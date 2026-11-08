class Character {

    constructor(name, hitbox, poly, color, xy, maxspeed, slower, gravity, bounciness, speed, moveType, health) {
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
        this.xOver = 0;
        this.yOver = 0;

        this.XbounceTime = 20;
        this.XbounceTimer = 0;

        this.YbounceTime = 20;
        this.YbounceTimer = 0;

        this.speed = speed;
        this.jumpSpeed = jumpSpeed;

        this.health = 100;

        this.jump = false;
        this.jumpTimer = 0;
        this.jumpCoolDown = false;
        this.jumpCoolDownTimer = 0;

        this.moveType = moveType;
        this.degreeToGoCW = 0;
        this.degreeToGoCCW = 0;
        this.degree = 0;
        this.degreeSpeedX = 0;

        this.death = false;

    }

    move() {
       
        console.log(this.XbounceTimer)

        //Gravity
        if (CollisionDetector.collision(this, [0, -this.gravity], allObjects)) {
            this.onGround = true;
            console.log("GROUND IS TRUE");
            console.log(this.y)
        } else {
            this.onGround = false;
            console.log("GROUND IS FALSE");
        }
        if (this.onGround == false) {
            this.yspeed -= this.gravity;
        }

        if ((this.xspeed != 0 || this.yspeed != 0) || (this.upPressed || this.downPressed || this.leftPressed || this.rightPressed) || this.onGround == false) {

            // Horizontaly
            if (!CollisionDetector.collision(this, [this.xspeed, 0], allObjects) && this.XbounceTimer == 0) {
                if (!this.leftPressed && this.rightPressed) {
                    if (this.xspeed < 0) {
                        this.xspeed += this.speed + this.slower;
                    }
                    else {
                        this.xspeed += this.speed;
                    }
                }
                if (this.leftPressed && !this.rightPressed) {
                    if (this.xspeed > 0) {
                        this.xspeed -= this.speed + this.slower;
                    }
                    else {
                        this.xspeed -= this.speed;
                    }
                }
            }
            // X Slower
            if (!this.rightPressed && !this.leftPressed && this.xspeed != 0) {
                //Slow Fix
                if ((0 < this.xspeed && this.xspeed < this.slower) || (0 > this.xspeed && this.xspeed > -this.slower)) {
                    this.xspeed = 0;
                }
                else {
                    this.xspeed = Math.subtractToZero(this.xspeed, this.slower);
                }
            }

        }

        // Vertically
        if (!CollisionDetector.collision(this, [0, this.yspeed + this.speed*2], allObjects) && this.YbounceTimer == 0) {
            if (!this.upPressed && this.downPressed) {
                if (this.yspeed > 0) {
                    this.yspeed -= this.speed + this.slower;
                }
                else {
                    this.yspeed -= this.speed;
                }
            }
            if (this.upPressed && !this.downPressed) {
                if (this.yspeed < 0) {
                    this.yspeed += this.speed + this.slower;
                }
                else {
                    this.yspeed += this.speed;
                }
            }
        }
        // Y Slower
        if (!this.upPressed && !this.downPressed && this.yspeed != 0) {
            //Slow Fix
            if ((0 < this.yspeed && this.yspeed < this.slower) || (0 > this.yspeed && this.yspeed > -this.slower)) {
                this.yspeed = 0;
            }
            else {
                this.yspeed = Math.subtractToZero(this.yspeed, this.slower);
            }
        }

        if (this.XbounceTimer > 0) {
            this.XbounceTimer--;
        }
        if (this.YbounceTimer > 0) {
            this.YbounceTimer--;
        }

        // Y Collision
        if (CollisionDetector.collision(this, [0, this.xspeed], allObjects)) {
            this.yspeed = this.yspeed * this.bounciness;
            this.y += this.yspeed*2;
            this.YbounceTimer = this.YbounceTime;
            //this.x += this.xOver;
            this.collidedWith.yspeed = this.yspeed * this.collidedWith.bounciness;
        }
        // X Collision
        if (CollisionDetector.collision(this, [this.xspeed, 0], allObjects)) {
            this.xspeed = this.xspeed * this.bounciness;
            this.x += this.xspeed*2;
            this.XbounceTimer = this.XbounceTime;
            //this.x += this.xOver;
            this.collidedWith.xspeed = this.xspeed * this.collidedWith.bounciness;
        }

        //Max Speed
        if (this.xspeed > this.maxspeed) {
            this.xspeed = this.maxspeed;
        }
        if (this.xspeed < -this.maxspeed) {
            this.xspeed = -this.maxspeed;
        }
        if (this.yspeed > this.maxspeed) {
            this.yspeed = this.maxspeed;
        }
        if (this.yspeed < -this.maxspeed) {
            this.yspeed = -this.maxspeed;
        }

        //Rounding
        this.yspeed = Math.round(this.yspeed * rounder) / rounder;
        this.xspeed = Math.round(this.xspeed * rounder) / rounder;


        // Setting Location
        this.x += this.xspeed;
        this.y += this.yspeed;
    }

    animate() {
        Components.moveTypeFinder(this);
        this.move();
        Polygon.create(this.poly, this.color, this);
    }
}