// ============================================================================
// GAME: TERRA  (terra)  -  dig, mine and build in a deep generated world
//   A seeded tile world: forest / desert / hill biomes with trees on top, dirt over stone, winding caves,
//   coal, iron and gold deeper down, bedrock at the bottom. Left mouse (or F) mines the tile you point at,
//   right mouse (or G) places the block picked in the hotbar (1-9). New world: N.
//   Only the tiles near the camera exist as collision boxes (merged into runs), so the world can be huge.
// ============================================================================
var TERRA = {
    T: 40, W: 640, H: 220, TOP: 2400,               // tile size, columns, rows, world y of row 0's top edge
    grid: null, seed: 1, chunks: {}, CH: 16, inv: {}, sel: 0, mineT: 0, mineAt: null, surface: [], tick: 0,
    creative: false, tool: 0, time: 0.3, DAY: 60 * 240, panel: null, torches: null
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
    ["brick", "#9e3b24", true, 45, "brick"],
    ["workbench", "#8b5a2b", false, 20, "workbench"],
    ["torch", "#fbbf24", false, 4, "torch"],
    ["crystal", "#a78bfa", true, 70, "crystal"],
    ["deepstone", "#3f3f55", true, 55, "stone"]
];
// pickaxe tier needed per tile (0 = hands) and the tool table: [name, mining speed multiplier]
var TERRA_NEED = { stone: 1, coal: 1, brick: 1, iron: 2, gold: 3, crystal: 3, deepstone: 2 };
var TERRA_TOOLS = [["hands", 1.7], ["wooden pickaxe", 1], ["stone pickaxe", 0.7], ["iron pickaxe", 0.5], ["gold pickaxe", 0.33]];
// recipes: [label, gives {item: n} or {tool: tier}, cost {item: n}, needs a workbench nearby]
var TERRA_RECIPES = [
    ["4 planks", { planks: 4 }, { wood: 1 }, false],
    ["Workbench", { workbench: 1 }, { planks: 6 }, false],
    ["4 torches", { torch: 4 }, { wood: 1, coal: 1 }, false],
    ["Wooden pickaxe", { tool: 1 }, { planks: 5 }, true],
    ["Stone pickaxe", { tool: 2 }, { planks: 2, stone: 6 }, true],
    ["Iron pickaxe", { tool: 3 }, { planks: 2, iron: 5 }, true],
    ["Gold pickaxe", { tool: 4 }, { planks: 2, gold: 5, crystal: 1 }, true],
    ["2 bricks", { brick: 2 }, { stone: 2 }, true]
];
// texture per tile id (textures.js)
var TERRA_TEX = [null, "tex_dirt", "grass_top", "stone_raw", "ore_coal", "ore_iron", "ore_gold", "log", "leaves", "sand", "bedrock", "wood_plank", "brick", "wood_plank", null, null, "bedrock"];
var TERRA_PLACEABLE = ["dirt", "stone", "sand", "planks", "brick", "wood", "torch", "workbench", "coal", "iron", "gold"];
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
            if (t === TILE_ID.stone && depth > 90) t = TILE_ID.deepstone;          // the deep layer: darker, harder rock
            g[r * W + c] = t;
        }
    }
    // ore veins: seed points that grow into blobs (coal shallow, iron mid, gold deep, crystal in the deep layer)
    var vein = function(id, count, minD, size) {
        for (let n = 0; n < count; n++) {
            var c = Math.floor(terraHash(n * 7 + id, 11) * W), r = Tr.surface[c] + minD + Math.floor(terraHash(n * 13 + id, 5) * (H - 6 - Tr.surface[c] - minD));
            var len = size + Math.floor(terraHash(n, id) * size);
            for (let k = 0; k < len; k++) {
                if (r > 0 && r < H - 4 && c > 0 && c < W - 1) { var cur = g[r * W + c]; if (cur === TILE_ID.stone || cur === TILE_ID.deepstone) g[r * W + c] = id; }
                var d = terraHash(n * 31 + k, id * 3);
                if (d < 0.25) c++; else if (d < 0.5) c--; else if (d < 0.75) r++; else r--;
            }
        }
    };
    vein(TILE_ID.coal, 260, 4, 6); vein(TILE_ID.iron, 170, 22, 5); vein(TILE_ID.gold, 90, 50, 4); vein(TILE_ID.crystal, 70, 92, 4);
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
    Tr.ver = (Tr.ver || 0) + 1;                    // LAN: the grid changed, send it again
    var k = Math.floor(c / Tr.CH);
    if (Tr.chunks[k]) terraStream(k);
}

// ---------------------------------------------------------------- crafting / tools / saving
function terraHas(cost) { for (var k in cost) if ((TERRA.inv[k] || 0) < cost[k]) return false; return true; }
function terraNearBench(ch) {
    var c0 = terraCol(ch.x), r0 = terraRow(ch.y);
    for (let dr = -4; dr <= 4; dr++) for (let dc = -5; dc <= 5; dc++) if (terraGet(c0 + dc, r0 + dr) === TILE_ID.workbench) return true;
    return false;
}
function terraCraft(i) {
    var R = TERRA_RECIPES[i], ch = redGuy;
    if (!R || !ch) return;
    if (R[3] && !terraNearBench(ch)) { Components.addFloatingText("Needs a workbench nearby", ch.x, ch.y + 110, "#fca5a5", 15); return; }
    if (R[1].tool !== undefined && TERRA.tool >= R[1].tool) { Components.addFloatingText("You already have a better pickaxe", ch.x, ch.y + 110, "#fca5a5", 15); return; }
    if (!terraHas(R[2])) { Components.addFloatingText("Missing materials", ch.x, ch.y + 110, "#fca5a5", 15); return; }
    for (var k in R[2]) TERRA.inv[k] -= R[2][k];
    if (R[1].tool !== undefined) TERRA.tool = R[1].tool; else for (var g in R[1]) TERRA.inv[g] = (TERRA.inv[g] || 0) + R[1][g];
    Components.addFloatingText("Crafted " + R[0] + "!", ch.x, ch.y + 110, "#bef264", 17);
    if (typeof SFX !== "undefined") SFX.play("pickup");
}
// save / load: the grid is run-length encoded
function terraSave(quiet) {
    try {
        var g = TERRA.grid, out = [], v = g[0], n = 0;
        for (let i = 0; i < g.length; i++) { if (g[i] === v && n < 65000) n++; else { out.push(v, n); v = g[i]; n = 1; } }
        out.push(v, n);
        localStorage.setItem("timsTerraWorld", JSON.stringify({ creative: TERRA.creative, seed: TERRA.seed, W: TERRA.W, H: TERRA.H, g: out, s: TERRA.surface, inv: TERRA.inv, tool: TERRA.tool, time: TERRA.time, x: redGuy ? redGuy.x : 0, y: redGuy ? redGuy.y : 0 }));
        if (!quiet) showBanner("WORLD SAVED", "it also autosaves every minute", "#bef264");
        return true;
    } catch (e) { if (!quiet) showBanner("Couldn't save", "storage full?", "#f87171"); return false; }
}
function terraLoad() {
    try {
        var d = JSON.parse(localStorage.getItem("timsTerraWorld") || "null");
        if (!d || d.W !== TERRA.W || d.H !== TERRA.H) return false;
        var g = new Uint8Array(d.W * d.H), k = 0;
        for (let i = 0; i < d.g.length; i += 2) { g.fill(d.g[i], k, k + d.g[i + 1]); k += d.g[i + 1]; }
        TERRA.creative = !!d.creative; TERRA.grid = g; TERRA.seed = d.seed; TERRA.surface = d.s; TERRA.inv = d.inv || {}; TERRA.tool = d.tool || 0; TERRA.time = d.time || 0.3; TERRA.chunks = {};
        TERRA.loadPos = [d.x, d.y];
        return true;
    } catch (e) { return false; }
}
// light: 1 = full light. sky light by time of day (fading with depth), plus torches and the heroes' own glow
function terraDaylight() { var t = TERRA.time; return Math.max(0.12, Math.min(1, 0.5 + Math.sin((t - 0.25) * Math.PI * 2) * 0.9)); }

// ---------------------------------------------------------------- the mode
GameModes.register({
    id: "terra",
    title: "TERRA",
    tagline: "Dig, mine and build in a deep generated world: biomes, caves, ores, trees.",
    color: "#84cc16",
    firstLevel: "terra_world",
    flags: { waves: false, revive: false, jetpack: true, shooting: false, ability: true, ammo: false, noBedrock: true, scenery: false,
        coopToggle: true, dash: true, wallJump: true, airJumps: 1, deepWorld: true },
    overTitle: "TERRA",
    tunables: function() { return [{ label: "Creative mode", type: "toggle", get: function() { return TERRA.creative; }, set: function(v) { TERRA.creative = v; terraSave(true); }, note: "Free blocks, instant mining, no damage; double-tap jump to fly" }]; },
    menuItems: function(items) { items.push({ id: "terra_creative", label: "Creative mode: " + (TERRA.creative ? "ON" : "OFF"), hint: "Free blocks, instant mining, double-tap jump to fly" }); },
    onMenu: function(id) { if (id !== "terra_creative") return false; TERRA.creative = !TERRA.creative; terraSave(true); return true; },

    setupLevel: function() {
        if (!TERRA.grid && !terraLoad()) terraGenerate(TERRA.seed > 1 ? TERRA.seed : 0);
        TERRA.chunks = {}; TERRA.panel = null;
        TERRA.inv = TERRA.inv && window.Object.keys(TERRA.inv).length ? TERRA.inv : { dirt: 20, planks: 20, torch: 6 };
        var c = Math.floor(TERRA.W / 2);
        cameraTargetX = terraCX(c); cameraTargetY = terraCY(TERRA.surface[c]);
        terraStream();
    },

    createPlayers: function() {
        var c = Math.floor(TERRA.W / 2), y = terraCY(TERRA.surface[c]) + 100, x = terraCX(c);
        if (TERRA.loadPos) { x = TERRA.loadPos[0]; y = TERRA.loadPos[1] + 20; TERRA.loadPos = null; }
        ModeKit.makeHero(0, x, y);
        if (multiplayer) ModeKit.makeHero(1, x + 80, y); else blueGuy = null;
    },
    // no game over: running out of health makes you wake up at the world spawn (inventory kept)
    onDamage: function(ch, amount) {
        if (!ch.isPlayer || amount >= 0) return false;
        if (TERRA.creative || ch.invulnTimer > 0) return true;
        ch.health += amount; ch.hitFlashTimer = 6; ch.invulnTimer = 20;
        if (ch.health <= 0) {
            var c = Math.floor(TERRA.W / 2);
            ch.x = terraCX(c); ch.y = terraCY(TERRA.surface[c]) + 100; ch.xspeed = ch.yspeed = 0; ch.health = ch.maxHealth; ch.invulnTimer = 120;
            showBanner("YOU FAINTED", "you wake up at the world spawn (your stuff is safe)", "#fca5a5");
        }
        return true;
    },

    canShoot: function() { return false; },
    onPad: function(i, b) { if (b === 8 && i === 0) { TERRA.sel = (TERRA.sel + 1) % TERRA_PLACEABLE.length; return true; } return false; },

    onKey: function(code) {
        var m = /^Digit([0-9])$/.exec(code);
        if (m) {
            var n = Number(m[1]) === 0 ? 10 : Number(m[1]);
            if (TERRA.panel === "craft") terraCraft(n - 1); else TERRA.sel = Math.min(TERRA_PLACEABLE.length - 1, n - 1);
            return true;
        }
        if (code === "Minus" && !TERRA.panel) { TERRA.sel = TERRA_PLACEABLE.length - 1; return true; }
        if (code === "KeyC") { TERRA.panel = TERRA.panel === "craft" ? null : "craft"; return true; }
        if (code === "KeyI" || code === "Tab") { TERRA.panel = TERRA.panel === "inv" ? null : "inv"; return true; }
        if (code === "KeyK") { terraSave(false); return true; }
        if (code === "KeyL") { if (terraLoad()) { LevelManager.selectLevel("terra_world"); showBanner("WORLD LOADED", "", "#bef264"); } else showBanner("No saved world", "K saves", "#fca5a5"); return true; }
        if (code === "KeyN") { if (TERRA.panel === "newconfirm") { TERRA.panel = null; terraGenerate(0); TERRA.inv = { dirt: 20, planks: 20, torch: 6 }; TERRA.tool = 0; TERRA.time = 0.3; LevelManager.selectLevel("terra_world"); } else { TERRA.panel = "newconfirm"; } return true; }
        if (TERRA.panel === "newconfirm") TERRA.panel = null;
        return false;
    },

    // right-click: place a block
    onSecondary: function(ch) { this.placeAt(ch); return true; },
    onClick: function(wx, wy, button) {
        if (TERRA.panel === "craft" && button === 0) {
            var R = TERRA.craftRects || [];
            for (let i = 0; i < R.length; i++) if (mouseX >= R[i][0] && mouseX <= R[i][0] + R[i][2] && mouseY >= R[i][1] && mouseY <= R[i][1] + R[i][3]) { terraCraft(R[i][4]); mouseDown = false; return true; }
        }
        if (button === 2) { this.placeAt(redGuy, wx, wy); return true; }
        return false;
    },

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
        if (!t.ok || terraGet(t.c, t.r) !== 0 || (!TERRA.creative && !(TERRA.inv[name] > 0))) return;
        var bx = terraCX(t.c), by = terraCY(t.r);
        for (let i = 0; i < characters.length; i++) { var h = characters[i]; if (Math.abs(h.x - bx) < (h.s1 + TERRA.T) / 2 - 2 && Math.abs(h.y - by) < (h.s2 + TERRA.T) / 2 - 2) return; }
        if (!TERRA.creative) TERRA.inv[name]--;
        terraSet(t.c, t.r, TILE_ID[name]);
        if (typeof SFX !== "undefined") SFX.play("select", bx, by, 0.4, 0.9);
    },

    // LAN players dig with their shoot button (at their own aim) and place with their grab button; shared stash
    lanDig: function() {
        if (typeof Net === "undefined" || Net.role !== "host") return;
        var self = this;
        characters.forEach(function(ch) {
            if (!ch.isRemote || ch.dead) return;
            var p = Net.peers[ch.netPid], i = (p && p.inp) || {};
            if (i.gr !== undefined && i.gr !== ch._terraGr) { if (ch._terraGr !== undefined) self.placeAt(ch, i.ax, i.ay); ch._terraGr = i.gr; }
            if (!i.sh) { ch._mineT = 0; return; }
            var t = self.target(ch, i.ax, i.ay), id = terraGet(t.c, t.r);
            if (!t.ok || !id || id === TILE_ID.bedrock || (!TERRA.creative && TERRA.tool < (TERRA_NEED[TILES[id][0]] || 0))) { ch._mineT = 0; return; }
            var key = t.c + "," + t.r;
            if (ch._mineAt !== key) { ch._mineAt = key; ch._mineT = 0; }
            if (TERRA.creative || ++ch._mineT >= TILES[id][3] * TERRA_TOOLS[TERRA.tool][1]) {
                var drop = TILES[id][4]; if (drop) TERRA.inv[drop] = (TERRA.inv[drop] || 0) + 1;
                terraSet(t.c, t.r, 0); Components.spawnSparks(terraCX(t.c), terraCY(t.r), TILES[id][1], 4); ch._mineT = 0;
            }
        });
    },
    netState: function() {
        var Tr = TERRA, m = { creative: Tr.creative, t: Tr.time, tool: Tr.tool, inv: Tr.inv, sel: Tr.sel };
        Tr.netN = (Tr.netN || 0) + 1;
        if (Tr.sentVer !== Tr.ver || Tr.netN % 90 === 0) {
            Tr.sentVer = Tr.ver;
            var g = Tr.grid, out = [], v = g[0], n = 0;
            for (let i = 0; i < g.length; i++) { if (g[i] === v && n < 65000) n++; else { out.push(v, n); v = g[i]; n = 1; } }
            out.push(v, n);
            m.g = out; m.s = Tr.surface; m.seed = Tr.seed;
        }
        return m;
    },
    applyNetState: function(m) {
        var Tr = TERRA;
        Tr.creative = !!m.creative; Tr.time = m.t; Tr.tool = m.tool; Tr.inv = m.inv; Tr.tick++;
        if (m.g) {
            var g = Tr.grid && Tr.grid.length === Tr.W * Tr.H ? Tr.grid : new Uint8Array(Tr.W * Tr.H), k = 0;
            for (let i = 0; i < m.g.length; i += 2) { g.fill(m.g[i], k, k + m.g[i + 1]); k += m.g[i + 1]; }
            Tr.grid = g; Tr.surface = m.s; Tr.seed = m.seed;
        }
    },
    preUpdate: function() {
        TERRA.tick++;
        this.lanDig();
        if (TERRA.tick % 20 === 0) terraStream();
        TERRA.time = (TERRA.time + 1 / TERRA.DAY) % 1;
        if (TERRA.tick % 3600 === 0) terraSave(true);                      // autosave every minute
        // night: monsters come out on the surface (and go home at dawn)
        var night = terraDaylight() < 0.35, hero = redGuy;
        if (!TERRA.creative && night && hero && !hero.dead && TERRA.tick % 360 === 0 && zombies.filter(function(z) { return !z.dead; }).length < 6) {
            var side = Math.random() < 0.5 ? -1 : 1, zx = hero.x + side * (700 + Math.random() * 400), zc = Math.max(1, Math.min(TERRA.W - 2, terraCol(zx)));
            var z = spawnZombie(Math.random() < 0.3 ? "BAT" : "NORMAL", terraCX(zc), terraCY(TERRA.surface[zc]) + 120);
            if (z) { z.x = terraCX(zc); z.y = terraCY(TERRA.surface[zc]) + 120; z.terraNight = true; }
        }
        if (!night && TERRA.tick % 60 === 0) zombies.forEach(function(z) { if (z.terraNight && !z.dead) { z.dead = true; Components.spawnSparks(z.x, z.y, "#fde68a", 6); } });
        // mining: hold the shoot button / left mouse
        var ch = redGuy;
        if (!ch || ch.dead) return;
        var want = mouseDown || (PlayerInput[0] && (PlayerInput[0].kbShoot || PlayerInput[0].shoot));
        if (!want) { TERRA.mineT = 0; TERRA.mineAt = null; return; }
        var t = this.target(ch);
        var id = terraGet(t.c, t.r);
        if (!t.ok || id === 0 || id === TILE_ID.bedrock) { TERRA.mineT = 0; TERRA.mineAt = null; return; }
        var key = t.c + "," + t.r;
        var need = TERRA_NEED[TILES[id][0]] || 0;
        if (!TERRA.creative && TERRA.tool < need) {
            if (TERRA.mineAt !== key) { TERRA.mineAt = key; TERRA.mineT = 0; Components.addFloatingText("needs a " + TERRA_TOOLS[need][0] + " (C to craft)", terraCX(t.c), terraCY(t.r) + 50, "#fca5a5", 13); }
            return;
        }
        if (TERRA.mineAt !== key) { TERRA.mineAt = key; TERRA.mineT = 0; }
        TERRA.mineT++;
        if (TERRA.mineT % 8 === 0 && typeof SFX !== "undefined") SFX.play("ui", terraCX(t.c), terraCY(t.r), 0.2, 0.6);
        if (TERRA.creative || TERRA.mineT >= TILES[id][3] * TERRA_TOOLS[TERRA.tool][1]) {
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
                var sx = wsx(terraCX(cc) - T / 2);
                if (id === TILE_ID.torch) {
                    if (rr > Tr.surface[cc] + 1) { ctx.fillStyle = "#1c1917"; ctx.fillRect(sx, sy, sz, sz); }
                    ctx.fillStyle = "#8b5a2b"; ctx.fillRect(sx + sz * 0.44, sy + sz * 0.4, sz * 0.12, sz * 0.6);
                    ctx.fillStyle = (Tr.tick >> 3) & 1 ? "#fde047" : "#fb923c"; ctx.beginPath(); ctx.arc(sx + sz * 0.5, sy + sz * 0.33, sz * 0.16, 0, 7); ctx.fill();
                    continue;
                }
                if (id === TILE_ID.workbench) {
                    if (rr > Tr.surface[cc] + 1) { ctx.fillStyle = "#1c1917"; ctx.fillRect(sx, sy, sz, sz); }
                    ctx.fillStyle = "#b07a3c"; ctx.fillRect(sx, sy + sz * 0.2, sz, sz * 0.22); ctx.fillStyle = "#6b4423"; ctx.fillRect(sx + sz * 0.1, sy + sz * 0.42, sz * 0.14, sz * 0.58); ctx.fillRect(sx + sz * 0.76, sy + sz * 0.42, sz * 0.14, sz * 0.58);
                    continue;
                }
                if (id === TILE_ID.crystal) {
                    ctx.fillStyle = "#3f3f55"; ctx.fillRect(sx, sy, sz, sz);
                    ctx.fillStyle = "#c4b5fd"; ctx.beginPath(); ctx.moveTo(sx + sz * 0.3, sy + sz * 0.9); ctx.lineTo(sx + sz * 0.45, sy + sz * 0.15); ctx.lineTo(sx + sz * 0.6, sy + sz * 0.9); ctx.fill();
                    ctx.fillStyle = "#a78bfa"; ctx.beginPath(); ctx.moveTo(sx + sz * 0.55, sy + sz * 0.9); ctx.lineTo(sx + sz * 0.72, sy + sz * 0.35); ctx.lineTo(sx + sz * 0.85, sy + sz * 0.9); ctx.fill();
                    continue;
                }
                var texName = TERRA_TEX[id], tex = texName && TextureManager.canvases ? TextureManager.canvases[texName] : null;
                if (tex && k > 0.15) { ctx.imageSmoothingEnabled = false; ctx.drawImage(tex, sx, sy, sz, sz); }
                else { ctx.fillStyle = t[1]; ctx.fillRect(sx, sy, sz, sz); }
                // flat-colour fallback detail when zoomed far out
                if (!tex && k > 0.25) {
                    if (id === TILE_ID.grass) { ctx.fillStyle = "#6fbf4a"; ctx.fillRect(sx, sy, sz, sz * 0.25); }
                    else if (id >= TILE_ID.coal && id <= TILE_ID.gold) { ctx.fillStyle = id === TILE_ID.coal ? "#111827" : (id === TILE_ID.iron ? "#e7c9a9" : "#fde047"); ctx.fillRect(sx + sz * 0.2, sy + sz * 0.25, sz * 0.22, sz * 0.22); ctx.fillRect(sx + sz * 0.58, sy + sz * 0.55, sz * 0.2, sz * 0.2); }
                    else if (id === TILE_ID.planks || id === TILE_ID.brick) { ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(sx, sy + sz * 0.48, sz, 1.5); }
                }

            }
        }
        // mining crack + target outline
        var ch = redGuy;
        if (ch && !ch.dead) {
            var tg = this.target(ch);
            var ox = wsx(terraCX(tg.c) - T / 2), oy = wsy(terraCY(tg.r) + T / 2);
            ctx.strokeStyle = tg.ok ? "rgba(255,255,255,0.7)" : "rgba(248,113,113,0.5)"; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, sz, sz);
            if (TERRA.mineAt && TERRA.mineT > 0) {
                var id2 = terraGet(tg.c, tg.r), f = Math.min(1, TERRA.mineT / Math.max(1, TILES[id2][3] * TERRA_TOOLS[TERRA.tool][1]));
                ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.beginPath(); ctx.moveTo(ox + sz * 0.5, oy); ctx.lineTo(ox + sz * (0.5 - f * 0.3), oy + sz * f); ctx.moveTo(ox + sz * 0.5, oy + sz * 0.3); ctx.lineTo(ox + sz * (0.5 + f * 0.4), oy + sz * (0.3 + f * 0.6)); ctx.stroke();
            }
        }
    },

    // light map: every visible tile gets the brightest of sky light (by time of day, fading below the surface),
    // torches (radius 8) and the heroes' own glow (radius 5); darkness is drawn tile by tile on top
    drawFront: function() {
        var Tr = TERRA, T = Tr.T, k = cameraScaleX;
        var l = (0 - xc) / k, r = (cssW - xc) / k, top = yc / k, bot = (yc - cssH) / k;
        var c0 = Math.max(0, terraCol(l) - 1), c1 = Math.min(Tr.W - 1, terraCol(r) + 1), r0 = Math.max(0, terraRow(top) - 1), r1 = Math.min(Tr.H - 1, terraRow(bot) + 1);
        var lights = [], day = terraDaylight();
        for (let rr = Math.max(0, r0 - 8); rr <= Math.min(Tr.H - 1, r1 + 8); rr++) for (let cc = Math.max(0, c0 - 8); cc <= Math.min(Tr.W - 1, c1 + 8); cc++) if (Tr.grid[rr * Tr.W + cc] === TILE_ID.torch) lights.push([cc, rr, 8]);
        characters.forEach(function(h) { if (!h.dead && h.isPlayer) lights.push([terraCol(h.x), terraRow(h.y), 5]); });
        var sz = T * k + 0.6;
        for (let rr = r0; rr <= r1; rr++) {
            var sy = wsy(terraCY(rr) + T / 2);
            for (let cc = c0; cc <= c1; cc++) {
                var depth = rr - Tr.surface[cc];
                var lv = depth <= 0 ? day : day * Math.max(0, 1 - depth / 7);
                for (let n = 0; n < lights.length; n++) { var L = lights[n], d = Math.abs(L[0] - cc) + Math.abs(L[1] - rr); if (d < L[2]) lv = Math.max(lv, 1 - d / L[2]); }
                var dark = Math.min(0.92, 1 - lv);
                if (dark > 0.04) { ctx.fillStyle = "rgba(4,6,14," + dark.toFixed(2) + ")"; ctx.fillRect(wsx(terraCX(cc) - T / 2), sy, sz, sz); }
            }
        }
        // the night sky tint above ground
        if (day < 0.9) { ctx.fillStyle = "rgba(10,14,40," + ((0.9 - day) * 0.35).toFixed(2) + ")"; ctx.fillRect(0, 0, cssW, cssH); }
    },

    drawHUD: function() {
        var Tr = TERRA, ch = redGuy;
        uiPanel(14, 14, 340, 60, "#84cc16");
        uiText("TERRA", 30, 42, 22, "#bef264", "left", "900");
        var depth = ch ? Math.max(0, terraRow(ch.y) - Tr.surface[Math.max(0, Math.min(Tr.W - 1, terraCol(ch.x)))]) : 0;
        var hrs = Math.floor(Tr.time * 24), mins = Math.floor((Tr.time * 24 - hrs) * 60), isNight = terraDaylight() < 0.35;
        uiText((isNight ? "🌙 " : "☀ ") + ("0" + hrs).slice(-2) + ":" + ("0" + mins).slice(-2) + "   depth " + depth + " m   ⛏ " + TERRA_TOOLS[Tr.tool][0], 30, 64, 12, isNight ? "#c7d2fe" : "#d9f99d", "left", "700");
        if (Tr.panel === "newconfirm") uiText("Press N again to make a NEW world (this one is lost unless you saved with K)", cssW / 2, 120, 16, "#fca5a5", "center", "900");
        if (Tr.panel === "craft") {
            var pw = 480, px = cssW / 2 - pw / 2, py = 110, bench = redGuy && terraNearBench(redGuy);
            uiPanel(px, py, pw, 44 + TERRA_RECIPES.length * 34, "#bef264", 0.95);
            uiText("CRAFTING  ·  " + (bench ? "workbench nearby ✔" : "no workbench nearby"), px + 16, py + 26, 14, "#bef264", "left", "900");
            Tr.craftRects = [];
            TERRA_RECIPES.forEach(function(R, i) {
                var y = py + 40 + i * 34, can = terraHas(R[2]) && (!R[3] || bench) && !(R[1].tool !== undefined && Tr.tool >= R[1].tool);
                ctx.fillStyle = can ? "rgba(132,204,22,0.18)" : "rgba(255,255,255,0.04)"; ctx.fillRect(px + 10, y, pw - 20, 30);
                var cost = []; for (var kk in R[2]) cost.push(R[2][kk] + " " + kk + " (" + (Tr.inv[kk] || 0) + ")");
                uiText((i + 1) + "  " + R[0], px + 18, y + 20, 13, can ? "#ecfccb" : "#94a3b8", "left", "900");
                uiText(cost.join(" + ") + (R[3] ? "  · bench" : ""), px + pw - 18, y + 20, 11, can ? "#d9f99d" : "#64748b", "right", "700");
                Tr.craftRects.push([px + 10, y, pw - 20, 30, i]);
            });
        }
        if (Tr.panel === "inv") {
            var items = window.Object.keys(Tr.inv).filter(function(kk) { return Tr.inv[kk] > 0; });
            var iw = 420, ix = cssW / 2 - iw / 2, iy = 110;
            uiPanel(ix, iy, iw, 70 + Math.ceil(items.length / 3) * 26, "#bef264", 0.95);
            uiText("INVENTORY  ·  pickaxe: " + TERRA_TOOLS[Tr.tool][0], ix + 16, iy + 26, 14, "#bef264", "left", "900");
            items.forEach(function(kk, i) { uiText(kk + " × " + Tr.inv[kk], ix + 20 + (i % 3) * 135, iy + 54 + Math.floor(i / 3) * 26, 13, "#ecfccb", "left", "800"); });
        }
        var n = TERRA_PLACEABLE.length, bw = 58, x0 = cssW / 2 - n * (bw + 6) / 2, y0 = cssH - 88;
        for (let i = 0; i < n; i++) {
            var name = TERRA_PLACEABLE[i], col = TILES[TILE_ID[name]][1], bx = x0 + i * (bw + 6), on = i === Tr.sel;
            ctx.fillStyle = on ? "rgba(132,204,22,0.3)" : "rgba(15,23,42,0.85)"; ctx.fillRect(bx, y0, bw, 50);
            ctx.strokeStyle = on ? "#bef264" : "#475569"; ctx.lineWidth = 2; ctx.strokeRect(bx, y0, bw, 50);
            ctx.fillStyle = col; ctx.fillRect(bx + 17, y0 + 8, 24, 24);
            uiText((i < 9 ? i + 1 : (i === 9 ? 0 : "-")) + " " + name + " ×" + (Tr.creative ? "∞" : (Tr.inv[name] || 0)), bx + bw / 2, y0 + 45, 9, on ? "#ecfccb" : "#94a3b8", "center", "800");
        }
        uiText("Left mouse / F mine · right mouse / G place · 1-0 / wheel pick block · C craft · I inventory · E shockwave · K save · L load · N new world · Esc menu", cssW / 2, cssH - 16, 12, "rgba(220,230,240,0.75)", "center", "700");
    }
});

ModeKit.addLevel("terra_world", { name: "⛏ Terra: Generated World", mode: "terra", wavesEnabled: false, spawnP1: [0, 200], spawnP2: [80, 200], layout: [], title: "Generated World" });

// mouse wheel cycles the hotbar in Terra
(function() {
    var cv = typeof canvas !== "undefined" ? canvas : document.querySelector("canvas");
    if (!cv) return;
    cv.addEventListener("wheel", function(e) {
        if (!GameModes.current || GameModes.current.id !== "terra" || paused) return;
        TERRA.sel = (TERRA.sel + (e.deltaY > 0 ? 1 : -1) + TERRA_PLACEABLE.length) % TERRA_PLACEABLE.length;
        e.preventDefault(); e.stopPropagation();
    }, { passive: false, capture: true });
})();
