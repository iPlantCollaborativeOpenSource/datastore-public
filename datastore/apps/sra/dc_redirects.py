"""
Redirects from the legacy curated tree to the new Data Commons (dc.cyverse.org).

The new Data Commons only shows the first level of each dataset folder, so any
deeper legacy path is sent to the first-level item it lives under:

  /iplant/home/shared/commons_repo                      -> /organization/cyverse
  /iplant/home/shared/commons_repo/curated              -> /organization/cyverse
  .../curated/<Folder>                                  -> /dataset/<name>
  .../curated/<Folder>/<child>[/anything/deeper]        -> /dataset/<name>/resource/<id>

The dataset is looked up live. dc.cyverse.org is populated from the curated
folders by kando's AVU sync (https://github.com/cyverse/data-commons,
kando/sync), which names each dataset from the folder's Terrain title, so the
same rule is applied to the folder's Terrain metadata and the name is checked
with CKAN's package_search. The child's resource is found with resource_search.

Anything that doesn't resolve to dc.cyverse.org (a folder that hasn't been
migrated, or Terrain/CKAN not answering in time) is served by the legacy site
instead. A child that isn't on dc.cyverse.org goes to its dataset page.
Lookups are cached, misses for less time so newly synced datasets show up soon.
"""
import hashlib
import logging
import os
import urllib

import requests
from django.core.cache import cache

from datastore.libs.terrain import settings as terrain_settings

logger = logging.getLogger(__name__)

COMMONS_REPO = '/iplant/home/shared/commons_repo'
CURATED = COMMONS_REPO + '/curated'

DC_HOST = os.getenv('DC_REDIRECT_HOST', 'https://dc.cyverse.org').rstrip('/')
ORGANIZATION_URL = DC_HOST + '/organization/cyverse'

# kando builds resource URLs as WEB_DAV_URL + the Terrain path.
DAV_PREFIX = 'https://data.cyverse.org/dav-anon'

ENABLED = os.getenv('DC_REDIRECTS_ENABLED', 'True') == 'True'

# 302 while the migration is in progress, so browsers don't cache redirects
# for datasets whose mapping may still change.
PERMANENT = os.getenv('DC_REDIRECTS_PERMANENT', 'False') == 'True'

CACHE_SECONDS = int(os.getenv('DC_REDIRECT_CACHE_SECONDS', '3600'))
# Shorter, so a newly migrated dataset starts redirecting soon after kando syncs it.
MISS_CACHE_SECONDS = int(os.getenv('DC_REDIRECT_MISS_CACHE_SECONDS', '300'))
TIMEOUT = float(os.getenv('DC_REDIRECT_TIMEOUT', '5'))

TITLE_KEYS = ('title', 'Title', 'datacite.title')
_MISS = 'none'


class DCLookupError(Exception):
    """Terrain or CKAN could not answer; nothing is cached."""


def _normalize(path):
    path = '/' + path.strip('/')
    while '//' in path:
        path = path.replace('//', '/')
    return path


def _quote(value):
    return urllib.quote(value.encode('utf8') if isinstance(value, unicode) else value, safe='')


# --- kando's naming rule (kando/sync/mapping.py and sync_avu.py) ----------------

def avus_to_dict(avus):
    """Collect Terrain AVUs the way kando's irods_client does."""
    metadata = {}
    for avu in avus:
        key, value = avu.get('attr', ''), avu.get('value', '')
        if not key:
            continue
        if key in metadata:
            existing = metadata[key]
            metadata[key] = existing + [value] if isinstance(existing, list) else [existing, value]
        else:
            metadata[key] = value
    return metadata


def get_title(metadata, folder_name):
    """The last of title/Title/datacite.title, stripped; the folder name if none."""
    title = None
    for key in TITLE_KEYS:
        if key in metadata:
            title = metadata[key]
    if title is None:
        return folder_name
    if isinstance(title, list):
        title = u', '.join(v.replace(u'\t', u'') for v in title)
    return title.replace(u'\t', u'').strip()


def get_name_from_title(title):
    name = u''.join(c if c.isalnum() or c in (u'-', u'_', u' ') else u''
                    for c in title.lower().replace(u' ', u'_'))
    return name[:100]


def candidate_names(metadata, folder_name):
    """The plain name, then the name kando creates when the plain one is taken."""
    name = get_name_from_title(get_title(metadata, folder_name))
    doi = metadata.get('identifier', '')
    if isinstance(doi, list):
        doi = doi[0]
    suffix = doi.replace('/', '-').replace('.', '-') if doi else folder_name[:20]
    return [name, name[:80] + u'_' + suffix[:19]]


def resource_folder(resource):
    """The curated folder kando built this resource's URL from, if any."""
    prefix = DAV_PREFIX + CURATED + '/'
    url = resource.get('url') or ''
    if not url.startswith(prefix):
        return None
    path = urllib.unquote(url[len(prefix):].encode('utf8')).decode('utf8')
    return path.split('/')[0].strip()


# --- live lookups -----------------------------------------------------------------

def _terrain(method, endpoint, **kwargs):
    url = u'{0}/terrain/filesystem/{1}'.format(terrain_settings.TERRAIN_API_HOST, endpoint)
    try:
        resp = requests.request(method, url, timeout=TIMEOUT, **kwargs)
    except requests.RequestException as e:
        raise DCLookupError('Terrain %s: %s' % (endpoint, e))
    if resp.status_code != 200:
        try:
            body = resp.json()
        except ValueError:
            body = {}
        if body.get('error_code') == 'ERR_DOES_NOT_EXIST':
            return None
        raise DCLookupError('Terrain %s returned %s' % (endpoint, resp.status_code))
    return resp.json()


def _ckan(action, params):
    try:
        resp = requests.get(u'{0}/api/3/action/{1}'.format(DC_HOST, action), params=params, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise DCLookupError('CKAN %s: %s' % (action, e))
    if resp.status_code != 200:
        raise DCLookupError('CKAN %s returned %s' % (action, resp.status_code))
    return resp.json()['result']


def _find_dataset(name):
    """Return {'id', 'name'} for a dataset name, or None. Only fetches those fields;
    package_show returns every resource, which is megabytes for large datasets."""
    result = _ckan('package_search', {'fq': u'name:"%s"' % name, 'rows': 1, 'fl': 'id,name'})
    for dataset in result.get('results', []):
        if dataset.get('name') == name:
            return {'id': dataset['id'], 'name': dataset['name']}
    return None


def lookup_folder(folder_name):
    """
    Return {'dataset': name, 'id': dataset id} for a curated folder, or None if
    it hasn't been migrated. Raises DCLookupError when Terrain or CKAN can't be
    reached.
    """
    if folder_name.startswith('_deprecated_'):
        return None  # kando never syncs these

    path = CURATED + '/' + folder_name
    stat = _terrain('POST', 'stat', json={'paths': [path]})
    if not stat:
        return None
    item = stat['paths'][path]
    if item.get('type') != 'dir':
        return None

    metadata = _terrain('GET', u'%s/metadata' % item['id'])
    metadata = avus_to_dict((metadata or {}).get('avus', []))

    for name in candidate_names(metadata, folder_name):
        dataset = _find_dataset(name)
        if dataset is not None:
            return {'dataset': dataset['name'], 'id': dataset['id']}
    return None


def lookup_resource(dataset_id, folder_name, child):
    """
    Return the id of the resource kando made for `child` of this folder, or None.

    kando names each resource after its Terrain label and builds its URL from
    the folder's path. Folders with the same title share one dataset, with each
    child added from whichever folder had it first, so a resource only counts if
    its URL comes from this folder. resource_search matches substrings, so the
    results are filtered exactly.
    """
    queries = [
        # Narrow: the child's own path; sorted by name, an exact match comes first.
        {'query': u'url:/curated/%s/%s' % (folder_name, child), 'order_by': 'name', 'limit': 25},
        # Some resource URLs have stray whitespace after the folder name.
        {'query': [u'name:%s' % child, u'url:/curated/%s' % folder_name], 'order_by': 'name', 'limit': 100},
    ]
    for params in queries:
        for resource in _ckan('resource_search', params).get('results', []):
            if (resource.get('name') == child and resource.get('package_id') == dataset_id
                    and resource_folder(resource) == folder_name):
                return resource['id']
    return None


def _cached(key, compute, *args):
    key = 'dc_redirect:' + hashlib.sha1(key.encode('utf8')).hexdigest()
    entry = cache.get(key)
    if entry is not None:
        return None if entry == _MISS else entry
    try:
        entry = compute(*args)
    except DCLookupError as e:
        logger.warning('DC redirect lookup failed for %s: %s', args, e)
        return None
    if entry is None:
        cache.set(key, _MISS, MISS_CACHE_SECONDS)
    else:
        cache.set(key, entry, CACHE_SECONDS)
    return entry


def resolve(path):
    """
    Return the dc.cyverse.org URL for a legacy data store path, or None when it
    doesn't resolve there (not migrated, or Terrain/CKAN unavailable), in which
    case the legacy page is served.
    """
    if not ENABLED:
        return None

    path = _normalize(path)
    if path == COMMONS_REPO or path == CURATED:
        return ORGANIZATION_URL
    if not path.startswith(COMMONS_REPO + '/'):
        return None
    if not path.startswith(CURATED + '/'):
        # commons_repo only holds curated/; anything else goes to the organization.
        return ORGANIZATION_URL

    parts = path[len(CURATED) + 1:].split('/')
    folder_name = parts[0]
    entry = _cached(u'folder:' + folder_name, lookup_folder, folder_name)
    if entry is None:
        return None

    url = '{0}/dataset/{1}'.format(DC_HOST, _quote(entry['dataset']))
    if len(parts) > 1 and parts[1]:
        resource_id = _cached(u'resource:%s/%s' % (folder_name, parts[1]),
                              lookup_resource, entry['id'], folder_name, parts[1])
        if resource_id:
            url += '/resource/' + _quote(resource_id)
    return url
