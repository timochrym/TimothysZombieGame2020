class CollisionDetector {

    static collision(objectToTest, xyAdd, objects) {
        objectToTest.collidedWith = null;

        var tx0 = objectToTest.hitbox[0][0] + objectToTest.x + xyAdd[0];
        var tx1 = objectToTest.hitbox[1][0] + objectToTest.x + xyAdd[0];
        var ty0 = objectToTest.hitbox[0][1] + objectToTest.y + xyAdd[1];
        var ty1 = objectToTest.hitbox[3][1] + objectToTest.y + xyAdd[1];

        var tx = [tx0, tx1];
        var ty = [ty0, ty1];

        for (let i = 0; i < objects.length; i++) {
            var other = objects[i];
            if (other != objectToTest && !other.dead && !other.noCollide) {

                var ox = [
                    other.hitbox[0][0] + other.x,
                    other.hitbox[1][0] + other.x
                ];
                var oy = [
                    other.hitbox[0][1] + other.y,
                    other.hitbox[3][1] + other.y
                ];

                if (this.matrixOverlap(tx, ox, ty, oy, objectToTest)) {
                    objectToTest.collidedWith = other;
                    return true;
                }
            }
        }
        return false;
    }

    static matrixOverlap(x1, x2, y1, y2, objectToTest) {
        var overLapY = this.rangeOverlap(y1, y2);
        var overLapX = this.rangeOverlap(x1, x2);
        if (overLapY[0] == true && overLapX[0] == true) {
            objectToTest.yOver = overLapY[1];
            objectToTest.xOver = overLapX[1];
            return true;
        }
        return false;
    }

    static rangeOverlap(aPair, bPair) {
        var a0 = Math.min(aPair[0], aPair[1]);
        var a1 = Math.max(aPair[0], aPair[1]);
        var b0 = Math.min(bPair[0], bPair[1]);
        var b1 = Math.max(bPair[0], bPair[1]);

        // Collides properly even when items have the exact same X or Y positions
        if (a0 < b1 && a1 > b0) {
            var centerA = (a0 + a1) / 2;
            var centerB = (b0 + b1) / 2;
            var overlap = 0;
            if (centerA >= centerB) {
                overlap = b1 - a0;
            } else {
                overlap = b0 - a1;
            }
            return [true, overlap];
        }
        return [false, 0];
    }
}
