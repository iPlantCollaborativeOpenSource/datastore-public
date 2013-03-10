from irods import *
from DSFile import DSFile, DSCollection, DSDataObject

class DataStore(object):
    def __init__(self):
        self._conn = None

    def configure(self, host=None, port=None, zone=None, user=None, password=None):
        self.host = host
        self.port = port
        self.zone = zone
        self.user = user
        self.password = password

    def _connect(self):
        if not self._conn:
            conn, err = rcConnect(self.host, self.port, self.user, self.zone)
            status = clientLoginWithPassword(conn, self.password)
            self._conn = conn
        return self._conn

    def get_collection(self, path):
        conn = self._connect()
        return DSCollection(conn, path)

    def get_file(self, path):
        conn = self._connect()
        return DSDataObject(conn, path)
