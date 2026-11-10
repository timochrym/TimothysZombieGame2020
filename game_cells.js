// ============================================================================
// GAME: BLOB ARENA  (cells)  -  agar-style arena (original)
//   You're a blob. Eat pellets and anything at least 25% smaller than you; avoid anything 25% bigger.
//   Bigger = slower. SPLIT to lunge at prey (your pieces merge back after a while), EJECT mass to feed or bait.
//   Spiky green viruses burst big blobs into pieces - small blobs can hide behind them.
//   P1: mouse moves, Space split, W eject.   P2 (pause → Players): arrows move, Enter split, / eject.
//   Pads: left stick moves, RT split, Y eject.   Runs on its own screen (engine `ownScreen` flag).
// ============================================================================
var CEL = { W: 5200, H: 5200, PELLETS: 2000, CPUS: 14, VIRUSES: 14, MAXCELLS: 12 };
var CEL_NAMES = ["Bubbles", "Gloop", "Jelly", "Mochi", "Pudding", "Slurp", "Dumpling", "Marsh", "Puddle", "Gumdrop", "Wobble", "Bean", "Nugget", "Pebble", "Sprout"];
var CEL_COLORS = ["#f472b6", "#a78bfa", "#34d399", "#fbbf24", "#60a5fa", "#f87171", "#2dd4bf", "#fb923c", "#c084fc", "#a3e635", "#e879f9", "#38bdf8", "#facc15", "#4ade80"];
var cellsSave = { best: 0 };
try { var _cs = JSON.parse(localStorage.getItem("timsBlobArena") || "null"); if (_cs) cellsSave.best = _cs.best || 0; } catch (e) {}

var Cells = {
    players: [], blobs: [], pellets: [], viruses: [], t: 0, cam: { x: 0, y: 0, z: 1 },

    rad: function(m) { return Math.sqrt(m) * 5; },
    speed: function(m) { return 9 * Math.pow(m, -0.24); },
    mass: function(pl) { var s = 0; for (let i = 0; i < this.blobs.length; i++) if (this.blobs[i].pl === pl) s += this.blobs[i].m; return s; },
    mine: function(pl) { return this.blobs.filter(function(b) { return b.pl === pl; }); },

    reset: function() {
        this.players = []; this.blobs = []; this.pellets = []; this.viruses = []; this.t = 0;
        for (let i = 0; i < CEL.PELLETS; i++) this.addPellet();
        for (let i = 0; i < CEL.VIRUSES; i++) this.addVirus();
        this.addPlayer({ human: 0, name: "P1", color: "#ff5a5f" });
        if (multiplayer) this.addPlayer({ human: 1, name: "P2", color: "#3da5ff" });
        for (let i = 0; i < CEL.CPUS; i++) this.addPlayer({ name: CEL_NAMES[i % CEL_NAMES.length], color: CEL_COLORS[i % CEL_COLORS.length] });
    },
    rndPos: function(pad) { return [(Math.random() - 0.5) * (CEL.W - pad * 2), (Math.random() - 0.5) * (CEL.H - pad * 2)]; },
    addPellet: function(x, y, m, col) { if (x === undefined) { var p = this.rndPos(20); x = p[0]; y = p[1]; } this.pellets.push({ x: x, y: y, m: m || 1, col: col || CEL_COLORS[(Math.random() * CEL_COLORS.length) | 0], vx: 0, vy: 0 }); },
    addVirus: function() { var p = this.rndPos(300); this.viruses.push({ x: p[0], y: p[1], m: 100 }); },

    addPlayer: function(o) {
        var pl = { name: o.name, color: o.color, human: o.human, alive: false, deadT: 0, aimX: 0, aimY: 0, cpuT: 0, peak: 0 };
        this.players.push(pl);
        this.spawn(pl);
        return pl;
    },
    spawn: function(pl) {
        var p = this.rndPos(400);
        for (let tries = 0; tries < 20; tries++) {
            var ok = this.blobs.every(function(b) { return b.m < 60 || Math.hypot(b.x - p[0], b.y - p[1]) > 700; });
            if (ok) break;
            p = this.rndPos(400);
        }
        pl.alive = true; pl.deadT = 0; pl.peak = 20;
        this.blobs.push({ pl: pl, x: p[0], y: p[1], m: 20, vx: 0, vy: 0, mergeT: 0 });
    },

    // ---------------- input: every player ends up with an aim point and split / eject presses
    input: function(pl) {
        var me = this.mine(pl), cx = 0, cy = 0, M = 0;
        me.forEach(function(b) { cx += b.x * b.m; cy += b.y * b.m; M += b.m; });
        if (M) { cx /= M; cy /= M; }
        pl.cx = cx; pl.cy = cy;
        var split = false, eject = false;
        if (pl.human === 0) {
            var pad = (typeof Pads !== "undefined") ? Pads.state[0] : null;
            if (pad && pad.active && (pad.left || pad.right || pad.up || pad.down)) {
                pl.aimX = cx + ((pad.right ? 1 : 0) - (pad.left ? 1 : 0)) * 400; pl.aimY = cy + ((pad.down ? 1 : 0) - (pad.up ? 1 : 0)) * 400;
            } else { var c = this.cam; pl.aimX = (mouseX - cssW / 2) / c.z + c.x; pl.aimY = (mouseY - cssH / 2) / c.z + c.y; }
            split = SpacePressed || !!(pad && pad.active && pad.shoot);
            eject = WASDupPressed || !!(pad && pad.active && pad.interact);
        } else if (pl.human === 1) {
            var p2 = (typeof Pads !== "undefined") ? Pads.state[1] : null;
            var dx = (ULDRrightPressed || (p2 && p2.active && p2.right) ? 1 : 0) - (ULDRleftPressed || (p2 && p2.active && p2.left) ? 1 : 0);
            var dy = (ULDRdownPressed || (p2 && p2.active && p2.down) ? 1 : 0) - (ULDRupPressed || (p2 && p2.active && p2.up) ? 1 : 0);
            pl.aimX = cx + dx * 400; pl.aimY = cy + dy * 400;
            split = !!PlayerInput[1].kbShoot || !!(p2 && p2.active && p2.shoot);
            eject = !!PlayerInput[1].kbInteract || !!(p2 && p2.active && p2.interact);
        } else {
            var cmd = this.cpu(pl, me, cx, cy, M);
            split = cmd.split; eject = false;
        }
        if (split && !pl.splitPrev) this.split(pl, me);
        if (eject && this.t % 4 === 0) this.eject(pl, me);
        pl.splitPrev = split;
    },

    cpu: function(pl, me, cx, cy, M) {
        pl.cpuT++;
        if (pl.cpuT % 12 !== 0 && pl.goal) { pl.aimX = pl.goal[0]; pl.aimY = pl.goal[1]; return { split: false }; }
        var big = me.reduce(function(a, b) { return b.m > a.m ? b : a; }, me[0]);
        var r = this.rad(big.m), fx = 0, fy = 0, threat = false, prey = null, pd = 1e9;
        for (let i = 0; i < this.blobs.length; i++) {
            var o = this.blobs[i];
            if (o.pl === pl) continue;
            var d = Math.hypot(o.x - cx, o.y - cy);
            if (o.m > big.m * 1.25 && d < 450 + this.rad(o.m)) { fx -= (o.x - cx) / (d || 1) * (1000 / (d + 50)); fy -= (o.y - cy) / (d || 1) * (1000 / (d + 50)); threat = true; }
            else if (big.m > o.m * 1.25 && d < 600 && d / o.m < pd) { pd = d / o.m; prey = o; }
        }
        // stay off the walls when running
        if (threat) {
            if (cx < -CEL.W / 2 + 400) fx += 3; if (cx > CEL.W / 2 - 400) fx -= 3; if (cy < -CEL.H / 2 + 400) fy += 3; if (cy > CEL.H / 2 - 400) fy -= 3;
            pl.goal = [cx + fx * 300, cy + fy * 300];
        } else if (prey) {
            pl.goal = [prey.x + prey.vx * 10, prey.y + prey.vy * 10];
            // lunge: split onto prey that is close and well under half our size
            var dd = Math.hypot(prey.x - big.x, prey.y - big.y);
            if (big.m > prey.m * 2.8 && dd < r + 260 && me.length < 3 && Math.random() < 0.5) { pl.aimX = pl.goal[0]; pl.aimY = pl.goal[1]; return { split: true }; }
        } else {
            var best = null, bd = 1e9;
            for (let i = 0; i < this.pellets.length; i += 3) { var p = this.pellets[i], d2 = Math.hypot(p.x - cx, p.y - cy); if (d2 < bd) { bd = d2; best = p; } }
            pl.goal = best ? [best.x, best.y] : [0, 0];
            // big blobs avoid viruses
            for (let i = 0; i < this.viruses.length; i++) { var v = this.viruses[i]; if (big.m > 130 && Math.hypot(v.x - cx, v.y - cy) < r + 160) pl.goal = [cx - (v.x - cx), cy - (v.y - cy)]; }
        }
        pl.aimX = pl.goal[0]; pl.aimY = pl.goal[1];
        return { split: false };
    },

    split: function(pl, me) {
        var n = me.length;
        for (let i = 0; i < me.length && n < CEL.MAXCELLS; i++) {
            var b = me[i];
            if (b.m < 36) continue;
            var dx = pl.aimX - b.x, dy = pl.aimY - b.y, L = Math.hypot(dx, dy) || 1;
            b.m /= 2;
            var nb = { pl: pl, x: b.x + dx / L * this.rad(b.m), y: b.y + dy / L * this.rad(b.m), m: b.m, vx: dx / L * 24, vy: dy / L * 24, mergeT: 540 };
            b.mergeT = 540;
            this.blobs.push(nb); n++;
        }
        if (pl.human !== undefined && typeof SFX !== "undefined") SFX.play("whoosh");
    },
    eject: function(pl, me) {
        for (let i = 0; i < me.length; i++) {
            var b = me[i];
            if (b.m < 32) continue;
            var dx = pl.aimX - b.x, dy = pl.aimY - b.y, L = Math.hypot(dx, dy) || 1, r = this.rad(b.m);
            b.m -= 14;
            this.pellets.push({ x: b.x + dx / L * (r + 14), y: b.y + dy / L * (r + 14), m: 11, col: pl.color, vx: dx / L * 20, vy: dy / L * 20 });
        }
    },

    step: function() {
        this.t++;
        for (let i = 0; i < this.players.length; i++) if (this.players[i].alive) this.input(this.players[i]);
        var B = this.blobs;
        // move
        for (let i = 0; i < B.length; i++) {
            var b = B[i], pl = b.pl, dx = pl.aimX - b.x, dy = pl.aimY - b.y, L = Math.hypot(dx, dy) || 1;
            var sp = this.speed(b.m) * Math.min(1, L / 60);
            b.x += dx / L * sp + b.vx; b.y += dy / L * sp + b.vy;
            b.vx *= 0.9; b.vy *= 0.9;
            if (b.mergeT > 0) b.mergeT--;
            if (b.m > 220) b.m *= 0.99985;                           // big blobs slowly shrink
            var r = this.rad(b.m);
            b.x = Math.max(-CEL.W / 2 + r * 0.5, Math.min(CEL.W / 2 - r * 0.5, b.x));
            b.y = Math.max(-CEL.H / 2 + r * 0.5, Math.min(CEL.H / 2 - r * 0.5, b.y));
        }
        // own pieces: push apart until they may merge, then merge on overlap
        for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
            var a = B[i], c = B[j];
            if (a.pl !== c.pl || a.dead || c.dead) continue;
            var ddx = c.x - a.x, ddy = c.y - a.y, d = Math.hypot(ddx, ddy) || 0.01, ra = this.rad(a.m), rc = this.rad(c.m);
            if (a.mergeT > 0 || c.mergeT > 0) {
                if (d < ra + rc) { var push = (ra + rc - d) * 0.25; a.x -= ddx / d * push * c.m / (a.m + c.m); a.y -= ddy / d * push * c.m / (a.m + c.m); c.x += ddx / d * push * a.m / (a.m + c.m); c.y += ddy / d * push * a.m / (a.m + c.m); }
            } else if (d < Math.max(ra, rc) * 0.7) { a.m += c.m; c.dead = true; }
        }
        // eat other blobs
        for (let i = 0; i < B.length; i++) for (let j = 0; j < B.length; j++) {
            var e = B[i], f = B[j];
            if (i === j || e.dead || f.dead || e.pl === f.pl || e.m < f.m * 1.25) continue;
            var rd = Math.hypot(f.x - e.x, f.y - e.y);
            if (rd < this.rad(e.m) - this.rad(f.m) * 0.4) {
                e.m += f.m; f.dead = true;
                if (e.pl.human !== undefined && typeof SFX !== "undefined") SFX.play("kill", e.x, e.y, 0.6);
                if (!this.mine(f.pl).some(function(q) { return !q.dead; })) this.die(f.pl, e.pl);
            }
        }
        // pellets (and ejected mass, which drifts to a stop)
        for (let k = this.pellets.length - 1; k >= 0; k--) {
            var p = this.pellets[k];
            if (p.vx || p.vy) { p.x += p.vx; p.y += p.vy; p.vx *= 0.88; p.vy *= 0.88; if (Math.abs(p.vx) + Math.abs(p.vy) < 0.1) p.vx = p.vy = 0; }
            for (let i = 0; i < B.length; i++) {
                var q = B[i];
                if (q.dead) continue;
                var rq = this.rad(q.m);
                if (Math.abs(p.x - q.x) < rq && Math.abs(p.y - q.y) < rq && Math.hypot(p.x - q.x, p.y - q.y) < rq && (p.m < 5 || q.m > 20)) { q.m += p.m; this.pellets.splice(k, 1); break; }
            }
        }
        // viruses pop big blobs
        for (let v = this.viruses.length - 1; v >= 0; v--) {
            var vi = this.viruses[v];
            for (let i = 0; i < B.length; i++) {
                var bb = B[i];
                if (bb.dead || bb.m < 130) continue;
                if (Math.hypot(bb.x - vi.x, bb.y - vi.y) < this.rad(bb.m) - 20) {
                    var pieces = Math.min(CEL.MAXCELLS - this.mine(bb.pl).length, 7);
                    bb.m += vi.m * 0.5;
                    var each = bb.m / (pieces + 1);
                    for (let k = 0; k < pieces; k++) { var a = k / pieces * Math.PI * 2; B.push({ pl: bb.pl, x: bb.x, y: bb.y, m: each, vx: Math.cos(a) * 16, vy: Math.sin(a) * 16, mergeT: 600 }); }
                    bb.m = each; bb.mergeT = 600;
                    this.viruses.splice(v, 1); this.addVirus();
                    if (bb.pl.human !== undefined) { showBanner("POPPED!", "you hit a virus", "#4ade80"); screenShake = 6; }
                    break;
                }
            }
        }
        this.blobs = B.filter(function(q) { return !q.dead; });
        while (this.pellets.length < CEL.PELLETS) this.addPellet();
        // players: track peaks, respawn CPUs
        for (let i = 0; i < this.players.length; i++) {
            var pl2 = this.players[i];
            if (pl2.alive) pl2.peak = Math.max(pl2.peak, this.mass(pl2));
            else if (pl2.human === undefined && ++pl2.deadT > 150) this.spawn(pl2);
        }
    },

    die: function(pl, by) {
        pl.alive = false; pl.deadT = 0; pl.by = by;
        if (pl.human !== undefined) {
            var pk = Math.round(pl.peak);
            if (pk > cellsSave.best) { cellsSave.best = pk; try { localStorage.setItem("timsBlobArena", JSON.stringify(cellsSave)); } catch (e) {} }
            if (typeof SFX !== "undefined") SFX.play("ko");
        } else if (by && by.human !== undefined) showBanner(by.name + " ate " + pl.name + "!", "", by.color);
    },

    toScreen: function(x, y) { var c = this.cam; return [(x - c.x) * c.z + cssW / 2, (y - c.y) * c.z + cssH / 2]; },

    render: function() {
        var hum = this.players.filter(function(p) { return p.human !== undefined && p.alive; });
        var tx = this.cam.x, ty = this.cam.y, M = 20, span = 0;
        if (hum.length) {
            tx = 0; ty = 0; M = 0;
            hum.forEach(function(p) { tx += p.cx; ty += p.cy; M = Math.max(M, Cells.mass(p)); });
            tx /= hum.length; ty /= hum.length;
            if (hum.length > 1) span = Math.hypot(hum[0].cx - hum[1].cx, hum[0].cy - hum[1].cy);
            hum.forEach(function(p) { Cells.mine(p).forEach(function(b) { span = Math.max(span, Math.hypot(b.x - tx, b.y - ty) * 2); }); });
        }
        var z = Math.max(0.22, Math.min(1.2, 1.3 / Math.pow(Math.max(20, M) / 20, 0.32)));
        if (span) z = Math.min(z, Math.min(cssW, cssH) * 0.8 / (span + 400));
        this.cam.x += (tx - this.cam.x) * 0.12; this.cam.y += (ty - this.cam.y) * 0.12; this.cam.z += (z - this.cam.z) * 0.05;
        var c = this.cam, Z = c.z;
        ctx.fillStyle = "#0b1220"; ctx.fillRect(0, 0, cssW, cssH);
        // arena + grid
        var tl = this.toScreen(-CEL.W / 2, -CEL.H / 2), br = this.toScreen(CEL.W / 2, CEL.H / 2);
        ctx.fillStyle = "#f1f5f9"; ctx.fillRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
        ctx.strokeStyle = "#dbe3ec"; ctx.lineWidth = 1;
        var g = 50, sx0 = Math.max(-CEL.W / 2, Math.floor((c.x - cssW / 2 / Z) / g) * g), sx1 = Math.min(CEL.W / 2, c.x + cssW / 2 / Z);
        var sy0 = Math.max(-CEL.H / 2, Math.floor((c.y - cssH / 2 / Z) / g) * g), sy1 = Math.min(CEL.H / 2, c.y + cssH / 2 / Z);
        ctx.beginPath();
        for (let x = sx0; x <= sx1; x += g) { var a = this.toScreen(x, sy0), b = this.toScreen(x, sy1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        for (let y = sy0; y <= sy1; y += g) { var a2 = this.toScreen(sx0, y), b2 = this.toScreen(sx1, y); ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]); }
        ctx.stroke();
        // pellets
        for (let i = 0; i < this.pellets.length; i++) {
            var p = this.pellets[i], s = this.toScreen(p.x, p.y);
            if (s[0] < -20 || s[1] < -20 || s[0] > cssW + 20 || s[1] > cssH + 20) continue;
            ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(2, this.rad(p.m) * Z * (p.m > 5 ? 1 : 0.8)), 0, 7); ctx.fill();
        }
        // blobs smallest-last so big ones go under (you see what's about to be eaten)
        var all = this.blobs.slice().sort(function(a, b) { return a.m - b.m; });
        for (let i = 0; i < all.length; i++) this.drawBlob(all[i], Z);
        // viruses on top of small blobs, under nothing
        for (let i = 0; i < this.viruses.length; i++) {
            var v = this.viruses[i], vs = this.toScreen(v.x, v.y), vr = this.rad(v.m) * Z;
            if (vs[0] < -vr * 2 || vs[1] < -vr * 2 || vs[0] > cssW + vr * 2 || vs[1] > cssH + vr * 2) continue;
            ctx.fillStyle = "#4ade80"; ctx.strokeStyle = "#15803d"; ctx.lineWidth = 3;
            ctx.beginPath();
            for (let k = 0; k <= 40; k++) { var an = k / 40 * Math.PI * 2 + this.t * 0.005, rr = vr * (k % 2 ? 0.88 : 1.06); ctx.lineTo(vs[0] + Math.cos(an) * rr, vs[1] + Math.sin(an) * rr); }
            ctx.closePath(); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
        }
    },
    drawBlob: function(b, Z) {
        var s = this.toScreen(b.x, b.y), r = this.rad(b.m) * Z;
        if (s[0] < -r || s[1] < -r || s[0] > cssW + r || s[1] > cssH + r) return;
        ctx.fillStyle = b.pl.color; ctx.strokeStyle = Components.shade(b.pl.color, -45); ctx.lineWidth = Math.max(2, r * 0.08);
        // wobbly outline
        ctx.beginPath();
        var n = 28;
        for (let k = 0; k <= n; k++) { var a = k / n * Math.PI * 2, w = 1 + Math.sin(a * 5 + this.t * 0.08 + b.x * 0.01) * 0.02; ctx.lineTo(s[0] + Math.cos(a) * r * w, s[1] + Math.sin(a) * r * w); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (r > 14) uiText(b.pl.name, s[0], s[1] + Math.min(18, r * 0.25) * 0.35, Math.max(10, Math.min(28, r * 0.35)), "#ffffff", "center", "900");
        if (r > 30) uiText(String(Math.round(b.m)), s[0], s[1] + Math.min(28, r * 0.35), Math.max(9, Math.min(16, r * 0.18)), "rgba(255,255,255,0.8)", "center", "800");
    },

    hud: function() {
        var hum = this.players.filter(function(p) { return p.human !== undefined; });
        uiPanel(14, 10, 320, 60, "#a78bfa");
        uiText("BLOB ARENA", 30, 38, 22, "#c4b5fd", "left", "900");
        uiText(hum.map(function(p) { return p.name + " " + (p.alive ? Math.round(Cells.mass(p)) : "✖"); }).join("   ") + "   best " + cellsSave.best, 30, 58, 12, "#cbd5e1", "left", "800");
        var lb = this.players.filter(function(p) { return p.alive; }).map(function(p) { return [p, Cells.mass(p)]; }).sort(function(a, b) { return b[1] - a[1]; });
        var rows = lb.slice(0, 8);
        lb.forEach(function(r, i) { if (i >= 8 && r[0].human !== undefined) { r[2] = i + 1; rows.push(r); } });
        uiPanel(cssW - 214, 64, 200, 30 + rows.length * 18, "#a78bfa", 0.85);
        uiText("LEADERBOARD", cssW - 114, 84, 12, "#c4b5fd", "center", "900");
        for (let i = 0; i < rows.length; i++) {
            var pl = rows[i][0];
            uiText((rows[i][2] || i + 1) + ". " + pl.name, cssW - 202, 104 + i * 18, 12, pl.human !== undefined ? "#fde047" : pl.color, "left", pl.human !== undefined ? "900" : "700");
            uiText(String(Math.round(rows[i][1])), cssW - 26, 104 + i * 18, 12, "#e2e8f0", "right", "800");
        }
        for (let i = 0; i < hum.length; i++) {
            var h = hum[i];
            if (h.alive) continue;
            var y = cssH / 2 - 60 + i * 120;
            uiPanel(cssW / 2 - 210, y, 420, 100, h.color, 0.92);
            uiText(h.name + (h.by ? " was eaten by " + h.by.name : " is out"), cssW / 2, y + 36, 22, "#fff", "center", "900");
            uiText("peak mass " + Math.round(h.peak) + "  ·  " + (h.deadT > 60 ? (h.human === 0 ? "click / Space" : "Enter") + " to play again" : "…"), cssW / 2, y + 70, 15, "#cbd5e1", "center", "800");
        }
        ctx.fillStyle = "rgba(15,23,42,0.8)"; ctx.fillRect(0, cssH - 30, cssW, 30);
        uiText("Mouse moves · Space split · W eject · eat anything 25% smaller · green spikes pop big blobs · Esc menu" + (multiplayer ? " · P2: arrows, Enter split, / eject" : ""), cssW / 2, cssH - 11, 12, "rgba(220,230,240,0.85)", "center", "700");
    }
};

ModeKit.addLevel("cells_arena", { name: "🫧 Blob Arena", mode: "cells", wavesEnabled: false, spawnP1: [0, 60], spawnP2: [60, 60], layout: ModeKit.room(-600, 600, 800, {}), title: "Blob Arena" });

GameModes.register({
    id: "cells",
    title: "BLOB ARENA",
    tagline: "Agar-style arena: eat smaller blobs, split to lunge, dodge the big ones and the spiky viruses.",
    color: "#a78bfa",
    firstLevel: "cells_arena",
    flags: { ownScreen: true, waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, scenery: false, coopToggle: true },
    overTitle: "BLOB ARENA",

    setupLevel: function() { Cells.reset(); },

    screenFrame: function() {
        for (let i = 0; i < Cells.players.length; i++) {
            var pl = Cells.players[i];
            if (pl.alive || pl.human === undefined) continue;
            pl.deadT++;
            var pad = (typeof Pads !== "undefined") ? Pads.state[pl.human] : null;
            var again = pl.human === 0 ? (mouseDown || SpacePressed || !!(pad && pad.active && pad.shoot)) : (!!PlayerInput[1].kbShoot || !!(pad && pad.active && pad.shoot));
            if (pl.deadT > 60 && again) { Cells.spawn(pl); pl.splitPrev = true; }
        }
        Cells.step();
        Cells.render();
        Cells.hud();
    },

    onClick: function() { return true; },
    menuItems: function(items) { items.push({ id: "ce_new", label: "New arena", hint: "" }); },
    onMenu: function(id) { if (id === "ce_new") { closePause(); Cells.reset(); return true; } return false; },
    onRestart: function() { Cells.reset(); },
    overSub: function() { return "Best mass " + cellsSave.best; }
});
