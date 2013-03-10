from irods import *
from os.path import basename

class DSFile(object):
    def __init__(self, conn, path):
        self._conn = conn

    @staticmethod
    def dictify_metadata(metadata):
        def unpack_tuple(t):
            return (t[0], (t[1], t[2]))
        return dict(map(unpack_tuple, metadata))

class DSDataObject(DSFile):
    def __init__(self, conn, path):
        DSFile.__init__(self, conn, path)
        self._file = iRodsOpen(conn, path, 'r')
        self.name = self._file.getDataName()
        self.path = self._file.getPath() + "/" + self.name

    def get_metadata(self):
        return DSFile.dictify_metadata(self._file.getUserMetadata())

    def __iter__(self):
        return DSDataObjectIter(self._conn, self.path)

class DSDataObjectIter(object):
    def __init__(self, conn, path):
        self.f = iRodsOpen(conn, path, 'r')

    def __iter__(self):
        return self

    def next(self):
        result = self.f.read(1<<16)
        if result:
            return result
        else:
            raise StopIteration

class DSCollection(DSFile):
    def __init__(self, conn, path):
        DSFile.__init__(self, conn, path)
        self._collection = irodsCollection(conn, path)
        self.path = self._collection.getCollName()
        self.name = basename(self.path)

    def get_subcollections(self):
        subcollections = self._collection.getSubCollections()
        return map(lambda dir_name: DSCollection(self._conn, self.path + "/" + dir_name), subcollections)

    def get_objects(self):
        objects = self._collection.getObjects()
        return map(lambda obj: DSDataObject(self._conn, self.path + "/" + obj[0]), objects)

    def get_metadata(self):
        return DSFile.dictify_metadata(self._collection.getUserMetadata())
