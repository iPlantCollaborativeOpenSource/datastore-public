define(['datastore', 'backbone', 'jquery', 'utils'], function(Datastore, Backbone, $, Utils) {
    var Website = {
        Views: {}
    };

    Website.Views.MainView = Backbone.View.extend({
        initialize: function() {
        },
        render: function() {
            $("<iframe>", {
                src: "/serve" + Utils.urlencode_path(this.model.get('path')) + "/index.html",
                width: 936,
                height: 600
            }).appendTo(this.$el);
            return this;
        }
    });

    return Website;
});
