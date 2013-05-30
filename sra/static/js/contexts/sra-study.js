define(['datastore', 'backbone', 'jquery'], function(Datastore, Backbone, $) {
    var Image = {
        Views: {}
    };

    Image.Views.MainView = Backbone.View.extend({
        initialize: function() {
            console.log(this.model);
        },
        render: function() {
            $('<h2>')
                .append(this.model.get('name') + ' ' + this.model.get('metadata')['title'])
                .appendTo(this.$el);

            var $dl = $('<dl>')
                .append($("<dt>").append("Abstract"))
                .append($("<dd>").append(this.model.get('metadata')['abstract']));

            var desc;
            if ((desc = this.model.get('metadata')['description']) != null)
                $dl.append($("<dt>").append("Description"))
                .append($("<dd>").append(desc));

            $dl.appendTo(this.$el);

            $('<h3>').append('Reads').appendTo(this.$el);

            this.$el
                .append(new Datastore.Views.NodeListView({model: this.model, collection:this.model.get('children')}).el);
            return this;
        }
    });

    return Image;
});
