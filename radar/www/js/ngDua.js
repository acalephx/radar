/*!
 * dua-sdk for ionic
 * 1.0.0
 * Copyright 2015 Drifty Co. http://www.xdua.org/
 * See LICENSE in this repository for license information
 */


/*
 * dua-sdk在localstorage上会建立一个叫duaLocalStorage的Key
 * 它是一个JSON.string.包含
 *  1：initime   APP第一次打开时的时间戳，毫秒
 *  2：lastime   APP最近一次打开时的时间戳，毫秒
 *  3：anonymousDuaid 匿名dua_id
 *  4：currentDuaid 当前使用APP的dua_id.这个变量在登录和退出账号的时候会发生变化
 *  5：lastclose APP最近exit/pause的时间
 *  6：lastStart APP最近start/resume的时间
 *  每次active结算的时候的dua_id，都以当时的currentDuaid来结算。不管它这个active启动的时候是匿名还是其它dua_id. 
 *  举例：你打开app,以匿名用户玩了10分钟，然后登录玩了2分钟，然后pause,这个时候结算，是以新的dua_id结算。这里面的active统计误差我们忽略掉。
 *  
*/
angular.module('dua-sdk', ['ngCordova'])
.run(function ($ionicPlatform, $rootScope, DUA) {
    $ionicPlatform.ready(function () {
        console.info("dua-sdk module run!");
        document.addEventListener("deviceready", onDeviceReady, false);
    });
    /*!
     * deviceready:
     * 当cordova完全加载，可以调用cordova API接口
     * 支持平台：Amazon、Fire OS、Android、BlackBerry 10、iOS、Tizen、Windows Phone 8、Windows 8
    
        pause:
        app切换到后台运行时监听的事件，如打开其它应用。
        支持平台：Amazon Fire OS、Android、BlackBerry 10、iOS、Windows Phone 8、Windows 8
    
        resume：
        app从后台运行时重新获取监听的事件
        支持平台：Amazon Fire OS、Android、BlackBerry 10、iOS、Windows Phone 8、Windows 8
        ios下当app切换到前台时，resume事件执行的函数需以setTimeout（fn,0）包裹，否则app会被挂起。
    
        backbutton：
        按下手机返回按钮时监听的事件
        支持平台：Amazon Fire OS、Android、BlackBerry 10、Windows Phone 8
    
        menubutton：
        按下手机上菜单按钮时监听的事件
        支持平台：Amazon Fire OS、Android、BlackBerry 10    
        
        */
    function onDeviceReady() {
        onStart();
        document.addEventListener("pause", onPause);
        document.addEventListener("resume", onResume);
        document.addEventListener("exit", onExit);
    }
    function onStart() {
        console.info("onStart() is called " + new Date().getTime());
        DUA.startOrResume();
    }
    function onPause() {
        console.info("onPause() is called " + new Date().getTime());
        DUA.pauseOrExit();
    }
    function onResume() {
        console.info("onResume() is called " + new Date().getTime());
        DUA.startOrResume();
    }
    function onExit() {
        console.info("onExit() is called " + new Date().getTime());
        DUA.pauseOrExit();
    }
})
.config(function (DUAProvider) {
    DUAProvider.setServerUrl("http://api.xdua.org");
})
.provider('DUA', function () {
    this.serverUrl = "";
    this.setServerUrl = function (newUrl) {
        this.serverUrl = newUrl;
    }
    this.$get = function ($http, $cordovaDevice, $cordovaSQLite, $cordovaNetwork, $q, $cordovaAppVersion, $cordovaBLE, $timeout, $cordovaGeolocation, $ionicPopup) {
        var self = this;
        var wlds = [];
        var records = [];
        var serverWlds = [];
        var location={lon:0,lat:0,acc:0};
        var duaDB;
        var duaLocalStorage = {

        };
        var curUser;
        var onlyWifi; //user swith if only upload in wifi
        //var watch = { ble: false, wifi: false, cell: false };
        var promiseOK = true;
        var saved = false;

        var service = {
            scanWlds: function () {
                if (promiseOK) {
                    promiseOK = false;
                    saved = false;
                    scanDevices().then(function () {
                        promiseOK = true;
                    })
                } else {
                    $ionicPopup.alert({
                        title: "操作失败",
                        template: "当前扫描还未完成"
                    });
                }

            },
            saveWlds:function(){
                if (promiseOK && !saved && wlds.length > 0) {
                    $cordovaSQLite.execute(duaDB, "INSERT INTO scanRecords (lon,lat,acc,data,time) VALUES (?,?,?,?,?)", [location.lon, location.lat, location.acc, JSON.stringify(wlds),location.time]).then(suc,err);
                    //for (var i = 0; i < wlds.length; i++) {
                    //    var obj = wlds[i];
                    //    $cordovaSQLite.execute(duaDB, "INSERT INTO wlds (type,id,name,dbm,reg,time,lon,lat,acc,uploaded) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    //        [obj.type, obj.id, obj.name, obj.dbm, obj.reg, obj.time, location.lon, location.lat, location.acc, 0]).then(function (result) {
                    //            //console.log("INSERT INTO wlds at " + result.insertId + " : ( " + JSON.stringify(obj) +" "+JSON.stringify(location)+ " )");
                    //        }, function (error) {
                    //            console.error(JSON.stringify(error));
                    //        });
                    //}
                    function suc(res) {
                        saved = true;
                        $ionicPopup.alert({
                            title: "操作成功",
                            template: "数据已保存至数据库"
                        });
                    }
                } else {
                    if (!promiseOK) {
                        $ionicPopup.alert({
                            title: "操作失败",
                            template: "扫描还未完成"
                        });
                    } else if (saved) {
                        $ionicPopup.alert({
                            title: "操作失败",
                            template: "当前数据已经保存"
                        });
                    } else {
                        $ionicPopup.alert({
                            title: "操作失败",
                            template: "没有需要保存的数据"
                        });
                    }

                }
            },
            getWlds: function () {
                return wlds;
            },
            uploadRecord:function(record){
                var msg = {};
                msg.dua_id = service.getCurrentDuaid();            
                msg.action = 'add_wlds';
                msg.lon = record.lon;
                msg.lat = record.lat;
                msg.acc = record.acc;
                msg.time = new Date().getTime() - record.time;
                msg.wlds = record.data;

                $http({
                    method: 'POST',
                    url: self.serverUrl + "/wlds",
                    data: msg,
                    timeout: 10000,
                }).then(onSuccess, err);
                function onSuccess(response) {
                    if (response.data.status == 0) {
                        $cordovaSQLite.execute(duaDB, "DELETE FROM scanRecords WHERE inc==?", [record.inc]);
                        $ionicPopup.alert({template:"上传成功"})
                    } else {
                        err(response.data);
                    }
                }
            },
            getRecords: function () {
                if (duaDB != null) {
                    records.length = 0;
                    //$cordovaSQLite.execute(duaDB, "SELECT * FROM wlds", []).then(suc, err);
                    $cordovaSQLite.execute(duaDB, "SELECT * FROM scanRecords", []).then(suc, err);
                    function suc(res) {
                        if (res.rows.length ==0) {
                            $ionicPopup.alert({
                                template: "没有数据"
                            });
                        } else {
                            for (var i = 0; i < res.rows.length; i++) {
                                var obj = res.rows.item(i);
                                var data = JSON.parse(obj.data);
                                obj.data = data;
                                records.push(obj);
                            }
                        }
                    }
                }
                return records;
            },
            getRecord:function(index){
                return records[index];
            },
            getServerWlds: function () {
                serverWlds.length = 0;
                var msg = {};
                msg.action = 'get_wlds';
                msg.dua_id = service.getCurrentDuaid();
                $http({
                    method: 'POST',
                    url: "http://api.xdua.org/wlds",
                    data: msg,
                    timeout: 10000,
                }).then(onSuccess, err);
                return serverWlds;

                function onSuccess(response) {
                    if (response.data.status==0&&response.data.data != null) {
                        for (var i = 0; i < response.data.data.length; i++) {
                            var obj = response.data.data[i];
                            serverWlds.push(obj);
                        }
                    } else {
                        err(response.data);
                    }

                }
            },
            getLocation: function () { return location },
            clearTable: function (tn) {
                if (duaDB == null) {
                    duaDB = $cordovaSQLite.openDB({ name: 'dua.db' });                  
                };
                $cordovaSQLite.execute(duaDB, "DELETE FROM " + tn);
            },
            getSettings:function(name,deVal){
                return getSettings(name, deVal);
            },



















            startOrResume: function () {
                //判断，如果这是本app在本设备的第一次打开，那么要在Localstorage生成一个新的key:duaLocalStorage
                if (localStorage.getItem("duaLocalStorage") == null) {
                    duaLocalStorage.initime = new Date().getTime();
                    duaLocalStorage.lastime = new Date().getTime();
                    duaLocalStorage.lastStart = new Date().getTime();
                    duaLocalStorage.lastClose = new Date().getTime();
                    duaLocalStorage.anonymousDuaid = null;
                    duaLocalStorage.currentDuaid = null;
                    localStorage.setItem("duaLocalStorage", JSON.stringify(duaLocalStorage));
                }
                duaLocalStorage = JSON.parse(localStorage.getItem("duaLocalStorage"));

                //每次打开(start/resume)时要判断本地有没有匿名dua_id，如果没有，那么就要发送born去服务器要取得匿名dua_id
                //要判断是否有网，如果有网，就发born，如果没网就不动了。等下次start/resume
                //我们每次需要dua_id的时候如果没有dua_id就需要立即执行born异步。
                if (duaLocalStorage.anonymousDuaid == null) {
                    if ($cordovaNetwork.isOnline()) {
                        this.born().then(null, null, null);
                    }
                }

                //如果duaDB数据库不存在，那么打开并创建activeEvent表
                if (duaDB == null) {
                    duaDB = $cordovaSQLite.openDB({ name: 'dua.db' });
                    //$cordovaSQLite.execute(duaDB, "DROP TABLE IF EXISTS wlds");
                    $cordovaSQLite.execute(duaDB, "CREATE TABLE IF NOT EXISTS activeEvent (inc integer primary key autoincrement, dua_id integer,t integer,d integer,uploaded integer)");
                    //$cordovaSQLite.execute(duaDB, "CREATE TABLE IF NOT EXISTS wlds (inc integer primary key autoincrement, type string,id string,name string,dbm integer,reg interger,time integer,lon double,lat double,acc double,uploaded integer)");
                    $cordovaSQLite.execute(duaDB, "CREATE TABLE IF NOT EXISTS scanRecords (inc integer primary key autoincrement, lon double,lat double,acc double,time integer, data text)");
                };
                /*
                    thisStart:本次打开的时间
                    lastClost:上次关闭的时间                    
                */
                var thisStart = new Date().getTime();
                var lastStart = duaLocalStorage.lastStart;
                var lastClose = duaLocalStorage.lastClose;
                /*
                    和上次active事件做融合，如果不能融合
                    把上次active结算存入数据库                  
                */
                if (thisStart - lastClose < 5000)//融合=无动作
                {
                    console.info("two active events emerge due to small interval (< 5 seconds)");
                } else {
                    var activeStarttime = lastStart;
                    var activeDuaration = parseInt((lastClose - lastStart) / 1000);
                    var activeDuaid = service.getCurrentDuaid();
                    if (activeDuaration >= 1) {
                        if (duaLocalStorage.anonymousDuaid == null) duaLocalStorage.anonymousDuaid = 0;
                        $cordovaSQLite.execute(duaDB, "INSERT INTO activeEvent (dua_id, t,d,uploaded) VALUES (?,?,?,?)", [activeDuaid, activeStarttime, activeDuaration, 0]).then(function (result) {
                            console.log("INSERT INTO activeEvent at " + result.insertId + " : (" + activeDuaid + " , " + activeStarttime + " , " + activeDuaration + " , 0 )");
                        }, function (error) {
                            console.error(JSON.stringify(error));
                        });
                    }
                    //重新开始一个新act
                    duaLocalStorage.lastStart = thisStart;
                    duaLocalStorage.lastClose = thisStart;
                    localStorage.setItem("duaLocalStorage", JSON.stringify(duaLocalStorage));
                }


                //如果activeEvent表里面有没有上传完的active消息，那么遍历上传
                //dua_active数据记录到本地数据库是独立进行的，不受下面影响
                //1: dua_id没有，即dua_born还没有成功过:此时dua_id被默认为0

                //上传数据库activeEvent表内容到服务器
                //条件是：我的born之前已经拿到dua_id了
                //要注意，数据库中已经存了大量dua_id默认为0的记录，此时都要翻译成真正的dua_id
                //数据：每行的结构如：dua_id, t,d,uploaded
                //客户端不要上传自己的时间戳，因为服务器端不信任客户端时间戳。客户端计算自己的时间偏移来就可以了。
                //如果客户端非常偶然的快速大尺度跳来跳去，会导致时间戳不合理。这个会做如下过滤
                //1:如果时间戳在未来，那么抛弃掉这个包
                //2:如果时间戳在过去好久，duartion明显不合理，超过24小时。那么抛弃掉这个包
                if (duaLocalStorage.anonymousDuaid != null)
                    $cordovaSQLite.execute(duaDB, "SELECT dua_id,t,d FROM activeEvent WHERE  uploaded=0", [])
                        .then(function (res) {
                            if (res.rows.length == 0) return;
                            var events = new Array();
                            var curtime = new Date().getTime();
                            for (var i = 0; i < res.rows.length; i++) {
                                var row = res.rows.item(i);
                                row.t = (curtime - row.t)/1000;
                                if (row.dua_id == 0) row.dua_id = duaLocalStorage.anonymousDuaid;
                                if (row.t > 0 && row.d < 24 * 3600) {
                                    events.push(row);
                                }
                            }
                            var data = {};
                            data.dua_id = duaLocalStorage.anonymousDuaid;
                            data.event = events;
                            service.active(data).then(
                                function (response) {
                                    if (response.status == "ok") {
                                        $cordovaSQLite.execute(duaDB, "UPDATE activeEvent SET uploaded=1", []).then(dbSuccess, dbError, null);
                                        function dbSuccess(result) {
                                            console.info("UPDATE activeEvent success: " + JSON.stringify(result));
                                            //FIXME:数据库操作失败就是个问题了，因为服务器已经同步，而本地却没有同步。请解决这个问题
                                        }
                                        function dbError(error) {
                                            console.info("UPDATE activeEvent error: " + JSON.stringify(error));
                                        }
                                    }
                                },
                                function (noResponse) {
                                    //console.error(JSON.stringify(noResponse));
                                }
                            );
                        },
                        function (noResponse) {
                            console.error("数据库错误" + JSON.stringify(noResponse));
                        }
                    );
            },
            //注意,cordova在onPause的时候，默认情况下，里面的代码不会在pause的时候执行
            //而是在resume的时候执行。所以这个lastClose永远获得的是resume的时间戳。
            //需要在config.xml里让ionic程序保持后台运行，就可以在pause的时候执行函数里代码。
            pauseOrExit: function () {
                duaLocalStorage.lastClose = new Date().getTime();
                localStorage.setItem("duaLocalStorage", JSON.stringify(duaLocalStorage));
            },

            /*
                dua的接口，获取操作手机的当前dua_id.可能是匿名用户，也可能是注册用户。
            */
            getCurrentDuaid: function () {
                var duaLocalStorageItem = localStorage.getItem("duaLocalStorage");
                if (duaLocalStorageItem == null) {
                    return 0;//系统在DUA_BORN前衣0作为默认的dua_id
                } else {
                    duaLocalStorage = JSON.parse(duaLocalStorageItem);
                    var dua_id = duaLocalStorage.currentDuaid;
                    if (dua_id == null) {
                        dua_id = duaLocalStorage.anonymousDuaid;
                    }
                    if (dua_id == null) {//如果系统连匿名dua_id也没有，那给0
                        dua_id = 0;
                    }
                    return dua_id;
                }
            },
            ///*
            //    dua的接口，获取操作手机的当前dua_ustr，用户名
            //*/
            //getCurrentUtel: function () {
            //    var duaLocalStorageItem = localStorage.getItem("duaLocalStorage");
            //    if (duaLocalStorageItem == null) {
            //        return "";//系统在DUA_BORN前衣0作为默认的dua_id
            //    } else {
            //        duaLocalStorage = JSON.parse(duaLocalStorageItem);
            //        var dua_utel = duaLocalStorage.currentUtel;
            //        if (dua_utel == undefined) {
            //            dua_utel = "";
            //        }
            //        return dua_utel;
            //    }
            //},
            ///*
            //    dua的接口，获取操作手机的当前dua_upwd，用户密码
            //*/
            //getCurrentUpwd: function () {
            //    var duaLocalStorageItem = localStorage.getItem("duaLocalStorage");
            //    if (duaLocalStorageItem == null) {
            //        return "";
            //    } else {
            //        duaLocalStorage = JSON.parse(duaLocalStorageItem);
            //        var dua_upwd = duaLocalStorage.currentUpwd;
            //        if (dua_upwd== null) {
            //            dua_upwd = "";
            //        }
            //        return dua_upwd;
            //    }
            //},
            //getCurrentZone: function () {
            //    var duaLocalStorageItem = localStorage.getItem("duaLocalStorage");
            //    if (duaLocalStorageItem == null) {
            //        return "+86-";//系统在DUA_BORN前衣0作为默认的dua_id
            //    } else {
            //        duaLocalStorage = JSON.parse(duaLocalStorageItem);
            //        var zone = duaLocalStorage.currentZone;
            //        if (zone == null) {
            //            zone = "+86-";
            //        }
            //        return zone;
            //    }
            //},
            getProps: function (item,names) {
                var itemStr = localStorage.getItem(item);
                if (itemStr == null) {
                    return null;
                }
                var itemObj = JSON.parse(itemStr);
                var params = [];
                for (var i = 0; i < names.length; i++) {
                    params[i] = itemObj[names[i]];
                }
                return params;
            },
            setItem: function (item, obj) {
                localStorage.setItem(item, angular.toJson(obj));

            },
            getItem:function(item){
                return localStorage.getItem(item);
            },
            // 发Born消息
            born: function () {
                var borninfo = {};
                borninfo.dsn = $cordovaDevice.getUUID();
                borninfo.model = $cordovaDevice.getModel();
                borninfo.os = $cordovaDevice.getPlatform()+" "+$cordovaDevice.getVersion();
                borninfo.man = $cordovaDevice.getManufacturer();//生产商manufacturer
                if (borninfo.model == null)
                    borninfo.model = "Unknown";

                $cordovaAppVersion.getVersionNumber().then(function (version) {
                    borninfo.avn = version;
                });
                $cordovaAppVersion.getVersionCode().then(function (build) {
                    borninfo.avc = build;    //整型  Platforms/AndroidManifest.xml
                });
                $cordovaAppVersion.getAppName().then(function (name) {
                    borninfo.aname = name;
                });
                $cordovaAppVersion.getPackageName().then(function (str) {
                    borninfo.pname = str;
                });





                borninfo.key = "797b75b683162604191d22dba892dfa2";
                borninfo.channel = "Debug";
                borninfo.action = "dua_born";
                borninfo.initime = new Date().getTime() - duaLocalStorage.initime;
                borninfo.lastime = new Date().getTime() - duaLocalStorage.lastime;
                borninfo.initime = parseInt(borninfo.initime / 1000);
                borninfo.lastime = parseInt(borninfo.lastime / 1000);

                var deferred = $q.defer();
                setTimeout(postBorn, 2000);
                return deferred.promise;

                function postBorn() {
                    if (borninfo.model == null)
                        borninfo.model = "Unknown";
                    if (borninfo.avn == null)
                        borninfo.avn = "1.1.1";
                    if (borninfo.avc == null)
                        borninfo.avc = "111";
                    if (borninfo.aname == null)
                        borninfo.aname = "unknown";
                    if (borninfo.pname == null)
                        borninfo.pname = "com.lovearthstudio.unknown";
                    console.info(borninfo);
                    $http.post( "http://api.xdua.org/duas", borninfo)
                        .success(function (response) {
                            console.info("dua_born response: " + JSON.stringify(response));
                            duaLocalStorage.anonymousDuaid = response.dua_id;
                            duaLocalStorage.currentDuaid = response.dua_id;
                            localStorage.setItem("duaLocalStorage", JSON.stringify(duaLocalStorage));
                            deferred.resolve(response);
                        })
                        .error(function (error) {
                            console.error("dua_born error: " + JSON.stringify(error));
                            deferred.reject(error);
                        });
                }
  
                
            },
            active: function (data) {
                var deferred = $q.defer();
                //data.key = "87bef141c833eebd326f9e52caff3fe9";
                data.action = "dua_active";
                data.model = $cordovaDevice.getModel();
                data.os = $cordovaDevice.getPlatform();
                data.channel = "Google Android app shop";
                data.version = "1.1.1";
                $http.post(self.serverUrl + "/duas", data).success(function (response) { deferred.resolve(response); }).error(function (error) { deferred.reject(error); });
                return deferred.promise;
            },
            registerApp: function (regApp) {
                var deferred = $q.defer();
                $http.post(self.serverUrl + '/apps', regApp).success(function (response) { deferred.resolve(response); }).error(function (error) { deferred.reject(error); });
                return deferred.promise;
            },
            loginUser: function (loginUser) {
                var deferred = $q.defer();
                duaLocalStorage = JSON.parse(localStorage.getItem("duaLocalStorage"));
                //如果本地没有匿名用户dua_id，那么就要触发born.触发born后login动作退出，希望用户下一次继续点击.
                if (duaLocalStorage.anonymousDuaid == null) {
                    this.born().then(null, null, null)
                    deferred.reject("anonymous dua_id not exist! try born!");
                } else {
                    //如果本地有匿名dua_id,那么直接发送注册
                    console.info("dua_id exist. go to login() with anonymoousduaid " + duaLocalStorage.anonymousDuaid);
                    loginUser.dua_id = duaLocalStorage.anonymousDuaid;
                    $http.post(self.serverUrl + "/users", loginUser)
                        .success(function (response) {
                            /*登陆成功的动作*/
                            console.info(JSON.stringify(response));
                            if (response.status == 0) {
                                duaLocalStorage = JSON.parse(localStorage.getItem("duaLocalStorage"));
                                duaLocalStorage.currentDuaid = response.dua_id;
                                duaLocalStorage.currentUtel = loginUser.tel;
                                duaLocalStorage.currentUpwd = loginUser.pwd;
                                duaLocalStorage.currentZone = loginUser.zone;
                                localStorage.setItem("duaLocalStorage", JSON.stringify(duaLocalStorage));
                                deferred.resolve(response);
                            } else {
                                deferred.reject(response);
                            }

                        }).error(function (error) { deferred.reject(error); });
                }
                return deferred.promise;
            },
            registerUser: function (regUser) {
                var deferred = $q.defer();
                duaLocalStorage = JSON.parse(localStorage.getItem("duaLocalStorage"));
                //如果本地没有匿名用户dua_id，那么就要触发born.触发born后login动作退出，希望用户下一次继续点击.
                if (duaLocalStorage.anonymousDuaid == null) {
                    console.info("dua_id is null. go to born()");
                    this.born().then(null, null, null)
                } else {
                    //如果本地有匿名dua_id,那么直接发送注册
                    regUser.dua_id = duaLocalStorage.anonymousDuaid;
                    $http.post(self.serverUrl + "/users", regUser)
                        .success(function (response) {
                            /*登陆成功的动作*/
                            if (response.status == "ok") {
                                duaLocalStorage = JSON.parse(localStorage.getItem("duaLocalStorage"));
                                duaLocalStorage.currentDuaid = response.dua_id;
                                localStorage.setItem("duaLocalStorage", JSON.stringify(duaLocalStorage));
                                deferred.resolve(response);
                            } else {
                                deferred.reject(response);
                            }
                        }).error(function (error) { deferred.reject(error); });
                }
                return deferred.promise;
            },
            addRats: function () {
                var deferred = $q.defer();
                AppList.getAppList(suc, err);
                return deferred.promise;
                function suc(list) {
                    //console.info(list);
                    var msg = {};
                    msg.action = "add_rats";
                    msg.dua_id = service.getCurrentDuaid();
                    msg.data = list;
                    $http({
                        method: 'POST',
                        url: self.serverUrl + "/apps",
                        data: msg,
                        timeout: 10000,
                    }).then(onSuccess, onErr);
                    function onSuccess(res) {
                        if (res.data.status == "ok") deferred.resolve(new Date().getTime()/1000);
                        else deferred.reject("上传失败，原因："+JSON.stringify(res));
                    }
                    function onErr(reason) {
                        deferred.reject("上传失败，服务器或网络出错");
                    }
                }
                function err(reason) {
                    deferred.reject("获取安装应用列表失败："+JSON.stringify(reason));
                }
            },

            /*根据本地存储的currentDuaid去服务器上查看有没有rule的权限
            或者服务器不在登录状态，那么就返回失败*/
            auth: function (rule) {
                var deferred = $q.defer();
                duaLocalStorage = JSON.parse(localStorage.getItem("duaLocalStorage"));
                //如果本地没有匿名用户dua_id，那么就要触发born.触发born后login动作退出，希望用户下一次继续点击.
                if (duaLocalStorage.currentDuaid == null) {
                    deferred.reject("current dua id doesnt exist");
                } else {
                    //如果本地有curretnDuaid,那么直接验证
                    var msg = {};
                    msg.dua_id = duaLocalStorage.currentDuaid;
                    msg.action = "dua_auth";
                    msg.rule = rule;
                    console.info(JSON.stringify(msg));
                    $http.post(self.serverUrl + "/duas", msg)
                        .success(function (result) {
                            if (result.status == "ok") {
                                deferred.resolve(result);
                            } else {//{status="no",reason="***"}
                                deferred.reject(JSON.stringify(result));
                            }
                        }).error(function (reason) { deferred.reject(reason); });
                }
                return deferred.promise;
            },
            getStorage: function (key) {
                var deferred = $q.defer();
                var msg = {};
                msg.dua_id = service.getCurrentDuaid();
                msg.action = "get";
                msg.key = key;
                $http.post(self.serverUrl + "/uas", msg)
                .success(function (result) {
                    if (result.status == "ok") {
                        deferred.resolve(result.data);
                    } else {//{status="no",reason="***"}
                        deferred.reject(result.reason);
                    }
                }).error(function (reason) { deferred.reject(reason); });
                return deferred.promise;
            },
            setStorage: function (key,data) {
                var deferred = $q.defer();
                var msg = {};
                msg.dua_id = service.getCurrentDuaid();
                msg.action = "set";
                msg.key = key;
                msg.data = data;
                $http.post(self.serverUrl + "/uas", msg)
                .success(function (result) {
                    if (result.status == "ok") {
                        deferred.resolve(result);
                    } else {//{status="no",reason="***"}
                        deferred.reject(result.reason);
                    }
                }).error(function (reason) { deferred.reject(reason); });
                return deferred.promise;
            },
            getCurUser: function () {
                if (!curUser) {
                    service.getStorage("userProfile").then(suc, null);
                    function suc(data) {
                        curUser = data;
                    }
                }
                return curUser;
            },
        }
        return service;

        function scanDevices() {
            wlds.length = 0;
            location.lon = 0;
            location.lat = 0;
            location.acc = 0;
            location.time = 0;
            console.info("scanDevices is called at " + new Date().toLocaleString());
            var q = $q.defer();

            var timeout = getSettings('gpsTimeout',10000);
            var options = { maximumAge: 3000, timeout: timeout, enableHighAccuracy: true };

            $cordovaGeolocation.watchPosition(options).then(null, function (reason) {
                console.error(JSON.stringify(reason));
            }, function (obj) {
                location.lon = obj.coords.longitude;
                location.lat = obj.coords.latitude;
                location.acc = obj.coords.accuracy;
                location.time = new Date().getTime();
            })
            //扫描基站
            LBS.getNCI(scanCellSuccess, err);
            function scanCellSuccess(cellList) {
                for (var i = 0; i < cellList.length; i++) {
                    var cell = cellList[i];
                    var type = 'T';/*type:CELL*/
                    var id = cell.mcc + ":" + cell.mnc + ":" + cell.lac + ":" + cell.cid;/*id:string*/
                    var name = "N/A";
                    var dbm = cell.dbm;
                    var reg = cell.reg;
                    wlds.push(new wld(type, id, name, dbm, reg));
                }
            }
            //扫描wifi
            WifiWizard.getScanResults(wifis, err);
            function wifis(wifiList) {
                WifiWizard.getCurrentBSSID(succ, fail);
                function succ(bssid) {
                    for (var i = 0; i < wifiList.length; i++) {
                        var wifi = wifiList[i];
                        var type = 'F';/*type:WIFI*/
                        var id = wifi.BSSID;/*id:string*/
                        var name = wifi.SSID;
                        var dbm = wifi.level;
                        var reg = (id == bssid ? 1 : 0);

                        wlds.push(new wld(type, id, name, dbm, reg));
                    }
                }
                function fail(reason) {
                    console.error(JSON.stringify(reason));
                    for (var i = 0; i < wifiList.length; i++) {
                        var wifi = wifiList[i];
                        var type = 'F';/*type:WIFI*/
                        var id = wifi.BSSID;/*id:string*/
                        var name = wifi.SSID;
                        var dbm = wifi.level;
                        var reg = 0;

                        wlds.push(new wld(type, id, name, dbm, reg));
                    }
                }
            }

            //扫描蓝牙
            var bleTimeout = getSettings('bleTimeout', 6);
            $cordovaBLE.scan([], bleTimeout).then(null, err, find);
            function find(ble) {
                if (!ble.hasOwnProperty("name")) ble.name = "N/A";
                var type = 'B';/*type:BLE*/
                var id = ble.id;/*id:string*/
                var name = ble.name;
                var dbm = ble.rssi;
                var reg = 0;//FIXME:增加reg判断

                wlds.push(new wld(type, id, name, dbm, reg));
            }

            var promiseTimeout = getSettings('promiseTimeout', 6000);
            $timeout(function () {
                console.info("scanDevices is completed at " + new Date().toLocaleString());
                q.resolve("ok");
            }, promiseTimeout);
            return q.promise;
        }
        function err(error) {
            //console.error(JSON.stringify(error));
                $ionicPopup.alert({
                    title: "操作失败",
                    template: JSON.stringify(error)
                });
        }

        function wld(type, id, name, dbm, reg) {
            this.type = type;
            this.id = id;
            this.name = name;
            this.dbm = dbm;
            this.reg = reg;
        }

        function getSettings(name, defaultValue) {
            var item = localStorage.getItem(name);
            if (item == null) {
                item = defaultValue;
            }
            return item;
        }

    }
})