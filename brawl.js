// ============================================================================
// BRAWL MODE  (Smash-style free-for-all)
//   - Floating stages with no walls or floor: get launched past the blast zone and you lose a stock
//   - Damage is a PERCENT that makes you fly further the higher it climbs; there is no health bar
//   - 1-4 fighters: P1 (WASD), P2 (arrows) and/or CPU fighters with Easy / Normal / Hard skill
//   - Attacks: blaster (F / Enter), shockwave smash (E / /), dash attack (Shift), double-jump to recover
//   - Pick it from the pause menu (Esc): Game mode -> Brawl, then Opponents / CPU skill / Stocks / Stage
// ============================================================================
var FIGHTER_COLORS = ["#ff5a5f", "#3da5ff", "#4ade80", "#fbbf24"];

var brawl = { active: false, phase: "off", timer: 0, stage: null, winner: null, itemTimer: 0, ko: [], tick: 0 };

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
var BRAWL_STAGES = ["brawl_battlefield", "brawl_plaza", "brawl_skybridge", "brawl_gearworks"];

try {
    var savedBrawl = JSON.parse(localStorage.getItem("timsZombieGameBrawlCfg") || "null");
    if (savedBrawl) {
        if (BRAWL_OPPONENTS.some(function(o) { return o[0] === savedBrawl.opponents; })) brawlCfg.opponents = savedBrawl.opponents;
        if (savedBrawl.cpuLevel >= 1 && savedBrawl.cpuLevel <= 3) brawlCfg.cpuLevel = savedBrawl.cpuLevel;
        if (savedBrawl.stocks >= 1 && savedBrawl.stocks <= 9) brawlCfg.stocks = savedBrawl.stocks;
        if (BRAWL_STAGES.indexOf(savedBrawl.stage) !== -1 || /^studio_/.test(savedBrawl.stage || "")) brawlCfg.stage = savedBrawl.stage;      // built-in or Level Studio stage
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
    // built-in stages plus any made in the Level Studio
    var all = BRAWL_STAGES.concat(window.Object.keys(LevelManager.customLevels || {}).filter(function(k) { return LevelManager.customLevels[k].isBrawl; }));
    var idx = Math.max(0, all.indexOf(brawlCfg.stage));
    idx = (idx + dir + all.length) % all.length;
    brawlCfg.stage = all[idx];
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
        ch.brKOs = 0; ch.brFalls = 0; ch.brDealt = 0; ch.brLastBy = null; ch.brLastT = -9999;
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
    brawl.ledges = null;
    brawl.timer = 190;
    brawl.winner = null;
    brawl.itemTimer = 420; brawl.bats = [];
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
    ch.brFalls = (ch.brFalls || 0) + 1;
    if (ch.brLastBy && ch.brLastBy !== ch && brawl.tick - ch.brLastT < 300) ch.brLastBy.brKOs = (ch.brLastBy.brKOs || 0) + 1;   // last hit within 5 s gets the KO
    // KO blast: a beam of the fighter's colour shooting from the exit point back toward the stage
    brawl.ko.push({ x: ex, y: ey, cx: st.centerX, cy: (st.minY + st.maxY) / 2, col: FIGHTER_COLORS[ch.playerIndex], t: 0 });
    screenShake = Math.max(screenShake, 9);
    if (ch.liveRagdoll && typeof Ragdolls !== "undefined") { Ragdolls.remove(ch.liveRagdoll); ch.liveRagdoll = null; }
    if (typeof SFX !== "undefined") SFX.play("ko", ex, ey);
    if (typeof Juice !== "undefined") {
        Juice.hitStop(7);
        var left = characters.filter(function(c) { return !c.eliminated && c !== ch; }).length + (ch.stocks > 0 ? 1 : 0);
        if (left <= 1) Juice.slowMo(110, 0.3);
    }
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

// ---------------------------------------------------------------------------
// Ledge grab: falling past the corner of a solid stage block catches it. Up / jump climbs on, down lets go.
// One grab per trip through the air; a short invulnerability while hanging.
function brawlLedges() {
    var out = [];
    for (let i = 0; i < staticObjects.length; i++) {
        var o = staticObjects[i];
        if (o.kind !== "block" || o.w < 400 || o.isInfiniteBase) continue;
        var top = o.y + o.h / 2;
        out.push({ x: o.x - o.w / 2, y: top, side: -1 }, { x: o.x + o.w / 2, y: top, side: 1 });
    }
    return out;
}
function brawlLedge(ch) {
    if (ch.liveRagdoll || ch.ragdollTimer > 0) { ch.ledge = null; return; }
    if (ch.ledge) {
        var L = ch.ledge;
        var jumped = ch.yspeed > 1.5 && L.t > 8;               // the engine already turned UP into a jump this frame
        // hang just outside the wall with the head at the lip (fully clear of the block, so it never counts as ground)
        ch.x = L.x + L.side * (ch.s1 / 2 + 3); ch.y = L.y - ch.s2 / 2 + 18; ch.xspeed = 0; ch.yspeed = 0; ch.onGround = false;
        ch.airJumps = ch.maxAirJumps;
        L.t++;
        var up = jumped || ch.upPressed || (ch.isCPU && L.t > 25), down = ch.downPressed || L.t > 200;
        if (up && L.t > 8) {                                   // climb on
            ch.x = L.x - L.side * (ch.s1 / 2 + 14); ch.y = L.y + ch.s2 / 2 + 4; ch.yspeed = 2; ch.xspeed = 0; ch.ledge = null; ch.invulnTimer = Math.max(ch.invulnTimer, 20);
            if (typeof SFX !== "undefined") SFX.play("jump", ch.x, ch.y, 0.4, 1.3);
        } else if (down && L.t > 8) { ch.ledge = null; ch.yspeed = -2; ch.x += L.side * 20; }
        return;
    }
    if (ch.onGround) { ch.ledgeUsed = false; return; }
    if (ch.ledgeUsed || ch.yspeed > 0) return;
    var ls = brawl.ledges || (brawl.ledges = brawlLedges());
    for (let i = 0; i < ls.length; i++) {
        var e = ls[i], head = ch.y + ch.s2 / 2;
        if (Math.abs(ch.x - (e.x + e.side * ch.s1 / 2)) < ch.s1 * 0.75 && head > e.y - 30 && head < e.y + 70 && (ch.x - e.x) * e.side > -10) {
            ch.ledge = { x: e.x, y: e.y, side: e.side, t: 0 }; ch.ledgeUsed = true; ch.invulnTimer = Math.max(ch.invulnTimer, 40);
            Components.addFloatingText("LEDGE!", ch.x, ch.y + 80, "#e2e8f0", 14);
            if (typeof SFX !== "undefined") SFX.play("ui", ch.x, ch.y, 0.4, 1.2);
            break;
        }
    }
}
// Shield: hold DOWN while standing on the solid main stage. It soaks hits (no knockback) and shrinks as it takes them;
// it regrows when lowered; if it breaks you're dizzy for a second.
function brawlShield(ch) {
    if (ch.shieldHP === undefined) ch.shieldHP = 50;
    if (ch.dizzyT > 0) { ch.dizzyT--; ch.xspeed = 0; ch.shielding = false; ch.leftPressed = ch.rightPressed = false; return; }
    var standOnSolid = ch.onGround && !(ch.collidedWith && ch.collidedWith.kind === "platform");
    var want = ch.downPressed && standOnSolid;
    if (ch.isCPU) want = standOnSolid && lazers.some(function(l) { return l.owner !== ch && Math.abs(l.x - ch.x) < 220 && Math.abs(l.y - ch.y) < 120 && (l.x - ch.x) * l.xspeed < 0; }) && ch.shieldHP > 15;
    ch.shielding = want && ch.shieldHP > 0;
    if (ch.shielding) { ch.xspeed *= 0.5; ch.shieldHP = Math.max(0, ch.shieldHP - 0.08); }
    else ch.shieldHP = Math.min(50, ch.shieldHP + 0.12);
}

function updateBrawl() {
    if (!brawl.active) return;
    var st = brawl.stage;
    brawl.tick++;
    for (let i = brawl.ko.length - 1; i >= 0; i--) if (++brawl.ko[i].t > 45) brawl.ko.splice(i, 1);
    if (brawl.phase === "countdown") {
        brawl.timer--;
        if (brawl.timer % 60 === 0 && brawl.timer > 0 && typeof SFX !== "undefined") SFX.play("beep");
        if (brawl.timer <= 0) {
            if (typeof SFX !== "undefined") SFX.play("go");
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
        if (ch.x < st.minX || ch.x > st.maxX || ch.y < st.minY || ch.y > st.maxY) { brawlLoseStock(ch); continue; }
        if (brawl.phase === "fight") { brawlLedge(ch); brawlShield(ch); }
    }

    // Items drop onto the stage now and then
    if (brawl.phase === "fight") {
        brawl.itemTimer--;
        if (brawl.itemTimer <= 0) {
            brawl.itemTimer = 700 + Math.random() * 400;
            var ix = st.centerX + (Math.random() - 0.5) * (st.maxX - st.minX) * 0.35;
            // every other drop is a throwable bomb: G / right-click picks it up, click throws, it blows on impact
            brawl.dropN = (brawl.dropN || 0) + 1;
            if (brawl.dropN % 3 === 0) {
                (brawl.bats = brawl.bats || []).push({ x: ix, y: st.topY + 520, vy: 0, t: brawl.tick });
                Components.addFloatingText("🏏 BAT!  walk over it · E swings", ix, st.topY + 620, "#fde68a", 18);
            } else if (brawl.dropN % 3 === 2) {
                var bomb = Object.addCrate(ix, st.topY + 520, 54, "#1f2937", { explosive: true, name: "Bomb" });
                bomb.brawlBomb = brawl.tick;
                if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                Components.addFloatingText("💣 BOMB!  G grab · click throw", ix, st.topY + 620, "#fca5a5", 18);
            } else spawnPowerUp(ix, st.topY + 260 + Math.random() * 300);
        }
        brawlBats();
        brawlSpecials();
        // unused bombs fizzle out after 25 s so the stage never fills up
        for (let i = movingObjects.length - 1; i >= 0; i--) {
            var bo = movingObjects[i];
            if (bo.brawlBomb !== undefined && !bo.heldBy && !bo.dead && brawl.tick - bo.brawlBomb > 1500) {
                Components.spawnSparks(bo.x, bo.y, "#94a3b8", 8); movingObjects.splice(i, 1);
                if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            }
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
// The bat: falls onto the stage, a fighter walking over it takes it; while held, E is a bat swing (6 of them)
// instead of the shockwave: a short-range hit in front with big knockback.
// ---------------------------------------------------------------------------
function brawlBats() {
    var bats = brawl.bats || [];
    for (let b = bats.length - 1; b >= 0; b--) {
        var B = bats[b];
        if (!Brawl.groundBelow(B.x, B.y, Math.max(12, -B.vy + 2))) { B.vy -= 0.8; B.y += B.vy; } else B.vy = 0;
        if (B.y < brawl.stage.minY || brawl.tick - B.t > 1500) { bats.splice(b, 1); continue; }
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (c.dead || c.eliminated || c.brBat > 0) continue;
            if (Math.abs(c.x - B.x) < 70 && Math.abs(c.y - c.s2 / 2 - B.y) < 90) {
                c.brBat = 6; bats.splice(b, 1);
                Components.addFloatingText((c.playerLabel || "") + " has the BAT!", c.x, c.y + 110, "#fde68a", 18);
                if (typeof SFX !== "undefined") SFX.play("pickup", c.x, c.y);
                break;
            }
        }
    }
    for (let i = 0; i < characters.length; i++) {
        var ch = characters[i];
        if (!(ch.brBat > 0) || ch.dead || ch.eliminated) continue;
        if (ch.brSwingT > 0) ch.brSwingT--;
        ch.abilityCooldown = Math.max(ch.abilityCooldown || 0, 2);       // the bat replaces the shockwave while held
        if (ch.abilityPressed && !(ch.brSwingCd > 0)) {
            var face = ch.lastFacing || 1;
            ch.brSwingT = 12; ch.brSwingCd = 32; ch.brBat--;
            if (typeof SFX !== "undefined") SFX.play("kick", ch.x, ch.y, 1, 0.8);
            for (let j = 0; j < characters.length; j++) {
                var v = characters[j];
                if (v === ch || v.dead || v.eliminated) continue;
                var dx = v.x - ch.x;
                if (dx * face > -20 && Math.abs(dx) < 170 && Math.abs(v.y - ch.y) < 120) {
                    v.hitCooldown = 0; v.brKnockMult = 1.8;
                    v.takeDamage(-34, face * 24, 16, ch);
                    Components.addFloatingText("BONK!", v.x, v.y + 90, "#fde68a", 26);
                    screenShake = Math.max(screenShake, 9);
                }
            }
            if (ch.brBat <= 0) Components.addFloatingText("bat broke", ch.x, ch.y + 90, "#94a3b8", 14);
        }
        if (ch.brSwingCd > 0) ch.brSwingCd--;
    }
}

// ---------------------------------------------------------------------------
// Character moves: every hero look has its own E move (the Original Hero keeps the shockwave)
//   Stick Fighter  - Rising Uppercut: leap up, launching anyone above / in front upward
//   Street Brawler - Ground Slam: hop and dive; landing blasts everyone close by
//   Cap Hero       - Rocket Punch: a lunge forward that strikes the first fighter in the way
// ---------------------------------------------------------------------------
var BRAWL_MOVES = { stick: "Rising Uppercut", brawler: "Ground Slam", cap: "Rocket Punch" };
function brawlHit(att, v, dmg, kx, ky, mult, text) {
    v.hitCooldown = 0; v.brKnockMult = mult;
    v.takeDamage(-dmg, kx, ky, att);
    Components.addFloatingText(text, v.x, v.y + 90, "#fde68a", 22);
    screenShake = Math.max(screenShake, 7);
}
function brawlSpecials() {
    for (let i = 0; i < characters.length; i++) {
        var ch = characters[i];
        if (ch.dead || ch.eliminated || ch.brBat > 0) continue;
        var skin = typeof ch.skinId === "function" ? ch.skinId() : "original", move = BRAWL_MOVES[skin];
        if (!move) continue;
        ch.abilityCooldown = Math.max(ch.abilityCooldown || 0, 2);          // their move replaces the shockwave
        if (ch.brSpCd > 0) ch.brSpCd--;
        var face = ch.lastFacing || 1, foes = characters.filter(function(v) { return v !== ch && !v.dead && !v.eliminated; });
        if (ch.abilityPressed && !(ch.brSpCd > 0) && !ch.liveRagdoll && !(ch.hitstun > 0)) {
            ch.brSpCd = 75;
            Components.addFloatingText(move.toUpperCase() + "!", ch.x, ch.y + 80, "#7ff0ff", 16);
            if (typeof SFX !== "undefined") SFX.play("kick", ch.x, ch.y, 1, 1.1);
            if (skin === "stick") {
                ch.yspeed = 17; ch.onGround = false;
                foes.forEach(function(v) { var dx = v.x - ch.x, dy = v.y - ch.y; if (dx * face > -40 && Math.abs(dx) < 150 && dy > -60 && dy < 230) brawlHit(ch, v, 24, face * 4, 20, 1.35, "UPPERCUT!"); });
            } else if (skin === "brawler") {
                if (ch.onGround) { ch.yspeed = 13; ch.onGround = false; ch.brSlam = 1; } else ch.brSlam = 2;
            } else if (skin === "cap") {
                ch.brDash = 12; ch.brDashHit = false;
            }
        }
        // ground slam: after the hop, dive; the landing blasts everyone near
        if (ch.brSlam === 1 && ch.yspeed < 4) ch.brSlam = 2;
        if (ch.brSlam === 2) {
            ch.yspeed = Math.min(ch.yspeed, -24);
            if (ch.onGround) {
                ch.brSlam = 0;
                Components.addRing(ch.x, ch.y - ch.s2 / 2, 260, "#fb923c", 18);
                foes.forEach(function(v) { var dx = v.x - ch.x; if (Math.abs(dx) < 260 && Math.abs(v.y - ch.y) < 160) brawlHit(ch, v, 26, (Math.sign(dx) || face) * 14, 12, 1.25, "SLAM!"); });
            }
        }
        // rocket punch: a straight lunge
        if (ch.brDash > 0) {
            ch.brDash--; ch.xspeed = face * 24; ch.yspeed = Math.max(ch.yspeed, 0.5);
            if (ch.brDash % 3 === 0) Components.spawnSparks(ch.x - face * 30, ch.y, "#fca5a5", 2);
            if (!ch.brDashHit) foes.forEach(function(v) { if (ch.brDashHit) return; var dx = v.x - ch.x; if (dx * face > -10 && Math.abs(dx) < 100 && Math.abs(v.y - ch.y) < 90) { ch.brDashHit = true; brawlHit(ch, v, 26, face * 20, 9, 1.4, "POW!"); ch.brDash = 0; ch.xspeed *= 0.2; } });
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

    if (victim.shielding && victim.shieldHP > 0) {
        victim.shieldHP -= dmg * 0.6;
        Components.spawnSparks(victim.x, victim.y, "#93c5fd", 6);
        if (typeof SFX !== "undefined") SFX.play("ui", victim.x, victim.y, 0.5, 1.6);
        if (victim.shieldHP <= 0) { victim.shieldHP = 0; victim.shielding = false; victim.dizzyT = 70; Components.addFloatingText("SHIELD BREAK!", victim.x, victim.y + 90, "#fca5a5", 20); }
        return;
    }
    var pct = Math.max(1, dmg * 0.35);
    victim.damagePct += pct;
    if (attacker && attacker !== victim && attacker.isPlayer) { victim.brLastBy = attacker; victim.brLastT = brawl.tick; attacker.brDealt = (attacker.brDealt || 0) + pct; }
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
    var launch = (dmg * 0.2 + 2.2) * (1 + victim.damagePct / 55) * (victim.brKnockMult || 1);   // the bat hits harder
    victim.brKnockMult = 0;
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
    if (victim.liveRagdoll) {
        // already tumbling: the new hit re-launches the body
        victim.liveRagdoll.setVelocity(victim.xspeed, victim.yspeed);
        victim.ragdollTimer = Math.max(victim.ragdollTimer, 30);
    }
    if (typeof SFX !== "undefined") SFX.play(launch > 14 ? "bonk" : "hit", victim.x, victim.y, Math.min(1, launch / 20));
    if (launch > 18 && typeof Juice !== "undefined") Juice.hitStop(5);
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
        var closeIn = (typeof Fight !== "undefined" && Fight.fists(ch)) ? 85 : 150;
        if (Math.abs(dx) > closeIn) {
            if (!edgeAhead || (targetBelow && lvl === 1 && Math.random() < 0.02)) {
                if (dir > 0) ch.rightPressed = true; else ch.leftPressed = true;
            } else if (edgeCaution || lvl >= 2) {
                // hold the ledge and shoot instead of walking off
            }
        } else if (Math.abs(dx) < 70 && lvl >= 2 && closeIn > 100) {
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
function drawBrawlShields() {
    for (let i = 0; i < characters.length; i++) {
        var c = characters[i];
        if (c.dead || c.eliminated) continue;
        if (c.shielding) {
            var r = (c.s1 * 0.75) * (0.55 + 0.45 * c.shieldHP / 50) * cameraScaleX;
            ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = FIGHTER_COLORS[c.playerIndex] || "#93c5fd";
            ctx.beginPath(); ctx.arc(wsx(c.x), wsy(c.y), r, 0, 7); ctx.fill(); ctx.globalAlpha = 0.9; ctx.strokeStyle = "#e0f2fe"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        }
        if (c.dizzyT > 0) uiText("★ ✦ ★", wsx(c.x), wsy(c.y + c.s2 / 2 + 20), 14, "#fde047", "center", "900");
    }
}
function drawBrawlBats() {
    var k = cameraScaleX;
    var bat = function(x, y, ang) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = "#b45309"; ctx.strokeStyle = "#451a03"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-6 * k, 0); ctx.lineTo(-10 * k, -70 * k); ctx.lineTo(10 * k, -70 * k); ctx.lineTo(6 * k, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#1f2937"; ctx.fillRect(-5 * k, -2 * k, 10 * k, 16 * k);
        ctx.restore();
    };
    (brawl.bats || []).forEach(function(B) { bat(wsx(B.x), wsy(B.y), 0.5); });
    for (let i = 0; i < characters.length; i++) {
        var c = characters[i];
        if (!(c.brBat > 0) || c.dead || c.eliminated || c.liveRagdoll) continue;
        var f = c.lastFacing || 1, swing = c.brSwingT > 0 ? (12 - c.brSwingT) / 12 : 0;
        bat(wsx(c.x + f * c.s1 * 0.5), wsy(c.y - 4), f * (-0.4 + swing * 2.2));
    }
}
function drawBrawlKO() {
    drawBrawlShields();
    drawBrawlBats();
    for (let i = 0; i < brawl.ko.length; i++) {
        var K = brawl.ko[i], a = 1 - K.t / 45;
        // KOs happen past the screen edge: start the beam at the edge you flew out of
        var x0 = Math.max(0, Math.min(cssW, wsx(K.x))), y0 = Math.max(0, Math.min(cssH, wsy(K.y))), dx = wsx(K.cx) - x0, dy = wsy(K.cy) - y0, L = Math.hypot(dx, dy) || 1;
        var ux = dx / L, uy = dy / L, len = Math.min(L, 900) * (0.4 + Math.min(1, K.t / 8) * 0.6), wdt = 90 * a + 10;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        var g = ctx.createLinearGradient(x0, y0, x0 + ux * len, y0 + uy * len);
        g.addColorStop(0, K.col); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = a * 0.85; ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x0 - uy * wdt, y0 + ux * wdt); ctx.lineTo(x0 + ux * len, y0 + uy * len); ctx.lineTo(x0 + uy * wdt, y0 - ux * wdt); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = a; ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.moveTo(x0 - uy * wdt * 0.3, y0 + ux * wdt * 0.3); ctx.lineTo(x0 + ux * len * 0.6, y0 + uy * len * 0.6); ctx.lineTo(x0 + uy * wdt * 0.3, y0 - ux * wdt * 0.3); ctx.closePath(); ctx.fill();
        ctx.restore();
    }
}

function drawBrawlHUD() {
    ctx.textBaseline = "alphabetic";
    var st = brawl.stage;
    drawBrawlKO();
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
        var shk = c.hitFlashTimer > 0 ? 4 : 0;          // the number jolts when you get hit
        if (!c.eliminated) uiText(pct + "%", x + 188 + (Math.random() - 0.5) * shk * 2, y0 + 62 + (Math.random() - 0.5) * shk * 2, 44 + shk, brawlPercentColor(c.damagePct || 0), "right", "900");
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
        // results: KOs / falls / damage dealt
        var rows = characters.slice().sort(function(a, b) { return (b === brawl.winner) - (a === brawl.winner) || (b.brKOs || 0) - (a.brKOs || 0); });
        var tw = 420, tx = w / 2 - tw / 2, ty = h / 2 + 52;
        uiPanel(tx, ty, tw, 34 + rows.length * 24, "#ffd23f", 0.9);
        uiText("FIGHTER", tx + 18, ty + 22, 12, "#94a3b8", "left", "900");
        uiText("KOs", tx + 220, ty + 22, 12, "#94a3b8", "center", "900");
        uiText("FALLS", tx + 290, ty + 22, 12, "#94a3b8", "center", "900");
        uiText("DAMAGE", tx + 370, ty + 22, 12, "#94a3b8", "center", "900");
        for (let i = 0; i < rows.length; i++) {
            var rc = rows[i], ry = ty + 46 + i * 24, rcol = FIGHTER_COLORS[rc.playerIndex];
            uiText((rc === brawl.winner ? "👑 " : "") + rc.playerLabel, tx + 18, ry, 15, rcol, "left", "900");
            uiText(String(rc.brKOs || 0), tx + 220, ry, 15, "#fff", "center", "900");
            uiText(String(rc.brFalls || 0), tx + 290, ry, 15, "#fff", "center", "900");
            uiText(Math.round(rc.brDealt || 0) + "%", tx + 370, ry, 15, "#fff", "center", "900");
        }
    }
    uiText("Esc: pause menu (rematch, stage, opponents)", w / 2, h - 142, 11, "rgba(200,220,235,0.55)", "center", "600");
    drawCrosshair();
}
