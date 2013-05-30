require.config({
    paths: {
        'jquery': 'lib/jquery-1.9.1.min',
        'backbone': 'lib/backbone-min',
        'underscore': 'lib/underscore-min',
        'moment': 'lib/moment.min',
        'shCore': '../syntaxhighlighter/scripts/shCore',
        // default brushes
        'shBrushCss': '../syntaxhighlighter/scripts/shBrushCss',
        'shBrushJava': '../syntaxhighlighter/scripts/shBrushJava',
        'shBrushPerl': '../syntaxhighlighter/scripts/shBrushPerl',
        'shBrushPhp': '../syntaxhighlighter/scripts/shBrushPhp',
        'shBrushPlain': '../syntaxhighlighter/scripts/shBrushPlain',
        'shBrushPython': '../syntaxhighlighter/scripts/shBrushPython',
        'shBrushRuby': '../syntaxhighlighter/scripts/shBrushRuby',
        'shBrushXml': '../syntaxhighlighter/scripts/shBrushXml',
        // custom brushes
        'shBrushFasta': 'brushes/shBrushFasta',
    },
    shim: {
        backbone: {
            deps: ['underscore', 'jquery'],
            exports: 'Backbone'
        },
        underscore: {
            exports: '_'
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
        Backbone.history.start();
    });
});
