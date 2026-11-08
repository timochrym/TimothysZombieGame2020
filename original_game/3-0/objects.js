class Object {

    constructor(name, c, size1, size2, x, y) {
        this.characterName = name;
        this.s1 = size1;
        this.s2 = size2;
        this.a1 = this.s1 / 2;
        this.a2 = this.s2 / 2;
        this.x = x;
        this.y = y;
        this.color = c;
        this.yspeed = 0;
        this.xspeed = 0;
        this.onGround = false
    }

    move() {

        // Horizontaly
        //X Collision
        if (this.xspeed != 0) {
            this.xCollisionP = CollisionDetector.collision(objects, this, [this.xspeed * 2, 0])
            this.xCollisionPObject = this.xCollisionP[1]
            this.xCollisionP = this.xCollisionP[0]
            this.xCollisionN = CollisionDetector.collision(objects, this, [-this.xspeed * 2, 0])
            this.xCollisionNObject = this.xCollisionN[1]
            this.xCollisionN = this.xCollisionN[0]
            if (this.xCollisionP == true && this.xCollisionN == false) {
                for (let object = 0; object < movingObjects.length; object++) {
                    if (this.xCollisionPObject == movingObjects[object]) {
                        this.xCollisionPObject.xspeed = this.xspeed * -xbounce
                        this.xCollisionPObject.xCollisionP = CollisionDetector.collision(objects, this.xCollisionPObject, [this.xCollisionPObject.xspeed * 2, 0])
                        if (this.xCollisionPObject.xCollisionP == true) {
                            this.xCollisionPObject.xspeed = 0
                        }
                    }
                }
                this.xspeed = this.xspeed * xbounce
            } else if (this.xCollisionP == true && this.xCollisionN == true) {
                this.xspeed = 0
            }
        }
        //X Slower
        if (this.xspeed != 0) {
            this.xspeed = Math.subtractToZero(this.xspeed, slow)
        }

        // Vertically
        this.onGround = CollisionDetector.collision(objects, this, [0, -1])[0]

        //Gravity
        if (this.onGround == false) {
            this.yspeed -= gravity
        }

        //Y Collision
        if (this.yspeed != 0) {
            this.yCollisionP = CollisionDetector.collision(objects, this, [0, this.yspeed])
            this.yCollisionPObject = this.yCollisionP[1]
            this.yCollisionP = this.yCollisionP[0]
            this.yCollisionN = CollisionDetector.collision(objects, this, [0, -this.yspeed])
            this.yCollisionNObject = this.yCollisionN[1]
            this.yCollisionN = this.yCollisionN[0]
            if (this.yCollisionP == true && this.yCollisionN == false) {
                for (let object = 0; object < movingObjects.length; object++) {
                    if (this.yCollisionPObject == movingObjects[object]) {
                        this.yCollisionPObject.yCollisionP = CollisionDetector.collision(objects, this.yCollisionPObject, [0, this.yCollisionPObject.yspeed * 2])
                        this.yCollisionPObject.yspeed = this.yspeed * -ybounce
                        if (this.yCollisionPObject.yCollisionP == true) {
                            this.yCollisionPObject.yspeed = 0
                        }
                    }
                }
                this.yspeed = this.yspeed * ybounce
            } else if (this.yCollisionP == true && this.yCollisionN == true) {
                this.yspeed = 0
            }
        }

        // Speed Fix
        if (this.yspeed < gravity && this.yspeed > -gravity) {
            this.yspeed = 0
        }
        if (this.xspeed < this.speed && this.xspeed > -this.speed) {
            this.xspeed = 0
        }

        //Max Speed
        if (this.xspeed > maxspeed) {
            this.xspeed = maxspeed
        }
        if (this.yspeed > maxspeed) {
            this.yspeed = maxspeed
        }

        // Setting Location
        this.x += this.xspeed
        this.y += this.yspeed
    }

    createObject() {
        ctx.beginPath()
        ctx.rect(xc + this.x - this.a1, yc - this.y - this.a2, this.s1, this.s2, this.s1, this.s2)
        ctx.fillStyle = this.color
        ctx.fill()
        ctx.closePath()
    }

    staticObject() {
        this.createObject()
    }

    movingObject() {
        this.move()
        this.createObject()
    }

    pointsRetrieve() {
        this.c1 = [this.x - this.s1 / 2, this.y + this.s2 / 2]
        this.c2 = [this.x + this.s1 / 2, this.y + this.s2 / 2]
        this.c3 = [this.x + this.s1 / 2, this.y - this.s2 / 2]
        this.c4 = [this.x - this.s1 / 2, this.y - this.s2 / 2]
        this.numbers = [this.c1, this.c2, this.c3, this.c4]
        return this.numbers
    }
    edgeRetrieve() {
        this.points = this.pointsRetrieve()
        this.edges = []
        for (let i = 0; i < this.points.length; i++) {
            this.p1 = i
            if (i + 1 >= this.points.length) {
                this.p2 = i + 1 - this.points.length
            } else {
                this.p2 = i + 1
            }
            this.edges.push([this.points[this.p1], this.points[this.p2]])
        }
        return this.edges
    }
}