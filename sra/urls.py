from django.conf.urls import patterns, include, url

urlpatterns = patterns('sra.views',
    url(r'^$', 'home', name='home'),
    url(r'^browse/(?P<path>.*)$', 'home', name='browse'),

    url(r'^api/file/$', 'get_file'),
    url(r'^api/collection/$', 'get_collection'),

    url(r'^serve/(?P<path>.*)$', 'serve_file', name='serve'),
)
