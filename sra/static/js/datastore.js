define(['jquery', 'underscore', 'backbone', 'utils', 'moment', 'bootstrap'], function($, _, Backbone, Utils, moment, _bootstrap) {

var Datastore = {
    Models: {},
    Collections: {},
    Views: {},
    Events: {},
    Contexts: {}
};

// A Node is a filesystem node--a file or directory
Datastore.Models.Node = Backbone.Model.extend({  
    urlRoot: '/api/file',
    defaults: { 
        parent:	null
    },
    url: function() {
        return '/api/file' + '?path=' + encodeURIComponent(this.get('path'));
    },
    parse: function(obj) {
        r = {}
        if (obj.is_dir)
            r.children = new Datastore.Collections.NodeCollection([], {path: obj.path});
        if (obj.is_dir != undefined && obj.is_dir == false)
            r.download_url = '/download' + Utils.urlencode_path(obj.path);
            r.serve_url = '/serve' + Utils.urlencode_path(obj.path);

        r.root_relative_path = obj.path.replace(root, '');

        r.metadata = Utils.metadata_to_object(obj.metadata);
        if (r.metadata[metadata_prefix])
            r.template_metadata = r.metadata[metadata_prefix];

        r.create_time = moment.unix(obj.create_time);
        r.modify_time = moment.unix(obj.modify_time);;

        return _.extend(obj, r);
    },
    get_ancestors: function() {
        if (!this.get('root_relative_path')) 
            return [];
        var dirs = this.get('root_relative_path').split('/').splice(1)
        dirs.pop();
        var ancestors = _.map(dirs, function(name, i) {
            var rel = '/' + dirs.slice(0, i+1).join('/');
            return new Datastore.Models.Node({
                name: name,
                path: root + rel,
                is_dir: true,
                root_relative_path: rel
            });
        })
        ancestors.push(this);
        return ancestors;
    }
}); 

Datastore.Collections.NodeCollection = Backbone.Collection.extend({
    model: Datastore.Models.Node,
    url: function() {
        return '/api/collection?path=' + encodeURIComponent(this.path);
    },
    initialize: function(models, options) {
        this.path = options.path;
    }
});

// The default view for a directory if no template is associated with it
Datastore.Views.NodeListView = Backbone.View.extend({
    tagName: 'div',
    events: {
        'click li.dir a': 'open_file',
        'click li.file a': 'open_file'
    },
    initialize: function(options) {
        this.collection.bind('reset', _.bind(this.append_children, this));
    },
    render: function() {
        this.$el.append('loading');
        //console.log(this.collection); 
        return this;
    },
    append_children: function() {
        this.$el.empty();
        $list = $("<ul>", {'class': 'node-list'});
        //console.log(this);
        this.collection.each(function(node) {
            $("<li>")
                .data('model', node)
                .addClass(node.get('is_dir') ? 'dir' : 'file ext-' + Utils.file_ext(node.get('name')))
                .append($('<a>', {href: '#'}).append(node.get('name')))
                .appendTo($list);
        });
        this.$el.append($list);
        return this;
    },
    open_file: function(e) {
        e.preventDefault();
        var node = $(e.currentTarget).closest('li').data('model'); 
        //console.log(node);
        Datastore.Events.Traversal.trigger('navigate', node);
        return false;
    }
});

// The default file view if no template is associated with it
Datastore.Views.FileView = Backbone.View.extend({
    tagName: 'div',
    events: {},
    initialize: function(options) {
    }, 
    render: function() {
        this.$el.append(new Datastore.Views.DataObjectHeader({model: this.model}).render().el);
        this.$el.append(
            $("<div>")
                .addClass('no-preview')
                .append("No preview available")
        );
        return this;
    }
});

// Event space for managing filesystem traversals. Supports a single event, 
// "navigate", that is triggered upon the selection of a new folder or file
Datastore.Events.Traversal = _.extend({}, Backbone.Events);

Datastore.Events.Traversal.on('navigate', function(model) {
    if (model.get('root_relative_path'))
        Backbone.history.navigate(model.get('root_relative_path').slice(1));
    else
        Backbone.history.navigate("");
});

// The breadcrumbs across the top of the app
Datastore.Views.BreadcrumbView = Backbone.View.extend({
    events: {
        'click a': 'open_dir'
    },
    initialize: function() {
        Datastore.Events.Traversal.on('navigate', _.bind(this.populate_breadcrumbs, this));
        this.base_node = this.options.base_node;
        this.$list = null;
    },
    render: function() {
        this.$list = $("<ul>", {'class': 'clearfix'});
        this.$list
            .appendTo(this.$el);
        return this;
    },
    breadcrumb: function(model) {
        return $("<li>")
            .addClass(model.get('is_dir') ? 'dir' : 'file')
            .data('model', model)
            .append($('<a>', {href: '#'}).append(model.get('name')));
    },
    populate_breadcrumbs: function(model) {
        //console.log(model);
        //console.log(model.get_ancestors());
        this.$list
            .empty()
            .append(this.breadcrumb(this.base_node))
            .append(_.map(model.get_ancestors(), this.breadcrumb));
    },
    open_dir: function(e) {
        e.preventDefault();
        var model = $(e.currentTarget).closest('li').data('model');
        Datastore.Events.Traversal.trigger('navigate', model);
        return false;
    }
});

// The main content area
Datastore.Views.DataApp = Backbone.View.extend({
    events: {
    },
    initialize: function() {
        Datastore.Events.Traversal.on('navigate', _.bind(this.navigate, this));
    },
    render: function() {
        return this;
    },
    navigate: function(model) {
        var self = this;
        model.fetch({
            success: function() {
                var new_width = 2 * 940;
                self.$el.width(new_width);

                //console.log(model.get('metadata'));
                var template = model.get('template_metadata') ? model.get('template_metadata')['template'] : null;
                //console.log(template);

                var append_view = function(view, options) {
                    //console.log(view);
                    if (model.get('is_dir')) {
                        var new_view  = new view(_.extend({model: model, collection: model.get('children')}, options))
                        new_view.render().$el.appendTo(self.$el);
                        model.get('children').fetch();
                    } else {
                        var new_view  = new view(_.extend({model: model}, options))
                        new_view.render().$el.appendTo(self.$el);
                    }
                    if (template)
                        new_view.$el.addClass('template-' + template);
                    //console.log(new_view.$el.position().left);
                    self.$el.parent().animate({
                        scrollLeft: new_view.$el.position().left
                    }, 'fast', function() {
                        self.$el
                            .children(':not(:last-child)').remove().end()
                            .parent().scrollLeft(0);
                    });
                };

                var view;
                //console.log(model.get('is_dir'));
                if (template) {
                    require(['static/js/contexts/' + template + '.js'], function(Context) {
                        view = Context.Views.MainView;   
                        view_options = model.get('template_metadata')['template_options'] || {};
                        append_view(view, view_options);
                    });
                } else if (model.get('is_dir')) {
                    view = Datastore.Views.NodeListView;
                    append_view(view, {});
                } else {
                    view = Datastore.Views.FileView;
                    append_view(view, {});
                }
            }
        });
    }
});

// Each file view is rendered with a header that contains the file's
// name, size, and a download link
Datastore.Views.DataObjectHeader = Backbone.View.extend({
    tagName: 'div',
    className: 'data-object-header clearfix',
    initialize: function() {
    },
    render: function() {
        this.$el
            .append($("<ul>", {'class': 'file-properties'})
                .append($("<li>").append(this.model.get('name')))
                .append($("<li>").append(Utils.bytes_to_human(this.model.get('size'))))
            )
            .append($('<div>', {'class': 'file-action'})
                .append($("<div>", {'class': 'btn-group'})
                    .append(
                        $('<a>', {
                            'class': 'btn file-info-button'
                        })
                            .append($('<i>', {'class': 'icon-info-sign'}))
                            .append(' Info')
                            .popover({
                                html: true, 
                                placement: 'bottom', 
                                title: this.model.get('name'),
                                content: _.bind(this.file_info, this),
                                afterShow: _.bind(this.highlight_link, this)
                            })
                    )
                    .append(
                        $('<a>', {
                            'class': 'btn btn-primary', 
                            'href': this.model.get('download_url')
                        })
                            .append($('<i>', {'class': 'icon-circle-arrow-down icon-white'}))
                            .append(' Download')
                    )
                )
            );
        return this;
    },
    file_info: function() {
        //return "HELLO";
        return $("<dl>")
            .addClass('file-info')
            .append($("<dt>").append("Link:"))
            .append($("<dd>").append($("<input>", {value: Backbone.history.location.href, type: 'text'})))
            .append($("<dt>").append("Checksum:"))
            .append($("<dd>").append(this.model.get('checksum')))
            .append($("<dt>").append("Created:"))
            .append($("<dd>").append(this.model.get('create_time').format('lll')))
            .append($("<dt>").append("Last Modified:"))
            .append($("<dd>").append(this.model.get('modify_time').format('lll')));
    },
    highlight_link: function() {
        this.$el.find('dl.file-info input').select();
    }
});

Datastore.Router = Backbone.Router.extend({
    routes: {
        "": "index",
        "*path": "expand"
    },
    initialize: function() {
        this.baseNode = new Datastore.Models.Node({path: root, name: root_name, is_dir: true});
        this.dataApp = new Datastore.Views.DataApp({el: $('#file-scroller-inner')}).render();
        this.breadcrumb_view = new Datastore.Views.BreadcrumbView({el: $('#breadcrumbs'), base_node: this.baseNode}).render();
    },
    index: function() {
        Datastore.Events.Traversal.trigger('navigate', this.baseNode);
    },
    expand: function(path) {
        var node = new Datastore.Models.Node({path: root + '/' + path});
        node.fetch({
            success: function(model) {
                Datastore.Events.Traversal.trigger('navigate', model);
            }
        });
    }
});

// This is a hack to add a callback to bootstrap's popover
// http://www.silviarebelo.com/2013/03/adding-callbacks-to-twitter-bootstraps-javascript-plugins/
var pt = $.fn.popover.Constructor.prototype.show;
$.fn.popover.Constructor.prototype.show = function(){
    pt.call(this);
    if (this.options.afterShow)
        this.options.afterShow();
}

return Datastore;

});
