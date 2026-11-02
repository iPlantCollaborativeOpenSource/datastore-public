# -*- coding: utf-8 -*-
import json
import os
import shutil
import tempfile
import time

import mock
from django.test import SimpleTestCase, override_settings

from datastore.apps.sra import dc_redirects
from datastore.apps.sra.management.commands.build_dc_redirects import (
    Command, avus_to_dict, candidate_names, get_name_from_title, get_title, resource_folder)

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


def _avus(**attrs):
    out = []
    for key, value in attrs.items():
        for v in (value if isinstance(value, list) else [value]):
            out.append({'attr': key.replace('__', '.'), 'value': v})
    return {'avus': out, 'irods-avus': [{'attr': 'title', 'value': 'ignored, kando only reads avus'}]}


def _dataset(name, resource_names=()):
    return {'name': name, 'resources': [{'id': '%s-%d' % (name, i), 'name': r}
                                        for i, r in enumerate(resource_names)]}


class TitleRuleTests(SimpleTestCase):
    """Same results as kando/sync/mapping.py in cyverse/data-commons."""

    def test_name_from_title(self):
        self.assertEqual(get_name_from_title(u'Barrow Viromes 2019'), u'barrow_viromes_2019')
        self.assertEqual(get_name_from_title(u'B73 RefGen_v4 (CEN) - 10.6 Mb!'), u'b73_refgen_v4_cen_-_106_mb')
        self.assertEqual(len(get_name_from_title(u'x' * 150)), 100)

    def test_title_is_stripped_and_tabs_removed(self):
        self.assertEqual(get_title({'title': u' Maize\tSyn10 '}, 'F'), u'MaizeSyn10')

    def test_last_title_key_wins(self):
        self.assertEqual(get_title({'title': u'a', 'Title': u'b', 'datacite.title': u'c'}, 'F'), u'c')
        self.assertEqual(get_title({'title': u'a', 'Title': u'b'}, 'F'), u'b')

    def test_multi_valued_title(self):
        self.assertEqual(get_title({'title': [u'Part one', u'Part two']}, 'F'), u'Part one, Part two')

    def test_missing_title_uses_folder_name(self):
        self.assertEqual(candidate_names({}, u'Some_Folder')[0], u'some_folder')

    def test_collision_name(self):
        self.assertEqual(candidate_names({'title': u'Data', 'identifier': u'10.7946/P2PK96'}, u'F')[1],
                         u'data_10-7946-P2PK96')
        self.assertEqual(candidate_names({'title': u'Data'}, u'A_Long_Folder_Name_2020')[1],
                         u'data_A_Long_Folder_Name_')

    def test_avus_to_dict_collects_multi_values(self):
        self.assertEqual(avus_to_dict(_avus(title=u'T', subject=[u'a', u'b'])['avus']),
                         {'title': u'T', 'subject': [u'a', u'b']})


class BuildMapTests(SimpleTestCase):

    def setUp(self):
        self.cmd = Command()
        self.cmd.stderr = mock.Mock()

    def build(self, metadata, datasets):
        self.cmd.terrain_anonymous = lambda method, endpoint, **kw: metadata[endpoint.split('/')[0]]
        folders = dict((name, name) for name in metadata)
        return self.cmd.build_mapping(folders, dict((d['name'], d) for d in datasets))

    def test_maps_by_title_with_resource_ids(self):
        mapping, unmatched, shared = self.build(
            {'Zhong_Barrow_2019': _avus(title=u'Barrow Viromes 2019')},
            [_dataset('barrow_viromes_2019', ['README.txt', 'viromes'])])
        self.assertEqual(mapping, {'Zhong_Barrow_2019': {
            'dataset': 'barrow_viromes_2019',
            'resources': {'README.txt': 'barrow_viromes_2019-0', 'viromes': 'barrow_viromes_2019-1'}}})
        self.assertEqual((unmatched, shared), ([], {}))

    def test_uses_collision_name_when_plain_name_is_absent(self):
        mapping, _, _ = self.build({'F': _avus(title=u'Data', identifier=u'10.1/abc')}, [_dataset('data_10-1-abc')])
        self.assertEqual(mapping['F']['dataset'], 'data_10-1-abc')

    def test_name_must_exist_on_dc(self):
        mapping, unmatched, _ = self.build({'New_2026': _avus(title=u'Not synced yet')}, [_dataset('other')])
        self.assertEqual(mapping, {})
        self.assertEqual(unmatched, ['New_2026'])

    def test_deprecated_folders_are_skipped(self):
        mapping, unmatched, _ = self.build({'_deprecated_X': _avus(title=u'X')}, [_dataset('x')])
        self.assertEqual(mapping, {})
        self.assertEqual(unmatched, ['_deprecated_X'])

    def test_folders_with_the_same_title_share_one_dataset(self):
        dav = 'https://data.cyverse.org/dav-anon' + CURATED + '/'
        dataset = {'name': 'same', 'resources': [
            {'id': 'r1', 'name': 'data', 'url': dav + 'V1_July/data'},
            {'id': 'r2', 'name': 'README', 'url': dav + 'V1_July/README'},
            {'id': 'r3', 'name': 'new_in_v2', 'url': dav + 'V2_Aug/new_in_v2'},
        ]}
        mapping, _, shared = self.build(
            {'V1_July': _avus(title=u'Same'), 'V2_Aug': _avus(Title=u'Same ')}, [dataset])
        self.assertEqual(mapping['V1_July'], {'dataset': 'same', 'resources': {'data': 'r1', 'README': 'r2'}})
        # V2's own "data" was never added to the dataset, so it must not point at V1's.
        self.assertEqual(mapping['V2_Aug'], {'dataset': 'same', 'resources': {'new_in_v2': 'r3'}})
        self.assertEqual(shared, {'same': ['V1_July', 'V2_Aug']})

    def test_resource_folder_ignores_stray_whitespace(self):
        url = 'https://data.cyverse.org/dav-anon' + CURATED + '/G2F_2018 /README.txt'
        self.assertEqual(resource_folder({'url': url}), u'G2F_2018')
        self.assertIsNone(resource_folder({'url': 'https://dc.cyverse.org/x.png'}))
