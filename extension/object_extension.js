Object.prototype.fetch = function(path) {
    var keys = path.split('/');
    var tmp = this;

    for (var i = 0,size = keys.length; i < size; i++) {
        var k = keys[i];
        if (tmp.hasOwnProperty(k)) {
            tmp = tmp[k]
        } else if (typeof tmp[k] === 'undefined') {
            return null;
        }
    }

    return tmp;
};

