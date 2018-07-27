#!/usr/bin/env node

'use strict';

console.log('Making distribution zip package');
var pkg = require('../package.json'),
    os = require('os'),
    fs = require('fs'),
    path = require('path'),
    rimraf = require('rimraf');

process.env.TMPDIR = fs
    .mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), `${pkg.name}-`)) + path.sep;

// Shorter version of node_modules/dpl/dpl.js which avoids the 'upload' phase

var dpl = require('dpl/lib/index.js');
// 'upload' into the ./dist folder instead.
dpl.upload = function() {
    var fileName = `${pkg.name}.zip`;
    var zipFile = path.normalize(process.env.TMPDIR + fileName);
    var distDir = path.normalize(path.join(__dirname, '..', 'dist'));
    try {
        fs.mkdirSync(distDir);
    } catch (ex) {}
    copyFile(zipFile, path.join(distDir, fileName), function() {
        rimraf.sync(path.dirname(zipFile));
        console.log(`zipped to ${path.relative(process.cwd(), path.join(distDir, fileName))}`);
    });
};
require('dpl/dpl.js');

function copyFile(src, dest, cb) {
    fs.createReadStream(src).pipe(fs.createWriteStream(dest))
        .on('error', console.error)
        .on('close', cb);
}
