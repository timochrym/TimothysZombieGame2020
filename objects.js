class Object {

    constructor(name, hitbox, poly, color, xy, maxspeed = 0, slower = 0, gravity = 0, bounciness = 0, movable = false, options = {}) {
        this.id = ++Object.nextId;
        this.name = name;
        this.hitbox = hitbox;
        this.poly = poly;
        this.color = color;
        this.x = xy[0];
        this.y = xy[1];
        this.w = options.w || Math.abs(hitbox[1][0] - hitbox[0][0]);
        this.h = options.h || Math.abs(hitbox[0][1] - hitbox[3][1]);
        this.yspeed = 0;
        this.xspeed = 0;
        this.maxspeed = maxspeed || window.maxspeed || 20;
        this.slower = slower || (window.slower ? window.slower * 0.45 : 0.8);
        this.gravity = gravity || window.gravity || 0.8;
        this.bounciness = (bounciness !== undefined && bounciness !== 0) ? bounciness : (window.bounciness || -0.35);
        this.movable = movable;
        this.onGround = false;
        this.collidedWith = null;
        this.xOver = 0;
        this.yOver = 0;

        this.isRamp = options.isRamp || false;
        this.rampDir = options.rampDir || "right";
        this.isBumper = options.isBumper || false;
        this.bounceForce = options.bounceForce || 22;
        this.explosive = options.explosive || false;
        this.isInfiniteBase = options.isInfiniteBase || false;
        this.baseOffsetX = options.baseOffsetX || 0;
        this.texture = options.texture !== undefined ? options.texture : (movable && !this.explosive ? "crate_plank" : null);
        this.health = options.health || (this.explosive ? 25 : 9999);
        this.dead = false;

        // Grab & Throw properties
        this.heldBy = null;
        this.thrownTimer = 0;
        this.thrownBy = null;
        this.noCollide = false;
    }

    resize(newW, newH) {
        this.w = Math.max(16, newW);
        this.h = Math.max(16, newH);
        this.hitbox = Math.makeHitbox(this.w, this.h);
        if (this.isRamp) {
            var hw = this.w / 2;
            var hh = this.h / 2;
            if (this.rampDir == "left") {
                this.poly = [[-hw, hh], [hw, -hh], [-hw, -hh]];
            } else {
                this.poly = [[-hw, -hh], [hw, hh], [hw, -hh]];
            }
        } else {
            this.poly = Math.makeHitbox(this.w, this.h);
        }
    }

    static addBox(x, y, w, h, color = "#243b4a", options = {}) {
        var box = Math.makeHitbox(w, h);
        var opts = { w: w, h: h, name: options.name || "Platform", ...options };
        var obj = new Object(opts.name, box, box, color, [x, y], 0, 0, 0, 0, false, opts);
        staticObjects.push(obj);
        return obj;
    }

    static addRamp(x, y, w, h, direction = "right", color = "#315368", options = {}) {
        var hw = w / 2;
        var hh = h / 2;
        var hitbox = Math.makeHitbox(w, h);
        var triPoly;
        if (direction == "left") {
            triPoly = [[-hw, hh], [hw, -hh], [-hw, -hh]];
        } else {
            triPoly = [[-hw, -hh], [hw, hh], [hw, -hh]];
        }
        var opts = { w: w, h: h, isRamp: true, rampDir: direction, name: options.name || ("Ramp (" + direction + ")"), ...options };
        var obj = new Object(opts.name, hitbox, triPoly, color, [x, y], 0, 0, 0, 0, false, opts);
        staticObjects.push(obj);
        return obj;
    }

    static addBumper(x, y, w = 130, h = 26, bounceForce = 22, color = "#ff2e63", options = {}) {
        var box = Math.makeHitbox(w, h);
        var opts = {
            w: w,
            h: h,
            isBumper: true,
            bounceForce: bounceForce,
            name: options.name || "Bounce Pad",
            ...options
        };
        var obj = new Object(opts.name, box, box, color, [x, y], 0, 0, 0, 0, false, opts);
        staticObjects.push(obj);
        return obj;
    }

    static addCrate(x, y, size = 72, color = "#d9a05b", options = {}) {
        var w = options.w || size;
        var h = options.h || size;
        var box = Math.makeHitbox(w, h);
        var isExplosive = options.explosive || false;
        var crateColor = isExplosive ? "#e84545" : color;
        var opts = { w: w, h: h, name: options.name || (isExplosive ? "TNT Barrel" : "Crate"), ...options };
        var obj = new Object(
            opts.name,
            box,
            box,
            crateColor,
            [x, y],
            maxspeed * 1.4,
            slower * 0.45,
            gravity,
            options.bounciness !== undefined ? options.bounciness : bounciness,
            true,
            opts
        );
        movingObjects.push(obj);
        return obj;
    }

    static loadMap(items) {
        for (let i = 0; i < items.length; i++) {
            var it = items[i];
            if (it.type == "box") {
                Object.addBox(it.x, it.y, it.w, it.h, it.color, it);
            } else if (it.type == "ramp") {
                Object.addRamp(it.x, it.y, it.w, it.h, it.dir || "right", it.color, it);
            } else if (it.type == "bumper") {
                Object.addBumper(it.x, it.y, it.w, it.h, it.bounce || 22, it.color, it);
            } else if (it.type == "crate") {
                Object.addCrate(it.x, it.y, it.size || 72, it.color, it);
            }
        }
        if (typeof Pathfinder !== "undefined") Pathfinder.rebuildGraph(true);
    }

    takeDamage(amount) {
        if (!this.explosive || this.dead) return;
        this.health += amount;
        if (this.health <= 0) {
            this.dead = true;
            if (this.heldBy) {
                this.heldBy.heldObject = null;
                this.heldBy = null;
            }
            Components.addFloatingText("BOOM!", this.x, this.y + 40, "#ffaa00", 24);
            Components.blowUp(this.x, this.y, "#ff5522", 26, 300, -45, this);
        }
    }

    move() {
        if (this.dead) return;

        // If currently held by a player, hover smoothly toward their cursor aim!
        if (this.heldBy && !this.heldBy.dead) {
            this.noCollide = true;
            var holder = this.heldBy;
            var rad = Math.radians(holder.degree);
            var targetX = holder.x + Math.sin(rad) * (holder.s1 * 0.75 + this.w * 0.45);
            var targetY = holder.y + Math.cos(rad) * (holder.s2 * 0.65 + this.h * 0.45) + 25;
            this.x += (targetX - this.x) * 0.45;
            this.y += (targetY - this.y) * 0.45;
            this.xspeed = 0;
            this.yspeed = 0;
            return;
        }
        this.noCollide = false;

        if (this.thrownTimer > 0) {
            this.thrownTimer--;
        }

        // Ground check using SAT
        if (CollisionDetector.collision(this, [0, -3], allObjects)) {
            this.onGround = true;
            if (this.collidedWith && this.collidedWith.isBumper) {
                this.yspeed = this.collidedWith.bounceForce;
                this.onGround = false;
            } else if (this.collidedRamp) {
                // Smooth natural gravity slide when a crate rests on a ramp slope
                var slideSign = (this.collidedRamp.rampDir == "left") ? 1 : -1;
                var slopeRatio = this.collidedRamp.h / Math.max(40, this.collidedRamp.w);
                if (slopeRatio > 0.35) {
                    this.xspeed += slideSign * this.gravity * slopeRatio * 0.55;
                }
            }
        } else {
            this.onGround = false;
        }

        if (this.onGround == false) {
            this.yspeed -= this.gravity;
        }

        if (this.xspeed != 0) {
            var fric = this.onGround ? this.slower * 0.55 : this.slower * 0.08;
            this.xspeed = Math.subtractToZero(this.xspeed, fric);
            if (Math.abs(this.xspeed) < fric) {
                this.xspeed = 0;
            }
        }

        var limit = this.thrownTimer > 0 ? this.maxspeed * 1.45 : this.maxspeed;
        if (this.xspeed > limit) this.xspeed = limit;
        if (this.xspeed < -limit) this.xspeed = -limit;
        if (this.yspeed > limit) this.yspeed = limit;
        if (this.yspeed < -limit) this.yspeed = -limit;

        // Sub-stepped movement so fast thrown crates can never tunnel through ramps or walls
        if (this.xspeed === 0 && this.yspeed === 0) return;
        var steps = Math.min(3, Math.max(1, Math.ceil(Math.hypot(this.xspeed, this.yspeed) / 12)));
        var stepX = this.xspeed / steps;
        var stepY = this.yspeed / steps;

        for (let s = 0; s < steps; s++) {
            // X Step
            if (stepX != 0) {
                var dirX = Math.sign(stepX);
                if (CollisionDetector.collision(this, [stepX, 0], allObjects)) {
                    var hitX = this.collidedWith;
                    this.checkThrownImpact(hitX);
                    if (this.dead) return;

                    if (this.collidedRamp) {
                        var climbY = this.yOver;
                        if (!CollisionDetector.hitsStatic(this, stepX, climbY + 0.5, staticObjects, this.collidedRamp)) {
                            this.x += stepX;
                            this.y += climbY;
                            this.onGround = true;
                            if (this.yspeed < 0) {
                                this.yspeed = 0;
                                stepY = 0;
                            }
                        } else {
                            stepX = 0;
                            this.xspeed = 0;
                        }
                    } else {
                        this.x += stepX + this.xOver;
                        if (hitX && (hitX.movable || hitX instanceof Character)) {
                            var couldMove = CollisionDetector.transferMomentum(this, hitX, dirX, 0);
                            if (couldMove) {
                                this.xspeed *= 0.35; // Smooth follow-through after transferring momentum
                            } else {
                                this.xspeed *= this.bounciness;
                            }
                        } else {
                            this.xspeed = this.xspeed * this.bounciness;
                        }
                        if (Math.abs(this.xspeed) < this.slower) this.xspeed = 0;
                        stepX = 0;
                    }
                } else {
                    this.x += stepX;
                    CollisionDetector.snapDownToRamp(this, stepX, staticObjects);
                }
            }

            // Y Step
            if (stepY != 0) {
                var dirY = Math.sign(stepY);
                if (CollisionDetector.collision(this, [0, stepY], allObjects)) {
                    var hitY = this.collidedWith;
                    this.checkThrownImpact(hitY);
                    if (this.dead) return;

                    this.y += stepY + this.yOver;
                    if (hitY && hitY.isBumper && this.yspeed <= 0) {
                        this.yspeed = hitY.bounceForce;
                        Components.spawnSparks(this.x, this.y - 30, "#ff2e63", 6);
                    } else if (this.collidedRamp && stepY < 0) {
                        // Smooth landing on a ramp: redirect downward momentum along the slope instead of bouncing vertically
                        var slideDir = (this.collidedRamp.rampDir == "left") ? 1 : -1;
                        var slopeRatio = this.collidedRamp.h / Math.max(40, this.collidedRamp.w);
                        this.xspeed += slideDir * Math.abs(this.yspeed) * slopeRatio * 0.65;
                        this.yspeed = 0;
                        this.onGround = true;
                    } else {
                        if (hitY && (hitY.movable || hitY instanceof Character)) {
                            CollisionDetector.transferMomentum(this, hitY, 0, dirY);
                        }
                        this.yspeed = this.yspeed * this.bounciness;
                        if (Math.abs(this.yspeed) < this.gravity * 2.5) {
                            this.yspeed = 0;
                        }
                    }
                    stepY = 0;
                } else {
                    this.y += stepY;
                }
            }
        }

        if (this.y < -3200) {
            this.x = (Math.random() - 0.5) * 800;
            this.y = 650;
            this.xspeed = 0;
            this.yspeed = 0;
        }

        this.x = Math.round(this.x * rounder) / rounder;
        this.y = Math.round(this.y * rounder) / rounder;
        this.yspeed = Math.round(this.yspeed * rounder) / rounder;
        this.xspeed = Math.round(this.xspeed * rounder) / rounder;
    }

    checkThrownImpact(hitObj) {
        if (!hitObj) return;
        var speedMag = Math.hypot(this.xspeed, this.yspeed);
        if (this.thrownTimer > 0 || speedMag > 10) {
            if (this.explosive && (hitObj instanceof Character || speedMag > 14)) {
                this.takeDamage(-999);
                return;
            }
            if (hitObj instanceof Character && hitObj != this.thrownBy) {
                var dmg = -Math.round(Math.min(65, speedMag * 2.5));
                hitObj.takeDamage(dmg, this.xspeed * 0.6, Math.abs(this.yspeed) * 0.4 + 4);
                Components.addFloatingText("SMASH! " + dmg, hitObj.x, hitObj.y + 55, "#00f5d4", 20);
                Components.spawnSparks(this.x, this.y, this.color, 10);
                this.xspeed *= -0.4;
                this.yspeed = 4;
                this.thrownTimer = 0;
            }
        }
    }

    drawDecorations() {
        var sx = this.x * cameraScaleX + xc;
        var sy = -this.y * cameraScaleY + yc;
        if (sx < -160 || sx > canvas.width + 160 || sy < -160 || sy > canvas.height + 160) {
            if (!this.heldBy) return;
        }
        if (this.explosive) {
            ctx.fillStyle = "#ffdd55";
            ctx.font = "bold " + Math.round(14 * cameraScaleX) + "px monospace";
            ctx.textAlign = "center";
            ctx.fillText("TNT", sx, sy + 5 * cameraScaleY);
        } else if (this.isBumper) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold " + Math.round(12 * cameraScaleX) + "px monospace";
            ctx.textAlign = "center";
            ctx.fillText("▲ BOUNCE ▲", sx, sy + 4 * cameraScaleY);
        }

        // Draw grab tether & highlight if held by a player
        if (this.heldBy) {
            var hx = this.heldBy.x * cameraScaleX + xc;
            var hy = -this.heldBy.y * cameraScaleY + yc;
            var bx = this.x * cameraScaleX + xc;
            var by = -this.y * cameraScaleY + yc;
            ctx.save();
            ctx.strokeStyle = "#00f5d4";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(bx, by);
            ctx.stroke();
            ctx.strokeRect(bx - (this.w / 2) * cameraScaleX - 3, by - (this.h / 2) * cameraScaleY - 3, this.w * cameraScaleX + 6, this.h * cameraScaleY + 6);
            ctx.restore();
        }
    }

    staticObject() {
        if (this.dead) return;
        if (this.isInfiniteBase && typeof cameraTargetX !== "undefined") {
            this.x = Math.round(cameraTargetX / 960) * 960 + (this.baseOffsetX || 0);
        }
        Polygon.create(this.poly, this.color, this);
        this.drawDecorations();
    }

    movingObject() {
        if (this.dead) return;
        this.movable = true;
        this.move();
        Polygon.create(this.poly, this.color, this);
        this.drawDecorations();
    }
}

Object.nextId = 0;
