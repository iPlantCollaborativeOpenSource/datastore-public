(function(window, angular, $) {
    "use strict";

    function config($routeProvider, $locationProvider, $httpProvider) {
        $httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';

        $routeProvider
            .when('/', {
                templateUrl: '/static/sra/templates/info.html',
                controller: 'DatastoreCtrl'
            })
            .when('/browse/', {
                templateUrl: '/static/sra/templates/info.html',
                controller: 'DatastoreCtrl'
            })
            .when('/browse/:path*', {
                templateUrl: '/static/sra/templates/info.html',
                controller: 'DatastoreCtrl'
            });

        $locationProvider.html5Mode(true);
    }

    var app = angular.module('Datastore', ['ngRoute', 'ngAnimate', 'djng.urls', 'ui.bootstrap', 'ngCookies'])
        .config(['$routeProvider', '$locationProvider', '$httpProvider', config]);


    app.controller('DatastoreCtrl', ['$scope', '$rootScope', '$location', '$route', '$routeParams', '$uibModal', 'datastoreFactory',
    function($scope, $rootScope, $location, $route, $routeParams, $uibModal, datastoreFactory) {
        console.log($routeParams);

        $scope.data = {};
        $location.replace();

        if ($location.path() == '/'){
            $scope.path = '/iplant/home/shared/';
            $location.path('browse' + $scope.path);
        } else {
            $scope.path = $location.path()
        }

        if ($scope.path.substring(0, 7) == "/browse") {
            $scope.real_path=$scope.path.slice(7)
        } else {
            $scope.real_path = $scope.path
        }

        $scope.browse = function(path, id){
            if (path.substring(0, 7) == "/browse") {
                var real_path=path.slice(7)
            } else {
                real_path = path
            }

            if (id){
                datastoreFactory.get_collection(real_path, id).then(
                    function(resp) {
                        $scope.data = resp.data;
                        $scope.data.page = 1;

                        for (var i=0; i <= $scope.data.collection.files.length - 1; i++) {
                            $scope.data.collection.files[i]['file-size'] = datastoreFactory.bytes_to_human($scope.data.collection.files[i]['file-size'])
                        }

                        var fullPath = real_path.replace(/\/$/, "").split('/'); //remove trailing slash then split
                        var trail = fullPath.slice(0, 3);
                        trail = trail.join('/');
                        fullPath = fullPath.splice(3);
                        $scope.data.breadcrumbs = fullPath.map(function(s, index){
                            return {  'name': s,
                                'path': trail + '/' + fullPath.slice(0, index + 1).join('/')
                            };
                        });

                        // console.log('$scope.data', $scope.data);
                        // $location.state(angular.copy($scope.data));
                        // console.log('get collection location.state', $location.state());
                        // $location.path('browse' + real_path);
                    },
                    function(data) {
                        console.log('get_collection error data', data);
                        $scope.data.msg = data.data
                    }
                )
            } else {

                datastoreFactory.browse(real_path).then(
                    function(resp) {
                        console.log('browse response', resp);
                        $scope.data = resp.data;
                        $scope.data.page = 1;

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

                        // console.log('browse $scope.data', $scope.data);
                        // $location.state(angular.copy($scope.data));
                        // console.log('browse location.state', $location.state());
                        // $location.path('browse' + real_path);

                    },
                    function(data) {
                        console.log('browse error data', data);
                        $scope.data.msg = data.data
                    }
                )
            }
        };

        $scope.load_more = function(path){
            $scope.data.page++;
            console.log('page', $scope.data.page);

            datastoreFactory.load_more(path, $scope.data.page).then(
                function(resp) {
                    console.log('load more response', resp);

                    if ($scope.data.type == 'dir') {
                        for (var i=0; i <= resp.data.collection.files.length - 1 ; i++) {
                            resp.data.collection.files[i]['file-size'] = datastoreFactory.bytes_to_human(resp.data.collection.files[i]['file-size'])
                        }
                    } else {
                        $scope.data['file-size'] = datastoreFactory.bytes_to_human($scope.data['file-size'])
                    }
                    $scope.data.collection.more_data = resp.data.collection.more_data;
                    $scope.data.collection.folders.push.apply($scope.data.collection.folders, resp.data.collection.folders);
                    $scope.data.collection.files.push.apply($scope.data.collection.files, resp.data.collection.files);
                    console.log('load more $scope.data', $scope.data);
                    $location.state(angular.copy($scope.data))
                },
                function(data) {
                    console.log('load more error data', data);
                    $scope.data.msg = data.data
                }
            )
        };

        $scope.browse($scope.path);

        $scope.$on('$locationChangeSuccess', function ($event, newUrl, oldUrl, newState, oldState) {
            if (newUrl !== oldUrl) {
                console.log('location change success', $event);
                console.log('newUrl', newUrl);
                console.log('oldUrl', oldUrl);
                console.log('newState', newState);
                console.log('oldState', oldState);
                $scope.data = newState;
            }
        });

        $scope.modal = function(file_path, file_name) {
            datastoreFactory.browse(file_path).then(
                function(resp) {
                    console.log('modal response', resp);
                    var data = resp.data;
                    if (data['file-size'] < 2000000000) {
                        data['downloadable'] = true
                    } else {
                        data['downloadable'] = false
                    }
                    data['file-size-readable'] = datastoreFactory.bytes_to_human(data['file-size']);

                    var date = new Date(data['date-created']);
                    data['date-created'] = date.toDateString();

                    date = new Date(data['date-modified']);
                    data['date-modified'] = date.toDateString();
                    console.log('modal scope', $scope);


                    $uibModal.open({
                        animation:$scope.animationsEnabled,
                        templateUrl: '/static/sra/templates/preview-modal.html',
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
                            }
                        }
                    })

                },
                function(data) {
                    console.log('modal error data', data);
                    $scope.data.msg = data.data
                }
            )
        };

    }]);

    app.factory('datastoreFactory', ['$http', 'djangoUrl', function($http, djangoUrl) {
        var service = {};

        service.browse = function(path) {
            return $http.get(djangoUrl.reverse('browse', {'path': path}));
        };

        service.get_collection = function(path, id) {
            // console.log('path', path)
            return $http.get(djangoUrl.reverse('get_collection', {'path': path, 'id': id}));
        };

        service.load_more = function(path, page) {
            return $http.get(djangoUrl.reverse('load_more', {'path': path, 'page': page}));
        };

        service.bytes_to_human = function(bytes) {
            var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
            return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
        };

        service.serve_file = function(path) {
            return $http.get(djangoUrl.reverse('serve', {'path': path}));
        };

        return service;
    }]);

    app.controller('ModalInstanceCtrl', ['$http', 'djangoUrl', '$uibModalInstance', '$cookies', 'file_path', 'file_name', 'data', '$scope', '$rootScope', 'datastoreFactory', '$sce', function ($http, djangoUrl, $uibModalInstance, $cookies, file_path, file_name, data, $scope, $rootScope, datastoreFactory, $sce) {
        $scope.data = {};
        $scope.data = data;
        $scope.file_path = file_path;
        $scope.file_name = file_name;
        console.log('ModalInstanceCtrl scope', $scope);

        $scope.download = function(path){
            $uibModalInstance.close();

            var url = 'download'+ path;
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
            datastoreFactory.serve_file(path).then(
                function(resp) {
                    console.log('serve_file response', resp);
                    $scope.data.file_preview = resp.data;
                    $rootScope.$broadcast('previewLoaded');
                },
                function(data) {
                    console.log('serve_file error data', data);
                    $scope.data.msg = data.data
                }
            )
        };

        $scope.isPreviewable = function(filename){
            var BrushSources = {
                'php': 'shBrushPhp',
                'js': 'shBrushJScript',
                'css': 'shBrushCss',
                'py': 'shBrushPython',
                'plain': 'shBrushPlain',
                'fasta': 'shBrushFasta',
                'eml': 'shBrushXml',
                'xml': 'shBrushXml'
            };

            var ext = filename.split('.').pop();

            if (ext in BrushSources || $scope.data['content-type'].substring(0, 4) == 'text'){
                $scope.data.isPreviewable = 'yes';
                if (ext in BrushSources) {
                    $scope.data.brush = ext;
                } else {
                    $scope.data.brush = 'text';
                }
                $scope.preview($scope.data.path);
                console.log('ModalInstanceCtrl scope after checking previewable', $scope)
            } else {
                $scope.data.isPreviewable = 'no'
            }
        };

        $scope.isPreviewable($scope.data['label']);


        $scope.check_recaptcha_cookie = function(path) {
            $scope.download_path = '/download' + path;

            if ($cookies.get('recaptcha_status') != 'verified') {

                $('#download_button').append('<script src="https://www.google.com/recaptcha/api.js" async defer></script>');
            } else {
                $scope.download(path);
                $('#download_button').popover('hide');

            }

            if ($('#recaptcha').html()) {
                grecaptcha.reset();
            }
        };
    }]);

    app.directive('syntaxHighlighter', function () {
        return {
            link:function ($scope, element, attrs) {
                $scope.$watch('data.file_preview', function(value) {
                    console.log('saw $scope.data.file_preview change');
                    var brush='brush:' + $scope.data.brush;
                    $(element).addClass(brush);
                    if (value) {
                        SyntaxHighlighter.highlight({}, element[0]);
                    }
                });
            }
        }
    });


})(window, angular, jQuery);
