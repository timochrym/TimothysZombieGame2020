// ============================================================================
// GAME INSPECTOR - lets the Cheats & tuning panel's Inspect tab pick and edit anything a game is made of, not just
// blocks, crates and enemies. In ✋ Edit mode a click asks, in order:
//   1. the game's own `inspect(x, y)` (or GAME_INSPECT[id])  - beds, generators, riders, fighters, pets, water...
//   2. the generic inspectors                                - any hero / CPU player, any ragdoll
//   3. the old block / crate / enemy inspector
// A description: { title, sub, pos() -> [x, y], fields: [tuning rows like tunables.js], actions: [{ label, fn }] }.
// Full-screen games (no world to click) show `matchState()` (or GAME_MATCH_STATE[id]) on the Inspect tab instead.
// ============================================================================
var GameInspect = {
    sel: null,
    find: function(wx, wy) {
        var m = GameModes.current, d = null;
        try {
            if (m && typeof m.inspect === "function") d = m.inspect(wx, wy);
            if (!d && m && GAME_INSPECT[m.id]) d = GAME_INSPECT[m.id](wx, wy);
        } catch (e) { d = null; }
        return d || this.generic(wx, wy);
    },
    near: function(o, wx, wy, pad) { return Math.abs(o.x - wx) < (o.s1 || o.w || 60) / 2 + (pad || 8) && Math.abs(o.y - wy) < (o.s2 || o.h || 60) / 2 + (pad || 8); },
    generic: function(wx, wy) {
        for (let i = 0; i < characters.length; i++) { var c = characters[i]; if (!c.dead && !c.liveRagdoll && (c.isPlayer || !c.isZombie) && this.near(c, wx, wy)) return this.charCard(c); }
        if (typeof Ragdolls !== "undefined") for (let i = Ragdolls.list.length - 1; i >= 0; i--) {
            var rd = Ragdolls.list[i];
            if (rd.pts.some(function(p) { return Math.hypot(p.x - wx, p.y - wy) < (p.r || 8) + 14; })) return this.ragdollCard(rd);
        }
        return null;
    },
    charCard: function(c) {
        return { title: (c.playerLabel || c.name || "Character") + (c.isCPU ? "  (CPU)" : c.isRemote ? "  (LAN)" : ""), sub: "a player", pos: function() { return [c.x, c.y]; },
            fields: [
                { label: "Health", type: "range", min: 0, max: 500, step: 1, get: function() { return Math.round(c.health); }, set: function(v) { c.health = Math.min(v, c.maxHealth); } },
                { label: "Max health", type: "range", min: 10, max: 500, step: 10, get: function() { return c.maxHealth; }, set: function(v) { c.maxHealth = v; c.health = Math.min(c.health, v); } },
                { label: "Speed", type: "range", min: 4, max: 60, step: 1, get: function() { return Math.round(c.maxspeed); }, set: function(v) { c.maxspeed = v; } }
            ],
            actions: [{ label: "❤ Heal", fn: function() { c.health = c.maxHealth; } }] };
    },
    ragdollCard: function(rd) {
        return { title: rd.isVehicle ? "Rider + vehicle" : (rd.style && rd.style.kind === "ball" ? "Ball / weight" : "Ragdoll"), sub: rd.pts.length + " joints", pos: function() { return [rd.centerX(), rd.centerY()]; },
            fields: [{ label: "Speed", type: "text", get: function() { return Math.round(Math.hypot(rd.velX(), rd.velY())) + " px/frame"; } }],
            actions: [{ label: "⬆ Fling up", fn: function() { rd.addVelocity(0, 30); } }] };
    }
};

var GAME_INSPECT = {
    bedwars: function(wx, wy) {
        for (let t = 0; t < BW.beds.length; t++) {
            var bed = BW.beds[t];
            if (bed && !bed.dead && GameInspect.near(bed, wx, wy, 20)) return (function(b, t) { return { title: "🛏 " + BW_TEAMS[t].name + " bed", sub: "break it and that team stops respawning", pos: function() { return [b.x, b.y]; },
                fields: [{ label: "Bed health", type: "range", min: 1, max: b.buildMaxHP, step: 5, get: function() { return Math.round(b.buildHP); }, set: function(v) { b.buildHP = v; } }],
                actions: [{ label: "Repair", fn: function() { b.buildHP = b.buildMaxHP; } }] }; })(bed, t);
        }
        for (let g = 0; g < BW.gens.length; g++) {
            var gen = BW.gens[g];
            if (Math.abs(gen.x - wx) < 60 && Math.abs(gen.y - wy) < 50) return (function(gen) { return { title: "⚙ Generator", sub: gen.kinds.join(" + "), pos: function() { return [gen.x, gen.y]; },
                fields: [{ label: "All generators' speed", type: "range", min: 0.5, max: 3, step: 0.25, get: function() { return bwCfg.genMult || 1; }, set: function(v) { bwCfg.genMult = v; } }],
                actions: [{ label: "Drop 5 now", fn: function() { for (let i = 0; i < 5; i++) BW.drops.push({ kind: gen.kinds[0], x: gen.x + (i - 2) * 16, y: 30, t: 0 }); } }] }; })(gen);
        }
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (c.dead || !GameInspect.near(c, wx, wy)) continue;
            var card = GameInspect.charCard(c);
            ["Iron", "Gold", "Diamond"].forEach(function(r) { card.fields.push({ label: r, type: "range", min: 0, max: 99, step: 1, get: function() { return c["bw" + r] || 0; }, set: function(v) { c["bw" + r] = v; } }); });
            return card;
        }
        return null;
    },
    brawl: function(wx, wy) {
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (c.dead || c.eliminated || !GameInspect.near(c, wx, wy)) continue;
            return { title: (c.playerLabel || "Fighter") + (c.isCPU ? "  (CPU)" : ""), sub: "Brawl fighter", pos: function() { return [c.x, c.y]; },
                fields: [{ label: "Damage %", type: "range", min: 0, max: 300, step: 5, get: function() { return Math.round(c.damagePct || 0); }, set: function(v) { c.damagePct = v; } },
                         { label: "Stocks left", type: "range", min: 1, max: 9, step: 1, get: function() { return c.stocks || 1; }, set: function(v) { c.stocks = v; } }],
                actions: [{ label: "Reset %", fn: function() { c.damagePct = 0; } }] };
        }
        return null;
    },
    wheels: function(wx, wy) {
        for (let i = 0; i < Wheels.riders.length; i++) {
            var rd = Wheels.riders[i];
            if (!rd.pts.some(function(p) { return Math.hypot(p.x - wx, p.y - wy) < (p.r || 8) + 16; })) continue;
            return (function(rd) { return { title: "🚲 Rider P" + ((rd.wheelsSlot || 0) + 1) + " on the " + rd.def.label, sub: rd.def.sp, pos: function() { var q = rd.pts[rd.vbase]; return [q.x, q.y]; },
                fields: [{ label: "Crashed", type: "text", get: function() { return rd.crashed ? "yes" : "no"; } },
                         { label: "Engine power (all riders)", type: "range", min: 0.5, max: 2.5, step: 0.1, get: function() { return Wheels.powerMult || 1; }, set: function(v) { Wheels.powerMult = v; } }],
                actions: [{ label: "Eject rider", fn: function() { wheelsEject(rd); } }, { label: "Restart course", fn: function() { LevelManager.selectLevel(LevelManager.currentLevelKey); } }] }; })(rd);
        }
        return null;
    },
    dummy: function(wx, wy) {
        var rd = Dummy.rd;
        if (!rd || !rd.pts.some(function(p) { return Math.hypot(p.x - wx, p.y - wy) < (p.r || 8) + 16; })) return null;
        return { title: "🧪 Crash-test dummy", sub: "bones broken: " + Dummy.bones, pos: function() { return [rd.centerX(), rd.centerY()]; },
            fields: [{ label: "Damage so far", type: "text", get: function() { return Math.round(Dummy.total); } }],
            actions: [{ label: "New dummy", fn: function() { GameModes.current.onKey("KeyR"); } }, { label: "⬆ Launch", fn: function() { rd.addVelocity(8, 34); } }] };
    },
    terra: function(wx, wy) {
        // a tile: change what it is (or dig it), and the inventory of the hero
        var c = terraCol(wx), r = terraRow(wy), t = terraGet(c, r);
        if (t === undefined) return null;
        var tx = (c - TERRA.W / 2 + 0.5) * TERRA.T, ty = TERRA.TOP - (r + 0.5) * TERRA.T;
        return { title: "⛏ Tile: " + TILES[t][0], sub: "column " + c + ", row " + r + (TERRA_NEED[TILES[t][0]] ? " · needs pickaxe tier " + TERRA_NEED[TILES[t][0]] : ""), pos: function() { return [tx, ty]; },
            fields: [{ label: "Block", type: "choice", options: TILES.map(function(T, i) { return [i, T[0]]; }), get: function() { return terraGet(c, r); }, set: function(v) { terraSet(c, r, v); } },
                     { label: "Your " + (TILES[t][4] || "dirt"), type: "range", min: 0, max: 99, step: 1, get: function() { return TERRA.inv[TILES[t][4] || "dirt"] || 0; }, set: function(v) { TERRA.inv[TILES[t][4] || "dirt"] = v; } }],
            actions: [{ label: "Dig it out", fn: function() { terraSet(c, r, TILE_ID.air); } }, { label: "Make it stone", fn: function() { terraSet(c, r, TILE_ID.stone); } }] };
    },
    words: function(wx, wy) {
        for (let i = 0; i < movingObjects.length; i++) {
            var o = movingObjects[i];
            if (!o.pet || o.dead || !GameInspect.near(o, wx, wy)) continue;
            return { title: "🐾 " + o.name, sub: "a pet that follows you", pos: function() { return [o.x, o.y]; },
                fields: [{ label: "Size", type: "range", min: 30, max: 160, step: 5, get: function() { return Math.round(o.w); }, set: function(v) { o.resize ? o.resize(v, v) : (o.w = o.h = v); } }],
                actions: [{ label: "Send home", fn: function() { o.x = redGuy.x - 80; o.y = redGuy.y; } }] };
        }
        for (let i = 0; i < WordLab.waters.length; i++) {
            var W = WordLab.waters[i];
            if (Math.abs(W.x - wx) < W.w / 2 && Math.abs(W.y - wy) < W.h / 2) return { title: "💧 Water", sub: "swim with W / Space", pos: function() { return [W.x, W.y]; },
                fields: [{ label: "Width", type: "range", min: 100, max: 2000, step: 20, get: function() { return W.w; }, set: function(v) { W.w = v; } }],
                actions: [{ label: "Drain", fn: function() { WordLab.waters.splice(WordLab.waters.indexOf(W), 1); GameInspect.sel = null; SummonManager.selectObject(null); } }] };
        }
        return null;
    }
};

// what the full-screen games show on the Inspect tab (live, read-only)
var GAME_MATCH_STATE = {
    table: function() { var g = (TABLE_GAMES.filter(function(x) { return x[0] === tableCfg.game; })[0] || ["", ""])[1]; var S = { flick: Flick.score, hockey: Hockey.score, arty: Arty.tank && Arty.tank.map(function(t) { return t.hp + " HP"; }), pool: Pool.score, darts: Darts.score, hunt: WordHunt.score }[tableCfg.game]; return [["Game", g], ["vs", tableCfg.vs === "cpu" ? "CPU" : "2 players"], ["RED", S ? S[0] : "-"], ["BLUE", S ? S[1] : "-"]]; },
    property: function() { return [["Round", Rent.round]].concat(Rent.pl.map(function(p) { return [p.name, p.out ? "bankrupt" : "$" + p.cash]; })); },
    party: function() { return [["Round", Party.round + " / " + partyCfg.rounds]].concat(Party.pl.map(function(p) { return [p.name, "★ " + p.stars + " · " + p.coins + " coins"]; })); }
};

// ============================================================================
// UNIVERSAL INSPECT - Works across ALL 24 games (standard world + ownScreen arenas)
// ============================================================================
var UniversalInspect = {
    hovered: null,
    selected: null,
    followTarget: null,

    arenaCam: function() {
        var id = GameModes.current ? GameModes.current.id : "";
        if (id === "mix" && typeof Mix !== "undefined") return Mix.cam;
        if (id === "tanks" && typeof Tanks !== "undefined") return Tanks.cam;
        if (id === "cells" && typeof Cells !== "undefined") return Cells.cam;
        if (id === "snake" && typeof Snake !== "undefined") return Snake.cam;
        return null;
    },

    screenToWorld: function(sx, sy) {
        var ac = this.arenaCam();
        if (ac) {
            var z = ac.z || 1;
            return { x: (sx - cssW / 2) / z + ac.x, y: (sy - cssH / 2) / z + ac.y };
        }
        var s = (typeof cameraScaleX !== "undefined" && cameraScaleX) ? cameraScaleX : 1;
        var x0 = (typeof xc !== "undefined") ? xc : 0;
        var y0 = (typeof yc !== "undefined") ? yc : 0;
        return { x: (sx - x0) / s, y: (y0 - sy) / s };
    },

    worldToScreen: function(wx, wy) {
        var ac = this.arenaCam();
        if (ac) {
            var z = ac.z || 1;
            return { x: (wx - ac.x) * z + cssW / 2, y: (wy - ac.y) * z + cssH / 2, scale: z };
        }
        var s = (typeof cameraScaleX !== "undefined" && cameraScaleX) ? cameraScaleX : 1;
        var x0 = (typeof xc !== "undefined") ? xc : 0;
        var y0 = (typeof yc !== "undefined") ? yc : 0;
        return { x: x0 + wx * s, y: y0 - wy * s, scale: s };
    },

    findAt: function(sx, sy) {
        var id = GameModes.current ? GameModes.current.id : "";
        var w = this.screenToWorld(sx, sy);
        var wx = w.x, wy = w.y;

        // 1. Arena IO games (mix, tanks, cells, snake)
        if (id === "mix" || id === "tanks" || id === "cells" || id === "snake") {
            if (typeof Tanks !== "undefined" && (id === "mix" || id === "tanks")) {
                for (var i = Tanks.tanks.length - 1; i >= 0; i--) {
                    var k = Tanks.tanks[i];
                    if (!k.alive) continue;
                    var r = Tanks.size(k);
                    if (Math.hypot(k.x - wx, k.y - wy) <= r + 14) return this._tankDesc(k);
                }
                for (var j = Tanks.shapes.length - 1; j >= 0; j--) {
                    var sh = Tanks.shapes[j], S = TNK_SHAPES[sh.type];
                    if (Math.hypot(sh.x - wx, sh.y - wy) <= (S ? S.r : 20) + 10) return this._shapeDesc(sh, S);
                }
            }
            if (typeof Cells !== "undefined" && (id === "mix" || id === "cells")) {
                for (var bi = Cells.blobs.length - 1; bi >= 0; bi--) {
                    var b = Cells.blobs[bi], br = Cells.rad(b.m);
                    if (Math.hypot(b.x - wx, b.y - wy) <= br + 12) return this._blobDesc(b);
                }
                for (var vi = Cells.viruses.length - 1; vi >= 0; vi--) {
                    var v = Cells.viruses[vi], vr = Cells.rad(v.m || 100);
                    if (Math.hypot(v.x - wx, v.y - wy) <= vr + 12) return this._virusDesc(v);
                }
            }
            if (typeof Snake !== "undefined" && (id === "mix" || id === "snake")) {
                var bestWm = null, bestD = Infinity;
                for (var wi = Snake.worms.length - 1; wi >= 0; wi--) {
                    var wm = Snake.worms[wi];
                    if (!wm.alive || !wm.segs.length) continue;
                    var wr = Snake.radius(wm) + 18;
                    for (var si = 0; si < wm.segs.length; si++) {
                        var sd = Math.hypot(wm.segs[si].x - wx, wm.segs[si].y - wy);
                        if (sd <= wr && sd < bestD) { bestD = sd; bestWm = wm; }
                    }
                }
                if (bestWm) return this._wormDesc(bestWm);
            }
            return null;
        }

        // 2. Zombie Ball: Ball & Flail Soccer Physics players
        if (id === "sport" && typeof Ball !== "undefined") {
            if (Math.hypot(Ball.x - wx, Ball.y - wy) <= Ball.r + 16) return this._ballDesc();
            if (typeof Flail !== "undefined" && Flail.on()) {
                for (var fi = Flail.men.length - 1; fi >= 0; fi--) {
                    var fm = Flail.men[fi];
                    if (fm.pts.some(function(p) { return Math.hypot(p.x - wx, p.y - wy) < (p.r || 20) + 26; })) {
                        return this._flailDesc(fm);
                    }
                }
            }
        }

        // 3. Mode-specific GameInspect (Bedwars, Brawl, Terra, Wheels, Dummy, Words)
        var extra = GameInspect.find(wx, wy);

        // 4. Characters (players & CPUs)
        for (var ci = characters.length - 1; ci >= 0; ci--) {
            var c = characters[ci];
            if (!c.dead && GameInspect.near(c, wx, wy, 14)) return this._charDesc(c, extra);
        }

        // 5. Zombies / Enemies
        for (var zi = zombies.length - 1; zi >= 0; zi--) {
            var z = zombies[zi];
            if (!z.dead && GameInspect.near(z, wx, wy, 14)) return this._charDesc(z, extra);
        }

        // 6. Ragdolls
        if (typeof Ragdolls !== "undefined") {
            for (var ri = Ragdolls.list.length - 1; ri >= 0; ri--) {
                var rd = Ragdolls.list[ri];
                if (rd.pts.some(function(p) { return Math.hypot(p.x - wx, p.y - wy) < (p.r || 10) + 18; })) {
                    return this._ragdollDesc(rd, extra);
                }
            }
        }

        // 7. Static & Moving Objects (floors, platforms, walls, crates)
        var objs = [].concat(movingObjects || [], staticObjects || []);
        for (var oi = objs.length - 1; oi >= 0; oi--) {
            var o = objs[oi];
            if (!o || o.dead) continue;
            var hw = (o.w || o.s1 || 40) / 2 + 8, hh = (o.h || o.s2 || 40) / 2 + 8;
            if (Math.abs(o.x - wx) <= hw && Math.abs(o.y - wy) <= hh) return this._objDesc(o, extra);
        }

        // 8. Fallback to mode-specific tile/water/etc.
        if (extra) return this._extraOnlyDesc(extra, wx, wy);
        return null;
    },

    _charDesc: function(c, extra) {
        var isZ = !!c.isZombie && !c.isPlayer;
        return {
            kind: isZ ? "enemy" : "character",
            icon: isZ ? "🧟" : "🧑",
            title: (c.playerLabel || c.name || (isZ ? c.power : "Hero")) + (c.isCPU ? " (CPU)" : ""),
            sub: isZ ? ("Enemy · " + (c.zombiePower || c.power || "NORMAL")) : ("Hero · " + (c.isPlayer ? "Player" : "NPC")),
            obj: c,
            color: c.originalColor || c.color || "#38bdf8",
            radius: Math.max(c.s1 || 60, c.s2 || 60) * 0.65,
            pos: function() { return { x: c.x, y: c.y }; },
            vel: function() { return { vx: c.xspeed || 0, vy: c.yspeed || 0 }; },
            hpInfo: function() { return { val: Math.round(c.health || 0), max: Math.round(c.maxHealth || 100), label: "HP" }; },
            isDead: function() { return !!c.dead; },
            extra: extra
        };
    },

    _objDesc: function(o, extra) {
        return {
            kind: "object",
            icon: o.kind === "platform" ? "➖" : (o.kind === "wall" ? "🏰" : "🧱"),
            title: o.name || "World Object",
            sub: (o.kind || "box") + " · " + Math.round(o.w || o.s1 || 60) + "×" + Math.round(o.h || o.s2 || 60),
            obj: o,
            color: o.color || "#94a3b8",
            radius: Math.max(o.w || o.s1 || 60, o.h || o.s2 || 60) * 0.55,
            pos: function() { return { x: o.x, y: o.y }; },
            vel: function() { return { vx: o.xspeed || 0, vy: o.yspeed || 0 }; },
            hpInfo: function() { return o.buildMaxHP ? { val: Math.round(o.buildHP || 0), max: o.buildMaxHP, label: "HP" } : null; },
            isDead: function() { return !!o.dead; },
            extra: extra
        };
    },

    _ragdollDesc: function(rd, extra) {
        return {
            kind: "ragdoll",
            icon: "🦴",
            title: rd.isVehicle ? "Rider + Vehicle" : "Ragdoll",
            sub: rd.pts.length + " joints",
            obj: rd,
            color: "#fbbf24",
            radius: 56,
            pos: function() { return { x: rd.centerX(), y: rd.centerY() }; },
            vel: function() { return { vx: rd.velX(), vy: rd.velY() }; },
            hpInfo: function() { return null; },
            isDead: function() { return typeof Ragdolls !== "undefined" && Ragdolls.list.indexOf(rd) === -1; },
            extra: extra
        };
    },

    _flailDesc: function(rd) {
        var team = rd.flailTeam === 0 ? "RED" : "BLUE";
        return {
            kind: "flail",
            icon: "⚽",
            title: (rd.flailLabel || team) + (rd.keeper ? " Keeper #1" : " Player"),
            sub: "Soccer Physics · " + team + " Team",
            obj: rd,
            color: rd.flailTeam === 0 ? "#ef4444" : "#3b82f6",
            radius: 75,
            pos: function() { return { x: rd.pts[1].x, y: rd.pts[1].y }; },
            vel: function() { return { vx: rd.pts[1].x - rd.pts[1].px, vy: rd.pts[1].y - rd.pts[1].py }; },
            hpInfo: function() { return null; },
            isDead: function() { return typeof Ragdolls !== "undefined" && Ragdolls.list.indexOf(rd) === -1; }
        };
    },

    _ballDesc: function() {
        return {
            kind: "ball",
            icon: "⚽",
            title: "Match Ball",
            sub: "Zombie Ball · r=" + Math.round(Ball.r),
            obj: Ball,
            color: "#fde047",
            radius: Ball.r + 12,
            pos: function() { return { x: Ball.x, y: Ball.y }; },
            vel: function() { return { vx: Ball.vx, vy: Ball.vy }; },
            hpInfo: function() { return null; },
            isDead: function() { return false; }
        };
    },

    _whoLabel: function(h) {
        if (h === 0) return " (P1)";
        if (h === "lan") return " (P2 LAN)";
        if (h === 1) return " (P2)";
        return " (Bot)";
    },

    _tankDesc: function(k) {
        return {
            kind: "tank",
            icon: "🛡",
            title: (k.name || "Tank") + this._whoLabel(k.human),
            sub: "Diep Tank · Lv " + (k.lvl || 1) + " · " + (k.cls || "basic"),
            obj: k,
            color: k.color || k.col || "#38bdf8",
            radius: Tanks.size(k) + 12,
            pos: function() { return { x: k.x, y: k.y }; },
            vel: function() { return { vx: k.vx || 0, vy: k.vy || 0 }; },
            hpInfo: function() {
                var mx = (typeof Tanks !== "undefined" && typeof Tanks.maxHp === "function") ? Tanks.maxHp(k) : (k.maxHp || k.hp || 100);
                return { val: Math.round(k.hp), max: Math.round(mx), label: "HP" };
            },
            isDead: function() { return !k.alive; }
        };
    },

    _shapeDesc: function(sh, S) {
        return {
            kind: "shape",
            icon: "🔷",
            title: (S ? S.name : "Polygon") + " Shape",
            sub: "XP: " + (S ? S.xp : 10),
            obj: sh,
            color: S ? S.col : "#facc15",
            radius: (S ? S.r : 20) + 8,
            pos: function() { return { x: sh.x, y: sh.y }; },
            vel: function() { return { vx: sh.vx || 0, vy: sh.vy || 0 }; },
            hpInfo: function() { return { val: Math.round(sh.hp), max: Math.round(S ? S.hp : 100), label: "HP" }; },
            isDead: function() { return sh.hp <= 0; }
        };
    },

    _blobDesc: function(b) {
        var o = b.pl || b.owner || {};
        return {
            kind: "blob",
            icon: o.chain ? "📿" : "🟢",
            title: (o.name || "Blob") + this._whoLabel(o.human),
            sub: (o.chain ? "Bubble Worm" : "Agar Blob") + " · Mass " + Math.round(b.m),
            obj: b,
            color: o.color || o.col || "#4ade80",
            radius: Cells.rad(b.m) + 10,
            pos: function() { return { x: b.x, y: b.y }; },
            vel: function() { return { vx: b.vx || 0, vy: b.vy || 0 }; },
            hpInfo: function() { return { val: Math.round(b.m), max: Math.max(500, Math.round(b.m * 1.5)), label: "MASS" }; },
            isDead: function() { return b.m <= 0 || Cells.blobs.indexOf(b) === -1; }
        };
    },

    _virusDesc: function(v) {
        return {
            kind: "virus",
            icon: "🦠",
            title: "Spiky Virus",
            sub: "Pop threshold: 95 mass",
            obj: v,
            color: "#22c55e",
            radius: Cells.rad(v.m || 100) + 10,
            pos: function() { return { x: v.x, y: v.y }; },
            vel: function() { return { vx: v.vx || 0, vy: v.vy || 0 }; },
            hpInfo: function() { return { val: Math.round(v.m || 100), max: 200, label: "MASS" }; },
            isDead: function() { return Cells.viruses.indexOf(v) === -1; }
        };
    },

    _wormDesc: function(w) {
        var h = w.segs[0] || { x: 0, y: 0 };
        return {
            kind: "worm",
            icon: "🐍",
            title: (w.name || "Worm") + this._whoLabel(w.human),
            sub: "Slither Worm · Length " + Math.round(w.len),
            obj: w,
            color: w.color || w.col || "#a855f7",
            radius: Snake.radius(w) + 14,
            pos: function() { return { x: w.segs[0].x, y: w.segs[0].y }; },
            vel: function() { var sp = w.boosting ? 7 : 3.5; return { vx: Math.cos(w.ang || 0) * sp, vy: Math.sin(w.ang || 0) * sp }; },
            hpInfo: function() { return { val: Math.round(w.len), max: Math.max(300, Math.round(w.len * 1.4)), label: "LEN" }; },
            isDead: function() { return !w.alive; }
        };
    },

    _extraOnlyDesc: function(extra, wx, wy) {
        return {
            kind: "extra",
            icon: "🔎",
            title: extra.title || "Game Element",
            sub: extra.sub || "",
            obj: extra,
            color: "#38bdf8",
            radius: 36,
            pos: function() { var p = extra.pos ? extra.pos() : [wx, wy]; return { x: p[0], y: p[1] }; },
            vel: function() { return { vx: 0, vy: 0 }; },
            hpInfo: function() { return null; },
            isDead: function() { return false; },
            extra: extra
        };
    },

    drawOverlay: function() {
        var sel = this.selected;
        if (sel && sel.isDead && sel.isDead()) { this.selected = null; sel = null; }
        var hov = this.hovered;
        if (hov && hov.isDead && hov.isDead()) { this.hovered = null; hov = null; }

        var drawReticle = function(d, col, dashed) {
            if (!d || !d.pos) return;
            var p = d.pos();
            var sp = UniversalInspect.worldToScreen(p.x, p.y);
            var r = Math.max(18, (d.radius || 36) * sp.scale);
            ctx.save();
            if (d.kind === "worm" && d.obj && d.obj.segs && d.obj.segs.length > 1) {
                ctx.strokeStyle = col;
                ctx.globalAlpha = 0.45;
                ctx.lineWidth = Math.max(3, (Snake.radius(d.obj) * 2 + 8) * sp.scale);
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.beginPath();
                for (var si = 0; si < d.obj.segs.length; si += 2) {
                    var spt = UniversalInspect.worldToScreen(d.obj.segs[si].x, d.obj.segs[si].y);
                    if (si === 0) ctx.moveTo(spt.x, spt.y); else ctx.lineTo(spt.x, spt.y);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            ctx.strokeStyle = col;
            ctx.lineWidth = 2.5;
            if (dashed) ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
            ctx.stroke();

            // Corner brackets
            ctx.setLineDash([]);
            var br = r + 6, L = 10;
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function(sg) {
                var cx = sp.x + sg[0] * br, cy = sp.y + sg[1] * br;
                ctx.beginPath();
                ctx.moveTo(cx - sg[0] * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - sg[1] * L);
                ctx.stroke();
            });

            // Velocity vector arrow
            if (d.vel) {
                var v = d.vel(), vmag = Math.hypot(v.vx, v.vy);
                if (vmag > 0.4) {
                    var ay = UniversalInspect.arenaCam() ? v.vy : -v.vy;
                    var ex = sp.x + v.vx * 6, ey = sp.y + ay * 6;
                    ctx.strokeStyle = "#fde047";
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(ex, ey); ctx.stroke();
                    ctx.fillStyle = "#fde047";
                    ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.fill();
                }
            }

            // Floating tag
            var hp = d.hpInfo ? d.hpInfo() : null;
            var tag = d.icon + " " + d.title + (hp ? " · " + hp.val + " " + hp.label : "");
            ctx.font = "800 11px system-ui, sans-serif";
            var tw = ctx.measureText(tag).width + 14;
            var tx = Math.max(8, Math.min(cssW - tw - 8, sp.x - tw / 2));
            var ty = Math.max(8, sp.y - r - 28);
            ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
            ctx.fillRect(tx, ty, tw, 20);
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.2;
            ctx.strokeRect(tx, ty, tw, 20);
            ctx.fillStyle = "#f8fafc";
            ctx.textAlign = "left";
            ctx.fillText(tag, tx + 7, ty + 14);
            ctx.restore();
        };

        if (hov && (!sel || hov.obj !== sel.obj)) drawReticle(hov, "#38bdf8", true);
        if (sel) drawReticle(sel, "#facc15", false);
    },

    moveTo: function(d, nx, ny) {
        if (!d || !d.obj || isNaN(nx) || isNaN(ny)) return;
        var o = d.obj;
        if (d.kind === "worm" && o.segs && o.segs.length) {
            var dx = nx - o.segs[0].x, dy = ny - o.segs[0].y;
            for (var i = 0; i < o.segs.length; i++) { o.segs[i].x += dx; o.segs[i].y += dy; }
        } else if ((d.kind === "ragdoll" || d.kind === "flail") && o.pts && o.pts.length) {
            var p0 = d.pos ? d.pos() : { x: o.pts[0].x, y: o.pts[0].y };
            var dxr = nx - p0.x, dyr = ny - p0.y;
            for (var j = 0; j < o.pts.length; j++) {
                o.pts[j].x += dxr; o.pts[j].y += dyr;
                if (o.pts[j].px !== undefined) o.pts[j].px += dxr;
                if (o.pts[j].py !== undefined) o.pts[j].py += dyr;
            }
        } else if (d.kind === "ball" && typeof Ball !== "undefined") {
            Ball.x = nx; Ball.y = ny; Ball.vx = 0; Ball.vy = 0;
        } else if (o.x !== undefined && o.y !== undefined) {
            o.x = nx; o.y = ny;
        }
        if (o._sbFrozen) { o._sbPinX = nx; o._sbPinY = ny; }
        if (typeof rebuildAllObjects === "function" && d.kind === "object") rebuildAllObjects();
    },

    getScale: function(d) {
        if (!d || !d.obj) return 100;
        return Math.round((d.obj._sbScale || 1) * 100);
    },

    setScale: function(d, pct) {
        if (!d || !d.obj) return;
        var s = Math.max(0.25, Math.min(4, (Number(pct) || 100) / 100));
        var o = d.obj;
        if (!o._sbBase) {
            o._sbBase = {
                s1: o.s1, s2: o.s2, w: o.w, h: o.h, m: o.m, len: o.len,
                r: d.kind === "ball" && typeof Ball !== "undefined" ? Ball.r : o.r,
                ptsR: o.pts ? o.pts.map(function(p) { return p.r || 6; }) : null,
                consD: o.cons ? o.cons.map(function(c) { return c.d || 10; }) : null
            };
        }
        var B = o._sbBase;
        o._sbScale = s;
        if (d.kind === "character" || d.kind === "enemy") {
            var ns1 = Math.max(16, Math.round((B.s1 || 80) * s));
            var ns2 = Math.max(16, Math.round((B.s2 || 80) * s));
            if (typeof o.resize === "function") o.resize(ns1, ns2);
            else { o.s1 = ns1; o.s2 = ns2; }
        } else if (d.kind === "object") {
            var nw = Math.max(12, Math.round((B.w || B.s1 || 60) * s));
            var nh = Math.max(12, Math.round((B.h || B.s2 || 60) * s));
            if (typeof o.resize === "function") o.resize(nw, nh);
            else { o.w = o.s1 = nw; o.h = o.s2 = nh; }
            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
        } else if (d.kind === "blob" || d.kind === "virus") {
            o.m = Math.max(10, Math.round((B.m || 50) * s * s));
        } else if (d.kind === "worm") {
            o.len = Math.max(15, Math.round((B.len || 40) * s));
        } else if (d.kind === "ball" && typeof Ball !== "undefined") {
            Ball.r = Math.max(10, Math.round((B.r || 44) * s));
            d.radius = Ball.r + 12;
        } else if ((d.kind === "ragdoll" || d.kind === "flail") && o.pts) {
            if (B.ptsR) for (var i = 0; i < o.pts.length; i++) o.pts[i].r = Math.max(2, B.ptsR[i] * s);
            if (B.consD && o.cons) for (var j = 0; j < o.cons.length; j++) o.cons[j].d = Math.max(2, B.consD[j] * s);
        }
        if (d.kind === "tank" && typeof Tanks !== "undefined") d.radius = Tanks.size(o) + 12;
        else if ((d.kind === "blob" || d.kind === "virus") && typeof Cells !== "undefined") d.radius = Cells.rad(o.m, o) + 10;
        else if (d.kind === "worm" && typeof Snake !== "undefined") d.radius = Snake.radius(o) + 14;
    }
};

