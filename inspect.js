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
