// ============================================================================
// PER-GAME TUNING - what the Cheats & tuning panel's Game tab shows for the game that's on.
//   1. "This game" rows: a mode's own settings, from `mode.tunables()` if it defines one, else GAME_TUNABLES[id].
//      A row: { label, type: "range" | "toggle" | "choice", get(), set(v), min, max, step, options: [[value, label]], note }
//   2. The shared rows only show where they mean something: wave rows need a wave game, world rows need a game with a
//      world (not the full-screen board / table / arena games). See GameTuning.applies().
// ============================================================================
var GAME_TUNABLES = {
    brawl: [
        { label: "Stocks (lives)", type: "range", min: 1, max: 9, step: 1, get: function() { return brawlCfg.stocks; }, set: function(v) { brawlCfg.stocks = v; if (typeof saveBrawlCfg === "function") saveBrawlCfg(); }, note: "next match" },
        { label: "CPU skill", type: "choice", options: [[1, "Easy"], [2, "Normal"], [3, "Hard"]], get: function() { return brawlCfg.cpuLevel; }, set: function(v) { brawlCfg.cpuLevel = v; if (typeof saveBrawlCfg === "function") saveBrawlCfg(); } }
    ],
    sport: [
        { label: "Goals to win", type: "range", min: 1, max: 10, step: 1, get: function() { return sportCfg.goals; }, set: function(v) { sportCfg.goals = v; } },
        { label: "Minutes", type: "range", min: 1, max: 6, step: 1, get: function() { return sportCfg.minutes; }, set: function(v) { sportCfg.minutes = v; }, note: "next match" },
        { label: "CPU skill", type: "choice", options: [[1, "Easy"], [2, "Normal"], [3, "Hard"]], get: function() { return sportCfg.level; }, set: function(v) { sportCfg.level = v; } }
    ],
    table: [
        { label: "CPU skill", type: "choice", options: [[1, "Easy"], [2, "Normal"], [3, "Hard"]], get: function() { return tableCfg.level; }, set: function(v) { tableCfg.level = v; if (typeof saveTable === "function") saveTable(); } }
    ],
    bedwars: [
        { label: "Generator speed", type: "range", min: 0.5, max: 3, step: 0.25, get: function() { return bwCfg.genMult || 1; }, set: function(v) { bwCfg.genMult = v; } }
    ],
    wheels: [
        { label: "Engine power", type: "range", min: 0.5, max: 2.5, step: 0.1, get: function() { return Wheels.powerMult || 1; }, set: function(v) { Wheels.powerMult = v; } }
    ],
    party: [
        { label: "Rounds", type: "range", min: 3, max: 30, step: 1, get: function() { return partyCfg.rounds; }, set: function(v) { partyCfg.rounds = v; } }
    ],
    property: [
        { label: "Rounds", type: "range", min: 5, max: 60, step: 1, get: function() { return rentCfg.rounds; }, set: function(v) { rentCfg.rounds = v; } }
    ],
    creative: [
        { label: "Noclip (fly through walls)", type: "toggle", get: function() { return !!creativeCfg.noclip; }, set: function(v) { creativeCfg.noclip = v; } },
        { label: "Invincible", type: "toggle", get: function() { return !!creativeCfg.invincible; }, set: function(v) { creativeCfg.invincible = v; } }
    ]
};

var GameTuning = {
    rows: function() {
        var m = GameModes.current;
        if (!m) return [];
        if (typeof m.tunables === "function") { try { return m.tunables() || []; } catch (e) { return []; } }
        return GAME_TUNABLES[m.id] || [];
    },
    // which shared rows make sense in the current game
    applies: function(need) {
        var own = GameModes.flag("ownScreen", false);
        if (need === "world") return !own;
        var brawlOn = typeof brawl !== "undefined" && brawl.active;
        if (need === "waves") return !own && GameModes.flag("waves", true) && !brawlOn;
        if (need === "enemies") return !own && !brawlOn && (GameModes.flag("waves", true) || zombies.length > 0);     // games with monsters
        if (need === "coop") return !own && !brawlOn && GameModes.flag("coopToggle", true);
        return true;
    }
};

// Arena simulations do not use Character, so expose and apply cheats to their own players.
var arenaCheats = { god: false, speed: 1, tankSkill: 1 };
try { var savedTankSkill = Number(localStorage.getItem("timsTankDifficulty")); if ([1, 2, 3].indexOf(savedTankSkill) !== -1) arenaCheats.tankSkill = savedTankSkill; } catch (e) {}
function setTankSkill(v) { arenaCheats.tankSkill = Math.max(1, Math.min(3, Number(v) || 1)); try { localStorage.setItem("timsTankDifficulty", String(arenaCheats.tankSkill)); } catch (e) {} }
function arenaHuman(p) { return p && p.human !== undefined; }
function arenaProtected(p) { return arenaHuman(p) && (arenaCheats.god || godMode); }
function arenaSpeed(p) { return arenaHuman(p) ? arenaCheats.speed : 1; }
function arenaRows() { return [
    { label: "Invincible humans", type: "toggle", get: function() { return arenaCheats.god; }, set: function(v) { arenaCheats.god = v; } },
    { label: "Human speed", type: "range", min: 0.5, max: 3, step: 0.25, get: function() { return arenaCheats.speed; }, set: function(v) { arenaCheats.speed = v; } }
]; }
GAME_TUNABLES.snake = arenaRows().concat([
    { label: "Human length", type: "range", min: 14, max: 600, step: 10, get: function() { var w = Snake.worms.find(arenaHuman); return w ? Math.round(w.len) : 24; }, set: function(v) { Snake.worms.filter(arenaHuman).forEach(function(w) { w.len = v; }); } }
]);
GAME_TUNABLES.cells = arenaRows().concat([
    { label: "Human mass", type: "range", min: 20, max: 2000, step: 20, get: function() { var p = Cells.players.find(arenaHuman); return p ? Math.round(Cells.mass(p)) : 20; }, set: function(v) { Cells.players.filter(arenaHuman).forEach(function(p) { var bs = Cells.mine(p); bs.forEach(function(b) { b.m = v / bs.length; }); }); } }
]);
GAME_TUNABLES.tanks = arenaRows().concat([
    { label: "CPU difficulty", type: "choice", options: [[1, "Easy"], [2, "Normal"], [3, "Hard"]], get: function() { return arenaCheats.tankSkill; }, set: function(v) { setTankSkill(v); } },
    { label: "Human stat points", type: "range", min: 0, max: 56, step: 1, get: function() { var k = Tanks.tanks.find(arenaHuman); return k ? k.pts : 0; }, set: function(v) { Tanks.tanks.filter(arenaHuman).forEach(function(k) { k.pts = v; }); } }
]);
GAME_TUNABLES.jetpack = [
    { label: "Invincible runners", type: "toggle", get: function() { return !!Jet.invincible; }, set: function(v) { Jet.invincible = v; } },
    { label: "Banked coins", type: "range", min: 0, max: 2000, step: 50, get: function() { return jetSave.coins; }, set: function(v) { jetSave.coins = v; saveJet(); } }
];
GAME_TUNABLES.party.push({ label: "Human coins", type: "range", min: 0, max: 500, step: 10, get: function() { return Party.pl[0] ? Party.pl[0].coins : 0; }, set: function(v) { Party.pl.filter(function(p) { return !p.cpu; }).forEach(function(p) { p.coins = v; }); } });
GAME_TUNABLES.property.push({ label: "Human cash", type: "range", min: 0, max: 10000, step: 100, get: function() { return Rent.pl[0] ? Rent.pl[0].cash : 0; }, set: function(v) { Rent.pl.filter(function(p) { return !p.cpu; }).forEach(function(p) { p.cash = v; }); } });
