define(['require', 'datastore', 'backbone', 'jquery', 'utils'], function(require, Datastore, Backbone, $, Utils) {
    //console.log(SyntaxHighlighter);
    var Highlighter = {
        Views: {},
        BrushSources: {}
    };

    Utils.load_css('static/syntaxhighlighter/styles/shCore.css');
    Utils.load_css('static/syntaxhighlighter/styles/shThemeDefault.css');

    Highlighter.BrushSources = {
        'php': 'shBrushPhp',
        'js': 'shBrushJScript',
        'css': 'shBrushCss',
        'py': 'shBrushPython',
        'plain': 'shBrushPlain',
        'fasta': 'shBrushFasta'
    };

    Highlighter.Views.MainView = Backbone.View.extend({
        initialize: function(options) {
            console.log(this.model);
            console.log(options);
            if (!this.options.brush)
                this.options.brush = 'text';

            var ext = this.model.get('path').split('.').pop();
            this.brush_source = Highlighter.BrushSources[ext] || 'shBrushPlain';
            console.log(this.brush_source);
        },
        render: function() {
            console.log(this.options.brush);
            this.$el.append(new Datastore.Views.DataObjectHeader({model: this.model}).render().el);
            var self = this;
            $.get('serve' + this.model.get('path'), function(data, text_status, jqXHR) {
                var $pre = $("<pre>", {'class' : 'brush: ' + self.options.brush}).append(_.escape(data));
                require(['shCore', self.brush_source], function(SyntaxHighlighter) {
                    // Set discoveredBrushes to null because this library sucks
                    SyntaxHighlighter.vars.discoveredBrushes = null;
                    console.log(SyntaxHighlighter.brushes);
                    $pre.appendTo(self.$el);
                    SyntaxHighlighter.highlight({}, $pre[0]);
                });
            });
            return this;
        }
    });

    return Highlighter;
});
