var App = {Models: {}, Collections: {}, Views: {}};

App.Models.Study = Backbone.Model.extend();

App.Collections.StudyCollection = Backbone.Collection.extend({
    model: App.Models.Study,
    url: "api/study"
});

App.Views.StudyList = Backbone.View.extend({
    events: {
        'click li a': 'select_study'
    },
    initialize: function(options) {
        console.log(options);
        App.studies.bind('reset', this.add_studies, this);
        App.studies.bind('select', this.highlight_study, this);
    },
    render: function() {
        return this;
    },
    add_studies: function() {
        this.$el.empty();
        var $list = $('<ul>', {id: 'study-list'});
        App.studies.each(function(model) {
            $('<li>')
                .append(
                    $('<a>', {href: '#study/' + model.id}).append(model.id + ' ' + model.get('title'))
                )
                .data('model', model)
                .attr('data-model_id', model.id)
                .appendTo($list); 
        });
        this.$el.append($list);
    },
    select_study: function(e) {
        var model = $(e.currentTarget).closest('li').data('model');
        console.log(model);
        App.studies.trigger('select', model);
    },
    highlight_study: function(model) {
        var $children = this.$el.find('ul').children().removeClass('active');
        if (model)
            $children.filter('li[data-model_id="' + model.id + '"]').addClass('active');
    }
});

App.Views.ContentArea = Backbone.View.extend({
    initialize: function(options) {
        var self = this;
        $('#header a').click(function(e) {
            e.preventDefault();
            App.studies.trigger('select', null);
            App.router.navigate('');
        });
        App.studies.bind('select', this.display_study, this);
    },
    render: function() {
        this.$el
            .empty()
            .append($('<h2>').append('Welcome to the iPlant Sequence Database!'))
            .append($('<p>').append('Click on a study to the left to explore details and download sequence reads.'));
        return this;
    },
    display_study: function(study) {
        if (!study) {
            this.render();
            return;
        }
        this.$el.empty();

        $('<h2>')
            .append(study.id + ' ' + study.get('title'))
            .appendTo(this.$el);

        var $dl = $('<dl>')
            .append($("<dt>").append("Abstract"))
            .append($("<dd>").append(study.get('abstract')));

        var desc;
        if ((desc = study.get('description')) != null)
            $dl.append($("<dt>").append("Description"))
            .append($("<dd>").append(desc));

        $dl.appendTo(this.$el);

        $('<h3>').append('Reads').appendTo(this.$el);

        $('<div>', {'class': 'file-tree'}).appendTo(this.$el).fileTree({
            root: study.get('path'),
            script: '/api/ls'
        }, function(file) {
            console.log(file); 
            window.location.replace('/download?path=' + encodeURIComponent(file));
        });

    }
});

App.Router = Backbone.Router.extend({
    routes: {
        "" : "list",
        "study/:study_id": "select_study"
    },
    initialize: function() {
        App.studies = new App.Collections.StudyCollection();
        new App.Views.StudyList({el: $('#sidebar')[0]}).render();
        new App.Views.ContentArea({el: $('#main')[0]}).render();
    },
    list: function() {
        App.studies.fetch();
        console.log(App.studies);
    },
    select_study: function(study_id) {
        App.studies.fetch({
            success: function() {
                var model;
                if (model = App.studies.get(study_id))
                    App.studies.trigger('select', model);
            }
        });
    }
});

$(document).ready(function() {
    App.router = new App.Router();
    Backbone.history.start();
});
