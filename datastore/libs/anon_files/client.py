import requests
import settings
import urllib


class AnonFilesClient(object):

    def download(self, path, **kwargs):
        url = '{0}/{1}'.format(settings.ANON_FILES_API_HOST, urllib.quote(path))
        return requests.get(url, stream=True, **kwargs)
