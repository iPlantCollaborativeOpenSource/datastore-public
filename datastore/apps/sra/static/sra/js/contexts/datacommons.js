define(['datastore', 'backbone', 'jquery', 'utils'], function(Datastore, Backbone, $, Utils) {
    var DataCommons = {
        Collections: {},
        Models: {},
        Views: {},
        Events: {},
    };

    DataCommons.Collections.MetadataMatches = Backbone.Collection.extend({
        // model: DataCommons.Models.MetadataMatchesDatastore.Models.Node,
        model: Datastore.Models.Node,
        url: function() {
            if (this.value) {
                return '/search/?name=' + this.name + '&value=' + this.value
            } else {
                return '/search/?name=' + this.name
            }
        },
        initialize: function(models, options) {
            this.name = options.name;
            this.value = options.value;
        }
    });

    DataCommons.Views.MainView = Backbone.View.extend({
        tagName: 'div',
        events: {
            'click .metadataLink': 'search_metadata'
        },
        initialize: function() {
            this.libraryNumber = Utils.get_metadata.bind(this)('Library Number');
            this.subjects = Utils.get_metadata_values.bind(this)('Subject');
            this.contributors = Utils.get_metadata_values.bind(this)('Contributor');
        },
        render: function() {
            console.log('MainView render this', this)

            this.$el
                .append($('<h2>').append('Metadata'))

            var $subjects = $('<div>').append('Subject: ')
            _.each(this.subjects, function(s){
                $subjects.append($('<a>',{
                            'TARGET':'_blank'
                        }).append(s + ', ')
                )
            })
            $subjects.appendTo(this.$el);

            var $contributors = $('<div>').append('Contributors: ')
            _.each(this.contributors, function(s){
                $contributors.append($('<a>',{
                            'TARGET':'_blank'
                        }).append(s + ', ')
                )
            })
            $contributors.appendTo(this.$el);

            var $libraryNumber = $('<div>').append('Library Number: ').data('metadata_name', 'Library Number')
                        .append($('<a>',{
                            // 'TARGET':'_blank'
                            // href: '/search/?name=Library Number&value=' + this.libraryNumber
                            'class': 'metadataLink',
                        }).append(this.libraryNumber))
            $libraryNumber.appendTo(this.$el);

            var $dl = $('<dl>')
            _.each(this.model.attributes.metadata, function(m) {
              // console.log(m['name'], ': ', m['value']);
              $dl.append($("<dt>").append(m['name']))
              .append($("<dd>").append(m['value']))
            })
            $dl.appendTo(this.$el);
            console.log('this.model',this.model)
            this.$el.append(new Datastore.Views.NodeListView({model: this.model, collection:this.model.get('children')}).el);

            return this;
        },
        search_metadata: function(e) {
            e.preventDefault();
            var searchParams = {}
            searchParams['metadata_name'] = $(e.currentTarget).closest('div').data('metadata_name');
            searchParams['metadata_value'] = e.currentTarget.innerHTML

            var results = new DataCommons.Collections.MetadataMatches([], {name: searchParams['metadata_name'], value: searchParams['metadata_value']});

            var self=this;
            results.fetch({update: true, remove: false})
            .done(
                function(){
                    console.log('metadata search results', results)
                    self.show_results(results, searchParams)
                });

            // DataCommons.Events.Traversal.trigger('search_metadata', searchParams);
            return false;
        },
        show_results: function(collection, searchParams) {
            this.$el.empty();
            heading = this.$el.append('Collections with ' + searchParams['metadata_name'])

            if (searchParams['metadata_value']) {
                heading.append(' = ' + searchParams['metadata_value'])
            }

            $list = $("<ul>", {'class': 'node-list'});

            collection.each(function(node) {
                $("<li>")
                    .data('model', node)
                    .addClass(node.get('is_dir') ? 'dir' : 'file ext-' + Utils.file_ext(node.get('name')))
                    .append($('<a>', {href: node.get('browse_url')}).append(node.get('name')))
                    .appendTo($list);
            });
            this.$el.append($list);

            return this;
        },
    });

    // Event space for managing metadata searches. Supports a single event,
    // "search_metadata", that is triggered when clicking on linked metadata
    DataCommons.Events.Traversal = _.extend({}, Backbone.Events);

    DataCommons.Events.Traversal.on('search_metadata', function(searchParams) {
        if (searchParams['metadata_value']) {
            Backbone.history.navigate('search?name=' + searchParams['metadata_name'] + '&value=' + searchParams['metadata_value']);
        } else {
            Backbone.history.navigate('search?name=' + searchParams['metadata_name']);

        }
    });
    return DataCommons;
});
