Datastore.Contexts['highlighter'] = {
    Views: {},
    BrushSources: {}
};

(function() {
    var default_brush_sources = {
        'php': 'shBrushPhp.js',
        'js': 'shBrushJScript.js',
        'css': 'shBrushCss.js',
        'py': 'shBrushPython.js'
    };
    var add_prefix_to_values = function(obj, prefix) {
        return _.object(_.map(_.pairs(obj), function(pair) {
            return [pair[0], prefix + pair[1]]
        }));
    };
    Datastore.Contexts['highlighter'].BrushSources = add_prefix_to_values(default_brush_sources, '/static/syntaxhighlighter/scripts/');
})();

var args = _.map(_.pairs(Datastore.Contexts['highlighter'].BrushSources), function(pair) {
    return pair[0] + ' ' + pair[1];
});
console.log(args);
SyntaxHighlighter.autoloader.apply(null, args);
//SyntaxHighlighter.autoloader('php static/syntaxhighlighter/scripts/shBrush.js');

Datastore.Contexts['highlighter'].Views.MainView = Backbone.View.extend({
    initialize: function(options) {
        console.log(this.model);
        console.log(options);
        if (!this.options.brush)
            this.options.brush = 'text';

        var ext = this.model.get('path').split('.').pop();
        this.brush_source = Datastore.Contexts['highlighter'].BrushSources[ext] || 'static/syntaxhighligher/scripts/shBrushPlain.js';
        console.log(this.brush_source);
    },
    render: function() {
        console.log(this.options.brush);
        var self = this;
        $.get('serve' + this.model.get('path'), function(data, text_status, jqXHR) {
            self.$el.append($("<pre>", {'class' : 'brush: ' + self.options.brush}).append(_.escape(data)));
            //require([self.brush_source], function() {
                SyntaxHighlighter.highlight(self.$el.find('pre')[0]);
            //});
        });
        return this;
    }
});
