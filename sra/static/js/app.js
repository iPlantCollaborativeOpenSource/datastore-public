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

	var DataApp = Backbone.View.extend({
		el: $('#file-scroller-inner'),
		events: {
			'click a.filename': 'file',
			'click #new-directory': 'newDirectory',
			'click #upload-file': 'uploadFileDialogue',
			'click #copy': 'copyNode',
			'click #paste': 'pasteNode',
			'click button#delete': 'deleteNode',
			'click button#metadata': 'metadata'
		},
		initialize: function() {
			//_.bindAll(this, 'render');
			//this.selectedModel = Nodes.get(this.model.id);
			//this.destinationDir = this.selectedModel;
			//this.clipboard = null;
			//this.render();
            console.log('init data app');
            Breadcrumbs.on('push', _.bind(this.push_dir, this));
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
		render: function() {
            console.log('render data app');
			//this.baseTreeView = new NodeListView({collection: this.model.get('children')});
			//this.$el.append(this.baseTreeView.render().el);
            return this;
		},
		file: function(e) {
			this.selectedModel = Nodes.get($(e.currentTarget).attr('data-node'));
			if (this.selectedModel.get('type') == 'dir') 
				this.destinationDir = this.selectedModel;
			else 
				this.destinationDir = this.selectedModel.get('parent');
			this.controls.setModel(this.selectedModel);
		},
		newDirectory: function(e) {
			console.log(this.model, this.selectedModel);
			console.log('create new directory in: ' + this.destinationDir.get('name'));	

			var newDir = new Node();
			var self = this;
			newDir.save(
				{
					type: 'dir', 
					name: 'New Directory', 
					parent_path: this.destinationDir.get('path')
				},
				{
					success: function() {
						Nodes.add(newDir);
						self.destinationDir.children.add(newDir);
					}
				}
			);
		},
		uploadFileDialogue: function() {
			modal = new Modal();	
			modal.title = 'Upload Files';
			modal.content = $('#UploadForm').html();
			modal.render();
			var self = this;
			$('#fileupload').fileupload({
				dataType: 'json',
				url: '/trellis-data/index.php/irods/nodes',
				formData: {
					parent_path: this.destinationDir.get('path')
				},
				done: function (e, data) {
					var file = data.result;
					$('<li/>')
						.text(file.name + ' (' + file.size + 'B)')
						.appendTo($('#uploaded-files'));
					var model = new Node(file);
					self.destinationDir.children.add(model);
					Nodes.add(model);
				}
			});
		},
		copyNode: function() {
			this.clipboard = this.selectedModel;
			$('#paste').removeAttr('disabled');
			console.log('save ' + this.selectedModel.get('name') + ' to the clipboard');
		},
		pasteNode: function() {
			console.log('put ' + this.clipboard.get('name') + ' into ' + this.destinationDir.get('name'));
			var newFile = new Node();
			var self = this;
			newFile.save(
				{
					type: 'file',
					name: this.clipboard.get('name'),
					parent_path: this.destinationDir.get('path'),
					copy_of: this.clipboard.id
				},
				{
					success: function() {
						Nodes.add(newFile);
						self.destinationDir.children.add(newFile);
					}
				}
			);
		},
		deleteNode: function() {
			var self = this;
			if (confirm('Delete node?')) {
				this.selectedModel.destroy({
					wait: true,
					error: function(model, response) {
						alert('File could not be deleted');
					},
					success: function(model, response) {
						self.selectedModel = model.get('parent');
						self.controls.setModel(self.selectedModel);
					}
				});
			}
		},
		metadata: function() {
			modal = new Modal();	
			modal.title = 'Metadata';
			modal.width = 800;
			modal.render();

			var metadataControl = new MetadataControl({model: this.selectedModel, collection: this.selectedModel.get('meta')});
			modal.$el.append(metadataControl.render().$el);

		}
	});

	Nodes = new NodeCollection();
	
	var App = Backbone.Router.extend({
		routes: {
			"": "index"
		},
		index: function() {
			this.baseNode = new Node({path: root});
			Nodes.add(this.baseNode);
			this.dataApp = new DataApp();
            this.dataApp.render();
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
