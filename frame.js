var staticObjects = [];
var movingObjects = [];
var characters = [];
var allObjects = [];

var levelBounds = null; // inner walls of arena levels (null for the endless frontier)
var redGuy = null;
var blueGuy = null;

function createMap() {
    staticObjects = [];
    movingObjects = [];
    worldOriginOffsetX = 0;
    if (typeof treasureChests !== "undefined") {
        treasureChests = [];
    }
    if (typeof BackgroundMosaic !== "undefined") {
        if (!BackgroundMosaic.layers) BackgroundMosaic.init();
        BackgroundMosaic.bgProps = [];
        BackgroundMosaic.bgWalls = [];
    }

    var brawlStage = ((typeof LevelManager !== "undefined") && LevelManager.getCurrentLevel() && LevelManager.getCurrentLevel().isBrawl) || GameModes.flag("noBedrock", false);
    if (typeof Gadgets !== "undefined") Gadgets.clear();

    // Always add the Infinite Subterranean Bedrock Base Floor ~2 screens down (top = -1600, bottom = -2400)
    // plus return Mega-Bounce Geysers so falling off any level lands on a playable deep floor!
    if (!brawlStage) {
    Object.addBox(0, -2000, 12000, 800, "#2b2d42", {
        name: "Infinite Bedrock Floor",
        texture: "castle_stone",
        isInfiniteBase: true,
        baseOffsetX: 0
    });
    Object.addBumper(-960, -1580, 240, 40, 38, "#ff2e63", {
        name: "Deep Return Geyser W",
        isInfiniteBase: true,
        baseOffsetX: -960
    });
    Object.addBumper(0, -1580, 240, 40, 38, "#ff2e63", {
        name: "Deep Return Geyser C",
        isInfiniteBase: true,
        baseOffsetX: 0
    });
    Object.addBumper(960, -1580, 240, 40, 38, "#ff2e63", {
        name: "Deep Return Geyser E",
        isInfiniteBase: true,
        baseOffsetX: 960
    });
    }

    var currentLvl = (typeof LevelManager !== "undefined") ? LevelManager.getCurrentLevel() : null;
    if (currentLvl && currentLvl.layout) {
        Object.loadMap(currentLvl.layout);
    }
    // Remember the arena's enclosure so nothing can ever leave it
    levelBounds = null;
    var lw = null, rw = null;
    for (let i = 0; i < staticObjects.length; i++) {
        if (staticObjects[i].name == "Left Wall") lw = staticObjects[i];
        if (staticObjects[i].name == "Right Wall") rw = staticObjects[i];
    }
    if (lw && rw && !(currentLvl && currentLvl.isProcedural)) {
        levelBounds = { minX: lw.x + lw.w / 2, maxX: rw.x - rw.w / 2, topY: lw.y + lw.h / 2 - 40, floorY: -1500 };
    }
    GameModes.call("setupLevel", currentLvl);
    if (currentLvl && currentLvl.isProcedural && typeof WorldGenerator !== "undefined") {
        WorldGenerator.reset();
        WorldGenerator.update(0);
    } else if (typeof BackgroundMosaic !== "undefined" && !brawlStage && GameModes.flag("scenery", true)) {
        // Populate scenic non-colliding background trees across arena levels
        var treePositions = [-1280, -920, -520, -160, 200, 560, 920, 1280];
        for (let i = 0; i < treePositions.length; i++) {
            BackgroundMosaic.addBackgroundTree(treePositions[i] * STRUCT_SCALE, 40, (160 + (i % 3) * 25) * STRUCT_SCALE, (i % 2 === 0) ? "oak" : "pine", null, STRUCT_SCALE);
        }
    }
}


function createPlayers() {
    if (GameModes.has("createPlayers")) { characters = []; GameModes.call("createPlayers"); return; }
    if (brawl.active) { createBrawlFighters(); return; }
    characters = [];
    var charBox = Math.makeHitbox(s1, s2);
    var currentLvl = (typeof LevelManager !== "undefined") ? LevelManager.getCurrentLevel() : null;
    var p1Pos = (currentLvl && currentLvl.spawnP1) ? currentLvl.spawnP1 : [-60, 180];
    var p2Pos = (currentLvl && currentLvl.spawnP2) ? currentLvl.spawnP2 : [60, 180];
    var baseHP = 100 + (heroLevel - 1) * 20;
    var spd = speed * (1 + (heroLevel - 1) * 0.04);

    redGuy = new Character("Player 1", charBox, charBox, "#ff4d52", [p1Pos[0], p1Pos[1]],
        maxspeed, slower, gravity, bounciness, spd, "WASD", baseHP, "ULDR", false, "NORMAL");
    redGuy.isPlayer = true;
    redGuy.playerIndex = 0;
    redGuy.playerLabel = "P1";
    characters.push(redGuy);

    if (multiplayer) {
        blueGuy = new Character("Player 2", charBox, charBox, "#3da5ff", [p2Pos[0], p2Pos[1]],
            maxspeed, slower, gravity, bounciness, spd, "ULDR", baseHP, "ULDR", false, "NORMAL");
        blueGuy.isPlayer = true;
        blueGuy.playerIndex = 1;
        blueGuy.playerLabel = "P2";
        characters.push(blueGuy);
    } else {
        blueGuy = null;
    }
    lastStandTimer = -1;
}

function rebuildAllObjects() {
    if (typeof StaticGrid !== "undefined") StaticGrid.build();
    allObjects = [];
    for (let i = 0; i < staticObjects.length; i++) {
        if (!staticObjects[i].dead) allObjects.push(staticObjects[i]);
    }
    for (let i = 0; i < movingObjects.length; i++) {
        if (!movingObjects[i].dead) allObjects.push(movingObjects[i]);
    }
    for (let i = 0; i < characters.length; i++) allObjects.push(characters[i]);
    for (let i = 0; i < zombies.length; i++) {
        if (!zombies[i].dead) allObjects.push(zombies[i]);
    }
}


function startLevel(lvl) {
    level = lvl;
    var coopBonus = multiplayer ? Math.ceil(level * 1.5) : 0;
    zombiesRemainingToSpawn = 5 + level * 3 + coopBonus;
    zombieSpawnTimer = 35;
    levelTransitionTimer = 110;

    if (lvl > 1 && typeof SFX !== "undefined") SFX.play("wave");
    if (lvl > 1) {
        var waveBonus = (lvl - 1) * 120;
        score += waveBonus;
        if (score > highScore) {
            highScore = score;
            try { localStorage.setItem("timsZombieGameHighScore", highScore.toString()); } catch (e) {}
        }
        if (redGuy) {
            Components.addFloatingText("WAVE CLEAR! +" + waveBonus, redGuy.x, redGuy.y + 110, "#55ff88", 28);
        }
    }

    for (let i = 0; i < characters.length; i++) {
        if (characters[i].isZombie) {
            characters[i].reviveAsHuman(0.6, "WAVE CLEARED - BACK FROM THE DEAD!");
        } else {
            characters[i].health = Math.min(characters[i].maxHealth, characters[i].health + 12);
        }
    }
    lastStandTimer = -1;

    if (lvl % 2 === 0) spawnPowerUp((Math.random() < 0.5 ? -620 : 620) * STRUCT_SCALE * 0.6, 280);   // a power-up every other wave
    if (lvl > 1 && redGuy) spawnPowerUp(redGuy.x + (Math.random() < 0.5 ? -260 : 260), redGuy.y + 160, "AMMO");
}

// Enemy archetype table (stats scale with the wave number)
function enemySpec(power) {
    var L = level;
    var t = {
        NORMAL:    { color: "#2d6e32", size: 80,  spd: 0.55 + Math.min(0.35, L * 0.04), hp: 48 + L * 10 },
        SLIME:     { color: "#00f5d4", size: 76,  spd: 0.56, hp: 58 + L * 10 },
        BAT:       { color: "#6c5ce7", size: 56,  spd: 0.74, hp: 34 + L * 6 },
        ARCHER:    { color: "#d4a373", size: 78,  spd: 0.58, hp: 50 + L * 8 },
        KNIGHT:    { color: "#7f8c8d", size: 94,  spd: 0.52, hp: 115 + L * 18 },
        MAGE:      { color: "#7209b7", size: 80,  spd: 0.54, hp: 62 + L * 10 },
        LEAPER:    { color: "#7ec820", size: 74,  spd: 0.86, hp: 42 + L * 8 },
        EXPLODER:  { color: "#d95b16", size: 78,  spd: 0.74, hp: 38 + L * 6 },
        TANK:      { color: "#5e2b50", size: 120, spd: 0.44, hp: 135 + L * 24 },
        SPITTER:   { color: "#4d9a36", size: 80,  spd: 0.62, hp: 70 + L * 8 },
        BOSS_KING: { color: "#9b2226", size: 136, spd: 0.46, hp: 260 + L * 35 }
    };
    var s = t[power] || t.NORMAL;
    return { color: s.color, size: s.size, spd: s.spd * BALANCE.enemySpd, hp: Math.round(s.hp * BALANCE.enemyHp) };
}

function pickEnemyType() {
    var roll = Math.random();
    if (roll < 0.14) return "SLIME";
    if (roll < 0.26) return "BAT";
    if (roll < 0.40) return "ARCHER";
    if (roll < 0.52) return "LEAPER";
    if (level >= 2 && roll < 0.64) return "KNIGHT";
    if (level >= 2 && roll < 0.75) return "MAGE";
    if (level >= 2 && roll < 0.86) return "EXPLODER";
    if (level >= 3 && roll < 0.95) return "TANK";
    if (level >= 3) return "SPITTER";
    return "NORMAL";
}

// Spawns an enemy. With no arguments it picks a random archetype just outside the camera view.
function spawnZombie(forcePower, forceX, forceY) {
    var centerRef = (typeof cameraTargetX !== "undefined") ? cameraTargetX : 0;
    var viewHalf = (w / 2) / Math.max(0.3, cameraScaleX);
    var spawnX = (forceX !== undefined) ? forceX : centerRef + (Math.random() < 0.5 ? -1 : 1) * (viewHalf + 120 + Math.random() * 500);
    var spawnY = (forceY !== undefined) ? forceY : (typeof cameraTargetY !== "undefined" ? cameraTargetY : 0) + 520;

    var power = forcePower || pickEnemyType();
    var spec = enemySpec(power);
    var distScale = (typeof WorldGenerator !== "undefined" && WorldGenerator.distanceMult) ? WorldGenerator.distanceMult() : 1;
    var zHealth = Math.round(spec.hp * devOpts.enemyHealth * (multiplayer ? 1.25 : 1) * (1 + (distScale - 1) * 0.5));
    var zBox = Math.makeHitbox(spec.size, spec.size);
    var z = new Character(
        "Enemy_" + power, zBox, zBox, spec.color, [spawnX, spawnY],
        maxspeed * 0.85, slower, gravity, bounciness, speed * spec.spd,
        "ZOMBIE", zHealth, "NONE", true, power
    );
    // Spawn inside the enclosure and never inside solid geometry
    if (levelBounds && forceX === undefined) {
        z.x = Math.max(levelBounds.minX + spec.size, Math.min(levelBounds.maxX - spec.size, z.x));
        z.y = Math.min(z.y, levelBounds.topY - 200);
    }
    for (let k = 0; k < 14; k++) {
        if (!CollisionDetector.collision(z, [0, 0], staticObjects)) break;
        z.y += 90;
    }
    z.collidedWith = null;
    z.hunter = true; // wave enemies always hunt the heroes
    zombies.push(z);
    return z;
}

// Keeps heroes & enemies inside the arena walls/ceiling and rescues anything that tunnels out of the world
function enforceContainment() {
    var all = characters.concat(zombies);
    for (let i = 0; i < all.length; i++) {
        var c = all[i];
        if (c.dead) continue;
        var half = (c.s1 || 80) / 2;
        if (levelBounds) {
            if (c.x < levelBounds.minX + half) { c.x = levelBounds.minX + half; if (c.xspeed < 0) c.xspeed = 0; }
            if (c.x > levelBounds.maxX - half) { c.x = levelBounds.maxX - half; if (c.xspeed > 0) c.xspeed = 0; }
            if (c.y > levelBounds.topY) { c.y = levelBounds.topY; if (c.yspeed > 0) c.yspeed = 0; }
        }
        // Heroes: remember the last safe standing spot, and rescue them if they ever fall beneath the world
        if (c.isPlayer && !brawl.active) {
            if (c.onGround && c.y > -1250) { c.lastSafeX = c.x; c.lastSafeY = c.y; }
            if (c.y < -1350 && c.lastSafeX !== undefined) {
                c.x = c.lastSafeX;
                c.y = c.lastSafeY + 60;
                c.xspeed = c.yspeed = 0;
                c.invulnTimer = 60;
                Components.addFloatingText("RESCUED!", c.x, c.y + 90, "#7ff0ff", 20);
            }
        }
        if (c.y < -1700 && !c.isPlayer) {
            // fell through the world: put the enemy back on the battlefield near a hero
            var anchor = redGuy;
            for (let h = 0; h < characters.length; h++) if (!characters[h].isZombie) anchor = characters[h];
            c.x = anchor.x + (Math.random() < 0.5 ? -1 : 1) * (500 + Math.random() * 400);
            c.y = anchor.y + 400;
            c.xspeed = c.yspeed = 0;
            if (levelBounds) c.x = Math.max(levelBounds.minX + half, Math.min(levelBounds.maxX - half, c.x));
        }
    }
}

function pickPowerUpType() {
    var anyUndead = false;
    for (let i = 0; i < characters.length; i++) if (characters[i].isZombie) anyUndead = true;
    var total = 0;
    var entries = [];
    for (var k in PowerUpDefs) {
        var wgt = PowerUpDefs[k].weight;
        if (k == "SERUM") wgt = anyUndead ? 16 : 0;
        if (wgt > 0) { entries.push([k, wgt]); total += wgt; }
    }
    var r = Math.random() * total;
    for (let i = 0; i < entries.length; i++) {
        r -= entries[i][1];
        if (r <= 0) return entries[i][0];
    }
    return "RAPID";
}

// Wave enemies actively hunt; guardians idle at their posts and must not block the wave counter
function countHunters() {
    var n = 0;
    for (let i = 0; i < zombies.length; i++) if (!zombies[i].dead && zombies[i].hunter) n++;
    return n;
}

// ---- Big announcement banners (distance rewards etc.) ----
var banners = [];
function showBanner(title, sub, color) {
    banners.push({ title: title, sub: sub, color: color || "#ffd23f", life: 190, max: 190 });
    if (banners.length > 3) banners.shift();
}

function drawBanners() {
    if (banners.length === 0) return;
    var b = banners[0];
    b.life--;
    var a = Math.min(1, b.life / 30, (b.max - b.life) / 14);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    var bw = Math.min(w - 40, 760), bx = w / 2 - bw / 2, by = 120;
    uiPanel(bx, by, bw, 78, b.color, 0.92);
    uiText(b.title, w / 2, by + 36, 26, b.color, "center", "900");
    uiText(b.sub, w / 2, by + 62, 14, "#dbe7f0", "center", "700");
    ctx.restore();
    if (b.life <= 0) banners.shift();
}

function spawnPowerUp(x, y, forceType) {
    var t = forceType || pickPowerUpType();
    var def = PowerUpDefs[t] || PowerUpDefs.RAPID;
    powerUps.push({
        x: x,
        y: y,
        w: 56,
        h: 56,
        type: t,
        color: def.color,
        hitbox: Math.makeHitbox(56, 56),
        poly: Math.makeHitbox(56, 56),
        bobPhase: Math.random() * Math.PI * 2,
        life: 1300
    });
    return powerUps[powerUps.length - 1];
}


function drawEdgeIndicator(wx, wy, color, label) {
    var sx = wx * cameraScaleX + xc;
    var sy = -wy * cameraScaleY + yc;
    var m = 46;
    if (sx > m && sx < cssW - m && sy > m && sy < cssH - m) return;
    var cx = cssW / 2, cy = cssH / 2;
    var ang = Math.atan2(sy - cy, sx - cx);
    var ex = Math.max(m, Math.min(cssW - m, sx));
    var ey = Math.max(m + 40, Math.min(cssH - m - 70, sy));
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.strokeStyle = "#0a0f16";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -13);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 13);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    if (label) {
        ctx.save();
        ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(5,8,14,0.9)";
        var ly = ey + (ey < cssH / 2 ? 30 : -22);
        var lx = Math.max(70, Math.min(cssW - 70, ex));
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = color;
        ctx.fillText(label, lx, ly);
        ctx.restore();
    }
}

function updatePowerUps() {
    var now = Date.now();
    for (let i = powerUps.length - 1; i >= 0; i--) {
        var p = powerUps[i];
        p.life--;
        p.bobPhase += 0.08;
        var def = PowerUpDefs[p.type] || { icon: "?", label: p.type, color: p.color || "#fff" };
        var bob = Math.sin(p.bobPhase) * 9;

        // Magnet power pulls drops toward the holder
        for (let c = 0; c < characters.length; c++) {
            var mc = characters[c];
            if (mc.hasPower("MAGNET")) {
                var md = Math.hypot(mc.x - p.x, mc.y - p.y);
                if (md < 700 && md > 1) {
                    p.x += (mc.x - p.x) / md * 7;
                    p.y += (mc.y - p.y) / md * 7;
                }
            }
        }

        var sx = p.x * cameraScaleX + xc;
        var sy = -(p.y + bob) * cameraScaleY + yc;
        var blink = (p.life < 220 && Math.floor(p.life / 8) % 2 === 0);

        if (sx > -80 && sx < cssW + 80 && sy > -200 && sy < cssH + 80 && !blink) {
            var sz = Math.max(30, 50 * Math.max(0.85, cameraScaleX * 1.3));
            ctx.save();
            // light beam so power-ups are visible from far away
            var beam = ctx.createLinearGradient(0, sy - 260, 0, sy);
            beam.addColorStop(0, "rgba(255,255,255,0)");
            beam.addColorStop(1, def.color + "55");
            ctx.fillStyle = beam;
            ctx.fillRect(sx - sz * 0.35, sy - 260, sz * 0.7, 260);
            // pulsing ring
            ctx.strokeStyle = def.color;
            ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now * 0.008);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(sx, sy, sz * 0.85 + Math.sin(now * 0.008) * 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            // badge
            ctx.shadowColor = def.color;
            ctx.shadowBlur = 20;
            var grad = ctx.createRadialGradient(sx - sz * 0.15, sy - sz * 0.2, 2, sx, sy, sz * 0.7);
            grad.addColorStop(0, "#ffffff");
            grad.addColorStop(0.35, def.color);
            grad.addColorStop(1, Components.shade(def.color, -70));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, sz * 0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#0a0f16";
            ctx.stroke();
            ctx.fillStyle = "#0a0f16";
            ctx.font = "900 " + Math.round(sz * 0.62) + "px 'Segoe UI Symbol', 'Segoe UI', Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(def.icon, sx, sy + 1);
            // name label
            ctx.font = "800 13px 'Segoe UI', Arial, sans-serif";
            ctx.textBaseline = "alphabetic";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(5,8,14,0.92)";
            ctx.strokeText(def.label, sx, sy + sz * 0.95);
            ctx.fillStyle = def.color;
            ctx.fillText(def.label, sx, sy + sz * 0.95);
            ctx.restore();
        }
        if (SummonManager_isOffscreenIndicatorOn()) drawEdgeIndicator(p.x, p.y + bob, def.color, def.label);

        var collected = false;
        var pr = { x: p.x, y: p.y + bob, w: 56, h: 56, hitbox: p.hitbox, poly: p.poly };
        for (let c = 0; c < characters.length; c++) {
            var ch = characters[c];
            if (!ch.dead && CollisionDetector.collision(pr, [0, 0], [ch])) {
                ch.applyPowerUp(p.type);
                collected = true;
                break;
            }
        }
        if (collected || p.life <= 0) {
            powerUps.splice(i, 1);
        }
    }
}

function SummonManager_isOffscreenIndicatorOn() { return true; }

function toggleMultiplayer() {
    if (brawl.active) {
        brawlCfg.opponents = (brawlCfg.opponents === "p2") ? "1cpu" : "p2";
        saveBrawlCfg();
        resetGame();
        return;
    }
    multiplayer = !multiplayer;
    resetGame();
}


function resetGame() {
    lazers = [];
    particles = [];
    powerUps = [];
    floatingTexts = [];
    coinOrbs = [];
    afterImages = [];
    zombies = [];
    Components.rings = [];
    Components.bolts = [];
    Components.corpses = [];
    if (typeof Ragdolls !== "undefined") Ragdolls.clear();
    hitStopFrames = 0;
    slowMoFrames = 0;
    score = 0;
    combo = 1;
    comboTimer = 0;
    screenShake = 0;
    gameOver = false;
    lastStandTimer = -1;
    helpTimer = devOpts.showHelp ? 60 * 12 : 0;
    createMap();
    createPlayers();
    if (typeof Net !== "undefined") Net.afterPlayersCreated();
    if (!brawl.active && GameModes.flag("waves", true)) startLevel(1);
    else { levelTransitionTimer = 0; zombiesRemainingToSpawn = 0; }
    rebuildAllObjects();
    if (typeof Pathfinder !== "undefined") {
        Pathfinder.rebuildGraph(true);
    }
    if (typeof SummonManager !== "undefined" && SummonManager.isOpen) {
        SummonManager.selectObject(null);
        SummonManager.refreshObjectList();
    }
    GameModes.call("onReset");
}

// Partner revive: hold your interact key next to a fallen (undead) teammate
function updateRevive() {
    for (let i = 0; i < characters.length; i++) {
        characters[i].suppressAbility = false;
        characters[i].reviveChannel = 0;
    }
    var beingRevived = {};
    for (let i = 0; i < characters.length; i++) {
        var healer = characters[i];
        if (healer.isZombie || healer.dead) continue;
        var ally = null, best = 190;
        for (let j = 0; j < characters.length; j++) {
            var c = characters[j];
            if (c === healer || !c.isZombie || c.dead) continue;
            var d = Math.hypot(c.x - healer.x, c.y - healer.y);
            if (d < best) { best = d; ally = c; }
        }
        if (!ally) continue;
        healer.suppressAbility = true;
        if (healer.input.interact) {
            ally.reviveProgress = Math.min(1, ally.reviveProgress + 1 / 95);
            healer.reviveChannel = ally.reviveProgress;
            beingRevived[ally.id] = true;
            if (Math.random() < 0.4) Components.spawnSparks(ally.x, ally.y, "#44ffaa", 1);
            if (ally.reviveProgress >= 1) {
                healer.revives++;
                ally.reviveAsHuman(0.55, "REVIVED BY " + (healer.playerLabel || "ALLY") + "!");
                score += 300;
                Components.addFloatingText("+300 TEAMWORK", healer.x, healer.y + 100, "#44ffaa", 18);
            }
        }
    }
    for (let i = 0; i < characters.length; i++) {
        var ch = characters[i];
        if (ch.reviveProgress > 0 && !beingRevived[ch.id]) {
            ch.reviveProgress = Math.max(0, ch.reviveProgress - 0.025);
        }
    }
}

function updateLastStand() {
    var anyHuman = false;
    for (let i = 0; i < characters.length; i++) if (!characters[i].isZombie) anyHuman = true;
    if (anyHuman) { lastStandTimer = -1; return; }
    if (gameOver) return;
    if (lastStandTimer < 0) lastStandTimer = lastStandTimerMax;
    if (levelTransitionTimer <= 0) lastStandTimer--;
    if (lastStandTimer === 0) {
        gameOver = true;
        lastStandTimer = -1;
    }
}

function updateCamera() {
    var heroes = [];
    var modeTargets = GameModes.call("cameraTargets");
    if (modeTargets && modeTargets.length) heroes = modeTargets;
    else for (let i = 0; i < characters.length; i++) if (!characters[i].dead && !characters[i].isRemote) heroes.push(characters[i]);
    if (heroes.length === 0) for (let i = 0; i < characters.length; i++) if (!characters[i].dead) heroes.push(characters[i]);
    if (heroes.length === 0) heroes.push(redGuy);

    var focusX = 0, focusY = 0, wTotal = 0;
    for (let i = 0; i < heroes.length; i++) {
        var wgt = (heroes[i].isZombie && !brawl.active) ? 0.45 : 1;
        focusX += heroes[i].x * wgt;
        focusY += heroes[i].y * wgt;
        wTotal += wgt;
    }
    focusX /= wTotal;
    focusY /= wTotal;

    // Dynamic zoom: zoom out to keep both heroes in frame
    var desired = baseZoom * userZoom;
    if (heroes.length > 1) {
        var minHX = Infinity, maxHX = -Infinity, minHY = Infinity, maxHY = -Infinity;
        for (let hi = 0; hi < heroes.length; hi++) {
            minHX = Math.min(minHX, heroes[hi].x); maxHX = Math.max(maxHX, heroes[hi].x);
            minHY = Math.min(minHY, heroes[hi].y); maxHY = Math.max(maxHY, heroes[hi].y);
        }
        var ddx = maxHX - minHX;
        var ddy = maxHY - minHY;
        var fit = Math.min((cssW * 0.74) / (ddx + 520), (cssH * 0.62) / (ddy + 420));
        desired = Math.min(desired, Math.max(0.3, fit));
    }
    cameraScaleX += (desired - cameraScaleX) * 0.05;
    cameraScaleY = cameraScaleX;

    cameraTargetX += (focusX - cameraTargetX) * 0.14;
    cameraTargetY += (focusY - cameraTargetY) * 0.14;

    var shakeX = 0;
    var shakeY = 0;
    if (screenShake > 0) {
        shakeX = (Math.random() - 0.5) * screenShake * 2 * settings.shake;
        shakeY = (Math.random() - 0.5) * screenShake * 2 * settings.shake;
        screenShake *= 0.85;
        if (screenShake < 0.4) screenShake = 0;
    }

    xc = xcMaster - cameraTargetX * cameraScaleX + shakeX;
    yc = ycMaster + (cameraTargetY + 110) * cameraScaleY + shakeY;
}


function drawCrosshair() {
    if (!useMouseAim || !redGuy) return;
    ctx.save();
    var isHolding = (redGuy && redGuy.heldObject);
    var col = godMode ? "#ffdd00" : (isHolding ? "#00f5d4" : (mouseDown ? "#ffdd44" : "#ffffff"));
    var r = mouseDown ? 13 : 16;
    ctx.lineCap = "round";
    for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? "rgba(0,0,0,0.7)" : col;
        ctx.lineWidth = pass === 0 ? 5 : 2.5;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, r, 0, Math.PI * 2);
        ctx.moveTo(mouseX - r - 8, mouseY); ctx.lineTo(mouseX - r + 5, mouseY);
        ctx.moveTo(mouseX + r - 5, mouseY); ctx.lineTo(mouseX + r + 8, mouseY);
        ctx.moveTo(mouseX, mouseY - r - 8); ctx.lineTo(mouseX, mouseY - r + 5);
        ctx.moveTo(mouseX, mouseY + r - 5); ctx.lineTo(mouseX, mouseY + r + 8);
        ctx.stroke();
    }
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// ============================================================================
// MODERN HUD
// ============================================================================
var UI_FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

// Rounded-rect path that does not depend on any game object (usable from menus / the arcade hub)
function uiRoundRect(x, y, w2, h2, r) {
    r = Math.min(r, w2 / 2, h2 / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w2, y, x + w2, y + h2, r);
    ctx.arcTo(x + w2, y + h2, x, y + h2, r);
    ctx.arcTo(x, y + h2, x, y, r);
    ctx.arcTo(x, y, x + w2, y, r);
    ctx.closePath();
}

function uiPanel(x, y, pw, ph, accent, alpha) {
    ctx.save();
    // cheap drop shadow (offset dark panel instead of shadowBlur)
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    uiRoundRect(x + 3, y + 5, pw, ph, 14);
    ctx.fill();
    ctx.fillStyle = "rgba(9, 14, 22, " + (alpha || 0.86) + ")";
    uiRoundRect(x, y, pw, ph, 14);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = accent || "rgba(120, 170, 200, 0.45)";
    ctx.stroke();
    ctx.restore();
}

function uiBar(x, y, bw, bh, pct, color, bg) {
    pct = Math.max(0, Math.min(1, pct));
    ctx.save();
    ctx.fillStyle = bg || "rgba(255,255,255,0.10)";
    uiRoundRect(x, y, bw, bh, bh / 2);
    ctx.fill();
    if (pct > 0.001) {
        ctx.fillStyle = color;
        uiRoundRect(x, y, Math.max(bh, bw * pct), bh, bh / 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(x + bh / 2, y + 1, Math.max(0, bw * pct - bh), bh * 0.3);
    }
    ctx.restore();
}

function uiText(txt, x, y, size, color, align, weight) {
    ctx.save();
    ctx.font = (weight || "700") + " " + size + "px " + UI_FONT;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, size * 0.22);
    ctx.strokeStyle = "rgba(4,7,12,0.85)";
    ctx.strokeText(txt, x, y);
    ctx.fillStyle = color || "#fff";
    ctx.fillText(txt, x, y);
    ctx.restore();
}

// Always-visible key legend above each hero card (colour matches the hero) so co-op players never mix up controls
function drawKeyLegend(ch, x, y) {
    var p2 = ch.playerIndex === 1;
    var accent = p2 ? "#3da5ff" : "#ff5a5f";
    var items = p2 ?
        [["← ↑ ↓ →", "move"], ["ENTER", "shoot"], ["'", "reload"], [".", "jetpack"], ["R-SHIFT", "dash"], ["/", "revive"]] :
        [["W A S D", "move"], ["F", "shoot"], ["X", "reload"], ["SPACE", "jetpack"], ["L-SHIFT", "dash"], ["E", "revive"]];
    if (brawl.active) {
        items = p2 ?
            [["← ↑ ↓ →", "move/jump"], ["ENTER", "blaster"], ["R-SHIFT", "dash hit"], ["/", "smash"]] :
            [["W A S D", "move/jump"], ["F", "blaster"], ["L-SHIFT", "dash hit"], ["E", "smash"]];
    }
    var widths = [];
    ctx.save();
    ctx.font = "800 11px " + UI_FONT;
    var total = 0;
    for (let i = 0; i < items.length; i++) {
        widths[i] = Math.max(46, ctx.measureText(items[i][0]).width + 14);
        total += widths[i] + 6;
    }
    var bx = x;
    uiPanel(x - 6, y - 6, total + 6, 48, accent, 0.82);
    for (let i = 0; i < items.length; i++) {
        ctx.fillStyle = "#e8eef4";
        ch.roundRectPath(bx, y, widths[i], 22, 5);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.fillRect(bx + 2, y + 19, widths[i] - 4, 3);
        ctx.fillStyle = "#101820";
        ctx.textAlign = "center";
        ctx.fillText(items[i][0], bx + widths[i] / 2, y + 15);
        ctx.fillStyle = "#b8c9d6";
        ctx.font = "700 10px " + UI_FONT;
        ctx.fillText(items[i][1], bx + widths[i] / 2, y + 37);
        ctx.font = "800 11px " + UI_FONT;
        bx += widths[i] + 6;
    }
    ctx.restore();
}

function drawHeroCard(ch, x, y) {
    var cw = 330, chh = 150;
    var accent = ch.playerIndex === 0 ? "#ff5a5f" : "#3da5ff";
    uiPanel(x, y, cw, chh, ch.isZombie ? "#c77dff" : accent, 0.88);

    // portrait badge
    ctx.save();
    ctx.fillStyle = ch.isZombie ? "#7a5cff" : accent;
    ch.roundRectPath(x + 12, y + 12, 54, 54, 12);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#0a0f16";
    ctx.stroke();
    if (!ch.isZombie && ch.skinId() !== "original") {
        drawSkinPreview(ch.skinId(), x + 39, y + 40, 50, ch.playerIndex === 0 ? "#ff5a5f" : "#3da5ff", "P" + (ch.playerIndex + 1));
    } else {
        ch.drawSprite(ch.isZombie ? zombieImg : characterImg, x + 12, y + 12, 54, 54, 12, ch.isZombie ? "#7a5cff" : (ch.playerIndex === 1 ? "#2f8cff" : null));
    }
    ctx.restore();

    var label = (ch.playerLabel || "P" + (ch.playerIndex + 1)) + (ch.isZombie ? "  UNDEAD" : "  HERO LV " + heroLevel);
    uiText(label, x + 78, y + 30, 16, ch.isZombie ? "#d8b4fe" : "#ffffff", "left", "800");

    // health
    var pct = ch.health / ch.maxHealth;
    var hcol = ch.isZombie ? "#c77dff" : (pct > 0.6 ? "#3ddc84" : (pct > 0.3 ? "#ffd23f" : "#ff4d5e"));
    uiBar(x + 78, y + 38, cw - 94, 14, pct, hcol);
    uiText(Math.max(0, Math.ceil(ch.health)) + " / " + ch.maxHealth, x + cw - 20, y + 49, 12, "#fff", "right", "700");
    if (ch.shield > 0) uiBar(x + 78, y + 55, cw - 94, 4, ch.shield / Math.max(1, ch.shieldMax), "#6ee7ff");

    if (ch.isZombie) {
        uiBar(x + 78, y + 66, cw - 94, 12, ch.humanity / 100, "#e879f9");
        uiText("HUMANITY " + Math.round(ch.humanity) + "% · kill enemies to return", x + 78, y + 92, 12, "#e9d5ff", "left", "600");
        uiText("or partner holds " + (ch.playerIndex === 0 ? "[E]" : "[/]") + " beside you", x + 78, y + 110, 12, "#a7f3d0", "left", "600");
    } else {
        // jetpack fuel
        uiBar(x + 78, y + 66, cw - 94, 7, ch.jetpackFuel / ch.jetpackMaxFuel, "#22d3ee");
        uiText("FUEL", x + 78, y + 86, 10, "#67e8f9", "left", "700");
        var ab = ch.abilityCooldown > 0 && !godMode ? 1 - ch.abilityCooldown / 150 : 1;
        uiBar(x + 160, y + 78, 70, 7, ab, "#ffaa33");
        uiText("SHOCK", x + 160, y + 96, 10, "#ffcc88", "left", "700");
        var dc = ch.dashCooldown > 0 ? 1 - ch.dashCooldown / 42 : 1;
        uiBar(x + 240, y + 78, 70, 7, dc, "#00f5d4");
        uiText("DASH", x + 240, y + 96, 10, "#7ffbe9", "left", "700");

        // Ammo: magazine pips + reserve count
        var pipW = (cw - 94 - (ch.ammoMagMax - 1) * 2) / ch.ammoMagMax;
        var lowAmmo = ch.totalAmmo() <= 30 && !ch.unlimitedAmmo();
        for (let ap = 0; ap < ch.ammoMagMax; ap++) {
            var filled = ap < ch.ammoMag;
            ctx.fillStyle = ch.unlimitedAmmo() ? "#ffd23f" : (filled ? (lowAmmo && Math.floor(Date.now() / 250) % 2 ? "#ff6b6b" : "#fbbf24") : "rgba(255,255,255,0.12)");
            ctx.fillRect(x + 78 + ap * (pipW + 2), y + 104, pipW, 9);
        }
        if (ch.reloadTimer > 0) {
            uiBar(x + 78, y + 104, cw - 94, 9, 1 - ch.reloadTimer / 70, "#fbbf24", "rgba(0,0,0,0.6)");
            uiText("RELOADING", x + 78 + (cw - 94) / 2, y + 112, 10, "#1a1205", "center", "900");
        }
        uiText(ch.unlimitedAmmo() ? "AMMO ∞" : ("AMMO " + ch.ammoMag + " / " + ch.ammoReserve + (ch.totalAmmo() <= 0 ? "  OUT!" : "")), x + 78, y + 128, 11, lowAmmo ? "#ff9b9b" : "#fde68a", "left", "800");

        // active power chips
        var cx = x + 14, cy = y + 142;
        var shown = 0;
        for (var pk in ch.powers) {
            var def = PowerUpDefs[pk];
            if (!def) continue;
            var frac = ch.powers[pk] / Math.max(1, def.duration);
            ctx.save();
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ch.roundRectPath(cx, cy - 12, 56, 16, 8);
            ctx.fill();
            ctx.fillStyle = def.color;
            ch.roundRectPath(cx, cy - 12, Math.max(14, 56 * frac), 16, 8);
            ctx.fill();
            ctx.fillStyle = "#0a0f16";
            ctx.font = "900 11px " + UI_FONT;
            ctx.textAlign = "center";
            ctx.fillText(def.icon + " " + pk.slice(0, 4), cx + 28, cy);
            ctx.restore();
            cx += 60;
            if (++shown >= 5) break;
        }
    }
}

function drawHUD() {
    if (!redGuy) return;
    if (GameModes.has("drawHUD")) { GameModes.call("drawHUD"); drawBanners(); drawCrosshair(); return; }
    if (brawl.active) { drawBrawlHUD(); return; }
    ctx.textBaseline = "alphabetic";

    // ---------- Top-left: wave / score card ----------
    var aliveEnemies = zombies.length + zombiesRemainingToSpawn;
    uiPanel(14, 14, 330, 124, godMode ? "#ffdd00" : "rgba(120,170,200,0.5)");
    uiText("WAVE " + level, 30, 48, 30, "#ffd23f", "left", "900");
    uiText(aliveEnemies + " enemies left", 30 + 150, 46, 14, "#ffb4b4", "left", "700");
    uiText("SCORE " + score, 30, 74, 18, "#ffffff", "left", "800");
    uiText("BEST " + highScore, 190, 74, 14, "#9fb6c8", "left", "700");
    var comboTxt = combo > 1 ? ("COMBO x" + combo) : "COMBO x1";
    uiText(comboTxt, 30, 98, 13, combo > 1 ? "#ff9f43" : "#8ba2b4", "left", "800");
    uiBar(130, 88, 190, 8, comboTimer / comboTimerMax, "#ff9f43");
    uiBar(30, 110, 200, 9, heroXP / heroXPNext, "#00f5d4");
    uiText("LV " + heroLevel + "  XP " + heroXP + "/" + heroXPNext, 30, 130, 11, "#7ffbe9", "left", "700");
    uiText("◈ " + coins, 250, 119, 15, "#ffd60a", "left", "800");
    if (godMode) uiText("⚡ GOD MODE", 250, 98, 12, "#ffdd00", "right", "900");

    // ---------- Frontier banner (distance, bonus, next reward) ----------
    if (typeof LevelManager !== "undefined" && LevelManager.currentLevelKey === "infinite_frontier" && typeof WorldGenerator !== "undefined") {
        var farthestX = 0;
        for (let hI = 0; hI < characters.length; hI++) farthestX = Math.max(farthestX, Math.abs(characters[hI].x + worldOriginOffsetX));
        var milesNow = Math.floor(farthestX / 240);
        var nextR = (Math.floor(milesNow / 5) + 1) * 5;
        var rewardName = (nextR % 25 === 0) ? "TRAIL LEGEND" : ((nextR % 10 === 0) ? "CACHE" : "SUPPLY DROP");
        var bx = 360, bw = Math.max(330, Math.min(520, w - 360 - 700));
        uiPanel(bx, 14, bw, 92, "#00f5d4");
        uiText(WorldGenerator.currentBiomeTitle.replace(/^\S+\s/, ""), bx + bw / 2, 38, 14, "#ffd23f", "center", "800");
        uiText(milesNow + " MI  ·  BEST " + WorldGenerator.bestMiles + " MI  ·  REWARDS x" + WorldGenerator.distanceMult().toFixed(2), bx + bw / 2, 58, 13, "#dbe7f0", "center", "700");
        var frac = ((farthestX / 240) - (nextR - 5)) / 5;
        uiBar(bx + 18, 70, bw - 36, 8, frac, "#00f5d4");
        uiText("Next: " + rewardName + " at " + nextR + " MI", bx + bw / 2, 96, 12, "#7ff0ff", "center", "700");
    }

    // ---------- Last stand banner ----------
    if (lastStandTimer >= 0 && !gameOver) {
        uiPanel(w / 2 - 250, 70, 500, 62, "#ff4d5e");
        uiText("LAST STAND - EARN A LIFE BACK!", w / 2, 96, 18, "#ff9aa5", "center", "900");
        uiBar(w / 2 - 220, 106, 440, 10, lastStandTimer / lastStandTimerMax, "#ff4d5e");
        uiText(Math.ceil(lastStandTimer / 60) + "s", w / 2 + 232, 116, 12, "#fff", "left", "800");
    }

    drawBanners();

    // ---------- Hero cards ----------
    var cardY = h - 166;
    drawHeroCard(redGuy, 14, cardY);
    if (multiplayer && blueGuy) drawHeroCard(blueGuy, w - 344, cardY);
    if (multiplayer) {
        drawKeyLegend(redGuy, 20, cardY - 58);
        if (blueGuy) drawKeyLegend(blueGuy, w - 338, cardY - 58);
    }

    // ---------- World-space prompts & off-screen partner arrows ----------
    for (let i = 0; i < characters.length; i++) {
        var ch = characters[i];
        if (multiplayer) drawEdgeIndicator(ch.x, ch.y, ch.isZombie ? "#c77dff" : (ch.playerIndex === 0 ? "#ff5a5f" : "#3da5ff"), ch.playerLabel);
        if (ch.isZombie && ch.isPlayer) {
            for (let j = 0; j < characters.length; j++) {
                var hh = characters[j];
                if (hh.isZombie || Math.hypot(hh.x - ch.x, hh.y - ch.y) > 190) continue;
                uiText("Hold " + (hh.playerIndex === 0 ? "[E]" : "[/]") + " to REVIVE", ch.x * cameraScaleX + xc, (-ch.y - ch.s2 * 0.5) * cameraScaleY + yc - 62, 14, "#a7f3d0", "center", "800");
            }
        }
    }

    // ---------- Controls cheat-sheet ----------
    if (devOpts.showHelp && helpTimer > 0) {
        helpTimer--;
        var fade = Math.min(1, helpTimer / 60);
        var hw = multiplayer ? 640 : 560;
        var hx = w / 2 - hw / 2, hy = h - 150;
        ctx.save();
        ctx.globalAlpha = fade;
        uiPanel(hx, hy, hw, 132, "rgba(120,170,200,0.4)", 0.8);
        if (multiplayer) {
            uiText("PLAYER 1", hx + 24, hy + 28, 14, "#ff7b80", "left", "900");
            uiText("WASD move/jump   F shoot   Space jetpack", hx + 24, hy + 50, 12, "#dbe7f0", "left", "600");
            uiText("L-Shift dash   E shockwave / hold: revive   G grab", hx + 24, hy + 68, 12, "#dbe7f0", "left", "600");
            uiText("Stairs: hold UP to climb, DOWN to step off · mouse also aims for P1", hx + 24, hy + 86, 11, "#8ba2b4", "left", "600");
            uiText("PLAYER 2", hx + 340, hy + 28, 14, "#6cb8ff", "left", "900");
            uiText("Arrows move/jump   Enter shoot   . jetpack", hx + 340, hy + 50, 12, "#dbe7f0", "left", "600");
            uiText("R-Shift dash   / shockwave / hold: revive   , grab", hx + 340, hy + 68, 12, "#dbe7f0", "left", "600");
        } else {
            uiText("WASD move/jump   Mouse aim + click or F shoot   Arrows: twin-stick fire", hx + 24, hy + 28, 12, "#dbe7f0", "left", "700");
            uiText("Space jetpack   L-Shift dash   E shockwave   R-click/G grab & throw crates or BODIES", hx + 24, hy + 50, 12, "#dbe7f0", "left", "700");
            uiText("Stairs: hold UP to climb, DOWN to step off.   Esc: pause menu (character, co-op, restart, levels)", hx + 24, hy + 72, 12, "#ffd23f", "left", "800");
        }
        uiText("Esc pause menu (restart · co-op · levels · settings) · 🎮 controllers supported · H hide · B dev mode · +/- zoom", hx + hw / 2, hy + 116, 11, "#8ba2b4", "center", "600");
        ctx.restore();
    } else {
        uiText("H: controls", w / 2, h - 12, 11, "rgba(200,220,235,0.55)", "center", "600");
    }

    // ---------- Wave title ----------
    if (levelTransitionTimer > 0) {
        levelTransitionTimer--;
        var a = Math.min(1, levelTransitionTimer / 30, (110 - levelTransitionTimer) / 12);
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        var lvlTitle = (typeof LevelManager !== "undefined") ? LevelManager.getCurrentLevel().name : "";
        uiText("WAVE " + level, w / 2, h / 3, 64, "#ffd23f", "center", "900");
        uiText(lvlTitle, w / 2, h / 3 + 34, 18, "#cfe3f1", "center", "700");
        ctx.restore();
    }

    // ---------- Game over ----------
    if (gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, w, h);
        uiPanel(w / 2 - 280, h / 2 - 120, 560, 240, "#ff4d5e", 0.95);
        uiText("OVERRUN", w / 2, h / 2 - 50, 52, "#ff4d5e", "center", "900");
        uiText("Wave " + level + "  ·  Score " + score + (score >= highScore ? "  ·  NEW BEST!" : ""), w / 2, h / 2 - 8, 20, "#ffffff", "center", "800");
        var statLine = "";
        for (let i = 0; i < characters.length; i++) {
            statLine += (characters[i].playerLabel || "P") + ": " + characters[i].kills + " kills, " + characters[i].revives + " revives     ";
        }
        uiText(statLine, w / 2, h / 2 + 28, 14, "#a8c0d0", "center", "700");
        uiText("Opening the menu…", w / 2, h / 2 + 78, 16, "#8ba2b4", "center", "700");
    }

    // ---------- Dev overlays ----------
    if (devOpts.showFPS) {
        uiText(measuredFPS + " FPS  |  enemies " + zombies.length + "  objs " + allObjects.length + "  zoom " + cameraScaleX.toFixed(2), 14, 160, 12, "#9bffb0", "left", "700");
    }
    if (devOpts.timeScale !== 1) {
        uiText("TIME x" + devOpts.timeScale.toFixed(2), w / 2, 90, 14, "#ffd23f", "center", "800");
    }

    drawCrosshair();
}

function frame() {
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // Draw Multi-Layer Repeating Parallax Background Mosaic & Non-Colliding Background Trees
    if (typeof BackgroundMosaic !== "undefined") {
        BackgroundMosaic.draw(ctx);
    }

    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer == 0) {
            combo = 1;
        }
    }

    var wavesPaused = (typeof SummonManager !== "undefined" && SummonManager.pauseWaves);
    if (!wavesPaused && !brawl.active && GameModes.flag("waves", true)) {
        if (zombiesRemainingToSpawn > 0) {
            zombieSpawnTimer--;
            if (zombieSpawnTimer <= 0 && countHunters() < devOpts.maxEnemies && !gameOver) {
                spawnZombie();
                zombiesRemainingToSpawn--;
                zombieSpawnTimer = Math.max(24, (100 - level * 8) / Math.max(0.1, devOpts.spawnRate));
            }
        } else if (countHunters() == 0 && !gameOver) {
            startLevel(level + 1);
        }
    }

    rebuildAllObjects();
    updateCamera();
    if (typeof WorldGenerator !== "undefined") {
        WorldGenerator.update(cameraTargetX);
    }

    for (let i = movingObjects.length - 1; i >= 0; i--) {
        if (movingObjects[i].dead) {
            movingObjects.splice(i, 1);
        } else {
            movingObjects[i].move();
        }
    }

    if (!brawl.active && GameModes.flag("revive", true)) {
        updateRevive();
        updateLastStand();
    }

    // Live gravity tuning (dev mode "Gravity" slider) applies to everyone
    var gNow = gravity * (devOpts.gravityMult || 1);
    for (let i = 0; i < characters.length; i++) characters[i].gravity = gNow;
    for (let i = 0; i < zombies.length; i++) zombies[i].gravity = gNow;
    for (let i = 0; i < movingObjects.length; i++) movingObjects[i].gravity = gNow;

    // Verlet ragdolls step first so knocked-down characters follow their bodies this frame
    if (typeof Ragdolls !== "undefined") Ragdolls.update();
    if (typeof Gadgets !== "undefined") Gadgets.preUpdate();
    if (typeof Pathfinder !== "undefined" && Pathfinder.beginFrame) Pathfinder.beginFrame();
    GameModes.call("preUpdate");

    for (let i = 0; i < characters.length; i++) {
        if (!characters[i].dead) {
            Components.moveTypeFinder(characters[i]);
            Components.shootLazer(characters[i]);
            characters[i].move();
        }
    }

    for (let i = zombies.length - 1; i >= 0; i--) {
        if (zombies[i].dead) {
            zombies.splice(i, 1);
        } else {
            Components.moveTypeFinder(zombies[i]);
            Components.shootLazer(zombies[i]);
            zombies[i].move();
        }
    }

    // Hard Mathematical Non-Penetration Solver
    var dynamicList = [].concat(characters, zombies, movingObjects);
    CollisionDetector.enforceNonPenetration(staticObjects, dynamicList);
    enforceContainment();
    updateBrawl();
    if (typeof Gadgets !== "undefined") Gadgets.update();
    GameModes.call("update");

    // Draw Static Map Objects
    for (let i = 0; i < staticObjects.length; i++) {
        staticObjects[i].staticObject();
    }

    if (typeof Gadgets !== "undefined") Gadgets.draw();
    GameModes.call("drawWorld");

    // Draw Stick Ninja Afterimages
    Components.updateAfterImages();

    // Draw Moving Physics Crates
    for (let i = 0; i < movingObjects.length; i++) {
        if (!movingObjects[i].dead) {
            Polygon.create(movingObjects[i].poly, movingObjects[i].color, movingObjects[i]);
            movingObjects[i].drawDecorations();
        }
    }

    // Ragdoll bodies lie behind the living
    if (typeof Ragdolls !== "undefined") Ragdolls.drawCorpses();

    // Update & Draw Power-Ups, Treasure Chests & RPG Gold Coins
    updatePowerUps();
    if (typeof Components.updateChests === "function") {
        Components.updateChests();
    }
    Components.updateCoins();

    // Draw Players & Zombies
    for (let i = 0; i < characters.length; i++) {
        if (!characters[i].dead) characters[i].createCharacter();
    }
    for (let i = 0; i < zombies.length; i++) {
        if (!zombies[i].dead) zombies[i].createCharacter();
    }

    // Update & Draw Lazers, Particles & Floating Arcade Texts
    Components.updateLazers();
    Components.updateParticles();
    Components.drawEffects();
    GameModes.call("drawFront");
    Components.updateFloatingTexts();

    if (devOpts.showHitboxes) drawHitboxes();

    if (typeof Pathfinder !== "undefined") {
        Pathfinder.drawDebug();
    }
    if (typeof SummonManager !== "undefined") {
        SummonManager.drawOverlay();
    }

    drawHUD();
    if (typeof Net !== "undefined" && Net.role === "host") Net.hostFrame();
}

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);
window.addEventListener("mousemove", mouseMoveHandler, false);
canvas.addEventListener("mousedown", mouseDownHandler, false);
window.addEventListener("mouseup", mouseUpHandler, false);

if (typeof TextureManager !== "undefined") TextureManager.init();
if (typeof BackgroundMosaic !== "undefined") BackgroundMosaic.init();
if (typeof LevelManager !== "undefined") LevelManager.init();
resetGame();
if (typeof Pathfinder !== "undefined") Pathfinder.init();
if (typeof SummonManager !== "undefined") SummonManager.init();

// ============================================================================
// PAUSE MENU (Esc). Restart, co-op, level changes and dev tools live here - never on a single stray key.
// ============================================================================
var paused = false;
var pauseIndex = 0;
var pauseConfirm = false;
var pauseRects = [];
var pauseSnap = null;
var pauseFromGameOver = false;
var pauseSub = null; // null = main menu, "settings" = settings page
var pauseLevelKeys = [];
var pauseLevelIdx = 0;
var gameOverTimer = 0;

function openPause(fromGameOver) {
    pauseFromGameOver = !!fromGameOver;
    pauseConfirm = false;
    pauseIndex = 0;
    pauseSnap = document.createElement("canvas");
    pauseSnap.width = canvas.width;
    pauseSnap.height = canvas.height;
    pauseSnap.getContext("2d").drawImage(canvas, 0, 0);
    pauseLevelKeys = [];
    var all = LevelManager.getAllLevels();
    for (var k in all) if (GameModes.modeOf(all[k]) === GameModes.current.id) pauseLevelKeys.push(k);
    pauseLevelIdx = Math.max(0, pauseLevelKeys.indexOf(LevelManager.currentLevelKey));
    paused = true;
    for (let i = 0; i < PlayerInput.length; i++) PlayerInput[i].shoot = PlayerInput[i].jet = PlayerInput[i].interact = false;
}

function closePause() {
    paused = false;
    pauseSub = null;
    pauseSnap = null;
    pauseConfirm = false;
}

function togglePause() {
    if (paused) closePause();
    else openPause(false);
}

var PAUSE_CYCLE_IDS = ["level", "skin0", "skin1", "bopp", "blvl", "bstk", "bstage", "svol", "sshake"];

function pauseItems() {
    if (pauseSub === "settings") {
        return [
            { id: "svol", label: "Sound volume:  ◀  " + (settings.volume <= 0 ? "OFF" : Math.round(settings.volume * 100) + "%") + "  ▶", hint: "◀ ▶ adjust" },
            { id: "sshake", label: "Screen shake:  ◀  " + Math.round(settings.shake * 100) + "%  ▶", hint: "◀ ▶ adjust (0% = off)" },
            { id: "shit", label: "Hit-stop on big hits:  " + (settings.hitStop ? "ON" : "OFF"), hint: "Freezes a few frames on heavy impacts" },
            { id: "shidpi", label: "Sharp hi-DPI graphics:  " + (settings.hiDPI ? (renderScaleAutoReduced ? "ON (auto-reduced for speed)" : "ON") : "OFF"), hint: "Turn off if the game runs slowly" },
            { id: "sglow", label: "Glow effects:  " + (settings.glow ? (glowAutoDisabled ? "ON (auto-reduced for speed)" : "ON") : "OFF"), hint: "Turn off for more FPS on slower computers" },
            { id: "ssquare", label: "Character look:  " + (settings.squareChars ? "Classic squares" : "Detailed"), hint: "Classic squares = the original 2020 blocky look" },
            { id: "help", label: "Controls help:  " + (devOpts.showHelp ? "ON" : "OFF"), hint: "Shows the key cheat-sheet" },
            { id: "back", label: "◀  Back", hint: "Esc" }
        ];
    }
    if (pauseConfirm) {
        return [
            { id: "yes", label: "Yes - restart the run", hint: "Score and wave progress are lost" },
            { id: "no", label: "No - go back", hint: "" }
        ];
    }
    var items = [];
    var inBrawl = brawl.active;
    if (!pauseFromGameOver) items.push({ id: "resume", label: "Resume", hint: "Esc" });
    else items.push({ id: "again", label: GameModes.current.againLabel || (inBrawl ? "Rematch" : "Play again"), hint: inBrawl ? "Applies the settings below" : "Start a fresh run" });
    items.push({ id: "arcade", label: "🕹  Arcade - switch game  (" + (GameModes.current ? GameModes.current.title : "") + ")", hint: "Pick any game made with this engine" });
    if (GameModes.has("menuItems")) { GameModes.call("menuItems", items); }
    if (inBrawl) {
        var sName = LevelManager.getAllLevels()[brawlCfg.stage];
        items.push({ id: "bopp", label: "Opponents:  ◀  " + brawlOpponentLabel() + "  ▶", hint: "Applies on Rematch - PvP or CPU fighters" });
        items.push({ id: "blvl", label: "CPU skill:  ◀  " + BRAWL_CPU_NAMES[brawlCfg.cpuLevel] + "  ▶", hint: "Applies on Rematch" });
        items.push({ id: "bstk", label: "Stocks:  ◀  " + brawlCfg.stocks + "  ▶", hint: "Lives per fighter - applies on Rematch" });
        items.push({ id: "bstage", label: "Stage:  ◀  " + (sName ? sName.name.replace(/^[^A-Za-z]+/, "") : "?") + "  ▶", hint: "Applies on Rematch" });
        if (!pauseFromGameOver) items.push({ id: "again", label: "Rematch", hint: "Start a new match with these settings" });
    } else if (GameModes.flag("coopToggle", true)) {
        items.push({ id: "mode", label: "Players:  " + (multiplayer ? "2-player co-op" : "Solo") + "   ▶  " + (multiplayer ? "Solo" : "Co-op"), hint: "Enter switches mode (restarts the run)" });
    }
    items.push({ id: "skin0", label: "Player 1 character:  ◀  " + skinName(heroSkins[0]) + "  ▶", hint: "◀ ▶ or Enter to change - applies instantly" });
    if (multiplayer && (!inBrawl || (brawlCfg.opponents.indexOf("p2") === 0))) items.push({ id: "skin1", label: "Player 2 character:  ◀  " + skinName(heroSkins[1]) + "  ▶", hint: "◀ ▶ or Enter to change - applies instantly" });
    if (!inBrawl && !GameModes.has("menuItems") && pauseLevelKeys.length > 1) {
        var lvlName = LevelManager.getAllLevels()[pauseLevelKeys[pauseLevelIdx]];
        items.push({ id: "level", label: "Level:  ◀  " + (lvlName ? lvlName.name : "?") + "  ▶", hint: "◀ ▶ choose, Enter loads it (restarts the run)" });
        if (!pauseFromGameOver) items.push({ id: "restart", label: "Restart run", hint: "Asks for confirmation" });
    }
    items.push({ id: "settings", label: "Settings  ▸", hint: "Sound, screen shake, hit-stop, graphics, help" });
    items.push({ id: "dev", label: "Developer Mode panel", hint: "Same as pressing B" });
    return items;
}

function pauseActivate(id, dir) {
    if (typeof SFX !== "undefined") SFX.play("select");
    if (id === "settings") { pauseSub = "settings"; pauseIndex = 0; return; }
    if (id === "back") { pauseSub = null; pauseIndex = 0; return; }
    if (id === "svol") { SFX.setVolume(Math.round((settings.volume + (dir || 1) * 0.1) * 10) / 10); if (settings.volume > 1) SFX.setVolume(1); return; }
    if (id === "sshake") { settings.shake = Math.max(0, Math.min(1, Math.round((settings.shake + (dir || 1) * 0.25) * 4) / 4)); saveSettings(); return; }
    if (id === "sglow") { settings.glow = !settings.glow; glowAutoDisabled = false; saveSettings(); return; }
    if (id === "ssquare") { settings.squareChars = !settings.squareChars; saveSettings(); return; }
    if (id === "shit") { settings.hitStop = !settings.hitStop; saveSettings(); return; }
    if (id === "shidpi") { settings.hiDPI = !settings.hiDPI; renderScaleAutoReduced = false; saveSettings(); applyCanvasSize(); xcMaster = w / 2; ycMaster = h / 2; return; }
    if (GameModes.call("onMenu", id, dir)) return;
    if (id === "arcade") { closePause(); Hub.openHub(false); return; }
    if (id === "resume") closePause();
    else if (id === "again" || id === "yes") {
        closePause();
        if (GameModes.has("onRestart")) { GameModes.call("onRestart"); return; }
        if (brawl.active && LevelManager.currentLevelKey !== brawlCfg.stage) LevelManager.selectLevel(brawlCfg.stage);
        else resetGame();
    }
    else if (id === "no") { pauseConfirm = false; pauseIndex = 0; }
    else if (id === "restart") { pauseConfirm = true; pauseIndex = 1; }
    else if (id === "skin0") cycleSkin(0, dir || 1);
    else if (id === "skin1") cycleSkin(1, dir || 1);
    else if (id === "gmode") {
        closePause();
        if (brawl.active) LevelManager.selectLevel("classic_arena");
        else LevelManager.selectLevel(brawlCfg.stage);
    }
    else if (id === "bopp") cycleBrawlOpponents(dir || 1);
    else if (id === "blvl") { brawlCfg.cpuLevel = ((brawlCfg.cpuLevel - 1 + (dir || 1) + 3) % 3) + 1; saveBrawlCfg(); }
    else if (id === "bstk") { brawlCfg.stocks = Math.max(1, Math.min(9, brawlCfg.stocks + (dir || 1))); saveBrawlCfg(); }
    else if (id === "bstage") cycleBrawlStage(dir || 1);
    else if (id === "mode") { closePause(); toggleMultiplayer(); }
    else if (id === "level") {
        if (dir) pauseLevelIdx = (pauseLevelIdx + dir + pauseLevelKeys.length) % pauseLevelKeys.length;
        else { var key = pauseLevelKeys[pauseLevelIdx]; closePause(); LevelManager.selectLevel(key); }
    }
    else if (id === "help") { devOpts.showHelp = !devOpts.showHelp; helpTimer = devOpts.showHelp ? 60 * 14 : 0; }
    else if (id === "dev") { closePause(); if (!SummonManager.isOpen) SummonManager.togglePanel(); }
}

function pauseKey(e) {
    var items = pauseItems();
    var c = e.code;
    if (typeof SFX !== "undefined" && (c === "ArrowUp" || c === "ArrowDown" || c === "KeyW" || c === "KeyS")) SFX.play("ui");
    if (c === "ArrowUp" || c === "KeyW") pauseIndex = (pauseIndex - 1 + items.length) % items.length;
    else if (c === "ArrowDown" || c === "KeyS") pauseIndex = (pauseIndex + 1) % items.length;
    else if (c === "ArrowLeft" || c === "KeyA") { var li = items[pauseIndex].id; if (PAUSE_CYCLE_IDS.indexOf(li) !== -1 || items[pauseIndex].cycle) pauseActivate(li, -1); }
    else if (c === "ArrowRight" || c === "KeyD") { var ri = items[pauseIndex].id; if (PAUSE_CYCLE_IDS.indexOf(ri) !== -1 || items[pauseIndex].cycle) pauseActivate(ri, 1); }
    else if (c === "Enter" || c === "NumpadEnter" || c === "Space") pauseActivate(items[pauseIndex].id, 0);
    e.preventDefault();
}

function pauseHover(mx, my) {
    for (let i = 0; i < pauseRects.length; i++) {
        var r = pauseRects[i];
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) { pauseIndex = i; return; }
    }
}

function pauseClick(mx, my) {
    var items = pauseItems();
    for (let i = 0; i < pauseRects.length; i++) {
        var r = pauseRects[i];
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
            pauseIndex = i;
            var dir = 0;
            if (PAUSE_CYCLE_IDS.indexOf(items[i].id) !== -1 || items[i].cycle) dir = (mx > r.x + r.w / 2) ? 1 : -1;
            pauseActivate(items[i].id, dir);
            return true;
        }
    }
    return false;
}

function drawPauseMenu() {
    if (!pauseSnap) return;
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.drawImage(pauseSnap, 0, 0, cssW, cssH);
    ctx.fillStyle = "rgba(4, 8, 14, 0.72)";
    ctx.fillRect(0, 0, w, h);

    var items = pauseItems();
    if (pauseIndex >= items.length) pauseIndex = 0;
    var pw = 560, rowH = Math.max(40, Math.min(58, Math.floor((h - 190) / items.length)));
    var ph = 150 + items.length * rowH;
    var px = w / 2 - pw / 2, py = Math.max(20, h / 2 - ph / 2);
    uiPanel(px, py, pw, ph, pauseFromGameOver ? "#ff4d5e" : "#22d3ee", 0.96);
    uiText(pauseSub === "settings" ? "SETTINGS" : pauseConfirm ? "RESTART?" : (pauseFromGameOver ? (GameModes.current.overTitle || (brawl.active ? "GAME!" : "OVERRUN")) : "PAUSED"), w / 2, py + 62, 44, pauseFromGameOver ? "#ff4d5e" : "#ffd23f", "center", "900");
    uiText(GameModes.has("overSub") ? GameModes.call("overSub", pauseFromGameOver) : brawl.active ? ("Brawl  ·  " + (brawl.stage ? brawl.stage.name.replace(/^[^A-Za-z]+/, "") : "")) : ("Wave " + level + "  ·  Score " + score + "  ·  " + (multiplayer ? "Co-op" : "Solo")), w / 2, py + 92, 15, "#a8c0d0", "center", "700");

    pauseRects = [];
    for (let i = 0; i < items.length; i++) {
        var ry = py + 116 + i * rowH;
        var sel = (i === pauseIndex);
        ctx.save();
        ctx.fillStyle = sel ? "rgba(34, 211, 238, 0.22)" : "rgba(255,255,255,0.05)";
        uiRoundRect(px + 24, ry, pw - 48, rowH - 8, 12);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = sel ? "#22d3ee" : "rgba(255,255,255,0.08)";
        ctx.stroke();
        ctx.restore();
        uiText(items[i].label, w / 2, ry + 28, 19, sel ? "#ffffff" : "#c3d5e2", "center", "800");
        if (sel && items[i].hint) uiText(items[i].hint, w / 2, ry + 43, 11, "#7ff0ff", "center", "600");
        if (items[i].id === "skin0" || items[i].id === "skin1") {
            var si = (items[i].id === "skin0") ? 0 : 1;
            drawSkinPreview(heroSkins[si], px + 62, ry + (rowH - 8) / 2, 40, si === 0 ? "#ff5a5f" : "#3da5ff", "P" + (si + 1));
        }
        pauseRects.push({ x: px + 24, y: ry, w: pw - 48, h: rowH - 8 });
    }
    uiText("↑ ↓ select    ← → change    Enter confirm    Esc resume", w / 2, py + ph - 14, 12, "#8ba2b4", "center", "600");
}

function drawHitboxes() {
    ctx.save();
    ctx.lineWidth = 1.5;
    var lists = [staticObjects, movingObjects, characters, zombies];
    for (let li = 0; li < lists.length; li++) {
        ctx.strokeStyle = li === 0 ? "rgba(0,255,120,0.7)" : (li === 1 ? "rgba(255,200,0,0.9)" : (li === 2 ? "rgba(80,200,255,1)" : "rgba(255,70,70,1)"));
        for (let i = 0; i < lists[li].length; i++) {
            var o = lists[li][i];
            if (!o || o.dead) continue;
            var sx = (o.x - o.w / 2) * cameraScaleX + xc;
            var sy = (-o.y - o.h / 2) * cameraScaleY + yc;
            if (sx > cssW || sy > cssH || sx + o.w * cameraScaleX < 0 || sy + o.h * cameraScaleY < 0) continue;
            ctx.strokeRect(sx, sy, o.w * cameraScaleX, o.h * cameraScaleY);
        }
    }
    ctx.restore();
}

// Fixed-rate loop with a time-scale accumulator (dev slow-mo / fast-forward) and FPS meter
var tickAccumulator = 0;
var lowFpsSeconds = 0;
function tick() {
    if (typeof Pads !== "undefined") Pads.poll();
    if (typeof Net !== "undefined" && Net.role === "client") { Net.clientTick(); return; }
    if (typeof Hub !== "undefined" && Hub.isOpen) { Hub.draw(); if (typeof Net !== "undefined") Net.hostIdle(); return; }
    if (paused) { drawPauseMenu(); return; }
    if (hitStopFrames > 0) { hitStopFrames--; return; }   // impact freeze: hold the last image
    if (gameOver) {
        gameOverTimer++;
        if (gameOverTimer > 150) { gameOverTimer = 0; openPause(true); return; }
    } else {
        gameOverTimer = 0;
    }
    var slow = 1;
    if (slowMoFrames > 0) { slowMoFrames--; slow = slowMoScale; }
    tickAccumulator += devOpts.timeScale * slow;
    var guard = 0;
    while (tickAccumulator >= 1 && guard < 4) {
        tickAccumulator -= 1;
        guard++;
        frame();
        framesThisSecond++;
    }
    if (tickAccumulator > 4) tickAccumulator = 0;
    var nowT = Date.now();
    if (nowT - lastSecondStamp >= 1000) {
        measuredFPS = framesThisSecond;
        framesThisSecond = 0;
        lastSecondStamp = nowT;
        // Automatically drop to 1x resolution if hi-DPI rendering is too slow on this machine
        if ((renderScale > 1 || (settings.glow && !glowAutoDisabled)) && measuredFPS < 45 && devOpts.timeScale >= 1 && slowMoFrames <= 0 && !paused) {
            if (++lowFpsSeconds >= 3) {
                if (!glowAutoDisabled && settings.glow) glowAutoDisabled = true;   // step 1: drop glows
                else { renderScaleAutoReduced = true; applyCanvasSize(); }           // step 2: drop resolution
                lowFpsSeconds = 0;
            }
        } else lowFpsSeconds = 0;
    }
}

// Fixed 60 Hz simulation driven by requestAnimationFrame (vsync-smooth, pauses in background tabs)
var loopLast = performance.now();
var loopAcc = 0;
function gameLoop(now) {
    loopAcc += Math.min(100, now - loopLast);
    loopLast = now;
    var steps = 0;
    while (loopAcc >= 1000 / fps && steps < 4) {
        loopAcc -= 1000 / fps;
        tick();
        steps++;
    }
    if (steps >= 4) loopAcc = 0;
    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

// Boot into the Arcade game-select screen
if (typeof Hub !== "undefined") Hub.openHub(true);
