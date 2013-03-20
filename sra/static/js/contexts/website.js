Datastore.Contexts['website'] = {
    Views: {}
};

Datastore.Contexts['website'].Views.MainView = Backbone.View.extend({
    initialize: function() {
        console.log(this.model);
        console.log(this.collection);
    },
    render: function() {
        $("<iframe>", {
            src: "/serve" + this.model.get('root_relative_path') + "/index.html",
            width: 940,
            height: 600
        }).appendTo(this.$el);
        return this;
    }
});
