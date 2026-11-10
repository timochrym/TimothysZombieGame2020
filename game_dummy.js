// ============================================================================
// GAME: CRASH LAB  (dummy)  -  abuse a crash-test dummy, score the damage
//   A floppy test dummy (Verlet ragdoll) in a lab full of ramps, pads and spikes. Pick a tool with 1-9
//   (or the mouse wheel) and click: blaster, grab & fling, TNT, bomb, cannon launch, bounce pad, spike
//   block, heavy weight, wrecking ball. Every hard hit is measured from how suddenly each body part
//   changes speed; the head counts most. R = new dummy. Beat your best total.
// ============================================================================
var DUMMY_TOOLS = [
    { id: "blaster", label: "Blaster", icon: "🔫", hint: "click to shoot" },
    { id: "hand", label: "Grab & fling", icon: "✋", hint: "drag the dummy, let go to throw" },
    { id: "tnt", label: "TNT", icon: "🧨", hint: "place a barrel (shoot it)" },
    { id: "bomb", label: "Bomb", icon: "💣", hint: "instant blast" },
    { id: "cannon", label: "Cannon", icon: "🎯", hint: "launch the dummy at the cursor" },
    { id: "pad", label: "Bounce pad", icon: "⏫", hint: "place a pad" },
    { id: "spike", label: "Spike block", icon: "🔺", hint: "place spikes" },
    { id: "weight", label: "Heavy weight", icon: "🏋", hint: "drop a weight from above" },
    { id: "ball", label: "Wrecking ball", icon: "⚫", hint: "swing a ball from the ceiling" }
];
var dummySave = { best: 0 };
try { var _ds = JSON.parse(localStorage.getItem("timsCrashLab") || "null"); if (_ds) dummySave.best = _ds.best || 0; } catch (e) {}

var Dummy = {
    rd: null, tool: 0, total: 0, combo: 0, comboT: 0, bones: 0, parts: [0, 0, 0], tick: 0,
    drag: null, balls: [], spikes: [], lastV: [],
    PART: function(i) { return i === 0 ? 0 : (i <= 2 ? 1 : 2); },     // head / torso / limbs
    MULT: [2.5, 1.2, 0.8]
};

(function() {
    var L = ModeKit.room(-2400, 2400, 2200, { tex: "lab_metal", color: "#334155", floorTex: "lab_metal", floorColor: "#475569" });
    L.push({ type: "ramp", name: "Launch Ramp", x: -1500, y: 200, w: 600, h: 400, dir: "right", color: "#64748b", texture: "lab_metal" });
    L.push({ type: "box", name: "Ledge", x: -900, y: 380, w: 300, h: 40, color: "#475569", texture: "lab_metal", kind: "block" });
    L.push({ type: "box", name: "Pillar", x: 800, y: 300, w: 120, h: 600, color: "#334155", texture: "lab_metal", kind: "wall" });
    L.push({ type: "box", name: "High Shelf", x: 1500, y: 1100, w: 500, h: 40, color: "#475569", texture: "lab_metal", kind: "block" });
    L.push({ type: "bumper", name: "Bounce Pad", x: 300, y: 20, w: 240, h: 40, bounce: 30 });
    L.push({ type: "crate", name: "Crate", x: 1200, y: 40, size: 80 });
    L.push({ type: "crate", name: "TNT Barrel", x: 1700, y: 40, size: 70, explosive: true });
    ModeKit.addLevel("crash_lab", { name: "🧪 Crash Lab", mode: "dummy", wavesEnabled: false, spawnP1: [-300, 60], spawnP2: [-200, 60], layout: L, title: "Crash Lab" });
})();

function dummySpawn(x, y) {
    if (Dummy.rd) Ragdolls.remove(Dummy.rd);
    var fake = { x: x, y: y, s1: 80, s2: 80, zombiePower: "DUMMY", originalColor: "#facc15", lastFacing: 1, xspeed: 0, yspeed: 0 };
    var rd = Ragdolls.spawnFrom(fake, { vx: 0, vy: 0, spin: 0 });
    rd.life = -1;
    rd.style.body = "#facc15"; rd.style.limb = "#fbbf24"; rd.style.head = "#fde047"; rd.style.face = "hero"; rd.style.dead = false;
    rd.style.acc = "headband"; rd.style.accColor = "#111827"; rd.style.sprite = null;
    rd.isDummy = true;
    Dummy.rd = rd;
    Dummy.lastV = [];
    Dummy.total = 0; Dummy.combo = 0; Dummy.bones = 0; Dummy.parts = [0, 0, 0];
    Dummy.grace = 45;
}

// a point resting on / launched by a bounce pad is bouncing, not crashing
function dummyOnPad(p) {
    for (let i = 0; i < staticObjects.length; i++) {
        var s = staticObjects[i];
        if (!s.isBumper || s.dead) continue;
        if (Math.abs(p.x - s.x) < s.w / 2 + p.r + 10 && Math.abs((p.y - p.r) - (s.y + s.h / 2)) < 40) return true;
    }
    return false;
}

function dummyHurt(amount, x, y, part) {
    if (amount <= 0) return;
    Dummy.total += amount;
    Dummy.combo += amount;
    Dummy.comboT = 90;
    Dummy.parts[part] += amount;
    if (Dummy.total > dummySave.best) { dummySave.best = Math.round(Dummy.total); try { localStorage.setItem("timsCrashLab", JSON.stringify(dummySave)); } catch (e) {} }
    if (amount > 8) Components.addFloatingText("-" + Math.round(amount), x, y + 40, part === 0 ? "#f87171" : "#fde68a", Math.min(28, 14 + amount * 0.25));
}

GameModes.register({
    id: "dummy",
    title: "CRASH LAB",
    tagline: "Launch, blast and fling a crash-test dummy. Every bone-rattling hit is scored.",
    color: "#facc15",
    firstLevel: "crash_lab",
    flags: { waves: false, revive: false, jetpack: true, shooting: true, ability: false, ammo: false, noBedrock: false, scenery: false,
        coopToggle: true, dash: true, wallJump: true, airJumps: 1 },
    overTitle: "CRASH LAB",

    setupLevel: function() { Dummy.rd = null; Dummy.balls = []; Dummy.spikes = []; Dummy.drag = null; Dummy.tick = 0; },
    onReset: function() { dummySpawn(-400, 300); },

    onDamage: function() { return true; },                    // the testers never get hurt
    canShoot: function() { return Dummy.tool === 0; },

    cameraTargets: function() {
        var t = [];
        if (redGuy && !redGuy.dead) t.push(redGuy);
        if (Dummy.rd) t.push({ x: Dummy.rd.centerX(), y: Dummy.rd.centerY(), isZombie: false });
        return t;
    },

    onKey: function(code) {
        var m = /^Digit([1-9])$/.exec(code);
        if (m) { Dummy.tool = Math.min(DUMMY_TOOLS.length - 1, Number(m[1]) - 1); return true; }
        if (code === "KeyR") { dummySpawn(redGuy ? redGuy.x + 200 : 0, 500); return true; }
        return false;
    },

    onClick: function(wx, wy, button) {
        if (button !== 0) return false;
        var t = DUMMY_TOOLS[Dummy.tool].id, rd = Dummy.rd;
        if (t === "blaster") return false;
        if (t === "hand" && rd) {
            var best = -1, bd = 140;
            for (let i = 0; i < rd.pts.length; i++) { var d = Math.hypot(rd.pts[i].x - wx, rd.pts[i].y - wy); if (d < bd) { bd = d; best = i; } }
            if (best >= 0) Dummy.drag = { i: best };
        } else if (t === "tnt") { Object.addCrate(wx, wy, 70, "#e84545", { explosive: true, name: "TNT Barrel" }); rebuildAllObjects(); }
        else if (t === "bomb") { Components.blowUp(wx, wy, "#ff6b00", 26, 320, -40, null); screenShake = Math.max(screenShake, 8); }
        else if (t === "cannon" && rd) {
            var cx = rd.centerX(), cy = rd.centerY(), dx = wx - cx, dy = wy - cy, L = Math.hypot(dx, dy) || 1;
            rd.addVelocity(dx / L * 32, dy / L * 32 + 4);
            Components.spawnSparks(cx, cy, "#fde68a", 10);
            if (typeof SFX !== "undefined") SFX.play("explode", cx, cy, 0.6, 1.4);
        }
        else if (t === "pad") { Object.addBumper(Math.round(wx / 40) * 40, Math.round(wy / 40) * 40, 200, 40, 32, "#ff2e63", { name: "Bounce Pad" }); rebuildAllObjects(); }
        else if (t === "spike") { var s = Object.addBox(Math.round(wx / 40) * 40, Math.round(wy / 40) * 40, 160, 40, "#94a3b8", { name: "Spike Block", texture: "solid", kind: "block" }); s.isSpike = true; Dummy.spikes.push(s); rebuildAllObjects(); }
        else if (t === "weight") { var w = Object.addCrate(wx, wy + 700, 120, "#1f2937", { name: "Heavy Weight", texture: "solid", bounciness: -0.05 }); w.yspeed = -6; rebuildAllObjects(); }
        else if (t === "ball") {
            var top = (levelBounds ? levelBounds.topY : 2000) - 40;
            var fakeB = { x: wx, y: wy, s1: 80, s2: 80, zombiePower: "BALL", lastFacing: 1 };
            var bl = new Ragdoll({ kind: "ball" }, 1);
            bl.addPoint(wx, top, 4);            // anchor
            bl.addPoint(wx - 500, top - 400, 70); // ball, swung out to the left
            bl.addStick(0, 1, 1);
            bl.pinned = { x: wx, y: top };
            bl.life = -1; bl.heavy = true;
            bl.drawFn = function(r) {
                var a = r.pts[0], b = r.pts[1];
                ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(wsx(a.x), wsy(a.y)); ctx.lineTo(wsx(b.x), wsy(b.y)); ctx.stroke();
                ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.arc(wsx(b.x), wsy(b.y), b.r * cameraScaleX, 0, 7); ctx.fill();
                ctx.strokeStyle = "#475569"; ctx.lineWidth = 3; ctx.stroke();
            };
            Ragdolls.list.push(bl);
            Dummy.balls.push(bl);
        }
        return true;
    },

    preUpdate: function() {
        Dummy.tick++;
        // wrecking balls stay hung from the ceiling
        for (let i = 0; i < Dummy.balls.length; i++) { var b = Dummy.balls[i]; b.pts[0].x = b.pts[0].px = b.pinned.x; b.pts[0].y = b.pts[0].py = b.pinned.y; b.wake(); }
        // dragging with the hand tool
        var rd = Dummy.rd;
        if (Dummy.drag && rd) {
            if (!mouseDown) {
                Dummy.drag = null;
                // cap the throw so a twitchy flick isn't a teleport
                for (let i = 0; i < rd.pts.length; i++) {
                    var q = rd.pts[i], vx = q.x - q.px, vy = q.y - q.py, sp = Math.hypot(vx, vy);
                    if (sp > 24) { q.px = q.x - vx / sp * 24; q.py = q.y - vy / sp * 24; }
                }
                Dummy.grace = 4;
            }
            else { var m = Components.getMouseWorldPos(), p = rd.pts[Dummy.drag.i]; p.x = m[0]; p.y = m[1]; rd.wake(); }
        }
    },

    update: function() {
        var rd = Dummy.rd;
        if (!rd) return;
        if (Ragdolls.list.indexOf(rd) === -1) { dummySpawn(-400, 300); return; }
        if (Dummy.grace > 0) Dummy.grace--;
        var padHit = false;
        for (let i = 0; i < rd.pts.length && !padHit; i++) padHit = dummyOnPad(rd.pts[i]);
        var scoring = Dummy.grace === 0 && !Dummy.drag && !rd.heldBy && !padHit;
        // blaster bolts that hit the dummy
        for (let l = lazers.length - 1; l >= 0; l--) {
            var lz = lazers[l];
            if (lz.team === 0 || lz.dmHit) continue;
            for (let i = 0; i < rd.pts.length; i++) {
                var bp = rd.pts[i];
                if (Math.hypot(lz.x - bp.x, lz.y - bp.y) < bp.r + 12) {
                    lz.dmHit = true;
                    dummyHurt(6 * Dummy.MULT[Dummy.PART(i)], bp.x, bp.y, Dummy.PART(i));
                    rd.impulseAt(lz.x, lz.y, lz.xspeed * 0.25, lz.yspeed * 0.25, 60);
                    lazers.splice(l, 1);
                    break;
                }
            }
        }
        // damage = how suddenly each part changes velocity (Verlet: velocity = position - previous position)
        for (let i = 0; i < rd.pts.length; i++) {
            var p = rd.pts[i], vx = p.x - p.px, vy = p.y - p.py;
            var lv = Dummy.lastV[i];
            if (lv && scoring) {
                var dv = Math.hypot(vx - lv[0], vy - lv[1]);
                if (dv > 5.5) {
                    var part = Dummy.PART(i);
                    dummyHurt((dv - 5.5) * 1.6 * Dummy.MULT[part], p.x, p.y, part);
                    if (dv > 20 && part === 2 && Dummy.tick - (Dummy.lastCrack || 0) > 20) { Dummy.bones++; Dummy.lastCrack = Dummy.tick; Components.addFloatingText("CRACK!", p.x, p.y + 70, "#f8fafc", 22); if (typeof SFX !== "undefined") SFX.play("bonk", p.x, p.y, 0.8, 0.7); }
                }
            }
            Dummy.lastV[i] = [vx, vy];
        }
        // spike blocks
        for (let s = 0; s < Dummy.spikes.length; s++) {
            var sp = Dummy.spikes[s];
            if (sp.dead) continue;
            for (let i = 0; i < rd.pts.length; i++) {
                var q = rd.pts[i];
                if (Math.abs(q.x - sp.x) < sp.w / 2 + q.r && Math.abs(q.y - sp.y) < sp.h / 2 + q.r + 6 && Dummy.tick % 6 === 0) dummyHurt(4 * Dummy.MULT[Dummy.PART(i)], q.x, q.y, Dummy.PART(i));
            }
        }
        // wrecking balls smack the dummy
        for (let b = 0; b < Dummy.balls.length; b++) {
            var ball = Dummy.balls[b].pts[1], bvx = ball.x - ball.px, bvy = ball.y - ball.py;
            for (let i = 0; i < rd.pts.length; i++) {
                var q2 = rd.pts[i], d = Math.hypot(q2.x - ball.x, q2.y - ball.y);
                if (d < ball.r + q2.r) {
                    var nx = (q2.x - ball.x) / (d || 1), ny = (q2.y - ball.y) / (d || 1);
                    q2.x = ball.x + nx * (ball.r + q2.r); q2.y = ball.y + ny * (ball.r + q2.r);
                    q2.px = q2.x - bvx * 1.4; q2.py = q2.y - bvy * 1.4;
                    rd.wake();
                }
            }
        }
        if (Dummy.comboT > 0 && --Dummy.comboT === 0) { if (Dummy.combo > 150) showBanner("COMBO " + Math.round(Dummy.combo), "", "#facc15"); Dummy.combo = 0; }
    },

    drawWorld: function() {
        var k = cameraScaleX;
        for (let s = 0; s < Dummy.spikes.length; s++) {
            var sp = Dummy.spikes[s];
            if (sp.dead) continue;
            var n = Math.round(sp.w / 32), l = wsx(sp.x - sp.w / 2), t = wsy(sp.y + sp.h / 2);
            ctx.fillStyle = "#e2e8f0"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 1.5;
            for (let i = 0; i < n; i++) { var bx = l + i * sp.w * k / n; ctx.beginPath(); ctx.moveTo(bx, t); ctx.lineTo(bx + sp.w * k / n / 2, t - 26 * k); ctx.lineTo(bx + sp.w * k / n, t); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        }
    },

    drawFront: function() {
        if (Dummy.drag && Dummy.rd) {
            var p = Dummy.rd.pts[Dummy.drag.i];
            ctx.strokeStyle = "rgba(250,204,21,0.8)"; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.arc(wsx(p.x), wsy(p.y), 26, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        }
    },

    drawHUD: function() {
        var dy = 62;
        uiPanel(cssW / 2 - 190, dy, 380, 92, "#facc15");
        uiText("DAMAGE", cssW / 2, dy + 22, 13, "#fde68a", "center", "900");
        uiText(String(Math.round(Dummy.total)), cssW / 2, dy + 60, 40, "#ffffff", "center", "900");
        uiText("best " + dummySave.best + (Dummy.combo > 0 ? "   combo " + Math.round(Dummy.combo) : "") + "   bones " + Dummy.bones, cssW / 2, dy + 84, 12, "#cbd5e1", "center", "800");
        // body chart
        var tot = Math.max(1, Dummy.parts[0] + Dummy.parts[1] + Dummy.parts[2]);
        var names = ["Head", "Torso", "Limbs"], cols = ["#f87171", "#fbbf24", "#a3e635"];
        uiPanel(14, 14, 220, 92, "#facc15", 0.85);
        uiText("CRASH LAB", 26, 38, 18, "#fde047", "left", "900");
        for (let i = 0; i < 3; i++) {
            uiText(names[i], 26, 60 + i * 16, 11, "#cbd5e1", "left", "700");
            ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(80, 52 + i * 16, 140, 9);
            ctx.fillStyle = cols[i]; ctx.fillRect(80, 52 + i * 16, 140 * Dummy.parts[i] / tot, 9);
        }
        // tool bar
        var n = DUMMY_TOOLS.length, bw = 70, x0 = cssW / 2 - (n * (bw + 6)) / 2, y0 = cssH - 96;
        for (let i = 0; i < n; i++) {
            var t = DUMMY_TOOLS[i], bx = x0 + i * (bw + 6), on = i === Dummy.tool;
            ctx.fillStyle = on ? "rgba(250,204,21,0.3)" : "rgba(15,23,42,0.85)"; ctx.fillRect(bx, y0, bw, 58);
            ctx.strokeStyle = on ? "#facc15" : "#475569"; ctx.lineWidth = 2; ctx.strokeRect(bx, y0, bw, 58);
            uiText(t.icon, bx + bw / 2, y0 + 30, 22, "#fff", "center", "800");
            uiText((i + 1) + " " + t.label, bx + bw / 2, y0 + 50, 9, on ? "#fde047" : "#94a3b8", "center", "800");
        }
        uiText(DUMMY_TOOLS[Dummy.tool].label + ": " + DUMMY_TOOLS[Dummy.tool].hint + "  ·  1-9 tools · R new dummy · WASD move · Space jetpack · Esc menu", cssW / 2, cssH - 18, 12, "rgba(220,230,240,0.75)", "center", "700");
    },

    menuItems: function(items) { items.push({ id: "dm_new", label: "New dummy (R)", hint: "" }, { id: "dm_clear", label: "Clear props", hint: "pads, spikes, TNT, weights, balls" }); },
    onMenu: function(id) {
        if (id === "dm_new") { closePause(); dummySpawn(redGuy ? redGuy.x + 200 : 0, 500); return true; }
        if (id === "dm_clear") { closePause(); LevelManager.selectLevel("crash_lab"); return true; }
        return false;
    },
    onRestart: function() { LevelManager.selectLevel("crash_lab"); }
});
