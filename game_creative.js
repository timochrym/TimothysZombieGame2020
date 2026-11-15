// ============================================================================
// GAME: CREATIVE  (creative)  -  fly anywhere and build
//   Double-tap jump to take off (W / S to rise and sink, double-tap again or hold S on the ground to land).
//   Optional noclip, invincibility, summon a horde to test your fort, and the dev build tools (B)
//   for placing blocks, stairs, slopes, slides, pads, crates, TNT and enemies.
//   Levels saved from the dev panel while in Creative stay Creative levels.
// ============================================================================
var creativeCfg = Store.load("timsCreativeCfg", { noclip: false, invincible: true });
function saveCreative() { Store.set("timsCreativeCfg", creativeCfg); }

(function() {
    var L = ModeKit.room(-6000, 6000, 4200, { tex: "brick", color: "#2b3445", floorColor: "#4a7a35", floorTex: "grass_dirt" });
    var box = function(name, x, y, w, h, tex, col, kind) { return { type: "box", name: name, x: x, y: y, w: w, h: h, texture: tex, color: col, kind: kind || "block" }; };
    var ramp = function(name, x, y, w, h, dir, tex, col) { return { type: "ramp", name: name, x: x, y: y, w: w, h: h, dir: dir, texture: tex, color: col }; };
    // a starter hill, a tower and some floating islands to fly between
    L.push(ramp("Hill Slope", -1900, 150, 600, 300, "right", "grass_dirt", "#5d8a3a"));
    L.push(box("Hill", -1300, 150, 600, 300, "grass_dirt", "#5d8a3a"));
    L.push(ramp("Hill Slide", -700, 150, 600, 300, "left", undefined, "#7dd3fc"));
    L.push(box("Tower", 1400, 700, 360, 1400, "castle_stone", "#6b7280"));
    L.push(ramp("Tower Stairs", 1000, 200, 440, 400, "right", "dojo_wood", "#a0784f"));
    L.push(box("Tower Ledge", 900, 760, 300, 40, "dojo_wood", "#8b6b4a", "platform"));
    L.push(box("Floating Island", -2600, 1500, 700, 120, "grass_dirt", "#5d8a3a"));
    L.push(box("Floating Island", 0, 2200, 900, 120, "grass_dirt", "#5d8a3a"));
    L.push(box("Floating Island", 2900, 1800, 600, 120, "grass_dirt", "#5d8a3a"));
    L.push(box("Cloud Platform", -1000, 2800, 500, 40, "neon_grid", "#a5f3fc", "platform"));
    L.push({ type: "bumper", name: "Bounce Pad", x: 300, y: 13, w: 140, h: 26, bounce: 26 });
    L.push({ type: "crate", name: "Crate", x: 500, y: 40, size: 80 });
    L.push({ type: "crate", name: "Crate", x: 500, y: 121, size: 80 });
    L.push({ type: "crate", name: "TNT Barrel", x: 650, y: 40, size: 70, explosive: true });
    ModeKit.addLevel("creative_world", { name: "✈ Creative: Sky Sandbox", mode: "creative", wavesEnabled: false,
        spawnP1: [0, 60], spawnP2: [140, 60], layout: L,
        gadgets: [{ type: "sign", x: -250, y: 0, text: "Double-tap W (jump) to FLY.  W / S rise and sink.\nB opens the build tools.  Esc for creative options." },
                  { type: "star", x: 0, y: 2400 }, { type: "star", x: 2900, y: 2000 }, { type: "star", x: -1000, y: 3000 }] });
})();

function creativeHorde() {
    var ref = redGuy || { x: 0, y: 200 };
    for (let i = 0; i < 6; i++) {
        var z = spawnZombie(null, ref.x + (i % 2 ? 1 : -1) * (700 + i * 90), ref.y + 300);
        z.hunter = true;
    }
    showBanner("HORDE SUMMONED", "6 enemies incoming - test your build!", "#ff6b6b");
}

GameModes.register({
    id: "creative",
    title: "CREATIVE",
    tagline: "Fly anywhere and build your own world. Summon enemies when you want a fight.",
    color: "#7dd3fc",
    firstLevel: "creative_world",
    flags: { waves: false, revive: false, jetpack: false, shooting: true, ability: true, ammo: false, noBedrock: false, scenery: true,
        coopToggle: true, dash: true, wallJump: true, airJumps: 1, flight: true },
    overTitle: "CREATIVE",
    againLabel: "Reload the world",
    restartLabel: "Reload the world",
    ui: {
        edit: true, enemies: true,
        help: [["W W", "double-tap to fly / land"], ["W / S", "rise / sink"], ["A / D", "move"], ["Shift", "dash"], ["F / click", "shoot"], ["N", "noclip"], ["B", "build tools"]]
    },

    setupLevel: function(lvl) {
        Gadgets.load(lvl.gadgets || []);
        if (typeof SummonManager !== "undefined") SummonManager.pauseWaves = true;
    },

    createPlayers: function() {
        var lvl = LevelManager.getCurrentLevel();
        var sp1 = lvl.spawnP1 || [0, 60], sp2 = lvl.spawnP2 || [140, 60];
        ModeKit.makeHero(0, sp1[0], sp1[1] + 40);
        if (multiplayer) ModeKit.makeHero(1, sp2[0], sp2[1] + 40);
        else blueGuy = null;
        for (let i = 0; i < characters.length; i++) characters[i].noclip = creativeCfg.noclip;
    },

    preUpdate: function() {
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            c.noclip = creativeCfg.noclip;
            // never lose a hero in the void
            if (c.y < -1300) { c.x = 0; c.y = 300; c.xspeed = c.yspeed = 0; }
        }
    },

    onDamage: function(ch) { return !!(ch.isPlayer && creativeCfg.invincible); },

    onKey: function(code) {
        if (code === "KeyN") {
            creativeCfg.noclip = !creativeCfg.noclip; saveCreative();
            if (redGuy) Components.addFloatingText(creativeCfg.noclip ? "NOCLIP ON" : "NOCLIP OFF", redGuy.x, redGuy.y + 90, "#7dd3fc", 16);
            return true;
        }
        return false;
    },

    onRestart: function() { LevelManager.selectLevel(LevelManager.currentLevelKey); },

    drawHUD: function() {
        uiPanel(14, 14, 380, 96, "#7dd3fc");
        uiText("CREATIVE", 30, 46, 24, "#7dd3fc", "left", "900");
        var st = [];
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            st.push(c.playerLabel + (c.creativeFlying ? " ✈ flying" : " walking"));
        }
        uiText(st.join("   ·   "), 30, 70, 14, "#e2e8f0", "left", "800");
        uiText("noclip " + (creativeCfg.noclip ? "ON" : "off") + " (N)   ·   " + (creativeCfg.invincible ? "invincible" : "mortal") + "   ·   ★ " + Gadgets.starsGot + "/" + Gadgets.starsTotal, 30, 94, 12, "#94a3b8", "left", "700");
        for (let i = 0; i < characters.length; i++) if (!characters[i].dead) drawEdgeIndicator(characters[i].x, characters[i].y, characters[i].color, characters[i].playerLabel);
    },

    menuRows: function() {
        return [
            { label: "Flying", icon: "✈", toggle: function() { return !!(redGuy && redGuy.creativeFlying); }, hint: "Or double-tap jump",
              act: function() { if (redGuy) { redGuy.creativeFlying = !redGuy.creativeFlying; if (redGuy.creativeFlying) redGuy.yspeed = 6; } } },
            { label: "Noclip while flying", icon: "👻", toggle: function() { return creativeCfg.noclip; }, hint: "Fly through walls (N)", act: function() { creativeCfg.noclip = !creativeCfg.noclip; saveCreative(); } },
            { label: "Invincible", icon: "🛡", toggle: function() { return creativeCfg.invincible; }, act: function() { creativeCfg.invincible = !creativeCfg.invincible; saveCreative(); } },
            { label: "Summon a horde", icon: "🧟", hint: "6 enemies come for you", act: function() { closePause(); creativeHorde(); } },
            { label: "Clear all enemies", icon: "☠", act: function() { for (let i = 0; i < zombies.length; i++) zombies[i].dead = true; } }
        ];
    },

    toolbarItems: function() {
        return [
            { id: "fly", icon: "✈", label: function() { return redGuy && redGuy.creativeFlying ? "Flying" : "Fly"; }, title: "Take off / land (double-tap jump)",
              run: function() { if (redGuy) { redGuy.creativeFlying = !redGuy.creativeFlying; if (redGuy.creativeFlying) redGuy.yspeed = 6; } }, active: function() { return !!(redGuy && redGuy.creativeFlying); } },
            { id: "horde", icon: "🧟", label: "Horde", title: "Summon 6 enemies to test your build", run: creativeHorde }
        ];
    }
});
