// ============================================================================
// GAME: RAGDOLL SIEGE  (siege)  -  slingshot ragdolls into zombie forts
//   Pull back the slingshot (drag with the mouse, or W/S aim + A/D power + Space/F fire),
//   launch crash-test dummies, heavy brutes and bombs (tap again mid-air to detonate)
//   into crate forts. Topple towers, crush zombies, earn up to 3 stars per fort.
// ============================================================================
var SIEGE_LEVELS = [];
var siegeSave = { stars: {}, best: {}, level: 0 };
try { var _ss = JSON.parse(localStorage.getItem("timsRagdollSiege") || "null"); if (_ss) { for (var _k2 in _ss) siegeSave[_k2] = _ss[_k2]; } } catch (e) {}
function saveSiege() { try { localStorage.setItem("timsRagdollSiege", JSON.stringify(siegeSave)); } catch (e) {} }

var SIEGE_ANCHOR = { x: -700, y: 330 };
var SIEGE_MAX_PULL = 230;
var SIEGE_POWER = 0.152;           // launch speed per px of pull  (max ~35 px/frame)
var AMMO = {
    dummy: { name: "Dummy", color: "#ff4d5e", desc: "Crash-test hero" },
    heavy: { name: "Heavy", color: "#a855f7", desc: "Twice the mass" },
    bomb:  { name: "Bomb", color: "#f97316", desc: "Click / Space again to detonate" }
};

var Siege = {
    phase: "aim", shots: [], shotIdx: 0, rd: null, rdType: null, flightT: 0, settleT: 0,
    angle: 40, power: 0.75, dragging: false, wasMouse: false, wasFire: false,
    score: 0, kills: 0, enemyTotal: 0, resultT: 0, won: false
};

// ---- building pieces ----
function sgCrate(x, y, w, h) { return { type: "crate", name: "Crate", x: x, y: y, size: 80, w: w || 80, h: h || 80, color: "#c98c4a", texture: "crate_plank" }; }
function sgPlank(x, y, w) { return { type: "crate", name: "Plank", x: x, y: y, w: w, h: 28, color: "#b07a3e", texture: "dojo_wood" }; }
function sgTNT(x, y) { return { type: "crate", name: "TNT Barrel", x: x, y: y, size: 70, explosive: true }; }
function sgStone(x, y, w, h) { return { type: "box", name: "Stone", x: x, y: y, w: w, h: h, color: "#6b7280", texture: "castle_stone", kind: "block" }; }
// a column of n crates whose bottom sits on `base`
function sgTower(x, base, n, size) { size = size || 80; var o = []; for (let i = 0; i < n; i++) o.push(sgCrate(x, base + size / 2 + i * size + 1, size, size)); return o; }

function siegeLevel(n, title, layout, enemies, ammo, focusX) {
    var key = "siege_" + n;
    var items = ModeKit.room(-1500, 2400, 2600, { tex: "brick", color: "#2b3445", floorColor: "#4a5a3a", floorTex: "grass_dirt" })
        .concat([sgStone(SIEGE_ANCHOR.x, 100, 170, 200)])
        .concat(layout);
    ModeKit.addLevel(key, { name: "🎯 Ragdoll Siege " + (n + 1) + ": " + title, mode: "siege", wavesEnabled: false,
        spawnP1: [-880, 60], spawnP2: [-980, 60], layout: items, title: title, siege: { enemies: enemies, ammo: ammo, focusX: focusX || 700 } });
    SIEGE_LEVELS[n] = key;
}

// 1: two towers
siegeLevel(0, "Knock Knock",
    [].concat(sgTower(450, 0, 3), sgTower(850, 0, 4)),
    [[450, 290, "NORMAL"], [850, 370, "NORMAL"]],
    ["dummy", "dummy", "dummy"], 650);

// 2: plank house
siegeLevel(1, "Plank House",
    [].concat(sgTower(520, 0, 2), sgTower(880, 0, 2), [sgPlank(700, 175, 480)], sgTower(600, 190, 1), sgTower(800, 190, 1), [sgPlank(700, 285, 320)]),
    [[700, 60, "NORMAL"], [700, 350, "NORMAL"], [1100, 60, "LEAPER"]],
    ["dummy", "heavy", "dummy"], 800);

// 3: TNT town
siegeLevel(2, "Boom Town",
    [].concat(sgTower(520, 0, 2), sgTower(980, 0, 2), [sgPlank(750, 175, 560), sgTNT(750, 225), sgTNT(750, 36)], sgTower(1250, 0, 3), [sgTNT(1250, 276)]),
    [[640, 60, "NORMAL"], [860, 60, "NORMAL"], [600, 240, "SPITTER"], [1400, 60, "NORMAL"]],
    ["bomb", "dummy", "dummy"], 760);

// 4: stone keep - lob over the wall
siegeLevel(3, "Stone Keep",
    [sgStone(420, 260, 120, 520), sgStone(1250, 200, 120, 400)].concat(
        sgTower(700, 0, 3), sgTower(980, 0, 3), [sgPlank(840, 255, 400)], sgTower(840, 270, 2)),
    [[840, 60, "KNIGHT"], [840, 480, "NORMAL"], [570, 60, "NORMAL"], [1105, 60, "ARCHER"]],
    ["heavy", "bomb", "dummy", "dummy"], 840);

// 5: king of the hill
siegeLevel(4, "King of the Hill",
    [{ type: "ramp", name: "Hill Slope", x: 500, y: 150, w: 400, h: 300, dir: "right", color: "#5d8a3a", texture: "grass_dirt" },
     { type: "box", name: "Hilltop", x: 1050, y: 150, w: 700, h: 300, color: "#5d8a3a", texture: "grass_dirt", kind: "block" },
     { type: "ramp", name: "Hill Slope", x: 1600, y: 150, w: 400, h: 300, dir: "left", color: "#5d8a3a", texture: "grass_dirt" }]
        .concat(sgTower(850, 300, 4), sgTower(1250, 300, 4), [sgPlank(1050, 636, 520)], sgTower(1050, 650, 2), [sgTNT(1050, 336)]),
    [[1050, 900, "BOSS_KING", 140], [950, 360, "NORMAL"], [1150, 360, "NORMAL"], [1700, 60, "TANK", 90], [400, 60, "NORMAL"]],
    ["heavy", "bomb", "dummy", "heavy", "bomb"], 1050);

function siegeLaunchVel() {
    var a = Siege.angle * Math.PI / 180, s = Siege.power * SIEGE_MAX_PULL * SIEGE_POWER;
    return [Math.cos(a) * s, Math.sin(a) * s];
}

// The pouch position for the current pull
function siegePouch() {
    var a = Siege.angle * Math.PI / 180, d = Siege.power * SIEGE_MAX_PULL;
    return [SIEGE_ANCHOR.x - Math.cos(a) * d, SIEGE_ANCHOR.y - Math.sin(a) * d];
}

function siegeEnemiesLeft() { var n = 0; for (let i = 0; i < zombies.length; i++) if (!zombies[i].dead) n++; return n; }

function siegeFire() {
    var type = Siege.shots[Siege.shotIdx];
    if (!type || Siege.phase !== "aim") return;
    var v = siegeLaunchVel(), pp = siegePouch();
    // a throw-away character only used to dress the ragdoll
    var box = Math.makeHitbox(s1, s2);
    var tmp;
    if (type === "dummy") {
        tmp = new Character("Dummy", box, box, "#ff4d5e", [pp[0], pp[1]], maxspeed, slower, gravity, bounciness, speed, "NONE", 100, "NONE", false, "NORMAL");
        tmp.isPlayer = true; tmp.playerIndex = 0;
    } else {
        tmp = new Character("Shot", box, box, AMMO[type].color, [pp[0], pp[1]], maxspeed, slower, gravity, bounciness, speed, "NONE", 100, "NONE", true, type === "heavy" ? "TANK" : "EXPLODER");
    }
    tmp.lastFacing = 1;
    var rd = Ragdolls.spawnFrom(tmp, { vx: v[0], vy: v[1], spin: 3 + Math.random() * 3 });
    rd.life = rd.maxLife = 900;
    rd.thrownBy = redGuy;
    rd.projectileTimer = 400;
    rd.siegeShot = type;
    Siege.rd = rd; Siege.rdType = type;
    Siege.phase = "flight"; Siege.flightT = 0; Siege.settleT = 0;
    Siege.shotIdx++;
    if (typeof SFX !== "undefined") SFX.play("sling");
    if (redGuy) { redGuy.scaleX = 0.8; redGuy.scaleY = 1.2; }
}

function siegeDetonate() {
    var rd = Siege.rd;
    if (!rd || Siege.rdType !== "bomb" || rd.detonated) return;
    rd.detonated = true;
    var x = rd.centerX(), y = rd.centerY();
    Ragdolls.remove(rd);
    Components.blowUp(x, y, "#ff7a1a", 30, 330, -70, redGuy);
    if (typeof Juice !== "undefined") Juice.hitStop(4);
    Siege.rd = null;
}

GameModes.register({
    id: "siege",
    title: "RAGDOLL SIEGE",
    tagline: "Slingshot ragdolls into zombie forts. Topple towers, earn 3 stars.",
    color: "#f97316",
    firstLevel: function() { return SIEGE_LEVELS[Math.min(siegeSave.level || 0, SIEGE_LEVELS.length - 1)]; },
    flags: { waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, noBedrock: true, scenery: true,
        coopToggle: false, dash: false, playerControl: false, enemiesPassive: true },
    overTitle: "FORT DESTROYED!",
    againLabel: "Retry this fort",

    setupLevel: function(lvl) {
        var sg = lvl.siege;
        Siege.phase = "aim"; Siege.shots = sg.ammo.slice(); Siege.shotIdx = 0; Siege.rd = null;
        Siege.score = 0; Siege.kills = 0; Siege.resultT = 0; Siege.won = false; Siege.dragging = false;
        Siege.angle = 40; Siege.power = 0.75; Siege.wasMouse = mouseDown; Siege.wasFire = true;
        siegeSave.level = Math.max(0, SIEGE_LEVELS.indexOf(LevelManager.currentLevelKey)); saveSiege();
        zombies.length = 0;
        for (let i = 0; i < sg.enemies.length; i++) {
            var e = sg.enemies[i];
            var z = spawnZombie(e[2], e[0], e[1]);
            z.hunter = false; z.siegeEnemy = true;
            z.health = z.maxHealth = e[3] || (e[2] === "KNIGHT" ? 70 : 42);
            z.lastFacing = -1; z.xspeed = 0;
            z._pvx = 0; z._pvy = 0; z._hitCd = 30;
        }
        Siege.enemyTotal = sg.enemies.length;
    },

    createPlayers: function() {
        var lvl = LevelManager.getCurrentLevel();
        var h = ModeKit.makeHero(0, lvl.spawnP1[0], lvl.spawnP1[1] + 40, { label: "P1" });
        h.lastFacing = 1;
        blueGuy = null;
    },

    preUpdate: function() {
        // enemy impact damage: falls, crushing crates, being slammed into things
        var crates = [];
        for (let i = 0; i < movingObjects.length; i++) {
            var o = movingObjects[i];
            if (!o.dead && o.movable && Math.hypot(o.xspeed, o.yspeed) > 6.5) crates.push(o);
        }
        for (let i = 0; i < zombies.length; i++) {
            var z = zombies[i];
            if (z.dead) continue;
            if (z._hitCd > 0) z._hitCd--;
            var dv = Math.hypot(z.xspeed - (z._pvx || 0), z.yspeed - (z._pvy || 0));
            if (dv > 11 && z._hitCd <= 0 && !z.liveRagdoll) {
                z._hitCd = 20;
                z.takeDamage(-(dv - 7) * 5, 0, 0, redGuy);
                Components.addFloatingText("CRUNCH!", z.x, z.y + 90, "#ffb703", 16);
            }
            for (let j = 0; j < crates.length; j++) {
                var c = crates[j];
                if (z._hitCd > 0) break;
                if (Math.abs(c.x - z.x) < (c.w + z.s1) / 2 + 8 && Math.abs(c.y - z.y) < (c.h + z.s2) / 2 + 8) {
                    var sp = Math.hypot(c.xspeed, c.yspeed);
                    z._hitCd = 20;
                    z.takeDamage(-sp * 4.5, Math.sign(c.xspeed) * 5, 4, redGuy);
                    Components.addFloatingText("CRUSHED!", z.x, z.y + 90, "#ffb703", 16);
                }
            }
            if (z.y < -300 || z.x > 2350) z.takeDamage(-999, 0, 0, redGuy);
        }
    },

    update: function() {
        // remember enemy velocities for next frame's impact check
        for (let i = 0; i < zombies.length; i++) { zombies[i]._pvx = zombies[i].xspeed; zombies[i]._pvy = zombies[i].yspeed; }
        var alive = siegeEnemiesLeft();
        var killedNow = Siege.enemyTotal - alive;
        if (killedNow > Siege.kills) { Siege.score += (killedNow - Siege.kills) * 1000; Siege.kills = killedNow; }

        // ---- input ----
        var md = mouseDown, fresh = md && !Siege.wasMouse;
        Siege.wasMouse = md;
        var fireKey = SpacePressed || EnterPressed;
        var fireFresh = fireKey && !Siege.wasFire;
        Siege.wasFire = fireKey;

        if (Siege.phase === "aim") {
            // keyboard aim
            if (WASDupPressed || ULDRupPressed) Siege.angle = Math.min(80, Siege.angle + 0.8);
            if (WASDdownPressed || ULDRdownPressed) Siege.angle = Math.max(-10, Siege.angle - 0.8);
            if (WASDrightPressed || ULDRrightPressed) Siege.power = Math.min(1, Siege.power + 0.012);
            if (WASDleftPressed || ULDRleftPressed) Siege.power = Math.max(0.15, Siege.power - 0.012);
            // mouse drag (anywhere on screen: pull away from the target)
            if (fresh) { Siege.dragging = true; }
            if (Siege.dragging && md) {
                var mw = Components.getMouseWorldPos();
                var dx = SIEGE_ANCHOR.x - mw[0], dy = SIEGE_ANCHOR.y - mw[1];
                var d = Math.hypot(dx, dy);
                if (d > 20) {
                    Siege.angle = Math.max(-10, Math.min(80, Math.atan2(dy, dx) * 180 / Math.PI));
                    Siege.power = Math.max(0.15, Math.min(1, d / SIEGE_MAX_PULL));
                }
            }
            if (Siege.dragging && !md) { Siege.dragging = false; siegeFire(); }
            else if (fireFresh) siegeFire();
        } else if (Siege.phase === "flight") {
            Siege.flightT++;
            if (Siege.rdType === "bomb" && (fresh || fireFresh) && Siege.flightT > 6) siegeDetonate();
            var rd = Siege.rd;
            // bombs also go off on a hard landing
            if (rd && Siege.rdType === "bomb" && Siege.flightT > 20 && (rd.grounded || rd.projectileTimer <= 0) && !rd.detonated) {
                if (!rd._fuse) rd._fuse = 40;
                if (--rd._fuse <= 0) siegeDetonate();
            }
            rd = Siege.rd;
            var still = !rd || Ragdolls.list.indexOf(rd) === -1 || (Math.abs(rd.velX()) + Math.abs(rd.velY()) < 0.6);
            Siege.settleT = still ? Siege.settleT + 1 : 0;
            if (Siege.settleT > 70 || Siege.flightT > 480) Siege.phase = "settle";
        } else if (Siege.phase === "settle") {
            // wait for falling crates & enemies to come to rest
            var moving = false;
            for (let i = 0; i < movingObjects.length; i++) { var o = movingObjects[i]; if (!o.dead && Math.hypot(o.xspeed, o.yspeed) > 1.2) moving = true; }
            for (let i = 0; i < zombies.length; i++) if (!zombies[i].dead && (Math.abs(zombies[i].yspeed) > 1.5 || zombies[i].liveRagdoll)) moving = true;
            Siege.settleT++;
            if (!moving || Siege.settleT > 300) {
                if (alive === 0) this.endLevel(true);
                else if (Siege.shotIdx >= Siege.shots.length) this.endLevel(false);
                else { Siege.phase = "aim"; Siege.rd = null; }
            }
        } else if (Siege.phase === "result") {
            if (--Siege.resultT <= 0) { Siege.phase = "over"; gameOver = true; }
        }
        // win immediately once the last zombie drops (after things settle a bit)
        if ((Siege.phase === "flight" || Siege.phase === "aim") && alive === 0 && Siege.enemyTotal > 0 && Siege.flightT > 30) Siege.phase = "settle";
        if (redGuy) { redGuy.lastFacing = 1; redGuy.degree = 90 - Siege.angle; }
    },

    endLevel: function(won) {
        Siege.won = won;
        Siege.phase = "result"; Siege.resultT = 150;
        var key = LevelManager.currentLevelKey;
        var left = Siege.shots.length - Siege.shotIdx;
        var stars = 0;
        if (won) {
            Siege.score += left * 1500;
            stars = left >= 2 ? 3 : (left >= 1 ? 2 : 1);
            siegeSave.stars[key] = Math.max(siegeSave.stars[key] || 0, stars);
            siegeSave.best[key] = Math.max(siegeSave.best[key] || 0, Siege.score);
            var idx = SIEGE_LEVELS.indexOf(key);
            if (idx + 1 < SIEGE_LEVELS.length) siegeSave.level = idx + 1;
            saveSiege();
            if (typeof SFX !== "undefined") SFX.play("clear");
            showBanner("FORT DESTROYED!", "★".repeat(stars) + "☆".repeat(3 - stars) + "   score " + Siege.score, "#ffd23f");
        } else {
            if (typeof SFX !== "undefined") SFX.play("fizzle");
            showBanner("OUT OF AMMO", siegeEnemiesLeft() + " zombie" + (siegeEnemiesLeft() === 1 ? "" : "s") + " survived", "#ff6b6b");
        }
        Siege.stars = stars;
        this.overTitle = won ? "FORT DESTROYED!" : "OUT OF AMMO";
    },

    onSecondary: function() {
        // right-click cycles which of the remaining shots goes next
        if (Siege.phase !== "aim") return true;
        var rest = Siege.shots.slice(Siege.shotIdx);
        if (rest.length > 1) { rest.push(rest.shift()); Siege.shots = Siege.shots.slice(0, Siege.shotIdx).concat(rest); if (typeof SFX !== "undefined") SFX.play("select"); }
        return true;
    },

    onKey: function(code) {
        if (code === "KeyR") { LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        if (code === "Tab" || code === "KeyQ") { this.onSecondary(); return true; }
        return false;
    },

    onDamage: function(ch) { return ch.isPlayer; },
    onRestart: function() { LevelManager.selectLevel(LevelManager.currentLevelKey); },

    cameraTargets: function() {
        var lvl = LevelManager.getCurrentLevel();
        var fx = lvl.siege ? lvl.siege.focusX : 700;
        var pts = [{ x: SIEGE_ANCHOR.x - 150, y: 150 }, { x: fx + 350, y: 300 }];
        if (Siege.rd && Ragdolls.list.indexOf(Siege.rd) !== -1) pts.push({ x: Siege.rd.centerX(), y: Math.min(1600, Siege.rd.centerY()) });
        return pts;
    },

    drawWorld: function() {
        // back prong + back band
        var k = cameraScaleX;
        var ax = SIEGE_ANCHOR.x, ay = SIEGE_ANCHOR.y;
        ctx.save();
        ctx.lineCap = "round";
        ctx.strokeStyle = "#5b3a1e"; ctx.lineWidth = 16 * k;
        ctx.beginPath(); ctx.moveTo(wsx(ax), wsy(200)); ctx.lineTo(wsx(ax), wsy(ay - 50)); ctx.lineTo(wsx(ax - 26), wsy(ay + 10)); ctx.stroke();
        ctx.strokeStyle = "#7a4d26"; ctx.lineWidth = 10 * k;
        ctx.beginPath(); ctx.moveTo(wsx(ax), wsy(ay - 50)); ctx.lineTo(wsx(ax + 26), wsy(ay + 10)); ctx.stroke();
        if (Siege.phase === "aim") {
            var pp = siegePouch();
            ctx.strokeStyle = "#3b2414"; ctx.lineWidth = 6 * k;
            ctx.beginPath(); ctx.moveTo(wsx(ax - 26), wsy(ay + 10)); ctx.lineTo(wsx(pp[0]), wsy(pp[1])); ctx.stroke();
            // trajectory preview (verlet-matched: 0.993 drag, ragdoll gravity)
            var v = siegeLaunchVel(), x = pp[0], y = pp[1], vx = v[0], vy = v[1], gg = gravity * 0.95;
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            for (let i = 1; i <= 75; i++) {
                vx *= 0.993; vy = vy * 0.993 - gg; x += vx; y += vy;
                if (y < 0) break;
                if (i % 4 === 0) {
                    var r = Math.max(2, (5 - i / 25)) * Math.max(0.6, k);
                    ctx.globalAlpha = 1 - i / 90;
                    ctx.beginPath(); ctx.arc(wsx(x), wsy(y), r, 0, Math.PI * 2); ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    },

    drawFront: function() {
        var k = cameraScaleX, ax = SIEGE_ANCHOR.x, ay = SIEGE_ANCHOR.y;
        ctx.save();
        ctx.lineCap = "round";
        if (Siege.phase === "aim") {
            var pp = siegePouch();
            var type = Siege.shots[Siege.shotIdx];
            // loaded shot: a little pixel-art body in the pouch
            if (type) {
                var col = AMMO[type].color;
                PixelArt.draw(PixelArt.sprites.shot, wsx(pp[0]) - 18 * k, wsy(pp[1]) - 18 * k, 4 * k, { b: col, f: "#f2c9a0", e: "#0a0f16", w: type === "bomb" ? "#ffd23f" : col });
            }
            ctx.strokeStyle = "#4a2c17"; ctx.lineWidth = 6 * k;
            ctx.beginPath(); ctx.moveTo(wsx(pp[0]), wsy(pp[1])); ctx.lineTo(wsx(ax + 26), wsy(ay + 10)); ctx.stroke();
        }
        ctx.strokeStyle = "#7a4d26"; ctx.lineWidth = 12 * k;
        ctx.beginPath(); ctx.moveTo(wsx(ax), wsy(ay - 50)); ctx.lineTo(wsx(ax + 26), wsy(ay + 10)); ctx.stroke();
        // enemy hp pips
        for (let i = 0; i < zombies.length; i++) {
            var z = zombies[i];
            if (z.dead || z.health >= z.maxHealth) continue;
            var bw = 50 * k, sx = wsx(z.x) - bw / 2, sy = wsy(z.y + z.s2 / 2 + 22);
            ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(sx - 2, sy - 2, bw + 4, 8 * k + 4);
            ctx.fillStyle = "#ff4d5e"; ctx.fillRect(sx, sy, bw * Math.max(0, z.health / z.maxHealth), 8 * k);
        }
        ctx.restore();
    },

    drawHUD: function() {
        var key = LevelManager.currentLevelKey, lvl = LevelManager.getCurrentLevel();
        var n = SIEGE_LEVELS.indexOf(key);
        uiPanel(14, 14, 420, 104, "#f97316");
        uiText("RAGDOLL SIEGE", 30, 46, 24, "#fdba74", "left", "900");
        uiText("FORT " + (n + 1) + "/" + SIEGE_LEVELS.length + "  ·  " + (lvl.title || ""), 30, 70, 14, "#e2e8f0", "left", "800");
        var best = siegeStarsFor(key);
        uiText("score " + Siege.score + "   🧟 " + siegeEnemiesLeft() + " left   best " + "★".repeat(best) + "☆".repeat(3 - best), 30, 94, 13, "#94a3b8", "left", "700");
        // ammo tray
        var tx = 30, ty = 108;
        for (let i = 0; i < Siege.shots.length; i++) {
            var t = Siege.shots[i], used = i < Siege.shotIdx, cur = i === Siege.shotIdx && Siege.phase === "aim";
            ctx.globalAlpha = used ? 0.25 : 1;
            PixelArt.draw(PixelArt.sprites.shot, tx + i * 30, ty - 14 + (cur ? -3 : 0), 2.5, { b: AMMO[t].color, f: "#f2c9a0", e: "#0a0f16", w: t === "bomb" ? "#ffd23f" : AMMO[t].color });
            ctx.globalAlpha = 1;
        }
        var nxt = Siege.shots[Siege.shotIdx];
        if (Siege.phase === "aim" && nxt) uiText("NEXT: " + AMMO[nxt].name.toUpperCase() + " - " + AMMO[nxt].desc, 30 + Siege.shots.length * 30 + 10, ty, 11, AMMO[nxt].color, "left", "800");
        if (Siege.phase === "flight" && Siege.rdType === "bomb" && Siege.rd) uiText("CLICK / SPACE TO DETONATE!", cssW / 2, 110, 24, "#f97316", "center", "900");
        if (Siege.phase === "aim") uiText("angle " + Math.round(Siege.angle) + "°   power " + Math.round(Siege.power * 100) + "%", cssW / 2, 100, 16, "#e2e8f0", "center", "800");
        uiText("Drag the mouse to pull & release to fire · or W/S aim, A/D power, Space fire · right-click/Tab swap shot · R retry · Esc menu", cssW / 2, cssH - 16, 12, "rgba(220,230,240,0.7)", "center", "700");
    },

    menuItems: function(items) {
        var n = Math.max(0, SIEGE_LEVELS.indexOf(LevelManager.currentLevelKey));
        if (pauseFromGameOver && Siege.won && n + 1 < SIEGE_LEVELS.length) items.unshift({ id: "sg_next", label: "Next fort ▶", hint: "Fort " + (n + 2) });
        items.push({ id: "sg_level", label: "Fort:  ◀  " + (n + 1) + " / " + SIEGE_LEVELS.length + "  " + "★".repeat(siegeStarsFor(SIEGE_LEVELS[n])) + "  ▶", hint: "", cycle: true });
        if (!pauseFromGameOver) items.push({ id: "sg_retry", label: "Retry fort  (R)", hint: "" });
    },

    onMenu: function(id, dir) {
        var n = Math.max(0, SIEGE_LEVELS.indexOf(LevelManager.currentLevelKey));
        if (id === "sg_next") { closePause(); LevelManager.selectLevel(SIEGE_LEVELS[n + 1]); return true; }
        if (id === "sg_level") { n = (n + (dir || 1) + SIEGE_LEVELS.length) % SIEGE_LEVELS.length; closePause(); LevelManager.selectLevel(SIEGE_LEVELS[n]); return true; }
        if (id === "sg_retry") { closePause(); LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        return false;
    }
});

function siegeStarsFor(key) { return siegeSave.stars[key] || 0; }

PixelArt.sprites.shot = ["..fff...", ".fefef..", "..fff...", ".bbbbb..", "b.bbb.b.", "..bbb...", "..b.b...", ".bb.bb.w"];
