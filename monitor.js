'use strict';

/*
Author: Fortinet

This monitor script handles the reporting and logging part of the Lambda function.
Information about the Lambda function and configuration is provided in the main script: index.js.

Required IAM permissions:
DynamoDB: UpdateItem

*/
const objectUtils = require('./utils/ObjectUtils.js'),
    respArr = [];

let docClient = null;

/*
 * set response for callback
 */
const setResp = (msg, detail) => {
    respArr.push({
        msg: msg,
        detail: detail
    });
};

/*
 * clear response for callback
 */
const unsetResp = () => {
    respArr.length = 0;
};

// updating ip address information into DynamoDB
const updateDBTable = (findingId, ip, lastSeen) => {
    return new Promise((resolve, reject) => {
        let params = {
            TableName: process.env.DDB_TABLE_NAME,
            Key: {
                finding_id: findingId,
                ip: ip
            },
            ExpressionAttributeNames: {
                '#last_seen': 'last_seen'
            },
            ExpressionAttributeValues: {
                ':last_seen': lastSeen,
                ':n_one': 1
            },
            UpdateExpression: 'SET #last_seen = :last_seen ADD detection_count :n_one'
        };

        docClient.update(params, function(err, data) {
            if (err) {
                console.log('called updateDBTable and returned with error:', err.stack);
                reject('Unable to Update ip into DynamoDB Table.');
            } else {
                console.log(
                    'called updateDBTable: ' + `finding entry (${findingId}) updated into DB.`
                );
                resolve(data);
            }
        });
    });
};

exports.handler = async (event, context, callback) => {
    const AWS = require('aws-sdk');
    // locking API versions
    AWS.config.apiVersions = {
        lambda: '2015-03-31',
        s3: '2006-03-01',
        dynamodb: '2012-08-10',
        dynamodbstreams: '2012-08-10'
    };

    unsetResp();

    // verify all required process env variables
    // check and set AWS region
    if (!process.env.REGION) {
        setResp('Must specify an AWS region.', null);
        callback(null, respArr);
        return;
    }

    if (!process.env.DDB_TABLE_NAME) {
        setResp('Must specify an AWS DB Table name.', null);
        callback(null, respArr);
        return;
    }

    AWS.config.update({
        region: process.env.REGION
    });

    docClient = new AWS.DynamoDB.DocumentClient();

    const minSeverity = process.env.minSeverity || 3,
        detail = objectUtils.fetch(event, 'detail') || {},
        ip = objectUtils.fetch(
            detail,
            'service/action/networkConnectionAction/remoteIpDetails/ipAddressV4'
        ),
        direction = objectUtils.fetch(
            detail,
            'service/action/networkConnectionAction/connectionDirection'
        ),
        threatListName = objectUtils.fetch(detail, 'service/additionalInfo/threatListName'),
        findingId = objectUtils.fetch(event, 'id'),
        lastSeen = objectUtils.fetch(detail, 'service/eventLastSeen');

    if (!ip) {
        setResp('IP not found', null);
        callback(null, respArr);
    } else if (direction === 'OUTBOUND') {
        setResp('Ignore OUTBOUND connection', null);
        callback(null, respArr);
    } else if (direction === 'UNKNOWN' && !threatListName) {
        setResp('Ignore UNKNOWN connection due to undefined threat list name', null);
        callback(null, respArr);
    } else if (detail.severity >= minSeverity) {
        try {
            await updateDBTable(findingId, ip, lastSeen);
            setResp(`finding entry (${findingId}) updated into DB.`, null);
        } catch (err) {
            setResp(
                "There's a problem in updating ip to the DB. Please" +
                    ' see detailed information in CloudWatch logs.',
                null
            );
        } finally {
            callback(null, respArr);
        }
    } else {
        setResp(`Ignore due to severity less than ${minSeverity}`, null);
        callback(null, respArr);
    }
};
