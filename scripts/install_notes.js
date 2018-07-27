'use strict';

require('dpl');
var notes = [
    'run "npm run build" to create the distribution zip file',
    'run "npm run deploy" to deploy to AWS directly'
];
console.log(`${notes.join('\n')}\n`);
