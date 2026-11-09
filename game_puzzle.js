// ============================================================================
// GAME: CRATE LAB  (puzzle)  -  physics puzzle rooms
//   Pressure plates, doors, levers, keys & locks, fans, elevators, spikes, TNT vs cracked walls.
//   Grab/throw crates (G / right-click, click to throw), E pulls levers, R restarts the room.
// ============================================================================
var PUZZLE_ROOMS = [];
var puzzleState = { room: 0, unlocked: 1, time: 0, done: false, doneTimer: 0, best: {} };
try { var _ps = JSON.parse(localStorage.getItem("timsCrateLab") || "null"); if (_ps) { puzzleState.unlocked = _ps.unlocked || 1; puzzleState.best = _ps.best || {}; puzzleState.room = Math.min(_ps.room || 0, puzzleState.unlocked - 1); } } catch (e) {}
function savePuzzle() { try { localStorage.setItem("timsCrateLab", JSON.stringify({ unlocked: puzzleState.unlocked, best: puzzleState.best, room: puzzleState.room })); } catch (e) {} }

function puzzleRoom(n, title, left, right, spawn, extra, gadgets) {
    var key = "lab_" + n;
    var layout = ModeKit.room(left, right, 1400, { tex: "lab_metal", color: "#334155", floorTex: "lab_metal" }).concat(extra || []);
    ModeKit.addLevel(key, { name: "🧪 Crate Lab " + (n + 1) + ": " + title, mode: "puzzle", wavesEnabled: false, spawnP1: spawn, spawnP2: [spawn[0] + 120, spawn[1]], layout: layout, gadgets: gadgets, title: title });
    PUZZLE_ROOMS[n] = key;
}
// Pits: a floor with a gap. The base room floor is skipped and replaced by segments.
function floorSeg(x0, x1, top) { return { type: "box", name: "Floor", x: (x0 + x1) / 2, y: top - 200, w: x1 - x0, h: 400, color: "#334155", texture: "lab_metal", kind: "block" }; }
function crate(x, y, opts) { var c = { type: "crate", name: "Crate", x: x, y: y, size: 80, color: "#d9a05b", texture: "crate_plank" }; for (var k in (opts || {})) c[k] = opts[k]; return c; }
function tnt(x, y) { return { type: "crate", name: "TNT Barrel", x: x, y: y, size: 80, explosive: true }; }

// ---------------- Room 1: plate opens the door
puzzleRoom(0, "Weighty Matters", -1300, 1300, [-1050, 60],
    [crate(-650, 60)],
    [
        { type: "sign", x: -850, y: 0, text: "Doors open while their pressure plate is weighed down.\nGrab a crate: G or right-click. Throw it: click.\nE pulls levers.  R restarts the room." },
        { type: "plate", x: -100, y: 0, w: 170, links: ["d1"] },
        { type: "door", id: "d1", x: 500, y: 700, w: 80, h: 1400 },
        { type: "star", x: -1150, y: 520 },
        { type: "exit", x: 1050, y: 0 }
    ]);

// ---------------- Room 2: stack crates to climb
puzzleRoom(1, "Stack Overflow", -1200, 1300, [-950, 60],
    [crate(-450, 60), crate(-150, 60), { type: "box", name: "High Ledge", x: 1000, y: 320, w: 600, h: 640, color: "#475569", texture: "lab_metal", kind: "block" }],
    [
        { type: "sign", x: -800, y: 0, text: "Too high to jump? Stack crates and climb!\n(Two crates should do it.)" },
        { type: "star", x: -1100, y: 300 },
        { type: "exit", x: 1050, y: 640 }
    ]);

// ---------------- Room 3: lever-driven bridge over spikes
puzzleRoom(2, "Mind the Gap", -1500, 1600, [-1300, 60],
    [floorSeg(-1500, 0, 0), floorSeg(1100, 1600, 0), floorSeg(0, 1100, -600)],
    [
        { type: "sign", x: -1100, y: 0, text: "Flip the lever (E) to power the moving platform." },
        { type: "switch", x: -400, y: 0, links: ["m3"] },
        { type: "mover", id: "m3", needsPower: true, x: 140, y: -20, w: 240, h: 40, x2: 960, y2: -20, speed: 4 },
        { type: "spikes", x: 550, y: -600, w: 1100 },
        { type: "star", x: 550, y: 380 },
        { type: "exit", x: 1400, y: 0 }
    ]);
PUZZLE_ROOMS.noBaseFloor = { lab_2: true };

// ---------------- Room 4: two plates, one door
puzzleRoom(3, "Double Trouble", -1400, 1400, [-1200, 60],
    [crate(-950, 60), crate(-150, 60)],
    [
        { type: "sign", x: -1000, y: 0, text: "This door needs BOTH plates held at once." },
        { type: "plate", x: -650, y: 0, w: 170, links: ["d4"] },
        { type: "plate", x: 250, y: 0, w: 170, links: ["d4"] },
        { type: "door", id: "d4", need: "all", x: 800, y: 700, w: 80, h: 1400 },
        { type: "star", x: 1150, y: 600 },
        { type: "exit", x: 1150, y: 0 }
    ]);

// ---------------- Room 5: fan up to the key, unlock the door
puzzleRoom(4, "Hot Air", -1300, 1300, [-1100, 60],
    [{ type: "box", name: "Key Shelf", x: -820, y: 980, w: 380, h: 40, color: "#475569", texture: "lab_metal", kind: "platform" }],
    [
        { type: "sign", x: -1000, y: 0, text: "Ride the fan's updraft to grab the key.\nThe yellow door opens for the key holder." },
        { type: "fan", x: -500, y: 0, w: 220, h: 1150, power: 1.8 },
        { type: "key", x: -860, y: 1060, color: "#facc15" },
        { type: "lockdoor", x: 600, y: 700, w: 90, h: 1400, color: "#facc15" },
        { type: "star", x: -150, y: 1200 },
        { type: "exit", x: 1050, y: 0 }
    ]);

// ---------------- Room 6: TNT vs cracked wall
puzzleRoom(5, "Demolition", -1400, 1400, [-1200, 60],
    [tnt(-700, 60), tnt(-450, 60)],
    [
        { type: "sign", x: -1000, y: 0, text: "Cracked walls crumble in explosions.\nGrab a TNT barrel and THROW it at the wall!" },
        { type: "cracked", x: 500, y: 700, w: 120, h: 1400 },
        { type: "star", x: 1150, y: 500 },
        { type: "exit", x: 1100, y: 0 }
    ]);

// ---------------- Room 7: plate-powered elevator
puzzleRoom(6, "Going Up", -1300, 1400, [-1100, 60],
    [crate(-700, 60), { type: "box", name: "Upper Floor", x: 1000, y: 450, w: 800, h: 900, color: "#475569", texture: "lab_metal", kind: "block" }],
    [
        { type: "sign", x: -950, y: 0, text: "The elevator only runs while its plate is pressed." },
        { type: "plate", x: -250, y: 0, w: 170, links: ["e7"] },
        { type: "mover", id: "e7", needsPower: true, x: 480, y: -20, w: 200, h: 40, x2: 480, y2: 880, speed: 3 },
        { type: "star", x: 480, y: 1250 },
        { type: "exit", x: 1150, y: 900 }
    ]);

// ---------------- Room 8: everything at once
puzzleRoom(7, "Final Exam", -2100, 2100, [-1900, 60],
    [floorSeg(-2100, -400, 0), floorSeg(600, 2100, 0), floorSeg(-400, 600, -600), crate(-1500, 60),
     { type: "box", name: "Key Shelf", x: 1340, y: 980, w: 360, h: 40, color: "#475569", texture: "lab_metal", kind: "platform" }],
    [
        { type: "plate", x: -1150, y: 0, w: 170, links: ["d8"] },
        { type: "door", id: "d8", x: -800, y: 700, w: 80, h: 1400 },
        { type: "switch", x: -600, y: 0, links: ["m8"] },
        { type: "mover", id: "m8", needsPower: true, x: -280, y: -20, w: 240, h: 40, x2: 480, y2: -20, speed: 4 },
        { type: "spikes", x: 100, y: -600, w: 1000 },
        { type: "checkpoint", x: 750, y: 0 },
        { type: "fan", x: 950, y: 0, w: 220, h: 1150, power: 1.8 },
        { type: "key", x: 1380, y: 1060, color: "#38bdf8" },
        { type: "lockdoor", x: 1700, y: 700, w: 90, h: 1400, color: "#38bdf8" },
        { type: "star", x: 100, y: 500 },
        { type: "exit", x: 1920, y: 0 }
    ]);
PUZZLE_ROOMS.noBaseFloor.lab_7 = true;

GameModes.register({
    id: "puzzle",
    title: "CRATE LAB",
    tagline: "Physics puzzle rooms: plates, doors, levers, fans, keys and TNT.",
    color: "#d9a05b",
    firstLevel: function() { return PUZZLE_ROOMS[Math.min(puzzleState.room, puzzleState.unlocked - 1)]; },
    flags: { waves: false, revive: false, jetpack: false, shooting: true, ability: false, ammo: false, noBedrock: false, scenery: false, coopToggle: true, wallJump: false, airJumps: 1, enemiesPassive: true },
    overTitle: "LAB COMPLETE!",
    againLabel: "Play from room 1",

    setupLevel: function(lvl) {
        // rooms with pits replace the full floor with segments
        if (PUZZLE_ROOMS.noBaseFloor[LevelManager.currentLevelKey]) {
            for (let i = staticObjects.length - 1; i >= 0; i--) {
                var o = staticObjects[i];
                if (o.name === "Floor" && o.w > 2500) staticObjects.splice(i, 1);
            }
        }
        Gadgets.load(lvl.gadgets);
        puzzleState.room = PUZZLE_ROOMS.indexOf(LevelManager.currentLevelKey);
        puzzleState.time = 0;
        puzzleState.done = false;
    },

    createPlayers: function() {
        var lvl = LevelManager.getCurrentLevel();
        ModeKit.makeHero(0, lvl.spawnP1[0], lvl.spawnP1[1] + 40);
        if (multiplayer) ModeKit.makeHero(1, lvl.spawnP2[0], lvl.spawnP2[1] + 40);
        else blueGuy = null;
    },

    update: function() {
        if (!puzzleState.done) puzzleState.time++;
        else if (--puzzleState.doneTimer <= 0) {
            var next = puzzleState.room + 1;
            if (next < PUZZLE_ROOMS.length) LevelManager.selectLevel(PUZZLE_ROOMS[next]);
            else { gameOver = true; puzzleState.done = false; }
        }
        // falling out of the world = respawn
        for (let i = 0; i < characters.length; i++) if (characters[i].y < -1400) Gadgets.killPlayer(characters[i], "WHOOPS!");
    },

    onExit: function() {
        if (puzzleState.done) return;
        puzzleState.done = true;
        puzzleState.doneTimer = 130;
        var r = puzzleState.room;
        var t = puzzleState.time / 60;
        var key = PUZZLE_ROOMS[r];
        if (!puzzleState.best[key] || t < puzzleState.best[key]) puzzleState.best[key] = Math.round(t * 10) / 10;
        puzzleState.unlocked = Math.max(puzzleState.unlocked, Math.min(PUZZLE_ROOMS.length, r + 2));
        puzzleState.room = Math.min(PUZZLE_ROOMS.length - 1, r + 1);
        savePuzzle();
        if (typeof SFX !== "undefined") SFX.play("clear");
        if (typeof showBanner === "function") showBanner("ROOM " + (r + 1) + " CLEAR!", t.toFixed(1) + "s  ·  stars " + Gadgets.starsGot + "/" + Gadgets.starsTotal + "  ·  deaths " + Gadgets.deaths, "#4ade80");
    },

    onDamage: function(ch, amount, kx, ky) {
        // no health in the lab; big blasts just send you flying
        if (amount <= -25) { ch.ragdollImmune = 0; ch.startRagdoll(kx, ky, 45); }
        return true;
    },

    onKey: function(code) {
        if (code === "KeyR") { LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        return false;
    },

    overSub: function(over) {
        return over ? ("All " + PUZZLE_ROOMS.length + " rooms solved!") : ("Room " + (puzzleState.room + 1) + " / " + PUZZLE_ROOMS.length + "  ·  " + (puzzleState.time / 60).toFixed(1) + "s  ·  ★ " + Gadgets.starsGot + "/" + Gadgets.starsTotal);
    },

    onRestart: function() { puzzleState.room = 0; LevelManager.selectLevel(PUZZLE_ROOMS[0]); },

    drawHUD: function() {
        var lvl = LevelManager.getCurrentLevel();
        uiPanel(14, 14, 380, 92, "#d9a05b");
        uiText("CRATE LAB", 30, 46, 24, "#f4c27a", "left", "900");
        uiText("ROOM " + (puzzleState.room + 1) + "/" + PUZZLE_ROOMS.length + "  ·  " + (lvl.title || ""), 30, 70, 14, "#e2e8f0", "left", "800");
        uiText("⏱ " + (puzzleState.time / 60).toFixed(1) + "s   ★ " + Gadgets.starsGot + "/" + Gadgets.starsTotal + "   ☠ " + Gadgets.deaths + (Gadgets.keys["#facc15"] || Gadgets.keys["#38bdf8"] ? "   🔑" : ""), 30, 94, 13, "#94a3b8", "left", "700");
        uiText("G / right-click grab · click throw · E lever · R restart room · Esc menu", cssW / 2, cssH - 16, 12, "rgba(220,230,240,0.7)", "center", "700");
    },

    menuItems: function(items) {
        items.push({ id: "pz_room", label: "Room:  ◀  " + (puzzleState.room + 1) + " / " + PUZZLE_ROOMS.length + "  (" + puzzleState.unlocked + " unlocked)  ▶", hint: "Enter loads the room", cycle: true });
        items.push({ id: "pz_restart", label: "Restart this room  (R)", hint: "" });
    },

    onMenu: function(id, dir) {
        if (id === "pz_room") {
            if (dir) { puzzleState.room = (puzzleState.room + dir + puzzleState.unlocked) % puzzleState.unlocked; }
            else { closePause(); LevelManager.selectLevel(PUZZLE_ROOMS[puzzleState.room]); }
            return true;
        }
        if (id === "pz_restart") { closePause(); LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        return false;
    }
});
