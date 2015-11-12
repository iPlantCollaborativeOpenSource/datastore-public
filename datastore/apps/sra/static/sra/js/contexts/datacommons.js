define(['datastore', 'backbone', 'jquery', 'utils'], function(Datastore, Backbone, $, Utils) {
    var DataCommons = {
        Collections: {},
        Models: {},
        Views: {},
        Events: {},
    };

    // DataCommons.Models.MetadataMatches = Backbone.Model.extend({
    //     // url: function() {
    //     //     return '/search/?name=Library Number&value=' + this.libraryNumber
    //     // },
    //     initialize: function(models, options) {
    //         this.name = '';
    //         this.value = '';
    //     },
    // });

    DataCommons.Collections.MetadataMatchesCollection = Backbone.Collection.extend({
        // model: DataCommons.Models.MetadataMatchesDatastore.Models.Node,
        model: Datastore.Models.Node,
        url: function() {
            return '/search/?name=' + this.name + '&value=' + this.value
        },
        initialize: function(models, options) {
            this.name = options.name;
            this.value = options.value;
        }
    });

    // DataCommons.Models.Study = Backbone.Model.extend({
    //     url: function() {
    //         return '/api/file?path=' + this.get('path');
    //     },
    //     parse: function(data) {
    //         metadata = Utils.metadata_to_object(data.metadata);
    //         return {
    //             id: data.name,
    //             path: data.path,
    //             'abstract': metadata['abstract'],
    //             title: metadata['title'],
    //             description: metadata['description']
    //         };
    //     }
    // });

    // DataCommons.Collections.StudyCollection = Backbone.Collection.extend({
    //     model: DataCommons.Models.Study
    // });

    // DataCommons.Views.StudyList = Backbone.View.extend({
    //     id: 'DataCommons-sidebar',
    //     events: {
    //         'click li a': 'select_study'
    //     },
    //     initialize: function(options) {
    //         this.collection.bind('reset', this.add_studies, this);
    //     },
    //     render: function() {
    //         return this;
    //     },
    //     add_studies: function() {
    //         this.$el.empty();
    //         var $list = $('<ul>', {id: 'study-list'});
    //         this.collection.each(function(model) {
    //             new DataCommons.Views.StudyListItem({model: model}).render().$el.appendTo($list);
    //             model.fetch();
    //         });
    //         this.$el.append($list);
    //     },
    //     select_study: function(e) {
    //         e.preventDefault();
    //         var model = $(e.currentTarget).closest('li').data('model');
    //         Datastore.Events.Traversal.trigger('navigate', model.get('file'));
    //         return false;
    //     }
    // });

    // DataCommons.Views.StudyListItem = Backbone.View.extend({
    //     tagName: 'li',
    //     initialize: function() {
    //         this.model.bind('sync', this.render, this);
    //     },
    //     render: function() {
    //         this.$el
    //             .empty()
    //             .append(
    //                 $('<a>', {href: this.model.get('browse_url')})
    //                     .append($('<span>', {'class': 'study-id'}).append(this.model.id))
    //                     .append($('<span>', {'class': 'study-title'}).append(this.model.get('title') || '&nbsp;'))
    //             )
    //             .data('model', this.model)
    //             .attr('data-model_id', this.model.id);
    //         return this;
    //     }
    // });

    DataCommons.Views.MainView = Backbone.View.extend({
        tagName: 'div',
        events: {
            'click .metadataLink': 'search_metadata'
        },
        initialize: function() {
            this.libraryNumber = Utils.get_metadata.bind(this)('Library Number');
            this.subjects = Utils.get_metadata_values.bind(this)('Subject');
            this.contributors = Utils.get_metadata_values.bind(this)('Contributor');
        },
        render: function() {
            console.log('this', this)
            var collections = new Datastore.Views.NodeListView({model: this.model, collection:this.model.get('children')})

            this.$el
                .append($('<h2>').append('Metadata'))

            var $subjects = $('<div>').append('Subject: ')
            _.each(this.subjects, function(s){
                $subjects.append($('<a>',{
                            'TARGET':'_blank'
                        }).append(s + ', ')
                )
            })
            $subjects.appendTo(this.$el);

            var $contributors = $('<div>').append('Contributors: ')
            _.each(this.contributors, function(s){
                $contributors.append($('<a>',{
                            'TARGET':'_blank'
                        }).append(s + ', ')
                )
            })
            $contributors.appendTo(this.$el);

            var $libraryNumber = $('<div>').append('Library Number: ')
                        .append($('<a>',{
                            // 'TARGET':'_blank'
                            // href: '/search/?name=Library Number&value=' + this.libraryNumber
                            'class': 'metadataLink',
                        }).append(this.libraryNumber))
            $libraryNumber.appendTo(this.$el);

            var $dl = $('<dl>')
            _.each(this.model.attributes.metadata, function(m) {
              // console.log(m['name'], ': ', m['value']);
              $dl.append($("<dt>").append(m['name']))
              .append($("<dd>").append(m['value']))
            })
            $dl.appendTo(this.$el);

            this.$el.append(collections.el);

            return this;
        },
        search_metadata: function(e) {
            var results = new DataCommons.Collections.MetadataMatchesCollection([], {name: 'Library Number', value: e.currentTarget.innerHTML});
            var self=this;
            results.fetch({update: true, remove: false})
            .done(
                function(){
                    console.log('metadata search results', results)
                    self.append_collection(results)
                });
        },
        append_collection: function(collection) {
            this.$el.empty();
            $list = $("<ul>", {'class': 'node-list'});
            //console.log(this);
            collection.each(function(node) {
                $("<li>")
                    .data('model', node)
                    .addClass(node.get('is_dir') ? 'dir' : 'file ext-' + Utils.file_ext(node.get('name')))
                    .append($('<a>', {href: node.get('browse_url')}).append(node.get('name')))
                    .appendTo($list);
            });
            this.$el.append($list);

            return this;
        },
    });
    return DataCommons;
});
