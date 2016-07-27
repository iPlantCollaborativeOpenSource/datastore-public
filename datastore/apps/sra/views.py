import json
import logging
import time
import urllib
import jwt
import markdown
import requests
from datetime import date
from os.path import basename, splitext
from django.core.cache import cache
from django.http import HttpResponse, HttpResponseRedirect, HttpResponseBadRequest, HttpResponseNotFound, StreamingHttpResponse
from django.http import JsonResponse
from django.shortcuts import render
import settings as sra_settings

logger = logging.getLogger(__name__)

CACHE_EXPIRATION = 900  # 15 minutes


def _check_path(path):
    path = str(path)
    if path[-1:] == '/':
        path = path[:-1]
    path = urllib.unquote(path).decode('utf8')
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
    path =_check_path(path)

    cache_key = urllib.quote_plus(path + '_page_' + str(page))
    cache_value = cache.get(cache_key)
    logger.info('{} - cache value:{}'.format(cache_key, cache_value))
    if not cache_value:
        url = sra_settings.DE_API_HOST + '/terrain/secured/filesystem/stat'
        payload = {'paths': [str(path)]}

        de_response = send_request('POST', url=url, payload=payload)

        if de_response.status_code != 200:
            # return de_response.raw
            return HttpResponse(de_response.reason + ' -- ' + de_response.content, status=de_response.status_code)

        data = de_response.json()['paths'][path]
        metadata = get_metadata(request, data['id'])

        collection = {}
        if data['type'] == 'dir':
            collection = get_collection(request, path, int(page))

        cache_value = data
        cache_value['metadata'] = metadata
        cache_value['collection'] = collection

        cache.set(cache_key, cache_value, CACHE_EXPIRATION)

    return JsonResponse(cache_value)


def get_metadata(request, id):
    cache_key = urllib.quote_plus('collection_id_' + id)
    metadata = cache.get(cache_key)
    if not metadata:
        url= sra_settings.DE_API_HOST + '/terrain/secured/filesystem/' + str(id) + '/metadata'
        de_response = send_request('GET', url=url)

        if de_response.status_code == 200:
            de_meta = de_response.json()

            try:
                template_meta = de_meta['avus']
            except IndexError: #there is no template metadata
                template_meta=[]

            irods_meta = de_meta['irods-avus']

        else: #something is wrong with DE metadata endpoint
            irods_meta=[{"attr": "Error", "value": de_response.reason}]
            template_meta=[]

        metadata = {
            'irods': irods_meta,
            'template': template_meta,
        }
        cache.set(cache_key, metadata, CACHE_EXPIRATION)
    return metadata


def download_metadata(request, id):
    metadata = get_metadata(request, id)
    flat_metadata = metadata['irods'].copy()
    flat_metadata.update(metadata['template'])

    return StreamingHttpResponse(flat_metadata, content_type=de_response.headers['Content-Type'])

def get_collection(request, path, page=1, id=None):
    path =_check_path(path)

    if id:
        cache_key = urllib.quote_plus('collection_and_meta_' + path + '_page_' + str(page))
    else: #just getting next page of collection
        cache_key = urllib.quote_plus('collection_' + path + '_page_' + str(page))
    collection = cache.get(cache_key)
    logger.info('cache_key: {} ---- cache_value: {}'.format(cache_key, collection))
    if not collection:
        PER_PAGE = 200

        page=int(page)
        offset = PER_PAGE * (page - 1)

        url= sra_settings.DE_API_HOST + '/terrain/secured/filesystem/paged-directory'
        params={
            'path': path,
            'limit': PER_PAGE,
            'offset': offset,
            'sort-col': 'name',
            'sort-dir': 'ASC'
            }

        de_response = send_request('GET', url=url, params=params)

        if de_response.status_code != 200:
            return HttpResponse(de_response.reason + ' -- ' + de_response.content, status=de_response.status_code)

        collection = de_response.json()
        metadata={}

        if id:
            metadata=get_metadata(request, id)

        if collection['total'] > PER_PAGE*page:
            collection['more_data'] = True
        else:
            collection['more_data'] = False

        if 'djng_url_kwarg_id' in request.GET or 'djng_url_kwarg_page' in request.GET: #this function was called by get_file_or_folder
            cache_value = {'collection': collection, 'metadata': metadata}
            cache.set(cache_key, cache_value, CACHE_EXPIRATION)
            return JsonResponse(cache_value)

        cache.set(cache_key, collection, CACHE_EXPIRATION)

    if 'djng_url_kwarg_id' in request.GET or 'djng_url_kwarg_page' in request.GET: #this function was called by get_file_or_folder
        return JsonResponse(collection)
    else:
        return collection


def serve_file(request, path=''):
    path =_check_path(path)

    url= sra_settings.DE_API_HOST + '/terrain/secured/fileio/download'
    params={
        'path': path,
        'chunk-size': 8000,
        'start': 0
        }

    de_response = send_request('GET', url=url, params=params)

    if de_response.status_code != 200:
        # return de_response.raw
        return HttpResponse(de_response.reason, status=de_response.status_code)

    return HttpResponse(de_response.content)


def download_file(request, path=''):
    path = _check_path(path)
    url= sra_settings.DE_API_HOST + '/terrain/secured/fileio/download'
    params={'path': path}

    de_response = send_request('GET', url=url, params=params, stream=True)

    if de_response.status_code != 200:
        return HttpResponse(de_response.reason, status=de_response.status_code)

    response = StreamingHttpResponse(de_response.content, content_type=de_response.headers['Content-Type'])
    response['Content-Disposition'] = de_response.headers['Content-Disposition']
    response['Accept-Ranges'] = 'bytes'

    return response


def markdown_view(request, path=''):
    path = _check_path(path)
    url= sra_settings.DE_API_HOST + '/terrain/secured/fileio/download'
    params={'path': path}

    de_response = send_request('GET', url=url, params=params)

    if de_response.status_code != 200:
        return HttpResponse(de_response.reason, status=de_response.status_code)

    ext = splitext(de_response.headers['Content-Disposition'])[1][1:].strip('"')

    if ext not in ['md', 'markdown']:
        return HttpResponseBadRequest()

    html = markdown.markdown(de_response.content)
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

    url = sra_settings.DE_API_HOST + '/terrain/secured/filesystem/stat'
    payload = {'paths': [str(path)]}

    de_response = send_request('POST', url=url, payload=payload)

    if de_response.status_code != 200:
        # return de_response.raw
        return HttpResponse(de_response.reason + ' -- ' + de_response.content, status=de_response.status_code)

    data = de_response.json()['paths'][path]

    if data['type'] == 'dir':
        logger.warn('Legacy URL for path %s satisfied from referer %s' % (path, request.META.get('HTTP_REFERER')))
        return HttpResponseRedirect('/browse' + path)
    elif data['type'] == 'file':
        logger.warn('Legacy URL for path %s satisfied from referer %s' % (path, request.META.get('HTTP_REFERER')))
        return HttpResponseRedirect('/download' + path)

    logger.warn('Legacy URL for path %s not satisfied from referer %s' % (path, request.META.get('HTTP_REFERER')))
    return HttpResponseNotFound('File does not exist')


def search_metadata(request):
    pass


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

    # query=json.dumps(
    #     {"bool":
    #         {"must":[
    #             {"nested":
    #                 {"path":"metadata",
    #                  "query":
    #                     {"query_string":
    #                         {"query": "*" + search_term + "*",
    #                          "fields":["metadata.value"]}
    #                     }
    #                 }
    #             }
    #         ]}
    #     })

    query=json.dumps(
        {"query":
            {"bool":
                 {"should":[
                    {"wildcard":
                        {"path":
                            {"value": "*" + search_term + "*"}
                        }
                    },
                    {"wildcard":
                        {"label":
                            {"value": "*" + search_term + "*"}
                        }
                    },
                    {"wildcard":
                        {"metadata.value":
                            {"value": "*" + search_term + "*"}
                        }
                    }
                 ]}
            }
        }
    )

    url = sra_settings.DE_API_HOST + '/terrain/secured/filesystem/index'
    params = {'q': query}

    resp = send_request('GET', url, params)

    return JsonResponse(resp.json())


def create_jwt_token():
    payload = {
        "iat": int(time.time()),
        "sub": 'anonymous',
        "email": 'test@email.com'
    }

    with open(sra_settings.DE_API_KEY_PATH, 'r') as api_key:
        shared_key = api_key.read()

    from cryptography.hazmat.primitives.serialization import load_pem_private_key
    from cryptography.hazmat.backends import default_backend

    key = load_pem_private_key(shared_key,
                               sra_settings.DE_API_KEY_PASSPHRASE, default_backend())

    jwt_string = jwt.encode(payload, key, algorithm='RS256')
    encoded_jwt = urllib.quote_plus(jwt_string)  # url-encode the jwt string

    return encoded_jwt


def send_request(http_method, url=None, params=None, stream=False, payload=None):
    encoded_jwt = create_jwt_token()
    headers = {'X-Iplant-De-Jwt': encoded_jwt}

    logger.info('url: {0}'.format(url))
    logger.info('params: {0}'.format(params))
    logger.info('jwt: {0}'.format(encoded_jwt))

    if payload:
        headers['Content-Type'] = 'application/json'
    if http_method.upper() == 'GET':
        response = requests.get(url, params=params, headers=headers, stream=stream)
    elif http_method.upper() == 'POST':
        data = json.dumps(payload)
        response = requests.post(url, data=data, params=params, headers=headers)
    elif http_method.upper() == 'PUT':
        data = json.dumps(payload)
        response = requests.put(url, data=data, params=params, headers=headers)
    elif http_method.upper() == 'DELETE':
        response = requests.delete(url, headers=headers)

    logger.info('{} - response time: {}'.format(url, response.elapsed))

    return response
