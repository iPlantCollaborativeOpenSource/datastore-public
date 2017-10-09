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


    var app = angular.module('Datastore', ['djng.urls', 'ui.bootstrap', 'ngCookies', 'ngSanitize'])
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

    app.value('DcrPaths', {
        'CURATED': '/iplant/home/shared/commons_repo/curated',
        'COMMUNITY': '/iplant/home/shared'
    });

    app.filter('contains', function() {
      return function (array, needle) {
        return array.indexOf(needle) >= 0;
      };
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

        service.getItemMetadata = function(itemId, download=false) {
            return $http.get(djangoUrl.reverse('api_metadata', {'item_id': itemId}), {'download': download})
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

        service.downloadFile = function(file) {
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

    app.controller('HomeCtrl', ['$scope', 'DcrPaths', function($scope, DcrPaths) {
        var defaultTitle = 'Tip:';
        var defaultDescription = 'Hover over an option for more information.';

        $scope.data={
            browseDescriptionTitle: defaultTitle,
            browseDescription: defaultDescription,
            publishDescriptionTitle: defaultTitle,
            publishDescription: defaultDescription
        };

        $scope.urls={
            community: '/browse' + DcrPaths.COMMUNITY,
            curated: '/browse' + DcrPaths.CURATED
        };

        $scope.mouseOver = function(data) {
            if (data == 'shared') {
                $scope.data.browseDescriptionTitle = 'Community Released:';
                $scope.data.browseDescription = "These data are provided by community collaborators for public access. Community Released Data are not curated by the Data Commons and don't have permanent identifiers. Their location and contents may change."

            } else if (data == 'dcr') {
                $scope.data.browseDescriptionTitle = 'CyVerse Curated:';
                $scope.data.browseDescription = "All data that have been given a permanent identifier (DOI or ARK) by CyVerse. These data are stable and contents will not change.";
            } else if (data == 'ncbi-sra') {
                $scope.data.publishDescriptionTitle = 'NCBI-SRA:';
                $scope.data.publishDescription = "Instructions on how to publish data to NCBI's Sequence Read Archive via the Data Commons."
            } else if (data == 'ncbi-wgs') {
                $scope.data.publishDescriptionTitle = 'NCBI-WGS:';
                $scope.data.publishDescription = "Instructions on how to publish data to NBCI's Whole Genome Shotgun (WGS) Archive via the Data Commons."
            } else if (data == 'dcrPublish') {
                $scope.data.publishDescriptionTitle = 'CyVerse:';
                $scope.data.publishDescription = "Request a permanent identifier (DOI or ARK) through the Data Commons or request a Community Released Data Folder.";
            }
        };

        $scope.mouseLeave = function() {
            $scope.data={
                browseDescriptionTitle: defaultTitle,
                browseDescription: defaultDescription,
                publishDescriptionTitle: defaultTitle,
                publishDescription: defaultDescription,
            };
        };
    }]);


    app.controller('DcrMainCtrl', ['$scope', '$q', '$location', '$cookies', '$anchorScroll', 'TerrainConfig', 'DcrPaths', 'DcrFileService',
        function($scope, $q, $location, $cookies, $anchorScroll, TerrainConfig, DcrPaths, DcrFileService) {

            $scope.config = TerrainConfig;

            $scope.model = {
                item: {},
                collection: {},
                pagination: {
                    show: false,
                    pageSize: TerrainConfig.DIR_PAGE_SIZE,
                    total: 0,
                    current: 1,
                    item_start: 0,
                    item_end: 0
                }
            };

            $scope.BasePaths={
                community: DcrPaths.COMMUNITY,
                curated: DcrPaths.CURATED
            }

            $scope.sortType     = 'label'; // set the default sort type
            $scope.sortReverse  = false;  // set the default sort order

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
                        $scope.model.display = null;
                        promises.push(
                            DcrFileService.getItemMetadata(item.id).then(function (result) {
                                $scope.model.metadata = result.metadata
                                $scope.model.display = {'sortedMetadata': result.sorted_meta}
                                $scope.model.display['curatedOrCommunity'] = ($scope.model.item.path.startsWith(DcrPaths.CURATED)) ? 'curated' : 'community';

                                if (Object.keys($scope.model.metadata).length) {
                                    $scope.model.display.showMoreButton = 'show more'
                                    $scope.model.display.hasMetadata = true

                                    if ($scope.model.metadata.Rights.value === 'ODC PDDL') {
                                        $scope.model.display.Rights = 'This data is made available under the Public Domain Dedication and License v1.0 whose full text can be found at <a href="http://www.opendatacommons.org/licenses/pddl/1.0/"> http://www.opendatacommons.org/licenses/pddl/1.0/ </a>';
                                    } else if ($scope.model.metadata.Rights.value === 'CC0') {
                                        $scope.model.display.Rights = '<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.';
                                    } else {
                                        $scope.model.display.Rights = '<dt>Rights: </dt> <dd>' + $scope.model.metadata.Rights.value + '</dd>'
                                    }

                                    if ($scope.model.metadata.Version) {
                                        $scope.model.display.readableCitation = $scope.model.metadata.Creator.value + ' (' + $scope.model.metadata['Publication Year'].value + '). ' + $scope.model.metadata.Title.value + '. ' + $scope.model.metadata.Version.value + '. ' + $scope.model.metadata.Publisher.value + '. ' + $scope.model.metadata['Identifier Type'].value + ' ' + $scope.model.metadata['Identifier'].value
                                    } else if ($scope.model.display.curatedOrCommunity ==='curated') {
                                        $scope.model.display.readableCitation = $scope.model.metadata.Creator.value + ' (' + $scope.model.metadata['Publication Year'].value + '). ' + $scope.model.metadata.Title.value + '. ' + $scope.model.metadata.Publisher.value + '. ' + $scope.model.metadata['Identifier Type'].value + ' ' + $scope.model.metadata['Identifier'].value
                                    } else if ($scope.model.display.curatedOrCommunity ==='community'){
                                        if (typeof $scope.model.metadata['Publication Year'] !== 'undefined') {
                                            $scope.model.display['Publication Year'] = $scope.model.metadata['Publication Year'].value;
                                        } else if (typeof $scope.model.metadata['Date'] !== 'undefined') {
                                            $scope.model.display['Publication Year'] = $scope.model.metadata['Date'].value.substring(0,4);
                                        } else {
                                            $scope.model.display['Publication Year'] = (new Date()).getFullYear();
                                        }

                                        $scope.model.display.readableCitation = $scope.model.metadata.Creator.value + ' (' + $scope.model.display['Publication Year'] + '). ' + $scope.model.metadata.Title.value + '. ' + $scope.model.metadata.Publisher.value + '. '
                                    }

                                    $scope.model.display.alreadyDisplayed = [
                                        'Title',
                                        'Creator',
                                        'Description',
                                        'Publisher',
                                        'Publication Year',
                                        'DOI'
                                    ]
                                }
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

                        $q.all(promises).finally(function () {
                            /* update $location */
                            $location
                                .state(angular.copy($scope.model))
                                .path('/browse' + $scope.model.item.path)
                                .search('page', page ? page : null);

                            $scope.expandMetadata = false;
                            console.log('$scope', $scope)
                        });

                        $anchorScroll();
                    });
            };

            $scope.getContents = function(path, page) {
                return DcrFileService.getListItem(path, page).then(
                    function(results) {
                        $scope.model.collection = results;
                        angular.forEach(results.folders, function(item){
                            item['isFolder'] = true;
                            item['file-size'] = '-'
                            // item['date-created'] = new Date(item['date-created'])
                            // item['date-modified'] = new Date(item['date-modified'])
                        })
                        // angular.forEach(results.files, function(item){
                        //     item['date-created'] = new Date(item['date-created'])
                        //     item['date-modified'] = new Date(item['date-modified'])
                        // })
                        $scope.model.collection['FoldersAndFiles'] = results.folders;
                        $scope.model.collection['FoldersAndFiles'] = $scope.model.collection['FoldersAndFiles'].concat(results.files)

                        if ($scope.model.collection.total > 0) {
                            var offset = page * TerrainConfig.DIR_PAGE_SIZE;
                            $scope.model.pagination.item_start = offset + 1;
                            if (offset + TerrainConfig.DIR_PAGE_SIZE > $scope.model.collection.total) {
                                $scope.model.pagination.item_end = $scope.model.collection.total;
                            } else {
                                $scope.model.pagination.item_end = offset + TerrainConfig.DIR_PAGE_SIZE;
                            }
                        }
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

            $scope.sort = function(sortType) {
                if ($scope.sortType == sortType) {
                    $scope.sortReverse = !$scope.sortReverse;
                } else {
                    $scope.sortType = sortType;
                    $scope.sortReverse = false;
                }
            };

            $scope.getSortIcon = function(sortType) {
                if ($scope.sortType == sortType) {
                    return $scope.sortReverse ? 'glyphicon-chevron-down' : 'glyphicon-chevron-up'
                }
            };

            $scope.orderBy = function(property) { //orderBy won't work with properties that have hyphens
              return function(item) {
                return item[property];
              };
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

            $scope.downloadFile = function() {
                DcrFileService.downloadFile($scope.model.item);
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
                    $scope.downloadFile();
                    $('#download_button').popover('hide');
                }
                if ($('#recaptcha').html()) {
                    grecaptcha.reset();
                }
            };

            $scope.metadataToggle = function() {
                $scope.expandMetadata = !$scope.expandMetadata;
                if ($scope.expandMetadata) {
                    $scope.model.display.showMoreButton = 'show less'
                } else {
                    $scope.model.display.showMoreButton = 'show more'
                }
            }

            $scope.getCitation = function(style) {
                if ($scope.model.display.citationFormat === style) {
                    // toggle citation display
                    $scope.model.display.citation = null;
                    $scope.model.display.citationFormat = null;
                    return
                }

                $scope.model.display.citationFormat = style
                if (style =='BibTeX'){
                    $scope.model.display.citation =
                    '@misc{dataset, \n' +
                    ' author = {' + $scope.model.metadata.Creator.value + '} \n' +
                    ' title = {' + $scope.model.metadata.Title.value + '} \n' +
                    ' publisher = {' + $scope.model.metadata.Publisher.value + '} \n' +
                    ' year = {' + $scope.model.display['Publication Year']+ '} \n' +
                    ' note = {' + $scope.model.metadata.Description.value + '} \n' +
                    '}';
                } else if (style =='Endnote'){
                    $scope.model.display.citation =
                    '%0 Generic \n' +
                    '%A ' + $scope.model.metadata.Creator.value + '\n' +
                    '%T ' + $scope.model.metadata.Title.value + '\n' +
                    '%I ' + $scope.model.metadata.Publisher.value + '\n' +
                    '%D ' + $scope.model.display['Publication Year'] + '\n';
                }
            }

            $scope.downloadCitation = function(style) {
                var citationFormat={
                    'BibTeX': 'bib',
                    'Endnote': 'enw'
                }
                var blob = new Blob([$scope.model.display.citation]);
                var downloadLink = angular.element('<a></a>');
                downloadLink.attr('href',window.URL.createObjectURL(blob));
                downloadLink.attr('download', $scope.model.item.label + 'citation.' + citationFormat[style]);
                downloadLink[0].click();
            }


            $scope.downloadMetadata = function(id) {
                var metadataJson = angular.toJson($scope.model.display.sortedMetadata, true);
                var blob = new Blob([metadataJson], { type:"application/json;charset=utf-8;" });
                var downloadLink = angular.element('<a></a>');
                downloadLink.attr('href',window.URL.createObjectURL(blob));
                downloadLink.attr('download', $scope.model.item.label + '_metadata.json');
                downloadLink[0].click();
            }

            // Initial load
            var initialPath = $location.path();
            if (initialPath === '/') {
                initialPath = DcrPaths.COMMUNITY;
                $location.path('/browse' + DcrPaths.COMMUNITY);
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
                        SyntaxHighlighter.highlight({toolbar: false, 'class-name': 'file-preview-wrapper'}, element[0]);
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
