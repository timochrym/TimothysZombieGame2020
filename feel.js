// ============================================================================
// FEEL - engine-wide game-feel options and moves (backlog B1)
//   • Grab & throw PLAYERS / enemies (G / right-click with nothing else in reach); thrown ones ragdoll.
//   • Punch (Z for P1, M for P2): short-range ragdoll knockback with hit-stop and a camera zoom kick.
//   • Settings: bouncing bullets (ricochets), hero speed (Normal / Fast / Turbo), effects (Full / Calm).
//   • Object weight: any object may carry `weight` (default 1). Heavier = harder to shove, throw and blast.
// ============================================================================
var Feel = {
    zoomKick: 0,

    // ---------------------------------------------------------------- settings
    speedMult: function() { return ({ normal: 1, fast: 1.25, turbo: 1.55 })[settings.heroSpeed] || 1; },
    calm: function() { return settings.fx !== "full"; },
    ricochets: function() { return settings.ricochet || 0; },

    // ---------------------------------------------------------------- grab & throw characters
    tryGrabCharacter: function(ch) {
        var best = null, bd = 170;
        var pool = characters.concat(zombies);
        for (let i = 0; i < pool.length; i++) {
            var o = pool[i];
            if (o === ch || o.dead || o.grabbedBy || o.heldChar || o.liveRagdoll) continue;
            if ((o.s1 || 80) > 125) continue;                    // bosses and brutes are too big to lift
            var d = Math.hypot(o.x - ch.x, o.y - ch.y);
            if (d < bd) { bd = d; best = o; }
        }
        if (!best) return false;
        ch.heldChar = best;
        best.grabbedBy = ch;
        best.grabT = 0;
        Components.addFloatingText("GRABBED " + (best.playerLabel || best.zombiePower || "") + "!", ch.x, ch.y + 90, "#00f5d4", 16);
        if (typeof SFX !== "undefined") SFX.play("grab", ch.x, ch.y);
        return true;
    },

    throwCharacter: function(ch, tx, ty) {
        var o = ch.heldChar;
        ch.heldChar = null;
        if (!o) return;
        o.grabbedBy = null;
        var dx = tx - ch.x, dy = ty - ch.y, L = Math.hypot(dx, dy);
        if (L < 1) { var rad = Math.radians(ch.degree || 90); dx = Math.sin(rad); dy = Math.cos(rad); } else { dx /= L; dy /= L; }
        var w = o.weight || 1;
        o.ragdollImmune = 0;
        o.lastHitBy = ch;
        if (typeof o.startRagdoll === "function") o.startRagdoll(dx * 22 / w, dy * 22 / w + 5, 70);
        else { o.xspeed = dx * 22 / w; o.yspeed = dy * 22 / w + 5; }
        if (o.liveRagdoll) { o.liveRagdoll.thrownBy = ch; o.liveRagdoll.projectileTimer = 60; }
        Components.addFloatingText("YEET!", ch.x, ch.y + 90, "#ffd23f", 20);
        if (typeof SFX !== "undefined") SFX.play("dash", ch.x, ch.y);
    },

    // ---------------------------------------------------------------- punch
    punch: function(ch) {
        if (!ch || ch.dead || ch.liveRagdoll || (ch.punchCd || 0) > 0) return;
        ch.punchCd = 22; ch.punchT = 10;
        var dir = ch.lastFacing || (ch.xspeed >= 0 ? 1 : -1);
        var fx = ch.x + dir * (ch.s1 / 2 + 40), fy = ch.y + 6;
        var hit = false;
        var pool = characters.concat(zombies);
        for (let i = 0; i < pool.length; i++) {
            var o = pool[i];
            if (o === ch || o.dead) continue;
            if (o.team === ch.team && !(typeof brawl !== "undefined" && brawl.active) && !devOpts.friendlyFire) continue;
            if (Math.abs(o.x - fx) > o.s1 / 2 + 50 || Math.abs(o.y - fy) > o.s2 / 2 + 40) continue;
            var w = o.weight || 1;
            o.takeDamage(-16 * (typeof rpgDamageMult !== "undefined" ? rpgDamageMult : 1), dir * 7 / w, 6 / w, ch);
            if (!o.dead && typeof o.startRagdoll === "function" && !o.isPlayer) { o.ragdollImmune = 0; o.startRagdoll(dir * 7.5 / w, 6.5 / w, 45); }
            hit = true;
        }
        if (typeof Ragdolls !== "undefined") for (let i = 0; i < Ragdolls.list.length; i++) {
            var rd = Ragdolls.list[i], b = rd.bounds(30);
            if (fx > b.l && fx < b.r && fy > b.b && fy < b.t) { rd.impulseAt(fx, fy, dir * 15, 9, 110); hit = true; }
        }
        for (let i = 0; i < movingObjects.length; i++) {
            var m = movingObjects[i];
            if (m.dead || m.heldBy || Math.abs(m.x - fx) > m.w / 2 + 40 || Math.abs(m.y - fy) > m.h / 2 + 40) continue;
            var mw = m.weight || 1;
            m.xspeed += dir * 13 / mw; m.yspeed += 6 / mw; hit = true;
        }
        if (hit) {
            Juice.hitStop(4);
            this.zoomKick = Math.max(this.zoomKick, 0.14);
            screenShake = Math.max(screenShake, 5);
            Components.spawnSparks(fx, fy, "#fde68a", 6);
            if (typeof SFX !== "undefined") SFX.play("kick", fx, fy, 1);
            if (Math.random() < 0.5) Juice.comic(fx, fy + 70);
        } else if (typeof SFX !== "undefined") SFX.play("whoosh", fx, fy, 0.5);
    },

    zoomMult: function() { return 1 + this.zoomKick; },

    // ---------------------------------------------------------------- per tick (after characters move)
    update: function() {
        this.zoomKick *= 0.86;
        if (this.zoomKick < 0.002) this.zoomKick = 0;
        var all = characters.concat(zombies);
        for (let i = 0; i < all.length; i++) {
            var c = all[i];
            if (c.punchCd > 0) c.punchCd--;
            if (c.punchT > 0) c.punchT--;
            var o = c.heldChar;
            if (!o) continue;
            if (c.dead || o.dead || c.liveRagdoll || ++o.grabT > 360) { o.grabbedBy = null; c.heldChar = null; continue; }   // wriggles free after 6 s
            var rad = Math.radians(c.degree || 90);
            o.x = c.x + Math.sin(rad) * (c.s1 * 0.6 + o.s1 * 0.4);
            o.y = c.y + Math.cos(rad) * (c.s2 * 0.5) + 40;
            o.xspeed = 0; o.yspeed = 0;
            o.leftPressed = o.rightPressed = o.upPressed = false;
        }
    },

    drawFront: function() {
        var all = characters.concat(zombies), k = cameraScaleX;
        for (let i = 0; i < all.length; i++) {
            var c = all[i];
            if (c.dead || !(c.punchT > 0)) continue;
            var dir = c.lastFacing || 1, ext = Math.sin((10 - c.punchT) / 10 * Math.PI);
            var sx = wsx(c.x + dir * (c.s1 / 2 + 8 + 38 * ext)), sy = wsy(c.y + 6);
            ctx.fillStyle = "#f2c9a0"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(sx, sy, (11 + 4 * ext) * k + 2, 0, 7); ctx.fill(); ctx.stroke();
        }
    }
};
