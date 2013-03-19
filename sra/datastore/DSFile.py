from irods import *
from os.path import basename
from DSMetadata import DSMetadata
from exception import FileDoesNotExist

class DSFile(object):
    def __init__(self, conn, path):
        self._conn = conn
        self._meta = None

    @property
    def metadata(self):
        if not self._meta:
            self._meta = DSMetadata(self._file)
        return self._meta

class DSDataObject(DSFile):
    def __init__(self, conn, path):
        DSFile.__init__(self, conn, path)
        self._file = iRodsOpen(conn, path, 'r')
        if not self._file:
            raise FileDoesNotExist("File does not exist") 
        self.name = self._file.getDataName()
        self.path = self._file.getPath() + "/" + self.name

    def __iter__(self):
        return DSDataObjectIter(self._conn, self.path)

class DSDataObjectIter(object):
    def __init__(self, conn, path):
        self.f = iRodsOpen(conn, path, 'r')

    def __iter__(self):
        return self

    def next(self):
        result = self.f.read(1<<24)
        if result:
            return result
        else:
            raise StopIteration

class DSCollection(DSFile):
    def __init__(self, conn, path):
        DSFile.__init__(self, conn, path)
        self._file = irodsCollection(conn, path)
        self.path = self._file.getCollName()
        self.name = basename(self.path)

    def get_subcollections(self):
        subcollections = self._file.getSubCollections()
        return map(lambda dir_name: DSCollection(self._conn, self.path + "/" + dir_name), subcollections)

    def get_objects(self):
        objects = self._file.getObjects()
        return map(lambda obj: DSDataObject(self._conn, self.path + "/" + obj[0]), objects)
