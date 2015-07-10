define(['datastore', 'backbone', 'jquery', 'underscore'], function(Datastore, Backbone, $, _) {
    var Image = {
        Views: {}
    };

    Image.Views.MainView = Backbone.View.extend({
        initialize: function() {
        },
        render: function() {
            this.$el
                .append(new Datastore.Views.DataObjectHeader({model: this.model}).render().el)
                .append($("<p>").append($("<img>", {
                    src: this.model.get('serve_url'),
                    'class': 'img-polaroid'
                })));
            if (this.options.caption)
                this.$el.append($("<p>").append(_.escape(this.options.caption)));
            return this;
        }
    });

    return Image;
});
