class Object {

    constructor(name, hitbox, poly, color, xy, maxspeed, slower, gravity, bounciness) {
        this.name = name;
        this.hitbox = hitbox;
        this.poly = poly;
        this.color = color;
        this.x = xy[0];
        this.y = xy[1];
        this.yspeed = 0;
        this.xspeed = 0;
        this.maxspeed = maxspeed;
        this.slower = slower;
        this.gravity = gravity;
        this.bounciness = bounciness;
        this.onGround = false;
        this.collidedWith = null;
    }

    move() {

        //Gravity
        if (CollisionDetector.collision(this, [0, -1], allObjects)) {
            this.onGround = true;
        } else {
            this.onGround = false;
        }
        if (this.onGround == false) {
            this.yspeed -= this.gravity;
        }

        if (this.xspeed != 0 || this.yspeed != 0) {

            // Horizontaly

            //X Collision
            if (CollisionDetector.collision(this, [this.xspeed, 0], allObjects)) {
                this.xspeed = this.xspeed * this.bounciness;
                    //this.collidedWith.xspeed = this.collidedWith.bounciness
            }

            //X Slower
            this.xspeed = Math.subtractToZero(this.xspeed, this.slower)


            // Vertically

            //Y Collision
            if (CollisionDetector.collision(this, [0, this.yspeed], allObjects)) {
                this.yspeed = this.yspeed * this.bounciness
                    //this.collidedWith.yspeed = this.collidedWith.yspeed * this.collidedWith.bounciness
            }

            // Speed Fix (Use variable that it is constantly being changed by)
            if (this.yspeed < this.gravity && this.yspeed > -this.gravity) {
                this.yspeed = 0
            }
            if (this.xspeed < this.slower && this.xspeed > -this.slower) {
                this.xspeed = 0
            }

            //Max Speed
            if (this.xspeed > this.maxspeed) {
                this.xspeed = this.maxspeed
            }
            if (this.xspeed < -this.maxspeed) {
                this.xspeed = -this.maxspeed
            }
            if (this.yspeed > this.maxspeed) {
                this.yspeed = this.maxspeed
            }
            if (this.yspeed < -this.maxspeed) {
                this.yspeed = -this.maxspeed
            }
        }

        // Setting Location
        this.x = Math.round(this.x * rounder) / rounder
        this.y = Math.round(this.y * rounder) / rounder
        this.yspeed = Math.round(this.yspeed * rounder) / rounder
        this.xspeed = Math.round(this.xspeed * rounder) / rounder
        this.x += this.xspeed
        this.y += this.yspeed
    }

    staticObject() {
        Polygon.create(this.poly, this.color, this)
    }

    movingObject() {
        this.move()
        Polygon.create(this.poly, this.color, this)
    }
}