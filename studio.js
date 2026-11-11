// ============================================================================
// LEVEL STUDIO - a full level editor for every game on the engine (B / "🛠 Level Studio").
//
//   The DOCUMENT is the source of truth: { name, mode, waves, ents: [...] }. Every entity has a `cat`:
//     layout  { type: box|ramp|bumper|crate, x, y, w, h, ... }   level geometry (Object.loadMap format)
//     gadget  { type: plate|door|exit|qblock|..., ... }           Gadgets format
//     enemy   { power, x, y }                                    NORMAL/BAT/... or walker/hopper/... (Stomp Squad)
//     item    { power, x, y }                                    power-up pickup
//     spawn   { player: 1|2, x, y }                              hero start points
//   After every edit the world is rebuilt from the document. The simulation is frozen while editing
//   (`simFrozen`); the camera is free (drag with right/middle mouse or WASD, wheel to zoom).
//   Play-test turns the document into a real level and runs it under the chosen game's rules; reaching
//   an exit (or Esc -> Back to Level Studio, or the ` key) returns here with the document unchanged.
//   Saved levels also appear in the normal level list. JSON export/import for sharing.
// ============================================================================
var simFrozen = false;

var STUDIO_TEXTURES = ["brick", "grass_dirt", "castle_stone", "dojo_wood", "lab_metal", "crate_plank", "neon_grid", "question_gold", "solid",
    "wood_plank", "stone_block", "metal_plate", "glass", "pipe_green", "used_block", "wool_red", "wool_blue", "tex_dirt", "grass_top",
    "stone_raw", "ore_coal", "ore_iron", "ore_gold", "log", "leaves", "sand", "bedrock", "hazard", "ice", "mossy_brick"];
var STUDIO_ENEMIES = ["NORMAL", "SLIME", "BAT", "ARCHER", "KNIGHT", "MAGE", "LEAPER", "EXPLODER", "TANK", "SPITTER", "BOSS_KING"];
var STUDIO_PLAT_ENEMIES = ["walker", "hopper", "flyer", "spiky", "tank"];
var STUDIO_MODES = [["survival", "Zombie Survival (waves)"], ["creative", "Creative (fly & build)"], ["platform", "Stomp Squad (platformer)"],
                    ["puzzle", "Crate Lab (puzzle)"], ["race", "Parkour Rush (race)"], ["portal", "Portal Lab"], ["wheels", "Wobble Wheels (course)"]];

// palette: category -> [ [label, icon, template] ]
var STUDIO_PALETTE = [
    ["Terrain", [
        ["Block", "🧱", { cat: "layout", type: "box", name: "Block", w: 480, h: 160, color: "#b84a27", texture: "brick", kind: "block" }],
        ["Grass ground", "🌿", { cat: "layout", type: "box", name: "Grass", w: 640, h: 80, color: "#7f4f24", texture: "grass_dirt", kind: "block" }],
        ["Small block", "▪", { cat: "layout", type: "box", name: "Small Block", w: 80, h: 80, color: "#b84a27", texture: "brick", kind: "block" }],
        ["Wall", "🏰", { cat: "layout", type: "box", name: "Wall", w: 80, h: 480, color: "#4a5568", texture: "castle_stone", kind: "wall" }],
        ["One-way platform", "➖", { cat: "layout", type: "box", name: "Platform", w: 480, h: 40, color: "#8b6b4a", texture: "dojo_wood", kind: "platform" }],
        ["Portal panel", "⬜", { cat: "layout", type: "box", name: "Portal Panel", w: 80, h: 480, color: "#e2e8f0", texture: "solid", kind: "wall", portalable: true }]
    ]],
    ["Stairs · slopes · slides", [
        ["Stairs /", "🪜", { cat: "layout", type: "ramp", name: "Stairs", w: 480, h: 320, dir: "right", color: "#6c3c28", texture: "dojo_wood" }],
        ["Stairs \\", "🪜", { cat: "layout", type: "ramp", name: "Stairs", w: 480, h: 320, dir: "left", color: "#6c3c28", texture: "dojo_wood" }],
        ["Slope /", "⛰", { cat: "layout", type: "ramp", name: "Slope", w: 480, h: 240, dir: "right", color: "#7f4f24", texture: "grass_dirt" }],
        ["Slope \\", "⛰", { cat: "layout", type: "ramp", name: "Slope", w: 480, h: 240, dir: "left", color: "#7f4f24", texture: "grass_dirt" }],
        ["Slide /", "🛝", { cat: "layout", type: "ramp", name: "Slide", w: 480, h: 240, dir: "right", color: "#38bdf8", texture: "solid" }],
        ["Slide \\", "🛝", { cat: "layout", type: "ramp", name: "Slide", w: 480, h: 240, dir: "left", color: "#38bdf8", texture: "solid" }]
    ]],
    ["Pads · crates", [
        ["Bounce pad", "⏫", { cat: "layout", type: "bumper", name: "Bounce Pad", w: 240, h: 40, bounce: 24, color: "#ff2e63" }],
        ["Crate", "📦", { cat: "layout", type: "crate", name: "Crate", size: 80 }],
        ["TNT", "🧨", { cat: "layout", type: "crate", name: "TNT Barrel", size: 80, explosive: true }]
    ]],
    ["Gadgets", [
        ["Pressure plate", "⏺", { cat: "gadget", type: "plate", w: 160, links: [] }],
        ["Lever", "🕹", { cat: "gadget", type: "switch", links: [] }],
        ["Door", "🚪", { cat: "gadget", type: "door", id: "door", w: 80, h: 320, invert: false }],
        ["Locked door", "🔒", { cat: "gadget", type: "lockdoor", w: 80, h: 320, color: "#facc15" }],
        ["Key", "🔑", { cat: "gadget", type: "key", color: "#facc15" }],
        ["Exit", "🏁", { cat: "gadget", type: "exit" }],
        ["Spikes", "🔺", { cat: "gadget", type: "spikes", w: 240 }],
        ["Checkpoint", "🚩", { cat: "gadget", type: "checkpoint" }],
        ["Moving platform", "↔", { cat: "gadget", type: "mover", w: 240, h: 40, dx2: 400, dy2: 0, speed: 3 }],
        ["Fan", "🌀", { cat: "gadget", type: "fan", w: 160, h: 480, power: 1.6 }],
        ["Cracked wall", "💥", { cat: "gadget", type: "cracked", w: 80, h: 320 }],
        ["Star", "⭐", { cat: "gadget", type: "star" }],
        ["Sign", "🪧", { cat: "gadget", type: "sign", text: "Hello!" }],
        ["? block", "❓", { cat: "gadget", type: "qblock", item: "coin" }],
        ["Brick", "🟫", { cat: "gadget", type: "brick" }],
        ["Coin", "🪙", { cat: "gadget", type: "coin" }],
        ["Goal pole", "🎌", { cat: "gadget", type: "goalpole", h: 640 }]
    ]],
    ["Vehicles", [
        ["Car", "🚗", { cat: "gadget", type: "car", color: "#e11d48" }],
        ["Rail", "🛤", { cat: "gadget", type: "rail", w: 480, dy: 0 }],
        ["Minecart", "🛒", { cat: "gadget", type: "minecart", cars: 1 }],
        ["Train (3 cars)", "🚂", { cat: "gadget", type: "minecart", cars: 3 }]
    ]],
    ["Enemies", STUDIO_ENEMIES.map(function(p) { return [p.toLowerCase().replace("_", " "), "👾", { cat: "enemy", power: p }]; })
        .concat(STUDIO_PLAT_ENEMIES.map(function(p) { return ["platformer " + p, "🍄", { cat: "enemy", power: p }]; }))],
    ["Items", []],
    ["Spawns", [
        ["Player 1 start", "1️⃣", { cat: "spawn", player: 1 }],
        ["Player 2 start", "2️⃣", { cat: "spawn", player: 2 }]
    ]],
    // only offered when the level's rules are Wobble Wheels (the 3rd item names the modes it's for)
    ["Wobble Wheels", [
        ["Mine", "💥", { cat: "wtrap", kind: "mine" }],
        ["Swinging log", "🪵", { cat: "wtrap", kind: "log", len: 900 }],
        ["Spike strip", "🔺", { cat: "wtrap", kind: "spikes", w: 200 }],
        ["Crumble slab", "🪨", { cat: "layout", type: "box", name: "Crumble slab", w: 400, h: 40, color: "#a8a29e", texture: "stone_raw", kind: "block" }],
        ["Finish line", "🏁", { cat: "wfinish" }]
    ], ["wheels"]]
];

var Studio = {
    isOpen: false,
    playtesting: false,
    doc: null,
    sel: [],
    clip: null,
    undoStack: [], redoStack: [],
    tool: "select", tpl: null, tplLabel: "",
    cam: { x: 0, y: 300, z: 0.35 },
    grid: 40, snap: true,
    drag: null,
    mouse: { x: 0, y: 0, wx: 0, wy: 0 },
    keys: {},
    nextSid: 1,
    toast: "", toastT: 0,
    prevLevelKey: null,
    ui: null,

    // ------------------------------------------------------------------ documents
    newDoc: function() {
        var items = ModeKit.room(-1600, 1600, 1600, { tex: "brick", color: "#334155", floorTex: "grass_dirt", floorColor: "#7f4f24" });
        var d = { name: "My Level", mode: "survival", waves: false, ents: [] };
        for (let i = 0; i < items.length; i++) { var it = items[i]; it.cat = "layout"; d.ents.push(it); }
        d.ents.push({ cat: "spawn", player: 1, x: -200, y: 100 }, { cat: "spawn", player: 2, x: -80, y: 100 });
        return this.withIds(d);
    },

    // turn any existing level definition into a document (edit built-in or saved levels)
    docFromLevel: function(key) {
        var lvl = LevelManager.getAllLevels()[key];
        if (!lvl) return this.newDoc();
        if (lvl.studioDoc) return this.withIds(JSON.parse(JSON.stringify(lvl.studioDoc)));
        var d = { name: (lvl.name || key).replace(/^[^A-Za-z0-9]+/, ""), mode: GameModes.modeOf(lvl), waves: !!lvl.wavesEnabled, ents: [] };
        var copy = function(o, cat) { var c = JSON.parse(JSON.stringify(o)); c.cat = cat; return c; };
        (lvl.layout || []).forEach(function(it) { d.ents.push(copy(it, "layout")); });
        (lvl.gadgets || []).forEach(function(g) { var c = copy(g, "gadget"); if (c.type === "mover" && c.x2 !== undefined) { c.dx2 = c.x2 - c.x; c.dy2 = c.y2 - c.y; delete c.x2; delete c.y2; } d.ents.push(c); });
        (lvl.enemies || []).forEach(function(e) { d.ents.push({ cat: "enemy", power: e.t || e.power || "NORMAL", x: e.x, y: (e.y || 0) + 70 }); });
        if (lvl.traps) {
            (lvl.traps.mines || []).forEach(function(m) { d.ents.push({ cat: "wtrap", kind: "mine", x: m[0], y: m[1] }); });
            (lvl.traps.logs || []).forEach(function(l) { d.ents.push({ cat: "wtrap", kind: "log", x: l[0], y: 800, len: l[1] }); });
            (lvl.traps.spikes || []).forEach(function(sp) { d.ents.push({ cat: "wtrap", kind: "spikes", x: sp[0], y: sp[1], w: sp[2] }); });
        }
        if (lvl.finishX !== undefined) d.ents.push({ cat: "wfinish", x: lvl.finishX, y: 0 });
        if (lvl.spawnP1) d.ents.push({ cat: "spawn", player: 1, x: lvl.spawnP1[0], y: lvl.spawnP1[1] });
        if (lvl.spawnP2) d.ents.push({ cat: "spawn", player: 2, x: lvl.spawnP2[0], y: lvl.spawnP2[1] });
        return this.withIds(d);
    },

    withIds: function(d) {
        for (let i = 0; i < d.ents.length; i++) d.ents[i]._sid = this.nextSid++;
        return d;
    },

    // document -> a real level definition (what play-test and Save use)
    docToDef: function(doc) {
        var strip = function(e) { var o = {}; for (var k in e) if (k !== "cat" && k !== "_sid") o[k] = e[k]; return o; };
        var def = { name: "🛠 " + (doc.name || "Studio level"), mode: doc.mode, wavesEnabled: !!doc.waves, layout: [], gadgets: [], enemies: [],
                    studioSpawns: { enemies: [], items: [] }, studioDoc: JSON.parse(JSON.stringify(doc)), _scaled: true, title: doc.name, time: 300 };
        var p1 = null, p2 = null;
        for (let i = 0; i < doc.ents.length; i++) {
            var e = doc.ents[i];
            if (e.cat === "layout") def.layout.push(strip(e));
            else if (e.cat === "gadget") {
                var g = strip(e);
                if (g.type === "mover") { g.x2 = g.x + (g.dx2 || 0); g.y2 = g.y + (g.dy2 || 0); delete g.dx2; delete g.dy2; }
                def.gadgets.push(g);
            }
            else if (e.cat === "enemy") {
                if (doc.mode === "platform" && STUDIO_PLAT_ENEMIES.indexOf(e.power) !== -1) def.enemies.push({ t: e.power, x: e.x, y: e.y - 70 });
                else def.studioSpawns.enemies.push({ power: STUDIO_PLAT_ENEMIES.indexOf(e.power) !== -1 ? ({ walker: "NORMAL", hopper: "SLIME", flyer: "BAT", spiky: "KNIGHT", tank: "TANK" })[e.power] : e.power, x: e.x, y: e.y });
            }
            else if (e.cat === "item") def.studioSpawns.items.push({ power: e.power, x: e.x, y: e.y });
            else if (e.cat === "spawn") { if (e.player === 2) p2 = [e.x, e.y]; else p1 = [e.x, e.y]; }
        }
        def.spawnP1 = p1 || [0, 120];
        def.spawnP2 = p2 || [def.spawnP1[0] + 100, def.spawnP1[1]];
        if (doc.mode === "wheels") {
            // Wobble Wheels reads traps / finish / checkpoints from the level itself
            var tr = { mines: [], logs: [], spikes: [] }, fin = null, maxX = -Infinity;
            doc.ents.forEach(function(e) {
                if (e.cat === "wtrap") { if (e.kind === "mine") tr.mines.push([e.x, e.y]); else if (e.kind === "log") tr.logs.push([e.x, e.len || 900]); else tr.spikes.push([e.x, e.y, e.w || 200]); }
                if (e.cat === "wfinish") fin = e.x;
                if (e.cat === "layout") maxX = Math.max(maxX, e.x + (e.w || 0) / 2);
            });
            def.traps = tr;
            def.finishX = fin !== null ? fin : (isFinite(maxX) ? maxX - 300 : 3000);
            def.cps = def.gadgets.filter(function(g) { return g.type === "checkpoint"; }).map(function(g) { return g.x; }).sort(function(a, b) { return a - b; });
            def.par = [30, 45, 60];
        }
        return def;
    },

    // rebuild the frozen preview world from the document
    rebuild: function() {
        var def = this.docToDef(this.doc);
        staticObjects = []; movingObjects = []; zombies = []; characters = []; lazers = []; particles = [];
        powerUps = []; coinOrbs = []; floatingTexts = [];
        if (typeof Ragdolls !== "undefined") Ragdolls.list = [];
        if (typeof treasureChests !== "undefined") treasureChests = [];
        redGuy = null; blueGuy = null;
        try { Object.loadMap(def.layout); } catch (e) { console.warn("studio layout", e); }
        try { Gadgets.load(JSON.parse(JSON.stringify(def.gadgets))); } catch (e) { console.warn("studio gadgets", e); }
        // enemy previews: real characters, never simulated while editing
        var plat = { walker: "NORMAL", hopper: "SLIME", flyer: "BAT", spiky: "KNIGHT", tank: "TANK" };
        for (let i = 0; i < this.doc.ents.length; i++) {
            var e = this.doc.ents[i];
            if (e.cat !== "enemy") continue;
            try {
                var z = spawnZombie(plat[e.power] || e.power, e.x, e.y);
                z.x = e.x; z.y = e.y; z.xspeed = z.yspeed = 0;
                z.studioSid = e._sid;
            } catch (er) {}
        }
        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
        if (typeof StaticGrid !== "undefined") StaticGrid.build();
    },

    // ------------------------------------------------------------------ open / close
    toggle: function() { if (this.isOpen) this.close(); else this.open(); },

    // the game you were playing is parked (not reloaded) while you edit, and handed back untouched when you
    // close the Studio - unless you play-tested, which had to replace the world
    park: function() {
        var P = { staticObjects: staticObjects, movingObjects: movingObjects, zombies: zombies, characters: characters, lazers: lazers,
            particles: particles, powerUps: powerUps, coinOrbs: coinOrbs, floatingTexts: floatingTexts, afterImages: afterImages,
            redGuy: redGuy, blueGuy: blueGuy, levelKey: LevelManager.currentLevelKey, mode: GameModes.current && GameModes.current.id };
        if (typeof treasureChests !== "undefined") P.treasureChests = treasureChests;
        if (typeof Ragdolls !== "undefined") P.ragdolls = Ragdolls.list;
        if (typeof Gadgets !== "undefined") P.gadgets = { list: Gadgets.list, byId: Gadgets.byId, keys: Gadgets.keys, starsGot: Gadgets.starsGot, starsTotal: Gadgets.starsTotal, deaths: Gadgets.deaths };
        if (typeof Vehicles !== "undefined") P.vehicles = { cars: Vehicles.cars, carts: Vehicles.carts, rails: Vehicles.rails };
        if (typeof Components !== "undefined") P.comps = { rings: Components.rings, bolts: Components.bolts, corpses: Components.corpses };
        this.parked = P;
    },

    unpark: function() {
        var P = this.parked;
        this.parked = null;
        if (!P) return false;
        staticObjects = P.staticObjects; movingObjects = P.movingObjects; zombies = P.zombies; characters = P.characters; lazers = P.lazers;
        particles = P.particles; powerUps = P.powerUps; coinOrbs = P.coinOrbs; floatingTexts = P.floatingTexts; afterImages = P.afterImages;
        redGuy = P.redGuy; blueGuy = P.blueGuy;
        if (P.treasureChests) treasureChests = P.treasureChests;
        if (P.ragdolls) Ragdolls.list = P.ragdolls;
        if (P.gadgets) for (var k in P.gadgets) Gadgets[k] = P.gadgets[k];
        if (P.vehicles) for (var v in P.vehicles) Vehicles[v] = P.vehicles[v];
        if (P.comps) for (var c in P.comps) Components[c] = P.comps[c];
        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
        if (typeof StaticGrid !== "undefined") StaticGrid.build();
        if (typeof Pathfinder !== "undefined") try { Pathfinder.rebuildGraph(true); } catch (e) {}
        return true;
    },

    open: function(editKey) {
        if (typeof Net !== "undefined" && Net.role === "client") return;
        if (this.playtesting) { this.endPlaytest(); return; }
        if (typeof paused !== "undefined" && paused && typeof closePause === "function") closePause();
        if (typeof Hub !== "undefined" && Hub.isOpen) Hub.close();
        if (typeof SummonManager !== "undefined" && SummonManager.isOpen) SummonManager.togglePanel();
        var fresh = !this.prevLevelKey;           // coming from a game (not back from a play-test)
        this.prevLevelKey = this.prevLevelKey || LevelManager.currentLevelKey;
        if (fresh) { this.park(); this.tested = false; }
        if (!this.doc) {
            var auto = null;
            try { auto = JSON.parse(localStorage.getItem("timsLevelStudioAutosave") || "null"); } catch (e) {}
            this.doc = (auto && auto.ents) ? this.withIds(auto) : this.newDoc();
        }
        if (editKey) this.doc = this.docFromLevel(editKey);
        this.isOpen = true;
        simFrozen = true;
        mouseDown = false;
        document.body.classList.add("studio-open");
        this.buildUI();
        this.rebuild();
        this.frameAll();
        this.renderAll();
        if (fresh && !editKey) this.showStart(); else this.hideStart();
    },

    close: function() {
        if (!this.isOpen) return;
        this.autosave();
        this.isOpen = false;
        simFrozen = false;
        this.tool = "select"; this.tpl = null; this.sel = []; this.drag = null;
        document.body.classList.remove("studio-open");
        if (this.ui) this.ui.root.style.display = "none";
        this.hideStart();
        var back = this.prevLevelKey || "classic_arena";
        this.prevLevelKey = null;
        var P = this.parked;
        // nothing replaced the game while editing: give it back exactly as it was (score, wave, positions)
        if (P && !this.tested && P.levelKey === LevelManager.currentLevelKey && P.mode === (GameModes.current && GameModes.current.id) && this.unpark()) {
            if (typeof Components !== "undefined" && Components.addFloatingText && characters[0]) Components.addFloatingText("BACK IN THE GAME", characters[0].x, characters[0].y + 120, "#7ff0ff", 18);
            return;
        }
        this.parked = null;
        LevelManager.selectLevel(LevelManager.getAllLevels()[back] ? back : "classic_arena");
    },

    // ---- start card: what do you want to edit? (shown when you open the Studio from a game)
    showStart: function() {
        if (!this.ui) return;
        var self = this, esc = function(s) { return String(s).replace(/[&<>"']/g, function(c) { return "&#" + c.charCodeAt(0) + ";"; }); };
        var cur = LevelManager.getAllLevels()[this.prevLevelKey] || {};
        var curName = (cur.name || this.prevLevelKey || "this level").replace(/^[^A-Za-z0-9]+/, "");
        var auto = null;
        try { auto = JSON.parse(localStorage.getItem("timsLevelStudioAutosave") || "null"); } catch (e) {}
        var saved = window.Object.keys(this.savedAll());
        var card = this.ui.start;
        var h = "<h2>🛠 Level Studio</h2><p class='muted'>Your game is paused and kept exactly as it is — close the Studio to carry on.</p>" +
            "<button class='sc' id='ss-cur'><b>✏ Edit a copy of “" + esc(curName) + "”</b><span>start from the level you were just playing</span></button>" +
            (auto && auto.ents ? "<button class='sc' id='ss-auto'><b>↻ Continue “" + esc(auto.name || "My Level") + "”</b><span>your last edit, " + auto.ents.length + " pieces (autosaved)</span></button>" : "") +
            "<button class='sc' id='ss-new'><b>＋ New blank level</b><span>a walled room with two player starts</span></button>" +
            (saved.length ? "<div class='ss-saved'><span class='muted'>Saved levels</span>" + saved.map(function(n, i) { return "<button data-n='" + i + "'>📂 " + esc(n) + "</button>"; }).join("") + "</div>" : "") +
            "<div class='ss-foot'><button id='ss-back'>◀ Back to the game (B)</button></div>";
        card.innerHTML = "<div class='ss-card'>" + h + "</div>";
        card.style.display = "flex";
        var pick = function(fn) { return function() { fn(); self.sel = []; self.undoStack = []; self.redoStack = []; self.rebuild(); self.frameAll(); self.renderAll(); self.hideStart(); }; };
        card.querySelector("#ss-cur").onclick = pick(function() { self.doc = self.docFromLevel(self.prevLevelKey); });
        var a = card.querySelector("#ss-auto"); if (a) a.onclick = pick(function() {});
        card.querySelector("#ss-new").onclick = pick(function() { self.doc = self.newDoc(); });
        card.querySelectorAll(".ss-saved button").forEach(function(b) { b.onclick = pick(function() { var d = self.savedAll()[saved[Number(b.dataset.n)]]; if (d) self.doc = self.withIds(JSON.parse(JSON.stringify(d))); }); });
        card.querySelector("#ss-back").onclick = function() { self.close(); };
    },
    hideStart: function() { if (this.ui && this.ui.start) this.ui.start.style.display = "none"; },
    startShown: function() { return this.ui && this.ui.start && this.ui.start.style.display !== "none"; },

    autosave: function() { try { localStorage.setItem("timsLevelStudioAutosave", JSON.stringify(this.doc)); } catch (e) {} },

    // ------------------------------------------------------------------ play-test
    playtest: function() {
        this.autosave();
        this.hideStart();
        this.tested = true;
        var def = this.docToDef(this.doc);
        LevelManager.builtInLevels["__studio_test"] = def;
        this.isOpen = false;
        this.playtesting = true;
        simFrozen = false;
        document.body.classList.remove("studio-open");
        document.body.classList.add("studio-testing");
        if (this.ui) this.ui.root.style.display = "none";
        this.showTestBar(true);
        LevelManager.selectLevel("__studio_test");
        if (LevelManager.currentLevelKey === "__studio_test" && typeof Pathfinder !== "undefined") Pathfinder.rebuildGraph(true);
    },

    endPlaytest: function(reason) {
        if (!this.playtesting) return;
        this.playtesting = false;
        document.body.classList.remove("studio-testing");
        this.showTestBar(false);
        gameOver = false;
        if (typeof paused !== "undefined" && paused && typeof closePause === "function") closePause();
        this.open();
        if (reason) this.say(reason);
    },

    // called at the end of resetGame(): spawn the document's enemies and items in any game
    afterReset: function() {
        var lvl = LevelManager.getCurrentLevel();
        if (!lvl || !lvl.studioSpawns) return;
        var sp = lvl.studioSpawns;
        for (let i = 0; i < sp.enemies.length; i++) {
            try { var z = spawnZombie(sp.enemies[i].power, sp.enemies[i].x, sp.enemies[i].y); z.x = sp.enemies[i].x; z.hunter = true; } catch (e) {}
        }
        for (let i = 0; i < sp.items.length; i++) { try { spawnPowerUp(sp.items[i].x, sp.items[i].y, sp.items[i].power); } catch (e) {} }
    },

    showTestBar: function(on) {
        var b = document.getElementById("studio-testbar");
        if (!b) {
            b = document.createElement("button");
            b.id = "studio-testbar";
            b.textContent = "◀ Back to Level Studio  ( ` )";
            b.addEventListener("mousedown", function(e) { e.stopPropagation(); });
            b.addEventListener("click", function(e) { e.stopPropagation(); Studio.endPlaytest(); });
            document.body.appendChild(b);
        }
        b.style.display = on ? "block" : "none";
    },

    // ------------------------------------------------------------------ geometry helpers
    // centre-based box + how the entity's x/y anchor to it
    bbox: function(e) {
        var t = e.type;
        if (e.cat === "layout") {
            if (t === "crate") { var s = e.size || 80; return { x: e.x, y: e.y, w: e.w || s, h: e.h || s }; }
            return { x: e.x, y: e.y, w: e.w || 80, h: e.h || 80 };
        }
        if (e.cat === "enemy") return { x: e.x, y: e.y, w: 80, h: 80 };
        if (e.cat === "item") return { x: e.x, y: e.y, w: 56, h: 56 };
        if (e.cat === "spawn") return { x: e.x, y: e.y, w: 70, h: 90 };
        if (e.cat === "wfinish") return { x: e.x, y: e.y + 150, w: 60, h: 300 };
        if (e.cat === "wtrap") return e.kind === "log" ? { x: e.x, y: e.y, w: 120, h: 120 } : e.kind === "spikes" ? { x: e.x, y: e.y + 15, w: e.w || 200, h: 30 } : { x: e.x, y: e.y + 12, w: 50, h: 24 };
        switch (t) {
            case "plate": return { x: e.x, y: e.y - 10, w: e.w || 160, h: 20 };
            case "switch": return { x: e.x, y: e.y + 40, w: 60, h: 80 };
            case "exit": return { x: e.x, y: e.y + 85, w: 110, h: 170 };
            case "spikes": return { x: e.x, y: e.y + 17, w: e.w || 240, h: 34 };
            case "checkpoint": return { x: e.x, y: e.y + 75, w: 50, h: 150 };
            case "sign": return { x: e.x, y: e.y + 50, w: 70, h: 100 };
            case "fan": return { x: e.x, y: e.y + (e.h || 480) / 2, w: e.w || 160, h: e.h || 480 };
            case "goalpole": return { x: e.x, y: e.y + (e.h || 640) / 2, w: 80, h: e.h || 640 };
            case "key": return { x: e.x, y: e.y, w: 70, h: 40 };
            case "star": return { x: e.x, y: e.y, w: 60, h: 60 };
            case "coin": return { x: e.x, y: e.y, w: 50, h: 60 };
            case "car": return { x: e.x, y: e.y + 60, w: 200, h: 120 };
            case "rail": return { x: e.x, y: e.y + (e.dy || 0) / 2, w: e.w || 480, h: Math.max(24, Math.abs(e.dy || 0)) };
            case "minecart": return { x: e.x, y: e.y + 40, w: 120, h: 70 };
            default: return { x: e.x, y: e.y, w: e.w || 80, h: e.h || 80 };
        }
    },

    // which edges can be dragged: "wh" both, "w" width only, "h" height only, "" none
    resizable: function(e) {
        if (e.cat === "layout") return e.type === "crate" ? "" : "wh";
        if (e.cat !== "gadget") return "";
        return ({ door: "wh", lockdoor: "wh", mover: "wh", cracked: "wh", fan: "wh", spikes: "w", plate: "w", goalpole: "h", qblock: "wh", brick: "wh", rail: "w" })[e.type] || "";
    },

    // write a new box (l, r, b, t) back into the entity respecting its anchor
    setBox: function(e, l, r, b, t) {
        var w = Math.max(20, r - l), h = Math.max(20, t - b), cx = (l + r) / 2;
        var rz = this.resizable(e);
        if (rz.indexOf("w") !== -1) e.w = w;
        if (rz.indexOf("h") !== -1) e.h = h;
        e.x = cx;
        if (e.cat === "gadget" && (e.type === "fan" || e.type === "goalpole")) e.y = b;
        else if (e.cat === "gadget" && e.type === "spikes") e.y = b;
        else if (e.cat === "gadget" && e.type === "rail") { e.y = (b + t) / 2 - (e.dy || 0) / 2; }
        else if (e.cat === "gadget" && e.type === "plate") e.y = b + 20;
        else e.y = (b + t) / 2;
    },

    snapV: function(v) { return this.snap ? Math.round(v / this.grid) * this.grid : Math.round(v); },

    toWorld: function(mx, my) { return [(mx - xc) / cameraScaleX, (yc - my) / cameraScaleY]; },

    hitTest: function(wx, wy) {
        // topmost first: spawns, items, enemies, gadgets, then layout (smallest wins among layout)
        var order = ["spawn", "item", "enemy", "gadget", "layout"];
        for (let o = 0; o < order.length; o++) {
            var best = null, bestA = Infinity;
            for (let i = this.doc.ents.length - 1; i >= 0; i--) {
                var e = this.doc.ents[i];
                if (e.cat !== order[o]) continue;
                var bb = this.bbox(e);
                var pad = 6 / cameraScaleX;
                if (Math.abs(wx - bb.x) <= bb.w / 2 + pad && Math.abs(wy - bb.y) <= bb.h / 2 + pad) {
                    var a = bb.w * bb.h;
                    if (a < bestA) { bestA = a; best = e; }
                }
            }
            if (best) return best;
        }
        return null;
    },

    handleAt: function(mx, my) {
        if (this.sel.length !== 1) return null;
        var e = this.sel[0], rz = this.resizable(e);
        if (!rz) return null;
        var hs = this.handles(e);
        for (let i = 0; i < hs.length; i++) if (Math.abs(mx - hs[i].sx) < 9 && Math.abs(my - hs[i].sy) < 9) return hs[i];
        return null;
    },

    handles: function(e) {
        var bb = this.bbox(e), rz = this.resizable(e), out = [];
        var l = bb.x - bb.w / 2, r = bb.x + bb.w / 2, b = bb.y - bb.h / 2, t = bb.y + bb.h / 2;
        var add = function(id, x, y) { out.push({ id: id, sx: wsx(x), sy: wsy(y) }); };
        if (rz.indexOf("w") !== -1) { add("r", r, bb.y); add("l", l, bb.y); }
        if (rz.indexOf("h") !== -1) { add("t", bb.x, t); add("b", bb.x, b); }
        if (rz === "wh") { add("tr", r, t); add("tl", l, t); add("br", r, b); add("bl", l, b); }
        return out;
    },

    // ------------------------------------------------------------------ edits
    pushUndo: function() {
        this.undoStack.push(JSON.stringify(this.doc));
        if (this.undoStack.length > 120) this.undoStack.shift();
        this.redoStack = [];
    },

    restore: function(json) {
        var sids = this.sel.map(function(e) { return e._sid; });
        this.doc = JSON.parse(json);
        this.sel = this.doc.ents.filter(function(e) { return sids.indexOf(e._sid) !== -1; });
        this.rebuild();
        this.renderAll();
    },

    undo: function() { if (!this.undoStack.length) return this.say("Nothing to undo"); this.redoStack.push(JSON.stringify(this.doc)); this.restore(this.undoStack.pop()); this.say("Undo"); },
    redo: function() { if (!this.redoStack.length) return this.say("Nothing to redo"); this.undoStack.push(JSON.stringify(this.doc)); this.restore(this.redoStack.pop()); this.say("Redo"); },

    changed: function(keepInspector) {
        this.rebuild();
        this.autosave();
        if (!keepInspector) this.renderInspector();
        this.renderStatus();
    },

    place: function(wx, wy) {
        this.pushUndo();
        var e = JSON.parse(JSON.stringify(this.tpl));
        e._sid = this.nextSid++;
        e.x = 0; e.y = 0;
        var bb = this.bbox(e);
        // snap the box's left/bottom edge to the grid so pieces line up
        var l = this.snapV(wx - bb.w / 2), b = this.snapV(wy - bb.h / 2);
        e.x = l + bb.w / 2 + (e.x - bb.x);
        e.y = b + bb.h / 2 + (e.y - bb.y);
        if (e.cat === "gadget" && e.type === "door") {
            var n = 1, ids = {};
            this.doc.ents.forEach(function(o) { if (o.id) ids[o.id] = 1; });
            while (ids["door" + n]) n++;
            e.id = "door" + n;
        }
        if (e.cat === "spawn") this.doc.ents = this.doc.ents.filter(function(o) { return !(o.cat === "spawn" && o.player === e.player); });
        this.doc.ents.push(e);
        this.sel = [e];
        this.changed();
    },

    moveSel: function(dx, dy) {
        for (let i = 0; i < this.sel.length; i++) { this.sel[i].x += dx; this.sel[i].y += dy; }
    },

    deleteSel: function() {
        if (!this.sel.length) return;
        this.pushUndo();
        var dead = this.sel;
        this.doc.ents = this.doc.ents.filter(function(e) { return dead.indexOf(e) === -1; });
        this.say("Deleted " + dead.length);
        this.sel = [];
        this.changed();
    },

    duplicateSel: function() {
        if (!this.sel.length) return;
        this.pushUndo();
        var self = this, out = [];
        this.sel.forEach(function(e) {
            if (e.cat === "spawn") return;
            var c = JSON.parse(JSON.stringify(e));
            c._sid = self.nextSid++;
            c.x += self.grid * 2; c.y += self.grid * 2;
            self.doc.ents.push(c); out.push(c);
        });
        this.sel = out;
        this.changed();
        this.say("Duplicated " + out.length);
    },

    copySel: function() { if (this.sel.length) { this.clip = JSON.stringify(this.sel); this.say("Copied " + this.sel.length); } },

    paste: function() {
        if (!this.clip) return this.say("Clipboard is empty");
        this.pushUndo();
        var items = JSON.parse(this.clip), self = this;
        var cx = 0, cy = 0;
        items.forEach(function(e) { cx += e.x; cy += e.y; });
        cx /= items.length; cy /= items.length;
        var dx = this.snapV(this.mouse.wx - cx), dy = this.snapV(this.mouse.wy - cy);
        this.sel = [];
        items.forEach(function(e) { if (e.cat === "spawn") return; e._sid = self.nextSid++; e.x += dx; e.y += dy; self.doc.ents.push(e); self.sel.push(e); });
        this.changed();
        this.say("Pasted " + this.sel.length);
    },

    flipSel: function() {
        var any = false;
        this.sel.forEach(function(e) { if (e.cat === "layout" && e.type === "ramp") any = true; });
        if (!any) return this.say("Select a ramp / stairs / slide to flip it");
        this.pushUndo();
        this.sel.forEach(function(e) { if (e.cat === "layout" && e.type === "ramp") e.dir = e.dir === "left" ? "right" : "left"; });
        this.changed();
    },

    // rotate a ramp 90°: swap its width and height and flip its direction
    rotateSel: function() {
        var did = false;
        this.pushUndo();
        this.sel.forEach(function(e) {
            if (e.cat === "layout" && (e.type === "ramp" || e.type === "box")) {
                var w = e.w; e.w = e.h; e.h = w;
                if (e.type === "ramp") e.dir = e.dir === "left" ? "right" : "left";
                did = true;
            }
        });
        if (!did) { this.undoStack.pop(); return this.say("Select blocks or ramps to rotate"); }
        this.changed();
    },

    frameAll: function() {
        if (!this.doc.ents.length) { this.cam = { x: 0, y: 300, z: 0.35 }; return; }
        var l = Infinity, r = -Infinity, b = Infinity, t = -Infinity;
        var self = this;
        this.doc.ents.forEach(function(e) {
            var bb = self.bbox(e);
            if (bb.w > 20000 || bb.h > 20000) return;
            l = Math.min(l, bb.x - bb.w / 2); r = Math.max(r, bb.x + bb.w / 2);
            b = Math.min(b, Math.max(bb.y - bb.h / 2, -400)); t = Math.max(t, bb.y + bb.h / 2);
        });
        if (!isFinite(l)) return;
        var vw = Math.max(200, cssW - (this.lw || 0) - (this.rw || 0) - 20), vh = cssH - 90;
        this.cam.x = (l + r) / 2; this.cam.y = (b + t) / 2;
        this.cam.z = Math.max(0.05, Math.min(1.2, Math.min(vw / (r - l + 200), vh / (t - b + 200))));
    },

    say: function(msg) { this.toast = msg; this.toastT = 150; },

    // ------------------------------------------------------------------ save / load / share
    savedAll: function() { try { return JSON.parse(localStorage.getItem("timsLevelStudio") || "{}") || {}; } catch (e) { return {}; } },

    save: function() {
        var all = this.savedAll();
        var name = (this.doc.name || "My Level").trim();
        this.doc.name = name;
        all[name] = this.doc;
        try { localStorage.setItem("timsLevelStudio", JSON.stringify(all)); } catch (e) { return this.say("Could not save (storage full?)"); }
        // also list it as a playable level everywhere
        var key = "studio_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        LevelManager.customLevels[key] = this.docToDef(this.doc);
        try { localStorage.setItem("timsZombieGameCustomLevels", JSON.stringify(LevelManager.customLevels)); } catch (e) {}
        if (typeof SummonManager !== "undefined" && SummonManager.refreshLevelDropdown) SummonManager.refreshLevelDropdown();
        this.say("Saved \"" + name + "\" — also in the level list");
        this.renderTop();
    },

    load: function(name) {
        var d = this.savedAll()[name];
        if (!d) return;
        this.pushUndo();
        this.doc = this.withIds(JSON.parse(JSON.stringify(d)));
        this.sel = [];
        this.rebuild(); this.frameAll(); this.renderAll();
        this.say("Loaded \"" + name + "\"");
    },

    removeSaved: function(name) {
        var all = this.savedAll();
        delete all[name];
        try { localStorage.setItem("timsLevelStudio", JSON.stringify(all)); } catch (e) {}
        var key = "studio_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        delete LevelManager.customLevels[key];
        try { localStorage.setItem("timsZombieGameCustomLevels", JSON.stringify(LevelManager.customLevels)); } catch (e) {}
        this.say("Deleted \"" + name + "\"");
        this.renderTop();
    },

    exportJSON: function() {
        var data = JSON.stringify({ format: "tims-level-studio", version: 1, doc: this.doc }, null, 1);
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
        a.download = (this.doc.name || "level").replace(/[^a-z0-9_-]+/gi, "_") + ".level.json";
        document.body.appendChild(a); a.click(); a.remove();
        this.say("Exported " + a.download);
    },

    importJSON: function(file) {
        var self = this;
        var r = new FileReader();
        r.onload = function() {
            try {
                var j = JSON.parse(r.result);
                var d = j.doc || j;
                if (!d || !Array.isArray(d.ents)) throw new Error("not a Level Studio file");
                self.pushUndo();
                self.doc = self.withIds({ name: String(d.name || "Imported"), mode: d.mode || "survival", waves: !!d.waves, ents: d.ents.filter(function(e) { return e && typeof e.x === "number" && typeof e.y === "number" && e.cat; }) });
                self.sel = [];
                self.rebuild(); self.frameAll(); self.renderAll();
                self.say("Imported \"" + self.doc.name + "\"");
            } catch (e) { self.say("Import failed: " + e.message); }
        };
        r.readAsText(file);
    },

    // ------------------------------------------------------------------ input
    onMouseDown: function(e) {
        if (!this.isOpen) return false;
        if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left, my = e.clientY - rect.top;
        var w = this.toWorld(mx, my);
        if (e.button === 1 || e.button === 2 || this.keys.Space) { this.drag = { kind: "pan", mx: mx, my: my, cx: this.cam.x, cy: this.cam.y }; return true; }
        if (this.tool === "place" && this.tpl) { this.place(w[0], w[1]); return true; }
        var h = this.handleAt(mx, my);
        if (h) {
            var bb = this.bbox(this.sel[0]);
            this.pushUndo();
            this.drag = { kind: "resize", h: h.id, e: this.sel[0], l: bb.x - bb.w / 2, r: bb.x + bb.w / 2, b: bb.y - bb.h / 2, t: bb.y + bb.h / 2 };
            return true;
        }
        var hit = this.hitTest(w[0], w[1]);
        if (hit) {
            if (e.shiftKey) {
                var i = this.sel.indexOf(hit);
                if (i === -1) this.sel.push(hit); else this.sel.splice(i, 1);
            } else if (this.sel.indexOf(hit) === -1) this.sel = [hit];
            this.pushUndo();
            this.drag = { kind: "move", sx: w[0], sy: w[1], start: this.sel.map(function(o) { return [o, o.x, o.y]; }), moved: false };
        } else {
            if (!e.shiftKey) this.sel = [];
            this.drag = { kind: "box", sx: w[0], sy: w[1], add: e.shiftKey, base: this.sel.slice() };
        }
        this.renderInspector();
        return true;
    },

    onMouseMove: function(e) {
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left, my = e.clientY - rect.top;
        this.mouse.x = mx; this.mouse.y = my;
        var w = this.toWorld(mx, my);
        this.mouse.wx = w[0]; this.mouse.wy = w[1];
        var d = this.drag;
        if (!d) return;
        if (d.kind === "pan") {
            this.cam.x = d.cx - (mx - d.mx) / this.cam.z;
            this.cam.y = d.cy + (my - d.my) / this.cam.z;
        } else if (d.kind === "move") {
            var dx = this.snapV(w[0] - d.sx), dy = this.snapV(w[1] - d.sy);
            for (let i = 0; i < d.start.length; i++) { d.start[i][0].x = d.start[i][1] + dx; d.start[i][0].y = d.start[i][2] + dy; }
            if (dx || dy) d.moved = true;
            this.rebuild();
        } else if (d.kind === "resize") {
            var l = d.l, r = d.r, b = d.b, t = d.t;
            var sx = this.snapV(w[0]), sy = this.snapV(w[1]);
            if (d.h.indexOf("r") !== -1) r = Math.max(l + 20, sx);
            if (d.h.indexOf("l") !== -1) l = Math.min(r - 20, sx);
            if (d.h.indexOf("t") !== -1) t = Math.max(b + 20, sy);
            if (d.h.indexOf("b") !== -1) b = Math.min(t - 20, sy);
            this.setBox(d.e, l, r, b, t);
            this.rebuild();
        } else if (d.kind === "box") {
            d.ex = w[0]; d.ey = w[1];
            var L = Math.min(d.sx, d.ex), R = Math.max(d.sx, d.ex), B = Math.min(d.sy, d.ey), T = Math.max(d.sy, d.ey);
            var self = this;
            this.sel = d.base.slice();
            this.doc.ents.forEach(function(o) {
                var bb = self.bbox(o);
                if (bb.w > 6000) return;            // don't sweep up the whole floor
                if (bb.x - bb.w / 2 >= L && bb.x + bb.w / 2 <= R && bb.y - bb.h / 2 >= B && bb.y + bb.h / 2 <= T && self.sel.indexOf(o) === -1) self.sel.push(o);
            });
        }
    },

    onMouseUp: function() {
        var d = this.drag;
        this.drag = null;
        if (!d) return;
        if (d.kind === "move" && !d.moved) this.undoStack.pop();
        if (d.kind === "move" || d.kind === "resize") this.changed();
        if (d.kind === "box") this.renderInspector();
    },

    onWheel: function(e) {
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left, my = e.clientY - rect.top;
        var before = this.toWorld(mx, my);
        this.cam.z = Math.max(0.04, Math.min(2.5, this.cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        this.applyCamera();
        var after = this.toWorld(mx, my);
        this.cam.x += before[0] - after[0];
        this.cam.y += before[1] - after[1];
    },

    onKey: function(e, down) {
        var c = e.code;
        if (!down) { this.keys[c === "Space" ? "Space" : c] = false; return; }
        var ctrl = e.ctrlKey || e.metaKey;
        if (this.startShown()) { if (c === "KeyB" || c === "Escape") { this.close(); e.preventDefault(); } return; }
        if (c === "Space") { this.keys.Space = true; e.preventDefault(); return; }
        if (c === "Tab") { this.togglePanels(); e.preventDefault(); return; }
        this.keys[c] = true;
        if (ctrl && c === "KeyZ") { if (e.shiftKey) this.redo(); else this.undo(); }
        else if (ctrl && c === "KeyY") this.redo();
        else if (ctrl && c === "KeyD") this.duplicateSel();
        else if (ctrl && c === "KeyC") this.copySel();
        else if (ctrl && c === "KeyV") this.paste();
        else if (ctrl && c === "KeyS") this.save();
        else if (ctrl && c === "KeyA") { this.sel = this.doc.ents.slice(); this.renderInspector(); }
        else if (c === "Delete" || c === "Backspace") this.deleteSel();
        else if (c === "Escape") { if (this.tool === "place") { this.tool = "select"; this.tpl = null; this.renderPalette(); } else { this.sel = []; this.renderInspector(); } }
        else if (c === "KeyR") this.rotateSel();
        else if (c === "KeyF") this.flipSel();
        else if (c === "KeyG") { this.snap = !this.snap; this.say("Grid snap " + (this.snap ? "ON (" + this.grid + ")" : "OFF")); this.renderTop(); }
        else if (c === "KeyH") this.frameAll();
        else if (c === "KeyP" || c === "F5") this.playtest();
        else if (c === "KeyB") this.close();
        else if (c.indexOf("Arrow") === 0 && this.sel.length) {
            this.pushUndo();
            var st = e.shiftKey ? this.grid * 4 : this.grid;
            this.moveSel(c === "ArrowLeft" ? -st : c === "ArrowRight" ? st : 0, c === "ArrowDown" ? -st : c === "ArrowUp" ? st : 0);
            this.changed(true);
        } else return;
        e.preventDefault();
    },

    // ------------------------------------------------------------------ per-frame (replaces the game tick)
    applyCamera: function() {
        cameraScaleX = cameraScaleY = this.cam.z;
        cameraTargetX = this.cam.x; cameraTargetY = this.cam.y;
        var lw = this.lw || 0, rw = this.rw || 0;
        xc = lw + (cssW - lw - rw) / 2 - this.cam.x * this.cam.z;
        yc = 48 + (cssH - 48) / 2 + this.cam.y * this.cam.z;
    },

    // ---- gamepad editing (first connected pad): a world cursor, A place / select / hold to drag, B delete / cancel,
    //      X rotate, Y play-test, LB/RB palette, LT/RT zoom, right stick pan, Start save, Back close
    padTick: function() {
        var gps = (navigator.getGamepads && navigator.getGamepads()) || [], g = null;
        for (let i = 0; i < gps.length; i++) if (gps[i] && gps[i].connected) { g = gps[i]; break; }
        if (!g) { this.pad = null; return; }
        var B = function(i) { return !!(g.buttons[i] && g.buttons[i].pressed); }, pv = this.padPrev || {}, now = {}, edge = function(i) { now[i] = B(i); return now[i] && !pv[i]; };
        for (let i = 0; i < 16; i++) now[i] = B(i);
        var dz = function(v) { return Math.abs(v) < 0.2 ? 0 : v; };
        if (!this.pad) { this.pad = { x: this.cam.x, y: this.cam.y }; this.say("🎮 Gamepad editing: stick moves the cursor · A place / select (hold to drag) · B delete · LB/RB pieces · Y play-test"); }
        var c = this.pad, z = this.cam.z, sp = 9 / z;
        var mx = dz(g.axes[0] || 0) + (B(15) ? 1 : 0) - (B(14) ? 1 : 0), my = -dz(g.axes[1] || 0) + (B(12) ? 1 : 0) - (B(13) ? 1 : 0);
        c.x += mx * sp; c.y += my * sp;
        this.cam.x += dz(g.axes[2] || 0) * 14 / z; this.cam.y -= dz(g.axes[3] || 0) * 14 / z;
        // keep the cursor on screen: the camera follows it near the edges
        var vw = (cssW - (this.lw || 0) - (this.rw || 0)) / 2 / z * 0.8, vh = (cssH - 48) / 2 / z * 0.8;
        if (c.x > this.cam.x + vw) this.cam.x = c.x - vw; if (c.x < this.cam.x - vw) this.cam.x = c.x + vw;
        if (c.y > this.cam.y + vh) this.cam.y = c.y - vh; if (c.y < this.cam.y - vh) this.cam.y = c.y + vh;
        if (B(6)) this.cam.z = Math.max(0.15, this.cam.z * 0.98); if (B(7)) this.cam.z = Math.min(2.5, this.cam.z * 1.02);
        this.mouse = this.mouse || {}; this.mouse.wx = c.x; this.mouse.wy = c.y;
        // A: place, or select what's under the cursor and drag it while held
        if (edge(0)) {
            if (this.tool === "place" && this.tpl) this.place(c.x, c.y);
            else { var hit = this.hitTest(c.x, c.y); this.sel = hit ? [hit] : []; if (hit) { this.pushUndo(); this.padDrag = { x: c.x, y: c.y, start: [hit.x, hit.y] }; } this.renderInspector(); }
        }
        if (this.padDrag && B(0) && this.sel.length) { var e = this.sel[0]; e.x = this.padDrag.start[0] + this.snapV(c.x - this.padDrag.x); e.y = this.padDrag.start[1] + this.snapV(c.y - this.padDrag.y); this.padMoved = true; }
        if (this.padDrag && !B(0)) { this.padDrag = null; if (this.padMoved) { this.padMoved = false; this.changed(true); } }
        if (edge(1)) { if (this.tool === "place") { this.tool = "select"; this.tpl = null; this.renderPalette(); } else this.deleteSel(); }
        if (edge(2)) this.rotateSel();
        if (edge(3)) this.playtest();
        if (edge(4) || edge(5)) {
            var refs = this.paletteRefs || [], cur = refs.findIndex(function(p) { return p && p[0] === Studio.tplLabel; });
            var nx = (cur + (now[5] ? 1 : -1) + refs.length) % Math.max(1, refs.length), p = refs[nx];
            if (p) { this.tool = "place"; this.tpl = p[2]; this.tplLabel = p[0]; this.sel = []; this.renderPalette(); this.renderInspector(); this.say("Piece: " + p[0]); }
        }
        if (edge(9)) this.save();
        if (edge(8)) { this.padPrev = now; this.close(); return; }
        this.padPrev = now;
    },
    drawPadCursor: function() {
        if (!this.pad) return;
        var x = wsx(this.pad.x), y = wsy(this.pad.y);
        ctx.strokeStyle = "#fde047"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y); ctx.moveTo(x, y - 14); ctx.lineTo(x, y + 14); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.stroke();
    },

    tick: function() {
        this.padTick();
        // pan with WASD (when not typing)
        var sp = 14 / this.cam.z;
        if (!this.sel.length || !this.drag) {
            if (this.keys.KeyA) this.cam.x -= sp; if (this.keys.KeyD) this.cam.x += sp;
            if (this.keys.KeyW) this.cam.y += sp; if (this.keys.KeyS) this.cam.y -= sp;
        }
        this.applyCamera();
        ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.fillStyle = "#0b1220"; ctx.fillRect(0, 0, cssW, cssH);
        try { if (typeof BackgroundMosaic !== "undefined") BackgroundMosaic.draw(ctx); } catch (e) {}
        this.drawGrid();
        for (let i = 0; i < staticObjects.length; i++) { try { staticObjects[i].staticObject(); } catch (e) {} }
        try { Gadgets.tick++; Gadgets.draw(); } catch (e) {}
        for (let i = 0; i < movingObjects.length; i++) { try { var o = movingObjects[i]; Polygon.create(o.poly, o.color, o); o.drawDecorations(); } catch (e) {} }
        for (let i = 0; i < zombies.length; i++) { try { zombies[i].createCharacter(); } catch (e) {} }
        this.drawMarkers();
        this.drawSelection();
        this.drawPadCursor();
        this.drawHint();
        if (this.toastT > 0) this.toastT--;
    },

    drawGrid: function() {
        var z = this.cam.z, g = this.grid;
        while (g * z < 10) g *= 2;
        var l = (0 - xc) / z, r = (cssW - xc) / z, t = yc / z, b = (yc - cssH) / z;
        ctx.save();
        ctx.lineWidth = 1;
        for (var x = Math.floor(l / g) * g; x <= r; x += g) {
            ctx.strokeStyle = (Math.round(x / g) % 10 === 0) ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.08)";
            ctx.beginPath(); ctx.moveTo(wsx(x), 0); ctx.lineTo(wsx(x), cssH); ctx.stroke();
        }
        for (var y = Math.floor(b / g) * g; y <= t; y += g) {
            ctx.strokeStyle = (Math.round(y / g) % 10 === 0) ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.08)";
            ctx.beginPath(); ctx.moveTo(0, wsy(y)); ctx.lineTo(cssW, wsy(y)); ctx.stroke();
        }
        ctx.strokeStyle = "rgba(250,204,21,0.35)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(wsx(0), 0); ctx.lineTo(wsx(0), cssH); ctx.moveTo(0, wsy(0)); ctx.lineTo(cssW, wsy(0)); ctx.stroke();
        ctx.restore();
    },

    drawMarkers: function() {
        var z = this.cam.z, self = this;
        ctx.save();
        // links: activators -> doors / movers
        var byId = {};
        this.doc.ents.forEach(function(e) { if (e.cat === "gadget" && e.id) byId[e.id] = e; });
        ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(125,211,252,0.8)";
        this.doc.ents.forEach(function(e) {
            if (e.cat !== "gadget" || !e.links || !e.links.length) return;
            e.links.forEach(function(id) { var t = byId[id]; if (!t) return; ctx.beginPath(); ctx.moveTo(wsx(e.x), wsy(e.y)); ctx.lineTo(wsx(t.x), wsy(t.y)); ctx.stroke(); });
        });
        // mover paths
        ctx.strokeStyle = "rgba(192,132,252,0.9)";
        this.doc.ents.forEach(function(e) {
            if (e.cat !== "gadget" || e.type !== "mover") return;
            var x2 = e.x + (e.dx2 || 0), y2 = e.y + (e.dy2 || 0);
            ctx.beginPath(); ctx.moveTo(wsx(e.x), wsy(e.y)); ctx.lineTo(wsx(x2), wsy(y2)); ctx.stroke();
            ctx.strokeRect(wsx(x2 - e.w / 2), wsy(y2 + e.h / 2), e.w * z, e.h * z);
        });
        ctx.setLineDash([]);
        // items + spawns
        this.doc.ents.forEach(function(e) {
            var sx = wsx(e.x), sy = wsy(e.y);
            if (e.cat === "item") {
                var def = (typeof PowerUpDefs !== "undefined" && PowerUpDefs[e.power]) || { icon: "?", color: "#fff" };
                ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(sx, sy, 28 * z + 4, 0, 7); ctx.fill();
                ctx.fillStyle = "#0a0f16"; ctx.font = "800 " + Math.round(22 * z + 8) + "px " + UI_FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(def.icon || "?", sx, sy + 1);
            } else if (e.cat === "wtrap" || e.cat === "wfinish") {
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                if (e.cat === "wfinish") {
                    ctx.fillStyle = "#f8fafc"; ctx.fillRect(sx - 4, sy - 300 * z, 8, 300 * z);
                    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { ctx.fillStyle = (r + c) % 2 ? "#0a0f16" : "#f8fafc"; ctx.fillRect(sx + 4 + c * 14 * z, sy - 300 * z + r * 14 * z, 14 * z, 14 * z); }
                } else if (e.kind === "mine") { ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(sx, sy - 12 * z, 22 * z + 3, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "900 " + Math.round(18 * z + 6) + "px " + UI_FONT; ctx.fillText("!", sx, sy - 12 * z); }
                else if (e.kind === "log") { ctx.strokeStyle = "#a8a29e"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, wsy(2400)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#78350f"; ctx.beginPath(); ctx.arc(sx, sy, 60 * z, 0, 7); ctx.fill(); }
                else { var n = Math.max(2, Math.round((e.w || 200) / 40)); ctx.fillStyle = "#e2e8f0"; for (let i = 0; i < n; i++) { var bx = sx - (e.w || 200) * z / 2 + i * (e.w || 200) * z / n; ctx.beginPath(); ctx.moveTo(bx, sy); ctx.lineTo(bx + (e.w || 200) * z / n / 2, sy - 30 * z); ctx.lineTo(bx + (e.w || 200) * z / n, sy); ctx.fill(); } }
            } else if (e.cat === "spawn") {
                var col = e.player === 2 ? "#3da5ff" : "#ff4d52";
                ctx.fillStyle = col; ctx.globalAlpha = 0.85;
                ctx.fillRect(sx - 35 * z, sy - 45 * z, 70 * z, 90 * z);
                ctx.globalAlpha = 1; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(sx - 35 * z, sy - 45 * z, 70 * z, 90 * z);
                ctx.fillStyle = "#fff"; ctx.font = "900 " + Math.round(26 * z + 8) + "px " + UI_FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("P" + e.player, sx, sy);
            }
        });
        ctx.textBaseline = "alphabetic";
        ctx.restore();
    },

    drawSelection: function() {
        var self = this, z = this.cam.z;
        ctx.save();
        // hover
        if (!this.drag && this.tool === "select") {
            var hv = this.hitTest(this.mouse.wx, this.mouse.wy);
            if (hv && this.sel.indexOf(hv) === -1) { var hb = this.bbox(hv); ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 2; ctx.strokeRect(wsx(hb.x - hb.w / 2), wsy(hb.y + hb.h / 2), hb.w * z, hb.h * z); }
        }
        ctx.setLineDash([7, 4]); ctx.lineWidth = 2.5; ctx.strokeStyle = "#facc15";
        this.sel.forEach(function(e) { var bb = self.bbox(e); ctx.strokeRect(wsx(bb.x - bb.w / 2) - 3, wsy(bb.y + bb.h / 2) - 3, bb.w * z + 6, bb.h * z + 6); });
        ctx.setLineDash([]);
        if (this.sel.length === 1) {
            var hs = this.handles(this.sel[0]);
            for (let i = 0; i < hs.length; i++) { ctx.fillStyle = "#facc15"; ctx.fillRect(hs[i].sx - 6, hs[i].sy - 6, 12, 12); ctx.strokeStyle = "#0a0f16"; ctx.strokeRect(hs[i].sx - 6, hs[i].sy - 6, 12, 12); }
        }
        if (this.drag && this.drag.kind === "box" && this.drag.ex !== undefined) {
            var d = this.drag;
            ctx.fillStyle = "rgba(250,204,21,0.08)"; ctx.strokeStyle = "rgba(250,204,21,0.8)"; ctx.lineWidth = 1.5;
            var x0 = wsx(Math.min(d.sx, d.ex)), y0 = wsy(Math.max(d.sy, d.ey));
            ctx.fillRect(x0, y0, Math.abs(d.ex - d.sx) * z, Math.abs(d.ey - d.sy) * z);
            ctx.strokeRect(x0, y0, Math.abs(d.ex - d.sx) * z, Math.abs(d.ey - d.sy) * z);
        }
        // ghost of the piece being placed
        if (this.tool === "place" && this.tpl) {
            var g = JSON.parse(JSON.stringify(this.tpl)); g.x = 0; g.y = 0;
            var gb = this.bbox(g);
            var l = this.snapV(this.mouse.wx - gb.w / 2), b = this.snapV(this.mouse.wy - gb.h / 2);
            ctx.fillStyle = "rgba(125,211,252,0.25)"; ctx.strokeStyle = "#7dd3fc"; ctx.lineWidth = 2;
            ctx.fillRect(wsx(l), wsy(b + gb.h), gb.w * z, gb.h * z); ctx.strokeRect(wsx(l), wsy(b + gb.h), gb.w * z, gb.h * z);
            uiText(this.tplLabel, wsx(l + gb.w / 2), wsy(b + gb.h) - 8, 12, "#7dd3fc", "center", "800");
        }
        ctx.restore();
    },

    drawHint: function() {
        var lw = this.lw || 0, aw = cssW - lw - (this.rw || 0) - 24, midX = lw + (cssW - lw - (this.rw || 0)) / 2;
        // fit a line into the editing area: shrink a little, else fall back to the shorter wording
        var fit = function(long, short, y, size, color, weight) {
            ctx.save(); ctx.font = weight + " " + size + "px " + UI_FONT;
            var t = long, wdt = ctx.measureText(t).width;
            if (wdt > aw && short) { t = short; wdt = ctx.measureText(t).width; }
            ctx.restore();
            uiText(t, midX, y, wdt > aw ? Math.max(9, Math.floor(size * aw / wdt)) : size, color, "center", weight);
        };
        var tool = this.tool === "place" ? ("Placing: " + this.tplLabel + " — click to place, Esc to stop") : "Select: click · Shift+click adds · drag empty space to box-select · drag handles to resize";
        fit(tool, this.tool === "place" ? "Placing " + this.tplLabel + " · Esc stops" : "Click selects · Shift adds · drag to box-select", cssH - 34, 13, "#e2e8f0", "800");
        if (this.pad) fit("🎮 stick cursor · right stick pan · A place / select (hold = drag) · B delete / cancel · X rotate · LB/RB pieces · LT/RT zoom · Y play-test · Start save · Back close",
                          "🎮 A place/select · B delete · X rotate · LB/RB pieces · Y test", cssH - 14, 11, "rgba(253,224,71,0.85)", "700");
        else fit("Right/middle-drag or WASD pan · wheel zoom · Del delete · Ctrl+D duplicate · Ctrl+C/V · Ctrl+Z/Y · R rotate · F flip ramp · G grid · H frame all · Tab panels · P play-test",
                 "WASD pan · wheel zoom · Del · Ctrl+Z · R rotate · H frame · Tab panels · P test", cssH - 14, 11, "rgba(203,213,225,0.75)", "700");
        if (this.toastT > 0) {
            ctx.save(); ctx.globalAlpha = Math.min(1, this.toastT / 30);
            fit(this.toast, null, 80, 18, "#facc15", "900");
            ctx.restore();
        }
    },

    // ------------------------------------------------------------------ DOM UI
    buildUI: function() {
        if (this.ui) { this.ui.root.style.display = "block"; this.layout(); return; }
        var css = document.createElement("style");
        css.textContent =
            "body.studio-open #top-right-bar, body.studio-open #level-select-dropdown { display:none !important }" +
            "#mario-maker-dock { display:none !important }" +
            "#studio-root{position:fixed;inset:0;pointer-events:none;z-index:1500;font-family:'Segoe UI',Arial,sans-serif;color:#e2e8f0;--lw:210px;--rw:280px}" +
            "#studio-root.nopanels{--lw:0px;--rw:0px}#studio-root.nopanels #studio-left,#studio-root.nopanels #studio-right{display:none}" +
            "#studio-top .narrow{display:none}#st-name{width:130px}#st-mode{max-width:200px}" +
            "@media (max-width:980px){#studio-root{--lw:172px;--rw:228px}#studio-top .wide{display:none}#studio-top .narrow{display:inline}#st-name{width:96px}#st-mode{max-width:130px}#studio-top{gap:4px;padding:0 6px}}" +
            "#studio-root>div{pointer-events:auto;background:rgba(15,23,42,.96);border-color:#334155;border-style:solid}" +
            "#studio-top{position:absolute;left:0;right:0;top:0;height:48px;border-width:0 0 1px;display:flex;align-items:center;gap:6px;padding:0 10px;white-space:nowrap}" +
            "#studio-top .sep{width:1px;height:26px;background:#334155;margin:0 2px}#studio-top .grow{flex:1}" +
            "#studio-left{position:absolute;left:0;top:48px;bottom:0;width:var(--lw);box-sizing:border-box;border-width:0 1px 0 0;overflow-y:auto;padding:8px}" +
            "#studio-right{position:absolute;right:0;top:48px;bottom:0;width:var(--rw);box-sizing:border-box;border-width:0 0 0 1px;overflow-y:auto;padding:10px}" +
            "#studio-root button,#studio-root select,#studio-root input{font:inherit;font-size:13px}" +
            "#studio-root button{background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:7px;padding:5px 9px;cursor:pointer}" +
            "#studio-root button:hover{background:#334155}#studio-root button.on{background:#2563eb;border-color:#60a5fa}" +
            "#studio-root button.go{background:#16a34a;border-color:#4ade80;font-weight:800}#studio-root button.go:hover{background:#15803d}" +
            "#studio-root button.back{background:#0e7490;border-color:#22d3ee;font-weight:800}" +
            "#studio-root select,#studio-root input{background:#0b1220;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:4px 6px}" +
            "#studio-left h4{margin:10px 2px 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;cursor:pointer}" +
            "#studio-left .pi{display:flex;align-items:center;gap:7px;width:100%;text-align:left;margin:2px 0;padding:5px 7px}" +
            "#studio-left .pf{width:100%;box-sizing:border-box;margin:0 0 4px}" +
            "#studio-right label{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:5px 0;font-size:12px;color:#cbd5e1}" +
            "#studio-right label input,#studio-right label select{width:58%;box-sizing:border-box}#studio-right label input[type=checkbox]{width:auto}" +
            "#studio-right h3{margin:4px 0 8px;font-size:15px}#studio-right .muted,#studio-start .muted{color:#94a3b8;font-size:12px;line-height:1.45}" +
            "#studio-file{position:absolute;top:46px;display:none;flex-direction:column;min-width:240px;max-height:70vh;overflow-y:auto;border-width:1px;border-radius:10px;padding:6px;box-shadow:0 12px 30px rgba(0,0,0,.5)}" +
            "#studio-file button{text-align:left;border:0 !important;background:transparent !important;padding:7px 9px !important;border-radius:6px !important;display:flex;justify-content:space-between;gap:14px}" +
            "#studio-file button:hover{background:#1e3a5f !important}#studio-file small{color:#94a3b8}#studio-file .fh{font-size:11px;color:#94a3b8;letter-spacing:.08em;text-transform:uppercase;margin:6px 8px 2px}" +
            "#studio-file .fr{display:flex}#studio-file .fr button:first-child{flex:1}" +
            "#studio-start{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(3,7,18,.72) !important;border:0 !important}" +
            "#studio-start .ss-card{width:min(460px,92vw);max-height:88vh;overflow-y:auto;background:#0f172a;border:1px solid #22d3ee;border-radius:14px;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.6)}" +
            "#studio-start h2{margin:0 0 4px;color:#facc15;font-size:22px}" +
            "#studio-start .sc{display:block;width:100%;text-align:left;margin:8px 0;padding:10px 12px !important}#studio-start .sc b{display:block;font-size:15px}#studio-start .sc span{color:#94a3b8;font-size:12px}" +
            "#studio-start .ss-saved{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}#studio-start .ss-saved .muted{width:100%}" +
            "#studio-start .ss-foot{margin-top:14px;text-align:right}" +
            "#studio-testbar{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:1600;background:#16a34a;color:#fff;border:0;border-radius:8px;padding:8px 14px;font:800 14px 'Segoe UI',Arial;cursor:pointer;display:none}";
        document.head.appendChild(css);
        var root = document.createElement("div");
        root.id = "studio-root";
        root.innerHTML = "<div id='studio-top'></div><div id='studio-left'></div><div id='studio-right'></div><div id='studio-file'></div><div id='studio-start'></div>";
        var stop = function(e) { e.stopPropagation(); };
        ["mousedown", "mouseup", "click", "wheel", "keydown", "keyup"].forEach(function(ev) { root.addEventListener(ev, stop); });
        document.body.appendChild(root);
        this.ui = { root: root, top: root.querySelector("#studio-top"), left: root.querySelector("#studio-left"), right: root.querySelector("#studio-right"),
                    file: root.querySelector("#studio-file"), start: root.querySelector("#studio-start"), collapsed: {} };
        var self = this;
        // clicking anywhere else closes the File menu
        window.addEventListener("mousedown", function(e) { if (self.ui.file.style.display === "flex" && !self.ui.file.contains(e.target) && e.target.id !== "st-file-btn") self.ui.file.style.display = "none"; }, true);
        window.addEventListener("resize", function() { self.layout(); });
        // power-up items for the palette
        var items = STUDIO_PALETTE.filter(function(c) { return c[0] === "Items"; })[0];
        if (items && !items[1].length && typeof PowerUpDefs !== "undefined") for (var k in PowerUpDefs) items[1].push([PowerUpDefs[k].label.toLowerCase(), PowerUpDefs[k].icon, { cat: "item", power: k }]);
        this.layout();
    },

    // side panel widths (they shrink on small windows and hide with Tab) drive the editing camera
    layout: function() {
        if (!this.ui) return;
        this.lw = this.ui.left.offsetParent ? this.ui.left.offsetWidth : 0;
        this.rw = this.ui.right.offsetParent ? this.ui.right.offsetWidth : 0;
    },
    togglePanels: function() { this.ui.root.classList.toggle("nopanels"); this.layout(); this.say(this.ui.root.classList.contains("nopanels") ? "Panels hidden (Tab shows them)" : "Panels shown"); },

    renderAll: function() { this.renderTop(); this.renderPalette(); this.renderInspector(); },
    renderStatus: function() {},

    renderTop: function() {
        if (!this.ui) return;
        var d = this.doc, self = this;
        var esc = function(s) { return String(s).replace(/[&<>"']/g, function(c) { return "&#" + c.charCodeAt(0) + ";"; }); };
        var gameName = (GameModes.current && GameModes.current.title) || "game";
        var h = "<b style='color:#facc15'>🛠<span class='wide'> STUDIO</span></b>" +
            "<input id='st-name' value='" + esc(d.name) + "' title='Level name'>" +
            "<select id='st-mode' title='Game rules: which game this level plays as'>" + STUDIO_MODES.map(function(m) { return "<option value='" + m[0] + "'" + (d.mode === m[0] ? " selected" : "") + ">" + m[1] + "</option>"; }).join("") + "</select>" +
            "<label title='Zombie waves on/off' style='font-size:12px'><input type='checkbox' id='st-waves'" + (d.waves ? " checked" : "") + "><span class='wide'> waves</span><span class='narrow'>🧟</span></label>" +
            "<span class='sep'></span>" +
            "<button class='go' id='st-play' title='Play it now (P). Come back with ` or the green button.'>▶<span class='wide'> Play-test</span><span class='narrow'> Test</span></button>" +
            "<span class='sep'></span>" +
            "<button id='st-undo' title='Undo (Ctrl+Z)'>↶</button><button id='st-redo' title='Redo (Ctrl+Y)'>↷</button>" +
            "<select id='st-grid' title='Snap to grid (G toggles)'><option value='0'" + (this.snap ? "" : " selected") + ">Snap off</option>" + [10, 20, 40, 80, 160].map(function(g) { return "<option value='" + g + "'" + (self.snap && g === self.grid ? " selected" : "") + ">Grid " + g + "</option>"; }).join("") + "</select>" +
            "<button id='st-file-btn' title='New, open, save, export, import'>📁<span class='wide'> File</span> ▾</button>" +
            "<button id='st-panels' title='Hide / show the side panels (Tab)'>◫</button>" +
            "<span class='grow'></span>" +
            "<button class='back' id='st-close' title='Close the Studio and carry on playing " + esc(gameName) + " (B)'>◀ Back<span class='wide'> to the game</span></button>";
        this.ui.top.innerHTML = h;
        var $ = function(id) { return document.getElementById(id); };
        $("st-name").onchange = function() { self.pushUndo(); self.doc.name = this.value; self.autosave(); };
        $("st-mode").onchange = function() { self.pushUndo(); self.doc.mode = this.value; self.changed(); self.renderPalette(); this.blur(); };
        $("st-waves").onchange = function() { self.pushUndo(); self.doc.waves = this.checked; self.autosave(); };
        $("st-play").onclick = function() { self.playtest(); };
        $("st-undo").onclick = function() { self.undo(); };
        $("st-redo").onclick = function() { self.redo(); };
        $("st-grid").onchange = function() { var g = Number(this.value); self.snap = g > 0; if (g) self.grid = g; this.blur(); };
        $("st-file-btn").onclick = function() { self.toggleFile(this); };
        $("st-panels").onclick = function() { self.togglePanels(); };
        $("st-close").onclick = function() { self.close(); };
    },

    toggleFile: function(btn) {
        var m = this.ui.file, self = this;
        if (m.style.display === "flex") { m.style.display = "none"; return; }
        var esc = function(s) { return String(s).replace(/[&<>"']/g, function(c) { return "&#" + c.charCodeAt(0) + ";"; }); };
        var saved = window.Object.keys(this.savedAll());
        var cur = LevelManager.getAllLevels()[this.prevLevelKey] || {};
        var it = function(id, label, key) { return "<button id='" + id + "'><span>" + label + "</span><small>" + (key || "") + "</small></button>"; };
        m.innerHTML = "<div class='fh'>Level</div>" +
            it("sf-new", "＋ New blank level") +
            it("sf-cur", "✏ Edit a copy of “" + esc((cur.name || "current level").replace(/^[^A-Za-z0-9]+/, "")) + "”") +
            it("sf-save", "💾 Save “" + esc(this.doc.name) + "”", "Ctrl+S") +
            "<div class='fh'>Saved levels" + (saved.length ? "" : " — none yet") + "</div>" +
            saved.map(function(n, i) { return "<div class='fr'><button data-o='" + i + "'><span>📂 " + esc(n) + "</span></button><button data-d='" + i + "' title='Delete'><span>🗑</span></button></div>"; }).join("") +
            "<div class='fh'>Share</div>" +
            it("sf-export", "⬇ Export as a .json file") + it("sf-import", "⬆ Import a .json file") + "<input type='file' id='st-file' accept='.json,application/json' style='display:none'>" +
            "<div class='fh'>More</div>" +
            it("sf-start", "🏁 Start screen") +
            it("sf-cheats", "🧪 Cheats & tuning panel");
        var r = btn.getBoundingClientRect();
        m.style.left = Math.max(6, Math.min(window.innerWidth - 260, r.left)) + "px";
        m.style.display = "flex";
        var done = function(fn) { return function() { m.style.display = "none"; fn(); }; };
        var $ = function(id) { return document.getElementById(id); };
        $("sf-new").onclick = done(function() { self.pushUndo(); self.doc = self.newDoc(); self.sel = []; self.rebuild(); self.frameAll(); self.renderAll(); self.say("New level (Ctrl+Z brings the old one back)"); });
        $("sf-cur").onclick = done(function() { self.pushUndo(); self.doc = self.docFromLevel(self.prevLevelKey || LevelManager.currentLevelKey); self.sel = []; self.rebuild(); self.frameAll(); self.renderAll(); self.say("Editing a copy of the current level"); });
        $("sf-save").onclick = done(function() { self.save(); });
        m.querySelectorAll("[data-o]").forEach(function(b) { b.onclick = done(function() { self.load(saved[Number(b.dataset.o)]); }); });
        m.querySelectorAll("[data-d]").forEach(function(b) { b.onclick = done(function() { var n = saved[Number(b.dataset.d)]; if (confirm("Delete saved level \"" + n + "\"?")) self.removeSaved(n); }); });
        $("sf-export").onclick = done(function() { self.exportJSON(); });
        $("sf-import").onclick = function() { $("st-file").click(); };
        $("st-file").onchange = function() { if (this.files[0]) self.importJSON(this.files[0]); this.value = ""; m.style.display = "none"; };
        $("sf-start").onclick = done(function() { self.showStart(); });
        $("sf-cheats").onclick = done(function() { if (typeof SummonManager !== "undefined") SummonManager.togglePanel(); });
    },

    renderPalette: function() {
        if (!this.ui) return;
        var self = this, h = "", idx = 0;
        this.paletteRefs = [];
        var q = (this.palFilter || "").toLowerCase().trim();
        STUDIO_PALETTE.forEach(function(cat) {
            if (cat[2] && cat[2].indexOf(self.doc.mode) === -1) return;          // game-specific pieces only for that game
            var list = q ? cat[1].filter(function(p) { return (p[0] + " " + cat[0]).toLowerCase().indexOf(q) !== -1; }) : cat[1];
            if (q && !list.length) return;
            var closed = !q && self.ui.collapsed[cat[0]];
            h += "<h4 data-cat='" + cat[0] + "'>" + (closed ? "▸ " : "▾ ") + cat[0] + "</h4>";
            if (closed) return;
            list.forEach(function(p) {
                var on = self.tool === "place" && self.tplLabel === p[0];
                h += "<button class='pi" + (on ? " on" : "") + "' data-i='" + idx + "'><span>" + p[1] + "</span><span>" + p[0] + "</span></button>";
                self.paletteRefs[idx++] = p;
            });
        });
        var hadFocus = document.activeElement && document.activeElement.id === "st-pfind";
        this.ui.left.innerHTML = "<div style='display:flex;gap:4px;margin-bottom:4px'><button id='st-tool-sel' class='" + (this.tool === "select" ? "on" : "") + "' style='flex:1'>↖ Select</button></div>" +
            "<input id='st-pfind' class='pf' placeholder='🔍 Find a piece…' value='" + String(this.palFilter || "").replace(/'/g, "&#39;") + "'>" +
            (h || "<p class='muted' style='font-size:12px;color:#94a3b8'>No piece matches.</p>");
        document.getElementById("st-tool-sel").onclick = function() { self.tool = "select"; self.tpl = null; self.renderPalette(); };
        var pf = document.getElementById("st-pfind");
        pf.oninput = function() { self.palFilter = this.value; self.renderPalette(); };
        pf.onkeydown = function(e) { if (e.key === "Escape") { self.palFilter = ""; self.renderPalette(); this.blur(); } else if (e.key === "Enter") { var first = self.ui.left.querySelector("button.pi"); if (first) first.click(); this.blur(); } };
        if (hadFocus) { pf.focus(); pf.setSelectionRange(pf.value.length, pf.value.length); }
        this.ui.left.querySelectorAll("button.pi").forEach(function(b) {
            b.onclick = function() { var p = self.paletteRefs[Number(b.dataset.i)]; self.tool = "place"; self.tpl = p[2]; self.tplLabel = p[0]; self.sel = []; self.renderPalette(); self.renderInspector(); };
        });
        this.ui.left.querySelectorAll("h4").forEach(function(h4) {
            h4.onclick = function() { var c = h4.dataset.cat; self.ui.collapsed[c] = !self.ui.collapsed[c]; self.renderPalette(); };
        });
    },

    renderInspector: function() {
        if (!this.ui) return;
        var self = this, esc = function(s) { return String(s).replace(/[&<>"']/g, function(c) { return "&#" + c.charCodeAt(0) + ";"; }); };
        var counts = { layout: 0, gadget: 0, enemy: 0, item: 0, spawn: 0 };
        this.doc.ents.forEach(function(e) { counts[e.cat] = (counts[e.cat] || 0) + 1; });
        var summary = "<p class='muted'>" + counts.layout + " pieces · " + counts.gadget + " gadgets · " + counts.enemy + " enemies · " + counts.item + " items</p>";
        if (this.sel.length !== 1) {
            this.ui.right.innerHTML = "<h3>" + (this.sel.length ? this.sel.length + " selected" : "Nothing selected") + "</h3>" + summary +
                (this.sel.length ? "<p class='muted'>Drag to move them together · Del deletes · Ctrl+D duplicates · R rotates blocks/ramps</p><button id='st-del-sel'>🗑 Delete selection</button>" :
                 "<p class='muted'>Pick a piece on the left, click in the world to place it. Click a piece to edit every property here.</p>" +
                 "<p class='muted'><b>Linking:</b> give a door an <b>id</b>, then put that id in a plate's or lever's <b>links</b>.</p>" +
                 "<p class='muted'><b>Game rules</b> (top bar) decide how the level plays: waves, lives, goals…</p>");
            var ds = document.getElementById("st-del-sel"); if (ds) ds.onclick = function() { self.deleteSel(); };
            return;
        }
        var e = this.sel[0];
        var title = e.cat === "layout" ? (e.name || e.type) : e.cat === "gadget" ? e.type : e.cat === "enemy" ? "Enemy: " + e.power : e.cat === "item" ? "Item: " + e.power : "Player " + e.player + " start";
        var h = "<h3>" + esc(title) + "</h3>" + summary;
        var keys = window.Object.keys(e).filter(function(k) { return k !== "cat" && k !== "_sid" && k !== "type"; });
        // useful optional fields
        var extra = e.cat === "layout" ? ["name", "color", "texture", "kind", "portalable"].concat(e.type === "crate" ? ["weight"] : []) : e.cat === "gadget" ? (({ door: ["id", "need"], plate: ["links"], switch: ["links"], mover: ["id", "needsPower"], sign: ["text"], qblock: ["item"], brick: ["item"] })[e.type] || []) : [];
        extra.forEach(function(k) { if (keys.indexOf(k) === -1) keys.push(k); });
        // position and size first (in pairs), then the rest A-Z with readable names
        var first = ["x", "y", "w", "h"];
        keys.sort(function(a, b) { var ia = first.indexOf(a), ib = first.indexOf(b); if (ia !== -1 || ib !== -1) return (ia === -1 ? 9 : ia) - (ib === -1 ? 9 : ib); return a < b ? -1 : 1; });
        var NAMES = { x: "x", y: "y", w: "width", h: "height", id: "id (links target)", links: "links (door ids)", need: "opens when", power: e.cat === "item" ? "item" : "type",
                      invert: "open until powered", needsPower: "needs power", portalable: "portal surface", kind: "surface", dx2: "travel x", dy2: "travel y", player: "player" };
        var pairs = [];
        if (keys.indexOf("x") !== -1 && keys.indexOf("y") !== -1) pairs.push(["x", "y", "position"]);
        if (keys.indexOf("w") !== -1 && keys.indexOf("h") !== -1) pairs.push(["w", "h", "size"]);
        pairs.forEach(function(pr) {
            h += "<label>" + pr[2] + "<span style='display:flex;gap:4px;width:58%'>" +
                 "<input type='number' id='sti-" + pr[0] + "' value='" + e[pr[0]] + "' title='" + NAMES[pr[0]] + "' style='width:50%'>" +
                 "<input type='number' id='sti-" + pr[1] + "' value='" + e[pr[1]] + "' title='" + NAMES[pr[1]] + "' style='width:50%'></span></label>";
        });
        keys.forEach(function(k) {
            if (pairs.some(function(pr) { return pr[0] === k || pr[1] === k; })) return;
            var v = e[k], id = "sti-" + k, inp;
            if (k === "texture") inp = "<select id='" + id + "'><option value=''>(none)</option>" + STUDIO_TEXTURES.map(function(t) { return "<option" + (v === t ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select>";
            else if (k === "kind") inp = "<select id='" + id + "'>" + ["", "block", "wall", "platform", "stairs", "slope", "slide"].map(function(t) { return "<option value='" + t + "'" + (v === t ? " selected" : "") + ">" + (t || "(auto)") + "</option>"; }).join("") + "</select>";
            else if (k === "dir") inp = "<select id='" + id + "'><option" + (v === "right" ? " selected" : "") + ">right</option><option" + (v === "left" ? " selected" : "") + ">left</option></select>";
            else if (k === "power" && e.cat === "enemy") inp = "<select id='" + id + "'>" + STUDIO_ENEMIES.concat(STUDIO_PLAT_ENEMIES).map(function(t) { return "<option" + (v === t ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select>";
            else if (k === "power" && e.cat === "item") inp = "<select id='" + id + "'>" + window.Object.keys(PowerUpDefs).map(function(t) { return "<option" + (v === t ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select>";
            else if (k === "item") inp = "<select id='" + id + "'>" + ["", "coin", "coins5", "power", "star", "life"].map(function(t) { return "<option value='" + t + "'" + (v === t ? " selected" : "") + ">" + (t || "(none)") + "</option>"; }).join("") + "</select>";
            else if (k === "need") inp = "<select id='" + id + "'><option value=''" + (v !== "all" ? " selected" : "") + ">any linked</option><option value='all'" + (v === "all" ? " selected" : "") + ">all linked</option></select>";
            else if (typeof v === "boolean" || k === "portalable" || k === "invert" || k === "explosive" || k === "needsPower") inp = "<input type='checkbox' id='" + id + "'" + (v ? " checked" : "") + ">";
            else if (typeof v === "number") inp = "<input type='number' id='" + id + "' value='" + v + "' step='" + (k === "speed" || k === "power" ? 0.1 : 1) + "'>";
            else if (Array.isArray(v) || k === "links") inp = "<input id='" + id + "' value='" + esc((v || []).join(", ")) + "' placeholder='door1, door2'>";
            else if (k === "text") inp = "<textarea id='" + id + "' rows='3' style='width:140px;background:#0b1220;color:#e2e8f0;border:1px solid #475569;border-radius:6px'>" + esc(v || "") + "</textarea>";
            else if (k === "color") inp = "<input type='color' id='" + id + "' value='" + (/^#[0-9a-f]{6}$/i.test(v || "") ? v : "#888888") + "'>";
            else inp = "<input id='" + id + "' value='" + esc(v === undefined ? "" : v) + "'>";
            h += "<label>" + esc(NAMES[k] || k) + inp + "</label>";
        });
        h += "<div style='margin-top:10px;display:flex;gap:6px;flex-wrap:wrap'><button id='st-dup'>⧉ Duplicate</button><button id='st-delone'>🗑 Delete</button>" +
             (e.cat === "layout" && (e.type === "ramp" || e.type === "box") ? "<button id='st-rot'>⟳ Rotate</button>" : "") +
             (e.type === "ramp" ? "<button id='st-flip'>⇋ Flip</button>" : "") + "</div>";
        this.ui.right.innerHTML = h;
        keys.forEach(function(k) {
            var el = document.getElementById("sti-" + k);
            if (!el) return;
            el.onchange = function() {
                self.pushUndo();
                var v;
                if (el.type === "checkbox") v = el.checked;
                else if (el.type === "number") v = Number(el.value);
                else if (k === "links") v = el.value.split(/[,\s]+/).filter(Boolean);
                else v = el.value;
                if (v === "" && (k === "texture" || k === "kind" || k === "item" || k === "need")) delete e[k]; else e[k] = v;
                self.changed(true);
                if (el.type !== "text" && el.tagName !== "TEXTAREA") el.blur();
            };
        });
        var b = function(id, fn) { var el = document.getElementById(id); if (el) el.onclick = fn; };
        b("st-dup", function() { self.duplicateSel(); });
        b("st-delone", function() { self.deleteSel(); });
        b("st-rot", function() { self.rotateSel(); self.renderInspector(); });
        b("st-flip", function() { self.flipSel(); self.renderInspector(); });
    }
};

// ---- route mouse / keyboard to the Studio while it is open (capture phase, before the game's handlers)
(function() {
    var typing = function(e) { var t = e.target; return t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA"); };
    window.addEventListener("load", function() {
        canvas.addEventListener("mousedown", function(e) { if (Studio.isOpen) { Studio.onMouseDown(e); e.stopImmediatePropagation(); e.preventDefault(); } }, true);
        canvas.addEventListener("wheel", function(e) { if (Studio.isOpen) { Studio.onWheel(e); e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true, passive: false });
    });
    window.addEventListener("mousemove", function(e) { if (Studio.isOpen) { Studio.onMouseMove(e); e.stopImmediatePropagation(); } }, true);
    window.addEventListener("mouseup", function(e) { if (Studio.isOpen) { Studio.onMouseUp(e); e.stopImmediatePropagation(); } }, true);
    document.addEventListener("keydown", function(e) {
        if (Studio.playtesting && e.code === "Backquote") { Studio.endPlaytest(); e.stopImmediatePropagation(); e.preventDefault(); return; }
        if (!Studio.isOpen || typing(e)) return;
        Studio.onKey(e, true); e.stopImmediatePropagation();
    }, true);
    document.addEventListener("keyup", function(e) { if (Studio.isOpen) { Studio.onKey(e, false); e.stopImmediatePropagation(); } }, true);
})();
