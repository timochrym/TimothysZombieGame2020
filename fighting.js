// ============================================================================
// FIGHTING: shared hero settings for every game that has shooting
//   settings.weapon     "blaster" (shoot)  |  "fists" (the fire button punches)
//   settings.ammo       "unlimited" (default) | "limited" (magazine + reserve, the old survival rule)
//   settings.hitRagdoll "short" (default: quick get-up) | "full" (the old long tumble) | "off" (just a flinch)
// Fists moves (fire button = F / click / pad shoot):
//   ground: punch, punch, KICK (3-hit combo)   ·  hold UP: uppercut (launches)
//   in the air + DOWN: ground pound (shockwave on landing)   ·  while dashing: flying kick
// ============================================================================
var FIGHT_WEAPONS = [["blaster", "🔫 Blaster"], ["fists", "👊 Fists (punch, kick, uppercut, ground pound)"]];
var FIGHT_AMMO = [["unlimited", "∞ Unlimited"], ["limited", "Limited (reload, pick up packs)"]];
var FIGHT_RAGDOLL = [["short", "Short (quick get-up)"], ["full", "Full tumble"], ["off", "Off (just a flinch)"]];
var FIGHT_MOVES = {
    punch:  { dmg: 12, kx: 5,  ky: 3,  reach: 80,  up: 0,   cd: 11, dur: 9,  label: "" },
    kick:   { dmg: 20, kx: 12, ky: 6,  reach: 100, up: -10, cd: 22, dur: 14, label: "KICK!" },
    upper:  { dmg: 18, kx: 3,  ky: 15, reach: 75,  up: 40,  cd: 26, dur: 16, label: "UPPERCUT!" },
    flying: { dmg: 22, kx: 14, ky: 5,  reach: 95,  up: 0,   cd: 20, dur: 12, label: "FLYING KICK!" },
    pound:  { dmg: 24, kx: 9,  ky: 11, reach: 170, up: 0,   cd: 30, dur: 0,  label: "GROUND POUND!" }
};

(function() {
    if (typeof settings === "undefined") return;
    if (["blaster", "fists"].indexOf(settings.weapon) === -1) settings.weapon = "blaster";
    if (["unlimited", "limited"].indexOf(settings.ammo) === -1) settings.ammo = "unlimited";
    if (["short", "full", "off"].indexOf(settings.hitRagdoll) === -1) settings.hitRagdoll = "short";
})();

var Fight = {
    // does this hero punch instead of shooting right now?
    fists: function(ch) {
        return !!(ch && ch.isPlayer && !ch.isZombie && settings.weapon === "fists" && GameModes.flag("shooting", true));
    },
    set: function(key, v) {
        settings[key] = v;
        if (typeof saveSettings === "function") saveSettings();
    },
    targets: function(ch) {
        var out = [];
        for (let i = 0; i < zombies.length; i++) if (!zombies[i].dead) out.push(zombies[i]);
        for (let i = 0; i < characters.length; i++) { var c = characters[i]; if (c !== ch && !c.dead && !c.eliminated) out.push(c); }
        return out;
    },
    facing: function(ch) {
        if (ch.mouseShooting && typeof Components.getMouseWorldPos === "function") {
            var m = Components.getMouseWorldPos(); if (Math.abs(m[0] - ch.x) > 4) return m[0] > ch.x ? 1 : -1;
        }
        if (ch.rightPressed) return 1;
        if (ch.leftPressed) return -1;
        // no direction held: swing at the nearest enemy in reach (melee aim-assist), else keep facing
        var f = ch.lastFacing || 1, R = FIGHT_MOVES.kick;
        var front = this.hitBox(ch, R, f), back = this.hitBox(ch, R, -f);
        if (!front.length && back.length) return -f;
        return f;
    },
    // anyone (enemy or other player) inside the move's box in front of the hero
    hitBox: function(ch, mv, dir) {
        var half = (ch.s1 || 60) / 2;
        var cx = ch.x + dir * (half + mv.reach / 2), cy = ch.y + (mv.up || 0);
        var hw = mv.reach / 2, hh = (ch.s2 || 80) * 0.55;
        var hit = [], ts = this.targets(ch);
        for (let i = 0; i < ts.length; i++) {
            var t = ts[i];
            if (Math.abs(t.x - cx) < hw + (t.s1 || 50) / 2 && Math.abs(t.y - cy) < hh + (t.s2 || 60) / 2) hit.push(t);
        }
        return hit;
    },
    dmgMult: function() {
        return (typeof rpgDamageMult !== "undefined" ? rpgDamageMult : 1) * ((typeof devOpts !== "undefined" && devOpts.playerDamage) || 1);
    },
    strike: function(ch, name, dir) {
        var mv = FIGHT_MOVES[name];
        var hits = this.hitBox(ch, mv, dir), mult = this.dmgMult(), landed = 0;
        for (let i = 0; i < hits.length; i++) {
            var t = hits[i], before = t.health, pct = t.damagePct;
            t.takeDamage(-mv.dmg * mult, dir * mv.kx, mv.ky, ch);
            if (t.health !== before || t.damagePct !== pct) landed++;
        }
        // kick bodies lying around too
        if (typeof Ragdolls !== "undefined" && Ragdolls.nearestCorpse) {
            var body = Ragdolls.nearestCorpse(ch.x + dir * (ch.s1 / 2 + mv.reach / 2), ch.y, mv.reach);
            if (body && body.addVelocity) { if (body.wake) body.wake(); body.addVelocity(dir * mv.kx * 1.4, mv.ky * 1.2); body.lastAttacker = ch; }
        }
        var fx = ch.x + dir * (ch.s1 / 2 + mv.reach * 0.7), fy = ch.y + (mv.up || 0);
        if (landed) {
            Components.spawnSparks(fx, fy, "#fde68a", 5 + landed * 2);
            if (typeof SFX !== "undefined") SFX.play(name === "punch" ? "hit" : "bonk", fx, fy, name === "punch" ? 0.6 : 1);
            if (name !== "punch" && typeof Juice !== "undefined") Juice.hitStop(name === "kick" ? 3 : 4);
            if (mv.label) Components.addFloatingText(mv.label, ch.x, ch.y + 90, "#fde047", 16);
        } else if (typeof SFX !== "undefined") SFX.play("dash", ch.x, ch.y, 0.25);
        ch.fightHits = (ch.fightHits || 0) + landed;
        return landed;
    },
    // called from Components.shootLazer instead of the blaster code
    update: function(ch) {
        if (ch.mlCd > 0) ch.mlCd--;
        if (ch.mlT > 0) ch.mlT--;
        if (ch.mlComboT > 0) ch.mlComboT--; else ch.mlCombo = 0;
        // ground pound: dive, then a shockwave where you land
        if (ch.mlPound) {
            // we hold the dive at -22 every frame, so any slow-down means we hit something (floor, enemy, bounce pad)
            if (ch.ragdollTimer > 0) ch.mlPound = false;
            else if (ch.onGround || ch.yspeed > -15) {
                ch.mlPound = false;
                var mv = FIGHT_MOVES.pound, ts = this.targets(ch), mult = this.dmgMult(), landed = 0;
                for (let i = 0; i < ts.length; i++) {
                    var t = ts[i], dx = t.x - ch.x;
                    if (Math.abs(dx) < mv.reach && Math.abs(t.y - ch.y) < 130) { t.takeDamage(-mv.dmg * mult, (Math.sign(dx) || 1) * mv.kx, mv.ky, ch); landed++; }
                }
                Components.addRing(ch.x, ch.y - ch.s2 / 2, mv.reach, "#fde68a", 14);
                Components.spawnSparks(ch.x, ch.y - ch.s2 / 2, "#e5e7eb", 10);
                if (typeof SFX !== "undefined") SFX.play("bonk", ch.x, ch.y, 1);
                if (typeof Juice !== "undefined") Juice.hitStop(4);
                if (typeof screenShake !== "undefined") screenShake = Math.max(screenShake, 10);
                Components.addFloatingText(mv.label, ch.x, ch.y + 90, "#fde047", 17);
                ch.fightHits = (ch.fightHits || 0) + landed;
                ch.mlCd = mv.cd; ch.mlMove = "pound"; ch.mlT = 10; ch.mlDur = 10;
            } else ch.yspeed = Math.min(ch.yspeed, -22);
            return;
        }
        if (!ch.shootPressed || ch.mlCd > 0) return;
        var dir = this.facing(ch);
        // a CPU only swings when someone is actually in reach
        if (ch.isCPU && !this.hitBox(ch, FIGHT_MOVES.kick, dir).length) return;
        var name;
        if (!ch.onGround && ch.downPressed) {
            ch.mlPound = true; ch.yspeed = -22; ch.xspeed *= 0.3;
            ch.mlMove = "pound"; ch.mlT = ch.mlDur = 30; ch.mlDir = dir;
            Components.addFloatingText("▼", ch.x, ch.y + 70, "#fde68a", 18);
            return;
        }
        if (ch.dashTimer > 0) name = "flying";
        else if (ch.upPressed) name = "upper";
        else { ch.mlCombo = (ch.mlCombo || 0) + 1; name = ch.mlCombo >= 3 ? "kick" : "punch"; if (ch.mlCombo >= 3) ch.mlCombo = 0; ch.mlComboT = 32; }
        var mv = FIGHT_MOVES[name];
        ch.lastFacing = dir; ch.mlDir = dir; ch.mlMove = name; ch.mlT = ch.mlDur = mv.dur; ch.mlCd = mv.cd;
        ch.degree = name === "upper" ? (dir > 0 ? 30 : 330) : (dir > 0 ? 90 : 270);
        ch.lastShotAt = Date.now();
        if (name === "upper") { ch.yspeed = Math.max(ch.yspeed, 9); ch.onGround = false; }
        else if (ch.onGround) ch.xspeed += dir * (name === "kick" ? 3 : 1.5);
        this.strike(ch, name, dir);
    },
    // 0..1: how far the fist / foot is out right now (for drawing)
    reachK: function(ch) {
        if (!(ch.mlT > 0) || !ch.mlDur) return 0;
        var p = 1 - ch.mlT / ch.mlDur;
        return p < 0.35 ? p / 0.35 : Math.max(0, 1 - (p - 0.35) / 0.65);
    },
    // fist / foot and a swoosh in front of the hero (world-space, after the body)
    drawFor: function(ch) {
        if (!this.fists(ch) || ch.dead) return;
        var k = cameraScaleX, dir = ch.mlDir || ch.lastFacing || 1, e = this.reachK(ch);
        var sx = wsx(ch.x), sy = wsy(ch.y), half = ch.s1 / 2 * k;
        ctx.save();
        var skin = typeof ch.accent === "function" ? ch.accent() : "#ff5a5f";
        if (ch.mlPound) {
            ctx.strokeStyle = "rgba(253,230,138,0.8)"; ctx.lineWidth = 4 * k;
            for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(sx + i * 18 * k, sy - ch.s2 * 0.9 * k); ctx.lineTo(sx + i * 18 * k, sy - ch.s2 * 0.5 * k); ctx.stroke(); }
        } else if (e > 0) {
            var mv = FIGHT_MOVES[ch.mlMove] || FIGHT_MOVES.punch;
            var foot = ch.mlMove === "kick" || ch.mlMove === "flying";
            var fx = sx + dir * (half * 0.6 + mv.reach * e * k), fy = sy - (mv.up || 0) * e * k + (foot ? ch.s2 * 0.25 * k : 0);
            // limb
            ctx.strokeStyle = "#0a0f16"; ctx.lineCap = "round"; ctx.lineWidth = Math.max(5, 12 * k);
            ctx.beginPath(); ctx.moveTo(sx + dir * half * 0.4, sy + (foot ? ch.s2 * 0.25 * k : 0)); ctx.lineTo(fx, fy); ctx.stroke();
            ctx.strokeStyle = skin; ctx.lineWidth = Math.max(3, 8 * k); ctx.stroke();
            // swoosh
            ctx.strokeStyle = "rgba(255,255,255," + (0.55 * e).toFixed(2) + ")"; ctx.lineWidth = Math.max(2, 4 * k);
            ctx.beginPath(); ctx.arc(sx, sy, half + mv.reach * 0.8 * k, dir > 0 ? -0.6 : Math.PI - 0.6, dir > 0 ? 0.6 : Math.PI + 0.6); ctx.stroke();
            // fist / boot
            ctx.fillStyle = foot ? "#1f2937" : "#ffffff"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = Math.max(2, 3 * k);
            ctx.beginPath(); ctx.arc(fx, fy, Math.max(5, (foot ? 11 : 10) * k), 0, 7); ctx.fill(); ctx.stroke();
        } else {
            // idle: two small fists up in a guard
            ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = Math.max(1.5, 2.5 * k);
            for (let j = 0; j < 2; j++) {
                ctx.beginPath(); ctx.arc(sx + dir * (half + (j ? 2 : 12) * k), sy - (j ? 2 : 10) * k, Math.max(4, 8 * k), 0, 7); ctx.fill(); ctx.stroke();
            }
        }
        ctx.restore();
    },
    drawAll: function() {
        if (settings.weapon !== "fists" || !GameModes.flag("shooting", true)) return;
        for (let i = 0; i < characters.length; i++) this.drawFor(characters[i]);
    }
};

// ---- Ragdoll-on-hit setting for heroes (enemies always tumble) ----
(function() {
    if (typeof Character === "undefined") return;
    var base = Character.prototype.startRagdoll;
    Character.prototype.startRagdoll = function(kx, ky, dur, noImpulse) {
        if (this.isPlayer && !this.isZombie && !this.forceRagdoll) {
            var m = settings.hitRagdoll;
            if (m === "off") {
                // a flinch instead: short stun, small shove, no tumble
                this.hitstun = Math.max(this.hitstun || 0, 8);
                this.scaleX = 1.2; this.scaleY = 0.85;
                return;
            }
            if (m === "short") {
                base.call(this, kx, ky, Math.max(12, Math.round((dur || 55) * 0.4)), noImpulse);
                if (this.ragdollTimer > 0) this.ragdollExtend = 80;      // at most ~10 extra frames while still flying
                return;
            }
        }
        return base.call(this, kx, ky, dur, noImpulse);
    };
})();
