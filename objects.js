class Object {

    constructor(name, hitbox, poly, color, xy, maxspeed = 0, slower = 0, gravity = 0, bounciness = 0, movable = false) {
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
        this.movable = movable;
        this.onGround = false;
        this.collidedWith = null;
        this.xOver = 0;
        this.yOver = 0;
    }

    move() {
        // Gravity check
        if (CollisionDetector.collision(this, [0, -2], allObjects)) {
            this.onGround = true;
        } else {
            this.onGround = false;
        }

        if (this.onGround == false) {
            this.yspeed -= this.gravity;
        }

        // Horizontal friction when on ground
        if (this.xspeed != 0) {
            var fric = this.onGround ? this.slower * 0.6 : this.slower * 0.15;
            this.xspeed = Math.subtractToZero(this.xspeed, fric);
            if (Math.abs(this.xspeed) < fric) {
                this.xspeed = 0;
            }
        }

        // Max Speed
        if (this.xspeed > this.maxspeed) this.xspeed = this.maxspeed;
        if (this.xspeed < -this.maxspeed) this.xspeed = -this.maxspeed;
        if (this.yspeed > this.maxspeed) this.yspeed = this.maxspeed;
        if (this.yspeed < -this.maxspeed) this.yspeed = -this.maxspeed;

        // X Collision & Momentum Transfer
        if (this.xspeed != 0) {
            if (CollisionDetector.collision(this, [this.xspeed, 0], allObjects)) {
                var hit = this.collidedWith;
                this.x += this.xspeed + this.xOver;
                if (hit && (hit.movable || hit instanceof Character)) {
                    hit.xspeed += this.xspeed * 0.7;
                }
                this.xspeed = this.xspeed * this.bounciness;
                if (Math.abs(this.xspeed) < this.slower) {
                    this.xspeed = 0;
                }
            } else {
                this.x += this.xspeed;
            }
        }

        // Y Collision & Momentum Transfer
        if (this.yspeed != 0) {
            if (CollisionDetector.collision(this, [0, this.yspeed], allObjects)) {
                var hit = this.collidedWith;
                this.y += this.yspeed + this.yOver;
                if (hit && (hit.movable || hit instanceof Character) && this.yspeed > 0) {
                    hit.yspeed += this.yspeed * 0.6;
                }
                this.yspeed = this.yspeed * this.bounciness;
                if (Math.abs(this.yspeed) < this.gravity * 2.5) {
                    this.yspeed = 0;
                }
            } else {
                this.y += this.yspeed;
            }
        }

        // Respawn moving crate if it falls off the map
        if (this.y < -1200) {
            this.x = (Math.random() - 0.5) * 800;
            this.y = 600;
            this.xspeed = 0;
            this.yspeed = 0;
        }

        this.x = Math.round(this.x * rounder) / rounder;
        this.y = Math.round(this.y * rounder) / rounder;
        this.yspeed = Math.round(this.yspeed * rounder) / rounder;
        this.xspeed = Math.round(this.xspeed * rounder) / rounder;
    }

    staticObject() {
        Polygon.create(this.poly, this.color, this);
    }

    movingObject() {
        this.movable = true;
        this.move();
        Polygon.create(this.poly, this.color, this);
    }
}
