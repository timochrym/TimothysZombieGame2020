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
    setPeerBody: function(p, body) {
        if (!p) return;
        body = ["tank", "blob", "worm", "chain"].indexOf(body) !== -1 ? body : "tank";
        p.mixBody = body;
        Tanks.tanks = Tanks.tanks.filter(function(k) { return k.pid !== p.pid; });
        var gone = Cells.players.filter(function(q) { return q.pid === p.pid; });
        Cells.players = Cells.players.filter(function(q) { return q.pid !== p.pid; });
        Cells.blobs = Cells.blobs.filter(function(b) { return gone.indexOf(b.pl) === -1; });
        Snake.worms = Snake.worms.filter(function(w) { return w.pid !== p.pid; });
        var o = { human: "lan", name: p.name, color: p.color || "#fde047" };
        if (body === "tank") { var k = Tanks.addTank(o); if (k) k.pid = p.pid; }
        else if (body === "blob") { var q = Cells.addPlayer(o); if (q) q.pid = p.pid; }
        else if (body === "chain") { var qc = Cells.addPlayer(o); if (qc) { qc.pid = p.pid; qc.chain = true; } }
        else { var w = Snake.spawn(o); if (w) w.pid = p.pid; }
    },
    lanSync: function() {
        if (typeof Net === "undefined" || Net.role !== "host") return;
        var self = this;
        // remove disconnected peers
        Tanks.tanks = Tanks.tanks.filter(function(k) { return k.human !== "lan" || !!Net.peers[k.pid]; });
        var gone = Cells.players.filter(function(q) { return q.human === "lan" && !Net.peers[q.pid]; });
        if (gone.length) {
            Cells.players = Cells.players.filter(function(q) { return q.human !== "lan" || !!Net.peers[q.pid]; });
            Cells.blobs = Cells.blobs.filter(function(b) { return gone.indexOf(b.pl) === -1; });
        }
        Snake.worms = Snake.worms.filter(function(w) { return w.human !== "lan" || !!Net.peers[w.pid]; });
        Net.peerList().forEach(function(p) {
            var tk = Tanks.tanks.find(function(q) { return q.pid === p.pid; });
            var cp = Cells.players.find(function(q) { return q.pid === p.pid; });
            var wm = Snake.worms.find(function(q) { return q.pid === p.pid; });
            var x = Net.peerX(p.pid);
            if (!tk && !cp && !wm) { self.setPeerBody(p, x.body || p.mixBody || "tank"); return; }
            if (x.body && x.body !== p.mixBody) { self.setPeerBody(p, x.body); return; }
            if (x.ws && x.ws !== p._seenWs) {
                p._seenWs = x.ws;
                if (wm && wm.alive) self.wormStat(wm, (x.ws % 10) - 1);
            }
            if (x.ts && x.ts !== p._seenTs) {
                p._seenTs = x.ts;
                if (tk && tk.alive) Tanks.addStat(tk, (x.ts % 10) - 1);
            }
            if (x.tc && x.tc !== p._seenTc) {
                p._seenTc = x.tc;
                if (tk && tk.alive && tk.choose) {
                    var nx = TNK_CLASSES[tk.cls] && TNK_CLASSES[tk.cls].next;
                    var ci = (x.tc % 10) - 1;
                    if (nx && nx[ci]) Tanks.pickClass(tk, nx[ci]);
                }
            }
            var again = !!(x.f || x.s || x.b || x.c);
            if (tk && !tk.alive && ++tk.deadT > 60 && again) Tanks.spawn(tk);
            if (cp && !cp.alive && ++cp.deadT > 60 && again) { Cells.spawn(cp); cp.splitPrev = true; }
            if (wm && !wm.alive && ++wm.deadT > 60 && again) { var nw = Snake.spawn({ old: wm, name: wm.name, color: wm.color, human: "lan" }); if (nw) { nw.pid = p.pid; nw.kills = 0; } }
        });
    },
    // the human's body as { kind, x, y, alive, ref }
    me: function() {
        if (typeof Net !== "undefined" && Net.role === "client") {
            var tk = Tanks.tanks.find(function(q) { return q.pid === Net.pid; });
            if (tk) return { kind: "tank", ref: tk, x: tk.x, y: tk.y, alive: tk.alive };
            var cp = Cells.players.find(function(q) { return q.pid === Net.pid; });
            if (cp) {
                var hd = (cp.chain && cp.chainList && cp.chainList[0]) || (cp.blobs && cp.blobs[0]);
                return { kind: "blob", ref: cp, x: cp.cx || (hd ? hd.x : 0), y: cp.cy || (hd ? hd.y : 0), alive: cp.alive };
            }
            var wm = Snake.worms.find(function(q) { return q.pid === Net.pid; });
            if (wm) return { kind: "worm", ref: wm, x: wm.segs[0].x, y: wm.segs[0].y, alive: wm.alive };
            return null;
        }
        if (mixCfg.body === "tank") { var k = Tanks.tanks.find(function(q) { return q.human === 0; }); return k ? { kind: "tank", ref: k, x: k.x, y: k.y, alive: k.alive } : null; }
        if (mixCfg.body === "blob" || mixCfg.body === "chain") {
            var p = Cells.players.find(function(q) { return q.human === 0; });
            var hd = p && ((p.chain && p.chainList && p.chainList[0]) || (p.blobs && p.blobs[0]));
            return p ? { kind: "blob", ref: p, x: (p.chain && hd) ? hd.x : (p.cx || (hd ? hd.x : 0)), y: (p.chain && hd) ? hd.y : (p.cy || (hd ? hd.y : 0)), alive: p.alive } : null;
        }
        var w = Snake.worms.find(function(q) { return q.human === 0; });
        return w ? { kind: "worm", ref: w, x: w.segs[0].x, y: w.segs[0].y, alive: w.alive } : null;
    },
    say: function(text, col) { this.log.unshift({ text: text, col: col || "#e2e8f0", t: 240 }); if (this.log.length > 5) this.log.length = 5; },
    note: function(human, text, col) { this.say(text, col); if (human) showBanner(text, "", col || "#fde047"); },
    burst: function(x, y, col, kind, text, maxR) {
        if (typeof Net !== "undefined" && Net.role === "host" && Net.peerCount() > 0) {
            var nf = this._netFx || (this._netFx = []);
            if (nf.length < 20) nf.push([Math.round(x), Math.round(y), col || "#fde047", kind || "spark", text || "", Math.round(maxR || 44)]);
        }
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
            blobR[j] = bj.dead ? 0 : Cells.rad(bj.m, bj);
        }
        var viruses = Cells.viruses;
        // ---- bullets: they shrink blobs (a blob shot below 12 is gone), hurt worms (heads most, bodies soak), and feed viruses
        for (let i = bullets.length - 1; i >= 0; i--) {
            var bu = bullets[i], used = false, bux = bu.x, buy = bu.y, bur = bu.r;
            var effDmg = bu.dmg;
            if (effDmg > 10) effDmg = 10 + Math.sqrt((effDmg - 10) * 5.5);
            if (bu.maxLife) effDmg *= (0.35 + 0.65 * Math.min(1, bu.life / bu.maxLife));
            for (let j = 0; j < blobs.length; j++) {
                var bl = blobs[j];
                if (bl.dead) continue;
                var br = blobR[j], rr = br + bur, dx = bux - bl.x, dy = buy - bl.y;
                if (dx > rr || dx < -rr || dy > rr || dy < -rr || dx * dx + dy * dy > rr * rr) continue;
                if (Cells.protectedNow(bl.pl)) {
                    used = true; bu.pen = 0;
                    this.burst(bux, buy, "#38bdf8", "spark", "SHIELD!", 24);
                    break;
                }
                bl.m -= effDmg * (bl.pl.chain ? 1.65 : 1.3); used = true; S.bulletBlob++;
                bl.vx = (bl.vx || 0) + (bu.vx || 0) * 0.16; bl.vy = (bl.vy || 0) + (bu.vy || 0) * 0.16;
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
                    if (!w.alive) continue;
                    var h = w.segs[0], wr = wormR[j], rrW = wr + bur, dxW = bux - h.x, dyW = buy - h.y;
                    if (dxW > rrW || dxW < -rrW || dyW > rrW || dyW < -rrW || dxW * dxW + dyW * dyW >= rrW * rrW) continue;
                    if (w.safeT > 0 || arenaProtected(w)) {
                        used = true; bu.pen = 0;
                        this.burst(bux, buy, "#38bdf8", "spark", "SHIELD!", 24);
                        break;
                    }
                    w.len -= effDmg * 0.85 * (1 - 0.1 * (w.mx ? w.mx.st[1] : 0)); used = true; S.bulletWorm++;
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
                        if (hitW.safeT > 0 || arenaProtected(hitW)) {
                            used = true; bu.pen = 0;
                            this.burst(bux, buy, "#38bdf8", "spark", "SHIELD!", 22);
                        } else {
                            hitW.len = Math.max(12, hitW.len - effDmg * 0.08 * (1 - 0.1 * (hitW.mx ? hitW.mx.st[1] : 0)));
                            used = true; S.bulletWorm++;
                            this.burst(bux, buy, hitW.color, "spark", "", 18);
                        }
                    }
                }
            }
            if (!used) {
                for (let v = 0; v < viruses.length; v++) {
                    var viB = viruses[v], vrB = Cells.rad(viB.m || 100) + bur;
                    var vdxB = bux - viB.x, vdyB = buy - viB.y;
                    if (vdxB * vdxB + vdyB * vdyB < vrB * vrB) {
                        var firedV = Cells.feedVirus(viB, bu.vx || (viB.x - bux), bu.vy || (viB.y - buy), 1);
                        used = true;
                        this.burst(viB.x, viB.y, "#4ade80", firedV ? "ring" : "spark", firedV ? "SPIKE!" : "", firedV ? 55 : 22);
                        break;
                    }
                }
            }
            if (used) { bu.pen -= 1; if (bu.pen <= 0) mixSwapPop(bullets, i); }
        }
        // ---- worms: break blocks, bite tanks, feed spikes when boosting; a worm's body is a wall for tanks
        var shapes = Tanks.shapes;
        for (let j = 0; j < worms.length; j++) {
            var w2 = worms[j];
            if (!w2.alive || !w2.mx) continue;
            if (w2.mx.vFeedCd > 0) w2.mx.vFeedCd--;
            var h2 = w2.segs[0], wr2 = wormR[j], bite = w2.mx.st[0], boost = w2.boosting ? 2 : 1;
            for (let i = shapes.length - 1; i >= 0; i--) {
                var sh = shapes[i], SH = TNK_SHAPES[sh.type], rrS = SH.r + wr2;
                var dxS = sh.x - h2.x, dyS = sh.y - h2.y;
                if (dxS > rrS || dxS < -rrS || dyS > rrS || dyS < -rrS || dxS * dxS + dyS * dyS > rrS * rrS) continue;
                sh.hp -= (0.4 + bite * 0.35) * boost; sh.hitT = 4;
                if (sh.hp <= 0) {
                    mixSwapPop(shapes, i); Tanks.addShape();
                    this.wormXp(w2, SH.xp); w2.len += 3 + SH.xp * 0.15; S.shapeBroken++;
                    this.burst(sh.x, sh.y, w2.color, "spark", w2.human !== undefined ? "CRACK!" : "", 28);
                    if (w2.human !== undefined && typeof SFX !== "undefined") SFX.play("pickup", h2.x, h2.y, 0.5);
                }
            }
        }
        // ---- Agar.io blobs vs Diep.io blocks: big blobs crush/absorb them for mass; small blobs bounce & chip them
        for (let i = 0; i < blobs.length; i++) {
            var bs = blobs[i];
            if (bs.dead) continue;
            var brs = blobR[i];
            for (let j = shapes.length - 1; j >= 0; j--) {
                var sh = shapes[j], SH = TNK_SHAPES[sh.type], rrB = SH.r + brs;
                var dxB = sh.x - bs.x, dyB = sh.y - bs.y;
                if (dxB > rrB || dxB < -rrB || dyB > rrB || dyB < -rrB) continue;
                var d2B = dxB * dxB + dyB * dyB;
                if (d2B > rrB * rrB) continue;
                if (brs > SH.r * 1.15) {
                    sh.hp -= Math.max(1.5, bs.m * 0.08); sh.hitT = 4;
                } else {
                    var dB = Math.sqrt(d2B) || 1, overlap = rrB - dB;
                    bs.x -= (dxB / dB) * overlap * 0.5; bs.y -= (dyB / dB) * overlap * 0.5;
                    sh.vx = (sh.vx || 0) + (dxB / dB) * 1.2; sh.vy = (sh.vy || 0) + (dyB / dB) * 1.2;
                    sh.hp -= Math.max(0.4, bs.m * 0.03); sh.hitT = 4;
                }
                if (sh.hp <= 0) {
                    mixSwapPop(shapes, j); Tanks.addShape();
                    bs.m += Math.max(2, SH.xp * 0.4); blobR[i] = Cells.rad(bs.m); S.shapeBroken++;
                    this.burst(sh.x, sh.y, SH.col, "spark", bs.pl.human !== undefined ? "CRUSH!" : "", 28);
                    if (bs.pl.human !== undefined && typeof SFX !== "undefined") SFX.play("pickup", bs.x, bs.y, 0.5);
                }
            }
        }
        for (let j = 0; j < worms.length; j++) {
            var w2 = worms[j];
            if (!w2.alive || !w2.mx) continue;
            var h2 = w2.segs[0], wr2 = wormR[j], bite = w2.mx.st[0], boost = w2.boosting ? 2 : 1;
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
            if (w2.mx.biteCd <= 0) {
                for (let i = 0; i < blobs.length; i++) {
                    var bW = blobs[i];
                    if (bW.dead || Cells.protectedNow(bW.pl)) continue;
                    var rrBW = blobR[i] + wr2 * 0.7, dxBW = h2.x - bW.x, dyBW = h2.y - bW.y;
                    if (dxBW > rrBW || dxBW < -rrBW || dyBW > rrBW || dyBW < -rrBW || dxBW * dxBW + dyBW * dyBW > rrBW * rrBW) continue;
                    var biteDmg = (10 + bite * 5) * (boost > 1 ? 1.5 : 1);
                    bW.m -= biteDmg;
                    w2.mx.biteCd = 18; S.wormBite++; this.wormXp(w2, 4);
                    w2.len += Math.min(4, biteDmg * 0.15);
                    this.burst(bW.x, bW.y, w2.color, "spark", "BITE!", 30);
                    if (bW.m < 12) {
                        this._blobGone(blobs, bW, w2.name); anyDead = true;
                        this.wormXp(w2, 25);
                        this.note(w2.human !== undefined || bW.pl.human !== undefined, w2.name + " bit " + bW.pl.name, w2.color);
                    } else {
                        blobR[i] = Cells.rad(bW.m, bW);
                    }
                    break;
                }
            }
            // boosting worms pop open spikes into globs; non-boosting worms feed/push spikes
            if (!w2.mx.vFeedCd) {
                for (let v = viruses.length - 1; v >= 0; v--) {
                    var viW = viruses[v], vrW = Cells.rad(viW.m || 100) + wr2 + 6;
                    var vdxW = h2.x - viW.x, vdyW = h2.y - viW.y;
                    if (vdxW * vdxW + vdyW * vdyW < vrW * vrW) {
                        if (w2.boosting) {
                            Cells.popVirus(v);
                            this.wormXp(w2, 20);
                            w2.mx.vFeedCd = 18;
                            this.burst(viW.x, viW.y, "#4ade80", "ring", "SPIKE POP!", 65);
                            if (w2.human !== undefined && typeof SFX !== "undefined") SFX.play("pickup", h2.x, h2.y, 0.7);
                        } else if (w2.len > 22) {
                            var firedW = Cells.feedVirus(viW, Math.cos(w2.ang), Math.sin(w2.ang), 2);
                            w2.len = Math.max(12, w2.len - 2);
                            w2.mx.vFeedCd = 15;
                            this.burst(viW.x, viW.y, "#4ade80", firedW ? "ring" : "spark", firedW ? "SPIKE!" : "", firedW ? 55 : 22);
                        }
                        break;
                    }
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
                    b2.m += km; blobR[j] = Cells.rad(b2.m, b2); k.mixEaten = true; k.hp = 0; Tanks.hurt(k, 1, { name: b2.pl.name }); S.blobAteTank++;
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
                    } else if (!Cells.protectedNow(b2.pl) && (b2.pl.chain || k.st[2] > 0)) {
                        b2.m -= 0.8 + k.st[2] * 0.55;
                        if (b2.m < 12) {
                            Tanks.gainXp(k, 20);
                            this._blobGone(blobs, b2, k.name); anyDead = true;
                        } else {
                            blobR[j] = Cells.rad(b2.m, b2);
                        }
                    }
                }
            }
            for (let j = 0; j < tanks.length && k.alive; j++) {
                var o = tanks[j];
                if (o === k || !o.alive || o.inv > 0 || arenaProtected(o) || !(km > o.mixMass * 1.25)) continue;
                var limO = ks - tankS[j] * 0.4;
                if (limO <= 0) continue;
                var odx = o.x - kx, ody = o.y - ky;
                if (odx * odx + ody * ody < limO * odx * 0 + limO * limO) {
                    k.mixMass += o.mixMass; km = k.mixMass; ks = tankS[i] = Tanks.size(k);
                    o.mixEaten = true; o.hp = 0; Tanks.hurt(o, 1, k); S.tankAteTank++;
                    this.burst(o.x, o.y, k.color, "ring", "CRUSHED!", ks + 20);
                    this.note(k.human !== undefined || o.human !== undefined, k.name + " ate " + o.name, k.color);
                }
            }
        }
        // ---- flying Agar.io thrown mass damages snakes and snakes only
        for (let i = cp0.length - 1; i >= 0; i--) {
            var ep = cp0[i];
            if (!ep.ejected || ep._gone || (ep.vx * ep.vx + ep.vy * ep.vy <= 4)) continue;
            var hw = Snake.hitBody(ep.x, ep.y, 12, null);
            if (!hw || !hw.alive) continue;
            hw.len -= 4;
            if (hw.len < 10) Snake.kill(hw, null);
            ep._gone = true; ep.eaten = true; cpGone = true;
            this.burst(ep.x, ep.y, ep.col || "#fff", "spark", "HIT!", 26);
            if (hw.human !== undefined && typeof SFX !== "undefined") SFX.play("hit", ep.x, ep.y, 0.5);
        }
        // ---- a blob that touches a worm POPS less easily: requires deeper contact, medium blobs bounce, big blobs lose 15% into max 3 pieces
        for (let i = 0, n0 = blobs.length; i < n0; i++) {
            var b4 = blobs[i];
            if (b4.dead || b4.popCd > 0 || Cells.protectedNow(b4.pl)) { if (b4.popCd > 0) b4.popCd--; continue; }
            if (b4.x * b4.x + b4.y * b4.y > MIX_SNK_RING_SQ) continue;
            var r4 = blobR[i];
            var w4 = Snake.hitBody(b4.x, b4.y, r4 * 0.45, null);
            if (!w4 || !w4.alive) continue;
            S.blobPopped++;
            if (b4.m < 25) {                                                   // tiny blob: worm absorbs it whole
                w4.len += b4.m * 0.35; this.wormXp(w4, b4.m * 0.45);
                this.burst(b4.x, b4.y, w4.color, "spark", "+EAT", 28);
                this.note(b4.pl.human !== undefined || w4.human !== undefined, w4.name + " ate " + b4.pl.name, w4.color);
                this._blobGone(blobs, b4, w4.name); anyDead = true; continue;
            }
            var hd = w4.segs[0], adx = b4.x - hd.x, ady = b4.y - hd.y, away = Math.sqrt(adx * adx + ady * ady) || 1;
            var headEatDist = (wormR[worms.indexOf(w4)] || 14) + r4 * 0.85;
            if (!b4.pl.chain && b4.m <= Math.max(30, w4.len * 0.32) && adx * adx + ady * ady < headEatDist * headEatDist) {
                w4.len += b4.m * 0.35; this.wormXp(w4, b4.m * 0.5);
                this.burst(b4.x, b4.y, w4.color, "spark", "+EAT", 30);
                this.note(b4.pl.human !== undefined || w4.human !== undefined, w4.name + " ate " + b4.pl.name, w4.color);
                this._blobGone(blobs, b4, w4.name); anyDead = true; continue;
            }
            if (b4.m < 80) {                                                   // medium blobs bounce off, worm nibbles a bit for points
                var nib = Math.min(b4.m * 0.12, 7 + (w4.mx ? w4.mx.st[0] * 1.5 : 0));
                b4.m = Math.max(15, b4.m - nib); blobR[i] = Cells.rad(b4.m, b4);
                w4.len += nib * 0.35; this.wormXp(w4, nib * 0.45);
                b4.vx += adx / away * 8; b4.vy += ady / away * 8; b4.popCd = 30;
                continue;
            }
            if (b4.pl.chain && !b4.pl.compact) {
                var isHeadB = b4.pl.chainList && b4 === b4.pl.chainList[0];
                var wDmg = isHeadB ? Math.max(14, Math.round(b4.m * 0.22)) : Math.max(6, Math.round(b4.m * 0.08));
                w4.len -= wDmg;
                var orbs = Math.min(8, Math.max(3, Math.round(wDmg / 5)));
                var orbM = Math.max(4, Math.round(wDmg / orbs * 1.1));
                for (let oq = 0; oq < orbs; oq++) {
                    var oa = Math.random() * Math.PI * 2, osp = 4 + Math.random() * 6;
                    Cells.pellets.push({ x: b4.x + Math.cos(oa) * (r4 + 8), y: b4.y + Math.sin(oa) * (r4 + 8), m: orbM, col: w4.color || "#fde047", vx: Math.cos(oa) * osp, vy: Math.sin(oa) * osp });
                }
                b4.m += wDmg * 0.35; blobR[i] = Cells.rad(b4.m, b4); b4.popCd = 24;
                b4.vx += adx / away * 9; b4.vy += ady / away * 9;
                if (w4.len < 10) {
                    Snake.kill(w4, b4.pl);
                    this.burst(b4.x, b4.y, b4.pl.color, "ring", "SHRED!", r4 + 42);
                    this.note(b4.pl.human !== undefined || w4.human !== undefined, b4.pl.name + " shredded " + w4.name, b4.pl.color);
                } else {
                    this.burst(b4.x, b4.y, b4.pl.color, "ring", "-" + wDmg + " FOOD", r4 + 34);
                }
                continue;
            }
            var lost = b4.m * 0.15, left = b4.m - lost;
            w4.len += lost * 0.25; this.wormXp(w4, lost * 0.35);
            this.burst(b4.x, b4.y, "#a78bfa", "ring", "POP!", r4 + 35);
            var cap = (cellsCfg.maxCells > 0) ? cellsCfg.maxCells : Infinity;
            var pieces = Math.max(0, Math.min(cap - Cells.mine(b4.pl).length, 3)), each = left / (pieces + 1);
            for (let q = 0; q < pieces; q++) {
                var pa = q / pieces * Math.PI * 2;
                blobs.push({ pl: b4.pl, x: b4.x, y: b4.y, m: each, vx: Math.cos(pa) * 14, vy: Math.sin(pa) * 14, mergeT: 600, popCd: 240 });
                blobR[blobs.length - 1] = Cells.rad(each, blobs[blobs.length - 1]);
            }
            b4.m = each; blobR[i] = Cells.rad(each, b4); b4.mergeT = 600; b4.popCd = 240;
            b4.vx += adx / away * 10; b4.vy += ady / away * 10;
            this.note(b4.pl.human !== undefined || w4.human !== undefined, b4.pl.name + " popped on " + w4.name, w4.color);
            if (b4.pl.human !== undefined) screenShake = 6;
        }
        // ---- snakes gain points & length by eating/biting Agar.io blobs with their head
        for (let j = 0; j < worms.length; j++) {
            var wH = worms[j];
            if (!wH.alive || !wH.segs || !wH.segs.length) continue;
            var hH = wH.segs[0], wrH = wormR[j];
            if (hH.x * hH.x + hH.y * hH.y > MIX_SNK_RING_SQ) continue;
            for (let i = 0; i < blobs.length; i++) {
                var bH = blobs[i];
                if (bH.dead || bH.popCd > 0 || Cells.protectedNow(bH.pl)) continue;
                if (bH.pl.chain && !bH.pl.compact && !(bH.pl.snakeGrace > 0)) continue; // Bubble Worm body cuts off snakes below
                var hitH = wrH + blobR[i] * 0.85;
                var hdx = bH.x - hH.x, hdy = bH.y - hH.y;
                if (hdx * hdx + hdy * hdy >= hitH * hitH) continue;
                if (bH.m <= Math.max(35, wH.len * 0.35)) {
                    wH.len += bH.m * 0.35; this.wormXp(wH, bH.m * 0.5);
                    this.burst(bH.x, bH.y, wH.color, "spark", "+EAT", 30);
                    this.note(bH.pl.human !== undefined || wH.human !== undefined, wH.name + " ate " + bH.pl.name, wH.color);
                    this._blobGone(blobs, bH, wH.name); anyDead = true;
                } else {
                    var bite = Math.min(bH.m * 0.14, 10 + (wH.mx ? wH.mx.st[0] * 2 : 0));
                    bH.m = Math.max(15, bH.m - bite); blobR[i] = Cells.rad(bH.m, bH);
                    bH.popCd = 20;
                    wH.len += bite * 0.35; this.wormXp(wH, bite * 0.5);
                    this.burst(bH.x, bH.y, wH.color, "spark", "+BITE", 22);
                }
            }
        }
        // ---- snakes running head-first into bubble snakes die (with grace period if just activated / grew a lot)
        for (let j = 0; j < worms.length; j++) {
            var wS = worms[j];
            if (!wS.alive || wS.safeT > 0) continue;
            var hS = wS.segs[0], wrS = wormR[j] * 0.65;
            if (hS.x * hS.x + hS.y * hS.y > MIX_SNK_RING_SQ) continue;
            for (let i = 0; i < blobs.length; i++) {
                var bS = blobs[i];
                if (bS.dead || !bS.pl.chain || bS.pl.compact || (bS.pl.snakeGrace > 0) || Cells.protectedNow(bS.pl)) continue;
                var hitS = wrS + blobR[i] * 0.78;
                var sdx = hS.x - bS.x, sdy = hS.y - bS.y;
                if (sdx * sdx + sdy * sdy < hitS * hitS) {
                    var gain = Math.max(38, Math.round(wS.len * 0.55));
                    Snake.kill(wS, bS.pl);
                    bS.m += gain; blobR[i] = Cells.rad(bS.m, bS);
                    var dropN = Math.min(10, Math.max(4, Math.round(wS.len / 12)));
                    var dropM = Math.max(5, Math.round(gain * 0.14));
                    for (let oq = 0; oq < dropN; oq++) {
                        var oa = Math.random() * Math.PI * 2, osp = 4 + Math.random() * 6;
                        Cells.pellets.push({ x: hS.x, y: hS.y, m: dropM, col: wS.color || "#fde047", vx: Math.cos(oa) * osp, vy: Math.sin(oa) * osp });
                    }
                    this.burst(hS.x, hS.y, bS.pl.color, "ring", "+" + gain + " FOOD!", 54);
                    this.note(wS.human !== undefined || bS.pl.human !== undefined, wS.name + " crashed into " + bS.pl.name, bS.pl.color);
                    break;
                }
            }
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
                                if (fdx5 < rr5 && fdx5 > -rr5 && fdy5 < rr5 && fdy5 > -rr5) { w5.len += f.m * (f.fromSpike ? 0.2 : 0.4); f._gone = true; cpGone = true; S.crossFood++; }
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
        this.lanSync();
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

        var sideOpen = typeof SandboxUI !== "undefined" && SandboxUI.sideOpen;
        var lx = sideOpen ? 320 : 14;
        var menuOpen = typeof document !== "undefined" && document.getElementById("top-menu") && document.getElementById("top-menu").classList.contains("open");

        // Unified 3-in-1 Top-Left Header Card (compact status bar when side menu is open; includes quick-switch pills when side menu is closed)
        var name = MIX_BODIES[0][1];
        for (let i = 0; i < MIX_BODIES.length; i++) if (MIX_BODIES[i][0] === mixCfg.body) { name = MIX_BODIES[i][1]; break; }
        var liveStat = "Spectating / Respawning", subStat = "Best: " + (mixSave.best[mixCfg.body] || 0);
        if (m && m.alive) {
            if (m.kind === "tank") {
                liveStat = (m.ref.name || "Tank") + " · Lv " + m.ref.lvl + " " + TNK_CLASSES[m.ref.cls].name + " · Score " + m.ref.score;
                subStat = "Mass " + Math.round(this.tankMass(m.ref)) + " · Best " + (mixSave.best.tank || 0) + " · Q switch body · V swap bot";
            } else if (m.kind === "blob") {
                var bm = Math.round(Cells.mass(m.ref));
                if (mixCfg.body === "chain" && m.ref.chainList) {
                    var bc = m.ref.chainList.length;
                    liveStat = (m.ref.name || "Bubble") + " · Mass " + bm + " · " + bc + (bc === 1 ? " bubble" : " bubbles");
                    subStat = (m.ref.compact ? "Compact Bubble [W: Snake]" : "Bubble Snake [W: Compact]") + " · Best " + (mixSave.best.chain || 0);
                } else {
                    var mc = Cells.mine(m.ref).length;
                    liveStat = (m.ref.name || "Blob") + " · Mass " + bm + " · " + mc + (mc === 1 ? " cell" : " cells");
                    subStat = "Best " + (mixSave.best.blob || 0) + " · Space split · W eject · Q body · V swap";
                }
            } else if (m.kind === "worm") {
                var X = m.ref.mx;
                liveStat = (m.ref.name || "Worm") + " · Len " + Math.round(m.ref.len) + (X ? " · Lv " + X.lvl : "");
                subStat = "Best " + (mixSave.best.worm || 0) + (X ? " · Bite " + X.st[0] + " · Armor " + X.st[1] + " · Appetite " + X.st[2] : "") + " · Q body · V swap";
            }
        }

        // Clickable quick-switch body pills (cached per active body & lx)
        var pillsKey = mixCfg.body + ":" + lx;
        if (!this._pillsCanvas || this._pillsBody !== pillsKey) {
            this._pillsBody = pillsKey;
            this._pills.length = 0;
            var pc = this._pillsCanvas || (this._pillsCanvas = document.createElement("canvas"));
            pc.width = 430; pc.height = 28;
            var pg = pc.getContext("2d");
            pg.clearRect(0, 0, 430, 28);
            var px = 0;
            for (let i = 0; i < MIX_BODIES.length; i++) {
                var bd = MIX_BODIES[i], active = bd[0] === mixCfg.body;
                var lbl = bd[0] === "chain" ? "📿 Bubble" : bd[1];
                var pw = Math.round(lbl.length * 7.0 + 18);
                pg.fillStyle = active ? "rgba(253,224,71,0.28)" : "rgba(15,23,42,0.82)";
                pg.strokeStyle = active ? "#fde047" : "rgba(148,163,184,0.4)";
                pg.lineWidth = active ? 1.8 : 1;
                pg.beginPath(); pg.roundRect(px + 1, 2, pw, 23, 6); pg.fill(); pg.stroke();
                pg.font = (active ? "800 " : "700 ") + "11px system-ui, sans-serif";
                pg.textAlign = "center";
                pg.fillStyle = active ? "#fef08a" : "#cbd5e1";
                pg.fillText(lbl, px + 1 + pw * 0.5, 17);
                this._pills.push({ id: bd[0], x: lx + 12 + px, y: 68, w: pw, h: 23 });
                px += pw + 6;
            }
            var swLbl = "🔄 Swap [V]", swW = Math.round(swLbl.length * 6.6 + 16);
            pg.fillStyle = "rgba(56,189,248,0.22)";
            pg.strokeStyle = "#38bdf8";
            pg.lineWidth = 1.4;
            pg.beginPath(); pg.roundRect(px + 1, 2, swW, 23, 6); pg.fill(); pg.stroke();
            pg.font = "800 11px system-ui, sans-serif";
            pg.textAlign = "center";
            pg.fillStyle = "#bae6fd";
            pg.fillText(swLbl, px + 1 + swW * 0.5, 17);
            this._swapPill = { id: "_swap", x: lx + 12 + px, y: 68, w: swW, h: 23 };
        }

        if (sideOpen) {
            // Side menu already shows the body switcher buttons — only draw a sleek status badge here!
            uiPanel(lx, 10, 420, 52, "#fde047", 0.86);
            uiText("🌀 ARENA MIX", lx + 14, 32, 16, "#fde047", "left", "900");
            uiText(liveStat, lx + 406, 32, 12, "#f8fafc", "right", "800");
            uiText(subStat, lx + 14, 50, 11, "#cbd5e1", "left", "700");
        } else {
            uiPanel(lx, 10, 446, 94, "#fde047", 0.88);
            uiText("🌀 ARENA MIX", lx + 14, 34, 18, "#fde047", "left", "900");
            uiText(liveStat, lx + 432, 33, 12, "#f8fafc", "right", "800");
            uiText(subStat, lx + 14, 54, 11, "#cbd5e1", "left", "700");
            ctx.drawImage(this._pillsCanvas, lx + 12, 66);
        }

        // Interactive Worm Upgrade Pills at bottom-left when playing as a worm with unspent points
        this._wormRects = [];
        var logStartY = 122;
        if (m && m.alive && m.kind === "worm" && m.ref.mx && m.ref.mx.pts > 0) {
            var WX = m.ref.mx, wy = cssH - 74;
            uiPanel(lx, wy, 368, 36, "#f472b6", 0.92);
            uiText("+" + WX.pts + " UPGRADE:", lx + 12, wy + 22, 11, "#fbcfe8", "left", "900");
            var wLabels = ["[1] 🦷 Bite (" + WX.st[0] + ")", "[2] 🛡 Armor (" + WX.st[1] + ")", "[3] 🧲 Appetite (" + WX.st[2] + ")"];
            var wx = lx + 94;
            for (let wi = 0; wi < 3; wi++) {
                var ww = 85;
                ctx.fillStyle = "rgba(244,114,182,0.25)";
                ctx.strokeStyle = "#f472b6";
                ctx.lineWidth = 1.3;
                ctx.beginPath(); ctx.roundRect(wx, wy + 6, ww, 24, 6); ctx.fill(); ctx.stroke();
                uiText(wLabels[wi], wx + ww * 0.5, wy + 22, 10, "#fdf2f8", "center", "800");
                this._wormRects.push({ idx: wi, x: wx, y: wy + 6, w: ww, h: 24 });
                wx += ww + 6;
            }
        }

        // Unified 3-in-1 Combined Leaderboard on the right (auto-hidden when #top-menu is open)
        if (!menuOpen) {
            var allEntries = [];
            for (let i = 0; i < Tanks.tanks.length; i++) {
                var tk = Tanks.tanks[i];
                if (!tk.alive) continue;
                allEntries.push({ icon: "🛡", name: tk.name || "Tank", val: Math.max(tk.score || 0, Math.round(this.tankMass(tk))), col: tk.color || "#60a5fa", human: tk.human !== undefined });
            }
            for (let i = 0; i < Cells.players.length; i++) {
                var cp = Cells.players[i];
                if (!cp.alive) continue;
                allEntries.push({ icon: cp.chain ? "📿" : "🫧", name: cp.name || "Blob", val: Math.round(Cells.mass(cp)), col: cp.color || "#c084fc", human: cp.human !== undefined });
            }
            for (let i = 0; i < Snake.worms.length; i++) {
                var sw2 = Snake.worms[i];
                if (!sw2.alive) continue;
                allEntries.push({ icon: "🪱", name: sw2.name || "Worm", val: Math.round(sw2.len), col: sw2.color || "#f472b6", human: sw2.human !== undefined });
            }
            allEntries.sort(function(a, b) { return b.val - a.val; });
            var lbRows = allEntries.slice(0, 8);
            for (let i = 8; i < allEntries.length; i++) {
                if (allEntries[i].human) { allEntries[i].rank = i + 1; lbRows.push(allEntries[i]); }
            }
            uiPanel(cssW - 220, 64, 206, 32 + lbRows.length * 18, "#fde047", 0.85);
            uiText("3-IN-1 LEADERBOARD", cssW - 117, 84, 12, "#fde047", "center", "900");
            for (let i = 0; i < lbRows.length; i++) {
                var row = lbRows[i];
                var rk = row.rank || (i + 1);
                uiText(rk + ". " + row.icon + " " + row.name, cssW - 208, 104 + i * 18, 12, row.human ? "#fde047" : row.col, "left", row.human ? "900" : "700");
                uiText(String(row.val), cssW - 24, 104 + i * 18, 12, "#e2e8f0", "right", "800");
            }
        }

        var lw = 0;
        for (let i = 0; i < this.log.length; i++) {
            var L = this.log[i]; L.t--;
            if (L.t <= 0) continue;
            ctx.globalAlpha = Math.min(1, L.t / 60);
            uiText(L.text, lx + 12, logStartY + lw * 18, 12, L.col, "left", "800");
            ctx.globalAlpha = 1;
            this.log[lw++] = L;
        }
        this.log.length = lw;
        this.drawRadar(m);

        // Single clean bottom control bar tailored to your current body
        ctx.fillStyle = "rgba(15,23,42,0.84)";
        ctx.fillRect(0, cssH - 30, cssW, 30);
        var bHint = "WASD move · Mouse aim & shoot · E autofire · 1-8 upgrades · Q switch body · V swap bot · Esc menu";
        if (mixCfg.body === "blob") bHint = "Mouse steers · Space split · W eject mass (feeds spikes!) · Q switch body · V swap bot · Esc menu";
        else if (mixCfg.body === "chain") bHint = "Mouse steers · Hold Space boost · W toggle Snake/Bubble form · Q switch body · V swap bot · Esc menu";
        else if (mixCfg.body === "worm") bHint = "Mouse steers · Hold Click/Space boost · 1/2/3 upgrade Bite/Armor/Appetite · Q switch body · V swap bot";
        uiText(bHint, cssW / 2, cssH - 11, 12, "rgba(226,232,240,0.9)", "center", "700");
    },

    nextBody: function(dir) {
        var i = MIX_BODIES.findIndex(function(b) { return b[0] === mixCfg.body; });
        this.setBody(MIX_BODIES[(i + (dir || 1) + MIX_BODIES.length) % MIX_BODIES.length][0]);
        showBanner("You are a " + MIX_BODIES.find(function(b) { return b[0] === mixCfg.body; })[1].replace(/^\S+\s/, "").toUpperCase(), "", "#fde047");
    },

    swapCharacter: function() {
        var pool = [];
        for (let i = 0; i < Tanks.tanks.length; i++) if (Tanks.tanks[i].alive) pool.push({ kind: "tank", ref: Tanks.tanks[i], x: Tanks.tanks[i].x, y: Tanks.tanks[i].y });
        for (let i = 0; i < Cells.players.length; i++) if (Cells.players[i].alive) {
            var cp = Cells.players[i], hd = cp.chain && cp.chainList && cp.chainList[0];
            pool.push({ kind: cp.chain ? "chain" : "blob", ref: cp, x: hd ? hd.x : (cp.cx || 0), y: hd ? hd.y : (cp.cy || 0) });
        }
        for (let i = 0; i < Snake.worms.length; i++) if (Snake.worms[i].alive) pool.push({ kind: "worm", ref: Snake.worms[i], x: Snake.worms[i].segs[0].x, y: Snake.worms[i].segs[0].y });

        var cur = pool.find(function(it) { return it.ref.human === 0; });
        var lanPeer = pool.find(function(it) { return it.ref.human === "lan"; });
        var next = null;
        if (lanPeer && cur && lanPeer !== cur) {
            // Swap P1 and LAN P2
            var pPid = lanPeer.ref.pid, pName = lanPeer.ref.name, pCol = lanPeer.ref.color;
            var cName = cur.ref.name, cCol = cur.ref.color;
            cur.ref.human = "lan"; cur.ref.pid = pPid; cur.ref.name = pName; cur.ref.color = pCol;
            lanPeer.ref.human = 0; lanPeer.ref.pid = undefined; lanPeer.ref.name = cName; lanPeer.ref.color = cCol;
            if (typeof Net !== "undefined" && Net.peers && Net.peers[pPid]) {
                Net.peers[pPid].mixBody = cur.kind;
                if (Net.peers[pPid].inp && Net.peers[pPid].inp.x) delete Net.peers[pPid].inp.x.body;
            }
            next = lanPeer;
        } else {
            var others = pool.filter(function(it) { return it.ref.human !== 0; });
            if (!others.length) return false;
            this._swapIdx = ((this._swapIdx || 0) + 1) % others.length;
            next = others[this._swapIdx];
            if (cur) cur.ref.human = undefined;
            next.ref.human = 0;
        }
        mixCfg.body = next.kind;
        this._pillsBody = null;
        this.cam.x = next.x; this.cam.y = next.y;
        this.burst(next.x, next.y, "#38bdf8", "ring", "SWAP!", 75);
        showBanner("SWAPPED", "Now controlling " + (next.ref.name || next.kind), "#38bdf8");
        return true;
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
    screenDraw: function() {
        Mix.t++;
        var now = performance.now();
        var m = Mix.me(), c = Cells.cam;
        // 1. Local bullet motion & hit feedback (shapes, tanks, blobs)
        for (let i = Tanks.bullets.length - 1; i >= 0; i--) {
            var b = Tanks.bullets[i];
            if (b.vx || b.vy) { b.x += b.vx; b.y += b.vy; }
            if (b._hit) { Tanks.bullets.splice(i, 1); continue; }
            for (let j = 0; j < Tanks.shapes.length; j++) {
                var q = Tanks.shapes[j], sr = (TNK_SHAPES[q.type] ? TNK_SHAPES[q.type].r : 18);
                if (Math.abs(b.x - q.x) < sr + b.r && Math.abs(b.y - q.y) < sr + b.r && Math.hypot(b.x - q.x, b.y - q.y) < sr + b.r) {
                    b._hit = true; q.hitT = 4; q.hp = Math.max(0, q.hp - (b.dmg || 5));
                    if (typeof Components !== "undefined") Components.spawnSparks(b.x, b.y, "#fde047", 4);
                    break;
                }
            }
            if (!b._hit) {
                for (let j = 0; j < Tanks.tanks.length; j++) {
                    var tk = Tanks.tanks[j];
                    if (!tk.alive || tk === b.owner) continue;
                    var tr = Tanks.size ? Tanks.size(tk) : 22;
                    if (Math.hypot(b.x - tk.x, b.y - tk.y) < tr + b.r) {
                        b._hit = true; tk.flash = 4;
                        if (typeof Components !== "undefined") Components.spawnSparks(b.x, b.y, tk.color || "#fff", 4);
                        break;
                    }
                }
            }
            if (!b._hit) {
                for (let j = 0; j < Cells.blobs.length; j++) {
                    var bl0 = Cells.blobs[j];
                    if (bl0.dead) continue;
                    var br0 = Cells.rad(bl0.m);
                    if (Math.hypot(b.x - bl0.x, b.y - bl0.y) < br0 + b.r) {
                        b._hit = true;
                        if (typeof Components !== "undefined") Components.spawnSparks(b.x, b.y, bl0.pl ? bl0.pl.color : "#fff", 4);
                        break;
                    }
                }
            }
            if (b._hit) Tanks.bullets.splice(i, 1);
        }
        // 2. Glide remote tanks, blobs, and worms toward their latest snapshot targets
        for (let i = 0; i < Tanks.tanks.length; i++) {
            var k = Tanks.tanks[i];
            if (k.flash > 0) k.flash--;
            if (!k.alive || (m && m.ref === k) || k._tx === undefined) continue;
            k.x += (k._tx - k.x) * 0.45; k.y += (k._ty - k.y) * 0.45;
            k.ang += Math.atan2(Math.sin(k._ta - k.ang), Math.cos(k._ta - k.ang)) * 0.45;
        }
        for (let i = 0; i < Tanks.shapes.length; i++) if (Tanks.shapes[i].hitT > 0) Tanks.shapes[i].hitT--;
        for (let i = 0; i < Cells.blobs.length; i++) {
            var bl = Cells.blobs[i];
            if (bl.dead || (m && bl.pl === m.ref) || bl.tx === undefined) continue;
            bl.x += (bl.tx - bl.x) * 0.45; bl.y += (bl.ty - bl.y) * 0.45;
        }
        for (let i = 0; i < Snake.worms.length; i++) {
            var w = Snake.worms[i];
            if (!w.alive || (m && m.ref === w) || w._tx === undefined || !w.segs[0]) continue;
            w.segs[0].x += (w._tx - w.segs[0].x) * 0.45; w.segs[0].y += (w._ty - w.segs[0].y) * 0.45;
        }
        // 3. Local player prediction + local interactions (shooting, food eating, shape bounce, segment follow)
        var markEaten = function(list, x, y) {
            if (list.length > 200) list.shift();
            list.push([x, y, now + 260]);
        };
        if (m && m.alive) {
            if (m.kind === "tank") {
                var sc = Tanks.toScreen(m.x, m.y);
                m.ref.ang = Math.atan2(mouseY - sc[1], mouseX - sc[0]);
                var mx = (WASDrightPressed ? 1 : 0) - (WASDleftPressed ? 1 : 0), my = (WASDdownPressed ? 1 : 0) - (WASDupPressed ? 1 : 0);
                if (mx || my) {
                    var sp = 3.2 + (m.ref.st ? m.ref.st[7] * 0.45 : 0), len = Math.hypot(mx, my) || 1;
                    m.ref.x += (mx / len) * sp; m.ref.y += (my / len) * sp;
                }
                if (m.ref._tx !== undefined) {
                    var dt = Math.hypot(m.ref._tx - m.ref.x, m.ref._ty - m.ref.y);
                    if (dt >= 120) { m.ref.x = m.ref._tx; m.ref.y = m.ref._ty; }
                    else if (dt > 8) { m.ref.x += (m.ref._tx - m.ref.x) * 0.12; m.ref.y += (m.ref._ty - m.ref.y) * 0.12; }
                }
                // Local predicted shooting
                m.ref._localCd = Math.max(0, (m.ref._localCd || 0) - 1);
                if ((mouseDown || SpacePressed) && m.ref._localCd <= 0 && typeof TNK_CLASSES !== "undefined") {
                    var cls = TNK_CLASSES[m.ref.cls] || TNK_CLASSES.tank;
                    var st = m.ref.st || [0,0,0,0,0,0,0,0];
                    m.ref._localCd = Math.max(6, Math.round((24 - st[6] * 2) * (cls.reload || 1)));
                    var ks0 = Tanks.size ? Tanks.size(m.ref) : 22;
                    var bsp = 7.5 + st[3] * 0.7, bdmg = (5 + st[4] * 2.2) * (cls.dmg || 1);
                    var bars = cls.b || [{ a: 0, off: 0, len: 1, w: 1 }];
                    for (let bi = 0; bi < bars.length; bi++) {
                        var B = bars[bi], ang = m.ref.ang + (B.a || 0);
                        var bw = ks0 * 0.42 * (B.w || 1), blen = ks0 * 1.15 * (B.len || 1);
                        var ox = Math.cos(m.ref.ang + 1.57) * ((B.off || 0) * ks0 / 30), oy = Math.sin(m.ref.ang + 1.57) * ((B.off || 0) * ks0 / 30);
                        Tanks.bullets.push({
                            x: m.ref.x + ox + Math.cos(ang) * blen, y: m.ref.y + oy + Math.sin(ang) * blen,
                            vx: Math.cos(ang) * bsp, vy: Math.sin(ang) * bsp, r: bw * 0.65,
                            owner: m.ref, dmg: bdmg, _pred: true, _born: now
                        });
                    }
                    if (typeof SFX !== "undefined") SFX.play("shoot", m.ref.x, m.ref.y, 0.2);
                }
                // Local tank vs shape knockback & local food eating
                var ks = Tanks.size ? Tanks.size(m.ref) : 22;
                for (let i = 0; i < Tanks.shapes.length; i++) {
                    var q = Tanks.shapes[i], sr = TNK_SHAPES[q.type] ? TNK_SHAPES[q.type].r : 18;
                    var dx = m.ref.x - q.x, dy = m.ref.y - q.y, d = Math.hypot(dx, dy);
                    if (d > 0 && d < ks + sr) {
                        var push = (ks + sr - d) * 0.5;
                        m.ref.x += dx / d * push; m.ref.y += dy / d * push;
                        q.hitT = 3;
                    }
                }
                var ce = Cells._eatenPellets || (Cells._eatenPellets = []), se = Snake._eatenPellets || (Snake._eatenPellets = []);
                for (let i = Cells.pellets.length - 1; i >= 0; i--) {
                    var f = Cells.pellets[i];
                    if (Math.abs(f.x - m.ref.x) < ks + 6 && Math.abs(f.y - m.ref.y) < ks + 6 && Math.hypot(f.x - m.ref.x, f.y - m.ref.y) < ks + 6) {
                        markEaten(ce, f.x, f.y); Cells.pellets.splice(i, 1);
                    }
                }
                for (let i = Snake.pellets.length - 1; i >= 0; i--) {
                    var g = Snake.pellets[i];
                    if (Math.abs(g.x - m.ref.x) < ks + 6 && Math.abs(g.y - m.ref.y) < ks + 6 && Math.hypot(g.x - m.ref.x, g.y - m.ref.y) < ks + 6) {
                        markEaten(se, g.x, g.y); Snake.pellets.splice(i, 1);
                    }
                }
            } else if (m.kind === "blob") {
                var ax = (mouseX - cssW / 2) / c.z + c.x, ay = (mouseY - cssH / 2) / c.z + c.y;
                m.ref.aimX = ax; m.ref.aimY = ay;
                var ce = Cells._eatenPellets || (Cells._eatenPellets = []), se = Snake._eatenPellets || (Snake._eatenPellets = []);
                var myBlobs = [];
                for (let i = 0; i < Cells.blobs.length; i++) {
                    var mb = Cells.blobs[i];
                    if (mb.dead || mb.pl !== m.ref) continue;
                    myBlobs.push(mb);
                    var dx = ax - mb.x, dy = ay - mb.y, d = Math.hypot(dx, dy);
                    if (d > 6) { var s = Math.min(3.4, d * 0.12); mb.x += dx / d * s; mb.y += dy / d * s; }
                    if (mb.tx !== undefined) {
                        var db = Math.hypot(mb.tx - mb.x, mb.ty - mb.y);
                        if (db >= 120) { mb.x = mb.tx; mb.y = mb.ty; }
                        else if (db > 8) { mb.x += (mb.tx - mb.x) * 0.12; mb.y += (mb.ty - mb.y) * 0.12; }
                    }
                    var mr = Cells.rad(mb.m);
                    for (let j = Cells.pellets.length - 1; j >= 0; j--) {
                        var f = Cells.pellets[j];
                        if (mb.m > f.m * 1.25 && Math.abs(f.x - mb.x) < mr && Math.abs(f.y - mb.y) < mr && Math.hypot(f.x - mb.x, f.y - mb.y) < mr) {
                            mb.m += f.m; markEaten(ce, f.x, f.y); Cells.pellets.splice(j, 1);
                        }
                    }
                    for (let j = Snake.pellets.length - 1; j >= 0; j--) {
                        var g = Snake.pellets[j];
                        if (Math.abs(g.x - mb.x) < mr && Math.abs(g.y - mb.y) < mr && Math.hypot(g.x - mb.x, g.y - mb.y) < mr) {
                            mb.m += (g.v || 1) * 0.35; markEaten(se, g.x, g.y); Snake.pellets.splice(j, 1);
                        }
                    }
                }
                if (m.ref.chain && myBlobs.length > 1) {
                    for (let i = 1; i < myBlobs.length; i++) {
                        var seg = myBlobs[i], ld = seg.lead || myBlobs[i - 1];
                        if (!ld) continue;
                        var sdx = ld.x - seg.x, sdy = ld.y - seg.y, sd = Math.hypot(sdx, sdy);
                        var wantD = (Cells.rad(ld.m) + Cells.rad(seg.m)) * 0.75;
                        if (sd > wantD) { seg.x += (sdx / sd) * (sd - wantD) * 0.55; seg.y += (sdy / sd) * (sd - wantD) * 0.55; }
                    }
                }
            } else if (m.kind === "worm") {
                var scW = Tanks.toScreen(m.x, m.y), ta = Math.atan2(mouseY - scW[1], mouseX - scW[0]);
                var da = Math.atan2(Math.sin(ta - m.ref.ang), Math.cos(ta - m.ref.ang));
                m.ref.ang += Math.max(-0.14, Math.min(0.14, da));
                var wsp = (mouseDown || SpacePressed || WASDupPressed) ? 5.2 : 3.2;
                m.ref.segs[0].x += Math.cos(m.ref.ang) * wsp; m.ref.segs[0].y += Math.sin(m.ref.ang) * wsp;
                if (m.ref._tx !== undefined) {
                    var dw = Math.hypot(m.ref._tx - m.ref.segs[0].x, m.ref._ty - m.ref.segs[0].y);
                    if (dw >= 120) { m.ref.segs[0].x = m.ref._tx; m.ref.segs[0].y = m.ref._ty; }
                    else if (dw > 8) { m.ref.segs[0].x += (m.ref._tx - m.ref.segs[0].x) * 0.12; m.ref.segs[0].y += (m.ref._ty - m.ref.segs[0].y) * 0.12; }
                }
                // Local worm body segment following
                for (let i = 1; i < m.ref.segs.length; i++) {
                    var prev = m.ref.segs[i - 1], cur = m.ref.segs[i];
                    var dx = prev.x - cur.x, dy = prev.y - cur.y, d = Math.hypot(dx, dy);
                    if (d > 5.5) { cur.x = prev.x - dx / d * 5.5; cur.y = prev.y - dy / d * 5.5; }
                }
                // Local worm food eating
                var wh = m.ref.segs[0], wr = 18;
                var se = Snake._eatenPellets || (Snake._eatenPellets = []), ce = Cells._eatenPellets || (Cells._eatenPellets = []);
                for (let i = Snake.pellets.length - 1; i >= 0; i--) {
                    var g = Snake.pellets[i];
                    if (Math.abs(g.x - wh.x) < wr && Math.abs(g.y - wh.y) < wr && Math.hypot(g.x - wh.x, g.y - wh.y) < wr) {
                        m.ref.len += g.v || 1; markEaten(se, g.x, g.y); Snake.pellets.splice(i, 1);
                    }
                }
                for (let i = Cells.pellets.length - 1; i >= 0; i--) {
                    var f = Cells.pellets[i];
                    if (Math.abs(f.x - wh.x) < wr && Math.abs(f.y - wh.y) < wr && Math.hypot(f.x - wh.x, f.y - wh.y) < wr) {
                        m.ref.len += (f.m || 1) * 0.4; markEaten(ce, f.x, f.y); Cells.pellets.splice(i, 1);
                    }
                }
            }
        }
        Mix.draw();
    },
    netInput: function() {
        var m = Mix.me(), c = Cells.cam;
        var x = {
            mx: (WASDrightPressed ? 1 : 0) - (WASDleftPressed ? 1 : 0),
            my: (WASDdownPressed ? 1 : 0) - (WASDupPressed ? 1 : 0),
            f: (mouseDown || SpacePressed) ? 1 : 0,
            ax: Math.round((mouseX - cssW / 2) / c.z + c.x),
            ay: Math.round((mouseY - cssH / 2) / c.z + c.y),
            s: SpacePressed ? 1 : 0,
            e: WASDupPressed ? 1 : 0,
            c: mouseDown ? 1 : 0,
            b: (mouseDown || SpacePressed || WASDupPressed) ? 1 : 0
        };
        if (m && m.alive) {
            var sc = Tanks.toScreen(m.x, m.y);
            x.a = Math.round(Math.atan2(mouseY - sc[1], mouseX - sc[0]) * 100) / 100;
        }
        if (Mix._lanBody) x.body = Mix._lanBody;
        if (Mix._lanWs) x.ws = Mix._lanWs;
        if (Mix._lanTs) x.ts = Mix._lanTs;
        if (Mix._lanTc) x.tc = Mix._lanTc;
        return x;
    },
    netState: function() {
        var tMode = GameModes.get("tanks"), cMode = GameModes.get("cells"), sMode = GameModes.get("snake");
        var wx = {};
        for (let i = 0; i < Snake.worms.length; i++) {
            var w = Snake.worms[i];
            if (w.human === "lan" && w.pid && w.mx) wx[w.pid] = [w.mx.lvl, w.mx.pts, w.mx.st[0], w.mx.st[1], w.mx.st[2]];
        }
        var lgArr = Mix.log.slice(0, 4).map(function(L) { return [L.text, L.col]; });
        var lgKey = JSON.stringify(lgArr);
        var full = typeof Net !== "undefined" && Net.isFullSnap;
        var out = {
            t: tMode && tMode.netState ? tMode.netState() : null,
            c: cMode && cMode.netState ? cMode.netState() : null,
            s: sMode && sMode.netState ? sMode.netState() : null,
            mm: Tanks.tanks.map(function(k) { return Math.round(k.mixMass || 36); }),
            cp: Cells.players.map(function(p) { return p.chain ? 1 : 0; }),
            wx: wx
        };
        if (Mix._netFx && Mix._netFx.length) { out.fx = Mix._netFx.slice(); Mix._netFx.length = 0; }
        if (full || Mix._lastLgKey !== lgKey) { Mix._lastLgKey = lgKey; out.lg = lgArr; }
        return out;
    },
    applyNetState: function(m) {
        if (!m) return;
        var tMode = GameModes.get("tanks"), cMode = GameModes.get("cells"), sMode = GameModes.get("snake");
        if (m.t && tMode && tMode.applyNetState) tMode.applyNetState(m.t);
        if (m.c && cMode && cMode.applyNetState) cMode.applyNetState(m.c);
        if (m.s && sMode && sMode.applyNetState) sMode.applyNetState(m.s);
        if (m.mm) for (let i = 0; i < Tanks.tanks.length && i < m.mm.length; i++) Tanks.tanks[i].mixMass = m.mm[i];
        if (m.cp) for (let i = 0; i < Cells.players.length && i < m.cp.length; i++) Cells.players[i].chain = !!m.cp[i];
        if (m.wx) for (let i = 0; i < Snake.worms.length; i++) {
            var w = Snake.worms[i], q = w.pid && m.wx[w.pid];
            if (q) w.mx = { lvl: q[0], pts: q[1], st: [q[2], q[3], q[4]], biteCd: 0, vFeedCd: 0 };
        }
        var me = Mix.me();
        if (me) {
            var bk = me.kind === "blob" ? (me.ref.chain ? "chain" : "blob") : me.kind;
            mixCfg.body = bk;
            if (Mix._lanBody === bk) Mix._lanBody = null;
            var meKey = bk + ":" + (me.ref.id || 0);
            if (me.alive && (Mix._lastMeKey !== meKey || Math.hypot(me.x - Mix.cam.x, me.y - Mix.cam.y) > 900)) {
                Mix.cam.x = me.x; Mix.cam.y = me.y;
            }
            Mix._lastMeKey = meKey;
        }
        if (m.fx) for (let i = 0; i < m.fx.length; i++) {
            var f = m.fx[i];
            Mix.burst(f[0], f[1], f[2], f[3], f[4], f[5]);
        }
        if (m.lg && m.lg.length) Mix.log = m.lg.map(function(L) { return { text: L[0], col: L[1], t: 180 }; });
    },

    tunables: function() {
        return [
            { label: "Play as", type: "choice", localOnly: true, options: MIX_BODIES, get: function() { return mixCfg.body; }, set: function(v) {
                if (typeof Net !== "undefined" && Net.role === "client") { Mix._lanBody = String(v); mixCfg.body = String(v); }
                else Mix.setBody(String(v));
            } }
        ].concat(arenaRows(), [
            { label: "CPU tanks", type: "range", min: 0, max: 14, step: 1, get: function() { return TNK.CPUS; }, set: function(v) { TNK.CPUS = v; }, note: "next arena" },
            { label: "CPU blobs", type: "range", min: 0, max: 40, step: 1, get: function() { return cellsCfg.bots; }, set: function(v) { cellsCfg.bots = v; saveCellsCfg(); }, note: "changes live" },
            { label: "Max bubbles per player (0 = unlimited)", type: "range", min: 0, max: 64, step: 1, get: function() { return cellsCfg.maxCells || 0; }, set: function(v) { cellsCfg.maxCells = v; saveCellsCfg(); }, note: "0 = no limit" },
            { label: "Max snake bubbles per snake", type: "range", min: 2, max: 60, step: 1, get: function() { return cellsCfg.maxChainBubbles || 20; }, set: function(v) { cellsCfg.maxChainBubbles = v; saveCellsCfg(); } },
            { label: "CPU worms", type: "range", min: 0, max: 20, step: 1, get: function() { return SNK.CPUS; }, set: function(v) { SNK.CPUS = v; }, note: "next arena" }
        ]);
    },
    onKey: function(code) {
        if (typeof Net !== "undefined" && Net.role === "client") {
            if (code === "KeyV" || code === "BracketRight") { Net.send({ t: "sb", act: { k: "swap" } }); return true; }
            if (code === "KeyQ") {
                var i = MIX_BODIES.findIndex(function(b) { return b[0] === mixCfg.body; });
                var nb = MIX_BODIES[(i + 1 + MIX_BODIES.length) % MIX_BODIES.length][0];
                Mix._lanBody = nb; mixCfg.body = nb;
                return true;
            }
            if (mixCfg.body === "worm") {
                var wi = ["Digit1", "Digit2", "Digit3"].indexOf(code);
                if (wi >= 0) { Mix._lanWs = ((Mix._lanWs || 0) - ((Mix._lanWs || 0) % 10)) + 10 + (wi + 1); return true; }
            }
            if (mixCfg.body === "tank") {
                var tm = /^Digit([1-8])$/.exec(code);
                if (tm) { Mix._lanTs = ((Mix._lanTs || 0) - ((Mix._lanTs || 0) % 10)) + 10 + Number(tm[1]); return true; }
                var ci = ["KeyU", "KeyI", "KeyO", "KeyP"].indexOf(code);
                var mTk = Mix.me();
                if (ci >= 0 && mTk && mTk.kind === "tank" && mTk.ref.choose) {
                    Mix._lanTc = ((Mix._lanTc || 0) - ((Mix._lanTc || 0) % 10)) + 10 + (ci + 1);
                    return true;
                }
            }
            return false;
        }
        if (code === "KeyV" || code === "BracketRight") { return Mix.swapCharacter(); }
        if (code === "KeyQ") { Mix.nextBody(1); return true; }
        if (mixCfg.body === "worm") { var wi = ["Digit1", "Digit2", "Digit3"].indexOf(code), me = Mix.me(); if (wi >= 0 && me && me.alive) { Mix.wormStat(me.ref, wi); return true; } }
        if (mixCfg.body === "tank") { var tk = GameModes.get("tanks"); if (tk && tk.onKey) return tk.onKey(code); }
        return false;
    },
    onClick: function(wx, wy, button) {
        if (button === 0 && typeof mouseX === "number" && typeof mouseY === "number") {
            var sp = Mix._swapPill;
            if (sp && mouseX >= sp.x && mouseX <= sp.x + sp.w && mouseY >= sp.y && mouseY <= sp.y + sp.h) {
                if (typeof Net !== "undefined" && Net.role === "client") Net.send({ t: "sb", act: { k: "swap" } });
                else Mix.swapCharacter();
                return true;
            }
            for (let i = 0; i < Mix._pills.length; i++) {
                var p = Mix._pills[i];
                if (mouseX >= p.x && mouseX <= p.x + p.w && mouseY >= p.y && mouseY <= p.y + p.h) {
                    if (typeof Net !== "undefined" && Net.role === "client") {
                        Mix._lanBody = p.id; mixCfg.body = p.id;
                    } else if (p.id !== mixCfg.body) Mix.setBody(p.id);
                    return true;
                }
            }
            if (Mix._wormRects && Mix._wormRects.length) {
                for (let i = 0; i < Mix._wormRects.length; i++) {
                    var wr = Mix._wormRects[i];
                    if (mouseX >= wr.x && mouseX <= wr.x + wr.w && mouseY >= wr.y && mouseY <= wr.y + wr.h) {
                        if (typeof Net !== "undefined" && Net.role === "client") {
                            Mix._lanWs = ((Mix._lanWs || 0) - ((Mix._lanWs || 0) % 10)) + 10 + (wr.idx + 1);
                        } else {
                            var meW = Mix.me();
                            if (meW && meW.alive && meW.kind === "worm") Mix.wormStat(meW.ref, wr.idx);
                        }
                        mouseDown = false;
                        return true;
                    }
                }
            }
            if (typeof Net !== "undefined" && Net.role === "client" && mixCfg.body === "tank") {
                var hit = function(r) { return mouseX >= r[0] && mouseX <= r[0] + r[2] && mouseY >= r[1] && mouseY <= r[1] + r[3]; };
                var mTk = Mix.me();
                if (mTk && mTk.kind === "tank" && mTk.ref.alive) {
                    for (let i = 0; i < (Tanks.classRects || []).length; i++) if (hit(Tanks.classRects[i])) {
                        Mix._lanTc = ((Mix._lanTc || 0) - ((Mix._lanTc || 0) % 10)) + 10 + (i + 1);
                        mouseDown = false; return true;
                    }
                    if (mTk.ref.pts > 0) for (let i = 0; i < (Tanks.statRects || []).length; i++) if (hit(Tanks.statRects[i])) {
                        Mix._lanTs = ((Mix._lanTs || 0) - ((Mix._lanTs || 0) % 10)) + 10 + (Tanks.statRects[i][4] + 1);
                        mouseDown = false; return true;
                    }
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
