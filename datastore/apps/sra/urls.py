from django.conf.urls import patterns, include, url

urlpatterns = patterns(
    'datastore.apps.sra.views',
    url(r'^', 'home', name='home'),
)
