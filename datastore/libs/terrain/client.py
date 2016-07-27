from cryptography.hazmat.primitives.serialization import load_pem_private_key
from cryptography.hazmat.backends import default_backend
import json
import jwt
import logging
import requests
import settings
import time
import urllib

logger = logging.getLogger(__name__)


class TerrainClient(object):

    DIR_PAGE_SIZE = 100
    SORT_COL = 'name'
    SORT_DIR = 'ASC'

    def __init__(self, sub, email):
        self._sub = sub
        self._email = email
        self._jwt_token = None

    @property
    def jwt_token(self):
        if self._jwt_token is None:
            payload = {
                'iat': time.time(),
                'sub': self._sub,
                'email': self._email
            }

            with open(settings.TERRAIN_API_KEY_PATH, 'r') as keyfile:
                private_key = keyfile.read()

            decrypted = load_pem_private_key(
                private_key, settings.TERRAIN_API_KEY_PASSPHRASE, default_backend())

            jwt_string = jwt.encode(payload, decrypted, algorithm='RS256')
            jwt_encoded = urllib.quote_plus(jwt_string)
            self._jwt_token = jwt_encoded

        return self._jwt_token

    def send_request(self, method, url, **kwargs):
        headers = kwargs.pop('headers', {})
        headers['X-Iplant-De-Jwt'] = self.jwt_token
        data = kwargs.pop('data', None)
        if data:
            headers['Content-Type'] = 'application/json'
            if isinstance(data, basestring):
                kwargs['data'] = data
            else:
                kwargs['data'] = json.dumps(data)
        kwargs['headers'] = headers
        response = requests.request(method, url, **kwargs)
        return response

    def get_file_or_folder(self, path):
        url = '{0}/terrain/secured/filesystem/stat'.format(settings.TERRAIN_API_HOST)
        payload = {'paths': [str(path)]}
        return self.send_request('POST', url, data=payload).json()

    def get_metadata(self, id):
        url = '{0}/terrain/secured/filesystem/{1}/metadata'.format(
            settings.TERRAIN_API_HOST, str(id))
        return self.send_request('GET', url).json()

    def get_contents(self, path, **kwargs):
        url = '{0}/terrain/secured/filesystem/paged-directory'.format(
            settings.TERRAIN_API_HOST)

        page = int(kwargs.pop('page', '0'))
        offset = page * TerrainClient.DIR_PAGE_SIZE

        params = {
            'path': path,
            'limit': TerrainClient.DIR_PAGE_SIZE,
            'offset': offset,
            'sort-col': TerrainClient.SORT_COL,
            'sort-dir': TerrainClient.SORT_DIR,
        }
        return self.send_request('GET', url, params=params).json()

    def download(self, params):
        url = '{0}/terrain/secured/fileio/download'.format(settings.TERRAIN_API_HOST)
        return self.send_request('GET', url=url, params=params, stream=True)
