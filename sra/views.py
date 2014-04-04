from os.path import basename, splitext
import logging
from datetime import date
from calendar import timegm

from pyramid.response import Response
from pyramid.view import view_config
from pyramid.httpexceptions import HTTPBadRequest, HTTPNotFound, HTTPNotImplemented, HTTPFound

import markdown

from sqlalchemy.exc import DBAPIError

from irods.collection import iRODSCollection, iRODSDataObject
from irods.exception import DataObjectDoesNotExist, CollectionDoesNotExist

from .models import (
    DBSession,
    MyModel,
    DataStoreSession,
)
from .content_types import content_types
from sra.file_iterable import FileIterable

logger = logging.getLogger(__name__)

@view_config(route_name='home', renderer='templates/home.pt')
@view_config(route_name='browse', renderer='templates/home.pt')
def home(request):
    return {
        'root': request.registry.settings['irods.path'],
        'root_name': basename(request.registry.settings['irods.path']),
        'metadata_prefix': request.registry.settings['datastore.metadata_prefix'],
        'year': date.today().year,
    }

@view_config(route_name='file', renderer='json')
def get_collection(request):
    if not 'path' in request.GET:
        raise HTTPBadRequest()
    path = request.GET['path']
    logger.debug(path)

    try:
        obj = DataStoreSession.collections.get(str(path))
    except CollectionDoesNotExist:
        try: 
            obj = DataStoreSession.data_objects.get(str(path))
        except DataObjectDoesNotExist:
            raise HTTPNotFound()

    logger.debug(obj)

    response = {
        'name': obj.name,
        'path': obj.path,
        'metadata': [m.__dict__ for m in obj.metadata.items()],
        'is_dir': isinstance(obj, iRODSCollection),
    }
    if isinstance(obj, iRODSDataObject):
        response['size'] = obj.size
        response['create_time'] = timegm(obj.create_time.utctimetuple())
        response['modify_time'] = timegm(obj.modify_time.utctimetuple())
        response['checksum'] = obj.checksum
    return response

@view_config(route_name='children', renderer='json')
def get_children(request):
    if not 'path' in request.GET:
        raise HTTPBadRequest()
    path = request.GET['path']

    collection = DataStoreSession.collections.get(str(path))
    sub_collections = collection.subcollections
    objects = collection.data_objects
    logger.debug(sub_collections)
    logger.debug(objects)

    def format_subcoll(coll):
        return {
            'name': coll.name,
            'path': coll.path,
            'is_dir': isinstance(coll, iRODSCollection)
        }

    return map(format_subcoll, sub_collections + objects)
    
@view_config(route_name='download_file')
def download_file(request):
    path = request.matchdict['path']
    path = "/" +  "/".join(path)
    try:
        obj = DataStoreSession.data_objects.get(str(path))
    except DataObjectDoesNotExist:
        raise HTTPNotFound()

    f = obj.open('r')
    iterator = FileIterable(f)
    content_length = obj.size
    if request.range:
        cr = request.range.content_range(obj.size)
        #logger.debug(cr.start)
        #logger.debug(cr.stop)
        #logger.debug(cr.length)
        iterator.start = cr.start
        iterator.stop = cr.stop
        content_length = cr.stop - cr.start

    return Response(
        content_disposition='attachment; filename="%s"' % obj.name,
        content_type='application/octet-stream', 
        content_length=content_length,
        accept_ranges='bytes',
        app_iter=iterator
    )

@view_config(route_name='serve_file')
def serve_file(request):
    path = request.matchdict['path']
    path = "/" +  "/".join(path)
    try:
        obj = DataStoreSession.data_objects.get(str(path))
    except DataObjectDoesNotExist:
        raise HTTPNotFound()

    ext = splitext(obj.name)[1][1:]

    if ext not in content_types:
        raise HTTPNotImplemented()

    f = obj.open('r')
    return Response(
        content_type=content_types[ext],
        content_length=obj.size,
        app_iter=FileIterable(f)
    )

@view_config(route_name='markdown')
def as_markdown(request):
    path = request.matchdict['path']
    path = "/" +  "/".join(path)
    try:
        obj = DataStoreSession.data_objects.get(str(path))
    except DataObjectDoesNotExist:
        raise HTTPNotFound()

    ext = splitext(obj.name)[1][1:]

    if ext not in ['md', 'markdown']:
        raise HTTPBadRequest()

    with obj.open('r') as f:
        html = markdown.markdown(f.read())
    return Response(
        html,
        content_type='text/html',
        content_length=len(html)
    )

@view_config(route_name='legacy')
def redirect_legacy_urls(request):
    """
    The old mirror site supported URLs of the form
    http://mirrors.iplantcollaborative.org//iplant_public_test/analyses
    for viewing directories, and
    http://mirrors.iplantcollaborative.org//iplant_public_test/status.php
    for download files.
    This redirects the former to /browse/path/to/dir and the latter to
    /download/path/to/file. Returns 404 if it's a bad path
    """
    path = request.matchdict['path']
    path = request.registry.settings['irods.path'] + '/' + path

    # TODO: stop using try/except for flow control
    try:
        obj = DataStoreSession.collections.get(str(path))
        logger.warn("Legacy URL for path %s satisfied from referer %s" % (path, request.referer))
        raise HTTPFound("/browse" + path)
    except CollectionDoesNotExist:
        try:
            obj = DataStoreSession.data_objects.get(str(path))
            logger.warn("Legacy URL for path %s satisfied from referer %s" % (path, request.referer))
            raise HTTPFound("/download" + path)
        except DataObjectDoesNotExist:
            logger.warn("Legacy URL for path %s not satisfied from referer %s" % (path, request.referer))
            raise HTTPNotFound("File does not exist")
