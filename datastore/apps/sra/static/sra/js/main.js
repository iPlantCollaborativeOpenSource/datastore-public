require.config({
    paths: {
        'jquery': '//cdnjs.cloudflare.com/ajax/libs/jquery/2.2.1/jquery.min',
        'backbone': '//cdnjs.cloudflare.com/ajax/libs/backbone.js/0.9.10/backbone-min',
        'underscore': '//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.6.0/underscore-min',
        'moment': '//cdnjs.cloudflare.com/ajax/libs/moment.js/2.5.1/moment.min',
        'shCore': '/static/sra/syntaxhighlighter/scripts/shCore',
        'bootstrap': '//cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.6/js/bootstrap.min',
        // default brushes
        'shBrushCss': '/static/sra/syntaxhighlighter/scripts/shBrushCss',
        'shBrushJava': '/static/sra/syntaxhighlighter/scripts/shBrushJava',
        'shBrushPerl': '/static/sra/syntaxhighlighter/scripts/shBrushPerl',
        'shBrushPhp': '/static/sra/syntaxhighlighter/scripts/shBrushPhp',
        'shBrushPlain': '/static/sra/syntaxhighlighter/scripts/shBrushPlain',
        'shBrushPython': '/static/sra/syntaxhighlighter/scripts/shBrushPython',
        'shBrushRuby': '/static/sra/syntaxhighlighter/scripts/shBrushRuby',
        'shBrushXml': '/static/sra/syntaxhighlighter/scripts/shBrushXml',
        // custom brushes
        'shBrushFasta': '/static/sra/js/brushes/shBrushFasta',
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

// require(['backbone', 'jquery', 'datastore'], function(Backbone, $, Datastore) {
//     $(document).ready(function() {
        // var app = new Datastore.Router();
//         Backbone.history.start({pushState: true});
//     });
// });
