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
var TABLE_GAMES = [["flick", "Flick Soccer"], ["four", "Four in a Row"], ["hockey", "Air Hockey"], ["arty", "Hill Cannons"], ["pool", "Pocket Race"], ["darts", "Sway Darts"]];
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
    human: function(team) { if (typeof Net !== "undefined" && Net.role === "client") return team === 1; return team === 0 || tableCfg.vs === "p2" || (team === 1 && !!Table.lanPid()); },

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
        // mouse: press on your disc, drag back, release (not for the LAN player's turn: they use their keys)
        var lanTurn = this.turn === 1 && Table.lanPid();
        var m = this.toWorld(mouseX, mouseY);
        if (lanTurn) { this.drag = null; }
        else {
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
        }
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
        if (team === 1 && Table.lanPid()) { var nb = Net.peerButtons(Table.lanPid()); return { left: nb.left, right: nb.right, up: nb.up, down: nb.down, fire: !!(Net.peers[Table.lanPid()].inp || {}).jt || !!(Net.peers[Table.lanPid()].inp || {}).sh, next: nb.build }; }
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
    human: function(t) { if (typeof Net !== "undefined" && Net.role === "client") return t === 1; return t === 0 || tableCfg.vs === "p2" || (t === 1 && !!Table.lanPid()); },
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
        if (Four.mouseMoved && mc >= 0 && mc < this.C && !(this.turn === 1 && Table.lanPid())) this.col = mc;
        var p = this.turn === 0 || tableCfg.vs !== "p2" || !multiplayer ? 0 : 1;
        var L = p ? ULDRleftPressed : WASDleftPressed, R = p ? ULDRrightPressed : WASDrightPressed, F = p ? !!PlayerInput[1].kbShoot : SpacePressed;
        if (this.turn === 1 && Table.lanPid()) { var nb = Net.peerButtons(Table.lanPid()); L = nb.left; R = nb.right; F = nb.go; }
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
        var who = function(t) {
            var lanC = typeof Net !== "undefined" && Net.role === "client", lanName = Table.lanPid() ? Net.peers[Table.lanPid()].name : "";
            if (lanC) return t === 1 ? "BLUE (you)" : "RED (host)";
            if (lanName) return t === 1 ? "BLUE (" + lanName + ")" : "RED (you)";
            return (t === 0 ? "RED" : "BLUE") + (tableCfg.vs === "cpu" ? (t === 0 ? " (you)" : " (CPU)") : "");
        };
        uiPanel(cssW / 2 - 200, 64, 400, 44, TABLE_COLORS[this.over ? Math.max(0, this.win) : this.turn]);
        uiText(this.over ? (this.win < 0 ? "DRAW!  ·  Space / click for a rematch" : who(this.win) + " WINS!  ·  Space / click for a rematch") : who(this.turn) + "'s turn", cssW / 2, 92, 16, "#fff", "center", "900");
        uiText("Click a column or ←/→ (A/D) + Space to drop · four in a line wins · Esc: opponent / game", cssW / 2, cssH - 14, 12, "rgba(220,230,240,0.7)", "center", "700");
    }
};

// ---------------------------------------------------------------- AIR HOCKEY (real time)
var Hockey = {
    RW: 1000, RH: 560, GOAL: 190, MR: 34, PR: 22, win: 7,
    m: [], puck: null, score: [0, 0], phase: "play", serveT: 0, msg: "", msgT: 0,
    reset: function() { this.score = [0, 0]; this.phase = "play"; this.serve(0); },
    serve: function(toward) {
        this.m = [{ x: -380, y: 0, px: -380, py: 0 }, { x: 380, y: 0, px: 380, py: 0 }];
        this.puck = { x: toward === 0 ? -120 : 120, y: 0, vx: 0, vy: 0 };
        this.serveT = 50;
    },
    scale: function() { return Math.min((cssW - 80) / (this.RW + 80), (cssH - 170) / (this.RH + 60)); },
    toScreen: function(x, y) { var s = this.scale(); return [cssW / 2 + x * s, cssH / 2 + 30 + y * s]; },
    toWorld: function(sx, sy) { var s = this.scale(); return [(sx - cssW / 2) / s, (sy - cssH / 2 - 30) / s]; },
    // where each mallet wants to go this frame
    target: function(side) {
        var M = this.m[side], W = this.RW / 2, H = this.RH / 2, pk = this.puck;
        var lan = side === 1 && Table.lanPid();
        if (side === 0 && !lan) {
            if (Hockey.mouseMoved) { var w = this.toWorld(mouseX, mouseY); return w; }
            var kx = (WASDrightPressed ? 1 : 0) - (WASDleftPressed ? 1 : 0), ky = (WASDdownPressed ? 1 : 0) - (WASDupPressed ? 1 : 0);
            return [M.x + kx * 14, M.y + ky * 14];
        }
        if (lan) { var nb = Net.peerButtons(Table.lanPid()); return [M.x + ((nb.right ? 1 : 0) - (nb.left ? 1 : 0)) * 14, M.y + ((nb.down ? 1 : 0) - (nb.up ? 1 : 0)) * 14]; }
        if (tableCfg.vs === "p2") return [M.x + ((ULDRrightPressed ? 1 : 0) - (ULDRleftPressed ? 1 : 0)) * 14, M.y + ((ULDRdownPressed ? 1 : 0) - (ULDRupPressed ? 1 : 0)) * 14];
        // CPU: guard the goal mouth, strike when the puck is on its half and coming / slow
        var lvl = tableCfg.level, home = [W - 90, Math.max(-this.GOAL / 2, Math.min(this.GOAL / 2, pk.y * 0.7))];
        if (pk.x > 0 && (pk.vx > -2 || pk.x > W * 0.5)) return [pk.x + 26, pk.y + (pk.y > 0 ? -8 : 8) + (Math.random() - 0.5) * (4 - lvl) * 20];
        return home;
    },
    update: function() {
        if (this.msgT > 0) this.msgT--;
        if (this.phase === "over") return;
        var W = this.RW / 2, H = this.RH / 2, self = this, maxSp = [0, 9, 13, 17][tableCfg.level];
        for (let side = 0; side < 2; side++) {
            var M = this.m[side], t = this.target(side);
            var lim = side === 0 ? [-W + this.MR, -this.MR] : [this.MR, W - this.MR];
            var tx = Math.max(lim[0], Math.min(lim[1], t[0])), ty = Math.max(-H + this.MR, Math.min(H - this.MR, t[1]));
            var dx = tx - M.x, dy = ty - M.y, d = Math.hypot(dx, dy), cap = (side === 1 && tableCfg.vs === "cpu" && !Table.lanPid()) ? maxSp : 40;
            if (d > cap) { dx *= cap / d; dy *= cap / d; }
            M.px = M.x; M.py = M.y; M.x += dx; M.y += dy;
        }
        if (this.serveT > 0) { this.serveT--; return; }
        var P = this.puck;
        for (let sub = 0; sub < 3; sub++) {
            P.x += P.vx / 3; P.y += P.vy / 3;
            if (P.y < -H + this.PR) { P.y = -H + this.PR; P.vy = Math.abs(P.vy) * 0.95; }
            if (P.y > H - this.PR) { P.y = H - this.PR; P.vy = -Math.abs(P.vy) * 0.95; }
            var inMouth = Math.abs(P.y) < this.GOAL / 2;
            if (!inMouth) { if (P.x < -W + this.PR) { P.x = -W + this.PR; P.vx = Math.abs(P.vx) * 0.95; } if (P.x > W - this.PR) { P.x = W - this.PR; P.vx = -Math.abs(P.vx) * 0.95; } }
            this.m.forEach(function(M) {
                var dx = P.x - M.x, dy = P.y - M.y, d = Math.hypot(dx, dy), md = self.MR + self.PR;
                if (d < md && d > 0) {
                    var nx = dx / d, ny = dy / d; P.x = M.x + nx * md; P.y = M.y + ny * md;
                    var mvx = M.x - M.px, mvy = M.y - M.py, rel = (P.vx - mvx) * nx + (P.vy - mvy) * ny;
                    if (rel < 0) { P.vx -= 1.9 * rel * nx; P.vy -= 1.9 * rel * ny; if (typeof SFX !== "undefined" && -rel > 4) SFX.play("hit", 0, 0, Math.min(1, -rel / 25)); }
                }
            });
        }
        var sp = Math.hypot(P.vx, P.vy); if (sp > 30) { P.vx *= 30 / sp; P.vy *= 30 / sp; }
        P.vx *= 0.996; P.vy *= 0.996;
        if (P.x < -W - this.PR || P.x > W + this.PR) {
            var scorer = P.x > 0 ? 0 : 1;
            this.score[scorer]++; this.msg = (scorer === 0 ? "RED" : "BLUE") + " SCORES!"; this.msgT = 90;
            if (typeof SFX !== "undefined") SFX.play("goal");
            if (this.score[scorer] >= this.win) { this.phase = "over"; this.winner = scorer; showBanner((scorer === 0 ? "RED" : "BLUE") + " WINS!", this.score[0] + " - " + this.score[1], TABLE_COLORS[scorer]); }
            else this.serve(1 - scorer);
        }
    },
    draw: function() {
        var s = this.scale(), W = this.RW / 2, H = this.RH / 2, G = this.GOAL / 2;
        ctx.fillStyle = "#0b1220"; ctx.fillRect(0, 0, cssW, cssH);
        var a = this.toScreen(-W, -H), b = this.toScreen(W, H);
        ctx.fillStyle = "#475569"; ctx.fillRect(a[0] - 16, a[1] - 16, b[0] - a[0] + 32, b[1] - a[1] + 32);
        ctx.fillStyle = "#e0f2fe"; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        ctx.fillStyle = "rgba(148,163,184,0.35)"; for (let x = a[0] + 14; x < b[0]; x += 28) for (let y = a[1] + 14; y < b[1]; y += 28) ctx.fillRect(x, y, 2, 2);   // air holes
        var c = this.toScreen(0, 0);
        ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c[0], a[1]); ctx.lineTo(c[0], b[1]); ctx.stroke();
        ctx.strokeStyle = "#3b82f6"; ctx.beginPath(); ctx.arc(c[0], c[1], 70 * s, 0, 7); ctx.stroke();
        [-1, 1].forEach(function(sd, i) { var p = Hockey.toScreen(sd * W, -G), q = Hockey.toScreen(sd * W, G); ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.strokeStyle = TABLE_COLORS[i]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p[0], c[1], G * s, sd < 0 ? -Math.PI / 2 : Math.PI / 2, sd < 0 ? Math.PI / 2 : Math.PI * 1.5); ctx.stroke(); });
        var pk = this.toScreen(this.puck.x, this.puck.y);
        ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(pk[0], pk[1], this.PR * s, 0, 7); ctx.fill(); ctx.strokeStyle = "#475569"; ctx.lineWidth = 2; ctx.stroke();
        this.m.forEach(function(M, i) {
            var q = Hockey.toScreen(M.x, M.y);
            ctx.fillStyle = TABLE_COLORS[i]; ctx.beginPath(); ctx.arc(q[0], q[1], Hockey.MR * s, 0, 7); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(q[0], q[1], Hockey.MR * s * 0.5, 0, 7); ctx.fill();
            ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q[0], q[1], Hockey.MR * s, 0, 7); ctx.stroke();
        });
        uiPanel(cssW / 2 - 150, 64, 300, 50, "#475569");
        uiText(String(this.score[0]), cssW / 2 - 80, 100, 32, TABLE_COLORS[0], "center", "900");
        uiText(String(this.score[1]), cssW / 2 + 80, 100, 32, TABLE_COLORS[1], "center", "900");
        uiText(this.phase === "over" ? (this.winner === 0 ? "RED" : "BLUE") + " WINS — Space" : "first to " + this.win, cssW / 2, 96, 13, "#e2e8f0", "center", "900");
        if (this.msgT > 0) uiText(this.msg, cssW / 2, cssH / 2, 56, "#0f172a", "center", "900");
        uiText("RED: mouse (or WASD) · BLUE: " + (tableCfg.vs === "p2" ? "arrows" : (Table.lanPid() ? "LAN player" : "CPU")) + " · first to " + this.win + " · Esc: opponent / game", cssW / 2, cssH - 14, 12, "rgba(220,230,240,0.7)", "center", "700");
    }
};

// LAN: the first LAN player takes BLUE (the CPU / P2 side)
// ---------------------------------------------------------------- HILL CANNONS (turn-based artillery)
//   Two cannons on rolling hills that crater where shells land. ←/→ (A/D) angle, ↑/↓ (W/S) power, Space fire
//   (or hold the mouse: aim + power follow the pointer, release fires). Wind changes every turn. 100 HP each.
var Arty = {
    W: 1600, N: 160, G: 0.25,
    reset: function(first) {
        var seed = Math.random() * 10;
        this.h = [];
        for (let i = 0; i <= this.N; i++) { var x = i / this.N; this.h.push(260 + Math.sin(x * 6.3 + seed) * 70 + Math.sin(x * 17 + seed * 2) * 28 + Math.sin(x * Math.PI) * 120); }
        this.tank = [{ x: 200, hp: 100, ang: 50, pow: 60 }, { x: this.W - 200, hp: 100, ang: 130, pow: 60 }];
        this.turn = first || 0; this.shell = null; this.boom = null; this.over = false; this.win = -1; this.cpuT = 0; this.trail = [];
        this.newWind();
    },
    newWind: function() { this.wind = Math.round((Math.random() * 2 - 1) * 10) / 100; },     // -0.10 .. 0.10 per frame
    human: function(t) { if (typeof Net !== "undefined" && Net.role === "client") return t === 1; return t === 0 || tableCfg.vs === "p2" || (t === 1 && !!Table.lanPid()); },
    ground: function(x) { var f = Math.max(0, Math.min(this.N, x / this.W * this.N)), i = Math.floor(f), t = f - i; return this.h[i] * (1 - t) + this.h[Math.min(this.N, i + 1)] * t; },
    muzzle: function(t) { var T = this.tank[t], a = T.ang * Math.PI / 180; return [T.x + Math.cos(a) * 34, this.ground(T.x) + 22 + Math.sin(a) * 34]; },
    fire: function() {
        if (this.shell || this.over) return;
        var T = this.tank[this.turn], a = T.ang * Math.PI / 180, v = T.pow * 0.22, m = this.muzzle(this.turn);
        this.shell = { x: m[0], y: m[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0 };
        this.trail = [];
        if (typeof SFX !== "undefined") SFX.play("shoot", 0, 0, 0.9, 0.6);
    },
    // one simulated flight (also used by the CPU to search for a shot); returns where it lands
    simulate: function(t, ang, pow) {
        var a = ang * Math.PI / 180, v = pow * 0.22, T = this.tank[t];
        var x = T.x + Math.cos(a) * 34, y = this.ground(T.x) + 22 + Math.sin(a) * 34, vx = Math.cos(a) * v, vy = Math.sin(a) * v;
        for (let i = 0; i < 1200; i++) {
            vx += this.wind; vy -= this.G; x += vx; y += vy;
            if (x < -200 || x > this.W + 200) return { x: x, y: y, out: true };
            if (y <= this.ground(x)) return { x: x, y: y };
        }
        return { x: x, y: y, out: true };
    },
    explode: function(x, y) {
        var R = 70;
        for (let i = 0; i <= this.N; i++) { var gx = i / this.N * this.W, d = Math.abs(gx - x); if (d < R) { var dip = Math.sqrt(R * R - d * d); this.h[i] = Math.max(40, Math.min(this.h[i], y - dip + R * 0.35)); } }
        for (let k = 0; k < 2; k++) {
            var T = this.tank[k], dd = Math.hypot(T.x - x, this.ground(T.x) + 14 - y);
            if (dd < R + 30) { var dmg = Math.round(55 * (1 - dd / (R + 30)) + 10); T.hp = Math.max(0, T.hp - dmg); T.hit = 40; T.lastDmg = dmg; }
        }
        this.boom = { x: x, y: y, t: 0 };
        if (typeof SFX !== "undefined") SFX.play("explode", 0, 0, 0.7);
        var dead = this.tank.map(function(T) { return T.hp <= 0; });
        if (dead[0] || dead[1]) { this.over = true; this.win = dead[0] && dead[1] ? -1 : (dead[0] ? 1 : 0); }
    },
    cpuMove: function() {
        var me = this.turn, foe = this.tank[1 - me], best = null, lvl = tableCfg.level;
        for (let a = me === 0 ? 20 : 100; a <= (me === 0 ? 80 : 160); a += 4) for (let p = 30; p <= 100; p += 4) {
            var r = this.simulate(me, a, p); if (r.out) continue;
            var d = Math.abs(r.x - foe.x) + (Math.abs(r.x - this.tank[me].x) < 110 ? 999 : 0);
            if (!best || d < best.d) best = { a: a, p: p, d: d };
        }
        if (!best) best = { a: this.tank[me].ang, p: 60 };
        var noise = [0, 9, 4, 1.2][lvl];
        this.tank[me].ang = Math.round(best.a + (Math.random() * 2 - 1) * noise);
        this.tank[me].pow = Math.max(20, Math.min(100, Math.round(best.p + (Math.random() * 2 - 1) * noise)));
        this.fire();
    },
    geo: function() { var s = Math.min((cssW - 40) / this.W, (cssH - 150) / 620); return { s: s, x0: cssW / 2 - this.W * s / 2, base: cssH - 40 }; },
    sx: function(x) { var g = this.geo(); return g.x0 + x * g.s; },
    sy: function(y) { var g = this.geo(); return g.base - y * g.s; },
    update: function() {
        var T = this.tank;
        for (let k = 0; k < 2; k++) if (T[k].hit > 0) T[k].hit--;
        if (this.boom && ++this.boom.t > 40) this.boom = null;
        if (this.shell) {
            var S = this.shell;
            for (let sub = 0; sub < 2; sub++) {
                S.vx += this.wind; S.vy -= this.G; S.x += S.vx; S.y += S.vy; S.t++;
                if (S.t % 2 === 0) this.trail.push([S.x, S.y]);
                if (S.x < -200 || S.x > this.W + 200 || S.y <= this.ground(S.x)) {
                    if (S.x >= -200 && S.x <= this.W + 200) this.explode(S.x, Math.max(S.y, this.ground(S.x)));
                    this.shell = null;
                    if (!this.over) { this.turn = 1 - this.turn; this.newWind(); this.cpuT = 0; }
                    break;
                }
            }
            return;
        }
        if (this.over || this.boom) return;
        if (!this.human(this.turn)) { if (++this.cpuT > 50) this.cpuMove(); return; }
        if (typeof Net !== "undefined" && Net.role === "client") return;
        var me = T[this.turn], p = this.turn === 0 || tableCfg.vs !== "p2" ? 0 : 1, lan = this.turn === 1 && Table.lanPid();
        var L, R, U, D, F;
        if (lan) { var inp = (Net.peers[lan] && Net.peers[lan].inp) || {}; L = !!inp.l; R = !!inp.r; U = !!inp.u; D = !!inp.d; F = !!(inp.sh || inp.jt); }
        else if (p === 0) { L = WASDleftPressed; R = WASDrightPressed; U = WASDupPressed; D = WASDdownPressed; F = SpacePressed; }
        else { L = ULDRleftPressed; R = ULDRrightPressed; U = ULDRupPressed; D = ULDRdownPressed; F = !!PlayerInput[1].kbShoot; }
        var pad = (typeof Pads !== "undefined" && !lan) ? Pads.state[p] : null;
        if (pad && pad.active) { L = L || pad.left; R = R || pad.right; U = U || pad.up; D = D || pad.down; F = F || pad.shoot; }
        if (L) me.ang = Math.min(178, me.ang + 1); if (R) me.ang = Math.max(2, me.ang - 1);
        if (U) me.pow = Math.min(100, me.pow + 0.6); if (D) me.pow = Math.max(10, me.pow - 0.6);
        // mouse: hold to aim (angle and power follow the pointer), release to fire
        if (!lan && p === 0 && mouseDown) {
            var mz = this.muzzle(this.turn), g = this.geo(), wx = (mouseX - g.x0) / g.s, wy = (g.base - mouseY) / g.s;
            me.ang = Math.max(2, Math.min(178, Math.round(Math.atan2(wy - mz[1], wx - mz[0]) * 180 / Math.PI)));
            me.pow = Math.max(10, Math.min(100, Math.round(Math.hypot(wx - mz[0], wy - mz[1]) / 5)));
            this.mouseAim = true;
        } else if (this.mouseAim && !mouseDown) { this.mouseAim = false; this.fire(); }
        if (F && !this.pF) this.fire();
        this.pF = F;
    },
    draw: function() {
        var self = this, g = this.geo();
        var sky = ctx.createLinearGradient(0, 0, 0, cssH); sky.addColorStop(0, "#0c1a33"); sky.addColorStop(1, "#1e3a5f");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, cssW, cssH);
        // hills
        ctx.beginPath(); ctx.moveTo(this.sx(0), cssH);
        for (let i = 0; i <= this.N; i++) ctx.lineTo(this.sx(i / this.N * this.W), this.sy(this.h[i]));
        ctx.lineTo(this.sx(this.W), cssH); ctx.closePath();
        ctx.fillStyle = "#3f6212"; ctx.fill(); ctx.strokeStyle = "#84cc16"; ctx.lineWidth = 3; ctx.stroke();
        // cannons
        for (let k = 0; k < 2; k++) {
            var T = this.tank[k], gx = this.sx(T.x), gy = this.sy(this.ground(T.x)), a = T.ang * Math.PI / 180, sc = g.s;
            ctx.save(); ctx.translate(gx, gy);
            ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 10 * sc + 2; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(0, -22 * sc); ctx.lineTo(Math.cos(a) * 34 * sc, -22 * sc - Math.sin(a) * 34 * sc); ctx.stroke();
            ctx.fillStyle = T.hit > 0 && T.hit % 6 < 3 ? "#fff" : TABLE_COLORS[k];
            ctx.beginPath(); ctx.arc(0, -14 * sc, 22 * sc, Math.PI, 0); ctx.fill(); ctx.fillRect(-30 * sc, -14 * sc, 60 * sc, 14 * sc);
            ctx.restore();
            uiBar(gx - 40, gy - 70 * sc - 14, 80, 8, T.hp / 100, TABLE_COLORS[k]);
            if (T.hit > 0) uiText("-" + T.lastDmg, gx, gy - 70 * sc - 24 - (40 - T.hit), 16, "#fde047", "center", "900");
        }
        // trail + shell + aim preview
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        this.trail.forEach(function(p) { ctx.fillRect(self.sx(p[0]) - 1.5, self.sy(p[1]) - 1.5, 3, 3); });
        if (this.shell) { ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(this.sx(this.shell.x), this.sy(this.shell.y), 5, 0, 7); ctx.fill(); }
        if (!this.shell && !this.over && this.human(this.turn)) {
            var M = this.muzzle(this.turn), T2 = this.tank[this.turn], a2 = T2.ang * Math.PI / 180, len = 30 + T2.pow * 0.9;
            ctx.strokeStyle = TABLE_COLORS[this.turn]; ctx.setLineDash([5, 6]); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(this.sx(M[0]), this.sy(M[1])); ctx.lineTo(this.sx(M[0] + Math.cos(a2) * len), this.sy(M[1] + Math.sin(a2) * len)); ctx.stroke(); ctx.setLineDash([]);
        }
        if (this.boom) { var b = this.boom; ctx.fillStyle = "rgba(251,146,60," + (1 - b.t / 40) + ")"; ctx.beginPath(); ctx.arc(this.sx(b.x), this.sy(b.y), (20 + b.t * 1.6) * g.s * 2, 0, 7); ctx.fill(); }
        // HUD: whose turn, angle / power, wind
        var who = function(t) {
            var lanC = typeof Net !== "undefined" && Net.role === "client", lanName = Table.lanPid() ? Net.peers[Table.lanPid()].name : "";
            if (lanC) return t === 1 ? "BLUE (you)" : "RED (host)";
            if (lanName) return t === 1 ? "BLUE (" + lanName + ")" : "RED (you)";
            return (t === 0 ? "RED" : "BLUE") + (tableCfg.vs === "cpu" ? (t === 0 ? " (you)" : " (CPU)") : "");
        };
        var Tt = this.tank[this.turn];
        uiPanel(cssW / 2 - 230, 64, 460, 54, TABLE_COLORS[this.over ? Math.max(0, this.win) : this.turn]);
        uiText(this.over ? (this.win < 0 ? "BOTH DOWN — DRAW!" : who(this.win) + " WINS!") + "  ·  Space for a rematch" : who(this.turn) + "'s shot" + (this.shell ? "…" : ""), cssW / 2, 88, 16, "#fff", "center", "900");
        var wtxt = this.wind === 0 ? "calm" : (this.wind > 0 ? "→ " : "← ") + Math.round(Math.abs(this.wind) * 100);
        uiText("angle " + Math.round(Tt.ang > 90 ? 180 - Tt.ang : Tt.ang) + "°   power " + Math.round(Tt.pow) + "   wind " + wtxt, cssW / 2, 108, 12, "#cbd5e1", "center", "800");
        uiText("←/→ angle · ↑/↓ power · Space fire (or hold the mouse to aim, release to fire) · Esc: opponent / game", cssW / 2, cssH - 14, 12, "rgba(220,230,240,0.7)", "center", "700");
    }
};

// ---------------------------------------------------------------- POCKET RACE (cue game)
//   7 balls, 6 pockets. Take turns striking the white ball: drag back from it and release (or ←/→ aim, ↑/↓ power,
//   Space). Potting a ball scores 1 and you go again; potting the white (a scratch) costs a point and passes the turn.
//   When the table is clear, the higher score wins.
var Pool = {
    PW: 1000, PH: 500, R: 15, PR: 30,
    reset: function(first) {
        this.balls = [];
        var cols = ["#facc15", "#3b82f6", "#ef4444", "#a855f7", "#f97316", "#22c55e", "#be123c"], k = 0;
        for (let row = 0; row < 4 && k < 7; row++) for (let i = 0; i <= row && k < 7; i++) this.balls.push({ x: 200 + row * this.R * 1.75, y: (i - row / 2) * this.R * 2.05, vx: 0, vy: 0, col: cols[k++] });
        this.cue = { x: -260, y: 0, vx: 0, vy: 0, col: "#f8fafc", cue: true };
        this.score = [0, 0]; this.turn = first || 0; this.phase = "aim"; this.aimA = 0; this.aimP = 0.5; this.drag = false; this.cpuT = 0; this.msg = ""; this.msgT = 0; this.potted = 0; this.scratch = false;
    },
    human: function(t) { return Flick.human(t); },
    scale: function() { return Math.min((cssW - 80) / (this.PW + 100), (cssH - 190) / (this.PH + 100)); },
    toScreen: function(x, y) { var s = this.scale(); return [cssW / 2 + x * s, cssH / 2 + 40 + y * s]; },
    toWorld: function(sx, sy) { var s = this.scale(); return [(sx - cssW / 2) / s, (sy - cssH / 2 - 40) / s]; },
    pockets: function() { var W = this.PW / 2, H = this.PH / 2; return [[-W, -H], [0, -H - 6], [W, -H], [-W, H], [0, H + 6], [W, H]]; },
    all: function() { return this.balls.concat([this.cue]); },
    shoot: function(ang, pow) {
        var sp = 3 + pow * 30;
        this.cue.vx = Math.cos(ang) * sp; this.cue.vy = Math.sin(ang) * sp;
        this.phase = "move"; this.potted = 0; this.scratch = false; this.drag = false;
        if (typeof SFX !== "undefined") SFX.play("hit", 0, 0, 0.4 + pow * 0.6);
    },
    physics: function() {
        var B = this.all(), W = this.PW / 2, H = this.PH / 2, R = this.R, P = this.pockets(), self = this;
        for (let sub = 0; sub < 3; sub++) {
            for (let i = 0; i < B.length; i++) {
                var b = B[i]; if (b.gone) continue;
                b.x += b.vx / 3; b.y += b.vy / 3;
                // pockets swallow a ball whose centre gets inside the mouth
                for (let p = 0; p < P.length; p++) if (Math.hypot(b.x - P[p][0], b.y - P[p][1]) < self.PR) {
                    b.gone = true; b.vx = b.vy = 0;
                    if (b.cue) self.scratch = true; else self.potted++;
                    if (typeof SFX !== "undefined") SFX.play("coin");
                    break;
                }
                if (b.gone) continue;
                if (b.x < -W + R) { b.x = -W + R; b.vx = Math.abs(b.vx) * 0.78; } if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx) * 0.78; }
                if (b.y < -H + R) { b.y = -H + R; b.vy = Math.abs(b.vy) * 0.78; } if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy) * 0.78; }
            }
            for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
                var a = B[i], c = B[j]; if (a.gone || c.gone) continue;
                var dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
                if (d >= 2 * R || d === 0) continue;
                var nx = dx / d, ny = dy / d, over = (2 * R - d) / 2;
                a.x -= nx * over; a.y -= ny * over; c.x += nx * over; c.y += ny * over;
                var rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
                if (rv < 0) { var jj = -rv * 0.96; a.vx -= jj * nx; a.vy -= jj * ny; c.vx += jj * nx; c.vy += jj * ny; }
            }
        }
        var still = true;
        B.forEach(function(q) { if (q.gone) return; q.vx *= 0.985; q.vy *= 0.985; if (Math.hypot(q.vx, q.vy) < 0.08) { q.vx = q.vy = 0; } else still = false; });
        if (!still) return;
        // the shot is over: score it
        var t = this.turn, name = t === 0 ? "RED" : "BLUE";
        if (this.potted) { this.score[t] += this.potted; this.msg = name + " pots " + this.potted + "!" + (this.scratch ? "" : "  Shoot again"); this.msgT = 100; }
        if (this.scratch) { this.score[t] = Math.max(0, this.score[t] - 1); this.msg = name + " scratched: -1"; this.msgT = 110; this.cue.gone = false; this.cue.x = -260; this.cue.y = 0; this.cue.vx = this.cue.vy = 0; }
        if (this.balls.every(function(b) { return b.gone; })) {
            this.phase = "over"; this.win = this.score[0] === this.score[1] ? -1 : (this.score[0] > this.score[1] ? 0 : 1);
            if (typeof showBanner === "function") showBanner(this.win < 0 ? "DRAW!" : (this.win === 0 ? "RED" : "BLUE") + " WINS!", this.score[0] + " - " + this.score[1], this.win < 0 ? "#e2e8f0" : TABLE_COLORS[this.win]);
            return;
        }
        if (!this.potted || this.scratch) this.turn = 1 - t;
        this.phase = "aim"; this.cpuT = 0;
    },
    // CPU: for every ball and pocket, find where the white must hit it ("ghost ball"), skip blocked lines, prefer
    // straight shots that are short; aim noise by skill
    cpu: function() {
        var c = this.cue, R = this.R, best = null, self = this, lvl = tableCfg.level;
        var clear = function(x0, y0, x1, y1, skip) {
            var lx = x1 - x0, ly = y1 - y0, L = Math.hypot(lx, ly) || 1;
            return self.balls.every(function(o) { if (o.gone || o === skip) return true; var t = ((o.x - x0) * lx + (o.y - y0) * ly) / (L * L); return t < 0 || t > 1 || Math.hypot(x0 + lx * t - o.x, y0 + ly * t - o.y) > 2 * R; });
        };
        this.balls.forEach(function(b) {
            if (b.gone) return;
            self.pockets().forEach(function(p) {
                var px = p[0] - b.x, py = p[1] - b.y, pl = Math.hypot(px, py);
                var gx = b.x - px / pl * 2 * R, gy = b.y - py / pl * 2 * R;            // ghost-ball position
                var ax = gx - c.x, ay = gy - c.y, al = Math.hypot(ax, ay);
                var cut = (ax / al) * (px / pl) + (ay / al) * (py / pl);
                if (cut < 0.25 || !clear(c.x, c.y, gx, gy, b) || !clear(b.x, b.y, p[0], p[1], b)) return;
                var sc = cut * 200 - al * 0.08 - pl * 0.1;
                if (!best || sc > best.sc) best = { sc: sc, ang: Math.atan2(ay, ax), pow: Math.min(1, 0.25 + (al + pl) / 1500 + (1 - cut) * 0.3) };
            });
        });
        if (!best) best = { ang: Math.random() * Math.PI * 2, pow: 0.6 };                // nothing on: a safety bash
        var noise = [0, 0.09, 0.035, 0.008][lvl];
        this.shoot(best.ang + (Math.random() - 0.5) * noise, best.pow);
    },
    update: function() {
        if (this.msgT > 0) this.msgT--;
        if (this.phase === "move") { this.physics(); return; }
        if (this.phase !== "aim") return;
        if (!this.human(this.turn)) { if (++this.cpuT > 50) this.cpu(); return; }
        if (typeof Net !== "undefined" && Net.role === "client") return;
        var lanTurn = this.turn === 1 && Table.lanPid(), m = this.toWorld(mouseX, mouseY);
        if (!lanTurn) {
            if (mouseDown && !this.drag && Math.hypot(this.cue.x - m[0], this.cue.y - m[1]) < this.R + 30) this.drag = true;
            if (this.drag) { var qx = this.cue.x - m[0], qy = this.cue.y - m[1]; this.aimA = Math.atan2(qy, qx); this.aimP = Math.min(1, Math.hypot(qx, qy) / 260); }
            if (!mouseDown && this.drag) { if (this.aimP > 0.05) { this.shoot(this.aimA, this.aimP); return; } this.drag = false; }
        }
        var ks = Flick.keys(this.turn);
        if (ks.left) this.aimA -= 0.025; if (ks.right) this.aimA += 0.025;
        if (ks.up) this.aimP = Math.min(1, this.aimP + 0.012); if (ks.down) this.aimP = Math.max(0.05, this.aimP - 0.012);
        if (ks.fire && !this.prevFire && !this.drag) this.shoot(this.aimA, this.aimP);
        this.prevFire = ks.fire;
    },
    draw: function() {
        var s = this.scale(), W = this.PW / 2, H = this.PH / 2, self = this;
        ctx.fillStyle = "#0b1220"; ctx.fillRect(0, 0, cssW, cssH);
        var a = this.toScreen(-W - 34, -H - 34), z = this.toScreen(W + 34, H + 34);
        ctx.fillStyle = "#78350f"; ctx.fillRect(a[0], a[1], z[0] - a[0], z[1] - a[1]);
        var a2 = this.toScreen(-W, -H), z2 = this.toScreen(W, H);
        ctx.fillStyle = "#166534"; ctx.fillRect(a2[0], a2[1], z2[0] - a2[0], z2[1] - a2[1]);
        this.pockets().forEach(function(p) { var q = self.toScreen(p[0], p[1]); ctx.fillStyle = "#020617"; ctx.beginPath(); ctx.arc(q[0], q[1], self.PR * s, 0, 7); ctx.fill(); });
        // aim line + cue stick (human's turn)
        if (this.phase === "aim" && !this.cue.gone && (this.human(this.turn) || this.drag)) {
            var c = this.toScreen(this.cue.x, this.cue.y), L = 160 * s;
            ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.setLineDash([6, 8]); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + Math.cos(this.aimA) * 420 * s, c[1] + Math.sin(this.aimA) * 420 * s); ctx.stroke(); ctx.setLineDash([]);
            var back = (20 + this.aimP * 90) * s;
            ctx.strokeStyle = "#d6a35c"; ctx.lineWidth = 7 * s + 2; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(c[0] - Math.cos(this.aimA) * back, c[1] - Math.sin(this.aimA) * back); ctx.lineTo(c[0] - Math.cos(this.aimA) * (back + L * 2), c[1] - Math.sin(this.aimA) * (back + L * 2)); ctx.stroke();
        }
        this.all().forEach(function(b) {
            if (b.gone) return;
            var q = self.toScreen(b.x, b.y);
            ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(q[0], q[1], self.R * s, 0, 7); ctx.fill();
            ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(q[0] - self.R * s * 0.35, q[1] - self.R * s * 0.35, self.R * s * 0.3, 0, 7); ctx.fill();
        });
        var who = function(t) { return (t === 0 ? "RED" : "BLUE") + (tableCfg.vs === "cpu" ? (t === 0 ? " (you)" : " (CPU)") : ""); };
        uiPanel(cssW / 2 - 230, 64, 460, 54, this.phase === "over" ? (this.win < 0 ? "#e2e8f0" : TABLE_COLORS[this.win]) : TABLE_COLORS[this.turn]);
        uiText(this.phase === "over" ? (this.win < 0 ? "DRAW" : who(this.win) + " WINS") + "  ·  Space for a rematch" : (this.msgT > 0 ? this.msg : who(this.turn) + "'s shot"), cssW / 2, 88, 16, "#fff", "center", "900");
        uiText("RED " + this.score[0] + "   ·   BLUE " + this.score[1] + "   ·   " + this.balls.filter(function(b) { return !b.gone; }).length + " balls left", cssW / 2, 108, 12, "#cbd5e1", "center", "800");
        uiText("Drag back from the white ball and let go (or ←/→ aim, ↑/↓ power, Space) · pot = +1 and shoot again · scratch = -1 · Esc: opponent / game", cssW / 2, cssH - 14, 12, "rgba(220,230,240,0.7)", "center", "700");
    }
};

// ---------------------------------------------------------------- SWAY DARTS
//   The aim point drifts in a figure-eight; Space / click throws. Hold Space / the mouse to steady your hand for a
//   moment (then the sway comes back stronger). Rings: bull 50, inner 25, then 20 / 15 / 10 / 5 outward, the outer
//   double ring scores twice its ring. 3 darts a turn, 5 rounds, higher total wins.
var Darts = {
    R: 220,
    reset: function(first) { this.score = [0, 0]; this.turn = first || 0; this.round = 1; this.dart = 0; this.hits = []; this.t = Math.random() * 100; this.steady = 0; this.tired = 0; this.over = false; this.win = -1; this.cpuT = 0; this.flash = null; this.wait = 0; },
    human: function(t) { return Flick.human(t); },
    geo: function() { var s = Math.min(cssW, cssH - 140) / (this.R * 2 + 120); return { s: s, cx: cssW / 2, cy: cssH / 2 + 30 }; },
    aim: function() {
        var amp = (95 + this.round * 8) * (this.steady > 0 ? 0.5 : 1) * (1 + this.tired * 0.8), sp = 0.035 + this.round * 0.003;
        var cx = Math.sin(this.t * 0.011) * 45, cy = Math.cos(this.t * 0.007) * 35;             // the whole sway drifts too
        return [cx + Math.sin(this.t * sp) * amp, cy + Math.sin(this.t * sp * 2 + 1.3) * amp * 0.6];
    },
    value: function(x, y) {
        var d = Math.hypot(x, y), R = this.R;
        if (d < R * 0.05) return 50; if (d < R * 0.12) return 25;
        if (d > R) return 0;
        var ring = d < R * 0.3 ? 20 : d < R * 0.5 ? 15 : d < R * 0.75 ? 10 : 5;
        return d > R * 0.9 ? ring * 2 : ring;
    },
    throwAt: function(x, y) {
        var v = this.value(x, y);
        this.score[this.turn] += v; this.hits.push([x, y, this.turn]);
        this.flash = { v: v, t: 50 }; this.dart++; this.steady = 0; this.tired = 0; this.wait = 25;
        if (typeof SFX !== "undefined") SFX.play(v >= 25 ? "coin" : "hit", 0, 0, 0.6);
        if (this.dart >= 3) {
            this.dart = 0; this.turn = 1 - this.turn; this.cpuT = 0; this.wait = 70;
            if (this.turn === 0) { this.round++; this.hits = []; }
            if (this.round > 5) { this.over = true; this.win = this.score[0] === this.score[1] ? -1 : (this.score[0] > this.score[1] ? 0 : 1); if (typeof showBanner === "function") showBanner(this.win < 0 ? "DRAW!" : (this.win ? "BLUE" : "RED") + " WINS!", this.score[0] + " - " + this.score[1], this.win < 0 ? "#e2e8f0" : TABLE_COLORS[this.win]); }
        }
    },
    update: function() {
        this.t++;
        if (this.flash && --this.flash.t <= 0) this.flash = null;
        if (this.over) return;
        if (this.wait > 0) { this.wait--; return; }
        if (!this.human(this.turn)) {
            // the CPU waits for a calm moment in the sway, then throws with skill-based error
            if (++this.cpuT > 40) { var a = this.aim(), err = [0, 70, 40, 18][tableCfg.level]; if (Math.hypot(a[0], a[1]) < 30 + err || this.cpuT > 160) this.throwAt(a[0] * 0.5 + (Math.random() - 0.5) * err * 2.4, a[1] * 0.5 + (Math.random() - 0.5) * err * 2.4); }
            return;
        }
        if (typeof Net !== "undefined" && Net.role === "client") return;
        var lan = this.turn === 1 && Table.lanPid(), inp = lan ? ((Net.peers[lan] && Net.peers[lan].inp) || {}) : null;
        var hold = lan ? !!(inp.sh || inp.jt) : (this.turn === 0 || tableCfg.vs !== "p2" ? (SpacePressed || mouseDown) : !!PlayerInput[1].kbShoot);
        // hold to steady (up to ~1 s), release to throw; holding too long makes your hand shake
        if (hold) { this.held = (this.held || 0) + 1; if (this.held < 60) this.steady = 1; else { this.steady = 0; this.tired = Math.min(1, (this.held - 60) / 60); } }
        else if (this.held) { this.held = 0; var a2 = this.aim(); this.throwAt(a2[0], a2[1]); }
    },
    draw: function() {
        var G = this.geo(), s = G.s, R = this.R, self = this;
        ctx.fillStyle = "#0b1220"; ctx.fillRect(0, 0, cssW, cssH);
        var rings = [[1.04, "#111827"], [1, "#ca8a04"], [0.9, "#b91c1c"], [0.75, "#f5f5f4"], [0.5, "#15803d"], [0.3, "#f5f5f4"], [0.12, "#15803d"], [0.05, "#b91c1c"]];
        rings.forEach(function(r) { ctx.fillStyle = r[1]; ctx.beginPath(); ctx.arc(G.cx, G.cy, R * r[0] * s, 0, 7); ctx.fill(); });
        ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1;
        for (let k = 0; k < 20; k++) { var an = k / 20 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(G.cx + Math.cos(an) * R * 0.12 * s, G.cy + Math.sin(an) * R * 0.12 * s); ctx.lineTo(G.cx + Math.cos(an) * R * s, G.cy + Math.sin(an) * R * s); ctx.stroke(); }
        [[0.95, "×2"], [0.62, "10"], [0.4, "15"], [0.21, "20"]].forEach(function(l) { uiText(l[1], G.cx, G.cy - R * l[0] * s + 5, 11, "#94a3b8", "center", "800"); });
        this.hits.forEach(function(h) { var x = G.cx + h[0] * s, y = G.cy + h[1] * s; ctx.fillStyle = TABLE_COLORS[h[2]]; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); });
        if (!this.over && this.wait <= 0) {
            var a = this.aim(), ax = G.cx + a[0] * s, ay = G.cy + a[1] * s, col = TABLE_COLORS[this.turn];
            ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ax, ay, 14, 0, 7); ctx.moveTo(ax - 22, ay); ctx.lineTo(ax + 22, ay); ctx.moveTo(ax, ay - 22); ctx.lineTo(ax, ay + 22); ctx.stroke();
        }
        if (this.flash) uiText(this.flash.v ? "+" + this.flash.v : "MISS", G.cx, G.cy - R * s - 18, 26, this.flash.v >= 25 ? "#fde047" : "#fff", "center", "900");
        var who = function(t) { return (t === 0 ? "RED" : "BLUE") + (tableCfg.vs === "cpu" ? (t === 0 ? " (you)" : " (CPU)") : ""); };
        uiPanel(cssW / 2 - 230, 64, 460, 54, this.over ? (this.win < 0 ? "#e2e8f0" : TABLE_COLORS[this.win]) : TABLE_COLORS[this.turn]);
        uiText(this.over ? (this.win < 0 ? "DRAW" : who(this.win) + " WINS") + "  ·  Space for a rematch" : who(this.turn) + "  ·  dart " + (this.dart + 1) + " of 3  ·  round " + Math.min(5, this.round) + " / 5", cssW / 2, 88, 16, "#fff", "center", "900");
        uiText("RED " + this.score[0] + "   ·   BLUE " + this.score[1], cssW / 2, 108, 13, "#cbd5e1", "center", "800");
        uiText("Hold Space (or the mouse) to steady your hand, let go to throw · hold too long and you shake · Esc: opponent / game", cssW / 2, cssH - 14, 12, "rgba(220,230,240,0.7)", "center", "700");
    }
};

// ---------------------------------------------------------------- the glue: which game is on, LAN state
var Table = {
    lanPid: function() { if (typeof Net === "undefined" || Net.role !== "host") return null; for (var k in Net.peers) return Net.peers[k].pid; return null; },
    netState: function() {
        return { g: tableCfg.game, vs: tableCfg.vs, lan: !!Table.lanPid(), lanName: Table.lanPid() ? Net.peers[Table.lanPid()].name : "",
            f: { d: Flick.discs.map(function(q) { return [Math.round(q.x), Math.round(q.y), q.t]; }), b: [Math.round(Flick.ball.x), Math.round(Flick.ball.y)], turn: Flick.turn, phase: Flick.phase, score: Flick.score, sel: Flick.sel, aimA: Flick.aimA, aimP: Flick.aimP, msg: Flick.msg, msgT: Flick.msgT, win: Flick.winner },
            q: { g: Four.g, turn: Four.turn, over: Four.over, win: Four.win, line: Four.line, col: Four.col },
            a: Arty.h ? { h: Arty.h.map(Math.round), k: Arty.tank.map(function(T) { return [T.x, T.hp, Math.round(T.ang), Math.round(T.pow), T.hit || 0, T.lastDmg || 0]; }), t: Arty.turn, s: Arty.shell ? [Math.round(Arty.shell.x), Math.round(Arty.shell.y)] : null, w: Arty.wind, o: Arty.over, win: Arty.win, b: Arty.boom ? [Arty.boom.x, Arty.boom.y, Arty.boom.t] : null } : null,
            p: Pool.balls ? { b: Pool.all().map(function(b) { return [Math.round(b.x), Math.round(b.y), b.gone ? 1 : 0]; }), s: Pool.score, t: Pool.turn, ph: Pool.phase, a: Pool.aimA, pw: Pool.aimP, m: Pool.msg, mt: Pool.msgT, w: Pool.win } : null,
            d: Darts.score ? { s: Darts.score, t: Darts.turn, r: Darts.round, n: Darts.dart, h: Darts.hits.map(function(q) { return [Math.round(q[0]), Math.round(q[1]), q[2]]; }), tt: Darts.t, st: Darts.steady, ti: Darts.tired, o: Darts.over, w: Darts.win, f: Darts.flash, wa: Darts.wait } : null,
            h: { m: Hockey.m.map(function(M) { return [Math.round(M.x), Math.round(M.y)]; }), p: [Math.round(Hockey.puck.x), Math.round(Hockey.puck.y)], s: Hockey.score, ph: Hockey.phase, w: Hockey.winner, msg: Hockey.msg, mt: Hockey.msgT } };
    },
    apply: function(m) {
        tableCfg.game = m.g; tableCfg.vs = m.vs; Table.remote = m.lan; Table.remoteName = m.lanName;
        var F = m.f;
        if (!Flick.discs.length) Flick.kickoff(0);
        F.d.forEach(function(a, i) { if (Flick.discs[i]) { Flick.discs[i].x = a[0]; Flick.discs[i].y = a[1]; Flick.discs[i].t = a[2]; } });
        Flick.ball.x = F.b[0]; Flick.ball.y = F.b[1]; Flick.turn = F.turn; Flick.phase = F.phase; Flick.score = F.score; Flick.sel = F.sel; Flick.aimA = F.aimA; Flick.aimP = F.aimP; Flick.msg = F.msg; Flick.msgT = F.msgT; Flick.winner = F.win;
        if (m.h) { if (!Hockey.puck) Hockey.reset(); m.h.m.forEach(function(a, i) { Hockey.m[i].x = a[0]; Hockey.m[i].y = a[1]; }); Hockey.puck.x = m.h.p[0]; Hockey.puck.y = m.h.p[1]; Hockey.score = m.h.s; Hockey.phase = m.h.ph; Hockey.winner = m.h.w; Hockey.msg = m.h.msg; Hockey.msgT = m.h.mt; }
        if (m.a) { var A = m.a; if (!Arty.h) Arty.reset(0); Arty.h = A.h; A.k.forEach(function(k, i) { var T = Arty.tank[i]; T.x = k[0]; T.hp = k[1]; T.ang = k[2]; T.pow = k[3]; T.hit = k[4]; T.lastDmg = k[5]; }); Arty.turn = A.t; Arty.shell = A.s ? { x: A.s[0], y: A.s[1] } : null; Arty.wind = A.w; Arty.over = A.o; Arty.win = A.win; Arty.boom = A.b ? { x: A.b[0], y: A.b[1], t: A.b[2] } : null; if (Arty.shell) Arty.trail.push([Arty.shell.x, Arty.shell.y]); else Arty.trail = Arty.trail.slice(-200); }
        if (m.p) { if (!Pool.balls) Pool.reset(0); var PB = Pool.all(); m.p.b.forEach(function(q, i) { if (PB[i]) { PB[i].x = q[0]; PB[i].y = q[1]; PB[i].gone = !!q[2]; } }); Pool.score = m.p.s; Pool.turn = m.p.t; Pool.phase = m.p.ph; Pool.aimA = m.p.a; Pool.aimP = m.p.pw; Pool.msg = m.p.m; Pool.msgT = m.p.mt; Pool.win = m.p.w; }
        if (m.d) { if (!Darts.score) Darts.reset(0); var D = m.d; Darts.score = D.s; Darts.turn = D.t; Darts.round = D.r; Darts.dart = D.n; Darts.hits = D.h; Darts.t = D.tt; Darts.steady = D.st; Darts.tired = D.ti; Darts.over = D.o; Darts.win = D.w; Darts.flash = D.f; Darts.wait = D.wa; }
        var Q = m.q; Four.g = Q.g; Four.turn = Q.turn; Four.over = Q.over; Four.win = Q.win; Four.line = Q.line; Four.col = Q.col; Four.drop = null;
    }
};

// ---------------------------------------------------------------- the mode
ModeKit.addLevel("table_games", { name: "🎲 Table Games", mode: "table", wavesEnabled: false, spawnP1: [0, 60], spawnP2: [60, 60], layout: ModeKit.room(-600, 600, 800, {}), title: "Table Games" });

GameModes.register({
    id: "table",
    title: "TABLE GAMES",
    tagline: "2-player minigames: tabletop flick soccer, four in a row, air hockey, hill cannons, a pocket-race cue game and darts. Vs CPU, pass-and-play or LAN.",
    color: "#22c55e",
    firstLevel: "table_games",
    flags: { ownScreen: true, waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, scenery: false, coopToggle: false },
    overTitle: "TABLE GAMES",

    seats: function() {
        return [{ label: "RED", options: ["human"], value: "human", set: function() {} },
            { label: "BLUE", options: ["human", "cpu"], value: tableCfg.vs === "p2" ? "human" : "cpu", note: "human = pass-and-play (or a LAN player takes BLUE)", set: function(v) { tableCfg.vs = v === "human" ? "p2" : "cpu"; multiplayer = v === "human"; saveTable(); Flick.reset(); Four.reset(0); Hockey.reset(); Arty.reset(0); Pool.reset(0); Darts.reset(0); } }];
    },
    setupLevel: function() { multiplayer = tableCfg.vs === "p2"; Flick.reset(); Four.reset(0); Hockey.reset(); Arty.reset(0); Pool.reset(0); Darts.reset(0); this.lastMouse = [mouseX, mouseY]; },

    screenFrame: function() {
        Four.mouseMoved = Math.hypot(mouseX - this.lastMouse[0], mouseY - this.lastMouse[1]) > 2;
        this.lastMouse = [mouseX, mouseY];
        Hockey.mouseMoved = Four.mouseMoved || (Hockey.mouseMoved && !(WASDleftPressed || WASDrightPressed || WASDupPressed || WASDdownPressed));
        if (tableCfg.game === "four") { Four.update(); Four.draw(); }
        else if (tableCfg.game === "hockey") { Hockey.update(); Hockey.draw(); if (Hockey.phase === "over" && SpacePressed) Hockey.reset(); }
        else if (tableCfg.game === "arty") { Arty.update(); Arty.draw(); if (Arty.over && SpacePressed && !Arty.pF) Arty.reset(Arty.win === 0 ? 1 : 0); Arty.pF = SpacePressed; }
        else if (tableCfg.game === "darts") { Darts.update(); Darts.draw(); if (Darts.over && SpacePressed && !Darts.pF) Darts.reset(Darts.win === 0 ? 1 : 0); Darts.pF = SpacePressed; }
        else if (tableCfg.game === "pool") { Pool.update(); Pool.draw(); if (Pool.phase === "over" && SpacePressed && !Pool.pF) Pool.reset(Pool.win === 0 ? 1 : 0); Pool.pF = SpacePressed; }
        else { Flick.update(); Flick.draw(); }
        if (tableCfg.game === "flick" && Flick.phase === "over" && (SpacePressed || (mouseDown && !Flick.mouseLock))) { Flick.reset(); Flick.mouseLock = true; }
        uiPanel(14, 10, 280, 48, "#22c55e");
        uiText("TABLE GAMES", 28, 36, 20, "#86efac", "left", "900");
        uiText((TABLE_GAMES.filter(function(g) { return g[0] === tableCfg.game; })[0] || ["", ""])[1] + "  ·  " + (tableCfg.vs === "cpu" ? "vs CPU (" + ["", "easy", "normal", "hard"][tableCfg.level] + ")" : "2 players"), 28, 52, 11, "#cbd5e1", "left", "800");
    },

    screenDraw: function() {
        // LAN client view: blue is me; reuse the normal drawing (client-side "human" = it's my turn)
        if (tableCfg.game === "four") Four.draw(); else if (tableCfg.game === "hockey") Hockey.draw(); else if (tableCfg.game === "arty") Arty.draw(); else if (tableCfg.game === "pool") Pool.draw(); else if (tableCfg.game === "darts") Darts.draw(); else Flick.draw();
        uiPanel(14, 10, 300, 48, "#22c55e");
        uiText("TABLE GAMES  ·  you are BLUE", 28, 36, 16, "#86efac", "left", "900");
        uiText("Four in a Row: ←/→ + Space   ·   Flick: ←/→ aim, ↑/↓ power, E next disc, Space shoot", 28, 52, 10, "#cbd5e1", "left", "700");
    },
    netState: function() { return Table.netState(); },
    applyNetState: function(m) { Table.apply(m); },
    onClick: function(wx, wy, button) {
        if (button !== 0) return true;
        if (tableCfg.game === "four") {
            if (Four.over) { Four.reset(Four.win === 0 ? 1 : 0); return true; }
            if (!Four.human(Four.turn) || (Four.turn === 1 && Table.lanPid())) return true;
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
        if (id === "tb_vs") { tableCfg.vs = tableCfg.vs === "cpu" ? "p2" : "cpu"; multiplayer = tableCfg.vs === "p2"; saveTable(); Flick.reset(); Four.reset(0); Hockey.reset(); Arty.reset(0); Pool.reset(0); Darts.reset(0); return true; }
        if (id === "tb_lvl") { tableCfg.level = ((tableCfg.level - 1 + (dir || 1) + 3) % 3) + 1; saveTable(); return true; }
        if (id === "tb_new") { closePause(); Flick.reset(); Four.reset(0); Hockey.reset(); Arty.reset(0); Pool.reset(0); Darts.reset(0); return true; }
        return false;
    },
    onRestart: function() { Flick.reset(); Four.reset(0); Hockey.reset(); Arty.reset(0); Pool.reset(0); Darts.reset(0); },
    overSub: function() { return "Flick soccer · four in a row · air hockey · hill cannons · pocket race · darts"; }
});
