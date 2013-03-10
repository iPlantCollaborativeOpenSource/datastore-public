var App = {Models: {}, Collections: {}, Views: {}};

App.Models.Study = Backbone.Model.extend();

App.Collections.StudyCollection = Backbone.Collection.extend({
    model: App.Models.Study,
    url: "api/study"
});

App.Views.StudyList = Backbone.View.extend({
    initialize: function(options) {
        console.log(options);
        App.studies.bind('reset', this.add_studies, this);
    },
    render: function() {
        this.$el.html("HELLO WORLD");
    },
    add_studies: function() {
        this.$el.empty();
        $list = $('<ul>', {id: 'study-list'});
        App.studies.each(function(model) {
            $('<li>').append(
                $('<a>', {href: '#'}).append(model.get('name'))
            ).appendTo($list); 
        });
        this.$el.append($list);
    }
});

App.Router = Backbone.Router.extend({
    routes: {
        "" : "list"
    },
    list: function() {
        App.studies = new App.Collections.StudyCollection();
        new App.Views.StudyList({el: $('#sidebar')[0]}).render();
        App.studies.fetch();
        console.log(App.studies);
    }
});

$(document).ready(function() {
    var app = new App.Router();
    Backbone.history.start();
});
