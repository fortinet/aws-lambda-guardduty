'use strict';

/*
Author: Fortinet

This generator script handles the creation of the static ip block list resource in the S3 bucket.
Information about the Lambda function and configuration is provided in the main script: index.js.

Required IAM permissions:
S3: ListBucket, HeadBucket, GetObject, PutObject, PutObjectAcl
DynamoDB: Scan

*/
const respArr = [];

let S3 = null,
    docClient = null;

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

/*
 * check if bucket exists
 */
const bucketExists = () => {
    return new Promise((resolve, reject) => {
        let params = {
            Bucket: process.env.S3_BUCKET
        };
        // eslint-disable-next-line no-unused-vars
        S3.headBucket(params, function(err, data) {
            if (err) {
                console.log('called bucketExists and return error: ', err.stack);
                reject(err);
            } else {
                console.log('called bucketExists: no error.'); // successful response
                resolve(params.Bucket);
            }
        });
    });
};

/*
 * scan the ip block list table and return a set of ip block list
 * return a promise to resolve a list of the table items.
 */
const scanDBTable = () => {
    return new Promise((resolve, reject) => {
        let params = {
            TableName: process.env.DDB_TABLE_NAME
        };
        docClient.scan(params, function(err, data) {
            if (err) {
                console.log('call scanDBTable: return error', err.stack);
                reject(err);
            } else {
                console.log('called scanDBTable: scan completed.');
                resolve(data.Items);
            }
        });
    });
};

/*
 * get the block list file
 */
const getBlockListFile = () => {
    return new Promise((resolve, reject) => {
        S3.getObject(
            {
                Bucket: process.env.S3_BUCKET,
                Key: process.env.S3_BLOCKLIST_KEY
            },
            function(err, data) {
                if (err && err.statusCode.toString() !== '404') {
                    console.log('called saveBlockListToBucket and return error: ', err.stack);
                    reject('Get ip block list error.');
                } else {
                    if (err && err.statusCode.toString() === '404') {
                        resolve('');
                    } else {
                        resolve(data.Body.toString('ascii'));
                    }
                }
            }
        );
    });
};

/*
 * save the block list file
 */
const saveBlockListFile = (items, blockList) => {
    return new Promise((resolve, reject) => {
        let found = new Set(),
            added = 0;

        items.forEach(finding => {
            if (blockList.indexOf(finding.ip) < 0) {
                blockList += `${finding.ip}\r\n`;
                added++;
            }
            found.add(finding.ip);
        });

        S3.putObject(
            {
                Body: blockList,
                Bucket: process.env.S3_BUCKET,
                Key: process.env.S3_BLOCKLIST_KEY,
                ACL: 'public-read',
                ContentType: 'text/plain'
            },
            // eslint-disable-next-line no-unused-vars
            function(err, data) {
                if (err) {
                    console.log('called saveBlockListToBucket and return error: ', err.stack);
                    reject('Put ip block list error');
                } else {
                    console.log('called saveBlockListToBucket: no error.');
                    let msg = `${found.size} IP addresses found,
                        and ${added} new IP addresses have been added to ip block list.`;
                    setResp(msg, {
                        found: found.size,
                        added: added
                    });
                    resolve();
                }
            }
        );
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

    if (!process.env.S3_BUCKET || !process.env.S3_BLOCKLIST_KEY) {
        setResp('Must specify the S3 bucket and the IP block list file.', null);
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
    // AWS services
    S3 = new AWS.S3();
    docClient = new AWS.DynamoDB.DocumentClient();

    try {
        unsetResp();
        // scan the DynamoDB table to get all ip records
        let ipRecords = await scanDBTable();
        // check if s3 bucket exists.
        await bucketExists();
        // get the current block list
        let blockList = await getBlockListFile();
        // update and save the ip block list file
        await saveBlockListFile(ipRecords, blockList);
    } catch (err) {
        setResp(
            "There's a problem in generating ip block list. Please see detailed" +
                ' information in CloudWatch logs.',
            null
        );
    } finally {
        callback(null, respArr);
    }
};
