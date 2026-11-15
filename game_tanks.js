// ============================================================================
// GAME: TANK ARENA  (tanks)  -  diep-style arena (original)
//   Drive a round tank, shoot drifting shapes for XP (squares, triangles, rare pentagons in the middle), level up,
//   spend points on 8 stats and pick a class at level 15 and again at 30. CPU tanks farm, fight and run away.
//   P1: WASD move, mouse aim, hold click to fire, E auto-fire, 1-8 stats, U / I / O / P (or click) pick a class.
//   P2 (pause → Players): arrows move, Enter fires at the nearest target; stats and class are chosen for P2.
//   Pads: left stick moves, right stick aims, RT fires.   Runs on its own screen (engine `ownScreen` flag).
// ============================================================================
var TNK = { W: 6000, H: 6000, SHAPES: 240, CPUS: 8 };
var TNK_STATS = ["Health regen", "Max health", "Body damage", "Bullet speed", "Bullet pierce", "Bullet damage", "Reload", "Move speed"];
var TNK_STAT_COL = ["#fca5a5", "#f9a8d4", "#c4b5fd", "#93c5fd", "#fde68a", "#fdba74", "#86efac", "#67e8f9"];
var TNK_SHAPES = { square: { hp: 10, xp: 10, r: 22, col: "#fde047", sides: 4 }, tri: { hp: 30, xp: 25, r: 24, col: "#f87171", sides: 3 }, penta: { hp: 100, xp: 130, r: 40, col: "#818cf8", sides: 5 } };
// barrels: a = angle offset, off = sideways offset, len / w = size multipliers, d = firing delay (fraction of reload)
var TNK_CLASSES = {
    basic:    { name: "Basic", tier: 0, next: ["twin", "sniper", "machine", "flank"], b: [{ a: 0 }] },
    twin:     { name: "Twin", tier: 1, next: ["triple"], rl: 1.1, dm: 0.7, b: [{ a: 0, off: -12 }, { a: 0, off: 12, d: 0.5 }] },
    sniper:   { name: "Sniper", tier: 1, next: ["assassin"], rl: 1.5, sp: 1.5, dm: 1.3, fov: 1.2, b: [{ a: 0, len: 1.35 }] },
    machine:  { name: "Machine Gun", tier: 1, next: ["destroyer"], rl: 0.5, dm: 0.7, spread: 0.32, b: [{ a: 0, w: 1.6 }] },
    flank:    { name: "Flank Guard", tier: 1, next: ["tri"], b: [{ a: 0 }, { a: Math.PI, len: 0.8 }] },
    triple:   { name: "Triple Shot", tier: 2, next: [], rl: 1.1, dm: 0.7, b: [{ a: 0 }, { a: -0.45 }, { a: 0.45 }] },
    assassin: { name: "Assassin", tier: 2, next: [], rl: 2, sp: 1.9, dm: 1.6, fov: 1.45, b: [{ a: 0, len: 1.6 }] },
    destroyer:{ name: "Destroyer", tier: 2, next: [], rl: 3.2, sp: 0.75, dm: 3.4, size: 2, recoil: 4, b: [{ a: 0, w: 2 }] },
    tri:      { name: "Tri-Angle", tier: 2, next: [], speed: 1.15, b: [{ a: 0 }, { a: Math.PI - 0.5, len: 0.8, thrust: true }, { a: Math.PI + 0.5, len: 0.8, thrust: true }] }
};
var TNK_NAMES = ["Rumble", "Clank", "Bolt", "Turret", "Gizmo", "Treads", "Boomer", "Sprocket", "Rivet", "Piston"];
var TNK_COLORS = ["#60a5fa", "#f87171", "#34d399", "#fbbf24", "#c084fc", "#fb923c", "#2dd4bf", "#f472b6"];
var tanksSave = { best: 0 };
try { var _tk = JSON.parse(localStorage.getItem("timsTankArena") || "null"); if (_tk) tanksSave.best = _tk.best || 0; } catch (e) {}

var Tanks = {
    tanks: [], shapes: [], bullets: [], pending: [], t: 0, cam: { x: 0, y: 0, z: 1 }, auto: false,

    locals: function() {
        if (typeof Net !== "undefined" && Net.role === "client") return this.tanks.filter(function(k) { return k.pid === Net.pid; });
        return this.tanks.filter(function(k) { return k.human === 0 || k.human === 1; }).sort(function(a, b) { return a.human - b.human; });
    },
    lanSync: function() {
        if (typeof Net === "undefined" || Net.role !== "host") return;
        var self = this;
        Net.peerList().forEach(function(p) { if (!self.tanks.some(function(k) { return k.pid === p.pid; })) { var k = self.addTank({ human: "lan", name: p.name, color: p.color || "#fde047" }); k.pid = p.pid; } });
        this.tanks.forEach(function(k) {
            if (k.human !== "lan") return;
            if (!Net.peers[k.pid]) { k.gone = true; return; }
            if (!k.alive && ++k.deadT > 60 && Net.peerX(k.pid).f) self.spawn(k);
        });
        this.tanks = this.tanks.filter(function(k) { return !k.gone; });
    },
    xpFor: function(l) { return Math.round(3 * Math.pow(l, 1.55)) + 4; },
    maxHp: function(k) { return 50 + 20 * k.st[1] + 2 * k.lvl; },
    // Arena Mix: a tank's mass changes how it shoots. Factor 1 = the starting mass (36). A heavy tank fires bigger,
    // harder bullets but reloads more slowly; a light tank is quick but weak. Outside Arena Mix the factor is 1.
    massFactor: function(k) { return (this.mixLayer && k.mixMass > 0) ? Math.max(0.7, Math.min(3.2, Math.sqrt(k.mixMass / 36))) : 1; },
    reload: function(k) { var f = this.massFactor(k); return 22 * Math.pow(0.9, k.st[6]) * (TNK_CLASSES[k.cls].rl || 1) * (1 + (f - 1) * 0.3); },
    speed: function(k) { return (3.4 + 0.28 * k.st[7] - k.lvl * 0.02) * (TNK_CLASSES[k.cls].speed || 1) * arenaSpeed(k); },
    size: function(k) { if (k.mixMass > 0 && this.mixLayer) return Math.sqrt(k.mixMass) * 5; return 30 + k.lvl * 0.45; },      // Arena Mix: a tank's size follows its mass, like a blob

    reset: function() {
        this.tanks = []; this.shapes = []; this.bullets = []; this.pending = []; this.t = 0;
        for (let i = 0; i < TNK.SHAPES; i++) this.addShape();
        this.addTank({ human: 0, name: "P1", color: "#ff5a5f" });
        if (multiplayer) this.addTank({ human: 1, name: "P2", color: "#3da5ff" });
        for (let i = 0; i < TNK.CPUS; i++) this.addTank({ name: TNK_NAMES[i % TNK_NAMES.length], color: TNK_COLORS[i % TNK_COLORS.length] });
    },
    addShape: function() {
        var r = Math.random(), mid = Math.random() < 0.25;
        var type = mid ? (r < 0.5 ? "penta" : "tri") : (r < 0.08 ? "penta" : (r < 0.35 ? "tri" : "square"));
        var x, y;
        if (mid) { var a = Math.random() * 6.28, d = Math.random() * 700; x = Math.cos(a) * d; y = Math.sin(a) * d; }
        else { x = (Math.random() - 0.5) * (TNK.W - 200); y = (Math.random() - 0.5) * (TNK.H - 200); }
        var S = TNK_SHAPES[type];
        this.shapes.push({ type: type, x: x, y: y, vx: 0, vy: 0, hp: S.hp, max: S.hp, ang: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.02, drift: Math.random() * 6.28, hitT: 0 });
    },
    addTank: function(o) {
        var k = { name: o.name, color: o.color, human: o.human, st: [0, 0, 0, 0, 0, 0, 0, 0], kills: 0 };
        this.tanks.push(k); this.spawn(k); return k;
    },
    spawn: function(k) {
        var x, y;
        for (let tries = 0; tries < 20; tries++) {
            x = (Math.random() - 0.5) * (TNK.W - 800); y = (Math.random() - 0.5) * (TNK.H - 800);
            if (Math.hypot(x, y) > 900 && this.tanks.every(function(o) { return o === k || !o.alive || Math.hypot(o.x - x, o.y - y) > 900; })) break;
        }
        k.x = x; k.y = y; k.vx = 0; k.vy = 0; k.ang = 0; k.alive = true; k.deadT = 0; k.lvl = 1; k.xp = 0; k.score = 0;
        k.st = [0, 0, 0, 0, 0, 0, 0, 0]; k.pts = 0; k.cls = "basic"; k.choose = false; k.reloadT = 0; k.barrelT = []; k.hurtT = 0; k.inv = 120;
        k.hp = this.maxHp(k);
    },

    gainXp: function(k, n) {
        k.xp += n; k.score += n;
        while (k.lvl < 45 && k.xp >= this.xpFor(k.lvl)) {
            k.xp -= this.xpFor(k.lvl); k.lvl++;
            if (k.lvl <= 30 || k.lvl % 3 === 0) k.pts++;
            var C = TNK_CLASSES[k.cls];
            if ((k.lvl === 15 && C.tier === 0) || (k.lvl === 30 && C.tier === 1)) k.choose = true;
            k.hp = Math.min(this.maxHp(k), k.hp + 10);
            if (k.human !== undefined && typeof SFX !== "undefined") SFX.play("select", k.x, k.y, 0.6, 1.3);
        }
        if (k.human === undefined || k.human === 1 || k.human === "lan") this.autoSpend(k);
    },
    addStat: function(k, i) { if (k.pts > 0 && k.st[i] < 7) { k.st[i]++; k.pts--; if (i === 1) k.hp += 20; return true; } return false; },
    pickClass: function(k, id) { if (!k.choose) return; k.cls = id; k.choose = false; k.barrelT = []; if (k.human !== undefined) showBanner(TNK_CLASSES[id].name.toUpperCase() + "!", "new class", k.color); },
    autoSpend: function(k) {
        var pref = k.human === 1 ? [6, 5, 3, 4, 1, 7, 0, 2] : [[6, 5, 3, 4, 1, 7, 0, 2], [7, 2, 1, 0, 6, 5, 3, 4], [5, 4, 6, 3, 1, 0, 7, 2]][k.name.length % 3];
        var guard = 0;
        while (k.pts > 0 && guard++ < 40) { for (let i = 0; i < pref.length && k.pts > 0; i++) if (k.st[pref[i]] < Math.min(7, 2 + (guard >> 1))) this.addStat(k, pref[i]); }
        if (k.choose) { var nx = TNK_CLASSES[k.cls].next; this.pickClass(k, nx[(Math.random() * nx.length) | 0]); }
    },

    // ---------------- control
    control: function(k) {
        var mx = 0, my = 0, fire = false;
        if (k.human === 0) {
            var pad = (typeof Pads !== "undefined") ? Pads.state[0] : null;
            mx = (WASDrightPressed ? 1 : 0) - (WASDleftPressed ? 1 : 0); my = (WASDdownPressed ? 1 : 0) - (WASDupPressed ? 1 : 0);
            if (pad && pad.active) { if (pad.left) mx = -1; if (pad.right) mx = 1; if (pad.up) my = -1; if (pad.down) my = 1; }
            if (pad && pad.active && pad.aim) k.ang = Math.atan2(pad.aim[1], pad.aim[0]);
            else { var s = this.toScreen(k.x, k.y); k.ang = Math.atan2(mouseY - s[1], mouseX - s[0]); }
            fire = mouseDown || this.auto || !!(pad && pad.active && pad.shoot);
        } else if (k.human === 1) {
            var p2 = (typeof Pads !== "undefined") ? Pads.state[1] : null;
            mx = (ULDRrightPressed || (p2 && p2.active && p2.right) ? 1 : 0) - (ULDRleftPressed || (p2 && p2.active && p2.left) ? 1 : 0);
            my = (ULDRdownPressed || (p2 && p2.active && p2.down) ? 1 : 0) - (ULDRupPressed || (p2 && p2.active && p2.up) ? 1 : 0);
            var tg = this.nearestTarget(k, 700);
            if (tg) k.ang = Math.atan2(tg.y - k.y, tg.x - k.x);
            fire = !!PlayerInput[1].kbShoot || !!(p2 && p2.active && p2.shoot);
        } else if (k.human === "lan") {
            var x = Net.peerX(k.pid);
            mx = x.mx || 0; my = x.my || 0; if (x.a !== undefined) k.ang = x.a; fire = !!x.f;
        } else {
            var c = this.cpu(k); mx = c[0]; my = c[1]; fire = c[2];
        }
        var L = Math.hypot(mx, my);
        if (L) { var sp = this.speed(k) * 0.12; k.vx += mx / L * sp; k.vy += my / L * sp; }
        if (fire) this.fire(k);
    },
    nearestTarget: function(k, range) {
        var best = null, bd = range;
        for (let i = 0; i < this.tanks.length; i++) { var o = this.tanks[i]; if (o !== k && o.alive) { var d = Math.hypot(o.x - k.x, o.y - k.y); if (d < bd) { bd = d; best = o; } } }
        if (best) return { x: best.x + best.vx * 8, y: best.y + best.vy * 8 };
        if (typeof Mix !== "undefined" && Mix.on) {
            for (let i = 0; i < Snake.worms.length; i++) { var sw = Snake.worms[i]; if (!sw.alive) continue; var sd = Math.hypot(sw.segs[0].x - k.x, sw.segs[0].y - k.y); if (sd < bd) { bd = sd; best = sw.segs[0]; } }
            if (best) return { x: best.x, y: best.y };
        }
        for (let i = 0; i < this.shapes.length; i++) { var s = this.shapes[i], d2 = Math.hypot(s.x - k.x, s.y - k.y); if (d2 < bd) { bd = d2; best = s; } }
        return best;
    },
    cpu: function(k) {
        var hpFrac = k.hp / this.maxHp(k), maxFd = [0, 500, 700, 900][arenaCheats.tankSkill], fd = maxFd, foe = null;
        for (let i = 0; i < this.tanks.length; i++) { var o = this.tanks[i]; if (o !== k && o.alive && o.inv <= 0) { var d = Math.hypot(o.x - k.x, o.y - k.y); if (d < fd) { fd = d; foe = o; } } }
        if (typeof Mix !== "undefined" && Mix.on && maxFd > 0) {
            if (typeof Cells !== "undefined") {
                for (let i = 0; i < Cells.blobs.length; i++) {
                    var b = Cells.blobs[i];
                    if (b.dead || Cells.protectedNow(b.pl)) continue;
                    var bd = Math.hypot(b.x - k.x, b.y - k.y);
                    if (bd < fd) { fd = bd; foe = { x: b.x, y: b.y, vx: b.vx || 0, vy: b.vy || 0, lvl: Math.round(b.m / 20), isBlob: true, m: b.m }; }
                }
            }
            if (typeof Snake !== "undefined") {
                for (let i = 0; i < Snake.worms.length; i++) {
                    var w = Snake.worms[i];
                    if (!w.alive || w.safeT > 0 || !w.segs || !w.segs.length) continue;
                    var wh = w.segs[0], wd = Math.hypot(wh.x - k.x, wh.y - k.y);
                    if (wd < fd) { fd = wd; foe = { x: wh.x, y: wh.y, vx: Math.cos(w.ang) * 3.5, vy: Math.sin(w.ang) * 3.5, lvl: Math.round(w.len / 15), isWorm: true }; }
                }
            }
        }
        var mx = 0, my = 0, fire = false, aim = null;
        if (foe && foe.isBlob && foe.m > k.mixMass * 1.25) {
            mx = -(foe.x - k.x); my = -(foe.y - k.y); aim = { x: foe.x + foe.vx * fd / 14, y: foe.y + foe.vy * fd / 14 }; fire = true;
        } else if (foe && (hpFrac > 0.4 || foe.lvl < k.lvl - 5)) {
            aim = { x: foe.x + foe.vx * fd / 14, y: foe.y + foe.vy * fd / 14 };
            var want = (foe.isBlob && k.mixMass > foe.m * 1.35) ? 0 : (420 + (TNK_CLASSES[k.cls].fov ? 250 : 0));         // ram smaller blobs, keep fighting distance from others
            var dir = fd > want ? 1 : -0.7;
            mx = (foe.x - k.x) / (fd || 1) * dir; my = (foe.y - k.y) / (fd || 1) * dir;
            mx += Math.cos(this.t * 0.02 + k.name.length) * 0.6; my += Math.sin(this.t * 0.02 + k.name.length) * 0.6;   // strafe
            fire = true;
        } else if (foe && hpFrac <= 0.4) {
            mx = -(foe.x - k.x); my = -(foe.y - k.y); aim = foe; fire = true;               // run, shooting back
        } else {
            var s = null, sd = 1e9;
            for (let i = 0; i < this.shapes.length; i++) { var q = this.shapes[i], d2 = Math.hypot(q.x - k.x, q.y - k.y) / TNK_SHAPES[q.type].xp; if (d2 < sd && (q.type !== "penta" || k.lvl > 12)) { sd = d2; s = q; } }
            if (s) { aim = s; var dd = Math.hypot(s.x - k.x, s.y - k.y); if (dd > 260) { mx = (s.x - k.x) / dd; my = (s.y - k.y) / dd; } fire = dd < 650; }
        }
        // stay inside the walls
        if (k.x < -TNK.W / 2 + 300) mx = 1; if (k.x > TNK.W / 2 - 300) mx = -1; if (k.y < -TNK.H / 2 + 300) my = 1; if (k.y > TNK.H / 2 - 300) my = -1;
        if (aim) { var ta = Math.atan2(aim.y - k.y, aim.x - k.x), da = ((ta - k.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI; k.ang += Math.max(-0.05 * arenaCheats.tankSkill, Math.min(0.05 * arenaCheats.tankSkill, da)); }
        return [mx, my, fire];
    },

    fire: function(k) {
        var C = TNK_CLASSES[k.cls], rl = this.reload(k);
        if (k.reloadT > 0) return;
        k.reloadT = rl;
        var r = this.size(k), mf = this.massFactor(k);
        for (let i = 0; i < C.b.length; i++) {
            var B = C.b[i];
            var go = function() {
                if (!k.alive) return;
                var a = k.ang + (B.a || 0) + (C.spread ? (Math.random() - 0.5) * C.spread : 0);
                var ca = Math.cos(a), sa = Math.sin(a), off = (B.off || 0) * r / 30;
                var spd = (7 + 0.9 * k.st[3]) * (C.sp || 1) * (B.thrust ? 0.8 : 1);
                var bx = k.x + ca * r * 1.6 * (B.len || 1) - sa * off, by = k.y + sa * r * 1.6 * (B.len || 1) + ca * off;
                var blife = 110 + k.st[3] * 6;
                Tanks.bullets.push({ x: bx, y: by, vx: ca * spd + k.vx * 0.5, vy: sa * spd + k.vy * 0.5, r: 9 * (r / 30) * (C.size || 1) * (B.w ? Math.min(1.4, B.w * 0.8) : 1), dmg: (5.5 + 1.6 * k.st[5]) * (C.dm || 1) * mf, pen: (1 + 0.8 * k.st[4]) * (C.size || 1), owner: k, life: blife, maxLife: blife });
                var rec = (C.recoil || 0.35) * (B.thrust ? 2.2 : 1);
                k.vx -= ca * rec * 0.3; k.vy -= sa * rec * 0.3;
                k.recoilT = 4;
            };
            if (B.d) this.pending.push({ t: this.t + Math.round(rl * B.d), fn: go }); else go();      // staggered barrels (frame-timed, so pausing pauses them)
        }
        if (k.human !== undefined && typeof SFX !== "undefined" && this.t % 3 === 0) SFX.play("shoot", k.x, k.y, 0.25, 1.1);
    },

    hurt: function(k, dmg, by) {
        if (!k.alive || k.inv > 0 || arenaProtected(k)) return;
        if (by && by.human === undefined && arenaHuman(k)) dmg *= [0, 0.55, 0.8, 1][arenaCheats.tankSkill];
        k.hp -= dmg; k.hurtT = 240; k.flash = 5;
        if (k.hp <= 0) {
            k.alive = false; k.deadT = 0; k.by = by;
            if (by && by.alive !== undefined) { by.kills++; this.gainXp(by, Math.round(Math.min(this.xpFor(k.lvl) * 2, 50 + k.score * 0.5))); }
            if (k.human !== undefined) {
                k.final = k.score;
                if (k.human === "lan") return;
                if (k.score > tanksSave.best) { tanksSave.best = k.score; try { localStorage.setItem("timsTankArena", JSON.stringify(tanksSave)); } catch (e) {} }
                if (typeof SFX !== "undefined") SFX.play("ko");
            } else if (by && by.human !== undefined) showBanner(by.name + " destroyed " + k.name + "!", "", by.color);
        }
    },

    step: function() {
        this.t++;
        for (let i = this.pending.length - 1; i >= 0; i--) if (this.pending[i].t <= this.t) { var pf = this.pending[i].fn; this.pending.splice(i, 1); pf(); }
        var T = this.tanks;
        for (let i = 0; i < T.length; i++) {
            var k = T[i];
            if (!k.alive) { if (k.human === undefined && ++k.deadT > 200) this.spawn(k); continue; }
            if (k.inv > 0) k.inv--;
            if (k.reloadT > 0) k.reloadT--;
            if (k.flash > 0) k.flash--;
            this.control(k);
            k.x += k.vx; k.y += k.vy; k.vx *= 0.88; k.vy *= 0.88;
            k.x = Math.max(-TNK.W / 2, Math.min(TNK.W / 2, k.x)); k.y = Math.max(-TNK.H / 2, Math.min(TNK.H / 2, k.y));
            var M = this.maxHp(k);
            if (k.hurtT > 0) k.hurtT--; else k.hp = Math.min(M, k.hp + M * 0.0006 * (1 + k.st[0]));
            if (k.hp < M && k.hurtT <= 0 && k.st[0] > 0) k.hp = Math.min(M, k.hp + M * 0.0004 * k.st[0]);
        }
        // shapes drift and spin
        for (let i = 0; i < this.shapes.length; i++) {
            var s = this.shapes[i];
            s.drift += 0.003; s.x += Math.cos(s.drift) * 0.15 + s.vx; s.y += Math.sin(s.drift) * 0.15 + s.vy; s.vx *= 0.9; s.vy *= 0.9; s.ang += s.spin;
            if (s.hitT > 0) s.hitT--;
        }
        // bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            var b = this.bullets[i];
            b.x += b.vx; b.y += b.vy;
            if (--b.life <= 0 || b.pen <= 0) { this.bullets.splice(i, 1); continue; }
            for (let j = 0; j < this.shapes.length && b.pen > 0; j++) {
                var sh = this.shapes[j], R = TNK_SHAPES[sh.type].r;
                if (Math.abs(sh.x - b.x) > R + b.r || Math.abs(sh.y - b.y) > R + b.r) continue;
                if (Math.hypot(sh.x - b.x, sh.y - b.y) < R + b.r) {
                    sh.hp -= b.dmg; sh.hitT = 4; sh.vx += b.vx * 0.06; sh.vy += b.vy * 0.06; b.pen -= 1;
                    if (sh.hp <= 0) { this.gainXp(b.owner, TNK_SHAPES[sh.type].xp); this.shapes.splice(j, 1); j--; }
                }
            }
            for (let j = 0; j < this.tanks.length && b.pen > 0; j++) {
                var tk = this.tanks[j];
                if (tk === b.owner || !tk.alive) continue;
                var tr = this.size(tk);
                if (Math.hypot(tk.x - b.x, tk.y - b.y) < tr + b.r) { this.hurt(tk, b.dmg, b.owner); tk.vx += b.vx * 0.04; tk.vy += b.vy * 0.04; b.pen -= 1.5; }
            }
            // bullets of different owners cancel each other out
            for (let j = i - 1; j >= 0 && b.pen > 0; j--) {
                var c = this.bullets[j];
                if (c.owner === b.owner || Math.abs(c.x - b.x) > c.r + b.r || Math.abs(c.y - b.y) > c.r + b.r) continue;
                var x = Math.min(b.pen, c.pen); b.pen -= x; c.pen -= x;
            }
        }
        // body contact: tanks ram shapes and each other
        for (let i = 0; i < T.length; i++) {
            var k2 = T[i];
            if (!k2.alive) continue;
            var r2 = this.size(k2), body = 1.2 + 1.2 * k2.st[2];
            for (let j = this.shapes.length - 1; j >= 0; j--) {
                var s2 = this.shapes[j], R2 = TNK_SHAPES[s2.type].r, d = Math.hypot(s2.x - k2.x, s2.y - k2.y);
                if (d < r2 + R2) {
                    var nx = (s2.x - k2.x) / (d || 1), ny = (s2.y - k2.y) / (d || 1);
                    s2.vx += nx * 2; s2.vy += ny * 2; k2.vx -= nx * 0.8; k2.vy -= ny * 0.8;
                    s2.hp -= body; this.hurt(k2, TNK_SHAPES[s2.type].sides * 0.35, null);
                    if (s2.hp <= 0) { this.gainXp(k2, TNK_SHAPES[s2.type].xp); this.shapes.splice(j, 1); }
                }
            }
            for (let j = i + 1; j < T.length; j++) {
                var o = T[j];
                if (!o.alive) continue;
                var dd = Math.hypot(o.x - k2.x, o.y - k2.y), ro = this.size(o);
                if (dd < r2 + ro) {
                    var ux = (o.x - k2.x) / (dd || 1), uy = (o.y - k2.y) / (dd || 1);
                    o.vx += ux * 3; o.vy += uy * 3; k2.vx -= ux * 3; k2.vy -= uy * 3;
                    this.hurt(o, 1.2 + 1.2 * k2.st[2], k2); this.hurt(k2, 1.2 + 1.2 * o.st[2], o);
                }
            }
        }
        while (this.shapes.length < TNK.SHAPES) this.addShape();
    },

    toScreen: function(x, y) { var c = this.cam; return [(x - c.x) * c.z + cssW / 2, (y - c.y) * c.z + cssH / 2]; },

    drawTank: function(k) {
        var s = this.toScreen(k.x, k.y), Z = this.cam.z, r = this.size(k) * Z, C = TNK_CLASSES[k.cls];
        if (s[0] < -r * 4 || s[1] < -r * 4 || s[0] > cssW + r * 4 || s[1] > cssH + r * 4) return;
        ctx.save();
        if (k.inv > 0) ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.t * 0.4);
        ctx.translate(s[0], s[1]);
        for (let i = 0; i < C.b.length; i++) {
            var B = C.b[i], len = r * 1.75 * (B.len || 1), w = r * 0.75 * (B.w || 1) * (C.size ? 1.2 : 1);
            ctx.save(); ctx.rotate(k.ang + (B.a || 0));
            ctx.fillStyle = "#94a3b8"; ctx.strokeStyle = "#475569"; ctx.lineWidth = 3;
            var off = (B.off || 0) * r / 30;
            if (C.spread) { ctx.beginPath(); ctx.moveTo(0, off - w * 0.35); ctx.lineTo(len, off - w / 2); ctx.lineTo(len, off + w / 2); ctx.lineTo(0, off + w * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke(); }
            else { ctx.fillRect(0, off - w / 2, len, w); ctx.strokeRect(0, off - w / 2, len, w); }
            ctx.restore();
        }
        ctx.fillStyle = k.flash > 0 ? "#ffffff" : k.color; ctx.strokeStyle = Components.shade(k.color, -50); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
        ctx.restore();
        var M = this.maxHp(k);
        if (k.hp < M) { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(s[0] - r, s[1] + r + 8, r * 2, 6); ctx.fillStyle = "#4ade80"; ctx.fillRect(s[0] - r, s[1] + r + 8, r * 2 * Math.max(0, k.hp / M), 6); }
        uiText(k.name + "  Lv " + k.lvl, s[0], s[1] - r - 10, k.human !== undefined ? 13 : 11, k.human !== undefined ? "#fff" : "rgba(226,232,240,0.75)", "center", "900");
    },

    render: function() {
        var hum = this.locals().filter(function(k) { return k.alive; });
        var tx = this.cam.x, ty = this.cam.y, fov = 1, span = 0;
        if (hum.length) {
            tx = 0; ty = 0; hum.forEach(function(k) { tx += k.x; ty += k.y; fov = Math.max(fov, (TNK_CLASSES[k.cls].fov || 1) * (1 + k.lvl * 0.006)); });
            tx /= hum.length; ty /= hum.length;
            if (hum.length > 1) span = Math.hypot(hum[0].x - hum[1].x, hum[0].y - hum[1].y);
        }
        var z = 0.85 / fov;
        if (span) z = Math.min(z, Math.min(cssW, cssH) * 0.8 / (span + 500));
        this.cam.x += (tx - this.cam.x) * 0.15; this.cam.y += (ty - this.cam.y) * 0.15; this.cam.z += (Math.max(0.3, z) - this.cam.z) * 0.05;
        var c = this.cam, Z = c.z;
        if (!this.mixLayer) { ctx.fillStyle = Theme.bg(); ctx.fillRect(0, 0, cssW, cssH); }      // Arena Mix draws one shared floor
        var tl = this.toScreen(-TNK.W / 2, -TNK.H / 2), br = this.toScreen(TNK.W / 2, TNK.H / 2);
        ctx.fillStyle = Theme.floor("#121a30"); ctx.fillRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
        var mid = this.toScreen(0, 0);
        ctx.fillStyle = "rgba(129,140,248,0.06)"; ctx.beginPath(); ctx.arc(mid[0], mid[1], 750 * Z, 0, 7); ctx.fill();
        ctx.strokeStyle = Theme.grid("#1c2744"); ctx.lineWidth = 1; ctx.beginPath();
        var g = 40, x0 = Math.max(-TNK.W / 2, Math.floor((c.x - cssW / 2 / Z) / g) * g), x1 = Math.min(TNK.W / 2, c.x + cssW / 2 / Z), y0 = Math.max(-TNK.H / 2, Math.floor((c.y - cssH / 2 / Z) / g) * g), y1 = Math.min(TNK.H / 2, c.y + cssH / 2 / Z);
        for (let x = x0; x <= x1; x += g) { var a = this.toScreen(x, y0), b = this.toScreen(x, y1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        for (let y = y0; y <= y1; y += g) { var a2 = this.toScreen(x0, y), b2 = this.toScreen(x1, y); ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]); }
        ctx.stroke();
        // shapes
        for (let i = 0; i < this.shapes.length; i++) {
            var s = this.shapes[i], S = TNK_SHAPES[s.type], p = this.toScreen(s.x, s.y), R = S.r * Z;
            if (p[0] < -R || p[1] < -R || p[0] > cssW + R || p[1] > cssH + R) continue;
            ctx.fillStyle = s.hitT > 0 ? "#ffffff" : S.col; ctx.strokeStyle = Components.shade(S.col, -60); ctx.lineWidth = 3;
            ctx.beginPath();
            for (let k = 0; k <= S.sides; k++) { var an = s.ang + k / S.sides * Math.PI * 2; ctx.lineTo(p[0] + Math.cos(an) * R, p[1] + Math.sin(an) * R); }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            if (s.hp < s.max) { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(p[0] - R, p[1] + R + 4, R * 2, 4); ctx.fillStyle = "#4ade80"; ctx.fillRect(p[0] - R, p[1] + R + 4, R * 2 * s.hp / s.max, 4); }
        }
        // bullets
        for (let i = 0; i < this.bullets.length; i++) {
            var bl = this.bullets[i], bp = this.toScreen(bl.x, bl.y);
            if (bp[0] < -30 || bp[1] < -30 || bp[0] > cssW + 30 || bp[1] > cssH + 30) continue;
            ctx.fillStyle = bl.owner.color; ctx.strokeStyle = Components.shade(bl.owner.color, -50); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(bp[0], bp[1], bl.r * Z, 0, 7); ctx.fill(); ctx.stroke();
        }
        for (let i = 0; i < this.tanks.length; i++) if (this.tanks[i].alive) this.drawTank(this.tanks[i]);
        ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 4; ctx.strokeRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
    },

    hud: function() {
        var me = this.locals()[0];
        var sideOpen = typeof SandboxUI !== "undefined" && (SandboxUI.sideOpen || SandboxUI.pauseOpen);
        var lx = sideOpen ? 320 : 12;
        if (!this.mixLayer) {
            if (!sideOpen) {
                uiPanel(lx, 50, 330, 60, "#60a5fa");
                uiText("TANK ARENA", lx + 16, 78, 22, "#93c5fd", "left", "900");
                uiText(this.tanks.filter(function(k) { return k.human !== undefined; }).map(function(k) { return k.name + " " + (k.alive ? "Lv " + k.lvl + " · " + k.score : "✖"); }).join("   ") + "   best " + tanksSave.best, lx + 16, 98, 12, "#cbd5e1", "left", "800");
            }
            // leaderboard
            var lb = this.tanks.filter(function(k) { return k.alive; }).sort(function(a, b) { return b.score - a.score; });
            uiPanel(cssW - 214, 14, 200, 30 + lb.length * 18, "#60a5fa", 0.85);
            uiText("SCOREBOARD", cssW - 114, 34, 12, "#93c5fd", "center", "900");
            for (let i = 0; i < lb.length; i++) {
                var k = lb[i];
                uiText((i + 1) + ". " + k.name + " · " + TNK_CLASSES[k.cls].name, cssW - 202, 54 + i * 18, 11, k.human !== undefined ? "#fde047" : k.color, "left", k.human !== undefined ? "900" : "700");
                uiText(String(k.score), cssW - 26, 54 + i * 18, 11, "#e2e8f0", "right", "800");
            }
        }
        this.statRects = []; this.classRects = [];
        if (me && me.alive) {
            // XP bar
            var bw = Math.min(520, cssW - 300), bx = cssW / 2 - bw / 2, by = cssH - 58;
            ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(bx, by, bw, 16);
            ctx.fillStyle = "#fde047"; ctx.fillRect(bx, by, bw * Math.min(1, me.xp / this.xpFor(me.lvl)), 16);
            uiText("Lv " + me.lvl + " " + TNK_CLASSES[me.cls].name + "   ·   score " + me.score, cssW / 2, by + 13, 12, "#ffffff", "center", "900");
            // stats (always visible; brighter when you have points)
            var sx = lx + 2, sy = cssH - 40 - 8 * 20;
            uiPanel(sx - 4, sy - 26, 236, 8 * 20 + 30, "#60a5fa", 0.8);
            uiText(me.pts > 0 ? "×" + me.pts + " POINTS — press 1-8" : "STATS", sx + 6, sy - 8, 12, me.pts > 0 ? "#fde047" : "#94a3b8", "left", "900");
            for (let i = 0; i < 8; i++) {
                var y = sy + i * 20;
                ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(sx + 6, y, 160, 15);
                for (let j = 0; j < me.st[i]; j++) { ctx.fillStyle = TNK_STAT_COL[i]; ctx.fillRect(sx + 6 + j * 23, y + 1, 21, 13); }
                uiText((i + 1) + " " + TNK_STATS[i], sx + 10, y + 12, 10, "#f8fafc", "left", "800");
                if (me.pts > 0 && me.st[i] < 7) uiText("+", sx + 186, y + 13, 16, "#fde047", "center", "900");
                this.statRects.push([sx, y, 200, 18, i]);
            }
            // class choice
            if (me.choose) {
                var nx = TNK_CLASSES[me.cls].next, keys = ["U", "I", "O", "P"], baseY = this.mixLayer ? 128 : 100;
                uiText("PICK A CLASS", lx + 8, baseY, 14, "#fde047", "left", "900");
                for (let i = 0; i < nx.length; i++) {
                    var cx = lx + 2 + (i % 2) * 112, cy = baseY + 10 + Math.floor(i / 2) * 92;
                    uiPanel(cx, cy, 104, 84, TNK_STAT_COL[i * 2], 0.9);
                    this.drawTankIcon({ ang: -0.6, cls: nx[i], color: me.color }, cx + 52, cy + 38);
                    uiText(keys[i] + " " + TNK_CLASSES[nx[i]].name, cx + 52, cy + 78, 11, "#fff", "center", "900");
                    this.classRects.push([cx, cy, 104, 84, nx[i]]);
                }
            }
        } else if (me) {
            uiPanel(cssW / 2 - 210, cssH / 2 - 50, 420, 100, me.color, 0.92);
            uiText(me.name + (me.by ? " destroyed by " + me.by.name : " destroyed"), cssW / 2, cssH / 2 - 14, 22, "#fff", "center", "900");
            uiText("score " + me.final + "  ·  " + (me.deadT > 60 ? "click / Space to play again" : "…"), cssW / 2, cssH / 2 + 22, 15, "#cbd5e1", "center", "800");
        }
        if (!this.mixLayer) {
            uiText("WASD move · mouse aim · hold click fire · E auto-fire" + (this.auto ? " (ON)" : "") + " · 1-8 stats · U/I/O/P class · Esc menu" + (multiplayer ? " · P2: arrows + Enter (auto-aim)" : ""), cssW / 2, cssH - 14, 12, "rgba(220,230,240,0.7)", "center", "700");
        }
    },
    // a small tank picture for the class cards (screen coordinates)
    drawTankIcon: function(k, sx, sy) {
        var C = TNK_CLASSES[k.cls], r = 15;
        ctx.save(); ctx.translate(sx, sy);
        for (let i = 0; i < C.b.length; i++) {
            var B = C.b[i], len = r * 1.75 * (B.len || 1), w = r * 0.75 * (B.w || 1);
            ctx.save(); ctx.rotate(k.ang + (B.a || 0)); ctx.fillStyle = "#94a3b8"; ctx.strokeStyle = "#475569"; ctx.lineWidth = 2;
            var off = (B.off || 0) * r / 30; ctx.fillRect(0, off - w / 2, len, w); ctx.strokeRect(0, off - w / 2, len, w); ctx.restore();
        }
        ctx.fillStyle = k.color; ctx.strokeStyle = "#7f1d1d"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
        ctx.restore();
    },
    swapBot: function(pid) {
        var cur = pid !== undefined
            ? this.tanks.find(function(k) { return k.pid === pid; })
            : this.tanks.find(function(k) { return k.human === 0; });
        var bots = this.tanks.filter(function(k) { return k.alive && k.human === undefined && k !== cur; });
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
        if (pid === undefined) {
            this.cam.x = bot.x; this.cam.y = bot.y;
            if (typeof showBanner === "function") showBanner("SWAPPED", "Now controlling " + (bot.name || "Tank"), "#38bdf8");
        }
        return true;
    }
};

ModeKit.addLevel("tanks_arena", { name: "🛡 Tank Arena", mode: "tanks", wavesEnabled: false, spawnP1: [0, 60], spawnP2: [60, 60], layout: ModeKit.room(-600, 600, 800, {}), title: "Tank Arena" });

GameModes.register({
    id: "tanks",
    title: "TANK ARENA",
    tagline: "Diep-style arena: shoot shapes for XP, level up, upgrade stats and evolve your tank.",
    color: "#60a5fa",
    firstLevel: "tanks_arena",
    flags: { ownScreen: true, botSwap: true, waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, scenery: false, coopToggle: true },
    overTitle: "TANK ARENA",

    seats: function() {
        return [{ label: "P1", options: ["human"], value: "human", set: function() {} },
            { label: "P2 (arrows / pad 2)", options: ["human", "off"], value: multiplayer ? "human" : "off", set: function(v) { multiplayer = v === "human"; Tanks.reset(); } },
            { label: "CPU opponents", count: true, value: TNK.CPUS, min: 0, max: 14, set: function(v) { TNK.CPUS = Math.max(0, Math.min(14, v)); Tanks.reset(); } }];
    },
    setupLevel: function() { Tanks.reset(); },

    screenFrame: function() {
        for (let i = 0; i < Tanks.tanks.length; i++) {
            var k = Tanks.tanks[i];
            if (k.alive || k.human === undefined) continue;
            k.deadT++;
            var pad = (typeof Pads !== "undefined") ? Pads.state[k.human] : null;
            var again = k.human === 0 ? (mouseDown || SpacePressed || !!(pad && pad.active && pad.shoot)) : (!!PlayerInput[1].kbShoot || !!(pad && pad.active && pad.shoot));
            if (k.deadT > 60 && again) Tanks.spawn(k);
        }
        Tanks.lanSync();
        Tanks.step();
        Tanks.render();
        Tanks.hud();
    },
    screenDraw: function() {
        Tanks.t++;
        var now = performance.now();
        for (let i = Tanks.bullets.length - 1; i >= 0; i--) {
            var b = Tanks.bullets[i];
            if (b.vx || b.vy) { b.x += b.vx; b.y += b.vy; }
            if (b._hit) { Tanks.bullets.splice(i, 1); continue; }
            for (let j = 0; j < Tanks.shapes.length; j++) {
                var q = Tanks.shapes[j], sr = TNK_SHAPES[q.type] ? TNK_SHAPES[q.type].r : 18;
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
            if (b._hit || (b._pred && now - (b._born || 0) > 1200)) Tanks.bullets.splice(i, 1);
        }
        var me = Tanks.locals()[0];
        for (let i = 0; i < Tanks.tanks.length; i++) {
            var k = Tanks.tanks[i];
            if (!k.alive || k === me) continue;
            if (k._tx !== undefined) {
                k.x += (k._tx - k.x) * 0.45;
                k.y += (k._ty - k.y) * 0.45;
                var da = Math.atan2(Math.sin(k._ta - k.ang), Math.cos(k._ta - k.ang));
                k.ang += da * 0.45;
            }
        }
        if (me && me.alive && typeof Net !== "undefined" && Net.role === "client") {
            var sc = Tanks.toScreen(me.x, me.y);
            me.ang = Math.atan2(mouseY - sc[1], mouseX - sc[0]);
            var mx = (WASDrightPressed ? 1 : 0) - (WASDleftPressed ? 1 : 0), my = (WASDdownPressed ? 1 : 0) - (WASDupPressed ? 1 : 0);
            if (mx || my) {
                var sp = 3.2 + (me.st ? me.st[7] * 0.45 : 0);
                var len = Math.hypot(mx, my) || 1;
                me.x += (mx / len) * sp; me.y += (my / len) * sp;
            }
            if (me._tx !== undefined) {
                var d = Math.hypot(me._tx - me.x, me._ty - me.y);
                if (d >= 120) { me.x = me._tx; me.y = me._ty; }
                else if (d > 8) { me.x += (me._tx - me.x) * 0.12; me.y += (me._ty - me.y) * 0.12; }
            }
            me._localCd = Math.max(0, (me._localCd || 0) - 1);
            if ((mouseDown || SpacePressed) && me._localCd <= 0) {
                var cls = (typeof TNK_CLASSES !== "undefined" && TNK_CLASSES[me.cls]) ? TNK_CLASSES[me.cls] : { b: [{ a: 0, off: 0, len: 1, w: 1 }], reload: 1 };
                var st = me.st || [0,0,0,0,0,0,0,0];
                me._localCd = Math.max(6, Math.round((24 - st[6] * 2) * (cls.reload || 1)));
                var ks = Tanks.size ? Tanks.size(me) : 22;
                var bsp = (7.5 + st[3] * 0.7), bdmg = (5 + st[4] * 2.2) * (cls.dmg || 1);
                for (let bi = 0; bi < cls.b.length; bi++) {
                    var B = cls.b[bi], ang = me.ang + (B.a || 0);
                    var bw = ks * 0.42 * (B.w || 1), blen = ks * 1.15 * (B.len || 1);
                    var ox = Math.cos(me.ang + 1.57) * ((B.off || 0) * ks / 30), oy = Math.sin(me.ang + 1.57) * ((B.off || 0) * ks / 30);
                    Tanks.bullets.push({
                        x: me.x + ox + Math.cos(ang) * blen, y: me.y + oy + Math.sin(ang) * blen,
                        vx: Math.cos(ang) * bsp, vy: Math.sin(ang) * bsp, r: bw * 0.65,
                        owner: me, dmg: bdmg, _pred: true, _born: now
                    });
                }
                if (typeof SFX !== "undefined") SFX.play("shoot", me.x, me.y, 0.2);
            }
            var ks2 = Tanks.size ? Tanks.size(me) : 22;
            for (let i = 0; i < Tanks.shapes.length; i++) {
                var q2 = Tanks.shapes[i], sr2 = TNK_SHAPES[q2.type] ? TNK_SHAPES[q2.type].r : 18;
                var dx2 = me.x - q2.x, dy2 = me.y - q2.y, d2 = Math.hypot(dx2, dy2);
                if (d2 > 0 && d2 < ks2 + sr2) {
                    var push = (ks2 + sr2 - d2) * 0.5;
                    me.x += dx2 / d2 * push; me.y += dy2 / d2 * push;
                    q2.hitT = 3;
                }
            }
        }
        Tanks.render(); Tanks.hud();
    },
    netInput: function() {
        var me = Tanks.locals()[0], x = { mx: (WASDrightPressed ? 1 : 0) - (WASDleftPressed ? 1 : 0), my: (WASDdownPressed ? 1 : 0) - (WASDupPressed ? 1 : 0), f: (mouseDown || SpacePressed) ? 1 : 0 };
        if (me && me.alive) { var sc = Tanks.toScreen(me.x, me.y); x.a = Math.round(Math.atan2(mouseY - sc[1], mouseX - sc[0]) * 100) / 100; }
        return x;
    },
    netState: function() {
        var T = Tanks.tanks;
        Tanks.netTick = (Tanks.netTick || 0) + 1;
        var fullMeta = (typeof Net !== "undefined" && Net.isFullSnap) || Tanks.netTick % 30 === 1;
        var km = {}, hasKm = false;
        var k = T.map(function(tk) {
            var id = tk.id || (tk.id = Tanks.nextId = (Tanks.nextId || 0) + 1);
            var h = tk.human === undefined ? -1 : tk.human;
            var by = tk.by ? tk.by.name : "";
            var mk = tk.name + "|" + tk.color + "|" + h + "|" + (tk.pid || 0) + "|" + tk.cls + "|" + (tk.st ? tk.st.join(",") : "") + "|" + by + "|" + (tk.final || 0);
            if (fullMeta || tk._nmk !== mk) {
                tk._nmk = mk;
                km[id] = [tk.name, tk.color, h, tk.pid || null, tk.cls, tk.st, by, tk.final || 0];
                hasKm = true;
            }
            return [id, tk.alive ? 1 : 0, Math.round(tk.x), Math.round(tk.y), Math.round(tk.ang * 100) / 100, Math.round(tk.hp), tk.lvl, tk.score, tk.xp, tk.pts, tk.inv, tk.flash, tk.deadT, tk.choose ? 1 : 0];
        });
        var viewPts = T.filter(function(tk) { return tk.human === "lan"; });
        if (typeof Cells !== "undefined" && Cells.players) {
            for (let i = 0; i < Cells.players.length; i++) {
                var cp = Cells.players[i];
                if (cp.human === "lan") viewPts.push({ x: cp.cx || 0, y: cp.cy || 0 });
            }
        }
        if (typeof Snake !== "undefined" && Snake.worms) {
            for (let i = 0; i < Snake.worms.length; i++) {
                var sw = Snake.worms[i];
                if (sw.human === "lan" && sw.segs && sw.segs[0]) viewPts.push(sw.segs[0]);
            }
        }
        var bl = viewPts.length ? Tanks.bullets.filter(function(bb) {
            return viewPts.some(function(tk) { return Math.abs(bb.x - tk.x) < 2600 && Math.abs(bb.y - tk.y) < 1800; });
        }) : Tanks.bullets;
        var st = {
            k: k,
            b: bl.map(function(bb) { return [Math.round(bb.x), Math.round(bb.y), Math.round(bb.r), T.indexOf(bb.owner), Math.round((bb.vx || 0) * 10) / 10, Math.round((bb.vy || 0) * 10) / 10, Math.round((bb.dmg || 5) * 10) / 10]; })
        };
        if (hasKm) st.km = km;
        if ((typeof Net !== "undefined" && Net.isFullSnap) || Tanks.netTick % 3 === 0) {
            var sh = viewPts.length ? Tanks.shapes.filter(function(q) { return viewPts.some(function(tk) { return Math.abs(q.x - tk.x) < 2800 && Math.abs(q.y - tk.y) < 2000; }); }) : Tanks.shapes;
            st.s = sh.map(function(q) { return [q.type.charAt(0), Math.round(q.x), Math.round(q.y), Math.round(q.ang * 100) / 100, Math.round(q.hp), q.hitT]; });
        }
        return st;
    },
    applyNetState: function(m) {
        var mc = Tanks._metaCache || (Tanks._metaCache = {});
        if (m.km) for (var mid in m.km) mc[mid] = m.km[mid];
        var prev = {};
        for (let i = 0; i < Tanks.tanks.length; i++) {
            var pk = Tanks.tanks[i];
            if (pk.alive) prev[(pk.id || pk.pid || pk.name)] = pk;
        }
        Tanks.tanks = m.k.map(function(o) {
            var id = o[0], md = mc[id] || ["Tank", "#38bdf8", -1, null, "tank", [0,0,0,0,0,0,0,0], "", 0];
            var k = {
                id: id, name: md[0], color: md[1], human: md[2] === -1 ? undefined : md[2], pid: md[3],
                cls: md[4], st: md[5], by: md[6] ? { name: md[6] } : null, final: md[7],
                alive: !!o[1], x: o[2], y: o[3], vx: 0, vy: 0, ang: o[4], hp: o[5],
                lvl: o[6], score: o[7], xp: o[8], pts: o[9], inv: o[10], flash: o[11], deadT: o[12], choose: !!o[13],
                _tx: o[2], _ty: o[3], _ta: o[4]
            };
            var old = prev[id] || prev[k.pid || k.name];
            if (old && k.alive && Math.hypot(k.x - old.x, k.y - old.y) < 140) {
                k.x = old.x; k.y = old.y; k.ang = old.ang;
                k._localCd = old._localCd;
            }
            return k;
        });
        var tm = { s: "square", t: "tri", p: "penta" };
        if (m.s) {
            var oldSh = Tanks.shapes;
            Tanks.shapes = m.s.map(function(a) {
                var ty = tm[a[0]], sh = { type: ty, x: a[1], y: a[2], ang: a[3], hp: a[4], max: TNK_SHAPES[ty].hp, hitT: a[5] };
                // preserve local hit flash if we just shot it on client
                for (let j = 0; j < oldSh.length; j++) {
                    var oq = oldSh[j];
                    if (oq.hitT > sh.hitT && Math.abs(oq.x - sh.x) < 16 && Math.abs(oq.y - sh.y) < 16) { sh.hitT = oq.hitT; break; }
                }
                return sh;
            });
        }
        var now = performance.now();
        var oldPred = (Tanks.bullets || []).filter(function(bb) { return bb._pred && !bb._hit && (now - bb._born < 180); });
        var hostBullets = m.b.map(function(a) { return { x: a[0], y: a[1], r: a[2], owner: Tanks.tanks[a[3]] || { color: "#fff" }, vx: a[4] || 0, vy: a[5] || 0, dmg: a[6] || 5 }; });
        for (let i = 0; i < oldPred.length; i++) {
            var pb = oldPred[i];
            var matched = hostBullets.some(function(hb) { return hb.owner === pb.owner && Math.hypot(hb.x - pb.x, hb.y - pb.y) < 75; });
            if (!matched) hostBullets.push(pb);
        }
        Tanks.bullets = hostBullets;
    },

    onKey: function(code) {
        if (code === "KeyV" || code === "BracketRight") {
            if (typeof Net !== "undefined" && Net.role === "client") { Net.send({ t: "sb", act: { k: "swap" } }); return true; }
            return Tanks.swapBot ? Tanks.swapBot() : false;
        }
        var me = Tanks.tanks.find(function(k) { return k.human === 0; });
        if (!me) return false;
        var m = /^Digit([1-8])$/.exec(code);
        if (m) { Tanks.addStat(me, Number(m[1]) - 1); return true; }
        var ci = ["KeyU", "KeyI", "KeyO", "KeyP"].indexOf(code);
        if (ci >= 0 && me.choose) { var nx = TNK_CLASSES[me.cls].next; if (nx[ci]) Tanks.pickClass(me, nx[ci]); return true; }
        if (code === "KeyE") { Tanks.auto = !Tanks.auto; return true; }
        return false;
    },
    onClick: function(wx, wy, button) {
        var me = Tanks.tanks.find(function(k) { return k.human === 0; });
        var hit = function(r) { return mouseX >= r[0] && mouseX <= r[0] + r[2] && mouseY >= r[1] && mouseY <= r[1] + r[3]; };
        if (me) {
            for (let i = 0; i < (Tanks.classRects || []).length; i++) if (hit(Tanks.classRects[i])) { Tanks.pickClass(me, Tanks.classRects[i][4]); mouseDown = false; return true; }
            if (me.pts > 0) for (let i = 0; i < (Tanks.statRects || []).length; i++) if (hit(Tanks.statRects[i])) { Tanks.addStat(me, Tanks.statRects[i][4]); mouseDown = false; return true; }
        }
        return true;
    },
    menuItems: function(items) { items.push({ id: "tk_skill", label: "CPU difficulty: " + ["", "Easy", "Normal", "Hard"][arenaCheats.tankSkill], cycle: true, hint: "Aggression, aim speed and damage" }); items.push({ id: "tk_new", label: "New arena", hint: "" }); },
    onMenu: function(id, dir) { if (id === "tk_skill") { setTankSkill((arenaCheats.tankSkill - 1 + (dir || 1) + 3) % 3 + 1); return true; }
        if (id === "tk_new") { closePause(); Tanks.reset(); return true; } return false; },
    onRestart: function() { Tanks.reset(); },
    overSub: function() { return "Best score " + tanksSave.best; }
});
