define(['jquery', 'underscore', 'backbone', 'utils', 'moment', 'bootstrap'], function($, _, Backbone, Utils, moment, _bootstrap) {

var Datastore = {
    Models: {},
    Collections: {},
    Views: {},
    Events: {},
    Contexts: {}
};

// A Node is a filesystem node--a file or directory
Datastore.Models.Node = Backbone.Model.extend({
    urlRoot: '/api/file',
    defaults: {
        parent: null
    },
    url: function() {
        return '/api/file' + '?path=' + encodeURIComponent(this.get('path'));
    },
    parse: function(obj) {
        r = {}
        if (obj.is_dir)
            r.children = new Datastore.Collections.NodeCollection([], {path: obj.path});

        var encoded_path = Utils.urlencode_path(obj.path);
        if (obj.is_dir != undefined && obj.is_dir == false) {
            r.download_url = '/download' + encoded_path;
            r.serve_url = '/serve' + encoded_path;
        }
        r.browse_url = '/browse' + encoded_path;

        r.root_relative_path = obj.path.replace(root, '');

        var metadata = Utils.metadata_to_object(obj.metadata);
        if (metadata[metadata_prefix])
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
            return new Datastore.Models.Node({
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

Datastore.Collections.NodeCollection = Backbone.Collection.extend({
    model: Datastore.Models.Node,
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

// The default view for a directory if no template is associated with it
Datastore.Views.NodeListView = Backbone.View.extend({
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
        Datastore.Events.Traversal.trigger('navigate', node);
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
Datastore.Views.FileView = Backbone.View.extend({
    tagName: 'div',
    events: {},
    initialize: function(options) {
    },
    render: function() {
        this.$el.append(new Datastore.Views.DataObjectHeader({model: this.model}).render().el);
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
Datastore.Events.Traversal = _.extend({}, Backbone.Events);

Datastore.Events.Traversal.on('navigate', function(model) {
    if (model.get('path')) {
        $('.content .popover').remove();
        Backbone.history.navigate('browse' + model.get('path'));
    } else {
        Backbone.history.navigate("");
    }
});

// The breadcrumbs across the top of the app
Datastore.Views.BreadcrumbView = Backbone.View.extend({
    events: {
        'click a': 'open_dir'
    },
    initialize: function() {
        Datastore.Events.Traversal.on('navigate', _.bind(this.populate_breadcrumbs, this));
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
        Datastore.Events.Traversal.trigger('navigate', model);
        return false;
    }
});

// The main content area
Datastore.Views.DataApp = Backbone.View.extend({
    events: {
    },
    initialize: function() {
        Datastore.Events.Traversal.on('navigate', _.bind(this.navigate, this));
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
                    view = Datastore.Views.NodeListView;
                    append_view(view, {});
                } else {
                    view = Datastore.Views.FileView;
                    append_view(view, {});
                }
            }
        });
    }
});

// Each file view is rendered with a header that contains the file's
// name, size, and a download link
Datastore.Views.DataObjectHeader = Backbone.View.extend({
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
                .append('Public Access (No account required)')
                .append($('<ul>')
                    .append($('<li>').append('iCommands'))
                    .append($('<li>').append('iDrop'))
                    .append($('<li>').append('Cyberduck'))
                    .append($('<li>').append($('<a>',{
                                'TARGET':'_blank',
                                'href': 'https://pods.iplantcollaborative.org/wiki/display/DS/Accessing+Data+in+the+iPlant+Data+Store'
                            }).append("More Information")))
                )
            )
            .append($('<div>')
                .append('iPlant Users (Requires iPlant account)')
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

Datastore.Router = Backbone.Router.extend({
    routes: {
        "": "index",
        "browse/*path": "expand"
    },
    initialize: function() {
        this.baseNode = new Datastore.Models.Node({path: root, name: root_name, is_dir: true});
        this.dataApp = new Datastore.Views.DataApp({el: $('#file-scroller-inner')}).render();
        this.breadcrumb_view = new Datastore.Views.BreadcrumbView({el: $('#breadcrumbs'), base_node: this.baseNode}).render();
    },
    index: function() {
        Datastore.Events.Traversal.trigger('navigate', this.baseNode);
    },
    expand: function(path) {
        var node = new Datastore.Models.Node({path: '/' + decodeURIComponent(path)});
        node.fetch({
            success: function(model) {
                Datastore.Events.Traversal.trigger('navigate', model);
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
    var d = new Date();
    d.setTime(d.getTime() + (365*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = 'recaptcha_status=verified; ' + expires;

    $('#download_form').submit();
    $('#download_button').popover('hide');
}

return Datastore;

});
