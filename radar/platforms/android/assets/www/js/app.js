// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('radar', ['ionic', 'radar.controllers', 'radar.services','dua-sdk'])

.run(function ($ionicPlatform, $ionicPopup,$state) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleLightContent();
    }
    $ionicPlatform.registerBackButtonAction(function (event) {
        if ($state.current.name.indexOf("tab") != -1 || $state.current.name == "login") {
            var confirmPopup = $ionicPopup.confirm({
                template: '是否退出应用?',
                buttons: [{ text: '取消' }, { text: '<b>确定</b>', type: 'button-positive', onTap: function (e) { if (false) { e.preventDefault() } else { return true; } } }]
            });
            confirmPopup.then(function (res) {
                if (res) {
                    navigator.app.exitApp();
                } else {
                }
            });
        } else {
            navigator.app.backHistory();
        }
    }, 100);
  });
})

.config(function ($stateProvider, $urlRouterProvider, $ionicConfigProvider) {
    $ionicConfigProvider.platform.android.tabs.position('bottom');
  // Ionic uses AngularUI Router which uses the concept of states
  // Learn more here: https://github.com/angular-ui/ui-router
  // Set up the various states which the app can be in.
  // Each state's controller can be found in controllers.js
  $stateProvider

  // setup an abstract state for the tabs directive
    .state('tab', {
    url: "/tab",
    abstract: true,
    templateUrl: "templates/tabs.html"
  })

  // Each tab has its own nav history stack:

  .state('tab.wlds', {
    url: '/wlds',
    views: {
      'tab-wlds': {
        templateUrl: 'templates/tab-wlds.html',
        controller: 'WldsCtrl'
      }
    }
  })
  .state('tab.local', {
      url: '/local',
      views: {
        'tab-local': {
          templateUrl: 'templates/tab-local.html',
          controller: 'LocalCtrl'
        }
      }
  })
        .state('scan-detail', {
            url: '/scan-detail/:recordIndex',
            templateUrl: 'templates/tab-scanDetail.html',
            controller: 'ScanDetailCtrl'
        })
        .state('tab.server', {
            url: '/server',
            views: {
                'tab-server': {
                    templateUrl: 'templates/tab-server.html',
                    controller: 'ServerCtrl'
                }
            }
        })
  .state('tab.settings', {
    url: '/settings',
    views: {
      'tab-settings': {
        templateUrl: 'templates/tab-settings.html',
        controller: 'SettingsCtrl'
      }
    }
  });

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/tab/wlds');

});

Date.prototype.Format = function (fmt) { //author: meizz 
    var o = {
        "M+": this.getMonth() + 1,                 //月份 
        "d+": this.getDate(),                    //日 
        "h+": this.getHours(),                   //小时 
        "m+": this.getMinutes(),                 //分 
        "s+": this.getSeconds(),                 //秒 
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
        "S": this.getMilliseconds()             //毫秒 
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

