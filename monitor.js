'use strict';

/*
Author: Fortinet

The following Lambda function will be called in CloudWatch when GuardDuty sends logs to CloudWatch.
This script will write the malicious IP to a dedicate file in S3 bucket. Firewall service (i.e. FortiOS) can
pull this list, and add those malicious IPs to the blacklist.

Currently the script has the following configurations (By environment variable):

MIN_SEVERITY: (integer only)
S3_BLACKLIST_KEY: (path to the file)
S3_BUCKET: (S3 bucket name)

The script will report the IP for the following conditions:

1. For inbound connection direction, if severity is greater than or equal to MIN_SEVERITY
2. For unknown connection direction, if the IP was flagged in the threat list name

** This script will only focus on the external attack, internal attack won't get reported.
Therefore, only remote IP will be stored to black list.

*/


require('extension/object_extension.js');

var monitor = function() {

  const
    _q = require('q'),
    _aws = require('aws-sdk'),
    _s3 = new _aws.S3(),
    _s3_param = {
        Bucket : process.env.S3_BUCKET,
        Key : process.env.S3_BLACKLIST_KEY
    };

  var
    _found = 0,
    _added = 0,
    _resp = [],
    _s3_get = function() {
        var deferred = _q.defer();
        _s3.getObject(_s3_param, function(error, data) {
            if (error) {
                deferred.reject(error);
            } else {
                deferred.resolve(data);
            }
        });

        return deferred.promise;
    },
    _s3_put = function(data) {
        var tmp_param = Object.assign({}, _s3_param);
        var deferred = _q.defer();

        tmp_param.Body = data;
        tmp_param.ACL = 'public-read';
        tmp_param.ContentType = 'text/plain';

        _s3.putObject(tmp_param, function(error, data) {
            if (error) {
                deferred.reject(error);
            } else {
                deferred.resolve(data);
            }
        });

        return deferred.promise;
    },
    _set_resp = function(msg, detail) {
        _resp.push({
            msg: msg,
            detail: detail
        });
    },
    _unset_resp = function() {
        _resp = [];
    },

    _build_ip_list = function(blacklist, ip) {
        _found = [];
        _added = [];
        var out = '';
        if (ip) {
            if (ip && blacklist.indexOf(ip) < 0) {
                blacklist += ip + "\r";
                _added.push(ip);
                _found.push(ip);
            } else if (ip) {
                _found.push(ip);
            }
        }
        return blacklist;
    },

    handler = function(event, context, handler_cb) {
        var min_severity = process.env.MIN_SEVERITY || 3,
            detail = event.fetch('detail') || {},
            ip = detail.fetch('service/action/networkConnectionAction/remoteIpDetails/ipAddressV4'),
            direction = detail.fetch('service/action/networkConnectionAction/connectionDirection'),
            threat_list_name = detail.fetch('service/additionalInfo/threatListName'),
            blacklist = null;

        _unset_resp();

        if (!ip) {

            _set_resp('IP not found', null);
            handler_cb(null, _resp);

        } else if(direction == 'OUTBOUND') {

            _set_resp('Ignore OUTBOUND connection', null);
            handler_cb(null, _resp);

        } else if(direction == 'UNKNOWN' && !threat_list_name) {

            _set_resp('Ignore UNKNOWN connection due to undefined threat list name', null);
            handler_cb(null, _resp);

        } else if (detail.severity >= min_severity) {

            _s3_get()
            .then(
                function(data) {
                    blacklist = _build_ip_list(data.Body.toString('ascii'), ip);
                },
                function(error) {
                    if (error.fetch('statusCode') === 404) {
                        blacklist = _build_ip_list('', ip);
                        _set_resp('Create new blacklist.', null);
                    } else {
                        _set_resp('Get blacklist error.', error);
                    }
                }
            ).then(
                function() {
                    return _s3_put(blacklist);
                }
            ).then(
                function(data) {

                    var msg = _found.length + ' IP addresses found, and '
                            + _added.length + ' new IP addresses have been added to blacklist.';

                    _set_resp(msg, {
                        found: _found,
                        added: _added,
                        event: event
                    });
                },
                function(error) {
                    _set_resp('Put blacklist error', error);
                }
            ).done(function() {
                console.log(JSON.stringify(_resp));
                handler_cb(null, _resp);
            });
        } else {

            _set_resp('Ignore due to severity less than ' + min_severity, null);
            handler_cb(null, _resp);
        }
    };

    return {
        handler: handler
    };
}();

exports.handler = monitor.handler;

