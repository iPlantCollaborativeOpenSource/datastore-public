"""
Build the legacy-curated-folder -> dc.cyverse.org dataset map used by
datastore.apps.sra.dc_redirects.

dc.cyverse.org is populated from the curated folders by kando's AVU sync
(https://github.com/cyverse/data-commons, kando/sync). The dataset name is
derived from the folder's Terrain title, so the same rule is applied here:

1. Read the folder's AVUs from Terrain (`avus` only, multi-value attrs as lists).
2. Title: the last of `title`, `Title`, `datacite.title` that is present,
   joined with ", " if multi-valued, stripped; the folder name if none.
3. Name: lowercased, spaces -> underscores, keep only alphanumerics, `-`, `_`,
   truncated to 100 characters. If kando hit a name collision it appended the
   DOI (or folder name) as a suffix, so that name is tried second.

A name is only used once it is confirmed to exist on dc.cyverse.org. Each
first-level file and folder is a resource named after its Terrain label, which
gives the resource id for deeper links. Folders with the same title are synced
into one dataset; each of those keeps only the resources whose URL kando built
from its own path. `_deprecated_` folders are skipped, as kando skips them.

Run it again as more datasets are migrated; the site picks up the new file
without a restart.
"""
import datetime
import json
import os
import urllib

import requests
from django.core.management.base import BaseCommand

from datastore.apps.sra import dc_redirects
from datastore.libs.terrain import settings as terrain_settings

PAGE_SIZE = 500
# kando builds resource URLs as WEB_DAV_URL + the Terrain path.
DAV_PREFIX = 'https://data.cyverse.org/dav-anon'
TITLE_KEYS = ('title', 'Title', 'datacite.title')


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


def _clean(value):
    if isinstance(value, list):
        return [v.replace('\t', '') for v in value]
    return value.replace('\t', '')


def get_title(metadata, folder_name):
    """kando mapping.get_title, falling back to the folder name like sync_avu."""
    title = None
    for key in TITLE_KEYS:
        if key in metadata:
            title = _clean(metadata[key])
    if title is None:
        return folder_name
    if isinstance(title, list):
        title = u', '.join(title)
    return title.strip()


def get_name_from_title(title):
    """kando mapping.get_name_from_title."""
    name = u''.join(c if c.isalnum() or c in (u'-', u'_', u' ') else u''
                    for c in title.lower().replace(u' ', u'_'))
    return name[:100]


def collision_name(name, metadata, folder_name):
    """The name kando creates when the plain name is already in use."""
    doi = metadata.get('identifier', '')
    if isinstance(doi, list):
        doi = doi[0]
    suffix = doi.replace('/', '-').replace('.', '-') if doi else folder_name[:20]
    return name[:80] + u'_' + suffix[:19]


def resource_folder(resource):
    """The curated folder kando built this resource's URL from, if any."""
    prefix = DAV_PREFIX + dc_redirects.CURATED + '/'
    url = resource.get('url') or ''
    if not url.startswith(prefix):
        return None
    path = urllib.unquote(url[len(prefix):].encode('utf8')).decode('utf8')
    return path.split('/')[0].strip()


def candidate_names(metadata, folder_name):
    name = get_name_from_title(get_title(metadata, folder_name))
    return [name, collision_name(name, metadata, folder_name)]


class Command(BaseCommand):
    help = 'Build the curated folder -> dc.cyverse.org dataset redirect map.'

    def add_arguments(self, parser):
        parser.add_argument('--output', default=dc_redirects.MAP_PATH)
        parser.add_argument('--organization', default='cyverse')
        parser.add_argument('--dry-run', action='store_true',
                            help='Print the summary without writing the map.')

    def handle(self, *args, **options):
        datasets = dict((d['name'], d) for d in self.fetch_datasets(options['organization']))
        folders = self.list_curated_folders()

        mapping, unmatched, shared = self.build_mapping(folders, datasets)

        self.stdout.write('datasets on dc: %d' % len(datasets))
        self.stdout.write('curated folders: %d' % len(folders))
        self.stdout.write('mapped: %d' % len(mapping))
        self.stdout.write('datasets shared by several folders: %s' % shared)
        self.stdout.write('not on dc yet (served here): %d %s' % (len(unmatched), sorted(unmatched)))

        if options['dry_run']:
            return

        out = {
            'generated_at': datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z',
            'source': dc_redirects.DC_HOST,
            'datasets': mapping,
        }
        tmp = options['output'] + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(out, f, indent=1, sort_keys=True)
            f.write('\n')
        os.rename(tmp, options['output'])
        self.stdout.write('wrote %s' % options['output'])

    def build_mapping(self, folders, datasets):
        """
        folders:  {folder name: folder id} from the curated listing.
        datasets: {dataset name: CKAN dataset dict}.
        Returns (mapping, unmatched folder names, {dataset name: folders} for
        datasets that several folders were synced into).
        """
        unmatched, owners = [], {}
        for folder_name, folder_id in sorted(folders.items()):
            if folder_name.startswith('_deprecated_'):
                unmatched.append(folder_name)
                continue
            try:
                metadata = avus_to_dict(self.terrain_anonymous('GET', '%s/metadata' % folder_id).get('avus', []))
            except requests.RequestException as e:
                self.stderr.write('metadata for %s failed: %s' % (folder_name, e))
                unmatched.append(folder_name)
                continue

            name = next((n for n in candidate_names(metadata, folder_name) if n in datasets), None)
            if name is None:
                unmatched.append(folder_name)
                continue

            owners.setdefault(name, []).append(folder_name)

        mapping = {}
        for name, names in owners.items():
            resources = datasets[name].get('resources', [])
            for folder_name in names:
                if len(names) > 1:
                    # kando merges folders with the same title into one dataset,
                    # adding only children whose names aren't there yet, so keep
                    # the resources it built from this folder's own path.
                    own = [r for r in resources if resource_folder(r) == folder_name]
                else:
                    own = resources
                mapping[folder_name] = {
                    'dataset': name,
                    'resources': dict((r['name'], r['id']) for r in own if r.get('name')),
                }
        shared = sorted(n for n in owners if len(owners[n]) > 1)
        return mapping, unmatched, dict((n, sorted(owners[n])) for n in shared)

    def fetch_datasets(self, organization):
        url = dc_redirects.DC_HOST + '/api/3/action/package_search'
        datasets, start = [], 0
        while True:
            resp = requests.get(url, params={
                'fq': 'organization:%s' % organization,
                'rows': PAGE_SIZE,
                'start': start,
            }, timeout=120)
            resp.raise_for_status()
            result = resp.json()['result']
            datasets.extend(result['results'])
            start += PAGE_SIZE
            if start >= result['count']:
                return datasets

    def terrain_anonymous(self, method, endpoint, **kwargs):
        url = '{0}/terrain/filesystem/{1}'.format(terrain_settings.TERRAIN_API_HOST, endpoint)
        resp = requests.request(method, url, timeout=120, **kwargs)
        resp.raise_for_status()
        return resp.json()

    def list_curated_folders(self):
        """Return {folder name: folder id} for the first level of curated/."""
        folders, offset = {}, 0
        while True:
            page = self.terrain_anonymous('GET', 'paged-directory', params={
                'path': dc_redirects.CURATED, 'limit': PAGE_SIZE, 'offset': offset})
            for folder in page['folders']:
                folders[folder['label']] = folder['id']
            offset += PAGE_SIZE
            if offset >= page['total']:
                return folders
