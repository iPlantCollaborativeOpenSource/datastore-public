require.config({
    paths: {
        'jquery': 'lib/jquery-1.9.1.min',
        'backbone': 'lib/backbone-min',
        'underscore': 'lib/underscore-min'
    },
    shim: {
        backbone: {
            deps: ['underscore', 'jquery'],
            exports: 'Backbone'
        },
        underscore: {
            exports: '_'
        }
    }
});

require(['backbone', 'jquery', 'datastore'], function(Backbone, $, Datastore) {
    $(document).ready(function() {
        var app = new Datastore.Router();
        Backbone.history.start();
    });
});
