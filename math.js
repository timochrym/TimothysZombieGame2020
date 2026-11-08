Math.radians = function(degrees) {
    return degrees * Math.PI / 180;
};

Math.degrees = function(radians) {
    return radians * 180 / Math.PI;
};

Math.subtractToZero = function subtractToZero(num, sub) {
    if (num > 0) {
        num -= sub;
        if (num < 0) num = 0;
    } else if (num < 0) {
        num += sub;
        if (num > 0) num = 0;
    } else {
        num = 0;
    }
    return num;
};

Math.makeHitbox = function(w, h) {
    var hw = w / 2;
    var hh = h / 2;
    return [
        [-hw, hh],
        [hw, hh],
        [hw, -hh],
        [-hw, -hh]
    ];
};
