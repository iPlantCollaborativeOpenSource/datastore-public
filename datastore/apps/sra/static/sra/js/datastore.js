define(['jquery', 'underscore', 'backbone', 'utils', 'moment', 'bootstrap'], function($, _, Backbone, Utils, moment, _bootstrap) {

var Datacommons = {
    Models: {},
    Collections: {},
    Views: {},
    Events: {},
    Contexts: {}
};

// A Node is a filesystem node--a file or directory
Datacommons.Models.Node = Backbone.Model.extend({
    urlRoot: '/api/file',
    defaults: {
        parent: null
    },
    url: function() {
        console.log('models.node')
        return '/api/file' + '?path=' + encodeURIComponent(this.get('path'));
    },
    parse: function(obj) {
        console.log('obj', obj)
        r = {}
        if (obj.is_dir)
            r.children = new Datacommons.Collections.NodeCollection([], {path: obj.path});

        var encoded_path = Utils.urlencode_path(obj.path);
        if (obj.is_dir != undefined && obj.is_dir == false) {
            r.download_url = '/download' + encoded_path;
            r.serve_url = '/serve' + encoded_path;
        }
        r.browse_url = '/browse' + encoded_path;

        r.root_relative_path = obj.path.replace(root, '');

        var metadata = Utils.metadata_to_object(obj.metadata);
        console.log('obj.metadata', obj.metadata)
        console.log('metadata', metadata)
        if (metadata[metadata_prefix])
            console.log('metadata_prefix', metadata_prefix)
            r.template_metadata = metadata[metadata_prefix];

        r.create_time = moment.unix(obj.create_time);
        r.modify_time = moment.unix(obj.modify_time);;

        return _.extend(obj, r);
    },
    get_ancestors: function() {
        if (!this.get('root_relative_path'))
            return [];
        var dirs = this.get('root_relative_path').split('/').splice(1)
        dirs.pop();
        var ancestors = _.map(dirs, function(name, i) {
            var rel = '/' + dirs.slice(0, i+1).join('/');
            return new Datacommons.Models.Node({
                name: name,
                path: root + rel,
                is_dir: true,
                root_relative_path: rel,
                browse_url: "/browse" + Utils.urlencode_path(root + rel)
            });
        })
        ancestors.push(this);
        return ancestors;
    }
});

Datacommons.Collections.NodeCollection = Backbone.Collection.extend({
    model: Datacommons.Models.Node,
    url: function() {
        return '/api/collection?path=' + encodeURIComponent(this.path) + '&page=' + this.page;
    },
    initialize: function(models, options) {
        this.path = options.path;
        this.page = 1;
    },
    parse: function(response){
        console.log('response', response)
        this.moreData = response.more_data
        this.page =response.page
        return response.models
    },
});

Datacommons.Collections.MetadataMatches = Backbone.Collection.extend({
    model: Datacommons.Models.Node,
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

// The default view for a directory if no template is associated with it
Datacommons.Views.NodeListView = Backbone.View.extend({
    tagName: 'div',
    events: {
        'click li.dir a': 'open_file',
        'click li.file a': 'open_file',
        'click #load_more': 'load_more'
    },
    initialize: function(options) {
        this.collection.bind('reset', _.bind(this.append_children, this));
    },
    render: function() {
        this.$el.append('loading');
        //console.log(this.collection);
        return this;
    },
    append_children: function() {
        this.$el.empty();
        $list = $("<ul>", {'class': 'node-list'});
        //console.log(this);
        this.collection.each(function(node) {
            $("<li>")
                .data('model', node)
                .addClass(node.get('is_dir') ? 'dir' : 'file ext-' + Utils.file_ext(node.get('name')))
                .append($('<a>', {href: node.get('browse_url')}).append(node.get('name')))
                .appendTo($list);
        });
        this.$el.append($list);

        if (this.collection.moreData) {
            this.$el.append(
                $('<a>', {
                    'class': 'btn file-info-button',
                    'id': 'load_more',
                })
                .append('Load more'))
        }
        return this;
    },
    open_file: function(e) {
        e.preventDefault();
        var node = $(e.currentTarget).closest('li').data('model');
        //console.log(node);
        Datacommons.Events.Traversal.trigger('navigate', node);
        return false;
    },
    load_more: function(e) {
        this.collection.page++
        var self=this;
        this.collection.fetch({update: true, remove: false})
        .done(
            function(){
              self.append_children()
            });
    }
});

// The default file view if no template is associated with it
Datacommons.Views.FileView = Backbone.View.extend({
    tagName: 'div',
    events: {},
    initialize: function(options) {
    },
    render: function() {
        this.$el.append(new Datacommons.Views.DataObjectHeader({model: this.model}).render().el);
        this.$el.append(
            $("<div>")
                .addClass('no-preview')
                .append("No preview available")
        );
        return this;
    }
});

// Event space for managing filesystem traversals. Supports a single event,
// "navigate", that is triggered upon the selection of a new folder or file
Datacommons.Events.Traversal = _.extend({}, Backbone.Events);

Datacommons.Events.Traversal.on('navigate', function(model) {
    if (model.get('path')) {
        $('.content .popover').remove();
        Backbone.history.navigate('browse' + model.get('path'));
    } else {
        Backbone.history.navigate("");
    }
});

// The breadcrumbs across the top of the app
Datacommons.Views.BreadcrumbView = Backbone.View.extend({
    events: {
        'click a': 'open_dir'
    },
    initialize: function() {
        Datacommons.Events.Traversal.on('navigate', _.bind(this.populate_breadcrumbs, this));
        this.base_node = this.options.base_node;
        this.$list = null;
    },
    render: function() {
        this.$list = $("<ul>", {'class': 'clearfix'});
        this.$list
            .appendTo(this.$el);
        return this;
    },
    breadcrumb: function(model) {
        return $("<li>")
            .addClass(model.get('is_dir') ? 'dir' : 'file')
            .data('model', model)
            .append($('<a>', {href: model.get('browse_url')}).append(model.get('name')));
    },
    populate_breadcrumbs: function(model) {
        //console.log(model);
        //console.log(model.get_ancestors());
        this.$list
            .empty()
            .append(this.breadcrumb(this.base_node))
            .append(_.map(model.get_ancestors(), this.breadcrumb));
    },
    open_dir: function(e) {
        e.preventDefault();
        var model = $(e.currentTarget).closest('li').data('model');
        Datacommons.Events.Traversal.trigger('navigate', model);
        return false;
    }
});

// The main content area
Datacommons.Views.DataApp = Backbone.View.extend({
    events: {
    },
    initialize: function() {
        Datacommons.Events.Traversal.on('navigate', _.bind(this.navigate, this));
    },
    render: function() {
        return this;
    },
    navigate: function(model) {
        var self = this;
        model.fetch({
            success: function() {
                var new_width = 2 * 940;
                self.$el.width(new_width);

                // console.log('model', model);
                var template = model.get('template_metadata') ? model.get('template_metadata')['template'] : null;
                // var template = 'datacommons' //for testing
                //console.log(template);

                var append_view = function(view, options) {
                    if (model.get('is_dir')) {
                        var new_view  = new view(_.extend({model: model, collection: model.get('children')}, options))
                        new_view.render().$el.appendTo(self.$el);
                        model.get('children').fetch();
                    } else {
                        var new_view  = new view(_.extend({model: model}, options))
                        new_view.render().$el.appendTo(self.$el);
                    }
                    if (template)
                        new_view.$el.addClass('template-' + template);
                    //console.log(new_view.$el.position().left);
                    self.$el.parent().animate({
                        scrollLeft: new_view.$el.position().left
                    }, 'fast', function() {
                        self.$el
                            .children(':not(:last-child)').remove().end()
                            .parent().scrollLeft(0);
                    });
                };

                var view;
                //console.log(model.get('is_dir'));
                if (template) {
                    require(['/static/sra/js/contexts/' + template + '.js'], function(Context) {
                        view = Context.Views.MainView;
                        view_options = model.get('template_metadata')['template_options'] || {};
                        // view_options = 'datacommons'; //for testing
                        append_view(view, view_options);
                    });
                } else if (model.get('is_dir')) {
                    // view = Datacommons.Views.NodeListView;
                    view = Datacommons.Views.Metadata;
                    append_view(view, {});
                } else {
                    view = Datacommons.Views.FileView;
                    append_view(view, {});
                }
            }
        });
    }
});

// Each file view is rendered with a header that contains the file's
// name, size, and a download link
Datacommons.Views.DataObjectHeader = Backbone.View.extend({
    tagName: 'div',
    className: 'data-object-header clearfix',
    initialize: function() {
    },
    render: function() {
        var downloadRenderer = (this.model.get('size') > 2000000000) //greater than 2 GB
            ? _.bind(this.download_options_button, this)
            : _.bind(this.download_button, this);

        this.$el
            .append($("<ul>", {'class': 'file-properties'})
                .append($("<li>").append(this.model.get('name')))
                .append($("<li>").append(Utils.bytes_to_human(this.model.get('size'))))
            )
            .append($('<div>', {'class': 'file-action'})
                .append($("<div>", {'class': 'btn-group'})
                    .append(
                        $('<a>', {
                            'class': 'btn file-info-button'
                        })
                            .append($('<i>', {'class': 'icon-info-sign'}))
                            .append(' Info')
                            .popover({
                                html: true,
                                placement: 'bottom',
                                title: this.model.get('name'),
                                content: _.bind(this.file_info, this),
                                afterShow: _.bind(this.highlight_link, this)
                            })
                    )
                    .append($('<a>', {'class': 'btn file-info-button'})
                            .append($('<i>', {'class': 'icon-list'}))
                            .append(' Metadata')
                            .popover({
                                html: true,
                                placement: 'bottom',
                                title: this.model.get('name'),
                                content: _.bind(this.metadata, this)
                            })
                    )
                    .append(downloadRenderer())
                )
            );
        return this;
    },
    cookie_value: function (name) {
        var cookieValue = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    },
    download_button: function() {
        return $('<a>', {
                'id': 'download_button',
                'class': 'btn btn-primary',
                'href': this.model.get('download_url')
                })
                .append($('<i>', {'class': 'icon-circle-arrow-down icon-white'}))
                .append(' Download')
                .popover({
                    html: true,
                    placement: 'bottom',
                    title: 'Verify your humanity',
                    content: _.bind(this.recaptcha_popover, this),
                    container: '.content'
                })
    },
    recaptcha_popover: function() {
        return $('<form>', {'action': this.model.get('download_url'), 'method': 'POST', 'id': 'download_form'})
            .append($('<input>', {'type': 'hidden', 'name': 'csrfmiddlewaretoken', 'value': this.cookie_value('csrftoken')}))
            .append($('<div>', {
                'id': 'recaptcha',
                'class': 'g-recaptcha',
                'data-sitekey': '6LerigwTAAAAABUYsV5WQoBBTZS58d7LfgE7I1yt',
                'data-size': 'compact',
                'data-callback': 'recaptcha_callback'
            }))
    },
    download_options_button: function() {
        return $('<a>', {
            'class': 'btn btn-primary'
        })
            .append($('<i>', {'class': 'icon-circle-arrow-down icon-white'}))
            .append(' Download Options')
            .popover({
                html: true,
                placement: 'bottom',
                title: this.model.get('name'),
                content: _.bind(this.download_options, this),
                container: '.content'
            });
    },
    file_info: function() {
        return $("<dl>")
            .addClass('file-info')
            .append($("<dt>").append("Download Link:"))
            .append($("<dd>").append($("<input>", {
                value: window.location.protocol + "//" + window.location.host + this.model.get('download_url'),
                type: 'text'
            })))
            .append($("<dt>").append("Checksum:"))
            .append($("<dd>").append(this.model.get('checksum')))
            .append($("<dt>").append("Created:"))
            .append($("<dd>").append(Utils.format_time(this.model.get('create_time'))))
            .append($("<dt>").append("Last Modified:"))
            .append($("<dd>").append(Utils.format_time(this.model.get('modify_time'))));
    },
    highlight_link: function() {
        this.$el.find('dl.file-info input').select();
    },
    metadata: function() {
        var metadata = this.model.get('metadata');
        if (metadata.length > 0) {
            var dl = $("<dl>").addClass('file-info');
            _.each(metadata, function(m) {
                dl.append($("<dt>").append(m['name'] + ':'));
                var dd_content = m['value'];
                if (m['units'])
                    dd_content += "<br /><em>Units: "+m['units']+"</em>";
                dl.append($("<dd>").append(dd_content));
            });
            return dl;
        } else
            return "No metadata.";
    },
    download_options: function() {
        var path = this.model.get('path').replace(this.model.get('name'),'')
        return $('<div>')
            .append('Due to the size of this file, it cannot be downloaded from this page. Use one of the following methods:')
            .append($('<div>')
                .append('Public Access')
                .append($('<a>',{
                            'TARGET':'_blank',
                            'href': 'https://pods.iplantcollaborative.org/wiki/display/DS/Accessing+Data+in+the+iPlant+Data+Store'
                        }).append(" (More Information)"))
                .append($('<ul>')
                    .append($('<li>').append('iCommands'))
                    .append($('<li>').append('iDrop'))
                    .append($('<li>').append('FTP/Cyberduck'))
                )
            )
            .append($('<div>')
                .append('iPlant Users')
                .append($('<ul>')
                    .append($('<li>')
                        .append($('<a>',{
                            'TARGET':'_blank',
                            'href': 'https://de.iplantcollaborative.org/de/?type=data&folder=' + path
                        }).append('Discovery Environment (DE)'))))
            )
            .append($("<dl>")
                .append($("<dt>").append("Path:"))
                .append($("<dd>").append($("<input>", {
                    value: path,
                    type: 'text'
                })))
                .append($("<dt>").append("File Name:"))
                .append($("<dd>").append($("<input>", {
                    value: this.model.get('name'),
                    type: 'text'
                }))));
    },
    events: {
        "click #download_button": "check_recaptcha_cookie"
    },
    check_recaptcha_cookie: function(event) {
        if (this.cookie_value('recaptcha_status') != 'verified') {
            event.preventDefault();
            $('#download_form').append('<script src="https://www.google.com/recaptcha/api.js" async defer></script>');
        } else {
            $('#download_button').popover('hide');
            return true;
        }

        if ($('#recaptcha').html()) {
            grecaptcha.reset();
        }
    },
});

Datacommons.Views.Metadata = Backbone.View.extend({
    tagName: 'div',
    events: {
        'click .metadataLink': 'search_metadata'
    },
    initialize: function() {
        this.biosampleNumbers = Utils.get_metadata_values.bind(this)('BioSample Number');
        this.subjects = Utils.get_metadata_values.bind(this)('Subject');
        this.contributors = Utils.get_metadata_values.bind(this)('Contributor');
    },
    render: function() {
        console.log('MainView render this', this)

        this.$el
            .append($('<h2>').append('Metadata'))

        var $subjects = $('<div>').append('Subject: ')
        _.each(this.subjects, function(element, index, list){
            $subjects.append($('<a>',{
                        'class': 'metadataLink'
                    }).data('search_params', {name: 'Subject', value: element}).append(element))
            if (index != list.length - 1) {
                $subjects.append(', ')
            }
        })
        $subjects.appendTo(this.$el);

        var $contributors = $('<div>').append('Contributors: ')
        _.each(this.contributors, function(element, index, list){
            $contributors.append($('<a>',{
                        'class': 'metadataLink'
                    }).data('search_params', {name: 'Contributor', value: element}).append(element))
            if (index != list.length - 1) {
                $contributors.append(', ')
            }
        })
        $contributors.appendTo(this.$el);

        var $biosampleNumbers = $('<div>').append('BioSample Number: ')
        _.each(this.biosampleNumbers, function(element, index, list){
            $biosampleNumbers.append($('<a>',{
                        'class': 'metadataLink'
                    }).data('search_params', {name: 'BioSample Number', value: element}).append(element))
            if (index != list.length - 1) {
                $biosampleNumbers.append(', ')
            }
        })
        $biosampleNumbers.appendTo(this.$el);

        var $dl = $('<dl>')
        _.each(this.model.attributes.metadata, function(m) {
            metaValue = m['value']
            metaName = m['attr']

            $dl.append($("<dt>").append(metaName).data('metadata_name', metaName))
            .append($("<dd>")//.append(m['value']))
                .append($('<a>',{
                    'class': 'metadataLink',
                }).data('search_params', {name: metaName, value: metaValue}).append(metaValue + ' '))
            )
        })
        $dl.appendTo(this.$el);
        console.log('this.model',this.model)
        this.$el.append(new Datacommons.Views.NodeListView({model: this.model, collection:this.model.get('children')}).el);

        return this;
    },
    search_metadata: function(e) {
        e.preventDefault();
        var searchParams = {}
        searchParams['metadata_name'] = $(e.currentTarget).closest('a').data('search_params').name//$(e.currentTarget).closest('div').data('metadata_name');
        searchParams['metadata_value'] = $(e.currentTarget).closest('a').data('search_params').value;

        var results = new Datacommons.Collections.MetadataMatches([], {name: searchParams['metadata_name'], value: searchParams['metadata_value']});

        var self=this;
        results.fetch({update: true, remove: false})
        .done(
            function(){
                console.log('metadata search results', results)
                self.show_results(results, searchParams)
            });

        // Datacommons.Events.Traversal.trigger('search_metadata', searchParams);
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

Datacommons.Router = Backbone.Router.extend({
    routes: {
        "": "index",
        "browse/*path": "expand"
    },
    initialize: function() {
        this.baseNode = new Datacommons.Models.Node({path: root, name: root_name, is_dir: true});
        this.dataApp = new Datacommons.Views.DataApp({el: $('#file-scroller-inner')}).render();
        this.breadcrumb_view = new Datacommons.Views.BreadcrumbView({el: $('#breadcrumbs'), base_node: this.baseNode}).render();
    },
    index: function() {
        Datacommons.Events.Traversal.trigger('navigate', this.baseNode);
    },
    expand: function(path) {
        var node = new Datacommons.Models.Node({path: '/' + decodeURIComponent(path)});
        node.fetch({
            success: function(model) {
                Datacommons.Events.Traversal.trigger('navigate', model);
            }
        });
    }
});

// This is a hack to add a callback to bootstrap's popover
// http://www.silviarebelo.com/2013/03/adding-callbacks-to-twitter-bootstraps-javascript-plugins/
var pt = $.fn.popover.Constructor.prototype.show;
$.fn.popover.Constructor.prototype.show = function(){
    pt.call(this);
    if (this.options.afterShow)
        this.options.afterShow();
}

window.recaptcha_callback = function recaptcha_callback(response) {
    $('#download_form').submit();
    $('#download_button').popover('hide');
}

return Datacommons;

});
