angular.module('radar.controllers', [])

.controller('WldsCtrl', function ($scope, WIRELESS, $state, $cordovaGeolocation, DUA, $http, $ionicPopup, $ionicPlatform) {
    $scope.wlds = DUA.getWlds();

    $scope.location = DUA.getLocation();

    $scope.getImg=function(wld) { 
        var imgUrl = '';
        switch (wld.type) {
            case 'T': {
                imgUrl = wld.ava == 0 ? 'img/wld/cell_invisible.png' : wld.reg == 1 ? 'img/wld/cell_registered.png' : 'img/wld/cell_visible.png';
                break;
            }
            case 'F': {
                imgUrl = wld.ava == 0 ? 'img/wld/wifi_invisible.png' : wld.reg == 1 ? 'img/wld/wifi_registered.png' : 'img/wld/wifi_visible.png';
                break;
            }
            case 'B': {
                imgUrl = wld.ava == 0 ? 'img/wld/bluetooth_invisible.png' : wld.reg == 1 ? 'img/wld/bluetooth_registered.png' : 'img/wld/bluetooth_visible.png';
                break;
            }
        }
        return imgUrl;
    }

    $scope.startScan = function () {
        $scope.scanDisable = true;
        DUA.scanWlds();
    }
    $scope.saveWlds = function () {
        DUA.saveWlds();
    }
    $scope.scanDisable = false;
})

.controller('LocalCtrl', function ($scope,DUA) {
    $scope.$on("$ionicView.enter", function () {
        $scope.records = DUA.getRecords();
    });
    $scope.toDate = function (tp) {
        return new Date(tp).Format('yyyyMMdd hh:mm:ss');
    }
})
.controller('ScanDetailCtrl', function ($scope, DUA, $stateParams) {
    var record = DUA.getRecord($stateParams.recordIndex);
    $scope.wlds = record.data;
    $scope.upload = function () {
        DUA.uploadRecord(record);
    }
    $scope.getImg = function (wld) {
        var imgUrl = '';
        switch (wld.type) {
            case 'T': {
                imgUrl = wld.ava == 0 ? 'img/wld/cell_invisible.png' : wld.reg == 1 ? 'img/wld/cell_registered.png' : 'img/wld/cell_visible.png';
                break;
            }
            case 'F': {
                imgUrl = wld.ava == 0 ? 'img/wld/wifi_invisible.png' : wld.reg == 1 ? 'img/wld/wifi_registered.png' : 'img/wld/wifi_visible.png';
                break;
            }
            case 'B': {
                imgUrl = wld.ava == 0 ? 'img/wld/bluetooth_invisible.png' : wld.reg == 1 ? 'img/wld/bluetooth_registered.png' : 'img/wld/bluetooth_visible.png';
                break;
            }
        }
        return imgUrl;
    }
})
.controller('ServerCtrl', function ($scope, DUA, $http) {
    $scope.refresh = function () {
        DUA.getServerWlds();
    }
    $scope.wlds = DUA.getServerWlds();
    $scope.getImg = function (wld) {
        var imgUrl = '';
        switch (wld.type) {
            case 'T': {
                imgUrl = wld.ava == 0 ? 'img/wld/cell_invisible.png' : wld.reg == 1 ? 'img/wld/cell_registered.png' : 'img/wld/cell_visible.png';
                break;
            }
            case 'F': {
                imgUrl = wld.ava == 0 ? 'img/wld/wifi_invisible.png' : wld.reg == 1 ? 'img/wld/wifi_registered.png' : 'img/wld/wifi_visible.png';
                break;
            }
            case 'B': {
                imgUrl = wld.ava == 0 ? 'img/wld/bluetooth_invisible.png' : wld.reg == 1 ? 'img/wld/bluetooth_registered.png' : 'img/wld/bluetooth_visible.png';
                break;
            }
        }
        return imgUrl;
    }
})


.controller('SettingsCtrl', function ($scope,DUA) {
    $scope.settings = {};
    $scope.clearTable = function () {
        //DUA.clearTable('wlds');
    }
    $scope.$on("$ionicView.enter", function () {
        console.info(DUA.getSettings('autoScan', true));
        $scope.settings.autoScan = DUA.getSettings('autoScan', true);
        $scope.settings.gpsTimeout = DUA.getSettings('gpsTimeout', 5000);
        $scope.settings.promiseTimeout = DUA.getSettings('promiseTimeout', 6000);
        $scope.settings.bleTimeout = DUA.getSettings('bleTimeout', 6);
    });
});
