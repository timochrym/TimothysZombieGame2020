// ============================================================================
// BRAWL MODE  (Smash-style free-for-all)
//   - Floating stages with no walls or floor: get launched past the blast zone and you lose a stock
//   - Damage is a PERCENT that makes you fly further the higher it climbs; there is no health bar
//   - 1-4 fighters: P1 (WASD), P2 (arrows) and/or CPU fighters with Easy / Normal / Hard skill
//   - Attacks: blaster (F / Enter), shockwave smash (E / /), dash attack (Shift), double-jump to recover
//   - Pick it from the pause menu (Esc): Game mode -> Brawl, then Opponents / CPU skill / Stocks / Stage
// ============================================================================
var FIGHTER_COLORS = ["#ff5a5f", "#3da5ff", "#4ade80", "#fbbf24"];

var brawl = { active: false, phase: "off", timer: 0, stage: null, winner: null, itemTimer: 0 };

var brawlCfg = {
    opponents: "1cpu",   // p2 | 1cpu | 2cpu | 3cpu | p2+1cpu | p2+2cpu
    cpuLevel: 2,         // 1 easy, 2 normal, 3 hard
    stocks: 3,
    stage: "brawl_battlefield"
};

var BRAWL_OPPONENTS = [
    ["1cpu", "1 CPU"], ["p2", "Player 2 (PvP)"], ["2cpu", "2 CPUs"], ["3cpu", "3 CPUs"],
    ["p2+1cpu", "Player 2 + 1 CPU"], ["p2+2cpu", "Player 2 + 2 CPUs"]
];
var BRAWL_CPU_NAMES = ["", "Easy", "Normal", "Hard"];
var BRAWL_STAGES = ["brawl_battlefield", "brawl_plaza", "brawl_skybridge"];

try {
    var savedBrawl = JSON.parse(localStorage.getItem("timsZombieGameBrawlCfg") || "null");
    if (savedBrawl) {
        if (BRAWL_OPPONENTS.some(function(o) { return o[0] === savedBrawl.opponents; })) brawlCfg.opponents = savedBrawl.opponents;
        if (savedBrawl.cpuLevel >= 1 && savedBrawl.cpuLevel <= 3) brawlCfg.cpuLevel = savedBrawl.cpuLevel;
        if (savedBrawl.stocks >= 1 && savedBrawl.stocks <= 9) brawlCfg.stocks = savedBrawl.stocks;
        if (BRAWL_STAGES.indexOf(savedBrawl.stage) !== -1) brawlCfg.stage = savedBrawl.stage;
    }
} catch (e) {}

function saveBrawlCfg() {
    try { localStorage.setItem("timsZombieGameBrawlCfg", JSON.stringify(brawlCfg)); } catch (e) {}
}

function brawlOpponentLabel() {
    for (let i = 0; i < BRAWL_OPPONENTS.length; i++) if (BRAWL_OPPONENTS[i][0] === brawlCfg.opponents) return BRAWL_OPPONENTS[i][1];
    return brawlCfg.opponents;
}

function cycleBrawlOpponents(dir) {
    var idx = 0;
    for (let i = 0; i < BRAWL_OPPONENTS.length; i++) if (BRAWL_OPPONENTS[i][0] === brawlCfg.opponents) idx = i;
    idx = (idx + dir + BRAWL_OPPONENTS.length) % BRAWL_OPPONENTS.length;
    brawlCfg.opponents = BRAWL_OPPONENTS[idx][0];
    saveBrawlCfg();
}

function cycleBrawlStage(dir) {
    var idx = Math.max(0, BRAWL_STAGES.indexOf(brawlCfg.stage));
    idx = (idx + dir + BRAWL_STAGES.length) % BRAWL_STAGES.length;
    brawlCfg.stage = BRAWL_STAGES[idx];
    saveBrawlCfg();
}

// ---------------------------------------------------------------------------
// Match setup
// ---------------------------------------------------------------------------
function createBrawlFighters() {
    characters = [];
    var lvl = LevelManager.getCurrentLevel();
    brawl.stage = {
        key: LevelManager.currentLevelKey,
        name: lvl.name,
        minX: lvl.blast.minX, maxX: lvl.blast.maxX, minY: lvl.blast.minY, maxY: lvl.blast.maxY,
        topY: lvl.stageTopY, centerX: lvl.stageCenterX || 0,
        spawns: lvl.brawlSpawns
    };
    var table = { "1cpu": [false, 1], "p2": [true, 0], "2cpu": [false, 2], "3cpu": [false, 3], "p2+1cpu": [true, 1], "p2+2cpu": [true, 2] };
    var cfgRow = table[brawlCfg.opponents] || table["1cpu"];
    var wantP2 = cfgRow[0];
    var cpus = cfgRow[1];
    var charBox = Math.makeHitbox(s1, s2);
    var spd = speed;
    var slots = [{ cpu: false }];
    if (wantP2) slots.push({ cpu: false });
    for (let i = 0; i < cpus; i++) slots.push({ cpu: true });
    var cpuNo = 0;
    for (let i = 0; i < slots.length; i++) {
        var sp = brawl.stage.spawns[i % brawl.stage.spawns.length];
        var ch = new Character(i === 0 ? "Player 1" : "Fighter " + (i + 1), charBox, charBox, FIGHTER_COLORS[i], [sp[0], sp[1]],
            maxspeed, slower, gravity, bounciness, spd, i === 0 ? "WASD" : "ULDR", 100, "ULDR", false, "NORMAL");
        ch.isPlayer = true;
        ch.playerIndex = i;
        ch.fighterTeam = i;
        ch.isCPU = slots[i].cpu;
        if (ch.isCPU) { cpuNo++; ch.playerLabel = "CPU " + cpuNo; ch.cpuIn = { shoot: false, jet: false, interact: false, reloadQueued: false }; }
        else ch.playerLabel = "P" + (i + 1);
        ch.stocks = brawlCfg.stocks;
        ch.damagePct = 0;
        ch.eliminated = false;
        ch.maxAirJumps = 2;
        ch.airJumps = 2;
        ch.invulnTimer = 120;
        characters.push(ch);
    }
    redGuy = characters[0];
    blueGuy = characters.length > 1 ? characters[1] : null;
    multiplayer = characters.length > 1;
    brawl.phase = "countdown";
    brawl.timer = 190;
    brawl.winner = null;
    brawl.itemTimer = 420;
    brawl.active = true;
    jetpackEnabled = false;
}

function brawlSpawnFor(ch) {
    var st = brawl.stage;
    var i = characters.indexOf(ch);
    var sp = st.spawns[i % st.spawns.length];
    return [sp[0], st.topY + 520];
}

function brawlLoseStock(ch) {
    var st = brawl.stage;
    var ex = Math.max(st.minX, Math.min(st.maxX, ch.x));
    var ey = Math.max(st.minY, Math.min(st.maxY, ch.y));
    ch.stocks--;
    screenShake = Math.max(screenShake, 9);
    Components.addRing(ex, ey, 420, FIGHTER_COLORS[ch.playerIndex], 30);
    Components.spawnSparks(ex, ey, FIGHTER_COLORS[ch.playerIndex], 16);
    Components.addFloatingText(ch.stocks > 0 ? "KO!" : "ELIMINATED!", ex, ey + (ey > 0 ? -60 : 80), "#ffffff", 34);
    ch.dead = true;
    ch.xspeed = ch.yspeed = 0;
    ch.ragdollTimer = 0;
    ch.ragdollAngle = 0;
    ch.hitstun = 0;
    ch.frozenTimer = 0;
    ch.powers = {};
    ch.shield = 0;
    ch.heldObject = null;
    if (ch.stocks <= 0) { ch.eliminated = true; ch.respawnTimer = 0; }
    else ch.respawnTimer = 110;
}

function brawlRespawn(ch) {
    var sp = brawlSpawnFor(ch);
    ch.dead = false;
    ch.damagePct = 0;
    ch.x = sp[0];
    ch.y = sp[1];
    ch.xspeed = ch.yspeed = 0;
    ch.invulnTimer = 190;
    ch.hitCooldown = 0;
    ch.ragdollImmune = 0;
    ch.airJumps = ch.maxAirJumps;
    ch.dashCooldown = 0;
    Components.addRing(ch.x, ch.y, 260, FIGHTER_COLORS[ch.playerIndex], 24);
    Components.addFloatingText(ch.playerLabel + " is back!", ch.x, ch.y + 90, FIGHTER_COLORS[ch.playerIndex], 18);
}

function updateBrawl() {
    if (!brawl.active) return;
    var st = brawl.stage;
    if (brawl.phase === "countdown") {
        brawl.timer--;
        if (brawl.timer <= 0) {
            brawl.phase = "fight";
            Components.addFloatingText("GO!", cameraTargetX, cameraTargetY + 200, "#ffd23f", 48);
        }
    }
    for (let i = 0; i < characters.length; i++) {
        var ch = characters[i];
        if (ch.eliminated) continue;
        if (ch.dead) {
            ch.respawnTimer--;
            if (ch.respawnTimer <= 0 && brawl.phase !== "over") brawlRespawn(ch);
            continue;
        }
        ch.health = ch.maxHealth;
        if (ch.x < st.minX || ch.x > st.maxX || ch.y < st.minY || ch.y > st.maxY) brawlLoseStock(ch);
    }

    // Items drop onto the stage now and then
    if (brawl.phase === "fight") {
        brawl.itemTimer--;
        if (brawl.itemTimer <= 0) {
            brawl.itemTimer = 700 + Math.random() * 400;
            var ix = st.centerX + (Math.random() - 0.5) * (st.maxX - st.minX) * 0.35;
            spawnPowerUp(ix, st.topY + 260 + Math.random() * 300);
        }
        var alive = characters.filter(function(c) { return !c.eliminated; });
        if (alive.length <= 1) {
            brawl.phase = "over";
            brawl.winner = alive[0] || null;
            gameOver = true;
            if (brawl.winner) Components.addFloatingText(brawl.winner.playerLabel + " WINS!", brawl.winner.x, brawl.winner.y + 120, "#ffd23f", 34);
        }
    }
}

// ---------------------------------------------------------------------------
// Damage: percent + knockback that grows with the percent (called from Character.takeDamage)
// ---------------------------------------------------------------------------
function brawlApplyHit(victim, amount, kx, ky, attacker) {
    if (victim.hitCooldown > 0) return;
    if (victim.invulnTimer > 0 || victim.dashTimer > 0) return;
    victim.hitCooldown = 12;
    var dmg = -amount;

    // Energy shield soaks the hit
    if (victim.shield > 0) {
        var soak = Math.min(victim.shield, dmg);
        victim.shield -= soak;
        dmg -= soak;
        Components.spawnSparks(victim.x, victim.y, "#6ee7ff", 5);
        if (victim.shield <= 0) delete victim.powers["SHIELD"];
        if (dmg < 1) return;
    }

    var pct = Math.max(1, dmg * 0.35);
    victim.damagePct += pct;
    victim.hitFlashTimer = 6;

    // launch direction: away from the attacker (bullets use their own travel direction)
    var nx = Math.abs(kx) > 0.3 ? Math.sign(kx) : 0, ny = 0;
    if (attacker && attacker !== victim) {
        var dx = victim.x - attacker.x, dy = victim.y - attacker.y;
        var len = Math.hypot(dx, dy) || 1;
        if (nx === 0) nx = dx / len;
        ny = dy / len;
    }
    if (nx === 0) nx = Math.random() < 0.5 ? -1 : 1;
    var launch = (dmg * 0.2 + 2.2) * (1 + victim.damagePct / 55);
    launch = Math.min(34, launch);
    victim.xspeed = nx * launch;
    victim.yspeed = Math.max(2.5, Math.abs(ny) * launch * 0.5 + launch * 0.38);
    victim.onGround = false;
    victim.hitstun = Math.min(55, Math.round(launch * 2.2));
    victim.hitstunSet = true;
    if (launch >= 11) {
        victim.ragdollImmune = 0;
        victim.startRagdoll(nx, 0, Math.min(70, Math.round(launch * 3)), true);
    }
    var pctNow = Math.round(victim.damagePct);
    Components.addFloatingText(pctNow + "%", victim.x, victim.y + 70, brawlPercentColor(victim.damagePct), 18 + Math.min(14, pct));
    Components.spawnSparks(victim.x, victim.y, "#ffffff", 5);
    if (launch > 14) screenShake = Math.max(screenShake, Math.min(8, launch * 0.3));
}

function brawlPercentColor(p) {
    if (p < 40) return "#ffffff";
    if (p < 80) return "#ffe08a";
    if (p < 120) return "#ff9f43";
    if (p < 160) return "#ff5a5f";
    return "#c0262d";
}

// ---------------------------------------------------------------------------
// CPU fighters
// ---------------------------------------------------------------------------
var Brawl = {
    groundBelow: function(x, feetY, depth) {
        for (let i = 0; i < staticObjects.length; i++) {
            var o = staticObjects[i];
            if (o.dead || o.isBumper) continue;
            if (Math.abs(x - o.x) > o.w / 2) continue;
            var top = o.y + o.h / 2;
            if (top <= feetY + 14 && top >= feetY - depth) return true;
        }
        return false;
    },

    cpuThink: function(ch) {
        var lvl = brawlCfg.cpuLevel;
        var cfg = [null, { react: 22, err: 18, aggr: 0.4 }, { react: 11, err: 8, aggr: 0.7 }, { react: 5, err: 2, aggr: 0.95 }][lvl];
        ch.leftPressed = ch.rightPressed = ch.upPressed = ch.downPressed = false;
        ch.shootPressed = false;
        ch.abilityPressed = false;
        ch.cpuIn.shoot = false;
        if (brawl.phase !== "fight" || ch.ragdollTimer > 0 || ch.hitstun > 0 || ch.frozenTimer > 0 || ch.dead) return;

        ch.cpuT = (ch.cpuT || 0) + 1;
        if (ch.cpuJumpCd > 0) ch.cpuJumpCd--;
        var st = brawl.stage;
        var feet = ch.y - ch.s2 / 2;

        // ---- pick a target: nearby, and preferably already hurt (easier to launch) ----
        if (!ch.cpuTarget || ch.cpuTarget.dead || ch.cpuTarget.eliminated || ch.cpuT % (cfg.react * 4) === 0) {
            var best = null, bestScore = Infinity;
            for (let i = 0; i < characters.length; i++) {
                var f = characters[i];
                if (f === ch || f.dead || f.eliminated) continue;
                var sc = Math.hypot(f.x - ch.x, f.y - ch.y) - f.damagePct * 2.5;
                if (sc < bestScore) { bestScore = sc; best = f; }
            }
            ch.cpuTarget = best;
        }
        var tgt = ch.cpuTarget;

        // ---- RECOVERY: off the stage -> steer back, double-jump, dash ----
        var overStage = Brawl.groundBelow(ch.x, feet, 3000);
        var low = ch.y < st.topY - 220;
        if (!ch.onGround && (!overStage || low)) {
            var cdir = Math.sign(st.centerX - ch.x) || 1;
            if (cdir > 0) ch.rightPressed = true; else ch.leftPressed = true;
            if (ch.yspeed < 2 && ch.airJumps > 0 && ch.cpuJumpCd <= 0 && ch.y < st.topY + 160) {
                ch.cpuJumpCd = 14;
                ch.cpuWantsJump = 3;
            }
            if (ch.cpuWantsJump > 0) { ch.upPressed = (ch.cpuWantsJump % 2 === 1); ch.cpuWantsJump--; }
            if (ch.dashCooldown <= 0 && ch.airJumps <= 0 && ch.y < st.topY - 60 && Math.abs(st.centerX - ch.x) > 250) {
                ch.degree = (Math.degrees(Math.atan2(st.centerX - ch.x, (st.topY + 250) - ch.y)) + 360) % 360;
                ch.triggerNinjaDash();
            }
            return;
        }
        if (!tgt) return;

        // ---- COMBAT ----
        var dx = tgt.x - ch.x, dy = tgt.y - ch.y;
        var dist = Math.hypot(dx, dy);
        var dir = Math.sign(dx) || 1;
        var edgeAhead = ch.onGround && !Brawl.groundBelow(ch.x + dir * 100, feet, 300);
        var targetBelow = tgt.y < ch.y - 150;
        // a hurt CPU at high percent plays safer: stays further from edges
        var edgeCaution = ch.damagePct > 90 && lvl >= 2;
        if (Math.abs(dx) > 150) {
            if (!edgeAhead || (targetBelow && lvl === 1 && Math.random() < 0.02)) {
                if (dir > 0) ch.rightPressed = true; else ch.leftPressed = true;
            } else if (edgeCaution || lvl >= 2) {
                // hold the ledge and shoot instead of walking off
            }
        } else if (Math.abs(dx) < 70 && lvl >= 2) {
            if (dir > 0) ch.leftPressed = true; else ch.rightPressed = true; // spacing
        }
        // jump up to platforms / over gaps
        if (ch.onGround && ((dy > 140 && Math.abs(dx) < 520) || (edgeAhead && !targetBelow && Math.abs(dx) > 300)) && Math.random() < 0.12) ch.upPressed = true;
        if (!ch.onGround && ch.airJumps > 0 && dy > 160 && ch.yspeed < 1 && ch.cpuJumpCd <= 0 && lvl >= 2) {
            ch.upPressed = (ch.cpuT % 2 === 0);
            if (ch.upPressed) ch.cpuJumpCd = 16;
        }

        // aim with error (hard CPUs lead the target)
        var px = tgt.x, py = tgt.y;
        if (lvl === 3) { var t0 = dist / (lazerSpeed || 26); px += tgt.xspeed * t0 * 0.7; py += tgt.yspeed * t0 * 0.3; }
        ch.degree = (Math.degrees(Math.atan2(px - ch.x, py - ch.y)) + (Math.random() - 0.5) * 2 * cfg.err + 360) % 360;

        // attacks
        if (dist < 950 && Math.random() < cfg.aggr * 0.5 && ch.cpuT % 2 === 0) { ch.shootPressed = true; ch.cpuIn.shoot = true; }
        if (dist < 200 && Math.abs(dy) < 130 && ch.abilityCooldown <= 0 && Math.random() < cfg.aggr * 0.14) ch.abilityPressed = true;
        if (dist < 360 && Math.abs(dy) < 160 && ch.dashCooldown <= 0 && Math.random() < cfg.aggr * 0.03 && !edgeAhead) ch.triggerNinjaDash();

        // dodge incoming bullets
        if (lvl >= 2 && ch.onGround && Math.random() < 0.3) {
            for (let li = 0; li < lazers.length; li++) {
                var lz = lazers[li];
                if (lz.team === ch.team) continue;
                var lx = ch.x - lz.x, ly = ch.y - lz.y;
                var ld = Math.hypot(lx, ly);
                if (ld < 300 && ld > 30 && (lx * lz.xspeed + ly * lz.yspeed) / (ld * (Math.hypot(lz.xspeed, lz.yspeed) || 1)) > 0.94) { ch.upPressed = true; break; }
            }
        }
    }
};

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function drawBrawlHUD() {
    ctx.textBaseline = "alphabetic";
    var st = brawl.stage;
    // title strip
    uiPanel(14, 14, 360, 56, "#ffd23f");
    uiText("BRAWL", 32, 50, 28, "#ffd23f", "left", "900");
    uiText(st ? st.name.replace(/^[^A-Za-z]+/, "") : "", 140, 48, 13, "#dbe7f0", "left", "700");

    // fighter panels (bottom centre)
    var n = characters.length, pw = 232, gap = 14;
    var total = n * pw + (n - 1) * gap;
    var x0 = w / 2 - total / 2, y0 = h - 136;
    for (let i = 0; i < n; i++) {
        var c = characters[i];
        var x = x0 + i * (pw + gap);
        var col = FIGHTER_COLORS[c.playerIndex];
        uiPanel(x, y0, pw, 118, c.eliminated ? "rgba(120,120,120,0.5)" : col, 0.9);
        ctx.save();
        if (c.eliminated) ctx.globalAlpha = 0.35;
        drawSkinPreview(c.skinId(), x + 38, y0 + 42, 50, col, c.isCPU ? "C" : "P" + (c.playerIndex + 1));
        var pct = Math.round(c.damagePct || 0);
        uiText(pct + "%", x + 188, y0 + 62, 44, brawlPercentColor(c.damagePct || 0), "right", "900");
        uiText(c.playerLabel + (c.isCPU ? "  ·  " + BRAWL_CPU_NAMES[brawlCfg.cpuLevel] : ""), x + 14, y0 + 90, 13, col, "left", "800");
        // stocks
        for (let s = 0; s < brawlCfg.stocks; s++) {
            ctx.beginPath();
            ctx.arc(x + 20 + s * 20, y0 + 104, 6.5, 0, Math.PI * 2);
            ctx.fillStyle = s < c.stocks ? col : "rgba(255,255,255,0.12)";
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#0a0f16";
            ctx.stroke();
        }
        // active power chip
        var shown = 0;
        for (var pk in c.powers) {
            var def = PowerUpDefs[pk];
            if (!def) continue;
            uiText(def.icon + " " + pk.slice(0, 4), x + pw - 14, y0 + 106 - shown * 14, 11, def.color, "right", "800");
            if (++shown >= 2) break;
        }
        if (c.dead && !c.eliminated) uiText("RESPAWN", x + pw - 14, y0 + 16, 11, "#8ba2b4", "right", "800");
        if (c.eliminated) uiText("OUT", x + pw / 2, y0 + 62, 36, "#8ba2b4", "center", "900");
        ctx.restore();
    }

    // key legends for the humans
    for (let i = 0; i < n; i++) {
        if (characters[i].isCPU) continue;
        if (characters[i].playerIndex === 0) drawKeyLegend(characters[i], 20, h - 224);
        else if (characters[i].playerIndex === 1) drawKeyLegend(characters[i], w - 338, h - 224);
    }

    // off-screen fighter arrows with their percent
    for (let i = 0; i < n; i++) {
        var f = characters[i];
        if (f.dead || f.eliminated) continue;
        drawEdgeIndicator(f.x, f.y, FIGHTER_COLORS[f.playerIndex], f.playerLabel + " " + Math.round(f.damagePct) + "%");
    }

    // countdown / winner
    if (brawl.phase === "countdown") {
        var sec = Math.ceil(brawl.timer / 60);
        var a = (brawl.timer % 60) / 60;
        ctx.save();
        ctx.globalAlpha = 0.4 + a * 0.6;
        uiText(sec > 0 ? String(sec) : "GO!", w / 2, h / 2 - 40, 120, "#ffd23f", "center", "900");
        uiText("Knock your rivals off the stage!", w / 2, h / 2 + 10, 20, "#dbe7f0", "center", "800");
        ctx.restore();
    }
    if (brawl.phase === "over") {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, 0, w, h);
        uiText("GAME!", w / 2, h / 2 - 20, 96, "#ffd23f", "center", "900");
        uiText(brawl.winner ? brawl.winner.playerLabel + " wins" : "Draw", w / 2, h / 2 + 30, 30, brawl.winner ? FIGHTER_COLORS[brawl.winner.playerIndex] : "#fff", "center", "900");
    }
    uiText("Esc: pause menu (rematch, stage, opponents)", w / 2, h - 142, 11, "rgba(200,220,235,0.55)", "center", "600");
    drawCrosshair();
}
