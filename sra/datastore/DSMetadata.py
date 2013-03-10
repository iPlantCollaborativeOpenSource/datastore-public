class DSMetadata(object):

    def __init__(self, obj):
        self._obj = obj
        self._reset_metadata()

    def _reset_metadata(self):
        self._meta = self._obj.getUserMetadata()

    def getall(self, key):
        """
        Returns a list of (value, unit) tuples associated with a given key
        """
        if not isinstance(key, str):
            raise TypeError
        return [(t[1],t[2]) for t in self._meta if t[0] == key]

    def getone(self, key):
        """
        Returns the (value, unit) tuple defined for a key. If there are none,
        of if there are more than one defined, raises KeyError
        """
        values = self.getall(key)
        if not values:
            raise KeyError
        if len(values) > 1:
            raise KeyError
        return values[0]

    def add(self, key, value):
        """
        Add a (value, unit) tuple to a key
        """
        if not isinstance(key, str) or not isinstance(value, tuple):
            raise TypeError
        self._obj.addUserMetadata(key, value[0], value[1])
        self._reset_metadata()

    def remove(self, key, value):
        """
        Removes a (value, unit) tuple from a key
        """
        if not isinstance(key, str) or not isinstance(value, tuple):
            raise TypeError
        self._obj.rmUserMetadata(key, value[0], value[1])
        self._reset_metadata()
    
    def items(self):
        """
        Returns a list of (key, value, unit) tuples
        """
        return self._meta

    def keys(self):
        """
        Return a list of keys. Duplicates preserved
        """
        return [t[0] for t in self._meta]
        
    def __getitem__(self, key):
        """
        Returns the first (value, unit) tuple defined on key. Order is
        undefined. Use getone() or getall() instead
        """
        values = self.getall(key)
        if not values:
            return KeyError 
        return values[0]

    def __setitem__(self, key, value):
        """
        Deletes all existing values associated with a given key and associates
        the key with a single (value, unit) tuple
        """
        if not isinstance(key, str) or not isinstance(value, tuple):
            raise TypeError
        self._delete_all_values(key)
        self._obj.addUserMetadata(key, value[0], value[1])
        self._reset_metadata()

    def _delete_all_values(self, key):
        current_values = self.getall(key)
        for val in current_values:
            self._obj.rmUserMetadata(key, val[0], val[1])

    def __delitem__(self, key):
        """
        Deletes all existing values associated with a given key
        """
        if not isinstance(key, str):
            raise TypeError
        self._delete_all_values(key)
        self._reset_metadata()
