// ============================================================================
// GAME: TABLE GAMES  (table)  -  2-player minigame pack (original), led by tabletop flick soccer
//   FLICK SOCCER: each side has five discs. On your turn drag a disc back (like a slingshot) and let go to flick it;
//   knock the ball into the other goal. First to 3. Keyboard / pad: Tab or L1/R1 pick a disc, A/D or stick turn the
//   aim, W/S power, Space / A shoot.
//   FOUR IN A ROW: drop counters, get four in a line. Click a column (or ←/→ + Space).
//   Play vs the CPU or pass-and-play with a friend (pause menu → Opponent). Runs on its own screen (`ownScreen`).
// ============================================================================
var tableCfg = { game: "flick", vs: "cpu", level: 2 };
try { var _tb = JSON.parse(localStorage.getItem("timsTableGames") || "null"); if (_tb) for (var _k in _tb) tableCfg[_k] = _tb[_k]; } catch (e) {}
function saveTable() { try { localStorage.setItem("timsTableGames", JSON.stringify(tableCfg)); } catch (e) {} }
var TABLE_GAMES = [["flick", "Flick Soccer"], ["four", "Four in a Row"]];
var TABLE_COLORS = ["#ef4444", "#3b82f6"];

// ---------------------------------------------------------------- FLICK SOCCER
var Flick = {
    PW: 1000, PH: 620, GOAL: 170, DR: 26, BR: 16,
    discs: [], ball: null, turn: 0, phase: "aim", score: [0, 0], sel: -1, drag: null, aimA: 0, aimP: 0.5, moved: false, cpuT: 0, msg: "", msgT: 0, win: 3,

    reset: function() { this.score = [0, 0]; this.kickoff(0); },
    kickoff: function(team) {
        var F = [[-430, 0], [-300, -150], [-300, 150], [-160, -70], [-160, 70]];
        this.discs = [];
        for (let t = 0; t < 2; t++) for (let i = 0; i < F.length; i++) this.discs.push({ t: t, x: F[i][0] * (t ? -1 : 1), y: F[i][1], vx: 0, vy: 0, r: this.DR, m: 2 });
        this.ball = { x: 0, y: 0, vx: 0, vy: 0, r: this.BR, m: 1, ball: true };
        this.turn = team; this.phase = "aim"; this.sel = -1; this.drag = null; this.cpuT = 0;
    },
    bodies: function() { return this.discs.concat([this.ball]); },
    scale: function() { return Math.min((cssW - 80) / (this.PW + 120), (cssH - 170) / (this.PH + 40)); },
    toScreen: function(x, y) { var s = this.scale(); return [cssW / 2 + x * s, cssH / 2 + 30 + y * s]; },
    toWorld: function(sx, sy) { var s = this.scale(); return [(sx - cssW / 2) / s, (sy - cssH / 2 - 30) / s]; },
    human: function(team) { return team === 0 || tableCfg.vs === "p2"; },

    shoot: function(d, ang, pow) {
        var sp = 4 + pow * 26;
        d.vx = Math.cos(ang) * sp; d.vy = Math.sin(ang) * sp;
        this.phase = "move"; this.moved = false; this.sel = -1; this.drag = null;
        if (typeof SFX !== "undefined") SFX.play("kick", 0, 0, 0.5 + pow * 0.5);
    },

    physics: function() {
        var B = this.bodies(), W = this.PW / 2, H = this.PH / 2, G = this.GOAL / 2;
        for (let sub = 0; sub < 2; sub++) {
            for (let i = 0; i < B.length; i++) {
                var b = B[i];
                b.x += b.vx / 2; b.y += b.vy / 2;
                // walls (the goal mouths are open for the ball; discs can go in a little)
                var inMouth = Math.abs(b.y) < G - b.r * 0.2;
                if (b.y < -H + b.r) { b.y = -H + b.r; b.vy = Math.abs(b.vy) * 0.8; }
                if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy) * 0.8; }
                var lim = inMouth ? W + (b.ball ? 80 : 30) : W - b.r;
                if (b.x < -lim) { b.x = -lim; b.vx = Math.abs(b.vx) * 0.8; }
                if (b.x > lim) { b.x = lim; b.vx = -Math.abs(b.vx) * 0.8; }
                // goal posts
                [[-W, -G], [-W, G], [W, -G], [W, G]].forEach(function(p) {
                    var dx = b.x - p[0], dy = b.y - p[1], d = Math.hypot(dx, dy);
                    if (d < b.r + 6 && d > 0) { var nx = dx / d, ny = dy / d; b.x = p[0] + nx * (b.r + 6); b.y = p[1] + ny * (b.r + 6); var vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; } }
                });
            }
            for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
                var a = B[i], c = B[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), md = a.r + c.r;
                if (d >= md || d === 0) continue;
                var nx = dx / d, ny = dy / d, over = md - d, im = 1 / a.m + 1 / c.m;
                a.x -= nx * over * (1 / a.m) / im; a.y -= ny * over * (1 / a.m) / im; c.x += nx * over * (1 / c.m) / im; c.y += ny * over * (1 / c.m) / im;
                var rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
                if (rv < 0) {
                    var j2 = -(1 + 0.9) * rv / im;
                    a.vx -= j2 * nx / a.m; a.vy -= j2 * ny / a.m; c.vx += j2 * nx / c.m; c.vy += j2 * ny / c.m;
                    if (-rv > 4 && typeof SFX !== "undefined") SFX.play("hit", 0, 0, Math.min(1, -rv / 20));
                }
            }
        }
        var still = true;
        for (let i = 0; i < B.length; i++) {
            var q = B[i], f = q.ball ? 0.978 : 0.965;
            q.vx *= f; q.vy *= f;
            if (Math.hypot(q.vx, q.vy) < 0.12) { q.vx = 0; q.vy = 0; } else still = false;
        }
        // goal?
        var bl = this.ball;
        if (Math.abs(bl.y) < G && Math.abs(bl.x) > W + bl.r) {
            var scorer = bl.x > 0 ? 0 : 1;
            this.score[scorer]++;
            this.msg = (scorer === 0 ? "RED" : "BLUE") + " SCORES!"; this.msgT = 120;
            if (typeof SFX !== "undefined") SFX.play("goal");
            if (this.score[scorer] >= this.win) { this.phase = "over"; this.winner = scorer; showBanner((scorer === 0 ? "RED" : "BLUE") + " WINS!", this.score[0] + " - " + this.score[1], TABLE_COLORS[scorer]); return; }
            this.phase = "goal"; this.goalT = 90; this.nextKick = 1 - scorer;
            return;
        }
        if (still) { this.turn = 1 - this.turn; this.phase = "aim"; this.cpuT = 0; this.aimA = this.turn === 0 ? 0 : Math.PI; }
    },

    cpu: function() {
        // try every disc: hit the ball so it heads for the red goal (x = -W); score each option
        var W = this.PW / 2, best = null, bs = -1e9, bl = this.ball, lvl = tableCfg.level;
        var goal = [-W - 40, 0];
        for (let i = 0; i < this.discs.length; i++) {
            var d = this.discs[i];
            if (d.t !== 1) continue;
            var gx = goal[0] - bl.x, gy = goal[1] - bl.y, gl = Math.hypot(gx, gy);
            var cx = bl.x - gx / gl * (d.r + bl.r - 2), cy = bl.y - gy / gl * (d.r + bl.r - 2);       // contact point behind the ball
            var ax = cx - d.x, ay = cy - d.y, al = Math.hypot(ax, ay);
            if (al < 1) continue;
            var cut = (ax / al) * (gx / gl) + (ay / al) * (gy / gl);                                   // 1 = straight through
            var blocked = 0;
            for (let k = 0; k < this.discs.length; k++) {
                var o = this.discs[k];
                if (o === d) continue;
                var t = ((o.x - d.x) * ax + (o.y - d.y) * ay) / (al * al);
                if (t > 0 && t < 1 && Math.hypot(d.x + ax * t - o.x, d.y + ay * t - o.y) < d.r + o.r) blocked++;
            }
            var score = cut * 100 - al * 0.06 - blocked * 120 + (d.x > bl.x ? 30 : -40);
            if (score > bs) { bs = score; best = { d: d, ang: Math.atan2(ay, ax), pow: Math.min(1, 0.35 + al / 700 + (1 - Math.max(0, cut)) * 0.2) }; }
        }
        if (!best) return;
        var noise = [0, 0.22, 0.1, 0.03][lvl];
        this.shoot(best.d, best.ang + (Math.random() - 0.5) * noise, Math.min(1, best.pow + (Math.random() - 0.5) * noise));
    },

    update: function() {
        if (this.msgT > 0) this.msgT--;
        if (this.phase === "move") { this.physics(); return; }
        if (this.phase === "goal") { if (--this.goalT <= 0) this.kickoff(this.nextKick); return; }
        if (this.phase !== "aim") return;
        if (!this.human(this.turn)) { if (++this.cpuT > 50) this.cpu(); return; }
        // mouse: press on your disc, drag back, release
        var m = this.toWorld(mouseX, mouseY);
        if (mouseDown && !this.drag) {
            for (let i = 0; i < this.discs.length; i++) { var d = this.discs[i]; if (d.t === this.turn && Math.hypot(d.x - m[0], d.y - m[1]) < d.r + 8) { this.drag = { i: i }; this.sel = i; } }
            if (!this.drag) this.mouseLock = true;
        }
        if (!mouseDown) {
            if (this.drag) {
                var dd = this.discs[this.drag.i], px = dd.x - m[0], py = dd.y - m[1], pl = Math.hypot(px, py);
                if (pl > 14) { this.shoot(dd, Math.atan2(py, px), Math.min(1, pl / 220)); return; }
                this.drag = null;
            }
            this.mouseLock = false;
        }
        if (this.drag) { var d2 = this.discs[this.drag.i], qx = d2.x - m[0], qy = d2.y - m[1]; this.aimA = Math.atan2(qy, qx); this.aimP = Math.min(1, Math.hypot(qx, qy) / 220); }
        // keyboard / pad aiming
        var team = this.turn, mine = this.discs.filter(function(q) { return q.t === team; });
        if (this.sel < 0 || this.discs[this.sel].t !== team) this.sel = this.discs.indexOf(mine[0]);
        var ks = this.keys(team);
        if (ks.next && !this.prevNext) { var idx = mine.indexOf(this.discs[this.sel]); this.sel = this.discs.indexOf(mine[(idx + 1) % mine.length]); }
        this.prevNext = ks.next;
        if (ks.left) this.aimA -= 0.04; if (ks.right) this.aimA += 0.04;
        if (ks.up) this.aimP = Math.min(1, this.aimP + 0.015); if (ks.down) this.aimP = Math.max(0.05, this.aimP - 0.015);
        if (ks.fire && !this.prevFire && !this.drag) this.shoot(this.discs[this.sel], this.aimA, this.aimP);
        this.prevFire = ks.fire;
    },
    keys: function(team) {
        var p = team === 0 || tableCfg.vs !== "p2" ? 0 : 1, pad = (typeof Pads !== "undefined") ? Pads.state[p] : null, pa = pad && pad.active;
        if (p === 0 || !multiplayer) return { left: WASDleftPressed || (pa && pad.left), right: WASDrightPressed || (pa && pad.right), up: WASDupPressed || (pa && pad.up), down: WASDdownPressed || (pa && pad.down), fire: SpacePressed || (pa && pad.shoot), next: !!Flick.tabDown || (pa && pad.jet) };
        return { left: ULDRleftPressed || (pa && pad.left), right: ULDRrightPressed || (pa && pad.right), up: ULDRupPressed || (pa && pad.up), down: ULDRdownPressed || (pa && pad.down), fire: !!PlayerInput[1].kbShoot || (pa && pad.shoot), next: !!PlayerInput[1].kbInteract || (pa && pad.jet) };
    },

    draw: function() {
        var s = this.scale(), W = this.PW / 2, H = this.PH / 2, G = this.GOAL / 2;
        ctx.fillStyle = "#0b1220"; ctx.fillRect(0, 0, cssW, cssH);
        // table edge + felt pitch with mowing stripes
        var tl = this.toScreen(-W - 50, -H - 30), br = this.toScreen(W + 50, H + 30);
        ctx.fillStyle = "#5b3a1e"; ctx.fillRect(tl[0] - 14, tl[1] - 14, br[0] - tl[0] + 28, br[1] - tl[1] + 28);
        var a = this.toScreen(-W, -H), b = this.toScreen(W, H);
        for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? "#2f7d3b" : "#348a41"; ctx.fillRect(a[0] + (b[0] - a[0]) * i / 10, a[1], (b[0] - a[0]) / 10 + 1, b[1] - a[1]); }
        ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3;
        ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        var c = this.toScreen(0, 0);
        ctx.beginPath(); ctx.moveTo(c[0], a[1]); ctx.lineTo(c[0], b[1]); ctx.stroke();
        ctx.beginPath(); ctx.arc(c[0], c[1], 80 * s, 0, 7); ctx.stroke();
        [-1, 1].forEach(function(sd) { var p = Flick.toScreen(sd * W, -110), q = Flick.toScreen(sd * (W - 120), 110); ctx.strokeRect(Math.min(p[0], q[0]), p[1], Math.abs(q[0] - p[0]), q[1] - p[1]); });
        // goals
        [-1, 1].forEach(function(sd, i) {
            var p = Flick.toScreen(sd * W, -G), q = Flick.toScreen(sd * (W + 46), G);
            ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(Math.min(p[0], q[0]), p[1], Math.abs(q[0] - p[0]), q[1] - p[1]);
            ctx.strokeStyle = TABLE_COLORS[i]; ctx.lineWidth = 4; ctx.strokeRect(Math.min(p[0], q[0]), p[1], Math.abs(q[0] - p[0]), q[1] - p[1]);
        });
        // aim guide
        if (this.phase === "aim" && this.human(this.turn) && this.sel >= 0) {
            var d = this.discs[this.sel], ds = this.toScreen(d.x, d.y), len = (60 + this.aimP * 220) * s;
            ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
            ctx.beginPath(); ctx.moveTo(ds[0], ds[1]); ctx.lineTo(ds[0] + Math.cos(this.aimA) * len, ds[1] + Math.sin(this.aimA) * len); ctx.stroke(); ctx.setLineDash([]);
            if (this.drag) { var mm = this.toScreen(d.x - Math.cos(this.aimA) * this.aimP * 220, d.y - Math.sin(this.aimA) * this.aimP * 220); ctx.strokeStyle = "rgba(253,224,71,0.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ds[0], ds[1]); ctx.lineTo(mm[0], mm[1]); ctx.stroke(); }
        }
        // discs and ball
        for (let i = 0; i < this.discs.length; i++) {
            var q2 = this.discs[i], qs = this.toScreen(q2.x, q2.y), r = q2.r * s, myTurn = this.phase === "aim" && q2.t === this.turn;
            ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.arc(qs[0] + 3, qs[1] + 4, r, 0, 7); ctx.fill();
            ctx.fillStyle = TABLE_COLORS[q2.t]; ctx.strokeStyle = i === this.sel && myTurn ? "#fde047" : "#0a0f16"; ctx.lineWidth = i === this.sel && myTurn ? 4 : 2.5;
            ctx.beginPath(); ctx.arc(qs[0], qs[1], r, 0, 7); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(qs[0], qs[1], r * 0.55, 0, 7); ctx.fill();
            if (myTurn && this.human(this.turn)) { ctx.strokeStyle = "rgba(253,224,71," + (0.3 + 0.3 * Math.sin(Date.now() / 150)) + ")"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(qs[0], qs[1], r + 5, 0, 7); ctx.stroke(); }
        }
        var bl = this.ball, bs = this.toScreen(bl.x, bl.y);
        ctx.fillStyle = "#f8fafc"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bs[0], bs[1], bl.r * s, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#0a0f16"; ctx.beginPath(); ctx.arc(bs[0], bs[1], bl.r * s * 0.4, 0, 7); ctx.fill();
        // HUD
        uiPanel(cssW / 2 - 170, 64, 340, 50, TABLE_COLORS[this.turn]);
        uiText(String(this.score[0]), cssW / 2 - 90, 100, 32, TABLE_COLORS[0], "center", "900");
        uiText(String(this.score[1]), cssW / 2 + 90, 100, 32, TABLE_COLORS[1], "center", "900");
        uiText(this.phase === "over" ? (this.winner === 0 ? "RED" : "BLUE") + " WINS" : (this.phase === "aim" ? (this.turn === 0 ? "RED" : "BLUE") + (this.human(this.turn) ? " — your flick" : " — thinking…") : "…"), cssW / 2, 96, 15, "#e2e8f0", "center", "900");
        if (this.msgT > 0) uiText(this.msg, cssW / 2, cssH / 2, 56, "#fde047", "center", "900");
        uiText("Drag a disc back and let go to flick · or Tab next disc, A/D aim, W/S power, Space shoot · first to " + this.win + " · Esc: opponent / game", cssW / 2, cssH - 14, 12, "rgba(220,230,240,0.7)", "center", "700");
    }
};

// ---------------------------------------------------------------- FOUR IN A ROW
var Four = {
    C: 7, R: 6, g: null, turn: 0, over: false, win: -1, line: null, col: 3, drop: null, cpuT: 0,
    reset: function(first) { this.g = []; for (let c = 0; c < this.C; c++) this.g.push([]); this.turn = first || 0; this.over = false; this.win = -1; this.line = null; this.drop = null; this.cpuT = 0; },
    human: function(t) { return t === 0 || tableCfg.vs === "p2"; },
    play: function(c) {
        if (this.over || this.drop || this.g[c].length >= this.R) return false;
        this.g[c].push(this.turn);
        this.drop = { c: c, r: this.g[c].length - 1, y: -1, t: this.turn };
        if (typeof SFX !== "undefined") SFX.play("select");
        var w = this.check(this.g);
        if (w) { this.over = true; this.win = w.t; this.line = w.cells; }
        else if (this.g.every(function(col) { return col.length >= Four.R; })) { this.over = true; this.win = -1; }
        this.turn = 1 - this.turn;
        return true;
    },
    check: function(g) {
        var D = [[1, 0], [0, 1], [1, 1], [1, -1]];
        for (let c = 0; c < this.C; c++) for (let r = 0; r < this.R; r++) {
            var t = g[c][r];
            if (t === undefined) continue;
            for (let k = 0; k < 4; k++) {
                var cells = [[c, r]];
                for (let s = 1; s < 4; s++) { var cc = c + D[k][0] * s, rr = r + D[k][1] * s; if (cc < 0 || cc >= this.C || rr < 0 || g[cc][rr] !== t) break; cells.push([cc, rr]); }
                if (cells.length === 4) return { t: t, cells: cells };
            }
        }
        return null;
    },
    // CPU: minimax with alpha-beta on a copy of the board
    heur: function(g, me) {
        var sc = 0, D = [[1, 0], [0, 1], [1, 1], [1, -1]];
        for (let c = 0; c < this.C; c++) for (let r = 0; r < this.R; r++) for (let k = 0; k < 4; k++) {
            var mine = 0, theirs = 0, ok = true;
            for (let s = 0; s < 4; s++) { var cc = c + D[k][0] * s, rr = r + D[k][1] * s; if (cc < 0 || cc >= this.C || rr < 0 || rr >= this.R) { ok = false; break; } var v = g[cc][rr]; if (v === me) mine++; else if (v === 1 - me) theirs++; }
            if (!ok || (mine && theirs)) continue;
            sc += [0, 1, 6, 40, 0][mine] - [0, 1, 7, 60, 0][theirs];
        }
        for (let r = 0; r < g[3].length; r++) sc += g[3][r] === me ? 4 : -4;
        return sc;
    },
    mm: function(g, depth, a, b, turn, me) {
        var w = this.check(g);
        if (w) return w.t === me ? 100000 + depth : -100000 - depth;
        if (depth === 0) return this.heur(g, me);
        var order = [3, 2, 4, 1, 5, 0, 6], any = false;
        if (turn === me) {
            var v = -1e9;
            for (let i = 0; i < 7; i++) { var c = order[i]; if (g[c].length >= this.R) continue; any = true; g[c].push(turn); v = Math.max(v, this.mm(g, depth - 1, a, b, 1 - turn, me)); g[c].pop(); a = Math.max(a, v); if (a >= b) break; }
            return any ? v : 0;
        }
        var v2 = 1e9;
        for (let i = 0; i < 7; i++) { var c2 = order[i]; if (g[c2].length >= this.R) continue; any = true; g[c2].push(turn); v2 = Math.min(v2, this.mm(g, depth - 1, a, b, 1 - turn, me)); g[c2].pop(); b = Math.min(b, v2); if (a >= b) break; }
        return any ? v2 : 0;
    },
    cpuMove: function() {
        var depth = [0, 1, 4, 6][tableCfg.level], best = 3, bv = -1e9, order = [3, 2, 4, 1, 5, 0, 6];
        if (tableCfg.level === 1 && Math.random() < 0.35) { var open = order.filter(function(c) { return Four.g[c].length < Four.R; }); this.play(open[(Math.random() * open.length) | 0]); return; }
        for (let i = 0; i < 7; i++) {
            var c = order[i]; if (this.g[c].length >= this.R) continue;
            this.g[c].push(1); var v = this.mm(this.g, depth, -1e9, 1e9, 0, 1); this.g[c].pop();
            if (v > bv) { bv = v; best = c; }
        }
        this.play(best);
    },
    geo: function() { var cs = Math.min((cssW - 100) / this.C, (cssH - 250) / this.R, 90); return { cs: cs, x0: cssW / 2 - cs * this.C / 2, y0: 120 + cs * 0.75 }; },
    update: function() {
        if (this.drop) { this.drop.y += 0.35; if (this.drop.y >= this.R - 1 - this.drop.r) this.drop = null; return; }
        if (this.over) return;
        if (!this.human(this.turn)) { if (++this.cpuT > 30) { this.cpuT = 0; this.cpuMove(); } return; }
        var G = this.geo(), mc = Math.floor((mouseX - G.x0) / G.cs);
        if (Four.mouseMoved && mc >= 0 && mc < this.C) this.col = mc;
        var p = this.turn === 0 || tableCfg.vs !== "p2" || !multiplayer ? 0 : 1;
        var L = p ? ULDRleftPressed : WASDleftPressed, R = p ? ULDRrightPressed : WASDrightPressed, F = p ? !!PlayerInput[1].kbShoot : SpacePressed;
        var pad = (typeof Pads !== "undefined") ? Pads.state[p] : null;
        if (pad && pad.active) { L = L || pad.left; R = R || pad.right; F = F || pad.shoot; }
        if (L && !this.pL) this.col = Math.max(0, this.col - 1); if (R && !this.pR) this.col = Math.min(this.C - 1, this.col + 1);
        if (F && !this.pF) this.play(this.col);
        this.pL = L; this.pR = R; this.pF = F;
    },
    draw: function() {
        var G = this.geo(), cs = G.cs;
        ctx.fillStyle = "#0b1220"; ctx.fillRect(0, 0, cssW, cssH);
        // hover counter
        if (!this.over && !this.drop && this.human(this.turn)) { ctx.fillStyle = TABLE_COLORS[this.turn]; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(G.x0 + (this.col + 0.5) * cs, G.y0 - cs * 0.5, cs * 0.38, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        // counters behind the frame
        for (let c = 0; c < this.C; c++) for (let r = 0; r < this.g[c].length; r++) {
            var dropping = this.drop && this.drop.c === c && this.drop.r === r;
            var row = dropping ? this.drop.y : this.R - 1 - r;
            ctx.fillStyle = TABLE_COLORS[this.g[c][r]]; ctx.beginPath(); ctx.arc(G.x0 + (c + 0.5) * cs, G.y0 + (row + 0.5) * cs, cs * 0.4, 0, 7); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.arc(G.x0 + (c + 0.5) * cs, G.y0 + (row + 0.5) * cs, cs * 0.26, 0, 7); ctx.fill();
        }
        // frame with holes
        ctx.save();
        ctx.beginPath(); ctx.rect(G.x0 - 12, G.y0 - 12, cs * this.C + 24, cs * this.R + 24);
        for (let c = 0; c < this.C; c++) for (let r = 0; r < this.R; r++) { var hx = G.x0 + (c + 0.5) * cs, hy = G.y0 + (r + 0.5) * cs; ctx.moveTo(hx + cs * 0.42, hy); ctx.arc(hx, hy, cs * 0.42, 0, Math.PI * 2, true); }
        ctx.fillStyle = "#1d4ed8"; ctx.fill("evenodd");
        ctx.restore();
        if (this.line) { ctx.strokeStyle = "#fde047"; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.beginPath(); var p0 = this.line[0], p3 = this.line[3]; ctx.moveTo(G.x0 + (p0[0] + 0.5) * cs, G.y0 + (this.R - 1 - p0[1] + 0.5) * cs); ctx.lineTo(G.x0 + (p3[0] + 0.5) * cs, G.y0 + (this.R - 1 - p3[1] + 0.5) * cs); ctx.stroke(); }
        var who = function(t) { return (t === 0 ? "RED" : "BLUE") + (tableCfg.vs === "cpu" ? (t === 0 ? " (you)" : " (CPU)") : ""); };
        uiPanel(cssW / 2 - 200, 64, 400, 44, TABLE_COLORS[this.over ? Math.max(0, this.win) : this.turn]);
        uiText(this.over ? (this.win < 0 ? "DRAW!  ·  Space / click for a rematch" : who(this.win) + " WINS!  ·  Space / click for a rematch") : who(this.turn) + "'s turn", cssW / 2, 92, 16, "#fff", "center", "900");
        uiText("Click a column or ←/→ (A/D) + Space to drop · four in a line wins · Esc: opponent / game", cssW / 2, cssH - 14, 12, "rgba(220,230,240,0.7)", "center", "700");
    }
};

// ---------------------------------------------------------------- the mode
ModeKit.addLevel("table_games", { name: "🎲 Table Games", mode: "table", wavesEnabled: false, spawnP1: [0, 60], spawnP2: [60, 60], layout: ModeKit.room(-600, 600, 800, {}), title: "Table Games" });

GameModes.register({
    id: "table",
    title: "TABLE GAMES",
    tagline: "2-player minigames: tabletop flick soccer and four in a row. Vs CPU or pass-and-play.",
    color: "#22c55e",
    firstLevel: "table_games",
    flags: { ownScreen: true, waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, scenery: false, coopToggle: false },
    overTitle: "TABLE GAMES",

    setupLevel: function() { multiplayer = tableCfg.vs === "p2"; Flick.reset(); Four.reset(0); this.lastMouse = [mouseX, mouseY]; },

    screenFrame: function() {
        Four.mouseMoved = Math.hypot(mouseX - this.lastMouse[0], mouseY - this.lastMouse[1]) > 2;
        this.lastMouse = [mouseX, mouseY];
        if (tableCfg.game === "four") { Four.update(); Four.draw(); }
        else { Flick.update(); Flick.draw(); }
        if (tableCfg.game === "flick" && Flick.phase === "over" && (SpacePressed || (mouseDown && !Flick.mouseLock))) { Flick.reset(); Flick.mouseLock = true; }
        uiPanel(14, 10, 280, 48, "#22c55e");
        uiText("TABLE GAMES", 28, 36, 20, "#86efac", "left", "900");
        uiText((TABLE_GAMES.filter(function(g) { return g[0] === tableCfg.game; })[0] || ["", ""])[1] + "  ·  " + (tableCfg.vs === "cpu" ? "vs CPU (" + ["", "easy", "normal", "hard"][tableCfg.level] + ")" : "2 players"), 28, 52, 11, "#cbd5e1", "left", "800");
    },

    onClick: function(wx, wy, button) {
        if (button !== 0) return true;
        if (tableCfg.game === "four") {
            if (Four.over) { Four.reset(Four.win === 0 ? 1 : 0); return true; }
            if (!Four.human(Four.turn)) return true;
            var G = Four.geo(), c = Math.floor((mouseX - G.x0) / G.cs);
            if (c >= 0 && c < Four.C) { Four.col = c; Four.play(c); }
        }
        return true;
    },
    onKey: function(code) {
        if (code === "Tab") { Flick.tabDown = true; setTimeout(function() { Flick.tabDown = false; }, 80); return true; }
        if (tableCfg.game === "four" && Four.over && code === "Space") { Four.reset(Four.win === 0 ? 1 : 0); return true; }
        return false;
    },

    menuItems: function(items) {
        var gi = TABLE_GAMES.findIndex(function(g) { return g[0] === tableCfg.game; });
        items.push({ id: "tb_game", label: "Game:  ◀  " + TABLE_GAMES[Math.max(0, gi)][1] + "  ▶", hint: "", cycle: true });
        items.push({ id: "tb_vs", label: "Opponent:  ◀  " + (tableCfg.vs === "cpu" ? "CPU" : "Player 2 (pass and play)") + "  ▶", hint: "", cycle: true });
        if (tableCfg.vs === "cpu") items.push({ id: "tb_lvl", label: "CPU skill:  ◀  " + ["", "Easy", "Normal", "Hard"][tableCfg.level] + "  ▶", hint: "", cycle: true });
        items.push({ id: "tb_new", label: "New match", hint: "" });
    },
    onMenu: function(id, dir) {
        if (id === "tb_game") { var gi = TABLE_GAMES.findIndex(function(g) { return g[0] === tableCfg.game; }); tableCfg.game = TABLE_GAMES[(gi + (dir || 1) + TABLE_GAMES.length) % TABLE_GAMES.length][0]; saveTable(); return true; }
        if (id === "tb_vs") { tableCfg.vs = tableCfg.vs === "cpu" ? "p2" : "cpu"; multiplayer = tableCfg.vs === "p2"; saveTable(); Flick.reset(); Four.reset(0); return true; }
        if (id === "tb_lvl") { tableCfg.level = ((tableCfg.level - 1 + (dir || 1) + 3) % 3) + 1; saveTable(); return true; }
        if (id === "tb_new") { closePause(); Flick.reset(); Four.reset(0); return true; }
        return false;
    },
    onRestart: function() { Flick.reset(); Four.reset(0); },
    overSub: function() { return "Flick soccer & four in a row"; }
});
