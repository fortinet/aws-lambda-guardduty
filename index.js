'use strict';

/*
Author: Fortinet

The following Lambda function will be called in CloudWatch when GuardDuty sends logs to CloudWatch.
This script will write the malicious IP to a dedicate file in S3 bucket.
Firewall service (i.e. FortiOS) can pull this list, and add those malicious IPs to the blacklist.

Currently the script has the following configurations (By environment variable):

MIN_SEVERITY: (integer only)
S3_BLOCKLIST_KEY: (path to the file)
S3_BUCKET: (S3 bucket name)
REGION: (AWS region)
DDB_TABLE_NAME: (DynamoDB table to store ip)

Required IAM permissions:
S3: ListBucket, HeadBucket, GetObject, PutObject, PutObjectAcl
DynamoDB: DescribeStream, ListStreams, Scan, GetShardIterator, GetRecords, UpdateItem

The script will report the IP for the following conditions:

1. For inbound connection direction, if severity is greater than or equal to MIN_SEVERITY
2. For unknown connection direction, if the IP was flagged in the threat list name

** This script will only focus on the external attack, internal attack won't get reported.
Therefore, only remote IP will be stored to black list.

*/

const ObjectUtils = require('./utils/ObjectUtils.js');
var script = null;
// process event and route to a proper handler script such as monitor.js or generator.js
const index = (event, context, callback) => {
    const serviceName = ObjectUtils.fetch(event, 'detail/service/serviceName') || null,
        records = ObjectUtils.fetch(event, 'Records') || null;
    if (serviceName === 'guardduty') {
        // route to monitor.js
        console.log('calling monitor script.');
        script = require('./monitor');
        script.handler.call(null, event, context, callback);
    } else if (records !== null) {
        // route to generator.js
        console.log('calling generator script.');
        script = require('./generator');
        script.handler.call(null, event, context, callback);
    } else {
        console.log('No matched script to run. Function exits.');
        callback('Invalid event.');
    }
};

exports.handler = index;
