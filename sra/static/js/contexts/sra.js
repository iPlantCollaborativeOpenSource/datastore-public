define(['datastore', 'backbone', 'jquery', 'utils'], function(Datastore, Backbone, $, Utils) {
    var SRA = {
        Collections: {},
        Models: {},
        Views: {},
        Events: {},
    };

    SRA.Models.Study = Backbone.Model.extend({
        url: function() {
            return '/api/file?path=' + this.get('path');
        },
        parse: function(data) {
            metadata = Utils.metadata_to_object(data.metadata);
            return {
                id: data.name,
                path: data.path,
                'abstract': metadata['abstract'],
                title: metadata['title'],
                description: metadata['description']
            };
        }
    });

    SRA.Collections.StudyCollection = Backbone.Collection.extend({
        model: SRA.Models.Study
    });

    SRA.Views.StudyList = Backbone.View.extend({
        id: 'sra-sidebar',
        events: {
            'click li a': 'select_study'
        },
        initialize: function(options) {
            this.collection.bind('reset', this.add_studies, this);
        },
        render: function() {
            return this;
        },
        add_studies: function() {
            this.$el.empty();
            var $list = $('<ul>', {id: 'study-list'});
            this.collection.each(function(model) {
                new SRA.Views.StudyListItem({model: model}).render().$el.appendTo($list);
                model.fetch();
            });
            this.$el.append($list);
        },
        select_study: function(e) {
            e.preventDefault();
            var model = $(e.currentTarget).closest('li').data('model');
            Datastore.Events.Traversal.trigger('navigate', model.get('file'));
            return false;
        }
    });

    SRA.Views.StudyListItem = Backbone.View.extend({
        tagName: 'li',
        initialize: function() {
            this.model.bind('sync', this.render, this);
        },
        render: function() {
            this.$el
                .empty()
                .append(
                    $('<a>', {href: this.model.get('browse_url')})
                        .append($('<span>', {'class': 'study-id'}).append(this.model.id))
                        .append($('<span>', {'class': 'study-title'}).append(this.model.get('title') || '&nbsp;'))
                )
                .data('model', this.model)
                .attr('data-model_id', this.model.id);
            return this;
        }
    });

    SRA.Views.MainView = Backbone.View.extend({
        tagName: 'div',    
        initialize: function() {
        },
        render: function() {
            var study_collection = new SRA.Collections.StudyCollection();
            var study_list = new SRA.Views.StudyList({
                collection: study_collection
            }).render();
            this.$el
                .append($('<h2>').append('Welcome to the iPlant Sequence Database!'))
                .append(study_list.el);

            var self = this;
            this.collection.bind('reset', function() {
                var models = _.map(self.collection.models, function(model) {
                    return new SRA.Models.Study({
                        id: model.get('name'),
                        path: model.get('path'),
                        file: model,
                        browse_url: Utils.urlencode_path(model.get('browse_url'))
                    });
                });
                study_collection.reset(models);
            });
            return this;
        }
    });
    return SRA;
});
