import copy
import datetime
import json
import logging
import time
import urllib
import jwt
import markdown
import requests
from requests import HTTPError
from os.path import splitext
from django.core.cache import cache
from django.http import HttpResponse, HttpResponseRedirect, HttpResponseBadRequest, HttpResponseNotFound, StreamingHttpResponse
from django.http import JsonResponse
from django.shortcuts import render
from datastore.libs.terrain.client import TerrainClient
from datastore.libs.anon_files.client import AnonFilesClient
import settings as sra_settings
from datastore.apps.sra.dictionary import data_dictionary, metadata_order

logger = logging.getLogger(__name__)

CACHE_EXPIRATION = 900  # 15 minutes


def _check_path(path):
    path = str(path)
    if path[-1:] == '/':
        path = path[:-1]
    path = urllib.unquote(path).decode('utf8')
    return path


def home(request, **kwargs):
    return render(request, 'sra/home.html')

def landing_page(request, **kwargs):
    return render(request, 'sra/landing.html')

def legacy_redirect(request, path=''):
    """
    The old mirrors site supported URLs of the form
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

    logger.warn('Legacy URL request for path %s from referer %s' % (path, request.META.get('HTTP_REFERER')))

    try:
        tc = TerrainClient('anonymous', 'anonymous@cyverse.org')
        path_stat = tc.get_file_or_folder(path)
        if 'error_code' in path_stat:
            logger.error('Error for path stat', extra={
                'path': path,
                'error_code': path_stat['error_code']
            })
            return HttpResponseNotFound(path_stat['error_code'])
        else:
            path_stat = path_stat['paths'][path]
            if path_stat['type'] == 'dir':
                return HttpResponseRedirect('/browse/' + path)
            elif path_stat['type'] == 'file':
                return HttpResponseRedirect('/download/' + path)
    except HTTPError as e:
        logger.exception('Failed to stat path', extra={'path': path})
        return HttpResponseBadRequest('Failed to stat path',
                                      content_type='application/json')


def api_stat(request, path):
    cache_key = '{}:{}'.format(urllib.quote_plus(path), 'stat')
    path_stat = None
    if len(cache_key) < 250:
        path_stat = cache.get(cache_key)
    if path_stat is None:
        try:
            tc = TerrainClient('anonymous', 'anonymous@cyverse.org')
            path_stat = tc.get_file_or_folder(path)
            path_stat = path_stat['paths'][path]
            if len(cache_key) < 250:
                cache.set(cache_key, path_stat, CACHE_EXPIRATION)
        except HTTPError as e:
            logger.exception('Failed to stat path', extra={'path': path})
            return HttpResponseBadRequest('Failed to stat path',
                                          content_type='application/json')
    return JsonResponse(path_stat)


def api_metadata(request, item_id, download=False):
    cache_key = '{}:{}'.format(item_id, 'metadata')
    result = None
    if len(cache_key) < 250:
        result = cache.get(cache_key)

    if result is None:
        try:
            tc = TerrainClient('anonymous', 'anonymous@cyverse.org')
            metadata = tc.get_metadata(item_id)
            avus = metadata['avus']+metadata['irods-avus']
            contributors = []

            readable_meta={}
            for item in avus: #get readable labels
                attr = item.get('attr')
                label = data_dictionary.get(attr, attr)
                value = item.get('value')

                my_dict = {}
                my_dict['attr'] = attr
                my_dict['label'] = label
                my_dict['value'] = value

                if (label not in readable_meta
                    and label != 'Contributor Type'
                    and label != 'Contributor'):
                    readable_meta[label] = my_dict
                elif label == 'Contributor Type' or label == 'Contributor':
                    contributors.append(my_dict)
                elif label not in readable_meta:
                    readable_meta[label] = my_dict
                elif readable_meta[label]['value']:
                    readable_meta[label]['value'] += ', {}'.format(value)
                else:
                    readable_meta[label]['value'] = value

            sorted_meta = []
            meta_copy = copy.copy(readable_meta)

            for item in metadata_order:
                if not isinstance(item, str):
                    key = item['key']
                    value = item['value']
                    if key in meta_copy and value in meta_copy:
                        if 'Additional Label' in item \
                            and meta_copy[key]['value'] \
                            and meta_copy[value]['value']:
                            label = item['Additional Label']
                            display_value = meta_copy[key]['value'] + ': ' + meta_copy[value]['value']
                        else:
                            label = meta_copy[key]['value']
                            display_value = meta_copy[value]['value']
                        sorted_meta.append({'key':label, 'value': display_value})
                        meta_copy.pop(key, None)
                        meta_copy.pop(value, None)
                elif item == 'Contributor':
                    for c in contributors:
                        sorted_meta.append({'key': c['label'], 'value': c['value']})
                elif item in meta_copy:
                    key = meta_copy[item]['label']
                    value = meta_copy[item]['value']
                    sorted_meta.append({'key':key, 'value':value})
                    meta_copy.pop(key, None)

            for others in meta_copy:
                sorted_meta.append({'key':readable_meta[others]['label'], 'value':readable_meta[others]['value']})

            result = {'sorted_meta': sorted_meta, 'metadata': readable_meta}
            if len(cache_key) < 250:
                cache.set(cache_key, result, CACHE_EXPIRATION)

        except HTTPError as e:
            logger.exception('Failed to retrieve metadata', extra={'id': item_id})
            return HttpResponseBadRequest('Failed to retrieve metadata',
                                          content_type='application/json')
    return JsonResponse(result, safe=False)


def api_list_item(request, path):
    path = _check_path(path)
    page = request.GET.get('page', 0)
    sort_col = request.GET.get('sort-col', 'NAME')
    sort_dir = request.GET.get('sort-dir', 'ASC')
    cache_key = '{}:{}:{}:sorted:{}-{}'.format(urllib.quote_plus(path), 'list_page', page, sort_col, sort_dir)
    logger.info(cache_key)
    list_resp = None
    if len(cache_key) < 250:
        list_resp = cache.get(cache_key)

    if list_resp is None:
        try:
            tc = TerrainClient('anonymous', 'anonymous@cyverse.org')
            list_resp = tc.get_contents(path, page=page, sort_col=sort_col, sort_dir=sort_dir)
            if len(cache_key) < 250:
                cache.set(cache_key, list_resp, CACHE_EXPIRATION)
        except HTTPError as e:
            logger.exception('Failed to list contents for path', extra={'path': path})
            return HttpResponseBadRequest('Failed to list contents',
                                          content_type='application/json')
    return JsonResponse(list_resp)


def api_preview_file(request, path):
    try:
        af = AnonFilesClient()
        response = af.download(path, stream=True, headers={'Range': 'bytes=0-8192'})
        return StreamingHttpResponse(response.content)
    except HTTPError as e:
        logger.exception('Failed to preview file', extra={'path': path})
        return HttpResponseBadRequest('Failed to preview file',
                                      content_type='application/json')


def download_file_anon(request, path):
    try:
        af = AnonFilesClient()
        redirect_url = af.download_url(path)
        return HttpResponseRedirect(redirect_to=redirect_url)
    except HTTPError as e:
        logger.exception('Failed to preview file', extra={'path': path})
        return HttpResponseBadRequest('Failed to preview file',
                                      content_type='application/json')


def search(request):
    search_term = request.GET.get('search_term')
    query={
        "all": [
            {"type": "path",
            "args": {"prefix": "/iplant/home/shared"}
            }
        ],
        "any": [
            {"type": "label",
            "args": {"exact": False, "label": search_term}
            },
            {"type": "metadata",
            "args": {"value": search_term}
            }
        ]
    }

    tc = TerrainClient('anonymous', 'anonymous@cyverse.org')
    list_resp = tc.search(query)
    files=[]
    folders=[]
    matches=[]

    for item in list_resp['hits']:
        if item['_type'] == 'file':
            files.append({
                'path': item['_source']['path'].lstrip('/'),
                'label': item['_source']['label'],
                'filesize': item['_source']['fileSize'],
                'dateCreated': datetime.datetime.fromtimestamp(item['_source']['dateCreated']/1000.0),
                'dateModified': datetime.datetime.fromtimestamp(item['_source']['dateModified']/1000.0),
            })
            matches.append({
                'path': item['_source']['path'].lstrip('/'),
                'label': item['_source']['label'],
                'filesize': item['_source']['fileSize'],
                'dateCreated': datetime.datetime.fromtimestamp(item['_source']['dateCreated']/1000.0),
                'dateModified': datetime.datetime.fromtimestamp(item['_source']['dateModified']/1000.0),
                'type': item['_type']
            })

        elif item['_type'] == 'folder':
            folders.append({
                'path': item['_source']['path'].lstrip('/'),
                'label': item['_source']['label'],
                'dateCreated': datetime.datetime.fromtimestamp(item['_source']['dateCreated']/1000.0),
                'dateModified': datetime.datetime.fromtimestamp(item['_source']['dateModified']/1000.0),
            })
            matches.append({
                'path': item['_source']['path'].lstrip('/'),
                'label': item['_source']['label'],
                'dateCreated': datetime.datetime.fromtimestamp(item['_source']['dateCreated']/1000.0),
                'dateModified': datetime.datetime.fromtimestamp(item['_source']['dateModified']/1000.0),
                'type': item['_type']
            })
    return render(request, 'sra/search.html',{'folders':folders, 'files':files, 'matches':matches, 'search_term':search_term})
