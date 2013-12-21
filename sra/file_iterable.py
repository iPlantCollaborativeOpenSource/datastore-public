import logging
logger = logging.getLogger(__name__)
# http://docs.webob.org/en/latest/file-example.html

class FileIterable(object):
    def __init__(self, file_obj, start=None, stop=None):
        self.file_obj = file_obj
        self.start = start
        self.stop = stop

    def __iter__(self):
        return FileIterator(self.file_obj, self.start, self.stop)

    def app_iter_range(self, start, stop):
        logger.debug(start, stop)
        return self.__class__(self.file_obj, start, stop)

class FileIterator(object):
    chunk_size = 4096

    def __init__(self, file_obj, start, stop):
        self.file_obj = file_obj
        if start:
            self.file_obj.seek(start)
        if stop is not None:
            self.length = stop - start
        else:
            self.length = None

    def __iter__(self):
        return self

    def next(self):
        if self.length is not None and self.length <= 0:
            self.file_obj.close()
            raise StopIteration
        chunk = self.file_obj.read(self.chunk_size)
        if not chunk:
            self.file_obj.close()
            raise StopIteration
        if self.length is not None:
            self.length -= len(chunk)
            if self.length < 0:
                # Chop off the extra:
                chunk = chunk[:self.length]
        return chunk
    __next__ = next # py3 compat
