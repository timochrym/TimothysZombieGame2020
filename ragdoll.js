// ============================================================================
// VERLET RAGDOLL PHYSICS
//   Point masses joined by distance sticks, integrated with Verlet and collided against the level
//   (boxes, one-way platforms, ramps/stairs, bounce pads, crates). Used for:
//     - LIVE ragdolls: a knocked-down hero/enemy is driven by its ragdoll until it gets back up
//     - CORPSES: slain enemies stay as floppy bodies you can kick, shoot, blow up, grab and throw
//   Slimes use a jelly "blob" soft-body (a springy ring of points) instead of a skeleton.
//   World space: +x right, +y UP (same as the rest of the game).
// ============================================================================

// Skeleton in the 80px character design space (y DOWN, origin at character centre) -> scaled by size
var RAGDOLL_POINTS = [
    // name,     x,   y,  radius
    ["head",     0, -27, 11],   // 0
    ["neck",     0, -14, 6],    // 1
    ["pelvis",   0,   9, 9],    // 2
    ["lElbow", -13,  -5, 4.5],  // 3
    ["lHand",  -21,   5, 5],    // 4
    ["rElbow",  13,  -5, 4.5],  // 5
    ["rHand",   21,   5, 5],    // 6
    ["lKnee",   -6,  22, 5],    // 7
    ["lFoot",   -7,  36, 6],    // 8
    ["rKnee",    6,  22, 5],    // 9
    ["rFoot",    7,  36, 6]     // 10
];
var RAGDOLL_STICKS = [
    // a, b, stiffness, minOnly
    [0, 1, 1], [1, 2, 1],                 // head-neck, spine
    [1, 3, 1], [3, 4, 1], [1, 5, 1], [5, 6, 1],   // arms
    [2, 7, 1], [7, 8, 1], [2, 9, 1], [9, 10, 1],  // legs
    [0, 2, 0.45],                         // keeps the head roughly over the spine
    [7, 9, 0.6, true], [8, 10, 0.4, true], [3, 5, 0.3, true], // limbs don't collapse into one line
    [0, 4, 0.15, true], [0, 6, 0.15, true]       // hands don't clip through the face
];

class Ragdoll {
    constructor(style, k) {
        this.id = ++Ragdoll.nextId;
        this.style = style;
        this.k = k;
        this.pts = [];
        this.sticks = [];
        this.owner = null;        // live character driving / driven by this ragdoll
        this.life = -1;           // frames left for corpses (-1 = live)
        this.maxLife = 1;
        this.sleepFrames = 0;
        this.asleep = false;
        this.grounded = false;
        this.heldBy = null;       // hero carrying this body
        this.thrownBy = null;
        this.projectileTimer = 0;
        this.lastAttacker = null;
        this.hitCd = {};
        this.bonkCd = 0;
        this.kickCd = 0;
        this.kind = style.kind || "humanoid";
    }

    addPoint(x, y, r) { this.pts.push({ x: x, y: y, px: x, py: y, r: r }); }

    addStick(a, b, stiff, minOnly) {
        var pa = this.pts[a], pb = this.pts[b];
        this.sticks.push({ a: a, b: b, len: Math.hypot(pa.x - pb.x, pa.y - pb.y), stiff: stiff, minOnly: !!minOnly });
    }

    wake() { this.asleep = false; this.sleepFrames = 0; }

    setVelocity(vx, vy) {
        for (let i = 0; i < this.pts.length; i++) { var p = this.pts[i]; p.px = p.x - vx; p.py = p.y - vy; }
        this.wake();
    }

    addVelocity(vx, vy) {
        for (let i = 0; i < this.pts.length; i++) { var p = this.pts[i]; p.px -= vx; p.py -= vy; }
        this.wake();
    }

    // Push points near (x,y) - nearer points get more of the impulse
    impulseAt(x, y, ix, iy, radius) {
        for (let i = 0; i < this.pts.length; i++) {
            var p = this.pts[i];
            var d = Math.hypot(p.x - x, p.y - y);
            if (d > radius) continue;
            var f = 1 - d / radius;
            p.px -= ix * f;
            p.py -= iy * f;
        }
        this.wake();
    }

    centerX() { return this.kind === "blob" ? this.pts[0].x : (this.pts.length < 3 ? this.pts[this.pts.length - 1].x : (this.pts[1].x + this.pts[2].x) / 2); }
    centerY() { return this.kind === "blob" ? this.pts[0].y : (this.pts.length < 3 ? this.pts[this.pts.length - 1].y : (this.pts[1].y + this.pts[2].y) / 2); }

    velX() { var s = 0; for (let i = 0; i < this.pts.length; i++) s += this.pts[i].x - this.pts[i].px; return s / this.pts.length; }
    velY() { var s = 0; for (let i = 0; i < this.pts.length; i++) s += this.pts[i].y - this.pts[i].py; return s / this.pts.length; }

    bounds(pad) {
        var b = { l: Infinity, r: -Infinity, b: Infinity, t: -Infinity };
        for (let i = 0; i < this.pts.length; i++) {
            var p = this.pts[i];
            if (p.x - p.r < b.l) b.l = p.x - p.r;
            if (p.x + p.r > b.r) b.r = p.x + p.r;
            if (p.y - p.r < b.b) b.b = p.y - p.r;
            if (p.y + p.r > b.t) b.t = p.y + p.r;
        }
        pad = pad || 0;
        b.l -= pad; b.r += pad; b.b -= pad; b.t += pad;
        return b;
    }

    lowestY() { var m = Infinity; for (let i = 0; i < this.pts.length; i++) m = Math.min(m, this.pts[i].y - this.pts[i].r); return m; }

    alpha() {
        if (this.life < 0) return 1;
        return Math.max(0, Math.min(1, this.life / 60));
    }
}
Ragdoll.nextId = 0;

var Ragdolls = {
    list: [],
    maxCount: 60,          // corpses kept at once (drops to 30 automatically if the frame rate sinks)

    clear: function() { this.list = []; },

    shift: function(dx) {
        for (let i = 0; i < this.list.length; i++) {
            var pts = this.list[i].pts;
            for (let j = 0; j < pts.length; j++) { pts[j].x -= dx; pts[j].px -= dx; }
        }
    },

    remove: function(rd) {
        var i = this.list.indexOf(rd);
        if (i !== -1) this.list.splice(i, 1);
        if (rd && rd.heldBy) { rd.heldBy.heldRagdoll = null; rd.heldBy = null; }
    },

    // ---- Visual style from the character (colours, head sprite, accessories) ----
    styleFor: function(ch) {
        var s = { kind: "humanoid", body: "#475569", limb: "#2d6e32", head: "#7fbf6a", thick: 1, headScale: 1, face: "zombie", acc: null, accColor: null, sprite: null, tint: null, wings: false, cape: false };
        var p = ch.zombiePower;
        if (ch.isPlayer) {
            var accent = ch.accent();
            if (ch.isZombie) {
                s.sprite = zombieImg; s.tint = "#7a5cff"; s.body = "#5b4aa8"; s.limb = "#7a5cff"; s.head = "#a78bfa";
            } else {
                var skin = ch.skinId();
                if (skin.indexOf("npc:") === 0) return this.styleFor({ zombiePower: skin.slice(4), originalColor: accent });
                s.face = "hero";
                if (skin === "stick") { s.body = accent; s.limb = accent; s.head = "#f8fafc"; s.thick = 0.55; s.acc = "headband"; s.accColor = accent; }
                else if (skin === "brawler") { s.body = "#f8fafc"; s.limb = "#f2c9a0"; s.head = "#f2c9a0"; s.acc = "headband"; s.accColor = accent; s.hair = true; s.belt = accent; }
                else if (skin === "cap") { s.body = "#2563eb"; s.limb = accent; s.head = "#fdd5ae"; s.acc = "cap"; s.accColor = accent; }
                else { s.sprite = characterImg; s.body = accent; s.limb = Components.shade(accent, -30); s.head = "#f2c9a0"; s.acc = "headband"; s.accColor = accent; }
            }
            return s;
        }
        var col = ch.originalColor || ch.color || "#2d6e32";
        if (p === "SLIME" || p === "MINI_SLIME") { s.kind = "blob"; s.body = col; return s; }
        if (p === "NORMAL") { s.sprite = zombieImg; s.body = "#475569"; s.limb = col; s.head = "#7fbf6a"; }
        else if (p === "SPITTER") { s.body = "#475569"; s.limb = "#4d9a36"; s.head = "#86c96f"; s.acc = "sac"; }
        else if (p === "LEAPER") { s.body = "#365314"; s.limb = "#7ec820"; s.head = "#a3e635"; s.thick = 0.85; }
        else if (p === "EXPLODER") { s.body = "#7c2d12"; s.limb = "#d95b16"; s.head = "#f59e0b"; s.acc = "vest"; }
        else if (p === "TANK") { s.body = "#5e2b50"; s.limb = "#7a3b68"; s.head = "#9d5a8a"; s.thick = 1.7; s.headScale = 0.8; }
        else if (p === "ARCHER") { s.body = "#e5e7eb"; s.limb = "#e5e7eb"; s.head = "#f8fafc"; s.thick = 0.55; s.face = "skull"; s.acc = "hood"; s.accColor = "#d4a373"; }
        else if (p === "KNIGHT") { s.body = "#9ca3af"; s.limb = "#6b7280"; s.head = "#9ca3af"; s.face = "visor"; s.acc = "helmet"; s.thick = 1.2; }
        else if (p === "MAGE") { s.body = "#7209b7"; s.limb = "#7e22ce"; s.head = "#1e1b4b"; s.face = "glow"; s.acc = "hood"; s.accColor = "#4c1d95"; s.thick = 1.2; }
        else if (p === "BOSS_KING") { s.body = "#9b2226"; s.limb = "#7f1d1d"; s.head = "#e0b48a"; s.face = "hero"; s.acc = "crown"; s.cape = true; s.thick = 1.35; }
        else if (p === "BAT") { s.body = "#6c5ce7"; s.limb = "#2b193d"; s.head = "#8b7cf0"; s.acc = "ears"; s.wings = true; s.thick = 0.7; }
        else { s.body = "#475569"; s.limb = col; s.head = Components.shade(col, 40); }
        return s;
    },

    // ---- Build a ragdoll matching a character's current position, facing and velocity ----
    spawnFrom: function(ch, opts) {
        opts = opts || {};
        var style = this.styleFor(ch);
        var k = (ch.s1 || 80) / 80;
        var rd = new Ragdoll(style, k);
        var f = (ch.lastFacing || (ch.xspeed >= 0 ? 1 : -1)) >= 0 ? 1 : -1;
        if (style.kind === "blob") {
            var R = (ch.s1 || 76) * 0.45;
            var cx = ch.x, cy = ch.y - (ch.s2 || 76) * 0.12;
            rd.addPoint(cx, cy, 6 * k);
            var N = 10;
            for (let i = 0; i < N; i++) {
                var a = (i / N) * Math.PI * 2;
                rd.addPoint(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.85, 5 * k);
            }
            for (let i = 0; i < N; i++) {
                rd.addStick(1 + i, 1 + ((i + 1) % N), 1);
                rd.addStick(0, 1 + i, 0.32);
                rd.addStick(1 + i, 1 + ((i + N / 2) % N), 0.18);
            }
        } else {
            for (let i = 0; i < RAGDOLL_POINTS.length; i++) {
                var d = RAGDOLL_POINTS[i];
                rd.addPoint(ch.x + d[1] * k * f, ch.y - d[2] * k, d[3] * k * (i === 0 ? style.headScale : 1));
            }
            for (let i = 0; i < RAGDOLL_STICKS.length; i++) {
                var st = RAGDOLL_STICKS[i];
                rd.addStick(st[0], st[1], st[2], st[3]);
            }
        }
        var vx = (opts.vx !== undefined) ? opts.vx : (ch.xspeed || 0);
        var vy = (opts.vy !== undefined) ? opts.vy : (ch.yspeed || 0);
        rd.setVelocity(vx, vy);
        // a little spin so bodies tumble instead of sliding stiffly
        if (rd.kind !== "blob") {
            var spin = (opts.spin !== undefined) ? opts.spin : (Math.sign(vx || (Math.random() - 0.5)) * (2 + Math.random() * 2.5));
            rd.pts[0].px -= spin;
            rd.pts[8].px += spin * 0.6;
            rd.pts[10].px += spin * 0.6;
        }
        rd.lastAttacker = ch.lastHitBy || null;
        if (opts.corpse) {
            rd.life = rd.maxLife = opts.life || 900;
            rd.style.dead = true;
        }
        this.list.push(rd);
        this.trim();
        return rd;
    },

    trim: function() {
        var corpses = this.list.filter(function(r) { return r.life >= 0; });
        if (this.maxCount <= 60 && typeof measuredFPS !== "undefined") this.maxCount = measuredFPS < 40 ? 30 : 60;
        while (corpses.length > this.maxCount) {
            var old = corpses.shift();
            this.remove(old);
        }
    },

    // A dying character's live ragdoll simply becomes its corpse (no pop)
    toCorpse: function(rd, life) {
        rd.owner = null;
        rd.life = rd.maxLife = life || 900;
        rd.style.dead = true;
        this.trim();
    },

    // ============================== SIMULATION ==============================
    update: function() {
        var g = gravity * (devOpts.gravityMult || 1) * 0.95;
        var bounce = devOpts.bouncyRagdolls ? 0.82 : 0.28;
        for (let i = this.list.length - 1; i >= 0; i--) {
            var rd = this.list[i];
            if (rd.life >= 0) {
                rd.life--;
                if (rd.life <= 0) { this.remove(rd); continue; }
            }
            if (rd.bonkCd > 0) rd.bonkCd--;
            if (rd.kickCd > 0) rd.kickCd--;
            if (rd.projectileTimer > 0) rd.projectileTimer--;
            for (var hk in rd.hitCd) { if (--rd.hitCd[hk] <= 0) delete rd.hitCd[hk]; }

            if (rd.heldBy) {
                this.pinToHolder(rd);
            }
            if (rd.asleep) continue;

            // Verlet integration
            var pts = rd.pts;
            var dmp = rd.drag || 0.993, gk = g * (rd.gScale || 1);   // per-body overrides (e.g. slingshot shots)
            for (let j = 0; j < pts.length; j++) {
                var p = pts[j];
                var vx = (p.x - p.px) * dmp, vy = (p.y - p.py) * dmp;
                var sp = Math.hypot(vx, vy);
                if (sp > 36) { vx *= 36 / sp; vy *= 36 / sp; }
                p.px = p.x; p.py = p.y;
                p.x += vx;
                p.y += vy - gk;
            }
            if (rd.heldBy) this.pinToHolder(rd);

            var near = this.nearbySolids(rd);
            rd.grounded = false;
            for (let it = 0; it < 3; it++) {
                this.solveSticks(rd);
                if (rd.heldBy) this.pinToHolder(rd);
                this.collide(rd, near, bounce, it === 2, it);
            }

            // Arena walls / ceiling
            if (typeof levelBounds !== "undefined" && levelBounds) {
                for (let j = 0; j < pts.length; j++) {
                    var q = pts[j];
                    if (q.x < levelBounds.minX + q.r) { q.x = levelBounds.minX + q.r; q.px = q.x + (q.x - q.px) * 0.3; }
                    if (q.x > levelBounds.maxX - q.r) { q.x = levelBounds.maxX - q.r; q.px = q.x + (q.x - q.px) * 0.3; }
                    if (q.y > levelBounds.topY) { q.y = levelBounds.topY; q.py = q.y; }
                }
            }

            // Sleep when a corpse has settled (saves CPU, wakes on any impulse)
            if (rd.life >= 0 && !rd.heldBy) {
                var avg = Math.abs(rd.velX()) + Math.abs(rd.velY());
                if (avg < 0.25 && rd.grounded) { if (++rd.sleepFrames > 45) rd.asleep = true; }
                else rd.sleepFrames = 0;
            }
            // fell out of the world
            if (rd.centerY() < (GameModes.flag("deepWorld", false) ? -9000 : -3300)) { this.remove(rd); continue; }
        }
        this.interact();
    },

    pinToHolder: function(rd) {
        var h = rd.heldBy;
        if (!h || h.dead) { rd.heldBy = null; return; }
        var rad = Math.radians(h.degree || 90);
        var hx = h.x + Math.sin(rad) * (h.s1 * 0.7), hy = h.y + Math.cos(rad) * (h.s2 * 0.5) + 30;
        var grip = rd.kind === "blob" ? rd.pts[0] : rd.pts[1];
        grip.x = grip.px = hx;
        grip.y = grip.py = hy;
    },

    solveSticks: function(rd) {
        var pts = rd.pts, sticks = rd.sticks;
        for (let s = 0; s < sticks.length; s++) {
            var st = sticks[s];
            if (st.broken) continue;
            var a = pts[st.a], b = pts[st.b];
            var dx = b.x - a.x, dy = b.y - a.y;
            var d = Math.hypot(dx, dy) || 0.0001;
            if (st.minOnly && d >= st.len) continue;
            // breakable joints (vehicles: the rider tears off on a big hit)
            if (st.breakAt && Math.abs(d - st.len) > st.breakAt) { st.broken = true; if (rd.onBreak) rd.onBreak(st); continue; }
            var diff = (d - st.len) / d * 0.5 * st.stiff;
            a.x += dx * diff; a.y += dy * diff;
            b.x -= dx * diff; b.y -= dy * diff;
        }
    },

    nearbySolids: function(rd) {
        var b = rd.bounds(70);
        var out = [];
        // statics come from the spatial hash instead of scanning the whole level for every body
        var lists = [typeof StaticGrid !== "undefined" ? StaticGrid.query(b.l, b.b, b.r, b.t, false, this._sbuf || (this._sbuf = [])).slice() : staticObjects, movingObjects];
        for (let li = 0; li < lists.length; li++) {
            var L = lists[li];
            for (let i = 0; i < L.length; i++) {
                var o = L[i];
                if (!o || o.dead || o.noCollide || o.heldBy) continue;
                var hw = o.w / 2, hh = o.h / 2;
                if (o.x + hw < b.l || o.x - hw > b.r || o.y + hh < b.b || o.y - hh > b.t) continue;
                out.push(o);
            }
        }
        return out;
    },

    // Resolve every point against nearby solids; apply bounce + friction; report hard impacts
    collide: function(rd, near, bounce, finalPass, iter) {
        var pts = rd.pts;
        var maxImpact = 0;
        for (let j = 0; j < pts.length; j++) {
            var p = pts[j];
            for (let i = 0; i < near.length; i++) {
                var o = near[i];
                var L = o.x - o.w / 2, R = o.x + o.w / 2, B = o.y - o.h / 2, T = o.y + o.h / 2;
                if (p.x < L - p.r || p.x > R + p.r || p.y < B - p.r || p.y > T + p.r) continue;
                var nx = 0, ny = 0;
                var ox = p.x, oy = p.y;

                if (o.isRamp) {
                    if (p.x < L || p.x > R) continue;
                    var tt = (o.rampDir == "left") ? (R - p.x) / (R - L) : (p.x - L) / (R - L);
                    var surf = B + tt * (T - B);
                    if (p.y - p.r >= surf || p.y < B - p.r) continue;
                    p.y = surf + p.r;
                    var slope = (T - B) / (R - L);
                    nx = (o.rampDir == "left") ? slope : -slope; ny = 1;
                    var nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
                } else if (o.isBumper || CollisionDetector.isSemiSolidPlatform(o)) {
                    // one-way: only land on top when coming from above
                    if (p.py - p.r < T - 3 || p.y - p.r >= T) continue;
                    p.y = T + p.r;
                    ny = 1;
                    if (o.isBumper) {
                        p.py = p.y - o.bounceForce * 0.85;
                        rd.wake();
                        if (rd.bonkCd <= 0) { rd.bonkCd = 12; if (typeof SFX !== "undefined") SFX.play("boing", p.x, p.y); }
                        continue;
                    }
                } else {
                    var dl = p.x - (L - p.r), dr = (R + p.r) - p.x, db = p.y - (B - p.r), dt = (T + p.r) - p.y;
                    var m = Math.min(dl, dr, db, dt);
                    if (m === dt) { p.y = T + p.r; ny = 1; }
                    else if (m === db) { p.y = B - p.r; ny = -1; }
                    else if (m === dl) { p.x = L - p.r; nx = -1; }
                    else { p.x = R + p.r; nx = 1; }
                    if (o.movable && !o.heldBy) {
                        // bodies slam crates with real momentum (towers topple in Ragdoll Siege!)
                        // use the INCOMING velocity (before the positional fix-up), so a body that merely
                        // overlaps a crate (e.g. a corpse spawning on a tower) can't launch it
                        var mass = rd.k * rd.k * (rd.style.thick || 1);
                        var ivx = ox - p.px, ivy = oy - p.py;
                        // once per frame (first solver pass) and per contact point: a whole body sums to a
                        // believable shove instead of every point x every pass stacking up
                        if (!iter && -(ivx * nx + ivy * ny) > 0.4) {
                            var ow = o.weight || 1;
                            o.xspeed = Math.max(-16, Math.min(16, o.xspeed + ivx * 0.075 * mass / ow));
                            o.yspeed = Math.max(-16, Math.min(16, o.yspeed + ivy * 0.05 * mass / ow));
                        }
                    }
                }

                // positional correction must not inject energy: move the previous position along with the point
                p.px += p.x - ox;
                p.py += p.y - oy;
                // velocity response: bounce along the normal, friction along the surface
                var vx = p.x - p.px, vy = p.y - p.py;
                var vn = vx * nx + vy * ny;
                if (vn < 0) {
                    var tx = vx - vn * nx, ty = vy - vn * ny;
                    var fr = p.roll ? 0.996 : (ny > 0.5 ? 0.78 : 0.92);     // wheels roll, bodies scrape
                    var nvx = tx * fr - vn * nx * bounce, nvy = ty * fr - vn * ny * bounce;
                    p.px = p.x - nvx; p.py = p.y - nvy;
                    if (-vn > maxImpact) maxImpact = -vn;
                }
                if (ny > 0.5) rd.grounded = true;
                p.contact = 3; p.cnx = nx; p.cny = ny;              // which way the surface faces (vehicles drive along it)
            }
        }
        if (finalPass && maxImpact > 9 && rd.bonkCd <= 0) {
            rd.bonkCd = 10;
            var c = rd.pts[rd.kind === "blob" ? 0 : 1];
            if (typeof SFX !== "undefined") SFX.play(rd.kind === "blob" ? "splat" : "bonk", c.x, c.y, Math.min(1, maxImpact / 22));
            if (maxImpact > 16) Components.spawnSparks(c.x, rd.lowestY() + 6, "#d8e2dc", 3);
        }
    },

    // ============================ INTERACTIONS ============================
    interact: function() {
        var list = this.list;
        var actors = characters.concat(zombies);
        var inBrawl = (typeof brawl !== "undefined" && brawl.active);
        for (let i = 0; i < list.length; i++) {
            var rd = list[i];
            var vx = rd.velX(), vy = rd.velY();
            var b = rd.bounds(rd.projectileTimer > 0 ? 34 : 0);   // thrown bodies get a generous hit radius
            var speed = Math.hypot(vx, vy);
            var attacker = rd.thrownBy || rd.lastAttacker;

            for (let a = 0; a < actors.length; a++) {
                var ch = actors[a];
                if (ch.dead || ch === rd.owner || ch.liveRagdoll || ch === rd.heldBy || ch.vehicle || ch.noCollide) continue;
                var hw = ch.s1 / 2, hh = ch.s2 / 2;
                if (ch.x + hw < b.l || ch.x - hw > b.r || ch.y + hh < b.b || ch.y - hh > b.t) continue;

                // 1) Thrown bodies & bodies launched fast enough are bowling balls
                var hostile = attacker && ch.team !== attacker.team && (inBrawl || !ch.isPlayer);
                if ((rd.projectileTimer > 0 || speed > 13) && hostile && !rd.hitCd[ch.id]) {
                    rd.hitCd[ch.id] = 45;
                    var dmg = rd.projectileTimer > 0 ? -34 : -16;
                    ch.takeDamage(dmg * (ch.isPlayer ? 1 : rpgDamageMult), Math.sign(vx || 1) * 6, 5, attacker);
                    var words = rd.projectileTimer > 0 ? ["BODY SLAM!", "SPLAT!", "INCOMING!", "SPECIAL DELIVERY!"] : ["STRIKE!", "BOWLED!", "BONK!", "WHAM!"];
                    Components.addFloatingText(words[Math.floor(Math.random() * words.length)], ch.x, ch.y + 100, "#ffd23f", 20);
                    if (typeof SFX !== "undefined") SFX.play("bonk", ch.x, ch.y, 1);
                    if (typeof Juice !== "undefined") Juice.hitStop(3);
                    rd.addVelocity(-vx * 0.45, 4);
                    rd.projectileTimer = 0;
                    continue;
                }

                // 2) Walking/running into a body kicks it around
                if (rd.life >= 0 && !rd.heldBy) {
                    var kickX = (ch.xspeed || 0) * 0.45, kicked = false;
                    for (let j = 0; j < rd.pts.length; j++) {
                        var p = rd.pts[j];
                        if (Math.abs(p.x - ch.x) < hw + p.r && Math.abs(p.y - ch.y) < hh + p.r) {
                            p.px -= kickX + Math.sign(p.x - ch.x) * 0.6;
                            p.py -= 0.6 + Math.abs(kickX) * 0.25;
                            kicked = true;
                        }
                    }
                    if (kicked) {
                        rd.wake();
                        if (Math.abs(ch.xspeed) > 6 && rd.kickCd <= 0 && ch.isPlayer) {
                            rd.kickCd = 30;
                            rd.addVelocity(Math.sign(ch.xspeed) * 3, 3.5);
                            if (typeof SFX !== "undefined") SFX.play("bonk", ch.x, ch.y, 0.4);
                        }
                    }
                }
            }
        }

        // 3) Bodies pile up instead of overlapping (cheap: head / neck / pelvis only)
        var hs = [];
        for (let i = 0; i < list.length; i++) if (list[i].kind === "humanoid") hs.push({ rd: list[i], b: list[i].bounds(0) });
        hs.sort(function(p, q) { return p.b.l - q.b.l; });
        for (let i = 0; i < hs.length; i++) {
            var A = hs[i].rd, ba = hs[i].b;
            for (let j = i + 1; j < hs.length; j++) {
                var Bd = hs[j].rd, bb = hs[j].b;
                if (bb.l > ba.r) break;
                if (A.asleep && Bd.asleep) continue;
                if (ba.t < bb.b || ba.b > bb.t) continue;
                var keys = [0, 1, 2];
                for (let u = 0; u < 3; u++) for (let v = 0; v < 3; v++) {
                    var p1 = A.pts[keys[u]], p2 = Bd.pts[keys[v]];
                    var dx = p2.x - p1.x, dy = p2.y - p1.y;
                    var d = Math.hypot(dx, dy), minD = p1.r + p2.r;
                    if (d < minD && d > 0.001) {
                        var push = (minD - d) / d * 0.5;
                        p1.x -= dx * push; p1.y -= dy * push;
                        p2.x += dx * push; p2.y += dy * push;
                        A.wake(); Bd.wake();
                    }
                }
            }
        }
    },

    // Explosion shock: fling every body in range
    explode: function(x, y, radius, power) {
        for (let i = 0; i < this.list.length; i++) {
            var rd = this.list[i];
            var cx = rd.centerX(), cy = rd.centerY();
            var d = Math.hypot(cx - x, cy - y);
            if (d > radius) continue;
            var f = (1 - d / radius) * power;
            var nx = (cx - x) / (d || 1), ny = (cy - y) / (d || 1);
            rd.impulseAt(x, y, nx * f * 1.3, (ny * f) + f * 0.7, radius * 1.5);
            rd.addVelocity(nx * f * 0.4, f * 0.35);
            if (rd.life >= 0) rd.life = Math.max(rd.life, 240);
        }
    },

    // Bullets nudge corpses (they pass through so they never eat your ammo)
    bulletHit: function(l) {
        if (!l.rdHit) l.rdHit = {};
        for (let i = 0; i < this.list.length; i++) {
            var rd = this.list[i];
            if ((rd.life < 0 && !rd.isDummy) || l.rdHit[rd.id]) continue;
            var b = rd.bounds(8);
            if (l.x < b.l || l.x > b.r || l.y < b.b || l.y > b.t) continue;
            for (let j = 0; j < rd.pts.length; j++) {
                var p = rd.pts[j];
                if (Math.hypot(p.x - l.x, p.y - l.y) < p.r + 9) {
                    l.rdHit[rd.id] = true;
                    rd.impulseAt(p.x, p.y, l.xspeed * 0.28, l.yspeed * 0.28 + 1.2, 30 * rd.k);
                    Components.spawnSparks(l.x, l.y, "#ffe0e0", 2);
                    if (rd.life >= 0) rd.life = Math.max(rd.life, 300);
                    break;
                }
            }
        }
    },

    nearestCorpse: function(x, y, reach) {
        var best = null, bd = reach;
        for (let i = 0; i < this.list.length; i++) {
            var rd = this.list[i];
            if (rd.life < 0 || rd.heldBy) continue;
            var d = Math.hypot(rd.centerX() - x, rd.centerY() - y);
            if (d < bd) { bd = d; best = rd; }
        }
        return best;
    },

    // ============================== RENDERING ==============================
    drawCorpses: function() {
        for (let i = 0; i < this.list.length; i++) {
            if (!this.list[i].owner && !this.list[i].isBallBody) this.draw(this.list[i]);
        }
    },

    draw: function(rd) {
        var b = rd.bounds(40);
        var sl = b.l * cameraScaleX + xc, sr = b.r * cameraScaleX + xc;
        var st = -b.t * cameraScaleY + yc, sb = -b.b * cameraScaleY + yc;
        if (sr < -20 || sl > cssW + 20 || sb < -20 || st > cssH + 20) return;
        ctx.save();
        ctx.globalAlpha = rd.alpha();
        if (rd.drawFn) rd.drawFn(rd);
        else if (rd.kind === "blob") this.drawBlob(rd);
        else if (typeof settings !== "undefined" && settings.squareChars) this.drawSquare(rd);
        else this.drawHumanoid(rd);
        ctx.restore();
    },

    // "Classic squares" look: one rounded square rotated to the neck-pelvis angle
    drawSquare: function(rd) {
        var P = rd.pts.map(this.sp);
        var neck = P[1], pelvis = P[2];
        var ang = Math.atan2(pelvis[0] - neck[0], pelvis[1] - neck[1]);
        var k = rd.k;
        var o = rd.owner;
        var w = (o ? o.s1 : 48 * k) * cameraScaleX, h = (o ? o.s2 : 72 * k) * cameraScaleY;
        var cx = (P[0][0] + (P[8][0] + P[10][0]) / 2) / 2, cy = (P[0][1] + (P[8][1] + P[10][1]) / 2) / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-ang);
        var r = Math.min(w, h) * 0.18;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, r); else ctx.rect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = (o && o.color) || rd.style.body;
        ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = "#0a0f16"; ctx.stroke();
        // X-eyes for corpses, plain eyes for a knocked-down live body
        var eyeR = Math.max(2, Math.min(w, h) * 0.1);
        ctx.strokeStyle = "#0a0f16"; ctx.fillStyle = "#ffffff"; ctx.lineWidth = Math.max(1.5, eyeR * 0.5);
        for (var e = -1; e <= 1; e += 2) {
            var ex = e * w * 0.2, ey = -h * 0.18;
            if (rd.life >= 0) {
                ctx.beginPath();
                ctx.moveTo(ex - eyeR, ey - eyeR); ctx.lineTo(ex + eyeR, ey + eyeR);
                ctx.moveTo(ex + eyeR, ey - eyeR); ctx.lineTo(ex - eyeR, ey + eyeR);
                ctx.stroke();
            } else {
                ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();
    },

    sp: function(p) { return [p.x * cameraScaleX + xc, -p.y * cameraScaleY + yc]; },

    limb: function(pts, lw, col) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.strokeStyle = "#0a0f16";
        ctx.lineWidth = lw + 4;
        ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.stroke();
        // close up: a soft highlight down the limb so bodies read as round, not flat
        if (lw > 3.5 && typeof col === "string" && (col.charAt(0) === "#" || col.indexOf("rgb") === 0)) {
            ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = Components.shade(col, 45); ctx.lineWidth = lw * 0.3;
            ctx.translate(-lw * 0.18, -lw * 0.18); ctx.stroke(); ctx.restore();
        }
    },

    drawHumanoid: function(rd) {
        var s = rd.style, k = rd.k * cameraScaleX;
        var P = rd.pts.map(this.sp);
        var lw = Math.max(2.5, 8.5 * k * s.thick);
        var limbBack = Components.shade(s.limb, -22);

        // back arm + leg
        this.limb([P[1], P[3], P[4]], lw * 0.9, limbBack);
        this.limb([P[2], P[7], P[8]], lw, limbBack);

        // cape (boss)
        if (s.cape) {
            ctx.fillStyle = "#7f1d1d";
            ctx.beginPath();
            ctx.moveTo(P[1][0] - 8 * k, P[1][1]);
            ctx.lineTo(P[1][0] + 8 * k, P[1][1]);
            ctx.lineTo(P[2][0] + 24 * k, P[2][1] + 24 * k);
            ctx.lineTo(P[2][0] - 24 * k, P[2][1] + 24 * k);
            ctx.closePath();
            ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = "#0a0f16"; ctx.stroke();
        }
        // bat wings hang off the shoulders and flop
        if (s.wings) {
            var flop = Math.sin(Date.now() * 0.01 + rd.id) * 6 * k;
            ctx.fillStyle = "#3b2a72";
            for (let side = -1; side <= 1; side += 2) {
                ctx.beginPath();
                ctx.moveTo(P[1][0], P[1][1]);
                ctx.lineTo(P[1][0] + side * 34 * k, P[1][1] - 6 * k + flop);
                ctx.lineTo(P[1][0] + side * 24 * k, P[1][1] + 16 * k + flop);
                ctx.closePath();
                ctx.fill();
                ctx.lineWidth = 2; ctx.strokeStyle = "#0a0f16"; ctx.stroke();
            }
        }

        // torso
        this.limb([P[1], P[2]], Math.max(5, 17 * k * s.thick), s.body);
        if (s.belt) this.limb([[P[2][0] - 1, P[2][1] - 3 * k], [P[2][0] + 1, P[2][1] - 3 * k]], 10 * k, s.belt);
        if (s.acc === "vest") {
            // dynamite sticks on the chest
            var mx = (P[1][0] + P[2][0]) / 2, my = (P[1][1] + P[2][1]) / 2;
            ctx.fillStyle = "#dc2626";
            for (let d = -1; d <= 1; d++) ctx.fillRect(mx + d * 6 * k - 2.5 * k, my - 6 * k, 5 * k, 12 * k);
        }
        if (s.acc === "sac") {
            ctx.fillStyle = "#a3e635";
            ctx.beginPath(); ctx.arc(P[1][0], P[1][1], 7 * k, 0, Math.PI * 2); ctx.fill();
        }

        // front arm + leg
        this.limb([P[2], P[9], P[10]], lw, s.limb);
        this.limb([P[1], P[5], P[6]], lw * 0.9, s.limb);
        // hands & feet
        ctx.fillStyle = s.limb;
        for (let hI of [4, 6]) { ctx.beginPath(); ctx.arc(P[hI][0], P[hI][1], Math.max(2, 4.5 * k * s.thick), 0, Math.PI * 2); ctx.fill(); }
        // boots: a rounded shoe pointing along the shin, toe forward
        ctx.fillStyle = "#1f2937";
        for (let fI of [8, 10]) {
            var kn = P[fI - 1], ft = P[fI], sa = Math.atan2(ft[1] - kn[1], ft[0] - kn[0]), fr = Math.max(2, 5.5 * k * Math.max(0.7, s.thick));
            ctx.save(); ctx.translate(ft[0], ft[1]); ctx.rotate(sa - Math.PI / 2);
            ctx.beginPath(); ctx.ellipse(fr * 0.5, 0, fr * 1.5, fr, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        this.drawHead(rd, P[0], P[1], k);
    },

    drawHead: function(rd, H, N, k) {
        var s = rd.style;
        var r = 11.5 * k * s.headScale;
        var ang = Math.atan2(H[0] - N[0], -(H[1] - N[1]));
        ctx.save();
        ctx.translate(H[0], H[1]);
        ctx.rotate(ang);

        if (s.sprite && s.sprite.complete && s.sprite.naturalWidth > 0) {
            // original pixel-art face as the head!
            var hs = r * 2.3;
            ctx.save();
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(-hs / 2, -hs / 2, hs, hs, hs * 0.22) : ctx.rect(-hs / 2, -hs / 2, hs, hs);
            ctx.clip();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(s.sprite, -hs / 2, -hs / 2, hs, hs);
            if (s.tint) { ctx.globalAlpha *= 0.4; ctx.fillStyle = s.tint; ctx.fillRect(-hs / 2, -hs / 2, hs, hs); }
            ctx.restore();
            ctx.lineWidth = 2.5; ctx.strokeStyle = "#0a0f16";
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(-hs / 2, -hs / 2, hs, hs, hs * 0.22) : ctx.rect(-hs / 2, -hs / 2, hs, hs);
            ctx.stroke();
            if (s.dead) this.xEyes(r * 1.05, "#ffffff");
        } else {
            ctx.fillStyle = s.head;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 2.5; ctx.strokeStyle = "#0a0f16"; ctx.stroke();
            if (s.dead) this.xEyes(r, s.face === "skull" || s.face === "glow" ? "#ff4d5e" : "#0a0f16");
            else if (rd.owner) this.dizzyEyes(r);
            else if (s.face === "skull") { ctx.fillStyle = "#0a0f16"; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.05, r * 0.25, 0, 7); ctx.arc(r * 0.35, -r * 0.05, r * 0.25, 0, 7); ctx.fill(); }
        }

        // accessories (drawn in head space so they tumble with the head)
        var ac = s.accColor || "#e63946";
        if (s.acc === "headband") { ctx.fillStyle = ac; ctx.fillRect(-r, -r * 0.55, r * 2, r * 0.35); ctx.fillRect(-r * 1.6, -r * 0.5, r * 0.7, r * 0.22); }
        else if (s.acc === "cap") {
            ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 1.05, Math.PI, Math.PI * 2); ctx.fill();
            ctx.fillRect(0, -r * 0.3, r * 1.6, r * 0.28);
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, -r * 0.75, r * 0.32, 0, 7); ctx.fill();
        } else if (s.acc === "helmet") {
            ctx.fillStyle = "#6b7280"; ctx.beginPath(); ctx.arc(0, 0, r * 1.08, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
            ctx.fillStyle = "#0a0f16"; ctx.fillRect(-r * 0.7, -r * 0.1, r * 1.4, r * 0.28);
            ctx.fillStyle = "#e63946"; ctx.beginPath(); ctx.moveTo(-r * 0.2, -r); ctx.quadraticCurveTo(-r * 1.6, -r * 1.6, -r * 1.9, -r * 0.4); ctx.lineTo(r * 0.2, -r * 0.9); ctx.fill();
        } else if (s.acc === "hood") {
            ctx.fillStyle = ac; ctx.beginPath(); ctx.moveTo(-r * 1.2, r * 0.6); ctx.lineTo(0, -r * 1.7); ctx.lineTo(r * 1.2, r * 0.6); ctx.lineTo(r * 0.75, -r * 0.1); ctx.lineTo(-r * 0.75, -r * 0.1); ctx.closePath(); ctx.fill();
            if (s.face === "glow" && !s.dead) { ctx.fillStyle = "#fde047"; ctx.fillRect(-r * 0.45, -r * 0.1, r * 0.3, r * 0.25); ctx.fillRect(r * 0.15, -r * 0.1, r * 0.3, r * 0.25); }
        } else if (s.acc === "crown") {
            ctx.fillStyle = "#fbbf24"; ctx.beginPath();
            ctx.moveTo(-r * 0.9, -r * 0.7); ctx.lineTo(-r * 0.9, -r * 1.6); ctx.lineTo(-r * 0.4, -r * 1.05); ctx.lineTo(0, -r * 1.8);
            ctx.lineTo(r * 0.4, -r * 1.05); ctx.lineTo(r * 0.9, -r * 1.6); ctx.lineTo(r * 0.9, -r * 0.7); ctx.closePath(); ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = "#0a0f16"; ctx.stroke();
        } else if (s.acc === "ears") {
            ctx.fillStyle = s.head;
            ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.5); ctx.lineTo(-r * 0.6, -r * 1.8); ctx.lineTo(-r * 0.1, -r * 0.8); ctx.fill();
            ctx.beginPath(); ctx.moveTo(r * 0.8, -r * 0.5); ctx.lineTo(r * 0.6, -r * 1.8); ctx.lineTo(r * 0.1, -r * 0.8); ctx.fill();
        }
        if (s.hair) {
            ctx.fillStyle = "#111827"; ctx.beginPath();
            ctx.moveTo(-r, -r * 0.5); ctx.lineTo(-r * 0.6, -r * 1.5); ctx.lineTo(-r * 0.1, -r * 0.9); ctx.lineTo(r * 0.3, -r * 1.6); ctx.lineTo(r * 0.6, -r * 0.9); ctx.lineTo(r, -r * 1.3); ctx.lineTo(r, -r * 0.5); ctx.closePath(); ctx.fill();
        }
        ctx.restore();

        // Dizzy stars orbit a live ragdoll's head
        if (rd.owner) {
            var t = Date.now() * 0.006;
            for (let i = 0; i < 3; i++) {
                var a = t + i * 2.1;
                this.star(H[0] + Math.cos(a) * r * 1.7, H[1] - r * 1.2 + Math.sin(a) * r * 0.5, r * 0.45);
            }
        }
    },

    xEyes: function(r, col) {
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1.5, r * 0.16);
        ctx.lineCap = "round";
        for (let sgn = -1; sgn <= 1; sgn += 2) {
            var ex = sgn * r * 0.38, ey = -r * 0.1, e = r * 0.2;
            ctx.beginPath();
            ctx.moveTo(ex - e, ey - e); ctx.lineTo(ex + e, ey + e);
            ctx.moveTo(ex + e, ey - e); ctx.lineTo(ex - e, ey + e);
            ctx.stroke();
        }
        // tongue out
        ctx.fillStyle = "#f472b6";
        ctx.beginPath(); ctx.ellipse(r * 0.15, r * 0.5, r * 0.18, r * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    },

    dizzyEyes: function(r) {
        ctx.strokeStyle = "#0a0f16";
        ctx.lineWidth = Math.max(1.2, r * 0.12);
        var t = Date.now() * 0.02;
        for (let sgn = -1; sgn <= 1; sgn += 2) {
            ctx.beginPath();
            for (let a = 0; a < 9; a += 0.6) {
                var rr = r * 0.03 * a;
                var x = sgn * r * 0.38 + Math.cos(a + t) * rr, y = -r * 0.1 + Math.sin(a + t) * rr;
                if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    },

    star: function(x, y, r) {
        ctx.fillStyle = "#ffd23f";
        ctx.strokeStyle = "#0a0f16";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
            ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    },

    drawBlob: function(rd) {
        var s = rd.style, k = rd.k * cameraScaleX;
        var ring = [];
        for (let i = 1; i < rd.pts.length; i++) ring.push(this.sp(rd.pts[i]));
        var n = ring.length;
        ctx.beginPath();
        var m0 = [(ring[n - 1][0] + ring[0][0]) / 2, (ring[n - 1][1] + ring[0][1]) / 2];
        ctx.moveTo(m0[0], m0[1]);
        for (let i = 0; i < n; i++) {
            var a = ring[i], b = ring[(i + 1) % n];
            ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        }
        ctx.closePath();
        var C = this.sp(rd.pts[0]);
        var g = ctx.createRadialGradient(C[0] - 8 * k, C[1] - 10 * k, 2, C[0], C[1], 40 * k);
        g.addColorStop(0, Components.shade(s.body, 60));
        g.addColorStop(1, s.body);
        ctx.globalAlpha *= 0.9;
        ctx.fillStyle = g;
        ctx.fill();
        ctx.globalAlpha /= 0.9;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#0a0f16";
        ctx.stroke();
        // face
        var r = 12 * k;
        ctx.save();
        ctx.translate(C[0], C[1] - 4 * k);
        if (s.dead) this.xEyes(r, "#0a0f16");
        else {
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r * 0.5, 0, r * 0.4, 0, 7); ctx.arc(r * 0.5, 0, r * 0.4, 0, 7); ctx.fill();
            this.dizzyEyes(r * 1.3);
        }
        ctx.restore();
    }
};
