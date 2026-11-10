// ============================================================================
// GAME: PARTY BOARD  (party)  -  dice board + minigames (original, mario-party-style)
//   2-4 players race round a looping board. On your turn press your button to roll (1-6), hop along the spaces:
//   BLUE +3 coins, RED -3 coins, ? = a random event, ★ = buy a star for 20 coins if you pass it (it then moves).
//   After everyone moves, a quick minigame: MASH (tap fastest), QUICK DRAW (press on GO, not before) or STOP IT
//   (stop the counter on the target). Winners get 10 coins. Most stars after 10 rounds wins (coins break ties).
//   Buttons: P1 Space, P2 Enter, P3/P4 = gamepads 3/4 (or CPUs). Players / CPUs: pause menu.
//   Runs on its own screen (engine `ownScreen` flag).
// ============================================================================
var partyCfg = { humans: 1, players: 4, rounds: 10 };
try { var _pc = JSON.parse(localStorage.getItem("timsPartyBoard") || "null"); if (_pc) for (var _k2 in _pc) partyCfg[_k2] = _pc[_k2]; } catch (e) {}
function saveParty() { try { localStorage.setItem("timsPartyBoard", JSON.stringify(partyCfg)); } catch (e) {} }
var PARTY_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#facc15"];

var Party = {
    spaces: [], pl: [], turn: 0, round: 1, phase: "intro", t: 0, die: 0, steps: 0, star: 0, mini: null, msg: "", msgT: 0, log: [],

    build: function() {
        // a rounded-rectangle loop of 28 spaces with a few events and one star spot
        var S = [], n = 28;
        for (let i = 0; i < n; i++) {
            var u = i / n, x, y;
            if (u < 0.3) { x = -0.42 + (u / 0.3) * 0.84; y = -0.36; }
            else if (u < 0.5) { x = 0.42; y = -0.36 + ((u - 0.3) / 0.2) * 0.72; }
            else if (u < 0.8) { x = 0.42 - ((u - 0.5) / 0.3) * 0.84; y = 0.36; }
            else { x = -0.42; y = 0.36 - ((u - 0.8) / 0.2) * 0.72; }
            S.push({ x: x, y: y, k: i % 7 === 3 ? "event" : (i % 5 === 2 ? "red" : "blue") });
        }
        S[0].k = "start";
        this.spaces = S;
        this.moveStar();
    },
    moveStar: function() {
        var opts = [];
        for (let i = 2; i < this.spaces.length; i++) if (this.spaces[i].k !== "event" && i !== this.star) opts.push(i);
        this.star = opts[(Math.random() * opts.length) | 0];
    },

    reset: function() {
        this.build();
        this.pl = [];
        for (let i = 0; i < partyCfg.players; i++) {
            // P1 / P2 by the Humans setting; P3 / P4 are human only when their gamepad is plugged in
            var cpu = i < 2 ? i >= partyCfg.humans : !this.padFor(i);
            this.pl.push({ i: i, name: cpu ? "CPU " + (i + 1) : "P" + (i + 1), cpu: cpu, pos: 0, coins: 10, stars: 0, hop: 0, col: PARTY_COLORS[i], wins: 0 });
        }
        this.turn = 0; this.round = 1; this.phase = "intro"; this.t = 0; this.log = [];
        multiplayer = partyCfg.humans > 1;
        this.say("Round 1 — " + this.pl[0].name + " rolls first!");
    },
    padFor: function(i) { var p = (typeof Pads !== "undefined") ? Pads.state[i] : null; return i >= 2 && p && p.active; },
    keyName: function(P) { if (P.pid) return (typeof Net !== "undefined" && Net.role === "client" && P.pid === Net.pid) ? "Space" : P.name + "'s Space"; return ["Space", "Enter", "pad 3", "pad 4"][P.i]; },
    btn: function(i) {
        var seat = this.pl[i];
        if (seat && seat.pid && typeof Net !== "undefined") return Net.peerButtons(seat.pid).go;
        var pad = (typeof Pads !== "undefined") ? Pads.state[i] : null, pd = !!(pad && pad.active && (pad.shoot || pad.up));
        if (i === 0) return SpacePressed || mouseDown || pd;
        if (i === 1) return !!PlayerInput[1].kbShoot || ULDRupPressed || pd;
        return pd;
    },
    say: function(m) { this.msg = m; this.msgT = 150; this.log.unshift(m); if (this.log.length > 5) this.log.pop(); },
    fresh: function(i) { var b = this.btn(i), f = b && !this.prev[i]; return f; },
    prev: [false, false, false, false],

    // ---------------- board turns
    update: function() {
        this.t++;
        if (this.msgT > 0) this.msgT--;
        if (typeof Net !== "undefined" && Net.role === "host" && Net.seatPeers(this.pl, function(i) { return "CPU " + (i + 1); })) this.say("LAN seats: " + this.pl.map(function(q) { return q.name; }).join(", "));
        var P = this.pl[this.turn];
        if (this.phase === "intro") { if (this.t > 90) { this.phase = "roll"; this.t = 0; } }
        else if (this.phase === "roll") {
            this.die = 1 + ((this.t / 3) | 0) % 6;                         // the die spins until you hit it
            if ((P.cpu && this.t > 50 + Math.random() * 30) || (!P.cpu && this.fresh(P.i))) {
                this.die = 1 + ((Math.random() * 6) | 0); this.steps = this.die; this.phase = "move"; this.t = 0;
                if (typeof SFX !== "undefined") SFX.play("select");
            }
        } else if (this.phase === "move") {
            if (this.t % 14 === 0) {
                P.pos = (P.pos + 1) % this.spaces.length; this.steps--; P.hop = 10;
                if (P.pos === 0) { P.coins += 5; this.say(P.name + " passes START: +5 coins"); }
                if (typeof SFX !== "undefined") SFX.play("ui", 0, 0, 0.4, 1.4);
                if (P.pos === this.star) {
                    if (P.coins >= 20) { P.coins -= 20; P.stars++; this.say("★ " + P.name + " buys a STAR!"); if (typeof SFX !== "undefined") SFX.play("clear"); this.moveStar(); }
                    else this.say(P.name + " needs 20 coins for the star");
                }
                if (this.steps <= 0) { this.land(P); this.phase = "landed"; this.t = 0; }
            }
        } else if (this.phase === "landed") {
            if (this.t > 70) {
                this.turn++;
                if (this.turn >= this.pl.length) { this.turn = 0; this.startMini(); }
                else { this.phase = "roll"; this.t = 0; }
            }
        } else if (this.phase === "mini") this.updateMini();
        else if (this.phase === "results") {
            if (this.t > 120) {
                this.round++;
                if (this.round > partyCfg.rounds) { this.phase = "over"; this.t = 0; this.finish(); }
                else { this.phase = "roll"; this.t = 0; this.say("Round " + this.round + (this.round === partyCfg.rounds ? " — LAST ROUND!" : "")); }
            }
        } else if (this.phase === "over") { if (this.t > 120 && [0, 1, 2, 3].some(function(i) { return Party.fresh(i); })) this.reset(); }
        for (let i = 0; i < 4; i++) this.prev[i] = this.btn(i);
        for (let i = 0; i < this.pl.length; i++) if (this.pl[i].hop > 0) this.pl[i].hop--;
    },
    land: function(P) {
        var s = this.spaces[P.pos];
        if (s.k === "blue") { P.coins += 3; this.say(P.name + " lands on blue: +3 coins"); }
        else if (s.k === "red") { P.coins = Math.max(0, P.coins - 3); this.say(P.name + " lands on red: -3 coins"); }
        else if (s.k === "event") {
            var r = Math.random();
            if (r < 0.25) { P.coins += 10; this.say("? " + P.name + " finds a treasure chest: +10 coins!"); }
            else if (r < 0.45) { var rich = this.pl.slice().sort(function(a, b) { return b.coins - a.coins; })[0]; if (rich !== P) { var take = Math.min(8, rich.coins); rich.coins -= take; P.coins += take; this.say("? " + P.name + " pickpockets " + rich.name + ": " + take + " coins"); } else { P.coins += 5; this.say("? " + P.name + " gets a tip: +5"); } }
            else if (r < 0.65) { P.pos = (this.star - 1 + this.spaces.length) % this.spaces.length; this.say("? Warp! " + P.name + " lands right before the star"); }
            else if (r < 0.85) { this.pl.forEach(function(q) { q.coins += 2; }); this.say("? Coin rain: everyone +2"); }
            else { this.moveStar(); this.say("? The star flies to a new spot!"); }
        }
    },
    finish: function() {
        var order = this.pl.slice().sort(function(a, b) { return b.stars - a.stars || b.coins - a.coins; });
        this.winner = order[0];
        showBanner(order[0].name + " WINS THE PARTY!", order[0].stars + " ★  ·  " + order[0].coins + " coins", order[0].col);
        if (typeof SFX !== "undefined") SFX.play("clear");
    },

    // ---------------- minigames
    startMini: function() {
        var kinds = ["mash", "draw", "stop", "timing", "hold"], k = kinds[(this.round + Math.floor(Math.random() * kinds.length)) % kinds.length];
        this.mini = { k: k, t: 0, score: this.pl.map(function() { return 0; }), done: this.pl.map(function() { return false; }), go: 90 + ((Math.random() * 120) | 0), target: 30 + ((Math.random() * 60) | 0), val: 0 };
        this.phase = "mini"; this.t = 0;
        this.say("MINIGAME: " + { mash: "MASH! — tap your button as fast as you can", draw: "QUICK DRAW — press on GO, not before!", stop: "STOP IT — stop the counter on the target", timing: "TIMING — stop the sweeping marker in the green", hold: "HOLD IT — hold your button for exactly 3 seconds" }[k]);
        this.mini.hold = this.pl.map(function() { return -1; });
    },
    updateMini: function() {
        var M = this.mini; M.t++;
        var pre = 100;                        // reading time
        if (M.t < pre) return;
        var t = M.t - pre;
        for (let i = 0; i < this.pl.length; i++) {
            var P = this.pl[i], press = P.cpu ? this.cpuPress(P, M, t) : this.fresh(i);
            if (M.k === "mash") { if (t < 300 && press) M.score[i]++; }
            else if (M.k === "draw") {
                if (M.done[i]) continue;
                if (press) { M.done[i] = true; M.score[i] = t < M.go ? -1 : t - M.go; }       // -1 = jumped the gun
            } else if (M.k === "stop") {
                if (M.done[i]) continue;
                if (press || t > 600) { M.done[i] = true; M.score[i] = Math.abs(this.counter(t) - M.target); }
            } else if (M.k === "timing") {
                if (M.done[i]) continue;
                if (press || t > 600) { M.done[i] = true; M.score[i] = Math.round(Math.abs(this.sweep(t) - 50)); }
            } else if (M.k === "hold") {
                if (M.done[i]) continue;
                var down = P.cpu ? (t >= (P.holdStart || (P.holdStart = 20 + ((Math.random() * 30) | 0))) && t < P.holdStart + 180 + ((P.i * 37) % 31) - 15) : this.btn(i);
                if (down && M.hold[i] < 0) M.hold[i] = t;
                if (!down && M.hold[i] >= 0) { M.done[i] = true; M.score[i] = Math.abs(t - M.hold[i] - 180); P.holdStart = 0; }
                if (t > 700 && !M.done[i]) { M.done[i] = true; M.score[i] = 999; }
            }
        }
        var over = M.k === "mash" ? t >= 300 : M.done.every(Boolean) || t > 720;
        if (over && !M.over) {
            M.over = true;
            var win = [];
            if (M.k === "mash") { var mx = Math.max.apply(null, M.score); M.score.forEach(function(s, i) { if (s === mx) win.push(i); }); }
            else if (M.k === "draw") { var best = 1e9; M.score.forEach(function(s, i) { if (s >= 0 && M.done[i] && s < best) best = s; }); M.score.forEach(function(s, i) { if (s === best && M.done[i]) win.push(i); }); }
            else { var bd = Math.min.apply(null, M.score); if (bd < 999) M.score.forEach(function(s, i) { if (s === bd) win.push(i); }); }
            var self = this;
            win.forEach(function(i) { self.pl[i].coins += 10; self.pl[i].wins++; });
            this.say("Minigame won by " + (win.length ? win.map(function(i) { return self.pl[i].name; }).join(" & ") : "nobody") + " (+10 coins)");
            if (typeof SFX !== "undefined") SFX.play("whistle");
            M.endT = 0;
        }
        if (M.over && ++M.endT > 110) { this.phase = "results"; this.t = 0; }
    },
    counter: function(t) { return (t * 2) % 100; },
    sweep: function(t) { var u = (t * 1.6) % 200; return u < 100 ? u : 200 - u; },      // 0..100..0
    cpuPress: function(P, M, t) {
        if (M.k === "mash") return Math.random() < 0.18 + (P.i % 3) * 0.03;
        if (M.k === "draw") { if (!P.react) P.react = M.go + 14 + ((Math.random() * 22) | 0); var r = t >= P.react && !M.done[P.i]; if (r) P.react = 0; return r; }
        if (M.k === "stop") { var v = this.counter(t); return Math.abs(v - M.target) <= 2 + (P.i % 2) * 3 && Math.random() < 0.45; }
        if (M.k === "timing") { return Math.abs(this.sweep(t) - 50) <= 3 + (P.i % 3) * 3 && Math.random() < 0.4; }
        return false;
    },

    // ---------------- drawing
    draw: function() {
        ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, cssW, cssH);
        if (this.phase === "mini") { this.drawMini(); return; }
        // fit between the message bar (top) and the score panels (bottom)
        var W = Math.min(cssW - 60, (cssH - 250) * 1.5), H = W / 1.5, cx = cssW / 2, cy = 105 + 30 + H / 2;
        // island
        ctx.fillStyle = "#14532d"; this.round2(cx - W / 2 - 30, cy - H / 2 - 30, W + 60, H + 60, 50); ctx.fill();
        ctx.fillStyle = "#166534"; this.round2(cx - W / 2, cy - H / 2, W, H, 40); ctx.fill();
        var sp = function(s) { return [cx + s.x * W, cy + s.y * H * 1.25]; };
        // path
        ctx.strokeStyle = "#a16207"; ctx.lineWidth = 16; ctx.lineJoin = "round"; ctx.beginPath();
        this.spaces.forEach(function(s, i) { var p = sp(s); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.stroke();
        var R = Math.max(14, W / 50);
        for (let i = 0; i < this.spaces.length; i++) {
            var s = this.spaces[i], p = sp(s);
            ctx.fillStyle = { blue: "#3b82f6", red: "#ef4444", event: "#a855f7", start: "#f8fafc" }[s.k];
            ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p[0], p[1], R, 0, 7); ctx.fill(); ctx.stroke();
            if (s.k === "event") uiText("?", p[0], p[1] + 6, R, "#fff", "center", "900");
            if (s.k === "start") uiText("GO", p[0], p[1] + 5, R * 0.8, "#0f172a", "center", "900");
            if (i === this.star) { var bob = Math.sin(this.t * 0.1) * 4; uiText("★", p[0], p[1] - R - 6 + bob, R * 1.8, "#fde047", "center", "900"); }
        }
        // pieces
        for (let i = 0; i < this.pl.length; i++) {
            var P = this.pl[i], q = sp(this.spaces[P.pos]), off = (i - (this.pl.length - 1) / 2) * R * 0.7, hop = Math.sin(P.hop / 10 * Math.PI) * 18;
            ctx.fillStyle = P.col; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(q[0] + off, q[1] - R * 0.9 - hop, R * 0.55, 0, 7); ctx.fill(); ctx.stroke();
            ctx.fillRect(q[0] + off - R * 0.3, q[1] - R * 0.5 - hop, R * 0.6, R * 0.5); ctx.strokeRect(q[0] + off - R * 0.3, q[1] - R * 0.5 - hop, R * 0.6, R * 0.5);
            if (i === this.turn && (this.phase === "roll" || this.phase === "move")) uiText("▼", q[0] + off, q[1] - R * 2 - hop, 16, P.col, "center", "900");
        }
        // middle: die / message
        if (this.phase === "roll" || this.phase === "move" || this.phase === "landed") {
            var P2 = this.pl[this.turn];
            uiPanel(cx - 150, cy - 96, 300, 150, P2.col, 0.92);
            uiText(P2.name + "'s turn", cx, cy - 64, 20, P2.col, "center", "900");
            ctx.fillStyle = "#f8fafc"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 4; this.round2(cx - 34, cy - 50, 68, 68, 12); ctx.fill(); ctx.stroke();
            uiText(String(this.phase === "move" ? this.steps : this.die), cx, cy + 2, 40, "#0f172a", "center", "900");
            uiText(this.phase === "roll" ? (P2.cpu ? "rolling…" : "press " + this.keyName(P2) + " to roll!") : (this.phase === "move" ? "moving…" : ""), cx, cy + 42, 14, "#e2e8f0", "center", "800");
        }
        if (this.phase === "over") {
            uiPanel(cx - 220, cy - 100, 440, 200, this.winner.col, 0.95);
            uiText("🏆 " + this.winner.name + " WINS!", cx, cy - 50, 32, this.winner.col, "center", "900");
            this.pl.slice().sort(function(a, b) { return b.stars - a.stars || b.coins - a.coins; }).forEach(function(q, i) { uiText((i + 1) + ". " + q.name + "   ★ " + q.stars + "   🪙 " + q.coins + "   minigames " + q.wins, cx, cy - 10 + i * 24, 15, q.col, "center", "800"); });
            if (this.t > 120) uiText("press a button for a new party", cx, cy + 90, 13, "#cbd5e1", "center", "800");
        }
        this.drawScores();
    },
    drawScores: function() {
        var n = this.pl.length, w = Math.min(230, (cssW - 40) / n - 10);
        for (let i = 0; i < n; i++) {
            var P = this.pl[i], x = cssW / 2 - (n * (w + 10)) / 2 + i * (w + 10), y = cssH - 70;
            uiPanel(x, y, w, 52, P.col, i === this.turn ? 0.98 : 0.8);
            uiText(P.name + (P.cpu ? "" : " 🎮"), x + 12, y + 22, 14, P.col, "left", "900");
            uiText("★ " + P.stars + "   🪙 " + P.coins, x + 12, y + 42, 14, "#f8fafc", "left", "800");
        }
        uiPanel(14, 10, 300, 48, "#f472b6");
        uiText("PARTY BOARD", 28, 36, 20, "#f9a8d4", "left", "900");
        uiText("Round " + Math.min(this.round, partyCfg.rounds) + " / " + partyCfg.rounds + "  ·  star costs 20 coins", 28, 52, 11, "#cbd5e1", "left", "800");
        if (this.msgT > 0) { uiPanel(cssW / 2 - 300, 66, 600, 34, "#f472b6", 0.9); uiText(this.msg, cssW / 2, 89, 15, "#fff", "center", "900"); }
    },
    drawMini: function() {
        var M = this.mini, t = M.t - 100, cx = cssW / 2;
        uiText({ mash: "MASH!", draw: "QUICK DRAW", stop: "STOP IT", timing: "TIMING", hold: "HOLD IT" }[M.k], cx, 130, 48, "#fde047", "center", "900");
        uiText({ mash: "tap your button as fast as you can", draw: "press your button the moment it says GO — too early and you're out", stop: "stop the counter on " + M.target, timing: "press when the marker is in the green", hold: "hold your button for exactly 3.00 seconds, then let go" }[M.k], cx, 166, 16, "#cbd5e1", "center", "800");
        if (M.k === "timing" && t >= 0) {
            var bw = Math.min(600, cssW - 120), bx = cx - bw / 2, by = cssH / 2 - 60;
            ctx.fillStyle = "#1e293b"; ctx.fillRect(bx, by, bw, 30); ctx.fillStyle = "#22c55e"; ctx.fillRect(bx + bw * 0.44, by, bw * 0.12, 30);
            ctx.fillStyle = "#fde047"; ctx.fillRect(bx + bw * this.sweep(t) / 100 - 4, by - 8, 8, 46);
        }
        if (M.k === "hold" && t >= 0) uiText("hold… let go at 3.00 s", cx, cssH / 2 - 40, 26, "#fff", "center", "900");
        if (t < 0) uiText("get ready… " + Math.ceil(-t / 30), cx, cssH / 2 - 40, 30, "#fff", "center", "900");
        else if (M.k === "mash") uiText(Math.max(0, Math.ceil((300 - t) / 60)) + "s", cx, cssH / 2 - 40, 40, "#fff", "center", "900");
        else if (M.k === "draw") uiText(t >= M.go ? "GO!" : "wait…", cx, cssH / 2 - 30, t >= M.go ? 90 : 40, t >= M.go ? "#4ade80" : "#94a3b8", "center", "900");
        else if (M.k === "stop") uiText(String(this.counter(Math.max(0, t))), cx, cssH / 2 - 20, 90, "#fff", "center", "900");
        // lanes
        var n = this.pl.length, lw = Math.min(240, (cssW - 60) / n - 14);
        for (let i = 0; i < n; i++) {
            var P = this.pl[i], x = cx - (n * (lw + 14)) / 2 + i * (lw + 14), y = cssH / 2 + 30;
            uiPanel(x, y, lw, 120, P.col, 0.9);
            uiText(P.name + (P.cpu ? "" : " (" + this.keyName(P) + ")"), x + lw / 2, y + 26, 15, P.col, "center", "900");
            var val = M.k === "mash" ? M.score[i] + " taps" : (!M.done[i] ? (M.k === "hold" && M.hold && M.hold[i] >= 0 ? "holding…" : "…") : (M.k === "draw" ? (M.score[i] < 0 ? "TOO EARLY!" : (M.score[i] / 60).toFixed(2) + " s") : (M.k === "hold" ? (M.score[i] >= 999 ? "never let go" : "off by " + (M.score[i] / 60).toFixed(2) + " s") : "off by " + M.score[i])));
            uiText(val, x + lw / 2, y + 74, 24, "#fff", "center", "900");
            if (M.k === "mash") { ctx.fillStyle = P.col; ctx.fillRect(x + 12, y + 92, (lw - 24) * Math.min(1, M.score[i] / 60), 12); }
        }
        this.drawScores();
    },
    round2: function(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
};

ModeKit.addLevel("party_board", { name: "🎉 Party Board", mode: "party", wavesEnabled: false, spawnP1: [0, 60], spawnP2: [60, 60], layout: ModeKit.room(-600, 600, 800, {}), title: "Party Board" });

GameModes.register({
    id: "party",
    title: "PARTY BOARD",
    tagline: "Dice board party for 2-4: coins, stars, events and a quick minigame every round.",
    color: "#f472b6",
    firstLevel: "party_board",
    flags: { ownScreen: true, waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, scenery: false, coopToggle: false },
    overTitle: "PARTY BOARD",
    seats: function() {
        var C = partyCfg, out = [{ label: "P1", options: ["human"], value: "human", set: function() {} }];
        for (let i = 1; i < 4; i++) (function(i) {
            var v = i >= C.players ? "off" : (i === 1 ? (C.humans > 1 ? "human" : "cpu") : "cpu");
            out.push({ label: "Seat " + (i + 1), options: i === 1 ? ["human", "cpu", "off"] : ["cpu", "off"], value: v, note: i >= 2 ? "a gamepad " + (i + 1) + " makes it human" : (i === 1 ? "Enter / ↑" : ""),
                set: function(nv) {
                    if (nv === "off") { C.players = Math.max(2, i); if (i === 1) C.humans = 1; }
                    else { C.players = Math.max(C.players, i + 1); if (i === 1) C.humans = nv === "human" ? 2 : 1; }
                    saveParty(); Party.reset();
                } });
        })(i);
        return out;
    },
    setupLevel: function() { Party.reset(); },
    screenFrame: function() { Party.update(); Party.draw(); },
    screenDraw: function() { Party.t++; Party.draw(); },
    netState: function() {
        var P = Party;
        return { pl: P.pl.map(function(q) { return { i: q.i, name: q.name, cpu: q.cpu, pid: q.pid || null, pos: q.pos, coins: q.coins, stars: q.stars, hop: q.hop, col: q.col, wins: q.wins }; }),
            sk: P.spaces.map(function(q) { return q.k; }), star: P.star, turn: P.turn, round: P.round, phase: P.phase, t: P.t, die: P.die, steps: P.steps, msg: P.msg, msgT: P.msgT,
            mini: P.mini ? { k: P.mini.k, t: P.mini.t, score: P.mini.score, done: P.mini.done, go: P.mini.go, target: P.mini.target, hold: P.mini.hold } : null, win: P.winner ? P.winner.i : -1, rounds: partyCfg.rounds };
    },
    applyNetState: function(m) {
        var P = Party;
        if (!P.spaces.length) P.build();
        m.sk.forEach(function(k, i) { if (P.spaces[i]) P.spaces[i].k = k; });
        P.pl = m.pl; P.star = m.star; P.turn = m.turn; P.round = m.round; P.phase = m.phase; P.t = m.t; P.die = m.die; P.steps = m.steps; P.msg = m.msg; P.msgT = m.msgT;
        P.mini = m.mini; P.winner = m.win >= 0 ? P.pl[m.win] : null; partyCfg.rounds = m.rounds;
    },
    onClick: function() { return true; },
    menuItems: function(items) {
        items.push({ id: "pt_hum", label: "Humans:  ◀  " + partyCfg.humans + " (P1 Space" + (partyCfg.humans > 1 ? ", P2 Enter" : "") + ")  ▶", hint: "gamepads 3-4 join as P3 / P4; the rest are CPUs", cycle: true });
        items.push({ id: "pt_pl", label: "Players:  ◀  " + partyCfg.players + "  ▶", hint: "", cycle: true });
        items.push({ id: "pt_rounds", label: "Rounds:  ◀  " + partyCfg.rounds + "  ▶", hint: "", cycle: true });
        items.push({ id: "pt_new", label: "New party", hint: "" });
    },
    onMenu: function(id, dir) {
        dir = dir || 1;
        if (id === "pt_hum") { partyCfg.humans = partyCfg.humans === 1 ? 2 : 1; partyCfg.players = Math.max(partyCfg.players, partyCfg.humans, 2); saveParty(); return true; }
        if (id === "pt_pl") { partyCfg.players = Math.max(2, Math.max(partyCfg.humans, ((partyCfg.players - 2 + dir + 3) % 3) + 2)); saveParty(); return true; }
        if (id === "pt_rounds") { var R = [5, 10, 15, 20], i = R.indexOf(partyCfg.rounds); partyCfg.rounds = R[(i + dir + R.length) % R.length]; saveParty(); return true; }
        if (id === "pt_new") { closePause(); Party.reset(); return true; }
        return false;
    },
    onRestart: function() { Party.reset(); },
    overSub: function() { return "Most stars wins"; }
});
