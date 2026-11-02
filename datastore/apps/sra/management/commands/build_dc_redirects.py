"""
Build the legacy-curated-folder -> dc.cyverse.org dataset map used by
datastore.apps.sra.dc_redirects.

Folders are matched to datasets in two ways:

1. Resource paths. dc.cyverse.org resources link to the data store at
   https://data.cyverse.org/dav-anon/iplant/home/shared/commons_repo/curated/<Folder>/<child>,
   which gives both the folder and each first-level child's resource id.
2. DOI. A folder no dataset links to is matched on the DOI in its metadata
   (only when exactly one dataset carries that DOI). These link to the
   dataset page, since there are no resources under the folder to point at.

Run it again as more datasets are migrated; the site picks up the new file
without a restart.
"""
import datetime
import json
import os
import re
import urllib

import requests
from django.core.management.base import BaseCommand

from datastore.apps.sra import dc_redirects
from datastore.libs.terrain import settings as terrain_settings

DAV_PREFIX = 'https://data.cyverse.org/dav-anon'
DOI_RE = re.compile(r'\b(10\.\d{4,9}/[^\s,;"]+)', re.IGNORECASE)
# Extras that identify the dataset itself; related identifiers are excluded
# because they point at other datasets.
DATASET_DOI_KEYS = ('identifier', 'doi', 'citation', 'datacite.identifier')
FOLDER_DOI_KEYS = ('identifier', 'datacite.identifier', 'doi')
PAGE_SIZE = 500


def _dois(text):
    return set(m.rstrip('.').lower() for m in DOI_RE.findall(text or ''))


class Command(BaseCommand):
    help = 'Build the curated folder -> dc.cyverse.org dataset redirect map.'

    def add_arguments(self, parser):
        parser.add_argument('--output', default=dc_redirects.MAP_PATH)
        parser.add_argument('--organization', default='cyverse')
        parser.add_argument('--dry-run', action='store_true',
                            help='Print the summary without writing the map.')

    def handle(self, *args, **options):
        datasets = self.fetch_datasets(options['organization'])
        folders = self.list_curated_folders()

        mapping, ambiguous = self.match_by_resources(datasets)
        doi_matched = self.match_by_doi(datasets, folders, mapping, ambiguous)

        unmatched = sorted(name for name in folders if name not in mapping)
        stale = sorted(name for name in mapping if name not in folders)

        self.stdout.write('datasets on dc: %d' % len(datasets))
        self.stdout.write('curated folders: %d' % len(folders))
        self.stdout.write('mapped by resource path: %d' % (len(mapping) - len(doi_matched)))
        self.stdout.write('mapped by DOI: %d %s' % (len(doi_matched), sorted(doi_matched)))
        self.stdout.write('ambiguous (not redirected): %s' % sorted(ambiguous))
        self.stdout.write('not migrated (served here): %d %s' % (len(unmatched), unmatched))
        self.stdout.write('mapped but no longer in curated: %s' % stale)

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

    def match_by_resources(self, datasets):
        prefix = DAV_PREFIX + dc_redirects.CURATED + '/'
        mapping, owners = {}, {}
        for dataset in datasets:
            for resource in dataset.get('resources', []):
                url = resource.get('url') or ''
                if not url.startswith(prefix):
                    continue
                parts = urllib.unquote(url[len(prefix):].encode('utf8')).decode('utf8').split('/')
                # Some resource URLs carry stray whitespace after the folder name.
                folder = parts[0].strip()
                owners.setdefault(folder, set()).add(dataset['name'])
                entry = mapping.setdefault(folder, {'dataset': dataset['name'], 'resources': {}})
                if len(parts) > 1 and parts[1] and entry['dataset'] == dataset['name']:
                    entry['resources'][parts[1]] = resource['id']

        ambiguous = set(folder for folder, names in owners.items() if len(names) > 1)
        for folder in ambiguous:
            self.stderr.write('folder %s is linked from several datasets %s; skipping'
                              % (folder, sorted(owners[folder])))
            del mapping[folder]
        return mapping, ambiguous

    def match_by_doi(self, datasets, folders, mapping, ambiguous):
        by_doi = {}
        for dataset in datasets:
            for extra in dataset.get('extras', []):
                if extra.get('key', '').strip().lower() in DATASET_DOI_KEYS:
                    for doi in _dois(extra.get('value')):
                        by_doi.setdefault(doi, set()).add(dataset['name'])

        matched = {}
        for name, folder_id in folders.items():
            if name in mapping or name in ambiguous:
                continue
            try:
                metadata = self.terrain_anonymous('GET', '%s/metadata' % folder_id)
            except requests.RequestException as e:
                self.stderr.write('metadata for %s failed: %s' % (name, e))
                continue
            dois = set()
            for avu in metadata.get('avus', []) + metadata.get('irods-avus', []):
                if avu.get('attr', '').strip().lower() in FOLDER_DOI_KEYS:
                    dois |= _dois(avu.get('value'))
            candidates = set()
            for doi in dois:
                candidates |= by_doi.get(doi, set())
            if len(candidates) == 1:
                mapping[name] = {'dataset': candidates.pop(), 'resources': {}}
                matched[name] = mapping[name]['dataset']
            elif len(candidates) > 1:
                self.stderr.write('folder %s DOI matches several datasets %s; skipping'
                                  % (name, sorted(candidates)))
        return matched
