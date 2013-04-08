define(['datastore', 'backbone', 'jquery', 'utils'], function(Datastore, Backbone, $, Utils) {

var Gallery = {
    Models: {},
    Collections: {},
    Views: {}
};

Gallery.Models.Photo = Backbone.Model.extend();

Gallery.Collections.PhotoCollection = Backbone.Collection.extend();

Gallery.Views.Gallery = Backbone.View.extend({
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
            new Gallery.Views.Thumbnail({model: model})
                .render().$el.appendTo(self.$el); 
        });
    }
});

Gallery.Views.Thumbnail = Backbone.View.extend({
    tagName: "li",
    className: "span4",
    events: {
        'click .thumbnail-link': 'open_image'
    },
    initialize: function() {
    },
    render: function() {
        $("<div>", {'class': 'thumbnail'})
            .data('model', this.model)
            .append(
                $('<a>', {href: '#', 'class': 'thumbnail-link'})
                    .append($("<img>", {
                        src: this.model.get('thumbnail_src')
                    }))
            )
            .append(
                $("<div>", {'class': 'caption'})
                    .append($("<h3>").append(this.model.get('name')))
                    //.append($("<p>").append('caption'))
                    .append($("<p>").append($("<a>", {href: this.model.get('download_url'), 'class': 'btn btn-primary'}).append('Download')))
            )
            .appendTo(this.$el);
        return this;
    },
    open_image: function(e) {
        e.preventDefault();
        var node = $(e.currentTarget).closest('.thumbnail').data('model'); 
        Datastore.Events.Breadcrumbs.trigger('push', node.get('file'));
        return false;
    }
});

function get_thumb(path) {
    arr = path.split("/");
    name = arr.pop();
    arr.push(".thumbnails")
    arr.push(name);
    return arr.join("/");
}

Gallery.Views.MainView = Backbone.View.extend({
    initialize: function() {
    },
    render: function() {
        var $container = $('<div>', {'class': 'row'});
        var photo_collection = new Gallery.Collections.PhotoCollection();
        var gallery = new Gallery.Views.Gallery({
            collection: photo_collection
        }).render();
        $container
            .append($("<div>", {'class': 'span12'}).append(gallery.el))
            .appendTo(this.$el);

        var self = this;
        this.collection.bind('reset', function() {
            var models = _.map(self.collection.models.filter(function(model) {return model.get('name') != ".thumbnails"}), function(model) {
                return new Gallery.Models.Photo({
                    name: model.get('name'),
                    path: model.get('path'),
                    src: "/serve" + Utils.urlencode_path(model.get('path')),
                    thumbnail_src: "/serve" + Utils.urlencode_path(get_thumb(model.get('path'))),
                    download_url: model.get('download_url'),
                    file: model
                });
            });
            photo_collection.reset(models);
        });
        return this;
    }
});

return Gallery;
});
