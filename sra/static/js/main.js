require.config({
    paths: {
        'jquery': '//cdnjs.cloudflare.com/ajax/libs/jquery/1.9.1/jquery',
        'backbone': '//cdnjs.cloudflare.com/ajax/libs/backbone.js/0.9.10/backbone-min',
        'underscore': '//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.6.0/underscore-min',
        'moment': '//cdnjs.cloudflare.com/ajax/libs/moment.js/2.5.1/moment.min',
        'shCore': '/static/syntaxhighlighter/scripts/shCore',
        'bootstrap': '//cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/2.3.2/js/bootstrap',
        // default brushes
        'shBrushCss': '/static/syntaxhighlighter/scripts/shBrushCss',
        'shBrushJava': '/static/syntaxhighlighter/scripts/shBrushJava',
        'shBrushPerl': '/static/syntaxhighlighter/scripts/shBrushPerl',
        'shBrushPhp': '/static/syntaxhighlighter/scripts/shBrushPhp',
        'shBrushPlain': '/static/syntaxhighlighter/scripts/shBrushPlain',
        'shBrushPython': '/static/syntaxhighlighter/scripts/shBrushPython',
        'shBrushRuby': '/static/syntaxhighlighter/scripts/shBrushRuby',
        'shBrushXml': '/static/syntaxhighlighter/scripts/shBrushXml',
        // custom brushes
        'shBrushFasta': '/static/js/brushes/shBrushFasta',
    },
    shim: {
        backbone: {
            deps: ['underscore', 'jquery'],
            exports: 'Backbone'
        },
        underscore: {
            exports: '_'
        },
        bootstrap: {
            deps: ['jquery']
        },
        shCore: {
            exports: 'SyntaxHighlighter'
        },
        shBrushCss: {deps: ['shCore']},
        shBrushJava: {deps: ['shCore']},
        shBrushPerl: {deps: ['shCore']},
        shBrushPhp: {deps: ['shCore']},
        shBrushPlain: {deps: ['shCore']},
        shBrushPython: {deps: ['shCore']},
        shBrushRuby: {deps: ['shCore']},
        shBrushXml: {deps: ['shCore']},
        shBrushFasta: {deps: ['shCore']}
    }
});

require(['backbone', 'jquery', 'datastore'], function(Backbone, $, Datastore) {
    $(document).ready(function() {
        var app = new Datastore.Router();
        Backbone.history.start({pushState: true});
    });
});
