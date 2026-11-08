class CollisionDetector {

    static collision(objectToTest, xyAdd, objects) {

        for (let i = 0; i < objects.length; i++) {
            if (objects[i] != objectToTest) {

                this.tx = [objectToTest.hitbox[0][0] + objectToTest.x + xyAdd[0], objectToTest.hitbox[1][0] + objectToTest.x + xyAdd[0]];
                this.ty = [objectToTest.hitbox[0][1] + objectToTest.y + xyAdd[1], objectToTest.hitbox[3][1] + objectToTest.y + xyAdd[1]];

                this.ox = [objects[i].hitbox[0][0] + objects[i].x + xyAdd[0], objects[i].hitbox[1][0] + objects[i].x + xyAdd[0]];
                this.oy = [objects[i].hitbox[0][1] + objects[i].y + xyAdd[1], objects[i].hitbox[3][1] + objects[i].y + xyAdd[1]];

                if (this.matrixOverlap(this.tx, this.ox, this.ty, this.oy, objectToTest)) {

                    objectToTest.collidedWith = objects[i];
                    return true;

                }
            }
        }
    }

    static matrixOverlap(x1, x2, y1, y2, objectToTest) {

        this.overLap1 = this.rangeOverlap(y1, y2);
        this.overLap2 = this.rangeOverlap(x1, x2);
        if (this.overLap1[0] == true && this.overLap2[0] == true) {
            objectToTest.yOver = this.overLap1[1];
            objectToTest.xOver = this.overLap2[1];
            return true;
        }
    }

    static rangeOverlap(aPair, bPair) {

        if (aPair[0] > aPair[1]) {
            aPair = [aPair[1], aPair[0]];
        }
        if (bPair[0] > bPair[1]) {
            bPair = [bPair[1], bPair[0]];
        }

        /*if ((bPair[0] >= aPair[0] && bPair[0] <= aPair[1]) || (bPair[1] >= aPair[0] && bPair[1] <= aPair[1])) {
            return true;
        }
        else if ((aPair[0] >= bPair[0] && aPair[0] <= bPair[1]) || (aPair[1] >= bPair[0] && aPair[1] <= bPair[1])) {
            return true;
        }
        return false;*/

        if ((bPair[0] > aPair[0] && bPair[0] < aPair[1])) {
            return ([true, aPair[1] - bPair[0]]);
        }
        else if ((bPair[1] > aPair[0] && bPair[1] < aPair[1])) {
            return ([true, bPair[1] - aPair[0]]);
        }
        else if ((aPair[0] > bPair[0] && aPair[0] < bPair[1])) {
            return ([true, aPair[1] - bPair[1]]);
        }
        else if ((aPair[1] > bPair[0] && aPair[1] < bPair[1])) {
            return ([true, aPair[1] - bPair[0]]);
        }
        return ([false, 0]);
    }
}