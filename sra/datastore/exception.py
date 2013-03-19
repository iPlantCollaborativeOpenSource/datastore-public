class FileDoesNotExist(Exception):
    def __init__(self, str):
        return super(FileDoesNotExist, self).__init__(str)
