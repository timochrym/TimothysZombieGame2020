// ============================================================================
// BUILD - Minecraft / Fortnite-style building during play (any game with the `building` flag).
//
//   C (P1) / ; (P2) toggles BUILD MODE. 1-4 (P1) or [ (P2) picks a piece: block, wall, floor, ramp.
//   T cycles the material: wood (cheap, weak) -> stone -> metal (tough).
//   Click / F (P1), Enter (P2): place at the grid-snapped ghost. Hold it to spam pieces Fortnite-style.
//   Right-click / G (P1), , (P2): take a piece back (refunds half).
//   Placed pieces have HP: bullets, explosions and enemies pushing on them break them.
//
//   Modes: flags.building = true to enable, flags.buildFree = true for unlimited materials.
//   Hooks: buildCost(ch, piece, mat) -> number;  canBuild(ch) -> bool;  onBuild(ch, obj) / onBreakPiece(obj, by)
// ============================================================================
var BUILD_PIECES = [
    { id: "block", label: "Block", icon: "🧱", w: 80, h: 80, cost: 10 },
    { id: "wall", label: "Wall", icon: "▮", w: 20, h: 160, cost: 10 },
    { id: "floor", label: "Floor", icon: "▬", w: 160, h: 20, cost: 10 },
    { id: "ramp", label: "Ramp", icon: "◢", w: 160, h: 160, cost: 15 }
];
var BUILD_MATS = [
    { id: "wood", label: "Wood", hp: 60, tex: "wood_plank", color: "#a16207" },
    { id: "stone", label: "Stone", hp: 150, tex: "stone_block", color: "#64748b" },
    { id: "metal", label: "Metal", hp: 280, tex: "metal_plate", color: "#94a3b8" }
];

var Build = {
    G: 80,                 // grid
    REACH: 560,            // max distance from the hero
    localToggle: 0,        // LAN client counters (sent to the host)
    localPiece: 0,
    localMat: 0,

    on: function() { return GameModes.flag("building", false); },
    free: function() { return GameModes.flag("buildFree", false) || godMode; },

    mats: function(ch) {
        if (!ch.buildMats) ch.buildMats = { wood: 60, stone: 0, metal: 0 };
        return ch.buildMats;
    },

    toggle: function(ch) {
        if (!ch || ch.dead || !this.on()) return;
        if (GameModes.has("canBuild") && !GameModes.call("canBuild", ch)) return;
        ch.buildMode = !ch.buildMode;
        if (ch.buildMode && typeof helpTimer !== "undefined") helpTimer = 0;     // the hotbar replaces the controls card
        ch.buildPiece = ch.buildPiece || 0;
        ch.buildMat = ch.buildMat || 0;
        if (typeof SFX !== "undefined") SFX.play("ui", ch.x, ch.y);
        Components.addFloatingText(ch.buildMode ? "BUILD MODE" : "COMBAT MODE", ch.x, ch.y + 110, ch.buildMode ? "#facc15" : "#7dd3fc", 16);
    },

    pick: function(ch, i) { if (ch) { ch.buildPiece = (i + BUILD_PIECES.length) % BUILD_PIECES.length; } },
    cycleMat: function(ch) { if (ch) ch.buildMat = ((ch.buildMat || 0) + 1) % BUILD_MATS.length; },

    // the world point a hero is building at: the mouse for P1 / LAN players, otherwise in front of them
    aimPoint: function(ch) {
        if (ch.isRemote && ch.netAimX !== undefined) return [ch.netAimX, ch.netAimY];
        if (ch.playerIndex === 0 && !ch.isRemote && !ch.isCPU && typeof useMouseAim !== "undefined" && useMouseAim) return Components.getMouseWorldPos();
        if (ch.buildAimX !== undefined) return [ch.buildAimX, ch.buildAimY];
        var rad = Math.radians(ch.degree || 90);
        return [ch.x + Math.sin(rad) * 150, ch.y + Math.cos(rad) * 150];
    },

    // snapped placement box {x, y, w, h, piece, dir} for a hero
    ghost: function(ch) {
        var p = BUILD_PIECES[ch.buildPiece || 0], G = this.G;
        var a = this.aimPoint(ch);
        var dx = a[0] - ch.x, dy = a[1] - ch.y, d = Math.hypot(dx, dy);
        if (d > this.REACH) { a = [ch.x + dx / d * this.REACH, ch.y + dy / d * this.REACH]; }
        var x, y;
        if (p.id === "wall") { x = Math.round(a[0] / G) * G; y = Math.floor(a[1] / G) * G + p.h / 2; }
        else if (p.id === "floor") { x = Math.floor(a[0] / (G * 2)) * G * 2 + G; y = Math.round(a[1] / G) * G - p.h / 2; }
        else if (p.id === "ramp") { x = Math.floor(a[0] / (G * 2)) * G * 2 + G; y = Math.floor(a[1] / (G * 2)) * G * 2 + G; }
        else { x = Math.floor(a[0] / G) * G + G / 2; y = Math.floor(a[1] / G) * G + G / 2; }
        var dir = (a[0] >= ch.x) ? "right" : "left";
        var g = { x: x, y: y, w: p.w, h: p.h, piece: p, dir: dir };
        g.ok = this.valid(g, ch);
        return g;
    },

    valid: function(g, ch) {
        // never inside solid level geometry, other pieces or characters
        var list = StaticGrid.query(g.x - g.w / 2 + 2, g.y - g.h / 2 + 2, g.x + g.w / 2 - 2, g.y + g.h / 2 - 2, false, this._buf || (this._buf = []));
        for (let i = 0; i < list.length; i++) {
            var s = list[i];
            if (s.dead || s.noCollide || s.isInfiniteBase) continue;
            if (Math.abs(g.x - s.x) < (g.w + s.w) / 2 - 2 && Math.abs(g.y - s.y) < (g.h + s.h) / 2 - 2) return false;
        }
        var chars = characters.concat(zombies);
        for (let i = 0; i < chars.length; i++) {
            var c = chars[i];
            if (c.dead) continue;
            if (Math.abs(g.x - c.x) < (g.w + c.s1) / 2 - 4 && Math.abs(g.y - c.y) < (g.h + c.s2) / 2 - 4) return false;
        }
        return true;
    },

    cost: function(ch, p, m) {
        if (this.free()) return 0;
        if (GameModes.has("buildCost")) { var c = GameModes.call("buildCost", ch, p, m); if (c !== undefined) return c; }
        return p.cost;
    },

    place: function(ch) {
        var g = this.ghost(ch);
        if (!g.ok) return false;
        var m = BUILD_MATS[ch.buildMat || 0];
        var mats = this.mats(ch);
        var c = this.cost(ch, g.piece, m);
        if (c > 0 && (mats[m.id] || 0) < c) {
            if (!ch._noMatT || ch._noMatT < Date.now()) { Components.addFloatingText("Need " + c + " " + m.label.toLowerCase(), ch.x, ch.y + 110, "#fca5a5", 15); ch._noMatT = Date.now() + 700; }
            return false;
        }
        if (c > 0) mats[m.id] -= c;
        var opts = { name: "Built " + g.piece.label, texture: m.tex, kind: g.piece.id === "wall" ? "wall" : "block" };
        var obj = g.piece.id === "ramp" ? Object.addRamp(g.x, g.y, g.w, g.h, g.dir, m.color, opts) : Object.addBox(g.x, g.y, g.w, g.h, m.color, opts);
        obj.buildHP = obj.buildMaxHP = m.hp;
        obj.builtBy = ch.playerIndex;
        obj.buildMat = m.id;
        obj.buildCost = c;
        this.changed(obj);
        GameModes.call("onBuild", ch, obj);
        if (typeof SFX !== "undefined") SFX.play("select", g.x, g.y, 0.6, 0.8 + Math.random() * 0.3);
        return true;
    },

    // take back the piece under the aim point (refund half)
    removeAt: function(ch) {
        var a = this.aimPoint(ch);
        for (let i = staticObjects.length - 1; i >= 0; i--) {
            var s = staticObjects[i];
            if (s.buildHP === undefined || s.dead) continue;
            if (Math.abs(a[0] - s.x) <= s.w / 2 + 6 && Math.abs(a[1] - s.y) <= s.h / 2 + 6) {
                if (Math.hypot(s.x - ch.x, s.y - ch.y) > this.REACH + 80) return false;
                var mats = this.mats(ch);
                if (!this.free() && s.buildCost) mats[s.buildMat] = (mats[s.buildMat] || 0) + Math.floor(s.buildCost / 2);
                this.destroy(s, ch, true);
                return true;
            }
        }
        return false;
    },

    damage: function(obj, amount, by) {
        if (obj.buildHP === undefined || obj.dead) return;
        if (GameModes.has("onPieceDamage") && GameModes.call("onPieceDamage", obj, amount, by)) return;
        obj.buildHP += Math.min(0, amount);
        obj.hitFlash = 6;
        if (obj.buildHP <= 0) this.destroy(obj, by, false);
    },

    destroy: function(obj, by, quiet) {
        obj.dead = true;
        var i = staticObjects.indexOf(obj);
        if (i !== -1) staticObjects.splice(i, 1);
        var col = obj.color || "#a16207";
        for (let k = 0; k < (quiet ? 4 : 8); k++) {
            if (particles.length >= 90) particles.shift();
            particles.push({ x: obj.x + (Math.random() - 0.5) * obj.w, y: obj.y + (Math.random() - 0.5) * obj.h, w: 16, h: 16, xspeed: (Math.random() - 0.5) * 10, yspeed: 4 + Math.random() * 8, poly: Math.makeHitbox(16, 16), color: col, life: 34 });
        }
        if (!quiet && typeof SFX !== "undefined") SFX.play("explode", obj.x, obj.y, 0.35, 1.8);
        GameModes.call("onBreakPiece", obj, by);
        this.changed(obj);
    },

    changed: function(obj) {
        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
        if (typeof StaticGrid !== "undefined") StaticGrid.build();
        if (typeof Pathfinder !== "undefined" && Pathfinder.invalidateRect) Pathfinder.invalidateRect(obj.x, obj.y, obj.w, obj.h);
    },

    onExplosion: function(x, y, radius, damage, source) {
        for (let i = staticObjects.length - 1; i >= 0; i--) {
            var s = staticObjects[i];
            if (s.buildHP === undefined || s.dead) continue;
            var d = Math.hypot(s.x - x, s.y - y);
            if (d < radius) this.damage(s, Math.min(-25, damage * 2.2) * (1 - d / radius * 0.6), source);
        }
    },

    // per tick (from frame): build-mode input for every hero, enemies chewing through pieces
    update: function() {
        if (!this.on()) { for (let i = 0; i < characters.length; i++) characters[i].buildMode = false; return; }
        for (let i = 0; i < characters.length; i++) {
            var ch = characters[i];
            if (!ch.buildMode || ch.dead) continue;
            ch.buildCd = Math.max(0, (ch.buildCd || 0) - 1);
            if (ch.buildWant && ch.buildCd === 0) { if (this.place(ch)) ch.buildCd = 6; }
        }
        // enemies pushing into a piece gnaw at it
        for (let z = 0; z < zombies.length; z++) {
            var zz = zombies[z];
            if (zz.dead || !(zz.leftPressed || zz.rightPressed)) continue;
            var dir = zz.rightPressed ? 1 : -1;
            for (let i = 0; i < staticObjects.length; i++) {
                var s = staticObjects[i];
                if (s.buildHP === undefined || s.dead) continue;
                if (Math.abs(zz.y - s.y) < (zz.s2 + s.h) / 2 - 6 && (s.x - zz.x) * dir > 0 && Math.abs(s.x - zz.x) < (zz.s1 + s.w) / 2 + 6) {
                    this.damage(s, -0.6 * (zz.zombiePower === "TANK" ? 3 : 1) * (devOpts.enemyDamage || 1), zz);
                    break;
                }
            }
        }
        for (let i = 0; i < staticObjects.length; i++) if (staticObjects[i].hitFlash > 0) staticObjects[i].hitFlash--;
    },

    // ---- drawing: ghost previews, damage cracks, the hotbar
    drawWorld: function() {
        var k = cameraScaleX;
        for (let i = 0; i < staticObjects.length; i++) {
            var s = staticObjects[i];
            if (s.buildHP === undefined || s.dead) continue;
            var frac = s.buildHP / s.buildMaxHP;
            if (frac < 0.95 || s.hitFlash > 0) {
                var l = wsx(s.x - s.w / 2), t = wsy(s.y + s.h / 2);
                ctx.save();
                ctx.fillStyle = s.hitFlash > 0 ? "rgba(255,255,255,0.35)" : "rgba(0,0,0," + (0.45 * (1 - frac)).toFixed(2) + ")";
                ctx.fillRect(l, t, s.w * k, s.h * k);
                if (frac < 0.6) {
                    ctx.strokeStyle = "rgba(10,15,22,0.8)"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(l + s.w * k * 0.2, t); ctx.lineTo(l + s.w * k * 0.5, t + s.h * k * 0.45); ctx.lineTo(l + s.w * k * 0.35, t + s.h * k); ctx.stroke();
                }
                ctx.restore();
            }
        }
    },

    drawFront: function() {
        if (!this.on()) return;
        var k = cameraScaleX;
        for (let i = 0; i < characters.length; i++) {
            var ch = characters[i];
            if (!ch.buildMode || ch.dead) continue;
            var g = this.ghost(ch);
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = g.ok ? "rgba(74,222,128,0.35)" : "rgba(248,113,113,0.35)";
            ctx.strokeStyle = g.ok ? "#4ade80" : "#f87171";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([8, 5]);
            ctx.beginPath();
            var l = wsx(g.x - g.w / 2), r = wsx(g.x + g.w / 2), t = wsy(g.y + g.h / 2), b = wsy(g.y - g.h / 2);
            if (g.piece.id === "ramp") {
                if (g.dir === "right") { ctx.moveTo(l, b); ctx.lineTo(r, t); ctx.lineTo(r, b); }
                else { ctx.moveTo(l, t); ctx.lineTo(r, b); ctx.lineTo(l, b); }
                ctx.closePath();
            } else ctx.rect(l, t, r - l, b - t);
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }
    },

    drawHUD: function() {
        if (!this.on()) return;
        var heroes = characters.filter(function(c) { return c.isPlayer && !c.isCPU && !c.dead && !c.isRemote; });
        if (typeof Net !== "undefined" && Net.role === "client") { var me = Net.myChar(); heroes = me ? [me] : []; }
        for (let h = 0; h < heroes.length; h++) {
            var ch = heroes[h];
            var bw = 64, n = BUILD_PIECES.length, total = n * (bw + 8) + 150;
            var x0 = cssW / 2 - total / 2 + (h - (heroes.length - 1) / 2) * (total + 30), y0 = cssH - 96;
            if (!ch.buildMode) {
                uiText((ch.playerLabel || "P1") + "  " + (ch.playerIndex === 1 ? ";" : "C") + ": build mode", x0 + total / 2, cssH - 48, 12, "rgba(250,204,21,0.75)", "center", "800");
                continue;
            }
            uiPanel(x0 - 8, y0 - 8, total + 16, bw + 34, "#facc15", 0.9);
            for (let i = 0; i < n; i++) {
                var p = BUILD_PIECES[i], bx = x0 + i * (bw + 8);
                ctx.fillStyle = i === (ch.buildPiece || 0) ? "rgba(250,204,21,0.35)" : "rgba(255,255,255,0.06)";
                ctx.fillRect(bx, y0, bw, bw);
                ctx.strokeStyle = i === (ch.buildPiece || 0) ? "#facc15" : "#475569"; ctx.lineWidth = 2; ctx.strokeRect(bx, y0, bw, bw);
                uiText(p.icon, bx + bw / 2, y0 + 36, 24, "#fff", "center", "800");
                uiText((ch.playerIndex === 1 ? "[" : String(i + 1)) + " " + p.label, bx + bw / 2, y0 + bw + 14, 10, "#cbd5e1", "center", "700");
            }
            var m = BUILD_MATS[ch.buildMat || 0], mats = this.mats(ch);
            var mx = x0 + n * (bw + 8) + 6;
            uiText("T: " + m.label, mx, y0 + 22, 14, m.color === "#a16207" ? "#fbbf24" : "#e2e8f0", "left", "900");
            uiText(this.free() ? "∞ free" : ((mats[m.id] || 0) + " left · " + this.cost(ch, BUILD_PIECES[ch.buildPiece || 0], m) + " each"), mx, y0 + 42, 12, "#cbd5e1", "left", "700");
            uiText("click place · R-click take back", mx, y0 + 60, 10, "#94a3b8", "left", "700");
        }
    }
};
