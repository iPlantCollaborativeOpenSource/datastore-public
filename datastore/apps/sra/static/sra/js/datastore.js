  (function(window, angular, $) {
  "use strict";

  function config($routeProvider, $locationProvider, $interpolateProvider, $httpProvider) {
    $httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';
    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';

    $locationProvider.html5Mode(true);
  }

  var app = angular.module('Datastore', ['ngRoute', 'ng.django.urls', 'ui.bootstrap','logging', 'ngCookies']).config(['$routeProvider', '$locationProvider', '$interpolateProvider', '$httpProvider', '$cookiesProvider', config]);


  angular.module('Datastore').controller('DatastoreCtrl', ['$scope','$rootScope','$location','$route','$routeParams','$uibModal', 'datastoreFactory', function($scope,$rootScope,$location,$route,$routeParams, $uibModal,datastoreFactory) {
      $scope.data={}
      $location.replace();

      if ($location.path() == '/'){
        $scope.path = '/iplant/home/shared/'
        $location.path('browse' + $scope.path);
      } else {
        $scope.path = $location.path()
      }

      if ($scope.path.substring(0, 7) == "/browse") {
        $scope.real_path=$scope.path.slice(7)
      } else {
        $scope.real_path = $scope.path
      }

      $scope.browse = function(path, id = ''){
        // var fullPath = $location.path().split('/');
        // // console.log('fullPath ', fullPath);
        // var trail = fullPath.slice(0, 4);
        // trail = trail.join('/');
        // // console.log('trail ', trail);
        // fullPath = fullPath.splice(4);
        // // console.log('fullPath', fullPath);
        // $scope.data.breadcrumbs = fullPath.map(function(s, index){
        //     return { 'name': s,
        //               'path': trail + '/' + fullPath.slice(0, index + 1).join('/')
        //             };
        // });
        // console.log('breadcrumbs ', $scope.data.breadcrumbs);

        if (path.substring(0, 7) == "/browse") {
          var real_path=path.slice(7)
        } else {
          real_path = path
        }
        // console.log('path',path)
        // console.log('real_path',real_path)

        if (id){
          datastoreFactory.get_collection(real_path, id).then(
            function(resp) {
              // console.log('get_collection response', resp)
              $scope.data = resp.data
              $scope.data.page = 1

              // if ($scope.data.type == 'dir') {
                for (var i=0; i <= $scope.data.collection.files.length - 1; i++) {
                  $scope.data.collection.files[i]['file-size'] = datastoreFactory.bytes_to_human($scope.data.collection.files[i]['file-size'])
                }
              // } else {
              //     $scope.data['file-size'] = $scope.bytes_to_human($scope.data['file-size'])
              // }

              var fullPath = real_path.replace(/\/$/, "").split('/'); //remove trailing slash then split
              // console.log('fullPath ', fullPath);
              var trail = fullPath.slice(0, 3);
              trail = trail.join('/');
              // console.log('trail ', trail);
              fullPath = fullPath.splice(3);
              // console.log('fullPath', fullPath);
              $scope.data.breadcrumbs = fullPath.map(function(s, index){
                  return {  'name': s,
                            'path': trail + '/' + fullPath.slice(0, index + 1).join('/')
                          };
              });

              console.log('$scope.data', $scope.data)
              $location.state(angular.copy($scope.data))
              console.log('get collection location.state', $location.state())
              $location.path('browse' + real_path);
            },
            function(data) {
              console.log('get_collection error data', data)
              $scope.data.msg = data.data
            }
          )
        } else {

          datastoreFactory.browse(real_path).then(
            function(resp) {
              console.log('browse response', resp)
              $scope.data = resp.data
              $scope.data.page = 1

              if ($scope.data.type == 'dir') {
                for (var i=0; i <= $scope.data.collection.files.length - 1; i++) {
                  $scope.data.collection.files[i]['file-size'] = datastoreFactory.bytes_to_human($scope.data.collection.files[i]['file-size'])
                }
              } else {
                  $scope.data['file-size'] = datastoreFactory.bytes_to_human($scope.data['file-size'])
              }


              var fullPath = real_path.replace(/\/$/, "").split('/'); //remove trailing slash then split
              // console.log('fullPath ', fullPath);
              var trail = fullPath.slice(0, 3);
              trail = trail.join('/');
              // console.log('trail ', trail);
              fullPath = fullPath.splice(3);
              // console.log('fullPath', fullPath);
              $scope.data.breadcrumbs = fullPath.map(function(s, index){
                  return {  'name': s,
                            'path': trail + '/' + fullPath.slice(0, index + 1).join('/')
                          };
              });

              if ($scope.data.type == 'file') {
                $scope.data.breadcrumbs[$scope.data.breadcrumbs.length-1]['type'] = 'file'
              }

              console.log('browse $scope.data', $scope.data)
              $location.state(angular.copy($scope.data))
              console.log('browse location.state', $location.state())
              $location.path('browse' + real_path);

            },
            function(data) {
              console.log('browse error data', data)
              $scope.data.msg = data.data
            }
          )
        }
      };

      $scope.load_more = function(path){
        $scope.data.page++;
        console.log('page', $scope.data.page)

        datastoreFactory.load_more(path, $scope.data.page).then(
          function(resp) {
            console.log('load more response', resp)

            if ($scope.data.type == 'dir') {
              for (var i=0; i <= resp.data.collection.files.length - 1 ; i++) {
                resp.data.collection.files[i]['file-size'] = datastoreFactory.bytes_to_human(resp.data.collection.files[i]['file-size'])
              }
            } else {
                $scope.data['file-size'] = datastoreFactory.bytes_to_human($scope.data['file-size'])
            }
            $scope.data.collection.more_data = resp.data.collection.more_data
            $scope.data.collection.folders.push.apply($scope.data.collection.folders, resp.data.collection.folders);
            $scope.data.collection.files.push.apply($scope.data.collection.files, resp.data.collection.files);
            console.log('load more $scope.data', $scope.data)
            $location.state(angular.copy($scope.data))
          },
          function(data) {
            console.log('load more error data', data)
            $scope.data.msg = data.data
          }
        )
      };

      $scope.browse($scope.path);

      // $scope.bytes_to_human = function(bytes) {
      //     var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      //     var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
      //     return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
      // }

      $scope.$on('$locationChangeSuccess', function ($event, newUrl, oldUrl, newState, oldState) {
        if (newUrl !== oldUrl) {
          console.log('location change success', $event)
          console.log('newUrl', newUrl)
          console.log('oldUrl', oldUrl)
          console.log('newState', newState)
          console.log('oldState', oldState)
          $scope.data = newState;
        }
      });

      $scope.modal = function(file_path, file_name) {
            // $('#' + id).modal(hide ? 'hide' : 'show');

            datastoreFactory.browse(file_path).then(
              function(resp) {
                console.log('modal response', resp)
                var data = resp.data
                if (data['file-size'] < 20000000000) {
                  data['downloadable'] = true
                }
                data['file-size'] = datastoreFactory.bytes_to_human(data['file-size'])

                var date = new Date($scope.data['date-created'])
                data['date-created'] = date.toDateString()

                date = new Date($scope.data['date-modified'])
                data['date-modified'] = date.toDateString()
                console.log('modal scope', $scope)

                // if ($scope.data['content-type'] == 'text/plain'){

                // }

                $uibModal.open({
                  animation:$scope.animationsEnabled,
                  // templateUrl: '/static/sra/templates/preview_modal.html',
                  templateUrl: 'preview_modal.html',
                  controller: 'ModalInstanceCtrl',
                  size: 'lg',
                  resolve: {
                    file_path: function () {
                      return file_path;
                    },
                    file_name: function () {
                      return file_name;
                    },
                    data: function () {
                      return data;
                    },
                  }
                })

              },
              function(data) {
                console.log('modal error data', data)
                $scope.data.msg = data.data
              }



              // $uibModal.open({
              //   animation:$scope.animationsEnabled,
              //   // templateUrl: '/static/sra/templates/preview_modal.html',
              //   templateUrl: 'preview_modal.html',
              //   controller: 'ModalInstanceCtrl',
              //   size: 'lg',
              //   resolve: {
              //     file_path: function () {
              //       return file_path;
              //     },
              //     file_name: function () {
              //       return file_name;
              //     },
              //     data: function () {
              //       return $scope.data;
              //     },
              //   }
              // })
            )
      };

  }]);

  angular.module('Datastore').factory('datastoreFactory', ['$http', 'djangoUrl', function($http, djangoUrl) {
    var service = {};

    service.browse = function(path) {
      return $http.get(djangoUrl.reverse('browse', {'path': path}));
    };

    service.get_collection = function(path, id='') {
      // console.log('path', path)
      return $http.get(djangoUrl.reverse('get_collection', {'path': path, 'id': id}));
    };

    service.load_more = function(path, page=1) {
      return $http.get(djangoUrl.reverse('load_more', {'path': path, 'page': page}));
    };

    service.bytes_to_human = function(bytes) {
          var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
          var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
          return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    };

    service.serve_file = function(path) {
      return $http.get(djangoUrl.reverse('serve', {'path': path}));
    };

    // service.download = function(path) {
    //   return $http.get(djangoUrl.reverse('download', {'path': path}));
    // };

    // service.get_file = function(path) {
    //   console.log('path', path)
    //   return $http.get(djangoUrl.reverse('get_file', {'path': path}));
    // };

    // service.delete = function(pk) {
    //   return $http.post(djangoUrl.reverse('designsafe_notifications:delete_notification', []), {'pk': encodeURIComponent(pk)});
    // };

    return service;
  }]);

  angular.module('Datastore').controller('ModalInstanceCtrl', ['$http', 'djangoUrl', '$uibModalInstance', '$cookies', 'file_path', 'file_name', 'data', '$scope', 'datastoreFactory', '$sce', function ($http, djangoUrl, $uibModalInstance, $cookies, file_path, file_name, data, $scope, datastoreFactory, $sce) {
    $scope.data = {}
    $scope.data = data
    $scope.file_path = file_path
    $scope.file_name = file_name
    console.log('ModalInstanceCtrl scope', $scope)

    $scope.download = function(path){
      $uibModalInstance.close();
      // return $http.get(djangoUrl.reverse('download', {'path': path}));

      var url = 'download'+ path //djangoUrl.reverse('download', {'path': path})
      var link = document.createElement('a');
      link.setAttribute('download', $scope.file_name);
      link.setAttribute('href', url);
      link.setAttribute('target', '_self');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('downloading', path)
    };

    $scope.preview = function(path){
      // if (item.isPreviewable()){
      //     $scope.temp = item;
      //     return item.preview()//.catch(
      //     //     function(data){
      //     //         item.error = $translate.instant('error_invalid_filename');
      //     //     }
      //     // );
      // }

      datastoreFactory.serve_file(path).then(
        function(resp) {
          console.log('serve_file response', resp)
          $scope.data.file_preview = resp.data

        },
        function(data) {
          console.log('serve_file error data', data)
          $scope.data.msg = data.data
        }
      )
    };

    // $scope.isPreviewable = function(contentType){
    //   if (contentType.substring(0, 4) == 'text') {
    //     $scope.preview($scope.data.path)
    //   }
    // }
    // $scope.isPreviewable($scope.data['content-type'])

    $scope.isPreviewable = function(filename){
      var BrushSources = {
        'php': 'shBrushPhp',
        'js': 'shBrushJScript',
        'css': 'shBrushCss',
        'py': 'shBrushPython',
        'plain': 'shBrushPlain',
        'fasta': 'shBrushFasta',
        'eml': 'shBrushXml',
        'xml': 'shBrushXml',
      };

      var ext = filename.split('.').pop();

      if (ext in BrushSources || $scope.data['content-type'].substring(0, 4) == 'text'){
        // try {
        //   $scope.data.brush = BrushSources[ext]
        // }
        // catch(err) {
        //   $scope.data.brush = 'shBrushPlain'
        // }
        $scope.data.brush = BrushSources[ext] || 'shBrushPlain'
        $scope.preview($scope.data.path)
        console.log('ModalInstanceCtrl scope after checking previewable', $scope)
      }
    };

    $scope.isPreviewable($scope.data['label'])

    $scope.check_recaptcha_cookie = function(path) {
      $scope.download_path = '/download' + path

      if ($cookies.get('recaptcha_status') != 'verified') {

          $('#download_button').append('<script src="https://www.google.com/recaptcha/api.js" async defer></script>');
      } else {
        $scope.download(path)
          $('#download_button').popover('hide');

      }

      if ($('#recaptcha').html()) {
          grecaptcha.reset();
      }
    };

    // $scope.recaptchaPopover = $sce.trustAsHtml('<form action="/download'+ $scope.data.path +'" method="GET" id="download_form"> <input type="hidden" name="csrfmiddlewaretoken" value="QxKAxVRIIjP3RQEVMNwsLcvobkZ0q6mX"><div id="recaptcha" class="g-recaptcha" data-sitekey="6LerigwTAAAAABUYsV5WQoBBTZS58d7LfgE7I1yt" data-size="compact" data-callback="$scope.recaptcha_callback"></div></form>');

    // $scope.recaptcha_callback = function recaptcha_callback(response) {
    //     var d = new Date();
    //     d.setTime(d.getTime() + (365*24*60*60*1000));
    //     var expires = "expires="+d.toUTCString();
    //     document.cookie = 'recaptcha_status=verified; ' + expires;

    //     $('#download_form').submit();
    //     $('#download_button').popover('hide');
    // }

    // $scope.get_file = function(path, id = ''){
    //   datastoreFactory.browse(path).then(
    //     function(resp) {
    //       console.log('modal response', resp)
    //       $scope.data = resp.data
    //       $scope.data['file-size'] = datastoreFactory.bytes_to_human($scope.data['file-size'])

    //       var date = new Date($scope.data['date-created'])
    //       $scope.data['date-created'] = date.toDateString()

    //       date = new Date($scope.data['date-modified'])
    //       $scope.data['date-modified'] = date.toDateString()
    //       console.log('modal scope', $scope)

    //       // if ($scope.data['content-type'] == 'text/plain'){

    //       // }
    //     },
    //     function(data) {
    //       console.log('data', data)
    //       $scope.data.msg = data.data
    //     }
    //   )
    // };

    // $scope.get_file(file_path)

    // $scope.selected = {
    //   item: $scope.items[0]
    // };

    // $scope.ok = function () {
    //   $uibModalInstance.close($scope.selected.item);
    // };

    // $scope.cancel = function () {
    //   $uibModalInstance.dismiss('cancel');
    // };
  }]);

  // angular.module('ds.notifications', ['logging', 'toastr']).config(config);

  // function NotificationService($rootScope, logger, toastr){
  //     var service = {
  //         init: init,
  //     };

  //     return service;

  //     function init(){
  //         console.log('asdfsafdfsdadfs')
  //     }

  //     function processMessage(e, msg){
  //         //var rScope = $injector.get('$rootScope');
  //         logger.log('websockets msg', msg);
  //         if (msg.toast) {
  //             if(msg.action_link) {
  //                 toastr.info(msg.toast.msg,
  //                 {
  //                     closeButton: true,
  //                     closeHtml: '<a target="_blank" href="' + msg.action_link.value + '">' + msg.action_link.label + '</a>',
  //                     onHidden: function undo(clicked, toast){
  //                         logger.log('clicked', clicked)
  //                         logger.log('toast', toast)

  //                     }
  //                 });
  //             } else {
  //                 toastr.info(msg.toast.msg);
  //             }
  //         }
  //         if (msg.status == 'FINISHED' || msg.status == 'FAILED') {
  //             var notification_badge = angular.element( document.querySelector( '#notification_badge' ) );
  //             notification_badge.removeClass('label-default')
  //             notification_badge.addClass('label-info')

  //             var numNotifications = notification_badge.html();
  //             if (isNaN(numNotifications)) {
  //                 notification_badge.html(1);
  //             } else {
  //                 notification_badge.html(Number(numNotifications) + 1);
  //             }
  //         }
  //     }
  // }

  // function NotificationServiceProvider($injector){
  //     // var configURL = '';
  //     this.$get = ['$rootScope', 'logger', 'toastr', NotificationBusHelper];

  //     // this.setUrl = function setUrl(url){
  //         // configURL = url;
  //     // };
  //     function NotificationBusHelper($rootScope, logger, toastr){
  //         return new NotificationService($rootScope, logger, toastr);
  //     }
  // }

  // angular.module('Datastore')
  // .provider('NotificationService', NotificationServiceProvider);

})(window, angular, jQuery);


// -------- OLD STUFF ---------

// define(['jquery', 'underscore', 'backbone', 'utils', 'moment', 'bootstrap'], function($, _, Backbone, Utils, moment, _bootstrap) {

// var Datacommons = {
//     Models: {},
//     Collections: {},
//     Views: {},
//     Events: {},
//     Contexts: {}
// };

// // A Node is a filesystem node--a file or directory
// Datacommons.Models.Node = Backbone.Model.extend({
//     urlRoot: '/api/file',
//     defaults: {
//         parent: null
//     },
//     url: function() {
//         console.log('models.node')
//         return '/api/file' + '?path=' + encodeURIComponent(this.get('path'));
//     },
//     parse: function(obj) {
//         console.log('obj', obj)
//         r = {}
//         if (obj.is_dir)
//             r.children = new Datacommons.Collections.NodeCollection([], {path: obj.path});

//         var encoded_path = Utils.urlencode_path(obj.path);
//         if (obj.is_dir != undefined && obj.is_dir == false) {
//             r.download_url = '/download' + encoded_path;
//             r.serve_url = '/serve' + encoded_path;
//             r.preview_url = '/serve' + encoded_path + '?preview=true';
//         }
//         r.browse_url = '/browse' + encoded_path;

//         r.root_relative_path = obj.path.replace(root, '');

//         var metadata = Utils.metadata_to_object(obj.metadata);
//         console.log('obj.metadata', obj.metadata)
//         console.log('metadata', metadata)
//         if (metadata[metadata_prefix])
//             console.log('metadata_prefix', metadata_prefix)
//             r.template_metadata = metadata[metadata_prefix];

//         r.create_time = moment.unix(obj.create_time);
//         r.modify_time = moment.unix(obj.modify_time);;

//         return _.extend(obj, r);
//     },
//     get_ancestors: function() {
//         if (!this.get('root_relative_path'))
//             return [];
//         var dirs = this.get('root_relative_path').split('/').splice(1)
//         dirs.pop();
//         var ancestors = _.map(dirs, function(name, i) {
//             var rel = '/' + dirs.slice(0, i+1).join('/');
//             return new Datacommons.Models.Node({
//                 name: name,
//                 path: root + rel,
//                 is_dir: true,
//                 root_relative_path: rel,
//                 browse_url: "/browse" + Utils.urlencode_path(root + rel)
//             });
//         })
//         ancestors.push(this);
//         return ancestors;
//     }
// });

// Datacommons.Models.DEresults = Backbone.Model.extend({
//     parse: function(obj) {
//         console.log('deresults obj', obj)
//         matches = []
//         for (i=0; i < obj.total; i++){
//             matches.push({
//                 id: obj.matches[i].entity.label,
//                 path: obj.matches[i].entity.path,
//             });
//         };
//         console.log('matches', matches);
//         // return return _.extend(obj, r);
//         return matches;
//         //  return {
//         //     id: obj.matches.entity.label,
//         //     path: obj.matches.entity.path,
//         //     'abstract': metadata['abstract'],
//         //     title: metadata['title'],
//         //     description: metadata['description']
//         // };
//     }
// });

// Datacommons.Collections.NodeCollection = Backbone.Collection.extend({
//     model: Datacommons.Models.Node,
//     url: function() {
//         return '/api/collection?path=' + encodeURIComponent(this.path) + '&page=' + this.page;
//     },
//     initialize: function(models, options) {
//         this.path = options.path;
//         this.page = 1;
//     },
//     parse: function(response){
//         console.log('response', response)
//         this.moreData = response.more_data
//         this.page =response.page
//         return response.models
//     },
// });

// Datacommons.Collections.MetadataMatches = Backbone.Collection.extend({
//     model: Datacommons.Models.Node,
//     url: function() {
//         if (this.value) {
//             return '/search/metadata/?name=' + this.name + '&value=' + this.value
//         } else {
//             return '/search/metadata/?name=' + this.name
//         }
//     },
//     initialize: function(models, options) {
//         this.name = options.name;
//         this.value = options.value;
//     }
// });

// Datacommons.Collections.SearchResults = Backbone.Collection.extend({
//     model: Datacommons.Models.DEresults,
//     url: function() {
//         return '/search/?search_term=' + this.search_term
//     },
//     initialize: function(models, options) {
//         this.search_term = options.search_term;
//     },
//     // parse: function(obj) { //trying the parse on the model
//     //     console.log('deresults obj', obj)
//     //     matches = []
//     //     for (i=0; i < obj.total; i++){
//     //         console.log('matches path', obj.matches[i].entity.path)
//     //         matches.push({
//     //             id: obj.matches[i].entity.label,
//     //             path: obj.matches[i].entity.path,
//     //         });
//     //     };
//     //     // console.log('matches', matches);
//     //     // return return _.extend(obj, r);
//     //     return matches;
//     //     //  return {
//     //     //     id: obj.matches.entity.label,
//     //     //     path: obj.matches.entity.path,
//     //     //     'abstract': metadata['abstract'],
//     //     //     title: metadata['title'],
//     //     //     description: metadata['description']
//     //     // };
//     // }
//     // parse: function(obj) {
//     //     console.log('collection obj', obj)
//     //     return obj.matches
//     // }
// });

// // The default view for a directory if no template is associated with it
// Datacommons.Views.NodeListView = Backbone.View.extend({
//     tagName: 'div',
//     events: {
//         'click li.dir a': 'open_file',
//         'click li.file a': 'open_file',
//         'click #load_more': 'load_more'
//     },
//     initialize: function(options) {
//         this.collection.bind('reset', _.bind(this.append_children, this));
//     },
//     render: function() {
//         this.$el.append('loading');
//         //console.log(this.collection);
//         return this;
//     },
//     append_children: function() {
//         this.$el.empty();
//         $list = $("<ul>", {'class': 'node-list'});
//         //console.log(this);
//         this.collection.each(function(node) {
//             $("<li>")
//                 .data('model', node)
//                 .addClass(node.get('is_dir') ? 'dir' : 'file ext-' + Utils.file_ext(node.get('name')))
//                 .append($('<a>', {href: node.get('browse_url')}).append(node.get('name')))
//                 .appendTo($list);
//         });
//         this.$el.append($list);

//         if (this.collection.moreData) {
//             this.$el.append(
//                 $('<a>', {
//                     'class': 'btn btn-default file-info-button',
//                     'id': 'load_more',
//                 })
//                 .append('Load more'))
//         }
//         return this;
//     },
//     open_file: function(e) {
//         e.preventDefault();
//         var node = $(e.currentTarget).closest('li').data('model');
//         //console.log(node);
//         Datacommons.Events.Traversal.trigger('navigate', node);
//         return false;
//     },
//     load_more: function(e) {
//         this.collection.page++
//         var self=this;
//         this.collection.fetch({update: true, remove: false})
//         .done(
//             function(){
//               self.append_children()
//             });
//     }
// });

// // The default file view if no template is associated with it
// Datacommons.Views.FileView = Backbone.View.extend({
//     tagName: 'div',
//     events: {},
//     initialize: function(options) {
//     },
//     render: function() {
//         this.$el.append(new Datacommons.Views.DataObjectHeader({model: this.model}).render().el);
//         this.$el.append(
//             $("<div>")
//                 .addClass('no-preview')
//                 .append("No preview available")
//         );
//         return this;
//     }
// });

// // Event space for managing filesystem traversals. Supports a single event,
// // "navigate", that is triggered upon the selection of a new folder or file
// Datacommons.Events.Traversal = _.extend({}, Backbone.Events);

// Datacommons.Events.Traversal.on('navigate', function(model) {
//     if (model.get('path')) {
//         $('.content .popover').remove();
//         Backbone.history.navigate('browse' + model.get('path'));
//     } else {
//         Backbone.history.navigate("");
//     }
// });

// // The breadcrumbs across the top of the app
// Datacommons.Views.BreadcrumbView = Backbone.View.extend({
//     events: {
//         'click a': 'open_dir'
//     },
//     initialize: function() {
//         Datacommons.Events.Traversal.on('navigate', _.bind(this.populate_breadcrumbs, this));
//         this.base_node = this.options.base_node;
//         this.$list = null;
//     },
//     render: function() {
//         this.$list = $("<ul>", {'class': 'clearfix'});
//         this.$list
//             .appendTo(this.$el);
//         return this;
//     },
//     breadcrumb: function(model) {
//         return $("<li>")
//             .addClass(model.get('is_dir') ? 'dir' : 'file')
//             .data('model', model)
//             .append($('<a>', {href: model.get('browse_url')}).append(model.get('name')));
//     },
//     populate_breadcrumbs: function(model) {
//         //console.log(model);
//         //console.log(model.get_ancestors());
//         this.$list
//             .empty()
//             .append(this.breadcrumb(this.base_node))
//             .append(_.map(model.get_ancestors(), this.breadcrumb));
//     },
//     open_dir: function(e) {
//         e.preventDefault();
//         var model = $(e.currentTarget).closest('li').data('model');
//         Datacommons.Events.Traversal.trigger('navigate', model);
//         return false;
//     }
// });

// // The main content area
// Datacommons.Views.DataApp = Backbone.View.extend({
//     events: {
//     },
//     initialize: function() {
//         Datacommons.Events.Traversal.on('navigate', _.bind(this.navigate, this));
//     },
//     render: function() {
//         return this;
//     },
//     navigate: function(model) {
//         var self = this;
//         var base_width = $(window).width();
//         if (base_width >= 1200) {
//             base_width = 1140;
//         } else if (base_width >= 992) {
//             base_width = 940;
//         } else if (base_width >= 768) {
//             base_width = 720;
//         }
//         var new_width = base_width * 2;
//         self.$el.width(new_width);
//         model.fetch({
//             success: function() {
//                 console.log('model', model);
//                 var template = model.get('template_metadata') ? model.get('template_metadata')['template'] : null;
//                 var content_type = model.get('content_type') ? model.get('content_type') : '';
//                 // var template = 'datacommons' //for testing
//                 //console.log(template);

//                 var append_view = function(view, options) {
//                     if (model.get('is_dir')) {
//                         var new_view  = new view(_.extend({model: model, collection: model.get('children')}, options))
//                         new_view.render().$el.appendTo(self.$el);
//                         model.get('children').fetch();
//                     } else {
//                         var new_view  = new view(_.extend({model: model}, options))
//                         new_view.render().$el.appendTo(self.$el);
//                     }
//                     if (template)
//                         new_view.$el.addClass('template-' + template);
//                     //console.log(new_view.$el.position().left);
//                     self.$el.parent().animate({
//                         scrollLeft: new_view.$el.position().left
//                     }, 'fast', function() {
//                         self.$el
//                             .children(':not(:last-child)').remove().end()
//                             .parent().scrollLeft(0);
//                     });
//                 };

//                 var view;
//                 //console.log(model.get('is_dir'));
//                 if (template) {
//                     require(['/static/sra/js/contexts/' + template + '.js'], function(Context) {
//                         view = Context.Views.MainView;
//                         view_options = model.get('template_metadata')['template_options'] || {};
//                         // view_options = 'datacommons'; //for testing
//                         append_view(view, view_options);
//                     });
//                 } else if (content_type.substring(0, 4) == 'text') {
//                     require(['/static/sra/js/contexts/highlighter.js'], function(Context) {
//                         view = Context.Views.MainView;
//                         view_options = {}
//                         append_view(view, view_options);
//                     });
//                 } else if (model.get('is_dir')) {
//                     // view = Datacommons.Views.NodeListView;
//                     view = Datacommons.Views.Metadata;
//                     append_view(view, {});
//                 } else {
//                     view = Datacommons.Views.FileView;
//                     append_view(view, {});
//                 }
//             }
//         });
//     }
// });

// // Each file view is rendered with a header that contains the file's
// // name, size, and a download link
// Datacommons.Views.DataObjectHeader = Backbone.View.extend({
//     tagName: 'div',
//     className: 'data-object-header clearfix',
//     initialize: function() {
//     },
//     render: function() {
//         var downloadRenderer = (this.model.get('size') > 2000000000) //greater than 2 GB
//             ? _.bind(this.download_options_button, this)
//             : _.bind(this.download_button, this);

//         this.$el
//             .append($("<ul>", {'class': 'file-properties'})
//                 .append($("<li>").append(this.model.get('name')))
//                 .append($("<li>").append(Utils.bytes_to_human(this.model.get('size'))))
//             )
//             .append($('<div>', {'class': 'file-action'})
//                 .append($("<div>", {'class': 'btn-group'})
//                     .append(
//                         $('<a>', {
//                             'class': 'btn btn-default file-info-button'
//                         })
//                             .append($('<i>', {'class': 'icon-info-sign'}))
//                             .append(' Info')
//                             .popover({
//                                 html: true,
//                                 container: '.content',
//                                 placement: 'bottom',
//                                 title: this.model.get('name'),
//                                 content: _.bind(this.file_info, this),
//                                 afterShow: _.bind(this.highlight_link, this)
//                             })
//                     )
//                     .append($('<a>', {'class': 'btn btn-default file-info-button'})
//                             .append($('<i>', {'class': 'icon-list'}))
//                             .append(' Metadata')
//                             .popover({
//                                 html: true,
//                                 container: '.content',
//                                 placement: 'bottom',
//                                 title: this.model.get('name'),
//                                 content: _.bind(this.metadata, this)
//                             })
//                     )
//                     .append(downloadRenderer())
//                 )
//             );
//         return this;
//     },
//     cookie_value: function (name) {
//         var cookieValue = null;
//         if (document.cookie && document.cookie != '') {
//             var cookies = document.cookie.split(';');
//             for (var i = 0; i < cookies.length; i++) {
//                 var cookie = jQuery.trim(cookies[i]);
//                 // Does this cookie string begin with the name we want?
//                 if (cookie.substring(0, name.length + 1) == (name + '=')) {
//                     cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
//                     break;
//                 }
//             }
//         }
//         return cookieValue;
//     },
//     download_button: function() {
//         return $('<a>', {
//                 'id': 'download_button',
//                 'class': 'btn btn-primary',
//                 'href': this.model.get('download_url')
//                 })
//                 .append($('<i>', {'class': 'icon-circle-arrow-down icon-white'}))
//                 .append(' Download')
//                 .popover({
//                     html: true,
//                     placement: 'bottom',
//                     title: 'Verify your humanity',
//                     content: _.bind(this.recaptcha_popover, this),
//                     container: '.content'
//                 })
//     },
//     recaptcha_popover: function() {
//         return $('<form>', {'action': this.model.get('download_url'), 'method': 'POST', 'id': 'download_form'})
//             .append($('<input>', {'type': 'hidden', 'name': 'csrfmiddlewaretoken', 'value': this.cookie_value('csrftoken')}))
//             .append($('<div>', {
//                 'id': 'recaptcha',
//                 'class': 'g-recaptcha',
//                 'data-sitekey': '6LerigwTAAAAABUYsV5WQoBBTZS58d7LfgE7I1yt',
//                 'data-size': 'compact',
//                 'data-callback': 'recaptcha_callback'
//             }))
//     },
//     download_options_button: function() {
//         return $('<a>', {
//             'class': 'btn btn-primary'
//         })
//             .append($('<i>', {'class': 'icon-circle-arrow-down icon-white'}))
//             .append(' Download Options')
//             .popover({
//                 html: true,
//                 placement: 'bottom',
//                 title: this.model.get('name'),
//                 content: _.bind(this.download_options, this),
//                 container: '.content'
//             });
//     },
//     file_info: function() {
//         return $("<dl>")
//             .addClass('file-info')
//             .append($("<dt>").append("Checksum:"))
//             .append($("<dd>").append(this.model.get('checksum')))
//             .append($("<dt>").append("Created:"))
//             .append($("<dd>").append(Utils.format_time(this.model.get('create_time'))))
//             .append($("<dt>").append("Last Modified:"))
//             .append($("<dd>").append(Utils.format_time(this.model.get('modify_time'))));
//     },
//     highlight_link: function() {
//         this.$el.find('dl.file-info input').select();
//     },
//     metadata: function() {
//         var metadata = this.model.get('metadata');
//         if (metadata.length > 0) {
//             var dl = $("<dl>").addClass('file-info');
//             _.each(metadata, function(m) {
//                 dl.append($("<dt>").append(m['name'] + ':'));
//                 var dd_content = m['value'];
//                 if (m['units'])
//                     dd_content += "<br /><em>Units: "+m['units']+"</em>";
//                 dl.append($("<dd>").append(dd_content));
//             });
//             return dl;
//         } else
//             return "No metadata.";
//     },
//     download_options: function() {
//         var path = this.model.get('path').replace(this.model.get('name'),'')
//         return $('<div>')
//             .append('Due to the size of this file, it cannot be downloaded from this page. Use one of the following methods:')
//             .append($('<div>')
//                 .append('Public Access (No account required)')
//                 .append($('<ul>')
//                     .append($('<li>').append('iCommands'))
//                     .append($('<li>').append('iDrop'))
//                     .append($('<li>').append('Cyberduck'))
//                     .append($('<li>').append($('<a>',{
//                                 'TARGET':'_blank',
//                                 'href': 'https://wiki.cyverse.org/wiki/display/DS/Downloading+and+Uploading+Data'
//                             }).append("More Information")))
//                 )
//             )
//             .append($('<div>')
//                 .append('iPlant Users (Requires iPlant account)')
//                 .append($('<ul>')
//                     .append($('<li>')
//                         .append($('<a>',{
//                             'TARGET':'_blank',
//                             'href': 'https://de.iplantcollaborative.org/de/?type=data&folder=' + path
//                         }).append('Discovery Environment (DE)'))))
//             )
//             .append($("<dl>")
//                 .append($("<dt>").append("Path:"))
//                 .append($("<dd>").append($("<input>", {
//                     value: path,
//                     type: 'text'
//                 })))
//                 .append($("<dt>").append("File Name:"))
//                 .append($("<dd>").append($("<input>", {
//                     value: this.model.get('name'),
//                     type: 'text'
//                 }))));
//     },
//     events: {
//         "click #download_button": "check_recaptcha_cookie"
//     },
//     check_recaptcha_cookie: function(event) {
//         if (this.cookie_value('recaptcha_status') != 'verified') {
//             event.preventDefault();
//             $('#download_form').append('<script src="https://www.google.com/recaptcha/api.js" async defer></script>');
//         } else {
//             $('#download_button').popover('hide');
//             return true;
//         }

//         if ($('#recaptcha').html()) {
//             grecaptcha.reset();
//         }
//     },
// });

// Datacommons.Views.Search = Backbone.View.extend({
//     render: function() {
//         this.$el
//             .append('Search').append($('<input>', {'type': 'text'})).append($('<input>', {'type': 'submit'}))
//     }
// });

// Datacommons.Views.Metadata = Backbone.View.extend({
//     tagName: 'div',
//     events: {
//         'click .metadataLink': 'search_metadata',
//         'click #submit_search' : 'search'
//     },
//     initialize: function() {
//         this.libraryNumbers = Utils.get_metadata_values.bind(this)('Library Number');
//         this.subjects = Utils.get_metadata_values.bind(this)('Subject');
//         this.contributors = Utils.get_metadata_values.bind(this)('Contributor');
//     },
//     render: function() {
//         console.log('MainView render this', this)

//         this.$el
//             .append('Search').append($('<input>', {'type': 'text', 'id':'search_input'})).append($('<input>', {'type': 'submit', 'id':'submit_search'}))
//             .append($('<h2>').append('Metadata'))

//         var $subjects = $('<div>').append('Subject: ')
//         _.each(this.subjects, function(element, index, list){
//             $subjects.append($('<a>',{
//                         'class': 'metadataLink'
//                     }).data('search_params', {name: 'Subject', value: element}).append(element))
//             if (index != list.length - 1) {
//                 $subjects.append(', ')
//             }
//         })
//         $subjects.appendTo(this.$el);

//         var $contributors = $('<div>').append('Contributors: ')
//         _.each(this.contributors, function(element, index, list){
//             $contributors.append($('<a>',{
//                         'class': 'metadataLink'
//                     }).data('search_params', {name: 'Contributor', value: element}).append(element))
//             if (index != list.length - 1) {
//                 $contributors.append(', ')
//             }
//         })
//         $contributors.appendTo(this.$el);

//         var $libraryNumbers = $('<div>').append('Library Number: ')
//         _.each(this.libraryNumbers, function(element, index, list){
//             $libraryNumbers.append($('<a>',{
//                         'class': 'metadataLink'
//                     }).data('search_params', {name: 'Library Number', value: element}).append(element))
//             if (index != list.length - 1) {
//                 $libraryNumbers.append(', ')
//             }
//         })

//         $libraryNumbers.appendTo(this.$el);

//         var $dl = $('<dl>')
//         _.each(this.model.attributes.metadata, function(m) {
//             metaValue = m['value']
//             metaName = m['attr']

//             $dl.append($("<dt>").append(metaName).data('metadata_name', metaName))
//             .append($("<dd>").append(m['value'])
//                 // .append($('<a>',{
//                     // 'class': 'metadataLink',
//                 // }).data('search_params', {name: metaName, value: metaValue}).append(metaValue + ' '))
//             )
//         })
//         $dl.appendTo(this.$el);
//         console.log('this.model',this.model)
//         this.$el.append(new Datacommons.Views.NodeListView({model: this.model, collection:this.model.get('children')}).el);

//         return this;
//     },
//     search_metadata: function(e) {
//         e.preventDefault();
//         var searchParams = {}
//         searchParams['metadata_name'] = $(e.currentTarget).closest('a').data('search_params').name//$(e.currentTarget).closest('div').data('metadata_name');
//         searchParams['metadata_value'] = $(e.currentTarget).closest('a').data('search_params').value;

//         var results = new Datacommons.Collections.MetadataMatches([], {name: searchParams['metadata_name'], value: searchParams['metadata_value']});

//         var self=this;
//         results.fetch({update: true, remove: false})
//         .done(
//             function(){
//                 console.log('search params', searchParams)
//                 console.log('metadata search results', results)
//                 self.show_metadata_results(results, searchParams)
//             });

//         // Datacommons.Events.Traversal.trigger('search_metadata', searchParams);
//         return false;
//     },
//     search: function(e) {
//         e.preventDefault();
//         var search_term = $('#search_input').val()

//         var results = new Datacommons.Collections.SearchResults([], {search_term: search_term});

//         var self=this;
//         results.fetch({update: true, remove: false})
//         .done(
//             function(){
//                 console.log('search results', results.models[0].attributes)
//                 self.show_search_results(results.models[0].attributes, search_term)
//             });

//         return false;
//     },
//     show_metadata_results: function(collection, searchParams) {
//         this.$el.empty();
//         heading = this.$el.append('Collections with ' + searchParams['metadata_name'])

//         if (searchParams['metadata_value']) {
//             heading.append(' = ' + searchParams['metadata_value'])
//         }

//         $list = $("<ul>", {'class': 'node-list'});

//         collection.each(function(node) {
//             $("<li>")
//                 .data('model', node)
//                 .addClass(node.get('is_dir') ? 'dir' : 'file ext-' + Utils.file_ext(node.get('name')))
//                 .append($('<a>', {href: node.get('browse_url')}).append(node.get('name')))
//                 .appendTo($list);
//         });
//         this.$el.append($list);

//         return this;
//     },
//     show_search_results: function(collection, searchTerm) {
//         this.$el.empty();
//         heading = this.$el.append('Collections with metadata value ' + searchTerm)


//         $list = $("<ul>", {'class': 'node-list'});


//         for(var index in collection) {
//             $("<li>")
//                 // .append($('<a>', {href: '/browse' + collection[index]['path']}).append(collection[index]['id']))
//                 .append($('<a>', {href: '/browse' + collection[index]['path']}).append(collection[index]['path']))
//                 .appendTo($list);
//         }
//         this.$el.append($list);

//         return this;
//     },
// });

// Datacommons.Router = Backbone.Router.extend({
//     routes: {
//         "": "index",
//         "browse/*path": "expand"
//     },
//     initialize: function() {
//         this.baseNode = new Datacommons.Models.Node({path: root, name: root_name, is_dir: true});
//         this.dataApp = new Datacommons.Views.DataApp({el: $('#file-scroller-inner')}).render();
//         this.breadcrumb_view = new Datacommons.Views.BreadcrumbView({el: $('#breadcrumbs'), base_node: this.baseNode}).render();
//         // this.search = new Datacommons.Views.Search({el: $('#search')}).render();
//     },
//     index: function() {
//         Datacommons.Events.Traversal.trigger('navigate', this.baseNode);
//     },
//     expand: function(path) {
//         var node = new Datacommons.Models.Node({path: '/' + decodeURIComponent(path)});
//         node.fetch({
//             success: function(model) {
//                 Datacommons.Events.Traversal.trigger('navigate', model);
//             }
//         });
//     }
// });

// // This is a hack to add a callback to bootstrap's popover
// // http://www.silviarebelo.com/2013/03/adding-callbacks-to-twitter-bootstraps-javascript-plugins/
// var pt = $.fn.popover.Constructor.prototype.show;
// $.fn.popover.Constructor.prototype.show = function(){
//     pt.call(this);
//     if (this.options.afterShow)
//         this.options.afterShow();
// }

// window.recaptcha_callback = function recaptcha_callback(response) {
//     var d = new Date();
//     d.setTime(d.getTime() + (365*24*60*60*1000));
//     var expires = "expires="+d.toUTCString();
//     document.cookie = 'recaptcha_status=verified; ' + expires;

//     $('#download_form').submit();
//     $('#download_button').popover('hide');
// }

// return Datacommons;

// });
