'use strict';

/*
Object operation utility class.
*/
let ObjectUtils = {};

ObjectUtils.fetch = function(obj, path) {
    var keys = path.split('/');
    var tmp = obj;

    for (var i = 0, size = keys.length; i < size; i++) {
        var k = keys[i];
        if (tmp.hasOwnProperty(k)) {
            tmp = tmp[k];
        } else if (typeof tmp[k] === 'undefined') {
            return null;
        }
    }

    return tmp;
};

module.exports = ObjectUtils;
