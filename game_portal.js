// ============================================================================
// GAME: PORTAL LAB  -  test chambers with a two-portal gun
//   F / left-click / RT  = BLUE portal      G / right-click / LB = ORANGE portal      E / Y = grab crate
//   Portals only stick to WHITE panels. Momentum is conserved: fall fast into one portal, fly fast out of the other.
//   Glass blocks bodies but lets the portal beam through. Co-op: each player gets their own portal pair.
// ============================================================================
var PORTAL_LEN = 170;
var PORTAL_CHAMBERS = [];
var portalState = { chamber: 0, unlocked: 1, time: 0, done: false, doneTimer: 0, best: {} };
try { var _pp = JSON.parse(localStorage.getItem("timsPortalLab") || "null"); if (_pp) { portalState.unlocked = _pp.unlocked || 1; portalState.best = _pp.best || {}; portalState.chamber = Math.min(_pp.chamber || 0, portalState.unlocked - 1); } } catch (e) {}
function savePortal() { try { localStorage.setItem("timsPortalLab", JSON.stringify({ unlocked: portalState.unlocked, chamber: portalState.chamber, best: portalState.best })); } catch (e) {} }

var Portals = {
    pairs: {},
    fixed: null,
    beams: [],
    colors: [["#38bdf8", "#fb923c"], ["#a78bfa", "#f43f5e"]],
    tick: 0,

    clear: function() { this.pairs = {}; this.beams = []; this.fixed = null; this.syncNavLinks(); },

    // tell the pathfinder about every complete portal pair (walk into one mouth, come out of the other)
    syncNavLinks: function() {
        if (typeof Pathfinder === "undefined" || !Pathfinder.addLink) return;
        Pathfinder.clearLinks("portal");
        for (var ow in this.pairs) {
            var pr = this.pairFor(Number(ow));
            if (!pr[0] || !pr[1]) continue;
            for (let k = 0; k < 2; k++) {
                var P = pr[k], Q = pr[1 - k];
                // floor portals are entered from above, wall portals from the side they face
                Pathfinder.addLink(P.x + P.nx * 30, P.y + (P.ny > 0.5 ? 0 : -40), Q.x + Q.nx * 60, Q.y + (Q.ny > 0.5 ? 10 : -40), "teleport", { tag: "portal" });
            }
        }
        Pathfinder.refreshLinks();
    },

    pairFor: function(owner) {
        if (!this.pairs[owner]) this.pairs[owner] = [null, null];
        var p = this.pairs[owner];
        if (this.fixed) p[1] = this.fixed;
        return p;
    },

    // Step along the aim ray; glass and one-way platforms let the beam through
    raycast: function(x, y, dx, dy) {
        var buf = [];
        var px = x, py = y;
        for (let t = 0; t < 400; t++) {
            var nx = px + dx * 9, ny = py + dy * 9;
            StaticGrid.query(nx - 1, ny - 1, nx + 1, ny + 1, false, buf);
            for (let i = 0; i < buf.length; i++) {
                var o = buf[i];
                if (o.dead || o.noCollide || o.glass || o.isRamp || o.kind === "platform" || o.isBumper) continue;
                var L = o.x - o.w / 2, R = o.x + o.w / 2, B = o.y - o.h / 2, T = o.y + o.h / 2;
                if (nx < L || nx > R || ny < B || ny > T) continue;
                // which face did the ray cross? (slab entry times)
                var tx = dx > 0 ? (L - px) / (dx * 9) : (dx < 0 ? (R - px) / (dx * 9) : -1);
                var ty = dy > 0 ? (B - py) / (dy * 9) : (dy < 0 ? (T - py) / (dy * 9) : -1);
                var hit = { obj: o };
                if (tx > ty) { hit.nx = dx > 0 ? -1 : 1; hit.ny = 0; hit.x = dx > 0 ? L : R; hit.y = py + dy * 9 * tx; }
                else { hit.nx = 0; hit.ny = dy > 0 ? -1 : 1; hit.y = dy > 0 ? B : T; hit.x = px + dx * 9 * ty; }
                return hit;
            }
            px = nx; py = ny;
        }
        return null;
    },

    place: function(ch, which) {
        if (!ch || ch.dead) return;
        var lvl = LevelManager.getCurrentLevel();
        if (which === 1 && lvl.onlyBlue) { Components.addFloatingText("This chamber has a fixed orange portal", ch.x, ch.y + 90, "#fb923c", 14); return; }
        var d = this.aimDir(ch), dx = d[0], dy = d[1];
        var col = this.colors[Math.min(1, ch.playerIndex)][which];
        var hit = this.raycast(ch.x, ch.y + 10, dx, dy);
        var endX = hit ? hit.x : ch.x + dx * 3600, endY = hit ? hit.y : ch.y + 10 + dy * 3600;
        this.beams.push({ x1: ch.x, y1: ch.y + 10, x2: endX, y2: endY, color: col, life: 14 });
        if (!hit || !hit.obj.portalable) { this.fizzle(endX, endY, col); return; }
        var o = hit.obj, half = PORTAL_LEN / 2;
        if (hit.nx !== 0) {
            if (o.h < PORTAL_LEN + 10) { this.fizzle(endX, endY, col); return; }
            hit.y = Math.max(o.y - o.h / 2 + half, Math.min(o.y + o.h / 2 - half, hit.y));
        } else {
            if (o.w < PORTAL_LEN + 10) { this.fizzle(endX, endY, col); return; }
            hit.x = Math.max(o.x - o.w / 2 + half, Math.min(o.x + o.w / 2 - half, hit.x));
        }
        // don't overlap another portal on the same face
        for (var ow in this.pairs) {
            for (let k = 0; k < 2; k++) {
                var q = this.pairs[ow][k];
                if (!q || (Number(ow) === ch.playerIndex && k === which)) continue;
                if (q.nx === hit.nx && q.ny === hit.ny && Math.hypot(q.x - hit.x, q.y - hit.y) < PORTAL_LEN) { this.fizzle(endX, endY, col); return; }
            }
        }
        var pair = this.pairFor(ch.playerIndex);
        pair[which] = { x: hit.x, y: hit.y, nx: hit.nx, ny: hit.ny, len: PORTAL_LEN, color: col, born: this.tick };
        this.syncNavLinks();
        if (typeof SFX !== "undefined") SFX.play("portal", hit.x, hit.y, 1, which ? 0.8 : 1.15);
        Components.spawnSparks(hit.x, hit.y, col, 8);
    },

    // the direction a hero's portal gun points: the mouse for P1, otherwise the stick / keyboard aim angle
    aimDir: function(ch) {
        var dx, dy;
        if (ch.playerIndex === 0 && useMouseAim && !ch.padAiming) { var m = Components.getMouseWorldPos(); dx = m[0] - ch.x; dy = m[1] - (ch.y + 10); }
        else { var rad = Math.radians(ch.degree); dx = Math.sin(rad); dy = Math.cos(rad); }
        var l = Math.hypot(dx, dy) || 1;
        return [dx / l, dy / l];
    },

    // aim reticle for every local hero (mouse, gamepad stick or P2 keys): where the beam would land and
    // whether a portal would stick there
    drawAim: function() {
        if (portalState.done) return;
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (c.isPlayer && !c.isCPU && !c.isRemote && !c.dead) this.drawAimFor(c);
        }
    },

    drawAimFor: function(ch) {
        var d = this.aimDir(ch), dx = d[0], dy = d[1];
        var hit = this.raycast(ch.x, ch.y + 10, dx, dy);
        if (!hit) return;
        var o = hit.obj, ok = !!o.portalable && (hit.nx !== 0 ? o.h >= PORTAL_LEN + 10 : o.w >= PORTAL_LEN + 10);
        var sx = wsx(hit.x), sy = wsy(hit.y), k = cameraScaleX;
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.moveTo(wsx(ch.x), wsy(ch.y + 10)); ctx.lineTo(sx, sy); ctx.stroke(); ctx.setLineDash([]);
        if (ok) {
            // a ghost of the portal outline on the face (left half blue, right half orange = "either fits")
            var half = PORTAL_LEN / 2 * k, vert = hit.nx !== 0, C = this.colors[Math.min(1, ch.playerIndex)];
            ctx.lineWidth = 3; ctx.globalAlpha = 0.75;
            ctx.strokeStyle = C[0]; ctx.beginPath(); ctx.ellipse(sx, sy, vert ? 7 : half, vert ? half : 7, 0, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
            ctx.strokeStyle = C[1]; ctx.beginPath(); ctx.ellipse(sx, sy, vert ? 7 : half, vert ? half : 7, 0, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
        } else {
            ctx.strokeStyle = "rgba(248,113,113,0.85)"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(sx - 8, sy - 8); ctx.lineTo(sx + 8, sy + 8); ctx.moveTo(sx + 8, sy - 8); ctx.lineTo(sx - 8, sy + 8); ctx.stroke();
        }
        ctx.restore();
    },

    fizzle: function(x, y, col) {
        Components.spawnSparks(x, y, "#94a3b8", 6);
        if (typeof SFX !== "undefined") SFX.play("fizzle", x, y);
    },

    // Teleport anything that moves into a portal mouth; speed is preserved and redirected out of the partner
    teleportAll: function() {
        var ents = [];
        for (let i = 0; i < characters.length; i++) if (!characters[i].dead && !characters[i].liveRagdoll) ents.push(characters[i]);
        for (let i = 0; i < zombies.length; i++) if (!zombies[i].dead && !zombies[i].liveRagdoll) ents.push(zombies[i]);
        for (let i = 0; i < movingObjects.length; i++) if (!movingObjects[i].dead && !movingObjects[i].heldBy) ents.push(movingObjects[i]);
        for (let i = 0; i < ents.length; i++) {
            var e = ents[i];
            if (e.portalCd > 0) { e.portalCd--; continue; }
            var done = false;
            for (var ow in this.pairs) {
                var pair = this.pairFor(Number(ow));
                if (!pair[0] || !pair[1] || done) continue;
                for (let k = 0; k < 2 && !done; k++) {
                    var P = pair[k], Q = pair[1 - k];
                    var tx = -P.ny, ty = P.nx;
                    var rx = e.x - P.x, ry = e.y - P.y;
                    var along = rx * tx + ry * ty, depth = rx * P.nx + ry * P.ny;
                    var hw = (e.w || e.s1) / 2, hh = (e.h || e.s2) / 2;
                    var halfN = Math.abs(P.nx) * hw + Math.abs(P.ny) * hh, halfT = Math.abs(tx) * hw + Math.abs(ty) * hh;
                    if (Math.abs(along) > P.len / 2 - halfT * 0.35) continue;
                    var vx = e.xspeed || 0, vy = e.yspeed || 0;
                    var vn = vx * P.nx + vy * P.ny;
                    var pushing = e.isPlayer && ((P.nx > 0.5 && e.leftPressed) || (P.nx < -0.5 && e.rightPressed));
                    var standingOn = P.ny > 0.5 && depth < halfN + 4;
                    if (!(vn < -0.3 || pushing || standingOn)) continue;
                    if (depth > halfN + 8 + Math.max(0, -vn) || depth < -halfN) continue;
                    this.teleport(e, P, Q, along, vn, vx * tx + vy * ty, hw, hh, halfT);
                    done = true;
                }
            }
        }
    },

    teleport: function(e, P, Q, along, vn, vt, hw, hh, halfT) {
        var speed = Math.max(-vn, 6);
        var qtx = -Q.ny, qty = Q.nx;
        var halfNQ = Math.abs(Q.nx) * hw + Math.abs(Q.ny) * hh;
        var a = Math.max(-(Q.len / 2 - halfT), Math.min(Q.len / 2 - halfT, -along));
        e.x = Q.x + qtx * a + Q.nx * (halfNQ + 6);
        e.y = Q.y + qty * a + Q.ny * (halfNQ + 6);
        e.xspeed = Q.nx * speed + qtx * (-vt);
        e.yspeed = Q.ny * speed + qty * (-vt);
        e.portalCd = 14;
        if (e instanceof Character) {
            e.onGround = false; e.jump = false; e.coyoteTimer = 0;
            e.flingTimer = 60;
            if (e.heldObject) { e.heldObject.x = e.x; e.heldObject.y = e.y + 60; }
        }
        Components.spawnSparks(P.x, P.y, P.color, 6);
        Components.spawnSparks(Q.x, Q.y, Q.color, 6);
        if (typeof SFX !== "undefined") SFX.play("warp", Q.x, Q.y);
    },

    draw: function() {
        this.tick++;
        var k = cameraScaleX;
        // white portal panels & glass
        for (let i = 0; i < staticObjects.length; i++) {
            var o = staticObjects[i];
            if (!o.portalable && !o.glass) continue;
            var l = wsx(o.x - o.w / 2), t = wsy(o.y + o.h / 2), w2 = o.w * k, h2 = o.h * k;
            if (l > cssW || t > cssH || l + w2 < 0 || t + h2 < 0) continue;
            ctx.save();
            if (o.portalable) {
                ctx.fillStyle = "#e2e8f0";
                ctx.fillRect(l, t, w2, h2);
                ctx.strokeStyle = "rgba(100,116,139,0.45)";
                ctx.lineWidth = 1;
                var ts = 40 * k * 2;
                ctx.beginPath();
                for (let x = l; x <= l + w2; x += ts) { ctx.moveTo(x, t); ctx.lineTo(x, t + h2); }
                for (let y = t; y <= t + h2; y += ts) { ctx.moveTo(l, y); ctx.lineTo(l + w2, y); }
                ctx.stroke();
                ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2; ctx.strokeRect(l, t, w2, h2);
            } else {
                ctx.fillStyle = "rgba(125,211,252,0.18)";
                ctx.fillRect(l, t, w2, h2);
                ctx.strokeStyle = "rgba(186,230,253,0.7)"; ctx.lineWidth = 2; ctx.strokeRect(l, t, w2, h2);
                ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(l + w2 * 0.2, t + 20); ctx.lineTo(l + w2 * 0.8, t + 60); ctx.stroke();
            }
            ctx.restore();
        }
        // portals
        var drawn = [];
        for (var ow in this.pairs) {
            var pair = this.pairFor(Number(ow));
            for (let j = 0; j < 2; j++) if (pair[j] && drawn.indexOf(pair[j]) === -1) { drawn.push(pair[j]); this.drawPortal(pair[j], pair[1 - j]); }
        }
        if (this.fixed && drawn.indexOf(this.fixed) === -1) this.drawPortal(this.fixed, null);
        // beams
        for (let i = this.beams.length - 1; i >= 0; i--) {
            var b = this.beams[i];
            ctx.save();
            ctx.globalAlpha = b.life / 14;
            ctx.strokeStyle = b.color; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(wsx(b.x1), wsy(b.y1)); ctx.lineTo(wsx(b.x2), wsy(b.y2)); ctx.stroke();
            ctx.restore();
            if (--b.life <= 0) this.beams.splice(i, 1);
        }
    },

    drawPortal: function(p, partner) {
        var k = cameraScaleX;
        var sx = wsx(p.x + p.nx * 4), sy = wsy(p.y + p.ny * 4);
        var vertical = p.nx !== 0;
        var rx = vertical ? 16 * k + 3 : p.len / 2 * k, ry = vertical ? p.len / 2 * k : 16 * k + 3;
        ctx.save();
        ctx.fillStyle = p.color; ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.ellipse(sx, sy, rx * 1.6, ry * 1.15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = partner ? "#0b1020" : "#1e293b";
        ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(3, 6 * k);
        ctx.stroke();
        // retro pixel swirl
        ctx.fillStyle = p.color;
        var px = Math.max(3, 6 * k);
        for (let i = 0; i < 10; i++) {
            var a = this.tick * 0.08 + i * Math.PI / 5;
            var r = 0.55 + 0.25 * Math.sin(this.tick * 0.05 + i);
            ctx.fillRect(sx + Math.cos(a) * rx * r - px / 2, sy + Math.sin(a) * ry * r - px / 2, px, px);
        }
        ctx.restore();
    }
};

// ---- chamber builder: explicit boxes; `p:` marks white portal panels, `glass:` glass
function pBox(x0, x1, y0, y1, opts) {
    var b = { type: "box", name: (opts && opts.name) || "Wall", x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, color: "#273449", texture: "lab_metal", kind: "block" };
    if (opts) { if (opts.p) b.portalable = true; if (opts.glass) { b.glass = true; b.texture = "solid"; b.color = "rgba(125,211,252,0.12)"; b.kind = "wall"; } if (opts.kind) b.kind = opts.kind; }
    return b;
}
function chamber(n, title, spawn, layout, gadgets, extra) {
    var key = "portal_" + n;
    var def = { name: "🌀 Portal Lab " + (n + 1) + ": " + title, mode: "portal", wavesEnabled: false, spawnP1: spawn, spawnP2: [spawn[0] + 120, spawn[1]], layout: layout, gadgets: gadgets, title: title };
    for (var k in (extra || {})) def[k] = extra[k];
    ModeKit.addLevel(key, def);
    PORTAL_CHAMBERS[n] = key;
}

// 1 - one fixed orange portal: just place blue and walk through
chamber(0, "First Light", [-1100, 60], [
    pBox(-1400, 1400, -400, 0, { name: "Floor" }),
    pBox(-1600, -1400, -400, 1600, { name: "Left Wall", p: true }),
    pBox(1400, 1600, -400, 1600, { name: "Right Wall" }),
    pBox(-1600, 1600, 1400, 1600, { name: "Ceiling" }),
    pBox(300, 400, 0, 1400, { name: "Divider", kind: "wall" })
], [
    { type: "sign", x: -800, y: 0, text: "Shoot a portal at a WHITE wall: F or left-click.\nThen walk into it. Orange is already placed for you." },
    { type: "exit", x: 1050, y: 0 }
], { onlyBlue: true, fixedPortal: { x: 1400, y: 200, nx: -1, ny: 0 } });

// 2 - aim over the wall
chamber(1, "Over the Wall", [-1300, 60], [
    pBox(-1500, 1500, -400, 0, { name: "Floor" }),
    pBox(-1700, -1500, -400, 1900, { name: "Left Wall", p: true }),
    pBox(1500, 1700, -400, 1900, { name: "Right Wall", p: true }),
    pBox(-1700, 1700, 1700, 1900, { name: "Ceiling" }),
    pBox(200, 300, 0, 700, { name: "Divider", kind: "wall" })
], [
    { type: "sign", x: -1000, y: 0, text: "Blue: F / left-click.  Orange: G / right-click.\nAim high - over the wall - at the far white wall." },
    { type: "exit", x: 1200, y: 0 }
]);

// 3 - floor portal up to a ledge
chamber(2, "Step Right Up", [-1100, 60], [
    pBox(-1300, -700, -400, 0, { name: "Floor" }),
    pBox(-700, -300, -400, 0, { name: "Panel Floor", p: true }),
    pBox(-300, 500, -400, 0, { name: "Floor" }),
    pBox(500, 1300, -400, 900, { name: "High Ledge" }),
    pBox(-1500, -1300, -400, 1800, { name: "Left Wall" }),
    pBox(1300, 1500, -400, 1800, { name: "Right Wall", p: true }),
    pBox(-1500, 1500, 1600, 1800, { name: "Ceiling" })
], [
    { type: "sign", x: -1000, y: 0, text: "Put a portal on the white FLOOR and one high on the far wall.\nStep onto the floor portal." },
    { type: "exit", x: 1050, y: 900 }
]);

// 4 - momentum fling across the spike pit
chamber(3, "Fling Theory", [300, 1140], [
    pBox(-2000, -1300, -800, -600, { name: "Pit Floor" }),
    pBox(-1300, -500, -800, 0, { name: "Exit Platform" }),
    pBox(-500, -400, -800, 2300, { name: "Glass", glass: true }),
    pBox(-400, 900, -800, 1100, { name: "Start Block" }),
    pBox(900, 1300, -1000, -600, { name: "Deep Panel", p: true }),
    pBox(1300, 2000, -800, 1100, { name: "Start Block" }),
    pBox(-2200, -2000, -1000, 2500, { name: "Left Wall", p: true }),
    pBox(2000, 2200, -1000, 2500, { name: "Right Wall" }),
    pBox(-2200, 2200, 2300, 2500, { name: "Ceiling" })
], [
    { type: "sign", x: 200, y: 1100, text: "Fall fast, fly fast: speed carries through a portal!\nBlue at the bottom of the shaft, orange on the far left wall\n(through the glass), then jump into the shaft." },
    { type: "spikes", x: -1650, y: -600, w: 700 },
    { type: "exit", x: -800, y: 0 }
]);

// 5 - fetch the crate from the sealed alcove
chamber(4, "Crate Courier", [-200, 60], [
    pBox(-1600, 1600, -400, 0, { name: "Floor" }),
    pBox(-1800, -1600, -400, 1800, { name: "Left Wall", p: true }),
    pBox(1600, 1800, -400, 1800, { name: "Right Wall" }),
    pBox(-1800, 1800, 1600, 1800, { name: "Ceiling" }),
    pBox(-1600, -850, 800, 900, { name: "Alcove Glass", glass: true }),
    pBox(-890, -850, 900, 1600, { name: "Alcove Glass", glass: true }),
    { type: "crate", name: "Courier Crate", x: -1200, y: 960, size: 80, color: "#f472b6", texture: "crate_plank" }
], [
    { type: "sign", x: 100, y: 0, text: "The crate is sealed in the glass alcove up high.\nOne portal low on the white wall, one INSIDE the alcove (shoot through the glass).\nGrab the crate with E, portal back out, put it on the plate." },
    { type: "plate", x: 450, y: 0, w: 170, links: ["d5"] },
    { type: "door", id: "d5", x: 950, y: 800, w: 90, h: 1600 },
    { type: "exit", x: 1350, y: 0 }
]);

GameModes.register({
    id: "portal",
    title: "PORTAL LAB",
    tagline: "Two-portal gun puzzle rooms. Momentum is conserved.",
    color: "#38bdf8",
    firstLevel: function() { return PORTAL_CHAMBERS[Math.min(portalState.chamber, portalState.unlocked - 1)]; },
    flags: { waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, noBedrock: true, scenery: false, coopToggle: true, dash: false, wallJump: false, airJumps: 0, enemiesPassive: true },
    overTitle: "TESTING COMPLETE",
    againLabel: "Restart from chamber 1",

    setupLevel: function(lvl) {
        Portals.clear();
        if (lvl.fixedPortal) {
            var f = lvl.fixedPortal;
            Portals.fixed = { x: f.x, y: f.y, nx: f.nx, ny: f.ny, len: PORTAL_LEN, color: "#fb923c", born: 0 };
        }
        // glass flags from the layout
        for (let i = 0; i < staticObjects.length; i++) {
            var o = staticObjects[i];
            if (o.name === "Glass" || o.name === "Alcove Glass") o.glass = true;
        }
        Gadgets.load(lvl.gadgets);
        portalState.chamber = PORTAL_CHAMBERS.indexOf(LevelManager.currentLevelKey);
        portalState.time = 0;
        portalState.done = false;
    },

    createPlayers: function() {
        var lvl = LevelManager.getCurrentLevel();
        ModeKit.makeHero(0, lvl.spawnP1[0], lvl.spawnP1[1] + 40);
        if (multiplayer) ModeKit.makeHero(1, lvl.spawnP2[0], lvl.spawnP2[1] + 40);
        else blueGuy = null;
    },

    preUpdate: function() {
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (c.dead) continue;
            if (pressedOnce(c, "blue", !!c.shootPressed)) Portals.place(c, 0);
            if (pressedOnce(c, "grab", !!c.abilityPressed)) {
                var rad = Math.radians(c.degree);
                c.tryGrabOrThrow(c.x + Math.sin(rad) * 200, c.y + Math.cos(rad) * 200);
            }
        }
        Portals.teleportAll();
    },

    update: function() {
        Portals.teleportAll();
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (c.flingTimer > 0 && !c.onGround) c.flingTimer = Math.max(c.flingTimer, 2);   // keep momentum while airborne
            if (c.y < -1400) Gadgets.killPlayer(c, "TEST FAILED");
        }
        for (let i = 0; i < movingObjects.length; i++) {
            var m = movingObjects[i];
            if (m.y < -1400 && m.spawnX !== undefined) { m.x = m.spawnX; m.y = m.spawnY; m.xspeed = m.yspeed = 0; }
            if (m.spawnX === undefined) { m.spawnX = m.x; m.spawnY = m.y; }
        }
        if (!portalState.done) portalState.time++;
        else if (--portalState.doneTimer <= 0) {
            var next = portalState.chamber + 1;
            if (next < PORTAL_CHAMBERS.length) LevelManager.selectLevel(PORTAL_CHAMBERS[next]);
            else { gameOver = true; portalState.done = false; }
        }
    },

    onSecondary: function(ch) { Portals.place(ch, 1); return true; },

    onExit: function() {
        if (portalState.done) return;
        portalState.done = true;
        portalState.doneTimer = 130;
        var c = portalState.chamber, bk = PORTAL_CHAMBERS[c], bt = Math.round(portalState.time / 6) / 10;
        if (bk && (!portalState.best[bk] || bt < portalState.best[bk])) portalState.best[bk] = bt;
        portalState.unlocked = Math.max(portalState.unlocked, Math.min(PORTAL_CHAMBERS.length, c + 2));
        portalState.chamber = Math.min(PORTAL_CHAMBERS.length - 1, c + 1);
        savePortal();
        if (typeof SFX !== "undefined") SFX.play("clear");
        if (typeof showBanner === "function") showBanner("CHAMBER " + (c + 1) + " COMPLETE", (portalState.time / 60).toFixed(1) + "s  ·  " + (c + 1 < PORTAL_CHAMBERS.length ? "proceed to the next test" : "you are a model test subject"), "#38bdf8");
    },

    onDamage: function(ch, amount, kx, ky) { return true; },

    onKey: function(code) {
        if (code === "KeyR") { LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        if (code === "KeyX") {      // close your own portals (the fixed orange one stays)
            var pr = Portals.pairFor(0);
            for (let j = 0; j < 2; j++) if (pr[j] && pr[j] !== Portals.fixed) { Components.spawnSparks(pr[j].x, pr[j].y, pr[j].color, 6); pr[j] = null; }
            Portals.syncNavLinks();
            if (typeof SFX !== "undefined") SFX.play("fizzle");
            return true;
        }
        return false;
    },

    overSub: function(over) {
        return over ? ("All " + PORTAL_CHAMBERS.length + " test chambers complete. Lab notes filed.") : ("Test chamber " + (portalState.chamber + 1) + " / " + PORTAL_CHAMBERS.length);
    },

    onRestart: function() { portalState.chamber = 0; LevelManager.selectLevel(PORTAL_CHAMBERS[0]); },

    drawWorld: function() { Portals.draw(); },
    drawFront: function() { Portals.drawAim(); },

    drawHUD: function() {
        var lvl = LevelManager.getCurrentLevel();
        uiPanel(14, 14, 400, 92, "#38bdf8");
        uiText("PORTAL LAB", 30, 46, 24, "#7dd3fc", "left", "900");
        uiText("TEST CHAMBER " + String(portalState.chamber + 1).padStart(2, "0") + "  ·  " + (lvl.title || ""), 30, 70, 14, "#e2e8f0", "left", "800");
        uiText("⏱ " + (portalState.time / 60).toFixed(1) + "s   ☠ " + Gadgets.deaths, 30, 94, 13, "#94a3b8", "left", "700");
        // portal status pips per player
        var px = 300;
        for (let i = 0; i < characters.length; i++) {
            var pair = Portals.pairFor(characters[i].playerIndex);
            for (let j = 0; j < 2; j++) {
                ctx.save();
                ctx.lineWidth = 3;
                ctx.strokeStyle = Portals.colors[Math.min(1, i)][j];
                ctx.fillStyle = pair[j] ? Portals.colors[Math.min(1, i)][j] : "transparent";
                ctx.beginPath(); ctx.ellipse(px + j * 34, 84 - i * 0, 10, 15, 0, 0, Math.PI * 2);
                if (pair[j]) ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
            px += 80;
        }
        uiText("F / click BLUE · G / right-click ORANGE · E grab · X close portals · R restart · Esc menu", cssW / 2, cssH - 16, 12, "rgba(220,230,240,0.75)", "center", "700");
    },

    menuItems: function(items) {
        items.push({ id: "pt_ch", label: "Chamber:  ◀  " + (portalState.chamber + 1) + " / " + PORTAL_CHAMBERS.length + "  (" + portalState.unlocked + " unlocked)  ▶", hint: "Enter loads it", cycle: true });
        items.push({ id: "pt_select", label: "🗺 Chamber select…", hint: "all chambers and best times" });
        items.push({ id: "pt_restart", label: "Restart chamber  (R)", hint: "" });
    },

    onMenu: function(id, dir) {
        if (id === "pt_select") {
            var name = function(k) { var L = LevelManager.getAllLevels()[k] || {}; return (L.title || L.name || k).replace(/^[^A-Za-z0-9]+/, ""); };
            CourseSelect.open({ title: "🌀 Portal Lab — chambers", items: PORTAL_CHAMBERS.map(function(k, i) { return { name: name(k), best: portalState.best[k] ? portalState.best[k] + "s" : "", locked: i >= portalState.unlocked, current: k === LevelManager.currentLevelKey }; }),
                onPick: function(i) { portalState.chamber = i; LevelManager.selectLevel(PORTAL_CHAMBERS[i]); } });
            return true;
        }
        if (id === "pt_ch") {
            if (dir) portalState.chamber = (portalState.chamber + dir + portalState.unlocked) % portalState.unlocked;
            else { closePause(); LevelManager.selectLevel(PORTAL_CHAMBERS[portalState.chamber]); }
            return true;
        }
        if (id === "pt_restart") { closePause(); LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        return false;
    }
});
