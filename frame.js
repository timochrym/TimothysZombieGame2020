var staticObjects = [];
var movingObjects = [];
var characters = [];
var allObjects = [];

var redGuy = null;
var blueGuy = null;

function createMap() {
    staticObjects = [];
    movingObjects = [];

    // Main Floor & Arena Walls
    var floor = new Object("floor", Math.makeHitbox(3200, 1000), Math.makeHitbox(3200, 1000), "#16202a", [0, -450]);
    var leftWall = new Object("leftWall", Math.makeHitbox(120, 1800), Math.makeHitbox(120, 1800), "#16202a", [-1540, 400]);
    var rightWall = new Object("rightWall", Math.makeHitbox(120, 1800), Math.makeHitbox(120, 1800), "#16202a", [1540, 400]);

    // Multi-level Platforms
    var platLeftLow = new Object("platLeftLow", Math.makeHitbox(420, 36), Math.makeHitbox(420, 36), "#243b4a", [-580, 230]);
    var platRightLow = new Object("platRightLow", Math.makeHitbox(420, 36), Math.makeHitbox(420, 36), "#243b4a", [580, 230]);
    var platCenterMid = new Object("platCenterMid", Math.makeHitbox(500, 36), Math.makeHitbox(500, 36), "#2d4a5c", [0, 410]);
    var platLeftHigh = new Object("platLeftHigh", Math.makeHitbox(380, 36), Math.makeHitbox(380, 36), "#243b4a", [-960, 540]);
    var platRightHigh = new Object("platRightHigh", Math.makeHitbox(380, 36), Math.makeHitbox(380, 36), "#243b4a", [960, 540]);
    var platTopCenter = new Object("platTopCenter", Math.makeHitbox(360, 32), Math.makeHitbox(360, 32), "#375a70", [0, 690]);

    staticObjects.push(
        floor, leftWall, rightWall,
        platLeftLow, platRightLow, platCenterMid,
        platLeftHigh, platRightHigh, platTopCenter
    );

    // Movable Physics Crates (bounce & transfer momentum)
    var cratePositions = [
        [-250, 180],
        [250, 180],
        [-580, 340],
        [580, 340],
        [0, 520]
    ];
    for (let i = 0; i < cratePositions.length; i++) {
        var boxPoly = Math.makeHitbox(76, 76);
        var crate = new Object(
            "crate" + i,
            boxPoly,
            boxPoly,
            "#d9a05b",
            cratePositions[i],
            maxspeed,
            slower * 0.5,
            gravity,
            bounciness,
            true
        );
        movingObjects.push(crate);
    }
}

function createPlayers() {
    characters = [];
    var charBox = Math.makeHitbox(s1, s2);

    redGuy = new Character(
        "Player 1",
        charBox,
        charBox,
        "#FF2222",
        [-120, 200],
        maxspeed,
        slower,
        gravity,
        bounciness,
        speed,
        "WASD",
        100,
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
            [120, 200],
            maxspeed,
            slower,
            gravity,
            bounciness,
            speed,
            "ULDR",
            100,
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
    for (let i = 0; i < staticObjects.length; i++) allObjects.push(staticObjects[i]);
    for (let i = 0; i < movingObjects.length; i++) allObjects.push(movingObjects[i]);
    for (let i = 0; i < characters.length; i++) allObjects.push(characters[i]);
    for (let i = 0; i < zombies.length; i++) {
        if (!zombies[i].dead) allObjects.push(zombies[i]);
    }
}

function startLevel(lvl) {
    level = lvl;
    zombiesRemainingToSpawn = 3 + level * 2;
    zombieSpawnTimer = 40;
    levelTransitionTimer = 90;

    // Revive any infected player and heal survivors between levels
    for (let i = 0; i < characters.length; i++) {
        if (characters[i].isZombie) {
            characters[i].reviveAsHuman();
        } else {
            characters[i].health = Math.min(characters[i].maxHealth, characters[i].health + 30);
        }
    }

    // Spawn a bonus power-up on the center platform
    spawnPowerUp(0, 470);
}

function spawnZombie() {
    var spawnX = (Math.random() < 0.5 ? -1 : 1) * (700 + Math.random() * 650);
    var spawnY = 650;

    // Choose Zombie Power based on current Level
    var power = "NORMAL";
    var zColor = "#2d6e32";
    var zSize = 90;
    var zHealth = 50 + level * 10;
    var zSpeed = speed * (0.55 + Math.min(0.35, level * 0.04));

    var roll = Math.random();
    if (level >= 2 && roll < 0.25) {
        power = "LEAPER";
        zColor = "#7ec820";
        zSize = 80;
        zSpeed = speed * 0.85;
        zHealth = 45 + level * 8;
    } else if (level >= 3 && roll >= 0.25 && roll < 0.45) {
        power = "TANK";
        zColor = "#5e2b50";
        zSize = 130;
        zSpeed = speed * 0.42;
        zHealth = 140 + level * 25;
    } else if (level >= 3 && roll >= 0.45 && roll < 0.62) {
        power = "EXPLODER";
        zColor = "#d95b16";
        zSize = 85;
        zSpeed = speed * 0.72;
        zHealth = 40 + level * 6;
    } else if (level >= 4 && roll >= 0.62 && roll < 0.80) {
        power = "SPITTER";
        zColor = "#16b862";
        zSize = 92;
        zSpeed = speed * 0.55;
        zHealth = 65 + level * 10;
    }

    var zBox = Math.makeHitbox(zSize, zSize);
    var z = new Character(
        "Zombie_" + power,
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
        type: t,
        color: colors[t],
        hitbox: Math.makeHitbox(42, 42),
        poly: Math.makeHitbox(42, 42),
        bobPhase: Math.random() * Math.PI * 2,
        life: 900
    });
}

function updatePowerUps() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        var p = powerUps[i];
        p.life--;
        p.bobPhase += 0.08;
        var drawObj = {
            x: p.x,
            y: p.y + Math.sin(p.bobPhase) * 8
        };
        Polygon.create(p.poly, p.color, drawObj);

        // Label above power-up
        var sx = p.x * cameraScaleX + xc;
        var sy = (-drawObj.y - 30) * cameraScaleY + yc;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(p.type, sx, sy);

        var collected = false;
        for (let c = 0; c < characters.length; c++) {
            var ch = characters[c];
            if (!ch.isZombie && CollisionDetector.collision(p, [0, 0], [ch])) {
                ch.applyPowerUp(p.type);
                Components.spawnSparks(p.x, p.y, p.color, 10);
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
    zombies = [];
    score = 0;
    gameOver = false;
    createMap();
    createPlayers();
    startLevel(1);
    rebuildAllObjects();
}

function updateCamera() {
    var focusX = redGuy.x;
    var focusY = redGuy.y;

    if (multiplayer && blueGuy) {
        // Focus on living human if one player is a zombie, or midpoint of both
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

    cameraTargetX += (focusX - cameraTargetX) * 0.12;
    cameraTargetY += (focusY - cameraTargetY) * 0.12;

    xc = xcMaster - cameraTargetX * cameraScaleX;
    yc = ycMaster + (cameraTargetY + 120) * cameraScaleY;
}

function drawHUD() {
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(16, 16, 430, 106);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px monospace";
    var aliveZombies = zombies.length + zombiesRemainingToSpawn;
    ctx.fillText("LEVEL " + level + "   |   SCORE: " + score + "   |   ZOMBIES: " + aliveZombies, 28, 44);

    ctx.font = "14px monospace";
    ctx.fillStyle = "#b8e994";
    var p1Status = redGuy.isZombie ? "ZOMBIE (INFECTED!)" : (redGuy.powerType ? "POWER: " + redGuy.powerType : "HUMAN");
    var bombReady = redGuy.abilityCooldown == 0 ? "READY [E]" : Math.ceil(redGuy.abilityCooldown / 60) + "s";
    ctx.fillText("P1: " + p1Status + "  |  Blow Up Bomb: " + bombReady, 28, 70);

    ctx.fillStyle = "#dddddd";
    if (!multiplayer) {
        ctx.fillText("Move: WASD/Space | Lazer: Arrows/F | [M] 2-Player | [R] Reset", 28, 96);
    } else {
        ctx.fillText("P1: WASD + Space/E | P2: Arrows + Enter/Shift | [M] 1P | [R] Reset", 28, 96);
    }

    // Level Banner
    if (levelTransitionTimer > 0) {
        levelTransitionTimer--;
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffdd44";
        ctx.font = "bold 44px monospace";
        ctx.fillText("LEVEL " + level, w / 2, h / 3);
    }

    // Game Over Banner (Note: Death = Zombie lets you keep moving around as a Zombie!)
    if (gameOver) {
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(w / 2 - 270, h / 2 - 75, 540, 130);
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 36px monospace";
        ctx.fillText("INFECTED! (DEATH = ZOMBIE)", w / 2, h / 2 - 20);
        ctx.fillStyle = "#ffffff";
        ctx.font = "18px monospace";
        ctx.fillText("You turned into a Zombie! Press [R] to Restart Human Run", w / 2, h / 2 + 25);
    }
}

function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Spawn Zombies for the active level
    if (zombiesRemainingToSpawn > 0) {
        zombieSpawnTimer--;
        if (zombieSpawnTimer <= 0 && zombies.length < 10) {
            spawnZombie();
            zombiesRemainingToSpawn--;
            zombieSpawnTimer = Math.max(35, 110 - level * 8);
        }
    } else if (zombies.length == 0 && !gameOver) {
        startLevel(level + 1);
    }

    rebuildAllObjects();

    // Draw Static Map Objects
    for (let i = 0; i < staticObjects.length; i++) {
        staticObjects[i].staticObject();
    }

    // Update & Draw Moving Physics Crates
    for (let i = 0; i < movingObjects.length; i++) {
        movingObjects[i].movingObject();
    }

    // Update & Draw Collectible Power-Ups
    updatePowerUps();

    // Update & Draw Players
    for (let i = 0; i < characters.length; i++) {
        characters[i].animate();
    }

    // Update & Draw Zombies
    for (let i = zombies.length - 1; i >= 0; i--) {
        if (zombies[i].dead) {
            zombies.splice(i, 1);
        } else {
            zombies[i].animate();
        }
    }

    // Update & Draw Lazers & Explosion Particles
    Components.updateLazers();
    Components.updateParticles();

    // Update Camera & HUD
    updateCamera();
    drawHUD();
}

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

resetGame();
setInterval(frame, 1000 / fps);
