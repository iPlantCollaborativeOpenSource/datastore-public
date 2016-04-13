from django.conf.urls import patterns, url
from datastore.apps.sra.views import *

urlpatterns = patterns('datastore.apps.sra.views',
    url(r'^$', 'home', name='home'),
    url(r'^browse/(?P<path>.*)/?$', 'home', name='browse'),

    url(r'^api/file/?$', FileView.as_view()),
    url(r'^api/collection/?$', CollectionView.as_view()),

    url(r'^serve/(?P<path>.*)$', ServeFileView.as_view(), name='serve'),
    url(r'^download/(?P<path>.*)$', DownloadFileView.as_view(), name='download'),
    url(r'^markdown/(?P<path>.*)$', MarkdownView.as_view(), name='markdown'),

    url(r'^search/?$', SearchMetadataView.as_view()),

    # legacy support
    url(r'^(?P<path>.+)$', LegacyRedirectView.as_view()),
)
