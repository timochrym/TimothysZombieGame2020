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
var MIX_SNK_RING_SQ = 2650 * 2650;

function mixSwapPop(arr, i) {
    var last = arr.length - 1;
    if (i < last) arr[i] = arr[last];
    arr.pop();
}

function mixBuildGrid(list, grid, used) {
    for (let u = 0; u < used.length; u++) grid[used[u]].length = 0;
    used.length = 0;
    for (let i = 0; i < list.length; i++) {
        var p = list[i];
        p._gone = false;
        var cx = (p.x + 3200) >> 8; if (cx < 0) cx = 0; else if (cx > 31) cx = 31;
        var cy = (p.y + 3200) >> 8; if (cy < 0) cy = 0; else if (cy > 31) cy = 31;
        var idx = (cy << 5) | cx;
        var b = grid[idx];
        if (!b) b = grid[idx] = [];
        if (b.length === 0) used.push(idx);
        b.push(p);
    }
}

function mixCompactGone(list) {
    var w = 0;
    for (let i = 0; i < list.length; i++) {
        var p = list[i];
        if (!p._gone) list[w++] = p;
    }
    list.length = w;
}

var Mix = {
    on: false, t: 0, cam: { x: 0, y: 0, z: 0.8 }, view: null, log: [], fx: [],
    _blobR: [], _wormR: [], _tankS: [], _takers: [], _pills: [],
    _cpGrid: new Array(1024), _cpUsed: [], _spGrid: new Array(1024), _spUsed: [],
    _radarBg: null, _pillsCanvas: null, _pillsBody: "",
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
        this.t = 0; this.log = []; this.fx.length = 0;
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
        if (m) {
            this.cam.x = m.x; this.cam.y = m.y;
            this.burst(m.x, m.y, "#fde047", "ring", "YOU", 70);
        }
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
    burst: function(x, y, col, kind, text, maxR) {
        if (Math.abs(x - this.cam.x) > 1400 || Math.abs(y - this.cam.y) > 950) return;
        if (this.fx.length >= 48) mixSwapPop(this.fx, 0);
        this.fx.push({ x: x, y: y, col: col || "#fde047", kind: kind || "spark", text: text || "", r: maxR || 44, t: 0, life: kind === "ring" ? 28 : 20 });
    },

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

    _blobGone: function(blobs, b, byName) {
        b.dead = true;
        for (let i = 0; i < blobs.length; i++) if (blobs[i].pl === b.pl && !blobs[i].dead) return;
        Cells.die(b.pl, { name: byName });
    },

    // ------------------------------------------------------------ when the three games meet
    interact: function() {
        var S = this.stat;
        var blobs = Cells.blobs, worms = Snake.worms, tanks = Tanks.tanks, bullets = Tanks.bullets;
        var blobR = this._blobR, wormR = this._wormR, tankS = this._tankS;
        var anyDead = false;

        // ---- worm bookkeeping: levels, appetite
        for (let j = 0; j < worms.length; j++) {
            var w0 = worms[j];
            if (!w0.alive) { w0.mx = null; wormR[j] = 0; continue; }
            if (!w0.mx) w0.mx = { lvl: 1, xp: 0, pts: 0, st: [0, 0, 0], biteCd: 0, last: w0.len };
            var x0 = w0.mx, grew = w0.len - x0.last;
            if (grew > 0) { w0.len += grew * 0.12 * x0.st[2]; this.wormXp(w0, grew * 0.5); }
            x0.last = w0.len;
            if (x0.biteCd > 0) x0.biteCd--;
            wormR[j] = Snake.radius(w0);
        }
        // ---- tank bookkeeping: mass, level growth, death lumps
        for (let i = 0; i < tanks.length; i++) {
            var k0 = tanks[i];
            if (!k0.alive) {
                if (k0.mixWasAlive) { k0.mixWasAlive = false; if (!k0.mixEaten && k0.mixMass > 8) this.lumps(k0.x, k0.y, k0.mixMass * 0.8, Math.max(3, Math.min(7, Math.round(k0.mixMass / 12))), k0.color, 12); k0.mixMass = 0; }
                tankS[i] = 0;
                continue;
            }
            if (!k0.mixWasAlive || !k0.mixMass) this.initTank(k0);
            if (k0.lvl > k0.mixLvl) { k0.mixMass += (k0.lvl - k0.mixLvl) * 4; k0.mixLvl = k0.lvl; k0.mixPeak = Math.max(k0.mixPeak || 0, k0.mixMass); }
            // size gives level: every new mass record earns XP (0.5 XP per point). A shrinking tank keeps its level.
            if (k0.mixPeak === undefined) k0.mixPeak = k0.mixMass;
            if (k0.mixMass > k0.mixPeak) { Tanks.gainXp(k0, (k0.mixMass - k0.mixPeak) * 0.5); k0.mixPeak = k0.mixMass; }
            if (k0.mixSplitCd > 0) k0.mixSplitCd--;
            // hurt badly -> pieces break off (once every 5 s at most, so steady fire still kills)
            if (k0.hp < Tanks.maxHp(k0) * 0.35 && k0.mixSplitCd <= 0 && k0.mixMass >= 30) {
                if (this.splitTank(k0, 0.4, "badly damaged")) this.burst(k0.x, k0.y, k0.color, "ring", "SPLIT!", Tanks.size(k0) + 40);
            }
            tankS[i] = Tanks.size(k0);
        }
        // cache blob radii once per frame
        for (let j = 0; j < blobs.length; j++) {
            var bj = blobs[j];
            blobR[j] = bj.dead ? 0 : Cells.rad(bj.m);
        }
        // ---- bullets: they shrink blobs (a blob shot below 12 is gone) and hurt worms (heads most, bodies soak)
        for (let i = bullets.length - 1; i >= 0; i--) {
            var bu = bullets[i], used = false, bux = bu.x, buy = bu.y, bur = bu.r;
            for (let j = 0; j < blobs.length; j++) {
                var bl = blobs[j];
                if (bl.dead || Cells.protectedNow(bl.pl)) continue;
                var br = blobR[j], rr = br + bur, dx = bux - bl.x, dy = buy - bl.y;
                if (dx > rr || dx < -rr || dy > rr || dy < -rr || dx * dx + dy * dy > rr * rr) continue;
                bl.m -= bu.dmg * 1.3; used = true; S.bulletBlob++;
                this.burst(bux, buy, bl.pl.color || "#a78bfa", "spark", "", 22);
                if (bu.owner && bu.owner.alive) Tanks.gainXp(bu.owner, 2);
                if (bl.m < 12) {
                    this._blobGone(blobs, bl, bu.owner ? bu.owner.name : "a tank"); anyDead = true;
                    if (bu.owner && bu.owner.alive) Tanks.gainXp(bu.owner, 40);
                    this.note(bu.owner && bu.owner.human !== undefined, (bu.owner ? bu.owner.name : "A tank") + " shot " + bl.pl.name + " to bits", "#93c5fd");
                } else {
                    blobR[j] = Cells.rad(bl.m);
                }
                break;
            }
            if (!used && bux * bux + buy * buy <= MIX_SNK_RING_SQ) {
                for (let j = 0; j < worms.length; j++) {
                    var w = worms[j];
                    if (!w.alive || w.safeT > 0 || arenaProtected(w)) continue;
                    var h = w.segs[0], wr = wormR[j], rrW = wr + bur, dxW = bux - h.x, dyW = buy - h.y;
                    if (dxW > rrW || dxW < -rrW || dyW > rrW || dyW < -rrW || dxW * dxW + dyW * dyW >= rrW * rrW) continue;
                    w.len -= bu.dmg * 1.6 * (1 - 0.1 * (w.mx ? w.mx.st[1] : 0)); used = true; S.bulletWorm++;
                    this.burst(bux, buy, w.color, "spark", "", 24);
                    if (bu.owner && bu.owner.alive) Tanks.gainXp(bu.owner, 3);
                    if (w.len < 12) {
                        Snake.kill(w, null); w.deathMsg = "Shot by " + (bu.owner ? bu.owner.name : "a tank");
                        if (bu.owner && bu.owner.alive) Tanks.gainXp(bu.owner, 45);
                        this.note(bu.owner && bu.owner.human !== undefined, (bu.owner ? bu.owner.name : "A tank") + " shot " + w.name, "#93c5fd");
                    }
                    break;
                }
                if (!used) {
                    var hitW = Snake.hitBody(bux, buy, bur, null);
                    if (hitW && hitW.alive) {
                        hitW.len = Math.max(12, hitW.len - bu.dmg * 0.25 * (1 - 0.1 * (hitW.mx ? hitW.mx.st[1] : 0)));
                        used = true; S.bulletWorm++;
                        this.burst(bux, buy, hitW.color, "spark", "", 18);
                    }
                }
            }
            if (used) { bu.pen -= 1; if (bu.pen <= 0) mixSwapPop(bullets, i); }
        }
        // ---- worms: break blocks, bite tanks; a worm's body is a wall for tanks
        var shapes = Tanks.shapes;
        for (let j = 0; j < worms.length; j++) {
            var w2 = worms[j];
            if (!w2.alive || !w2.mx) continue;
            var h2 = w2.segs[0], wr2 = wormR[j], bite = w2.mx.st[0], boost = w2.boosting ? 2 : 1;
            for (let i = shapes.length - 1; i >= 0; i--) {
                var sh = shapes[i], SH = TNK_SHAPES[sh.type], rrS = SH.r + wr2;
                var dxS = sh.x - h2.x, dyS = sh.y - h2.y;
                if (dxS > rrS || dxS < -rrS || dyS > rrS || dyS < -rrS || dxS * dxS + dyS * dyS > rrS * rrS) continue;
                sh.hp -= (0.5 + bite * 0.45) * boost; sh.hitT = 4;
                if (sh.hp <= 0) {
                    mixSwapPop(shapes, i); Tanks.addShape();
                    this.wormXp(w2, SH.xp); w2.len += 2 + SH.xp * 0.1; S.shapeBroken++;
                    this.burst(sh.x, sh.y, w2.color, "spark", w2.human !== undefined ? "CRACK!" : "", 28);
                    if (w2.human !== undefined && typeof SFX !== "undefined") SFX.play("pickup", h2.x, h2.y, 0.5);
                }
            }
            if (w2.mx.biteCd <= 0) {
                for (let i = 0; i < tanks.length; i++) {
                    var k2 = tanks[i];
                    if (!k2.alive) continue;
                    var rrT = tankS[i] + wr2 * 0.6, dxT = h2.x - k2.x, dyT = h2.y - k2.y;
                    if (dxT > rrT || dxT < -rrT || dyT > rrT || dyT < -rrT || dxT * dxT + dyT * dyT > rrT * rrT) continue;
                    Tanks.hurt(k2, (8 + bite * 4) * (boost > 1 ? 1.5 : 1), { name: w2.name });
                    w2.len = Math.max(12, w2.len - (2 + k2.st[2]));          // biting a tank costs a little length (more against Body damage)
                    w2.mx.biteCd = 18; S.wormBite++; this.wormXp(w2, 4);
                    this.burst(k2.x, k2.y, w2.color, "spark", "BITE!", 34);
                    if (!k2.alive) { this.wormXp(w2, 40); this.note(w2.human !== undefined || k2.human !== undefined, w2.name + " bit " + k2.name + " to pieces", w2.color); }
                    break;
                }
            }
        }
        var sp0 = Snake.pellets, cp0 = Cells.pellets, viruses = Cells.viruses;
        var cpGrid = this._cpGrid, spGrid = this._spGrid;
        var cpBuilt = false, spBuilt = false, cpGone = false, spGone = false;
        var doWormFood = (this.t & 1) === 1;
        if (doWormFood) {
            if (sp0.length > 0 && tanks.length > 0) { mixBuildGrid(sp0, spGrid, this._spUsed); spBuilt = true; }
        } else {
            if (cp0.length > 0 && (tanks.length > 0 || worms.length > 0)) { mixBuildGrid(cp0, cpGrid, this._cpUsed); cpBuilt = true; }
            if (sp0.length > 0 && blobs.length > 0) { mixBuildGrid(sp0, spGrid, this._spUsed); spBuilt = true; }
        }
        for (let i = 0; i < tanks.length; i++) {
            var k = tanks[i];
            if (!k.alive) continue;
            var ks = tankS[i], km = k.mixMass, kx = k.x, ky = k.y;
            if (kx * kx + ky * ky <= MIX_SNK_RING_SQ) {
                var wall = Snake.hitBody(kx, ky, ks * 0.8, null);
                if (wall && wall.alive) {
                    Tanks.hurt(k, 1.1, { name: wall.name }); S.wormWall++;
                    var wh = wall.segs[0], wdx = kx - wh.x, wdy = ky - wh.y, pd = Math.sqrt(wdx * wdx + wdy * wdy) || 1;
                    k.vx += wdx / pd * 0.25; k.vy += wdy / pd * 0.25;
                    if (!k.alive) { this.wormXp(wall, 40); this.note(wall.human !== undefined || k.human !== undefined, k.name + " drove into " + wall.name, wall.color); continue; }
                }
            }
            // a virus breaks a tank apart like it pops a blob
            if (km >= 45 && k.mixSplitCd <= 0) {
                var rrV = ks + 20, rrV2 = rrV * rrV;
                for (let v = viruses.length - 1; v >= 0; v--) {
                    var vi = viruses[v], vdx = vi.x - kx, vdy = vi.y - ky;
                    if (vdx * vdx + vdy * vdy < rrV2) {
                        if (this.splitTank(k, 0.5, "hit a virus")) {
                            mixSwapPop(viruses, v); Cells.addVirus();
                            this.burst(kx, ky, "#22c55e", "ring", "VIRUS!", ks + 45);
                            ks = tankS[i] = Tanks.size(k); km = k.mixMass;
                        }
                        break;
                    }
                }
            }
            // decay like a blob (same setting as Blob Arena)
            if (cellsCfg.decay > 0 && k.mixMass > 40) { k.mixMass -= k.mixMass * cellsCfg.decay * (cellsCfg.decayGrow ? 1 + k.mixMass / 800 : 1); km = k.mixMass; }
            var ks2 = ks * ks;
            var cx0 = ((kx - ks + 3200) >> 8); if (cx0 < 0) cx0 = 0;
            var cx1 = ((kx + ks + 3200) >> 8); if (cx1 > 31) cx1 = 31;
            var cy0 = ((ky - ks + 3200) >> 8); if (cy0 < 0) cy0 = 0;
            var cy1 = ((ky + ks + 3200) >> 8); if (cy1 > 31) cy1 = 31;
            // collect some of the worms' food too (a third of its value, like blob food)
            if (doWormFood) {
                if (spBuilt) {
                    for (let gy = cy0; gy <= cy1; gy++) {
                        var row = gy << 5;
                        for (let gx = cx0; gx <= cx1; gx++) {
                            var bk = spGrid[row | gx];
                            if (!bk || !bk.length) continue;
                            for (let q = 0; q < bk.length; q++) {
                                var g0 = bk[q]; if (g0._gone) continue;
                                var gdx = g0.x - kx, gdy = g0.y - ky;
                                if (gdx * gdx + gdy * gdy < ks2) { k.mixMass += g0.v * 0.35; Tanks.gainXp(k, 1); g0._gone = true; spGone = true; S.crossFood++; }
                            }
                        }
                    }
                }
            } else {
                // eat food (and the inert lumps other tanks dropped)
                if (cpBuilt) {
                    for (let gy = cy0; gy <= cy1; gy++) {
                        var rowC = gy << 5;
                        for (let gx = cx0; gx <= cx1; gx++) {
                            var bkC = cpGrid[rowC | gx];
                            if (!bkC || !bkC.length) continue;
                            for (let q = 0; q < bkC.length; q++) {
                                var f0 = bkC[q]; if (f0._gone || (f0.from === k && this.t - f0.born < 180)) continue;
                                var fdx = f0.x - kx, fdy = f0.y - ky;
                                if (fdx * fdx + fdy * fdy < ks2) { k.mixMass += f0.m * (f0.lump ? 0.8 : 0.35); f0._gone = true; cpGone = true; S.crossFood++; }
                            }
                        }
                    }
                }
            }
            km = k.mixMass;
            // blobs and tanks eat each other by the blob rule: 25% bigger and covering it
            for (let j = 0; j < blobs.length; j++) {
                var b2 = blobs[j];
                if (b2.dead || !k.alive) continue;
                var r2 = blobR[j], bdx = b2.x - kx, bdy = b2.y - ky, rrB = r2 + ks;
                if (bdx > rrB || bdx < -rrB || bdy > rrB || bdy < -rrB) continue;
                var d2sq = bdx * bdx + bdy * bdy;
                if (d2sq > rrB * rrB) continue;
                var limA = r2 - ks * 0.4;
                if (b2.m > km * 1.25 && limA > 0 && d2sq < limA * limA && !(k.inv > 0) && !arenaProtected(k)) {
                    b2.m += km; blobR[j] = Cells.rad(b2.m); k.mixEaten = true; k.hp = 0; Tanks.hurt(k, 1, { name: b2.pl.name }); S.blobAteTank++;
                    this.burst(kx, ky, b2.pl.color, "ring", "ABSORBED!", r2 + 20);
                    this.note(b2.pl.human !== undefined || k.human !== undefined, b2.pl.name + " absorbed " + k.name, b2.pl.color);
                } else {
                    var limT = ks - r2 * 0.4;
                    if (km > b2.m * 1.25 && limT > 0 && d2sq < limT * limT && !Cells.protectedNow(b2.pl)) {
                        k.mixMass += b2.m; km = k.mixMass; ks = tankS[i] = Tanks.size(k);
                        Tanks.gainXp(k, 10 + Math.round(b2.m * 0.3)); S.tankAteBlob++;
                        this.burst(b2.x, b2.y, k.color, "ring", "ATE BLOB!", ks + 20);
                        this.note(b2.pl.human !== undefined || k.human !== undefined, k.name + " ate " + b2.pl.name, k.color);
                        this._blobGone(blobs, b2, k.name); anyDead = true;
                    }
                }
            }
            for (let j = 0; j < tanks.length && k.alive; j++) {
                var o = tanks[j];
                if (o === k || !o.alive || o.inv > 0 || arenaProtected(o) || !(km > o.mixMass * 1.25)) continue;
                var limO = ks - tankS[j] * 0.4;
                if (limO <= 0) continue;
                var odx = o.x - kx, ody = o.y - ky;
                if (odx * odx + ody * ody < limO * limO) {
                    k.mixMass += o.mixMass; km = k.mixMass; ks = tankS[i] = Tanks.size(k);
                    o.mixEaten = true; o.hp = 0; Tanks.hurt(o, 1, k); S.tankAteTank++;
                    this.burst(o.x, o.y, k.color, "ring", "CRUSHED!", ks + 20);
                    this.note(k.human !== undefined || o.human !== undefined, k.name + " ate " + o.name, k.color);
                }
            }
        }
        // ---- a blob that touches a worm POPS like it hit a virus: it splits and part of its mass goes to the worm
        for (let i = 0, n0 = blobs.length; i < n0; i++) {
            var b4 = blobs[i];
            if (b4.dead || b4.popCd > 0 || Cells.protectedNow(b4.pl)) { if (b4.popCd > 0) b4.popCd--; continue; }
            if (b4.x * b4.x + b4.y * b4.y > MIX_SNK_RING_SQ) continue;
            var r4 = blobR[i];
            var w4 = Snake.hitBody(b4.x, b4.y, r4 * 0.8, null);
            if (!w4 || !w4.alive) continue;
            S.blobPopped++;
            if (b4.m < 30) {                                                   // too small to split: the worm takes it whole
                w4.len += b4.m * 0.4; this.wormXp(w4, b4.m * 0.5);
                this.burst(b4.x, b4.y, w4.color, "spark", "", 28);
                this.note(b4.pl.human !== undefined || w4.human !== undefined, w4.name + " absorbed " + b4.pl.name, w4.color);
                this._blobGone(blobs, b4, w4.name); anyDead = true; continue;
            }
            var lost = b4.m * 0.25, left = b4.m - lost;
            w4.len += lost * 0.3; this.wormXp(w4, lost * 0.4);
            this.burst(b4.x, b4.y, "#a78bfa", "ring", "POP!", r4 + 35);
            if (b4.pl.chain) { b4.m = left; blobR[i] = Cells.rad(left); b4.popCd = 150; continue; }
            var pieces = Math.max(0, Math.min(CEL.MAXCELLS - Cells.mine(b4.pl).length, 5)), each = left / (pieces + 1);
            for (let q = 0; q < pieces; q++) {
                var pa = q / pieces * Math.PI * 2;
                blobs.push({ pl: b4.pl, x: b4.x, y: b4.y, m: each, vx: Math.cos(pa) * 16, vy: Math.sin(pa) * 16, mergeT: 600, popCd: 150 });
                blobR[blobs.length - 1] = Cells.rad(each);
            }
            b4.m = each; blobR[i] = Cells.rad(each); b4.mergeT = 600; b4.popCd = 150;
            var hd = w4.segs[0], adx = b4.x - hd.x, ady = b4.y - hd.y, away = Math.sqrt(adx * adx + ady * ady) || 1;
            b4.vx += adx / away * 10; b4.vy += ady / away * 10;
            this.note(b4.pl.human !== undefined || w4.human !== undefined, b4.pl.name + " popped on " + w4.name, w4.color);
            if (b4.pl.human !== undefined) screenShake = 6;
        }
        // ---- shared power-ups: tanks and worms pick up the same pickups blobs do
        //   speed = 1.5x movement · shield = can't be hurt or eaten · magnet = pulls food in · mass = a lump of size
        var pus = Cells.pickups || [];
        var takers = this._takers; takers.length = 0;
        for (let i = 0; i < tanks.length; i++) if (tanks[i].alive) takers.push({ ref: tanks[i], x: tanks[i].x, y: tanks[i].y, r: tankS[i], tank: true });
        for (let j = 0; j < worms.length; j++) if (worms[j].alive) takers.push({ ref: worms[j], x: worms[j].segs[0].x, y: worms[j].segs[0].y, r: wormR[j], tank: false });
        for (let q = 0; q < takers.length; q++) {
            var T = takers[q], R = T.ref, fx = R.mixFx || (R.mixFx = { speed: 0, magnet: 0 });
            if (fx.speed > 0) fx.speed--;
            if (fx.magnet > 0) {
                fx.magnet--;
                if (!cpBuilt && cp0.length > 0) { mixBuildGrid(cp0, cpGrid, this._cpUsed); cpBuilt = true; }
                if (!T.tank && !spBuilt && sp0.length > 0) { mixBuildGrid(sp0, spGrid, this._spUsed); spBuilt = true; }
                var magSq = 380 * 380;
                var mx0 = ((T.x - 380 + 3200) >> 8); if (mx0 < 0) mx0 = 0;
                var mx1 = ((T.x + 380 + 3200) >> 8); if (mx1 > 31) mx1 = 31;
                var my0 = ((T.y - 380 + 3200) >> 8); if (my0 < 0) my0 = 0;
                var my1 = ((T.y + 380 + 3200) >> 8); if (my1 > 31) my1 = 31;
                if (cpBuilt) {
                    for (let gy = my0; gy <= my1; gy++) {
                        var rowM = gy << 5;
                        for (let gx = mx0; gx <= mx1; gx++) {
                            var bkM = cpGrid[rowM | gx]; if (!bkM || !bkM.length) continue;
                            for (let z = 0; z < bkM.length; z++) {
                                var mp = bkM[z]; if (mp._gone) continue;
                                var mdx = T.x - mp.x, mdy = T.y - mp.y, mdsq = mdx * mdx + mdy * mdy;
                                if (mdsq < magSq && mdsq > 1) { var md = Math.sqrt(mdsq); mp.x += mdx / md * 7; mp.y += mdy / md * 7; }
                            }
                        }
                    }
                }
                if (!T.tank && spBuilt) {
                    for (let gy = my0; gy <= my1; gy++) {
                        var rowM2 = gy << 5;
                        for (let gx = mx0; gx <= mx1; gx++) {
                            var bkM2 = spGrid[rowM2 | gx]; if (!bkM2 || !bkM2.length) continue;
                            for (let z = 0; z < bkM2.length; z++) {
                                var mp2 = bkM2[z]; if (mp2._gone) continue;
                                var mdx2 = T.x - mp2.x, mdy2 = T.y - mp2.y, mdsq2 = mdx2 * mdx2 + mdy2 * mdy2;
                                if (mdsq2 < magSq && mdsq2 > 1) { var md2 = Math.sqrt(mdsq2); mp2.x += mdx2 / md2 * 7; mp2.y += mdy2 / md2 * 7; }
                            }
                        }
                    }
                }
            }
            var puR = T.r + 26, puR2 = puR * puR;
            for (let u = pus.length - 1; u >= 0; u--) {
                var pu = pus[u], pudx = pu.x - T.x, pudy = pu.y - T.y;
                if (pudx * pudx + pudy * pudy > puR2) continue;
                var PW = CELL_POWERS[pu.kind];
                if (pu.kind === "speed") fx.speed = PW.t;
                else if (pu.kind === "magnet") fx.magnet = PW.t;
                else if (pu.kind === "shield") { if (T.tank) R.inv = Math.max(R.inv || 0, PW.t); else R.safeT = Math.max(R.safeT || 0, PW.t); }
                else if (T.tank) R.mixMass += 30; else R.len += 30;
                mixSwapPop(pus, u); S.pickups++;
                this.burst(T.x, T.y, PW.col, "ring", PW.icon, T.r + 36);
                if (R.human !== undefined) { showBanner(PW.icon + " " + (pu.kind === "mass" ? (T.tank ? "+30 MASS" : "+30 LENGTH") : PW.name), "", PW.col); if (typeof SFX !== "undefined") SFX.play("pickup", T.x, T.y); }
            }
        }
        // ---- food crosses over (every other tick is plenty)
        if (!doWormFood) {
            if (cpBuilt) {
                for (let j = 0; j < worms.length; j++) {
                    var w5 = worms[j];
                    if (!w5.alive) continue;
                    var h5 = w5.segs[0], rr5 = wormR[j] + 8;
                    var wx0 = ((h5.x - rr5 + 3200) >> 8); if (wx0 < 0) wx0 = 0;
                    var wx1 = ((h5.x + rr5 + 3200) >> 8); if (wx1 > 31) wx1 = 31;
                    var wy0 = ((h5.y - rr5 + 3200) >> 8); if (wy0 < 0) wy0 = 0;
                    var wy1 = ((h5.y + rr5 + 3200) >> 8); if (wy1 > 31) wy1 = 31;
                    for (let gy = wy0; gy <= wy1; gy++) {
                        var rowW = gy << 5;
                        for (let gx = wx0; gx <= wx1; gx++) {
                            var bkW = cpGrid[rowW | gx]; if (!bkW || !bkW.length) continue;
                            for (let i = 0; i < bkW.length; i++) {
                                var f = bkW[i]; if (f._gone) continue;
                                var fdx5 = f.x - h5.x, fdy5 = f.y - h5.y;
                                if (fdx5 < rr5 && fdx5 > -rr5 && fdy5 < rr5 && fdy5 > -rr5) { w5.len += f.m * 0.6; f._gone = true; cpGone = true; S.crossFood++; }
                            }
                        }
                    }
                }
            }
            if (spBuilt) {
                for (let i = 0; i < blobs.length; i++) {
                    var b5 = blobs[i];
                    if (b5.dead) continue;
                    var r5 = blobR[i], r5sq = r5 * r5;
                    var bx0 = ((b5.x - r5 + 3200) >> 8); if (bx0 < 0) bx0 = 0;
                    var bx1 = ((b5.x + r5 + 3200) >> 8); if (bx1 > 31) bx1 = 31;
                    var by0 = ((b5.y - r5 + 3200) >> 8); if (by0 < 0) by0 = 0;
                    var by1 = ((b5.y + r5 + 3200) >> 8); if (by1 > 31) by1 = 31;
                    for (let gy = by0; gy <= by1; gy++) {
                        var rowB = gy << 5;
                        for (let gx = bx0; gx <= bx1; gx++) {
                            var bkB = spGrid[rowB | gx]; if (!bkB || !bkB.length) continue;
                            for (let j = 0; j < bkB.length; j++) {
                                var g = bkB[j]; if (g._gone) continue;
                                var gdx5 = g.x - b5.x, gdy5 = g.y - b5.y;
                                if (gdx5 * gdx5 + gdy5 * gdy5 < r5sq) { b5.m += g.v; g._gone = true; spGone = true; S.crossFood++; }
                            }
                        }
                    }
                }
            }
        }
        if (cpGone) mixCompactGone(cp0);
        if (spGone) mixCompactGone(sp0);
        if (!doWormFood) while (sp0.length < SNK.PELLETS) Snake.addPellet();
        if (anyDead) {
            var wIdx = 0;
            for (let i = 0; i < blobs.length; i++) if (!blobs[i].dead) blobs[wIdx++] = blobs[i];
            blobs.length = wIdx;
        }
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

    drawFx: function(Z) {
        var fx = this.fx;
        for (let i = fx.length - 1; i >= 0; i--) {
            var p = fx[i];
            p.t++;
            if (p.t >= p.life) { mixSwapPop(fx, i); continue; }
            var prog = p.t / p.life, alpha = 1 - prog;
            var s = Tanks.toScreen(p.x, p.y);
            if (s[0] < -120 || s[0] > cssW + 120 || s[1] < -120 || s[1] > cssH + 120) continue;
            ctx.save();
            ctx.globalAlpha = alpha;
            if (p.kind === "ring") {
                ctx.strokeStyle = p.col;
                ctx.lineWidth = Math.max(1.5, (3.5 - prog * 2.5) * Z);
                ctx.beginPath();
                ctx.arc(s[0], s[1], Math.max(4, (12 + p.r * prog) * Z), 0, 7);
                ctx.stroke();
            } else {
                ctx.fillStyle = p.col;
                var sp = (6 + p.r * prog) * Z, sz = Math.max(2, 4 * Z * alpha);
                for (let k = 0; k < 4; k++) {
                    var a = k * 1.5708 + prog * 0.9;
                    ctx.fillRect(s[0] + Math.cos(a) * sp - sz * 0.5, s[1] + Math.sin(a) * sp - sz * 0.5, sz, sz);
                }
            }
            if (p.text) {
                uiText(p.text, s[0], s[1] - (10 + prog * 24) * Math.max(0.7, Z), 11, p.col, "center", "900");
            }
            ctx.restore();
        }
    },

    drawRadar: function(m) {
        var size = 108, rx = cssW - size - 16, ry = cssH - size - 44;
        if (rx < 360 || ry < 160) return;
        var half = size * 0.5, cx = rx + half, cy = ry + half, scale = (size - 10) / 6000;
        if (!this._radarBg) {
            var rc = document.createElement("canvas");
            rc.width = size; rc.height = size;
            var g = rc.getContext("2d");
            g.fillStyle = "rgba(10,16,30,0.72)";
            g.strokeStyle = "rgba(253,224,71,0.35)";
            g.lineWidth = 1.5;
            g.beginPath(); g.roundRect(1, 1, size - 2, size - 2, 10); g.fill(); g.stroke();
            var bw = 5200 * scale;
            g.strokeStyle = "rgba(167,139,250,0.45)"; g.lineWidth = 1;
            g.strokeRect(half - bw * 0.5, half - bw * 0.5, bw, bw);
            g.strokeStyle = "rgba(244,114,182,0.5)";
            g.beginPath(); g.arc(half, half, 2400 * scale, 0, 7); g.stroke();
            g.font = "800 9px system-ui, sans-serif";
            g.textAlign = "center";
            g.fillStyle = "rgba(226,232,240,0.7)";
            g.fillText("3-IN-1 RADAR", half, size - 5);
            this._radarBg = rc;
        }
        ctx.drawImage(this._radarBg, rx, ry);
        // entity dots
        ctx.fillStyle = "#60a5fa";
        for (let i = 0; i < Tanks.tanks.length; i++) {
            var k = Tanks.tanks[i]; if (!k.alive) continue;
            ctx.fillRect(cx + k.x * scale - 1.5, cy + k.y * scale - 1.5, 3, 3);
        }
        ctx.fillStyle = "#c084fc";
        for (let i = 0; i < Cells.blobs.length; i++) {
            var b = Cells.blobs[i]; if (b.dead) continue;
            ctx.fillRect(cx + b.x * scale - 1.5, cy + b.y * scale - 1.5, 3, 3);
        }
        ctx.fillStyle = "#f472b6";
        for (let i = 0; i < Snake.worms.length; i++) {
            var w = Snake.worms[i]; if (!w.alive) continue;
            ctx.fillRect(cx + w.segs[0].x * scale - 1.5, cy + w.segs[0].y * scale - 1.5, 3, 3);
        }
        if (m && m.alive) {
            var px = cx + m.x * scale, py = cy + m.y * scale;
            var pulse = 4 + Math.sin(this.t * 0.18) * 1.8;
            ctx.strokeStyle = "#fde047"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(px, py, pulse, 0, 7); ctx.stroke();
            ctx.fillStyle = "#fde047";
            ctx.beginPath(); ctx.arc(px, py, 2.5, 0, 7); ctx.fill();
        }
    },

    draw: function() {
        this.updateCam();
        ctx.fillStyle = Theme.bg(); ctx.fillRect(0, 0, cssW, cssH);
        Tanks.render();      // tank floor + grid, shapes, bullets, tanks
        Cells.render();      // the blob zone, food, blobs, spikes
        Snake.render();      // the worm ring, food, worms
        // a dashed ring shows a tank or worm holding a power-up: blue = shield, yellow = speed, pink = magnet
        var Z = this.cam.z;
        ctx.lineWidth = Math.max(2, 4 * Z);
        ctx.setLineDash([10 * Z + 4, 8 * Z + 3]);
        ctx.lineDashOffset = -this.t * 0.6;
        for (let i = 0; i < Tanks.tanks.length; i++) {
            var k = Tanks.tanks[i];
            if (!k.alive) continue;
            var fk = k.mixFx, colK = k.inv > 130 ? "#38bdf8" : (fk && fk.speed > 0 ? "#facc15" : (fk && fk.magnet > 0 ? "#f472b6" : null));
            if (colK) {
                var sk = Tanks.toScreen(k.x, k.y);
                ctx.strokeStyle = colK; ctx.beginPath(); ctx.arc(sk[0], sk[1], (Tanks.size(k) + 6) * Z + 6, 0, 7); ctx.stroke();
            }
        }
        for (let i = 0; i < Snake.worms.length; i++) {
            var w = Snake.worms[i];
            if (!w.alive) continue;
            var fw = w.mixFx, colW = w.safeT > 130 ? "#38bdf8" : (fw && fw.speed > 0 ? "#facc15" : (fw && fw.magnet > 0 ? "#f472b6" : null));
            if (colW) {
                var sw = Tanks.toScreen(w.segs[0].x, w.segs[0].y);
                ctx.strokeStyle = colW; ctx.beginPath(); ctx.arc(sw[0], sw[1], (Snake.radius(w) + 8) * Z + 6, 0, 7); ctx.stroke();
            }
        }
        ctx.setLineDash([]);
        this.drawFx(Z);

        var m = this.me();
        if (m && m.kind === "tank") Tanks.hud();
        else if (m && m.kind === "blob") Cells.hud();
        else if (m) Snake.hud();

        // what this mode adds to the screen: who you are, clickable body pills, and the cross-game feed
        var name = MIX_BODIES[0][1];
        for (let i = 0; i < MIX_BODIES.length; i++) if (MIX_BODIES[i][0] === mixCfg.body) { name = MIX_BODIES[i][1]; break; }
        var extra = "";
        if (m && m.alive && m.kind === "tank") extra = " · mass " + Math.round(this.tankMass(m.ref));
        else if (m && m.alive && mixCfg.body === "chain" && m.ref.chainList) { var bc = m.ref.chainList.length; extra = " · " + bc + (bc === 1 ? " bubble" : " bubbles"); }
        if (m && m.alive && m.kind === "worm" && m.ref.mx) { var X = m.ref.mx; extra = " · Lv " + X.lvl + (X.pts ? " · " + X.pts + " pt: 1 Bite " + X.st[0] + " · 2 Armor " + X.st[1] + " · 3 Appetite " + X.st[2] : " (B" + X.st[0] + " A" + X.st[1] + " P" + X.st[2] + ")"); }
        uiPanel(14, 76, Math.max(330, 60 + (name.length + extra.length + 34) * 6.4), 34, "#fde047", 0.8);
        uiText("ARENA MIX · you: " + name + " · Q: switch body" + extra, 26, 98, 12, "#fde68a", "left", "800");

        // clickable quick-switch body pills (cached to offscreen canvas per active body)
        if (!this._pillsCanvas || this._pillsBody !== mixCfg.body) {
            this._pillsBody = mixCfg.body;
            this._pills.length = 0;
            var pc = this._pillsCanvas || (this._pillsCanvas = document.createElement("canvas"));
            pc.width = 360; pc.height = 26;
            var pg = pc.getContext("2d");
            pg.clearRect(0, 0, 360, 26);
            var px = 0;
            for (let i = 0; i < MIX_BODIES.length; i++) {
                var bd = MIX_BODIES[i], active = bd[0] === mixCfg.body;
                var lbl = bd[0] === "chain" ? "📿 Bubble" : bd[1];
                var pw = lbl.length * 7.2 + 18;
                pg.fillStyle = active ? "rgba(253,224,71,0.24)" : "rgba(15,23,42,0.72)";
                pg.strokeStyle = active ? "#fde047" : "rgba(148,163,184,0.35)";
                pg.lineWidth = active ? 1.5 : 1;
                pg.beginPath(); pg.roundRect(px + 1, 1, pw, 22, 6); pg.fill(); pg.stroke();
                pg.font = (active ? "800 " : "700 ") + "11px system-ui, sans-serif";
                pg.textAlign = "center";
                pg.fillStyle = active ? "#fef08a" : "#cbd5e1";
                pg.fillText(lbl, px + 1 + pw * 0.5, 16);
                this._pills.push({ id: bd[0], x: 14 + px, y: 114, w: pw, h: 22 });
                px += pw + 6;
            }
        }
        ctx.drawImage(this._pillsCanvas, 14, 113);

        var lw = 0;
        for (let i = 0; i < this.log.length; i++) {
            var L = this.log[i]; L.t--;
            if (L.t <= 0) continue;
            ctx.globalAlpha = Math.min(1, L.t / 60);
            uiText(L.text, 26, 156 + lw * 18, 12, L.col, "left", "800");
            ctx.globalAlpha = 1;
            this.log[lw++] = L;
        }
        this.log.length = lw;
        this.drawRadar(m);
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
        if (button === 0 && typeof mouseX === "number" && typeof mouseY === "number") {
            for (let i = 0; i < Mix._pills.length; i++) {
                var p = Mix._pills[i];
                if (mouseX >= p.x && mouseX <= p.x + p.w && mouseY >= p.y && mouseY <= p.y + p.h) {
                    if (p.id !== mixCfg.body) Mix.setBody(p.id);
                    return true;
                }
            }
        }
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
