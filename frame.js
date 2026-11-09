var staticObjects = [];
var movingObjects = [];
var characters = [];
var allObjects = [];

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

    // Always add the Infinite Subterranean Bedrock Base Floor ~2 screens down (top = -1600, bottom = -2400)
    // plus return Mega-Bounce Geysers so falling off any level lands on a playable deep floor!
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

    var currentLvl = (typeof LevelManager !== "undefined") ? LevelManager.getCurrentLevel() : null;
    if (currentLvl && currentLvl.layout) {
        Object.loadMap(currentLvl.layout);
    }
    if (currentLvl && currentLvl.isProcedural && typeof WorldGenerator !== "undefined") {
        WorldGenerator.reset();
        WorldGenerator.update(0);
    } else if (typeof BackgroundMosaic !== "undefined") {
        // Populate scenic non-colliding background trees across arena levels
        var treePositions = [-1280, -920, -520, -160, 200, 560, 920, 1280];
        for (let i = 0; i < treePositions.length; i++) {
            BackgroundMosaic.addBackgroundTree(treePositions[i] * STRUCT_SCALE, 40, (160 + (i % 3) * 25) * STRUCT_SCALE, (i % 2 === 0) ? "oak" : "pine", null, STRUCT_SCALE);
        }
    }
}


function createPlayers() {
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
    zombiesRemainingToSpawn = 4 + level * 2 + coopBonus;
    zombieSpawnTimer = 35;
    levelTransitionTimer = 110;

    if (lvl > 1) {
        var waveBonus = (lvl - 1) * 250;
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
            characters[i].health = Math.min(characters[i].maxHealth, characters[i].health + 30);
        }
    }
    lastStandTimer = -1;

    spawnPowerUp((Math.random() < 0.5 ? -620 : 620) * STRUCT_SCALE * 0.6, 280);
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
    return t[power] || t.NORMAL;
}

function pickEnemyType() {
    var roll = Math.random();
    if (roll < 0.16) return "SLIME";
    if (roll < 0.30) return "BAT";
    if (roll < 0.44) return "ARCHER";
    if (level >= 2 && roll < 0.58) return "KNIGHT";
    if (level >= 2 && roll < 0.70) return "MAGE";
    if (level >= 2 && roll < 0.80) return "LEAPER";
    if (level >= 3 && roll < 0.90) return "EXPLODER";
    if (level >= 3) return "TANK";
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
    var zHealth = Math.round(spec.hp * devOpts.enemyHealth * (multiplayer ? 1.25 : 1));
    var zBox = Math.makeHitbox(spec.size, spec.size);
    var z = new Character(
        "Enemy_" + power, zBox, zBox, spec.color, [spawnX, spawnY],
        maxspeed * 0.85, slower, gravity, bounciness, speed * spec.spd,
        "ZOMBIE", zHealth, "NONE", true, power
    );
    zombies.push(z);
    return z;
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
    if (sx > m && sx < canvas.width - m && sy > m && sy < canvas.height - m) return;
    var cx = canvas.width / 2, cy = canvas.height / 2;
    var ang = Math.atan2(sy - cy, sx - cx);
    var ex = Math.max(m, Math.min(canvas.width - m, sx));
    var ey = Math.max(m + 40, Math.min(canvas.height - m - 70, sy));
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
        var ly = ey + (ey < canvas.height / 2 ? 30 : -22);
        var lx = Math.max(70, Math.min(canvas.width - 70, ex));
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

        if (sx > -80 && sx < canvas.width + 80 && sy > -200 && sy < canvas.height + 80 && !blink) {
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
    score = 0;
    combo = 1;
    comboTimer = 0;
    screenShake = 0;
    gameOver = false;
    lastStandTimer = -1;
    helpTimer = devOpts.showHelp ? 60 * 12 : 0;
    createMap();
    createPlayers();
    startLevel(1);
    rebuildAllObjects();
    if (typeof Pathfinder !== "undefined") {
        Pathfinder.rebuildGraph(true);
    }
    if (typeof SummonManager !== "undefined" && SummonManager.isOpen) {
        SummonManager.selectObject(null);
        SummonManager.refreshObjectList();
    }
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
    for (let i = 0; i < characters.length; i++) if (!characters[i].dead) heroes.push(characters[i]);
    if (heroes.length === 0) heroes.push(redGuy);

    var focusX = 0, focusY = 0, wTotal = 0;
    for (let i = 0; i < heroes.length; i++) {
        var wgt = heroes[i].isZombie ? 0.45 : 1;
        focusX += heroes[i].x * wgt;
        focusY += heroes[i].y * wgt;
        wTotal += wgt;
    }
    focusX /= wTotal;
    focusY /= wTotal;

    // Dynamic zoom: zoom out to keep both heroes in frame
    var desired = baseZoom * userZoom;
    if (heroes.length > 1) {
        var ddx = Math.abs(heroes[0].x - heroes[1].x);
        var ddy = Math.abs(heroes[0].y - heroes[1].y);
        var fit = Math.min((canvas.width * 0.74) / (ddx + 520), (canvas.height * 0.62) / (ddy + 420));
        desired = Math.min(desired, Math.max(0.3, fit));
    }
    cameraScaleX += (desired - cameraScaleX) * 0.05;
    cameraScaleY = cameraScaleX;

    cameraTargetX += (focusX - cameraTargetX) * 0.14;
    cameraTargetY += (focusY - cameraTargetY) * 0.14;

    var shakeX = 0;
    var shakeY = 0;
    if (screenShake > 0) {
        shakeX = (Math.random() - 0.5) * screenShake * 2;
        shakeY = (Math.random() - 0.5) * screenShake * 2;
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

function uiPanel(x, y, pw, ph, accent, alpha) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(9, 14, 22, " + (alpha || 0.86) + ")";
    redGuy.roundRectPath(x, y, pw, ph, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = accent || "rgba(120, 170, 200, 0.45)";
    ctx.stroke();
    ctx.restore();
}

function uiBar(x, y, bw, bh, pct, color, bg) {
    pct = Math.max(0, Math.min(1, pct));
    ctx.save();
    ctx.fillStyle = bg || "rgba(255,255,255,0.10)";
    redGuy.roundRectPath(x, y, bw, bh, bh / 2);
    ctx.fill();
    if (pct > 0.001) {
        ctx.fillStyle = color;
        redGuy.roundRectPath(x, y, Math.max(bh, bw * pct), bh, bh / 2);
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

function drawHeroCard(ch, x, y) {
    var cw = 330, chh = 132;
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
    ch.drawSprite(ch.isZombie ? zombieImg : characterImg, x + 12, y + 12, 54, 54, 12, ch.isZombie ? "#7a5cff" : null);
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

        // active power chips
        var cx = x + 14, cy = y + 124;
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

    // ---------- Frontier banner ----------
    if (typeof LevelManager !== "undefined" && LevelManager.currentLevelKey === "infinite_frontier" && typeof WorldGenerator !== "undefined") {
        var totalWorldX = (redGuy ? redGuy.x : 0) + (typeof worldOriginOffsetX !== "undefined" ? worldOriginOffsetX : 0);
        var miles = Math.floor(Math.abs(totalWorldX) / 240);
        var dirLabel = (totalWorldX < -60) ? "WEST" : "EAST";
        var bx = 360, bw = Math.min(520, w - 360 - 700);
        uiPanel(bx, 14, Math.max(300, bw), 46, "#00f5d4");
        uiText(WorldGenerator.currentBiomeTitle.replace(/^\S+\s/, "") + "  ·  " + miles + " MI " + dirLabel, bx + Math.max(300, bw) / 2, 44, 14, "#ffd23f", "center", "800");
    }

    // ---------- Last stand banner ----------
    if (lastStandTimer >= 0 && !gameOver) {
        uiPanel(w / 2 - 250, 70, 500, 62, "#ff4d5e");
        uiText("LAST STAND - EARN A LIFE BACK!", w / 2, 96, 18, "#ff9aa5", "center", "900");
        uiBar(w / 2 - 220, 106, 440, 10, lastStandTimer / lastStandTimerMax, "#ff4d5e");
        uiText(Math.ceil(lastStandTimer / 60) + "s", w / 2 + 232, 116, 12, "#fff", "left", "800");
    }

    // ---------- Hero cards ----------
    var cardY = h - 148;
    drawHeroCard(redGuy, 14, cardY);
    if (multiplayer && blueGuy) drawHeroCard(blueGuy, w - 344, cardY);

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
            uiText("(mouse also aims & shoots for P1)", hx + 24, hy + 86, 11, "#8ba2b4", "left", "600");
            uiText("PLAYER 2", hx + 340, hy + 28, 14, "#6cb8ff", "left", "900");
            uiText("Arrows move/jump   Enter shoot   . jetpack", hx + 340, hy + 50, 12, "#dbe7f0", "left", "600");
            uiText("R-Shift dash   / shockwave / hold: revive   , grab", hx + 340, hy + 68, 12, "#dbe7f0", "left", "600");
        } else {
            uiText("WASD move/jump   Mouse aim + click or F shoot   Arrows: twin-stick fire", hx + 24, hy + 28, 12, "#dbe7f0", "left", "700");
            uiText("Space jetpack   L-Shift dash   E shockwave   R-click/G grab & throw", hx + 24, hy + 50, 12, "#dbe7f0", "left", "700");
            uiText("Press M for 2-player co-op", hx + 24, hy + 72, 12, "#ffd23f", "left", "800");
        }
        uiText("M co-op · H hide · V god mode · B dev mode · +/- zoom · 1-6 levels · R restart", hx + hw / 2, hy + 116, 11, "#8ba2b4", "center", "600");
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
        uiText("Press [R] to play again", w / 2, h / 2 + 78, 18, "#ffd23f", "center", "800");
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
    if (!wavesPaused) {
        if (zombiesRemainingToSpawn > 0) {
            zombieSpawnTimer--;
            if (zombieSpawnTimer <= 0 && zombies.length < devOpts.maxEnemies && !gameOver) {
                spawnZombie();
                zombiesRemainingToSpawn--;
                zombieSpawnTimer = Math.max(24, (100 - level * 8) / Math.max(0.1, devOpts.spawnRate));
            }
        } else if (zombies.length == 0 && !gameOver) {
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

    updateRevive();
    updateLastStand();

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

    // Draw Static Map Objects
    for (let i = 0; i < staticObjects.length; i++) {
        staticObjects[i].staticObject();
    }

    // Draw Stick Ninja Afterimages
    Components.updateAfterImages();

    // Draw Moving Physics Crates
    for (let i = 0; i < movingObjects.length; i++) {
        if (!movingObjects[i].dead) {
            Polygon.create(movingObjects[i].poly, movingObjects[i].color, movingObjects[i]);
            movingObjects[i].drawDecorations();
        }
    }

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
    Components.updateFloatingTexts();

    if (devOpts.showHitboxes) drawHitboxes();

    if (typeof Pathfinder !== "undefined") {
        Pathfinder.drawDebug();
    }
    if (typeof SummonManager !== "undefined") {
        SummonManager.drawOverlay();
    }

    drawHUD();
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
            if (sx > canvas.width || sy > canvas.height || sx + o.w * cameraScaleX < 0 || sy + o.h * cameraScaleY < 0) continue;
            ctx.strokeRect(sx, sy, o.w * cameraScaleX, o.h * cameraScaleY);
        }
    }
    ctx.restore();
}

// Fixed-rate loop with a time-scale accumulator (dev slow-mo / fast-forward) and FPS meter
var tickAccumulator = 0;
function tick() {
    tickAccumulator += devOpts.timeScale;
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
    }
}

setInterval(tick, 1000 / fps);
