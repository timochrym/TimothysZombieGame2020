// ============================================================================
// GAME: SAND LAB  (powder)  -  a falling-sand toy
//   Paint materials into a grid and watch them interact: sand piles and sinks, water flows, oil floats,
//   fire spreads through oil / plants / wood, lava meets water and turns to stone, plants drink water and grow,
//   steam rises and rains back down. Left mouse paints, right mouse erases, wheel or [ ] = brush size,
//   1-0 / click the palette = material, Space = pause, C = clear, S = save, L = load.
//   Runs on its own full screen (the engine's `ownScreen` flag) - no platformer world underneath.
// ============================================================================
var PW = { W: 320, H: 180 };
var PM = [   // id order matters: index = cell value
    { id: "empty", name: "Eraser", col: [12, 17, 26] },
    { id: "sand", name: "Sand", col: [214, 186, 112], key: "Digit1" },
    { id: "water", name: "Water", col: [56, 132, 230], key: "Digit2" },
    { id: "wall", name: "Wall", col: [100, 108, 122], key: "Digit3" },
    { id: "fire", name: "Fire", col: [255, 120, 30], key: "Digit4" },
    { id: "oil", name: "Oil", col: [92, 64, 40], key: "Digit5" },
    { id: "plant", name: "Plant", col: [64, 170, 70], key: "Digit6" },
    { id: "lava", name: "Lava", col: [235, 80, 20], key: "Digit7" },
    { id: "stone", name: "Stone", col: [128, 128, 134], key: "Digit8" },
    { id: "steam", name: "Steam", col: [200, 210, 225], key: "Digit9" },
    { id: "wood", name: "Wood", col: [140, 92, 50], key: "Digit0" }
];
var P_EMPTY = 0, P_SAND = 1, P_WATER = 2, P_WALL = 3, P_FIRE = 4, P_OIL = 5, P_PLANT = 6, P_LAVA = 7, P_STONE = 8, P_STEAM = 9, P_WOOD = 10;
// density: heavier things sink through lighter liquids/gases
var P_DENS = [0, 5, 3, 99, 0, 2, 99, 4, 6, 0, 99];
var P_LIQUID = { 2: 1, 5: 1, 7: 1 };
var P_BURNS = { 5: 0.08, 6: 0.04, 10: 0.012 };   // chance per touching-fire frame

var Powder = {
    grid: null, life: null, moved: null, sel: 1, brush: 4, paused: false, img: null, cvs: null, t: 0,
    rd: null, view: { x: 0, y: 0, s: 1 }, counts: [],

    init: function() {
        var n = PW.W * PW.H;
        this.grid = new Uint8Array(n); this.life = new Uint8Array(n); this.moved = new Uint8Array(n);
        this.cvs = document.createElement("canvas"); this.cvs.width = PW.W; this.cvs.height = PW.H;
        this.img = this.cvs.getContext("2d").createImageData(PW.W, PW.H);
        this.shade = new Uint8Array(n);
        for (let i = 0; i < n; i++) this.shade[i] = (Math.random() * 22) | 0;
        // a little starter scene: a bowl of walls, a sand pile and a pond
        for (let x = 40; x < 280; x++) this.set(x, 170, P_WALL);
        for (let y = 120; y < 171; y++) { this.set(40, y, P_WALL); this.set(279, y, P_WALL); }
        for (let x = 150; x < 170; x++) for (let y = 120; y < 170; y++) this.set(x, y, P_WALL);
        for (let x = 60; x < 140; x++) for (let y = 150 + Math.abs(x - 100) / 3; y < 170; y++) this.set(x, y | 0, P_SAND);
        for (let x = 170; x < 279; x++) for (let y = 150; y < 170; y++) this.set(x, y, P_WATER);
        for (let x = 200; x < 230; x++) this.set(x, 110, P_WOOD);
    },

    idx: function(x, y) { return y * PW.W + x; },
    get: function(x, y) { return (x < 0 || y < 0 || x >= PW.W || y >= PW.H) ? P_WALL : this.grid[y * PW.W + x]; },
    set: function(x, y, v) { if (x < 0 || y < 0 || x >= PW.W || y >= PW.H) return; var i = y * PW.W + x; this.grid[i] = v; this.life[i] = v === P_FIRE ? 30 + ((Math.random() * 40) | 0) : (v === P_STEAM ? 120 + ((Math.random() * 120) | 0) : 0); },
    swap: function(a, b) { var g = this.grid, l = this.life, t = g[a]; g[a] = g[b]; g[b] = t; t = l[a]; l[a] = l[b]; l[b] = t; this.moved[a] = this.moved[b] = 1; },

    // try to move cell i (x,y) into (nx,ny) if what's there is lighter
    tryMove: function(i, x, y, nx, ny) {
        if (nx < 0 || ny < 0 || nx >= PW.W || ny >= PW.H) return false;
        var j = ny * PW.W + nx, a = this.grid[i], b = this.grid[j];
        if (b === P_EMPTY || (P_DENS[b] < P_DENS[a] && (P_LIQUID[b] || b === P_STEAM || b === P_FIRE))) { this.swap(i, j); return true; }
        return false;
    },

    step: function() {
        var W = PW.W, H = PW.H, g = this.grid, L = this.life;
        this.moved.fill(0);
        var flip = (this.t & 1) === 1;
        // falling things update bottom-up, rising things top-down; one pass bottom-up with rising handled by "moved"
        for (let y = H - 1; y >= 0; y--) {
            for (let k = 0; k < W; k++) {
                var x = flip ? k : W - 1 - k, i = y * W + x, c = g[i];
                if (c === P_EMPTY || c === P_WALL || this.moved[i]) continue;
                var r = Math.random(), dir = r < 0.5 ? -1 : 1;
                if (c === P_SAND || c === P_STONE) {
                    if (!this.tryMove(i, x, y, x, y + 1) && !this.tryMove(i, x, y, x + dir, y + 1)) this.tryMove(i, x, y, x - dir, y + 1);
                } else if (c === P_WATER || c === P_OIL || c === P_LAVA) {
                    if (c === P_LAVA && r < 0.5) continue;          // lava is sluggish
                    if (!this.tryMove(i, x, y, x, y + 1) && !this.tryMove(i, x, y, x + dir, y + 1) && !this.tryMove(i, x, y, x + dir, y)) this.tryMove(i, x, y, x - dir, y);
                    if (c === P_LAVA) this.react(x, y, i);
                    else if (c === P_WATER) this.wet(x, y, i);
                } else if (c === P_FIRE) {
                    this.burn(x, y, i);
                    if (g[i] === P_FIRE) {
                        if (--L[i] === 0) { g[i] = Math.random() < 0.25 ? P_STEAM : P_EMPTY; if (g[i] === P_STEAM) L[i] = 40; continue; }
                        if (r < 0.6) { if (!this.tryMove(i, x, y, x + ((r * 10) | 0) % 3 - 1, y - 1)) this.tryMove(i, x, y, x + dir, y); }
                    }
                } else if (c === P_STEAM) {
                    if (--L[i] === 0) { g[i] = Math.random() < 0.6 ? P_WATER : P_EMPTY; continue; }    // condenses back to rain
                    if (!this.tryMove(i, x, y, x + ((r * 10) | 0) % 3 - 1, y - 1)) this.tryMove(i, x, y, x + dir, y);
                } else if (c === P_PLANT) {
                    // plants drink neighbouring water and grow into it
                    if (r < 0.02) { var nx = x + ((r * 300) | 0) % 3 - 1, ny = y + ((r * 900) | 0) % 3 - 1; if (this.get(nx, ny) === P_WATER) this.set(nx, ny, P_PLANT); }
                }
            }
        }
        this.t++;
    },

    neigh: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    react: function(x, y, i) {      // lava: water -> stone (+steam), sets flammables alight
        for (let k = 0; k < 4; k++) {
            var nx = x + this.neigh[k][0], ny = y + this.neigh[k][1], n = this.get(nx, ny);
            if (n === P_WATER) { this.set(nx, ny, P_STEAM); this.grid[i] = P_STONE; return; }
            if (P_BURNS[n] && Math.random() < 0.2) this.set(nx, ny, P_FIRE);
        }
    },
    wet: function(x, y, i) {         // water puts fire out
        for (let k = 0; k < 4; k++) { var nx = x + this.neigh[k][0], ny = y + this.neigh[k][1]; if (this.get(nx, ny) === P_FIRE) { this.set(nx, ny, P_STEAM); return; } }
    },
    burn: function(x, y, i) {
        for (let k = 0; k < 4; k++) {
            var nx = x + this.neigh[k][0], ny = y + this.neigh[k][1], n = this.get(nx, ny);
            if (P_BURNS[n] && Math.random() < P_BURNS[n] * 6) this.set(nx, ny, P_FIRE);
            else if (n === P_WATER && Math.random() < 0.3) { this.grid[i] = P_STEAM; this.life[i] = 40; return; }
        }
    },

    paint: function(cx, cy, v) {
        var r = this.brush;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            var x = cx + dx, y = cy + dy;
            if (x < 0 || y < 0 || x >= PW.W || y >= PW.H) continue;
            var cur = this.grid[y * PW.W + x];
            // powders and liquids go in as a sprinkle so piles look natural; solids and the eraser fill solid
            if (v !== P_EMPTY && v !== P_WALL && v !== P_WOOD && v !== P_PLANT && Math.random() < 0.55) continue;
            if (v === P_EMPTY || cur === P_EMPTY || v === P_WALL) this.set(x, y, v);
        }
    },

    // screen <-> grid
    layout: function() {
        var top = 70, bottom = 96, s = Math.max(1, Math.min((cssW - 40) / PW.W, (cssH - top - bottom) / PW.H));
        this.view = { s: s, x: Math.round((cssW - PW.W * s) / 2), y: top };
        return this.view;
    },
    toGrid: function(sx, sy) { var v = this.view; return [Math.floor((sx - v.x) / v.s), Math.floor((sy - v.y) / v.s)]; },

    render: function() {
        var d = this.img.data, g = this.grid, sh = this.shade, t = this.t;
        this.counts = new Array(PM.length).fill(0);
        for (let i = 0; i < g.length; i++) {
            var c = g[i], col = PM[c].col, o = i * 4, j = sh[i];
            this.counts[c]++;
            if (c === P_EMPTY) { d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; continue; }
            if (c === P_FIRE || c === P_LAVA) j = ((j + t * 3 + i) % 40);          // flicker
            if (c === P_WATER) j = (j + ((t >> 3) + i) % 6) | 0;
            d[o] = Math.min(255, col[0] + j - 8); d[o + 1] = Math.min(255, col[1] + j - 8); d[o + 2] = Math.min(255, col[2] + j - 8); d[o + 3] = 255;
        }
        this.cvs.getContext("2d").putImageData(this.img, 0, 0);
        var v = this.layout();
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#05080d"; ctx.fillRect(0, 0, cssW, cssH);
        ctx.drawImage(this.cvs, v.x, v.y, PW.W * v.s, PW.H * v.s);
        ctx.strokeStyle = "#334155"; ctx.lineWidth = 2; ctx.strokeRect(v.x - 1, v.y - 1, PW.W * v.s + 2, PW.H * v.s + 2);
        // brush outline
        var gp = this.toGrid(mouseX, mouseY);
        if (gp[0] >= 0 && gp[1] >= 0 && gp[0] < PW.W && gp[1] < PW.H) {
            ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(v.x + (gp[0] + 0.5) * v.s, v.y + (gp[1] + 0.5) * v.s, this.brush * v.s, 0, 7); ctx.stroke();
        }
        ctx.restore();
    },

    palette: function() {
        var n = PM.length, bw = Math.min(92, (cssW - 40) / n - 6), x0 = cssW / 2 - (n * (bw + 6)) / 2, y0 = cssH - 84;
        this.palRects = [];
        for (let k = 0; k < n; k++) {
            var i = (k + 1) % n, m = PM[i], bx = x0 + k * (bw + 6), on = i === this.sel;      // eraser last
            ctx.fillStyle = "rgb(" + m.col.join(",") + ")"; ctx.fillRect(bx, y0, bw, 30);
            ctx.strokeStyle = on ? "#fde047" : "#1e293b"; ctx.lineWidth = on ? 3 : 2; ctx.strokeRect(bx, y0, bw, 30);
            uiText((i === P_EMPTY ? "E" : String((k + 1) % 10)) + " " + m.name, bx + bw / 2, y0 + 46, 11, on ? "#fde047" : "#94a3b8", "center", "800");
            this.palRects.push([bx, y0, bw, 52, i]);
        }
    }
};

ModeKit.addLevel("powder_lab", { name: "🏖 Sand Lab", mode: "powder", wavesEnabled: false, spawnP1: [0, 60], spawnP2: [60, 60], layout: ModeKit.room(-600, 600, 800, {}), title: "Sand Lab" });

GameModes.register({
    id: "powder",
    title: "SAND LAB",
    tagline: "Falling-sand toy: sand, water, fire, oil, plants, lava, steam. Paint and watch it react.",
    color: "#d6ba70",
    firstLevel: "powder_lab",
    flags: { ownScreen: true, waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, scenery: false, coopToggle: false },
    overTitle: "SAND LAB",

    setupLevel: function() { if (!Powder.grid) Powder.init(); },

    screenDraw: function() { Powder.t++; Powder.render(); this.hudBits(true); },
    netInput: function() {
        var gp = Powder.toGrid(mouseX, mouseY);
        return { gx: gp[0], gy: gp[1], m: Powder.sel, b: Powder.brush, p: mouseDown ? 1 : 0, e: rightMouseDown ? 1 : 0 };
    },
    netState: function() {
        Powder.netTick = (Powder.netTick || 0) + 1;
        if (Powder.netTick % 2) return null;                       // the grid every other snapshot (~15 Hz) is plenty
        var g = Powder.grid, out = [], v = g[0], n = 0;
        for (let i = 0; i < g.length; i++) { if (g[i] === v && n < 60000) n++; else { out.push(v, n); v = g[i]; n = 1; } }
        out.push(v, n);
        return { r: out };
    },
    applyNetState: function(m) {
        if (!m || !m.r) return;
        if (!Powder.grid) Powder.init();
        var g = Powder.grid, k = 0;
        for (let i = 0; i < m.r.length; i += 2) { g.fill(m.r[i], k, k + m.r[i + 1]); k += m.r[i + 1]; }
    },
    hudBits: function(client) {
        uiPanel(14, 10, 430, 50, "#d6ba70");
        uiText("SAND LAB" + (client ? "  ·  LAN" : ""), 30, 42, 22, "#fde68a", "left", "900");
        Powder.palette();
        uiText("Left paint · right erase · wheel / [ ] brush " + Powder.brush + " · 1-0 material · E eraser" + (client ? " · you're painting in the host's box" : " · Space pause · F fast · C clear · S save · L load") + " · Esc menu", cssW / 2, cssH - 14, 12, "rgba(220,230,240,0.7)", "center", "700");
    },
    screenFrame: function() {
        // LAN painters (host side): each paints with their own material and brush
        if (typeof Net !== "undefined" && Net.role === "host") Net.peerList().forEach(function(p) {
            var x = (p.inp && p.inp.x) || {};
            if (!x.p && !x.e) return;
            var keep = Powder.brush; Powder.brush = Math.max(1, Math.min(20, x.b || 4));
            Powder.paint(x.gx, x.gy, x.e ? P_EMPTY : Math.max(0, Math.min(PM.length - 1, x.m | 0)));
            Powder.brush = keep;
        });
        // paint while the mouse is held (left = material, right = erase)
        var gp = Powder.toGrid(mouseX, mouseY);
        if (Powder.palDown) Powder.palDown = mouseDown;
        else if (mouseDown) Powder.paint(gp[0], gp[1], Powder.sel);
        if (rightMouseDown) Powder.paint(gp[0], gp[1], P_EMPTY);
        if (!Powder.paused) { Powder.step(); if (Powder.fast) Powder.step(); }
        Powder.render();
        uiPanel(14, 10, 430, 50, "#d6ba70");
        uiText("SAND LAB", 30, 42, 22, "#fde68a", "left", "900");
        var shown = 0, info = "";
        for (let i = 1; i < PM.length; i++) if (Powder.counts[i] && shown < 4 && i !== P_WALL) { info += PM[i].name + " " + Powder.counts[i] + "  "; shown++; }
        uiText(info, 150, 40, 11, "#94a3b8", "left", "700");
        if (Powder.paused) uiText("⏸ PAUSED (Space)", cssW - 24, 42, 16, "#fde047", "right", "900");
        Powder.palette();
        uiText("Left paint · right erase · wheel / [ ] brush " + Powder.brush + " · 1-0 material · E eraser · Space pause · F fast · C clear · S save · L load · Esc menu", cssW / 2, cssH - 14, 12, "rgba(220,230,240,0.7)", "center", "700");
    },

    onClick: function(wx, wy, button) {
        if (button === 2) { rightMouseDown = true; return true; }
        var r = Powder.palRects || [];
        for (let k = 0; k < r.length; k++) if (mouseX >= r[k][0] && mouseX <= r[k][0] + r[k][2] && mouseY >= r[k][1] && mouseY <= r[k][1] + r[k][3]) { Powder.sel = r[k][4]; Powder.palDown = true; return true; }
        return true;
    },

    onKey: function(code) {
        for (let i = 1; i < PM.length; i++) if (PM[i].key === code) { Powder.sel = i; return true; }
        if (code === "Space") { Powder.paused = !Powder.paused; return true; }
        if (code === "KeyF") { Powder.fast = !Powder.fast; return true; }
        if (code === "BracketLeft") { Powder.brush = Math.max(1, Powder.brush - 1); return true; }
        if (code === "BracketRight") { Powder.brush = Math.min(20, Powder.brush + 1); return true; }
        if (code === "KeyE") { Powder.sel = P_EMPTY; return true; }
        if (code === "KeyC") { Powder.grid.fill(0); Powder.life.fill(0); return true; }
        if (code === "KeyS") {
            try { localStorage.setItem("timsSandLab", Array.prototype.map.call(Powder.grid, function(v) { return String.fromCharCode(48 + v); }).join("")); showBanner("SAVED", "L loads it back", "#86efac"); }
            catch (e) { showBanner("Couldn't save", "", "#f87171"); }
            return true;
        }
        if (code === "KeyL") {
            try {
                var sv = localStorage.getItem("timsSandLab");
                if (sv && sv.length === Powder.grid.length) { for (let i = 0; i < sv.length; i++) Powder.grid[i] = Math.min(PM.length - 1, sv.charCodeAt(i) - 48); Powder.life.fill(0); showBanner("LOADED", "", "#86efac"); }
                else showBanner("Nothing saved yet", "S saves the box", "#fca5a5");
            } catch (e) {}
            return true;
        }
        if (code === "KeyR") { Powder.grid = null; Powder.init(); return true; }
        return false;
    },

    menuItems: function(items) {
        items.push({ id: "pw_clear", label: "Clear the box (C)", hint: "" });
        items.push({ id: "pw_reset", label: "Starter scene (R)", hint: "" });
    },
    onMenu: function(id) {
        if (id === "pw_clear") { closePause(); this.onKey("KeyC"); return true; }
        if (id === "pw_reset") { closePause(); this.onKey("KeyR"); return true; }
        return false;
    },
    onRestart: function() { this.onKey("KeyR"); },
    overSub: function() { return "Falling-sand toy"; }
});

// mouse wheel = brush size while Sand Lab is on
(function() {
    var cv = typeof canvas !== "undefined" ? canvas : document.querySelector("canvas");
    if (!cv) return;
    cv.addEventListener("wheel", function(e) {
        if (!GameModes.current || GameModes.current.id !== "powder" || paused) return;
        Powder.brush = Math.max(1, Math.min(20, Powder.brush + (e.deltaY > 0 ? -1 : 1)));
        e.preventDefault();
    }, { passive: false });
})();
