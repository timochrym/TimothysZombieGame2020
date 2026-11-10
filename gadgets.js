// ============================================================================
// GADGETS - reusable interactive level pieces for every game built on this engine.
//   Declared in a level as  gadgets: [ { type: "plate", ... }, ... ]  (world coordinates, +y up)
//
//   plate      { x, y(top surface), w, links:[ids] }          pressure plate: active while weighed down
//   switch     { x, y(bottom), links:[ids] }                  lever: interact (E) or shoot it to toggle
//   door       { id, x, y, w, h, invert }                     solid door, opens while any linked activator is on
//   lockdoor   { x, y, w, h, color }                          opens for a hero carrying the matching key
//   key        { x, y, color }                                collectible key
//   exit       { x, y(bottom) }                               level goal (calls mode.onExit)
//   spikes     { x, y(bottom), w }                            hazard (calls mode.onHazard, default: respawn)
//   checkpoint { x, y(bottom) }                               sets the hero's respawn point
//   mover      { x, y, w, h, x2, y2, speed, links }           moving platform (carries riders); links = only when powered
//   fan        { x, y(bottom), w, h, power }                  updraft column (heroes, crates, bodies float)
//   cracked    { x, y, w, h }                                 breakable wall: explosions destroy it
//   star       { x, y }                                       collectible (mode reads Gadgets.starsGot)
//   sign       { x, y(bottom), text }                         tutorial sign (text shows when a hero is near)
//   qblock     { x, y, item: coin|power|coins5|star|life }    ? block: hit from below -> mode.onBlockHit(ch, g) (default: a coin)
//   brick      { x, y, item? }                                breaks when mode.canBreak(ch) says so (default yes), else bumps
//   coin       { x, y }                                       floating coin -> mode.onCoin(ch, g)
//   goalpole   { x, y(bottom), h }                            grab it: mode.onGoal(ch, g, heightFraction 0..1), then onExit
// ============================================================================

// ---- Tiny pixel-art renderer (keeps the retro look consistent across games) ----
var PixelArt = {
    // sprite: array of strings, '.' = transparent, other chars index into palette
    draw: function(sprite, x, y, px, palette, flipX) {
        var rows = sprite.length, cols = sprite[0].length;
        for (let r = 0; r < rows; r++) {
            var row = sprite[r];
            for (let c = 0; c < cols; c++) {
                var ch = row[c];
                if (ch === "." || ch === " ") continue;
                var col = palette[ch];
                if (!col) continue;
                ctx.fillStyle = col;
                var cc = flipX ? (cols - 1 - c) : c;
                ctx.fillRect(Math.round(x + cc * px), Math.round(y + r * px), Math.ceil(px), Math.ceil(px));
            }
        }
    },
    sprites: {
        key: ["..yyy.......", ".y...y......", ".y...yyyyyyy", ".y...y..y.y.", "..yyy...y.y."],
        star: ["....y....", "....y....", "...yyy...", "yyyyyyyyy", ".yyyyyyy.", "..yyyyy..", "..yy.yy..", ".yy...yy."],
        flag: ["ggggg.", "gggggg", "ggggg.", "p.....", "p.....", "p.....", "p.....", "p....."]
    }
};

function wsx(x) { return x * cameraScaleX + xc; }
function wsy(y) { return -y * cameraScaleY + yc; }

var Gadgets = {
    list: [],
    byId: {},
    keys: {},
    starsGot: 0,
    starsTotal: 0,
    deaths: 0,
    tick: 0,

    clear: function() {
        this.list = [];
        this.byId = {};
        this.keys = {};
        this.starsGot = 0;
        this.starsTotal = 0;
        this.deaths = 0;
    },

    load: function(defs) {
        this.clear();
        if (!defs) return;
        for (let i = 0; i < defs.length; i++) this.add(defs[i]);
        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
    },

    add: function(d) {
        var g = {};
        for (var k in d) g[k] = d[k];
        g.links = g.links || [];
        g.active = false;
        if (g.type === "door" || g.type === "lockdoor" || g.type === "mover" || g.type === "cracked") {
            var opts = { name: g.type === "cracked" ? "Cracked Wall" : (g.type === "mover" ? "Moving Platform" : "Door"),
                texture: g.type === "cracked" ? "brick" : "lab_metal", kind: g.type === "mover" ? "block" : "wall" };
            var col = g.type === "lockdoor" ? (g.color || "#facc15") : (g.type === "cracked" ? "#a16207" : "#475569");
            g.obj = Object.addBox(g.x, g.y, g.w, g.h, col, opts);
            g.obj.gadget = g;
            g.topY = g.y + g.h / 2;
            g.progress = 0;
            if (g.type === "mover") { g.ax = g.x; g.ay = g.y; g.t = 0; g.dir = 1; g.speed = g.speed || 3; }
        }
        if (g.type === "qblock" || g.type === "brick") {
            g.w = g.w || 80; g.h = g.h || 80;
            g.obj = Object.addBox(g.x, g.y, g.w, g.h, g.type === "qblock" ? "#f59e0b" : "#b0462d",
                { name: g.type === "qblock" ? "? Block" : "Brick", texture: g.type === "qblock" ? "question_gold" : "brick", kind: "block" });
            g.obj.gadget = g;
            g.baseY = g.y; g.bump = 0;
            if (g.item === "coins5") g.hitsLeft = 5;
        }
        if (g.type === "goalpole") { g.h = g.h || 640; g.flagY = g.h - 40; }
        if (g.type === "star") this.starsTotal++;
        if (g.id) this.byId[g.id] = g;
        this.list.push(g);
        return g;
    },

    // anything that has weight: heroes, enemies, crates and ragdoll bodies
    weights: function() {
        var out = [];
        for (let i = 0; i < characters.length; i++) if (!characters[i].dead) out.push(characters[i]);
        for (let i = 0; i < zombies.length; i++) if (!zombies[i].dead) out.push(zombies[i]);
        for (let i = 0; i < movingObjects.length; i++) if (!movingObjects[i].dead && !movingObjects[i].heldBy) out.push(movingObjects[i]);
        return out;
    },

    // all activators wired to this id are on (and there is at least one)
    allPowered: function(id) {
        var n = 0;
        for (let i = 0; i < this.list.length; i++) {
            var g = this.list[i];
            if (g.links.indexOf(id) !== -1) { if (!g.active) return false; n++; }
        }
        return n > 0;
    },

    isPowered: function(id) {
        for (let i = 0; i < this.list.length; i++) {
            var g = this.list[i];
            if (g.active && g.links.indexOf(id) !== -1) return true;
        }
        return false;
    },

    killPlayer: function(ch, reason) {
        if (!ch || ch.dead || ch.invulnTimer > 0) return;
        this.deaths++;
        if (typeof Ragdolls !== "undefined") {
            var rd = Ragdolls.spawnFrom(ch, { corpse: true, life: 420, vx: ch.xspeed, vy: Math.max(ch.yspeed, 8) });
            rd.style.dead = true;
        }
        if (ch.liveRagdoll) { Ragdolls.remove(ch.liveRagdoll); ch.liveRagdoll = null; ch.ragdollTimer = 0; }
        if (ch.heldObject) { ch.heldObject.heldBy = null; ch.heldObject.noCollide = false; ch.heldObject = null; }
        if (ch.heldRagdoll) { ch.heldRagdoll.heldBy = null; ch.heldRagdoll = null; }
        Components.spawnSparks(ch.x, ch.y, "#ff4d5e", 12);
        if (typeof SFX !== "undefined") SFX.play("hurt", ch.x, ch.y);
        Components.addFloatingText(reason || "OUCH!", ch.x, ch.y + 90, "#ff6b6b", 20);
        var rx = (ch.respawnX !== undefined) ? ch.respawnX : ch.spawnX;
        var ry = (ch.respawnY !== undefined) ? ch.respawnY : ch.spawnY;
        ch.x = rx; ch.y = ry; ch.xspeed = ch.yspeed = 0;
        ch.invulnTimer = 70;
        ch.ragdollImmune = 60;
        ch.health = ch.maxHealth;
    },

    // ---------------------------------------------------------------- logic
    preUpdate: function() {
        if (this.list.length === 0) return;
        this.tick++;
        var moved = false;
        var weights = null;
        for (let i = 0; i < this.list.length; i++) {
            var g = this.list[i];
            if (g.type === "plate") {
                weights = weights || this.weights();
                var was = g.active;
                g.active = false;
                for (let j = 0; j < weights.length; j++) {
                    var e = weights[j];
                    var hw = (e.w || e.s1 || 40) / 2, bot = e.y - (e.h || e.s2 || 40) / 2;
                    if (Math.abs(e.x - g.x) < g.w / 2 + hw - 6 && bot > g.y - 14 && bot < g.y + 22) { g.active = true; break; }
                }
                if (!g.active && typeof Ragdolls !== "undefined") {
                    for (let j = 0; j < Ragdolls.list.length && !g.active; j++) {
                        var pts = Ragdolls.list[j].pts;
                        for (let q = 0; q < pts.length; q++) {
                            if (Math.abs(pts[q].x - g.x) < g.w / 2 && pts[q].y - pts[q].r < g.y + 14 && pts[q].y > g.y - 10) { g.active = true; break; }
                        }
                    }
                }
                if (g.active !== was && typeof SFX !== "undefined") SFX.play(g.active ? "select" : "ui", g.x, g.y);
            } else if (g.type === "door" || g.type === "lockdoor") {
                var wantOpen = g.type === "door" ? ((g.need === "all" ? this.allPowered(g.id) : this.isPowered(g.id)) !== !!g.invert) : !!g.unlocked;
                if (g.type === "lockdoor" && !g.unlocked) {
                    for (let j = 0; j < characters.length; j++) {
                        var c = characters[j];
                        if (this.keys[g.color] && Math.abs(c.x - g.x) < g.w / 2 + 90 && Math.abs(c.y - g.y) < g.h / 2 + 60) {
                            g.unlocked = true;
                            Components.addFloatingText("UNLOCKED!", g.x, g.topY + 40, "#facc15", 20);
                            if (typeof SFX !== "undefined") SFX.play("pickup", g.x, g.y);
                        }
                    }
                }
                var target = wantOpen ? 1 : 0;
                if (!wantOpen && g.progress > 0) {
                    // never close onto someone standing in the doorway
                    weights = weights || this.weights();
                    for (let j = 0; j < weights.length; j++) {
                        var e2 = weights[j];
                        if (Math.abs(e2.x - g.x) < g.w / 2 + (e2.w || e2.s1) / 2 && Math.abs(e2.y - g.y) < g.h / 2 + (e2.h || e2.s2) / 2) { target = g.progress; break; }
                    }
                }
                if (Math.abs(g.progress - target) > 0.001) {
                    g.progress += Math.sign(target - g.progress) * Math.min(0.06, Math.abs(target - g.progress));
                    var nh = Math.max(4, g.h * (1 - g.progress));
                    g.obj.resize(g.w, nh);
                    g.obj.y = g.topY - nh / 2;
                    var wasOpen = !!g.obj.noCollide;
                    g.obj.noCollide = g.progress > 0.97;
                    if (wasOpen !== g.obj.noCollide && typeof Pathfinder !== "undefined" && Pathfinder.invalidateRect) Pathfinder.invalidateRect(g.x, g.y, g.w, g.h);
                    moved = true;
                }
            } else if (g.type === "mover") {
                var on = !g.needsPower || this.isPowered(g.id);
                if (!on) continue;
                var len = Math.hypot(g.x2 - g.ax, g.y2 - g.ay) || 1;
                g.t += g.dir * g.speed / len;
                if (g.t >= 1) { g.t = 1; g.dir = -1; }
                if (g.t <= 0) { g.t = 0; g.dir = 1; }
                var nx = g.ax + (g.x2 - g.ax) * g.t, ny = g.ay + (g.y2 - g.ay) * g.t;
                var dx = nx - g.obj.x, dy = ny - g.obj.y;
                if (dx || dy) {
                    var top = g.obj.y + g.h / 2;
                    weights = weights || this.weights();
                    for (let j = 0; j < weights.length; j++) {
                        var r = weights[j];
                        var rb = r.y - (r.h || r.s2 || 40) / 2;
                        if (Math.abs(r.x - g.obj.x) < g.w / 2 + (r.w || r.s1 || 40) / 2 - 4 && Math.abs(rb - top) < 10) { r.x += dx; r.y += dy; }
                    }
                    g.obj.x = nx; g.obj.y = ny;
                    moved = true;
                }
            }
        }
        if (moved && typeof StaticGrid !== "undefined") StaticGrid.build();
    },

    update: function() {
        if (this.list.length === 0) return;
        for (let i = 0; i < this.list.length; i++) {
            var g = this.list[i];
            for (let j = 0; j < characters.length; j++) {
                var c = characters[j];
                if (c.dead || c.isCPU && g.type !== "fan") continue;
                var hw = c.s1 / 2, hh = c.s2 / 2;
                var bot = c.y - hh;
                if (g.type === "spikes") {
                    if (Math.abs(c.x - g.x) < g.w / 2 + hw - 10 && bot < g.y + 34 && c.y + hh > g.y) {
                        if (!GameModes.call("onHazard", c, g)) this.killPlayer(c, "SPIKED!");
                    }
                } else if (g.type === "checkpoint") {
                    if (Math.abs(c.x - g.x) < 70 && Math.abs(bot - g.y) < 120 && (c.respawnX !== g.x)) {
                        c.respawnX = g.x; c.respawnY = g.y + hh + 10;
                        if (!g.active) { g.active = true; Components.addFloatingText("CHECKPOINT!", g.x, g.y + 200, "#4ade80", 18); if (typeof SFX !== "undefined") SFX.play("pickup", g.x, g.y); }
                    }
                } else if (g.type === "key") {
                    if (!g.taken && Math.hypot(c.x - g.x, c.y - g.y) < 70) {
                        g.taken = true; this.keys[g.color] = true;
                        Components.addFloatingText("GOT THE KEY!", g.x, g.y + 60, "#facc15", 18);
                        if (typeof SFX !== "undefined") SFX.play("pickup", g.x, g.y);
                    }
                } else if (g.type === "star") {
                    if (!g.taken && Math.hypot(c.x - g.x, c.y - g.y) < 75) {
                        g.taken = true; this.starsGot++;
                        Components.addFloatingText("★ " + this.starsGot + "/" + this.starsTotal, g.x, g.y + 60, "#ffd23f", 20);
                        Components.spawnSparks(g.x, g.y, "#ffd23f", 12);
                        if (typeof SFX !== "undefined") SFX.play("coin", g.x, g.y);
                    }
                } else if (g.type === "exit") {
                    if (!g.done && Math.abs(c.x - g.x) < 70 && bot >= g.y - 10 && bot < g.y + 150) {
                        g.done = true;
                        if (typeof SFX !== "undefined") SFX.play("levelup", g.x, g.y);
                        GameModes.call("onExit", c, g);
                    }
                } else if (g.type === "switch") {
                    if (Math.abs(c.x - g.x) < 110 && Math.abs(bot - g.y) < 120 && pressedOnce(c, "sw" + i, !!c.abilityPressed)) this.toggle(g);
                } else if ((g.type === "qblock" || g.type === "brick") && !g.broken) {
                    // head-butt from below: was rising last tick, now stopped by the block's underside
                    var head = c.y + hh, under = g.obj.y - g.h / 2;
                    if (Math.abs(c.x - g.x) < g.w / 2 + hw * 0.45 && head > under - 10 && head < under + 14 && (c._vyPrev || 0) > 1 && c.yspeed <= 0.5) this.hitBlock(g, c);
                } else if (g.type === "coin") {
                    if (!g.taken && Math.abs(c.x - g.x) < hw + 22 && Math.abs(c.y - g.y) < hh + 26) {
                        g.taken = true;
                        if (!GameModes.call("onCoin", c, g)) { Components.addFloatingText("+1", g.x, g.y + 40, "#ffd23f", 16); if (typeof SFX !== "undefined") SFX.play("coin", g.x, g.y); }
                    }
                } else if (g.type === "goalpole") {
                    if (!g.done && Math.abs(c.x - g.x) < hw + 16 && bot > g.y - 20 && bot < g.y + g.h + 60) {
                        g.done = true;
                        var frac = Math.max(0, Math.min(1, (bot - g.y) / g.h));
                        g.grabY = Math.max(0, bot - g.y);
                        if (typeof SFX !== "undefined") SFX.play("levelup", g.x, g.y);
                        GameModes.call("onGoal", c, g, frac);
                        GameModes.call("onExit", c, g);
                    }
                }
            }
            if (g.type === "switch") {
                for (let l = lazers.length - 1; l >= 0; l--) {
                    var lz = lazers[l];
                    if (lz.team === 1 && Math.abs(lz.x - g.x) < 34 && lz.y > g.y && lz.y < g.y + 90) { this.toggle(g); lazers.splice(l, 1); }
                }
            }
            if (g.type === "fan") this.applyFan(g);
            if ((g.type === "qblock" || g.type === "brick") && g.obj && !g.broken) {
                if (g.bump > 0) { g.bump--; g.obj.y = g.baseY + Math.sin((10 - g.bump) / 10 * Math.PI) * 14; }
                else g.obj.y = g.baseY;
            }
            if (g.type === "goalpole" && g.done && g.flagY > (g.grabY || 0)) g.flagY = Math.max(g.grabY || 0, g.flagY - 9);
        }
        for (let j = 0; j < characters.length; j++) characters[j]._vyPrev = characters[j].yspeed;
    },

    hitBlock: function(g, c) {
        if (g.bump > 0) return;
        g.bump = 10;
        var top = g.baseY + g.h / 2;
        // anything standing on the block gets knocked off
        for (let z = 0; z < zombies.length; z++) {
            var zz = zombies[z];
            if (!zz.dead && Math.abs(zz.x - g.x) < g.w / 2 + zz.s1 / 2 && Math.abs((zz.y - zz.s2 / 2) - top) < 16) zz.takeDamage(-999, (zz.x > g.x ? 4 : -4), 10, c);
        }
        if (g.type === "brick") {
            var big = GameModes.has("canBreak") ? GameModes.call("canBreak", c) : true;
            if (g.item && !g.used) { g.used = true; g.type = "qblock"; g.obj.texture = "solid"; g.obj.color = "#8b5a2b"; GameModes.call("onBlockHit", c, g); return; }
            if (!big) { if (typeof SFX !== "undefined") SFX.play("ui", g.x, g.y); return; }
            g.broken = true;
            g.obj.dead = true;
            var idx = staticObjects.indexOf(g.obj);
            if (idx !== -1) staticObjects.splice(idx, 1);
            for (let k = 0; k < 8; k++) particles.push({ x: g.x + (Math.random() - 0.5) * g.w, y: g.y + (Math.random() - 0.5) * g.h, w: 22, h: 22, xspeed: (Math.random() - 0.5) * 14, yspeed: 8 + Math.random() * 10, poly: Math.makeHitbox(22, 22), color: "#b0462d", life: 50 });
            if (typeof SFX !== "undefined") SFX.play("explode", g.x, g.y, 0.5, 1.6);
            GameModes.call("onBrickBreak", c, g);
            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            if (typeof Pathfinder !== "undefined" && Pathfinder.invalidateRect) Pathfinder.invalidateRect(g.x, g.y, g.w, g.h);
            return;
        }
        if (g.used) { if (typeof SFX !== "undefined") SFX.play("ui", g.x, g.y); return; }
        if (g.item === "coins5" && --g.hitsLeft > 0) { GameModes.call("onBlockHit", c, g) || this.popCoin(g); return; }
        g.used = true;
        g.obj.texture = "solid"; g.obj.color = "#8b5a2b";
        if (!GameModes.call("onBlockHit", c, g)) this.popCoin(g);
    },

    popCoin: function(g) {
        Components.addFloatingText("+1 🪙", g.x, g.baseY + g.h / 2 + 60, "#ffd23f", 18);
        Components.spawnSparks(g.x, g.baseY + g.h / 2 + 20, "#ffd23f", 6);
        if (typeof SFX !== "undefined") SFX.play("coin", g.x, g.y);
    },

    toggle: function(g) {
        g.active = !g.active;
        if (typeof SFX !== "undefined") SFX.play("select", g.x, g.y);
        Components.spawnSparks(g.x, g.y + 50, "#7ff0ff", 6);
    },

    applyFan: function(g) {
        var p = g.power || 1.6;
        var inCol = function(x, y) { return Math.abs(x - g.x) < g.w / 2 && y > g.y && y < g.y + g.h; };
        var ents = this.weights();
        for (let j = 0; j < ents.length; j++) {
            var e = ents[j];
            if (inCol(e.x, e.y)) {
                var lift = p * (1 - (e.y - g.y) / g.h * 0.6);
                e.yspeed = Math.min(e.yspeed + lift, 13);
                if (e.isPlayer) { e.onGround = false; e.fastFalling = false; }
            }
        }
        if (typeof Ragdolls !== "undefined") {
            for (let j = 0; j < Ragdolls.list.length; j++) {
                var rd = Ragdolls.list[j];
                if (inCol(rd.centerX(), rd.centerY())) { rd.addVelocity(0, p * 0.6); }
            }
        }
        if (Math.random() < 0.5) particles.push({ x: g.x + (Math.random() - 0.5) * g.w, y: g.y + 20, w: 4, h: 18, xspeed: 0, yspeed: 9 + Math.random() * 5, poly: Math.makeHitbox(4, 18), color: "rgba(200,240,255,0.5)", life: 22 });
    },

    onExplosion: function(x, y, radius) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            var g = this.list[i];
            if (g.type !== "cracked" || g.broken) continue;
            var dx = Math.max(Math.abs(x - g.x) - g.w / 2, 0), dy = Math.max(Math.abs(y - g.y) - g.h / 2, 0);
            if (Math.hypot(dx, dy) < radius * 0.6) {
                g.broken = true;
                g.obj.dead = true;
                var idx = staticObjects.indexOf(g.obj);
                if (idx !== -1) staticObjects.splice(idx, 1);
                for (let k = 0; k < 14; k++) {
                    particles.push({ x: g.x + (Math.random() - 0.5) * g.w, y: g.y + (Math.random() - 0.5) * g.h, w: 18, h: 18, xspeed: (Math.random() - 0.5) * 16, yspeed: Math.random() * 14, poly: Math.makeHitbox(18, 18), color: "#a16207", life: 50 });
                }
                Components.addFloatingText("CRUMBLE!", g.x, g.y + g.h / 2 + 40, "#fbbf24", 20);
                if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                if (typeof Pathfinder !== "undefined" && Pathfinder.invalidateRect) Pathfinder.invalidateRect(g.x, g.y, g.w, g.h);
            }
        }
    },

    // ---------------------------------------------------------------- drawing (retro pixel style)
    draw: function() {
        if (this.list.length === 0) return;
        var k = cameraScaleX;
        var t = this.tick;
        for (let i = 0; i < this.list.length; i++) {
            var g = this.list[i];
            var sx = wsx(g.x), sy = wsy(g.y);
            if (sx < -400 || sx > cssW + 400 || sy < -400 || sy > cssH + 500) continue;
            ctx.save();
            if (g.type === "plate") {
                var pw = g.w * k, ph = 16 * k, press = g.active ? 8 * k : 0;
                ctx.fillStyle = "#1f2937"; ctx.fillRect(sx - pw / 2 - 6 * k, sy - 6 * k, pw + 12 * k, 10 * k);
                ctx.fillStyle = g.active ? "#4ade80" : "#ef4444";
                ctx.fillRect(sx - pw / 2, sy - ph + press, pw, ph - press);
                ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(sx - pw / 2, sy - ph + press, pw, 3 * k);
                ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2; ctx.strokeRect(sx - pw / 2, sy - ph + press, pw, ph - press);
            } else if (g.type === "door" || g.type === "lockdoor") {
                if (!g.obj.noCollide) {
                    var top = wsy(g.topY), dh = g.obj.h * k, dw = g.w * k;
                    // hazard stripes so doors read clearly as doors
                    ctx.beginPath(); ctx.rect(sx - dw / 2, top, dw, dh); ctx.clip();
                    ctx.fillStyle = g.type === "lockdoor" ? "rgba(250,204,21,0.35)" : (this.isPowered(g.id) ? "rgba(74,222,128,0.25)" : "rgba(239,68,68,0.22)");
                    for (let s = -dh; s < dh + dw; s += 26 * k) { ctx.beginPath(); ctx.moveTo(sx - dw / 2 + s, top); ctx.lineTo(sx - dw / 2 + s + 12 * k, top); ctx.lineTo(sx - dw / 2 + s - dh + 12 * k, top + dh); ctx.lineTo(sx - dw / 2 + s - dh, top + dh); ctx.fill(); }
                    if (g.type === "lockdoor") PixelArt.draw(PixelArt.sprites.key, sx - 18 * k, top + dh / 2 - 8 * k, 3 * k, { y: g.color || "#facc15" });
                }
            } else if (g.type === "switch") {
                ctx.fillStyle = "#374151"; ctx.fillRect(sx - 22 * k, sy - 24 * k, 44 * k, 24 * k);
                ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2; ctx.strokeRect(sx - 22 * k, sy - 24 * k, 44 * k, 24 * k);
                var ang = g.active ? 0.6 : -0.6;
                ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 6 * k; ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(sx, sy - 18 * k); ctx.lineTo(sx + Math.sin(ang) * 46 * k, sy - 18 * k - Math.cos(ang) * 46 * k); ctx.stroke();
                ctx.fillStyle = g.active ? "#4ade80" : "#ef4444";
                ctx.beginPath(); ctx.arc(sx + Math.sin(ang) * 46 * k, sy - 18 * k - Math.cos(ang) * 46 * k, 9 * k, 0, 7); ctx.fill();
                if (this.nearHero(g.x, g.y, 120)) uiText("E / shoot", sx, sy - 80 * k, 12, "#7ff0ff", "center", "800");
            } else if (g.type === "exit") {
                var ew = 110 * k, eh = 170 * k;
                ctx.fillStyle = "#14532d"; ctx.fillRect(sx - ew / 2, sy - eh, ew, eh);
                ctx.fillStyle = g.done ? "#4ade80" : "#052e16"; ctx.fillRect(sx - ew / 2 + 10 * k, sy - eh + 10 * k, ew - 20 * k, eh - 10 * k);
                ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 3; ctx.strokeRect(sx - ew / 2, sy - eh, ew, eh);
                var bob = Math.sin(t * 0.08) * 4 * k;
                ctx.fillStyle = "#4ade80"; ctx.fillRect(sx - 34 * k, sy - eh - 34 * k + bob, 68 * k, 24 * k);
                ctx.fillStyle = "#052e16"; ctx.font = "900 " + Math.max(9, Math.round(16 * k)) + "px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText("EXIT", sx, sy - eh - 22 * k + bob);
            } else if (g.type === "spikes") {
                var n = Math.max(2, Math.round(g.w / 30));
                var sw = g.w * k / n;
                ctx.fillStyle = "#cbd5e1"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 1.5;
                for (let s = 0; s < n; s++) {
                    var bx = sx - g.w * k / 2 + s * sw;
                    ctx.beginPath(); ctx.moveTo(bx, sy); ctx.lineTo(bx + sw / 2, sy - 34 * k); ctx.lineTo(bx + sw, sy); ctx.closePath(); ctx.fill(); ctx.stroke();
                }
            } else if (g.type === "checkpoint") {
                PixelArt.draw(PixelArt.sprites.flag, sx - 4 * k, sy - 8 * 18 * k, 18 * k, { g: g.active ? "#4ade80" : "#6b7280", p: "#e5e7eb" });
            } else if (g.type === "key" && !g.taken) {
                PixelArt.draw(PixelArt.sprites.key, sx - 30 * k, sy - 12 * k + Math.sin(t * 0.08) * 5 * k, 5 * k, { y: g.color || "#facc15" });
            } else if (g.type === "star" && !g.taken) {
                var sc = Math.abs(Math.cos(t * 0.05));
                ctx.translate(sx, sy + Math.sin(t * 0.07) * 6 * k);
                ctx.scale(Math.max(0.2, sc), 1);
                PixelArt.draw(PixelArt.sprites.star, -27 * k, -24 * k, 6 * k, { y: "#ffd23f" });
            } else if (g.type === "fan") {
                var fw = g.w * k;
                ctx.fillStyle = "#334155"; ctx.fillRect(sx - fw / 2, sy - 20 * k, fw, 20 * k);
                ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2; ctx.strokeRect(sx - fw / 2, sy - 20 * k, fw, 20 * k);
                ctx.fillStyle = "rgba(186,230,253,0.07)"; ctx.fillRect(sx - fw / 2, wsy(g.y + g.h), fw, g.h * k - 20 * k);
                ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 4 * k;
                var spin = t * 0.5;
                for (let b = 0; b < 4; b++) { var a = spin + b * Math.PI / 2; ctx.beginPath(); ctx.moveTo(sx, sy - 10 * k); ctx.lineTo(sx + Math.cos(a) * fw * 0.4, sy - 10 * k + Math.sin(a) * 4 * k); ctx.stroke(); }
            } else if (g.type === "cracked" && !g.broken) {
                var cw = g.w * k, chh = g.h * k, cty = wsy(g.y + g.h / 2);
                ctx.strokeStyle = "rgba(10,15,22,0.8)"; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(sx - cw * 0.3, cty); ctx.lineTo(sx, cty + chh * 0.3); ctx.lineTo(sx - cw * 0.15, cty + chh * 0.55); ctx.lineTo(sx + cw * 0.2, cty + chh); ctx.stroke();
                if (this.nearHero(g.x, g.y, 300)) uiText("💥 cracked - blow it up", sx, cty - 14, 12, "#fbbf24", "center", "800");
            } else if (g.type === "coin" && !g.taken) {
                var cw2 = Math.max(0.15, Math.abs(Math.cos(t * 0.06 + g.x * 0.01)));
                ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.ellipse(sx, sy, 22 * k * cw2, 28 * k, 0, 0, 7); ctx.fill();
                ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.ellipse(sx, sy, 14 * k * cw2, 20 * k, 0, 0, 7); ctx.fill();
                ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, 22 * k * cw2, 28 * k, 0, 0, 7); ctx.stroke();
            } else if (g.type === "goalpole") {
                var ptop = wsy(g.y + g.h);
                ctx.fillStyle = "#e2e8f0"; ctx.fillRect(sx - 5 * k, ptop, 10 * k, sy - ptop);
                ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2; ctx.strokeRect(sx - 5 * k, ptop, 10 * k, sy - ptop);
                ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(sx, ptop, 14 * k, 0, 7); ctx.fill(); ctx.stroke();
                var fy = wsy(g.y + g.flagY);
                ctx.fillStyle = "#f43f5e"; ctx.beginPath(); ctx.moveTo(sx - 5 * k, fy); ctx.lineTo(sx - 85 * k, fy + 26 * k); ctx.lineTo(sx - 5 * k, fy + 52 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.fillStyle = "#475569"; ctx.fillRect(sx - 40 * k, sy - 40 * k, 80 * k, 40 * k); ctx.strokeRect(sx - 40 * k, sy - 40 * k, 80 * k, 40 * k);
            } else if (g.type === "sign") {
                ctx.fillStyle = "#7c4a1e"; ctx.fillRect(sx - 4 * k, sy - 70 * k, 8 * k, 70 * k);
                ctx.fillStyle = "#b07a3c"; ctx.fillRect(sx - 34 * k, sy - 96 * k, 68 * k, 40 * k);
                ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2; ctx.strokeRect(sx - 34 * k, sy - 96 * k, 68 * k, 40 * k);
                ctx.fillStyle = "#0a0f16"; ctx.font = "900 " + Math.max(10, Math.round(22 * k)) + "px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", sx, sy - 76 * k);
                if (this.nearHero(g.x, g.y, 420)) {
                    ctx.font = "700 14px 'Segoe UI', Arial, sans-serif";
                    var lines = String(g.text).split("\n");
                    var tw = 0;
                    for (let li = 0; li < lines.length; li++) tw = Math.max(tw, ctx.measureText(lines[li]).width);
                    var bx2 = sx - tw / 2 - 12, by2 = sy - 110 * k - 24 - lines.length * 18;
                    uiPanel(bx2, by2, tw + 24, lines.length * 18 + 16, "#fbbf24", 0.92);
                    for (let li = 0; li < lines.length; li++) uiText(lines[li], sx, by2 + 22 + li * 18, 14, "#fde68a", "center", "700");
                }
            }
            ctx.restore();
        }
    },

    nearHero: function(x, y, r) {
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (!c.dead && !c.isCPU && Math.hypot(c.x - x, c.y - y) < r) return true;
        }
        return false;
    }
};
