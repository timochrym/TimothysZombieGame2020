// ============================================================================
// ARENA MIX - worms inside blobs inside tanks: the three arena games in ONE world.
//
//   All three arenas are centred on the same point, so they nest: the worm ring (radius 2400) sits inside the blob
//   square (5200), which sits inside the tank square (6000). Each game keeps running its own rules (Snake.step,
//   Cells.step, Tanks.step); this file adds what happens when they meet, one camera, and "play as".
//
//   You pick a body: TANK, BLOB, WORM or BUBBLE WORM (a worm made of blob bubbles) - pause menu, or Q. CPUs of all three kinds share the arena.
//   What happens when they meet:
//     bullets   shrink blobs (shot below 12 they are gone) and hurt worms (heads most; bodies soak them)
//     tanks     (size changes shooting and level: heavier = bigger, harder bullets but slower reload; new mass
//               records earn XP) are blobs with a gun: they carry mass, eat food and anything 25% smaller, and are eaten by anything
//               25% bigger. They can't split on purpose; a virus or heavy damage breaks pieces off - the biggest
//               piece keeps the gun, the rest are inert lumps that can only be eaten
//     worms     level up (Bite / Armor / Appetite) from eating, breaking the tank blocks with their heads, and
//               biting tanks; their bodies are walls that hurt tanks
//     blobs     pop like they hit a virus when they touch a worm: they split and a quarter of the mass goes to the worm
//     food      worms can eat blob food and blobs can eat worm food
//     power-ups are shared: tanks and worms pick up speed / shield / magnet / mass just like blobs
// ============================================================================
var mixCfg = { body: "tank" };
try { var _mx = JSON.parse(localStorage.getItem("timsArenaMix") || "null"); if (_mx && ["tank", "blob", "worm", "chain"].indexOf(_mx.body) !== -1) mixCfg.body = _mx.body; } catch (e) {}
var mixSave = { best: { tank: 0, blob: 0, worm: 0, chain: 0 } };
try { var _ms = JSON.parse(localStorage.getItem("timsArenaMixBest") || "null"); if (_ms && _ms.best) for (var _mk in mixSave.best) mixSave.best[_mk] = _ms.best[_mk] || 0; } catch (e) {}
var MIX_BODIES = [["tank", "🛡 Tank"], ["blob", "🫧 Blob"], ["worm", "🪱 Worm"], ["chain", "📿 Bubble worm"]];
var MIX_CHAIN_CPUS = 3;          // CPU bubble worms in the arena

var Mix = {
    on: false, t: 0, cam: { x: 0, y: 0, z: 0.8 }, view: null, log: [],
    stat: { bulletBlob: 0, bulletWorm: 0, blobAteTank: 0, tankAteBlob: 0, tankAteTank: 0, tankSplit: 0, blobPopped: 0, wormBite: 0, wormWall: 0, shapeBroken: 0, crossFood: 0, pickups: 0 },

    // every arena draws with the same camera; none of them may move it (this file does)
    link: function() {
        if (!this.view) {
            var v = {}, self = this;
            ["x", "y", "z"].forEach(function(k) { window.Object.defineProperty(v, k, { get: function() { return self.cam[k]; }, set: function() {} }); });
            this.view = v;
        }
        this.keep = this.keep || { tank: Tanks.cam, blob: Cells.cam, worm: Snake.cam };
        Tanks.cam = Cells.cam = Snake.cam = this.view;
        Tanks.mixLayer = Cells.mixLayer = Snake.mixLayer = true;
        this.on = true;
    },
    unlink: function() {
        if (this.keep) { Tanks.cam = this.keep.tank; Cells.cam = this.keep.blob; Snake.cam = this.keep.worm; this.keep = null; }
        Tanks.mixLayer = Cells.mixLayer = Snake.mixLayer = false;
        this.on = false;
    },

    reset: function() {
        var mp = multiplayer; multiplayer = false;         // one human here for now (P1); everyone else is a CPU
        Tanks.reset(); Cells.reset(); Snake.reset();
        multiplayer = mp;
        this.t = 0; this.log = [];
        for (var k in this.stat) this.stat[k] = 0;
        for (let i = 0; i < MIX_CHAIN_CPUS; i++) { var cw = Cells.addPlayer({ name: ["Beads", "Pearls", "Abacus", "Rosary", "Bobbles"][i % 5], color: ["#fb923c", "#2dd4bf", "#e879f9", "#a3e635", "#f87171"][i % 5] }); cw.chain = true; }
        this.setBody(mixCfg.body);
    },

    stripHumans: function() {
        Tanks.tanks = Tanks.tanks.filter(function(k) { return k.human === undefined; });
        var gone = Cells.players.filter(function(p) { return p.human !== undefined; });
        Cells.players = Cells.players.filter(function(p) { return p.human === undefined; });
        Cells.blobs = Cells.blobs.filter(function(b) { return gone.indexOf(b.pl) === -1; });
        Snake.worms = Snake.worms.filter(function(w) { return w.human === undefined; });
    },
    setBody: function(body) {
        mixCfg.body = body;
        try { localStorage.setItem("timsArenaMix", JSON.stringify(mixCfg)); } catch (e) {}
        this.stripHumans();
        var o = { human: 0, name: "P1", color: "#ff5a5f" };
        if (body === "tank") Tanks.addTank(o);
        else if (body === "blob") Cells.addPlayer(o);
        else if (body === "chain") Cells.addPlayer(o).chain = true;
        else Snake.spawn(o);
        var m = this.me();
        if (m) { this.cam.x = m.x; this.cam.y = m.y; }
    },
    // the human's body as { kind, x, y, alive, ref }
    me: function() {
        if (mixCfg.body === "tank") { var k = Tanks.tanks.find(function(q) { return q.human === 0; }); return k ? { kind: "tank", ref: k, x: k.x, y: k.y, alive: k.alive } : null; }
        if (mixCfg.body === "blob" || mixCfg.body === "chain") {
            var p = Cells.players.find(function(q) { return q.human === 0; });
            var hd = p && p.chain && p.chainList && p.chainList[0];              // a bubble worm's camera follows its head
            return p ? { kind: "blob", ref: p, x: hd ? hd.x : (p.cx || 0), y: hd ? hd.y : (p.cy || 0), alive: p.alive } : null;
        }
        var w = Snake.worms.find(function(q) { return q.human === 0; });
        return w ? { kind: "worm", ref: w, x: w.segs[0].x, y: w.segs[0].y, alive: w.alive } : null;
    },
    say: function(text, col) { this.log.unshift({ text: text, col: col || "#e2e8f0", t: 240 }); if (this.log.length > 5) this.log.length = 5; },
    note: function(human, text, col) { this.say(text, col); if (human) showBanner(text, "", col || "#fde047"); },

    // ------------------------------------------------------------ tanks are blobs with a gun
    // In the mix a tank carries MASS like a blob (its size follows it). It eats food and smaller blobs or tanks, and
    // a bigger blob or tank eats it. It cannot split on purpose. A virus, or being hurt badly, breaks pieces off: the
    // biggest piece keeps the gun, the rest are inert lumps that can only be eaten (they are ordinary food).
    tankMass: function(k) { return k.mixMass || 36; },
    initTank: function(k) { k.mixMass = 36; k.mixPeak = 36; k.mixLvl = k.lvl; k.mixSplitCd = 0; k.mixWasAlive = true; k.mixEaten = false; },
    lumps: function(x, y, total, n, col, speed, from) {
        // "from": the tank that shed them can't eat its own pieces straight back (3 s)
        for (let i = 0; i < n; i++) { var a = (i / n) * Math.PI * 2 + Math.random() * 0.8; Cells.pellets.push({ x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 12, m: Math.max(2, total / n), col: col, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, lump: true, from: from || null, born: this.t }); }
    },
    splitTank: function(k, share, why) {
        var lost = k.mixMass * share;
        if (lost < 5) return false;
        k.mixMass -= lost; k.mixSplitCd = 300;
        this.lumps(k.x, k.y, lost, Math.max(2, Math.min(6, Math.round(lost / 10))), k.color, 22 + Tanks.size(k) * 0.12, k);
        k.hp = Math.max(k.hp, Tanks.maxHp(k) * 0.5);            // shedding mass buys it a second wind
        this.stat.tankSplit++;
        this.note(k.human !== undefined, k.name + " broke apart (" + why + ")", k.color);
        if (k.human !== undefined) screenShake = 8;
        return true;
    },

    // ------------------------------------------------------------ worms level up
    // XP comes from eating, breaking blocks and biting. Each level is a point for Bite (damage to blocks and tanks),
    // Armor (bullets hurt less) or Appetite (food grows you more). Human: keys 1 / 2 / 3. CPUs spend at random.
    wormXpFor: function(l) { return Math.round(15 * Math.pow(l, 1.4)); },
    wormStat: function(w, i) { var x = w.mx; if (x && x.pts > 0 && x.st[i] < 7) { x.st[i]++; x.pts--; return true; } return false; },
    wormXp: function(w, n) {
        var x = w.mx; if (!x) return;
        x.xp += n;
        while (x.lvl < 30 && x.xp >= this.wormXpFor(x.lvl)) {
            x.xp -= this.wormXpFor(x.lvl); x.lvl++; x.pts++;
            if (w.human !== undefined) { showBanner("WORM LEVEL " + x.lvl, "1 Bite · 2 Armor · 3 Appetite", w.color); if (typeof SFX !== "undefined") SFX.play("levelup"); }
            else this.wormStat(w, (Math.random() * 3) | 0);
        }
    },

    // ------------------------------------------------------------ when the three games meet
    interact: function() {
        var S = this.stat, self = this;
        var blobs = Cells.blobs, worms = Snake.worms, tanks = Tanks.tanks, bullets = Tanks.bullets;
        var blobGone = function(b, byName) {
            b.dead = true;
            if (!blobs.some(function(q) { return q.pl === b.pl && !q.dead; })) Cells.die(b.pl, { name: byName });
        };
        // ---- worm bookkeeping: levels, appetite
        for (let j = 0; j < worms.length; j++) {
            var w0 = worms[j];
            if (!w0.alive) { w0.mx = null; continue; }
            if (!w0.mx) w0.mx = { lvl: 1, xp: 0, pts: 0, st: [0, 0, 0], biteCd: 0, last: w0.len };
            var x0 = w0.mx, grew = w0.len - x0.last;
            if (grew > 0) { w0.len += grew * 0.12 * x0.st[2]; this.wormXp(w0, grew * 0.5); }
            x0.last = w0.len;
            if (x0.biteCd > 0) x0.biteCd--;
        }
        // ---- tank bookkeeping: mass, level growth, death lumps
        for (let i = 0; i < tanks.length; i++) {
            var k0 = tanks[i];
            if (!k0.alive) {
                if (k0.mixWasAlive) { k0.mixWasAlive = false; if (!k0.mixEaten && k0.mixMass > 8) this.lumps(k0.x, k0.y, k0.mixMass * 0.8, Math.max(3, Math.min(7, Math.round(k0.mixMass / 12))), k0.color, 12); k0.mixMass = 0; }
                continue;
            }
            if (!k0.mixWasAlive || !k0.mixMass) this.initTank(k0);
            if (k0.lvl > k0.mixLvl) { k0.mixMass += (k0.lvl - k0.mixLvl) * 4; k0.mixLvl = k0.lvl; k0.mixPeak = Math.max(k0.mixPeak || 0, k0.mixMass); }
            // size gives level: every new mass record earns XP (0.5 XP per point). A shrinking tank keeps its level.
            if (k0.mixPeak === undefined) k0.mixPeak = k0.mixMass;
            if (k0.mixMass > k0.mixPeak) { Tanks.gainXp(k0, (k0.mixMass - k0.mixPeak) * 0.5); k0.mixPeak = k0.mixMass; }
            if (k0.mixSplitCd > 0) k0.mixSplitCd--;
            // hurt badly -> pieces break off (once every 5 s at most, so steady fire still kills)
            if (k0.hp < Tanks.maxHp(k0) * 0.35 && k0.mixSplitCd <= 0 && k0.mixMass >= 30) this.splitTank(k0, 0.4, "badly damaged");
        }
        // ---- bullets: they shrink blobs (a blob shot below 12 is gone) and hurt worms (heads most, bodies soak)
        for (let i = bullets.length - 1; i >= 0; i--) {
            var bu = bullets[i], used = false;
            for (let j = 0; j < blobs.length && !used; j++) {
                var bl = blobs[j];
                if (bl.dead || Cells.protectedNow(bl.pl)) continue;
                var br = Cells.rad(bl.m);
                if (Math.abs(bu.x - bl.x) > br + bu.r || Math.hypot(bu.x - bl.x, bu.y - bl.y) > br + bu.r) continue;
                bl.m -= bu.dmg * 1.3; used = true; S.bulletBlob++;
                if (bu.owner && bu.owner.alive) Tanks.gainXp(bu.owner, 2);
                if (bl.m < 12) {
                    blobGone(bl, bu.owner ? bu.owner.name : "a tank");
                    if (bu.owner && bu.owner.alive) Tanks.gainXp(bu.owner, 40);
                    this.note(bu.owner && bu.owner.human !== undefined, (bu.owner ? bu.owner.name : "A tank") + " shot " + bl.pl.name + " to bits", "#93c5fd");
                }
            }
            for (let j = 0; j < worms.length && !used; j++) {
                var w = worms[j];
                if (!w.alive || w.safeT > 0 || arenaProtected(w)) continue;
                var h = w.segs[0], wr = Snake.radius(w);
                if (Math.hypot(bu.x - h.x, bu.y - h.y) < wr + bu.r) {
                    w.len -= bu.dmg * 1.6 * (1 - 0.1 * (w.mx ? w.mx.st[1] : 0)); used = true; S.bulletWorm++;
                    if (bu.owner && bu.owner.alive) Tanks.gainXp(bu.owner, 3);
                    if (w.len < 12) {
                        Snake.kill(w, null); w.deathMsg = "Shot by " + (bu.owner ? bu.owner.name : "a tank");
                        if (bu.owner && bu.owner.alive) Tanks.gainXp(bu.owner, 45);
                        this.note(bu.owner && bu.owner.human !== undefined, (bu.owner ? bu.owner.name : "A tank") + " shot " + w.name, "#93c5fd");
                    }
                }
            }
            if (!used) { var hitW = Snake.hitBody(bu.x, bu.y, bu.r, null); if (hitW && hitW.alive) { hitW.len = Math.max(12, hitW.len - bu.dmg * 0.25 * (1 - 0.1 * (hitW.mx ? hitW.mx.st[1] : 0))); used = true; S.bulletWorm++; } }
            if (used) { bu.pen -= 1; if (bu.pen <= 0) bullets.splice(i, 1); }
        }
        // ---- worms: break blocks, bite tanks; a worm's body is a wall for tanks
        var shapes = Tanks.shapes;
        for (let j = 0; j < worms.length; j++) {
            var w2 = worms[j];
            if (!w2.alive || !w2.mx) continue;
            var h2 = w2.segs[0], wr2 = Snake.radius(w2), bite = w2.mx.st[0], boost = w2.boosting ? 2 : 1;
            for (let i = shapes.length - 1; i >= 0; i--) {
                var sh = shapes[i], SH = TNK_SHAPES[sh.type];
                if (Math.abs(sh.x - h2.x) > SH.r + wr2 || Math.hypot(sh.x - h2.x, sh.y - h2.y) > SH.r + wr2) continue;
                sh.hp -= (0.5 + bite * 0.45) * boost; sh.hitT = 4;
                if (sh.hp <= 0) {
                    shapes.splice(i, 1); Tanks.addShape();
                    this.wormXp(w2, SH.xp); w2.len += 2 + SH.xp * 0.1; S.shapeBroken++;
                    if (w2.human !== undefined && typeof SFX !== "undefined") SFX.play("pickup", h2.x, h2.y, 0.5);
                }
            }
            if (w2.mx.biteCd <= 0) for (let i = 0; i < tanks.length; i++) {
                var k2 = tanks[i];
                if (!k2.alive || Math.hypot(h2.x - k2.x, h2.y - k2.y) > Tanks.size(k2) + wr2 * 0.6) continue;
                Tanks.hurt(k2, (8 + bite * 4) * (boost > 1 ? 1.5 : 1), { name: w2.name });
                w2.len = Math.max(12, w2.len - (2 + k2.st[2]));          // biting a tank costs a little length (more against Body damage)
                w2.mx.biteCd = 18; S.wormBite++; this.wormXp(w2, 4);
                if (!k2.alive) { this.wormXp(w2, 40); this.note(w2.human !== undefined || k2.human !== undefined, w2.name + " bit " + k2.name + " to pieces", w2.color); }
                break;
            }
        }
        for (let i = 0; i < tanks.length; i++) {
            var k = tanks[i];
            if (!k.alive) continue;
            var ks = Tanks.size(k), km = k.mixMass;
            var wall = Snake.hitBody(k.x, k.y, ks * 0.8, null);
            if (wall && wall.alive) {
                Tanks.hurt(k, 1.1, { name: wall.name }); S.wormWall++;
                var wh = wall.segs[0], pd = Math.hypot(k.x - wh.x, k.y - wh.y) || 1; k.vx += (k.x - wh.x) / pd * 0.25; k.vy += (k.y - wh.y) / pd * 0.25;
                if (!k.alive) { this.wormXp(wall, 40); this.note(wall.human !== undefined || k.human !== undefined, k.name + " drove into " + wall.name, wall.color); continue; }
            }
            // a virus breaks a tank apart like it pops a blob
            if (km >= 45 && k.mixSplitCd <= 0) for (let v = Cells.viruses.length - 1; v >= 0; v--) {
                var vi = Cells.viruses[v];
                if (Math.hypot(vi.x - k.x, vi.y - k.y) < ks + 20) { if (this.splitTank(k, 0.5, "hit a virus")) { Cells.viruses.splice(v, 1); Cells.addVirus(); } break; }
            }
            // decay like a blob (same setting as Blob Arena)
            if (cellsCfg.decay > 0 && k.mixMass > 40) k.mixMass -= k.mixMass * cellsCfg.decay * (cellsCfg.decayGrow ? 1 + k.mixMass / 800 : 1);
            // collect some of the worms' food too (a third of its value, like blob food)
            if (this.t % 2 === 1) { var sp0 = Snake.pellets; for (let q = sp0.length - 1; q >= 0; q--) { var g0 = sp0[q]; if (Math.abs(g0.x - k.x) < ks && Math.abs(g0.y - k.y) < ks && Math.hypot(g0.x - k.x, g0.y - k.y) < ks) { k.mixMass += g0.v * 0.35; Tanks.gainXp(k, 1); sp0.splice(q, 1); S.crossFood++; } } }
            // eat food (and the inert lumps other tanks dropped)
            if (this.t % 2 === 0) { var cp0 = Cells.pellets; for (let q = cp0.length - 1; q >= 0; q--) { var f0 = cp0[q]; if (f0.from === k && this.t - f0.born < 180) continue; if (Math.abs(f0.x - k.x) < ks && Math.abs(f0.y - k.y) < ks && Math.hypot(f0.x - k.x, f0.y - k.y) < ks) { k.mixMass += f0.m * (f0.lump ? 0.8 : 0.35); cp0.splice(q, 1); S.crossFood++; } } }
            // blobs and tanks eat each other by the blob rule: 25% bigger and covering it
            for (let j = 0; j < blobs.length; j++) {
                var b2 = blobs[j];
                if (b2.dead || !k.alive) continue;
                var r2 = Cells.rad(b2.m), d2 = Math.hypot(b2.x - k.x, b2.y - k.y);
                if (d2 > r2 + ks) continue;
                if (b2.m > km * 1.25 && d2 < r2 - ks * 0.4 && !(k.inv > 0) && !arenaProtected(k)) {
                    b2.m += km; k.mixEaten = true; k.hp = 0; Tanks.hurt(k, 1, { name: b2.pl.name }); S.blobAteTank++;
                    this.note(b2.pl.human !== undefined || k.human !== undefined, b2.pl.name + " absorbed " + k.name, b2.pl.color);
                } else if (km > b2.m * 1.25 && d2 < ks - r2 * 0.4 && !Cells.protectedNow(b2.pl)) {
                    k.mixMass += b2.m; km = k.mixMass; Tanks.gainXp(k, 10 + Math.round(b2.m * 0.3)); S.tankAteBlob++;
                    this.note(b2.pl.human !== undefined || k.human !== undefined, k.name + " ate " + b2.pl.name, k.color);
                    blobGone(b2, k.name);
                }
            }
            for (let j = 0; j < tanks.length && k.alive; j++) {
                var o = tanks[j];
                if (o === k || !o.alive || o.inv > 0 || arenaProtected(o) || !(km > o.mixMass * 1.25)) continue;
                if (Math.hypot(o.x - k.x, o.y - k.y) < ks - Tanks.size(o) * 0.4) {
                    k.mixMass += o.mixMass; km = k.mixMass; o.mixEaten = true; o.hp = 0; Tanks.hurt(o, 1, k); S.tankAteTank++;
                    this.note(k.human !== undefined || o.human !== undefined, k.name + " ate " + o.name, k.color);
                }
            }
        }
        // ---- a blob that touches a worm POPS like it hit a virus: it splits and part of its mass goes to the worm
        for (let i = 0, n0 = blobs.length; i < n0; i++) {
            var b4 = blobs[i];
            if (b4.dead || b4.popCd > 0 || Cells.protectedNow(b4.pl)) { if (b4.popCd > 0) b4.popCd--; continue; }
            var r4 = Cells.rad(b4.m);
            var w4 = Snake.hitBody(b4.x, b4.y, r4 * 0.8, null);
            if (!w4 || !w4.alive) continue;
            S.blobPopped++;
            if (b4.m < 30) {                                                   // too small to split: the worm takes it whole
                w4.len += b4.m * 0.4; this.wormXp(w4, b4.m * 0.5);
                this.note(b4.pl.human !== undefined || w4.human !== undefined, w4.name + " absorbed " + b4.pl.name, w4.color);
                blobGone(b4, w4.name); continue;
            }
            var lost = b4.m * 0.25, left = b4.m - lost;
            w4.len += lost * 0.3; this.wormXp(w4, lost * 0.4);
            if (b4.pl.chain) { b4.m = left; b4.popCd = 150; continue; }
            var pieces = Math.max(0, Math.min(CEL.MAXCELLS - Cells.mine(b4.pl).length, 5)), each = left / (pieces + 1);
            for (let q = 0; q < pieces; q++) { var pa = q / pieces * Math.PI * 2; blobs.push({ pl: b4.pl, x: b4.x, y: b4.y, m: each, vx: Math.cos(pa) * 16, vy: Math.sin(pa) * 16, mergeT: 600, popCd: 150 }); }
            b4.m = each; b4.mergeT = 600; b4.popCd = 150;
            var hd = w4.segs[0], away = Math.hypot(b4.x - hd.x, b4.y - hd.y) || 1; b4.vx += (b4.x - hd.x) / away * 10; b4.vy += (b4.y - hd.y) / away * 10;
            this.note(b4.pl.human !== undefined || w4.human !== undefined, b4.pl.name + " popped on " + w4.name, w4.color);
            if (b4.pl.human !== undefined) screenShake = 6;
        }
        // ---- shared power-ups: tanks and worms pick up the same pickups blobs do
        //   speed = 1.5x movement · shield = can't be hurt or eaten · magnet = pulls food in · mass = a lump of size
        var pus = Cells.pickups || [];
        var takers = [];
        for (let i = 0; i < tanks.length; i++) if (tanks[i].alive) takers.push({ ref: tanks[i], x: tanks[i].x, y: tanks[i].y, r: Tanks.size(tanks[i]), tank: true });
        for (let j = 0; j < worms.length; j++) if (worms[j].alive) takers.push({ ref: worms[j], x: worms[j].segs[0].x, y: worms[j].segs[0].y, r: Snake.radius(worms[j]), tank: false });
        for (let q = 0; q < takers.length; q++) {
            var T = takers[q], R = T.ref, fx = R.mixFx || (R.mixFx = { speed: 0, magnet: 0 });
            if (fx.speed > 0) fx.speed--;
            if (fx.magnet > 0) {
                fx.magnet--;
                var lists = T.tank ? [Cells.pellets] : [Cells.pellets, Snake.pellets];
                for (let L = 0; L < lists.length; L++) for (let z = 0; z < lists[L].length; z++) { var mp = lists[L][z], mdx = T.x - mp.x, mdy = T.y - mp.y; if (Math.abs(mdx) < 380 && Math.abs(mdy) < 380) { var md = Math.hypot(mdx, mdy) || 1; if (md < 380) { mp.x += mdx / md * 7; mp.y += mdy / md * 7; } } }
            }
            for (let u = pus.length - 1; u >= 0; u--) {
                var pu = pus[u];
                if (Math.hypot(pu.x - T.x, pu.y - T.y) > T.r + 26) continue;
                var PW = CELL_POWERS[pu.kind];
                if (pu.kind === "speed") fx.speed = PW.t;
                else if (pu.kind === "magnet") fx.magnet = PW.t;
                else if (pu.kind === "shield") { if (T.tank) R.inv = Math.max(R.inv || 0, PW.t); else R.safeT = Math.max(R.safeT || 0, PW.t); }
                else if (T.tank) R.mixMass += 30; else R.len += 30;
                pus.splice(u, 1); S.pickups++;
                if (R.human !== undefined) { showBanner(PW.icon + " " + (pu.kind === "mass" ? (T.tank ? "+30 MASS" : "+30 LENGTH") : PW.name), "", PW.col); if (typeof SFX !== "undefined") SFX.play("pickup", T.x, T.y); }
            }
        }
        // ---- food crosses over (every other tick is plenty)
        if (this.t % 2 === 0) {
            var cp = Cells.pellets, sp = Snake.pellets;
            for (let j = 0; j < worms.length; j++) {
                var w5 = worms[j];
                if (!w5.alive) continue;
                var h5 = w5.segs[0], rr = Snake.radius(w5) + 8;
                for (let i = cp.length - 1; i >= 0; i--) { var f = cp[i]; if (Math.abs(f.x - h5.x) < rr && Math.abs(f.y - h5.y) < rr) { w5.len += f.m * 0.6; cp.splice(i, 1); S.crossFood++; } }
            }
            for (let i = 0; i < blobs.length; i++) {
                var b5 = blobs[i];
                if (b5.dead) continue;
                var r5 = Cells.rad(b5.m);
                for (let j = sp.length - 1; j >= 0; j--) { var g = sp[j]; if (Math.abs(g.x - b5.x) < r5 && Math.abs(g.y - b5.y) < r5 && Math.hypot(g.x - b5.x, g.y - b5.y) < r5) { b5.m += g.v; sp.splice(j, 1); S.crossFood++; } }
            }
            while (sp.length < SNK.PELLETS) Snake.addPellet();
        }
        if (blobs.some(function(q) { return q.dead; })) Cells.blobs = blobs.filter(function(q) { return !q.dead; });
    },

    // ------------------------------------------------------------ one camera for all three
    updateCam: function() {
        var m = this.me(), z = this.cam.z;
        if (m && m.alive) {
            if (m.kind === "tank") z = 0.85 / ((TNK_CLASSES[m.ref.cls].fov || 1) * (1 + m.ref.lvl * 0.006));
            else if (m.kind === "blob") z = Math.max(0.22, Math.min(1.2, 1.3 / Math.pow(Math.max(20, Cells.mass(m.ref)) / 20, 0.32)));
            else z = Math.max(0.35, Math.min(1.1, 1.15 - Math.sqrt(m.ref.len) * 0.035));
            this.cam.x += (m.x - this.cam.x) * 0.15; this.cam.y += (m.y - this.cam.y) * 0.15;
        }
        this.cam.z += (Math.max(0.22, z) - this.cam.z) * 0.05;
    },

    frame: function() {
        this.t++;
        // respawn the human when they press their button
        var m = this.me();
        if (m && !m.alive) {
            var r = m.ref; r.deadT = (r.deadT || 0) + (m.kind === "worm" ? 0 : 1);       // Snake.step already counts a dead worm's time
            var pad = (typeof Pads !== "undefined") ? Pads.state[0] : null;
            if (r.deadT > 60 && (mouseDown || SpacePressed || !!(pad && pad.active && pad.shoot))) {
                if (m.kind === "tank") Tanks.spawn(r);
                else if (m.kind === "blob") { Cells.spawn(r); r.splitPrev = true; }
                else { Snake.spawn({ old: r, name: r.name, color: r.color, human: 0 }); r.kills = 0; }
            }
        }
        Snake.mouseMoved = Math.hypot(mouseX - (Snake.lastMouse ? Snake.lastMouse[0] : mouseX), mouseY - (Snake.lastMouse ? Snake.lastMouse[1] : mouseY)) > 3;
        Snake.lastMouse = [mouseX, mouseY];
        Tanks.step(); Cells.step(); Snake.step();
        this.interact();
        // scores for the Arcade card
        m = this.me();
        if (m && m.alive) {
            var sc = m.kind === "tank" ? m.ref.score : (m.kind === "blob" ? Math.round(Cells.mass(m.ref)) : Math.round(m.ref.len));
            var bk = mixCfg.body;
            if (sc > (mixSave.best[bk] || 0)) { mixSave.best[bk] = sc; if (this.t % 120 === 0) { try { localStorage.setItem("timsArenaMixBest", JSON.stringify(mixSave)); } catch (e) {} } }
        }
        this.draw();
    },

    draw: function() {
        this.updateCam();
        ctx.fillStyle = Theme.bg(); ctx.fillRect(0, 0, cssW, cssH);
        Tanks.render();      // tank floor + grid, shapes, bullets, tanks
        Cells.render();      // the blob zone, food, blobs, spikes
        Snake.render();      // the worm ring, food, worms
        // a dashed ring shows a tank or worm holding a power-up: blue = shield, yellow = speed, pink = magnet
        var Z = this.cam.z, self = this;
        var ring = function(x, y, r, col) { var s2 = Tanks.toScreen(x, y); ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, 4 * Z); ctx.setLineDash([10 * Z + 4, 8 * Z + 3]); ctx.lineDashOffset = -self.t * 0.6; ctx.beginPath(); ctx.arc(s2[0], s2[1], r * Z + 6, 0, 7); ctx.stroke(); ctx.setLineDash([]); };
        Tanks.tanks.forEach(function(k) { if (!k.alive) return; var f = k.mixFx || {}, col = k.inv > 130 ? "#38bdf8" : (f.speed > 0 ? "#facc15" : (f.magnet > 0 ? "#f472b6" : null)); if (col) ring(k.x, k.y, Tanks.size(k) + 6, col); });
        Snake.worms.forEach(function(w) { if (!w.alive) return; var f = w.mixFx || {}, col = w.safeT > 130 ? "#38bdf8" : (f.speed > 0 ? "#facc15" : (f.magnet > 0 ? "#f472b6" : null)); if (col) ring(w.segs[0].x, w.segs[0].y, Snake.radius(w) + 8, col); });
        var m = this.me();
        if (m && m.kind === "tank") Tanks.hud();
        else if (m && m.kind === "blob") Cells.hud();
        else if (m) Snake.hud();
        // what this mode adds to the screen: who you are, how to switch, and the cross-game feed
        var name = MIX_BODIES.find(function(b) { return b[0] === mixCfg.body; })[1];
        var extra = "";
        if (m && m.alive && m.kind === "tank") extra = " · mass " + Math.round(this.tankMass(m.ref));
        if (m && m.alive && m.kind === "worm" && m.ref.mx) { var X = m.ref.mx; extra = " · Lv " + X.lvl + (X.pts ? " · " + X.pts + " pt: 1 Bite " + X.st[0] + " · 2 Armor " + X.st[1] + " · 3 Appetite " + X.st[2] : " (B" + X.st[0] + " A" + X.st[1] + " P" + X.st[2] + ")"); }
        uiPanel(14, 76, Math.max(330, 60 + (name.length + extra.length + 34) * 6.4), 34, "#fde047", 0.8);
        uiText("ARENA MIX · you: " + name + " · Q: switch body" + extra, 26, 98, 12, "#fde68a", "left", "800");
        for (let i = 0; i < this.log.length; i++) {
            var L = this.log[i]; L.t--;
            ctx.globalAlpha = Math.min(1, L.t / 60);
            uiText(L.text, 26, 132 + i * 18, 12, L.col, "left", "800");
            ctx.globalAlpha = 1;
        }
        this.log = this.log.filter(function(L) { return L.t > 0; });
        uiText("Bullets shrink blobs · tanks are blobs with a gun (bigger eats smaller) · blobs pop on worms · worms break blocks, bite tanks and level up", cssW / 2, cssH - 28, 11, "rgba(220,230,240,0.75)", "center", "700");
    },

    nextBody: function(dir) {
        var i = MIX_BODIES.findIndex(function(b) { return b[0] === mixCfg.body; });
        this.setBody(MIX_BODIES[(i + (dir || 1) + MIX_BODIES.length) % MIX_BODIES.length][0]);
        showBanner("You are a " + MIX_BODIES.find(function(b) { return b[0] === mixCfg.body; })[1].replace(/^\S+\s/, "").toUpperCase(), "", "#fde047");
    }
};

ModeKit.addLevel("mix_arena", { name: "🌀 Arena Mix", mode: "mix", wavesEnabled: false, spawnP1: [0, 60], spawnP2: [60, 60], layout: ModeKit.room(-600, 600, 800, {}), title: "Arena Mix" });

GameModes.register({
    id: "mix",
    title: "ARENA MIX",
    tagline: "Worms inside blobs inside tanks: all three arenas in one world. Play as any of them.",
    color: "#fde047",
    firstLevel: "mix_arena",
    flags: { ownScreen: true, waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, scenery: false, coopToggle: false },
    overTitle: "ARENA MIX",

    onActivate: function() { Mix.link(); },
    onDeactivate: function() { Mix.unlink(); },
    setupLevel: function() { Mix.link(); Mix.reset(); },
    screenFrame: function() { Mix.frame(); },

    tunables: function() {
        return [
            { label: "Play as", type: "choice", options: MIX_BODIES, get: function() { return mixCfg.body; }, set: function(v) { Mix.setBody(String(v)); } }
        ].concat(arenaRows(), [
            { label: "CPU tanks", type: "range", min: 0, max: 14, step: 1, get: function() { return TNK.CPUS; }, set: function(v) { TNK.CPUS = v; }, note: "next arena" },
            { label: "CPU blobs", type: "range", min: 0, max: 40, step: 1, get: function() { return cellsCfg.bots; }, set: function(v) { cellsCfg.bots = v; saveCellsCfg(); }, note: "changes live" },
            { label: "CPU worms", type: "range", min: 0, max: 20, step: 1, get: function() { return SNK.CPUS; }, set: function(v) { SNK.CPUS = v; }, note: "next arena" }
        ]);
    },
    onKey: function(code) {
        if (code === "KeyQ") { Mix.nextBody(1); return true; }
        if (mixCfg.body === "worm") { var wi = ["Digit1", "Digit2", "Digit3"].indexOf(code), me = Mix.me(); if (wi >= 0 && me && me.alive) { Mix.wormStat(me.ref, wi); return true; } }
        if (mixCfg.body === "tank") { var tk = GameModes.get("tanks"); if (tk && tk.onKey) return tk.onKey(code); }
        return false;
    },
    onClick: function(wx, wy, button) {
        if (mixCfg.body === "tank") { var tk = GameModes.get("tanks"); if (tk && tk.onClick) return tk.onClick(wx, wy, button); }
        return true;
    },
    menuItems: function(items) {
        items.push({ id: "mx_body", label: "Play as:  ◀  " + MIX_BODIES.find(function(b) { return b[0] === mixCfg.body; })[1] + "  ▶", hint: "Tank, blob or worm (Q in play)", cycle: true });
        items.push({ id: "mx_new", label: "New arena", hint: "" });
    },
    onMenu: function(id, dir) {
        if (id === "mx_body") { Mix.nextBody(dir || 1); return true; }
        if (id === "mx_new") { closePause(); Mix.reset(); return true; }
        return false;
    },
    onRestart: function() { Mix.reset(); },
    overSub: function() { return "Best: tank " + mixSave.best.tank + " · blob " + mixSave.best.blob + " · worm " + mixSave.best.worm + " · bubble worm " + (mixSave.best.chain || 0); }
});
