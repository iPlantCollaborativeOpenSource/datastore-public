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

#@view_config(route_name='home', renderer='templates/mytemplate.pt')
#def my_view(request):
#    try:
#        one = DBSession.query(MyModel).filter(MyModel.name == 'one').first()
#    except DBAPIError:
#        return Response(conn_err_msg, content_type='text/plain', status_int=500)
#    return {'one': one, 'project': 'sra'}

@view_config(route_name='home', renderer='templates/home.pt')
@view_config(route_name='browse', renderer='templates/home.pt')
def home(request):
    return {
        'root': request.registry.settings['irods.path'],
        'root_name': basename(request.registry.settings['irods.path']),
        'metadata_prefix': request.registry.settings['datastore.metadata_prefix'],
        'year': date.today().year,
    }

# deprecated
#@view_config(route_name='studies', renderer='json')
#def show_studies(request):
#    def format_study(study):
#        return {
#            'id': study.name,
#            'path': study.path,
#            'url': request.route_path('study', study_id=study.name),
#            'title': study.metadata.getone('title')[0],
#            'abstract': study.metadata.getone('abstract')[0],
#            'description': study.metadata.getone('description')[0] if 'description' in study.metadata else None,
#        }
#
#    collection = DataStoreSession.get_collection(request.registry.settings['irods.path'] + '/sra')
#    return map(format_study, collection.get_subcollections())

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
    
@view_config(route_name='file_tree')
def file_tree(request):
    if not 'dir' in request.POST:
        raise HTTPBadRequest()
    dir_name = str(request.POST['dir'])
    if dir_name[-1] == '/':
        dir_name = dir_name[:-1]

    try:
        coll = DataStoreSession.collections.get(dir_name)
    except CollectionDoesNotExist:
        raise HTTPNotFound()

    def coll_to_li(coll):
        return '<li class="directory collapsed"><a href="#" rel="%s/">%s</a></li>' % (coll.path, coll.name)

    def file_obj_to_li(f):
        ext = splitext(f.name)[1][1:]
        return '<li class="file ext_%s"><a href="#" rel="%s">%s</a></li>' % (ext, f.path, f.name)

    resp = "\n".join(map(coll_to_li, coll.subcollections) + map(file_obj_to_li, coll.data_objects))
    
    resp = '<ul class="jqueryFileTree" style="display: none;">' + resp + '</ul>'
    return Response(resp)

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
        logger.info("Legacy URL for path %s satisfied from referer %s" % (path, request.referer))
        logger.debug("found dir")
        raise HTTPFound("/browse" + path)
    except CollectionDoesNotExist:
        try:
            obj = DataStoreSession.data_objects.get(str(path))
            logger.debug("found file")
            raise HTTPFound("/download" + path)
        except DataObjectDoesNotExist:
            raise HTTPNotFound("File does not exist")

    logger.warn("Legacy URL for path %s not satisfied from referer %s" % (path, request.referer))

    raise HTTPNotFound("File does not exist")

conn_err_msg = """\
Pyramid is having a problem using your SQL database.  The problem
might be caused by one of the following things:

1.  You may need to run the "initialize_sra_db" script
    to initialize your database tables.  Check your virtual 
    environment's "bin" directory for this script and try to run it.

2.  Your database server may not be running.  Check that the
    database server referred to by the "sqlalchemy.url" setting in
    your "development.ini" file is running.

After you fix the problem, please restart the Pyramid application to
try it again.
"""

