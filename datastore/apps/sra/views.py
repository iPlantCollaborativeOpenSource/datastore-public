from django.core.cache import cache
from django.shortcuts import render
from django.http import HttpResponse, HttpResponseRedirect, HttpResponseBadRequest, HttpResponseNotFound, StreamingHttpResponse
from django.http import JsonResponse

from os.path import basename, splitext
import logging
from datetime import date
from calendar import timegm

import markdown
import urllib
import urllib2
import json
import jwt
import requests
import time

from irods.collection import iRODSCollection, iRODSDataObject
from irods.exception import DataObjectDoesNotExist, CollectionDoesNotExist
from irods.manager.collection_manager import CollectionManager
from irods.models import Collection, CollectionMeta
from .models import DataStoreSession
from .content_types import content_types
from .file_iterable import FileIterable
from . import settings as sra_settings


logger = logging.getLogger(__name__)
GOOGLE_RECAPTCHA_SITE_KEY = "6LerigwTAAAAABUYsV5WQoBBTZS58d7LfgE7I1yt"
GOOGLE_RECAPTCHA_SECRET_KEY = "6LerigwTAAAAABTFBYCADArZ-pitvBo2oP-4f-6e"
CACHE_EXPIRATION = 900 #15 minutes


def home(request, path=''):
    context = {
        'root': sra_settings.irods['path'],
        'root_name': basename(sra_settings.irods['path']),
        'metadata_prefix': sra_settings.datastore['metadata_prefix'],
        'year': date.today().year,
    }
    return render(request, 'sra/home.html', context);


def get_file(request):
    if not 'path' in request.GET:
        raise HttpResponseBadRequest()

    path = request.GET['path']
    logger.debug(path)

    cache_file_key = str(path) + '_file_key'
    result = cache.get(cache_file_key)

    if not result:
        try:
            obj = DataStoreSession.collections.get(str(path))
        except CollectionDoesNotExist as e:
            try:
                obj = DataStoreSession.data_objects.get(str(path))
            except DataObjectDoesNotExist as e:
                logger.exception(e)
                return HttpResponseNotFound()

        logger.debug(obj)

        uuid = obj.metadata.get_one('ipc_UUID').__dict__['value']
        uuid = 'e494f3c0-e20f-11e3-b86f-6abdce5a08d5' #for testing (everdene can't see prod data)
        de_meta = send_request('GET', str(uuid))
        template_meta = de_meta['metadata']['templates'][0]
        template_meta = template_meta['avus']

        irods_meta = de_meta['irods-avus']
        irods_meta = [m.__dict__ for m in obj.metadata.items()] #for testing - want to show correct irods data

        response = {
            'name': obj.name,
            'path': obj.path,
            'metadata': irods_meta + template_meta, #[m.__dict__ for m in obj.metadata.items()],
            'is_dir': isinstance(obj, iRODSCollection),
        }
        if isinstance(obj, iRODSDataObject):
            response['size'] = obj.size
            response['create_time'] = timegm(obj.create_time.utctimetuple())
            response['modify_time'] = timegm(obj.modify_time.utctimetuple())
            response['checksum'] = obj.checksum

        result = JsonResponse(response)
        # cache.set(cache_file_key, result, CACHE_EXPIRATION)
    return result

def format_subcoll(coll):
    return {
        'name': coll.name,
        'path': coll.path,
        'is_dir': isinstance(coll, iRODSCollection)
    }

def get_collection(request):
    PER_PAGE = 200

    if not 'path' in request.GET:
        return HttpResponseBadRequest()

    path = request.GET['path']
    page = int(request.GET.get('page', 1))

    offset = PER_PAGE * (page - 1)

    try:
        cache_key = str(path) + '_page_' + str(page)
        cache_value = cache.get(cache_key)

        if not cache_value:
            collection = DataStoreSession.collections.get(str(path))
            sub_collections = collection.subcollections
            objects = collection.data_objects_paging(PER_PAGE, offset)

            logger.debug(sub_collections)
            logger.debug(objects)

            cache_value = map(format_subcoll, sub_collections + objects)
            # cache.set(cache_key, cache_value, CACHE_EXPIRATION)

        next_page_cache_key = str(path) + '_page_' + str(page + 1)
        next_page_cache_value = cache.get(next_page_cache_key)

        if not isinstance(next_page_cache_value, list):
            try:
              collection
            except NameError:
                collection = DataStoreSession.collections.get(str(path))
                sub_collections = collection.subcollections

            next_page_objects = collection.data_objects_paging(PER_PAGE, int(offset+PER_PAGE))
            next_page_cache_value = map(format_subcoll, next_page_objects)
            # cache.set(next_page_cache_key, next_page_cache_value, CACHE_EXPIRATION)

        if next_page_cache_value:
            more_data = True
        else:
            more_data = False

        json={'models': cache_value,
            'more_data': more_data,
            'page': page}

        response = JsonResponse(json, safe=False)
        # import pdb; pdb.set_trace()
        return response

    except Exception as e:
        logger.exception('FAIL: %s' % e)
        return HttpResponse(status=500)


def serve_file(request, path=''):
    try:
        obj = DataStoreSession.data_objects.get('/' + str(path))
    except DataObjectDoesNotExist:
        return HttpResponseNotFound()

    ext = splitext(obj.name)[1][1:]

    if ext not in content_types:
        return HttpResponse('File type not supported', status=501)

    f = obj.open('r')

    response = HttpResponse(f, content_type=content_types[ext])
    response['Content-Length'] = obj.size
    return response

def verify_recaptcha(request, path=''):
    # verify the google recaptcha success
    url = "https://www.google.com/recaptcha/api/siteverify"
    values = {
        'secret': GOOGLE_RECAPTCHA_SECRET_KEY,
        'response': request.POST.get(u'g-recaptcha-response', None),
        'remoteip': request.META.get("REMOTE_ADDR", None),
    }
    data = urllib.urlencode(values)
    req = urllib2.Request(url, data)
    response = urllib2.urlopen(req)
    result = json.loads(response.read())

    # result['success'] will be True on a success
    if result['success']:
        return 'verified'

    return result['error-codes']

def download_file(request, path=''):
    recaptcha_status = ''

    if not request.COOKIES.has_key('recaptcha_status'):
        recaptcha_status = verify_recaptcha(request)
        if recaptcha_status != 'verified':
            return HttpResponse(recaptcha_status)

    try:
        obj = DataStoreSession.data_objects.get('/' + str(path))
    except DataObjectDoesNotExist:
        return HttpResponseNotFound()

    ext = splitext(obj.name)[1][1:]

    if ext in content_types:
        content_type = content_types[ext]
    else:
        content_type = 'application/octet-stream'

    try:
        f = obj.open('r')
    except KeyError as e:
        return HttpResponse('Download could not be completed.',status=500)

    response = StreamingHttpResponse(f, content_type=content_type)
    response['Content-Length'] = obj.size
    response['Content-Disposition'] = 'attachment; filename="%s"' % obj.name
    response['Accept-Ranges'] = 'bytes'

    if recaptcha_status:
        max_age = 365*24*60*60  #one year
        response.set_cookie('recaptcha_status', recaptcha_status, max_age=max_age )

    return response


def markdown_view(request, path=''):
    try:
        obj = DataStoreSession.data_objects.get('/' + str(path))
    except DataObjectDoesNotExist:
        return HttpResponseNotFound()

    ext = splitext(obj.name)[1][1:]


    if ext not in ['md', 'markdown']:
        return HttpResponseBadRequest()

    with obj.open('r') as f:
        html = markdown.markdown(f.read())
    response = HttpResponse(html, content_type='text/html')
    response['Content-Length'] = len(html)
    return response


def legacy_redirect(request, path=''):
    """
    The old mirror site supported URLs of the form
    http://mirrors.iplantcollaborative.org//iplant_public_test/analyses
    for viewing directories, and
    http://mirrors.iplantcollaborative.org//iplant_public_test/status.php
    for download files.
    This redirects the former to /browse/path/to/dir and the latter to
    /download/path/to/file. Returns 404 if it's a bad path
    """
    if path[0] == '/':
        path = sra_settings.irods['path'] + path
    else:
        path = sra_settings.irods['path'] + '/' + path

    try:
        obj = DataStoreSession.collections.get(str(path))
        logger.warn('Legacy URL for path %s satisfied from referer %s' % (path, request.META.get('HTTP_REFERER')))
        return HttpResponseRedirect('/browse' + path)
    except CollectionDoesNotExist:
        try:
            obj = DataStoreSession.data_objects.get(str(path))
            logger.warn('Legacy URL for path %s satisfied from referer %s' % (path, request.META.get('HTTP_REFERER')))
            return HttpResponseRedirect('/download' + path)
        except DataObjectDoesNotExist:
            logger.warn('Legacy URL for path %s not satisfied from referer %s' % (path, request.META.get('HTTP_REFERER')))
            return HttpResponseNotFound('File does not exist')


def search_metadata(request):
    name = request.GET['name']
    value = request.GET.get('value')

    if value:
        query_result = DataStoreSession.query(Collection).filter(CollectionMeta.name == name, CollectionMeta.value == value).all()
    else:
        query_result = DataStoreSession.query(Collection).filter(CollectionMeta.name == name).all()

    results = [iRODSCollection(CollectionManager, row) for row in query_result]

    return JsonResponse(map(format_subcoll, results), safe=False)


def create_jwt_token():
    payload = {
        "iat": int(time.time()),
        "sub": 'ipcdev',
        "email": 'test@email.com'
    }

    with open('privkey.pem', 'r') as priv_key:
        shared_key = priv_key.read()

    from cryptography.hazmat.primitives.serialization import load_pem_private_key
    from cryptography.hazmat.backends import default_backend

    key = load_pem_private_key(shared_key, 'mirrors', default_backend())

    # jwt_string = jwt.encode(payload, shared_key, algorithm='RS256')
    jwt_string = jwt.encode(payload, key, algorithm='RS256')
    encoded_jwt = urllib.quote_plus(jwt_string)  # url-encode the jwt string

    return encoded_jwt


def send_request(http_method, UUID=None, url=None, params=None, payload=None):
    encoded_jwt = create_jwt_token()
    headers = {'X-Iplant-De-Jwt': encoded_jwt}

    url = 'https://everdene.iplantcollaborative.org/terrain/secured/filesystem/' + UUID + '/metadata'
    print url

    if payload:
        headers['Content-Type'] = 'application/json'
    if http_method.upper() == 'GET':
        response = requests.get(url, params=params, headers=headers)
    elif http_method.upper() == 'POST':
        data = json.dumps(payload)
        response = requests.post(url, data=data, params=params, headers=headers)
    elif http_method.upper() == 'PUT':
        data = json.dumps(payload)
        response = requests.put(url, data=data, params=params, headers=headers)
    elif http_method.upper() == 'DELETE':
        response = requests.delete(url, headers=headers)

    print response.json()
    return response.json()
