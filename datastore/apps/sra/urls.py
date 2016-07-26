from django.conf.urls import patterns, include, url

urlpatterns = patterns(
    'datastore.apps.sra.views',
    url(r'^$', 'home', name='home'),
    url(r'^browse/(?P<path>.*)/?$', 'home'),
    url(r'^api/browse/(?P<path>.*)/?$', 'get_file_or_folder', name='browse'),

    # url(r'^api/browse/(?P<path>.*)/page/(?P<page>\d*)/?$', 'get_file_or_folder', name='browse'),

    # url(r'^api/file/(?P<path>.*)/?$', 'get_file', name='get_file'),
    url(r'^api/collection/(?P<path>.*)/id/(?P<id>.*-.*)/?$', 'get_collection', name='get_collection'),
    url(r'^api/load_more/(?P<path>.*)/page/(?P<page>\d*)/?$', 'get_collection', name='load_more'),

    url(r'^serve/(?P<path>.*)$', 'serve_file', name='serve'),
    url(r'^download/(?P<path>.*)$', 'download_file', name='download'),
    url(r'^markdown/(?P<path>.*)$', 'markdown_view', name='markdown'),

    url(r'^search/metadata/?$', 'search_metadata'),
    url(r'^search/?$', 'search'),

    url(r'^api/stat/(?P<path>.*)/?$', 'api_stat', name='api_stat'),
    url(r'^api/metadata/(?P<item_id>.*)/?$', 'api_metadata', name='api_metadata'),
    url(r'^api/list/(?P<path>.*)/?$', 'api_list_item', name='api_list_item'),

    # legacy support
    url(r'^(?P<path>.+)$', 'legacy_redirect'),
)
