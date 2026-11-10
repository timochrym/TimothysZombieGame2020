// ============================================================================
// GAME: STOMP SQUAD  (platform)  -  side-scrolling co-op platformer
//   Run, jump, stomp. ? blocks hide coins, a Power Seed (grow big: survive one hit),
//   an Ember Orb (shoot fireballs) or a Star (invincible, touch to defeat).
//   Big heroes smash bricks. 100 coins = extra life. Chain stomps for big points.
//   Co-op: a fallen partner floats in a bubble until the other player touches it.
//   Enemies: Shambler (walks), Blob (hops), Flapper (flies), Spikehelm (can't be stomped),
//   Brute (takes 3 stomps).
// ============================================================================
var PLAT_LEVELS = [];
var platSave = { unlocked: 1, best: {} };
try { var _ps = JSON.parse(localStorage.getItem("timsStompSquad") || "null"); if (_ps) { for (var _pk in _ps) platSave[_pk] = _ps[_pk]; } } catch (e) {}
function savePlat() { try { localStorage.setItem("timsStompSquad", JSON.stringify(platSave)); } catch (e) {} }

var Plat = {
    lives: 5, coins: 0, score: 0, time: 300, tick: 0,
    phase: "play", phaseT: 0,
    items: [],
    cp: null,                 // { key, x, y } checkpoint reached in the current course
    sizes: {},                // playerIndex -> 0 small / 1 big / 2 fire (carried to the next course)
    newGame: function() { this.lives = 5; this.coins = 0; this.score = 0; this.cp = null; this.sizes = {}; },
    heroes: function() { return characters.filter(function(c) { return c.isPlayer && !c.dead; }); }
};
var PLAT_ENEMY = {
    walker: { power: "NORMAL", name: "Shambler", spd: 6 },
    hopper: { power: "SLIME", name: "Blob", spd: 7 },
    flyer:  { power: "BAT", name: "Flapper", spd: 7 },
    spiky:  { power: "KNIGHT", name: "Spikehelm", spd: 5 },
    tank:   { power: "TANK", name: "Brute", spd: 4.5 }
};
var PLAT_CHAIN = [100, 200, 400, 800, 1000, 2000, 4000, 8000];

// ---------------------------------------------------------------- level kit (ground top = y 0, blocks are 80px)
var PK = {
    theme: { ground: "#7f4f24", groundTex: "grass_dirt", block: "#9e3b24", blockTex: "brick", pipe: "#16a34a" },
    ground: function(x0, x1, top) { top = top || 0; return { type: "box", name: "Ground", x: (x0 + x1) / 2, y: (top - 1600) / 2, w: x1 - x0, h: top + 1600, color: PK.theme.ground, texture: PK.theme.groundTex, kind: "block" }; },
    pipe: function(x, h) { return { type: "box", name: "Pipe", x: x, y: h / 2, w: 120, h: h, color: PK.theme.pipe, texture: "pipe_green", kind: "block" }; },
    solid: function(x0, x1, top, h) { h = h || 80; return { type: "box", name: "Block", x: (x0 + x1) / 2, y: top - h / 2, w: x1 - x0, h: h, color: PK.theme.block, texture: PK.theme.blockTex, kind: "block" }; },
    plat: function(x0, x1, top) { return { type: "box", name: "Platform", x: (x0 + x1) / 2, y: top - 15, w: x1 - x0, h: 30, color: "#8b6b4a", texture: "dojo_wood", kind: "platform" }; },
    // staircase of solid columns starting at x0; dir 1 = climbs to the right, -1 = descends
    stairs: function(x0, steps, dir, base) {
        base = base || 0;
        var out = [];
        for (let i = 0; i < steps; i++) {
            var hgt = (dir > 0 ? i + 1 : steps - i) * 80;
            out.push({ type: "box", name: "Stair Block", x: x0 + i * 80 + 40, y: base + hgt / 2, w: 80, h: hgt, color: "#6b4f3a", texture: "castle_stone", kind: "block" });
        }
        return out;
    },
    q: function(x, y, item) { return { type: "qblock", x: x, y: y, item: item || "coin" }; },
    br: function(x, y, item) { return { type: "brick", x: x, y: y, item: item }; },
    coins: function(x0, y, n, gap) { var o = []; for (let i = 0; i < n; i++) o.push({ type: "coin", x: x0 + i * (gap || 70), y: y }); return o; },
    arc: function(x0, y, n) { var o = []; for (let i = 0; i < n; i++) o.push({ type: "coin", x: x0 + i * 70, y: y + Math.sin(i / (n - 1) * Math.PI) * 140 }); return o; }
};

function platCourse(n, title, theme, spawn, left, right, layout, gadgets, enemies, time) {
    var key = "plat_" + n;
    var items = ModeKit.room(left, right, 3000, { tex: "brick", color: "#1e293b", noFloor: true }).concat(layout);
    ModeKit.addLevel(key, { name: "🍄 Stomp Squad " + (n + 1) + ": " + title, mode: "platform", wavesEnabled: false,
        spawnP1: spawn, spawnP2: [spawn[0] - 90, spawn[1]], layout: items, gadgets: gadgets, enemies: enemies, title: title, theme: theme, time: time || 300 });
    PLAT_LEVELS[n] = key;
}

// ---------------------------------------------------------------- Course 1: Meadow Dash
(function() {
    PK.theme = { ground: "#7f4f24", groundTex: "grass_dirt", block: "#9e3b24", blockTex: "brick", pipe: "#16a34a" };
    var L = [], G = [], E = [];
    var add = function(a) { if (Array.isArray(a)) L.push.apply(L, a); else L.push(a); };
    var gad = function(a) { if (Array.isArray(a)) G.push.apply(G, a); else G.push(a); };
    add(PK.ground(-500, 1900));
    gad({ type: "sign", x: 120, y: 0, text: "A/D run · W jump (hold for height)\nHit ? blocks from below · stomp enemies!" });
    gad([PK.q(480, 280), PK.br(640, 280), PK.q(720, 280, "power"), PK.br(800, 280), PK.q(880, 280)]);
    gad(PK.q(720, 600, "coins5"));
    add(PK.pipe(1200, 160));
    add(PK.pipe(1560, 240));
    E.push({ t: "walker", x: 1000 }, { t: "walker", x: 1380 }, { t: "walker", x: 1440 });
    // first gap, coin arc over it
    gad(PK.arc(1900, 120, 5));
    add(PK.ground(2160, 3700));
    gad([PK.br(2480, 280), PK.br(2560, 280, "coins5"), PK.br(2640, 280), PK.br(2720, 280)]);
    gad([PK.br(2560, 600), PK.q(2640, 600, "life"), PK.br(2720, 600)]);
    E.push({ t: "hopper", x: 2900 }, { t: "walker", x: 3100 }, { t: "flyer", x: 3300, y: 320 });
    gad({ type: "checkpoint", x: 2400, y: 0 });
    gad(PK.q(3400, 280, "star"));
    E.push({ t: "spiky", x: 3550 });
    add(PK.ground(3900, 6200));
    E.push({ t: "walker", x: 4200 }, { t: "tank", x: 4500 });
    add(PK.stairs(4800, 4, 1));
    add(PK.stairs(5200, 4, -1));
    gad(PK.coins(4900, 420, 4));
    add(PK.stairs(5600, 6, 1));
    add(PK.solid(6080, 6160, 480, 480));
    gad({ type: "goalpole", x: 6000 + 360, y: 0, h: 680 });
    add(PK.ground(6200, 6900));
    platCourse(0, "Meadow Dash", "meadow", [-200, 60], -560, 6900, L, G, E, 300);
})();

// ---------------------------------------------------------------- Course 2: Cavern Crawl
(function() {
    PK.theme = { ground: "#3b4454", groundTex: "castle_stone", block: "#6b4f3a", blockTex: "brick", pipe: "#0e7490" };
    var L = [], G = [], E = [];
    var add = function(a) { if (Array.isArray(a)) L.push.apply(L, a); else L.push(a); };
    var gad = function(a) { if (Array.isArray(a)) G.push.apply(G, a); else G.push(a); };
    add(PK.ground(-500, 1500));
    add(PK.solid(-500, 7600, 1480, 200));        // cave ceiling
    gad([PK.q(400, 280, "power"), PK.br(480, 280), PK.br(560, 280, "coins5"), PK.br(640, 280)]);
    for (let x = 720; x <= 1280; x += 80) gad(PK.br(x, 600));
    E.push({ t: "walker", x: 800 }, { t: "spiky", x: 1200 });
    // spike pit with a moving platform
    add(PK.ground(1500, 1700, 0));
    gad({ type: "spikes", x: 2050, y: -200, w: 700 });
    add(PK.solid(1700, 2400, -200, 80));
    gad({ type: "mover", x: 1900, y: 160, w: 240, h: 40, x2: 2250, y2: 160, speed: 3 });
    add(PK.ground(2400, 4200));
    gad({ type: "checkpoint", x: 2600, y: 0 });
    add(PK.pipe(3000, 240));
    E.push({ t: "hopper", x: 2800 }, { t: "hopper", x: 3300 }, { t: "walker", x: 3600 }, { t: "walker", x: 3700 });
    gad([PK.q(3400, 280, "power"), PK.q(3480, 280), PK.q(3560, 280, "coins5")]);
    gad(PK.coins(3300, 700, 6));
    add(PK.plat(3260, 3700, 640));
    add(PK.ground(4400, 6600));
    gad(PK.arc(4200, 80, 4));
    E.push({ t: "spiky", x: 4700 }, { t: "tank", x: 5100 }, { t: "flyer", x: 5400, y: 360 });
    gad([PK.br(4800, 280), PK.q(4880, 280, "star"), PK.br(4960, 280)]);
    add(PK.stairs(5700, 5, 1));
    gad({ type: "goalpole", x: 6300, y: 0, h: 640 });
    platCourse(1, "Cavern Crawl", "cave", [-200, 60], -560, 6600, L, G, E, 300);
})();

// ---------------------------------------------------------------- Course 3: Sky Bridges
(function() {
    PK.theme = { ground: "#5d8a3a", groundTex: "grass_dirt", block: "#9e3b24", blockTex: "brick", pipe: "#16a34a" };
    var L = [], G = [], E = [];
    var add = function(a) { if (Array.isArray(a)) L.push.apply(L, a); else L.push(a); };
    var gad = function(a) { if (Array.isArray(a)) G.push.apply(G, a); else G.push(a); };
    add(PK.ground(-500, 700));
    gad({ type: "sign", x: 200, y: 0, text: "Mind the gaps!\nCo-op: touch your partner's bubble to bring them back." });
    // floating islands
    add(PK.solid(900, 1300, 120, 120));
    add(PK.solid(1500, 1820, 240, 120));
    E.push({ t: "walker", x: 1700, y: 240 });
    gad({ type: "mover", x: 2050, y: 200, w: 240, h: 40, x2: 2050, y2: 520, speed: 2.5 });
    add(PK.solid(2300, 2900, 520, 120));
    gad([PK.q(2500, 800, "power"), PK.br(2580, 800), PK.q(2660, 800, "coins5")]);
    E.push({ t: "hopper", x: 2700, y: 520 });
    gad(PK.arc(2950, 520, 5));
    add(PK.solid(3300, 4300, 300, 120));
    gad({ type: "checkpoint", x: 3400, y: 300 });
    E.push({ t: "flyer", x: 3700, y: 640 }, { t: "flyer", x: 4000, y: 560 }, { t: "spiky", x: 4100, y: 300 });
    gad({ type: "mover", x: 4500, y: 300, w: 220, h: 40, x2: 5000, y2: 300, speed: 3.5 });
    add(PK.solid(5200, 5600, 300, 120));
    gad(PK.q(5400, 580, "star"));
    add(PK.solid(5800, 6200, 160, 120));
    E.push({ t: "flyer", x: 5700, y: 400 });
    add(PK.ground(6400, 7800));
    E.push({ t: "tank", x: 6800 }, { t: "walker", x: 7000 });
    add(PK.stairs(7000, 6, 1));
    gad({ type: "goalpole", x: 7680, y: 0, h: 700 });
    platCourse(2, "Sky Bridges", "sky", [-200, 60], -560, 7900, L, G, E, 300);
})();

// ---------------------------------------------------------------- helpers
function platSetSize(ch, size) {
    var old = ch.platSize;
    ch.platSize = size;
    var dim = size > 0 ? s1 : Math.round(s1 * 0.72);
    var oldH = ch.s2 || s2;
    ch.s1 = ch.s2 = ch.w = ch.h = dim;
    ch.hitbox = Math.makeHitbox(dim, dim);
    ch.sizeScale = dim / s1;
    ch.y += (dim - oldH) / 2;
    if (ch.platBaseColor === undefined) ch.platBaseColor = ch.color;
    ch.color = size === 2 ? "#fb923c" : ch.platBaseColor;
    if (old !== undefined && size > old) { ch.scaleX = 0.7; ch.scaleY = 1.35; }
}

function platAddScore(n, x, y, col) {
    Plat.score += n;
    if (x !== undefined) Components.addFloatingText(String(n), x, y, col || "#fef3c7", 18);
}

function platAddLife(x, y) {
    Plat.lives++;
    if (x !== undefined) Components.addFloatingText("1UP!", x, y, "#4ade80", 24);
    if (typeof SFX !== "undefined") SFX.play("levelup", x, y, 0.8, 1.3);
}

function platAddCoin(x, y) {
    Plat.coins++;
    Plat.score += 50;
    if (typeof SFX !== "undefined") SFX.play("coin", x, y);
    if (Plat.coins >= 100) { Plat.coins -= 100; platAddLife(x, y + 40); }
}

function platKillFoe(foe, by, score) {
    if (foe.dead) return;
    if (typeof Ragdolls !== "undefined" && Ragdolls.spawnFrom) {
        var rd = Ragdolls.spawnFrom(foe, { corpse: true, life: 120, vx: (foe.x >= (by ? by.x : foe.x) ? 5 : -5), vy: 10 });
        if (rd && rd.style) rd.style.dead = true;
    }
    foe.dead = true;
    Components.spawnSparks(foe.x, foe.y, "#fef08a", 8);
    if (score) platAddScore(score, foe.x, foe.y + 70);
}

function platHurt(ch) {
    if (ch.platBubble || ch.platStar > 0 || ch.invulnTimer > 0 || Plat.phase !== "play") return;
    if (ch.platSize > 0) {
        platSetSize(ch, 0);
        ch.invulnTimer = 110;
        Components.addFloatingText("OUCH!", ch.x, ch.y + 70, "#fca5a5", 18);
        if (typeof SFX !== "undefined") SFX.play("hurt", ch.x, ch.y);
    } else platDie(ch);
}

function platDie(ch) {
    if (Plat.phase !== "play" || ch.platBubble || ch.dead) return;
    if (typeof SFX !== "undefined") SFX.play("hurt", ch.x, ch.y, 1, 0.7);
    Plat.sizes[ch.playerIndex] = 0;
    var others = Plat.heroes().filter(function(c) { return c !== ch && !c.platBubble; });
    if (others.length) {
        // co-op: float in a bubble until a partner pops it
        ch.platBubble = true;
        ch.noCollide = true;
        platSetSize(ch, 0);
        ch.invulnTimer = 9999;
        ch.x = others[0].x; ch.y = Math.max(ch.y, others[0].y + 220);
        Components.addFloatingText(ch.playerLabel + " — touch the bubble!", ch.x, ch.y + 90, "#7dd3fc", 18);
        return;
    }
    platAllDown(ch);
}

// nobody is left standing: lose a life and replay from the checkpoint (or game over)
function platAllDown(ch) {
    if (Plat.phase !== "play") return;
    if (typeof Ragdolls !== "undefined" && Ragdolls.spawnFrom && ch.y > -900) {
        var rd = Ragdolls.spawnFrom(ch, { corpse: true, life: 200, vx: 0, vy: 14 });
        if (rd && rd.style) rd.style.dead = true;
    }
    for (let i = 0; i < characters.length; i++) if (characters[i].isPlayer) characters[i].dead = true;
    Plat.lives--;
    Plat.phase = Plat.lives > 0 ? "dead" : "over";
    Plat.phaseT = 150;
    showBanner(Plat.lives > 0 ? "TOO BAD!" : "GAME OVER", Plat.lives > 0 ? ("Lives left: " + Plat.lives) : "Press Esc for the menu", Plat.lives > 0 ? "#fca5a5" : "#f87171");
}

function platPopBubble(ch) {
    ch.platBubble = false;
    ch.noCollide = false;
    ch.invulnTimer = 90;
    ch.yspeed = 9;
    Components.spawnSparks(ch.x, ch.y, "#bae6fd", 12);
    if (typeof SFX !== "undefined") SFX.play("pop", ch.x, ch.y);
}

function platSpawnItem(kind, g) {
    Plat.items.push({ kind: kind, x: g.x, y: g.baseY + g.h / 2 - 30, vx: 0, vy: 0, emerge: 30, dir: 1, life: 1800 });
}

// simple AABB physics for pickups (lands on solid tops and one-way platforms, turns at walls)
function platItemPhysics(it) {
    var hw = 26, hh = 26;
    var hit = function(x, y) {
        var list = StaticGrid.query(x - hw, y - hh, x + hw, y + hh, false, platItemPhysics.buf || (platItemPhysics.buf = []));
        for (let i = 0; i < list.length; i++) {
            var s = list[i];
            if (s.dead || s.noCollide || s.isRamp) continue;
            if (Math.abs(x - s.x) < hw + s.w / 2 && Math.abs(y - s.y) < hh + s.h / 2) return s;
        }
        return null;
    };
    it.x += it.vx;
    var sx = hit(it.x, it.y);
    if (sx && !CollisionDetector.isSemiSolidPlatform(sx)) { it.x -= it.vx; it.vx = -it.vx; it.dir = -it.dir; }
    it.vy = Math.max(-14, it.vy - 0.7);
    var oy = it.y;
    it.y += it.vy;
    var sy = hit(it.x, it.y);
    if (sy) {
        var top = sy.y + sy.h / 2;
        if (it.vy < 0 && oy - hh >= top - 2) { it.y = top + hh; it.vy = it.kind === "star" ? 13 : 0; it.grounded = true; }
        else if (!CollisionDetector.isSemiSolidPlatform(sy)) { it.y = oy; it.vy = it.vy > 0 ? 0 : it.vy; }
    }
}

// ---------------------------------------------------------------- the mode
GameModes.register({
    id: "platform",
    title: "STOMP SQUAD",
    tagline: "Co-op platformer. Stomp, smash bricks, grab power-ups, reach the flagpole.",
    color: "#f59e0b",
    firstLevel: function() { return PLAT_LEVELS[0]; },
    flags: { waves: false, revive: false, jetpack: false, shooting: true, ability: false, ammo: false, noBedrock: true, scenery: true,
        coopToggle: true, dash: false, wallJump: true, airJumps: 0, enemiesPassive: true, playerControl: true },
    overTitle: "GAME OVER",
    againLabel: "Play again",

    onActivate: function() { Plat.newGame(); jetpackEnabled = false; },

    setupLevel: function(lvl) {
        Gadgets.load(lvl.gadgets);
        Plat.items = [];
        Plat.time = lvl.time || 300;
        Plat.tick = 0;
        Plat.phase = "play";
        Plat.phaseT = 0;
        if (!Plat.cp || Plat.cp.key !== LevelManager.currentLevelKey) Plat.cp = null;
        else for (let i = 0; i < Gadgets.list.length; i++) if (Gadgets.list[i].type === "checkpoint" && Gadgets.list[i].x === Plat.cp.x) Gadgets.list[i].active = true;
        this.overTitle = "GAME OVER";
    },

    createPlayers: function() {
        var lvl = LevelManager.getCurrentLevel();
        var sp = Plat.cp ? [Plat.cp.x, Plat.cp.y] : lvl.spawnP1;
        var a = ModeKit.makeHero(0, sp[0], sp[1] + 40);
        platSetSize(a, Plat.sizes[0] || 0);
        if (multiplayer) { var b = ModeKit.makeHero(1, sp[0] - 90, sp[1] + 40); platSetSize(b, Plat.sizes[1] || 0); }
        else blueGuy = null;
        if (Plat.cp) for (let i = 0; i < characters.length; i++) { characters[i].respawnX = Plat.cp.x; characters[i].respawnY = Plat.cp.y; }
    },

    onReset: function() {
        var lvl = LevelManager.getCurrentLevel();
        var list = lvl.enemies || [];
        for (let i = 0; i < list.length; i++) {
            var e = list[i], spec = PLAT_ENEMY[e.t] || PLAT_ENEMY.walker;
            var z = spawnZombie(spec.power, e.x, (e.y || 0) + 70);
            z.platKind = e.t;
            z.hunter = false;
            z.health = z.maxHealth = 1;
            z.maxspeed = spec.spd;
            z.platHomeX = e.x; z.platHomeY = (e.y || 0) + 70;
            z.platDir = -1;
            z.platHits = e.t === "tank" ? 3 : 1;
            z.playerLabel = spec.name;
            if (e.t === "flyer") z.flies = true;
        }
    },

    // ---- enemies: simple patrols (turn at walls and ledges), hoppers hop, flappers bob
    enemyAI: function(z) {
        if (!z.platKind) return false;
        if (Plat.phase !== "play") return true;
        if (!z.platAwake) {
            for (let i = 0; i < characters.length; i++) if (Math.abs(characters[i].x - z.x) < 1500) z.platAwake = true;
            if (!z.platAwake) return true;
        }
        var k = z.platKind;
        if (k === "flyer") {
            z.flies = true;
            z.platT = (z.platT || 0) + 1;
            var tx = z.platHomeX + Math.sin(z.platT * 0.012 + z.id) * 260, ty = z.platHomeY + Math.sin(z.platT * 0.04 + z.id) * 110;
            if (tx > z.x + 10) z.rightPressed = true; else if (tx < z.x - 10) z.leftPressed = true;
            if (ty > z.y + 10) z.upPressed = true; else if (ty < z.y - 10) z.downPressed = true;
            return true;
        }
        if (z.onGround) {
            var blocked = CollisionDetector.collision(z, [z.platDir * 8, 0], staticObjects) && !z.collidedRamp;
            var footY = z.y - z.s2 / 2;
            var ledge = k !== "hopper" && typeof Pathfinder !== "undefined" && !Pathfinder.groundBelow(z.x + z.platDir * (z.s1 / 2 + 12), footY, 70);
            if (blocked || ledge) z.platDir = -z.platDir;
            // bump into another enemy -> both turn
            for (let i = 0; i < zombies.length; i++) {
                var o = zombies[i];
                if (o !== z && !o.dead && o.platKind && o.platKind !== "flyer" && Math.abs(o.x - z.x) < (o.s1 + z.s1) / 2 + 2 && Math.abs(o.y - z.y) < 60 && (o.x - z.x) * z.platDir > 0) { z.platDir = -z.platDir; break; }
            }
        }
        if (z.platDir > 0) z.rightPressed = true; else z.leftPressed = true;
        if (k === "hopper" && z.onGround && (z.platHop = (z.platHop || 0) + 1) > 55) { z.platHop = 0; z.upPressed = true; }
        return true;
    },

    onStomp: function(hero, foe) {
        if (hero.platBubble) return true;
        if (!foe.platKind) return false;
        if (hero.platStar > 0) { platKillFoe(foe, hero, 200); return true; }
        if (foe.platKind === "spiky") { platHurt(hero); hero.yspeed = 7; return true; }
        hero.yspeed = hero.upPressed ? 13 : 8.5;
        hero.jump = false; hero.onGround = false; hero.coyoteTimer = 0;
        hero.scaleX = 0.86; hero.scaleY = 1.16;
        if (typeof SFX !== "undefined") SFX.play("boing", hero.x, hero.y, 0.9, 1.3 + (hero.platChain || 0) * 0.08);
        var n = hero.platChain = (hero.platChain || 0) + 1;
        var pts = n > PLAT_CHAIN.length ? 0 : PLAT_CHAIN[n - 1];
        if (foe.platKind === "tank" && --foe.platHits > 0) {
            foe.scaleX = 1.4; foe.scaleY = 0.6; foe.hitFlashTimer = 8;
            foe.platDir = hero.x < foe.x ? 1 : -1;
            Components.addFloatingText(foe.platHits + " MORE!", foe.x, foe.y + 90, "#fca5a5", 18);
            return true;
        }
        if (pts) platKillFoe(foe, hero, pts); else { platKillFoe(foe, hero, 0); platAddLife(foe.x, foe.y + 80); }
        return true;
    },

    onContact: function(hero, foe) {
        if (hero.platBubble) return true;
        if (hero.platStar > 0 && foe.platKind) { platKillFoe(foe, hero, 200); return true; }
        return false;
    },

    onDamage: function(ch, amount) {
        if (amount >= 0) return false;
        platHurt(ch);
        return true;
    },

    onEnemyDamage: function(foe, amount, kx, ky, attacker) {
        if (!foe.platKind) return false;
        if (amount >= 0) return true;
        if (foe.platKind === "tank" && amount > -500 && --foe.platHits > 0) { foe.hitFlashTimer = 8; return true; }
        platKillFoe(foe, attacker, 200);
        return true;
    },

    onHazard: function(ch, g) { platHurt(ch); ch.yspeed = 12; ch.onGround = false; return true; },

    canShoot: function(ch) { return ch.platSize === 2 && !ch.platBubble; },
    canBreak: function(ch) { return ch.platSize > 0; },

    onBlockHit: function(ch, g) {
        var it = g.item || "coin";
        if (it === "coin" || it === "coins5") { platAddCoin(g.x, g.y); Gadgets.popCoin(g); return true; }
        if (it === "power") { platSpawnItem(ch.platSize > 0 ? "fire" : "grow", g); }
        else platSpawnItem(it, g);
        if (typeof SFX !== "undefined") SFX.play("select", g.x, g.y);
        return true;
    },

    onCoin: function(ch, g) { platAddCoin(g.x, g.y); return true; },
    onBrickBreak: function(ch, g) { platAddScore(50); },

    onGoal: function(ch, g, frac) {
        var steps = [100, 400, 800, 2000, 5000];
        if (frac > 0.95) platAddLife(ch.x, ch.y + 120);
        else platAddScore(steps[Math.min(4, Math.floor(frac * 5))], ch.x, ch.y + 120, "#fde047");
    },

    onExit: function(ch, g) {
        if (Plat.phase !== "play") return;
        Plat.phase = "clear";
        Plat.phaseT = 230;
        var bonus = Plat.time * 10;
        Plat.score += bonus;
        for (let i = 0; i < characters.length; i++) { var c = characters[i]; if (c.isPlayer) { Plat.sizes[c.playerIndex] = c.platSize || 0; if (c.platBubble) platPopBubble(c); } }
        var n = PLAT_LEVELS.indexOf(LevelManager.currentLevelKey);
        platSave.unlocked = Math.max(platSave.unlocked, Math.min(PLAT_LEVELS.length, n + 2));
        platSave.best[LevelManager.currentLevelKey] = Math.max(platSave.best[LevelManager.currentLevelKey] || 0, Plat.score);
        savePlat();
        Plat.cp = null;
        if (typeof SFX !== "undefined") SFX.play("clear");
        showBanner("COURSE CLEAR!", "Time bonus +" + bonus, "#fde047");
    },

    preUpdate: function() {
        this.flags.playerControl = (Plat.phase === "play");
        if (Plat.phase !== "play") {
            if (--Plat.phaseT <= 0) {
                if (Plat.phase === "dead") { LevelManager.selectLevel(LevelManager.currentLevelKey); return; }
                if (Plat.phase === "over") { gameOver = true; return; }
                if (Plat.phase === "clear") {
                    var n = PLAT_LEVELS.indexOf(LevelManager.currentLevelKey);
                    if (n + 1 < PLAT_LEVELS.length) { LevelManager.selectLevel(PLAT_LEVELS[n + 1]); return; }
                    Plat.phase = "won"; this.overTitle = "ALL COURSES CLEAR!"; gameOver = true;
                }
            }
        }
    },

    update: function() {
        Plat.tick++;
        if (Plat.phase === "play" && Plat.tick % 24 === 0 && --Plat.time <= 0) {
            Plat.time = 0;
            var hs = Plat.heroes();
            for (let i = 0; i < hs.length; i++) Plat.sizes[hs[i].playerIndex] = 0;
            if (hs.length) { showBanner("TIME UP!", "", "#f87171"); platAllDown(hs[0]); }
        }
        var heroes = Plat.heroes();
        var free = heroes.filter(function(c) { return !c.platBubble; });
        for (let i = 0; i < heroes.length; i++) {
            var c = heroes[i];
            if (c.platSize === undefined) platSetSize(c, 0);
            if (c.onGround) c.platChain = 0;
            if (c.platStar > 0 && --c.platStar === 0) c.invulnTimer = 30;
            if (c.platBubble) {
                if (!free.length) {           // everyone is bubbled: the round is lost
                    c.platBubble = false; c.noCollide = false;
                    platAllDown(c);
                    continue;
                }
                var t = free[0];
                var tx = t.x - 40, ty = t.y + 200;
                c.x += (tx - c.x) * 0.04; c.y += (ty - c.y) * 0.04;
                c.xspeed = c.yspeed = 0;
                c.invulnTimer = 9999;
                for (let j = 0; j < free.length; j++) if (Math.hypot(free[j].x - c.x, free[j].y - c.y) < 90) platPopBubble(c);
                continue;
            }
            if (c.y < -900) platDie(c);
        }
        // checkpoint memory
        for (let i = 0; i < Gadgets.list.length; i++) {
            var g = Gadgets.list[i];
            if (g.type === "checkpoint" && g.active && (!Plat.cp || Plat.cp.x !== g.x)) Plat.cp = { key: LevelManager.currentLevelKey, x: g.x, y: g.y + 70 };
        }
        // enemies that fall out of the world are gone
        for (let i = 0; i < zombies.length; i++) if (zombies[i].platKind && zombies[i].y < -900) zombies[i].dead = true;
        // pickups
        for (let i = Plat.items.length - 1; i >= 0; i--) {
            var it = Plat.items[i];
            if (it.emerge > 0) { it.y += 2; if (--it.emerge === 0) { it.vx = (it.kind === "fire") ? 0 : 3.4; if (it.kind === "star") it.vy = 10; } }
            else platItemPhysics(it);
            if (--it.life <= 0 || it.y < -900) { Plat.items.splice(i, 1); continue; }
            if (it.emerge > 0) continue;
            for (let j = 0; j < free.length; j++) {
                var h = free[j];
                if (Math.abs(h.x - it.x) < h.s1 / 2 + 26 && Math.abs(h.y - it.y) < h.s2 / 2 + 26) {
                    if (it.kind === "grow") { if (!h.platSize) platSetSize(h, 1); else platAddScore(1000, h.x, h.y + 80); Components.addFloatingText("BIG!", h.x, h.y + 100, "#4ade80", 20); }
                    else if (it.kind === "fire") { platSetSize(h, 2); Components.addFloatingText("FIRE! (click / F to shoot)", h.x, h.y + 100, "#fb923c", 18); }
                    else if (it.kind === "star") { h.platStar = 600; h.invulnTimer = 600; Components.addFloatingText("STAR POWER!", h.x, h.y + 100, "#fde047", 22); }
                    else if (it.kind === "life") platAddLife(h.x, h.y + 100);
                    if (typeof SFX !== "undefined") SFX.play("pickup", h.x, h.y);
                    Plat.items.splice(i, 1);
                    break;
                }
            }
        }
    },

    drawWorld: function() {
        var k = cameraScaleX, t = Plat.tick;
        for (let i = 0; i < Plat.items.length; i++) {
            var it = Plat.items[i], sx = wsx(it.x), sy = wsy(it.y), r = 26 * k;
            ctx.save();
            ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2.5;
            if (it.kind === "grow") {
                // Power Seed: green bulb with a leaf
                ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.2, r * 0.9, r * 0.8, 0, 0, 7); ctx.fill(); ctx.stroke();
                ctx.fillStyle = "#bbf7d0"; ctx.beginPath(); ctx.ellipse(sx - r * 0.3, sy, r * 0.25, r * 0.35, 0, 0, 7); ctx.fill();
                ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.ellipse(sx + r * 0.35, sy - r * 0.75, r * 0.45, r * 0.2, -0.6, 0, 7); ctx.fill(); ctx.stroke();
            } else if (it.kind === "fire") {
                // Ember Orb
                ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.arc(sx, sy, r * 0.85, 0, 7); ctx.fill(); ctx.stroke();
                ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(sx, sy + Math.sin(t * 0.2) * 2, r * 0.42, 0, 7); ctx.fill();
            } else if (it.kind === "star") {
                ctx.translate(sx, sy); ctx.rotate(t * 0.08);
                ctx.fillStyle = "hsl(" + ((t * 12) % 360) + ",95%,62%)";
                ctx.beginPath();
                for (let p = 0; p < 10; p++) { var rr = p % 2 ? r * 0.45 : r; var a = p / 10 * Math.PI * 2 - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
                ctx.closePath(); ctx.fill(); ctx.stroke();
            } else if (it.kind === "life") {
                ctx.fillStyle = "#f472b6";
                ctx.beginPath(); ctx.moveTo(sx, sy + r * 0.8);
                ctx.bezierCurveTo(sx - r * 1.4, sy - r * 0.2, sx - r * 0.6, sy - r * 1.2, sx, sy - r * 0.4);
                ctx.bezierCurveTo(sx + r * 0.6, sy - r * 1.2, sx + r * 1.4, sy - r * 0.2, sx, sy + r * 0.8);
                ctx.fill(); ctx.stroke();
                ctx.fillStyle = "#fff"; ctx.font = "900 " + Math.round(12 * k + 4) + "px " + UI_FONT; ctx.textAlign = "center"; ctx.fillText("1UP", sx, sy);
            }
            ctx.restore();
        }
    },

    drawFront: function() {
        var k = cameraScaleX, t = Plat.tick;
        // spiky helmets + brute hit pips
        for (let i = 0; i < zombies.length; i++) {
            var z = zombies[i];
            if (z.dead || !z.platKind) continue;
            var top = wsy(z.y + z.s2 / 2), sx = wsx(z.x), w = z.s1 * k;
            if (z.platKind === "spiky") {
                ctx.fillStyle = "#cbd5e1"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2;
                for (let s = 0; s < 4; s++) { var bx = sx - w / 2 + s * w / 4; ctx.beginPath(); ctx.moveTo(bx, top + 4); ctx.lineTo(bx + w / 8, top - 22 * k); ctx.lineTo(bx + w / 4, top + 4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
            } else if (z.platKind === "tank" && z.platHits < 3) {
                for (let p = 0; p < 3; p++) { ctx.fillStyle = p < z.platHits ? "#f87171" : "#334155"; ctx.beginPath(); ctx.arc(sx - 16 + p * 16, top - 30, 5, 0, 7); ctx.fill(); }
            }
        }
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (c.dead) continue;
            var cx = wsx(c.x), cy = wsy(c.y);
            if (c.platBubble) {
                ctx.save();
                ctx.globalAlpha = 0.85;
                ctx.strokeStyle = "#bae6fd"; ctx.lineWidth = 4;
                ctx.fillStyle = "rgba(186,230,253,0.18)";
                ctx.beginPath(); ctx.arc(cx, cy, (c.s1 * 0.9 + Math.sin(t * 0.1) * 4) * k + 6, 0, 7); ctx.fill(); ctx.stroke();
                ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(cx - 14 * k, cy - 18 * k, 7 * k, 0, 7); ctx.fill();
                ctx.restore();
            } else if (c.platStar > 0) {
                ctx.save();
                ctx.strokeStyle = "hsl(" + ((t * 14) % 360) + ",95%,62%)"; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(cx, cy, c.s1 * 0.75 * k, 0, 7); ctx.stroke();
                ctx.restore();
            }
        }
    },

    drawHUD: function() {
        var lvl = LevelManager.getCurrentLevel(), n = PLAT_LEVELS.indexOf(LevelManager.currentLevelKey);
        var hs = characters.filter(function(c) { return c.isPlayer; });
        uiPanel(14, 14, 430, 92 + Math.max(0, hs.length - 2) * 16, "#f59e0b");
        uiText("STOMP SQUAD", 30, 44, 22, "#fbbf24", "left", "900");
        uiText("♥ ×" + Plat.lives, 224, 44, 20, "#f472b6", "left", "900");
        uiText("🪙 ×" + Plat.coins, 300, 44, 20, "#fde047", "left", "900");
        uiText("⏱ " + Plat.time, 372, 44, 18, Plat.time < 60 ? "#f87171" : "#e2e8f0", "left", "900");
        uiText("Course " + (n + 1) + " of " + PLAT_LEVELS.length + ": " + (lvl.title || ""), 30, 68, 13, "#e2e8f0", "left", "800");
        uiText("Score " + String(Plat.score).padStart(7, "0"), 300, 68, 13, "#cbd5e1", "left", "800");
        for (let i = 0; i < hs.length; i++) {
            var c = hs[i], lab = c.platBubble ? "in a bubble" : ["small", "BIG", "FIRE"][c.platSize || 0] + (c.platStar > 0 ? " ★" : "");
            uiText((c.playerLabel || "P") + ": " + lab, 30 + (i % 2) * 200, 90 + Math.floor(i / 2) * 16, 12, c.color || "#fff", "left", "800");
        }
        uiText("A/D run · W jump (hold = higher) · stomp enemies · hit ? blocks · FIRE: click / F to shoot · Esc menu", cssW / 2, cssH - 16, 12, "rgba(220,230,240,0.7)", "center", "700");
        for (let i = 0; i < hs.length; i++) if (!hs[i].dead) drawEdgeIndicator(hs[i].x, hs[i].y, hs[i].color, hs[i].playerLabel);
    },

    menuItems: function(items) {
        var n = Math.max(0, PLAT_LEVELS.indexOf(LevelManager.currentLevelKey));
        items.push({ id: "pl_course", label: "Course:  ◀  " + (n + 1) + " / " + PLAT_LEVELS.length + "  (" + platSave.unlocked + " unlocked)  ▶", hint: "", cycle: true });
        items.push({ id: "pl_restart", label: "Restart course", hint: "keeps lives" });
    },

    onMenu: function(id, dir) {
        if (id === "pl_course") {
            var n = Math.max(0, PLAT_LEVELS.indexOf(LevelManager.currentLevelKey));
            n = (n + (dir || 1) + platSave.unlocked) % platSave.unlocked;
            closePause(); Plat.cp = null; LevelManager.selectLevel(PLAT_LEVELS[n]);
            return true;
        }
        if (id === "pl_restart") { closePause(); Plat.cp = null; LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        return false;
    },

    onRestart: function() { Plat.newGame(); LevelManager.selectLevel(PLAT_LEVELS[0]); },

    overSub: function() {
        return (Plat.phase === "won" ? "Every course cleared!" : "Out of lives") + "  ·  Score " + Plat.score + "  ·  🪙 " + Plat.coins;
    },

    // LAN: sync the HUD numbers and pickups to remote screens
    netState: function() { return { l: Plat.lives, c: Plat.coins, s: Plat.score, t: Plat.time, p: Plat.phase, k: Plat.tick, it: Plat.items.map(function(i) { return [i.kind, Math.round(i.x), Math.round(i.y)]; }) }; },
    applyNetState: function(s) {
        Plat.lives = s.l; Plat.coins = s.c; Plat.score = s.s; Plat.time = s.t; Plat.phase = s.p; Plat.tick = s.k;
        Plat.items = (s.it || []).map(function(a) { return { kind: a[0], x: a[1], y: a[2] }; });
    }
});
