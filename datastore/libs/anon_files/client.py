import requests
import settings
import urllib


class AnonFilesClient(object):

    def download_url(self, path):
        return '{0}/{1}'.format(settings.ANON_FILES_API_HOST, urllib.quote(path))

    def download(self, path, **kwargs):
        return requests.get(self.download_url(path), **kwargs)
