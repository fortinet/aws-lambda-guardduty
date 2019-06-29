'use strict';
/*
Author: Fortinet

This script intends to run the project in local node dev environment instead of AWS Lambda over the
cloud, for local development purpose.
Please install aws-cli and configure it with a proper AWS account you use for development.

requirements:
The lambda function entry is index.js by default. Or change it on line 54.
The lambda function entry and local.js must be situated in the same directory.

This script accept a few command line arguments. See the argument list below:

Argument list:
first argument: the file path to an external resource as an input event.
second argument: the file path to a script to load environment variables into process.

To load a set of variables into process.env, you can also create a separate script in the 'local'
directory. Then specify the file path as the second argument when you execute the local.js script
via 'npm run local.js' command.

*/
console.log('Start to run in local environment...');

// the argument index for the source file path of event json
const ARGV_PROCESS_EVENT_JSON = 2;
// the argument index for the source file path where this script loads environment variable from
const ARGV_PROCESS_ENV_SCRIPT = 3;
var fs = require('fs');

var event = null,
    context = {},
    // eslint-disable-next-line no-shadow
    callback = function(context, response) {
        console.log('handle callback is called with:', response, context);
    };

// run the script to load process.env if the command line argument is specified.
if (process.argv[ARGV_PROCESS_ENV_SCRIPT] !== undefined) {
    require(require.resolve(`${process.cwd()}/${process.argv[ARGV_PROCESS_ENV_SCRIPT]}`));
}

// if provided an event json file, use is. otherwise, use an empty event.
if (
    process.argv[ARGV_PROCESS_EVENT_JSON] !== undefined &&
    fs.existsSync(process.argv[ARGV_PROCESS_EVENT_JSON])
) {
    const data = fs.readFileSync(process.argv[ARGV_PROCESS_EVENT_JSON]);
    // TODO: fix this:
    // eslint-disable-next-line no-useless-catch
    try {
        event = JSON.parse(data);
    } catch (e) {
        throw e;
    }
}
// load entry script with an event
var entryScript = require(require.resolve(`${__dirname}/index`));
console.log('Loading entry script...');
entryScript.handler.call(null, event, context, callback);
