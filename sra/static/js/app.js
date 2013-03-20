Datastore = {
    Models: {},
    Collections: {},
    Views: {},
    Events: {},
    Contexts: {}
};

Datastore.Models.Node = Backbone.Model.extend({  
    urlRoot: '/api/file',
    url: function() {
        console.log(this);
        return '/api/file' + '?path=' + encodeURIComponent(this.get('path'));
    },
    parse: function(obj) {
        r = {}
        r.children = new Datastore.Collections.NodeCollection();
        r.children.url = '/api/collection?path=' + encodeURIComponent(obj.path);
        r.root_relative_path = obj.path.replace(root, '');
        return _.extend(obj, r);
    },
    defaults: { 
        parent:	null
    }
}); 

Datastore.Collections.NodeCollection = Backbone.Collection.extend({
    model: Datastore.Models.Node,
    url: '/trellis-data/index.php/irods/nodes'
});

Datastore.Views.NodeListView = Backbone.View.extend({
    tagName: 'div',
    events: {
        'click li.dir a': 'open_dir',
        'click li.file a': 'download_file'
    },
    initialize: function(options) {
        this.collection.bind('reset', _.bind(this.append_children, this));
    },
    render: function() {
        this.$el.append('loading');
        console.log(this.collection); 
        return this;
    },
    append_children: function() {
        this.$el.empty();
        $list = $("<ul>", {'class': 'node-list'});
        console.log(this);
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
    open_dir: function(e) {
        node = $(e.currentTarget).closest('li').data('model'); 
        console.log(node);
        Datastore.Events.Breadcrumbs.trigger('push', node);
    },
    download_file: function(e) {
        node = $(e.currentTarget).closest('li').data('model'); 
        window.location.replace('/download?path=' + node.get('path'));
    }
});

Datastore.Events.Breadcrumbs = _.extend({}, Backbone.Events);

Datastore.Views.BreadcrumbView = Backbone.View.extend({
    events: {
        'click a': 'open_dir'
    },
    initialize: function() {
        Datastore.Events.Breadcrumbs.on('push', _.bind(this.push_dir, this));
        Datastore.Events.Breadcrumbs.on('pop', _.bind(this.pop_dir, this));
        //this.nodes = []
        this.$list = null;
    },
    render: function() {
        this.$list = $("<ul>", {'class': 'clearfix'});
        this.$el.append(this.$list);
        return this;
    },
    push_dir: function(model) {
        //this.nodes.push(model);
        $("<li>")
            .data('model', model)
            .append($('<a>', {href: '#'}).append(model.get('name')))
            .appendTo(this.$list);
    },
    pop_dir: function() {
        this.$list.children().last().remove();
    },
    open_dir: function(e) {
        li = $(e.currentTarget).closest('li');
        var index = this.$list.children().index(li);
        var len = this.$list.children().length;
        var pops = len - index - 1;
        for (i = 0; i < pops; i++)
            Datastore.Events.Breadcrumbs.trigger('pop');
    }
});

Datastore.Views.DataApp = Backbone.View.extend({
    events: {
    },
    initialize: function() {
        console.log('init data app');
        Datastore.Events.Breadcrumbs.on('push', _.bind(this.push_dir, this));
        Datastore.Events.Breadcrumbs.on('pop', _.bind(this.add_to_pop_queue, this));
        this.pop_queue = 0;
        this.popping = false;
    },
    push_dir: function(model) {
        console.log('pushdir data app');
        console.log(model);

        var self = this;
        model.fetch({
            success: function() {
                var new_width = (self.$el.children().length + 1) * 940;
                self.$el.width(new_width);

                console.log(model.get('metadata'));
                var template = _.find(model.get('metadata'), function(meta) {
                    return meta[0] == 'template';
                });
                console.log(template);

                var append_view = function(view) {
                    console.log(view);
                    var new_view  = new view({model: model, collection: model.get('children')})
                    new_view.render().$el.appendTo(self.$el);

                    model.get('children').fetch();
                    console.log(new_view.$el.position().left);
                    self.$el.parent().animate({
                        scrollLeft: new_view.$el.position().left
                    }, 'fast');
                };

                var view;
                if (template) {
                    require(['/static/js/contexts/' + template[1] + '.js'], function() {
                        view = Datastore.Contexts[template[1]].Views.MainView;   
                        append_view(view);
                    });
                } else {
                    view = Datastore.Views.NodeListView;
                    append_view(view);
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
        console.log('render data app');
        return this;
    },
});


Datastore.Router = Backbone.Router.extend({
    routes: {
        "": "index"
    },
    index: function() {
        this.baseNode = new Datastore.Models.Node({path: root, name: root_name});
        this.dataApp = new Datastore.Views.DataApp({el: $('#file-scroller-inner')}).render();
        this.breadcrumb_view = new Datastore.Views.BreadcrumbView({el: $('#breadcrumbs')}).render();
        Datastore.Events.Breadcrumbs.trigger('push', this.baseNode);
    }
});

$(document).ready(function() {
	var app = new Datastore.Router();
	Backbone.history.start();
});
