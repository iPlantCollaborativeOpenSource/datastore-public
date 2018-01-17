(function(window, angular, $) {
    "use strict";

    var app = angular.module('Datastore')

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

        service.getItemMetadata = function(itemId) {
            return $http.get(djangoUrl.reverse('api_metadata', {'item_id': itemId}))
                .then(
                    function (resp) {
                        return resp.data;
                    });
        };

        service.getListItem = function(path, page, sortType, sortDir) {
            page = page || 0;

            switch(sortType) {
                case 'label':
                    sortType = 'NAME';
                    break;
                case 'file-size':
                    sortType = 'SIZE';
                    break;
                case 'date-created':
                    sortType = 'DATECREATED';
                    break;
                case 'date-modified':
                    sortType = 'LASTMODIFIED';
                    break;
            }

            return $http.get(djangoUrl.reverse('api_list_item', {'path': path}), {'params': {'page': page, 'sort-col': sortType, 'sort-dir': sortDir}})
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
            $scope.sortDir  = 'ASC';  // set the default sort order

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
                                        $scope.model.display.Rights = '<a rel="license" href="https://creativecommons.org/share-your-work/public-domain/cc0/"><img alt="Creative Commons License Badge" style="border-width:0" src="' + window.location.origin + '/static/img/CC0.png"/></a><br />This work is available in the public domain under the <a rel="license" href="https://creativecommons.org/share-your-work/public-domain/cc0/">Creative Commons CC0 agreement</a>.';
                                    } else if ($scope.model.metadata.Rights.value === 'CC-BY') {
                                        $scope.model.display.Rights = '<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License Badge" style="border-width:0" src="' + window.location.origin + '/static/img/CCBY.png"/></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.';
                                    } else {
                                        $scope.model.display.Rights = $scope.model.metadata.Rights.value
                                    }

                                    if ($scope.model.metadata.Version) {
                                        $scope.model.display.readableCitation = $scope.model.metadata.Creator.value + ' (' + $scope.model.metadata['Publication Year'].value + '). ' + $scope.model.metadata.Title.value + '. ' + $scope.model.metadata.Version.value + '. ' + $scope.model.metadata.Publisher.value + '. ' + $scope.model.metadata['Identifier Type'].value + ' ' + $scope.model.metadata['Identifier'].value
                                    } else if ($scope.model.display.curatedOrCommunity ==='curated') {
                                        $scope.model.display.readableCitation = $scope.model.metadata.Creator.value + ' (' + $scope.model.metadata['Publication Year'].value + '). ' + $scope.model.metadata.Title.value + '. ' + $scope.model.metadata.Publisher.value + '. ' + $scope.model.metadata['Identifier Type'].value + ' ' + $scope.model.metadata['Identifier'].value
                                    }

                                    $scope.model.display.alreadyDisplayed = [
                                        'Title',
                                        'Creator',
                                        'Description',
                                        'Rights'
                                    ]

                                    if ($scope.model.display.curatedOrCommunity ==='curated') {
                                        $scope.model.display.alreadyDisplayed.push('Publisher', 'Publication Year', 'DOI')
                                    }


                                }
                            })
                        );

                        /* reset contents */
                        $scope.model.collection = null;
                        $scope.model.pagination.show = false;
                        if (item.type === 'dir') {
                            promises.push($scope.getContents(item.path, page, 'label', 'ASC'));
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

            $scope.getContents = function(path, page, sortType, sortDir) {
                return DcrFileService.getListItem(path, page, sortType, sortDir).then(
                    function(results) {
                        $scope.model.collection = results;
                        angular.forEach(results.folders, function(item){
                            item['isFolder'] = true;
                            item['file-size'] = '-'
                        })

                        // $scope.model.collection['FoldersAndFiles'] = results.folders;
                        // $scope.model.collection['FoldersAndFiles'] = $scope.model.collection['FoldersAndFiles'].concat(results.files)

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
                    $scope.sortDir = $scope.sortDir === 'ASC' ? 'DESC' : 'ASC'
                } else {
                    $scope.sortType = sortType;
                    $scope.sortDir = 'ASC';
                }

                var load_page = 0;
                $scope.getContents($scope.model.item.path, load_page, sortType, $scope.sortDir)
                    .then(function() {
                        /* scroll to top of listing */
                        $anchorScroll('directory-contents');
                        /* update $location */
                        $location
                            .state(angular.copy($scope.model))
                            .search('page', load_page);
                    });
            };

            $scope.getSortIcon = function(sortType) {
                if ($scope.sortType == sortType) {
                    return $scope.sortDir==='ASC' ? 'glyphicon-chevron-up' : 'glyphicon-chevron-down';
                }
            };

            $scope.orderBy = function(property) { //orderBy won't work with properties that have hyphens
              return function(item) {
                return item[property];
              };
            };

            $scope.pageChanged = function() {
                var load_page = $scope.model.pagination.current - 1;
                $scope.getContents($scope.model.item.path, load_page, $scope.sortType, $scope.sortDir)
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
                    ' year = {' + $scope.model.metadata['Publication Year'].value+ '} \n' +
                    ' note = {' + $scope.model.metadata.Description.value + '} \n' +
                    '}';
                } else if (style =='Endnote'){
                    $scope.model.display.citation =
                    '%0 Generic \n' +
                    '%A ' + $scope.model.metadata.Creator.value + '\n' +
                    '%T ' + $scope.model.metadata.Title.value + '\n' +
                    '%I ' + $scope.model.metadata.Publisher.value + '\n' +
                    '%D ' + $scope.model.metadata['Publication Year'].value + '\n';
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
