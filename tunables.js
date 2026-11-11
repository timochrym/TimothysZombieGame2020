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
