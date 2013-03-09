var App = {Models: {}, Collections: {}};

App.Models.Study = Backbone.Model.extend();

App.Collections.StudyCollection = Backbone.Collection.extend({
    model: App.Models.Study,
    url: "api/study"
});

App.Router = Backbone.Router.extend({
    routes: {
        "" : "list"
    },
    list: function() {
        App.studies = new App.Collections.StudyCollection();
        App.studies.fetch();
        console.log(App.studies);
    }
});

var app = new App.Router();
Backbone.history.start();
