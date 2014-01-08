define(['datastore', 'backbone', 'jquery'], function(Datastore, Backbone, $) {
    var Image = {
        Views: {}
    };

    Image.Views.MainView = Backbone.View.extend({
        initialize: function() {
            var get_metadata = function(key) {
                var meta = _.find(this.model.get('metadata'), function(m) {
                    return m.name == key;
                });
                if (meta)
                    return meta['value'];
                return null;
            };

            this.title = get_metadata.bind(this)('title');
            this.abs = get_metadata.bind(this)('abstract');
            this.description = get_metadata.bind(this)('description');
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
