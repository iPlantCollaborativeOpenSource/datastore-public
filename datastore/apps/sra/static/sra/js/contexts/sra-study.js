define(['datastore', 'backbone', 'jquery', 'utils'], function(Datastore, Backbone, $, Utils) {
    var Image = {
        Views: {}
    };

    Image.Views.MainView = Backbone.View.extend({
        initialize: function() {
            this.title = Utils.get_metadata.bind(this)('title');
            this.abs = Utils.get_metadata.bind(this)('abstract');
            this.description = Utils.get_metadata.bind(this)('description');
        },
        render: function() {
            $('<h2>')
                .append(this.model.get('name') + ' ' + this.title)
                .appendTo(this.$el);

            var $dl = $('<dl>')
                .append($("<dt>").append("Abstract"))
                .append($("<dd>").append(this.abs));

            var desc;
            if ((desc = this.description) != null)
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
