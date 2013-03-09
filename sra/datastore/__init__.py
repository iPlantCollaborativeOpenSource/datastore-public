from irods import *


class DataStore(object):
    def configure(self, host=None, port=None, zone=None, path=None, user=None, password=None):
        self.host = host
        self.port = port
        self.zone = zone
        self.path = path
        self.user = user
        self.password = password

    def _connect(self):
        conn, err = rcConnect(self.host, self.port, self.user, self.zone)
        status = clientLoginWithPassword(conn, self.password)
        return conn

    def get_studies(self):
        conn = self._connect()
        c = irodsCollection(conn, self.path)
        base_path = c.getCollName()

        studies = map(lambda dir_name: {"name": dir_name, "path" : base_path + "/" + dir_name}, c.getSubCollections())
        return studies

DataStoreSession = DataStore()
