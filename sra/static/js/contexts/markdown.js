define(['datastore', 'backbone', 'jquery'], function(Datastore, Backbone, $) {
    var Markdown = {
        Views: {}
    };

    Markdown.Views.MainView = Backbone.View.extend({
        initialize: function() {
            console.log(this.model);
        },
        render: function() {
            this.$el.append(new Datastore.Views.DataObjectHeader({model: this.model}).render().el);
            var self = this;
            $.get('markdown' + this.model.get('path'), function(data, text_status, jqXHR) {
                self.$el.append(data);
            });
            return this;
        }
    });

    return Markdown;
});
