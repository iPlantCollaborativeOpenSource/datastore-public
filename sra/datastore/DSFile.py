from irods import *
from os.path import basename

class DSFile(object):
    def __init__(self, conn, path):
        self._conn = conn

class DSCollection(DSFile):
    def __init__(self, conn, path):
        DSFile.__init__(self, conn, path)
        self._collection = irodsCollection(conn, path)
        self.path = self._collection.getCollName()
        self.name = basename(self.path)

    def get_subcollections(self):
        subcollections = self._collection.getSubCollections()
        return map(lambda dir_name: DSCollection(self._conn, self.path + "/" + dir_name), subcollections)

    def get_metadata(self):
        def unpack_tuple(t):
            return (t[0], (t[1], t[2]))
        return dict(map(unpack_tuple, self._collection.getUserMetadata()))
