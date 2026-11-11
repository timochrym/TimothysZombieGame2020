// ============================================================================
// POWER-UP CATALOGUE  (duration in frames @60fps, 0 = instant)
// ============================================================================
var PowerUpDefs = {
    RAPID:   { label: "TRIPLE LASER",  icon: "✦", color: "#ffdd33", duration: 420, weight: 10, desc: "3-way rapid fire" },
    SPEED:   { label: "MEGA SPEED",    icon: "»", color: "#33ddff", duration: 420, weight: 10, desc: "Faster + higher jump" },
    HEAL:    { label: "MEDKIT",        icon: "+", color: "#33ff88", duration: 0,   weight: 8,  desc: "+35 HP & full fuel" },
    BLOWUP:  { label: "MEGA BLAST",    icon: "✹", color: "#ff7722", duration: 0,   weight: 6,  desc: "Huge explosion" },
    SHIELD:  { label: "ENERGY SHIELD", icon: "◉", color: "#6ee7ff", duration: 630, weight: 9,  desc: "Absorbs 60 damage" },
    FREEZE:  { label: "FROST NOVA",    icon: "❄", color: "#bdeaff", duration: 0,   weight: 7,  desc: "Freezes all nearby enemies" },
    MAGNET:  { label: "COIN MAGNET",   icon: "⊛", color: "#f9a8d4", duration: 630, weight: 6,  desc: "Pulls in coins & drops" },
    BERSERK: { label: "BERSERK",       icon: "♨", color: "#ff5a1f", duration: 380, weight: 7,  desc: "Double damage, big shots" },
    ORBIT:   { label: "BLADE ORBIT",   icon: "✧", color: "#d946ef", duration: 500, weight: 7,  desc: "3 spinning blades shred foes" },
    HOMING:  { label: "HOMING SHOTS",  icon: "◎", color: "#a3e635", duration: 500, weight: 7,  desc: "Bullets seek enemies" },
    CHAIN:   { label: "CHAIN LIGHTNING", icon: "ϟ", color: "#fde047", duration: 500, weight: 6, desc: "Shots arc between enemies" },
    AMMO:    { label: "AMMO PACK",    icon: "▮", color: "#fbbf24", duration: 0,   weight: 14, desc: "+60 reserve ammo" },
    SERUM:   { label: "LIFE SERUM",    icon: "♥", color: "#ff4d8d", duration: 0,   weight: 0,  desc: "Revives fallen heroes" }
};

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

        // --- Co-op / team state ---
        this.isPlayer = false;       // true for the two heroes (alive OR undead ally)
        this.playerIndex = 0;        // 0 = Player 1, 1 = Player 2
        this.playerLabel = "";
        this.humanity = 0;           // 0..100 - fill it as an undead hero to earn your life back
        this.reviveProgress = 0;     // 0..1 while a partner is channelling a revive on this hero
        this.reviveChannel = 0;      // 0..1 progress of THIS hero reviving somebody
        this.kills = 0;
        this.revives = 0;
        this.lastHitBy = null;
        this.frozenTimer = 0;
        this.shield = 0;
        this.shieldMax = 0;
        this.orbAngle = Math.random() * 6.28;
        this.powers = {};            // type -> frames remaining (several can be active at once)
        this.powerHitTimers = {};
        this.invulnTimer = 0;
        this.spawnPulse = 0;
        this.ammoMag = 24;           // rounds in the magazine
        this.ammoMagMax = 24;
        this.ammoReserve = 150;      // spare rounds
        this.ammoReserveMax = 300;
        this.reloadTimer = 0;
        this.noAmmoMsg = 0;
        this.emergencyTimer = 0;
        this.ragdollTimer = 0;       // >0 = limp ragdoll: no control, tumbling
        this.ragdollAngle = 0;
        this.ragdollSpin = 0;
        this.ragdollImmune = 0;
        this.hitstun = 0;
        this.stairsGrip = 0;         // >0 while this hero is climbing stairs (hold Up)
        this.stairsIgnore = 0;
        this.onStairs = false;
        this.hitCooldown = 0;        // i-frames after a hero is hit (no more chain-bounces)
        this.staggerTimer = 0;       // enemies reel back when a hero hits them
        this.onSlide = false;
    }

    // In Brawl mode every fighter is its own team (free-for-all)
    get team() { return this.fighterTeam !== undefined ? this.fighterTeam : (this.isPlayer ? 1 : 0); }

    accent() { return this.accentColor || (typeof FIGHTER_COLORS !== "undefined" && FIGHTER_COLORS[this.playerIndex]) || "#ff5a5f"; }

    get input() { return this.isCPU ? this.cpuIn : (this.netIn || PlayerInput[this.playerIndex] || PlayerInput[0]); }

    // Calm top running speed (px/frame); knockback, dashes and wall-jumps can briefly exceed it
    runCapNow() {
        if (!this.isPlayer) return this.maxspeed * 0.4 * (this.capMult || 1);
        if (GameModes.has("runMult")) { var rm = GameModes.call("runMult", this); if (rm && rm !== 1) return this.maxspeed * 0.48 * rm; }
        var fm = (typeof Feel !== "undefined") ? Feel.speedMult() : 1;
        if (fm !== 1 && !this.creativeFlying) return this.maxspeed * (this.hasPower("SPEED") ? 0.62 : 0.48) * fm;
        if (this.creativeFlying) return this.maxspeed * 0.75;   // flying is quick
        return this.maxspeed * (this.hasPower("SPEED") ? 0.62 : 0.48);
    }

    // ---- Ammo ------------------------------------------------------------
    unlimitedAmmo() { return (typeof settings !== "undefined" && settings.ammo !== "limited") || godMode || devOpts.infiniteAmmo || this.isZombie || (typeof brawl !== "undefined" && brawl.active) || !GameModes.flag("ammo", true); }

    totalAmmo() { return this.ammoMag + this.ammoReserve; }

    startReload() {
        if (this.reloadTimer > 0 || this.ammoMag >= this.ammoMagMax || this.ammoReserve <= 0) return;
        this.reloadTimer = 70;
        if (typeof SFX !== "undefined") SFX.play("reload", this.x, this.y);
        Components.addFloatingText("RELOADING", this.x, this.y + 78, "#fbbf24", 14);
    }

    addAmmo(n) {
        this.ammoReserve = Math.min(this.ammoReserveMax, this.ammoReserve + n);
    }

    updateAmmo() {
        if (!this.isPlayer || this.isZombie) return;
        if (this.input.reloadQueued) { this.input.reloadQueued = false; this.startReload(); }
        if (this.reloadTimer > 0) {
            this.reloadTimer--;
            if (this.reloadTimer === 0) {
                var take = Math.min(this.ammoMagMax - this.ammoMag, this.ammoReserve);
                this.ammoMag += take;
                this.ammoReserve -= take;
                Components.spawnSparks(this.x, this.y, "#fbbf24", 4);
            }
        } else if (this.ammoMag <= 0 && this.ammoReserve > 0) {
            this.startReload();
        }
        if (this.noAmmoMsg > 0) this.noAmmoMsg--;
        // Scraping the barrel: with nothing left you slowly salvage a few rounds so you are never fully soft-locked
        if (this.totalAmmo() <= 0) {
            this.emergencyTimer++;
            if (this.emergencyTimer > 240) {
                this.emergencyTimer = 0;
                this.ammoReserve += 4;
                Components.addFloatingText("+4 SCRAPPED AMMO", this.x, this.y + 78, "#fbbf24", 13);
            }
        } else {
            this.emergencyTimer = 0;
        }
    }

    hasPower(type) { return (this.powers[type] || 0) > 0; }

    // Big hits turn a character into a limp ragdoll for a moment (heroes AND enemies)
    ragdollThreshold() {
        if (this.isPlayer) return Math.max(16, this.maxHealth * 0.18);
        var p = this.zombiePower;
        if (p == "BOSS_KING") return 9999;
        if (p == "TANK") return 60;
        if (p == "KNIGHT") return 42;
        return Math.max(26, this.maxHealth * 0.3);
    }

    startRagdoll(kx, ky, dur, noImpulse) {
        if (typeof Net !== "undefined" && Net.predicting) return;
        if (this.ragdollTimer > 0 || this.ragdollImmune > 0 || this.dead) return;
        this.ragdollTimer = dur || 55;
        this.ragdollExtend = 0;
        var dir = Math.abs(kx) > 0.5 ? Math.sign(kx) : (Math.random() < 0.5 ? -1 : 1);
        this.ragdollSpin = dir * (0.2 + Math.random() * 0.16);
        this.ragdollAngle = 0;
        if (!noImpulse) {
            this.xspeed += dir * 5;
            this.yspeed = Math.max(this.yspeed, 6.5);
        }
        this.onGround = false;
        this.jump = false;
        this.dashTimer = 0;
        if (this.heldObject) {
            this.heldObject.heldBy = null;
            this.heldObject.noCollide = false;
            this.heldObject = null;
        }
        if (this.heldRagdoll) { this.heldRagdoll.heldBy = null; this.heldRagdoll = null; }
        // Hand the body over to the Verlet ragdoll until it comes to rest
        if (typeof Ragdolls !== "undefined") {
            if (this.liveRagdoll) Ragdolls.remove(this.liveRagdoll);
            this.liveRagdoll = Ragdolls.spawnFrom(this, {});
            this.liveRagdoll.owner = this;
        }
        if (typeof Juice !== "undefined") {
            Juice.hitStop(this.isPlayer ? 4 : 3);
            if (Math.random() < 0.6) Juice.comic(this.x, this.y + 110);
        }
    }

    // Stand back up where the ragdoll came to rest
    endLiveRagdoll() {
        var rd = this.liveRagdoll;
        this.liveRagdoll = null;
        this.ragdollExtend = 0;
        if (!rd) return;
        Ragdolls.remove(rd);
        this.x = rd.centerX();
        this.y = rd.lowestY() + this.s2 / 2 + 2;
        for (let i = 0; i < 14; i++) {
            if (!CollisionDetector.collision(this, [0, 0], staticObjects)) break;
            this.y += 30;
        }
        this.collidedWith = null;
        this.xspeed = rd.velX() * 0.4;
        this.yspeed = 3.5;
        this.dizzyTimer = 80;
        this.scaleX = 0.8;
        this.scaleY = 1.25;
    }

    recomputeStats() {
        var lvlMult = this.isZombie ? 1.15 : (1 + (heroLevel - 1) * 0.04);
        var spd = this.hasPower("SPEED");
        this.speed = this.baseSpeed * lvlMult * (spd ? 1.5 : 1);
        this.jumpSpeed = this.baseJumpSpeed * (this.isZombie ? 1.15 : 1) * (spd ? 1.25 : 1);
    }

    addHumanity(amount, reason) {
        if (!this.isPlayer || !this.isZombie || this.dead) return;
        this.humanity = Math.min(100, this.humanity + amount);
        Components.addFloatingText("+" + Math.round(amount) + "% HUMANITY", this.x, this.y + 80, "#c77dff", 15);
        if (this.humanity >= 100) {
            this.reviveAsHuman(0.6, "HUMANITY RESTORED!");
        }
    }

    tryGrabOrThrow(cursorWorldX, cursorWorldY) {
        if (this.heldChar && typeof Feel !== "undefined") { Feel.throwCharacter(this, cursorWorldX, cursorWorldY); return true; }
        if (this.heldRagdoll) {
            this.throwHeldRagdoll(cursorWorldX, cursorWorldY);
            return true;
        }
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
            if (typeof SFX !== "undefined") SFX.play("grab", this.x, this.y);
            return true;
        }

        // No crate in reach? Pick up a body instead - and throw it at the horde!
        if (typeof Ragdolls !== "undefined" && !this.isZombie) {
            var body = Ragdolls.nearestCorpse(this.x, this.y, godMode ? 900 : 280);
            if (body) {
                this.heldRagdoll = body;
                body.heldBy = this;
                body.wake();
                body.life = Math.max(body.life, 900);
                Components.addFloatingText("GRABBED A BODY! [Throw it!]", this.x, this.y + 70, "#ffd23f", 16);
                if (typeof SFX !== "undefined") SFX.play("grab", this.x, this.y);
                return true;
            }
        }
        // nothing else in reach: grab a player or an enemy
        if (typeof Feel !== "undefined" && Feel.tryGrabCharacter(this)) return true;
        return false;
    }

    throwHeldRagdoll(cursorWorldX, cursorWorldY) {
        var rd = this.heldRagdoll;
        this.heldRagdoll = null;
        if (!rd) return;
        rd.heldBy = null;
        var dx = cursorWorldX - this.x, dy = cursorWorldY - this.y;
        var len = Math.hypot(dx, dy);
        if (len < 0.01) { var rad = Math.radians(this.degree); dx = Math.sin(rad); dy = Math.cos(rad); }
        else { dx /= len; dy /= len; }
        rd.setVelocity(dx * 27 + this.xspeed * 0.4, dy * 27 + 4);
        rd.pts[0].px += dx * 6; // head-first for extra tumble
        rd.thrownBy = this;
        rd.lastAttacker = this;
        rd.projectileTimer = 70;
        Components.addFloatingText("YEET!", this.x, this.y + 90, "#ffd23f", 20);
        if (typeof SFX !== "undefined") SFX.play("dash", this.x, this.y);
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
        var bw = Math.sqrt(block.weight || 1);
        block.xspeed = (dx * throwSpeed + this.xspeed * 0.35) / bw;
        block.yspeed = (dy * throwSpeed + 3) / bw;

        CollisionDetector.enforceNonPenetration(staticObjects, [block]);
        Components.spawnSparks(block.x, block.y, "#00f5d4", 8);
        return true;
    }

    triggerNinjaDash() {
        if (this.dashCooldown > 0 && !godMode) return;
        if (this.isPlayer && !GameModes.flag("dash", true)) return;
        var mPos = Components.getMouseWorldPos();
        var dx = mPos[0] - this.x;
        var dy = mPos[1] - this.y;
        if (this.playerIndex !== 0 || !useMouseAim || this.padAiming || Math.hypot(dx, dy) < 10) {
            var rad = Math.radians(this.degree);
            dx = Math.sin(rad);
            dy = Math.cos(rad);
        }
        var len = Math.hypot(dx, dy) || 1;
        this.dashVX = (dx / len) * 23;
        this.dashVY = (dy / len) * 14 + 1;
        this.dashTimer = 8;
        this.dashHitIds = {};
        this.dashCooldown = (godMode || devOpts.infiniteAmmo) ? 6 : 42;
        this.scaleX = 1.22;
        this.scaleY = 0.82;
        Components.spawnSparks(this.x, this.y, "#00f5d4", 6);
        if (typeof SFX !== "undefined") SFX.play("dash", this.x, this.y);
    }

    takeDamage(amount, knockX = 0, knockY = 0, attacker = null) {
        if (this.dead) return;
        if (typeof Net !== "undefined" && Net.predicting) return;      // a LAN joiner moving its own hero: damage is the host's call
        // God Mode protects living heroes from all damage!
        if (!this.isZombie && (godMode || this.dashTimer > 0 || this.invulnTimer > 0)) {
            return;
        }
        if (attacker && attacker.team === this.team && attacker !== this && !devOpts.friendlyFire) return;
        if (this.isPlayer && GameModes.has("onDamage") && GameModes.call("onDamage", this, amount, knockX, knockY, attacker)) return;
        if (!this.isPlayer && GameModes.has("onEnemyDamage") && GameModes.call("onEnemyDamage", this, amount, knockX, knockY, attacker)) return;

        // Brawl mode: damage becomes a percent and knockback grows with it (no health, no death)
        if (typeof brawl !== "undefined" && brawl.active && this.isPlayer) {
            if (amount < 0) brawlApplyHit(this, amount, knockX, knockY, attacker);
            return;
        }

        // Heroes get brief i-frames after every hit and only a small nudge, so enemies can't juggle you
        if (this.isPlayer && amount < 0) {
            if (this.hitCooldown > 0) return;
            this.hitCooldown = BALANCE.heroIframes;
            knockX = Math.max(-4.5, Math.min(4.5, knockX));
            knockY = Math.max(-2, Math.min(3, knockY));
        }
        // Enemies hit by a hero immediately know where they are; knights block frontal chip damage with the shield
        if (!this.isPlayer && attacker && attacker.isPlayer) {
            this.alertTimer = 600;
            if (this.zombiePower == "KNIGHT" && amount > -40 && this.dashTimer <= 0 && !this.stompHit) {
                var facingToward = ((attacker.x - this.x) * (this.lastFacing || 1)) > 0;
                if (facingToward) {
                    amount *= 0.4;
                    knockX *= 0.3;
                    Components.spawnSparks(this.x + (this.lastFacing || 1) * 30, this.y, "#e5e7eb", 4);
                    if (Math.random() < 0.35) Components.addFloatingText("BLOCK", this.x, this.y + 70, "#e5e7eb", 13);
                }
            }
        }
        // Enemies reel back harder when a hero lands a hit
        if (!this.isPlayer && amount < 0 && attacker && attacker.isPlayer) {
            this.staggerTimer = 10;
            knockX *= 1.5;
            knockY += 1.5;
        }

        if (amount < 0 && this.isPlayer && attacker && !attacker.isPlayer) amount *= devOpts.enemyDamage * BALANCE.enemyDmg;
        if (amount < 0 && this.frozenTimer > 0) amount *= 1.25;
        if (attacker) this.lastHitBy = attacker;

        // Energy shield soaks damage first
        if (amount < 0 && this.shield > 0) {
            var soak = Math.min(this.shield, -amount);
            this.shield -= soak;
            amount += soak;
            this.hitFlashTimer = 3;
            Components.spawnSparks(this.x, this.y, "#6ee7ff", 5);
            if (this.shield <= 0) {
                delete this.powers["SHIELD"];
                Components.addFloatingText("SHIELD BROKEN", this.x, this.y + 70, "#6ee7ff", 15);
            }
            if (amount > -0.5) return;
        }

        this.health += amount;
        this.xspeed += knockX;
        this.yspeed += knockY;
        this.hitFlashTimer = 5;
        if (this.liveRagdoll && amount < 0) this.liveRagdoll.addVelocity(knockX * 0.8, knockY * 0.6 + 1.5);
        if (typeof SFX !== "undefined" && amount <= -4) SFX.play(this.isPlayer ? "hurt" : "hit", this.x, this.y, Math.min(1, -amount / 25));
        if (amount < 0 && -amount >= this.ragdollThreshold() && this.health > 0) {
            this.startRagdoll(knockX, knockY, this.isPlayer ? 55 : 60);
        }

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
            if (typeof Components !== "undefined" && Components.addCorpse) Components.addCorpse(this);
            if (typeof SFX !== "undefined") SFX.play("kill", this.x, this.y);

            var basePts = (this.zombiePower == "BOSS_KING" ? 1500 : (this.zombiePower == "TANK" || this.zombiePower == "KNIGHT" ? 300 : (this.zombiePower == "NORMAL" ? 100 : 200)));
            if (comboTimer > 0) {
                combo = Math.min(10, combo + 1);
            } else {
                combo = 1;
            }
            comboTimer = comboTimerMax;

            // Fallen heroes earn their life back by taking the horde down!
            var humanityGain = (this.zombiePower == "BOSS_KING") ? 100 : ((this.zombiePower == "TANK" || this.zombiePower == "KNIGHT") ? 45 : (this.zombiePower == "MINI_SLIME" ? 8 : 24));
            var killer = this.lastHitBy;
            if (killer && killer.isPlayer) killer.kills++;
            if (killer && killer.isPlayer && typeof Build !== "undefined" && GameModes.flag("building", false)) { Build.mats(killer).wood += 5; if (Math.random() < 0.25) Build.mats(killer).stone += 4; }
            for (let pi = 0; pi < characters.length; pi++) {
                var pc = characters[pi];
                if (pc.isPlayer && pc.isZombie) {
                    pc.addHumanity(humanityGain * (pc === killer ? 1.5 : 0.6));
                }
            }
            var dMult = (typeof WorldGenerator !== "undefined" && WorldGenerator.distanceMult) ? WorldGenerator.distanceMult() : 1;
            var earned = Math.round(basePts * combo * dMult);
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
                if (typeof Juice !== "undefined") { Juice.hitStop(10); Juice.slowMo(100, 0.3); }
            } else {
                var coinCount = ((this.zombiePower == "TANK" || this.zombiePower == "KNIGHT") ? 3 : 1) + Math.floor(dMult - 1);
                Components.spawnCoins(this.x, this.y + 20, coinCount);
            }

            var blastRadius = (this.zombiePower == "EXPLODER") ? 280 : 130;
            var blastDamage = (this.zombiePower == "EXPLODER") ? -35 : -8;
            Components.blowUp(this.x, this.y, this.color, 14, blastRadius, blastDamage, this);

            if (Math.random() < BALANCE.killPowerUp * devOpts.powerUpRate && typeof spawnPowerUp === "function") {
                spawnPowerUp(this.x, this.y + 20);
            }
            // Ammo drops: far more likely when somebody is running low
            var lowest = 999;
            for (let ai = 0; ai < characters.length; ai++) if (!characters[ai].isZombie) lowest = Math.min(lowest, characters[ai].totalAmmo());
            if (lowest < 999 && typeof spawnPowerUp === "function" && Math.random() < (lowest < 40 ? BALANCE.killAmmoLow : BALANCE.killAmmo)) {
                spawnPowerUp(this.x + (Math.random() - 0.5) * 60, this.y + 40, "AMMO");
            }
        } else if (!this.isZombie) {
            this.death = true;
            this.isZombie = true;
            this.color = this.isPlayer ? "#7a5cff" : "#2d6e32";
            this.maxHealth = 120;
            this.health = 120;
            this.humanity = 0;
            this.reviveProgress = 0;
            this.ragdollImmune = 0;
            this.startRagdoll(this.xspeed, 6, 80);
            this.powers = {};
            this.shield = 0;
            this.zombiePower = "SPITTER";
            this.recomputeStats();
            Components.addFloatingText("YOU FELL!", this.x, this.y + 70, "#ff6b6b", 26);
            Components.addFloatingText("Kill enemies or get revived", this.x, this.y + 42, "#c77dff", 15);
            Components.blowUp(this.x, this.y, "#ff3333", 20, 180, -15, this);

            var anyHumanAlive = false;
            for (let i = 0; i < characters.length; i++) {
                if (!characters[i].isZombie) {
                    anyHumanAlive = true;
                }
            }
            if (!anyHumanAlive && lastStandTimer < 0) {
                lastStandTimer = lastStandTimerMax;
                Components.addFloatingText("LAST STAND! Earn a life back!", this.x, this.y + 120, "#ffdd44", 22);
            }
        } else {
            // An undead hero got destroyed: lose some humanity and respawn beside a living teammate
            Components.blowUp(this.x, this.y, this.color, 16, 150, 0, this);
            this.health = this.maxHealth;
            this.humanity = Math.max(0, this.humanity - 25);
            var buddy = null;
            for (let i = 0; i < characters.length; i++) {
                if (characters[i] !== this && !characters[i].isZombie) buddy = characters[i];
            }
            if (buddy) {
                this.x = buddy.x + (Math.random() < 0.5 ? -120 : 120);
                this.y = buddy.y + 60;
            } else {
                this.x = (Math.random() - 0.5) * 600;
                this.y = 550;
            }
            this.xspeed = 0;
            this.yspeed = 0;
            this.invulnTimer = 90;
        }
    }

    reviveAsHuman(healthPct = 1, label = "REVIVED!") {
        var wasUndead = this.isZombie;
        this.death = false;
        this.isZombie = false;
        this.color = this.originalColor;
        this.maxHealth = 100 + (heroLevel - 1) * 20;
        this.health = Math.max(20, Math.round(this.maxHealth * healthPct));
        this.humanity = 0;
        this.reviveProgress = 0;
        this.zombiePower = "NORMAL";
        this.invulnTimer = 120;
        this.recomputeStats();
        this.jetpackFuel = this.jetpackMaxFuel;
        if (wasUndead) {
            if (typeof SFX !== "undefined") SFX.play("revive", this.x, this.y);
            Components.addFloatingText(label, this.x, this.y + 70, "#44ffaa", 24);
            Components.spawnSparks(this.x, this.y, "#44ffaa", 22);
            Components.blowUp(this.x, this.y, "#44ffaa", 14, 220, -10, this);
            lastStandTimer = -1;
        }
    }

    // ---- Power-Ups --------------------------------------------------------
    // Instant: HEAL, BLOWUP, SERUM, FREEZE | Timed (stackable): RAPID, SPEED, SHIELD, MAGNET, BERSERK, ORBIT, HOMING, CHAIN
    applyPowerUp(type) {
        var def = PowerUpDefs[type];
        if (!def) return;
        if (typeof SFX !== "undefined") SFX.play(type == "FREEZE" ? "freeze" : "pickup", this.x, this.y);
        Components.addFloatingText(def.icon + " " + def.label, this.x, this.y + 70, def.color, 20);
        Components.spawnSparks(this.x, this.y, def.color, 14);

        if (type == "HEAL") {
            if (typeof brawl !== "undefined" && brawl.active) this.damagePct = Math.max(0, (this.damagePct || 0) - 35);
            this.health = Math.min(this.maxHealth, this.health + 35);
            this.jetpackFuel = this.jetpackMaxFuel;
        } else if (type == "BLOWUP") {
            Components.blowUp(this.x, this.y, "#ffaa00", 28, 420, -55 * rpgDamageMult, this);
        } else if (type == "FREEZE") {
            Components.freezeBlast(this.x, this.y, 1100, 300);
        } else if (type == "AMMO") {
            this.addAmmo(60);
            for (let i = 0; i < characters.length; i++) {
                if (characters[i] !== this && !characters[i].isZombie) characters[i].addAmmo(25);
            }
            if (this.ammoMag < this.ammoMagMax) this.startReload();
        } else if (type == "SERUM") {
            this.reviveAllies();
        } else {
            this.powers[type] = def.duration;
            if (type == "SHIELD") {
                this.shield = this.shieldMax = 60;
            }
            this.recomputeStats();
        }
        this.powerType = type;
    }

    // Serum / team revive: brings every undead hero back (including self)
    reviveAllies() {
        var any = false;
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (c.isPlayer && c.isZombie) {
                c.reviveAsHuman(0.7, "LIFE SERUM!");
                any = true;
            }
        }
        if (!any) {
            this.shield = this.shieldMax = 60;
            this.powers["SHIELD"] = 600;
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

        // Stackable power timers
        var powersChanged = false;
        for (var pk in this.powers) {
            this.powers[pk]--;
            if (this.powers[pk] <= 0) {
                delete this.powers[pk];
                if (pk == "SHIELD") this.shield = 0;
                powersChanged = true;
            }
        }
        if (powersChanged) this.recomputeStats();
        this.updateAmmo();
        if (this.ragdollImmune > 0) this.ragdollImmune--;
        if (this.hitstun > 0) {
            this.hitstun--;
            this.leftPressed = this.rightPressed = this.upPressed = this.downPressed = false;
            this.dashTimer = 0;
        }
        if (this.dizzyTimer > 0) this.dizzyTimer--;
        if (this.ragdollTimer > 0 && this.liveRagdoll) {
            // Body is a ragdoll: follow it, no control until it settles
            this.ragdollTimer--;
            var lrd = this.liveRagdoll;
            this.x = lrd.centerX();
            this.y = lrd.centerY();
            this.xspeed = lrd.velX();
            this.yspeed = lrd.velY();
            this.onGround = false;
            this.leftPressed = this.rightPressed = this.upPressed = this.downPressed = false;
            this.dashTimer = 0;
            // keep tumbling while still flying fast (up to 1.5 extra seconds)
            if (this.ragdollTimer === 0 && Math.hypot(this.xspeed, this.yspeed) > 6 && this.ragdollExtend < 90) {
                this.ragdollTimer = 1;
                this.ragdollExtend++;
            }
            if (this.ragdollTimer > 0) {
                if (this.invulnTimer > 0) this.invulnTimer--;
                if (this.hitCooldown > 0) this.hitCooldown--;
                return;
            }
            this.endLiveRagdoll();
            this.ragdollImmune = this.isPlayer ? 150 : 90;
        }
        if (this.ragdollTimer > 0) {
            this.ragdollTimer--;
            this.ragdollAngle += this.ragdollSpin;
            if (this.onGround) { this.ragdollSpin *= 0.9; this.xspeed *= 0.95; } else this.ragdollSpin *= 0.995;
            this.leftPressed = this.rightPressed = this.upPressed = this.downPressed = false;
            this.dashTimer = 0;
            this.fastFalling = false;
            if (this.ragdollTimer === 0) {
                this.ragdollAngle = 0;
                this.ragdollSpin = 0;
                this.ragdollImmune = this.isPlayer ? 150 : 90;
                this.scaleX = 1.25;
                this.scaleY = 0.78; // spring back up
            }
        }
        if (this.invulnTimer > 0) this.invulnTimer--;
        if (this.hitCooldown > 0) this.hitCooldown--;
        if (this.stompGrace > 0) this.stompGrace--;
        if (this.stompCd > 0) this.stompCd--;
        if (this.staggerTimer > 0) {
            this.staggerTimer--;
            this.leftPressed = this.rightPressed = this.upPressed = false;
            this.xspeed *= 0.92;
        }
        if (this.spawnPulse > 0) this.spawnPulse--;

        // Frozen enemies are completely locked in ice
        if (this.frozenTimer > 0) {
            this.frozenTimer--;
            this.leftPressed = this.rightPressed = this.upPressed = this.downPressed = false;
            this.dashTimer = 0;
            this.xspeed *= 0.8;
        }

        // Orbiting energy blades
        if (this.hasPower("ORBIT")) {
            this.orbAngle += 0.11;
            for (let b = 0; b < 3; b++) {
                var a = this.orbAngle + b * (Math.PI * 2 / 3);
                var bx = this.x + Math.cos(a) * 115;
                var by = this.y + Math.sin(a) * 115;
                for (let z = 0; z < zombies.length; z++) {
                    var zz = zombies[z];
                    if (zz.dead) continue;
                    if (Math.hypot(zz.x - bx, zz.y - by) < zz.s1 * 0.5 + 26) {
                        var key = zz.id;
                        if (!this.powerHitTimers[key] || this.powerHitTimers[key] <= 0) {
                            zz.takeDamage(-13 * rpgDamageMult * devOpts.playerDamage, Math.cos(a) * 3, 3, this);
                            this.powerHitTimers[key] = 14;
                            Components.spawnSparks(bx, by, "#d946ef", 3);
                        }
                    }
                }
            }
            for (var hk in this.powerHitTimers) {
                if (this.powerHitTimers[hk] > 0) this.powerHitTimers[hk]--;
            }
        }

        this.onSlide = false;
        // Stairs are opt-in: hold Up to climb, keep gripping while standing on them, press Down to step off
        if (this.isPlayer) {
            if (this.stairsIgnore > 0) this.stairsIgnore--;
            var freshDownS = this.downPressed && !this.wasDownPressed;
            if (this.upPressed && this.stairsIgnore <= 0) this.stairsGrip = 14;
            else if (this.onStairs && this.onGround && !this.downPressed && this.stairsIgnore <= 0) this.stairsGrip = Math.max(this.stairsGrip, 8);
            if (freshDownS && this.onStairs) { this.stairsGrip = 0; this.stairsIgnore = 18; this.onGround = false; this.coyoteTimer = 0; }
            if (this.stairsGrip > 0) this.stairsGrip--;
            this.stairsHintTimer = Math.max(0, (this.stairsHintTimer || 0) - 1);
        }
        // Gentle hint the first time you pass the foot of a staircase
        if (this.isPlayer && !this.isZombie && this.stairsGrip <= 0 && this.onGround && this.stairsHintTimer <= 0 && ((this.hintFrame = (this.hintFrame || 0) + 1) % 10 === 0)) {
            var feetY = this.y - this.s2 / 2;
            for (let hs = 0; hs < staticObjects.length; hs++) {
                var st = staticObjects[hs];
                if (st.kind !== "stairs" || st.dead) continue;
                var lowX = (st.rampDir == "right") ? st.x - st.w / 2 : st.x + st.w / 2;
                if (Math.abs(this.x - lowX) < 110 && Math.abs(feetY - (st.y - st.h / 2)) < 50) {
                    Components.addFloatingText("▲ hold UP to climb stairs", this.x, this.y + 95, "#ffe08a", 14);
                    this.stairsHintTimer = 600;
                    break;
                }
            }
        }
        this.onStairs = false;
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

            this.onStairs = !!(this.collidedRamp && this.collidedRamp.kind === "stairs");

            // Slides are slippery: gravity drags you downhill, climbing them is a slog
            this.onSlide = !!(this.collidedRamp && this.collidedRamp.kind === "slide");
            if (this.onSlide) {
                var downhill = (this.collidedRamp.rampDir == "left") ? 1 : -1;
                this.xspeed += downhill * 0.5;
            }

            if (this.collidedWith && this.collidedWith.isBumper && !(this.isPlayer && this.downPressed)) {
                this.yspeed = this.collidedWith.bounceForce;
                if (GameModes.flag("bigPads", false)) this.launchSpeed = this.yspeed;
                if (typeof SFX !== "undefined") SFX.play("boing", this.x, this.y);
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

        // Creative flight: double-tap jump to take off / land (Creative game, or the dev-panel cheat)
        if (this.isPlayer) {
            var canFly = !this.isZombie && !this.dead && (GameModes.flag("flight", false) || devOpts.flight || (GameModes.current.id === "terra" && TERRA.creative));
            if (!canFly) this.creativeFlying = false;
            else if (freshJumpPress) {
                if (this.flyTapTimer > 0) {
                    this.creativeFlying = !this.creativeFlying;
                    this.flyTapTimer = 0;
                    this.jumpBufferTimer = 0;
                    this.jump = false;
                    if (this.creativeFlying) { this.yspeed = Math.max(this.yspeed, 4); this.onGround = false; }
                    Components.addFloatingText(this.creativeFlying ? "✈ FLYING" : "WALKING", this.x, this.y + 80, "#7dd3fc", 16);
                    if (typeof SFX !== "undefined") SFX.play(this.creativeFlying ? "jump" : "select", this.x, this.y, 0.7, 1.4);
                } else this.flyTapTimer = 16;
            }
            if (this.flyTapTimer > 0) this.flyTapTimer--;
            // touching down while holding Down lands you
            if (this.creativeFlying && this.onGround && this.downPressed) this.creativeFlying = false;
            this.flies = !!this.creativeFlying;
            this.noCollide = !!(this.creativeFlying && this.noclip);
        }

        // Stick Ninja Wall-Slide Detection
        this.wallSliding = 0;
        if (!this.onGround && !this.isZombie && !this.creativeFlying && GameModes.flag("wallJump", true)) {
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
            // Slice through nearby zombies during dash! (heroes only - enemy lunges must not hurt each other)
            for (let z = 0; this.isPlayer && z < zombies.length; z++) {
                var zom = zombies[z];
                if (!zom.dead && Math.hypot(zom.x - this.x, zom.y - this.y) < this.s1 + 35) {
                    var slashDmg = Math.round(-45 * rpgDamageMult * devOpts.playerDamage);
                    zom.takeDamage(slashDmg, this.dashVX * 0.5, 6, this);
                    this.airJumps = this.maxAirJumps; // Hit-confirm resets air jump!
                    Components.addFloatingText("SLASH! " + slashDmg, zom.x, zom.y + 65, "#00f5d4", 20);
                }
            }
            // Brawl: the dash is an attack on rival fighters too (one hit per dash)
            if (this.isPlayer && typeof brawl !== "undefined" && brawl.active) {
                if (!this.dashHitIds) this.dashHitIds = {};
                for (let f = 0; f < characters.length; f++) {
                    var rival = characters[f];
                    if (rival === this || rival.dead || rival.eliminated || this.dashHitIds[rival.id]) continue;
                    if (Math.hypot(rival.x - this.x, rival.y - this.y) < this.s1 + 30) {
                        this.dashHitIds[rival.id] = true;
                        rival.takeDamage(-32, this.dashVX * 0.4, 5, this);
                        Components.addFloatingText("DASH HIT!", rival.x, rival.y + 95, "#00f5d4", 16);
                    }
                }
            }
        } else {
            // Tactile Arcade Horizontal Movement (snappy turn-around skid + apex air-control boost)
            var isAtJumpApex = !this.onGround && Math.abs(this.yspeed) < 3.4;
            var capNow = this.runCapNow();
            var accel = this.speed * (isAtJumpApex ? 1.0 : 0.9) * (this.onSlide ? 0.55 : 1) * (this.isPlayer && typeof Feel !== "undefined" ? Feel.speedMult() : 1);
            var turnSnap = this.onGround ? (this.speed * 1.3 + this.slower * 0.9) : (this.speed * 1.0 + this.slower * 0.4);

            if (this.rightPressed && !this.leftPressed) {
                if (this.xspeed < 0) {
                    if (this.onGround && this.xspeed < -6 && !this.isZombie && Math.random() < 0.4) {
                        Components.spawnSparks(this.x - this.s1 * 0.3, this.y - this.s2 * 0.45, "#cccccc", 2);
                    }
                    this.xspeed += turnSnap;
                } else if (this.xspeed < capNow) {
                    this.xspeed = Math.min(capNow, this.xspeed + accel);
                }
            } else if (this.leftPressed && !this.rightPressed) {
                if (this.xspeed > 0) {
                    if (this.onGround && this.xspeed > 6 && !this.isZombie && Math.random() < 0.4) {
                        Components.spawnSparks(this.x + this.s1 * 0.3, this.y - this.s2 * 0.45, "#cccccc", 2);
                    }
                    this.xspeed -= turnSnap;
                } else if (this.xspeed > -capNow) {
                    this.xspeed = Math.max(-capNow, this.xspeed - accel);
                }
            } else if (this.xspeed != 0 && !(this.flingTimer > 0 && !this.onGround)) {
                var stopFriction = this.onGround ? this.slower * (this.onSlide ? 0.12 : 0.95) : this.slower * 0.3;
                if (Math.abs(this.xspeed) < stopFriction) {
                    this.xspeed = 0;
                } else {
                    this.xspeed = Math.subtractToZero(this.xspeed, stopFriction);
                }
            }

            // Flying Enemy Movement (Bats / Gargoyles ignore gravity and swoop smoothly!)
            if (this.flies || this.zombiePower == "BAT") {
                var flyCap = this.isPlayer ? 12 : 8;
                if (this.upPressed) this.yspeed += this.speed * (this.isPlayer ? 1.3 : 0.9);
                else if (this.downPressed) this.yspeed -= this.speed * (this.isPlayer ? 1.3 : 0.9);
                else this.yspeed *= 0.85;
                if (this.yspeed > flyCap) this.yspeed = flyCap;
                if (this.yspeed < -flyCap) this.yspeed = -flyCap;
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
                    if (this.isPlayer && typeof SFX !== "undefined") SFX.play("jump", this.x, this.y, 0.9, 1.15);
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
                    if (this.isPlayer && typeof SFX !== "undefined") SFX.play("jump", this.x, this.y);
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
                    if (this.isPlayer && typeof SFX !== "undefined") SFX.play("jump", this.x, this.y, 0.9, 1.35);
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
            var wantJetpack = !this.isZombie && !this.creativeFlying && this.ragdollTimer <= 0 && jetpackEnabled && (this.input.jet || (godMode && this.upPressed && !this.onGround));
            if (wantJetpack && (this.jetpackFuel > 0 || godMode)) {
                this.jetpackFiring = true;
                this.fastFalling = false;
                if (!godMode && !devOpts.infiniteAmmo) {
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
                        damage: Math.round(lazerDamage * 0.85 * rpgDamageMult * devOpts.playerDamage),
                        team: 1,
                        life: 55
                    });
                }
            }
        }

        // Max Speed
        var curMaxSpeed = (this.hasPower("SPEED") || godMode || this.dashTimer > 0) ? this.maxspeed * 1.45 : this.maxspeed;
        // Calmer run speed: a soft cap that bleeds off excess (wall-jumps / wavedash / knockback still feel punchy)
        var runCap = this.runCapNow();
        if (this.flingTimer > 0) this.flingTimer--;
        if (this.dashTimer <= 0 && !godMode && Math.abs(this.xspeed) > runCap && !this.onSlide && !(this.flingTimer > 0)) {
            this.xspeed = Math.sign(this.xspeed) * (runCap + (Math.abs(this.xspeed) - runCap) * 0.9);
        }
        // bounce pads and portal flings may exceed the normal cap (that's the whole point of them)
        var flingCap = this.flingTimer > 0 ? Math.max(curMaxSpeed, 40) : curMaxSpeed;
        var upCap = Math.max(flingCap, this.launchSpeed || 0);
        if (this.launchSpeed && this.yspeed < curMaxSpeed) this.launchSpeed = 0;
        if (this.xspeed > flingCap) this.xspeed = flingCap;
        if (this.xspeed < -flingCap) this.xspeed = -flingCap;
        if (this.yspeed > upCap) this.yspeed = upCap;
        if (this.yspeed < -flingCap) this.yspeed = -flingCap;

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
                    } else if (this.tryStepUp(hitX, stepX)) {
                        // glided up onto a small ledge / stair lip instead of snagging
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
                    if (this.handleCharacterCollision(hitY) === "stomp" && this.yspeed > 0) {
                        stepY = 0;                                             // keep the stomp bounce; don't damp it
                        continue;
                    }

                    if (hitY && hitY.isBumper && this.yspeed <= 0 && !(this.isPlayer && this.downPressed)) {
                        this.yspeed = hitY.bounceForce;
                        if (GameModes.flag("bigPads", false)) this.launchSpeed = this.yspeed;
                        if (typeof SFX !== "undefined") SFX.play("boing", this.x, this.y);
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
                        // Upright characters land and stop at ceilings. Bumpers and stomps above
                        // have their own explicit bounce; prop restitution must not make heroes pogo.
                        this.yspeed = 0;
                        this.jump = false;
                    }
                    stepY = 0;
                } else {
                    this.y += stepY;
                }
            }
        }

        // Fast proximity check only against opposing Characters (instead of scanning all 200 static objects twice!)
        if (this.isPlayer) {
            for (let z = 0; z < zombies.length; z++) {
                var zom = zombies[z];
                if (!zom.dead && Math.abs(zom.x - this.x) <= (this.s1 + zom.s1) * 0.5 + 3 && Math.abs(zom.y - this.y) <= (this.s2 + zom.s2) * 0.5 + 3) {
                    this.handleCharacterCollision(zom);
                }
            }
        }

        if (this.y < -3200 && !(typeof brawl !== "undefined" && brawl.active)) {
            this.takeDamage(-25, 0, 0);
            var anchor = null;
            for (let ci = 0; ci < characters.length; ci++) if (characters[ci] !== this && !characters[ci].dead) anchor = characters[ci];
            this.x = anchor ? anchor.x : 0;
            this.y = anchor ? anchor.y + 120 : 550;
            this.xspeed = 0;
            this.yspeed = 0;
        }

        if (this.isPlayer) this.checkStuck();

        this.yspeed = Math.round(this.yspeed * rounder) / rounder;
        this.xspeed = Math.round(this.xspeed * rounder) / rounder;
        this.x = Math.round(this.x * rounder) / rounder;
        this.y = Math.round(this.y * rounder) / rounder;
    }

    // Auto step-up: walking into a ledge/stair lip up to ~90px tall hops onto it instead of getting stuck
    tryStepUp(hitX, stepX) {
        if (!hitX || hitX.movable || hitX instanceof Character || hitX.isBumper || hitX.isRamp) return false;
        if (this.dashTimer > 0 || !(this.onGround || this.coyoteTimer > 0)) return false;
        var bh = CollisionDetector.getBounds(hitX, [0, 0]);
        var rise = bh.top - (this.y - this.s2 / 2);
        if (rise <= 0 || rise > 90) return false;
        var oy = this.y;
        this.y += rise + 2;
        if (!CollisionDetector.collision(this, [stepX, 0], allObjects)) {
            this.x += stepX;
            if (this.yspeed < 0) this.yspeed = 0;
            this.onGround = true;
            return true;
        }
        this.y = oy;
        return false;
    }

    // Safety net: a hero pushing against something for 1.5s without moving gets popped free
    checkStuck() {
        var pushing = (this.leftPressed !== this.rightPressed);
        var moved = Math.abs(this.x - (this._px === undefined ? this.x : this._px)) + Math.abs(this.y - (this._py === undefined ? this.y : this._py));
        this._px = this.x; this._py = this.y;
        if (pushing && moved < 0.6 && this.dashTimer <= 0 && !this.heldObject && !this.jetpackFiring) this.stuckTimer = (this.stuckTimer || 0) + 1;
        else this.stuckTimer = Math.max(0, (this.stuckTimer || 0) - 2);
        if (this.stuckTimer > 90) {
            this.stuckTimer = 0;
            var dir = this.rightPressed ? 1 : -1;
            var tries = [[0, 110], [dir * 70, 110], [dir * 130, 40], [0, 230], [dir * 120, 230]];
            for (let t = 0; t < tries.length; t++) {
                var ox = this.x, oy = this.y;
                this.x += tries[t][0];
                this.y += tries[t][1];
                if (!CollisionDetector.hitsStatic(this, 0, 0, staticObjects)) {
                    this.yspeed = 4;
                    Components.addFloatingText("UNSTUCK!", this.x, this.y + 80, "#7ff0ff", 16);
                    Components.spawnSparks(this.x, this.y, "#7ff0ff", 8);
                    return;
                }
                this.x = ox; this.y = oy;
            }
        }
    }

    handleCharacterCollision(other) {
        if (!other || !(other instanceof Character)) return;
        if (typeof brawl !== "undefined" && brawl.active) return;
        if (other.team === this.team) return;
        if (this.frozenTimer > 0) return;
        if (this.isPlayer && other.isPlayer && GameModes.flag("noHeroContact", false)) return;
        if (this.grabbedBy === other || other.grabbedBy === this) return;          // held in someone's hands
        // Enemy touches hero => hero is hurt (heroes only get a half-strength hit while undead)
        var victim = this.isPlayer ? this : other;
        var bully = this.isPlayer ? other : this;
        if (bully.frozenTimer > 0) return;
        // Hero vs enemy only: head stomps, then the mode's contact hook, then default contact damage
        if (victim.isPlayer && !bully.isPlayer) {
            if (victim.stompGrace > 0) return;                    // just bounced off a head: no contact damage
            if (Character.isStomp(victim, bully)) {
                victim.stompGrace = 10;
                bully.stompCd = 8;
                if (!(GameModes.has("onStomp") && GameModes.call("onStomp", victim, bully))) {
                    Character.applyStomp(victim, bully);
                }
                return "stomp";
            }
            if (GameModes.has("onContact") && GameModes.call("onContact", victim, bully)) return;
        }
        var mult = victim.isZombie ? 0.5 : 1;
        var dmg = -9, kx = 3;
        if (bully.dashTimer > 0 && bully.zombiePower == "TANK") { dmg = -26; kx = 7; }
        else if (bully.dashTimer > 0 && bully.zombiePower == "KNIGHT") { dmg = -16; kx = 5; }
        victim.takeDamage(dmg * mult, (victim.x > bully.x ? kx : -kx), 1.5, bully);
    }

    // Hero is clearly on top of the foe and falling (or level) relative to it
    static isStomp(hero, foe) {
        if (hero.dead || foe.dead || hero.ragdollTimer > 0 || foe.stompCd > 0) return false;
        var feet = hero.y - hero.s2 / 2;
        var head = foe.y + foe.s2 / 2;
        if (hero.y <= foe.y) return false;
        if (feet < head - Math.min(18, foe.s2 * 0.3)) return false;           // too far down the foe's side
        if (Math.abs(hero.x - foe.x) > (hero.s1 + foe.s1) * 0.5 - 2) return false;
        return hero.yspeed - (foe.yspeed || 0) <= 0.5;
    }

    static applyStomp(hero, foe) {
        foe.stompHit = true;                                                   // bypasses the knight's frontal shield
        foe.takeDamage(-35 * rpgDamageMult * devOpts.playerDamage, (foe.x >= hero.x ? 1.5 : -1.5), -1, hero);
        foe.stompHit = false;
        foe.scaleX = 1.35; foe.scaleY = 0.6;                                  // squash
        hero.yspeed = hero.upPressed ? 12.5 : 8;                              // hold jump to bounce higher
        hero.jump = false;
        hero.onGround = false;
        hero.coyoteTimer = 0;
        hero.scaleX = 0.86; hero.scaleY = 1.16;
        Components.spawnSparks(hero.x, hero.y - hero.s2 / 2, "#ffe066", 7);
        if (typeof SFX !== "undefined") SFX.play("boing", hero.x, hero.y, 0.9, 1.3);
    }

    createCharacter() {
        if (this.liveRagdoll && typeof Ragdolls !== "undefined") {
            Ragdolls.draw(this.liveRagdoll);
            Components.healthBar(this);
            return;
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
        if (drawX + drawW < -80 || drawX > cssW + 80 || drawY + drawH < -80 || drawY > cssH + 80) {
            return;
        }

        // Soft ground shadow + team aura (makes every character pop against the background)
        this.drawAura(drawX, drawY, drawW, drawH);

        // Ragdoll: the whole body tumbles around its centre
        var ragRot = this.ragdollTimer > 0 || this.corpse;
        if (ragRot) {
            ctx.save();
            ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
            ctx.rotate(this.ragdollAngle);
            ctx.translate(-(drawX + drawW / 2), -(drawY + drawH / 2));
        }
        var isEnemyChar = this.isZombie && !this.isPlayer && typeof drawEnemySkin === "function";

        // Custom Distinct Artwork for Non-Zombie Enemy Archetypes (Bats, Slimes, Archers, Knights, Mages, Bosses)
        var customEnemyTypes = ["BAT", "SLIME", "MINI_SLIME", "ARCHER", "KNIGHT", "MAGE", "BOSS_KING"];
        if (typeof settings !== "undefined" && settings.squareChars) {
            this.drawSquareBody(drawX, drawY, drawW, drawH, drawColor);
        } else if (isEnemyChar) {
            this.drawEnemyChar(drawX, drawY, drawW, drawH);
        } else if (this.isZombie && customEnemyTypes.indexOf(this.zombiePower) !== -1) {
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
            this.outlineBox(drawX, drawY, drawW, drawH, 3);
            ctx.restore();
        } else {
            this.drawModernBody(drawX, drawY, drawW, drawH, drawColor);
        }

        if (ragRot) ctx.restore();

        if (this.corpse) return;
        this.drawOverlays(drawX, drawY, drawW, drawH);

        Components.healthBar(this);
    }

    // ------------------------------------------------------------------
    // MODERN VISUALS
    // ------------------------------------------------------------------
    teamColor() {
        if (this.isPlayer) return this.isZombie ? "#c77dff" : this.accent();
        return "#ff3b4a";
    }

    // "Classic squares" look (settings.squareChars): the original blocky 2020 style with eyes that follow facing
    drawSquareBody(x, y, w, h, color) {
        var facing = this.xspeed > 0.3 ? 1 : (this.xspeed < -0.3 ? -1 : (this.lastFacing || 1));
        this.lastFacing = facing;
        var enemy = this.isZombie && !this.isPlayer;
        // little feet (they step while walking) and hands at the sides (they swing) - drawn first, body on top
        var walk = this.onGround && Math.abs(this.xspeed) > 0.6 ? Math.sin(performance.now() * 0.018 + (this.id || 0)) : 0;
        var dark = Components.shade(color, -45);
        ctx.fillStyle = dark; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2;
        for (var f = 0; f < 2; f++) {
            var fx = x + w * (f ? 0.56 : 0.16) + (f ? -walk : walk) * w * 0.07, fy = y + h - h * 0.06 - Math.max(0, (f ? -walk : walk)) * h * 0.06;
            this.roundRectPath(fx, fy, w * 0.28, h * 0.14, h * 0.05); ctx.fill(); ctx.stroke();
        }
        for (var hs = -1; hs <= 1; hs += 2) {
            var hx = x + w / 2 + hs * w * 0.54, hy = y + h * 0.6 + hs * walk * h * 0.05;
            ctx.beginPath(); ctx.arc(hx, hy, Math.max(2, w * 0.1), 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = color;
        this.roundRectPath(x, y, w, h, Math.min(w, h) * 0.18);
        ctx.fill();
        this.outlineBox(x, y, w, h, 3);
        var eyeR = Math.max(2, Math.min(w, h) * 0.11);
        var eyeY = y + h * 0.32;
        var cx = x + w / 2 + facing * w * 0.1;
        var look = facing * eyeR * 0.45;
        for (var e = -1; e <= 1; e += 2) {
            var ex = cx + e * w * 0.2;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath(); ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = enemy ? "#ff2e3e" : "#111111";
            ctx.beginPath(); ctx.arc(ex + look, eyeY + eyeR * 0.1, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
            if (enemy) {
                // angry brows slanting down toward the middle
                ctx.strokeStyle = "#111111";
                ctx.lineWidth = Math.max(1.5, eyeR * 0.45);
                ctx.beginPath();
                ctx.moveTo(ex - e * eyeR * 1.2, eyeY - eyeR * 1.7);
                ctx.lineTo(ex + e * eyeR * 1.1, eyeY - eyeR * 1.05);
                ctx.stroke();
            }
        }
    }

    roundRectPath(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    outlineBox(x, y, w, h, lw) {
        ctx.save();
        ctx.lineWidth = lw;
        ctx.strokeStyle = "#0a0f16";
        this.roundRectPath(x, y, w, h, 8 * cameraScaleX + 2);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = this.isPlayer ? "#ffffff" : this.teamColor();
        ctx.globalAlpha = 0.9;
        this.roundRectPath(x + 1.5, y + 1.5, w - 3, h - 3, 7 * cameraScaleX + 1);
        ctx.stroke();
        ctx.restore();
    }

    drawAura(x, y, w, h) {
        ctx.save();
        var cx = x + w / 2;
        // ground shadow
        ctx.fillStyle = "rgba(0,0,0,0.30)";
        ctx.beginPath();
        ctx.ellipse(cx, y + h + 2, w * 0.55, Math.max(3, 7 * cameraScaleY), 0, 0, Math.PI * 2);
        ctx.fill();

        // team glow ring so heroes (cyan/red/blue) and enemies (red) are instantly distinguishable
        var t = Date.now() * 0.004 + this.id;
        var glow = this.teamColor();
        ctx.strokeStyle = glow;
        ctx.globalAlpha = this.isPlayer ? 0.55 + Math.sin(t) * 0.15 : 0.35;
        ctx.lineWidth = this.isPlayer ? 3 : 2;
        ctx.beginPath();
        ctx.ellipse(cx, y + h + 2, w * 0.66, Math.max(4, 9 * cameraScaleY), 0, 0, Math.PI * 2);
        ctx.stroke();

        if (!this.isZombie && godMode) {
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = "#ffdd00";
            ctx.lineWidth = 3;
            this.roundRectPath(x - w * 0.12, y - h * 0.12, w * 1.24, h * 1.24, 12);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Distinct animated character for every enemy archetype
    drawEnemyChar(x, y, w, h) {
        var rad = Math.radians(this.degree || 0);
        var firing = (Date.now() - (this.lastShotAt || 0)) < 260;
        var airborne = !this.onGround && this.zombiePower != "BAT";
        if (this.onGround && !this.frozenTimer) this.animPhase = (this.animPhase || 0) + Math.min(0.4, Math.abs(this.xspeed) * 0.06);
        var facing = this.xspeed > 0.3 ? 1 : (this.xspeed < -0.3 ? -1 : (this.lastFacing || 1));
        var aimX = Math.sin(rad), aimY = -Math.cos(rad);
        if (firing || this.zombiePower == "ARCHER" || this.zombiePower == "BOSS_KING") {
            if (Math.abs(aimX) > 0.2) facing = aimX > 0 ? 1 : -1;
        }
        this.lastFacing = facing;
        var skinKey = this.zombiePower;
        drawEnemySkin(skinKey, x + w / 2, y + h / 2, Math.max(w, h), {
            id: this.id,
            facing: facing,
            phase: this.animPhase || 0,
            moving: (this.onGround && !this.ragdollTimer) ? Math.min(1, Math.abs(this.xspeed) / 2.5) : 0,
            air: airborne,
            rising: this.yspeed > 0,
            aimX: aimX, aimY: aimY,
            color: this.originalColor || this.color,
            firing: firing,
            fists: typeof Fight !== "undefined" && Fight.fists(this),
            flash: this.hitFlashTimer > 0,
            t: Date.now(),
            ragdoll: this.ragdollTimer > 0 || this.corpse
        });
    }

    skinId() { return (typeof heroSkins !== "undefined" && heroSkins[this.playerIndex]) || "original"; }

    // Alternate playable characters (stick figure / street brawler / cap hero) - animated, same hitbox
    drawSkinned(x, y, w, h) {
        var rad = Math.radians(this.degree);
        var aimX = Math.sin(rad), aimY = -Math.cos(rad);
        var firing = (Date.now() - (this.lastShotAt || 0)) < 120;
        if (this.onGround) this.animPhase = (this.animPhase || 0) + Math.min(0.45, Math.abs(this.xspeed) * 0.05);
        var facing = this.xspeed > 0.4 ? 1 : (this.xspeed < -0.4 ? -1 : (this.lastFacing || 1));
        if (firing && Math.abs(aimX) > 0.3) facing = aimX > 0 ? 1 : -1;
        this.lastFacing = facing;
        drawHeroSkin(this.skinId(), x + w / 2, y + h / 2, (w + h) / 2, {
            facing: facing,
            phase: this.animPhase || 0,
            moving: this.onGround ? Math.min(1, Math.abs(this.xspeed) / 3) : 0,
            air: !this.onGround,
            rising: this.yspeed > 0,
            aimX: aimX, aimY: aimY,
            color: this.accent(),
            firing: firing,
            flash: this.hitFlashTimer > 0,
            ragdoll: this.ragdollTimer > 0,
            t: Date.now(),
            label: this.isCPU ? "C" : "P" + (this.playerIndex + 1)
        });
    }

    drawModernBody(x, y, w, h, drawColor) {
        if (this.isPlayer && !this.isZombie && this.skinId() !== "original") {
            this.drawSkinned(x, y, w, h);
            return;
        }
        ctx.save();
        var cx = x + w / 2;
        var cy = y + h / 2;
        var facing = (this.xspeed > 0.4) ? 1 : ((this.xspeed < -0.4) ? -1 : (this.lastFacing || 1));
        this.lastFacing = facing;
        var flash = this.hitFlashTimer > 0;
        var r = Math.max(6, 11 * cameraScaleX);

        // body gradient
        var g = ctx.createLinearGradient(0, y, 0, y + h);
        var base = flash ? "#ffffff" : drawColor;
        g.addColorStop(0, flash ? "#ffffff" : Components.shade(base, 38));
        g.addColorStop(1, flash ? "#dddddd" : Components.shade(base, -34));
        ctx.fillStyle = g;
        this.roundRectPath(x, y, w, h, r);
        ctx.fill();

        var pw = this.zombiePower;
        if (this.isPlayer && !this.isZombie) {
            // Hero: bright visor with eyes, belt stripe in player colour and gun barrel
            var accent = this.accent();
            this.drawSprite(characterImg, x, y, w, h, r, this.playerIndex === 1 ? "#2f8cff" : null);
            // big on screen: soft lighting, rim light and eye catch-lights so the pixel face doesn't look flat
            var det = (typeof settings === "undefined" || settings.charDetail !== false) ? Math.max(0, Math.min(1, (w - 90) / 60)) : 0;
            if (det > 0 && !flash) {
                ctx.save();
                this.roundRectPath(x, y, w, h, r); ctx.clip();
                var lg = ctx.createLinearGradient(x, y, x + w, y + h);
                lg.addColorStop(0, "rgba(255,255,255," + (0.16 * det).toFixed(3) + ")");
                lg.addColorStop(0.55, "rgba(255,255,255,0)");
                lg.addColorStop(1, "rgba(0,0,0," + (0.28 * det).toFixed(3) + ")");
                ctx.fillStyle = lg; ctx.fillRect(x, y, w, h);
                ctx.globalAlpha = 0.9 * det; ctx.fillStyle = "#ffffff";
                var ex = facing >= 0 ? [0.27, 0.66] : [0.29, 0.68];
                for (let e = 0; e < 2; e++) ctx.fillRect(x + w * ex[e], y + h * 0.43, Math.max(2, w * 0.035), Math.max(2, h * 0.035));
                ctx.globalAlpha = 0.5 * det; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(1.5, w * 0.012);
                ctx.beginPath(); ctx.moveTo(x + r, y + 2); ctx.lineTo(x + w - r, y + 2); ctx.moveTo(x + 2, y + r); ctx.lineTo(x + 2, y + h * 0.5); ctx.stroke();
                ctx.restore();
            }
            ctx.fillStyle = accent;
            ctx.fillRect(x + 2, y + h * 0.66, w - 4, h * 0.10);
            // headband tail
            var rib = Math.sin(Date.now() * 0.02) * 6 * cameraScaleY;
            ctx.strokeStyle = accent;
            ctx.lineWidth = Math.max(3, 5 * cameraScaleX);
            ctx.beginPath();
            ctx.moveTo(cx - facing * w * 0.46, y + h * 0.14);
            ctx.lineTo(cx - facing * (w * 0.46 + 26 * cameraScaleX), y + h * 0.14 + rib);
            ctx.stroke();
            // aim barrel (none when fighting with fists)
            var rad = Math.radians(this.degree);
            if (typeof Fight !== "undefined" && Fight.fists(this)) rad = null;
            if (rad !== null) {
            var ax = Math.sin(rad), ay = -Math.cos(rad);
            ctx.strokeStyle = "#0a0f16";
            ctx.lineWidth = Math.max(6, 11 * cameraScaleX);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(cx + ax * w * 0.2, cy + ay * h * 0.2);
            ctx.lineTo(cx + ax * w * 0.78, cy + ay * h * 0.78);
            ctx.stroke();
            ctx.strokeStyle = this.hasPower("BERSERK") ? "#ff6b1a" : "#e8fbff";
            ctx.lineWidth = Math.max(3, 5 * cameraScaleX);
            ctx.beginPath();
            ctx.moveTo(cx + ax * w * 0.2, cy + ay * h * 0.2);
            ctx.lineTo(cx + ax * w * 0.78, cy + ay * h * 0.78);
            ctx.stroke();
            }
        } else {
            // Undead / enemy: glowing eyes + jagged teeth
            this.drawSprite(zombieImg, x, y, w, h, r, this.isPlayer ? "#7a5cff" : (pw == "NORMAL" ? null : drawColor));
            if (pw == "TANK") {
                ctx.fillStyle = "#3b1d33";
                ctx.fillRect(x + 3, y + h * 0.80, w - 6, h * 0.12);
                ctx.fillRect(x + w * 0.1, y + h * 0.05, w * 0.8, h * 0.06);
            } else if (pw == "EXPLODER") {
                var pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.02);
                ctx.fillStyle = "rgba(255," + Math.round(120 + pulse * 120) + ",30,0.9)";
                ctx.fillRect(x + 3, y + h * 0.80, w - 6, h * 0.12);
                ctx.fillStyle = "#111";
                ctx.font = "bold " + Math.max(9, Math.round(14 * cameraScaleX)) + "px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("TNT", cx, y + h * 0.9);
            } else if (pw == "LEAPER") {
                ctx.strokeStyle = "#d9ff66";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x + w * 0.2, y + h);
                ctx.lineTo(x + w * 0.3, y + h + 8 * cameraScaleY);
                ctx.lineTo(x + w * 0.4, y + h);
                ctx.moveTo(x + w * 0.6, y + h);
                ctx.lineTo(x + w * 0.7, y + h + 8 * cameraScaleY);
                ctx.lineTo(x + w * 0.8, y + h);
                ctx.stroke();
            }
        }
        ctx.restore();
        this.outlineBox(x, y, w, h, 3.5);
    }

    // Original pixel-art sprites (Character.png / Zombie.png) drawn crisp inside the rounded body
    drawSprite(img, x, y, w, h, r, tint) {
        if (!img || !img.complete || img.naturalWidth === 0) return;
        ctx.save();
        this.roundRectPath(x, y, w, h, r);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x, y, w, h);
        if (tint) {
            ctx.globalAlpha = 0.38;
            ctx.fillStyle = tint;
            ctx.fillRect(x, y, w, h);
        }
        ctx.restore();
    }

    drawOverlays(x, y, w, h) {
        var cx = x + w / 2;
        var cy = y + h / 2;
        var now = Date.now();

        // Frozen: icy tint + crystals
        if (this.frozenTimer > 0) {
            ctx.save();
            ctx.fillStyle = "rgba(150, 225, 255, 0.55)";
            this.roundRectPath(x - 3, y - 3, w + 6, h + 6, 10);
            ctx.fill();
            ctx.strokeStyle = "#e0f7ff";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - w * 0.3, y);
            ctx.lineTo(cx - w * 0.2, y - 12);
            ctx.lineTo(cx - w * 0.1, y);
            ctx.moveTo(cx + w * 0.1, y);
            ctx.lineTo(cx + w * 0.22, y - 16);
            ctx.lineTo(cx + w * 0.32, y);
            ctx.stroke();
            ctx.restore();
        }

        // Energy shield bubble
        if (this.shield > 0) {
            ctx.save();
            var rr = Math.max(w, h) * 0.78;
            var gg = ctx.createRadialGradient(cx, cy, rr * 0.55, cx, cy, rr);
            gg.addColorStop(0, "rgba(110, 231, 255, 0.04)");
            gg.addColorStop(1, "rgba(110, 231, 255, " + (0.25 + 0.1 * Math.sin(now * 0.008)) + ")");
            ctx.fillStyle = gg;
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(180, 245, 255, 0.9)";
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.restore();
        }

        // Orbiting blades
        if (this.hasPower("ORBIT")) {
            ctx.save();
            for (let b = 0; b < 3; b++) {
                var a = this.orbAngle + b * (Math.PI * 2 / 3);
                var bx = (this.x + Math.cos(a) * 115) * cameraScaleX + xc;
                var by = (-(this.y + Math.sin(a) * 115)) * cameraScaleY + yc;
                ctx.translate(bx, by);
                ctx.rotate(-a * 2);
                ctx.shadowColor = "#d946ef";
                ctx.shadowBlur = 14;
                ctx.fillStyle = "#f5d0fe";
                var bs = 15 * cameraScaleX + 5;
                ctx.beginPath();
                ctx.moveTo(0, -bs * 1.5);
                ctx.lineTo(bs * 0.6, 0);
                ctx.lineTo(0, bs * 1.5);
                ctx.lineTo(-bs * 0.6, 0);
                ctx.closePath();
                ctx.fill();
                ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
            }
            ctx.restore();
        }

        // Undead hero: halo + humanity ring
        if (this.isPlayer && this.isZombie) {
            ctx.save();
            ctx.strokeStyle = "rgba(199,125,255," + (0.5 + 0.3 * Math.sin(now * 0.006)) + ")";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(cx, y - 14 * cameraScaleY, w * 0.32, 6 * cameraScaleY + 2, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 5;
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(w, h) * 0.75, -Math.PI / 2, Math.PI * 1.5);
            ctx.stroke();
            ctx.strokeStyle = "#c77dff";
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(w, h) * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (this.humanity / 100));
            ctx.stroke();
            ctx.restore();
        }

        // Revive channel ring (drawn on the hero being revived)
        if (this.reviveProgress > 0) {
            ctx.save();
            ctx.lineWidth = 7;
            ctx.strokeStyle = "rgba(0,0,0,0.55)";
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(w, h) * 0.95, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = "#44ffaa";
            ctx.shadowColor = "#44ffaa";
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(w, h) * 0.95, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.reviveProgress);
            ctx.stroke();
            ctx.restore();
        }

        // Still seeing stars after getting back up
        if (this.dizzyTimer > 0 && typeof Ragdolls !== "undefined") {
            var dt = Date.now() * 0.007;
            ctx.save();
            ctx.globalAlpha = Math.min(1, this.dizzyTimer / 25);
            for (let i = 0; i < 3; i++) {
                var da = dt + i * 2.1;
                Ragdolls.star(cx + Math.cos(da) * w * 0.55, y - 8 + Math.sin(da) * 6, Math.max(4, 7 * cameraScaleX));
            }
            ctx.restore();
        }

        // Invulnerability sparkle
        if ((this.invulnTimer > 0 || this.hitCooldown > 0) && Math.floor((this.invulnTimer + this.hitCooldown) / 4) % 2 === 0) {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = "#ffffff";
            this.roundRectPath(x, y, w, h, 8);
            ctx.fill();
            ctx.restore();
        }
    }

    animate() {
        if (this.dead) return;
        Components.moveTypeFinder(this);
        Components.shootLazer(this);
        this.move();
        this.createCharacter();
    }
}

// Resize a character in place (feet stay on the ground). k is relative to its first size, so 1 = back to normal.
Character.prototype.scaleSize = function(k) {
    if (this.baseW === undefined) { this.baseW = this.s1; this.baseH = this.s2; }
    var oldH = this.s2, nw = Math.round(this.baseW * k), nh = Math.round(this.baseH * k);
    this.s1 = this.w = nw; this.s2 = this.h = nh;
    this.hitbox = Math.makeHitbox(nw, nh); this.poly = Math.makeHitbox(nw, nh);
    this.sizeScale = nw / s1;
    this.y += (nh - oldH) / 2;
    this.scaleX = k > 1 ? 0.75 : 1.25; this.scaleY = k > 1 ? 1.3 : 0.8;     // squash-and-stretch pop
};
