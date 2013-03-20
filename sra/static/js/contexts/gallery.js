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
                src: this.model.get('thumbnail_src')
            }))
            .append(
                $("<div>", {'class': 'caption'})
                    .append($("<h3>").append(this.model.get('name')))
                    //.append($("<p>").append('caption'))
                    .append($("<p>").append($("<a>", {href: this.model.get('download_url'), 'class': 'btn btn-primary'}).append('Download')))
            )
            .appendTo(this.$el);
        return this;
    }
});

function get_thumb(path) {
    arr = path.split("/");
    name = arr.pop();
    arr.push(".thumbnails")
    arr.push(name);
    return arr.join("/");
}

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
            var models = _.map(self.collection.models.filter(function(model) {return model.get('name') != ".thumbnails"}), function(model) {
                return new Datastore.Contexts['gallery'].Models.Photo({
                    name: model.get('name'),
                    path: model.get('path'),
                    src: "/serve" + urlencode_path(model.get('root_relative_path')),
                    thumbnail_src: "/serve" + urlencode_path(get_thumb(model.get('root_relative_path'))),
                    download_url: model.get('download_url')
                });
            });
            photo_collection.reset(models);
        });
        return this;
    }
});
