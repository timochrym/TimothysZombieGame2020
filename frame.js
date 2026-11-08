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
            BackgroundMosaic.addBackgroundTree(treePositions[i], 0, 160 + (i % 3) * 25, (i % 2 === 0) ? "oak" : "pine", null);
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

    redGuy = new Character(
        "Player 1",
        charBox,
        charBox,
        "#FF2222",
        [p1Pos[0], p1Pos[1]],
        maxspeed,
        slower,
        gravity,
        bounciness,
        speed * (1 + (heroLevel - 1) * 0.04),
        "WASD",
        baseHP,
        "ULDR",
        false,
        "NORMAL"
    );
    characters.push(redGuy);

    if (multiplayer) {
        blueGuy = new Character(
            "Player 2",
            charBox,
            charBox,
            "#2288FF",
            [p2Pos[0], p2Pos[1]],
            maxspeed,
            slower,
            gravity,
            bounciness,
            speed * (1 + (heroLevel - 1) * 0.04),
            "ULDR",
            baseHP,
            "ULDR",
            false,
            "NORMAL"
        );
        characters.push(blueGuy);
    } else {
        blueGuy = null;
    }
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
    zombiesRemainingToSpawn = 4 + level * 2;
    zombieSpawnTimer = 35;
    levelTransitionTimer = 95;

    if (lvl > 1) {
        var waveBonus = (lvl - 1) * 250;
        score += waveBonus;
        if (score > highScore) {
            highScore = score;
            try { localStorage.setItem("timsZombieGameHighScore", highScore.toString()); } catch (e) {}
        }
        if (redGuy) {
            Components.addFloatingText("WAVE CLEAR! +" + waveBonus, redGuy.x, redGuy.y + 90, "#55ff88", 24);
        }
    }

    for (let i = 0; i < characters.length; i++) {
        if (characters[i].isZombie) {
            characters[i].reviveAsHuman();
        } else {
            characters[i].health = Math.min(characters[i].maxHealth, characters[i].health + 30);
        }
    }

    spawnPowerUp((Math.random() < 0.5 ? -620 : 620), 280);
}

function spawnZombie() {
    var centerRef = (typeof cameraTargetX !== "undefined") ? cameraTargetX : 0;
    var spawnX = centerRef + (Math.random() < 0.5 ? -1 : 1) * (650 + Math.random() * 550);
    var spawnY = (typeof cameraTargetY !== "undefined" ? cameraTargetY : 0) + 520;

    var power = "NORMAL";
    var zColor = "#2d6e32";
    var zSize = 80;
    var zHealth = 48 + level * 10;
    var zSpeed = speed * (0.55 + Math.min(0.35, level * 0.04));

    var roll = Math.random();
    if (roll < 0.16) {
        power = "SLIME";
        zColor = "#00f5d4";
        zSize = 76;
        zSpeed = speed * 0.56;
        zHealth = 58 + level * 10;
    } else if (roll < 0.30) {
        power = "BAT";
        zColor = "#6c5ce7";
        zSize = 56;
        zSpeed = speed * 0.74;
        zHealth = 34 + level * 6;
    } else if (roll < 0.44) {
        power = "ARCHER";
        zColor = "#d4a373";
        zSize = 78;
        zSpeed = speed * 0.58;
        zHealth = 50 + level * 8;
    } else if (level >= 2 && roll < 0.58) {
        power = "KNIGHT";
        zColor = "#7f8c8d";
        zSize = 94;
        zSpeed = speed * 0.52;
        zHealth = 115 + level * 18;
    } else if (level >= 2 && roll < 0.70) {
        power = "MAGE";
        zColor = "#7209b7";
        zSize = 80;
        zSpeed = speed * 0.54;
        zHealth = 62 + level * 10;
    } else if (level >= 2 && roll < 0.80) {
        power = "LEAPER";
        zColor = "#7ec820";
        zSize = 74;
        zSpeed = speed * 0.86;
        zHealth = 42 + level * 8;
    } else if (level >= 3 && roll < 0.90) {
        power = "EXPLODER";
        zColor = "#d95b16";
        zSize = 78;
        zSpeed = speed * 0.74;
        zHealth = 38 + level * 6;
    } else if (level >= 3) {
        power = "TANK";
        zColor = "#5e2b50";
        zSize = 120;
        zSpeed = speed * 0.44;
        zHealth = 135 + level * 24;
    }

    var zBox = Math.makeHitbox(zSize, zSize);
    var z = new Character(
        "Enemy_" + power,
        zBox,
        zBox,
        zColor,
        [spawnX, spawnY],
        maxspeed * 0.85,
        slower,
        gravity,
        bounciness,
        zSpeed,
        "ZOMBIE",
        zHealth,
        "NONE",
        true,
        power
    );
    zombies.push(z);
}

function spawnPowerUp(x, y) {
    var types = ["RAPID", "SPEED", "HEAL", "BLOWUP"];
    var colors = {
        "RAPID": "#ffdd33",
        "SPEED": "#33ddff",
        "HEAL": "#33ff88",
        "BLOWUP": "#ff7722"
    };
    var t = types[Math.floor(Math.random() * types.length)];
    powerUps.push({
        x: x,
        y: y,
        w: 40,
        h: 40,
        type: t,
        color: colors[t],
        hitbox: Math.makeHitbox(40, 40),
        poly: Math.makeHitbox(40, 40),
        bobPhase: Math.random() * Math.PI * 2,
        life: 900
    });
}

function updatePowerUps() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        var p = powerUps[i];
        p.life--;
        p.bobPhase += 0.09;
        var drawObj = {
            x: p.x,
            y: p.y + Math.sin(p.bobPhase) * 8,
            texture: "question_gold"
        };
        Polygon.create(p.poly, p.color, drawObj);

        var sx = p.x * cameraScaleX + xc;
        var sy = (-drawObj.y - 28) * cameraScaleY + yc;
        ctx.fillStyle = "#fff";
        ctx.font = "bold " + Math.round(13 * cameraScaleX) + "px monospace";
        ctx.textAlign = "center";
        ctx.fillText(p.type, sx, sy);

        var collected = false;
        for (let c = 0; c < characters.length; c++) {
            var ch = characters[c];
            if (!ch.isZombie && CollisionDetector.collision(p, [0, 0], [ch])) {
                ch.applyPowerUp(p.type);
                Components.spawnSparks(p.x, p.y, p.color, 12);
                collected = true;
                break;
            }
        }
        if (collected || p.life <= 0) {
            powerUps.splice(i, 1);
        }
    }
}

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
    score = 0;
    combo = 1;
    comboTimer = 0;
    screenShake = 0;
    gameOver = false;
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

function updateCamera() {
    var focusX = redGuy.x;
    var focusY = redGuy.y;

    if (multiplayer && blueGuy) {
        if (!redGuy.isZombie && !blueGuy.isZombie) {
            focusX = (redGuy.x + blueGuy.x) / 2;
            focusY = (redGuy.y + blueGuy.y) / 2;
        } else if (!redGuy.isZombie) {
            focusX = redGuy.x;
            focusY = redGuy.y;
        } else if (!blueGuy.isZombie) {
            focusX = blueGuy.x;
            focusY = blueGuy.y;
        } else {
            focusX = (redGuy.x + blueGuy.x) / 2;
            focusY = (redGuy.y + blueGuy.y) / 2;
        }
    }

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
    if (!useMouseAim) return;
    ctx.save();
    var isHolding = (redGuy && redGuy.heldObject);
    ctx.strokeStyle = godMode ? "#ffdd00" : (isHolding ? "#00f5d4" : (mouseDown ? "#ffdd44" : "rgba(255, 255, 255, 0.85)"));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 10, 0, Math.PI * 2);
    ctx.moveTo(mouseX - 15, mouseY);
    ctx.lineTo(mouseX - 5, mouseY);
    ctx.moveTo(mouseX + 5, mouseY);
    ctx.lineTo(mouseX + 15, mouseY);
    ctx.moveTo(mouseX, mouseY - 15);
    ctx.lineTo(mouseX, mouseY - 5);
    ctx.moveTo(mouseX, mouseY + 5);
    ctx.lineTo(mouseX, mouseY + 15);
    ctx.stroke();
    ctx.restore();
}

function drawHUD() {
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(10, 16, 22, 0.80)";
    ctx.fillRect(14, 14, 650, 126);
    ctx.strokeStyle = godMode ? "#ffdd00" : "#335c67";
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, 650, 126);

    ctx.fillStyle = "#ffdd44";
    ctx.font = "bold 19px monospace";
    var aliveZombies = zombies.length + zombiesRemainingToSpawn;
    var godBadge = godMode ? " [⚡GOD MODE]" : "";
    ctx.fillText("WAVE " + level + " | SCORE: " + score + " | HI: " + highScore + godBadge, 26, 40);

    // RPG Hero Level, XP Bar & Coins
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#00f5d4";
    var grabStatus = (redGuy && redGuy.heldObject) ? "HOLDING: " + redGuy.heldObject.name : "R-Click/[G]: Grab";
    ctx.fillText("HERO LVL " + heroLevel + " (XP " + heroXP + "/" + heroXPNext + ") | 🪙 COINS: " + coins + " | COMBO: " + combo + "x | " + grabStatus, 26, 65);

    // XP Bar + Combo Bar
    ctx.fillStyle = "#1d3557";
    ctx.fillRect(26, 73, 240, 6);
    ctx.fillStyle = "#00f5d4";
    ctx.fillRect(26, 73, 240 * Math.min(1, heroXP / heroXPNext), 6);

    if (comboTimer > 0) {
        ctx.fillStyle = "#ff9933";
        ctx.fillRect(280, 73, 180 * (comboTimer / comboTimerMax), 6);
    }

    ctx.font = "12px monospace";
    ctx.fillStyle = "#a8dadc";
    ctx.fillText("WASD: Move/Double-Jump/Fast-Fall | Space: Jetpack | Shift: Dash/Wavedash | E: Shockwave", 26, 98);
    ctx.fillStyle = "#d8e2dc";
    ctx.fillText("L-Click: Shoot | R-Click/G: Grab & Throw | [V] God Mode | [1-6] Levels | [B] Editor", 26, 118);

    // Oregon Trail Infinite Frontier Biome & Miles Banner
    if (typeof LevelManager !== "undefined" && LevelManager.currentLevelKey === "infinite_frontier" && typeof WorldGenerator !== "undefined") {
        var totalWorldX = (redGuy ? redGuy.x : 0) + (typeof worldOriginOffsetX !== "undefined" ? worldOriginOffsetX : 0);
        var miles = Math.floor(Math.abs(totalWorldX) / 120);
        var dirLabel = (totalWorldX < -60) ? "WEST" : "EAST";
        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(10, 16, 22, 0.85)";
        ctx.fillRect(w / 2 - 230, 14, 460, 44);
        ctx.strokeStyle = "#00f5d4";
        ctx.lineWidth = 2;
        ctx.strokeRect(w / 2 - 230, 14, 460, 44);
        ctx.fillStyle = "#ffdd44";
        ctx.font = "bold 15px monospace";
        ctx.fillText(WorldGenerator.currentBiomeTitle + "  |  ⛺ " + miles + " MI " + dirLabel, w / 2, 41);
        ctx.restore();
    }

    if (levelTransitionTimer > 0) {
        levelTransitionTimer--;
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffdd44";
        ctx.font = "bold 44px monospace";
        var lvlTitle = (typeof LevelManager !== "undefined") ? LevelManager.getCurrentLevel().name : ("WAVE " + level);
        ctx.fillText(lvlTitle + " - WAVE " + level, w / 2, h / 3);
    }

    if (gameOver) {
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(w / 2 - 280, h / 2 - 75, 560, 135);
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 36px monospace";
        ctx.fillText("INFECTED! (DEATH = ZOMBIE)", w / 2, h / 2 - 20);
        ctx.fillStyle = "#ffffff";
        ctx.font = "18px monospace";
        ctx.fillText("Final Score: " + score + "  |  Press [R] to Play Again", w / 2, h / 2 + 25);
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
            if (zombieSpawnTimer <= 0 && zombies.length < 11) {
                spawnZombie();
                zombiesRemainingToSpawn--;
                zombieSpawnTimer = Math.max(30, 100 - level * 8);
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
    Components.updateFloatingTexts();

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

setInterval(frame, 1000 / fps);
