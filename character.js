class Character {

    constructor(name, hitbox, poly, color, xy, maxspeed, slower, gravity, bounciness, speed, moveType, health, lazerType = "ULDR", isZombie = false, zombiePower = "NORMAL") {
        this.id = ++Object.nextId;
        this.name = name;
        this.hitbox = hitbox;
        this.poly = poly;
        this.color = color;
        this.originalColor = color;
        this.x = xy[0];
        this.y = xy[1];
        this.s1 = Math.abs(hitbox[1][0] - hitbox[0][0]);
        this.s2 = Math.abs(hitbox[0][1] - hitbox[3][1]);
        this.w = this.s1;
        this.h = this.s2;
        this.sizeScale = this.s1 / s1;

        this.yspeed = 0;
        this.xspeed = 0;
        this.maxspeed = maxspeed;
        this.slower = slower;
        this.gravity = gravity;
        this.bounciness = bounciness;
        this.onGround = false;
        this.collidedWith = null;
        this.collidedRamp = null;
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
        this.hitFlashTimer = 0;

        this.powerType = null;
        this.powerTimer = 0;
        this.powerTimerMax = 480;

        // Jetpack Joyride state
        this.jetpackFuel = 100;
        this.jetpackMaxFuel = 100;
        this.jetpackFiring = false;
        this.jetpackBulletTimer = 0;

        // Stick Ninja Wall-Jump, Coyote Time, Jump Buffer, Double Jump & Tactile Squash/Stretch state
        this.wallSliding = 0; // -1 left wall, 1 right wall, 0 none
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.dashVX = 0;
        this.dashVY = 0;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.wasUpPressed = false;
        this.wasDownPressed = false;
        this.dropThroughTimer = 0;
        this.airJumps = 1;
        this.maxAirJumps = 1;
        this.fastFalling = false;
        this.techLandingTimer = 0;
        this.scaleX = 1.0;
        this.scaleY = 1.0;

        // Block Grab & Throw state
        this.heldObject = null;
        this.navPath = [];
        this.navTimer = 0;
    }

    tryGrabOrThrow(cursorWorldX, cursorWorldY) {
        if (this.heldObject && !this.heldObject.dead) {
            this.throwHeldObject(cursorWorldX, cursorWorldY);
            return true;
        }

        var maxPlayerReach = godMode ? 2500 : 480;
        var maxCursorReach = godMode ? 400 : 200;
        var bestCrate = null;
        var bestDist = Infinity;

        for (let i = 0; i < movingObjects.length; i++) {
            var m = movingObjects[i];
            if (m.dead || m.heldBy) continue;
            var distToCursor = Math.hypot(m.x - cursorWorldX, m.y - cursorWorldY);
            var distToPlayer = Math.hypot(m.x - this.x, m.y - this.y);
            if (distToPlayer < maxPlayerReach && distToCursor < maxCursorReach) {
                if (distToCursor < bestDist) {
                    bestDist = distToCursor;
                    bestCrate = m;
                }
            }
        }

        if (!bestCrate) {
            for (let i = 0; i < movingObjects.length; i++) {
                var m = movingObjects[i];
                if (m.dead || m.heldBy) continue;
                var dPlayer = Math.hypot(m.x - this.x, m.y - this.y);
                if (dPlayer < (godMode ? 800 : 220) && dPlayer < bestDist) {
                    bestDist = dPlayer;
                    bestCrate = m;
                }
            }
        }

        if (bestCrate) {
            this.heldObject = bestCrate;
            bestCrate.heldBy = this;
            bestCrate.noCollide = true;
            bestCrate.xspeed = 0;
            bestCrate.yspeed = 0;
            Components.addFloatingText("GRABBED! [Click to Throw]", this.x, this.y + 70, "#00f5d4", 16);
            return true;
        }
        return false;
    }

    throwHeldObject(cursorWorldX, cursorWorldY) {
        if (!this.heldObject || this.heldObject.dead) {
            this.heldObject = null;
            return false;
        }
        var block = this.heldObject;
        this.heldObject = null;
        block.heldBy = null;
        block.noCollide = false;
        block.thrownBy = this;
        block.thrownTimer = 50;

        var dx = cursorWorldX - this.x;
        var dy = cursorWorldY - this.y;
        var len = Math.hypot(dx, dy);
        if (len < 0.01) {
            var rad = Math.radians(this.degree);
            dx = Math.sin(rad);
            dy = Math.cos(rad);
        } else {
            dx /= len;
            dy /= len;
        }

        var throwSpeed = godMode ? 32 : 25;
        block.x = this.x + dx * (this.s1 * 0.65 + block.w * 0.55);
        block.y = this.y + dy * (this.s2 * 0.65 + block.h * 0.55);
        block.xspeed = dx * throwSpeed + this.xspeed * 0.35;
        block.yspeed = dy * throwSpeed + 3;

        CollisionDetector.enforceNonPenetration(staticObjects, [block]);
        Components.spawnSparks(block.x, block.y, "#00f5d4", 8);
        return true;
    }

    triggerNinjaDash() {
        if (this.dashCooldown > 0 && !godMode) return;
        var mPos = Components.getMouseWorldPos();
        var dx = mPos[0] - this.x;
        var dy = mPos[1] - this.y;
        if (!useMouseAim || Math.hypot(dx, dy) < 10) {
            var rad = Math.radians(this.degree);
            dx = Math.sin(rad);
            dy = Math.cos(rad);
        }
        var len = Math.hypot(dx, dy) || 1;
        this.dashVX = (dx / len) * 23;
        this.dashVY = (dy / len) * 14 + 1;
        this.dashTimer = 8;
        this.dashCooldown = godMode ? 6 : 42;
        this.scaleX = 1.22;
        this.scaleY = 0.82;
        Components.spawnSparks(this.x, this.y, "#00f5d4", 6);
    }

    takeDamage(amount, knockX = 0, knockY = 0) {
        if (this.dead) return;
        // God Mode protects human players from all damage!
        if (!this.isZombie && (godMode || this.dashTimer > 0)) {
            return;
        }

        this.health += amount;
        this.xspeed += knockX;
        this.yspeed += knockY;
        this.hitFlashTimer = 5;

        if (amount <= -5) {
            Components.addFloatingText(Math.round(amount).toString(), this.x, this.y + this.s2 / 2 + 15, this.isZombie ? "#ffdd44" : "#ff4444", 15);
        }

        if (this.health <= 0) {
            this.health = 0;
            this.handleDeath();
        }
    }

    handleDeath() {
        if (this.heldObject) {
            this.heldObject.heldBy = null;
            this.heldObject.noCollide = false;
            this.heldObject = null;
        }

        if (this.moveType == "ZOMBIE") {
            this.dead = true;

            var basePts = (this.zombiePower == "BOSS_KING" ? 1500 : (this.zombiePower == "TANK" || this.zombiePower == "KNIGHT" ? 300 : (this.zombiePower == "NORMAL" ? 100 : 200)));
            if (comboTimer > 0) {
                combo = Math.min(10, combo + 1);
            } else {
                combo = 1;
            }
            comboTimer = comboTimerMax;
            var earned = basePts * combo;
            score += earned;
            if (score > highScore) {
                highScore = score;
                try {
                    localStorage.setItem("timsZombieGameHighScore", highScore.toString());
                } catch (e) {}
            }

            var popupText = combo > 1 ? ("+" + earned + " (" + combo + "x!)") : ("+" + earned);
            Components.addFloatingText(popupText, this.x, this.y + 45, combo > 1 ? "#ffdd00" : "#55ff88", combo > 1 ? 20 : 16);

            // Slime Split Mechanic: Large Slimes split into 2 fast Mini-Slimes on death!
            if (this.zombiePower == "SLIME") {
                for (let s = -1; s <= 1; s += 2) {
                    var miniBox = Math.makeHitbox(46, 46);
                    var mini = new Character(
                        "Mini_Slime",
                        miniBox,
                        miniBox,
                        "#00f5d4",
                        [this.x + s * 28, this.y + 16],
                        maxspeed * 0.9,
                        slower,
                        gravity,
                        -0.65,
                        speed * 0.82,
                        "ZOMBIE",
                        28,
                        "NONE",
                        true,
                        "MINI_SLIME"
                    );
                    mini.xspeed = s * 7;
                    mini.yspeed = 8;
                    zombies.push(mini);
                }
            }

            // Boss King drops a Royal Treasure Chest + huge coin shower!
            if (this.zombiePower == "BOSS_KING") {
                Components.spawnCoins(this.x, this.y + 30, 14);
                Components.spawnChest(this.x, this.y, "Boss King's Royal Hoard");
                Components.addFloatingText("👑 CITADEL BOSS DEFEATED!", this.x, this.y + 90, "#ffdd00", 24);
            } else {
                var coinCount = (this.zombiePower == "TANK" || this.zombiePower == "KNIGHT") ? 5 : 2;
                Components.spawnCoins(this.x, this.y + 20, coinCount);
            }

            var blastRadius = (this.zombiePower == "EXPLODER") ? 280 : 130;
            var blastDamage = (this.zombiePower == "EXPLODER") ? -35 : -8;
            Components.blowUp(this.x, this.y, this.color, 14, blastRadius, blastDamage, this);

            if (Math.random() < 0.25 && typeof spawnPowerUp === "function") {
                spawnPowerUp(this.x, this.y + 20);
            }
        } else if (!this.isZombie) {
            this.death = true;
            this.isZombie = true;
            this.color = "#2d6e32";
            this.maxHealth = 120;
            this.health = 120;
            this.speed = this.baseSpeed * 1.15;
            this.jumpSpeed = this.baseJumpSpeed * 1.15;
            this.zombiePower = "SPITTER";
            Components.addFloatingText("INFECTED!", this.x, this.y + 60, "#44ff44", 24);
            Components.blowUp(this.x, this.y, "#ff3333", 20, 180, -15, this);

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
        this.maxHealth = 100 + (heroLevel - 1) * 20;
        this.health = this.maxHealth;
        this.speed = this.baseSpeed * (1 + (heroLevel - 1) * 0.04);
        this.jumpSpeed = this.baseJumpSpeed;
        Components.addFloatingText("REVIVED!", this.x, this.y + 60, "#44ffaa", 22);
    }

    applyPowerUp(type) {
        this.powerType = type;
        this.powerTimer = this.powerTimerMax;
        if (type == "SPEED") {
            this.speed = this.baseSpeed * 1.5;
            this.jumpSpeed = this.baseJumpSpeed * 1.25;
            Components.addFloatingText("MEGA SPEED!", this.x, this.y + 60, "#33ddff", 20);
        } else if (type == "RAPID") {
            Components.addFloatingText("TRIPLE LASER!", this.x, this.y + 60, "#ffdd33", 20);
        } else if (type == "HEAL") {
            this.health = Math.min(this.maxHealth, this.health + 50);
            this.jetpackFuel = this.jetpackMaxFuel;
            this.powerTimer = 90;
            Components.addFloatingText("+50 HP & FUEL!", this.x, this.y + 60, "#33ff88", 20);
        } else if (type == "BLOWUP") {
            Components.addFloatingText("MEGA BLAST!", this.x, this.y + 60, "#ff7722", 22);
            Components.blowUp(this.x, this.y, "#ffaa00", 28, 350, -55, this);
            this.powerTimer = 90;
        }
    }

    move() {
        if (this.hitFlashTimer > 0) this.hitFlashTimer--;
        if (this.dashCooldown > 0) this.dashCooldown--;
        if (this.techLandingTimer > 0) this.techLandingTimer--;
        if (this.dropThroughTimer > 0) this.dropThroughTimer--;

        // Smoothly spring squash-and-stretch back to 1.0
        this.scaleX += (1.0 - this.scaleX) * 0.24;
        this.scaleY += (1.0 - this.scaleY) * 0.24;

        if (godMode && !this.isZombie) {
            this.health = this.maxHealth;
            this.jetpackFuel = this.jetpackMaxFuel;
        }

        if (this.powerTimer > 0) {
            this.powerTimer--;
            if (this.powerTimer == 0) {
                this.powerType = null;
                this.speed = this.baseSpeed * (1 + (heroLevel - 1) * 0.04);
                this.jumpSpeed = this.baseJumpSpeed;
            }
        }

        var wasGrounded = this.onGround;
        var preLandSpeedY = this.yspeed;

        // Ground check using SAT (with 5px probe so slopes stay grounded seamlessly)
        if (CollisionDetector.collision(this, [0, -5], allObjects)) {
            this.onGround = true;
            this.coyoteTimer = 7;
            this.airJumps = this.maxAirJumps;
            if (!wasGrounded && preLandSpeedY < -5) {
                // Tactile landing squash & dust!
                var impactRatio = Math.min(1, Math.abs(preLandSpeedY) / 20);
                this.scaleX = 1.0 + impactRatio * 0.26;
                this.scaleY = 1.0 - impactRatio * 0.22;
                if (!this.isZombie) {
                    Components.spawnSparks(this.x, this.y - this.s2 / 2, "#d8e2dc", this.fastFalling ? 10 : 4);
                }
                if (this.fastFalling) {
                    this.fastFalling = false;
                    this.techLandingTimer = 8; // Window for a Tech Super-Jump / Wave-Bounce!
                    screenShake = Math.max(screenShake, 4);
                    // Radial ground-pound shockwave transfers momentum into nearby crates & zombies!
                    for (let i = 0; i < allObjects.length; i++) {
                        var near = allObjects[i];
                        if (near == this || near.dead || !near.movable) continue;
                        var dist = Math.hypot(near.x - this.x, near.y - this.y);
                        if (dist < 170) {
                            var pushSign = near.x >= this.x ? 1 : -1;
                            near.xspeed += pushSign * 9;
                            near.yspeed += 7;
                        }
                    }
                }
            }
            this.fastFalling = false;

            if (this.collidedWith && this.collidedWith.isBumper) {
                this.yspeed = this.collidedWith.bounceForce;
                this.onGround = false;
                this.jump = false;
                this.scaleX = 0.78;
                this.scaleY = 1.28;
                Components.spawnSparks(this.x, this.y - this.s2 / 2, "#ff2e63", 8);
            }
        } else {
            this.onGround = false;
            if (this.coyoteTimer > 0) this.coyoteTimer--;
        }

        // Detect fresh Jump key press for Jump Buffering & Air Double-Jump
        var freshJumpPress = this.upPressed && !this.wasUpPressed;
        this.wasUpPressed = this.upPressed;
        if (freshJumpPress) {
            this.jumpBufferTimer = 7;
        } else if (this.jumpBufferTimer > 0) {
            this.jumpBufferTimer--;
        }

        // Stick Ninja Wall-Slide Detection
        this.wallSliding = 0;
        if (!this.onGround && !this.isZombie) {
            if (this.leftPressed && CollisionDetector.hitsStatic(this, -4, 0, staticObjects)) {
                this.wallSliding = -1;
            } else if (this.rightPressed && CollisionDetector.hitsStatic(this, 4, 0, staticObjects)) {
                this.wallSliding = 1;
            }
            if (this.wallSliding !== 0) {
                this.airJumps = this.maxAirJumps; // Reset air jump on wall touch
                this.fastFalling = false;
                if (this.yspeed < -2.2) {
                    this.yspeed = -2.2;
                    this.jetpackFuel = Math.min(this.jetpackMaxFuel, this.jetpackFuel + 0.8);
                    if (Math.random() < 0.35) {
                        Components.spawnSparks(this.x + this.wallSliding * (this.s1 / 2), this.y, "#cccccc", 1);
                    }
                }
            }
        }

        // Recharge Jetpack on Ground
        if (this.onGround && !this.isZombie) {
            this.jetpackFuel = Math.min(this.jetpackMaxFuel, this.jetpackFuel + 1.8);
        }

        // Stick Ninja Dash Execution + Wavedash Jump Cancel!
        if (this.dashTimer > 0) {
            this.dashTimer--;
            this.xspeed = this.dashVX;
            this.yspeed = this.dashVY;

            // Wavedash: jumping out of a grounded/low dash converts dash into a high-speed horizontal slide-jump!
            if ((this.onGround || this.coyoteTimer > 0) && this.jumpBufferTimer > 0) {
                this.dashTimer = 0;
                this.jumpBufferTimer = 0;
                this.coyoteTimer = 0;
                this.xspeed = Math.sign(this.dashVX || 1) * this.maxspeed * 1.42;
                this.yspeed = 13.5;
                this.scaleX = 1.25;
                this.scaleY = 0.8;
                Components.spawnSparks(this.x, this.y - this.s2 / 2, "#00f5d4", 10);
                Components.addFloatingText("WAVEDASH!", this.x, this.y + 50, "#00f5d4", 15);
            }

            afterImages.push({
                x: this.x,
                y: this.y,
                poly: this.poly,
                color: "#00f5d4",
                life: 10,
                maxLife: 10
            });
            // Slice through nearby zombies during dash!
            for (let z = 0; z < zombies.length; z++) {
                var zom = zombies[z];
                if (!zom.dead && Math.hypot(zom.x - this.x, zom.y - this.y) < this.s1 + 35) {
                    var slashDmg = Math.round(-45 * rpgDamageMult);
                    zom.takeDamage(slashDmg, this.dashVX * 0.5, 6);
                    this.airJumps = this.maxAirJumps; // Hit-confirm resets air jump!
                    Components.addFloatingText("SLASH! " + slashDmg, zom.x, zom.y + 65, "#00f5d4", 20);
                }
            }
        } else {
            // Tactile Arcade Horizontal Movement (snappy turn-around skid + apex air-control boost)
            var isAtJumpApex = !this.onGround && Math.abs(this.yspeed) < 3.4;
            var accel = this.speed * (isAtJumpApex ? 1.25 : 1.12);
            var turnSnap = this.onGround ? (this.speed * 1.85 + this.slower * 1.2) : (this.speed * 1.35 + this.slower * 0.6);

            if (this.rightPressed && !this.leftPressed) {
                if (this.xspeed < 0) {
                    if (this.onGround && this.xspeed < -6 && !this.isZombie && Math.random() < 0.4) {
                        Components.spawnSparks(this.x - this.s1 * 0.3, this.y - this.s2 * 0.45, "#cccccc", 2);
                    }
                    this.xspeed += turnSnap;
                } else {
                    this.xspeed += accel;
                }
            } else if (this.leftPressed && !this.rightPressed) {
                if (this.xspeed > 0) {
                    if (this.onGround && this.xspeed > 6 && !this.isZombie && Math.random() < 0.4) {
                        Components.spawnSparks(this.x + this.s1 * 0.3, this.y - this.s2 * 0.45, "#cccccc", 2);
                    }
                    this.xspeed -= turnSnap;
                } else {
                    this.xspeed -= accel;
                }
            } else if (this.xspeed != 0) {
                var stopFriction = this.onGround ? this.slower * 1.15 : this.slower * 0.35;
                if (Math.abs(this.xspeed) < stopFriction) {
                    this.xspeed = 0;
                } else {
                    this.xspeed = Math.subtractToZero(this.xspeed, stopFriction);
                }
            }

            // Flying Enemy Movement (Bats / Gargoyles ignore gravity and swoop smoothly!)
            if (this.flies || this.zombiePower == "BAT") {
                if (this.upPressed) this.yspeed += this.speed * 0.9;
                else if (this.downPressed) this.yspeed -= this.speed * 0.9;
                else this.yspeed *= 0.85;
                if (this.yspeed > 8) this.yspeed = 8;
                if (this.yspeed < -8) this.yspeed = -8;
            } else {
                // 1. Stick Ninja Wall-Jump!
                if ((this.jumpBufferTimer > 0 || (this.isZombie && this.upPressed)) && this.wallSliding !== 0) {
                    this.xspeed = -this.wallSliding * 13.5;
                    this.yspeed = 13.8;
                    this.wallSliding = 0;
                    this.jumpBufferTimer = 0;
                    this.jumpCoolDown = false;
                    this.scaleX = 0.85;
                    this.scaleY = 1.18;
                    Components.spawnSparks(this.x, this.y, "#ffffff", 5);
                }
                // 2. Ground / Coyote-Time / Tech-Bounce Jump! (Smooth, controlled platformer jump arc)
                else if ((this.jumpBufferTimer > 0 || (this.isZombie && this.upPressed && !this.jumpCoolDown)) && (this.onGround || this.coyoteTimer > 0)) {
                    this.jump = true;
                    this.jumpTimer = 0;
                    this.coyoteTimer = 0;
                    this.jumpBufferTimer = 0;
                    this.onGround = false;

                    var launchY = (this.zombiePower == "LEAPER" || this.zombiePower == "SLIME") ? 11.5 : 7.8;
                    if (this.techLandingTimer > 0 && !this.isZombie) {
                        launchY = 12.5;
                        this.techLandingTimer = 0;
                        Components.spawnSparks(this.x, this.y - this.s2 / 2, "#ffdd00", 8);
                    } else if (!this.isZombie) {
                        Components.spawnSparks(this.x, this.y - this.s2 / 2, "#ffffff", 3);
                    }
                    this.yspeed = Math.max(this.yspeed, launchY);
                    this.scaleX = 0.86;
                    this.scaleY = 1.16;
                }
                // 3. Tactile Mid-Air Double Jump!
                else if (!this.isZombie && freshJumpPress && !this.onGround && this.coyoteTimer <= 0 && this.wallSliding === 0 && this.airJumps > 0) {
                    this.airJumps--;
                    this.jump = true;
                    this.jumpTimer = 3;
                    this.jumpBufferTimer = 0;
                    this.fastFalling = false;
                    this.yspeed = 11.2;
                    if (this.rightPressed && !this.leftPressed) this.xspeed = Math.max(this.xspeed, this.maxspeed * 0.7);
                    if (this.leftPressed && !this.rightPressed) this.xspeed = Math.min(this.xspeed, -this.maxspeed * 0.7);
                    this.scaleX = 0.85;
                    this.scaleY = 1.18;
                    Components.spawnSparks(this.x, this.y - this.s2 / 2, "#00f5d4", 6);
                }

                // Fast-Fall / Dive Slam (Down in Mid-Air) OR Drop-Through Semi-Solid Interior Floor (Press Down on Ground)
                var freshDownPress = this.downPressed && !this.wasDownPressed;
                this.wasDownPressed = this.downPressed;
                if (this.downPressed) {
                    this.jump = false;
                    if (this.onGround && !this.isZombie && freshDownPress && !this.collidedRamp &&
                        this.collidedWith && CollisionDetector.isSemiSolidPlatform(this.collidedWith)) {
                        this.dropThroughTimer = 14;
                        this.onGround = false;
                        this.coyoteTimer = 0;
                        this.y -= 4;
                        this.yspeed = -3.5;
                    } else if (!this.onGround) {
                        if (!this.fastFalling && this.yspeed < 4 && !this.isZombie) {
                            this.fastFalling = true;
                            this.scaleX = 0.84;
                            this.scaleY = 1.18;
                        }
                        this.yspeed -= this.gravity * 1.3;
                    }
                }

                // Variable Jump Hold & Short-Hop Release Cut
                if (this.jump) {
                    this.jumpTimer += 1;
                    var maxJumpFrames = (this.zombiePower == "LEAPER") ? jumpTimeMax * 1.15 : jumpTimeMax * 0.8;
                    if (maxJumpFrames > this.jumpTimer && this.upPressed) {
                        this.yspeed += this.jumpSpeed * 0.44;
                    } else {
                        if (!this.upPressed && this.yspeed > 5) {
                            this.yspeed *= 0.65;
                        }
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
                        var gravMult = isAtJumpApex ? 0.62 : (this.yspeed < 0 ? 1.08 : 1.0);
                        this.yspeed -= this.gravity * gravMult;
                    }
                }
            }

            // Jetpack Joyride Machine-Gun Jetpack! (Hold Space in 1P or Up while airborne)
            this.jetpackFiring = false;
            var wantJetpack = !this.isZombie && jetpackEnabled && (SpacePressed || (godMode && this.upPressed && !this.onGround));
            if (wantJetpack && (this.jetpackFuel > 0 || godMode)) {
                this.jetpackFiring = true;
                this.fastFalling = false;
                if (!godMode) {
                    this.jetpackFuel = Math.max(0, this.jetpackFuel - 0.65);
                }
                this.yspeed = Math.min(11.5, this.yspeed + this.gravity * 1.75);
                this.jetpackBulletTimer++;

                // Exhaust flame particles
                particles.push({
                    x: this.x + (Math.random() - 0.5) * 26,
                    y: this.y - this.s2 / 2 - 4,
                    xspeed: (Math.random() - 0.5) * 3,
                    yspeed: -6 - Math.random() * 5,
                    poly: Math.makeHitbox(9, 9),
                    color: Math.random() < 0.5 ? "#ff9900" : "#ffdd00",
                    life: 9
                });

                // Fire downward machine-gun bullets (Jetpack Joyride style!)
                if (this.jetpackBulletTimer % 4 === 0) {
                    var spread = (Math.random() - 0.5) * 0.22;
                    lazers.push({
                        x: this.x + (Math.random() - 0.5) * 22,
                        y: this.y - this.s2 / 2 - 8,
                        xspeed: spread * lazerSpeed,
                        yspeed: -lazerSpeed * 0.95,
                        hitbox: Math.makeHitbox(10, 16),
                        poly: Math.makeHitbox(10, 16),
                        color: "#ffbe0b",
                        owner: this,
                        fromZombie: false,
                        damage: Math.round(lazerDamage * 0.85 * rpgDamageMult),
                        life: 55
                    });
                }
            }
        }

        // Max Speed
        var curMaxSpeed = (this.powerType == "SPEED" || godMode || this.dashTimer > 0) ? this.maxspeed * 1.45 : this.maxspeed;
        if (this.xspeed > curMaxSpeed) this.xspeed = curMaxSpeed;
        if (this.xspeed < -curMaxSpeed) this.xspeed = -curMaxSpeed;
        if (this.yspeed > curMaxSpeed) this.yspeed = curMaxSpeed;
        if (this.yspeed < -curMaxSpeed) this.yspeed = -curMaxSpeed;

        // Sub-stepped movement so characters never tunnel or clip into ramps or other objects
        var maxSteps = this.isZombie ? 2 : 3;
        var steps = Math.min(maxSteps, Math.max(1, Math.ceil(Math.hypot(this.xspeed, this.yspeed) / 10)));
        var stepX = this.xspeed / steps;
        var stepY = this.yspeed / steps;

        for (let s = 0; s < steps; s++) {
            if (stepX != 0) {
                var dirX = Math.sign(stepX);
                if (CollisionDetector.collision(this, [stepX, 0], allObjects)) {
                    var hitX = this.collidedWith;
                    this.handleCharacterCollision(hitX);
                    if (this.collidedRamp) {
                        var climbY = this.yOver;
                        if (!CollisionDetector.hitsStatic(this, stepX, climbY + 0.5, staticObjects, this.collidedRamp)) {
                            this.x += stepX;
                            this.y += climbY;
                            this.onGround = true;
                            this.coyoteTimer = 7;
                            // Smooth shallow-angle glide onto an uphill ramp/stair: absorb downward yspeed so stepY doesn't slam
                            if (this.yspeed < 0) {
                                this.yspeed = 0;
                                stepY = 0;
                            }
                        } else {
                            this.xspeed = 0;
                            stepX = 0;
                        }
                    } else {
                        this.x += stepX + this.xOver;
                        if (hitX && hitX.movable) {
                            var couldMove = CollisionDetector.transferMomentum(this, hitX, dirX, 0);
                            if (couldMove) {
                                this.xspeed *= 0.45; // Follow through when pushing an unblocked object
                            } else {
                                this.xspeed = this.xspeed * this.bounciness;
                            }
                        } else {
                            this.xspeed = this.xspeed * this.bounciness;
                        }
                        if (Math.abs(this.xspeed) < this.slower) {
                            this.xspeed = 0;
                        }
                        stepX = 0;
                    }
                } else {
                    this.x += stepX;
                    CollisionDetector.snapDownToRamp(this, stepX, staticObjects);
                }
            }

            if (stepY != 0) {
                var dirY = Math.sign(stepY);
                if (CollisionDetector.collision(this, [0, stepY], allObjects)) {
                    var hitY = this.collidedWith;
                    this.y += stepY + this.yOver;
                    this.handleCharacterCollision(hitY);

                    if (hitY && hitY.isBumper && this.yspeed <= 0) {
                        this.yspeed = hitY.bounceForce;
                        this.jump = false;
                        Components.spawnSparks(this.x, this.y - this.s2 / 2, "#ff2e63", 8);
                    } else if (this.collidedRamp) {
                        // Smooth landing / shallow-angle glide onto a ramp without bounce or ceiling-bonk!
                        if (stepY < 0 && this.collidedRamp.isRamp) {
                            var slideSign = (this.collidedRamp.rampDir == "left") ? 1 : -1;
                            var slopeRatio = this.collidedRamp.h / Math.max(40, this.collidedRamp.w);
                            // Redirect downward landing momentum smoothly into downhill slope glide
                            if (this.xspeed * slideSign >= -1) {
                                this.xspeed += slideSign * Math.min(8, Math.abs(this.yspeed) * slopeRatio * 0.45);
                            }
                        }
                        if (this.yspeed < 0) this.yspeed = 0;
                        this.onGround = true;
                        this.coyoteTimer = 7;
                    } else {
                        if (hitY && hitY.movable) {
                            CollisionDetector.transferMomentum(this, hitY, 0, dirY);
                        }
                        if (this.yspeed > 0) {
                            this.jump = false;
                        }
                        this.yspeed = this.yspeed * this.bounciness;
                        if (Math.abs(this.yspeed) < this.gravity * 2.2) {
                            this.yspeed = 0;
                        }
                    }
                    stepY = 0;
                } else {
                    this.y += stepY;
                }
            }
        }

        // Fast proximity check only against opposing Characters (instead of scanning all 200 static objects twice!)
        if (!this.isZombie) {
            for (let z = 0; z < zombies.length; z++) {
                var zom = zombies[z];
                if (!zom.dead && Math.abs(zom.x - this.x) <= (this.s1 + zom.s1) * 0.5 + 3 && Math.abs(zom.y - this.y) <= (this.s2 + zom.s2) * 0.5 + 3) {
                    this.handleCharacterCollision(zom);
                }
            }
        }

        if (this.y < -3200) {
            this.takeDamage(-25, 0, 0);
            this.x = 0;
            this.y = 550;
            this.xspeed = 0;
            this.yspeed = 0;
        }

        this.yspeed = Math.round(this.yspeed * rounder) / rounder;
        this.xspeed = Math.round(this.xspeed * rounder) / rounder;
        this.x = Math.round(this.x * rounder) / rounder;
        this.y = Math.round(this.y * rounder) / rounder;
    }

    handleCharacterCollision(other) {
        if (!other || !(other instanceof Character)) return;
        if (this.isZombie && !other.isZombie) {
            other.takeDamage(zombieDamage * 2.5, (other.x > this.x ? 4 : -4), 2);
        } else if (!this.isZombie && other.isZombie) {
            this.takeDamage(zombieDamage * 2.5, (this.x > other.x ? 4 : -4), 2);
        }
    }

    createCharacter() {
        // Draw God Mode golden halo if active
        if (!this.isZombie && godMode) {
            var gx = (this.x - this.s1 * 0.62) * cameraScaleX + xc;
            var gy = (-this.y - this.s2 * 0.62) * cameraScaleY + yc;
            ctx.save();
            ctx.strokeStyle = "#ffdd00";
            ctx.lineWidth = 3;
            ctx.strokeRect(gx, gy, this.s1 * 1.24 * cameraScaleX, this.s2 * 1.24 * cameraScaleY);
            ctx.restore();
        }

        // Draw Stick Ninja fluttering headband ribbon
        if (!this.isZombie) {
            var dirSign = this.xspeed >= 0 ? -1 : 1;
            var hx = (this.x + dirSign * (this.s1 * 0.5)) * cameraScaleX + xc;
            var hy = (-this.y - this.s2 * 0.28) * cameraScaleY + yc;
            ctx.save();
            ctx.strokeStyle = "#e63946";
            ctx.lineWidth = 4 * cameraScaleX;
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(hx + dirSign * 22 * cameraScaleX, hy + Math.sin(Date.now() * 0.02) * 8 * cameraScaleY);
            ctx.stroke();
            ctx.restore();
        }

        var sx = this.scaleX || 1.0;
        var sy = this.scaleY || 1.0;
        var visualW = this.s1 * sx;
        var visualH = this.s2 * sy;
        var visualY = (this.y - this.s2 / 2) + visualH / 2;

        var drawColor = (this.hitFlashTimer > 0) ? "#FFFFFF" : this.color;
        var drawX = (this.x - visualW / 2) * cameraScaleX + xc;
        var drawY = (-visualY - visualH / 2) * cameraScaleY + yc;
        var drawW = visualW * cameraScaleX;
        var drawH = visualH * cameraScaleY;

        // Viewport culling for off-screen characters/enemies
        if (drawX + drawW < -80 || drawX > canvas.width + 80 || drawY + drawH < -80 || drawY > canvas.height + 80) {
            return;
        }

        // Custom Distinct Artwork for Non-Zombie Enemy Archetypes (Bats, Slimes, Archers, Knights, Mages, Bosses)
        var customEnemyTypes = ["BAT", "SLIME", "MINI_SLIME", "ARCHER", "KNIGHT", "MAGE", "BOSS_KING"];
        if (this.isZombie && customEnemyTypes.indexOf(this.zombiePower) !== -1) {
            ctx.save();
            var cx = this.x * cameraScaleX + xc;
            var cy = -visualY * cameraScaleY + yc;
            var facing = (this.xspeed >= 0) ? 1 : -1;

            if (this.zombiePower == "BAT") {
                // Flapping Winged Cave Bat / Gargoyle
                var flap = Math.sin(Date.now() * 0.025 + this.id) * 18 * cameraScaleY;
                ctx.fillStyle = drawColor;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx - drawW * 0.95, cy - drawH * 0.4 + flap);
                ctx.lineTo(cx - drawW * 0.45, cy + drawH * 0.25);
                ctx.lineTo(cx + drawW * 0.45, cy + drawH * 0.25);
                ctx.lineTo(cx + drawW * 0.95, cy - drawH * 0.4 + flap);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = "#2b193d";
                ctx.fillRect(cx - drawW * 0.3, cy - drawH * 0.3, drawW * 0.6, drawH * 0.6);
                ctx.fillStyle = "#ff2e63";
                ctx.fillRect(cx - 8 * cameraScaleX, cy - 4 * cameraScaleY, 5 * cameraScaleX, 5 * cameraScaleY);
                ctx.fillRect(cx + 3 * cameraScaleX, cy - 4 * cameraScaleY, 5 * cameraScaleX, 5 * cameraScaleY);
            }
            else if (this.zombiePower == "SLIME" || this.zombiePower == "MINI_SLIME") {
                // Translucent Gelatinous Acid/Magma Slime with Inner Core
                ctx.globalAlpha = 0.78;
                ctx.fillStyle = drawColor;
                ctx.fillRect(drawX, drawY, drawW, drawH);
                ctx.globalAlpha = 1.0;
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.strokeRect(drawX, drawY, drawW, drawH);
                ctx.fillStyle = "#104547";
                ctx.fillRect(cx - drawW * 0.2, cy - drawH * 0.15, drawW * 0.4, drawH * 0.4);
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(cx + facing * 6 * cameraScaleX - 10 * cameraScaleX, cy - 8 * cameraScaleY, 6 * cameraScaleX, 6 * cameraScaleY);
                ctx.fillRect(cx + facing * 6 * cameraScaleX + 4 * cameraScaleX, cy - 8 * cameraScaleY, 6 * cameraScaleX, 6 * cameraScaleY);
            }
            else if (this.zombiePower == "ARCHER") {
                // Skeleton Bowyer with Hood & Drawn Bow
                Polygon.create(Math.makeHitbox(visualW, visualH), drawColor, { x: this.x, y: visualY });
                ctx.fillStyle = "#1d2d44";
                ctx.fillRect(drawX + 4, drawY + 4, drawW - 8, drawH * 0.45);
                ctx.fillStyle = "#00f5d4";
                ctx.fillRect(cx + facing * 6 * cameraScaleX - 8 * cameraScaleX, drawY + drawH * 0.2, 5 * cameraScaleX, 5 * cameraScaleY);
                ctx.fillRect(cx + facing * 6 * cameraScaleX + 3 * cameraScaleX, drawY + drawH * 0.2, 5 * cameraScaleX, 5 * cameraScaleY);
                // Drawn Wooden Bow
                ctx.strokeStyle = "#d9a05b";
                ctx.lineWidth = 3 * cameraScaleX;
                ctx.beginPath();
                ctx.arc(cx + facing * drawW * 0.45, cy, drawH * 0.4, -Math.PI * 0.45, Math.PI * 0.45, facing < 0);
                ctx.stroke();
            }
            else if (this.zombiePower == "KNIGHT") {
                // Armored Dark Knight with Crimson Plume, T-Visor & Shield
                Polygon.create(Math.makeHitbox(visualW, visualH), drawColor, { x: this.x, y: visualY });
                // Crimson helmet plume
                ctx.fillStyle = "#e63946";
                ctx.fillRect(cx - 10 * cameraScaleX, drawY - 10 * cameraScaleY, 20 * cameraScaleX, 10 * cameraScaleY);
                // Dark T-Visor
                ctx.fillStyle = "#0b090a";
                ctx.fillRect(drawX + drawW * 0.2, drawY + drawH * 0.2, drawW * 0.6, 6 * cameraScaleY);
                ctx.fillRect(cx - 3 * cameraScaleX, drawY + drawH * 0.2, 6 * cameraScaleX, drawH * 0.28);
                // Steel Shield
                ctx.fillStyle = "#8d99ae";
                ctx.strokeStyle = "#edf2f4";
                ctx.lineWidth = 2;
                ctx.fillRect(cx + facing * drawW * 0.35 - 8 * cameraScaleX, cy - drawH * 0.25, 16 * cameraScaleX, drawH * 0.55);
                ctx.strokeRect(cx + facing * drawW * 0.35 - 8 * cameraScaleX, cy - drawH * 0.25, 16 * cameraScaleX, drawH * 0.55);
            }
            else if (this.zombiePower == "MAGE") {
                // Cloaked Necromancer Mage with Glowing Staff
                Polygon.create(Math.makeHitbox(visualW, visualH), drawColor, { x: this.x, y: visualY });
                ctx.fillStyle = "#ffbe0b";
                ctx.fillRect(cx - 9 * cameraScaleX, drawY + drawH * 0.22, 6 * cameraScaleX, 6 * cameraScaleY);
                ctx.fillRect(cx + 3 * cameraScaleX, drawY + drawH * 0.22, 6 * cameraScaleX, 6 * cameraScaleY);
                // Arcane Orb Staff
                var staffX = cx + facing * (drawW * 0.55 + 6 * cameraScaleX);
                ctx.strokeStyle = "#9c6644";
                ctx.lineWidth = 3 * cameraScaleX;
                ctx.beginPath();
                ctx.moveTo(staffX, drawY + drawH);
                ctx.lineTo(staffX, drawY - 8 * cameraScaleY);
                ctx.stroke();
                ctx.fillStyle = "#e0aaff";
                ctx.beginPath();
                ctx.arc(staffX, drawY - 10 * cameraScaleY, 7 * cameraScaleX, 0, Math.PI * 2);
                ctx.fill();
            }
            else if (this.zombiePower == "BOSS_KING") {
                // Giant Citadel Boss King with Golden 3-Pointed Crown!
                Polygon.create(Math.makeHitbox(visualW, visualH), drawColor, { x: this.x, y: visualY });
                ctx.fillStyle = "#ffdd00";
                ctx.beginPath();
                ctx.moveTo(drawX + drawW * 0.15, drawY);
                ctx.lineTo(drawX + drawW * 0.15, drawY - 22 * cameraScaleY);
                ctx.lineTo(drawX + drawW * 0.38, drawY - 8 * cameraScaleY);
                ctx.lineTo(cx, drawY - 26 * cameraScaleY);
                ctx.lineTo(drawX + drawW * 0.62, drawY - 8 * cameraScaleY);
                ctx.lineTo(drawX + drawW * 0.85, drawY - 22 * cameraScaleY);
                ctx.lineTo(drawX + drawW * 0.85, drawY);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = "#9c4100";
                ctx.lineWidth = 2;
                ctx.stroke();
                // Glowing Boss Eyes
                ctx.fillStyle = "#ff2e63";
                ctx.fillRect(cx - 18 * cameraScaleX, drawY + drawH * 0.24, 10 * cameraScaleX, 8 * cameraScaleY);
                ctx.fillRect(cx + 8 * cameraScaleX, drawY + drawH * 0.24, 10 * cameraScaleX, 8 * cameraScaleY);
            }
            ctx.restore();
        } else {
            Polygon.create(Math.makeHitbox(visualW, visualH), drawColor, { x: this.x, y: visualY });

            var img = this.isZombie ? zombieImg : characterImg;
            if (img && img.complete && img.naturalWidth > 0 && this.hitFlashTimer == 0) {
                ctx.webkitImageSmoothingEnabled = false;
                ctx.mozImageSmoothingEnabled = false;
                ctx.imageSmoothingEnabled = false;

                ctx.globalAlpha = 0.85;
                ctx.drawImage(img, drawX, drawY, drawW, drawH);
                ctx.globalAlpha = 1.0;
            }
        }

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
