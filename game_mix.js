// ============================================================================
// ARENA MIX - worms inside blobs inside tanks: the three arena games in ONE world.
//
//   All three arenas are centred on the same point, so they nest: the worm ring (radius 2400) sits inside the blob
//   square (5200), which sits inside the tank square (6000). Each game keeps running its own rules (Snake.step,
//   Cells.step, Tanks.step); this file adds what happens when they meet, one camera, and "play as".
//
//   You pick a body: TANK, BLOB or WORM (pause menu, or Q). CPUs of all three kinds share the arena.
//   What beats what:
//     bullets   shrink blobs and worms (a head shot hurts most; a worm's body soaks bullets)
//     a blob    swallows a tank or a worm's head when it is clearly bigger and covers it
//     a worm    its body is a wall: tanks touching it take damage, small blobs that run into it are absorbed,
//               and a worm whose own head runs into a tank dies (heads are soft, bodies are hard)
//     a tank    ramming a blob chips its mass (and gets chipped back)
//     food      worms can eat blob food and blobs can eat worm food
// ============================================================================
var mixCfg = { body: "tank" };
try { var _mx = JSON.parse(localStorage.getItem("timsArenaMix") || "null"); if (_mx && ["tank", "blob", "worm"].indexOf(_mx.body) !== -1) mixCfg.body = _mx.body; } catch (e) {}
var mixSave = { best: { tank: 0, blob: 0, worm: 0 } };
try { var _ms = JSON.parse(localStorage.getItem("timsArenaMixBest") || "null"); if (_ms && _ms.best) for (var _mk in mixSave.best) mixSave.best[_mk] = _ms.best[_mk] || 0; } catch (e) {}
var MIX_BODIES = [["tank", "🛡 Tank"], ["blob", "🫧 Blob"], ["worm", "🪱 Worm"]];

var Mix = {
    on: false, t: 0, cam: { x: 0, y: 0, z: 0.8 }, view: null, log: [],
    stat: { bulletBlob: 0, bulletWorm: 0, blobAteTank: 0, blobAteWorm: 0, wormWall: 0, wormAbsorb: 0, headOnTank: 0, crossFood: 0 },

    // every arena draws with the same camera; none of them may move it (this file does)
    link: function() {
        if (!this.view) {
            var v = {}, self = this;
            ["x", "y", "z"].forEach(function(k) { window.Object.defineProperty(v, k, { get: function() { return self.cam[k]; }, set: function() {} }); });
            this.view = v;
        }
        this.keep = this.keep || { tank: Tanks.cam, blob: Cells.cam, worm: Snake.cam };
        Tanks.cam = Cells.cam = Snake.cam = this.view;
        Tanks.mixLayer = Cells.mixLayer = Snake.mixLayer = true;
        this.on = true;
    },
    unlink: function() {
        if (this.keep) { Tanks.cam = this.keep.tank; Cells.cam = this.keep.blob; Snake.cam = this.keep.worm; this.keep = null; }
        Tanks.mixLayer = Cells.mixLayer = Snake.mixLayer = false;
        this.on = false;
    },

    reset: function() {
        var mp = multiplayer; multiplayer = false;         // one human here for now (P1); everyone else is a CPU
        Tanks.reset(); Cells.reset(); Snake.reset();
        multiplayer = mp;
        this.t = 0; this.log = [];
        for (var k in this.stat) this.stat[k] = 0;
        this.setBody(mixCfg.body);
    },

    stripHumans: function() {
        Tanks.tanks = Tanks.tanks.filter(function(k) { return k.human === undefined; });
        var gone = Cells.players.filter(function(p) { return p.human !== undefined; });
        Cells.players = Cells.players.filter(function(p) { return p.human === undefined; });
        Cells.blobs = Cells.blobs.filter(function(b) { return gone.indexOf(b.pl) === -1; });
        Snake.worms = Snake.worms.filter(function(w) { return w.human === undefined; });
    },
    setBody: function(body) {
        mixCfg.body = body;
        try { localStorage.setItem("timsArenaMix", JSON.stringify(mixCfg)); } catch (e) {}
        this.stripHumans();
        var o = { human: 0, name: "P1", color: "#ff5a5f" };
        if (body === "tank") Tanks.addTank(o);
        else if (body === "blob") Cells.addPlayer(o);
        else Snake.spawn(o);
        var m = this.me();
        if (m) { this.cam.x = m.x; this.cam.y = m.y; }
    },
    // the human's body as { kind, x, y, alive, ref }
    me: function() {
        if (mixCfg.body === "tank") { var k = Tanks.tanks.find(function(q) { return q.human === 0; }); return k ? { kind: "tank", ref: k, x: k.x, y: k.y, alive: k.alive } : null; }
        if (mixCfg.body === "blob") { var p = Cells.players.find(function(q) { return q.human === 0; }); return p ? { kind: "blob", ref: p, x: p.cx || 0, y: p.cy || 0, alive: p.alive } : null; }
        var w = Snake.worms.find(function(q) { return q.human === 0; });
        return w ? { kind: "worm", ref: w, x: w.segs[0].x, y: w.segs[0].y, alive: w.alive } : null;
    },
    say: function(text, col) { this.log.unshift({ text: text, col: col || "#e2e8f0", t: 240 }); if (this.log.length > 5) this.log.length = 5; },
    note: function(human, text, col) { this.say(text, col); if (human) showBanner(text, "", col || "#fde047"); },

    // ------------------------------------------------------------ when the three games meet
    interact: function() {
        var S = this.stat, self = this;
        var blobs = Cells.blobs, worms = Snake.worms, tanks = Tanks.tanks, bullets = Tanks.bullets;
        var blobGone = function(b, byName) {
            b.dead = true;
            if (!blobs.some(function(q) { return q.pl === b.pl && !q.dead; })) Cells.die(b.pl, { name: byName });
        };
        // ---- bullets vs blobs and worms
        for (let i = bullets.length - 1; i >= 0; i--) {
            var bu = bullets[i], used = false;
            for (let j = 0; j < blobs.length && !used; j++) {
                var bl = blobs[j];
                if (bl.dead || Cells.protectedNow(bl.pl)) continue;
                var br = Cells.rad(bl.m);
                if (Math.abs(bu.x - bl.x) > br + bu.r || Math.hypot(bu.x - bl.x, bu.y - bl.y) > br + bu.r) continue;
                bl.m -= bu.dmg * 1.3; used = true; S.bulletBlob++;
                if (bu.owner && bu.owner.alive) Tanks.gainXp(bu.owner, 2);
                if (bl.m < 12) {
                    blobGone(bl, bu.owner ? bu.owner.name : "a tank");
                    if (bu.owner && bu.owner.alive) Tanks.gainXp(bu.owner, 40);
                    this.note(bu.owner && bu.owner.human !== undefined, (bu.owner ? bu.owner.name : "A tank") + " shot " + bl.pl.name + " to bits", "#93c5fd");
                }
            }
            for (let j = 0; j < worms.length && !used; j++) {
                var w = worms[j];
                if (!w.alive || w.safeT > 0 || arenaProtected(w)) continue;
                var h = w.segs[0], wr = Snake.radius(w);
                if (Math.hypot(bu.x - h.x, bu.y - h.y) < wr + bu.r) {
                    w.len -= bu.dmg * 1.6; used = true; S.bulletWorm++;
                    if (bu.owner && bu.owner.alive) Tanks.gainXp(bu.owner, 3);
                    if (w.len < 12) {
                        Snake.kill(w, null); w.deathMsg = "Shot by " + (bu.owner ? bu.owner.name : "a tank");
                        if (bu.owner && bu.owner.alive) Tanks.gainXp(bu.owner, 45);
                        this.note(bu.owner && bu.owner.human !== undefined, (bu.owner ? bu.owner.name : "A tank") + " shot " + w.name, "#93c5fd");
                    }
                }
            }
            if (!used) { var hitW = Snake.hitBody(bu.x, bu.y, bu.r, null); if (hitW && hitW.alive) { hitW.len = Math.max(12, hitW.len - bu.dmg * 0.25); used = true; S.bulletWorm++; } }   // bodies soak bullets
            if (used) { bu.pen -= 1; if (bu.pen <= 0) bullets.splice(i, 1); }
        }
        // ---- tanks vs worms and blobs
        for (let i = 0; i < tanks.length; i++) {
            var k = tanks[i];
            if (!k.alive) continue;
            var ks = Tanks.size(k);
            // a worm's body is a wall
            var wall = Snake.hitBody(k.x, k.y, ks * 0.8, null);
            if (wall && wall.alive) {
                Tanks.hurt(k, 1.1, { name: wall.name }); S.wormWall++;
                var wh = wall.segs[0], pd = Math.hypot(k.x - wh.x, k.y - wh.y) || 1; k.vx += (k.x - wh.x) / pd * 0.25; k.vy += (k.y - wh.y) / pd * 0.25;
                if (!k.alive) { wall.len += 30 + k.lvl * 2; this.note(wall.human !== undefined || k.human !== undefined, k.name + " drove into " + wall.name, wall.color); }
            }
            // a worm's head into a tank: the worm loses
            for (let j = 0; j < worms.length; j++) {
                var w2 = worms[j];
                if (!w2.alive || w2.safeT > 0 || !k.alive) continue;
                var h2 = w2.segs[0];
                if (Math.hypot(h2.x - k.x, h2.y - k.y) < ks + Snake.radius(w2) * 0.6) {
                    Snake.kill(w2, null); w2.deathMsg = "Hit " + k.name + " head-on"; Tanks.hurt(k, 14, { name: w2.name }); Tanks.gainXp(k, 35); S.headOnTank++;
                    this.note(w2.human !== undefined || k.human !== undefined, w2.name + " hit " + k.name + " head-on", "#fca5a5");
                }
            }
            // blobs: a clearly bigger one swallows the tank, otherwise they chip each other
            for (let j = 0; j < blobs.length; j++) {
                var b2 = blobs[j];
                if (b2.dead || !k.alive) continue;
                var r2 = Cells.rad(b2.m), d2 = Math.hypot(b2.x - k.x, b2.y - k.y);
                if (d2 > r2 + ks) continue;
                if (r2 > ks * 1.7 && d2 < r2 - ks * 0.3 && !(k.inv > 0) && !arenaProtected(k)) {
                    k.hp = 0; Tanks.hurt(k, 1, { name: b2.pl.name }); b2.m += 50 + k.lvl * 5; S.blobAteTank++;
                    this.note(b2.pl.human !== undefined || k.human !== undefined, b2.pl.name + " swallowed " + k.name, b2.pl.color);
                } else if (!Cells.protectedNow(b2.pl)) {
                    b2.m -= 0.5 + k.st[2] * 0.25; Tanks.hurt(k, 0.35, { name: b2.pl.name });
                    if (b2.m < 12) { blobGone(b2, k.name); Tanks.gainXp(k, 40); }
                }
            }
        }
        // ---- blobs vs worms
        for (let j = 0; j < worms.length; j++) {
            var w3 = worms[j];
            if (!w3.alive) continue;
            var h3 = w3.segs[0], wr3 = Snake.radius(w3);
            for (let i = 0; i < blobs.length; i++) {
                var b3 = blobs[i];
                if (b3.dead) continue;
                var r3 = Cells.rad(b3.m);
                if (Math.abs(b3.x - h3.x) > r3 + wr3 + 400) continue;
                // a big blob over the head swallows the worm
                if (w3.alive && !(w3.safeT > 0) && r3 > wr3 * 2.6 && Math.hypot(b3.x - h3.x, b3.y - h3.y) < r3 - wr3 * 0.5) {
                    b3.m += 20 + w3.len * 0.4; Snake.kill(w3, null); w3.deathMsg = "Swallowed by " + b3.pl.name; S.blobAteWorm++;
                    this.note(b3.pl.human !== undefined || w3.human !== undefined, b3.pl.name + " swallowed " + w3.name, b3.pl.color);
                    break;
                }
            }
        }
        // a small blob that runs into a worm's body is absorbed by the worm
        for (let i = 0; i < blobs.length; i++) {
            var b4 = blobs[i];
            if (b4.dead || Cells.protectedNow(b4.pl)) continue;
            var r4 = Cells.rad(b4.m);
            var w4 = Snake.hitBody(b4.x, b4.y, r4 * 0.35, null);
            if (w4 && w4.alive && r4 < Snake.radius(w4) * 2.2) {
                w4.len += b4.m * 0.35; S.wormAbsorb++;
                this.note(b4.pl.human !== undefined || w4.human !== undefined, w4.name + " absorbed " + b4.pl.name, w4.color);
                blobGone(b4, w4.name);
            }
        }
        // ---- food crosses over (every other tick is plenty)
        if (this.t % 2 === 0) {
            var cp = Cells.pellets, sp = Snake.pellets;
            for (let j = 0; j < worms.length; j++) {
                var w5 = worms[j];
                if (!w5.alive) continue;
                var h5 = w5.segs[0], rr = Snake.radius(w5) + 8;
                for (let i = cp.length - 1; i >= 0; i--) { var f = cp[i]; if (Math.abs(f.x - h5.x) < rr && Math.abs(f.y - h5.y) < rr) { w5.len += f.m * 0.6; cp.splice(i, 1); S.crossFood++; } }
            }
            for (let i = 0; i < blobs.length; i++) {
                var b5 = blobs[i];
                if (b5.dead) continue;
                var r5 = Cells.rad(b5.m);
                for (let j = sp.length - 1; j >= 0; j--) { var g = sp[j]; if (Math.abs(g.x - b5.x) < r5 && Math.abs(g.y - b5.y) < r5 && Math.hypot(g.x - b5.x, g.y - b5.y) < r5) { b5.m += g.v; sp.splice(j, 1); S.crossFood++; } }
            }
            while (sp.length < SNK.PELLETS) Snake.addPellet();
        }
        if (blobs.some(function(q) { return q.dead; })) Cells.blobs = blobs.filter(function(q) { return !q.dead; });
    },

    // ------------------------------------------------------------ one camera for all three
    updateCam: function() {
        var m = this.me(), z = this.cam.z;
        if (m && m.alive) {
            if (m.kind === "tank") z = 0.85 / ((TNK_CLASSES[m.ref.cls].fov || 1) * (1 + m.ref.lvl * 0.006));
            else if (m.kind === "blob") z = Math.max(0.22, Math.min(1.2, 1.3 / Math.pow(Math.max(20, Cells.mass(m.ref)) / 20, 0.32)));
            else z = Math.max(0.35, Math.min(1.1, 1.15 - Math.sqrt(m.ref.len) * 0.035));
            this.cam.x += (m.x - this.cam.x) * 0.15; this.cam.y += (m.y - this.cam.y) * 0.15;
        }
        this.cam.z += (Math.max(0.22, z) - this.cam.z) * 0.05;
    },

    frame: function() {
        this.t++;
        // respawn the human when they press their button
        var m = this.me();
        if (m && !m.alive) {
            var r = m.ref; r.deadT = (r.deadT || 0) + (m.kind === "worm" ? 0 : 1);       // Snake.step already counts a dead worm's time
            var pad = (typeof Pads !== "undefined") ? Pads.state[0] : null;
            if (r.deadT > 60 && (mouseDown || SpacePressed || !!(pad && pad.active && pad.shoot))) {
                if (m.kind === "tank") Tanks.spawn(r);
                else if (m.kind === "blob") { Cells.spawn(r); r.splitPrev = true; }
                else { Snake.spawn({ old: r, name: r.name, color: r.color, human: 0 }); r.kills = 0; }
            }
        }
        Snake.mouseMoved = Math.hypot(mouseX - (Snake.lastMouse ? Snake.lastMouse[0] : mouseX), mouseY - (Snake.lastMouse ? Snake.lastMouse[1] : mouseY)) > 3;
        Snake.lastMouse = [mouseX, mouseY];
        Tanks.step(); Cells.step(); Snake.step();
        this.interact();
        // scores for the Arcade card
        m = this.me();
        if (m && m.alive) {
            var sc = m.kind === "tank" ? m.ref.score : (m.kind === "blob" ? Math.round(Cells.mass(m.ref)) : Math.round(m.ref.len));
            if (sc > mixSave.best[m.kind]) { mixSave.best[m.kind] = sc; if (this.t % 120 === 0) { try { localStorage.setItem("timsArenaMixBest", JSON.stringify(mixSave)); } catch (e) {} } }
        }
        this.draw();
    },

    draw: function() {
        this.updateCam();
        ctx.fillStyle = Theme.bg(); ctx.fillRect(0, 0, cssW, cssH);
        Tanks.render();      // tank floor + grid, shapes, bullets, tanks
        Cells.render();      // the blob zone, food, blobs, spikes
        Snake.render();      // the worm ring, food, worms
        var m = this.me();
        if (m && m.kind === "tank") Tanks.hud();
        else if (m && m.kind === "blob") Cells.hud();
        else if (m) Snake.hud();
        // what this mode adds to the screen: who you are, how to switch, and the cross-game feed
        var name = MIX_BODIES.find(function(b) { return b[0] === mixCfg.body; })[1];
        uiPanel(14, 76, 330, 34, "#fde047", 0.8);
        uiText("ARENA MIX · you: " + name + " · Q: switch body", 26, 98, 12, "#fde68a", "left", "800");
        for (let i = 0; i < this.log.length; i++) {
            var L = this.log[i]; L.t--;
            ctx.globalAlpha = Math.min(1, L.t / 60);
            uiText(L.text, 26, 132 + i * 18, 12, L.col, "left", "800");
            ctx.globalAlpha = 1;
        }
        this.log = this.log.filter(function(L) { return L.t > 0; });
        uiText("Worm ring (pink) inside the blob zone (purple) inside the tank arena · bullets shrink blobs & worms · big blobs swallow · worm bodies are walls", cssW / 2, cssH - 28, 11, "rgba(220,230,240,0.75)", "center", "700");
    },

    nextBody: function(dir) {
        var i = MIX_BODIES.findIndex(function(b) { return b[0] === mixCfg.body; });
        this.setBody(MIX_BODIES[(i + (dir || 1) + MIX_BODIES.length) % MIX_BODIES.length][0]);
        showBanner("You are a " + MIX_BODIES.find(function(b) { return b[0] === mixCfg.body; })[1].replace(/^\S+\s/, "").toUpperCase(), "", "#fde047");
    }
};

ModeKit.addLevel("mix_arena", { name: "🌀 Arena Mix", mode: "mix", wavesEnabled: false, spawnP1: [0, 60], spawnP2: [60, 60], layout: ModeKit.room(-600, 600, 800, {}), title: "Arena Mix" });

GameModes.register({
    id: "mix",
    title: "ARENA MIX",
    tagline: "Worms inside blobs inside tanks: all three arenas in one world. Play as any of them.",
    color: "#fde047",
    firstLevel: "mix_arena",
    flags: { ownScreen: true, waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, scenery: false, coopToggle: false },
    overTitle: "ARENA MIX",

    onActivate: function() { Mix.link(); },
    onDeactivate: function() { Mix.unlink(); },
    setupLevel: function() { Mix.link(); Mix.reset(); },
    screenFrame: function() { Mix.frame(); },

    tunables: function() {
        return [
            { label: "Play as", type: "choice", options: MIX_BODIES, get: function() { return mixCfg.body; }, set: function(v) { Mix.setBody(String(v)); } }
        ].concat(arenaRows(), [
            { label: "CPU tanks", type: "range", min: 0, max: 14, step: 1, get: function() { return TNK.CPUS; }, set: function(v) { TNK.CPUS = v; }, note: "next arena" },
            { label: "CPU blobs", type: "range", min: 0, max: 40, step: 1, get: function() { return cellsCfg.bots; }, set: function(v) { cellsCfg.bots = v; saveCellsCfg(); }, note: "changes live" },
            { label: "CPU worms", type: "range", min: 0, max: 20, step: 1, get: function() { return SNK.CPUS; }, set: function(v) { SNK.CPUS = v; }, note: "next arena" }
        ]);
    },
    onKey: function(code) {
        if (code === "KeyQ") { Mix.nextBody(1); return true; }
        if (mixCfg.body === "tank") { var tk = GameModes.get("tanks"); if (tk && tk.onKey) return tk.onKey(code); }
        return false;
    },
    onClick: function(wx, wy, button) {
        if (mixCfg.body === "tank") { var tk = GameModes.get("tanks"); if (tk && tk.onClick) return tk.onClick(wx, wy, button); }
        return true;
    },
    menuItems: function(items) {
        items.push({ id: "mx_body", label: "Play as:  ◀  " + MIX_BODIES.find(function(b) { return b[0] === mixCfg.body; })[1] + "  ▶", hint: "Tank, blob or worm (Q in play)", cycle: true });
        items.push({ id: "mx_new", label: "New arena", hint: "" });
    },
    onMenu: function(id, dir) {
        if (id === "mx_body") { Mix.nextBody(dir || 1); return true; }
        if (id === "mx_new") { closePause(); Mix.reset(); return true; }
        return false;
    },
    onRestart: function() { Mix.reset(); },
    overSub: function() { return "Best: tank " + mixSave.best.tank + " · blob " + mixSave.best.blob + " · worm " + mixSave.best.worm; }
});
