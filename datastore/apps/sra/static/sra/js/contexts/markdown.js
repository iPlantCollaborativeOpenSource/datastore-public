define(['datastore', 'backbone', 'jquery', 'utils'], function(Datastore, Backbone, $, Utils) {
    var Markdown = {
        Views: {}
    };

    Markdown.Views.MainView = Backbone.View.extend({
        initialize: function() {
        },
        render: function() {
            this.$el.append(new Datastore.Views.DataObjectHeader({model: this.model}).render().el);
            var self = this;
            $.get('/markdown' + Utils.urlencode_path(this.model.get('path')), function(data, text_status, jqXHR) {
                self.$el.append(data);
            });
            return this;
        }
    });

    return Markdown;
});
