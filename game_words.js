// ============================================================================
// GAME: WORD LAB  (words)  -  type a thing, it appears (original, scribblenauts-style)
//   Each room has a star you can't reach the normal way. Press Enter (or T), type what you need - "stairs",
//   "big trampoline", "bridge", "heavy red crate", "tnt", "car", "angry knight", "jetpack" - and it appears where
//   the mouse points. Adjectives change it: big / huge / tiny, heavy / light, bouncy, explosive, colours,
//   angry (tougher monsters). Grab the star with as few words as you can: 3 stars for meeting the room's par.
//   Normal hero controls (WASD, mouse aim + click to shoot, G grab & throw). Esc menu: room select.
// ============================================================================
var WORD_COLORS = { red: "#ef4444", blue: "#3b82f6", green: "#22c55e", yellow: "#facc15", orange: "#f97316", purple: "#a855f7", pink: "#ec4899", black: "#1f2937", white: "#f8fafc", gold: "#eab308", golden: "#eab308", grey: "#6b7280", gray: "#6b7280", brown: "#92400e" };
var WORD_SIZE = { big: 1.6, large: 1.6, huge: 2.2, giant: 2.6, enormous: 2.6, small: 0.6, little: 0.6, tiny: 0.4, mini: 0.4, long: 1, wide: 1 };
var wordsSave = { best: {}, room: 0 };
try { var _ws2 = JSON.parse(localStorage.getItem("timsWordLab") || "null"); if (_ws2) { wordsSave.best = _ws2.best || {}; wordsSave.room = _ws2.room || 0; } } catch (e) {}
function saveWords() { try { localStorage.setItem("timsWordLab", JSON.stringify(wordsSave)); } catch (e) {} }

// every noun -> how to make it. a = adjective info { s: size, col, heavy, light, bouncy, explosive, angry, long }
var WORD_DICT = {};
function wordDef(names, fn, kind) { names.split(" ").forEach(function(n) { WORD_DICT[n] = { fn: fn, kind: kind || "thing" }; }); }
var WK2 = {
    crate: function(x, y, a, extra) {
        var size = Math.round(76 * a.s);
        var c = Object.addCrate(x, y + size / 2, size, a.col || (extra && extra.col) || "#d9a05b", window.Object.assign({ name: (extra && extra.name) || "Crate", texture: (extra && extra.tex) || "crate_plank" }, a.explosive ? { explosive: true } : {}));
        if (a.heavy || (extra && extra.heavy)) c.weight = 3; if (a.light) c.weight = 0.4;
        if (a.bouncy) c.bounciness = -0.75;
        return c;
    },
    box: function(x, y, w, h, a, name, kind, tex) { return Object.addBox(x, y, w, h, a.col || "#64748b", { name: name, kind: kind || "block", texture: tex || "stone_block" }); },
    zombie: function(type, x, y, a) {
        var z = spawnZombie(type, x, y + 40);
        if (!z) return null;
        z.x = x; z.y = y + 60;
        if (a.angry) { z.health *= 2; z.maxHealth = z.health; }
        if (a.s !== 1 && z.scaleSize) z.scaleSize(a.s);
        return z;
    },
    power: function(type, x, y) { spawnPowerUp(x, y + 40, type); }
};
wordDef("crate box cube chest", function(x, y, a) { WK2.crate(x, y, a); });
wordDef("boulder rock stone anvil", function(x, y, a) { a.heavy = true; WK2.crate(x, y, a, { col: "#6b7280", name: "Boulder", tex: "stone_raw" }); });
wordDef("barrel tnt dynamite bomb explosive", function(x, y, a) { a.explosive = true; WK2.crate(x, y, a, { col: "#e84545", name: "TNT Barrel" }); });
wordDef("ball pillow", function(x, y, a) { a.bouncy = true; a.light = true; WK2.crate(x, y, a, { col: "#f472b6", name: "Ball" }); });
// a balloon floats up (negative gravity) until it hits something - grab it (G) and it lifts you
wordDef("balloon blimp airship", function(x, y, a) {
    a.light = true;
    var c = WK2.crate(x, y, a, { col: a.col || "#f43f5e", name: "Balloon" });
    c.gravityMult = -0.28 * (a.heavy ? 0.4 : 1); c.gravity = gravity * c.gravityMult; c.weight = 0.6; c.bounciness = 0;
});
// a rope / vine: a column of small one-way footholds you climb by jumping
wordDef("rope vine chain pole", function(x, y, a) {
    var n = Math.round(7 * a.s);
    for (let i = 0; i < n; i++) WK2.box(x + (i % 2 ? 40 : -40), y + i * 110, 90, 16, { col: a.col || "#a16207" }, "Rope knot", "platform", "wood_plank");
});
wordDef("block brick wall pillar tower", function(x, y, a) { var h = 240 * a.s, w = 60 * Math.max(0.6, a.s); WK2.box(x, y + h / 2, w, h, a, "Wall", "block", "mossy_brick"); });
wordDef("platform ledge shelf plank board", function(x, y, a) { WK2.box(x, y, 260 * a.s, 30, a, "Platform", "platform", "wood_plank"); });
wordDef("bridge", function(x, y, a) { WK2.box(x, y, 700 * a.s, 30, a, "Bridge", "block", "wood_plank"); });
wordDef("cloud", function(x, y, a) { WK2.box(x, y, 320 * a.s, 40, { col: a.col || "#e2e8f0" }, "Cloud", "platform", "glass"); });
wordDef("stairs staircase steps ladder", function(x, y, a) {
    // a staircase climbing toward the mouse side, made of 6 steps
    var n = Math.round(6 * a.s), st = 70;
    for (let i = 0; i < n; i++) Object.addBox(x + i * st, y + (i + 1) * st / 2, st, (i + 1) * st, a.col || "#8b5a2b", { name: "Step", kind: "block", texture: "wood_plank" });
});
wordDef("ramp slope hill", function(x, y, a) { Object.addRamp(x, y + 100 * a.s, 360 * a.s, 200 * a.s, "right", a.col || "#5d8a3a", { texture: "grass_top" }); });
wordDef("trampoline spring bouncer pogo", function(x, y, a) { Object.addBumper(x, y + 13, 200 * a.s, 26, 30 + (a.bouncy ? 10 : 0) * 1, a.col || "#ff2e63", { name: "Trampoline" }); });
wordDef("fan wind blower", function(x, y, a) { Gadgets.add({ type: "fan", x: x, y: y, w: 200 * a.s, h: 1100 * a.s, power: 1.8 }); });
wordDef("car truck buggy jeep", function(x, y) { if (typeof Vehicles !== "undefined") Vehicles.spawnCar({ x: x, y: y + 20 }); }, "vehicle");
wordDef("zombie monster enemy ghoul", function(x, y, a) { WK2.zombie("NORMAL", x, y, a); }, "monster");
wordDef("knight guard soldier", function(x, y, a) { WK2.zombie("KNIGHT", x, y, a); }, "monster");
wordDef("archer skeleton", function(x, y, a) { WK2.zombie("ARCHER", x, y, a); }, "monster");
wordDef("slime blob jelly", function(x, y, a) { WK2.zombie("SLIME", x, y, a); }, "monster");
wordDef("bat vampire", function(x, y, a) { WK2.zombie("BAT", x, y, a); }, "monster");
wordDef("wizard mage witch", function(x, y, a) { WK2.zombie("MAGE", x, y, a); }, "monster");
wordDef("frog spider kangaroo", function(x, y, a) { WK2.zombie("LEAPER", x, y, a); }, "monster");
wordDef("tank ogre giant troll", function(x, y, a) { WK2.zombie("TANK", x, y, a); }, "monster");
wordDef("dragon king boss", function(x, y, a) { WK2.zombie("BOSS_KING", x, y, a); }, "monster");
wordDef("dummy mannequin scarecrow", function(x, y) { var rd = Ragdolls.spawnFrom({ x: x, y: y + 60, s1: 80, s2: 80, zombiePower: "DUMMY", originalColor: "#facc15", lastFacing: 1, xspeed: 0, yspeed: 0 }, { vx: 0, vy: 0, spin: 0 }); if (rd) { rd.life = 1800; rd.style.dead = false; } });
wordDef("medkit medicine potion health heart bandage", function(x, y) { WK2.power("HEAL", x, y); }, "item");
wordDef("shield armor armour helmet", function(x, y) { WK2.power("SHIELD", x, y); }, "item");
wordDef("gun laser blaster rifle", function(x, y) { WK2.power("RAPID", x, y); }, "item");
wordDef("shoes boots sneakers speed", function(x, y) { WK2.power("SPEED", x, y); }, "item");
wordDef("sword blade axe", function(x, y) { WK2.power("ORBIT", x, y); }, "item");
wordDef("ice snowflake freezer", function(x, y) { WK2.power("FREEZE", x, y); }, "item");
wordDef("lightning thunder", function(x, y) { WK2.power("CHAIN", x, y); }, "item");
wordDef("magnet", function(x, y) { WK2.power("MAGNET", x, y); }, "item");
wordDef("nuke explosion blast", function(x, y) { Components.blowUp(x, y, "#ff6b00", 26, 300, -40, null); screenShake = 10; }, "item");
wordDef("jetpack rocket wings", function(x, y) { jetpackEnabled = true; characters.forEach(function(c) { if (c.isPlayer) c.fuel = c.maxFuel || 100; }); Components.addFloatingText("JETPACK ON! (Space)", redGuy.x, redGuy.y + 100, "#fde047", 20); }, "item");
// pets follow you around: a dog (lunges at monsters), a cat (quick), a bird (flies beside you). They're light crates
// underneath, so they walk on the ground, can be grabbed, and you can even stand on one.
function wordPet(kind) {
    return function(x, y, a) {
        var col = a.col || ({ dog: "#b45309", cat: "#71717a", bird: "#38bdf8" })[kind];
        var size = Math.round((kind === "bird" ? 44 : 60) * a.s);
        var c = Object.addCrate(x, y + size / 2, size, "rgba(0,0,0,0)", { name: kind === "dog" ? "Dog" : kind === "cat" ? "Cat" : "Bird", texture: null });
        c.weight = 0.8; c.pet = { kind: kind, owner: redGuy, t: 0, bite: 0, col: col };      // the crate is invisible: the pet is drawn on top
        if (kind === "bird") { c.gravityMult = 0; c.gravity = 0; }
    };
}
wordDef("dog puppy hound wolf", wordPet("dog"), "pet");
wordDef("cat kitten kitty", wordPet("cat"), "pet");
wordDef("bird parrot pigeon duck owl", wordPet("bird"), "pet");

function wordPetsUpdate() {
    for (let i = 0; i < movingObjects.length; i++) {
        var o = movingObjects[i], P = o.pet;
        if (!P || o.dead || o.heldBy) continue;
        var h = P.owner && !P.owner.dead ? P.owner : redGuy;
        if (!h) continue;
        P.t++;
        var dx = h.x - o.x - (P.kind === "bird" ? 70 : 0), dy = h.y - o.y, sp = P.kind === "cat" ? 9 : 7;
        if (P.kind === "bird") {
            // hover beside the hero's head, bobbing
            var tx = dx, ty = dy + 90 + Math.sin(P.t * 0.08) * 14;
            o.xspeed += Math.max(-1, Math.min(1, tx * 0.02)) - o.xspeed * 0.08;
            o.yspeed += Math.max(-1, Math.min(1, ty * 0.02)) - o.yspeed * 0.08;
            continue;
        }
        // dog: chase a monster that comes close
        var target = null;
        if (P.kind === "dog") for (let z = 0; z < zombies.length; z++) { var zz = zombies[z]; if (!zz.dead && Math.abs(zz.x - o.x) < 320 && Math.abs(zz.y - o.y) < 200) { target = zz; break; } }
        if (target) { dx = target.x - o.x; dy = target.y - o.y; }
        if (Math.abs(dx) > (target ? 20 : 110)) o.xspeed = Math.sign(dx) * sp;
        else if (o.onGround) o.xspeed *= 0.7;
        // hop when blocked or when the hero is above
        var stuck = Math.abs(dx) > 120 && Math.abs(o.x - (P.lastX || o.x)) < 0.5;
        if (o.onGround && (stuck || dy > 140)) o.yspeed = 15;
        P.lastX = o.x;
        if (target && P.bite <= 0 && Math.abs(target.x - o.x) < 70 && Math.abs(target.y - o.y) < 90) {
            target.takeDamage(-18, Math.sign(target.x - o.x) * 9, 6, h);
            Components.addFloatingText("WOOF!", o.x, o.y + 60, "#fde68a", 16);
            P.bite = 40;
        }
        if (P.bite > 0) P.bite--;
    }
}

function wordPetsDraw() {
    var k = cameraScaleX;
    for (let i = 0; i < movingObjects.length; i++) {
        var o = movingObjects[i], P = o.pet;
        if (!P || o.dead) continue;
        var sx = wsx(o.x), sy = wsy(o.y), r = o.w / 2 * k, face = o.xspeed < -0.5 ? -1 : 1;
        ctx.save();
        ctx.fillStyle = P.col; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2;
        // body: a rounded loaf (dog / cat) or a round bird, with little legs that trot
        if (P.kind === "bird") { ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.8, 0, 0, 7); ctx.fill(); ctx.stroke(); }
        else {
            var step = Math.abs(o.xspeed) > 1 ? Math.sin(P.t * 0.6) * r * 0.25 : 0;
            ctx.fillRect(sx - r * 0.7 + step, sy + r * 0.5, r * 0.25, r * 0.5); ctx.fillRect(sx + r * 0.45 - step, sy + r * 0.5, r * 0.25, r * 0.5);
            ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.1, r, r * 0.65, 0, 0, 7); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(sx + face * r * 0.65, sy - r * 0.35, r * 0.5, 0, 7); ctx.fill(); ctx.stroke();       // head
        }
        if (P.kind === "bird") {
            var flap = Math.sin(P.t * 0.5) * r * 0.6;
            ctx.beginPath(); ctx.moveTo(sx - face * r * 0.2, sy); ctx.lineTo(sx - face * r * 1.2, sy - flap); ctx.lineTo(sx - face * r * 0.2, sy + r * 0.3); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.moveTo(sx + face * r, sy - r * 0.2); ctx.lineTo(sx + face * r * 1.5, sy); ctx.lineTo(sx + face * r, sy + r * 0.2); ctx.fill();
        } else {
            // ears
            var ear = P.kind === "cat" ? [[0.5, -1.25], [0.85, -0.75], [0.3, -0.75]] : [[0.95, -0.35], [1.1, -0.95], [0.6, -0.8]];
            ctx.beginPath(); ctx.moveTo(sx + face * r * ear[2][0], sy + r * ear[2][1]); ctx.lineTo(sx + face * r * ear[0][0], sy + r * ear[0][1]); ctx.lineTo(sx + face * r * ear[1][0], sy + r * ear[1][1]); ctx.closePath(); ctx.fill(); ctx.stroke();
            // wagging tail
            var wag = Math.sin(P.t * (P.kind === "dog" ? 0.5 : 0.15)) * r * 0.4;
            ctx.lineWidth = Math.max(3, r * 0.22); ctx.strokeStyle = P.col; ctx.beginPath(); ctx.moveTo(sx - face * r, sy - r * 0.3); ctx.quadraticCurveTo(sx - face * r * 1.5, sy - r * 0.8 + wag, sx - face * r * 1.4, sy - r * 1.2 + wag); ctx.stroke();
        }
        // eye
        ctx.fillStyle = "#0a0f16"; ctx.beginPath(); ctx.arc(sx + face * r * (P.kind === "bird" ? 0.45 : 0.8), sy - r * (P.kind === "bird" ? 0.2 : 0.45), Math.max(2, r * 0.1), 0, 7); ctx.fill();
        if (P.kind !== "bird") { ctx.beginPath(); ctx.arc(sx + face * r * 1.12, sy - r * 0.3, Math.max(2, r * 0.1), 0, 7); ctx.fill(); }   // nose
        ctx.restore();
    }
}

// verbs change your hero instead of making a thing
var WORD_VERBS = {};
function wordVerb(names, fn) { names.split(" ").forEach(function(n) { WORD_VERBS[n] = fn; }); }
wordVerb("fly float hover soar", function(h) { jetpackEnabled = true; h.fuel = h.maxFuel || 100; Components.addFloatingText("FLY! (hold Space)", h.x, h.y + 100, "#fde047", 20); });
wordVerb("shrink smaller", function(h) { h.scaleSize(0.55); Components.addFloatingText("tiny!", h.x, h.y + 70, "#c4b5fd", 18); });
wordVerb("grow bigger enlarge", function(h) { h.scaleSize(1.6); Components.addFloatingText("BIG!", h.x, h.y + 120, "#c4b5fd", 22); });
wordVerb("normal reset unshrink", function(h) { h.scaleSize(1); });
wordVerb("heal", function(h) { h.health = h.maxHealth; Components.addFloatingText("+HEALED", h.x, h.y + 100, "#4ade80", 18); });
var WORD_BANNED = ["star", "stars", "goal", "win", "flag", "key", "teleport", "portal", "god"];

var WordLab = {
    open: false, input: null, used: 0, log: [], msg: "", msgT: 0, doneT: 0, done: false,

    ensureInput: function() {
        if (this.input) return this.input;
        var el = document.createElement("input");
        el.type = "text"; el.placeholder = "type a thing… (e.g. big trampoline)"; el.maxLength = 40; el.autocomplete = "off";
        el.style.cssText = "position:fixed;left:50%;bottom:64px;transform:translateX(-50%);width:min(520px,80vw);font:700 22px system-ui,sans-serif;padding:12px 16px;border-radius:12px;border:3px solid #fde047;background:#0f172a;color:#f8fafc;outline:none;z-index:50;display:none;box-shadow:0 8px 30px rgba(0,0,0,.5)";
        el.addEventListener("keydown", function(e) {
            if (e.key === "Enter") { var v = el.value; WordLab.close(); WordLab.make(v); e.preventDefault(); }
            else if (e.key === "Escape") { WordLab.close(); e.preventDefault(); }
            e.stopPropagation();
        });
        document.body.appendChild(el);
        this.input = el;
        return el;
    },
    openBox: function() {
        if (this.done) return;
        var el = this.ensureInput();
        el.value = ""; el.style.display = "block"; this.open = true;
        // drop held movement keys so the hero doesn't keep walking while you type
        WASDleftPressed = WASDrightPressed = WASDupPressed = WASDdownPressed = false; mouseDown = false;
        setTimeout(function() { el.focus(); }, 0);
    },
    close: function() { if (this.input) { this.input.style.display = "none"; this.input.blur(); } this.open = false; },

    parse: function(text) {
        var words = text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
        var a = { s: 1 }, noun = null, verb = null, unknown = [];
        for (let i = 0; i < words.length; i++) {
            var w = words[i];
            if (w === "a" || w === "an" || w === "the" || w === "very" || w === "some") continue;
            var base = WORD_DICT[w] ? w : (WORD_DICT[w.replace(/s$/, "")] ? w.replace(/s$/, "") : null);
            if (WORD_SIZE[w]) a.s *= WORD_SIZE[w];
            else if (WORD_COLORS[w]) a.col = WORD_COLORS[w];
            else if (w === "heavy" || w === "iron" || w === "metal") a.heavy = true;
            else if (w === "light" || w === "feather" || w === "paper") a.light = true;
            else if (w === "bouncy" || w === "rubber" || w === "springy") a.bouncy = true;
            else if (w === "exploding" || w === "explosive") a.explosive = true;
            else if (w === "angry" || w === "evil" || w === "mean" || w === "strong") a.angry = true;
            else if (base) noun = base;
            else if (WORD_VERBS[w]) verb = w;
            else if (WORD_BANNED.indexOf(w) !== -1) return { banned: w };
            else unknown.push(w);
        }
        a.s = Math.max(0.3, Math.min(3, a.s));
        return { noun: noun, verb: verb, a: a, unknown: unknown };
    },

    make: function(text) {
        if (!text || !text.trim()) return;
        var p = this.parse(text);
        if (p.banned) { this.say("Nice try! You can't summon a " + p.banned + ".", "#fca5a5"); return; }
        if (!p.noun && p.verb) {
            var hero = redGuy;
            if (hero && !hero.dead) { WORD_VERBS[p.verb](hero, p.a); this.used++; this.log.unshift(text.trim()); if (this.log.length > 6) this.log.pop(); Components.spawnSparks(hero.x, hero.y, "#a78bfa", 14); this.say("✨ " + text.trim(), "#c4b5fd"); }
            return;
        }
        if (!p.noun) {
            var guess = p.unknown[0] || text;
            this.say("I don't know \"" + guess + "\" yet — try a crate, stairs, trampoline, balloon, rope, tnt, car, knight, dog… or a verb: fly, grow, shrink", "#fca5a5");
            return;
        }
        var m = Components.getMouseWorldPos(), x = m[0], y = m[1];
        // keep it out of the walls: if the mouse is inside something, use the spot above the hero instead
        if (staticObjects.some(function(o) { return !o.dead && Math.abs(o.x - x) < o.w / 2 && Math.abs(o.y - y) < o.h / 2; })) { x = redGuy.x + (redGuy.lastFacing || 1) * 160; y = redGuy.y + 40; }
        WORD_DICT[p.noun].fn(x, y, p.a);
        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
        this.used++;
        this.log.unshift(text.trim()); if (this.log.length > 6) this.log.pop();
        Components.spawnSparks(x, y, "#fde047", 14);
        if (typeof SFX !== "undefined") SFX.play("pickup", x, y);
        this.say("✨ " + text.trim(), "#fde047");
    },
    say: function(t, col) { this.msg = t; this.msgCol = col; this.msgT = 200; }
};

// ---------------------------------------------------------------- rooms
var WORD_ROOMS = [];
function wordRoom(n, title, task, par, layout, gadgets, spawn) {
    var key = "words_" + n;
    var L = ModeKit.room(-1400, 1400, 1800, { tex: "lab_metal", color: "#334155", floorTex: "lab_metal" }).concat(layout);
    ModeKit.addLevel(key, { name: "🔤 Word Lab " + (n + 1) + ": " + title, mode: "words", wavesEnabled: false, spawnP1: spawn || [-1100, 60], spawnP2: [-1000, 60], layout: L, gadgets: gadgets, title: title, task: task, par: par });
    WORD_ROOMS[n] = key;
}
wordRoom(0, "High Shelf", "The star is on a high shelf. Make something to climb!", 1,
    [{ type: "box", name: "High Shelf", x: 700, y: 640, w: 500, h: 40, color: "#475569", texture: "metal_plate", kind: "block" }],
    [{ type: "sign", x: -900, y: 0, text: "Press ENTER and type a thing — try \"stairs\" or \"trampoline\".\nIt appears where your mouse points." }, { type: "star", x: 760, y: 760 }]);
wordRoom(1, "The Gap", "Get across the spike pit to the star.", 1,
    [{ type: "box", name: "Floor", x: -900, y: -200, w: 1000, h: 400, color: "#334155", texture: "lab_metal", kind: "block" }, { type: "box", name: "Floor", x: 1000, y: -200, w: 800, h: 400, color: "#334155", texture: "lab_metal", kind: "block" }],
    [{ type: "spikes", x: 0, y: -800, w: 800 }, { type: "star", x: 1150, y: 120 }, { type: "sign", x: -1000, y: 0, text: "Too far to jump. A bridge? A car? Your call." }], [-1100, 60]);
wordRoom(2, "Guarded", "Three zombies guard the star. Deal with them.", 2,
    [{ type: "box", name: "Pen Wall", x: 200, y: 160, w: 60, h: 320, color: "#475569", texture: "metal_plate", kind: "block" }],
    [{ type: "star", x: 900, y: 90 }, { type: "sign", x: -1000, y: 0, text: "Monsters ahead. Something explosive? Something sharp? A bigger monster?" }]);
wordRoom(3, "Vault", "The star is sealed in a vault with a cracked wall.", 1,
    [{ type: "box", name: "Vault Roof", x: 900, y: 420, w: 700, h: 60, color: "#475569", texture: "metal_plate", kind: "block" }],
    [{ type: "cracked", x: 560, y: 200, w: 80, h: 400 }, { type: "star", x: 950, y: 90 }, { type: "sign", x: -1000, y: 0, text: "Cracked walls crumble in explosions." }]);
wordRoom(4, "Sky Star", "The star floats high above a pit. Go up!", 2,
    [{ type: "box", name: "Floor", x: -900, y: -200, w: 1000, h: 400, color: "#334155", texture: "lab_metal", kind: "block" }],
    [{ type: "star", x: 600, y: 1300 }, { type: "spikes", x: 800, y: -800, w: 1200 }, { type: "sign", x: -1000, y: 0, text: "No floor over there. Fly? Clouds? A fan?" }]);
wordRoom(5, "Low Door", "The star is behind a gap far too low to walk through.", 1,
    [{ type: "box", name: "Low Wall", x: 300, y: 960, w: 120, h: 1800, color: "#475569", texture: "metal_plate", kind: "block" }],
    [{ type: "star", x: 900, y: 70 }, { type: "sign", x: -1000, y: 0, text: "You'll never fit under there... as you are. Verbs work too!" }]);
wordRoom(6, "The Tower", "The star sits on top of a tower far too tall for stairs.", 1,
    [{ type: "box", name: "Tower", x: 700, y: 700, w: 320, h: 1400, color: "#475569", texture: "metal_plate", kind: "block" }],
    [{ type: "star", x: 700, y: 1460 }, { type: "sign", x: -1000, y: 0, text: "Stairs won't reach. Something that goes UP? (verbs work too)" }]);
wordRoom(7, "Pressure Point", "The door only stays open while its plate is weighed down.", 1,
    [{ type: "box", name: "Divider", x: 400, y: 1080, w: 100, h: 1640, color: "#475569", texture: "metal_plate", kind: "block" }],
    [{ type: "plate", x: -200, y: 0, w: 160, links: ["d7"] }, { type: "door", id: "d7", x: 400, y: 130, w: 100, h: 260 },
     { type: "star", x: 900, y: 70 }, { type: "sign", x: -1000, y: 0, text: "You can't stand on the plate and walk through the door at once." }]);

GameModes.register({
    id: "words",
    title: "WORD LAB",
    tagline: "Type a thing and it appears: stairs, trampolines, bridges, TNT, monsters. Reach every star.",
    color: "#fde047",
    firstLevel: function() { return WORD_ROOMS[Math.min(wordsSave.room, WORD_ROOMS.length - 1)]; },
    flags: { waves: false, revive: false, jetpack: false, shooting: true, ability: false, ammo: false, noBedrock: false, scenery: false, coopToggle: true, enemiesPassive: false },
    overTitle: "WORD LAB",

    setupLevel: function(lvl) {
        var key = LevelManager.currentLevelKey;
        if (key === "words_1" || key === "words_4") {
            for (let i = staticObjects.length - 1; i >= 0; i--) { var o = staticObjects[i]; if (o.name === "Floor" && o.w > 2500) staticObjects.splice(i, 1); }
        }
        Gadgets.load(lvl.gadgets);
        WordLab.used = 0; WordLab.log = []; WordLab.done = false; WordLab.doneT = 0; WordLab.close();
        wordsSave.room = Math.max(0, WORD_ROOMS.indexOf(key)); saveWords();
        jetpackEnabled = false;
        zombies.length = 0;
        if (key === "words_2") for (let i = 0; i < 3; i++) { var z = spawnZombie(i === 2 ? "KNIGHT" : "NORMAL", 600 + i * 160, 80); if (z) { z.x = 600 + i * 160; z.y = 80; } }
        WordLab.say(lvl.task, "#e2e8f0");
    },

    update: function() {
        wordPetsUpdate();
        // balloons rise gently (a steady climb you can ride), not like a rocket
        for (let i = 0; i < movingObjects.length; i++) { var bo = movingObjects[i]; if (bo.gravityMult < 0 && bo.yspeed > 3.2) bo.yspeed = 3.2; }
        // holding a balloon (G) lifts you; let go to drop
        for (let i = 0; i < characters.length; i++) { var hc = characters[i]; if (hc.heldObject && hc.heldObject.gravityMult < 0) { hc.yspeed = Math.max(hc.yspeed + 1.1, Math.min(hc.yspeed, 3)); if (hc.yspeed > 3) hc.yspeed = 3; } }
        for (let i = 0; i < characters.length; i++) if (characters[i].y < -1200) Gadgets.killPlayer(characters[i], "WHOOPS!");
        if (!WordLab.done && Gadgets.starsTotal > 0 && Gadgets.starsGot >= Gadgets.starsTotal) {
            WordLab.done = true; WordLab.doneT = 170;
            var lvl = LevelManager.getCurrentLevel(), key = LevelManager.currentLevelKey;
            var stars = WordLab.used <= lvl.par ? 3 : (WordLab.used <= lvl.par + 2 ? 2 : 1);
            wordsSave.best[key] = Math.max(wordsSave.best[key] || 0, stars); saveWords();
            showBanner("ROOM CLEAR!", "★".repeat(stars) + "☆".repeat(3 - stars) + "  ·  " + WordLab.used + " word" + (WordLab.used === 1 ? "" : "s") + " (par " + lvl.par + ")", "#fde047");
            if (typeof SFX !== "undefined") SFX.play("clear");
        }
        if (WordLab.done && --WordLab.doneT === 0) {
            var n = WORD_ROOMS.indexOf(LevelManager.currentLevelKey);
            if (n + 1 < WORD_ROOMS.length) LevelManager.selectLevel(WORD_ROOMS[n + 1]); else { gameOver = true; }
        }
        if (WordLab.msgT > 0) WordLab.msgT--;
    },

    onKey: function(code) {
        if (code === "Enter" || code === "NumpadEnter" || code === "KeyT") { if (!WordLab.open) WordLab.openBox(); return true; }
        if (code === "KeyR") { LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        return false;
    },
    onExit: function() {},
    // no game over in the lab: running out of health just sends you back to the start of the room
    onDamage: function(ch, amount) {
        if (!ch.isPlayer || amount >= 0) return false;
        if (ch.invulnTimer > 0) return true;
        ch.health += amount; ch.hitFlashTimer = 6;
        if (ch.health <= 0) Gadgets.killPlayer(ch, "OUCH!");
        return true;
    },

    drawFront: function() { wordPetsDraw(); },

    drawHUD: function() {
        var lvl = LevelManager.getCurrentLevel(), n = WORD_ROOMS.indexOf(LevelManager.currentLevelKey), best = wordsSave.best[LevelManager.currentLevelKey] || 0;
        uiPanel(14, 14, 440, 96, "#fde047");
        uiText("WORD LAB", 30, 44, 24, "#fde68a", "left", "900");
        uiText("ROOM " + (n + 1) + "/" + WORD_ROOMS.length + "  ·  " + (lvl.title || "") + "   " + "★".repeat(best) + "☆".repeat(3 - best), 30, 68, 14, "#e2e8f0", "left", "800");
        uiText("words used " + WordLab.used + "  ·  par " + (lvl.par || 1) + "  ·  ★ " + Gadgets.starsGot + "/" + Gadgets.starsTotal, 30, 92, 13, "#94a3b8", "left", "700");
        if (WordLab.log.length) {
            uiPanel(cssW - 230, 64, 216, 26 + WordLab.log.length * 18, "#fde047", 0.8);
            uiText("YOUR WORDS", cssW - 122, 82, 11, "#fde68a", "center", "900");
            for (let i = 0; i < WordLab.log.length; i++) uiText(WordLab.log[i], cssW - 218, 100 + i * 18, 12, i ? "#94a3b8" : "#fef9c3", "left", "800");
        }
        if (WordLab.msgT > 0) { ctx.globalAlpha = Math.min(1, WordLab.msgT / 30); uiText(WordLab.msg, cssW / 2, 150, 18, WordLab.msgCol || "#fff", "center", "900"); ctx.globalAlpha = 1; }
        if (!WordLab.open) uiText("ENTER (or T): type a thing  ·  it appears at your mouse  ·  WASD move · click shoot · G grab · R reset room · Esc menu", cssW / 2, cssH - 16, 12, "rgba(220,230,240,0.75)", "center", "700");
        if (typeof drawCrosshair === "function") drawCrosshair();
    },

    menuItems: function(items) {
        var n = Math.max(0, WORD_ROOMS.indexOf(LevelManager.currentLevelKey));
        items.push({ id: "wd_room", label: "Room:  ◀  " + (n + 1) + " / " + WORD_ROOMS.length + "  ▶", hint: "", cycle: true });
        items.push({ id: "wd_words", label: "Word list", hint: "Things it knows" });
    },
    onMenu: function(id, dir) {
        if (id === "wd_room") { var n = Math.max(0, WORD_ROOMS.indexOf(LevelManager.currentLevelKey)); closePause(); LevelManager.selectLevel(WORD_ROOMS[(n + (dir || 1) + WORD_ROOMS.length) % WORD_ROOMS.length]); return true; }
        if (id === "wd_words") { closePause(); WordLab.say("Knows: " + window.Object.keys(WORD_DICT).slice(0, 40).join(", ") + " … + big/tiny, heavy/light, bouncy, colours, angry", "#fde68a"); WordLab.msgT = 600; return true; }
        return false;
    },
    onRestart: function() { LevelManager.selectLevel(LevelManager.currentLevelKey); },
    overSub: function() { var s = 0; WORD_ROOMS.forEach(function(k) { s += wordsSave.best[k] || 0; }); return "All rooms done  ·  ★ " + s + " / " + WORD_ROOMS.length * 3; }
});
