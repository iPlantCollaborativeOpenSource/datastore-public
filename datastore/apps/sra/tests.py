# -*- coding: utf-8 -*-
import json
import os
import shutil
import tempfile
import time

import mock
from django.test import SimpleTestCase, override_settings

from datastore.apps.sra import dc_redirects
from datastore.apps.sra.management.commands.build_dc_redirects import Command

ORG = 'https://dc.cyverse.org/organization/cyverse'
DS = 'https://dc.cyverse.org/dataset/'
CURATED = '/iplant/home/shared/commons_repo/curated'

MAP = {
    'datasets': {
        'Alcock_leafPhenotypingImages_2016': {
            'dataset': 'alcock_leaf_phenotyping',
            'resources': {'images': 'res-images', 'README.txt': 'res-readme'},
        },
        'Zhong_Barrow_2019': {'dataset': 'barrow_viromes_2019', 'resources': {}},
        u'Café_2020': {'dataset': 'cafe_2020', 'resources': {u'données': 'res-donnees'}},
    }
}


class RedirectMapTestCase(SimpleTestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.map_path = os.path.join(self.tmp, 'dc_redirects.json')
        self.write_map(MAP)
        patches = [
            mock.patch.object(dc_redirects, 'MAP_PATH', self.map_path),
            mock.patch.object(dc_redirects, 'ENABLED', True),
            mock.patch.object(dc_redirects, 'PERMANENT', False),
            mock.patch.dict(dc_redirects._loaded, {'mtime': None, 'datasets': {}}),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(shutil.rmtree, self.tmp)

    def write_map(self, data, mtime=None):
        with open(self.map_path, 'w') as f:
            json.dump(data, f)
        if mtime is not None:
            os.utime(self.map_path, (mtime, mtime))


class ResolveTests(RedirectMapTestCase):

    def test_commons_repo_and_curated_go_to_organization(self):
        for path in ('/iplant/home/shared/commons_repo', '/iplant/home/shared/commons_repo/',
                     CURATED, CURATED + '/', 'iplant/home/shared/commons_repo/curated',
                     '/iplant/home/shared/commons_repo/something_else'):
            self.assertEqual(dc_redirects.resolve(path), ORG, path)

    def test_dataset_folder(self):
        self.assertEqual(dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016'),
                         DS + 'alcock_leaf_phenotyping')

    def test_first_level_child(self):
        self.assertEqual(dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016/README.txt'),
                         DS + 'alcock_leaf_phenotyping/resource/res-readme')

    def test_deep_path_goes_to_first_level_child(self):
        self.assertEqual(
            dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016/images/plot3/day7/leaf.png'),
            DS + 'alcock_leaf_phenotyping/resource/res-images')

    def test_unknown_child_falls_back_to_dataset(self):
        self.assertEqual(dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016/gone/deeper'),
                         DS + 'alcock_leaf_phenotyping')

    def test_dataset_without_resources(self):
        self.assertEqual(dc_redirects.resolve(CURATED + '/Zhong_Barrow_2019/viromes/a.fa'),
                         DS + 'barrow_viromes_2019')

    def test_unmigrated_folder_is_not_redirected(self):
        self.assertIsNone(dc_redirects.resolve(CURATED + '/Not_Migrated_Yet'))
        self.assertIsNone(dc_redirects.resolve(CURATED + '/Not_Migrated_Yet/a/b'))

    def test_paths_outside_commons_repo_are_not_redirected(self):
        for path in ('/iplant/home/shared', '/iplant/home/shared/TCIA/4D-Lung',
                     '/iplant/home/shared/commons_repository'):
            self.assertIsNone(dc_redirects.resolve(path), path)

    def test_double_slashes(self):
        self.assertEqual(dc_redirects.resolve('//iplant/home/shared/commons_repo//curated/Zhong_Barrow_2019/'),
                         DS + 'barrow_viromes_2019')

    def test_unicode_names(self):
        self.assertEqual(dc_redirects.resolve(CURATED + u'/Café_2020/données/x'),
                         DS + 'cafe_2020/resource/res-donnees')

    def test_disabled(self):
        with mock.patch.object(dc_redirects, 'ENABLED', False):
            self.assertIsNone(dc_redirects.resolve(CURATED))

    def test_map_reloads_when_file_changes(self):
        self.assertIsNone(dc_redirects.resolve(CURATED + '/New_2026'))
        updated = {'datasets': dict(MAP['datasets'], New_2026={'dataset': 'new_2026', 'resources': {}})}
        self.write_map(updated, mtime=time.time() + 10)
        self.assertEqual(dc_redirects.resolve(CURATED + '/New_2026'), DS + 'new_2026')

    def test_bad_map_keeps_last_good_copy(self):
        dc_redirects.resolve(CURATED + '/Zhong_Barrow_2019')
        with open(self.map_path, 'w') as f:
            f.write('{not json')
        os.utime(self.map_path, (time.time() + 10, time.time() + 10))
        self.assertEqual(dc_redirects.resolve(CURATED + '/Zhong_Barrow_2019'), DS + 'barrow_viromes_2019')

    def test_missing_map_redirects_only_the_top_level(self):
        os.remove(self.map_path)
        self.assertEqual(dc_redirects.resolve(CURATED), ORG)
        self.assertIsNone(dc_redirects.resolve(CURATED + '/Zhong_Barrow_2019'))


@override_settings(
    STATICFILES_STORAGE='django.contrib.staticfiles.storage.StaticFilesStorage',
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class BrowseViewTests(RedirectMapTestCase):

    def test_curated_redirects(self):
        resp = self.client.get('/browse' + CURATED)
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp['Location'], ORG)

    def test_deep_path_redirects_to_resource(self):
        resp = self.client.get('/browse' + CURATED + '/Alcock_leafPhenotypingImages_2016/images/plot3/')
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp['Location'], DS + 'alcock_leaf_phenotyping/resource/res-images')

    def test_encoded_path(self):
        resp = self.client.get('/browse/iplant/home/shared/commons_repo/curated/Caf%C3%A9_2020/donn%C3%A9es')
        self.assertEqual(resp['Location'], DS + 'cafe_2020/resource/res-donnees')

    def test_permanent(self):
        with mock.patch.object(dc_redirects, 'PERMANENT', True):
            resp = self.client.get('/browse' + CURATED)
        self.assertEqual(resp.status_code, 301)

    def test_unmigrated_and_community_pages_still_render(self):
        for path in (CURATED + '/Not_Migrated_Yet/sub', '/iplant/home/shared', '/iplant/home/shared/TCIA'):
            resp = self.client.get('/browse' + path)
            self.assertEqual(resp.status_code, 200, path)
            self.assertContains(resp, 'DcrMainCtrl')

    def test_downloads_are_not_redirected(self):
        with mock.patch('datastore.apps.sra.views.AnonFilesClient') as client:
            client.return_value.download_url.return_value = 'https://data.cyverse.org/dav-anon/x'
            resp = self.client.get('/download' + CURATED + '/Alcock_leafPhenotypingImages_2016/README.txt')
        self.assertEqual(resp['Location'], 'https://data.cyverse.org/dav-anon/x')


def _dataset(name, resource_paths=(), extras=()):
    prefix = 'https://data.cyverse.org/dav-anon' + CURATED + '/'
    return {
        'name': name,
        'resources': [{'id': '%s-%d' % (name, i), 'url': prefix + p} for i, p in enumerate(resource_paths)],
        'extras': [{'key': k, 'value': v} for k, v in extras],
    }


class BuildMapTests(SimpleTestCase):

    def setUp(self):
        self.cmd = Command()
        self.cmd.stderr = mock.Mock()

    def test_match_by_resources(self):
        datasets = [
            _dataset('a', ['FolderA/one.txt', 'FolderA/sub', 'FolderA2/x']),
            _dataset('b', ['Folder%20B/data file.csv', 'Folder C /c.txt']),
            _dataset('logo'),
        ]
        mapping, ambiguous = self.cmd.match_by_resources(datasets)
        self.assertEqual(mapping['FolderA'], {'dataset': 'a', 'resources': {'one.txt': 'a-0', 'sub': 'a-1'}})
        self.assertEqual(mapping['FolderA2']['dataset'], 'a')
        self.assertEqual(mapping['Folder B'], {'dataset': 'b', 'resources': {'data file.csv': 'b-0'}})
        self.assertEqual(mapping['Folder C'], {'dataset': 'b', 'resources': {'c.txt': 'b-1'}})
        self.assertEqual(ambiguous, set())

    def test_folder_claimed_by_two_datasets_is_skipped(self):
        mapping, ambiguous = self.cmd.match_by_resources([
            _dataset('a', ['Shared/x']), _dataset('b', ['Shared/y'])])
        self.assertNotIn('Shared', mapping)
        self.assertEqual(ambiguous, {'Shared'})

    def test_match_by_doi_ignores_related_identifiers(self):
        datasets = [
            _dataset('barrow_viromes', extras=[('Citation', 'Zhong 2018. Barrow Viromes. DOI 10.7946/P2PK96')]),
            _dataset('barrow_viromes_2019', extras=[
                ('Citation', 'Zhong 2019. DOI 10.25739/0e7n-6611'),
                ('relatedIdentifier', '10.7946/P2PK96')]),
        ]
        metadata = {
            'id-2018': {'avus': [{'attr': 'Identifier', 'value': '10.7946/P2PK96'}], 'irods-avus': []},
            'id-2019': {'avus': [{'attr': 'identifier', 'value': '10.25739/0e7n-6611'},
                                 {'attr': 'relatedIdentifier', 'value': '10.7946/P2PK96'}], 'irods-avus': []},
            'id-none': {'avus': [], 'irods-avus': []},
        }
        self.cmd.terrain_anonymous = lambda method, endpoint, **kw: metadata[endpoint.split('/')[0]]
        mapping = {}
        matched = self.cmd.match_by_doi(
            datasets, {'Zhong_Barrow_Viromes_2018': 'id-2018', 'Zhong_Barrow_2019': 'id-2019',
                       'Unmigrated': 'id-none'}, mapping, set())
        self.assertEqual(matched, {'Zhong_Barrow_Viromes_2018': 'barrow_viromes',
                                   'Zhong_Barrow_2019': 'barrow_viromes_2019'})
        self.assertNotIn('Unmigrated', mapping)
