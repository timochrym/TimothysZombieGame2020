// ============================================================================
// PER-GAME TUNING - what the Cheats & tuning panel's Game tab shows for the game that's on.
//   1. "This game" rows: a mode's own settings, from `mode.tunables()` if it defines one, else GAME_TUNABLES[id].
//      A row: { label, type: "range" | "toggle" | "choice", get(), set(v), min, max, step, options: [[value, label]], note }
//   2. The shared rows only show where they mean something: wave rows need a wave game, world rows need a game with a
//      world (not the full-screen board / table / arena games). See GameTuning.applies().
// ============================================================================
var GAME_TUNABLES = {
    brawl: [
        { label: "Damage you take", type: "choice", options: [[1, "Normal"], [0.5, "Half"], [0.25, "Quarter"], [0, "None (can't be launched)"]], get: function() { return gameCheats.brawlTaken; }, set: function(v) { gameCheats.brawlTaken = Number(v); }, note: "humans only" },
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
    race: [
        { label: "Freeze the clock", type: "toggle", get: function() { return !!gameCheats.raceFreeze; }, set: function(v) { gameCheats.raceFreeze = !!v; }, note: "runs with it on don't save a best time" }
    ],
    portal: [
        { label: "Portals stick to any wall", type: "toggle", get: function() { return !!gameCheats.portalAnywhere; }, set: function(v) { gameCheats.portalAnywhere = !!v; } }
    ],
    siege: [
        { label: "Unlimited shots", type: "toggle", get: function() { return !!gameCheats.siegeUnlimited; }, set: function(v) { gameCheats.siegeUnlimited = !!v; } }
    ],
    platform: [
        { label: "Infinite lives", type: "toggle", get: function() { return !!gameCheats.platLives; }, set: function(v) { gameCheats.platLives = !!v; } }
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
        if (need === "cpu") return ["brawl", "tanks", "mix", "sport", "table"].indexOf(GameModes.current ? GameModes.current.id : "") !== -1;
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
function arenaSpeed(p) { return (arenaHuman(p) ? arenaCheats.speed : 1) * (p && p.mixFx && p.mixFx.speed > 0 ? 1.5 : 1); }      // mixFx: a speed power-up picked up in Arena Mix
function killBrokenArenaPlayers() {
    var removed = 0, reasons = [];
    var totalBlob = 0, blobAlive = 0, totalWorm = 0, wormAlive = 0, totalTank = 0, tankAlive = 0;
    var cMasses = [];
    if (typeof Cells !== "undefined" && Cells.players) {
        for (let i = 0; i < Cells.players.length; i++) {
            var p = Cells.players[i];
            if (!p || !p.alive) continue;
            var pm = Cells.mass(p);
            cMasses.push({ pl: p, m: pm, blobs: Cells.mine(p) });
            totalBlob += pm; blobAlive++;
        }
    }
    var wList = [];
    if (typeof Snake !== "undefined" && Snake.worms) {
        for (let i = 0; i < Snake.worms.length; i++) {
            var w = Snake.worms[i];
            if (!w || !w.alive || w.gone) continue;
            wList.push(w);
            totalWorm += (w.len || 0); wormAlive++;
        }
    }
    var tList = [];
    if (typeof Tanks !== "undefined" && Tanks.tanks) {
        for (let i = 0; i < Tanks.tanks.length; i++) {
            var k = Tanks.tanks[i];
            if (!k || !k.alive || k.gone || k.isMini) continue;
            var kv = Math.max(1, k.mixMass || k.score || 36);
            tList.push({ k: k, v: kv });
            totalTank += kv; tankAlive++;
        }
    }
    var totalWorld = totalBlob + totalWorm + totalTank;
    var totalAlive = blobAlive + wormAlive + tankAlive;
    var spawnBlobM = (typeof cellsCfg !== "undefined" && cellsCfg.startMass) ? cellsCfg.startMass : 20;
    var worldLimC = (typeof CEL !== "undefined") ? Math.min(CEL.W, CEL.H) * 0.28 : 1600;
    for (let i = 0; i < cMasses.length; i++) {
        var c = cMasses[i], cp = c.pl, rsn = null;
        var fastBlob = c.blobs.some(function(b) { return Math.hypot(b.vx || 0, b.vy || 0) > 65; });
        var hugeBlob = c.blobs.some(function(b) { return Cells.rad(b.m, b) >= worldLimC; });
        if ((cp._fastTicks || 0) >= 5 || fastBlob) rsn = "abnormal speed";
        else if ((totalAlive >= 2 && totalWorld > 200 && c.m / totalWorld >= 0.99) || (blobAlive >= 2 && totalBlob > 300 && c.m / totalBlob >= 0.99)) rsn = "99% value";
        else if (hugeBlob || c.m >= 50000) rsn = "oversized";
        else if (c.m >= 50 * spawnBlobM && ((cp._dupBurst || 0) >= 6 || c.blobs.length >= 24)) rsn = "50x rapid duplication";
        if (rsn) {
            for (let j = 0; j < c.blobs.length; j++) c.blobs[j].dead = true;
            cp.chainList = [];
            Cells.die(cp, null);
            removed++; reasons.push((cp.name || "Blob") + " (" + rsn + ")");
        }
    }
    for (let i = 0; i < wList.length; i++) {
        var wk = wList[i], wrsn = null;
        var sibs = 0;
        for (let j = 0; j < wList.length; j++) {
            var ow = wList[j];
            if ((wk.kinId && ow.kinId === wk.kinId) || ((ow.splitOwner || ow) === (wk.splitOwner || wk))) sibs++;
        }
        if ((wk._fastTicks || 0) >= 5) wrsn = "abnormal speed";
        else if ((totalAlive >= 2 && totalWorld > 200 && wk.len / totalWorld >= 0.99) || (wormAlive >= 2 && totalWorm > 300 && wk.len / totalWorm >= 0.99)) wrsn = "99% value";
        else if (wk.len >= 3000) wrsn = "oversized";
        else if (wk.len >= 50 * 24 && ((wk._dupBurst || 0) >= 3 || sibs >= 4)) wrsn = "50x rapid duplication";
        if (wrsn) {
            wk.alive = false; wk.gone = true;
            removed++; reasons.push((wk.name || "Worm") + " (" + wrsn + ")");
        }
    }
    if (typeof Snake !== "undefined" && Snake.worms && removed > 0) {
        Snake.worms = Snake.worms.filter(function(q) { return !q.gone; });
    }
    var worldLimT = (typeof TNK !== "undefined") ? Math.min(TNK.W, TNK.H) * 0.2 : 1200;
    for (let i = 0; i < tList.length; i++) {
        var tk = tList[i].k, tv = tList[i].v, trsn = null;
        if (Math.hypot(tk.vx || 0, tk.vy || 0) > 40) trsn = "abnormal speed";
        else if ((totalAlive >= 2 && totalWorld > 200 && tv / totalWorld >= 0.99) || (tankAlive >= 2 && totalTank > 300 && tv / totalTank >= 0.99)) trsn = "99% value";
        else if (Tanks.size(tk) >= worldLimT || (tk.mixMass || 0) >= 50000) trsn = "oversized";
        if (trsn) {
            tk.alive = false; tk.hp = 0; tk.gone = true;
            removed++; reasons.push((tk.name || "Tank") + " (" + trsn + ")");
        }
    }
    if (typeof Tanks !== "undefined" && Tanks.tanks && removed > 0) {
        Tanks.tanks = Tanks.tanks.filter(function(q) { return !q.gone; });
    }
    if (typeof showBanner === "function") {
        showBanner(removed ? ("KILLED " + removed + " BROKEN PLAYER" + (removed > 1 ? "S" : "")) : "No broken players found", reasons.slice(0, 3).join(", "), removed ? "#f87171" : "#94a3b8");
    }
    if (typeof DevUI !== "undefined" && DevUI.toast) {
        DevUI.toast(removed ? ("Removed " + removed + ": " + reasons.join(", ")) : "No broken players detected");
    }
    return { removed: removed, reasons: reasons };
}
function arenaRows() { return [
    { label: "⚡ Kill Broken Players", type: "button", fn: killBrokenArenaPlayers },
    { label: "Invincible humans", type: "toggle", get: function() { return arenaCheats.god; }, set: function(v) { arenaCheats.god = v; } },
    { label: "Human speed", type: "range", min: 0.5, max: 3, step: 0.25, get: function() { return arenaCheats.speed; }, set: function(v) { arenaCheats.speed = v; } }
]; }
GAME_TUNABLES.snake = (typeof wormSplitRows === "function" ? wormSplitRows() : []).concat(arenaRows(), [
    { label: "Human length", type: "range", min: 14, max: 600, step: 10, get: function() { var w = Snake.worms.find(arenaHuman); return w ? Math.round(w.len) : 24; }, set: function(v) { Snake.worms.filter(arenaHuman).forEach(function(w) { w.len = v; }); } }
  ]);
GAME_TUNABLES.cells = [
    // ---- game settings (saved) ----
    { label: "CPU blobs", type: "range", min: 0, max: 40, step: 1, get: function() { return cellsCfg.bots; }, set: function(v) { cellsCfg.bots = v; saveCellsCfg(); }, note: "changes live" },
    { label: "Food on the map", type: "range", min: 300, max: 4000, step: 100, get: function() { return cellsCfg.food; }, set: function(v) { cellsCfg.food = v; saveCellsCfg(); } },
    { label: "Decay (big blobs shrink)", type: "choice", options: CELL_DECAY, get: function() { return cellsCfg.decay; }, set: function(v) { cellsCfg.decay = Number(v); saveCellsCfg(); } },
    { label: "Decay grows with size", type: "toggle", get: function() { return cellsCfg.decayGrow; }, set: function(v) { cellsCfg.decayGrow = !!v; saveCellsCfg(); }, note: "the bigger, the faster it shrinks" },
    { label: "Spawn shield (seconds)", type: "range", min: 0, max: 8, step: 1, get: function() { return cellsCfg.shield; }, set: function(v) { cellsCfg.shield = v; saveCellsCfg(); } },
    { label: "Power-up pickups", type: "toggle", get: function() { return cellsCfg.powerups; }, set: function(v) { cellsCfg.powerups = !!v; saveCellsCfg(); }, note: "speed, shield, magnet, mass" },
    { label: "Humans are bubble worms", type: "toggle", get: function() { return cellsCfg.chain; }, set: function(v) { cellsCfg.chain = !!v; saveCellsCfg(); Cells.players.filter(arenaHuman).forEach(function(p) { p.chain = !!v; if (!v) Cells.mine(p).forEach(function(b) { b.lead = null; b.mergeT = 300; }); }); }, note: "a chain of bubbles that follows its head" },
    { label: "Humans start at mass", type: "range", min: 20, max: 1000, step: 20, get: function() { return cellsCfg.startMass; }, set: function(v) { cellsCfg.startMass = v; saveCellsCfg(); }, note: "next spawn" },
    { label: "Max bubbles per player (0 = unlimited)", type: "range", min: 0, max: 64, step: 1, get: function() { return cellsCfg.maxCells || 0; }, set: function(v) { cellsCfg.maxCells = v; saveCellsCfg(); }, note: "0 = no limit" },
    { label: "Max snake bubbles per snake", type: "range", min: 2, max: 60, step: 1, get: function() { return cellsCfg.maxChainBubbles || 20; }, set: function(v) { cellsCfg.maxChainBubbles = v; saveCellsCfg(); } }
].concat(arenaRows(), [
    // ---- cheats ----
    { label: "Set human size now", type: "range", min: 20, max: 20000, step: 20, get: function() { var p = Cells.players.find(arenaHuman); return p ? Math.round(Cells.mass(p)) : 20; }, set: function(v) { Cells.players.filter(arenaHuman).forEach(function(p) { var bs = Cells.mine(p); bs.forEach(function(b) { b.m = v / bs.length; }); }); } }
]);
function tankAutoRows() {
    if (typeof Tanks === "undefined" || !Tanks.autoUpgrade || typeof TNK_STATS === "undefined") return [];
    var rows = [
        { label: "Auto-spend Diep.io upgrades", type: "toggle", localOnly: true, get: function() { return !!Tanks.autoUpgrade.enabled; }, set: function(v) {
            Tanks.autoUpgrade.enabled = !!v;
            if (Tanks.saveAutoUpgrade) Tanks.saveAutoUpgrade();
            if (Tanks.autoUpgrade.enabled) {
                var me = Tanks.tanks.find(function(k) { return k.human === 0 && k.alive; });
                if (me && me.pts > 0) Tanks.applyAutoUpgrades(me);
            }
        } }
    ];
    for (let i = 0; i < 8; i++) {
        (function(idx) {
            rows.push({
                label: "Rank: " + TNK_STATS[idx], type: "range", min: 0, max: 1, step: 0.05, localOnly: true,
                get: function() { return Number((Tanks.autoUpgrade.weights[idx] || 0).toFixed(2)); },
                set: function(v) {
                    Tanks.autoUpgrade.weights[idx] = Math.max(0, Math.min(1, Number(v) || 0));
                    if (Tanks.saveAutoUpgrade) Tanks.saveAutoUpgrade();
                    if (Tanks.autoUpgrade.enabled) {
                        var me = Tanks.tanks.find(function(k) { return k.human === 0 && k.alive; });
                        if (me && me.pts > 0) Tanks.applyAutoUpgrades(me);
                    }
                }
            });
        })(i);
    }
    return rows;
}
GAME_TUNABLES.tanks = arenaRows().concat([
    { label: "CPU difficulty", type: "choice", options: [[1, "Easy"], [2, "Normal"], [3, "Hard"]], get: function() { return arenaCheats.tankSkill; }, set: function(v) { setTankSkill(v); } },
    { label: "Human stat points", type: "range", min: 0, max: 56, step: 1, get: function() { var k = Tanks.tanks.find(arenaHuman); return k ? k.pts : 0; }, set: function(v) { Tanks.tanks.filter(arenaHuman).forEach(function(k) { k.pts = v; }); } }
], tankAutoRows());
GAME_TUNABLES.jetpack = [
    { label: "Invincible runners", type: "toggle", get: function() { return !!Jet.invincible; }, set: function(v) { Jet.invincible = v; } },
    { label: "Banked coins", type: "range", min: 0, max: 2000, step: 50, get: function() { return jetSave.coins; }, set: function(v) { jetSave.coins = v; saveJet(); } }
];
GAME_TUNABLES.party.push({ label: "Human coins", type: "range", min: 0, max: 500, step: 10, get: function() { return Party.pl[0] ? Party.pl[0].coins : 0; }, set: function(v) { Party.pl.filter(function(p) { return !p.cpu; }).forEach(function(p) { p.coins = v; }); } });
GAME_TUNABLES.property.push({ label: "Human cash", type: "range", min: 0, max: 10000, step: 100, get: function() { return Rent.pl[0] ? Rent.pl[0].cash : 0; }, set: function(v) { Rent.pl.filter(function(p) { return !p.cpu; }).forEach(function(p) { p.cash = v; }); } });
