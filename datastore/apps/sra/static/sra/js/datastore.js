if (!Array.prototype.map) {
    /* polyfill */
    Array.prototype.map = function(callback, thisArg) {

        var T, A, k;

        if (this == null) {
            throw new TypeError(" this is null or not defined");
        }

        // 1. Let O be the result of calling ToObject passing the |this| value as the argument.
        var O = Object(this);

        // 2. Let lenValue be the result of calling the Get internal method of O with the argument "length".
        // 3. Let len be ToUint32(lenValue).
        var len = O.length >>> 0;

        // 4. If IsCallable(callback) is false, throw a TypeError exception.
        // See: http://es5.github.com/#x9.11
        if (typeof callback !== "function") {
            throw new TypeError(callback + " is not a function");
        }

        // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
        if (thisArg) {
            T = thisArg;
        }

        // 6. Let A be a new array created as if by the expression new Array(len) where Array is
        // the standard built-in constructor with that name and len is the value of len.
        A = new Array(len);

        // 7. Let k be 0
        k = 0;

        // 8. Repeat, while k < len
        while(k < len) {

            var kValue, mappedValue;

            // a. Let Pk be ToString(k).
            //   This is implicit for LHS operands of the in operator
            // b. Let kPresent be the result of calling the HasProperty internal method of O with argument Pk.
            //   This step can be combined with c
            // c. If kPresent is true, then
            if (k in O) {

                // i. Let kValue be the result of calling the Get internal method of O with argument Pk.
                kValue = O[ k ];

                // ii. Let mappedValue be the result of calling the Call internal method of callback
                // with T as the this value and argument list containing kValue, k, and O.
                mappedValue = callback.call(T, kValue, k, O);

                // iii. Call the DefineOwnProperty internal method of A with arguments
                // Pk, Property Descriptor {Value: mappedValue, : true, Enumerable: true, Configurable: true},
                // and false.

                // In browsers that support Object.defineProperty, use the following:
                // Object.defineProperty(A, Pk, { value: mappedValue, writable: true, enumerable: true, configurable: true });

                // For best browser support, use the following:
                A[ k ] = mappedValue;
            }
            // d. Increase k by 1.
            k++;
        }

        // 9. return A
        return A;
    };
}

(function(window, angular, $) {
    "use strict";

    function config($httpProvider, $locationProvider) {
        /* ensure server recognized ajax requests */
        $httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

        /* CSRF support, but we're not doing any posts... */
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';

        /* cache responses by default */
        $httpProvider.defaults.cache = true;

        $locationProvider.html5Mode(true);
    }


    var app = angular.module('Datastore', ['djng.urls', 'ui.bootstrap', 'ngCookies'])
        .config(['$httpProvider', '$locationProvider', config]);


    app.value('BrushSources', {
        'php': 'shBrushPhp',
        'js': 'shBrushJScript',
        'css': 'shBrushCss',
        'py': 'shBrushPython',
        'plain': 'shBrushPlain',
        'fasta': 'shBrushFasta',
        'eml': 'shBrushXml',
        'xml': 'shBrushXml'
    });


    app.value('TerrainConfig', {
        'DIR_PAGE_SIZE': 100,
        'MAX_DOWNLOAD_SIZE': 2147483648,
        'MAX_PREVIEW_SIZE': 8192
    });


    app.factory('DcrFileService', ['$http', 'djangoUrl', 'TerrainConfig', 'BrushSources', function($http, djangoUrl, TerrainConfig, BrushSources) {

        var service = {};

        service.getItem = function(path) {
            return $http.get(djangoUrl.reverse('api_stat', {'path': path})).then(
                function (resp) {
                    var item = resp.data;
                    if (item.type === 'file') {
                        item.ext = item.label.split('.').pop();
                        item.downloadEnabled = item['file-size'] < TerrainConfig.MAX_DOWNLOAD_SIZE;

                        var parent_path = item.path.split('/');
                        parent_path.pop();
                        item.parent_path = parent_path.join('/');

                        if (item.ext in BrushSources) {
                            item.previewable = true;
                            item.brush = item.ext;
                        }
                        else if (item['content-type'].substring(0, 4) === 'text') {
                            item.previewable = true;
                            item.brush = 'plain';
                        }
                        else {
                            item.previewable = false;
                        }
                    }
                    return item;
                });
        };

        service.getItemMetadata = function(itemId) {
            return $http.get(djangoUrl.reverse('api_metadata', {'item_id': itemId}))
                .then(
                    function (resp) {
                        return resp.data;
                    });
        };

        service.getListItem = function(path, page) {
            page = page || 0;
            return $http.get(djangoUrl.reverse('api_list_item', {'path': path}), {'params': {'page': page}})
                .then(
                    function (resp) {
                        return resp.data;
                    });
        };

        service.previewFile = function(path) {
            return $http.get(djangoUrl.reverse('api_preview_file', {'path': path}))
                .then(
                    function (resp) {
                        return resp.data;
                    });
        };

        service.download = function(file) {
            var url = djangoUrl.reverse('download', {path: file.path});
            var link = document.createElement('a');
            link.setAttribute('download', file.label);
            link.setAttribute('href', url);
            link.setAttribute('target', '_self');
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        return service;

    }]);


    app.controller('DcrMainCtrl', ['$scope', '$q', '$location', '$cookies', '$anchorScroll', 'TerrainConfig', 'DcrFileService',
        function($scope, $q, $location, $cookies, $anchorScroll, TerrainConfig, DcrFileService) {

            $scope.config = TerrainConfig;

            $scope.model = {
                item: {},
                collection: {},
                pagination: {
                    show: false,
                    pageSize: TerrainConfig.DIR_PAGE_SIZE,
                    total: 0,
                    current: 1
                }
            };

            $scope.browse = function($event, item, page) {
                if (item.loading) {
                    return;
                }

                if ($event) {
                    $event.preventDefault();
                }

                page = page || 0;

                item.loading = true;
                DcrFileService.getItem(item.path)
                    .then(function(item) {
                        $scope.model.item = item;

                        var promises = [];

                        /* reset metadata */
                        $scope.model.metadata = null;
                        promises.push(
                            DcrFileService.getItemMetadata(item.id).then(function (result) {
                                $scope.model.metadata = result;
                            })
                        );

                        /* reset contents */
                        $scope.model.collection = null;
                        $scope.model.pagination.show = false;
                        if (item.type === 'dir') {
                            promises.push($scope.getContents(item.path, page));
                        }

                        /* reset preview */
                        $scope.model.preview = null;
                        if (item.previewable) {
                            promises.push($scope.preview(item.path));
                        }

                        $q.all(promises).then(function () {
                            /* update $location */
                            $location
                                .state(angular.copy($scope.model))
                                .path('/browse' + $scope.model.item.path)
                                .search('page', page ? page : null);
                        });

                        $anchorScroll();
                    });
            };

            $scope.getContents = function(path, page) {
                return DcrFileService.getListItem(path, page).then(
                    function(results) {
                        $scope.model.collection = results;
                        if ($scope.model.collection.total > TerrainConfig.DIR_PAGE_SIZE) {
                            $scope.model.pagination.show = true;
                            $scope.model.pagination.total = $scope.model.collection.total;
                            $scope.model.pagination.current = page + 1;
                        } else {
                            $scope.model.pagination.show = false;
                        }
                        return results;
                    },
                    function(err) {
                        $scope.model.err = err;
                    }
                );
            };

            $scope.pageChanged = function() {
                var load_page = $scope.model.pagination.current - 1;
                $scope.getContents($scope.model.item.path, load_page)
                    .then(function() {
                        /* scroll to top of listing */
                        $anchorScroll('directory-contents');

                        /* update $location */
                        $location
                            .state(angular.copy($scope.model))
                            .search('page', load_page);
                    });
            };

            $scope.download = function() {
                DcrFileService.download($scope.model.item);
            };

            $scope.preview = function(path) {
                DcrFileService.previewFile(path).then(
                    function(preview) {
                        $scope.model.preview = preview;
                        return preview;
                    },
                    function(err) {
                        console.log('Preview error', err);
                        $scope.err = err.data
                    }
                )
            };

            $scope.check_recaptcha_cookie = function() {
                if ($cookies.get('recaptcha_status') != 'verified') {
                    $('#download_button').append('<script src="https://www.google.com/recaptcha/api.js" async defer></script>');
                } else {
                    $scope.download();
                    $('#download_button').popover('hide');
                }
                if ($('#recaptcha').html()) {
                    grecaptcha.reset();
                }
            };

            // Initial load
            var initialPath = $location.path();
            if (initialPath === '/') {
                initialPath = '/iplant/home/shared';
                $location.path('/browse/iplant/home/shared');
            }
            else if (initialPath.indexOf('/browse') === 0) {
                initialPath = initialPath.slice(7);
            }

            var searchObj = $location.search();

            $scope.browse(undefined, {'path': initialPath}, +searchObj.page);

            if (searchObj && searchObj.pf_id && searchObj.pf_path) {
                $scope.preview(undefined, {
                    'id': searchObj.pf_id,
                    'path': searchObj.pf_path
                });
            }

            $scope.$on('$locationChangeSuccess', function($event, newUrl, oldUrl, newState) {
               if (newState && newUrl !== oldUrl) {
                   $scope.model = newState;
               }
            });

        }]);


    app.directive('dcrBreadcrumbs', function() {
        function makeLinks(item) {
            if (item && item.path) {
                var currentPath = item.path;
                var pathParts = currentPath.split('/');
                var base = pathParts.slice(0, 3).join('/');
                var crumbs = pathParts.slice(3);
                return crumbs.map(function (o, idx, list) {
                    return {
                        'label': o,
                        'path': base + '/' + list.slice(0, idx + 1).join('/')
                    };
                });
            }
        }

        return {
            restrict: 'EA',
            templateUrl: '/static/sra/templates/dcr-breadcrumbs.html',
            scope: {
                dcrItem: '=',
                onClick: '&onClick'
            },
            link: function(scope) {
                scope.$watch('dcrItem', function(newValue) {
                    if (newValue) {
                        scope.links = makeLinks(newValue);
                    }
                });

            }
        }
    });


    app.directive('syntaxHighlighter', function () {
        return {
            link:function (scope, element) {
                scope.$watch('model.preview', function(value) {
                    var brush = 'brush:' + scope.model.item.brush;
                    element.addClass(brush);
                    if (value) {
                        SyntaxHighlighter.highlight({}, element[0]);
                    }
                });
            }
        }
    });


    app.filter('bytes', function() {
        return function(bytes, precision) {
            if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
            if (typeof precision === 'undefined') precision = 1;
            var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'];
            var number = bytes === 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(1024));
            return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) +  ' ' + units[number];
        }
    });


})(window, angular, jQuery);
