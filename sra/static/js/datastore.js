define(['jquery', 'underscore', 'backbone', 'utils'], function($, _, Backbone, Utils) {

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
        if (obj.is_dir) {
            r.children = new Datastore.Collections.NodeCollection();
            r.children.url = '/api/collection?path=' + encodeURIComponent(obj.path);
        }
        r.root_relative_path = obj.path.replace(root, '');
        if (obj.is_dir != undefined && obj.is_dir == false)
            r.download_url = '/download' + Utils.urlencode_path(obj.path);
            r.serve_url = '/serve' + Utils.urlencode_path(obj.path);

        r.metadata = Utils.metadata_to_object(obj.metadata);
        if (r.metadata[metadata_prefix])
            r.template_metadata = r.metadata[metadata_prefix];
        return _.extend(obj, r);
    },
    get_ancestors: function() {
        if (!this.get('root_relative_path')) 
            return [];
        //console.log(this.get('root_relative_path'));
        var dirs = this.get('root_relative_path').split('/').splice(1)
        dirs.pop();
        console.log(dirs);
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
        console.log(ancestors);
        return ancestors;
    }
}); 

Datastore.Collections.NodeCollection = Backbone.Collection.extend({
    model: Datastore.Models.Node,
    url: '/trellis-data/index.php/irods/nodes'
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
                .addClass(node.get('is_dir') ? 'dir' : 'file')
                .append($('<a>', {href: '#'}).append(node.get('name')))
                .appendTo($list);
        });
        this.$el.append($list);
        return this;
    },
    open_file: function(e) {
        var node = $(e.currentTarget).closest('li').data('model'); 
        //console.log(node);
        Datastore.Events.Traversal.trigger('navigate', node);
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
            $("<dl>")
                .append($("<dt>").append("Checksum:"))
                .append($("<dd>").append(this.model.get('checksum')))
                .append($("<dt>").append("Created:"))
                .append($("<dd>").append(this.model.get('create_time')))
                .append($("<dt>").append("Last Modified:"))
                .append($("<dd>").append(this.model.get('modify_time')))
        );
        return this;
    }
});

// Event space for managing filesystem traversals. Supports a single event, 
// "navigate", that is triggered upon the selection of a new folder or file
Datastore.Events.Traversal = _.extend({}, Backbone.Events);

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
        var model = $(e.currentTarget).closest('li').data('model');
        Datastore.Events.Traversal.trigger('navigate', model);
    }
});

// The main content area
Datastore.Views.DataApp = Backbone.View.extend({
    events: {
    },
    initialize: function() {
        Datastore.Events.Traversal.on('navigate', _.bind(this.navigate, this));
        this.pop_queue = 0;
        this.popping = false;
    },
    navigate: function(model) {
        var self = this;
        model.fetch({
            success: function() {
                var new_width = (self.$el.children().length + 1) * 940;
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
                    }, 'fast');
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
    },
    add_to_pop_queue: function() {
        this.pop_queue++; 
        if (!this.popping)
            this.pop_dir();
    },
    pop_dir: function() {
        this.popping = true;
        var self = this;
        this.$el.parent().animate(
            {scrollLeft: this.$el.children().last().prev().position().left}, 
            'slow', 
            function() {
                console.log('pop finished'); 
                self.$el.children().last().remove();
                var new_width = (self.$el.children().length) * 940;
                self.$el.width(new_width);
                self.pop_queue--;
                if (self.pop_queue > 0)
                   self.pop_dir(); 
                else
                    self.popping = false;
            }
        );
    },
    render: function() {
        return this;
    },
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
                            'class': 'btn btn-primary', 
                            'type': 'button',
                            'href': this.model.get('download_url')
                        })
                            .append($('<i>', {'class': 'icon-circle-arrow-down icon-white'}))
                            .append(' Download')
                    )
                )
            );
        return this;
    }
});

Datastore.Router = Backbone.Router.extend({
    routes: {
        "": "index"
    },
    index: function() {
        this.baseNode = new Datastore.Models.Node({path: root, name: root_name, is_dir: true});
        this.dataApp = new Datastore.Views.DataApp({el: $('#file-scroller-inner')}).render();
        this.breadcrumb_view = new Datastore.Views.BreadcrumbView({el: $('#breadcrumbs'), base_node: this.baseNode}).render();
        Datastore.Events.Traversal.trigger('navigate', this.baseNode);
    }
});

return Datastore;

});
