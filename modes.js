// ============================================================================
// GAME MODES - the plug-in layer that turns this engine into many games.
//
// Every game (Zombie Survival, Brawl, Zombie Ball, Crate Lab, Portal Lab, Ragdoll Siege, Parkour Rush, Creative ...)
// is a "mode" object registered with GameModes.register({...}). The core engine (physics, characters,
// ragdolls, rendering, input, audio, menus) calls the optional hooks below at the right moments.
// Levels choose their game with `mode: "<id>"` in their level definition. See ENGINE.md.
//
//   id, title, tagline, color, firstLevel        identity + which level to load from the Arcade
//   flags: {                                      engine features to switch on/off for this game
//     waves, revive, jetpack, shooting, ability, ammo, playerControl, noBedrock, scenery, enemiesPassive,
//     coopToggle, dash, wallJump, airJumps, bigPads, flight
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
//   ui: { edit, dev, players, net, levelPicker, restart, enemies, help }   what menus / tools this game offers
//   toolbarItems()                                game-specific toolbar buttons [{id, icon, label, title, run(), active()}]
//   menuRows(over)                                extra pause-menu rows {label, value, hint, cycle, toggle, act(dir), go(), tab}
//   overTitle / overSub(over) / againLabel / restartLabel / onRestart()   game-over screen text and restart behaviour
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
        Progress.swap(this.current, next);
        this.current = next;
        if (next.onActivate) next.onActivate();
        if (typeof UI !== "undefined") UI.onModeChange();
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

// RPG progression (level, XP, coins, damage bonus) belongs to Zombie Survival only: it is parked while another
// game runs, so nothing earned there leaks into (or out of) other games.
var Progress = {
    stash: null,
    keeps: function(m) { return !!(m && m.flags && m.flags.progression); },
    swap: function(from, to) {
        if (this.keeps(from)) this.stash = { heroLevel: heroLevel, heroXP: heroXP, heroXPNext: heroXPNext, coins: coins, rpgDamageMult: rpgDamageMult };
        if (this.keeps(to)) {
            var st = this.stash;
            if (st) { heroLevel = st.heroLevel; heroXP = st.heroXP; heroXPNext = st.heroXPNext; coins = st.coins; rpgDamageMult = st.rpgDamageMult; }
        } else { heroLevel = 1; heroXP = 0; heroXPNext = 100; coins = 0; rpgDamageMult = 1; }
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
    flags: { waves: true, revive: true, jetpack: true, shooting: true, ability: true, ammo: true, scenery: true, progression: true },
    ui: {
        edit: true, enemies: true,
        help: function() {
            if (multiplayer) return [
                { title: "PLAYER 1", color: "#ff7b80", items: [["WASD", "move · jump"], ["F", "shoot"], ["Space", "jetpack"], ["Shift", "dash"], ["E", "shockwave · revive"], ["G", "grab"]] },
                { title: "PLAYER 2", color: "#6cb8ff", items: [["← ↑ →", "move · jump"], ["Enter", "shoot"], [".", "jetpack"], ["R-Shift", "dash"], ["/", "shockwave · revive"], [",", "grab"]] }
            ];
            return [["WASD", "move · jump"], ["F / click", "shoot (mouse aims)"], ["Space", "jetpack"], ["Shift", "dash"], ["E", "shockwave"], ["G / R-click", "grab · throw"],
                ["Hold ↑", "climb stairs"], ["B", "dev tools"], ["+ / -", "zoom"], ["H", "hide this"]];
        }
    },
    toolbarItems: function() {
        return [
            { id: "coop", icon: "👥", label: function() { return multiplayer ? "Co-op" : "Solo"; }, title: "Solo or 2-player co-op (restarts the run)",
              run: function() { toggleMultiplayer(); }, active: function() { return multiplayer; } },
            { id: "frontier", icon: "🌲", label: function() { return LevelManager.currentLevelKey === "infinite_frontier" ? "Arena" : "Frontier"; },
              title: "Switch between the arena and the endless frontier",
              run: function() { LevelManager.selectLevel(LevelManager.currentLevelKey === "infinite_frontier" ? "classic_arena" : "infinite_frontier"); },
              active: function() { return LevelManager.currentLevelKey === "infinite_frontier"; } }
        ];
    }
});

GameModes.register({
    id: "brawl",
    title: "BRAWL",
    tagline: "Smash-style party fighting. Knock rivals off the stage.",
    color: "#ffd23f",
    firstLevel: function() { return brawlCfg.stage; },
    flags: { waves: false, revive: false, jetpack: false, shooting: true, ability: true, ammo: false, noBedrock: true, scenery: false },
    restartLabel: "Rematch",
    ui: {
        edit: true, levelPicker: false,
        help: function() {
            return [
                { title: "PLAYER 1", color: "#ff7b80", items: [["WASD", "move · jump"], ["F / click", "attack"], ["Shift", "dash"], ["E", "shockwave"], ["G", "grab"]] },
                { title: "PLAYER 2", color: "#6cb8ff", items: [["← ↑ →", "move · jump"], ["Enter", "attack"], ["R-Shift", "dash"], ["/", "shockwave"], [",", "grab"]] }
            ];
        }
    },
    menuRows: function() {
        return [
            { tab: "players", label: "Opponents", cycle: true, icon: "🥊", value: function() { return brawlOpponentLabel(); }, hint: "Applies on Rematch - PvP or CPU fighters", act: function(d) { cycleBrawlOpponents(d); } },
            { label: "CPU skill", cycle: true, icon: "🤖", value: function() { return BRAWL_CPU_NAMES[brawlCfg.cpuLevel]; }, hint: "Applies on Rematch",
              act: function(d) { brawlCfg.cpuLevel = ((brawlCfg.cpuLevel - 1 + d + 3) % 3) + 1; saveBrawlCfg(); } },
            { label: "Stocks", cycle: true, icon: "❤", value: function() { return brawlCfg.stocks; }, hint: "Lives per fighter - applies on Rematch",
              act: function(d) { brawlCfg.stocks = Math.max(1, Math.min(9, brawlCfg.stocks + d)); saveBrawlCfg(); } },
            { label: "Stage", cycle: true, icon: "🏝", value: function() { var st = LevelManager.getAllLevels()[brawlCfg.stage]; return st ? st.name.replace(/^[^A-Za-z]+/, "") : "?"; }, hint: "Applies on Rematch",
              act: function(d) { cycleBrawlStage(d); } }
        ];
    }
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
