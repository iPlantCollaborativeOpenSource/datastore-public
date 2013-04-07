define(function() {
    return {
        urlencode_path: function(path) {
            return _.map(path.split('/'), encodeURIComponent).join('/');
        },
        bytes_to_human: function(bytes) {
            var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
            return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
        },
        /*
         * Given a list of metadata objects like
         * [{name: 'p1.k1', value: 'v1'},
         *  {name: 'p2.k1', value: 'v1'},
         *  {name: 'p1.k2', value: 'v2'},
         *  {name: 'p1.k3.k1, value: 'v3'},
         *  {name: 'p1.k3.k2, value: 'v4'},
         *  {name: 'p1.k3.k3, value: 'v5'},
         *  {name: 'p3', value: 'v6'} ]
         * return an object formatted like
         * { 
             p1: {
                 k1: 'v1',
                 k2: 'v2',
                 k3: { k1: 'v3', k2: 'v4', k3: 'v5'}
             },
             p2: {
                 k1: 'v1'
             },
             p3: 'v6'
         * }
         */
        metadata_to_object: function(metadata) {
            var obj = {};
            _.each(metadata, function(datum) {
                var parts = datum.name.split('.');
                if (parts.length == 1)
                    obj[datum.name] = datum.value;
                else {
                    var ns = obj;
                    for (i = 0; i < parts.length - 1; i++) {
                        var part = parts[i];
                        if (!_.has(ns, part))
                            ns[part] = {}
                        ns = ns[part];
                    }
                    ns[parts.pop()] = datum.value;
                }
            });
            return obj;
        }
    };
});
