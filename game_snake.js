// ============================================================================
// GAME: WORM ARENA  (snake)  -  slither-style arena (original)
//   Steer a glowing worm around a round arena. Eat pellets to grow; hold boost to go fast (it burns length and
//   leaves a trail of food). If your HEAD touches another worm's body you burst into pellets - so cut the others
//   off. CPU worms roam, hunt food and try to trap you. Leaderboard top-right, best length saved.
//   P1: mouse steers (or A/D turn), click / Space / W = boost.   P2 (pause menu → Players): ←/→ turn, ↑ / Enter boost.
//   Gamepads: left stick steers, A / RT boosts.   Runs on its own screen (engine `ownScreen` flag).
// ============================================================================
var SNK = { R: 2400, PELLETS: 1400, CPUS: 11, SEG: 9 };
var SNK_NAMES = ["Noodle", "Zigzag", "Wiggles", "Slinky", "Ribbon", "Doodle", "Squiggle", "Twister", "Spaghetti", "Coil", "Loopy", "Zappy", "Scribble", "Swirl"];
var SNK_COLORS = ["#f472b6", "#a78bfa", "#34d399", "#fbbf24", "#60a5fa", "#f87171", "#2dd4bf", "#fb923c", "#c084fc", "#a3e635", "#e879f9", "#38bdf8"];
var snakeSave = { best: 0 };
try { var _sn = JSON.parse(localStorage.getItem("timsWormArena") || "null"); if (_sn) snakeSave.best = _sn.best || 0; } catch (e) {}

function arenaRecordDmg(victim, by, amt) {
    if (!victim || !by || !(amt > 0)) return;
    var log = victim._dmgLog || (victim._dmgLog = []);
    for (var i = 0; i < log.length; i++) {
        if (log[i].by === by) { log[i].dmg += amt; return; }
    }
    log.push({ by: by, dmg: amt });
}
function arenaPopDmg(victim, by) {
    if (!victim || !victim._dmgLog || !by) return 0;
    for (var i = 0; i < victim._dmgLog.length; i++) {
        if (victim._dmgLog[i].by === by) {
            var d = victim._dmgLog[i].dmg;
            victim._dmgLog.splice(i, 1);
            return d;
        }
    }
    return 0;
}

// Worm split settings (menu panel -> Game Rules). pieces: how many pieces "Split worm now" makes. rejoin: off = pieces never recombine.
var snakeCfg = { pieces: 2, rejoin: true };
try { var _sc = JSON.parse(localStorage.getItem("timsWormSplitCfg") || "null"); if (_sc) { if (typeof _sc.pieces === "number") snakeCfg.pieces = Math.max(2, Math.min(30, _sc.pieces | 0)); if (typeof _sc.rejoin === "boolean") snakeCfg.rejoin = _sc.rejoin; } } catch (e) {}
function saveSnakeCfg() { try { localStorage.setItem("timsWormSplitCfg", JSON.stringify(snakeCfg)); } catch (e) {} }
// the three menu rows: how many pieces, may they rejoin, and the button itself
function wormSplitRows() {
    return [
        { label: "Split worm into (pieces)", type: "range", min: 2, max: 30, step: 1, localOnly: true, get: function() { return snakeCfg.pieces; }, set: function(v) { snakeCfg.pieces = Math.max(2, Math.min(30, v | 0)); saveSnakeCfg(); }, note: "as many as you want (a short worm makes fewer)" },
        { label: "Pieces can rejoin (head to tail)", type: "toggle", localOnly: true, get: function() { return snakeCfg.rejoin; }, set: function(v) { snakeCfg.rejoin = !!v; saveSnakeCfg(); }, note: "off = split pieces never recombine" },
        { label: "✂ Split my worm now", type: "button", localOnly: true, fn: function() { return Snake.splitMine(); } }
    ];
}

var Snake = {
    worms: [], pellets: [], grid: {}, t: 0, cam: { x: 0, y: 0, z: 1 },

    reset: function() {
        this.worms = []; this.pellets = []; this.t = 0;
        for (let i = 0; i < SNK.PELLETS; i++) this.addPellet();
        this.spawn({ human: 0, name: "P1", color: "#ff5a5f" });
        if (multiplayer) this.spawn({ human: 1, name: "P2", color: "#3da5ff" });
        for (let i = 0; i < SNK.CPUS; i++) this.spawn({ name: SNK_NAMES[i % SNK_NAMES.length], color: SNK_COLORS[i % SNK_COLORS.length] });
    },

    addPellet: function(x, y, v, col) {
        if (x === undefined) { var a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (SNK.R - 60); x = Math.cos(a) * d; y = Math.sin(a) * d; }
        this.pellets.push({ x: x, y: y, v: v || 1, col: col || SNK_COLORS[(Math.random() * SNK_COLORS.length) | 0], ph: Math.random() * 6 });
    },

    spawn: function(o) {
        // a free spot away from other heads
        var x = 0, y = 0;
        for (let tries = 0; tries < 30; tries++) {
            var a = Math.random() * Math.PI * 2, d = Math.random() * (SNK.R - 500);
            x = Math.cos(a) * d; y = Math.sin(a) * d;
            if (this.worms.every(function(w) { return !w.alive || Math.hypot(w.segs[0].x - x, w.segs[0].y - y) > 500; })) break;
        }
        var ang = Math.random() * Math.PI * 2, w = o.old || {};
        w.name = o.name; w.color = o.color; w.human = o.human; w.alive = true; w.len = 24; w.ang = ang; w.want = ang;
        w.boost = false; w.segs = []; w.kills = w.kills || 0; w.deadT = 0; w.cpuT = 0; w._dmgLog = null;
        w.kinId = 0; w.slowed = false; w.rejoinCd = 0; w.splitCd = 0; w.gone = false;         // a fresh worm is on its own again
        w.kbT = 0; w.kbSpeed = 0; w.kbSlowT = 0; w.ejectCd = 0; w.splitOwner = null; w.isSplitChild = false;
        w.safeT = o.human !== undefined ? 120 : 0;          // humans get 2 s of spawn protection
        for (let i = 0; i < w.len; i++) w.segs.push({ x: x - Math.cos(ang) * i * SNK.SEG, y: y - Math.sin(ang) * i * SNK.SEG });
        if (!o.old) this.worms.push(w);
        return w;
    },

    radius: function(w) { return ((w && w._sbScale) ? w._sbScale : 1) * (9 + Math.min(22, Math.sqrt(w.len) * 0.9)); },
    rad: function(w) { return this.radius(w); },
    sizeDmgScale: function(w) { return w ? Math.min(1.45, Math.pow(Math.max(0.15, w.len / 100), 1.45)) : 1; },
    eject: function(w) {
        if (!w || !w.alive || w.gone || w.len < 22 || (w.ejectCd && w.ejectCd > 0) || !w.segs || !w.segs.length) return false;
        var cost = Math.min(8, Math.max(4, Math.round(w.len * 0.06)));
        w.len -= cost;
        w.ejectCd = 14;
        var h = w.segs[0], r = this.radius(w) + 12;
        var ca = Math.cos(w.ang), sa = Math.sin(w.ang);
        var px = h.x + ca * r, py = h.y + sa * r;
        this.pellets.push({
            x: px, y: py, v: Math.max(3, cost * 0.85), r: 8,
            col: w.color, vx: ca * 13, vy: sa * 13,
            ejectT: 18, ownerWorm: w
        });
        if (w.human !== undefined && typeof SFX !== "undefined") SFX.play("whoosh", px, py, 0.35, 1.3);
        return true;
    },
    hitKnockback: function(w, hitAng, spd, dur, slowDur) {
        if (!w || !w.alive) return;
        w.ang = hitAng; w.want = hitAng; w.kbAng = hitAng;
        w.kbSpeed = Math.max(w.kbSpeed || 0, spd || 16);
        w.kbT = Math.max(w.kbT || 0, dur || 28);
        w.kbSlowT = Math.max(w.kbSlowT || 0, slowDur || 120);
    },
    splitAt: function(w, x, y, hitAng) {
        if (!w || !w.alive || w.gone || w.splitCd > 0 || !w.segs || w.segs.length < 16 || w.len < 32) return null;
        var owner = w.splitOwner || w;
        var sibCount = 0;
        for (let i = 0; i < this.worms.length; i++) {
            var sw = this.worms[i];
            if (sw.alive && !sw.gone && ((w.kinId && sw.kinId === w.kinId) || (sw.splitOwner || sw) === owner)) sibCount++;
        }
        if (sibCount >= 4) return null;
        var lo = Math.max(4, Math.floor(w.segs.length * 0.25)), hi = Math.min(w.segs.length - 4, Math.floor(w.segs.length * 0.75));
        var bestIdx = Math.floor(w.segs.length * 0.5), bestD = Infinity;
        for (let i = lo; i <= hi; i++) {
            var dd = Math.hypot(w.segs[i].x - x, w.segs[i].y - y);
            if (dd < bestD) { bestD = dd; bestIdx = i; }
        }
        var frac = bestIdx / w.segs.length;
        var frontLen = Math.max(14, Math.round(w.len * frac));
        var backLen = Math.max(14, Math.round(w.len - frontLen));
        var backSegs = w.segs.slice(bestIdx).map(function(s) { return { x: s.x, y: s.y }; });
        if (!w.kinId) w.kinId = ++this._kinSeq;
        w.segs = w.segs.slice(0, bestIdx);
        w.len = frontLen;
        w.splitOwner = owner;
        w.rejoinCd = this.REJOIN_FRAMES;
        w.splitCd = this.SPLIT_FRAMES;
        w._dupBurst = (w._dupBurst || 0) + 1;
        var w2 = {
            name: w.name, color: w.color, human: w.human, pid: w.pid,
            alive: true, gone: false, slowed: false, len: backLen, ang: hitAng, want: hitAng,
            boost: false, segs: backSegs, kills: 0, deadT: 0, cpuT: 0,
            _dmgLog: null, safeT: 14, mx: w.mx,
            kinId: w.kinId, rejoinCd: this.REJOIN_FRAMES, splitCd: this.SPLIT_FRAMES,
            splitOwner: owner, isSplitChild: true, kbT: 0, kbSpeed: 0, kbSlowT: 0, ejectCd: 0
        };
        this.worms.push(w2);
        this.hitKnockback(w2, hitAng, 16, 28, 120);
        return w2;
    },

    control: function(w) {
        if (w.human === 0) {
            var pad = (typeof Pads !== "undefined") ? Pads.state[0] : null;
            if (pad && pad.active && (pad.left || pad.right || pad.up || pad.down || pad.aim)) {
                var ax = pad.aim ? pad.aim[0] : (pad.right ? 1 : 0) - (pad.left ? 1 : 0), ay = pad.aim ? pad.aim[1] : (pad.down ? 1 : 0) - (pad.up ? 1 : 0);
                if (ax || ay) w.want = Math.atan2(ay, ax);
                w.boost = !!pad.shoot;
            } else if (WASDleftPressed || WASDrightPressed) { w.want = w.ang + (WASDrightPressed ? 0.09 : -0.09); w.keyMode = true; }
            else if (!w.keyMode || Snake.mouseMoved) { var hs = this.toScreen(w.segs[0].x, w.segs[0].y); w.want = Math.atan2(mouseY - hs[1], mouseX - hs[0]); w.keyMode = false; }
            w.boost = !!(pad && pad.active && pad.shoot) || mouseDown || SpacePressed;
            var ej0 = WASDupPressed || !!(pad && pad.active && pad.interact);
            if (ej0 && !w._ejPrev) this.eject(w);
            w._ejPrev = ej0;
        } else if (w.human === 1) {
            var pad2 = (typeof Pads !== "undefined") ? Pads.state[1] : null;
            if (pad2 && pad2.active && (pad2.left || pad2.right || pad2.aim)) { var bx = pad2.aim ? pad2.aim[0] : (pad2.right ? 1 : -1), by = pad2.aim ? pad2.aim[1] : 0; w.want = Math.atan2(by, bx); }
            else if (ULDRleftPressed || ULDRrightPressed) w.want = w.ang + (ULDRrightPressed ? 0.09 : -0.09);
            w.boost = ULDRupPressed || !!PlayerInput[1].kbShoot || !!(pad2 && pad2.active && pad2.shoot);
            var ej1 = !!PlayerInput[1].kbInteract || !!(pad2 && pad2.active && pad2.interact);
            if (ej1 && !w._ejPrev) this.eject(w);
            w._ejPrev = ej1;
        } else if (w.human === "lan") {
            var x = Net.peerX(w.pid);
            if (x.a !== undefined) w.want = x.a;
            w.boost = !!x.b;
        } else this.cpu(w);
    },
    // LAN: every LAN player gets a worm of their own (host only); leavers' worms burst
    lanSync: function() {
        if (typeof Net === "undefined" || Net.role !== "host") return;
        var self = this;
        Net.peerList().forEach(function(p) {
            if (!self.worms.some(function(w) { return w.pid === p.pid; })) { var w = self.spawn({ name: p.name, color: p.color || "#fde047", human: "lan" }); w.pid = p.pid; }
        });
        this.worms.forEach(function(w) {
            if (w.human !== "lan") return;
            if (!Net.peers[w.pid]) { if (w.alive) self.kill(w, null); w.gone = true; return; }
            if (!w.alive && ++w.deadT > 60 && Net.peerX(w.pid).b) self.spawn({ old: w, name: w.name, color: w.color, human: "lan" });
        });
        this.worms = this.worms.filter(function(w) { return !w.gone; });
    },

    cpu: function(w) {
        var h = w.segs[0], r = this.radius(w);
        var inMix = typeof Mix !== "undefined" && Mix.on;
        w.cpuT++;
        // 1) danger: probe rays ahead for bodies / Bubble Snakes / the wall
        var best = null, bestScore = -1e9;
        for (let k = -3; k <= 3; k++) {
            var a = w.ang + k * 0.35, score = -Math.abs(k) * 2, clear = 1;
            for (let d = 30; d <= 200; d += 34) {
                var px = h.x + Math.cos(a) * d, py = h.y + Math.sin(a) * d;
                if (Math.hypot(px, py) > SNK.R - 60) { clear = 0; break; }
                if (this.hitBody(px, py, r + 8, w)) { clear = 0; break; }
                if (inMix && typeof Cells !== "undefined") {
                    for (let bi = 0; bi < Cells.blobs.length; bi++) {
                        var bc = Cells.blobs[bi];
                        if (!bc.dead && bc.pl.chain && !bc.pl.compact && !(bc.pl.snakeGrace > 0)) {
                            var br = Cells.rad(bc.m, bc) + r + 8;
                            if ((px - bc.x) * (px - bc.x) + (py - bc.y) * (py - bc.y) < br * br) { clear = 0; break; }
                        }
                    }
                    if (!clear) break;
                }
            }
            if (!clear) score -= 1000;
            // 2) food / target: prefer the direction of the nearest big pellet cluster or hunted enemy
            if (w.food) { var fa = Math.atan2(w.food.y - h.y, w.food.x - h.x), da = Math.abs(((fa - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI); score += (Math.PI - da) * 20; }
            if (score > bestScore) { bestScore = score; best = a; }
        }
        if (w.cpuT % 20 === 0 || !w.food || w.food.eaten) {
            var nf = null, nd = 700;
            for (let i = 0; i < this.pellets.length; i++) { var p = this.pellets[i], dd = Math.hypot(p.x - h.x, p.y - h.y) / p.v; if (dd < nd) { nd = dd; nf = p; } }
            w.food = nf;
            // 3) hunting: cut in front of nearby worms, or bite Tanks/Blobs in Arena Mix
            var tgt = null;
            for (let i = 0; i < this.worms.length; i++) { var o = this.worms[i]; if (o !== w && o.alive && o.len < w.len && Math.hypot(o.segs[0].x - h.x, o.segs[0].y - h.y) < 500) tgt = o; }
            if (tgt && Math.random() < 0.5) { var oh = tgt.segs[0]; w.food = { x: oh.x + Math.cos(tgt.ang) * 160, y: oh.y + Math.sin(tgt.ang) * 160, eaten: false }; w.hunting = 40; }
            else if (inMix) {
                var bestCross = null, bestD = 540;
                if (typeof Tanks !== "undefined") {
                    for (let i = 0; i < Tanks.tanks.length; i++) {
                        var tk = Tanks.tanks[i];
                        if (!tk.alive || tk.inv > 0 || arenaProtected(tk)) continue;
                        var td = Math.hypot(tk.x - h.x, tk.y - h.y);
                        if (td < bestD) { bestD = td; bestCross = { x: tk.x + tk.vx * 10, y: tk.y + tk.vy * 10 }; }
                    }
                }
                if (typeof Cells !== "undefined") {
                    for (let i = 0; i < Cells.blobs.length; i++) {
                        var bl = Cells.blobs[i];
                        if (bl.dead || (bl.pl.chain && !bl.pl.compact) || Cells.protectedNow(bl.pl)) continue;
                        var bd = Math.hypot(bl.x - h.x, bl.y - h.y);
                        if (bd < bestD) { bestD = bd; bestCross = { x: bl.x + bl.vx * 10, y: bl.y + bl.vy * 10 }; }
                    }
                }
                if (bestCross) { w.food = { x: bestCross.x, y: bestCross.y, eaten: false }; w.hunting = 35; }
            }
        }
        w.want = best;
        w.boost = (w.hunting > 0 && w.len > 40) || (bestScore < -500 && w.len > 30 && Math.random() < 0.05);
        if (w.hunting > 0) w.hunting--;
    },

    hitBody: function(x, y, rad, self) {
        var g = this.grid;
        if (!g || !g.size) return null;
        var cx = Math.floor(x * 0.0125) + 512, cy = Math.floor(y * 0.0125) + 512;
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
            var base = gx * 1024;
            for (let gy = cy - 1; gy <= cy + 1; gy++) {
                var cell = g.get(base + gy);
                if (!cell) continue;
                for (let i = 0; i < cell.length; i += 5) {
                    var w = cell[i + 3];
                    if (w === self) continue;
                    if (self && self.kinId && w.kinId === self.kinId) continue;       // pieces of one player's split worm never hurt each other
                    if (self && (w.splitOwner || w) === (self.splitOwner || self)) continue;
                    var dx = cell[i] - x, dy = cell[i + 1] - y, rr = rad + cell[i + 2];
                    if (dx * dx + dy * dy < rr * rr) { this.lastHitIdx = cell[i + 4]; return w; }     // lastHitIdx: which body segment was hit
                }
            }
        }
        return null;
    },

    // ================= SPLIT WORMS =================
    // A spike pushed into a worm's side cuts it in two. Both halves belong to the same player: same slot, colour,
    // stats (`mx`) and controls, and they share a `kinId`. Rules:
    //   - kin worms never collide with each other (no accidental deaths);
    //   - they can only rejoin HEAD to TAIL: one worm's head must reach the last 3 segments of the other,
    //     within (radiusA + radiusB) x 1.35, and not before `rejoinCd` (2 s) has run out;
    //   - hold the brake key (R, P2: Right Shift) to slow the split worm whose head is furthest from the screen centre.
    _kinSeq: 0,
    SPLIT_MIN_LEN: 30, SPLIT_MIN_PIECE: 8, SPLIT_MAX_PIECES: 30, MANUAL_MIN_PIECE: 3, REJOIN_FRAMES: 120, SPLIT_FRAMES: 90, REJOIN_LEEWAY: 1.35, BRAKE_FACTOR: 0.45,

    kinOf: function(w) {
        if (!w.kinId) return [w];
        var out = [];
        for (let i = 0; i < this.worms.length; i++) { var q = this.worms[i]; if (q.alive && !q.gone && q.kinId === w.kinId) out.push(q); }
        return out.length ? out : [w];
    },
    // the player's main worm: the longest one alive (a dead record while all are dead); pred picks the player's worms
    primaryWorm: function(pred) {
        var best = null;
        for (let i = 0; i < this.worms.length; i++) {
            var q = this.worms[i];
            if (q.gone || !pred(q)) continue;
            if (!best || (q.alive && !best.alive) || (q.alive === best.alive && q.alive && q.len > best.len)) best = q;
        }
        return best;
    },
    localWorm: function(human) { return this.primaryWorm(function(q) { return q.human === human; }); },

    // cut worm w at body segment k. Returns the new worm (the tail half), or null when it cannot split.
    splitWorm: function(w, k) {
        var n = w.segs.length;
        if (!w.alive || w.gone || w.splitCd > 0 || w.len < this.SPLIT_MIN_LEN || n < this.SPLIT_MIN_LEN) return null;
        if (this.kinOf(w).length >= this.SPLIT_MAX_PIECES) return null;
        var m = this.SPLIT_MIN_PIECE;
        if (k < m || k > n - m) return null;
        var headSegs = w.segs.slice(0, k + 1), tailSegs = w.segs.slice(k + 1);
        if (!w.kinId) w.kinId = ++this._kinSeq;
        var B = {};
        for (var key in w) B[key] = w[key];             // same name, colour, owner slot, pid, stats, power-ups
        B.id = undefined; B._nmk = "";
        B.segs = tailSegs;
        var share = headSegs.length / n;
        B.len = w.len * (1 - share); w.len = w.len * share;
        w.segs = headSegs;
        // the tail half's new head is the cut end: it carries on in the direction the worm was going there, then veers away
        var t0 = tailSegs[0], t1 = tailSegs[1] || tailSegs[0];
        B.ang = Math.atan2(t0.y - t1.y, t0.x - t1.x) + (Math.random() < 0.5 ? -1 : 1) * 0.9;
        B.want = B.ang; B.boost = false; B.boosting = false; B.kills = 0; B.deadT = 0; B.cpuT = 0; B._dmgLog = null; B.alive = true; B.gone = false; B.slowed = false;
        B.safeT = Math.max(B.safeT || 0, 30);
        B.rejoinCd = w.rejoinCd = this.REJOIN_FRAMES;    // no instant re-merge on the split frame
        B.splitCd = w.splitCd = this.SPLIT_FRAMES;       // and no instant second cut
        this.worms.push(B);
        return B;
    },

    // Cut worm w into n pieces of about equal length at once (the menu button). A piece needs at least MANUAL_MIN_PIECE
    // segments, so a short worm makes fewer than asked. Returns how many pieces the worm is in now (1 = nothing happened).
    splitInto: function(w, n) {
        if (!w || !w.alive || w.gone) return 1;
        var S = w.segs.length, room = this.SPLIT_MAX_PIECES - this.kinOf(w).length + 1;
        n = Math.max(2, Math.min(n | 0, room, Math.floor(S / this.MANUAL_MIN_PIECE)));
        if (n < 2 || S < 2 * this.MANUAL_MIN_PIECE) return 1;
        if (!w.kinId) w.kinId = ++this._kinSeq;
        var segs = w.segs, total = w.len, per = Math.floor(S / n), extra = S - per * n, at = 0, sign = 1;
        var base = {}; for (var key in w) base[key] = w[key];                  // everything the pieces inherit: owner, name, colour, stats, power-ups
        for (let i = 0; i < n; i++) {
            var size = per + (i < extra ? 1 : 0), part = segs.slice(at, at + size); at += size;
            var piece = w;
            if (i > 0) {
                piece = {}; for (var k2 in base) piece[k2] = base[k2];
                piece.id = undefined; piece._nmk = "";
                var t0 = part[0], t1 = part[1] || part[0];
                piece.ang = Math.atan2(t0.y - t1.y, t0.x - t1.x) + sign * (0.6 + 0.25 * Math.floor((i - 1) / 2)); sign = -sign;   // fan out
                piece.want = piece.ang; piece.boost = false; piece.boosting = false; piece.kills = 0; piece.deadT = 0; piece.cpuT = 0; piece._dmgLog = null;
                piece.alive = true; piece.gone = false; piece.slowed = false; piece.safeT = Math.max(piece.safeT || 0, 30);
                this.worms.push(piece);
            }
            piece.segs = part; piece.len = total * size / S; piece.mxLast = piece.len;
            piece.rejoinCd = this.REJOIN_FRAMES; piece.splitCd = this.SPLIT_FRAMES;
        }
        return n;
    },
    // the menu button: split the local player's main worm into snakeCfg.pieces
    splitMine: function() {
        var w = this.localWorm(0);
        if (!w || !w.alive) { if (typeof showBanner === "function") showBanner("No worm to split", "Play as a worm first", "#fca5a5"); return 1; }
        var want = snakeCfg.pieces, got = this.splitInto(w, want), pieces = this.kinOf(w).length;
        if (typeof showBanner === "function") {
            if (got < 2) showBanner("Too short to split", "grow a little first", "#fca5a5");
            else showBanner("SPLIT into " + got + (got < want ? " (all it can)" : ""), snakeCfg.rejoin ? "head to tail rejoins" : "rejoining is off", "#4ade80");
        }
        if (got >= 2 && typeof Mix !== "undefined" && Mix.on && Mix.burst) Mix.burst(w.segs[0].x, w.segs[0].y, "#4ade80", "ring", "SPLIT ×" + pieces, 70);
        return got;
    },

    // front keeps its head and gets rear's whole body as its new tail; rear is absorbed (no death, no kill)
    rejoin: function(front, rear) {
        front.segs = front.segs.concat(rear.segs);
        front.len += rear.len;
        front.rejoinCd = 40; front.splitCd = Math.max(front.splitCd || 0, 40);
        rear.alive = false; rear.gone = true;
        this._anyGone = true;
        this.rejoined = (this.rejoined || 0) + 1;
    },
    // head -> tail check for every pair of kin worms
    kinStep: function() {
        if (!snakeCfg.rejoin) return;                       // the menu switch: split pieces never recombine
        var W = this.worms, leeway = this.REJOIN_LEEWAY;
        for (let i = 0; i < W.length; i++) {
            var a = W[i];
            if (!a.alive || a.gone || !a.kinId || a.rejoinCd > 0) continue;
            var h = a.segs[0];
            for (let j = 0; j < W.length; j++) {
                var b = W[j];
                if (b === a || !b.alive || b.gone || b.kinId !== a.kinId || b.rejoinCd > 0) continue;
                var reach = (this.radius(a) + this.radius(b)) * leeway, n = b.segs.length, touch = false;
                for (let t = n - 1; t >= Math.max(1, n - 3); t--) {       // only the last 3 segments of the other worm count
                    var s2 = b.segs[t], dx = s2.x - h.x, dy = s2.y - h.y;
                    if (dx * dx + dy * dy < reach * reach) { touch = true; break; }
                }
                if (touch) { this.rejoin(b, a); break; }
            }
        }
    },

    brakeHeld: function(w) {
        if (w.human === 0) { var p0 = (typeof Pads !== "undefined") ? Pads.state[0] : null; return (typeof BrakePressed !== "undefined" && !!BrakePressed) || !!(p0 && p0.active && p0.interact); }
        if (w.human === 1) { var p1 = (typeof Pads !== "undefined") ? Pads.state[1] : null; return !!RShiftPressed || !!(p1 && p1.active && p1.interact); }
        if (w.human === "lan" && typeof Net !== "undefined" && Net.peers && Net.peers[w.pid]) return !!Net.peerX(w.pid).r;
        return false;
    },
    // while the brake is held, slow exactly ONE worm of each split player: the one whose head is furthest from the
    // centre of the screen (the camera). A small margin keeps the choice from flipping when the two are about level.
    brakeStep: function() {
        var groups = {}, W = this.worms;
        for (let i = 0; i < W.length; i++) { var w = W[i]; w.slowedNow = false; if (w.alive && !w.gone && w.kinId) (groups[w.kinId] || (groups[w.kinId] = [])).push(w); }
        for (var id in groups) {
            var g = groups[id];
            if (g.length < 2) { g[0].slowed = false; continue; }
            if (!this.brakeHeld(g[0])) { g.forEach(function(q) { q.slowed = false; }); continue; }
            var local = g[0].human === 0 || g[0].human === 1, cx, cy;
            if (local) { cx = this.cam.x; cy = this.cam.y; }
            else { cx = 0; cy = 0; g.forEach(function(q) { cx += q.segs[0].x; cy += q.segs[0].y; }); cx /= g.length; cy /= g.length; }
            var far = null, farD = -1, prev = null;
            g.forEach(function(q) { var d = Math.hypot(q.segs[0].x - cx, q.segs[0].y - cy); q._cd = d; if (d > farD) { farD = d; far = q; } if (q.slowed) prev = q; });
            if (prev && prev !== far && prev._cd >= farD - 40) far = prev;
            g.forEach(function(q) { q.slowed = q === far; });
        }
    },
    // copy owner / name / colour from one worm to the rest of its split pieces (after a swap with a bot)
    syncKin: function(w) {
        if (!w.kinId) return;
        for (let i = 0; i < this.worms.length; i++) { var q = this.worms[i]; if (q !== w && q.kinId === w.kinId) { q.human = w.human; q.pid = w.pid; q.name = w.name; q.color = w.color; } }
    },
    // how many worms the player owns, and the widest gap between them (for the camera and the HUD)
    kinCount: function(w) { return this.kinOf(w).length; },

    buildGrid: function() {
        var g = this.grid;
        if (g instanceof Map) g.clear();
        else g = this.grid = new Map();
        for (let k = 0; k < this.worms.length; k++) {
            var w = this.worms[k];
            if (!w.alive) continue;
            var r = this.radius(w) * 0.8, segs = w.segs;
            for (let i = 3; i < segs.length; i += 2) {        // skip the head area, every other segment is plenty
                var s = segs[i], key = (Math.floor(s.x * 0.0125) + 512) * 1024 + (Math.floor(s.y * 0.0125) + 512);
                var cell = g.get(key);
                if (cell) cell.push(s.x, s.y, r, w, i);
                else g.set(key, [s.x, s.y, r, w, i]);
            }
        }
    },

    kill: function(w, by) {
        if (!w.alive || arenaProtected(w)) return;
        w.alive = false; w.deadT = 0;
        var col = w.color;
        var nSeg = w.segs.length, maxDrops = 26;
        var step = Math.max(2, Math.ceil(nSeg / maxDrops));
        var val = Math.max(2, Math.round((2 + ((w.len / 60) | 0)) * (step / 2)));
        for (let i = 0; i < nSeg; i += step) {
            this.addPellet(w.segs[i].x + (Math.random() - 0.5) * 20, w.segs[i].y + (Math.random() - 0.5) * 20, val, col);
        }
        // Group neighboring excess pellets into bigger globs to cap entity count without losing food value
        this.groupPellets(SNK.PELLETS + 180, SNK.PELLETS + 60);
        if (by) {
            by.kills++;
            if (by.segs && by.alive) {
                var putIn = arenaPopDmg(w, by);
                by.len += Math.max(Math.round(w.len * 0.5), Math.round(putIn * 1.2), 15);
            }
        }
        var kinLeft = 0, wOwn = w.splitOwner || w;
        for (let q = 0; q < this.worms.length; q++) {
            var o = this.worms[q];
            if (o === w || !o.alive || o.gone) continue;
            if ((w.kinId && o.kinId === w.kinId) || ((o.splitOwner || o) === wOwn && (w.splitOwner || o.splitOwner)) || (w.human !== undefined && o.human === w.human && o.pid === w.pid)) kinLeft++;
        }
        if (kinLeft > 0) { w.gone = true; this._anyGone = true; return; }         // one piece died, the player lives on
        if (w.human !== undefined) {
            w.deathMsg = by ? "Eaten by " + by.name : "You hit the wall";
            w.finalLen = Math.round(w.len);
            if ((w.human === 0 || w.human === 1) && w.finalLen > snakeSave.best) { snakeSave.best = w.finalLen; try { localStorage.setItem("timsWormArena", JSON.stringify(snakeSave)); } catch (e) {} }
            if (typeof SFX !== "undefined") SFX.play("ko");
        } else if (by && by.human !== undefined) {
            if (typeof SFX !== "undefined") SFX.play("kill");
            showBanner(by.name + " got " + w.name + "!", "length " + Math.round(w.len), by.color);
        }
    },

    step: function() {
        this.t++;
        this.buildGrid();
        this.brakeStep();
        for (let pi = 0; pi < this.pellets.length; pi++) {
            var mp = this.pellets[pi];
            if (mp.ejectT > 0) mp.ejectT--;
            if (mp.vx || mp.vy) {
                mp.x += mp.vx; mp.y += mp.vy;
                mp.vx *= 0.91; mp.vy *= 0.91;
                if (Math.abs(mp.vx) < 0.08 && Math.abs(mp.vy) < 0.08) { mp.vx = 0; mp.vy = 0; }
            }
        }
        for (let k = 0; k < this.worms.length; k++) {
            var w = this.worms[k];
            if (w.gone) continue;
            if (w.rejoinCd > 0) w.rejoinCd--;
            if (w.splitCd > 0) w.splitCd--;
            if (w.ejectCd > 0) w.ejectCd--;
            if (!w.alive) {
                w.deadT++;
                if (w.human === undefined && !w.isSplitChild && w.deadT > 180) this.spawn({ old: w, name: w.name, color: w.color });
                continue;
            }
            if (w.kbSlowT > 0) w.kbSlowT--;
            if (w.kbT > 0) {
                w.kbT--;
                w.ang = w.kbAng;
                w.want = w.kbAng;
            } else {
                this.control(w);
                // turn toward the wanted heading (bigger worms turn a little slower)
                var d = ((w.want - w.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI, turn = 0.11 - Math.min(0.05, w.len / 4000);
                w.ang += Math.max(-turn, Math.min(turn, d));
            }
            var boosting = (w.kbT > 0 || w.kbSlowT > 0) ? false : (w.boost && w.len > 14);
            var kbSlowMult = (w.kbT <= 0 && w.kbSlowT > 0) ? 0.52 : 1;
            var sp = (w.kbT > 0 ? w.kbSpeed : (boosting ? 6.2 : 3.2)) * arenaSpeed(w) * (w.kbT > 0 ? 1 : (w.slowed ? this.BRAKE_FACTOR : 1)) * kbSlowMult;
            if (w.kbT <= 0 && sp > 22) w._fastTicks = (w._fastTicks || 0) + 1;
            else if (w._fastTicks > 0) w._fastTicks = Math.max(0, w._fastTicks - 0.1);
            if (w._dupBurst > 0) w._dupBurst = Math.max(0, w._dupBurst - 0.02);
            if (w.kbT > 0) w.kbSpeed = Math.max(5.5, w.kbSpeed * 0.95);
            if (boosting && this.t % 4 === 0) { w.len -= 1; var tl = w.segs[w.segs.length - 1]; this.addPellet(tl.x, tl.y, 1, w.color); }
            var snkDec = (typeof cellsCfg !== "undefined") ? cellsCfg.decay : 0.0000333;
            if (snkDec > 0 && w.len > 60) {
                w.len -= (w.len - 40) * snkDec * ((typeof cellsCfg !== "undefined" && cellsCfg.decayGrow) ? 1 + w.len / 400 : 1);
            }
            var h = w.segs[0];
            var nh = { x: h.x + Math.cos(w.ang) * sp, y: h.y + Math.sin(w.ang) * sp };
            // body follows: each segment keeps SEG distance from the one ahead
            w.segs.unshift(nh);
            var want = Math.round(w.len);
            var acc = 0, out = [w.segs[0]];
            for (let i = 1; i < w.segs.length && out.length < want; i++) {
                var a = out[out.length - 1], b = w.segs[i], dd = Math.hypot(b.x - a.x, b.y - a.y);
                if (dd >= SNK.SEG) { out.push({ x: a.x + (b.x - a.x) * SNK.SEG / dd, y: a.y + (b.y - a.y) * SNK.SEG / dd }); }
                else if (i === w.segs.length - 1) out.push(b);
            }
            while (out.length < want) { var last = out[out.length - 1]; out.push({ x: last.x, y: last.y }); }
            w.segs = out;
            w.boosting = boosting;
            // eat
            var r = this.radius(w), rPull = r + 14, rEat = r + 6, rEat2 = rEat * rEat, rWall = SNK.R - r;
            var ps = this.pellets;
            for (let i = ps.length - 1; i >= 0; i--) {
                var p = ps[i];
                if (p.ejectT > 0 && p.ownerWorm === w) continue;
                var dxp = p.x - nh.x, dyp = p.y - nh.y;
                if (dxp < rPull && dxp > -rPull && dyp < rPull && dyp > -rPull) {
                    // pellets get sucked in for a frame or two before they disappear
                    if (dxp * dxp + dyp * dyp < rEat2) {
                        w.len += p.v * 0.65; p.eaten = true;
                        var lastP = ps.length - 1;
                        if (i < lastP) ps[i] = ps[lastP];
                        ps.pop();
                    }
                    else { p.x -= dxp * 0.3; p.y -= dyp * 0.3; }
                }
            }
            // die on the wall or another worm's body
            if (nh.x * nh.x + nh.y * nh.y > rWall * rWall) { this.kill(w, null); continue; }
            if (w.safeT > 0) { w.safeT--; continue; }
            var hit = this.hitBody(nh.x, nh.y, r * 0.7, w);
            if (hit) this.kill(w, hit);
        }
        this.kinStep();
        if (this._anyGone) { this._anyGone = false; this.worms = this.worms.filter(function(q) { return !q.gone; }); }
        while (this.pellets.length < SNK.PELLETS) this.addPellet();
        if (this.pellets.length > SNK.PELLETS + 180) this.groupPellets(SNK.PELLETS + 180, SNK.PELLETS + 60);
    },

    groupPellets: function(cap, targetLen) {
        if (this.pellets.length <= cap) return;
        var cellSz = 220, buckets = Object.create(null);
        for (let i = 0; i < this.pellets.length && this.pellets.length > targetLen; i++) {
            var gp = this.pellets[i];
            var key = ((gp.x / cellSz) | 0) + "," + ((gp.y / cellSz) | 0);
            var hostIdx = buckets[key];
            if (hostIdx === undefined) {
                buckets[key] = i;
            } else {
                var hp = this.pellets[hostIdx], tot = hp.v + gp.v;
                hp.x = (hp.x * hp.v + gp.x * gp.v) / tot;
                hp.y = (hp.y * hp.v + gp.y * gp.v) / tot;
                hp.v = tot;
                var last = this.pellets.length - 1;
                if (i < last) this.pellets[i] = this.pellets[last];
                this.pellets.pop();
                i--;
            }
        }
    },

    toScreen: function(x, y) { var c = this.cam; return [(x - c.x) * c.z + cssW / 2, (y - c.y) * c.z + cssH / 2]; },

    humans: function() {
        if (typeof Net !== "undefined" && Net.role === "client") return this.worms.filter(function(w) { return w.pid === Net.pid; });
        return this.worms.filter(function(w) { return w.human === 0 || w.human === 1; });
    },

    render: function() {
        var hs = this.humans().filter(function(w) { return w.alive; });
        // camera: follow the human worms, zoom out as they grow (and to fit both)
        var tx = 0, ty = 0, span = 0;
        if (hs.length) {
            // one focus per player: their main (longest) worm; the others of a split player only widen the view
            var focus = [], seen = {};
            hs.forEach(function(w) { var key = w.kinId || ("w" + focus.length + w.human); if (seen[key]) { if (w.len > seen[key].len) focus[focus.indexOf(seen[key])] = (seen[key] = w); return; } seen[key] = w; focus.push(w); });
            focus.forEach(function(w) { tx += w.segs[0].x; ty += w.segs[0].y; });
            tx /= focus.length; ty /= focus.length;
            if (focus.length > 1) span = Math.hypot(focus[0].segs[0].x - focus[1].segs[0].x, focus[0].segs[0].y - focus[1].segs[0].y);
            hs.forEach(function(w) { span = Math.max(span, Math.hypot(w.segs[0].x - tx, w.segs[0].y - ty) * 2); });
        }
        else { tx = this.cam.x; ty = this.cam.y; }
        var biggest = hs.reduce(function(m, w) { return Math.max(m, w.len); }, 24);
        var z = Math.max(0.35, Math.min(1.1, 1.15 - Math.sqrt(biggest) * 0.035)), fitZ = span ? Math.min(z, (Math.min(cssW, cssH) * 0.8) / (span + 300)) : z;
        this.cam.x += (tx - this.cam.x) * 0.15; this.cam.y += (ty - this.cam.y) * 0.15; this.cam.z += (Math.max(0.25, fitZ) - this.cam.z) * 0.05;
        var c = this.cam, Z = c.z;
        if (!this.mixLayer) { ctx.fillStyle = Theme.bg(); ctx.fillRect(0, 0, cssW, cssH); }
        // hex-ish dot floor inside the arena
        var o = this.toScreen(0, 0);
        ctx.save();
        ctx.beginPath(); ctx.arc(o[0], o[1], SNK.R * Z, 0, 7); ctx.fillStyle = this.mixLayer ? "rgba(244,114,182,0.07)" : Theme.floor("#0d1626"); ctx.fill(); ctx.clip();
        var step = 60, x0 = Math.floor((c.x - cssW / 2 / Z) / step) * step, y0 = Math.floor((c.y - cssH / 2 / Z) / step) * step;
        ctx.fillStyle = this.mixLayer ? "rgba(0,0,0,0)" : Theme.grid("#16233a");
        if (!this.mixLayer) for (let x = x0; x < c.x + cssW / 2 / Z + step; x += step) for (let y = y0; y < c.y + cssH / 2 / Z + step; y += step) {
            var p = this.toScreen(x + ((y / step) & 1) * step / 2, y); ctx.fillRect(p[0] - 2 * Z, p[1] - 2 * Z, 4 * Z + 1, 4 * Z + 1);
        }
        // pellets
        for (let i = 0; i < this.pellets.length; i++) {
            var pl = this.pellets[i], ps = this.toScreen(pl.x, pl.y);
            if (ps[0] < -30 || ps[1] < -30 || ps[0] > cssW + 30 || ps[1] > cssH + 30) continue;
            var baseR = pl.v >= 4 ? Math.min(18, 3.2 + Math.sqrt(pl.v) * 1.65) : (3 + pl.v * 1.4);
            var pr = baseR * Z * (1 + Math.sin(this.t * 0.1 + pl.ph) * 0.12);
            ctx.globalAlpha = 0.35; ctx.fillStyle = pl.col; ctx.beginPath(); ctx.arc(ps[0], ps[1], pr * 2.1, 0, 7); ctx.fill();
            ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(ps[0], ps[1], pr, 0, 7); ctx.fill();
            if (pl.v >= 6) { ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.beginPath(); ctx.arc(ps[0], ps[1], pr * 0.42, 0, 7); ctx.fill(); }
        }
        // worms: tail first, little ones on top
        var order = this.worms.filter(function(w) { return w.alive; }).sort(function(a, b) { return b.len - a.len; });
        for (let k = 0; k < order.length; k++) {
            var w = order[k], r = this.radius(w) * Z, S = w.segs;
            ctx.globalAlpha = w.safeT > 0 ? 0.45 + 0.25 * Math.sin(this.t * 0.4) : 1;
            for (let i = S.length - 1; i >= 0; i--) {
                var sp = this.toScreen(S[i].x, S[i].y);
                if (sp[0] < -60 || sp[1] < -60 || sp[0] > cssW + 60 || sp[1] > cssH + 60) continue;
                ctx.fillStyle = (i % 6 < 3) ? w.color : Components.shade(w.color, -28);
                if (w.boosting) { ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(sp[0], sp[1], r * 1.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
                ctx.beginPath(); ctx.arc(sp[0], sp[1], r, 0, 7); ctx.fill();
            }
            // eyes on the head
            var hp = this.toScreen(S[0].x, S[0].y), ca = Math.cos(w.ang), sa = Math.sin(w.ang);
            for (let e = -1; e <= 1; e += 2) {
                var ex = hp[0] + ca * r * 0.35 - sa * e * r * 0.45, ey = hp[1] + sa * r * 0.35 + ca * e * r * 0.45;
                ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.38, 0, 7); ctx.fill();
                ctx.fillStyle = "#0a0f16"; ctx.beginPath(); ctx.arc(ex + ca * r * 0.14, ey + sa * r * 0.14, r * 0.18, 0, 7); ctx.fill();
            }
            ctx.globalAlpha = 1;
            uiText(w.name, hp[0], hp[1] - r - 10, w.human !== undefined ? 14 : 11, w.human !== undefined ? "#fff" : "rgba(226,232,240,0.7)", "center", "900");
        }
        ctx.restore();
        // arena wall
        ctx.strokeStyle = "#ef4444"; ctx.lineWidth = Math.max(3, 10 * Z); ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(o[0], o[1], SNK.R * Z, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    },

    // shown while a player has 2+ worms: how the pieces work (also used by Arena Mix)
    splitHint: function() {
        var me = this.localWorm((typeof Net !== "undefined" && Net.role === "client") ? undefined : 0);
        if (typeof Net !== "undefined" && Net.role === "client") me = this.primaryWorm(function(q) { return q.pid === Net.pid; });
        if (!me || !me.alive) return;
        var k = this.kinOf(me);
        if (k.length < 2) return;
        var cd = Math.max.apply(null, k.map(function(q) { return q.rejoinCd || 0; }));
        var held = this.brakeHeld(me);
        var txt = "SPLIT ×" + k.length + " · hold R: slow the outer worm" + (held ? " (braking)" : "") + " · " + (!snakeCfg.rejoin ? "rejoining is OFF" : (cd > 0 ? "rejoin in " + Math.ceil(cd / 60) + " s" : "rejoin: touch a worm's head to the other's tail"));
        uiPanel(cssW / 2 - 250, cssH - 74, 500, 28, "#4ade80", 0.85);
        uiText(txt, cssW / 2, cssH - 55, 12, held ? "#fde047" : "#bbf7d0", "center", "800");
    },
    hud: function() {
        this.splitHint();
        var hs = this.humans();
        var sideOpen = typeof SandboxUI !== "undefined" && (SandboxUI.sideOpen || SandboxUI.pauseOpen);
        var lx = sideOpen ? 320 : 12;
        if (!this.mixLayer) {
            if (!sideOpen) {
                uiPanel(lx, 50, 300, 60, "#f472b6");
                uiText("WORM ARENA", lx + 16, 78, 22, "#f9a8d4", "left", "900");
                uiText(hs.map(function(w) { return w.name + " " + (w.alive ? Math.round(w.len) : "✖"); }).join("   ") + "   best " + snakeSave.best, lx + 16, 98, 12, "#cbd5e1", "left", "800");
            }
            // leaderboard
            // one line per player: the pieces of a split worm are added together
            var byKin = {}, all = [];
            this.worms.forEach(function(w) {
                if (!w.alive) return;
                if (!w.kinId) { all.push(w); return; }
                var e = byKin[w.kinId];
                if (!e) { e = byKin[w.kinId] = { name: w.name, color: w.color, human: w.human, len: 0 }; all.push(e); }
                e.len += w.len;
            });
            all.sort(function(a, b) { return b.len - a.len; });
            var lb = all.slice(0, 8);
            all.forEach(function(w, i) { if (i >= 8 && w.human !== undefined) { w.rank = i + 1; lb.push(w); } });   // you, even when you're not top 8
            uiPanel(cssW - 214, 14, 200, 30 + lb.length * 18, "#f472b6", 0.8);
            uiText("LEADERBOARD", cssW - 114, 34, 12, "#f9a8d4", "center", "900");
            for (let i = 0; i < lb.length; i++) {
                var w = lb[i];
                uiText((w.rank && i >= 8 ? w.rank : i + 1) + ". " + w.name, cssW - 202, 54 + i * 18, 12, w.human !== undefined ? "#fde047" : w.color, "left", w.human !== undefined ? "900" : "700");
                uiText(String(Math.round(w.len)), cssW - 26, 54 + i * 18, 12, "#e2e8f0", "right", "800");
            }
            // minimap
            var mr = 60, mx = cssW - 84, my = cssH - 92;
            ctx.fillStyle = "rgba(15,23,42,0.8)"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
            ctx.strokeStyle = "rgba(239,68,68,0.6)"; ctx.lineWidth = 2; ctx.stroke();
            for (let i = 0; i < this.worms.length; i++) {
                var q = this.worms[i];
                if (!q.alive) continue;
                ctx.fillStyle = q.human !== undefined ? "#fff" : q.color;
                var qs = q.human !== undefined ? 4 : 2;
                ctx.fillRect(mx + q.segs[0].x / SNK.R * mr - qs / 2, my + q.segs[0].y / SNK.R * mr - qs / 2, qs, qs);
            }
        }
        // death card (only when ALL snakes for that player are dead)
        var shownDead = {};
        for (let i = 0; i < hs.length; i++) {
            var hw = hs[i];
            if (hw.alive || hw.gone) continue;
            var hk = hw.human + ":" + (hw.pid || 0);
            if (shownDead[hk] || hs.some(function(o) { return o !== hw && o.alive && !o.gone && o.human === hw.human && (o.pid || 0) === (hw.pid || 0); })) continue;
            shownDead[hk] = true;
            var y = cssH / 2 - 60 + i * 120;
            uiPanel(cssW / 2 - 200, y, 400, 100, hw.color, 0.92);
            uiText(hw.name + ": " + (hw.deathMsg || "Out!"), cssW / 2, y + 36, 22, "#fff", "center", "900");
            uiText("length " + hw.finalLen + "  ·  " + (hw.deadT > 60 ? (hw.human === 1 ? "Enter / ↑" : "click / Space") + " to play again" : "…"), cssW / 2, y + 70, 15, "#cbd5e1", "center", "800");
        }
        if (!this.mixLayer) {
            ctx.fillStyle = "rgba(15,23,42,0.8)"; ctx.fillRect(0, cssH - 30, cssW, 30);
            uiText((hs[0] && hs[0].keyMode ? "A/D turn" : "Mouse steers") + " · click / Space / W boost · R slows the outer worm when split · V swap bot · cut others off · Esc menu" + (multiplayer ? " · P2: ←/→ turn, ↑ boost" : ""), cssW / 2, cssH - 11, 12, "rgba(220,230,240,0.85)", "center", "700");
        }
    },
    swapBot: function(pid) {
        var cur = pid !== undefined
            ? this.worms.find(function(w) { return w.pid === pid; })
            : this.localWorm(0);
        var bots = this.worms.filter(function(w) { return w.alive && w.human === undefined && w !== cur; });
        if (!bots.length) return false;
        this._swapIdx = ((this._swapIdx || 0) + 1) % bots.length;
        var bot = bots[this._swapIdx];
        if (cur) {
            bot.human = cur.human; bot.pid = cur.pid;
            cur.human = undefined; cur.pid = undefined;
        } else {
            bot.human = pid !== undefined ? "lan" : 0;
            if (pid !== undefined) bot.pid = pid;
        }
        this.syncKin(bot); if (cur) this.syncKin(cur);
        if (pid === undefined && bot.segs && bot.segs[0]) {
            this.cam.x = bot.segs[0].x; this.cam.y = bot.segs[0].y;
            if (typeof showBanner === "function") showBanner("SWAPPED", "Now controlling " + (bot.name || "Worm"), "#f472b6");
        }
        return true;
    }
};

ModeKit.addLevel("snake_arena", { name: "🐍 Worm Arena", mode: "snake", wavesEnabled: false, spawnP1: [0, 60], spawnP2: [60, 60], layout: ModeKit.room(-600, 600, 800, {}), title: "Worm Arena" });

GameModes.register({
    id: "snake",
    title: "WORM ARENA",
    tagline: "Slither-style arena: grow by eating, boost, and make the other worms crash into you.",
    color: "#f472b6",
    firstLevel: "snake_arena",
    flags: { ownScreen: true, botSwap: true, waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, scenery: false, coopToggle: true },
    overTitle: "WORM ARENA",

    seats: function() {
        return [{ label: "P1", options: ["human"], value: "human", set: function() {} },
            { label: "P2 (arrows / pad 2)", options: ["human", "off"], value: multiplayer ? "human" : "off", set: function(v) { multiplayer = v === "human"; Snake.reset(); } },
            { label: "CPU opponents", count: true, value: SNK.CPUS, min: 0, max: 20, set: function(v) { SNK.CPUS = Math.max(0, Math.min(20, v)); Snake.reset(); } }];
    },
    setupLevel: function() { Snake.reset(); Snake.lastMouse = [mouseX, mouseY]; },

    screenFrame: function() {
        Snake.mouseMoved = Math.hypot(mouseX - Snake.lastMouse[0], mouseY - Snake.lastMouse[1]) > 3;
        Snake.lastMouse = [mouseX, mouseY];
        // respawn a dead human when they press their button (only if all their split pieces are dead)
        var hs = Snake.humans();
        for (let i = 0; i < hs.length; i++) {
            var w = hs[i];
            if (w.alive || w.gone) continue;
            if (hs.some(function(o) { return o !== w && o.alive && !o.gone && o.human === w.human; })) continue;
            w.deadT++;
            var pad = (typeof Pads !== "undefined") ? Pads.state[w.human] : null;
            var again = w.human === 0 ? (mouseDown || SpacePressed || !!(pad && pad.active && pad.shoot)) : (ULDRupPressed || !!PlayerInput[1].kbShoot || !!(pad && pad.active && pad.shoot));
            if (w.deadT > 60 && again) { Snake.spawn({ old: w, name: w.name, color: w.color, human: w.human }); w.kills = 0; }
        }
        Snake.lanSync();
        Snake.step();
        Snake.render();
        Snake.hud();
    },
    screenDraw: function() {
        Snake.t++;
        var isCl = typeof Net !== "undefined" && Net.role === "client";
        var myW = isCl ? (Snake.worms.find(function(w) { return w.pid === Net.pid && w.alive && !w.gone; }) || Snake.worms.find(function(w) { return w.pid === Net.pid; })) : null;
        for (let i = 0; i < Snake.worms.length; i++) {
            var w = Snake.worms[i];
            if (!w.alive || !w.segs || !w.segs.length) continue;
            if (w === myW) {
                var sc = Snake.toScreen(w.segs[0].x, w.segs[0].y);
                var ta = Math.atan2(mouseY - sc[1], mouseX - sc[0]);
                var da = Math.atan2(Math.sin(ta - w.ang), Math.cos(ta - w.ang));
                w.ang += Math.max(-0.14, Math.min(0.14, da));
                var wsp = (mouseDown || SpacePressed || WASDupPressed) ? 5.2 : 3.2;
                w.segs[0].x += Math.cos(w.ang) * wsp; w.segs[0].y += Math.sin(w.ang) * wsp;
                if (w._tx !== undefined) {
                    var dw = Math.hypot(w._tx - w.segs[0].x, w._ty - w.segs[0].y);
                    if (dw >= 120) { w.segs[0].x = w._tx; w.segs[0].y = w._ty; }
                    else if (dw > 8) { w.segs[0].x += (w._tx - w.segs[0].x) * 0.12; w.segs[0].y += (w._ty - w.segs[0].y) * 0.12; }
                }
                for (let s = 1; s < w.segs.length; s++) {
                    var prev = w.segs[s - 1], cur = w.segs[s];
                    var dx = prev.x - cur.x, dy = prev.y - cur.y, d = Math.hypot(dx, dy);
                    if (d > 5.5) { cur.x = prev.x - dx / d * 5.5; cur.y = prev.y - dy / d * 5.5; }
                }
                var wh = w.segs[0], wr = 18;
                var se = Snake._eatenPellets || (Snake._eatenPellets = []), now = performance.now();
                for (let p = Snake.pellets.length - 1; p >= 0; p--) {
                    var g = Snake.pellets[p];
                    if (Math.abs(g.x - wh.x) < wr && Math.abs(g.y - wh.y) < wr && Math.hypot(g.x - wh.x, g.y - wh.y) < wr) {
                        w.len += g.v || 1;
                        se.push([Math.round(g.x), Math.round(g.y), now + 900]);
                        if (se.length > 160) se.shift();
                        Snake.pellets.splice(p, 1);
                    }
                }
            } else if (w._tx !== undefined) {
                w.segs[0].x += (w._tx - w.segs[0].x) * 0.45;
                w.segs[0].y += (w._ty - w.segs[0].y) * 0.45;
                for (let s = 1; s < w.segs.length; s++) {
                    var rp = w.segs[s - 1], rc = w.segs[s];
                    var rdx = rp.x - rc.x, rdy = rp.y - rc.y, rd = Math.hypot(rdx, rdy);
                    if (rd > 5.5) { rc.x = rp.x - rdx / rd * 5.5; rc.y = rp.y - rdy / rd * 5.5; }
                }
            }
        }
        Snake.render(); Snake.hud();
    },
    onKey: function(code) {
        if (code === "KeyV" || code === "BracketRight") {
            if (typeof Net !== "undefined" && Net.role === "client") { Net.send({ t: "sb", act: { k: "swap" } }); return true; }
            return Snake.swapBot ? Snake.swapBot() : false;
        }
        return false;
    },
    netInput: function() {
        var me = Snake.humans()[0];
        var x = { b: (mouseDown || SpacePressed || WASDupPressed) ? 1 : 0, r: (typeof BrakePressed !== "undefined" && BrakePressed) ? 1 : 0 };
        if (me && me.alive) { var hs = Snake.toScreen(me.segs[0].x, me.segs[0].y); x.a = Math.round(Math.atan2(mouseY - hs[1], mouseX - hs[0]) * 100) / 100; }
        return x;
    },
    netState: function() {
        Snake.netTick = (Snake.netTick || 0) + 1;
        var fullMeta = (typeof Net !== "undefined" && Net.isFullSnap) || Snake.netTick % 30 === 1;
        var lan = [];
        for (let i = 0; i < Snake.worms.length; i++) {
            var sw = Snake.worms[i];
            if (sw.human === "lan" && sw.segs && sw.segs[0]) lan.push(sw.segs[0]);
        }
        var viewPts = lan.slice();
        if (typeof Tanks !== "undefined" && Tanks.tanks) {
            for (let i = 0; i < Tanks.tanks.length; i++) if (Tanks.tanks[i].human === "lan") viewPts.push(Tanks.tanks[i]);
        }
        if (typeof Cells !== "undefined" && Cells.players) {
            for (let i = 0; i < Cells.players.length; i++) {
                var cp = Cells.players[i];
                if (cp.human === "lan") viewPts.push({ x: cp.cx || 0, y: cp.cy || 0 });
            }
        }
        var wm = {}, hasWm = false;
        var wList = Snake.worms.map(function(w) {
            var id = w.id || (w.id = Snake.nextId = (Snake.nextId || 0) + 1);
            var h = w.human === undefined ? -1 : w.human;
            var dm = w.deathMsg || "";
            var mk = w.name + "|" + w.color + "|" + h + "|" + (w.pid || 0) + "|" + dm + "|" + (w.finalLen || 0);
            if (fullMeta || w._nmk !== mk) {
                w._nmk = mk;
                wm[id] = [w.name, w.color, h, w.pid || null, dm, w.finalLen || 0];
                hasWm = true;
            }
            var sg = [];
            if (w.alive && w.segs.length) {
                var inView = !viewPts.length;
                if (!inView) {
                    for (let i = 0; i < w.segs.length; i += 6) {
                        var s = w.segs[i];
                        if (viewPts.some(function(lh) { return Math.abs(s.x - lh.x) < 2600 && Math.abs(s.y - lh.y) < 1800; })) { inView = true; break; }
                    }
                }
                if (inView) {
                    for (let i = 0; i < w.segs.length; i += 2) sg.push(Math.round(w.segs[i].x), Math.round(w.segs[i].y));
                } else {
                    sg.push(Math.round(w.segs[0].x), Math.round(w.segs[0].y));
                }
            }
            return { id: id, a: w.alive ? 1 : 0, l: Math.round(w.len), g: Math.round(w.ang * 100) / 100, b: w.boosting ? 1 : 0, s: w.safeT || 0, k: w.kinId || 0, sl: w.slowed ? 1 : 0, sg: NetPack.d(sg), dt: w.deadT || 0 };
        });
        var st = { w: wList };
        if (hasWm) st.wm = wm;
        if ((typeof Net !== "undefined" && Net.isFullSnap) || Snake.netTick % 4 === 0) {
            var near = viewPts.length ? Snake.pellets.filter(function(p) { return viewPts.some(function(h) { return Math.abs(p.x - h.x) < 2000 && Math.abs(p.y - h.y) < 1400; }); }) : [];
            st.p = near.map(function(p) { return [Math.round(p.x), Math.round(p.y), p.v, SNK_COLORS.indexOf(p.col)]; });
        }
        return st;
    },
    applyNetState: function(m) {
        var mc = Snake._metaCache || (Snake._metaCache = {});
        if (m.wm) for (var mid in m.wm) mc[mid] = m.wm[mid];
        var prev = {};
        for (let i = 0; i < Snake.worms.length; i++) {
            var pw = Snake.worms[i];
            if (pw.alive && pw.segs && pw.segs[0]) prev[pw.id || pw.pid || pw.name] = pw;
        }
        Snake.worms = m.w.map(function(o) {
            var md = mc[o.id] || ["Worm", "#4ade80", -1, null, "", 0];
            var sgo = NetPack.un(o.sg);
            var segs = []; for (let i = 0; i < sgo.length; i += 2) { segs.push({ x: sgo[i], y: sgo[i + 1] }); segs.push({ x: sgo[i], y: sgo[i + 1] }); }
            var w = { id: o.id, name: md[0], color: md[1], human: md[2] === -1 ? undefined : md[2], pid: md[3], deathMsg: md[4], finalLen: md[5], alive: !!o.a, len: o.l, ang: o.g, boosting: !!o.b, safeT: o.s, kinId: o.k || 0, slowed: !!o.sl, segs: segs.length ? segs : [{ x: 0, y: 0 }], deadT: o.dt };
            w._tx = w.segs[0].x; w._ty = w.segs[0].y;
            var old = prev[o.id || w.pid || w.name];
            if (old && w.alive && Math.hypot(w._tx - old.segs[0].x, w._ty - old.segs[0].y) < 140) {
                if (typeof Net !== "undefined" && w.pid === Net.pid && old.segs.length > 2 && Math.abs(old.segs.length - segs.length) <= 4) {
                    w.segs = old.segs;
                    w.ang = old.ang;
                } else {
                    w.segs[0].x = old.segs[0].x; w.segs[0].y = old.segs[0].y;
                    if (typeof Net !== "undefined" && w.pid === Net.pid) w.ang = old.ang;
                }
            }
            return w;
        });
        if (m.p) {
            var now = performance.now(), eaten = Snake._eatenPellets;
            if (eaten && eaten.length) eaten = Snake._eatenPellets = eaten.filter(function(e) { return e[2] > now; });
            Snake.pellets = m.p.map(function(a) {
                return { x: a[0], y: a[1], v: a[2], col: SNK_COLORS[a[3]] || "#ffffff", ph: (a[0] + a[1]) % 6 };
            }).filter(function(p) {
                if (!eaten || !eaten.length) return true;
                for (let i = 0; i < eaten.length; i++) if (Math.abs(p.x - eaten[i][0]) < 8 && Math.abs(p.y - eaten[i][1]) < 8) return false;
                return true;
            });
        }
    },

    onClick: function() { return true; },
    menuItems: function(items) { items.push({ id: "sn_new", label: "New arena", hint: "" }); },
    onMenu: function(id) { if (id === "sn_new") { closePause(); Snake.reset(); return true; } return false; },
    onRestart: function() { Snake.reset(); },
    overSub: function() { return "Best length " + snakeSave.best; }
});
