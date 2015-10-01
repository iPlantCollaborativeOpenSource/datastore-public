define(['datastore', 'backbone', 'jquery', 'utils'], function(Datastore, Backbone, $, Utils) {
    var DataCommons = {
        Collections: {},
        Models: {},
        Views: {},
        Events: {},
    };

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
        initialize: function() {
            this.title = Utils.get_metadata.bind(this)('title');
            this.abs = Utils.get_metadata.bind(this)('abstract');
            this.description = Utils.get_metadata.bind(this)('description');
        },
        render: function() {
            var collections = new Datastore.Views.NodeListView({model: this.model, collection:this.model.get('children')})

            console.log(this)
            this.$el
                .append($('<h2>').append('Metadata'))

            var $dl = $('<dl>')

            _.each(this.model.attributes.metadata, function(m) {
              // console.log(m['name'], ': ', m['value']);
              $dl.append($("<dt>").append(m['name']))
              .append($("<dd>").append(m['value']))
            })

            $dl.appendTo(this.$el);

            this.$el.append(collections.el);

            console.log('this at end', this)
            return this;
        }
    });
    return DataCommons;
});
