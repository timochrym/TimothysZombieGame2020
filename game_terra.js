// ============================================================================
// GAME: TERRA  (terra)  -  dig, mine and build in a deep generated world
//   A seeded tile world: forest / desert / hill biomes with trees on top, dirt over stone, winding caves,
//   coal, iron and gold deeper down, bedrock at the bottom. Left mouse (or F) mines the tile you point at,
//   right mouse (or G) places the block picked in the hotbar (1-9). New world: N.
//   Only the tiles near the camera exist as collision boxes (merged into runs), so the world can be huge.
// ============================================================================
var TERRA = {
    T: 40, W: 640, H: 170, TOP: 2400,               // tile size, columns, rows, world y of row 0's top edge
    grid: null, seed: 1, chunks: {}, CH: 16, inv: {}, sel: 0, mineT: 0, mineAt: null, surface: [], tick: 0
};
// id: [name, color, solid, hardness (frames to mine), drop]
var TILES = [
    ["air", null, false, 0],
    ["dirt", "#7c4a26", true, 18, "dirt"],
    ["grass", "#4f8a33", true, 18, "dirt"],
    ["stone", "#6b7280", true, 40, "stone"],
    ["coal", "#374151", true, 45, "coal"],
    ["iron", "#b08968", true, 60, "iron"],
    ["gold", "#d4a017", true, 75, "gold"],
    ["wood", "#8b5a2b", false, 20, "wood"],
    ["leaves", "#3f7d2b", false, 6, null],
    ["sand", "#d6c27a", true, 14, "sand"],
    ["bedrock", "#1f2937", true, 99999, null],
    ["planks", "#b07a3c", true, 22, "planks"],
    ["brick", "#9e3b24", true, 45, "brick"]
];
var TERRA_PLACEABLE = ["dirt", "stone", "sand", "planks", "brick", "wood", "coal", "iron", "gold"];
var TILE_ID = {}; TILES.forEach(function(t, i) { TILE_ID[t[0]] = i; });

// ---------------------------------------------------------------- deterministic noise
function terraHash(x, y) { var n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(TERRA.seed, 2147483647); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
function terraNoise1(x, s) { var i = Math.floor(x / s), f = x / s - i; f = f * f * (3 - 2 * f); var a = terraHash(i, 7), b = terraHash(i + 1, 7); return a + (b - a) * f; }
function terraNoise2(x, y, s) {
    var ix = Math.floor(x / s), iy = Math.floor(y / s), fx = x / s - ix, fy = y / s - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = terraHash(ix, iy), b = terraHash(ix + 1, iy), c = terraHash(ix, iy + 1), d = terraHash(ix + 1, iy + 1);
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

function terraGenerate(seed) {
    var Tr = TERRA;
    Tr.seed = seed || (1 + Math.floor(Math.random() * 99999));
    var W = Tr.W, H = Tr.H, g = new Uint8Array(W * H);
    Tr.surface = [];
    for (let c = 0; c < W; c++) {
        var biome = terraNoise1(c, 90);                                   // <0.35 desert, >0.7 hills, else forest
        var hills = biome > 0.7 ? 1.8 : 1;
        var h = 60 + (terraNoise1(c, 40) - 0.5) * 18 * hills + (terraNoise1(c, 12) - 0.5) * 6;
        var s = Math.round(h);
        Tr.surface[c] = s;
        var desert = biome < 0.35;
        var dirtDepth = 5 + Math.round(terraNoise1(c, 17) * 6);
        for (let r = s; r < H; r++) {
            var t;
            if (r >= H - 3) t = TILE_ID.bedrock;
            else if (r === s) t = desert ? TILE_ID.sand : TILE_ID.grass;
            else if (r < s + dirtDepth) t = desert ? TILE_ID.sand : TILE_ID.dirt;
            else t = TILE_ID.stone;
            // caves: two noise layers -> winding tunnels, more common deeper
            var depth = r - s;
            if (depth > 4 && r < H - 4) {
                var cv = terraNoise2(c, r * 1.6, 9) * 0.6 + terraNoise2(c + 500, r, 22) * 0.4;
                if (cv > 0.66 - Math.min(0.08, depth / 900)) t = 0;
            }
            if (t === TILE_ID.stone) {
                var o = terraHash(c * 3 + 1, r * 5 + 2);
                if (o < 0.035) t = TILE_ID.coal;
                else if (depth > 25 && o < 0.052) t = TILE_ID.iron;
                else if (depth > 55 && o < 0.062) t = TILE_ID.gold;
            }
            g[r * W + c] = t;
        }
    }
    // trees on forest grass
    for (let c = 3; c < W - 3; c++) {
        var b2 = terraNoise1(c, 90);
        if (b2 < 0.35 || terraHash(c, 99) > 0.12) continue;
        var top = Tr.surface[c];
        if (g[top * W + c] !== TILE_ID.grass) continue;
        var ht = 4 + Math.floor(terraHash(c, 3) * 4);
        for (let k = 1; k <= ht; k++) if (top - k >= 0) g[(top - k) * W + c] = TILE_ID.wood;
        for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
            var rr = top - ht + dy, cc = c + dx;
            if (rr >= 0 && cc >= 0 && cc < W && g[rr * W + cc] === 0 && Math.abs(dx) + Math.abs(dy) < 4) g[rr * W + cc] = TILE_ID.leaves;
        }
        c += 3;
    }
    Tr.grid = g;
    Tr.chunks = {};
}

function terraGet(c, r) { var Tr = TERRA; if (c < 0 || r < 0 || c >= Tr.W || r >= Tr.H) return TILE_ID.bedrock; return Tr.grid[r * Tr.W + c]; }
function terraCX(c) { return (c - TERRA.W / 2) * TERRA.T + TERRA.T / 2; }
function terraCY(r) { return TERRA.TOP - r * TERRA.T - TERRA.T / 2; }
function terraCol(x) { return Math.floor(x / TERRA.T + TERRA.W / 2); }
function terraRow(y) { return Math.floor((TERRA.TOP - y) / TERRA.T); }

// ---------------------------------------------------------------- collision chunks (only near the camera)
function terraBuildChunk(k) {
    var Tr = TERRA, out = [];
    var c0 = k * Tr.CH, c1 = Math.min(Tr.W, c0 + Tr.CH);
    for (let r = 0; r < Tr.H; r++) {
        var start = -1;
        for (let c = c0; c <= c1; c++) {
            var solid = c < c1 && TILES[terraGet(c, r)][2];
            if (solid && start < 0) start = c;
            if (!solid && start >= 0) {
                var w = (c - start) * Tr.T;
                var o = Object.addBox((terraCX(start) + terraCX(c - 1)) / 2, terraCY(r), w, Tr.T, "#000", { name: "Terrain", kind: "block", texture: "solid" });
                o.invisible = true; o.terraChunk = k;
                out.push(o);
                start = -1;
            }
        }
    }
    Tr.chunks[k] = out;
}

function terraDropChunk(k) {
    var list = TERRA.chunks[k];
    if (!list) return;
    var set = new Set(list);
    staticObjects = staticObjects.filter(function(o) { return !set.has(o); });
    delete TERRA.chunks[k];
}

function terraStream(force) {
    var Tr = TERRA;
    var cx = (typeof cameraTargetX !== "undefined") ? cameraTargetX : 0;
    var span = Math.max(1600, (cssW / Math.max(0.2, cameraScaleX)) * 0.75);
    var k0 = Math.max(0, Math.floor(terraCol(cx - span) / Tr.CH)), k1 = Math.min(Math.ceil(Tr.W / Tr.CH) - 1, Math.floor(terraCol(cx + span) / Tr.CH));
    var changed = false;
    for (var k in Tr.chunks) { k = Number(k); if (k < k0 - 1 || k > k1 + 1) { terraDropChunk(k); changed = true; } }
    for (let k = k0; k <= k1; k++) if (!Tr.chunks[k] || force === k) { if (Tr.chunks[k]) terraDropChunk(k); terraBuildChunk(k); changed = true; }
    if (changed && typeof rebuildAllObjects === "function") rebuildAllObjects();
}

function terraSet(c, r, t) {
    var Tr = TERRA;
    if (c < 0 || r < 0 || c >= Tr.W || r >= Tr.H) return;
    Tr.grid[r * Tr.W + c] = t;
    var k = Math.floor(c / Tr.CH);
    if (Tr.chunks[k]) terraStream(k);
}

// ---------------------------------------------------------------- the mode
GameModes.register({
    id: "terra",
    title: "TERRA",
    tagline: "Dig, mine and build in a deep generated world: biomes, caves, ores, trees.",
    color: "#84cc16",
    firstLevel: "terra_world",
    flags: { waves: false, revive: false, jetpack: true, shooting: false, ability: false, ammo: false, noBedrock: true, scenery: false,
        coopToggle: true, dash: true, wallJump: true, airJumps: 1, deepWorld: true },
    overTitle: "TERRA",

    setupLevel: function() {
        if (!TERRA.grid) terraGenerate(TERRA.seed > 1 ? TERRA.seed : 0);
        TERRA.chunks = {};
        TERRA.inv = TERRA.inv && window.Object.keys(TERRA.inv).length ? TERRA.inv : { dirt: 20, planks: 20 };
        var c = Math.floor(TERRA.W / 2);
        cameraTargetX = terraCX(c); cameraTargetY = terraCY(TERRA.surface[c]);
        terraStream();
    },

    createPlayers: function() {
        var c = Math.floor(TERRA.W / 2), y = terraCY(TERRA.surface[c]) + 100;
        ModeKit.makeHero(0, terraCX(c), y);
        if (multiplayer) ModeKit.makeHero(1, terraCX(c) + 80, y); else blueGuy = null;
    },

    canShoot: function() { return false; },
    onPad: function(i, b) { if (b === 8 && i === 0) { TERRA.sel = (TERRA.sel + 1) % TERRA_PLACEABLE.length; return true; } return false; },

    onKey: function(code) {
        var m = /^Digit([1-9])$/.exec(code);
        if (m) { TERRA.sel = Number(m[1]) - 1; return true; }
        if (code === "KeyN") { terraGenerate(0); LevelManager.selectLevel("terra_world"); return true; }
        return false;
    },

    // right-click: place a block
    onSecondary: function(ch) { this.placeAt(ch); return true; },
    onClick: function(wx, wy, button) { if (button === 2) { this.placeAt(redGuy, wx, wy); return true; } return false; },

    // the tile a hero is working on: the one under the mouse, or (keys / gamepad) the first solid tile along the aim;
    // `place` asks for the empty tile just before it instead
    target: function(ch, wx, wy, place) {
        if (wx === undefined) {
            if (ch.playerIndex === 0 && typeof useMouseAim !== "undefined" && useMouseAim) { var m = Components.getMouseWorldPos(); wx = m[0]; wy = m[1]; }
            else {
                var rad = Math.radians(ch.degree || 90), sx = Math.sin(rad), sy = Math.cos(rad), last = null;
                for (let d = 20; d <= 220; d += 10) {
                    var px = ch.x + sx * d, py = ch.y + sy * d, cc = terraCol(px), rr = terraRow(py);
                    var id = terraGet(cc, rr);
                    if (id && TILES[id][2] !== undefined && id !== 0) { if (place && last) { wx = terraCX(last[0]); wy = terraCY(last[1]); } else { wx = px; wy = py; } break; }
                    var inside = Math.abs(px - ch.x) < ch.s1 / 2 + 2 && Math.abs(py - ch.y) < ch.s2 / 2 + 2;
                    if (!inside) last = [cc, rr];
                }
                if (wx === undefined) { if (place && last) { wx = terraCX(last[0]); wy = terraCY(last[1]); } else { wx = ch.x + sx * 70; wy = ch.y + sy * 70; } }
            }
        }
        var c = terraCol(wx), r = terraRow(wy);
        var reach = Math.hypot(terraCX(c) - ch.x, terraCY(r) - ch.y) < 260;
        return { c: c, r: r, ok: reach };
    },

    placeAt: function(ch, wx, wy) {
        if (!ch || ch.dead) return;
        var t = this.target(ch, wx, wy, true), name = TERRA_PLACEABLE[TERRA.sel];
        if (!t.ok || terraGet(t.c, t.r) !== 0 || !(TERRA.inv[name] > 0)) return;
        var bx = terraCX(t.c), by = terraCY(t.r);
        for (let i = 0; i < characters.length; i++) { var h = characters[i]; if (Math.abs(h.x - bx) < (h.s1 + TERRA.T) / 2 - 2 && Math.abs(h.y - by) < (h.s2 + TERRA.T) / 2 - 2) return; }
        TERRA.inv[name]--;
        terraSet(t.c, t.r, TILE_ID[name]);
        if (typeof SFX !== "undefined") SFX.play("select", bx, by, 0.4, 0.9);
    },

    preUpdate: function() {
        TERRA.tick++;
        if (TERRA.tick % 20 === 0) terraStream();
        // mining: hold the shoot button / left mouse
        var ch = redGuy;
        if (!ch || ch.dead) return;
        var want = mouseDown || (PlayerInput[0] && (PlayerInput[0].kbShoot || PlayerInput[0].shoot));
        if (!want) { TERRA.mineT = 0; TERRA.mineAt = null; return; }
        var t = this.target(ch);
        var id = terraGet(t.c, t.r);
        if (!t.ok || id === 0 || id === TILE_ID.bedrock) { TERRA.mineT = 0; TERRA.mineAt = null; return; }
        var key = t.c + "," + t.r;
        if (TERRA.mineAt !== key) { TERRA.mineAt = key; TERRA.mineT = 0; }
        TERRA.mineT++;
        if (TERRA.mineT % 8 === 0 && typeof SFX !== "undefined") SFX.play("ui", terraCX(t.c), terraCY(t.r), 0.2, 0.6);
        if (TERRA.mineT >= TILES[id][3]) {
            var drop = TILES[id][4];
            if (drop) TERRA.inv[drop] = (TERRA.inv[drop] || 0) + 1;
            terraSet(t.c, t.r, 0);
            Components.spawnSparks(terraCX(t.c), terraCY(t.r), TILES[id][1], 4);
            if (drop) Components.addFloatingText("+1 " + drop, terraCX(t.c), terraCY(t.r) + 40, "#e2e8f0", 13);
            TERRA.mineT = 0; TERRA.mineAt = null;
        }
    },

    drawWorld: function() {
        var Tr = TERRA, T = Tr.T, k = cameraScaleX;
        var l = (0 - xc) / k, r = (cssW - xc) / k, top = yc / k, bot = (yc - cssH) / k;
        var c0 = Math.max(0, terraCol(l) - 1), c1 = Math.min(Tr.W - 1, terraCol(r) + 1);
        var r0 = Math.max(0, terraRow(top) - 1), r1 = Math.min(Tr.H - 1, terraRow(bot) + 1);
        var sz = T * k + 0.6;
        for (let rr = r0; rr <= r1; rr++) {
            var sy = wsy(terraCY(rr) + T / 2);
            for (let cc = c0; cc <= c1; cc++) {
                var id = Tr.grid[rr * Tr.W + cc];
                if (!id) {
                    // cave background below the surface
                    if (rr > Tr.surface[cc] + 1) { ctx.fillStyle = "#1c1917"; ctx.fillRect(wsx(terraCX(cc) - T / 2), sy, sz, sz); }
                    continue;
                }
                var t = TILES[id];
                ctx.fillStyle = t[1];
                var sx = wsx(terraCX(cc) - T / 2);
                ctx.fillRect(sx, sy, sz, sz);
                // a little texture: lighter top edge, ore flecks, depth darkening
                if (k > 0.25) {
                    if (id === TILE_ID.grass) { ctx.fillStyle = "#6fbf4a"; ctx.fillRect(sx, sy, sz, sz * 0.25); }
                    else if (id >= TILE_ID.coal && id <= TILE_ID.gold) { ctx.fillStyle = id === TILE_ID.coal ? "#111827" : (id === TILE_ID.iron ? "#e7c9a9" : "#fde047"); ctx.fillRect(sx + sz * 0.2, sy + sz * 0.25, sz * 0.22, sz * 0.22); ctx.fillRect(sx + sz * 0.58, sy + sz * 0.55, sz * 0.2, sz * 0.2); }
                    else if (id === TILE_ID.planks || id === TILE_ID.brick) { ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(sx, sy + sz * 0.48, sz, 1.5); }
                }
                var depth = rr - Tr.surface[cc];
                if (depth > 6) { ctx.fillStyle = "rgba(0,0,0," + Math.min(0.55, (depth - 6) * 0.012).toFixed(3) + ")"; ctx.fillRect(sx, sy, sz, sz); }
            }
        }
        // mining crack + target outline
        var ch = redGuy;
        if (ch && !ch.dead) {
            var tg = this.target(ch);
            var ox = wsx(terraCX(tg.c) - T / 2), oy = wsy(terraCY(tg.r) + T / 2);
            ctx.strokeStyle = tg.ok ? "rgba(255,255,255,0.7)" : "rgba(248,113,113,0.5)"; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, sz, sz);
            if (TERRA.mineAt && TERRA.mineT > 0) {
                var id2 = terraGet(tg.c, tg.r), f = Math.min(1, TERRA.mineT / Math.max(1, TILES[id2][3]));
                ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.beginPath(); ctx.moveTo(ox + sz * 0.5, oy); ctx.lineTo(ox + sz * (0.5 - f * 0.3), oy + sz * f); ctx.moveTo(ox + sz * 0.5, oy + sz * 0.3); ctx.lineTo(ox + sz * (0.5 + f * 0.4), oy + sz * (0.3 + f * 0.6)); ctx.stroke();
            }
        }
    },

    drawFront: function() {
        // underground darkness with a light around each hero
        var Tr = TERRA, ch = redGuy;
        if (!ch) return;
        var depth = terraRow(ch.y) - Tr.surface[Math.max(0, Math.min(Tr.W - 1, terraCol(ch.x)))];
        if (depth < 6) return;
        var a = Math.min(0.72, (depth - 6) * 0.03);
        var g = ctx.createRadialGradient(wsx(ch.x), wsy(ch.y), 60, wsx(ch.x), wsy(ch.y), 420 * cameraScaleX + 120);
        g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0," + a.toFixed(2) + ")");
        ctx.fillStyle = g; ctx.fillRect(0, 0, cssW, cssH);
    },

    drawHUD: function() {
        var Tr = TERRA, ch = redGuy;
        uiPanel(14, 14, 340, 60, "#84cc16");
        uiText("TERRA", 30, 42, 22, "#bef264", "left", "900");
        var depth = ch ? Math.max(0, terraRow(ch.y) - Tr.surface[Math.max(0, Math.min(Tr.W - 1, terraCol(ch.x)))]) : 0;
        uiText("seed " + Tr.seed + "   depth " + depth + " m   N new world", 30, 64, 12, "#d9f99d", "left", "700");
        var n = TERRA_PLACEABLE.length, bw = 58, x0 = cssW / 2 - n * (bw + 6) / 2, y0 = cssH - 88;
        for (let i = 0; i < n; i++) {
            var name = TERRA_PLACEABLE[i], col = TILES[TILE_ID[name]][1], bx = x0 + i * (bw + 6), on = i === Tr.sel;
            ctx.fillStyle = on ? "rgba(132,204,22,0.3)" : "rgba(15,23,42,0.85)"; ctx.fillRect(bx, y0, bw, 50);
            ctx.strokeStyle = on ? "#bef264" : "#475569"; ctx.lineWidth = 2; ctx.strokeRect(bx, y0, bw, 50);
            ctx.fillStyle = col; ctx.fillRect(bx + 17, y0 + 8, 24, 24);
            uiText((i + 1) + " " + name + " ×" + (Tr.inv[name] || 0), bx + bw / 2, y0 + 45, 9, on ? "#ecfccb" : "#94a3b8", "center", "800");
        }
        uiText("Left mouse / F mine · right mouse / G place · 1-9 pick block · Space jetpack · N new world · Esc menu", cssW / 2, cssH - 16, 12, "rgba(220,230,240,0.75)", "center", "700");
    }
});

ModeKit.addLevel("terra_world", { name: "⛏ Terra: Generated World", mode: "terra", wavesEnabled: false, spawnP1: [0, 200], spawnP2: [80, 200], layout: [], title: "Generated World" });
