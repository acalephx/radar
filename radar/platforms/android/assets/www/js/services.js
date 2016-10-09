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
        //�������豸������recordes���ô����records,���º�state=1
        //��������ڣ���ô����һ����record,��ֵ��ע�⣬isdirty=1,Ȼ�����
        //�ڽ�β��ʱ�򣬰�records�������һ�£����state=0,��ô��û���ģ�1�����µģ�2:����ӵġ�
        records.update = function (type, id, name, dbm, reg,time) {
            var date = new Date();
            var h = date.getHours();
            var m = date.getMinutes();
            var tp = h * 4 + Math.ceil(m / 15) - 1;
            //����dbmInex
            var dbmIndex = dbm + 100 - 1;
            if (dbmIndex < 0) dbmIndex = 0;
            if (dbmIndex > 99) dbmIndex = 99;

            var index = indexOfArray(type, id, records.data);

            if (index == -1) {
                var dbmMask = new filledArray(0, 100);//��ʼ��һ������Ϊ100�����飬����0.
                var regMask = new filledArray(0, 96); //��ʼ��һ������Ϊ 96�����飬����0.
                var smpMask = new filledArray(0, 96);
                dbmMask[dbmIndex] += 1;
                regMask[tp] += reg;
                smpMask[tp] += 1;
                var img = getImg(type, 1, reg);  //��ɨ�����˵��ava��1,
                var wgt = getWgt(dbm, type, 1, reg);
                var rec = new record(type, id, name, dbm, dbmMask, reg, regMask, 1, smpMask, 2/*2:new*/, 1, reg, img, wgt,time);
                records.data.push(rec);
            } else {
                var rec = records.data[index];
                var img = getImg(type, 1, reg);
                var wgt = getWgt(dbm, type, 1, reg);

                rec.dbm = Math.round((rec.dbm * rec.smp + dbm) / (rec.smp + 1));
                rec.dbmMask[dbmIndex] += 1;
                rec.reg += reg;     //��������regֻ����0��1����rec.reg�Ǵ���0����ʷ���Ӵ���
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
        //����records.data���飬��stateΪ0��2��������������ݿ�͸��¡�
        records.flush = function () {
            var data = records.data;
            for (var i = 0; i < data.length; i++) {
                var rec = data[i];
                if (rec.state == 2)  //���ݿ��е�state���ڴ��е����ƣ������岻ͬ
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
        //����records.data���飬������wld��ava����Ϊ0.
        var intervalScan = null;//��������ɨ���Interval
        var service = {
            //����ɨ�����߻����ķ���������������͵�ɨ�����߻������������ݿ⣬�ϴ�����������
            startService: function () {
                console.info("WIRELESS service start!");
                //���û�����ݿ⣬������Ӧ�����ݿ�ͱ�
                db = $cordovaSQLite.openDB({ name: 'healthyun.db' });
                //$cordovaSQLite.execute(db, "DROP TABLE IF EXISTS wireless");
                $cordovaSQLite.execute(db, "CREATE TABLE IF NOT EXISTS wireless (inc integer primary key, type integer,\
                    id string UNIQUE,name string,dbm real,dbmMask text,reg int,regMask text,smp int,smpMask text,state int)");
                //�����ݿ���洢�����߻���ȡ������������һ��ѭ����ÿ��wld.ava������Ϊ0
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
                //��ʼ�������߻�����ɨ��,ÿ5����ɨ��һ��,���뱣֤scanDevices�������ɨ��delayС�����300.
                scanDevices();
                if (intervalScan == null) {
                    intervalScan = setInterval(function () {
                        //����һ���⣬ÿ��ɨ��ǰ������չʾ״̬��ΪĬ�ϡ�
                        resetAllrec();
                        scanDevices();
                    }, 300000);
                }
            },
            stopScan: function () {
                //�ر�ɨ���ʱ��
                if (intervalScan != null) {
                    clearInterval(intervalScan);
                    intervalScan = null;
                }
                resetAllrec();
            },
            stopService: function () {
                console.info("all new and updated wireless device are stored into db");
                //��records���dirty����ˢ�����ݿ�
                records.flush();
                //�ͷ�records
                records.data.length = 0;
                //TODO:�ر����ݿ�
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
            //��cordova����$cordovaGeolocation����λ��ʱ��������timeout��������������ȥ���ɹ��ˣ�ԭ��Ȼ�ǣ�Ҫ�ڰ�װapp������һ���ֻ���
            //�����Ļ��������п���ҲҪ���
            //1:  enableHighAccuracy��Ϊfalse�����׳ɹ�
            //2:  ���ֻ��������У�Go to Settings -> Location and security -> Use networks; and active it. I have passed all the afternoon watching the problem and it was that.
            //3:  ��$ionicPlatform.ready����д
            //4�� �ο���https://forum.ionicframework.com/t/geolocation-cordova-android-plugin-does-not-work/27020/4
            $ionicPlatform.ready(function () {
                var options = { maximumAge: 30000, timeout: 50000, enableHighAccuracy: true };
                $cordovaGeolocation.watchPosition(options).then(null, function (reason) {
                    console.error(JSON.stringify(reason));
                }, function (obj) {
                    //records.location = angular.copy(obj.coords);
                    records.location.longitude = obj.coords.longitude;
                    
                })
            });
            //ɨ���վ
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
            //ɨ��wifi
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

            //ɨ������
            $cordovaBLE.scan([], 6).then(null, err, find);
            function find(ble) {
                var time = new Date().getTime();
                if (!ble.hasOwnProperty("name")) ble.name = "N/A";
                var type = 2;/*type:BLE*/
                var id = ble.id;/*id:string*/
                var name = ble.name;
                var dbm = ble.rssi;
                var reg = Math.round(Math.random());//FIXME:����reg�ж�
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
            this.dbmMask = dbmMask;//����Ϊ100�����飬��Χ���Ϊ-99~0����100�����������򱻽�ƽ��dbmMask[0]=-99
            this.reg = reg;//���ݿ���reg����ʷ���Ӵ�������ɨ�����ʱ������¼��reg��ָ��ǰ�Ƿ�����
            this.regMask = regMask;
            this.smp = smp;
            this.smpMask = smpMask;
            this.state = state;
            //�ڿͻ����ڴ��У�0:�����ݿ���������ģ�û���޸Ĺ���1�������ݿ�������ģ��޸Ĺ���2�����ݿ���û�У�����ӵġ�
            //�ڿͻ������ݿ⣺0:�������ͬ����û���޸Ĺ�1����������copy���޸Ĺ�����2��������û�У�����ӵġ�
            //��������ava��img����
            this.ava = ava;
            this.con = con;
            this.img = img;
            this.wgt = wgt;
            this.time = time;   //���һ��ɨ���ʱ���
            return this;
        }
        function filledArray(value, length) {
            var ary = new Array();
            for (var i = 0; i < length; i++) {
                ary.push(value);
            }
            return ary;
        }
        function getImg(type, ava, con) { //��reg����ɨ������ģ�ֻ����0��1�����������ݿ�ȡ���ġ�
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