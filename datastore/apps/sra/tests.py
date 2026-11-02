# -*- coding: utf-8 -*-
import json

import mock
import requests
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from datastore.apps.sra import dc_redirects
from datastore.apps.sra.dc_redirects import (
    avus_to_dict, candidate_names, get_name_from_title, get_title, resource_folder)

ORG = 'https://dc.cyverse.org/organization/cyverse'
DS = 'https://dc.cyverse.org/dataset/'
CURATED = '/iplant/home/shared/commons_repo/curated'
DAV = 'https://data.cyverse.org/dav-anon' + CURATED + '/'


class FakeResponse(object):

    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body

    def json(self):
        return json.loads(json.dumps(self._body))


class FakeAPIs(object):
    """Terrain's anonymous filesystem endpoints and CKAN's package_show."""

    def __init__(self):
        self.folders = {}   # folder name -> list of AVUs
        self.datasets = {}  # dataset name -> CKAN dataset
        self.calls = 0
        self.down = False

    def folder(self, name, **attrs):
        avus = []
        for key, value in attrs.items():
            for v in (value if isinstance(value, list) else [value]):
                avus.append({'attr': key, 'value': v})
        self.folders[name] = avus

    def dataset(self, name, *resources):
        """resources: (resource name, folder it was synced from) pairs."""
        self.datasets[name] = {'name': name, 'resources': [
            {'id': '%s-%d' % (name, i), 'name': r, 'url': DAV + folder + '/' + r}
            for i, (r, folder) in enumerate(resources)]}

    def add_resource(self, dataset, name, url):
        resources = self.datasets[dataset]['resources']
        resources.append({'id': '%s-%d' % (dataset, len(resources)), 'name': name, 'url': url})

    def request(self, method, url, **kwargs):
        self.calls += 1
        if self.down:
            raise requests.ConnectionError('down')
        endpoint = url.split('/terrain/filesystem/')[1]
        if endpoint == 'stat':
            path = kwargs['json']['paths'][0]
            name = path[len(CURATED) + 1:]
            if name not in self.folders:
                return FakeResponse(500, {'error_code': 'ERR_DOES_NOT_EXIST', 'paths': [path]})
            return FakeResponse(200, {'paths': {path: {'id': 'id:' + name, 'type': 'dir', 'path': path}}})
        name = endpoint[len('id:'):-len('/metadata')]
        return FakeResponse(200, {'avus': self.folders[name],
                                  'irods-avus': [{'attr': 'title', 'value': 'kando only reads avus'}]})

    def get(self, url, params=None, **kwargs):
        self.calls += 1
        if self.down:
            raise requests.ConnectionError('down')
        action = url.rsplit('/', 1)[1]
        if action == 'package_search':
            assert params['fl'] == 'id,name', 'must not fetch whole datasets'
            name = params['fq'][len('name:"'):-1]
            results = [{'id': 'id-' + name, 'name': name}] if name in self.datasets else []
            return FakeResponse(200, {'success': True, 'result': {'count': len(results), 'results': results}})
        if action == 'resource_search':
            # CKAN matches each "field:value" term as a case-insensitive substring.
            terms = params['query'] if isinstance(params['query'], list) else [params['query']]
            hits = []
            for name, dataset in self.datasets.items():
                for r in dataset['resources']:
                    r = dict(r, package_id='id-' + name)
                    if all(t.split(':', 1)[1].lower() in r[t.split(':', 1)[0]].lower() for t in terms):
                        hits.append(r)
            hits.sort(key=lambda r: r['name'])
            return FakeResponse(200, {'success': True, 'result': {'count': len(hits), 'results': hits[:params['limit']]}})
        raise AssertionError('unexpected CKAN action %s' % action)


@override_settings(
    STATICFILES_STORAGE='django.contrib.staticfiles.storage.StaticFilesStorage',
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class RedirectTestCase(SimpleTestCase):

    def setUp(self):
        cache.clear()
        self.api = FakeAPIs()
        self.api.folder('Alcock_leafPhenotypingImages_2016', title=u' Alcock Leaf Phenotyping ')
        self.api.dataset('alcock_leaf_phenotyping',
                         ('images', 'Alcock_leafPhenotypingImages_2016'),
                         ('README.txt', 'Alcock_leafPhenotypingImages_2016'))
        self.api.folder('Zhong_Barrow_2019', title=u'Barrow Viromes 2019', identifier=u'10.25739/0e7n-6611')
        self.api.dataset('barrow_viromes_2019')
        self.api.folder(u'Café_2020', **{'datacite.title': u'Café 2020'})
        self.api.dataset(u'café_2020', (u'données', u'Café_2020'))
        self.api.folder('Not_Migrated_Yet', title=u'Not synced yet')
        patches = [
            mock.patch.object(dc_redirects.requests, 'request', self.api.request),
            mock.patch.object(dc_redirects.requests, 'get', self.api.get),
            mock.patch.object(dc_redirects, 'ENABLED', True),
            mock.patch.object(dc_redirects, 'PERMANENT', False),
            mock.patch.object(dc_redirects, 'SHOW_PAGE', False),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)


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
        self.assertEqual(avus_to_dict([{'attr': 'title', 'value': u'T'}, {'attr': 'subject', 'value': u'a'},
                                       {'attr': 'subject', 'value': u'b'}]),
                         {'title': u'T', 'subject': [u'a', u'b']})

    def test_resource_folder_ignores_stray_whitespace(self):
        self.assertEqual(resource_folder({'url': DAV + 'G2F_2018 /README.txt'}), u'G2F_2018')
        self.assertIsNone(resource_folder({'url': 'https://dc.cyverse.org/x.png'}))


class ResolveTests(RedirectTestCase):

    def test_commons_repo_and_curated_go_to_organization_without_lookups(self):
        for path in ('/iplant/home/shared/commons_repo', '/iplant/home/shared/commons_repo/',
                     CURATED, CURATED + '/', 'iplant/home/shared/commons_repo/curated',
                     '/iplant/home/shared/commons_repo/something_else'):
            self.assertEqual(dc_redirects.resolve(path), ORG, path)
        self.assertEqual(self.api.calls, 0)

    def test_dataset_folder(self):
        self.assertEqual(dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016'),
                         DS + 'alcock_leaf_phenotyping')

    def test_first_level_child(self):
        self.assertEqual(dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016/README.txt'),
                         DS + 'alcock_leaf_phenotyping/resource/alcock_leaf_phenotyping-1')

    def test_deep_path_goes_to_first_level_child(self):
        self.assertEqual(
            dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016/images/plot3/day7/leaf.png'),
            DS + 'alcock_leaf_phenotyping/resource/alcock_leaf_phenotyping-0')

    def test_unknown_child_falls_back_to_dataset(self):
        self.assertEqual(dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016/gone/deeper'),
                         DS + 'alcock_leaf_phenotyping')

    def test_dataset_without_resources(self):
        self.assertEqual(dc_redirects.resolve(CURATED + '/Zhong_Barrow_2019/viromes/a.fa'),
                         DS + 'barrow_viromes_2019')

    def test_collision_name(self):
        self.api.folder('Dup', title=u'Data', identifier=u'10.1/abc')
        self.api.dataset('data_10-1-abc')
        self.assertEqual(dc_redirects.resolve(CURATED + '/Dup'), DS + 'data_10-1-abc')

    def test_folders_sharing_a_dataset_keep_their_own_resources(self):
        self.api.folder('V1_July', title=u'Same')
        self.api.folder('V2_Aug', Title=u'Same ')
        self.api.dataset('same', ('data', 'V1_July'), ('new_in_v2', 'V2_Aug'))
        self.assertEqual(dc_redirects.resolve(CURATED + '/V1_July/data/x'), DS + 'same/resource/same-0')
        self.assertEqual(dc_redirects.resolve(CURATED + '/V2_Aug/new_in_v2'), DS + 'same/resource/same-1')
        # V2's own "data" was never added to the dataset, so it must not point at V1's.
        self.assertEqual(dc_redirects.resolve(CURATED + '/V2_Aug/data/x'), DS + 'same')

    def test_exact_child_match_among_substring_hits(self):
        self.api.add_resource('alcock_leaf_phenotyping', 'images_v2', DAV + 'Alcock_leafPhenotypingImages_2016/images_v2')
        self.api.add_resource('alcock_leaf_phenotyping', 'old_images', DAV + 'Alcock_leafPhenotypingImages_2016/old_images')
        self.assertEqual(dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016/images_v2/x'),
                         DS + 'alcock_leaf_phenotyping/resource/alcock_leaf_phenotyping-2')
        self.assertEqual(dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016/images/x'),
                         DS + 'alcock_leaf_phenotyping/resource/alcock_leaf_phenotyping-0')

    def test_child_with_stray_whitespace_in_resource_url(self):
        self.api.folder('G2F_2018', title=u'G2F 2018')
        self.api.dataset('g2f_2018')
        self.api.add_resource('g2f_2018', 'README.txt', DAV + 'G2F_2018 /README.txt')
        self.assertEqual(dc_redirects.resolve(CURATED + '/G2F_2018/README.txt'), DS + 'g2f_2018/resource/g2f_2018-0')

    def test_same_child_name_in_another_dataset_is_ignored(self):
        self.api.folder('Other_2020', title=u'Other 2020')
        self.api.dataset('other_2020', ('README.txt', 'Other_2020'))
        self.assertEqual(dc_redirects.resolve(CURATED + '/Other_2020/README.txt'),
                         DS + 'other_2020/resource/other_2020-0')
        self.assertEqual(dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016/README.txt'),
                         DS + 'alcock_leaf_phenotyping/resource/alcock_leaf_phenotyping-1')

    def test_child_lookup_failure_still_goes_to_the_dataset(self):
        dc_redirects.resolve(CURATED + '/Zhong_Barrow_2019')  # folder cached
        self.api.down = True
        self.assertEqual(dc_redirects.resolve(CURATED + '/Zhong_Barrow_2019/viromes'), DS + 'barrow_viromes_2019')

    def test_unmigrated_folder_is_not_redirected(self):
        self.assertIsNone(dc_redirects.resolve(CURATED + '/Not_Migrated_Yet'))
        self.assertIsNone(dc_redirects.resolve(CURATED + '/Not_Migrated_Yet/a/b'))

    def test_missing_folder_is_not_redirected(self):
        self.assertIsNone(dc_redirects.resolve(CURATED + '/No_Such_Folder/x'))

    def test_deprecated_folders_are_not_looked_up(self):
        self.assertIsNone(dc_redirects.resolve(CURATED + '/_deprecated_Old_2016/x'))
        self.assertEqual(self.api.calls, 0)

    def test_paths_outside_commons_repo_are_not_redirected(self):
        for path in ('/iplant/home/shared', '/iplant/home/shared/TCIA/4D-Lung',
                     '/iplant/home/shared/commons_repository'):
            self.assertIsNone(dc_redirects.resolve(path), path)
        self.assertEqual(self.api.calls, 0)

    def test_double_slashes(self):
        self.assertEqual(dc_redirects.resolve('//iplant/home/shared/commons_repo//curated/Zhong_Barrow_2019/'),
                         DS + 'barrow_viromes_2019')

    def test_unicode_names(self):
        self.assertEqual(dc_redirects.resolve(CURATED + u'/Café_2020/données/x'),
                         DS + 'caf%C3%A9_2020/resource/caf%C3%A9_2020-0')

    def test_data_store_url(self):
        self.assertEqual(dc_redirects.data_store_url(u'//iplant/home/shared/commons_repo//curated/Café 2020/a b.txt/'),
                         'https://data.cyverse.org/dav-anon/iplant/home/shared/commons_repo/curated/Caf%C3%A9%202020/a%20b.txt')

    def test_support_mailto_includes_the_failed_link(self):
        link = dc_redirects.support_mailto(u'http://datacommons.cyverse.org/browse/x?y=1&z=Café')
        self.assertTrue(link.startswith('mailto:support@cyverse.org?subject=Data%20Commons%20link%20not%20opening&body='))
        self.assertIn('http%3A%2F%2Fdatacommons.cyverse.org%2Fbrowse%2Fx%3Fy%3D1%26z%3DCaf%C3%A9', link)
        self.assertNotIn('+', link)

    def test_disabled(self):
        with mock.patch.object(dc_redirects, 'ENABLED', False):
            self.assertIsNone(dc_redirects.resolve(CURATED))

    def test_folder_and_child_lookups_are_cached(self):
        dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016/images/a')
        calls = self.api.calls
        dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016/images/b/c')
        dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016')
        self.assertEqual(self.api.calls, calls)
        dc_redirects.resolve(CURATED + '/Alcock_leafPhenotypingImages_2016/README.txt')
        self.assertEqual(self.api.calls, calls + 1)  # one resource_search for the new child

    def test_misses_are_cached_briefly(self):
        with mock.patch.object(dc_redirects.cache, 'set', wraps=dc_redirects.cache.set) as cache_set:
            dc_redirects.resolve(CURATED + '/Not_Migrated_Yet')
        self.assertEqual(cache_set.call_args[0][1:], (dc_redirects._MISS, dc_redirects.MISS_CACHE_SECONDS))
        calls = self.api.calls
        dc_redirects.resolve(CURATED + '/Not_Migrated_Yet/x')
        self.assertEqual(self.api.calls, calls)

    def test_newly_synced_dataset_redirects_once_the_miss_expires(self):
        self.assertIsNone(dc_redirects.resolve(CURATED + '/Not_Migrated_Yet'))
        self.api.dataset('not_synced_yet')
        cache.clear()
        self.assertEqual(dc_redirects.resolve(CURATED + '/Not_Migrated_Yet'), DS + 'not_synced_yet')

    def test_outage_raises_and_is_not_cached(self):
        self.api.down = True
        with self.assertRaises(dc_redirects.DCLookupError):
            dc_redirects.resolve(CURATED + '/Zhong_Barrow_2019')
        self.api.down = False
        self.assertEqual(dc_redirects.resolve(CURATED + '/Zhong_Barrow_2019'), DS + 'barrow_viromes_2019')

    def test_terrain_error_is_not_cached(self):
        real = self.api.request
        self.api.request = lambda *a, **k: FakeResponse(503, {})
        with mock.patch.object(dc_redirects.requests, 'request', self.api.request):
            with self.assertRaises(dc_redirects.DCLookupError):
                dc_redirects.resolve(CURATED + '/Zhong_Barrow_2019')
        self.api.request = real
        self.assertEqual(dc_redirects.resolve(CURATED + '/Zhong_Barrow_2019'), DS + 'barrow_viromes_2019')


class BrowseViewTests(RedirectTestCase):

    def test_curated_redirects(self):
        resp = self.client.get('/browse' + CURATED)
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp['Location'], ORG)

    def test_deep_path_redirects_to_resource(self):
        resp = self.client.get('/browse' + CURATED + '/Alcock_leafPhenotypingImages_2016/images/plot3/')
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp['Location'], DS + 'alcock_leaf_phenotyping/resource/alcock_leaf_phenotyping-0')

    def test_encoded_path(self):
        resp = self.client.get('/browse/iplant/home/shared/commons_repo/curated/Caf%C3%A9_2020/donn%C3%A9es')
        self.assertEqual(resp['Location'], DS + 'caf%C3%A9_2020/resource/caf%C3%A9_2020-0')

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


class RedirectPageTests(RedirectTestCase):

    def setUp(self):
        super(RedirectPageTests, self).setUp()
        p = mock.patch.object(dc_redirects, 'SHOW_PAGE', True)
        p.start()
        self.addCleanup(p.stop)

    def test_page_forwards_to_dc(self):
        resp = self.client.get('/browse' + CURATED + '/Alcock_leafPhenotypingImages_2016/images/plot3')
        target = DS + 'alcock_leaf_phenotyping/resource/alcock_leaf_phenotyping-0'
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp['X-Robots-Tag'], 'noindex')
        self.assertContains(resp, 'Redirecting to the new Data&nbsp;Commons')
        self.assertContains(resp, 'this file or folder')
        self.assertContains(resp, '<meta http-equiv="refresh" content="3;url=%s">' % target, html=False)
        self.assertContains(resp, '<a class="btn btn-primary go" href="%s">Go now</a>' % target, html=False)
        self.assertContains(resp, 'window.location.replace("%s")' % target)
        self.assertNotContains(resp, 'Stay on')
        # The give-up state is there, hidden, in case dc.cyverse.org doesn't load.
        self.assertContains(resp, '<section id="error" class="tile is-error" hidden role="alert">', html=False)
        self.assertContains(resp, '}, 15000);')

    def test_page_describes_the_destination(self):
        self.assertContains(self.client.get('/browse' + CURATED), 'CyVerse curated data')
        self.assertContains(self.client.get('/browse' + CURATED + '/Zhong_Barrow_2019'), 'this dataset')

    def test_delay_setting(self):
        with mock.patch.object(dc_redirects, 'PAGE_DELAY_SECONDS', 5):
            resp = self.client.get('/browse' + CURATED)
        self.assertContains(resp, 'content="5;url=')
        self.assertContains(resp, 'in 5 seconds')

    def test_target_cannot_break_out_of_the_script(self):
        with mock.patch.object(dc_redirects, 'resolve', return_value='https://dc.cyverse.org/x</script><b>'):
            resp = self.client.get('/browse' + CURATED)
        self.assertNotContains(resp, 'x</script><b>')
        self.assertContains(resp, 'replace("https://dc.cyverse.org/x\\u003c/script>\\u003cb>")')

    def test_error_page_when_dc_cannot_be_reached(self):
        self.api.down = True
        resp = self.client.get('/browse' + CURATED + '/Zhong_Barrow_2019/viromes')
        self.assertEqual(resp.status_code, 503)
        self.assertEqual(resp['Retry-After'], '60')
        self.assertContains(resp, 'Redirect failed', status_code=503)
        self.assertContains(resp, "We couldn't open this on the new Data&nbsp;Commons", status_code=503)
        self.assertContains(resp, '<a class="btn btn-primary data-store" href="https://data.cyverse.org/dav-anon%s'
                            '/Zhong_Barrow_2019/viromes">Open in the Data Store</a>' % CURATED,
                            status_code=503, html=False)
        self.assertContains(resp, 'please contact CyVerse support at <a href="mailto:support@cyverse.org?subject=',
                            status_code=503)
        self.assertNotContains(resp, 'legacy Data Commons', status_code=503)
        self.assertContains(resp, 'class="btn btn-secondary retry" href="/browse%s/Zhong_Barrow_2019/viromes"' % CURATED,
                            status_code=503, html=False)
        self.assertNotContains(resp, 'http-equiv="refresh"', status_code=503)
        self.assertNotContains(resp, 'window.location.replace', status_code=503)

    def test_error_page_even_without_the_redirect_page(self):
        self.api.down = True
        with mock.patch.object(dc_redirects, 'SHOW_PAGE', False):
            resp = self.client.get('/browse' + CURATED + '/Zhong_Barrow_2019')
        self.assertEqual(resp.status_code, 503)

    def test_redirect_page_carries_the_same_fallback_for_its_give_up_state(self):
        resp = self.client.get('/browse' + CURATED + '/Zhong_Barrow_2019/viromes')
        self.assertContains(resp, 'href="https://data.cyverse.org/dav-anon%s/Zhong_Barrow_2019/viromes"' % CURATED)
        self.assertContains(resp, 'mailto:support@cyverse.org?subject=')

    def test_legacy_parameter_no_longer_skips_the_redirect(self):
        resp = self.client.get('/browse' + CURATED + '/Zhong_Barrow_2019?legacy=1')
        self.assertContains(resp, 'Redirecting to the new')

    def test_permanent_skips_the_page(self):
        with mock.patch.object(dc_redirects, 'PERMANENT', True):
            resp = self.client.get('/browse' + CURATED)
        self.assertEqual(resp.status_code, 301)
        self.assertEqual(resp['Location'], ORG)

    def test_unmigrated_folder_gets_no_page(self):
        resp = self.client.get('/browse' + CURATED + '/Not_Migrated_Yet')
        self.assertNotContains(resp, 'Redirecting to the new')
        self.assertContains(resp, 'DcrMainCtrl')

