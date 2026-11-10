// ============================================================================
// GAME: JET DASH  (jetpack)  -  endless jetpack runner (original)
//   You run right on your own, faster and faster. HOLD to fire the jetpack, let go to drop.
//   Dodge zappers (electric bars, some spinning), missiles (a warning blinks first) and laser beams (they charge,
//   then fire across the whole corridor). Grab coins; a shield bubble saves you once. Distance is your score.
//   P1: hold Space / W / click.   P2 (pause → Players): hold ↑ or Enter - both of you fly the same run.
//   Pads: hold A / RT.   Runs on its own screen (engine `ownScreen` flag).
// ============================================================================
var JD = { FLOOR: 60, CEIL: 60 };    // corridor margins (screen px, scaled)
var jetSave = { best: 0, coins: 0 };
try { var _jd = JSON.parse(localStorage.getItem("timsJetDash") || "null"); if (_jd) { jetSave.best = _jd.best || 0; jetSave.coins = _jd.coins || 0; } } catch (e) {}
function saveJet() { try { localStorage.setItem("timsJetDash", JSON.stringify(jetSave)); } catch (e) {} }

var Jet = {
    H: 600, W: 1066, x: 0, speed: 7, t: 0, phase: "ready", runners: [], obs: [], coins: [], fx: [], nextAt: 900, coinsRun: 0, endT: 0,

    reset: function() {
        this.x = 0; this.speed = 7; this.t = 0; this.phase = "ready"; this.obs = []; this.coins = []; this.fx = []; this.nextAt = 1100; this.coinsRun = 0; this.endT = 0;
        this.runners = [this.makeRunner(0, "#ff5a5f")];
        if (multiplayer) this.runners.push(this.makeRunner(1, "#3da5ff"));
        this.lanSync();
    },
    // LAN players join the run as extra runners (host); they drop out when they leave
    lanSync: function() {
        if (typeof Net === "undefined" || Net.role !== "host") return;
        var self = this;
        Net.peerList().forEach(function(p) {
            if (self.runners.some(function(r) { return r.pid === p.pid; })) return;
            var r = self.makeRunner(self.runners.length, p.color || "#fde047"); r.lan = true; r.pid = p.pid; r.name = p.name;
            if (self.phase !== "ready") { r.alive = false; r.why = "joined mid-run"; }
            self.runners.push(r);
        });
        this.runners = this.runners.filter(function(r) { return !r.lan || Net.peers[r.pid]; });
    },
    makeRunner: function(i, col) { return { i: i, col: col, x: 260 - i * 70, y: this.H - JD.FLOOR - 40, vy: 0, alive: true, shield: false, flame: 0, dist: 0, dieX: 0, spin: 0 }; },

    held: function(r) {
        if (r.lan) return !!Net.peerX(r.pid).h;
        var pad = (typeof Pads !== "undefined") ? Pads.state[r.i] : null;
        if (r.i === 0) return SpacePressed || WASDupPressed || mouseDown || !!(pad && pad.active && (pad.up || pad.shoot)) || (!multiplayer && (ULDRupPressed || !!PlayerInput[1].kbShoot));
        return ULDRupPressed || !!PlayerInput[1].kbShoot || !!(pad && pad.active && (pad.up || pad.shoot));
    },

    // ---------------- obstacle patterns (world x = distance along the run, y = 0 top .. H bottom)
    spawnChunk: function() {
        var X = this.nextAt, H = this.H, top = JD.CEIL + 30, bot = H - JD.FLOOR - 30, lvl = Math.min(1, this.x / 30000);
        var r = Math.random(), gap = 520 - lvl * 160;
        if (r < 0.34) {
            // zapper: a bar between two nodes, sometimes spinning
            var len = 140 + Math.random() * 160, cy = top + 40 + Math.random() * (bot - top - 80), ang = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4][(Math.random() * 4) | 0];
            this.obs.push({ k: "zap", x: X, y: cy, len: len, ang: ang, spin: Math.random() < 0.25 + lvl * 0.3 ? (Math.random() < 0.5 ? -1 : 1) * 0.02 : 0 });
        } else if (r < 0.52) {
            // two zappers forming a gate
            var gy = top + 90 + Math.random() * (bot - top - 180), gw = 170 - lvl * 30;
            this.obs.push({ k: "zap", x: X, y: (top + gy - gw / 2) / 2, len: Math.max(30, gy - gw / 2 - top), ang: Math.PI / 2, spin: 0 });
            this.obs.push({ k: "zap", x: X, y: (bot + gy + gw / 2) / 2, len: Math.max(30, bot - gy - gw / 2), ang: Math.PI / 2, spin: 0 });
        } else if (r < 0.70) {
            this.obs.push({ k: "missile", x: X + 900, y: 0, warnT: 110, lock: true });            // aims at you, then flies
        } else if (r < 0.80 && this.x > 4000) {
            var ly = top + Math.random() * (bot - top);
            this.obs.push({ k: "laser", x: X, y: ly, t: 0, charge: 110, fire: 60 });                // follows the screen
            if (Math.random() < 0.4 + lvl * 0.4) this.obs.push({ k: "laser", x: X, y: ly > H / 2 ? ly - 150 - Math.random() * 120 : ly + 150 + Math.random() * 120, t: -20, charge: 110, fire: 60 });
        } else {
            // a coin ribbon (sine wave or a word-ish block)
            var cy2 = top + 60 + Math.random() * (bot - top - 120), n = 10 + ((Math.random() * 8) | 0), wave = Math.random() < 0.6;
            for (let i = 0; i < n; i++) this.coins.push({ x: X + i * 34, y: cy2 + (wave ? Math.sin(i / 2) * 50 : ((i % 2) * 34 - 17)) });
            if (Math.random() < 0.08) this.coins.push({ x: X + n * 34 + 60, y: cy2, shield: true });
        }
        // sprinkle coins between hazards
        if (Math.random() < 0.5) { var yy = top + Math.random() * (bot - top); for (let i = 0; i < 6; i++) this.coins.push({ x: X + gap * 0.5 + i * 34, y: yy }); }
        this.nextAt = X + gap + Math.random() * 200;
    },

    zapHit: function(o, r) {
        var ca = Math.cos(o.ang), sa = Math.sin(o.ang), px = r.x + this.x - o.x, py = r.y - o.y;
        var along = Math.max(-o.len / 2, Math.min(o.len / 2, px * ca + py * sa));
        return Math.hypot(px - ca * along, py - sa * along) < 26;
    },

    kill: function(r, why) {
        if (!r.alive) return;
        if (r.shield) { r.shield = false; r.inv = 60; this.fx.push({ x: r.x, y: r.y, t: 0, col: "#67e8f9", big: true }); if (typeof SFX !== "undefined") SFX.play("fizzle"); return; }
        r.alive = false; r.why = why; r.dieX = this.x; r.vy = -6; r.vx = 4; r.spin = 0.3;
        screenShake = 8;
        if (typeof SFX !== "undefined") SFX.play("ko");
        this.fx.push({ x: r.x, y: r.y, t: 0, col: "#fde047", big: true });
    },

    step: function() {
        this.t++;
        var H = this.H, floor = H - JD.FLOOR - 22, ceil = JD.CEIL + 22;
        if (this.phase === "ready") { if (this.runners.some(function(r) { return Jet.held(r); }) || this.t > 120) this.phase = "run"; else return; }
        var anyAlive = this.runners.some(function(r) { return r.alive; });
        if (this.phase === "run") {
            this.speed = Math.min(17, 7 + this.x / 6000);
            this.x += this.speed;
            while (this.nextAt < this.x + 1600) this.spawnChunk();
        }
        for (let i = 0; i < this.runners.length; i++) {
            var r = this.runners[i];
            if (r.inv > 0) r.inv--;
            if (r.alive) {
                var hold = this.held(r);
                r.vy += hold ? -0.85 : 0.75;
                r.vy = Math.max(-9, Math.min(11, r.vy));
                r.y += r.vy;
                if (r.y > floor) { r.y = floor; r.vy = 0; } if (r.y < ceil) { r.y = ceil; r.vy = Math.max(0, r.vy); }
                r.flame = hold ? Math.min(1, r.flame + 0.25) : Math.max(0, r.flame - 0.2);
                r.dist = Math.floor(this.x / 10);
                if (hold && this.t % 3 === 0) this.fx.push({ x: r.x - 14, y: r.y + 30, t: 0, col: "#fb923c", vy: 4 + Math.random() * 3, vx: -this.speed * 0.3 });
            } else {
                // tumble and skid along the floor
                r.vy += 0.8; r.y += r.vy; r.x += (r.vx || 0) * 0.2; r.vx *= 0.97;
                if (r.y > floor + 10) { r.y = floor + 10; r.vy = -r.vy * 0.45; if (Math.abs(r.vy) < 1.5) r.vy = 0; }
            }
        }
        if (this.phase === "dead") { this.endT++; this.speed *= 0.97; this.x += this.speed; }
        // obstacles
        for (let k = this.obs.length - 1; k >= 0; k--) {
            var o = this.obs[k];
            if (o.k === "zap") {
                o.ang += o.spin;
                for (let i = 0; i < this.runners.length; i++) { var rr = this.runners[i]; if (rr.alive && !(rr.inv > 0) && this.zapHit(o, rr)) this.kill(rr, "zapped"); }
                if (o.x + o.len < this.x - 200) this.obs.splice(k, 1);
            } else if (o.k === "missile") {
                var tgt = this.runners.filter(function(q) { return q.alive; })[0];
                if (o.warnT > 0) {
                    if (o.x - this.x > 1100) continue;               // not yet in range
                    o.warnT--; if (o.lock && tgt) o.y += (tgt.y - o.y) * (o.warnT > 40 ? 0.12 : 0);
                    if (o.warnT === 0 && typeof SFX !== "undefined") SFX.play("whoosh");
                    o.x = this.x + this.W + 60;                      // waits just off the right edge
                } else {
                    o.x -= 14;                                        // on top of the scroll: very fast
                    for (let i = 0; i < this.runners.length; i++) { var mr = this.runners[i]; if (mr.alive && !(mr.inv > 0) && Math.abs(o.x - this.x - mr.x) < 34 && Math.abs(o.y - mr.y) < 26) { this.kill(mr, "hit by a missile"); this.fx.push({ x: mr.x, y: mr.y, t: 0, col: "#f97316", big: true }); this.obs.splice(k, 1); break; } }
                    if (this.obs[k] === o && o.x < this.x - 300) this.obs.splice(k, 1);
                }
            } else if (o.k === "laser") {
                if (o.x > this.x + 200) continue;
                o.t++;
                if (o.t > o.charge && o.t < o.charge + o.fire) for (let i = 0; i < this.runners.length; i++) { var lr = this.runners[i]; if (lr.alive && !(lr.inv > 0) && Math.abs(lr.y - o.y) < 20) this.kill(lr, "lasered"); }
                if (o.t > o.charge + o.fire + 20) this.obs.splice(k, 1);
            }
        }
        // coins
        for (let k = this.coins.length - 1; k >= 0; k--) {
            var c = this.coins[k];
            if (c.x < this.x - 100) { this.coins.splice(k, 1); continue; }
            for (let i = 0; i < this.runners.length; i++) {
                var cr = this.runners[i];
                if (cr.alive && Math.abs(c.x - this.x - cr.x) < 28 && Math.abs(c.y - cr.y) < 34) {
                    if (c.shield) { cr.shield = true; showBanner("SHIELD!", "saves you once", "#67e8f9"); }
                    else { this.coinsRun++; if (typeof SFX !== "undefined" && this.t % 2 === 0) SFX.play("coin", 0, 0, 0.3, 1.4); }
                    this.coins.splice(k, 1); break;
                }
            }
        }
        if (this.phase === "run" && !this.runners.some(function(r) { return r.alive; })) { this.phase = "dead"; this.endT = 0; this.finish(); }
        for (let k = this.fx.length - 1; k >= 0; k--) { var f = this.fx[k]; f.t++; if (f.vy) { f.y += f.vy; f.x += f.vx; } if (f.t > (f.big ? 30 : 16)) this.fx.splice(k, 1); }
    },

    finish: function() {
        var d = Math.floor(this.x / 10);
        jetSave.coins += this.coinsRun;
        var nb = d > jetSave.best;
        if (nb) jetSave.best = d;
        saveJet();
        showBanner(d + " m", (nb ? "NEW BEST!  ·  " : "best " + jetSave.best + " m  ·  ") + this.coinsRun + " coins", "#fde047");
    },

    render: function() {
        // scale the 600-tall corridor to the window
        var S = cssH / this.H, W = cssW / S;
        this.W = W;
        ctx.save();
        ctx.scale(S, S);
        // background: lab corridor with parallax windows and pillars
        ctx.fillStyle = "#101826"; ctx.fillRect(0, 0, W, this.H);
        var px = -(this.x * 0.3) % 400;
        for (let x = px; x < W + 400; x += 400) { ctx.fillStyle = "#16233a"; ctx.fillRect(x + 40, 150, 260, 220); ctx.fillStyle = "#0c1422"; ctx.fillRect(x + 50, 160, 240, 200); ctx.fillStyle = "rgba(125,211,252,0.06)"; ctx.fillRect(x + 50, 160, 120, 200); }
        var px2 = -(this.x * 0.7) % 260;
        for (let x = px2; x < W + 260; x += 260) { ctx.fillStyle = "#1b2a44"; ctx.fillRect(x, JD.CEIL, 36, this.H - JD.CEIL - JD.FLOOR); }
        ctx.fillStyle = "#334155"; ctx.fillRect(0, 0, W, JD.CEIL); ctx.fillRect(0, this.H - JD.FLOOR, W, JD.FLOOR);
        ctx.fillStyle = "#475569"; for (let x = -(this.x % 80); x < W; x += 80) { ctx.fillRect(x, this.H - JD.FLOOR, 40, 6); ctx.fillRect(x, JD.CEIL - 6, 40, 6); }
        // coins
        for (let i = 0; i < this.coins.length; i++) {
            var c = this.coins[i], cx = c.x - this.x;
            if (cx < -30 || cx > W + 30) continue;
            if (c.shield) { ctx.strokeStyle = "#67e8f9"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, c.y, 18, 0, 7); ctx.stroke(); ctx.fillStyle = "rgba(103,232,249,0.3)"; ctx.fill(); continue; }
            var sq = Math.abs(Math.cos(this.t * 0.08 + c.x * 0.01));
            ctx.fillStyle = "#facc15"; ctx.strokeStyle = "#a16207"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(cx, c.y, 11 * sq + 2, 12, 0, 0, 7); ctx.fill(); ctx.stroke();
        }
        // obstacles
        for (let k = 0; k < this.obs.length; k++) {
            var o = this.obs[k];
            if (o.k === "zap") {
                var ox = o.x - this.x; if (ox < -400 || ox > W + 400) continue;
                var ca = Math.cos(o.ang), sa = Math.sin(o.ang), ax = ox - ca * o.len / 2, ay = o.y - sa * o.len / 2, bx = ox + ca * o.len / 2, by = o.y + sa * o.len / 2;
                ctx.strokeStyle = "rgba(250,204,21,0.35)"; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
                ctx.strokeStyle = "#fef08a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax, ay);
                for (let s = 1; s < 12; s++) { var f = s / 12; ctx.lineTo(ax + (bx - ax) * f + (Math.random() - 0.5) * 10 * -sa, ay + (by - ay) * f + (Math.random() - 0.5) * 10 * ca); }
                ctx.lineTo(bx, by); ctx.stroke();
                [[ax, ay], [bx, by]].forEach(function(p) { ctx.fillStyle = "#64748b"; ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p[0], p[1], 15, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 7); ctx.fill(); });
            } else if (o.k === "missile") {
                var mx = o.x - this.x;
                if (o.warnT > 0) {
                    if (o.x - this.x > W + 200 && o.warnT === 110) continue;
                    var blink = (this.t >> 3) & 1;
                    ctx.fillStyle = blink ? "#ef4444" : "#7f1d1d"; ctx.beginPath(); ctx.moveTo(W - 20, o.y); ctx.lineTo(W - 56, o.y - 20); ctx.lineTo(W - 56, o.y + 20); ctx.closePath(); ctx.fill();
                    uiText("!", W - 70, o.y + 8, 26, blink ? "#fecaca" : "#ef4444", "center", "900");
                } else {
                    ctx.fillStyle = "#e5e7eb"; ctx.fillRect(mx - 30, o.y - 9, 50, 18);
                    ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.moveTo(mx - 30, o.y - 9); ctx.lineTo(mx - 46, o.y); ctx.lineTo(mx - 30, o.y + 9); ctx.fill();
                    ctx.fillStyle = Math.random() < 0.5 ? "#fb923c" : "#fde047"; ctx.beginPath(); ctx.arc(mx + 28, o.y, 9 + Math.random() * 5, 0, 7); ctx.fill();
                }
            } else if (o.k === "laser" && o.x <= this.x + 200) {
                var charging = o.t <= o.charge, firing = o.t > o.charge && o.t < o.charge + o.fire;
                ctx.fillStyle = "#475569"; ctx.fillRect(0, o.y - 16, 30, 32); ctx.fillRect(W - 30, o.y - 16, 30, 32);
                if (charging && o.t > 0) { ctx.strokeStyle = "rgba(239,68,68," + (0.15 + 0.5 * o.t / o.charge) + ")"; ctx.lineWidth = 2; ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.moveTo(30, o.y); ctx.lineTo(W - 30, o.y); ctx.stroke(); ctx.setLineDash([]); }
                if (firing) { ctx.fillStyle = "rgba(239,68,68,0.45)"; ctx.fillRect(30, o.y - 18, W - 60, 36); ctx.fillStyle = "#fecaca"; ctx.fillRect(30, o.y - 6, W - 60, 12); }
            }
        }
        // runners
        for (let i = 0; i < this.runners.length; i++) this.drawRunner(this.runners[i]);
        for (let i = 0; i < this.fx.length; i++) { var e = this.fx[i]; ctx.globalAlpha = 1 - e.t / (e.big ? 30 : 16); ctx.fillStyle = e.col; ctx.beginPath(); ctx.arc(e.x, e.y, e.big ? 10 + e.t * 2.5 : 6 - e.t * 0.3, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        ctx.restore();
    },

    drawRunner: function(r) {
        ctx.save();
        ctx.translate(r.x, r.y);
        if (!r.alive) ctx.rotate((this.t * r.spin) % 6.28);
        if (r.inv > 0 && (this.t >> 2) & 1) ctx.globalAlpha = 0.4;
        // jetpack + flame
        ctx.fillStyle = "#64748b"; ctx.fillRect(-26, -16, 14, 34);
        if (r.flame > 0 && r.alive) { ctx.fillStyle = "#fb923c"; ctx.beginPath(); ctx.moveTo(-26, 18); ctx.lineTo(-19, 18 + 30 * r.flame + Math.random() * 10); ctx.lineTo(-12, 18); ctx.fill(); ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.moveTo(-23, 18); ctx.lineTo(-19, 18 + 16 * r.flame); ctx.lineTo(-15, 18); ctx.fill(); }
        // body (a little original hero: square head, headband, suit in the player colour)
        ctx.fillStyle = r.col; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 3;
        ctx.fillRect(-12, -10, 26, 30); ctx.strokeRect(-12, -10, 26, 30);
        var leg = r.alive && r.y >= this.H - JD.FLOOR - 23 ? Math.sin(this.t * 0.5) * 8 : 4;
        ctx.fillStyle = "#1f2937"; ctx.fillRect(-8, 20, 7, 12 + leg); ctx.fillRect(4, 20, 7, 12 - leg);
        ctx.fillStyle = "#f2c9a0"; ctx.fillRect(-12, -36, 28, 26); ctx.strokeRect(-12, -36, 28, 26);
        ctx.fillStyle = r.col; ctx.fillRect(-12, -36, 28, 6);
        ctx.fillStyle = "#0a0f16"; ctx.fillRect(4, -26, 4, 6); ctx.fillRect(10, -26, 4, 6);
        if (r.shield) { ctx.strokeStyle = "rgba(103,232,249,0.85)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(2, -4, 46, 0, 7); ctx.stroke(); ctx.fillStyle = "rgba(103,232,249,0.12)"; ctx.fill(); }
        ctx.restore();
        if (r.alive) uiText(r.name || "P" + (r.i + 1), r.x, r.y - 50, 12, (typeof Net !== "undefined" && Net.role === "client" && r.pid === Net.pid) ? "#fde047" : "#fff", "center", "900");      // (inside the scaled corridor view)
    },

    hud: function() {
        var d = Math.floor(this.x / 10);
        uiPanel(14, 10, 300, 60, "#fb923c");
        uiText("JET DASH", 30, 38, 22, "#fdba74", "left", "900");
        uiText(d + " m   ·   🪙 " + this.coinsRun + "   ·   best " + jetSave.best + " m", 30, 58, 13, "#e2e8f0", "left", "800");
        if (this.phase === "ready") uiText("HOLD Space / W / click to fly" + (multiplayer ? "  ·  P2: hold ↑" : ""), cssW / 2, cssH / 2 - 60, 28, "#fde047", "center", "900");
        if (this.phase === "dead" && this.endT > 40) {
            uiPanel(cssW / 2 - 220, cssH / 2 - 70, 440, 130, "#fb923c", 0.92);
            uiText(d + " m", cssW / 2, cssH / 2 - 22, 40, "#fff", "center", "900");
            uiText(this.runners.map(function(r) { return "P" + (r.i + 1) + " " + (r.why || ""); }).join("  ·  ") + "   ·   🪙 " + this.coinsRun + " (bank " + jetSave.coins + ")", cssW / 2, cssH / 2 + 10, 14, "#cbd5e1", "center", "800");
            uiText(this.endT > 70 ? "Space / click / A to run again" : "", cssW / 2, cssH / 2 + 42, 15, "#fde047", "center", "900");
        }
        uiText("Hold to fly · let go to drop · dodge zappers, missiles (watch the ! warning) and lasers · Esc menu", cssW / 2, cssH - 12, 12, "rgba(220,230,240,0.7)", "center", "700");
    }
};

ModeKit.addLevel("jet_lab", { name: "🚀 Jet Dash", mode: "jetpack", wavesEnabled: false, spawnP1: [0, 60], spawnP2: [60, 60], layout: ModeKit.room(-600, 600, 800, {}), title: "Jet Dash" });

GameModes.register({
    id: "jetpack",
    title: "JET DASH",
    tagline: "Endless jetpack runner: hold to fly, dodge zappers, missiles and lasers, grab coins.",
    color: "#fb923c",
    firstLevel: "jet_lab",
    flags: { ownScreen: true, waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, scenery: false, coopToggle: true },
    overTitle: "JET DASH",

    setupLevel: function() { Jet.reset(); Jet.wasHeld = true; },

    screenFrame: function() {
        if (Jet.phase === "dead" && Jet.endT > 70) {
            var pad = (typeof Pads !== "undefined") ? Pads.state[0] : null;
            var again = SpacePressed || mouseDown || !!(pad && pad.active && (pad.up || pad.shoot));
            if (again && !Jet.wasHeld) Jet.reset();
            Jet.wasHeld = again;
        } else Jet.wasHeld = Jet.phase === "ready" ? false : true;
        Jet.lanSync();
        Jet.step();
        Jet.render();
        Jet.hud();
    },
    screenDraw: function() { Jet.render(); Jet.hud(); },
    netInput: function() { return { h: (SpacePressed || WASDupPressed || mouseDown) ? 1 : 0 }; },
    netState: function() {
        var J = Jet, W = J.W;
        return { x: Math.round(J.x), sp: J.speed, t: J.t, ph: J.phase, cr: J.coinsRun, et: J.endT,
            r: J.runners.map(function(r) { return { i: r.i, c: r.col, x: r.x, y: Math.round(r.y), a: r.alive ? 1 : 0, s: r.shield ? 1 : 0, f: r.flame, n: r.name || "", p: r.pid || null, w: r.why || "", sp: r.spin, iv: r.inv || 0 }; }),
            o: J.obs.filter(function(o) { return o.x < J.x + W + 1400; }).map(function(o) { return { k: o.k, x: Math.round(o.x), y: Math.round(o.y), len: o.len, ang: o.ang, warnT: o.warnT, t: o.t, charge: o.charge, fire: o.fire }; }),
            c: J.coins.filter(function(c) { return c.x < J.x + W + 200; }).map(function(c) { return [Math.round(c.x), Math.round(c.y), c.shield ? 1 : 0]; }) };
    },
    applyNetState: function(m) {
        Jet.x = m.x; Jet.speed = m.sp; Jet.t = m.t; Jet.phase = m.ph; Jet.coinsRun = m.cr; Jet.endT = m.et;
        Jet.runners = m.r.map(function(o) { return { i: o.i, col: o.c, x: o.x, y: o.y, alive: !!o.a, shield: !!o.s, flame: o.f, name: o.n, pid: o.p, why: o.w, spin: o.sp, inv: o.iv, vy: 0 }; });
        Jet.obs = m.o; Jet.coins = m.c.map(function(a) { return { x: a[0], y: a[1], shield: !!a[2] }; }); Jet.fx = [];
    },

    onClick: function() { return true; },
    menuItems: function(items) { items.push({ id: "jd_new", label: "New run", hint: "" }); },
    onMenu: function(id) { if (id === "jd_new") { closePause(); Jet.reset(); return true; } return false; },
    onRestart: function() { Jet.reset(); },
    overSub: function() { return "Best " + jetSave.best + " m  ·  " + jetSave.coins + " coins banked"; }
});
