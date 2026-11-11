// ============================================================================
// GAME: PARKOUR RUSH  (race)  -  speedrun obstacle courses
//   Slopes, slides, opt-in stairs, bounce pads, wall-jump chimneys, dash gaps, moving platforms,
//   fans and spike pits. Checkpoints catch you, stars reward detours, the flag is the finish line.
//   Best times + a ghost of your best run are saved per course. 2 players race head-to-head.
// ============================================================================
var RACE_COURSES = [];
var raceSave = { best: {}, ghost: {}, medals: {}, splits: {}, course: 0 };
try { var _rs = JSON.parse(localStorage.getItem("timsParkourRush") || "null"); if (_rs) { for (var _k in _rs) raceSave[_k] = _rs[_k]; } } catch (e) {}
function saveRace() { try { localStorage.setItem("timsParkourRush", JSON.stringify(raceSave)); } catch (e) {} }

var Race = {
    phase: "ready", timer: 0, time: 0,
    finish: {},        // playerIndex -> frames
    rec: [], ghost: null, ghostOn: true,
    newBest: false, endTimer: 0
};

// ---- Course building blocks (floor tops in world y, +y up) ----
var RK = {
    col: "#3b4a63", tex: "brick",
    // solid ground column from x0..x1 with its top at `top`
    ground: function(x0, x1, top, name) { return { type: "box", name: name || "Ground", x: (x0 + x1) / 2, y: (top - 1600) / 2, w: x1 - x0, h: top + 1600, color: RK.col, texture: RK.tex, kind: "block" }; },
    // thin solid ledge
    ledge: function(x0, x1, top) { return { type: "box", name: "Ledge", x: (x0 + x1) / 2, y: top - 30, w: x1 - x0, h: 60, color: "#4b5d7a", texture: "brick", kind: "block" }; },
    // one-way platform (jump up through it)
    plat: function(x0, x1, top) { return { type: "box", name: "Platform", x: (x0 + x1) / 2, y: top - 15, w: x1 - x0, h: 30, color: "#8b6b4a", texture: "dojo_wood", kind: "platform" }; },
    wall: function(x, bottom, top, w) { w = w || 80; return { type: "box", name: "Climb Wall", x: x, y: (bottom + top) / 2, w: w, h: top - bottom, color: "#55657f", texture: "brick", kind: "wall" }; },
    // sloped piece from (x0, y0) to (x1, y1) with a ground column underneath. kind: "Slope" | "Slide" | "Stairs"
    ramp: function(x0, y0, x1, y1, kind) {
        var lo = Math.min(y0, y1), hgt = Math.abs(y1 - y0);
        var tex = kind === "Slide" ? undefined : (kind === "Stairs" ? "dojo_wood" : "grass_dirt");
        var col = kind === "Slide" ? "#7dd3fc" : (kind === "Stairs" ? "#a0784f" : "#5d8a3a");
        return [
            { type: "ramp", name: kind, x: (x0 + x1) / 2, y: lo + hgt / 2, w: x1 - x0, h: hgt, dir: y1 > y0 ? "right" : "left", color: col, texture: tex },
            RK.ground(x0, x1, lo)
        ];
    },
    pad: function(x, top, force) { return { type: "bumper", name: "Bounce Pad", x: x, y: top + 13, w: 140, h: 26, bounce: force || 30 }; }
};

function raceCourse(n, title, par, spawn, left, right, layout, gadgets, tips) {
    var key = "race_" + n;
    var items = ModeKit.room(left, right, 3200, { tex: "brick", color: "#26324a", noFloor: true }).concat(layout);
    ModeKit.addLevel(key, { name: "🏁 Parkour Rush " + (n + 1) + ": " + title, mode: "race", wavesEnabled: false,
        spawnP1: spawn, spawnP2: [spawn[0] + 110, spawn[1]], layout: items, gadgets: gadgets, title: title, par: par, tips: tips });
    RACE_COURSES[n] = key;
}

// ---------------------------------------------------------------- Course 1: Rooftop Run (learn the moves)
(function() {
    var L = [], G = [];
    var push = function(a) { if (Array.isArray(a)) L.push.apply(L, a); else L.push(a); };
    push(RK.ground(-400, 1100, 0));
    G.push({ type: "sign", x: 250, y: 0, text: "A/D run · W jump (again in the air!) · S drop\nShift DASH · jump off walls · hold W to take stairs" });
    // a small gap
    push(RK.ground(1400, 2100, 0));
    // slope up to a plateau, opt-in stairs up to a star shelf
    push(RK.ramp(2100, 0, 2700, 300, "Slope"));
    push(RK.ground(2700, 3700, 300));
    push(RK.ramp(2800, 300, 3200, 600, "Stairs"));
    push(RK.ledge(3200, 3500, 600));
    G.push({ type: "star", x: 3380, y: 700 });
    G.push({ type: "checkpoint", x: 3550, y: 300 });
    // spike pit with stepping platforms
    push(RK.ground(3700, 4900, -300));
    G.push({ type: "spikes", x: 4300, y: -300, w: 1200 });
    push(RK.ledge(4000, 4200, 260));
    push(RK.ledge(4450, 4650, 300));
    push(RK.ground(4900, 6600, 300));
    // bounce pad up to the high road
    L.push(RK.pad(5300, 300, 35));
    push(RK.ledge(5500, 6600, 1000));
    G.push({ type: "star", x: 6400, y: 1120 });
    // ice slide back down
    push(RK.ramp(6600, 1000, 7600, 300, "Slide"));
    push(RK.ground(7600, 8800, 300));
    G.push({ type: "checkpoint", x: 7750, y: 300 });
    // wall-jump chimney
    L.push(RK.wall(8100, 650, 1600));   // walk under this one into the chimney
    L.push(RK.wall(8400, 300, 1100));   // climb past this one
    push(RK.ledge(8440, 9100, 1100));
    G.push({ type: "sign", x: 7950, y: 300, text: "WALL JUMP: jump into a wall,\nthen jump again to kick off it." });
    push(RK.ground(9100, 10000, 0));
    push(RK.ramp(8800, 300, 9100, 0, "Slope"));
    G.push({ type: "exit", x: 9700, y: 0 });
    raceCourse(0, "Rooftop Run", [24, 32, 45], [0, 60], -400, 10000, L, G);
})();

// ---------------------------------------------------------------- Course 2: Factory Floor (movers, fans, dash gaps)
(function() {
    var L = [], G = [];
    var push = function(a) { if (Array.isArray(a)) L.push.apply(L, a); else L.push(a); };
    RK.tex = "lab_metal"; RK.col = "#3a4556";
    push(RK.ground(-400, 900, 0));
    G.push({ type: "sign", x: 250, y: 0, text: "DASH (Shift) across wide gaps.\nRide the moving platforms." });
    // long dash gap
    push(RK.ground(1500, 2400, 0));
    G.push({ type: "spikes", x: 1200, y: -500, w: 600 });
    push(RK.ground(900, 1500, -500));
    // moving platform over a spike river
    push(RK.ground(2400, 4200, -500));
    G.push({ type: "spikes", x: 3300, y: -500, w: 1800 });
    G.push({ type: "mover", x: 2650, y: -20, w: 260, h: 40, x2: 3950, y2: -20, speed: 7 });
    G.push({ type: "star", x: 3300, y: 420 });
    push(RK.ground(4200, 5200, 0));
    G.push({ type: "checkpoint", x: 4400, y: 0 });
    // fan shaft up to the catwalk
    G.push({ type: "fan", x: 4900, y: 0, w: 240, h: 1450, power: 1.9 });
    push(RK.ledge(5200, 6600, 1150));
    G.push({ type: "sign", x: 4600, y: 0, text: "Float up the fan!" });
    // catwalk: vertical mover lift down + spikes underneath
    push(RK.ground(5200, 8000, -500));
    G.push({ type: "spikes", x: 6600, y: -500, w: 2800 });
    G.push({ type: "mover", x: 6800, y: 1130, w: 220, h: 40, x2: 6800, y2: 200, speed: 4 });
    push(RK.ledge(7050, 7400, 200));
    push(RK.ledge(7650, 8000, 450));
    G.push({ type: "star", x: 7250, y: 1100 });
    push(RK.ground(8000, 9200, 450));
    G.push({ type: "checkpoint", x: 8150, y: 450 });
    // bouncy staircase of pads
    L.push(RK.pad(8600, 450, 33));
    push(RK.ledge(8800, 9200, 1050));
    push(RK.ramp(9200, 1050, 10200, 0, "Slide"));
    push(RK.ground(10200, 11400, 0));
    G.push({ type: "exit", x: 11100, y: 0 });
    RK.tex = "brick"; RK.col = "#3b4a63";
    raceCourse(1, "Factory Floor", [30, 40, 58], [0, 60], -400, 11400, L, G);
})();

// ---------------------------------------------------------------- Course 3: Sky Spire (vertical + everything)
(function() {
    var L = [], G = [];
    var push = function(a) { if (Array.isArray(a)) L.push.apply(L, a); else L.push(a); };
    RK.tex = "castle_stone"; RK.col = "#40404e";
    push(RK.ground(-400, 800, 0));
    G.push({ type: "sign", x: 250, y: 0, text: "Final course. Climb the spire,\nthen dive for the flag!" });
    push(RK.ramp(800, 0, 1600, 400, "Slope"));
    push(RK.ground(1600, 2600, 400));
    // wall-jump chimney
    L.push(RK.wall(2150, 750, 1900));
    L.push(RK.wall(2450, 400, 1500));
    push(RK.ledge(2490, 3200, 1500));
    G.push({ type: "checkpoint", x: 2900, y: 1500 });
    // floating one-way platforms
    push(RK.plat(3350, 3600, 1750));
    push(RK.plat(3800, 4050, 2000));
    push(RK.plat(4250, 4500, 1750));
    G.push({ type: "star", x: 3925, y: 2350 });
    push(RK.ledge(4650, 5400, 1500));
    // spike-lined dash gap
    G.push({ type: "spikes", x: 5750, y: 1100, w: 700 });
    push(RK.ledge(5400, 6100, 1100));
    push(RK.ledge(6100, 6900, 1500));
    G.push({ type: "checkpoint", x: 6250, y: 1500 });
    // pad + fan combo to the top
    L.push(RK.pad(6780, 1500, 40));
    G.push({ type: "fan", x: 6780, y: 1500, w: 200, h: 1150, power: 1.5 });
    push(RK.ledge(6950, 7700, 2500));
    G.push({ type: "star", x: 7550, y: 2620 });
    // the big dive: slide + slope + moving platform
    push(RK.ramp(7700, 2500, 9300, 900, "Slide"));
    push(RK.ground(9300, 9800, 900));
    G.push({ type: "spikes", x: 10350, y: 300, w: 1100 });
    push(RK.ground(9800, 10900, 300));
    G.push({ type: "mover", x: 10000, y: 880, w: 220, h: 40, x2: 10700, y2: 880, speed: 4 });
    push(RK.ground(10900, 12200, 900));
    G.push({ type: "checkpoint", x: 11100, y: 900 });
    push(RK.ramp(11500, 900, 12200, 1200, "Stairs"));
    G.push({ type: "star", x: 12000, y: 1450 });
    push(RK.ramp(12200, 900, 12800, 0, "Slope"));
    push(RK.ground(12800, 13800, 0));
    G.push({ type: "exit", x: 13500, y: 0 });
    RK.tex = "brick"; RK.col = "#3b4a63";
    raceCourse(2, "Sky Spire", [42, 56, 80], [0, 60], -400, 13800, L, G);
})();

function raceFmt(frames) {
    if (frames == null) return "--";
    var s = frames / 60;
    var m = Math.floor(s / 60);
    return (m > 0 ? m + ":" + (s % 60 < 10 ? "0" : "") : "") + (s % 60).toFixed(2);
}

function raceMedal(key, frames) {
    var par = (LevelManager.getAllLevels()[key] || {}).par || [30, 45, 60];
    var s = frames / 60;
    return s <= par[0] ? 3 : (s <= par[1] ? 2 : (s <= par[2] ? 1 : 0));
}
var MEDAL_NAMES = ["", "BRONZE", "SILVER", "GOLD"];
var MEDAL_COLORS = ["#64748b", "#cd7f32", "#cbd5e1", "#ffd23f"];

GameModes.register({
    id: "race",
    title: "PARKOUR RUSH",
    tagline: "Speedrun obstacle courses. Beat your ghost, grab the stars, race a friend.",
    color: "#38bdf8",
    firstLevel: function() { return RACE_COURSES[raceSave.course || 0] || RACE_COURSES[0]; },
    flags: { waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, noBedrock: true, scenery: false,
        coopToggle: true, dash: true, wallJump: true, airJumps: 1, enemiesPassive: true, playerControl: true, bigPads: true },
    overTitle: "COURSE COMPLETE",
    againLabel: "Run it again",

    setupLevel: function(lvl) {
        Gadgets.load(lvl.gadgets);
        raceSave.course = Math.max(0, RACE_COURSES.indexOf(LevelManager.currentLevelKey));
        Race.phase = "ready"; Race.timer = 150; Race.time = 0;
        Race.finish = {}; Race.rec = []; Race.newBest = false; Race.endTimer = 0; Race.hurry = undefined;
        Race.splits = []; Race.splitShow = null;
        if (!raceSave.splits) raceSave.splits = {};
        var g = raceSave.ghost[LevelManager.currentLevelKey];
        Race.ghost = (g && g.length) ? g : null;
    },

    createPlayers: function() {
        var lvl = LevelManager.getCurrentLevel();
        ModeKit.makeHero(0, lvl.spawnP1[0], lvl.spawnP1[1] + 40);
        if (multiplayer) ModeKit.makeHero(1, lvl.spawnP2[0], lvl.spawnP2[1] + 40);
        else blueGuy = null;
    },

    preUpdate: function() {
        this.flags.playerControl = (Race.phase === "run");
        if (Race.phase === "ready") {
            if (Race.timer % 50 === 0 && Race.timer > 0 && typeof SFX !== "undefined") SFX.play("select");
            if (--Race.timer <= 0) { Race.phase = "run"; if (typeof SFX !== "undefined") SFX.play("whistle"); }
        }
    },

    update: function() {
        if (Race.phase === "run") {
            Race.time++;
            // record P1 every 2 frames for the ghost
            if (redGuy && Race.time % 2 === 0 && Race.finish[0] === undefined && Race.rec.length < 12000) {
                Race.rec.push(Math.round(redGuy.x), Math.round(redGuy.y));
            }
        }
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            var floorY = (c.respawnY !== undefined ? c.respawnY : 0) - 1000;
            if (c.y < Math.max(-1100, floorY)) Gadgets.killPlayer(c, "FELL!");
        }
        if (Race.phase === "done" && --Race.endTimer <= 0) { Race.phase = "results"; gameOver = true; }
        // 2-player: once someone finishes, the other gets 10 seconds
        if (Race.phase === "run" && multiplayer && Race.hurry !== undefined && --Race.hurry <= 0) this.finishRace();
    },

    // speedrun splits: P1's time at each checkpoint vs the splits of the best run
    onCheckpoint: function(c, g) {
        if (Race.phase !== "run" || c.playerIndex !== 0) return;
        var cps = Gadgets.list.filter(function(q) { return q.type === "checkpoint"; }).sort(function(a, b) { return a.x - b.x; });
        var i = cps.indexOf(g);
        if (i < 0 || Race.splits[i] !== undefined) return;
        Race.splits[i] = Race.time;
        var old = (raceSave.splits[LevelManager.currentLevelKey] || [])[i];
        var d = old !== undefined ? (Race.time - old) / 60 : null;
        Race.splitShow = { i: i, t: Race.time, d: d, until: Race.time + 180 };
        if (d !== null) Components.addFloatingText((d <= 0 ? "-" : "+") + Math.abs(d).toFixed(2), c.x, c.y + 150, d <= 0 ? "#4ade80" : "#f87171", 22);
    },

    onExit: function(c, g) {
        if (Race.phase !== "run" || Race.finish[c.playerIndex] !== undefined) { g.done = false; return; }
        Race.finish[c.playerIndex] = Race.time;
        g.done = false; // let the other racer finish too
        Components.addFloatingText(c.playerLabel + " FINISHED! " + raceFmt(Race.time), c.x, c.y + 120, "#ffd23f", 24);
        Components.spawnSparks(c.x, c.y + 60, "#ffd23f", 24);
        var all = true;
        for (let i = 0; i < characters.length; i++) if (Race.finish[characters[i].playerIndex] === undefined) all = false;
        if (all) this.finishRace();
        else if (Race.hurry === undefined) { Race.hurry = 600; showBanner(c.playerLabel + " WINS THE RACE!", "10 seconds to finish!", "#ffd23f"); }
    },

    finishRace: function() {
        if (Race.phase !== "run") return;
        Race.phase = "done"; Race.endTimer = 150; Race.hurry = undefined;
        var key = LevelManager.currentLevelKey;
        var t = Race.finish[0];
        if (t !== undefined) {
            if (!raceSave.best[key] || t < raceSave.best[key]) {
                Race.newBest = true;
                raceSave.best[key] = t;
                raceSave.ghost[key] = Race.rec.slice();
                raceSave.splits[key] = Race.splits.slice();
            }
            raceSave.medals[key] = Math.max(raceSave.medals[key] || 0, raceMedal(key, t));
            saveRace();
        }
        if (typeof SFX !== "undefined") SFX.play("clear");
        var m = t !== undefined ? raceMedal(key, t) : 0;
        showBanner(t !== undefined ? ("FINISH!  " + raceFmt(t)) : "TIME!", (m ? MEDAL_NAMES[m] + " MEDAL" : "No medal - keep practising") + (Race.newBest ? "  ·  NEW BEST!" : ""), MEDAL_COLORS[m]);
    },

    overSub: function() {
        var key = LevelManager.currentLevelKey, t = Race.finish[0];
        var m = t !== undefined ? raceMedal(key, t) : 0;
        return "Course " + (RACE_COURSES.indexOf(key) + 1) + "  ·  " + (t !== undefined ? raceFmt(t) + "s" : "DNF") + (m ? "  ·  " + MEDAL_NAMES[m] : "") + "  ·  best " + raceFmt(raceSave.best[key]) + (Race.newBest ? "  ·  NEW BEST!" : "");
    },

    onDamage: function(ch, amount, kx, ky) { return true; },

    onKey: function(code) {
        if (code === "KeyR") { LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        // T: straight back to your last checkpoint (the clock keeps running; not counted as a fall)
        if (code === "KeyT" && redGuy && !redGuy.dead && Race.phase === "run") {
            var c = redGuy;
            // no checkpoint yet: back to the start of the course (never to an unset spawn = NaN)
            var start = LevelManager.getCurrentLevel().spawnP1 || [0, 120];
            c.x = c.respawnX !== undefined ? c.respawnX : start[0]; c.y = c.respawnY !== undefined ? c.respawnY : start[1] + 40;
            c.xspeed = c.yspeed = 0; c.invulnTimer = 30;
            if (c.liveRagdoll && typeof Ragdolls !== "undefined") { Ragdolls.remove(c.liveRagdoll); c.liveRagdoll = null; c.ragdollTimer = 0; }
            Components.spawnSparks(c.x, c.y, "#7ff0ff", 10);
            Components.addFloatingText("↩ CHECKPOINT", c.x, c.y + 90, "#7ff0ff", 18);
            return true;
        }
        if (code === "KeyG") { Race.ghostOn = !Race.ghostOn; return true; }
        return false;
    },

    onRestart: function() { LevelManager.selectLevel(LevelManager.currentLevelKey); },

    drawWorld: function() {
        // ghost of the best run
        if (!Race.ghost || !Race.ghostOn || Race.phase === "ready") return;
        var idx = Math.min(Math.floor(Race.time / 2), Race.ghost.length / 2 - 1) * 2;
        var gx = Race.ghost[idx], gy = Race.ghost[idx + 1];
        var sx = wsx(gx), sy = wsy(gy), S = s1 * cameraScaleX;
        if (sx < -100 || sx > cssW + 100) return;
        ctx.save();
        ctx.globalAlpha = 0.38;
        if (typeof drawSkinPreview === "function") drawSkinPreview(heroSkins[0], sx, sy, S, "#a5f3fc", "");
        ctx.globalAlpha = 0.7;
        ctx.font = "800 " + Math.round(12 * Math.max(0.7, cameraScaleX)) + "px " + UI_FONT;
        ctx.textAlign = "center";
        ctx.fillStyle = "#a5f3fc";
        ctx.fillText("GHOST", sx, sy - S * 0.75);
        ctx.restore();
    },

    drawHUD: function() {
        var key = LevelManager.currentLevelKey, lvl = LevelManager.getCurrentLevel();
        var n = RACE_COURSES.indexOf(key);
        uiPanel(14, 14, 400, 104, "#38bdf8");
        uiText("PARKOUR RUSH", 30, 46, 24, "#7dd3fc", "left", "900");
        uiText("COURSE " + (n + 1) + "/" + RACE_COURSES.length + "  ·  " + (lvl.title || ""), 30, 70, 14, "#e2e8f0", "left", "800");
        var best = raceSave.best[key];
        uiText("⏱ " + raceFmt(Race.time) + "    best " + raceFmt(best) + "    ★ " + Gadgets.starsGot + "/" + Gadgets.starsTotal + "   ☠ " + Gadgets.deaths, 30, 94, 13, "#94a3b8", "left", "700");
        var par = lvl.par || [30, 45, 60];
        uiText("🥇 " + par[0] + "s   🥈 " + par[1] + "s   🥉 " + par[2] + "s" + (raceSave.medals[key] ? "   earned: " + MEDAL_NAMES[raceSave.medals[key]] : ""), 30, 110, 11, "#64748b", "left", "700");
        // big timer
        uiText(raceFmt(Race.time), cssW / 2, 96, 34, Race.phase === "run" ? "#ffffff" : "#ffd23f", "center", "900");
        if (Race.splitShow && Race.time < Race.splitShow.until) {
            var sp = Race.splitShow, good = sp.d !== null && sp.d <= 0;
            uiPanel(cssW / 2 - 110, 138, 220, 34, sp.d === null ? "#38bdf8" : (good ? "#4ade80" : "#f87171"), 0.9);
            uiText("CP " + (sp.i + 1) + "  " + raceFmt(sp.t) + (sp.d === null ? "" : "   " + (good ? "-" : "+") + Math.abs(sp.d).toFixed(2)), cssW / 2, 161, 16, sp.d === null ? "#e2e8f0" : (good ? "#86efac" : "#fca5a5"), "center", "900");
        }
        // speed lines when you're really moving
        if (redGuy && !redGuy.dead && Race.phase === "run") {
            var spd = Math.hypot(redGuy.xspeed, redGuy.yspeed);
            if (spd > 13) {
                var a = Math.min(0.35, (spd - 13) * 0.04), dir = redGuy.xspeed >= 0 ? 1 : -1;
                ctx.strokeStyle = "rgba(255,255,255," + a.toFixed(3) + ")"; ctx.lineWidth = 2;
                for (let i = 0; i < 14; i++) {
                    var ly = ((i * 97 + Race.time * 3) % cssH), lx = (i % 2 ? cssW - 40 : 40) + ((Race.time * 23 + i * 61) % 120) * -dir, len = 60 + (i * 37) % 90;
                    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - dir * len, ly); ctx.stroke();
                }
            }
        }
        if (Race.phase === "ready") {
            var c = Math.ceil(Race.timer / 50);
            uiText(c > 0 ? String(c) : "GO!", cssW / 2, cssH / 2 - 40, 110, "#38bdf8", "center", "900");
        }
        if (Race.hurry !== undefined && Race.phase === "run") uiText("HURRY! " + Math.ceil(Race.hurry / 60), cssW / 2, 196, 20, "#ff6b6b", "center", "900");
        // course progress bar
        var exitG = null;
        for (let i = 0; i < Gadgets.list.length; i++) if (Gadgets.list[i].type === "exit") exitG = Gadgets.list[i];
        if (exitG) {
            var bx = cssW / 2 - 200, bw = 400, by = 118;
            uiRoundRect(bx, by, bw, 6, 3); ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fill();
            var span = exitG.x - lvl.spawnP1[0];
            var mark = function(x, col, r) {
                var p = Math.max(0, Math.min(1, (x - lvl.spawnP1[0]) / span));
                ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx + p * bw, by + 3, r, 0, Math.PI * 2); ctx.fill();
            };
            if (Race.ghost && Race.ghostOn) { var gi = Math.min(Math.floor(Race.time / 2), Race.ghost.length / 2 - 1) * 2; mark(Race.ghost[gi], "rgba(165,243,252,0.7)", 5); }
            for (let i = 0; i < characters.length; i++) mark(characters[i].x, characters[i].color || "#fff", 7);
        }
        uiText("A/D run · W jump · Shift dash · wall-jump · hold W for stairs · T last checkpoint · R restart · G ghost " + (Race.ghostOn ? "on" : "off") + " · Esc menu", cssW / 2, cssH - 16, 12, "rgba(220,230,240,0.7)", "center", "700");
        for (let i = 0; i < characters.length; i++) if (!characters[i].dead) drawEdgeIndicator(characters[i].x, characters[i].y, characters[i].color, characters[i].playerLabel);
    },

    menuItems: function(items) {
        var n = Math.max(0, RACE_COURSES.indexOf(LevelManager.currentLevelKey));
        items.push({ id: "rc_course", label: "Course:  ◀  " + (n + 1) + " / " + RACE_COURSES.length + "  ▶", hint: "", cycle: true });
        items.push({ id: "rc_select", label: "🗺 Course select…", hint: "all courses, best times, medals" });
        items.push({ id: "rc_restart", label: "Restart run  (R)", hint: "" });
        items.push({ id: "rc_ghost", label: "Ghost:  " + (Race.ghostOn ? "ON" : "OFF"), hint: "G" });
        items.push({ id: "rc_clear", label: "Erase best time + ghost", hint: "this course" });
    },

    onMenu: function(id, dir) {
        if (id === "rc_course") {
            var n = Math.max(0, RACE_COURSES.indexOf(LevelManager.currentLevelKey));
            n = (n + (dir || 1) + RACE_COURSES.length) % RACE_COURSES.length;
            closePause(); LevelManager.selectLevel(RACE_COURSES[n]);
            return true;
        }
        if (id === "rc_select") {
            var name = function(k) { var L = LevelManager.getAllLevels()[k] || {}; return (L.title || L.name || k).replace(/^[^A-Za-z0-9]+/, ""); };
            CourseSelect.open({ title: "🏃 Parkour Rush — courses", items: RACE_COURSES.map(function(k) { return { name: name(k), best: raceSave.best[k] ? raceFmt(raceSave.best[k]) + "s" : "", medal: raceSave.medals[k] || 0, current: k === LevelManager.currentLevelKey }; }),
                onPick: function(i) { LevelManager.selectLevel(RACE_COURSES[i]); } });
            return true;
        }
        if (id === "rc_restart") { closePause(); LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        if (id === "rc_ghost") { Race.ghostOn = !Race.ghostOn; return true; }
        if (id === "rc_clear") {
            var k = LevelManager.currentLevelKey;
            delete raceSave.best[k]; delete raceSave.ghost[k]; delete raceSave.medals[k]; saveRace(); Race.ghost = null;
            return true;
        }
        return false;
    }
});
