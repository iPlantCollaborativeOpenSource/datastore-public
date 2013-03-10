from irods import *


class DataStore(object):
    def __init__(self):
        self.conn = None

    def configure(self, host=None, port=None, zone=None, path=None, user=None, password=None):
        self.host = host
        self.port = port
        self.zone = zone
        self.path = path
        self.user = user
        self.password = password

    def _connect(self):
        if not self.conn:
            conn, err = rcConnect(self.host, self.port, self.user, self.zone)
            status = clientLoginWithPassword(conn, self.password)
            self.conn = conn
        return self.conn

    def get_studies(self):
        conn = self._connect()
        c = irodsCollection(conn, self.path)
        base_path = c.getCollName()

        studies = map(lambda dir_name: {
            "id": dir_name, 
            "path" : base_path + "/" + dir_name,
            "metadata" : self.get_collection_metadata(base_path + "/" + dir_name)
        }, c.getSubCollections())
        return studies

    def get_collection_metadata(self, path):
        conn = self._connect()
        c = irodsCollection(conn, path)
        def unpack_tuple(t):
            return (t[0], (t[1], t[2]))
        return dict(map(unpack_tuple, c.getUserMetadata()))
        

DataStoreSession = DataStore()
