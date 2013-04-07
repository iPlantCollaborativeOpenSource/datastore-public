Datastore.Contexts['highlighter'] = {
    Views: {}
};

Datastore.Contexts['highlighter'].Views.MainView = Backbone.View.extend({
    initialize: function(options) {
        console.log(this.model);
        console.log(options);
    },
    render: function() {
        this.$el.append('hello');
        return this;
    }
});
