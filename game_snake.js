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
        w.boost = false; w.segs = []; w.kills = w.kills || 0; w.deadT = 0; w.cpuT = 0;
        w.safeT = o.human !== undefined ? 120 : 0;          // humans get 2 s of spawn protection
        for (let i = 0; i < w.len; i++) w.segs.push({ x: x - Math.cos(ang) * i * SNK.SEG, y: y - Math.sin(ang) * i * SNK.SEG });
        if (!o.old) this.worms.push(w);
        return w;
    },

    radius: function(w) { return 9 + Math.min(22, Math.sqrt(w.len) * 0.9); },

    control: function(w) {
        if (w.human === 0) {
            var pad = (typeof Pads !== "undefined") ? Pads.state[0] : null;
            if (pad && pad.active && (pad.left || pad.right || pad.up || pad.down || pad.aim)) {
                var ax = pad.aim ? pad.aim[0] : (pad.right ? 1 : 0) - (pad.left ? 1 : 0), ay = pad.aim ? pad.aim[1] : (pad.down ? 1 : 0) - (pad.up ? 1 : 0);
                if (ax || ay) w.want = Math.atan2(ay, ax);
                w.boost = !!pad.shoot;
            } else if (WASDleftPressed || WASDrightPressed) { w.want = w.ang + (WASDrightPressed ? 0.09 : -0.09); w.keyMode = true; }
            else if (!w.keyMode || Snake.mouseMoved) { var hs = this.toScreen(w.segs[0].x, w.segs[0].y); w.want = Math.atan2(mouseY - hs[1], mouseX - hs[0]); w.keyMode = false; }
            w.boost = w.boost || mouseDown || SpacePressed || WASDupPressed;
        } else if (w.human === 1) {
            var pad2 = (typeof Pads !== "undefined") ? Pads.state[1] : null;
            if (pad2 && pad2.active && (pad2.left || pad2.right || pad2.aim)) { var bx = pad2.aim ? pad2.aim[0] : (pad2.right ? 1 : -1), by = pad2.aim ? pad2.aim[1] : 0; w.want = Math.atan2(by, bx); }
            else if (ULDRleftPressed || ULDRrightPressed) w.want = w.ang + (ULDRrightPressed ? 0.09 : -0.09);
            w.boost = ULDRupPressed || !!PlayerInput[1].kbShoot || !!(pad2 && pad2.active && pad2.shoot);
        } else this.cpu(w);
    },

    cpu: function(w) {
        var h = w.segs[0], r = this.radius(w);
        w.cpuT++;
        // 1) danger: probe three rays ahead for bodies / the wall
        var best = null, bestScore = -1e9;
        for (let k = -3; k <= 3; k++) {
            var a = w.ang + k * 0.35, score = -Math.abs(k) * 2, clear = 1;
            for (let d = 30; d <= 200; d += 34) {
                var px = h.x + Math.cos(a) * d, py = h.y + Math.sin(a) * d;
                if (Math.hypot(px, py) > SNK.R - 60) { clear = 0; break; }
                if (this.hitBody(px, py, r + 8, w)) { clear = 0; break; }
            }
            if (!clear) score -= 1000;
            // 2) food: prefer the direction of the nearest big pellet cluster
            if (w.food) { var fa = Math.atan2(w.food.y - h.y, w.food.x - h.x), da = Math.abs(((fa - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI); score += (Math.PI - da) * 20; }
            if (score > bestScore) { bestScore = score; best = a; }
        }
        if (w.cpuT % 20 === 0 || !w.food || w.food.eaten) {
            var nf = null, nd = 700;
            for (let i = 0; i < this.pellets.length; i++) { var p = this.pellets[i], dd = Math.hypot(p.x - h.x, p.y - h.y) / p.v; if (dd < nd) { nd = dd; nf = p; } }
            w.food = nf;
            // 3) hunting: a CPU that is bigger sometimes tries to cut in front of a nearby worm
            var tgt = null;
            for (let i = 0; i < this.worms.length; i++) { var o = this.worms[i]; if (o !== w && o.alive && o.len < w.len && Math.hypot(o.segs[0].x - h.x, o.segs[0].y - h.y) < 500) tgt = o; }
            if (tgt && Math.random() < 0.5) { var oh = tgt.segs[0]; w.food = { x: oh.x + Math.cos(tgt.ang) * 160, y: oh.y + Math.sin(tgt.ang) * 160, eaten: false }; w.hunting = 40; }
        }
        w.want = best;
        w.boost = (w.hunting > 0 && w.len > 40) || (bestScore < -500 && w.len > 30 && Math.random() < 0.05);
        if (w.hunting > 0) w.hunting--;
    },

    hitBody: function(x, y, rad, self) {
        var cx = Math.floor(x / 80), cy = Math.floor(y / 80);
        for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
            var cell = this.grid[gx + "," + gy];
            if (!cell) continue;
            for (let i = 0; i < cell.length; i++) {
                var s = cell[i];
                if (s.w === self) continue;
                if (Math.hypot(s.x - x, s.y - y) < rad + s.r) return s.w;
            }
        }
        return null;
    },

    buildGrid: function() {
        this.grid = {};
        for (let k = 0; k < this.worms.length; k++) {
            var w = this.worms[k];
            if (!w.alive) continue;
            var r = this.radius(w);
            for (let i = 3; i < w.segs.length; i += 2) {        // skip the head area, every other segment is plenty
                var s = w.segs[i], key = Math.floor(s.x / 80) + "," + Math.floor(s.y / 80);
                (this.grid[key] || (this.grid[key] = [])).push({ x: s.x, y: s.y, r: r * 0.8, w: w });
            }
        }
    },

    kill: function(w, by) {
        if (!w.alive) return;
        w.alive = false; w.deadT = 0;
        var col = w.color;
        for (let i = 0; i < w.segs.length; i += 2) this.addPellet(w.segs[i].x + (Math.random() - 0.5) * 20, w.segs[i].y + (Math.random() - 0.5) * 20, 2 + ((w.len / 60) | 0), col);
        if (by) { by.kills++; }
        if (w.human !== undefined) {
            w.deathMsg = by ? "Eaten by " + by.name : "You hit the wall";
            w.finalLen = Math.round(w.len);
            if (w.finalLen > snakeSave.best) { snakeSave.best = w.finalLen; try { localStorage.setItem("timsWormArena", JSON.stringify(snakeSave)); } catch (e) {} }
            if (typeof SFX !== "undefined") SFX.play("ko");
        } else if (by && by.human !== undefined) {
            if (typeof SFX !== "undefined") SFX.play("kill");
            showBanner(by.name + " got " + w.name + "!", "length " + Math.round(w.len), by.color);
        }
    },

    step: function() {
        this.t++;
        this.buildGrid();
        for (let k = 0; k < this.worms.length; k++) {
            var w = this.worms[k];
            if (!w.alive) {
                w.deadT++;
                if (w.human === undefined && w.deadT > 180) this.spawn({ old: w, name: w.name, color: w.color });
                continue;
            }
            this.control(w);
            // turn toward the wanted heading (bigger worms turn a little slower)
            var d = ((w.want - w.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI, turn = 0.11 - Math.min(0.05, w.len / 4000);
            w.ang += Math.max(-turn, Math.min(turn, d));
            var boosting = w.boost && w.len > 14;
            var sp = boosting ? 7.2 : 3.6;
            if (boosting && this.t % 6 === 0) { w.len -= 1; var tl = w.segs[w.segs.length - 1]; this.addPellet(tl.x, tl.y, 1, w.color); }
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
            var r = this.radius(w);
            for (let i = this.pellets.length - 1; i >= 0; i--) {
                var p = this.pellets[i];
                if (Math.abs(p.x - nh.x) < r + 14 && Math.abs(p.y - nh.y) < r + 14) {
                    // pellets get sucked in for a frame or two before they disappear
                    if (Math.hypot(p.x - nh.x, p.y - nh.y) < r + 6) { w.len += p.v * 0.75; p.eaten = true; this.pellets.splice(i, 1); }
                    else { p.x += (nh.x - p.x) * 0.3; p.y += (nh.y - p.y) * 0.3; }
                }
            }
            // die on the wall or another worm's body
            if (Math.hypot(nh.x, nh.y) > SNK.R - r) { this.kill(w, null); continue; }
            if (w.safeT > 0) { w.safeT--; continue; }
            var hit = this.hitBody(nh.x, nh.y, r * 0.7, w);
            if (hit) this.kill(w, hit);
        }
        while (this.pellets.length < SNK.PELLETS) this.addPellet();
        if (this.pellets.length > SNK.PELLETS * 2) this.pellets.splice(0, this.pellets.length - SNK.PELLETS * 2);
    },

    toScreen: function(x, y) { var c = this.cam; return [(x - c.x) * c.z + cssW / 2, (y - c.y) * c.z + cssH / 2]; },

    humans: function() { return this.worms.filter(function(w) { return w.human !== undefined; }); },

    render: function() {
        var hs = this.humans().filter(function(w) { return w.alive; });
        // camera: follow the human worms, zoom out as they grow (and to fit both)
        var tx = 0, ty = 0, span = 0;
        if (hs.length) { hs.forEach(function(w) { tx += w.segs[0].x; ty += w.segs[0].y; }); tx /= hs.length; ty /= hs.length; if (hs.length > 1) span = Math.hypot(hs[0].segs[0].x - hs[1].segs[0].x, hs[0].segs[0].y - hs[1].segs[0].y); }
        else { tx = this.cam.x; ty = this.cam.y; }
        var biggest = hs.reduce(function(m, w) { return Math.max(m, w.len); }, 24);
        var z = Math.max(0.35, Math.min(1.1, 1.15 - Math.sqrt(biggest) * 0.035)), fitZ = span ? Math.min(z, (Math.min(cssW, cssH) * 0.8) / (span + 300)) : z;
        this.cam.x += (tx - this.cam.x) * 0.15; this.cam.y += (ty - this.cam.y) * 0.15; this.cam.z += (Math.max(0.25, fitZ) - this.cam.z) * 0.05;
        var c = this.cam, Z = c.z;
        ctx.fillStyle = "#060a12"; ctx.fillRect(0, 0, cssW, cssH);
        // hex-ish dot floor inside the arena
        var o = this.toScreen(0, 0);
        ctx.save();
        ctx.beginPath(); ctx.arc(o[0], o[1], SNK.R * Z, 0, 7); ctx.fillStyle = "#0d1626"; ctx.fill(); ctx.clip();
        var step = 60, x0 = Math.floor((c.x - cssW / 2 / Z) / step) * step, y0 = Math.floor((c.y - cssH / 2 / Z) / step) * step;
        ctx.fillStyle = "#16233a";
        for (let x = x0; x < c.x + cssW / 2 / Z + step; x += step) for (let y = y0; y < c.y + cssH / 2 / Z + step; y += step) {
            var p = this.toScreen(x + ((y / step) & 1) * step / 2, y); ctx.fillRect(p[0] - 2 * Z, p[1] - 2 * Z, 4 * Z + 1, 4 * Z + 1);
        }
        // pellets
        for (let i = 0; i < this.pellets.length; i++) {
            var pl = this.pellets[i], ps = this.toScreen(pl.x, pl.y);
            if (ps[0] < -20 || ps[1] < -20 || ps[0] > cssW + 20 || ps[1] > cssH + 20) continue;
            var pr = (3 + pl.v * 1.4) * Z * (1 + Math.sin(this.t * 0.1 + pl.ph) * 0.15);
            ctx.globalAlpha = 0.35; ctx.fillStyle = pl.col; ctx.beginPath(); ctx.arc(ps[0], ps[1], pr * 2.2, 0, 7); ctx.fill();
            ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(ps[0], ps[1], pr, 0, 7); ctx.fill();
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

    hud: function() {
        var hs = this.humans();
        uiPanel(14, 10, 300, 60, "#f472b6");
        uiText("WORM ARENA", 30, 38, 22, "#f9a8d4", "left", "900");
        uiText(hs.map(function(w) { return w.name + " " + (w.alive ? Math.round(w.len) : "✖"); }).join("   ") + "   best " + snakeSave.best, 30, 58, 12, "#cbd5e1", "left", "800");
        // leaderboard
        var all = this.worms.filter(function(w) { return w.alive; }).sort(function(a, b) { return b.len - a.len; });
        var lb = all.slice(0, 8);
        all.forEach(function(w, i) { if (i >= 8 && w.human !== undefined) { w.rank = i + 1; lb.push(w); } });   // you, even when you're not top 8
        uiPanel(cssW - 214, 64, 200, 30 + lb.length * 18, "#f472b6", 0.8);
        uiText("LEADERBOARD", cssW - 114, 84, 12, "#f9a8d4", "center", "900");
        for (let i = 0; i < lb.length; i++) {
            var w = lb[i];
            uiText((w.rank && i >= 8 ? w.rank : i + 1) + ". " + w.name, cssW - 202, 104 + i * 18, 12, w.human !== undefined ? "#fde047" : w.color, "left", w.human !== undefined ? "900" : "700");
            uiText(String(Math.round(w.len)), cssW - 26, 104 + i * 18, 12, "#e2e8f0", "right", "800");
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
        // death card
        for (let i = 0; i < hs.length; i++) {
            var hw = hs[i];
            if (hw.alive) continue;
            var y = cssH / 2 - 60 + i * 120;
            uiPanel(cssW / 2 - 200, y, 400, 100, hw.color, 0.92);
            uiText(hw.name + ": " + (hw.deathMsg || "Out!"), cssW / 2, y + 36, 22, "#fff", "center", "900");
            uiText("length " + hw.finalLen + "  ·  " + (hw.deadT > 60 ? (hw.human === 0 ? "click / Space" : "Enter / ↑") + " to play again" : "…"), cssW / 2, y + 70, 15, "#cbd5e1", "center", "800");
        }
        uiText((hs[0] && hs[0].keyMode ? "A/D turn" : "Mouse steers") + " · click / Space / W boost (costs length) · cut others off · Esc menu" + (multiplayer ? " · P2: ←/→ turn, ↑ boost" : ""), cssW / 2, cssH - 14, 12, "rgba(220,230,240,0.7)", "center", "700");
    }
};

ModeKit.addLevel("snake_arena", { name: "🐍 Worm Arena", mode: "snake", wavesEnabled: false, spawnP1: [0, 60], spawnP2: [60, 60], layout: ModeKit.room(-600, 600, 800, {}), title: "Worm Arena" });

GameModes.register({
    id: "snake",
    title: "WORM ARENA",
    tagline: "Slither-style arena: grow by eating, boost, and make the other worms crash into you.",
    color: "#f472b6",
    firstLevel: "snake_arena",
    flags: { ownScreen: true, waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, scenery: false, coopToggle: true },
    overTitle: "WORM ARENA",

    setupLevel: function() { Snake.reset(); Snake.lastMouse = [mouseX, mouseY]; },

    screenFrame: function() {
        Snake.mouseMoved = Math.hypot(mouseX - Snake.lastMouse[0], mouseY - Snake.lastMouse[1]) > 3;
        Snake.lastMouse = [mouseX, mouseY];
        // respawn a dead human when they press their button
        var hs = Snake.humans();
        for (let i = 0; i < hs.length; i++) {
            var w = hs[i];
            if (w.alive) continue;
            w.deadT++;
            var pad = (typeof Pads !== "undefined") ? Pads.state[w.human] : null;
            var again = w.human === 0 ? (mouseDown || SpacePressed || !!(pad && pad.active && pad.shoot)) : (ULDRupPressed || !!PlayerInput[1].kbShoot || !!(pad && pad.active && pad.shoot));
            if (w.deadT > 60 && again) { Snake.spawn({ old: w, name: w.name, color: w.color, human: w.human }); w.kills = 0; }
        }
        Snake.step();
        Snake.render();
        Snake.hud();
    },

    onClick: function() { return true; },
    menuItems: function(items) { items.push({ id: "sn_new", label: "New arena", hint: "" }); },
    onMenu: function(id) { if (id === "sn_new") { closePause(); Snake.reset(); return true; } return false; },
    onRestart: function() { Snake.reset(); },
    overSub: function() { return "Best length " + snakeSave.best; }
});
