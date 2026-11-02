"""
Redirects from the legacy curated tree to the new Data Commons (dc.cyverse.org).

The new Data Commons only shows the first level of each dataset folder, so any
deeper legacy path is sent to the first-level item it lives under:

  /iplant/home/shared/commons_repo                      -> /organization/cyverse
  /iplant/home/shared/commons_repo/curated              -> /organization/cyverse
  .../curated/<Folder>                                  -> /dataset/<name>
  .../curated/<Folder>/<child>[/anything/deeper]        -> /dataset/<name>/resource/<id>

Folders that have not been migrated yet are not in the map and keep being
served by this site. The map is built by `manage.py build_dc_redirects`.
"""
import json
import logging
import os
import urllib

logger = logging.getLogger(__name__)

COMMONS_REPO = '/iplant/home/shared/commons_repo'
CURATED = COMMONS_REPO + '/curated'

DC_HOST = os.getenv('DC_REDIRECT_HOST', 'https://dc.cyverse.org').rstrip('/')
ORGANIZATION_URL = DC_HOST + '/organization/cyverse'

MAP_PATH = os.getenv('DC_REDIRECT_MAP', os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'dc_redirects.json'))

ENABLED = os.getenv('DC_REDIRECTS_ENABLED', 'True') == 'True'

# 302 while the migration is in progress, so browsers don't cache redirects
# for datasets whose mapping may still change.
PERMANENT = os.getenv('DC_REDIRECTS_PERMANENT', 'False') == 'True'

_loaded = {'mtime': None, 'datasets': {}}


def _normalize(path):
    path = '/' + path.strip('/')
    while '//' in path:
        path = path.replace('//', '/')
    return path


def load_map():
    """Return the folder -> dataset map, reloading the file when it changes."""
    try:
        mtime = os.path.getmtime(MAP_PATH)
    except OSError:
        if _loaded['mtime'] is not None:
            logger.error('DC redirect map %s is missing; using last loaded copy', MAP_PATH)
        return _loaded['datasets']

    if mtime != _loaded['mtime']:
        try:
            with open(MAP_PATH) as f:
                _loaded['datasets'] = json.load(f)['datasets']
            _loaded['mtime'] = mtime
        except (IOError, ValueError, KeyError):
            logger.exception('Failed to load DC redirect map %s', MAP_PATH)
    return _loaded['datasets']


def _quote(value):
    return urllib.quote(value.encode('utf8') if isinstance(value, unicode) else value, safe='')


def resolve(path):
    """Return the dc.cyverse.org URL for a legacy data store path, or None."""
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
    entry = load_map().get(parts[0])
    if entry is None:
        return None

    url = '{0}/dataset/{1}'.format(DC_HOST, _quote(entry['dataset']))
    if len(parts) > 1:
        resource_id = entry.get('resources', {}).get(parts[1])
        if resource_id:
            url += '/resource/' + _quote(resource_id)
    return url
