// ============================================================================
// GAME: BED BRAWL  (bedwars)  -  protect your bed, break theirs
//   Two teams on sky islands over the void. Each island has a BED, an iron/gold generator and a row of
//   shop pedestals (walk onto one, press E / / to buy). While your bed stands you respawn; once it's
//   broken, your next death is final. Break the enemy bed (shoot it, or hold E next to it), then wipe
//   them out. Build bridges with C (build mode) using the blocks you buy. The middle island has diamonds.
//   Local 2-player PvP, CPU bots that bridge, fight and go for beds, and LAN players (they take CPU slots).
// ============================================================================
var bwCfg = { format: "1v1" };
try { var _bw = JSON.parse(localStorage.getItem("timsBedBrawl") || "null"); if (_bw) bwCfg.format = _bw.format || "1v1"; } catch (e) {}
function saveBw() { try { localStorage.setItem("timsBedBrawl", JSON.stringify(bwCfg)); } catch (e) {} }

var BW_FORMATS = [["1v1", "You vs 1 CPU"], ["pvp", "2 players (P1 vs P2)"], ["2v2", "You + CPU vs 2 CPUs"], ["coop", "P1 + P2 vs 2 CPUs"], ["3v3", "You + 2 CPUs vs 3 CPUs"]];
var BW_TEAMS = [{ name: "RED", color: "#ef4444", dark: "#7f1d1d", side: -1 }, { name: "BLUE", color: "#3b82f6", dark: "#1e3a8a", side: 1 }];
var BW_SHOP = [
    { id: "wool", label: "Blocks ×16", icon: "🧱", cost: { iron: 4 } },
    { id: "stone", label: "Stone ×8", icon: "🪨", cost: { iron: 12 } },
    { id: "heal", label: "Heal", icon: "❤", cost: { gold: 2 } },
    { id: "blaster", label: "Blaster +", icon: "🔫", cost: { gold: 6 } },
    { id: "armor", label: "Armor +", icon: "🛡", cost: { gold: 10 } },
    { id: "tnt", label: "TNT", icon: "🧨", cost: { gold: 4 } },
    { id: "egg", label: "Bridge Egg", icon: "🥚", cost: { iron: 20 } },       // flies along your aim, laying a bridge behind it
    { id: "fireball", label: "Fireball", icon: "☄", cost: { iron: 24 } },     // flies straight where you aim and blasts blocks / players
    { id: "forge", label: "Team Forge", icon: "⚒", cost: { diamond: 2 } },       // team upgrades: diamonds from the middle island
    { id: "sharp", label: "Team Sharp", icon: "🗡", cost: { diamond: 3 } }
];
var BW_SUDDEN = 60 * 60 * 5;      // 5:00 in: every bed still standing breaks (no endless stalemates)
var BW_RES = { iron: { color: "#e5e7eb", every: 70, cap: 40 }, gold: { color: "#facc15", every: 420, cap: 12 }, diamond: { color: "#22d3ee", every: 1100, cap: 4 } };

var BW = {
    beds: [], gens: [], drops: [], shops: [],
    phase: "fight", winner: -1, endT: 0, tick: 0,
    up: [], feed: [],
    VOID: -480
};

// kill feed (top right): kills, final kills, void falls, beds
function bwFeed(text, color) {
    BW.feed.push({ text: text, color: color || "#e2e8f0", t: BW.tick });
    if (BW.feed.length > 6) BW.feed.shift();
}

// ---------------------------------------------------------------- map: two base islands + a diamond island
(function() {
    var L = ModeKit.room(-4200, 4200, 2400, { tex: "brick", color: "#0f172a", noFloor: true });
    var island = function(x0, x1, top, tex, col) { return { type: "box", name: "Island", x: (x0 + x1) / 2, y: top - 120, w: x1 - x0, h: 240, color: col || "#5d8a3a", texture: tex || "grass_dirt", kind: "block" }; };
    L.push(island(-3200, -2160, 0));
    L.push(island(2160, 3200, 0));
    L.push(island(-400, 400, 0, "castle_stone", "#475569"));
    L.push({ type: "box", name: "Island", x: 0, y: 260, w: 240, h: 40, color: "#8b6b4a", texture: "dojo_wood", kind: "platform" });
    ModeKit.addLevel("bedwars_sky", { name: "🛏 Bed Brawl: Sky Islands", mode: "bedwars", wavesEnabled: false, spawnP1: [-2900, 80], spawnP2: [2900, 80], layout: L, title: "Sky Islands" });
})();

function bwTeamOf(ch) { return ch.fighterTeam === 1 ? 1 : 0; }
function bwRes(ch) { return { iron: ch.bwIron || 0, gold: ch.bwGold || 0, diamond: ch.bwDiamond || 0 }; }

function bwSpawnPoint(team, k) {
    var side = BW_TEAMS[team].side;
    return [side * (2900 - (k || 0) * 70), 90];
}

function bwRespawn(ch) {
    var sp = bwSpawnPoint(bwTeamOf(ch), ch.bwSlot || 0);
    ch.dead = false;
    ch.x = sp[0]; ch.y = sp[1]; ch.xspeed = ch.yspeed = 0;
    ch.health = ch.maxHealth;
    ch.invulnTimer = 90;
    ch.bwDeadT = 0;
    ch.buildMode = false;
    if (ch.liveRagdoll && typeof Ragdolls !== "undefined") { Ragdolls.remove(ch.liveRagdoll); ch.liveRagdoll = null; ch.ragdollTimer = 0; }
}

function bwKill(ch, by) {
    if (ch.dead || BW.phase !== "fight") return;
    var team = bwTeamOf(ch);
    var bedAlive = BW.beds[team] && !BW.beds[team].dead;
    if (typeof Ragdolls !== "undefined" && Ragdolls.spawnFrom && ch.y > BW.VOID) {
        var rd = Ragdolls.spawnFrom(ch, { corpse: true, life: 150, vx: ch.xspeed, vy: 8 });
        if (rd && rd.style) rd.style.dead = true;
    }
    ch.dead = true;
    if (ch.heldObject) { ch.heldObject.heldBy = null; ch.heldObject.noCollide = false; ch.heldObject = null; }
    // drop half your iron & gold for whoever killed you
    if (by && by.isPlayer && by !== ch) { by.bwIron = (by.bwIron || 0) + Math.floor((ch.bwIron || 0) / 2); by.bwGold = (by.bwGold || 0) + Math.floor((ch.bwGold || 0) / 2); by.kills = (by.kills || 0) + 1; }
    ch.bwIron = 0; ch.bwGold = 0;
    var who = (by && by.isPlayer && by !== ch) ? (by.playerLabel + " ⚔ ") : "";
    var how = who ? (by.playerLabel + " ⚔ " + ch.playerLabel) : (ch.y < BW.VOID ? ch.playerLabel + " fell into the void" : ch.playerLabel + " died");
    bwFeed(how + (bedAlive ? "" : "  — FINAL KILL"), bedAlive ? BW_TEAMS[team].color : "#fde047");
    Components.addFloatingText(who + ch.playerLabel + (bedAlive ? "" : " — ELIMINATED"), ch.x, Math.max(ch.y, 0) + 120, BW_TEAMS[team].color, 18);
    if (typeof SFX !== "undefined") SFX.play("hurt", ch.x, ch.y, 1, 0.8);
    if (bedAlive) ch.bwDeadT = 240; else ch.bwOut = true;
    bwCheckWin();
}

function bwCheckWin() {
    for (let t = 0; t < 2; t++) {
        var alive = characters.some(function(c) { return c.isPlayer && bwTeamOf(c) === t && !c.bwOut; });
        if (!alive) {
            BW.phase = "over"; BW.winner = 1 - t; BW.endT = 200;
            showBanner(BW_TEAMS[1 - t].name + " TEAM WINS!", "Bed Brawl", BW_TEAMS[1 - t].color);
            if (typeof SFX !== "undefined") SFX.play("clear");
            return;
        }
    }
}

function bwBuy(ch, item) {
    var r = bwRes(ch), up = BW.up[bwTeamOf(ch)] || (BW.up[bwTeamOf(ch)] = { forge: 0, sharp: 0 });
    var maxed = (item.id === "forge" && up.forge >= 2) || (item.id === "sharp" && up.sharp >= 1) || (item.id === "armor" && (ch.bwArmor || 0) >= 3) || (item.id === "blaster" && (ch.bwDmg || 0) >= 3);
    if (maxed) {
        if ((ch.bwNoCashT || 0) < BW.tick) { Components.addFloatingText("Maxed out", ch.x, ch.y + 110, "#fca5a5", 14); ch.bwNoCashT = BW.tick + 40; }
        return false;
    }
    for (var k in item.cost) if ((r[k] || 0) < item.cost[k]) {
        if ((ch.bwNoCashT || 0) < BW.tick) { Components.addFloatingText("Need " + item.cost[k] + " " + k, ch.x, ch.y + 110, "#fca5a5", 14); ch.bwNoCashT = BW.tick + 40; }
        return false;
    }
    for (var k2 in item.cost) { var f = "bw" + k2.charAt(0).toUpperCase() + k2.slice(1); ch[f] = (ch[f] || 0) - item.cost[k2]; }
    var mats = Build.mats(ch);
    if (item.id === "wool") mats.wood += 16;
    else if (item.id === "stone") mats.stone += 8;
    else if (item.id === "heal") ch.health = ch.maxHealth;
    else if (item.id === "blaster") ch.bwDmg = Math.min(3, (ch.bwDmg || 0) + 1);
    else if (item.id === "armor") ch.bwArmor = Math.min(3, (ch.bwArmor || 0) + 1);
    else if (item.id === "forge") { up.forge++; bwFeed(BW_TEAMS[bwTeamOf(ch)].name + " bought Forge " + up.forge + " (faster generator)", BW_TEAMS[bwTeamOf(ch)].color); }
    else if (item.id === "sharp") { up.sharp = 1; bwFeed(BW_TEAMS[bwTeamOf(ch)].name + " bought Sharp (+25% team damage)", BW_TEAMS[bwTeamOf(ch)].color); }
    else if (item.id === "fireball") bwFireball(ch);
    else if (item.id === "egg") bwBridgeEgg(ch);
    else if (item.id === "tnt") { var t = Object.addCrate(ch.x + (ch.lastFacing || 1) * 90, ch.y + 60, 70, "#e84545", { explosive: true, name: "TNT Barrel" }); t.xspeed = (ch.lastFacing || 1) * 6; t.yspeed = 6; if (typeof rebuildAllObjects === "function") rebuildAllObjects(); }
    Components.addFloatingText("+" + item.label, ch.x, ch.y + 110, "#86efac", 15);
    if (typeof SFX !== "undefined") SFX.play("pickup", ch.x, ch.y);
    return true;
}

// a bridge egg: flies nearly level the way you face (a little up or down with your aim) and lays a block every 80 px
// behind it - up to 16 - until it hits something. A fast way to the middle island or across to the enemy.
function bwBridgeEgg(ch) {
    var rad = Math.radians(ch.degree || 90), dir = Math.sin(rad) >= 0 ? 1 : -1;
    if (Math.abs(Math.sin(rad)) < 0.2) dir = ch.lastFacing || 1;
    var rise = Math.max(-0.35, Math.min(0.35, Math.cos(rad)));
    BW.eggs.push({ x: ch.x + dir * 60, y: ch.y - ch.s2 / 2 + 30, vx: dir * 14, vy: rise * 14, n: 0, dist: 0, team: bwTeamOf(ch), owner: ch });
    if (typeof SFX !== "undefined") SFX.play("sling", ch.x, ch.y, 0.6, 1.3);
}

function bwEggs() {
    var mat = BUILD_MATS[0];
    for (let e = BW.eggs.length - 1; e >= 0; e--) {
        var E = BW.eggs[e], placed = null, stop = false;
        E.x += E.vx; E.y += E.vy; E.dist += Math.abs(E.vx);
        for (let i = 0; i < staticObjects.length; i++) { var o = staticObjects[i]; if (!o.dead && !/Bed/.test(o.name || "") && Math.abs(E.x - o.x) < o.w / 2 && Math.abs(E.y - o.y) < o.h / 2) { stop = true; break; } }   // flies over beds
        if (!stop && E.dist >= 80) {
            E.dist -= 80;
            // the block's top sits where the thrower's feet were (the egg flies 30 above it); skip spots already solid
            var bx = E.x - Math.sign(E.vx) * 40, by = E.y - 50, solid = false;
            for (let i = 0; i < staticObjects.length; i++) { var q = staticObjects[i]; if (!q.dead && Math.abs(bx - q.x) < q.w / 2 + 38 && Math.abs(by - q.y) < q.h / 2 + 18) { solid = true; break; } }
            if (solid) continue;
            var b = Object.addBox(bx, by, 80, 40, BW_TEAMS[E.team] ? BW_TEAMS[E.team].color : mat.color, { name: "Built Bridge", texture: mat.tex, kind: "block" });
            b.buildHP = b.buildMaxHP = mat.hp; b.builtBy = E.owner && E.owner.playerIndex; b.buildMat = mat.id; b.buildCost = 0;
            E.n++; placed = b;
        }
        if (placed) Build.changed(placed);
        if (stop || E.n >= 16 || Math.abs(E.x) > 9000) { Components.spawnSparks(E.x, E.y, "#fef3c7", 8); BW.eggs.splice(e, 1); }
    }
}

// a fireball: a small, nearly weightless bomb launched fast along your aim; it bursts on whatever it hits
function bwFireball(ch) {
    var rad = Math.radians(ch.degree || 90), dx = Math.sin(rad), dy = Math.cos(rad);
    if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) { dx = ch.lastFacing || 1; dy = 0; }
    var f = Object.addCrate(ch.x + dx * 80, ch.y + 20 + dy * 80, 40, "#f97316", { explosive: true, name: "Fireball" });
    f.gravityMult = 0.04; f.gravity = gravity * 0.04; f.maxspeed = 40;
    f.xspeed = dx * 26; f.yspeed = dy * 26;
    f.thrownBy = ch; f.thrownTimer = 50; f.bwFire = true;
    if (typeof rebuildAllObjects === "function") rebuildAllObjects();
    if (typeof SFX !== "undefined") SFX.play("shockwave", ch.x, ch.y, 0.6, 1.4);
}

// ---------------------------------------------------------------- CPU bots
function bwBotThink(ch) {
    ch.leftPressed = ch.rightPressed = ch.upPressed = ch.downPressed = false;
    ch.shootPressed = false; ch.abilityPressed = false;
    if (ch.cpuIn) ch.cpuIn.shoot = false;
    ch.buildMode = false;
    if (ch.dead || BW.phase !== "fight" || ch.ragdollTimer > 0) return;
    ch.cpuT = (ch.cpuT || 0) + 1;
    var team = bwTeamOf(ch), enemyT = 1 - team;
    var feet = ch.y - ch.s2 / 2;
    var mats = Build.mats(ch);
    var myBed = BW.beds[team], theirBed = BW.beds[enemyT];
    var enemies = characters.filter(function(c) { return c.isPlayer && bwTeamOf(c) === enemyT && !c.dead; });
    var near = null, nd = Infinity;
    enemies.forEach(function(e) { var d = Math.hypot(e.x - ch.x, e.y - ch.y); if (d < nd) { nd = d; near = e; } });
    var home = BW_TEAMS[team].side * 2700;
    var onHome = Math.abs(ch.x - home) < 600 && feet > -60;

    // goal: shop when short on blocks, defend when someone is at our bed, otherwise their bed, then their players
    var goalX, goalY = 0, mode;
    var blocks = mats.wood + mats.stone;
    if (ch.bwRestock && blocks >= 32) ch.bwRestock = false;
    if (blocks < 6) ch.bwRestock = true;
    var tu = BW.up[team] || {}, upIdx = -1;
    if ((ch.bwDiamond || 0) >= 2 && (tu.forge || 0) < 2) upIdx = BW_SHOP.findIndex(function(it) { return it.id === "forge"; });
    else if ((ch.bwDiamond || 0) >= 3 && !tu.sharp) upIdx = BW_SHOP.findIndex(function(it) { return it.id === "sharp"; });
    if (upIdx >= 0 && onHome) { goalX = BW.shops[team][upIdx].x; mode = "shop"; }
    else if (ch.bwRestock && (ch.bwIron || 0) >= 4 && onHome) { goalX = BW.shops[team][0].x; mode = "shop"; }
    else if (ch.bwRestock && onHome && blocks < 16) { goalX = BW.gens[team].x; mode = "farm"; }
    else if (ch.bwRestock && !onHome && blocks === 0) { goalX = home; mode = "home"; }
    else if (near && myBed && !myBed.dead && Math.abs(near.x - myBed.x) < 500 && nd < 900) { goalX = near.x; goalY = near.y; mode = "defend"; }
    else if (theirBed && !theirBed.dead) { goalX = theirBed.x; goalY = theirBed.y; mode = "bed"; }
    else if (near) { goalX = near.x; goalY = near.y; mode = "hunt"; }
    else { goalX = home; mode = "home"; }
    ch.bwMode = mode;

    // fight anyone close with line of sight (lead the shot a little)
    if (near && nd < 800 && Components.hasLOS(ch.x, ch.y, near.x, near.y)) {
        var lx = near.x + (near.xspeed || 0) * 8, ly = near.y + (near.yspeed || 0) * 4;
        ch.degree = ch.degreeToGoCW = (Math.degrees(Math.atan2(lx - ch.x, ly - ch.y)) + 360) % 360 + (Math.random() - 0.5) * 8;
        if (ch.cpuT % 3 !== 0) { ch.shootPressed = true; if (ch.cpuIn) ch.cpuIn.shoot = true; }
    }
    // at the enemy bed: hold E and shoot it
    if (theirBed && !theirBed.dead && Math.abs(ch.x - theirBed.x) < 140 && Math.abs(feet - (theirBed.y + 25)) < 120) {
        ch.abilityPressed = true;
        ch.degree = ch.degreeToGoCW = (Math.degrees(Math.atan2(theirBed.x - ch.x, theirBed.y - ch.y)) + 360) % 360;
        ch.shootPressed = true; if (ch.cpuIn) ch.cpuIn.shoot = true;
    }
    if (mode === "shop" && Math.abs(ch.x - goalX) < 30) { ch.abilityPressed = (ch.cpuT % 2 === 0); return; }   // tap E
    if (mode === "farm" && Math.abs(ch.x - goalX) < 60) return;

    var dx = goalX - ch.x;
    if (Math.abs(dx) < 40 && mode !== "bed") return;
    var dir = dx > 0 ? 1 : -1;
    // stuck for a while: hop, then walk the other way for a moment
    if (Math.abs(ch.x - (ch.bwLastX || 0)) < 2) ch.bwStuck = (ch.bwStuck || 0) + 1; else { ch.bwStuck = 0; ch.bwLastX = ch.x; }
    if (ch.bwStuck > 60) ch.upPressed = (ch.cpuT % 2 === 0);
    if (ch.bwStuck > 150) { ch.bwFlee = 45; ch.bwStuck = 0; }
    if (ch.bwFlee > 0) { ch.bwFlee--; dir = -dir; }
    if (dir > 0) ch.rightPressed = true; else ch.leftPressed = true;
    ch.lastFacing = dir;
    // bridge: no ground just ahead -> stop at the edge and lay a block at foot level
    if (ch.onGround && typeof Pathfinder !== "undefined") {
        var aheadX = ch.x + dir * (ch.s1 / 2 + 30);
        if (!Pathfinder.groundBelow(aheadX, feet, 160)) {
            if (mats.wood + mats.stone > 0) {
                ch.rightPressed = ch.leftPressed = false;
                // fill the first empty grid cell ahead at foot level (keeps bridges hole-free)
                if (!ch.bwPlaceCd || ch.bwPlaceCd < BW.tick) {
                    ch.buildMode = true; ch.buildPiece = 0; ch.buildMat = mats.wood > 0 ? 0 : 1;
                    var c0 = Math.floor(ch.x / 80);
                    for (let s = 0; s <= 3; s++) {
                        var cx = (c0 + dir * s) * 80 + 40;
                        if (Pathfinder.groundBelow(cx, feet, 20)) continue;
                        ch.buildAimX = cx; ch.buildAimY = feet - 40;
                        if (Build.place(ch)) { ch.bwPlaceCd = BW.tick + 7; break; }
                    }
                    ch.buildMode = false;
                }
            } else if (Pathfinder.groundBelow(ch.x + dir * 230, feet, 40)) {
                ch.upPressed = (ch.cpuT % 2 === 0);      // out of blocks: hop a small hole
            } else {
                ch.rightPressed = ch.leftPressed = false;
                ch.bwRestock = true;
            }
            return;
        }
        // walk up blocks and over small walls
        if (CollisionDetector.collision(ch, [dir * 12, 0], staticObjects) && !ch.collidedRamp) ch.upPressed = (ch.cpuT % 2 === 0);
        // enemy built up high: tower up with a block under our feet
        if (goalY > ch.y + 220 && Math.abs(dx) < 260 && mats.wood + mats.stone > 0) ch.upPressed = true;
    }
    if (!ch.onGround && feet > -40 && goalY > ch.y + 220 && ch.yspeed < 2 && mats.wood + mats.stone > 0 && (!ch.bwPlaceCd || ch.bwPlaceCd < BW.tick)) {
        ch.buildMode = true; ch.buildPiece = 0; ch.buildMat = mats.wood > 0 ? 0 : 1;
        ch.buildAimX = ch.x; ch.buildAimY = feet - 45;
        if (Build.place(ch)) ch.bwPlaceCd = BW.tick + 12;
        ch.buildMode = false;
    }
}

// ---------------------------------------------------------------- the mode
GameModes.register({
    id: "bedwars",
    title: "BED BRAWL",
    tagline: "Protect your bed, bridge across the void, break theirs. PvP, CPU bots and LAN.",
    color: "#ef4444",
    firstLevel: "bedwars_sky",
    flags: { waves: false, revive: false, jetpack: false, shooting: true, ability: false, ammo: false, noBedrock: true, scenery: false,
        coopToggle: false, dash: true, wallJump: false, airJumps: 0, building: true, noHeroContact: true },
    overTitle: "BED BRAWL",
    againLabel: "Rematch",

    onActivate: function() { jetpackEnabled = false; },

    setupLevel: function(lvl) {
        BW.phase = "fight"; BW.winner = -1; BW.tick = 0; BW.drops = [];
        BW.eggs = [];
        BW.beds = []; BW.gens = []; BW.shops = []; BW.feed = []; BW.up = [{ forge: 0, sharp: 0 }, { forge: 0, sharp: 0 }];
        for (let t = 0; t < 2; t++) {
            var side = BW_TEAMS[t].side;
            var bed = Object.addBox(side * 2380, 25, 160, 50, BW_TEAMS[t].color, { name: BW_TEAMS[t].name + " Bed", texture: t === 0 ? "wool_red" : "wool_blue", kind: "block" });
            bed.buildHP = bed.buildMaxHP = 160; bed.isBed = true; bed.bedTeam = t;
            BW.beds[t] = bed;
            BW.gens[t] = { x: side * 3110, y: 0, team: t, t: 0, kinds: ["iron", "gold"] };
            BW.shops[t] = BW_SHOP.map(function(it, i) { return { x: side * (2600 + i * 70) - side * 0, y: 0, item: it, team: t }; });
            // lay the pedestals out between the bed and the spawn
            for (let i = 0; i < BW.shops[t].length; i++) BW.shops[t][i].x = side * (2500 + i * 75);
        }
        BW.gens[2] = { x: 0, y: 0, team: -1, t: 0, kinds: ["diamond"] };
        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
    },

    createPlayers: function() {
        var f = bwCfg.format;
        var red = [{ cpu: false, idx: 0 }], blue = [];
        if (f === "1v1") blue = [{ cpu: true }];
        else if (f === "pvp") blue = [{ cpu: false, idx: 1 }];
        else if (f === "2v2") { red.push({ cpu: true }); blue = [{ cpu: true }, { cpu: true }]; }
        else if (f === "coop") { red.push({ cpu: false, idx: 1 }); blue = [{ cpu: true }, { cpu: true }]; }
        else if (f === "3v3") { red.push({ cpu: true }, { cpu: true }); blue = [{ cpu: true }, { cpu: true }, { cpu: true }]; }
        var slot = 2, n = 1;
        var make = function(p, team, k) {
            var sp = bwSpawnPoint(team, k);
            var ch = ModeKit.makeHero(p.cpu ? slot++ : p.idx, sp[0], sp[1], { team: team, color: p.cpu ? BW_TEAMS[team].color : undefined, accent: BW_TEAMS[team].color, cpu: p.cpu, label: p.cpu ? "CPU" + (n++) : ("P" + (p.idx + 1)) });
            ch.fighterTeam = team;
            ch.bwSlot = k;
            ch.buildMats = { wood: 8, stone: 0, metal: 0 };
            ch.bwIron = 0; ch.bwGold = 0; ch.bwDiamond = 0;
        };
        red.forEach(function(p, k) { make(p, 0, k); });
        blue.forEach(function(p, k) { make(p, 1, k); });
        multiplayer = (f === "pvp" || f === "coop");
        if (!multiplayer) blueGuy = null;
    },

    cpuThink: function(ch) { bwBotThink(ch); },

    // follow the humans at this screen, not every bot on the map
    cameraTargets: function() {
        var h = characters.filter(function(c) { return c.isPlayer && !c.isCPU && !c.isRemote && !c.dead; });
        return h.length ? h : characters.filter(function(c) { return !c.dead; });
    },

    // all damage between players goes through here: armor, blaster upgrades, knockback, deaths
    onDamage: function(ch, amount, kx, ky, attacker) {
        if (amount >= 0) return false;
        if (ch.dead || BW.phase !== "fight") return true;
        if (ch.hitCooldown > 0) return true;
        var mult = [1, 0.8, 0.65, 0.5][ch.bwArmor || 0] * (attacker && attacker.bwDmg ? 1 + attacker.bwDmg * 0.3 : 1);
        if (attacker && attacker.isPlayer && BW.up[bwTeamOf(attacker)] && BW.up[bwTeamOf(attacker)].sharp) mult *= 1.25;
        ch.health += amount * mult;
        ch.hitCooldown = 10;
        ch.hitFlashTimer = 6;
        ch.xspeed += kx * 1.6; ch.yspeed += Math.max(ky, 3);
        ch.lastHitBy = attacker; ch.bwLastHitT = BW.tick;
        if (ch.health <= 0) bwKill(ch, attacker);
        return true;
    },

    // your own bed can't be hurt by your team
    onPieceDamage: function(obj, amount, by) { return !!(obj.isBed && by && by.isPlayer && bwTeamOf(by) === obj.bedTeam); },

    onBreakPiece: function(obj, by) {
        if (!obj.isBed) return;
        var t = obj.bedTeam;
        bwFeed("🛏 " + BW_TEAMS[t].name + " bed destroyed" + (by && by.playerLabel ? " by " + by.playerLabel : ""), BW_TEAMS[1 - t].color);
        showBanner(BW_TEAMS[t].name + " BED DESTROYED!", (by && by.playerLabel ? by.playerLabel + " broke it — " : "") + BW_TEAMS[t].name + " can no longer respawn", BW_TEAMS[1 - t].color);
        if (typeof SFX !== "undefined") SFX.play("explode", obj.x, obj.y, 1, 0.7);
        screenShake = Math.max(screenShake, 10);
        // anyone of that team already waiting to respawn is out
        characters.forEach(function(c) { if (c.isPlayer && bwTeamOf(c) === t && c.dead) c.bwOut = true; });
        bwCheckWin();
    },

    buildCost: function(ch, piece, mat) { return mat.id === "metal" ? 99 : (piece.id === "ramp" ? 2 : 1); },

    preUpdate: function() {
        BW.tick++;
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (!c.isPlayer) continue;
            if (c.dead && !c.bwOut && c.bwDeadT > 0 && --c.bwDeadT === 0 && BW.phase === "fight") bwRespawn(c);
        }
        if (BW.phase === "over" && --BW.endT <= 0) gameOver = true;
        if (BW.phase === "fight" && BW.tick === BW_SUDDEN) {
            bwFeed("⏰ SUDDEN DEATH — all beds break", "#f97316");
            for (let t = 0; t < BW.beds.length; t++) if (BW.beds[t] && !BW.beds[t].dead) Build.destroy(BW.beds[t], null, false);
            if (BW.phase === "fight") showBanner("SUDDEN DEATH!", "Every bed is gone — last team standing wins", "#f97316");
        }
    },

    update: function() {
        if (BW.eggs && BW.eggs.length) bwEggs();
        // void
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (c.isPlayer && !c.dead && c.y < BW.VOID) bwKill(c, (c.lastHitBy && BW.tick - (c.bwLastHitT || 0) < 300) ? c.lastHitBy : null);
        }
        // generators
        for (let g = 0; g < BW.gens.length; g++) {
            var gen = BW.gens[g];
            gen.t++;
            for (let k = 0; k < gen.kinds.length; k++) {
                var kind = gen.kinds[k], R = BW_RES[kind];
                var every = gen.team >= 0 && BW.up[gen.team] ? Math.round(R.every / (1 + 0.5 * BW.up[gen.team].forge)) : R.every;
                every = Math.max(5, Math.round(every / (bwCfg.genMult || 1)));               // Cheats & tuning: Generator speed
                if (gen.t % every === 0) {
                    var count = BW.drops.filter(function(d) { return d.kind === kind && Math.abs(d.x - gen.x) < 200; }).length;
                    if (count < R.cap) BW.drops.push({ kind: kind, x: gen.x + (Math.random() - 0.5) * 80, y: 30, t: 0 });
                }
            }
        }
        // pickups
        for (let i = BW.drops.length - 1; i >= 0; i--) {
            var d = BW.drops[i];
            d.t++;
            for (let j = 0; j < characters.length; j++) {
                var h = characters[j];
                if (!h.isPlayer || h.dead) continue;
                if (Math.abs(h.x - d.x) < h.s1 / 2 + 24 && Math.abs((h.y - h.s2 / 2) - d.y) < 70) {
                    var f = "bw" + d.kind.charAt(0).toUpperCase() + d.kind.slice(1);
                    h[f] = (h[f] || 0) + 1;
                    BW.drops.splice(i, 1);
                    if (typeof SFX !== "undefined" && !h.isCPU) SFX.play("coin", h.x, h.y, 0.4, d.kind === "iron" ? 1.4 : 1);
                    break;
                }
            }
        }
        // shops and bed-breaking with the interact key (pressed once per buy)
        for (let i = 0; i < characters.length; i++) {
            var c2 = characters[i];
            if (!c2.isPlayer || c2.dead) continue;
            var want = !!c2.abilityPressed, fresh = want && !c2.bwPrevAbility;
            c2.bwPrevAbility = want;
            var feet = c2.y - c2.s2 / 2;
            var shops = BW.shops[bwTeamOf(c2)] || [];
            for (let s = 0; s < shops.length; s++) {
                if (Math.abs(c2.x - shops[s].x) < 36 && Math.abs(feet - shops[s].y) < 60) { c2.bwAtShop = shops[s]; if (fresh) bwBuy(c2, shops[s].item); }
            }
            var eb = BW.beds[1 - bwTeamOf(c2)];
            if (want && eb && !eb.dead && Math.abs(c2.x - eb.x) < 140 && Math.abs(feet - (eb.y + 25)) < 120) Build.damage(eb, -1.2, c2);
        }
    },

    drawWorld: function() {
        (BW.eggs || []).forEach(function(E) {
            var k = cameraScaleX; ctx.fillStyle = "#fef3c7"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(wsx(E.x), wsy(E.y), 14 * k, 18 * k, BW.tick * 0.3, 0, 7); ctx.fill(); ctx.stroke();
        });
        var k = cameraScaleX, t = BW.tick;
        // beds: frame, pillow and an HP bar
        for (let i = 0; i < BW.beds.length; i++) {
            var b = BW.beds[i];
            if (!b || b.dead) continue;
            var sx = wsx(b.x), sy = wsy(b.y + b.h / 2);
            ctx.save();
            ctx.fillStyle = "#f8fafc"; ctx.fillRect(sx + BW_TEAMS[i].side * -1 * 0 - 70 * k, sy - 10 * k, 50 * k, 22 * k);
            ctx.fillStyle = BW_TEAMS[i].dark; ctx.fillRect(sx - 80 * k, sy + 28 * k, 12 * k, 22 * k); ctx.fillRect(sx + 68 * k, sy + 28 * k, 12 * k, 22 * k);
            var frac = b.buildHP / b.buildMaxHP;
            ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(sx - 60 * k, sy - 34 * k, 120 * k, 8 * k);
            ctx.fillStyle = frac > 0.5 ? "#4ade80" : (frac > 0.25 ? "#facc15" : "#ef4444"); ctx.fillRect(sx - 60 * k, sy - 34 * k, 120 * k * frac, 8 * k);
            ctx.restore();
            uiText("🛏 " + BW_TEAMS[i].name, sx, sy - 44 * k, 12, BW_TEAMS[i].color, "center", "900");
        }
        // generators
        for (let g = 0; g < BW.gens.length; g++) {
            var gen = BW.gens[g], gx = wsx(gen.x), gy = wsy(gen.y);
            var col = gen.kinds[0] === "diamond" ? BW_RES.diamond.color : "#94a3b8";
            ctx.fillStyle = TextureManager.getPattern("gen_grate") || "#1e293b"; ctx.fillRect(gx - 50 * k, gy - 16 * k, 100 * k, 16 * k);
            ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(gx - 50 * k, gy - 16 * k, 100 * k, 16 * k);
            ctx.fillStyle = col; ctx.globalAlpha = 0.5 + Math.sin(t * 0.1) * 0.3; ctx.fillRect(gx - 40 * k, gy - 12 * k, 80 * k, 6 * k); ctx.globalAlpha = 1;
        }
        // resource drops
        for (let i = 0; i < BW.drops.length; i++) {
            var d = BW.drops[i], dx = wsx(d.x), dy = wsy(d.y + 14 + Math.sin((t + i * 13) * 0.08) * 5);
            ctx.fillStyle = BW_RES[d.kind].color; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(dx, dy - 11 * k - 3); ctx.lineTo(dx + 9 * k + 2, dy); ctx.lineTo(dx, dy + 11 * k + 3); ctx.lineTo(dx - 9 * k - 2, dy); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        // shop pedestals
        for (let tm = 0; tm < BW.shops.length; tm++) {
            for (let s = 0; s < BW.shops[tm].length; s++) {
                var sp = BW.shops[tm][s], px = wsx(sp.x), py = wsy(sp.y);
                ctx.fillStyle = TextureManager.getPattern("pedestal_stone") || "#334155"; ctx.fillRect(px - 28 * k, py - 26 * k, 56 * k, 26 * k);
                ctx.strokeStyle = BW_TEAMS[tm].color; ctx.lineWidth = 2; ctx.strokeRect(px - 28 * k, py - 26 * k, 56 * k, 26 * k);
                uiText(sp.item.icon, px, py - 40 * k, Math.max(12, 26 * k), "#fff", "center", "800");
                var near = characters.some(function(c) { return c.isPlayer && !c.isCPU && !c.dead && bwTeamOf(c) === tm && Math.abs(c.x - sp.x) < 36 && Math.abs((c.y - c.s2 / 2) - sp.y) < 60; });
                var cs = []; for (var key in sp.item.cost) cs.push(sp.item.cost[key] + " " + key);
                if (near) {
                    // only the pedestal you stand on gets the full label (8 side by side would overlap)
                    uiText(sp.item.label, px, py - 200 * k - 34, 14, "#fde047", "center", "900");
                    uiText(cs.join(" + ") + "  — press E", px, py - 200 * k - 16, 12, "#e2e8f0", "center", "700");
                } else if (k > 0.45) {
                    var ic = { iron: "⬜", gold: "🟨", diamond: "💎" }, short = [];
                    for (var key2 in sp.item.cost) short.push(sp.item.cost[key2] + ic[key2]);
                    uiText(short.join(""), px, py - 66 * k - 6, 9, "#94a3b8", "center", "700");
                }
            }
        }
    },

    drawHUD: function() {
        uiPanel(14, 14, 560, 78, "#ef4444");
        uiText("BED BRAWL", 30, 44, 22, "#fca5a5", "left", "900");
        for (let t = 0; t < 2; t++) {
            var bed = BW.beds[t];
            var alive = characters.filter(function(c) { return c.isPlayer && bwTeamOf(c) === t && !c.bwOut; }).length;
            var u0 = BW.up[t] || {};
            uiText(BW_TEAMS[t].name + " " + (bed && !bed.dead ? "🛏 ✔" : "🛏 ✖") + "  " + alive + " left" + (u0.forge ? "  ⚒" + u0.forge : "") + (u0.sharp ? " 🗡" : ""), 180 + t * 180, 44, 14, BW_TEAMS[t].color, "left", "900");
        }
        var left = Math.max(0, BW_SUDDEN - BW.tick), anyBed = BW.beds.some(function(b) { return b && !b.dead; });
        if (anyBed && BW.phase === "fight") uiText("⏰ beds break in " + Math.floor(left / 3600) + ":" + ("0" + Math.floor(left / 60) % 60).slice(-2), 400, 72, 13, left < 1800 ? "#f97316" : "#cbd5e1", "left", "900");
        for (let i = 0; i < BW.feed.length; i++) {
            var fe = BW.feed[i], age = BW.tick - fe.t;
            if (age > 600) continue;
            ctx.globalAlpha = Math.min(1, (600 - age) / 90);
            uiText(fe.text, cssW - 20, 110 + i * 20, 13, fe.color, "right", "800");
            ctx.globalAlpha = 1;
        }
        uiText("Format: " + (BW_FORMATS.filter(function(f) { return f[0] === bwCfg.format; })[0] || ["", ""])[1] + "  ·  Esc to change", 30, 72, 12, "#94a3b8", "left", "700");
        // resources for the people at this screen
        var mine = characters.filter(function(c) { return c.isPlayer && !c.isCPU && !c.isRemote; });
        if (typeof Net !== "undefined" && Net.role === "client") { var me = Net.myChar(); mine = me ? [me] : []; }
        for (let i = 0; i < mine.length; i++) {
            var c = mine[i], m = Build.mats(c), y0 = 110 + i * 64;
            uiPanel(14, y0, 300, 54, BW_TEAMS[bwTeamOf(c)].color, 0.85);
            uiText(c.playerLabel + (c.dead ? (c.bwOut ? "  OUT" : "  respawn in " + Math.ceil((c.bwDeadT || 0) / 60)) : ""), 26, y0 + 20, 13, BW_TEAMS[bwTeamOf(c)].color, "left", "900");
            uiText("⬜ " + (c.bwIron || 0) + "   🟨 " + (c.bwGold || 0) + "   💎 " + (c.bwDiamond || 0) + "   🧱 " + (m.wood + m.stone) + "   🛡 " + (c.bwArmor || 0) + "   🔫 " + (c.bwDmg || 0), 26, y0 + 42, 13, "#e2e8f0", "left", "800");
        }
        uiText("Walk on pedestals + E to buy · C build mode (bridge!) · shoot or hold E at the enemy bed · don't fall", cssW / 2, cssH - 16, 12, "rgba(220,230,240,0.7)", "center", "700");
        for (let i = 0; i < characters.length; i++) if (!characters[i].dead) drawEdgeIndicator(characters[i].x, characters[i].y, characters[i].color, characters[i].playerLabel);
    },

    menuItems: function(items) {
        var i = Math.max(0, BW_FORMATS.findIndex(function(f) { return f[0] === bwCfg.format; }));
        items.push({ id: "bw_format", label: "Teams:  ◀  " + BW_FORMATS[i][1] + "  ▶", hint: "Applies on rematch", cycle: true });
        items.push({ id: "bw_again", label: "Rematch", hint: "" });
    },

    onMenu: function(id, dir) {
        if (id === "bw_format") {
            var i = Math.max(0, BW_FORMATS.findIndex(function(f) { return f[0] === bwCfg.format; }));
            bwCfg.format = BW_FORMATS[(i + (dir || 1) + BW_FORMATS.length) % BW_FORMATS.length][0]; saveBw();
            return true;
        }
        if (id === "bw_again") { closePause(); LevelManager.selectLevel("bedwars_sky"); return true; }
        return false;
    },

    onRestart: function() { LevelManager.selectLevel("bedwars_sky"); },
    overSub: function() { return BW.winner >= 0 ? (BW_TEAMS[BW.winner].name + " team wins") : "Bed Brawl"; },

    netState: function() { return { d: BW.drops.map(function(d) { return [d.kind.charAt(0), Math.round(d.x), Math.round(d.y)]; }), p: BW.phase, w: BW.winner, t: BW.tick, b: BW.beds.map(function(b) { return b ? b._nid : 0; }), f: BW.feed, u: BW.up }; },
    applyNetState: function(s) {
        var map = { i: "iron", g: "gold", d: "diamond" };
        BW.drops = s.d.map(function(a) { return { kind: map[a[0]], x: a[1], y: a[2] }; });
        BW.phase = s.p; BW.winner = s.w; BW.tick = s.t;
        if (s.f) BW.feed = s.f; if (s.u) BW.up = s.u;
        if (typeof Net !== "undefined") BW.beds = s.b.map(function(id) { return Net.objs.get(id) || { dead: true }; });
    }
});
