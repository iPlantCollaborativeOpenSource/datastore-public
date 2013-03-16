$(document).ready(function() {
	var Node = Backbone.Model.extend({  
        urlRoot: '/api/file',
		url: function() {
            console.log(this);
			return '/api/file' + '?path=' + encodeURIComponent(this.get('path'));
		},
        parse: function(obj) {
            r = {}
            r.children = new NodeCollection();
            r.children.url = '/api/collection?path=' + encodeURIComponent(obj.path);
            return _.extend(obj, r);
        },
            /*
		initialize: function(){  
			//this.children = new NodeCollection();
			//this.children.url = '/trellis-data/index.php/irods/node_collections/' + this.id;
			//this.set('download_url', '/trellis-data/index.php/irods/download/' + this.id);
			//console.log(this.id);
			//this.set('meta', new MetaCollection(this.get('meta')));
			var self = this;
			_.each(this.get('meta').models, function(model) {
				model.node = self;
			});
		},  
        */
		defaults: { 
			parent:	null
		},
		fetchChildren: function() {
			var self = this;
			this.children.bind('reset', function(nodes) {
				_.each(nodes.models, function(node) {
					node.set('parent', self);
				});
				Nodes.add(nodes.models);
			});	
			this.children.fetch();
		}
	}); 

	var NodeCollection = Backbone.Collection.extend({
		model: Node,
		url: '/trellis-data/index.php/irods/nodes'
	});

    var NodeListView = Backbone.View.extend({
        tagName: 'div',
        events: {
            'click li.dir a': 'open_dir'
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
                    .append($('<a>').append(node.get('name')))
                    .appendTo($list);
            });
            this.$el.append($list);
            return this;
        },
        open_dir: function(e) {
            node = $(e.currentTarget).closest('li').data('model'); 
            console.log(node);
            Breadcrumbs.trigger('push', node);
        }
    });

    var Breadcrumbs = {};
    _.extend(Breadcrumbs, Backbone.Events);

    var BreadcrumbView = Backbone.View.extend({
        el: $("#breadcrumbs"),
        events: {
            'click a': 'open_dir'
        },
        initialize: function() {
            Breadcrumbs.on('push', _.bind(this.push_dir, this));
            Breadcrumbs.on('pop', _.bind(this.pop_dir, this));
            this.nodes = []
            this.$list = null;
        },
        render: function() {
            this.$list = $("<ul>", {'class': 'clearfix'});
            this.$el.append(this.$list);
            return this;
        },
        push_dir: function(model) {
            this.nodes.push(model);
            $("<li>")
                .data('model', model)
                .append($('<a>').append(model.get('name')))
                .appendTo(this.$list);
        },
        pop_dir: function() {
            this.$list.children().last().remove();
        },
        open_dir: function(e) {
            model = $(e.currentTarget).closest('li').data('model');
            console.log(model);
            Breadcrumbs.trigger('pop');
        }
    });

	var DataApp = Backbone.View.extend({
		el: $('#file-scroller-inner'),
		events: {
		},
		initialize: function() {
			//_.bindAll(this, 'render');
			//this.selectedModel = Nodes.get(this.model.id);
			//this.destinationDir = this.selectedModel;
			//this.clipboard = null;
			//this.render();
            console.log('init data app');
            Breadcrumbs.on('push', _.bind(this.push_dir, this));
            Breadcrumbs.on('pop', _.bind(this.add_to_pop_queue, this));
            this.pop_queue = 0;
            this.popping = false;
		},
        push_dir: function(model) {
            console.log('pushdir data app');
            console.log(model, this);

            var new_width = (this.$el.children().length + 1) * 940;
            this.$el.width(new_width);

            var new_view  = new NodeListView({collection: model.get('children')})
            new_view.render().$el.appendTo(this.$el);

            model.get('children').fetch();
            console.log(new_view.$el.position().left);
            this.$el.parent().animate({
                scrollLeft: new_view.$el.position().left
            }, 'fast');
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

	Nodes = new NodeCollection();
	
	var App = Backbone.Router.extend({
		routes: {
			"": "index"
		},
		index: function() {
			this.baseNode = new Node({path: root});
			Nodes.add(this.baseNode);
			this.dataApp = new DataApp().render();
            this.breadcrumb_view = new BreadcrumbView().render();
			var self = this;
			this.baseNode.fetch({
				success: function() {
                    Breadcrumbs.trigger('push', self.baseNode);
				}
			});
		}
	});
	
	var app = new App();
	Backbone.history.start();

});
