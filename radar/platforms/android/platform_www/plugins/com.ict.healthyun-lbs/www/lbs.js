cordova.define("com.ict.healthyun-lbs.lbs", function(require, exports, module) { var cordova = require('cordova');

var LBS = function() {};

LBS.prototype.getNCI = function (success, error) {
    cordova.exec(success, error, 'LBS', 'getNCI', []);
};

var lbs = new LBS();
module.exports = lbs;
});
