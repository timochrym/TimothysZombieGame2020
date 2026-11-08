class Character {

    constructor(name, c, size1, size2, x, y, moveType, lazerType) {

        this.characterName = name;

        this.s1 = size1
        this.s2 = size2
        this.a1 = this.s1 / 2
        this.a2 = this.s2 / 2
        this.x = x
        this.y = y
        this.color = c

        this.speed = speed
        this.yspeed = 0
        this.xspeed = 0
        this.jumpSpeed = jumpSpeed
        this.onGround = false

        this.health = 100

        this.jump = false
        this.jumpTimer = 0
        this.jumpCoolDown = false
        this.jumpCoolDownTimer = 0

        this.moveType = moveType
        this.degreeToGoCW = 0
        this.degreeToGoCCW = 0
        this.degree = 0
        this.degreeSpeedX = 0
        this.lazerType = lazerType

        this.death = false
    }

    move() {
        // Horizontaly
        if (this.rightPressed == true) {
            this.xspeed += this.speed
        }
        if (this.leftPressed == true) {
            this.xspeed -= this.speed
        }
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
        if (this.rightPressed == false && this.leftPressed == false && this.xspeed != 0) {
            this.xspeed = Math.subtractToZero(this.xspeed, slow)
        }

        // Vertically
        this.onGround = CollisionDetector.collision(objects, this, [0, -10])[0]

        if (this.upPressed == true && this.jumpCoolDown == false && this.onGround == true) {
            this.jump = true
        }
        if (this.downPressed == true) {
            this.jump = false
        }
        //Jump
        if (this.jump == true) {
            this.jumpTimer += 1
            if (jumpTimeMax > this.jumpTimer) {
                this.yspeed += this.jumpSpeed
            } else {
                this.jumpTimer = 0
                this.jump = false
                this.jumpCoolDown = true
                this.jumpCoolDownTimer = 0
            }
        } else if (this.jump == false) {
            this.jumpCoolDownTimer += 1
            if (this.jumpCoolDownTimer > jumpCoolDownTimeMax) {
                this.jumpCoolDown = false
                this.jumpCoolDownTimer = 0
            }
        }

        //Gravity
        if (this.jump == false && this.onGround == false) {
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

    createCharacter() {
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.imageSmoothingEnabled = false;
        ctx.beginPath()
        ctx.rect(xc + this.x - this.a1, yc - this.y - this.a2, this.s1, this.s2, this.s1, this.s2)
        ctx.fillStyle = this.color
        ctx.fill()
        ctx.closePath()
        ctx.drawImage(character, xc + this.x - this.a1, yc - this.y - this.a2, this.s1, this.s2)
    }

    animate() {
        Components.moveTypeFinder(this)
        this.move()
        this.createCharacter()
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