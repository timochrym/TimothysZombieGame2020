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
        console.log("Y SPEED IS " + this.yspeed);
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
            /*if (this.rightPressed == true) {
                this.xspeed += this.speed;
            }
            if (this.leftPressed == true) {
                this.xspeed -= this.speed;
            }

            //X Slower
            if (this.rightPressed == false && this.leftPressed == false && this.xspeed != 0) {
                //Slow Fix
                if ((0 < this.xspeed && this.xspeed < this.slower) || (0 > this.xspeed && this.xspeed > -this.slower)) {
                    this.xspeed = 0;
                }
                else {
                    this.xspeed = Math.subtractToZero(this.xspeed, this.slower);
                }
            }*/

            // Vertically
            //if (this.upPressed == true) {
                //this.yspeed += this.speed;
            //}
            //if (this.downPressed == true) {
                //this.yspeed -= this.speed;
            //}
            
            //console.log(this.onGround);
            //Y Slower
            if (Math.abs(this.yspeed) <= this.gravity*4 && this.onGround == true) {
                this.yspeed = 0;
                console.log("ON GROUND RESET")
            } 
            //this.upPressed == false && this.downPressed == false && 
            //if (this.yspeed != 0) {
                //Slow Fix
                //if ((0 < this.yspeed && this.yspeed < this.slower) || (0 > this.yspeed && this.yspeed > -this.slower)) {
                    //this.yspeed = this.yspeed * 0.5
                    //console.log("MADE IT HERE SLFDHK");

                //}
                //if (Math.abs(this.yspeed) < 6) {
                    //this.yspeed = Math.round(this.yspeed) - 1;
                //}
                //else if (0 < this.yspeed) {
                    //this.yspeed = this.yspeed * 0.5;
                //}
                //if ((this.yspeed > this.slower)) {
                    //this.yspeed = Math.subtractToZero(this.yspeed, this.slower);
                //}
                //this.yspeed = Math.round(this.yspeed);

                //console.log(this.yspeed);
            //}

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

            //X Collision
            if (CollisionDetector.collision(this, [this.xspeed, 0], allObjects)) {
                this.xspeed = this.xspeed * this.bounciness;
                //this.x += this.xOver;
                this.collidedWith.xspeed = this.xspeed * this.collidedWith.bounciness;
            }
            if (CollisionDetector.collision(this, [this.xspeed, 0], allObjects)) {
                this.xspeed = 0;
                //this.x += this.xOver+1;
            }

            //Y Collision
            if (CollisionDetector.collision(this, [0, this.yspeed], allObjects)) {
                this.yspeed = this.yspeed * this.bounciness;
                this.y += this.yOver;
                this.collidedWith.yspeed =  this.yspeed * this.collidedWith.bounciness;
                console.log("COLLIDED______________ ______ ______ _____ ____");
            }
            if (CollisionDetector.collision(this, [0, this.yspeed], allObjects)) {
                this.yspeed = 0;
                //this.y += this.yOver+1;
            }
        }
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