(function(window, angular, $) {
    "use strict";

    var app = angular.module('Datastore')

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

})(window, angular, jQuery);
