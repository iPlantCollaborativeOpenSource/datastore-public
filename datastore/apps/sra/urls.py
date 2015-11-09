from django.conf.urls import patterns, include, url

urlpatterns = patterns('datastore.apps.sra.views',
    url(r'^$', 'home', name='home'),
    url(r'^browse/(?P<path>.*)$', 'home', name='browse'),

    url(r'^api/file/?$', 'get_file'),
    url(r'^api/collection/?$', 'get_collection'),

    url(r'^serve/(?P<path>.*)$', 'serve_file', name='serve'),
    url(r'^download/(?P<path>.*)$', 'download_file', name='download'),
    url(r'^markdown/(?P<path>.*)$', 'markdown_view', name='markdown'),

    url(r'^search/?$', 'search_metadata'),

    # legacy support
    url(r'^(?P<path>.+)$', 'legacy_redirect'),
)
