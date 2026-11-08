Math.radians = function(degrees) {
    return degrees * Math.PI / 180;
};

Math.degrees = function(radians) {
    return radians * 180 / Math.PI;
};

Math.subtractToZero = function subtractToZero(num, sub) {
    if (num > 0) {
        num -= sub
    } else if (num < 0) {
        num += sub
    } else if (num == 0) {
        num = 0
    }
    return num
}