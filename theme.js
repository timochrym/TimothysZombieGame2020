// ============================================================================
// THEMES: one look setting shared by every game (Pause -> Settings, or the
// Cheats panel's "Shared by every game" box).
//   Theme.c          -> the current palette (sky, hills, cavern, panel, bg...)
//   Theme.set(id)    -> switch theme, rebuild cached backgrounds, save
//   Theme.setBright(v) -> whole-screen brightness (works in every game, even
//                         ones that paint their own background)
// ============================================================================
var THEMES = {
    night:  { label: "🌙 Night (classic)",
              sky: ["#0d1b2a", "#1b2e3c", "#0f1e26"], peaks: ["#142433", "#17293b", "#12202e"], hills: "#19303d", castle: "#152833",
              cavern: "#0a121a", wall: "#1c2433", bg: "#0b1220", panel: "9,14,22", page: "#0d1b2a", filter: "",
              dp: { bg: "rgba(10,16,24,0.94)", line: "rgba(130,180,210,0.22)" } },
    day:    { label: "☀️ Day (light)",
              sky: ["#6fb8ea", "#b5def6", "#e4f3fb"], peaks: ["#93b6cf", "#a6c5da", "#8aaec8"], hills: "#86b98f", castle: "#73a27f",
              cavern: "#5c4634", wall: "#6d7d90", bg: "#3d6f94", panel: "26,46,70", page: "#6fb8ea", floor: "#eef2f5", grid: "#d3dce5", filter: "",
              dp: { bg: "rgba(24,44,66,0.94)", line: "rgba(170,210,235,0.35)" } },
    sunset: { label: "🌅 Sunset",
              sky: ["#2c1a4d", "#a9497a", "#f2a05a"], peaks: ["#4b2b60", "#5b3369", "#43285a"], hills: "#5f3a5e", castle: "#4e2f50",
              cavern: "#22132a", wall: "#3a2840", bg: "#3a2147", panel: "36,18,42", page: "#2c1a4d", floor: "#2e1a3c", grid: "#452b55", filter: "",
              dp: { bg: "rgba(38,20,46,0.94)", line: "rgba(240,160,200,0.28)" } },
    meadow: { label: "🌿 Meadow (bright)",
              sky: ["#9fd8f5", "#d6f0e0", "#f4f9e6"], peaks: ["#a9c7b0", "#b7d3bb", "#9cbfa5"], hills: "#6fae63", castle: "#5f9a57",
              cavern: "#6a5238", wall: "#7b8a6c", bg: "#4b7f5a", panel: "28,54,40", page: "#9fd8f5", floor: "#e7f2df", grid: "#cde0c2", filter: "saturate(1.1)",
              dp: { bg: "rgba(26,52,38,0.94)", line: "rgba(180,230,190,0.35)" } },
    retro:  { label: "📼 Retro (warm film)",
              sky: ["#1d1a14", "#3a3020", "#20190f"], peaks: ["#2f2818", "#3a321e", "#2a2415"], hills: "#3d3420", castle: "#30291a",
              cavern: "#14100a", wall: "#2a2418", bg: "#1a160f", panel: "22,18,10", page: "#1d1a14", floor: "#1d170e", grid: "#2e2617", filter: "sepia(0.35) contrast(1.06)",
              dp: { bg: "rgba(26,22,14,0.94)", line: "rgba(230,200,140,0.28)" } },
    abyss:  { label: "🌌 Bioluminescent Abyss",
              sky: ["#040712", "#09122b", "#050a1a"], peaks: ["#0a132c", "#0e1a3a", "#070e22"], hills: "#0d1b36", castle: "#091429",
              cavern: "#03060f", wall: "#111e38", bg: "#040712", panel: "6,11,26", page: "#040712",
              floor: "rgba(6, 12, 30, 0.42)", grid: "rgba(56, 189, 248, 0.11)", filter: "", anim: "abyss",
              dp: { bg: "rgba(6,11,26,0.94)", line: "rgba(56,189,248,0.28)" } },
    veins:  { label: "🩸 Crimson Veins",
              sky: ["#090306", "#1a0710", "#0c0409"], peaks: ["#17060e", "#220915", "#12040b"], hills: "#240b17", castle: "#1a0810",
              cavern: "#070205", wall: "#260d18", bg: "#090306", panel: "16,5,10", page: "#090306",
              floor: "rgba(18, 5, 11, 0.45)", grid: "rgba(244, 63, 94, 0.11)", filter: "", anim: "veins",
              dp: { bg: "rgba(18,5,11,0.94)", line: "rgba(244,63,94,0.28)" } },
    cyber:  { label: "⚡ Cyber Circuit",
              sky: ["#050811", "#0a1628", "#060b16"], peaks: ["#091324", "#0e1c33", "#070f1e"], hills: "#0d1b30", castle: "#091424",
              cavern: "#04060d", wall: "#122138", bg: "#050811", panel: "6,10,22", page: "#050811",
              floor: "rgba(6, 10, 22, 0.45)", grid: "rgba(56, 189, 248, 0.12)", filter: "", anim: "cyber",
              dp: { bg: "rgba(6,10,22,0.94)", line: "rgba(52,211,153,0.28)" } },
    mycelium: { label: "🕸️ Void Mycelium",
              sky: ["#070410", "#140a29", "#090516"], peaks: ["#120926", "#1b0e38", "#0e071d"], hills: "#1c1038", castle: "#140b29",
              cavern: "#05030b", wall: "#21143d", bg: "#070410", panel: "11,6,24", page: "#070410",
              floor: "rgba(11, 6, 24, 0.45)", grid: "rgba(192, 132, 252, 0.11)", filter: "", anim: "mycelium",
              dp: { bg: "rgba(11,6,24,0.94)", line: "rgba(192,132,252,0.28)" } }
};
var THEME_ORDER = ["night", "abyss", "veins", "cyber", "mycelium", "day", "sunset", "meadow", "retro"];
var BRIGHT_STEPS = [0.85, 1, 1.15, 1.3, 1.5];

var Theme = {
    id: "night",
    c: THEMES.night,
    _cache: null,
    init: function() {
        if (typeof settings === "undefined") return;
        if (!THEMES[settings.theme]) settings.theme = "night";
        if (typeof settings.bright !== "number" || settings.bright < 0.6 || settings.bright > 1.8) settings.bright = 1;
        this.id = settings.theme; this.c = THEMES[this.id];
        this.applyPage();
    },
    // Background colour for full-screen games (cards, tables, menus).
    bg: function() { return this.c.bg; },
    // Arena floor / grid for top-down games; Night keeps each game's own colours.
    floor: function(nightCol) { return this.c.floor || nightCol; },
    grid: function(nightCol) { return this.c.grid || nightCol; },
    panel: function(a) { return "rgba(" + this.c.panel + "," + a + ")"; },
    set: function(id) {
        if (!THEMES[id]) return;
        this.id = id; this.c = THEMES[id];
        if (typeof settings !== "undefined") { settings.theme = id; if (typeof saveSettings === "function") saveSettings(); }
        if (typeof BackgroundMosaic !== "undefined") {
            BackgroundMosaic._skyGrad = null;
            if (BackgroundMosaic.layers) BackgroundMosaic.buildMosaicLayers();
        }
        this.applyPage();
    },
    cycle: function(dir) {
        var i = THEME_ORDER.indexOf(this.id);
        this.set(THEME_ORDER[(i + (dir || 1) + THEME_ORDER.length) % THEME_ORDER.length]);
    },
    setBright: function(v) {
        settings.bright = Math.max(0.6, Math.min(1.8, Math.round(v * 100) / 100));
        if (typeof saveSettings === "function") saveSettings();
        this.applyPage();
    },
    stepBright: function(dir) {
        var i = 0, best = 9;
        for (var k = 0; k < BRIGHT_STEPS.length; k++) { var d = Math.abs(BRIGHT_STEPS[k] - settings.bright); if (d < best) { best = d; i = k; } }
        this.setBright(BRIGHT_STEPS[Math.max(0, Math.min(BRIGHT_STEPS.length - 1, i + (dir || 1)))]);
    },
    filterCss: function() {
        var f = this.c.filter || "";
        var b = (typeof settings !== "undefined" && settings.bright) || 1;
        if (Math.abs(b - 1) > 0.001) f += (f ? " " : "") + "brightness(" + b + ")";
        return f;
    },
    // Page colour, canvas filter (brightness + theme tint) and the panel colours.
    applyPage: function() {
        if (typeof document === "undefined") return;
        var c = this.c, f = this.filterCss();
        var cv = document.getElementById("screen");
        if (cv) { cv.style.filter = f; cv.style.background = c.page; }
        if (document.body) document.body.style.background = c.page;
        var root = document.documentElement;
        if (root && root.style) { root.style.setProperty("--dp-bg", c.dp.bg); root.style.setProperty("--dp-line", c.dp.line); }
        root.dataset.theme = this.id;
    },
    _ensureCache: function() {
        if (this._cache) return this._cache;
        var seed = 1337;
        function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
        // Bioluminescent orbs + spores
        var orbs = [];
        for (let i = 0; i < 18; i++) {
            orbs.push({ x: rnd(), y: rnd(), vx: (rnd() - 0.5) * 0.018, vy: (rnd() - 0.5) * 0.014, r: 70 + rnd() * 130, ph: rnd() * 6.28, hue: i % 2 ? 190 : 268 });
        }
        var spores = [];
        for (let i = 0; i < 32; i++) spores.push({ x: rnd(), y: rnd(), vy: -0.012 - rnd() * 0.025, s: 1.2 + rnd() * 2.2, ph: rnd() * 6.28 });
        // Organic branching veins
        var veins = [];
        function addBranch(x0, y0, ang, len, depth) {
            if (depth <= 0 || len < 0.05) return;
            var x2 = x0 + Math.cos(ang) * len, y2 = y0 + Math.sin(ang) * len;
            var perp = ang + Math.PI * 0.5, bend = (rnd() - 0.5) * len * 0.55;
            var cx = (x0 + x2) * 0.5 + Math.cos(perp) * bend, cy = (y0 + y2) * 0.5 + Math.sin(perp) * bend;
            veins.push({ x0: x0, y0: y0, cx: cx, cy: cy, x2: x2, y2: y2, w: depth * 1.45, ph: rnd() * 6.28, sp: 0.25 + rnd() * 0.35 });
            var splits = depth >= 3 ? 2 : (rnd() < 0.72 ? 2 : 1);
            for (let s = 0; s < splits; s++) {
                var da = (s === 0 ? -1 : 1) * (0.28 + rnd() * 0.42) + (rnd() - 0.5) * 0.15;
                addBranch(x2, y2, ang + da, len * (0.64 + rnd() * 0.16), depth - 1);
            }
        }
        var roots = [
            [0.0, 0.15, 0.25], [0.0, 0.78, -0.32], [1.0, 0.22, Math.PI - 0.28],
            [1.0, 0.82, Math.PI + 0.32], [0.48, 0.0, Math.PI * 0.5 + 0.12], [0.52, 1.0, -Math.PI * 0.5 - 0.12]
        ];
        for (let i = 0; i < roots.length; i++) addBranch(roots[i][0], roots[i][1], roots[i][2], 0.24, 4);
        // Cyber circuit traces
        var circuits = [];
        for (let i = 0; i < 24; i++) {
            var px = Math.round(rnd() * 16) / 16, py = Math.round(rnd() * 10) / 10;
            var pts = [{ x: px, y: py }];
            var dir = Math.floor(rnd() * 4);
            for (let s = 0; s < 4; s++) {
                var step = 0.07 + Math.floor(rnd() * 3) * 0.06;
                var ang = dir * Math.PI * 0.5 + (s === 1 && rnd() < 0.4 ? Math.PI * 0.25 : 0);
                px = Math.max(0.02, Math.min(0.98, px + Math.cos(ang) * step));
                py = Math.max(0.02, Math.min(0.98, py + Math.sin(ang) * step));
                pts.push({ x: px, y: py });
                dir = (dir + (rnd() < 0.5 ? 1 : 3)) % 4;
            }
            circuits.push({ pts: pts, col: i % 3 === 0 ? "#34d399" : "#38bdf8", ph: rnd() * 6.28, sp: 0.35 + rnd() * 0.45 });
        }
        // Mycelium / neural nodes
        var nodes = [];
        for (let i = 0; i < 24; i++) {
            nodes.push({ bx: 0.08 + rnd() * 0.84, by: 0.08 + rnd() * 0.84, ax: 0.04 + rnd() * 0.06, ay: 0.04 + rnd() * 0.06, fx: 0.25 + rnd() * 0.35, fy: 0.22 + rnd() * 0.32, ph: rnd() * 6.28 });
        }
        this._cache = { orbs: orbs, spores: spores, veins: veins, circuits: circuits, nodes: nodes };
        return this._cache;
    },
    drawBg: function(ctx, W, H, px, py) {
        ctx.fillStyle = this.c.bg;
        ctx.fillRect(0, 0, W, H);
        this.drawBgOverlay(ctx, W, H, px, py);
    },
    drawBgOverlay: function(ctx, W, H, px, py) {
        var anim = this.c.anim;
        if (!anim || (typeof settings !== "undefined" && settings.animBg === false)) return;
        var C = this._ensureCache();
        var t = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001;
        var ox = ((px || 0) % W + W) % W, oy = ((py || 0) % H + H) % H;
        ctx.save();
        if (anim === "abyss") {
            // Breathing aurora ribbons
            ctx.globalCompositeOperation = "lighter";
            for (let b = 0; b < 2; b++) {
                var yBase = H * (0.3 + b * 0.38) + Math.sin(t * 0.35 + b * 2) * 32;
                var gA = ctx.createLinearGradient(0, yBase - 120, W, yBase + 120);
                gA.addColorStop(0, "rgba(34,211,238,0)");
                gA.addColorStop(0.5, b === 0 ? "rgba(34,211,238,0.09)" : "rgba(167,139,250,0.08)");
                gA.addColorStop(1, "rgba(167,139,250,0)");
                ctx.fillStyle = gA;
                ctx.beginPath();
                ctx.moveTo(0, yBase);
                for (let x = 0; x <= W; x += 80) {
                    ctx.lineTo(x, yBase + Math.sin(x * 0.004 + t * 0.7 + b) * 45);
                }
                ctx.lineTo(W, yBase + 140); ctx.lineTo(0, yBase + 140); ctx.closePath(); ctx.fill();
            }
            // Glowing bioluminescent orbs
            for (let i = 0; i < C.orbs.length; i++) {
                var o = C.orbs[i];
                var x = (((o.x + o.vx * t) * W - ox * 0.5) % (W + 240) + W + 240) % (W + 240) - 120;
                var y = (((o.y + o.vy * t) * H - oy * 0.5) % (H + 240) + H + 240) % (H + 240) - 120;
                var pulse = 0.85 + 0.18 * Math.sin(t * 1.4 + o.ph);
                var r = o.r * pulse;
                var gr = ctx.createRadialGradient(x, y, 0, x, y, r);
                gr.addColorStop(0, "hsla(" + o.hue + ",90%,65%,0.24)");
                gr.addColorStop(0.45, "hsla(" + o.hue + ",85%,50%,0.08)");
                gr.addColorStop(1, "hsla(" + o.hue + ",85%,45%,0)");
                ctx.fillStyle = gr;
                ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
            }
            // Floating spores
            ctx.fillStyle = "rgba(165,243,252,0.45)";
            for (let i = 0; i < C.spores.length; i++) {
                var sp = C.spores[i];
                var sx = (((sp.x * W + Math.sin(t + sp.ph) * 22 - ox * 0.3) % W) + W) % W;
                var sy = (((sp.y + sp.vy * t) * H - oy * 0.3) % H + H) % H;
                ctx.beginPath(); ctx.arc(sx, sy, sp.s, 0, 7); ctx.fill();
            }
        } else if (anim === "veins") {
            var beat = 0.65 + 0.35 * Math.pow(Math.max(0, Math.sin(t * 2.1)), 3);
            ctx.lineCap = "round";
            for (let i = 0; i < C.veins.length; i++) {
                var v = C.veins[i];
                var sway = Math.sin(t * 0.9 + v.ph) * 8;
                var x0 = v.x0 * W, y0 = v.y0 * H, cx = v.cx * W + sway, cy = v.cy * H - sway, x2 = v.x2 * W, y2 = v.y2 * H;
                ctx.strokeStyle = "rgba(190,18,60," + (0.22 + 0.14 * beat) + ")";
                ctx.lineWidth = v.w * 2.4;
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
                ctx.strokeStyle = "rgba(251,113,133," + (0.28 + 0.25 * beat) + ")";
                ctx.lineWidth = Math.max(0.9, v.w * 0.65);
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
                // Travelling blood/energy pulse along vein
                var u = (t * v.sp + v.ph) % 1, iu = 1 - u;
                var pxV = iu * iu * x0 + 2 * iu * u * cx + u * u * x2;
                var pyV = iu * iu * y0 + 2 * iu * u * cy + u * u * y2;
                ctx.fillStyle = "rgba(253,164,175,0.65)";
                ctx.beginPath(); ctx.arc(pxV, pyV, Math.max(1.5, v.w * 0.7), 0, 7); ctx.fill();
            }
        } else if (anim === "cyber") {
            ctx.lineCap = "round"; ctx.lineJoin = "round";
            for (let i = 0; i < C.circuits.length; i++) {
                var tr = C.circuits[i], pts = tr.pts;
                ctx.strokeStyle = tr.col === "#34d399" ? "rgba(52,211,153,0.18)" : "rgba(56,189,248,0.18)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(pts[0].x * W, pts[0].y * H);
                for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x * W, pts[k].y * H);
                ctx.stroke();
                // Junction nodes
                ctx.fillStyle = tr.col === "#34d399" ? "rgba(52,211,153,0.38)" : "rgba(56,189,248,0.38)";
                ctx.beginPath(); ctx.arc(pts[0].x * W, pts[0].y * H, 3, 0, 7); ctx.fill();
                ctx.beginPath(); ctx.arc(pts[pts.length - 1].x * W, pts[pts.length - 1].y * H, 3.5, 0, 7); ctx.fill();
                // Zipping data pulse
                var segs = pts.length - 1, pos = ((t * tr.sp + tr.ph) % 1) * segs;
                var si = Math.min(segs - 1, Math.floor(pos)), f = pos - si;
                var dx = pts[si].x * W + (pts[si + 1].x - pts[si].x) * W * f;
                var dy = pts[si].y * H + (pts[si + 1].y - pts[si].y) * H * f;
                ctx.fillStyle = tr.col;
                ctx.beginPath(); ctx.arc(dx, dy, 3.2, 0, 7); ctx.fill();
            }
            // Subtle cyber scanline sweep
            var scanY = ((t * 95) % (H + 160)) - 80;
            var sg = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
            sg.addColorStop(0, "rgba(56,189,248,0)");
            sg.addColorStop(0.5, "rgba(56,189,248,0.08)");
            sg.addColorStop(1, "rgba(56,189,248,0)");
            ctx.fillStyle = sg;
            ctx.fillRect(0, scanY - 60, W, 120);
        } else if (anim === "mycelium") {
            ctx.globalCompositeOperation = "lighter";
            var ptsN = [];
            for (let i = 0; i < C.nodes.length; i++) {
                var n = C.nodes[i];
                ptsN.push({
                    x: (n.bx + Math.sin(t * n.fx + n.ph) * n.ax) * W,
                    y: (n.by + Math.cos(t * n.fy + n.ph) * n.ay) * H
                });
            }
            var maxD = Math.min(W, H) * 0.28, maxD2 = maxD * maxD;
            for (let i = 0; i < ptsN.length; i++) {
                var a = ptsN[i];
                for (let j = i + 1; j < ptsN.length; j++) {
                    var b = ptsN[j], ddx = b.x - a.x, ddy = b.y - a.y, d2 = ddx * ddx + ddy * ddy;
                    if (d2 > maxD2) continue;
                    var alpha = (1 - Math.sqrt(d2) / maxD) * 0.42;
                    var mx = (a.x + b.x) * 0.5 + Math.sin(t + i + j) * 18;
                    var my = (a.y + b.y) * 0.5 + Math.cos(t + i - j) * 18;
                    ctx.strokeStyle = (i + j) % 2 ? "rgba(192,132,252," + alpha + ")" : "rgba(45,212,191," + alpha + ")";
                    ctx.lineWidth = 1.4;
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
                    if ((i + j) % 5 === 0) {
                        var su = (t * 0.55 + i * 0.3) % 1, siu = 1 - su;
                        var sxN = siu * siu * a.x + 2 * siu * su * mx + su * su * b.x;
                        var syN = siu * siu * a.y + 2 * siu * su * my + su * su * b.y;
                        ctx.fillStyle = "rgba(233,213,255," + (alpha * 1.8) + ")";
                        ctx.beginPath(); ctx.arc(sxN, syN, 2.2, 0, 7); ctx.fill();
                    }
                }
                ctx.fillStyle = "rgba(192,132,252,0.55)";
                ctx.beginPath(); ctx.arc(a.x, a.y, 2.8, 0, 7); ctx.fill();
            }
        }
        ctx.restore();
    }
};
Theme.init();
if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function() { Theme.applyPage(); });
