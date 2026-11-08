class Character {

    constructor(name, hitbox, poly, color, xy, maxspeed, slower, gravity, bounciness, speed, moveType, health, lazerType = "ULDR", isZombie = false, zombiePower = "NORMAL") {
        this.name = name;
        this.hitbox = hitbox;
        this.poly = poly;
        this.color = color;
        this.originalColor = color;
        this.x = xy[0];
        this.y = xy[1];
        this.s1 = Math.abs(hitbox[1][0] - hitbox[0][0]);
        this.s2 = Math.abs(hitbox[0][1] - hitbox[3][1]);
        this.sizeScale = this.s1 / s1;

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
        this.movable = true;

        this.speed = speed;
        this.baseSpeed = speed;
        this.jumpSpeed = jumpSpeed;
        this.baseJumpSpeed = jumpSpeed;

        this.health = health || 100;
        this.maxHealth = this.health;

        this.jump = false;
        this.jumpTimer = 0;
        this.jumpCoolDown = false;
        this.jumpCoolDownTimer = 0;

        this.moveType = moveType;
        this.lazerType = lazerType;
        this.lazerCooldown = 0;
        this.abilityCooldown = 0;

        this.degreeToGoCW = 0;
        this.degreeToGoCCW = 0;
        this.degree = 0;
        this.degreeSpeedX = 0;

        this.isZombie = isZombie;
        this.zombiePower = zombiePower;
        this.death = false;
        this.dead = false;
        this.aiDir = 1;

        this.powerType = null;
        this.powerTimer = 0;
        this.powerTimerMax = 480;
    }

    takeDamage(amount, knockX = 0, knockY = 0) {
        if (this.dead) return;
        this.health += amount; // amount is negative for damage
        this.xspeed += knockX;
        this.yspeed += knockY;

        if (this.health <= 0) {
            this.health = 0;
            this.handleDeath();
        }
    }

    handleDeath() {
        if (this.moveType == "ZOMBIE") {
            // AI Zombie dies and blows up!
            this.dead = true;
            score += (this.zombiePower == "TANK" ? 30 : (this.zombiePower == "NORMAL" ? 10 : 20));
            var blastRadius = (this.zombiePower == "EXPLODER") ? 280 : 140;
            var blastDamage = (this.zombiePower == "EXPLODER") ? -35 : -10;
            Components.blowUp(this.x, this.y, this.color, 18, blastRadius, blastDamage, this);

            // Chance to drop a Power-Up
            if (Math.random() < 0.35 && typeof spawnPowerUp === "function") {
                spawnPowerUp(this.x, this.y + 20);
            }
        } else if (!this.isZombie) {
            // Player Death = Zombie!
            this.death = true;
            this.isZombie = true;
            this.color = "#2d6e32";
            this.maxHealth = 120;
            this.health = 120;
            this.speed = this.baseSpeed * 1.15;
            this.jumpSpeed = this.baseJumpSpeed * 1.15;
            this.zombiePower = "SPITTER";
            Components.blowUp(this.x, this.y, "#ff3333", 20, 180, -15, this);

            // Check if all human players are now zombies
            var anyHumanAlive = false;
            for (let i = 0; i < characters.length; i++) {
                if (!characters[i].isZombie) {
                    anyHumanAlive = true;
                }
            }
            if (!anyHumanAlive) {
                gameOver = true;
            }
        } else {
            // Player-controlled zombie died: respawn them at top after blowing up
            Components.blowUp(this.x, this.y, this.color, 16, 150, 0, this);
            this.health = this.maxHealth;
            this.x = (Math.random() - 0.5) * 600;
            this.y = 550;
            this.xspeed = 0;
            this.yspeed = 0;
        }
    }

    reviveAsHuman() {
        this.death = false;
        this.isZombie = false;
        this.color = this.originalColor;
        this.maxHealth = 100;
        this.health = 100;
        this.speed = this.baseSpeed;
        this.jumpSpeed = this.baseJumpSpeed;
    }

    applyPowerUp(type) {
        this.powerType = type;
        this.powerTimer = this.powerTimerMax;
        if (type == "SPEED") {
            this.speed = this.baseSpeed * 1.5;
            this.jumpSpeed = this.baseJumpSpeed * 1.25;
        } else if (type == "HEAL") {
            this.health = Math.min(this.maxHealth, this.health + 50);
            this.powerTimer = 90;
        } else if (type == "BLOWUP") {
            Components.blowUp(this.x, this.y, "#ffaa00", 26, 340, -50, this);
            this.powerTimer = 90;
        }
    }

    move() {
        // Power-up timer update
        if (this.powerTimer > 0) {
            this.powerTimer--;
            if (this.powerTimer == 0) {
                this.powerType = null;
                this.speed = this.baseSpeed;
                this.jumpSpeed = this.baseJumpSpeed;
            }
        }

        // Ground check
        if (CollisionDetector.collision(this, [0, -3], allObjects)) {
            this.onGround = true;
        } else {
            this.onGround = false;
        }

        // Horizontal movement
        if (this.rightPressed && !this.leftPressed) {
            if (this.xspeed < 0) {
                this.xspeed += this.speed + this.slower;
            } else {
                this.xspeed += this.speed;
            }
        } else if (this.leftPressed && !this.rightPressed) {
            if (this.xspeed > 0) {
                this.xspeed -= this.speed + this.slower;
            } else {
                this.xspeed -= this.speed;
            }
        } else if (this.xspeed != 0) {
            // X Slower (Friction)
            if (Math.abs(this.xspeed) < this.slower) {
                this.xspeed = 0;
            } else {
                this.xspeed = Math.subtractToZero(this.xspeed, this.slower);
            }
        }

        // Vertical Jump & Gravity (from 3-0 character.js)
        if (this.upPressed && !this.jumpCoolDown && this.onGround) {
            this.jump = true;
            this.jumpTimer = 0;
        }
        if (this.downPressed) {
            this.jump = false;
            if (!this.onGround) {
                this.yspeed -= this.gravity * 0.8;
            }
        }

        if (this.jump) {
            this.jumpTimer += 1;
            var maxJumpFrames = (this.zombiePower == "LEAPER") ? jumpTimeMax * 1.35 : jumpTimeMax;
            if (maxJumpFrames > this.jumpTimer && this.upPressed) {
                this.yspeed += this.jumpSpeed;
            } else {
                this.jumpTimer = 0;
                this.jump = false;
                this.jumpCoolDown = true;
                this.jumpCoolDownTimer = 0;
            }
        } else {
            if (this.jumpCoolDown) {
                this.jumpCoolDownTimer += 1;
                if (this.jumpCoolDownTimer > jumpCoolDownTimeMax || this.onGround) {
                    this.jumpCoolDown = false;
                    this.jumpCoolDownTimer = 0;
                }
            }
            if (!this.onGround) {
                this.yspeed -= this.gravity;
            }
        }

        // Max Speed
        var curMaxSpeed = (this.powerType == "SPEED") ? this.maxspeed * 1.35 : this.maxspeed;
        if (this.xspeed > curMaxSpeed) this.xspeed = curMaxSpeed;
        if (this.xspeed < -curMaxSpeed) this.xspeed = -curMaxSpeed;
        if (this.yspeed > curMaxSpeed) this.yspeed = curMaxSpeed;
        if (this.yspeed < -curMaxSpeed) this.yspeed = -curMaxSpeed;

        // X Collision & Momentum Transfer
        if (this.xspeed != 0) {
            if (CollisionDetector.collision(this, [this.xspeed, 0], allObjects)) {
                var hitX = this.collidedWith;
                this.x += this.xspeed + this.xOver;
                this.handleCharacterCollision(hitX);
                if (hitX && hitX.movable) {
                    var pushFactor = (this.zombiePower == "TANK") ? 1.15 : 0.75;
                    hitX.xspeed = this.xspeed * pushFactor;
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
                var hitY = this.collidedWith;
                this.y += this.yspeed + this.yOver;
                this.handleCharacterCollision(hitY);
                if (hitY && hitY.movable && this.yspeed > 0) {
                    hitY.yspeed = this.yspeed * 0.6;
                }
                if (this.yspeed > 0) {
                    // Hit ceiling: stop jump
                    this.jump = false;
                }
                this.yspeed = this.yspeed * this.bounciness;
                if (Math.abs(this.yspeed) < this.gravity * 2.2) {
                    this.yspeed = 0;
                }
            } else {
                this.y += this.yspeed;
            }
        }

        // Also check direct contact with zombies/humans when standing next to them
        if (CollisionDetector.collision(this, [2, 0], allObjects)) {
            this.handleCharacterCollision(this.collidedWith);
        }
        if (CollisionDetector.collision(this, [-2, 0], allObjects)) {
            this.handleCharacterCollision(this.collidedWith);
        }

        // Out of bounds fall protection
        if (this.y < -1200) {
            this.takeDamage(-25, 0, 0);
            this.x = 0;
            this.y = 550;
            this.xspeed = 0;
            this.yspeed = 0;
        }

        // Rounding
        this.yspeed = Math.round(this.yspeed * rounder) / rounder;
        this.xspeed = Math.round(this.xspeed * rounder) / rounder;
        this.x = Math.round(this.x * rounder) / rounder;
        this.y = Math.round(this.y * rounder) / rounder;
    }

    handleCharacterCollision(other) {
        if (!other || !(other instanceof Character)) return;
        // Zombie bites Human!
        if (this.isZombie && !other.isZombie) {
            other.takeDamage(zombieDamage * 2.5, (other.x > this.x ? 4 : -4), 2);
        } else if (!this.isZombie && other.isZombie) {
            this.takeDamage(zombieDamage * 2.5, (this.x > other.x ? 4 : -4), 2);
        }
    }

    createCharacter() {
        // Draw colored polygon base
        Polygon.create(this.poly, this.color, this);

        // Draw pixel-art sprite (Zombie.png or Character.png) on top
        var img = this.isZombie ? zombieImg : characterImg;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.webkitImageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.imageSmoothingEnabled = false;

            var drawX = (this.x - this.s1 / 2) * cameraScaleX + xc;
            var drawY = (-this.y - this.s2 / 2) * cameraScaleY + yc;
            var drawW = this.s1 * cameraScaleX;
            var drawH = this.s2 * cameraScaleY;

            ctx.globalAlpha = 0.85;
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            ctx.globalAlpha = 1.0;
        }

        // Draw Health Bar
        Components.healthBar(this);
    }

    animate() {
        if (this.dead) return;
        Components.moveTypeFinder(this);
        Components.shootLazer(this);
        this.move();
        this.createCharacter();
    }
}
