from irods import *
from DSFile import DSFile, DSCollection

class DataStore(object):
    def __init__(self):
        self._conn = None

    def configure(self, host=None, port=None, zone=None, path=None, user=None, password=None):
        self.host = host
        self.port = port
        self.zone = zone
        self.path = path
        self.user = user
        self.password = password

    def _connect(self):
        if not self._conn:
            conn, err = rcConnect(self.host, self.port, self.user, self.zone)
            status = clientLoginWithPassword(conn, self.password)
            self._conn = conn
        return self._conn

    def get_studies(self):
        conn = self._connect()
        collection = DSCollection(conn, self.path)
        return collection.get_subcollections()

DataStoreSession = DataStore()
