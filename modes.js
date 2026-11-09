// ============================================================================
// GAME MODES - the plug-in layer that turns this engine into many games.
//
// Every game (Zombie Survival, Brawl, Zombie Ball, Crate Lab, Portal Lab, Ragdoll Siege, Parkour Rush ...)
// is a "mode" object registered with GameModes.register({...}). The core engine (physics, characters,
// ragdolls, rendering, input, audio, menus) calls the optional hooks below at the right moments.
// Levels choose their game with `mode: "<id>"` in their level definition. See ENGINE.md.
//
//   id, title, tagline, color, firstLevel        identity + which level to load from the Arcade
//   flags: {                                      engine features to switch on/off for this game
//     waves, revive, jetpack, shooting, ability, ammo, playerControl, noBedrock, scenery, enemiesPassive,
//     coopToggle, dash, wallJump, airJumps, bigPads
//   }
//   onActivate() / onDeactivate()                 entering / leaving this game
//   setupLevel(lvl)                               after the level geometry loads (build gadgets, balls ...)
//   createPlayers()                               spawn the heroes yourself (optional)
//   onReset()                                     end of resetGame()
//   preUpdate()                                   every frame, before characters move
//   update()                                      every frame, after physics
//   drawWorld()                                   after level geometry is drawn (behind characters)
//   drawFront()                                   after characters (in front)
//   drawHUD()                                     replaces the standard HUD
//   cameraTargets()                               -> [{x, y}] points the camera should keep in frame
//   cpuThink(ch)                                  AI for CPU-controlled heroes (ch.isCPU)
//   onSecondary(ch)                               right-click / alt-fire -> return true to consume
//   onKey(code, e)                                keyboard hook -> return true to consume
//   onDamage(ch, amount, kx, ky, attacker)        a character is damaged -> return true to consume
//   onExplosion(x, y, radius, power)              any explosion in the world
//   onExit(ch, gadget) / onHazard(ch, gadget)     gadget events (level exit reached / spikes touched)
//   menuItems(items) / onMenu(id, dir)            add / handle pause-menu rows (row.cycle = true for ◀ ▶)
//   overTitle / overSub(over) / againLabel / onRestart()   game-over screen text + restart behaviour
// ============================================================================
var GameModes = {
    list: [],
    byId: {},
    current: null,

    register: function(mode) {
        mode.flags = mode.flags || {};
        this.list.push(mode);
        this.byId[mode.id] = mode;
        if (!this.current) this.current = mode;
        return mode;
    },

    get: function(id) { return this.byId[id] || null; },

    activate: function(id) {
        var next = this.byId[id] || this.byId.survival;
        if (next === this.current) return;
        if (this.current && this.current.onDeactivate) this.current.onDeactivate();
        this.current = next;
        if (next.onActivate) next.onActivate();
    },

    flag: function(name, def) {
        var f = this.current && this.current.flags;
        return (f && f[name] !== undefined) ? f[name] : def;
    },

    call: function(hook, a, b, c, d, e) {
        var m = this.current;
        if (m && typeof m[hook] === "function") return m[hook](a, b, c, d, e);
        return undefined;
    },

    has: function(hook) { return !!(this.current && typeof this.current[hook] === "function"); },

    // Which game a level belongs to
    modeOf: function(lvl) {
        if (!lvl) return "survival";
        if (lvl.mode) return lvl.mode;
        return lvl.isBrawl ? "brawl" : "survival";
    },

    // Launch a game from the arcade: load its saved/first level
    launch: function(id) {
        var m = this.byId[id];
        if (!m) return;
        var key = (typeof m.firstLevel === "function") ? m.firstLevel() : m.firstLevel;
        if (key && LevelManager.getAllLevels()[key]) LevelManager.selectLevel(key);
        try { localStorage.setItem("timsArcadeLastGame", id); } catch (e) {}
    }
};

// Edge-detect a held button per character (for "press once" actions like placing portals)
function pressedOnce(ch, key, held) {
    var was = ch["_held_" + key];
    ch["_held_" + key] = held;
    return held && !was;
}

// ---- The two original games, registered as modes ----
GameModes.register({
    id: "survival",
    title: "ZOMBIE SURVIVAL",
    tagline: "The original. Waves, co-op, revive, castles, the endless frontier.",
    color: "#55ff88",
    firstLevel: "classic_arena",
    flags: { waves: true, revive: true, jetpack: true, shooting: true, ability: true, ammo: true, scenery: true }
});

GameModes.register({
    id: "brawl",
    title: "BRAWL",
    tagline: "Smash-style party fighting. Knock rivals off the stage.",
    color: "#ffd23f",
    firstLevel: function() { return brawlCfg.stage; },
    flags: { waves: false, revive: false, jetpack: false, shooting: true, ability: true, ammo: false, noBedrock: true, scenery: false }
});

// ============================================================================
// MODE KIT - helpers for building games: register levels, spawn heroes, build rooms
// ============================================================================
var EXTRA_LEVELS = {};

var ModeKit = {
    // Levels added here appear in LevelManager (authored at final scale, never auto-scaled)
    addLevel: function(key, def) {
        def._scaled = true;
        EXTRA_LEVELS[key] = def;
    },

    // Spawn a controllable hero. idx 0 = Player 1 (WASD), 1 = Player 2 (arrows), >1 = extra slots (CPUs)
    makeHero: function(idx, x, y, opts) {
        opts = opts || {};
        var charBox = Math.makeHitbox(s1, s2);
        var ch = new Character(opts.name || ("Player " + (idx + 1)), charBox, charBox, opts.color || FIGHTER_COLORS[idx % 4], [x, y],
            maxspeed, slower, gravity, bounciness, speed, idx === 0 ? "WASD" : "ULDR", opts.hp || 100, "ULDR", false, "NORMAL");
        ch.isPlayer = true;
        ch.playerIndex = idx;
        ch.playerLabel = opts.label || ("P" + (idx + 1));
        ch.spawnX = x; ch.spawnY = y;
        ch.respawnX = x; ch.respawnY = y;
        ch.maxAirJumps = ch.airJumps = GameModes.flag("airJumps", 1);
        if (opts.team !== undefined) ch.fighterTeam = opts.team;
        if (opts.accent) ch.accentColor = opts.accent;
        if (opts.cpu) { ch.isCPU = true; ch.cpuIn = { shoot: false, jet: false, interact: false, reloadQueued: false }; }
        characters.push(ch);
        if (idx === 0) redGuy = ch;
        if (idx === 1) blueGuy = ch;
        return ch;
    },

    // Floor (top at y = 0), side walls named for arena containment, and a ceiling
    room: function(left, right, ceilY, opts) {
        opts = opts || {};
        var tex = opts.tex || "lab_metal", col = opts.color || "#334155";
        var w2 = right - left;
        var items = [
            { type: "box", name: "Left Wall", x: left - 100, y: ceilY / 2, w: 200, h: ceilY + 1800, color: col, texture: tex, kind: "wall", portalable: !!opts.portalWalls },
            { type: "box", name: "Right Wall", x: right + 100, y: ceilY / 2, w: 200, h: ceilY + 1800, color: col, texture: tex, kind: "wall", portalable: !!opts.portalWalls },
            { type: "box", name: "Ceiling", x: (left + right) / 2, y: ceilY + 100, w: w2 + 400, h: 200, color: col, texture: tex, kind: "block", portalable: !!opts.portalCeiling }
        ];
        if (!opts.noFloor) items.push({ type: "box", name: "Floor", x: (left + right) / 2, y: -200, w: w2, h: 400, color: opts.floorColor || col, texture: opts.floorTex || tex, kind: "block", portalable: !!opts.portalFloor });
        return items;
    }
};
