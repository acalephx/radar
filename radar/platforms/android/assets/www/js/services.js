angular.module('radar.services',['ngCordova'])
.provider('WIRELESS', function () {
    this.serverUrl = "";
    this.setServerUrl = function (newUrl) {
        this.serverUrl = newUrl;
    }
    this.autoScan = false;
    this.changeSwitch = function (bl) {
        this.autoScan = bl;
    }
    this.$get = function ($http, $cordovaSQLite, $cordovaBLE, $cordovaGeolocation,$ionicPlatform) {
        var self = this;
        var db;
        var records = {};
        records.location = {longitude:0.0,latitude:0.0,accuracy:0};
        records.data = new Array();
        //如果这个设备存在在recordes里，那么更新records,更新后state=1
        //如果不存在，那么创建一个空record,赋值，注意，isdirty=1,然后存入
        //在结尾的时候，把records数组遍历一下：如果state=0,那么是没动的，1：更新的，2:新添加的。
        records.update = function (type, id, name, dbm, reg,time) {
            var date = new Date();
            var h = date.getHours();
            var m = date.getMinutes();
            var tp = h * 4 + Math.ceil(m / 15) - 1;
            //计算dbmInex
            var dbmIndex = dbm + 100 - 1;
            if (dbmIndex < 0) dbmIndex = 0;
            if (dbmIndex > 99) dbmIndex = 99;

            var index = indexOfArray(type, id, records.data);

            if (index == -1) {
                var dbmMask = new filledArray(0, 100);//初始化一个长度为100的数组，填满0.
                var regMask = new filledArray(0, 96); //初始化一个长度为 96的数组，填满0.
                var smpMask = new filledArray(0, 96);
                dbmMask[dbmIndex] += 1;
                regMask[tp] += reg;
                smpMask[tp] += 1;
                var img = getImg(type, 1, reg);  //能扫描出来说明ava是1,
                var wgt = getWgt(dbm, type, 1, reg);
                var rec = new record(type, id, name, dbm, dbmMask, reg, regMask, 1, smpMask, 2/*2:new*/, 1, reg, img, wgt,time);
                records.data.push(rec);
            } else {
                var rec = records.data[index];
                var img = getImg(type, 1, reg);
                var wgt = getWgt(dbm, type, 1, reg);

                rec.dbm = Math.round((rec.dbm * rec.smp + dbm) / (rec.smp + 1));
                rec.dbmMask[dbmIndex] += 1;
                rec.reg += reg;     //传进来的reg只会是0或1，但rec.reg是大于0的历史连接次数
                rec.regMask[tp] += reg;
                rec.smp += 1;
                rec.smpMask[tp] += 1;

                rec.ava = 1;
                rec.con = reg;
                rec.img = img;
                rec.wgt = wgt;
                rec.time = time;
                if (rec.state == 0) rec.state = 1;
            }
        }
        //遍历records.data数组，对state为0或2的数据添加入数据库和更新。
        records.flush = function () {
            var data = records.data;
            for (var i = 0; i < data.length; i++) {
                var rec = data[i];
                if (rec.state == 2)  //数据库中的state与内存中的相似，但意义不同
                {
                    var query = "INSERT INTO wireless (type,id,name,dbm,dbmMask,reg,regMask,smp,smpMask,state) VALUES(?,?,?,?,?,?,?,?,?,?)";
                    $cordovaSQLite.execute(db, query, [rec.type, rec.id, rec.name, rec.dbm, rec.dbmMask, rec.reg,
                        rec.regMask, rec.smp, rec.smpMask, 2]).then(null, err);
                }
                if (rec.state == 1) {
                    var query = "UPDATE wireless SET name=?,dbm=?,dbmMask=?,reg=?,regMask=?,smp=?,smpMask=? ,state = ? WHERE type=? AND id=?";
                    $cordovaSQLite.execute(db, query, [rec.name, rec.dbm, rec.dbmMask, rec.reg,
                        rec.regMask, rec.smp, rec.smpMask, 1, rec.type, rec.id]).then(null, err);
                }
            }
        }
        //遍历records.data数组，把所有wld的ava重置为0.
        var intervalScan = null;//整个周期扫描的Interval
        var service = {
            //启动扫描无线环境的服务，这个服务周期型的扫描无线环境，更新数据库，上传到服务器。
            startService: function () {
                console.info("WIRELESS service start!");
                //如果没有数据库，创建对应的数据库和表
                db = $cordovaSQLite.openDB({ name: 'healthyun.db' });
                //$cordovaSQLite.execute(db, "DROP TABLE IF EXISTS wireless");
                $cordovaSQLite.execute(db, "CREATE TABLE IF NOT EXISTS wireless (inc integer primary key, type integer,\
                    id string UNIQUE,name string,dbm real,dbmMask text,reg int,regMask text,smp int,smpMask text,state int)");
                //把数据库里存储的无线环境取出来，并且用一个循环把每个wld.ava都重置为0
                var query = "SELECT * FROM wireless";
                if (db != null) $cordovaSQLite.execute(db, query, []).then(suc, fail);
                function suc(res) {
                    for (var i = 0; i < res.rows.length; i++) {
                        var dbitem = res.rows.item(i);
                        var img = getImg(dbitem.type, 0, 0);
                        var wgt = getWgt(dbitem.dbm, dbitem.type, 0, 0);
                        var rec = new record(
                            dbitem.type,
                            dbitem.id,
                            dbitem.name,
                            dbitem.dbm,
                            strToAry(dbitem.dbmMask),
                            dbitem.reg,
                            strToAry(dbitem.regMask),
                            dbitem.smp,
                            strToAry(dbitem.smpMask),
                            0,   //state
                            0,   //ava
                            0,   //con
                            img,
                            wgt
                            );
                        records.data.push(rec);
                    }
                    console.info("get " + res.rows.length + " sqlite data complete at " + new Date().toLocaleString());
                    if (self.autoScan) {
                        service.startScan();
                    }
                }
                function fail(reason) {
                    console.error(JSON.stringify(reason));
                    if (self.autoScan) {
                        service.startScan();
                    }
                }
            },
            startScan: function () {
                //开始启动无线环境的扫描,每5分钟扫描一次,必须保证scanDevices里的蓝牙扫描delay小于这个300.
                scanDevices();
                if (intervalScan == null) {
                    intervalScan = setInterval(function () {
                        //除第一次外，每次扫描前将所有展示状态设为默认。
                        resetAllrec();
                        scanDevices();
                    }, 300000);
                }
            },
            stopScan: function () {
                //关闭扫描计时器
                if (intervalScan != null) {
                    clearInterval(intervalScan);
                    intervalScan = null;
                }
                resetAllrec();
            },
            stopService: function () {
                console.info("all new and updated wireless device are stored into db");
                //把records里的dirty数据刷回数据库
                records.flush();
                //释放records
                records.data.length = 0;
                //TODO:关闭数据库
            },
            getRecords: function () {
                return records.data;
            },
            getRecord: function (index) {
                return records.data[index];
            },
            getLocation:function(){
                return records.location;
            }
        };
        return service;

        function scanDevices(/*cellDelay, wifiDelay, btDelay*/) {
            console.info("scanDevices is called at " + new Date().toLocaleString());
            //在cordova中用$cordovaGeolocation来定位的时候，总是有timeout错误。我们搜来搜去，成功了，原因竟然是，要在安装app后重启一下手机。
            //其它的环境配置有可能也要理睬
            //1:  enableHighAccuracy设为false更容易成功
            //2:  在手机的设置中，Go to Settings -> Location and security -> Use networks; and active it. I have passed all the afternoon watching the problem and it was that.
            //3:  在$ionicPlatform.ready里面写
            //4： 参考：https://forum.ionicframework.com/t/geolocation-cordova-android-plugin-does-not-work/27020/4
            $ionicPlatform.ready(function () {
                var options = { maximumAge: 30000, timeout: 50000, enableHighAccuracy: true };
                $cordovaGeolocation.watchPosition(options).then(null, function (reason) {
                    console.error(JSON.stringify(reason));
                }, function (obj) {
                    //records.location = angular.copy(obj.coords);
                    records.location.longitude = obj.coords.longitude;
                    
                })
            });
            //扫描基站
            LBS.getNCI(scanCellSuccess, err);
            function scanCellSuccess(cellList) {
                var time = new Date().getTime();
                for (var i = 0; i < cellList.length; i++) {
                    var cell = cellList[i];
                    var type = 0;/*type:CELL*/
                    var id = cell.mcc + ":" + cell.mnc + ":" + cell.lac + ":" + cell.cid;/*id:string*/
                    var name = "N/A";
                    var dbm = cell.dbm;
                    var reg = cell.reg;
                    records.update(type, id, name, dbm, reg,time);
                }
            }
            //扫描wifi
            WifiWizard.getScanResults(wifis, err);
            function wifis(wifiList) {
                var time = new Date().getTime();
                WifiWizard.getCurrentBSSID(succ, fail);
                function succ(bssid) {
                    for (var i = 0; i < wifiList.length; i++) {
                        var wifi = wifiList[i];
                        var type = 1;/*type:WIFI*/
                        var id = wifi.BSSID;/*id:string*/
                        var name = wifi.SSID;
                        var dbm = wifi.level;
                        var reg = (id == bssid ? 1 : 0);
                        if (name == null) name = "N/A";
                        records.update(type, id, name, dbm, reg,time);
                    }
                }
                function fail(reason) {
                    console.error(JSON.stringify(reason));
                    for (var i = 0; i < wifiList.length; i++) {
                        var wifi = wifiList[i];
                        var type = 1;/*type:WIFI*/
                        var id = wifi.BSSID;/*id:string*/
                        var name = wifi.SSID;
                        var dbm = wifi.level;
                        var reg = 0;
                        records.update(type, id, name, dbm, reg,time);
                    }
                }
            }

            //扫描蓝牙
            $cordovaBLE.scan([], 6).then(null, err, find);
            function find(ble) {
                var time = new Date().getTime();
                if (!ble.hasOwnProperty("name")) ble.name = "N/A";
                var type = 2;/*type:BLE*/
                var id = ble.id;/*id:string*/
                var name = ble.name;
                var dbm = ble.rssi;
                var reg = Math.round(Math.random());//FIXME:增加reg判断
                records.update(type, id, name, dbm, reg,time);
            }
        }
        function err(error) {
            console.error(JSON.stringify(error));
        }
        function indexOfArray(t, id, a) {
            var index = -1;
            for (var i = 0; i < a.length; i++) {
                var obj = a[i];
                if (obj.type == t && obj.id == id) {
                    index = i;
                    break;
                }
            }
            return index;
        }
        function record(type, id, name, dbm, dbmMask, reg, regMask, smp, smpMask, state, ava, con, img, wgt,time) {
            this.type = type;
            this.id = id;
            this.name = name;
            this.dbm = dbm;
            this.dbmMask = dbmMask;//长度为100的数组，范围表达为-99~0。共100个数。超出则被截平。dbmMask[0]=-99
            this.reg = reg;//数据库中reg是历史连接次数，而扫描出来时单个记录的reg是指当前是否连接
            this.regMask = regMask;
            this.smp = smp;
            this.smpMask = smpMask;
            this.state = state;
            //在客户端内存中：0:从数据库里读出来的，没有修改过。1：从数据库读出来的，修改过。2：数据库里没有，新添加的。
            //在客户端数据库：0:与服务器同步，没有修改过1：服务器有copy，修改过。。2：服务器没有，新添加的。
            //接下来的ava和img都是
            this.ava = ava;
            this.con = con;
            this.img = img;
            this.wgt = wgt;
            this.time = time;   //最后一次扫描的时间戳
            return this;
        }
        function filledArray(value, length) {
            var ary = new Array();
            for (var i = 0; i < length; i++) {
                ary.push(value);
            }
            return ary;
        }
        function getImg(type, ava, con) { //此reg是新扫描出来的，只能是0或1，不能是数据库取出的。
            var imgUrl = '';
            switch (type) {
                case 0: {
                    imgUrl = ava == 0 ? 'img/wld/cell_invisible.png' : con == 1 ? 'img/wld/cell_registered.png' : 'img/wld/cell_visible.png';
                    break;
                }
                case 1: {
                    imgUrl = ava == 0 ? 'img/wld/wifi_invisible.png' : con == 1 ? 'img/wld/wifi_registered.png' : 'img/wld/wifi_visible.png';
                    break;
                }
                case 2: {
                    imgUrl = ava == 0 ? 'img/wld/bluetooth_invisible.png' : con == 1 ? 'img/wld/bluetooth_registered.png' : 'img/wld/bluetooth_visible.png';
                    break;
                }
            }
            return imgUrl;
        }
        function getWgt(dbm, type, ava, con) {
            var wgt = -dbm;
            switch (type) {
                case 0: {
                    wgt += ava == 0 ? 600 : con == 1 ? 0 : 300;
                    break;
                }
                case 1: {
                    wgt += ava == 0 ? 700 : con == 1 ? 100 : 400;
                    break;
                }
                case 2: {
                    wgt += ava == 0 ? 800 : con == 1 ? 200 : 500;
                    break;
                }
            }
            return wgt;
        }
        function resetPresentation(rec) {
            rec.ava = 0;
            rec.con = 0;
            rec.img = getImg(rec.type, 0, 0);
            rec.wgt = getWgt(rec.dbm, rec.type, 0, 0);
        }
        function resetAllrec() {
            for (var i = 0; i < records.data.length; i++) {
                resetPresentation(records.data[i]);
            }
        }
        function strToAry(str) {
            return JSON.parse("[" + str + "]");
        }
    }
})