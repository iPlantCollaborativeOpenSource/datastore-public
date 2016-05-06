from django.core.cache import cache
from django.shortcuts import render
from django.http import HttpResponse, HttpResponseRedirect, HttpResponseBadRequest, HttpResponseNotFound, StreamingHttpResponse
from django.http import JsonResponse

from os.path import basename, splitext
from os import O_RDONLY
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
from irods.data_object import iRODSDataObjectFileRaw
from irods.exception import DataObjectDoesNotExist, CollectionDoesNotExist
from irods.manager.collection_manager import CollectionManager
from irods.models import Collection, CollectionMeta
from .models import DataStoreSession
from .content_types import content_types
from .file_iterable import FileIterable
from . import settings as sra_settings


logger = logging.getLogger(__name__)

CACHE_EXPIRATION = 900 #15 minutes
DE_HOST='https://everdene.iplantcollaborative.org/'

def _check_path(path):
    path = str(path)
    if path[-1:] == '/':
        path = path[:-1]
    return path

def home(request, path=''):
    context = {
        'root': sra_settings.irods['path'],
        'root_name': basename(sra_settings.irods['path']),
        'metadata_prefix': sra_settings.datastore['metadata_prefix'],
        'year': date.today().year,
    }
    return render(request, 'sra/home.html', context);


def get_file_or_folder(request, path, page=1):
    url = DE_HOST + 'terrain/secured/filesystem/stat'
    payload = {'paths': [str(path)]}

    de_response = send_request('POST', url=url, payload=payload)

    data = de_response.json()['paths'][path]
    metadata = get_metadata(request, data['id'])

    collection = {}
    if data['type'] == 'dir':
        collection = get_collection(request, path, int(page))

    response = data
    response['metadata'] = metadata
    response['collection'] = collection

    return JsonResponse(response)

def get_file(request, path):
    if not 'djng_url_kwarg_path' in request.GET:
        raise HttpResponseBadRequest()

    # path = _check_path(request.GET['path'])
    # logger.debug(path)

    cache_file_key = path + '_file_key'
    result = cache.get(cache_file_key)


    url= DE_HOST + '/secured/filesystem/directory'#'terrain/secured/filesystem/file/manifest'
    params={'path': path}
    # import pdb; pdb.set_trace()
    de_response = send_request('GET', url=url, params=params)
    import pdb; pdb.set_trace()
    logger.info('DE DIRECTORY RESPONSE: {0} {1} -------- {2}'.format(de_response.status_code, de_response.reason, de_response.json()))


    if not result:
        try:
            obj = DataStoreSession.collections.get(path)
        except CollectionDoesNotExist as e:
            try:
                obj = DataStoreSession.data_objects.get(path)
            except DataObjectDoesNotExist as e:
                logger.exception(e)
                return HttpResponseNotFound()

        logger.debug('obj: {}'.format(obj))

        uuid = obj.metadata.get_one('ipc_UUID').__dict__['value']

        # url= DE_HOST + 'terrain/secured/filesystem/' + str(uuid) + '/metadata'
        # # import pdb; pdb.set_trace()
        # de_response = send_request('GET', url=url)
        # logger.info('DE META RESPONSE: {0} {1} -------- {2}'.format(de_response.status_code, de_response.reason, de_response.json()))
        # if de_response.status_code == 200:
        #     de_meta = de_response.json()

        #     # if de_meta['error_code']:
        #     #     template_meta=[]
        #     #     irods_meta=[{"attr": "Error", "value": de_meta['reason']}]
        #     # else:
        #     #     try:
        #     #         template_meta = de_meta['metadata']['templates'][0]['avus']
        #     #     except IndexError: #there is no template metadata
        #     #         template_meta=[]
        #     #     irods_meta = de_meta['irods-avus']

        #     try:
        #         template_meta = de_meta['metadata']['templates'][0]['avus']
        #     except IndexError: #there is no template metadata
        #         template_meta=[]

        #     irods_meta = de_meta['irods-avus']

        # else: #something is wrong with DE metadata endpoint
        #     irods_meta=[{"attr": "Error", "value": de_response.reason}]
        #     template_meta=[]

        # response = {
        #     'name': obj.name,
        #     'path': obj.path,
        #     'metadata': irods_meta + template_meta,
        #     'is_dir': isinstance(obj, iRODSCollection),
        # }
        if isinstance(obj, iRODSDataObject):
            response['size'] = obj.size
            response['create_time'] = timegm(obj.create_time.utctimetuple())
            response['modify_time'] = timegm(obj.modify_time.utctimetuple())
            response['checksum'] = obj.checksum

            ext = splitext(obj.name)[1][1:]

            try:
                response['content_type'] = content_types[ext]
            except KeyError as e:
                pass #don't know mimetype

        result = JsonResponse(response)
        # cache.set(cache_file_key, result, CACHE_EXPIRATION)
    return result

def format_subcoll(coll):
    return {
        'name': coll.name,
        'path': coll.path,
        'is_dir': isinstance(coll, iRODSCollection)
    }

def get_metadata(request, id):
    url= DE_HOST + 'terrain/secured/filesystem/' + str(id) + '/metadata'
    # import pdb; pdb.set_trace()
    de_response = send_request('GET', url=url)
    # logger.info('DE META RESPONSE: {0} {1} -------- {2}'.format(de_response.status_code, de_response.reason, de_response.json()))
    if de_response.status_code == 200:
        de_meta = de_response.json()

        try:
            template_meta = de_meta['metadata']['templates'][0]['avus']
        except IndexError: #there is no template metadata
            template_meta=[]

        irods_meta = de_meta['irods-avus']

    else: #something is wrong with DE metadata endpoint
        irods_meta=[{"attr": "Error", "value": de_response.reason}]
        template_meta=[]

    metadata = {
        'irods': irods_meta + template_meta,
        'template': template_meta,
    }

    return metadata

def get_collection(request, path, page=1):
    PER_PAGE = 200
    # logger.info('get_collection request: {}'.format(request.GET))
    # if not 'djng_url_kwarg_path' in request.GET:
    #     return HttpResponseBadRequest()

    # path = _check_path(request.GET['path'])
    # page = int(request.GET.get('page', 1))

    offset = PER_PAGE * (page - 1)

    url= DE_HOST + 'terrain/secured/filesystem/paged-directory'
    params={
        'path': path,
        'limit': PER_PAGE,
        'offset': offset,
        'sort-col': 'name',
        'sort-dir': 'ASC'
        }

    collection = send_request('GET', url=url, params=params).json()

    logger.info('URL: {}'.format(url))
    logger.info('DE PAGING DIRECTORY RESPONSE: {0}'.format(collection))
    # logger.info('DE PAGING DIRECTORY RESPONSE: {0} {1} -------- {2}'.format(collection.status_code, collection.reason, collection.json()))

    metadata=get_metadata(request, collection['id'])

    if collection['total'] > PER_PAGE*page:
        collection['more_data'] = True
    else:
        collection['more_data'] = False

    return collection
    return JsonResponse({'collection': collection, 'metadata': metadata})
#  wont run right now
    try:
        cache_key = path + '_page_' + str(page)
        cache_value = cache.get(cache_key)

        if not cache_value:
            collection = DataStoreSession.collections.get(path)
            sub_collections = collection.subcollections
            objects = collection.data_objects_paging(PER_PAGE, offset)

            logger.debug(sub_collections)
            logger.debug(objects)

            cache_value = map(format_subcoll, sub_collections + objects)
            # cache.set(cache_key, cache_value, CACHE_EXPIRATION)

        next_page_cache_key = path + '_page_' + str(page + 1)
        next_page_cache_value = cache.get(next_page_cache_key)

        if not isinstance(next_page_cache_value, list):
            try:
              collection
            except NameError:
                collection = DataStoreSession.collections.get(path)
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
        return response

    except Exception as e:
        logger.exception('FAIL: %s' % e)
        return HttpResponse(status=500)


def serve_file(request, path=''):
    path =_check_path(path)

    try:
        obj = DataStoreSession.data_objects.get('/' + path)
    except DataObjectDoesNotExist:
        return HttpResponseNotFound()

    ext = splitext(obj.name)[1][1:]

    if ext in content_types:
        content_type = content_types[ext]
    else:
        content_type = 'application/octet-stream'

    if request.GET.get('preview') == 'true':
        conn, desc = obj.manager.open(obj.path, O_RDONLY)
        x = iRODSDataObjectFileRaw(conn, desc)
        f = x.conn.read_file(desc, 8000)
        return HttpResponse(f)

    f = obj.open('r')
    response = HttpResponse(f, content_type=content_type)
    response['Content-Length'] = obj.size
    return response


def download_file(request, path=''):
    path = _check_path(path)

    url= DE_HOST + 'terrain/secured/fileio/download'
    params={'path': path}

    de_response = send_request('GET', url=url, params=params)

    response = StreamingHttpResponse(de_response.content, content_type=de_response.headers['Content-Type'])
    # response['Content-Length'] = de_response.headers
    response['Content-Disposition'] = de_response.headers['Content-Disposition'] #'attachment; filename="%s"' % obj.name
    response['Accept-Ranges'] = 'bytes'

    # logger.info('DE RESPONSE: {0} {1} -------- {2}'.format(de_response.status_code, de_response.reason, de_response.json()))

    # try:
    #     obj = DataStoreSession.data_objects.get('/' + path)
    # except DataObjectDoesNotExist:
    #     return HttpResponseNotFound()

    # ext = splitext(obj.name)[1][1:]

    # if ext in content_types:
    #     content_type = content_types[ext]
    # else:
    #     content_type = 'application/octet-stream'

    # try:
    #     f = obj.open('r')
    # except KeyError as e:
    #     return HttpResponse('Download could not be completed.',status=500)

    # response = StreamingHttpResponse(f, content_type=content_type)
    # response['Content-Length'] = obj.size
    # response['Content-Disposition'] = 'attachment; filename="%s"' % obj.name
    # response['Accept-Ranges'] = 'bytes'

    return response


def markdown_view(request, path=''):
    path = _check_path(path)

    try:
        obj = DataStoreSession.data_objects.get('/' + path)
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

    path = _check_path(path)

    try:
        obj = DataStoreSession.collections.get(path)
        logger.warn('Legacy URL for path %s satisfied from referer %s' % (path, request.META.get('HTTP_REFERER')))
        return HttpResponseRedirect('/browse' + path)
    except CollectionDoesNotExist:
        try:
            obj = DataStoreSession.data_objects.get(path)
            logger.warn('Legacy URL for path %s satisfied from referer %s' % (path, request.META.get('HTTP_REFERER')))
            return HttpResponseRedirect('/download' + path)
        except DataObjectDoesNotExist:
            logger.warn('Legacy URL for path %s not satisfied from referer %s' % (path, request.META.get('HTTP_REFERER')))
            return HttpResponseNotFound('File does not exist')


def search_metadata(request):
    name = request.GET['name']
    value = request.GET.get('value')

    # if value and name:
    query_result = DataStoreSession.query(Collection).filter(CollectionMeta.name == name, CollectionMeta.value == value).all()
    # elif name:
    #     query_result = DataStoreSession.query(Collection).filter(CollectionMeta.name == name).all()
    # elif value:
    #     query_result = DataStoreSession.query(Collection).filter(CollectionMeta.value == value).all()

    results = [iRODSCollection(CollectionManager, row) for row in query_result]
    logger.info('query result: {0}'.format(query_result))

    return JsonResponse(map(format_subcoll, results), safe=False)


def search(request):
    # name = request.GET['search_term']
    search_term = request.GET.get('search_term', '*rice*')

    #trying to use DE API -- experimental
    # query=json.dumps(
    #     {"wildcard":
    #         {"label":"BioSample_1_2"}
    #     }
    # )

    # query=json.dumps(
    #     {"match":
    #         {"metadata.attribute":"BioProject Number"} #doesn't work, but label:BioProject_1 does
    #     }
    # )

    #     # {
    #     #       "filtered": {
    #     #          "query": {
    #     #             "match_all": {}
    #     #          },
    #     #          "filter": {
    #     #             "term": {
    #     #                "metadata.value": "1BB8D567-43B8-4827-9016-B5767983F9EE"
    #     #             }
    #     #          }
    #     #       }
    #     # }
    # ) #not working

    # query=json.dumps(
    #     {'query_string':
    #         {"query": search_term,
    #          'fields':['path', 'label', 'metadata.value']
    #         }
    #     }
    # )

    # query=json.dumps(
    #     {"nested" : {
    #         "path" : "metadata",
    #         "query" : {
    #             "bool" : {
    #                 "must" : [
    #                     {
    #                         "match" : {"metadata.value" : "1_2"}
    #                     },
    #                     {
    #                         "match" : {"metadata.attribute" : "Fasta File Number"}
    #                     }
    #                 ]
    #             }
    #         }
    #     }}) #should we use DE api or irods?

    query=json.dumps(
        {"bool":
            {"must":[
                {"nested":
                    {"path":"metadata",
                     "query":
                        {"query_string":
                            {"query": "*" + search_term + "*",
                             "fields":["metadata.value"]}
                        }
                    }
                }
            ]}
        })

    url = DE_HOST + 'terrain/secured/filesystem/index'
    params = {'q': query}

    resp = send_request('GET', url, params)

    return JsonResponse(resp.json())


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


def send_request(http_method, url=None, params=None, payload=None):
    encoded_jwt = create_jwt_token()
    headers = {'X-Iplant-De-Jwt': encoded_jwt}

    # logger.info('url: {0}'.format(url))
    # logger.info('params: {0}'.format(params))
    logger.info('jwt: {0}'.format(encoded_jwt))

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

    # if response.status_code == 200:
    #     print response.json()
    logger.info('response time: {}'.format(response.elapsed))
    return response
