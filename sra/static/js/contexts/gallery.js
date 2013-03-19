Datastore.Contexts['gallery'] = {
    Models: {},
    Collections: {},
    Views: {}
};

Datastore.Contexts['gallery'].Models.Photo = Backbone.Model.extend();

Datastore.Contexts['gallery'].Collections.PhotoCollection = Backbone.Collection.extend();

Datastore.Contexts['gallery'].Views.Gallery = Backbone.View.extend({
    tagName: "ul",
    className: "thumbnails",
    initialize: function() {
        this.collection.bind('reset', this.append_photos, this);
    },
    render: function() {
        return this;
    },
    append_photos: function() {
        var self = this;
        console.log(this.collection);
        this.collection.each(function(model) {
            new Datastore.Contexts['gallery'].Views.Thumbnail({model: model})
                .render().$el.appendTo(self.$el); 
        });
    }
});

Datastore.Contexts['gallery'].Views.Thumbnail = Backbone.View.extend({
    tagName: "li",
    className: "span4",
    initialize: function() {
    },
    render: function() {
        $thumb = $("<div>", {'class': 'thumbnail'})
            .append($("<img>", {
                'data-src': this.model.get('src'),
                src: 'test.jpg'
            }))
            .append(
                $("<div>", {'class': 'caption'})
                    .append($("<h3>").append('title'))
                    .append($("<p>").append('caption'))
            )
            .appendTo(this.$el);
        return this;
    }
});

Datastore.Contexts['gallery'].Views.MainView = Backbone.View.extend({
    initialize: function() {
    },
    render: function() {
        var $container = $('<div>', {'class': 'row'});
        var photo_collection = new Datastore.Contexts['gallery'].Collections.PhotoCollection();
        var gallery = new Datastore.Contexts['gallery'].Views.Gallery({
            collection: photo_collection
        }).render();
        $container
            .append($("<div>", {'class': 'span12'}).append(gallery.el))
            .appendTo(this.$el);

        var self = this;
        this.collection.bind('reset', function() {
            var models = _.map(self.collection.models, function(model) {
                return new Datastore.Contexts['gallery'].Models.Photo({
                    name: model.get('name'),
                    path: model.get('path')
                });
            });
            photo_collection.reset(models);
        });
        return this;
    }
});
