// ============================================================================
// PLAYABLE CHARACTER SKINS
//   original  - your original pixel-art hero (Character.png)
//   stick     - Stick Fight style stick figure
//   brawler   - Street-Fighter style martial artist (gi, headband, fists)
//   cap       - Smash-Bros / platformer style cap-and-overalls hero
// All skins share the same 80px hitbox, so gameplay is identical - only the look and animation change.
// Pick a character from the pause menu (Esc). Choices are remembered between sessions.
// ============================================================================
var SKINS = [
    { id: "original", name: "Original Hero" },
    { id: "stick", name: "Stick Fighter" },
    { id: "brawler", name: "Street Brawler" },
    { id: "cap", name: "Cap Hero" }
];

var heroSkins = ["original", "original", "stick", "brawler"];
try {
    var savedSkins = JSON.parse(localStorage.getItem("timsZombieGameSkins") || "null");
    if (savedSkins && savedSkins.length === 2) {
        heroSkins[0] = SKINS.some(function(s) { return s.id === savedSkins[0]; }) ? savedSkins[0] : "original";
        heroSkins[1] = SKINS.some(function(s) { return s.id === savedSkins[1]; }) ? savedSkins[1] : "original";
    }
} catch (e) {}

function skinName(id) {
    for (let i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i].name;
    return id;
}

function cycleSkin(playerIdx, dir) {
    var cur = 0;
    for (let i = 0; i < SKINS.length; i++) if (SKINS[i].id === heroSkins[playerIdx]) cur = i;
    cur = (cur + (dir || 1) + SKINS.length) % SKINS.length;
    heroSkins[playerIdx] = SKINS[cur].id;
    try { localStorage.setItem("timsZombieGameSkins", JSON.stringify(heroSkins.slice(0, 2))); } catch (e) {}
}

// ---------------------------------------------------------------------------
// Drawing helpers (all coordinates are in a design space where the character box is 80 x 80,
// origin at the centre, +y downward; everything is scaled by S/80 and drawn onto `ctx`)
// ---------------------------------------------------------------------------
// 0..1: how much extra detail to draw (set per character from its on-screen size; big = more detail)
var SKIN_DETAIL = 0;

function skinSeg(x1, y1, x2, y2, lw, col, flash) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a0f16";
    ctx.lineWidth = lw + 5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = flash ? "#ffffff" : col;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (SKIN_DETAIL > 0 && !flash && typeof col === "string" && col[0] === "#") {
        // shading: a darker under-edge and a light top-edge highlight along the limb
        var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        if (ny > 0) { nx = -nx; ny = -ny; }
        ctx.globalAlpha = 0.55 * SKIN_DETAIL;
        ctx.strokeStyle = Components.shade(col, -45); ctx.lineWidth = lw * 0.35;
        ctx.beginPath(); ctx.moveTo(x1 - nx * lw * 0.3, y1 - ny * lw * 0.3); ctx.lineTo(x2 - nx * lw * 0.3, y2 - ny * lw * 0.3); ctx.stroke();
        ctx.strokeStyle = Components.shade(col, 60); ctx.lineWidth = lw * 0.22;
        ctx.beginPath(); ctx.moveTo(x1 + nx * lw * 0.25, y1 + ny * lw * 0.25); ctx.lineTo(x2 + nx * lw * 0.25, y2 + ny * lw * 0.25); ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

function skinPoly(pts, fill, flash) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = flash ? "#ffffff" : fill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#0a0f16";
    ctx.lineJoin = "round";
    ctx.stroke();
}

function skinCirc(x, y, r, fill, flash, outline) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = flash ? "#ffffff" : fill;
    ctx.fill();
    if (SKIN_DETAIL > 0 && !flash && r > 3 && typeof fill === "string" && fill[0] === "#") {
        // round shading + a specular shine on heads, hands and joints
        ctx.save();
        ctx.clip();
        ctx.globalAlpha = 0.35 * SKIN_DETAIL;
        ctx.fillStyle = Components.shade(fill, -50);
        ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.4, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.65 * SKIN_DETAIL;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    if (outline !== false) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#0a0f16";
        ctx.stroke();
    }
}

// Two-bone limb: from a to b with a bent knee/elbow (bend pushes the joint sideways)
function skinLimb(ax, ay, bx, by, bend, lw, col, flash) {
    var mx = (ax + bx) / 2 + bend, my = (ay + by) / 2;
    skinSeg(ax, ay, mx, my, lw, col, flash);
    skinSeg(mx, my, bx, by, lw, col, flash);
    return [mx, my];
}

// st: { facing:+1/-1, phase, moving(0..1), air, rising, aimX, aimY (unit, screen space), color, firing, flash, t }
function drawHeroSkin(skin, cx, cy, S, st) {
    SKIN_DETAIL = (typeof settings === "undefined" || settings.charDetail !== false) ? Math.max(0, Math.min(1, (S - 70) / 50)) : 0;
    ctx.save();
    ctx.translate(cx, cy);
    var k = S / 80;
    ctx.scale(k, k);
    var f = st.facing || 1;
    var ph = st.phase || 0;
    var run = st.moving || 0;
    var fl = !!st.flash;
    var col = st.color || "#ff5a5f";
    var bob = (st.air ? 0 : Math.sin((st.t || 0) * 0.006) * 1.2) + (run > 0.1 ? Math.abs(Math.sin(ph)) * -2.5 : 0);
    var ax = st.aimX, ay = st.aimY;
    if (ax === undefined) { ax = f; ay = 0; }

    // foot positions shared by the animated skins
    var sw = Math.sin(ph) * 15 * run;
    var liftA = Math.max(0, Math.cos(ph)) * 7 * run;
    var liftB = Math.max(0, -Math.cos(ph)) * 7 * run;
    var footAx, footAy, footBx, footBy;
    if (st.air) {
        footAx = -7 + f * 7; footAy = 30;
        footBx = 8 + f * 7; footBy = st.rising ? 22 : 33;
    } else {
        footAx = -9 + sw; footAy = 36 - liftA;
        footBx = 9 - sw; footBy = 36 - liftB;
    }

    if (skin === "stick") {
        var lw = 6;
        // legs
        skinLimb(0, 10 + bob, footAx, footAy, f * 6, lw, col, fl);
        skinLimb(0, 10 + bob, footBx, footBy, f * 6, lw, col, fl);
        // torso (slight lean into the run)
        var lean = f * 4 * run;
        skinSeg(0, 10 + bob, lean, -12 + bob, lw + 1, col, fl);
        // back arm swings opposite the legs
        var bax = -f * 8 - sw * 0.5, bay = 8 + bob;
        skinLimb(lean, -9 + bob, bax, bay, -f * 4, lw - 1, col, fl);
        // gun arm along the aim line
        var hx = lean + ax * 26, hy = -9 + bob + ay * 26;
        skinLimb(lean, -9 + bob, hx, hy, ay * -4, lw - 1, col, fl);
        // blaster
        if (!st.fists) skinSeg(hx, hy, hx + ax * 13, hy + ay * 13, 7, "#334155", fl);
        if (st.firing && !st.fists) skinCirc(hx + ax * 17, hy + ay * 17, 6, "#fff3a0", false, false);
        // head + headband ribbon
        skinCirc(lean, -24 + bob, 11, "#0a0f16", false, false);
        skinCirc(lean, -24 + bob, 8.5, fl ? "#ffffff" : "#f8fafc", false, false);
        ctx.fillStyle = col;
        ctx.fillRect(lean - 9, -27 + bob, 18, 4);
        skinSeg(lean - f * 9, -25 + bob, lean - f * (18 + Math.sin(ph * 2 + 1) * 3), -22 + bob + Math.sin((st.t || 0) * 0.02) * 4, 3, col, fl);
        ctx.fillStyle = "#0a0f16";
        ctx.fillRect(lean + f * 3 - 1, -23 + bob, 3, 4);
    } else if (skin === "brawler") {
        var skin1 = "#f2c9a0", gi = "#f8fafc";
        var wide = st.air ? 0 : 3;
        // legs: wide fighting stance, gi trousers
        skinLimb(-6, 8 + bob, footAx - wide, footAy, -f * 3, 12, gi, fl);
        skinLimb(6, 8 + bob, footBx + wide, footBy, f * 3, 12, gi, fl);
        skinCirc(footAx - wide, footAy + 1, 5.5, fl ? "#fff" : "#1f2937", false);
        skinCirc(footBx + wide, footBy + 1, 5.5, fl ? "#fff" : "#1f2937", false);
        // torso: gi jacket (trapezoid) + belt + lapels
        skinPoly([[-17, -14 + bob], [17, -14 + bob], [13, 11 + bob], [-13, 11 + bob]], gi, fl);
        if (!fl) {
            ctx.strokeStyle = "#cbd5e1";
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-9, -14 + bob); ctx.lineTo(2, 4 + bob); ctx.lineTo(9, -14 + bob); ctx.stroke();
        }
        ctx.fillStyle = fl ? "#fff" : col;
        ctx.fillRect(-14, 4 + bob, 28, 7);
        skinSeg(f * 10, 9 + bob, f * 15 + Math.sin(ph * 2) * 3, 20 + bob, 4, col, fl);
        // arms: muscular bare arms, red wristbands. Firing = two-handed energy thrust
        var sx0 = -15, sx1 = 15, sy = -9 + bob;
        if (st.firing && !st.fists) {
            skinLimb(sx0, sy, ax * 28 - 4, sy + ay * 28, ay * 4, 10, skin1, fl);
            skinLimb(sx1, sy, ax * 28 + 4, sy + ay * 28, ay * 4, 10, skin1, fl);
            skinCirc(ax * 38, sy + ay * 38, 9, "#a5f3fc", false);
            skinCirc(ax * 38, sy + ay * 38, 5, "#ffffff", false, false);
        } else {
            // front fist guards along the aim, rear arm bobs
            skinLimb(sx1, sy, ax * 24 + 8, sy + ay * 24, ay * 4, 10, skin1, fl);
            skinCirc(ax * 24 + 8, sy + ay * 24, 6, fl ? "#fff" : col, false);
            skinLimb(sx0, sy, -16 - sw * 0.3, 6 + bob, -3, 10, skin1, fl);
            skinCirc(-16 - sw * 0.3, 6 + bob, 6, fl ? "#fff" : col, false);
        }
        // head: skin, spiky hair, headband with fluttering tail, angry brow
        skinCirc(0, -27 + bob, 12, skin1, fl);
        skinPoly([[-12, -30 + bob], [-9, -42 + bob], [-3, -34 + bob], [2, -45 + bob], [6, -34 + bob], [12, -41 + bob], [12, -30 + bob]], "#111827", fl);
        ctx.fillStyle = fl ? "#fff" : col;
        ctx.fillRect(-12, -30 + bob, 24, 5);
        skinSeg(-f * 12, -28 + bob, -f * (24 + Math.sin(ph * 2) * 2), -24 + bob + Math.sin((st.t || 0) * 0.02) * 5, 4, col, fl);
        ctx.fillStyle = "#0a0f16";
        ctx.fillRect(f * 3 - 6, -25 + bob, 5, 3);
        ctx.fillRect(f * 3 + 2, -25 + bob, 5, 3);
        ctx.fillRect(f * 3 - 7, -27 + bob, 16, 2);
    } else if (skin === "cap") {
        var skin2 = "#fdd5ae", overall = "#2563eb";
        // legs (overalls) + big shoes
        skinLimb(-6, 8 + bob, footAx, footAy, f * 3, 12, overall, fl);
        skinLimb(6, 8 + bob, footBx, footBy, f * 3, 12, overall, fl);
        skinPoly([[footAx - 8, footAy + 5], [footAx + 9 * f, footAy + 5], [footAx + 10 * f, footAy - 4], [footAx - 6, footAy - 5]], "#7c2d12", fl);
        skinPoly([[footBx - 8, footBy + 5], [footBx + 9 * f, footBy + 5], [footBx + 10 * f, footBy - 4], [footBx - 6, footBy - 5]], "#7c2d12", fl);
        // torso: shirt in the player's colour, overalls bib with straps and buttons
        skinPoly([[-14, -14 + bob], [14, -14 + bob], [14, 12 + bob], [-14, 12 + bob]], col, fl);
        skinPoly([[-14, -1 + bob], [14, -1 + bob], [14, 12 + bob], [-14, 12 + bob]], overall, fl);
        ctx.fillStyle = fl ? "#fff" : overall;
        ctx.fillRect(-12, -14 + bob, 5, 14);
        ctx.fillRect(7, -14 + bob, 5, 14);
        skinCirc(-9.5, -2 + bob, 2.8, "#fde047", fl, false);
        skinCirc(9.5, -2 + bob, 2.8, "#fde047", fl, false);
        // arms: gloved. Gun arm along the aim; rear arm swings. Jump = rear arm punches skyward
        skinLimb(-13, -8 + bob, -f * 12 - sw * 0.4, st.air ? -22 : 5 + bob, -3, 8, col, fl);
        skinCirc(-f * 12 - sw * 0.4, st.air ? -24 : 5 + bob, 6, fl ? "#fff" : "#ffffff", false);
        var gx = 13 + ax * 24, gy = -8 + bob + ay * 24;
        skinLimb(13, -8 + bob, gx, gy, ay * -3, 8, col, fl);
        if (!st.fists) skinSeg(gx, gy, gx + ax * 12, gy + ay * 12, 7, "#334155", fl);
        skinCirc(gx, gy, 6, fl ? "#fff" : "#ffffff", false);
        if (st.firing && !st.fists) skinCirc(gx + ax * 17, gy + ay * 17, 6, "#fff3a0", false, false);
        // head: face, nose, cap with brim + emblem
        skinCirc(0, -27 + bob, 12.5, skin2, fl);
        skinCirc(f * 11, -25 + bob, 3.6, "#f2b88a", fl, false);
        ctx.fillStyle = "#0a0f16";
        ctx.fillRect(f * 2, -30 + bob, 3, 6);
        ctx.fillRect(f * 7 - 1, -30 + bob, 3, 6);
        ctx.beginPath();
        ctx.arc(0, -29 + bob, 13.5, Math.PI, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = fl ? "#fff" : col;
        ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = "#0a0f16"; ctx.stroke();
        skinPoly([[f * 2, -30 + bob], [f * 20, -29 + bob], [f * 20, -26 + bob], [f * 2, -26 + bob]], col, fl);
        skinCirc(f * 1, -37 + bob, 4.5, "#ffffff", fl, false);
        ctx.fillStyle = fl ? "#fff" : col;
        ctx.font = "900 6px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(st.label || "P", f * 1, -35 + bob);
    }
    ctx.restore();
}

// Draws the original sprite hero in the same call signature (used by menu previews)
function drawSkinPreview(skin, cx, cy, S, color, label) {
    if (skin === "original") {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (characterImg && characterImg.complete) ctx.drawImage(characterImg, cx - S / 2, cy - S / 2, S, S);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#0a0f16";
        ctx.strokeRect(cx - S / 2, cy - S / 2, S, S);
        ctx.restore();
        return;
    }
    var t = Date.now();
    drawHeroSkin(skin, cx, cy, S, {
        facing: 1, phase: t * 0.012, moving: 1, air: false, aimX: 1, aimY: 0,
        color: color, firing: (Math.floor(t / 500) % 3 === 0), flash: false, t: t, label: label
    });
}

// ============================================================================
// ENEMY CHARACTERS - every archetype is a distinct, animated character (same 80px design space)
//   NORMAL shambling zombie | LEAPER crouching sprinter | TANK hulking brute | EXPLODER dynamite-vest zombie
//   SPITTER hunched acid-spitter | SLIME / MINI_SLIME blob | BAT winged gargoyle | ARCHER skeleton bowman
//   KNIGHT armoured swordsman | MAGE hooded necromancer | BOSS_KING crowned giant
// st: { power, facing, phase, moving, air, rising, aimX, aimY, color, firing, flash, t, ragdoll, frozen }
// ============================================================================
function enemyGait(st, stride) {
    var f = st.facing || 1, ph = st.phase || 0, run = st.moving || 0, t = st.t || 0;
    var g = { bob: 0, sw: 0, run: run };
    if (st.ragdoll) {
        var tt = t * 0.02;
        g.fax = -16 + Math.sin(tt * 1.7) * 10; g.fay = 28 + Math.cos(tt * 1.3) * 5;
        g.fbx = 16 + Math.sin(tt * 1.1 + 2) * 10; g.fby = 26 + Math.sin(tt * 1.9) * 6;
        g.run = 0;
        return g;
    }
    var sw = Math.sin(ph) * stride * run;
    var la = Math.max(0, Math.cos(ph)) * 6 * run, lb = Math.max(0, -Math.cos(ph)) * 6 * run;
    if (st.air) {
        g.fax = -6 + f * 6; g.fay = 30; g.fbx = 8 + f * 6; g.fby = st.rising ? 22 : 33;
    } else {
        g.fax = -9 + sw; g.fay = 36 - la; g.fbx = 9 - sw; g.fby = 36 - lb;
        g.bob = run > 0.1 ? -Math.abs(Math.sin(ph)) * 2 : Math.sin(t * 0.005) * 1;
    }
    g.sw = sw;
    return g;
}

// hand positions: normal pose or floppy ragdoll flail
function enemyHand(st, i, nx, ny) {
    if (st.ragdoll) {
        var tt = (st.t || 0) * 0.02 + i * 2.3;
        return [Math.sin(tt) * 26, -6 + Math.cos(tt * 1.3) * 20];
    }
    return [nx, ny];
}

function drawEnemySkin(skin, cx, cy, S, st) {
    SKIN_DETAIL = (typeof settings === "undefined" || settings.charDetail !== false) ? Math.max(0, Math.min(1, (S - 70) / 50)) : 0;
    ctx.save();
    ctx.translate(cx, cy);
    var k = S / 80;
    ctx.scale(k, k);
    var f = st.facing || 1, ph = st.phase || 0, t = st.t || 0;
    var fl = !!st.flash;
    var col = st.color || "#2d6e32";
    var ax = st.aimX, ay = st.aimY;
    if (ax === undefined) { ax = f; ay = 0; }
    var light = Components.shade(col, 38), dark = Components.shade(col, -45);

    if (skin === "NORMAL" || skin === "SPITTER" || skin === "EXPLODER" || skin === "LEAPER") {
        var leaper = skin === "LEAPER", spit = skin === "SPITTER", boom = skin === "EXPLODER";
        var g = enemyGait(st, leaper ? 18 : 11);
        var bob = g.bob + (leaper && !st.air ? 6 : 0);          // leapers crouch low
        var lean = (spit || leaper) ? f * 6 : f * 2;
        skinLimb(-6, 8 + bob, g.fax, g.fay, f * (leaper ? 9 : 3), leaper ? 9 : 11, "#374151", fl);
        skinLimb(6, 8 + bob, g.fbx, g.fby, f * (leaper ? 9 : 3), leaper ? 9 : 11, "#374151", fl);
        skinCirc(g.fax, g.fay + 2, 5, "#111827", fl);
        skinCirc(g.fbx, g.fby + 2, 5, "#111827", fl);
        // torso: tattered shirt
        var shirt = boom ? "#7c2d12" : (leaper ? "#365314" : "#475569");
        skinPoly([[-14 + lean, -14 + bob], [14 + lean, -14 + bob], [12, 11 + bob], [8, 7 + bob], [4, 12 + bob], [0, 7 + bob], [-5, 12 + bob], [-12, 8 + bob]], shirt, fl);
        if (!fl) { ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -8 + bob); ctx.lineTo(2, 4 + bob); ctx.stroke(); }
        if (boom) {
            // dynamite vest with a hissing fuse
            for (let d = 0; d < 3; d++) {
                ctx.fillStyle = fl ? "#fff" : "#dc2626";
                ctx.fillRect(-12 + d * 9, -6 + bob, 7, 15);
                ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2; ctx.strokeRect(-12 + d * 9, -6 + bob, 7, 15);
            }
            var pulse = 0.5 + 0.5 * Math.sin(t * 0.02);
            skinSeg(2, -6 + bob, 6, -15 + bob, 2, "#fbbf24", fl);
            skinCirc(6 + Math.sin(t * 0.05) * 1.5, -17 + bob, 3 + pulse * 3, pulse > 0.5 ? "#fde047" : "#fb923c", false, false);
        }
        // arms: reach toward the player (or flail when ragdolled)
        var reach = leaper && st.air ? 34 : 27;
        var h1 = enemyHand(st, 0, f * reach, -10 + bob + Math.sin(ph * 0.5) * 3);
        var h2 = enemyHand(st, 1, f * (reach - 4), -3 + bob + Math.cos(ph * 0.5) * 3);
        skinLimb(f * 6, -9 + bob, h1[0], h1[1], -3, 9, col, fl);
        skinLimb(f * 4, -7 + bob, h2[0], h2[1], 3, 9, light, fl);
        if (leaper) { skinCirc(h1[0], h1[1], 4, "#d9f99d", fl); skinCirc(h2[0], h2[1], 4, "#d9f99d", fl); }
        // head
        var hy = (spit ? -23 : -27) + bob;
        var hx = lean + (spit ? f * 5 : 0);
        skinCirc(hx, hy, 12, light, fl);
        if (!fl) {
            ctx.fillStyle = "#0a0f16"; ctx.fillRect(hx + f * 1 - 7, hy - 5, 14, 5);
            ctx.fillStyle = "#ff3b4a"; ctx.fillRect(hx + f * 1 - 6, hy - 4, 4, 3); ctx.fillRect(hx + f * 1 + 2, hy - 4, 4, 3);
            // jagged teeth
            ctx.fillStyle = "#f1f5f9";
            for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(hx - 7 + i * 3, hy + 4); ctx.lineTo(hx - 5.5 + i * 3, hy + (i % 2 ? 9 : 11)); ctx.lineTo(hx - 4 + i * 3, hy + 4); ctx.fill(); }
            ctx.fillStyle = "rgba(244,114,182,0.8)"; ctx.fillRect(hx - f * 6 - 3, hy - 12, 7, 4); // exposed brain patch
        }
        if (spit) {
            skinCirc(f * 10 + lean, -12 + bob, 7 + Math.sin(t * 0.01) * 1.5, "#a3e635", fl);
            skinCirc(hx + f * 8, hy + 14 + ((t * 0.05) % 10), 2.6, "#bef264", false, false);
        }
    } else if (skin === "TANK") {
        var gt = enemyGait(st, 8);
        var b = gt.bob;
        skinLimb(-10, 8 + b, gt.fax - 3, gt.fay, f * 3, 17, "#3b1d33", fl);
        skinLimb(10, 8 + b, gt.fbx + 3, gt.fby, f * 3, 17, "#3b1d33", fl);
        skinPoly([[gt.fax - 14, gt.fay + 6], [gt.fax + 10, gt.fay + 6], [gt.fax + 8, gt.fay - 4], [gt.fax - 12, gt.fay - 4]], "#1f2937", fl);
        skinPoly([[gt.fbx - 10, gt.fby + 6], [gt.fbx + 14, gt.fby + 6], [gt.fbx + 12, gt.fby - 4], [gt.fbx - 8, gt.fby - 4]], "#1f2937", fl);
        skinPoly([[-27, -17 + b], [27, -17 + b], [22, 14 + b], [-22, 14 + b]], col, fl);
        skinPoly([[-27, -17 + b], [-12, -17 + b], [-18, -8 + b], [-27, -8 + b]], "#9ca3af", fl);
        skinPoly([[27, -17 + b], [12, -17 + b], [18, -8 + b], [27, -8 + b]], "#9ca3af", fl);
        if (!fl) {
            ctx.fillStyle = "#e5e7eb";
            for (let sp = 0; sp < 3; sp++) {
                ctx.beginPath(); ctx.moveTo(-26 + sp * 5, -17 + b); ctx.lineTo(-23 + sp * 5, -26 + b); ctx.lineTo(-20 + sp * 5, -17 + b); ctx.fill();
                ctx.beginPath(); ctx.moveTo(26 - sp * 5, -17 + b); ctx.lineTo(23 - sp * 5, -26 + b); ctx.lineTo(20 - sp * 5, -17 + b); ctx.fill();
            }
        }
        ctx.fillStyle = fl ? "#fff" : "#6b7280"; ctx.fillRect(-22, 6 + b, 44, 6);
        var th1 = enemyHand(st, 0, f * 30 + gt.sw * 0.3, 6 + b), th2 = enemyHand(st, 1, -f * 26 - gt.sw * 0.3, 8 + b);
        skinLimb(f * 24, -10 + b, th1[0], th1[1], f * 6, 15, col, fl);
        skinLimb(-f * 24, -10 + b, th2[0], th2[1], -f * 6, 15, light, fl);
        skinCirc(th1[0], th1[1], 9, light, fl); skinCirc(th2[0], th2[1], 9, light, fl);
        skinCirc(f * 3, -24 + b, 10, light, fl);
        if (!fl) { ctx.fillStyle = "#ff3b4a"; ctx.fillRect(f * 3 - 7, -27 + b, 5, 4); ctx.fillRect(f * 3 + 2, -27 + b, 5, 4); ctx.fillStyle = "#0a0f16"; ctx.fillRect(f * 3 - 7, -20 + b, 14, 4); }
    } else if (skin === "SLIME" || skin === "MINI_SLIME") {
        var wob = Math.sin(t * 0.008 + (st.id || 0)) * 3.5;
        var squish = st.air ? -5 : Math.sin(ph * 2) * 2 * (st.moving || 0);
        var wd = 33 + wob - squish, ht = 27 - wob + squish;
        var by = 30;
        ctx.beginPath();
        ctx.moveTo(-wd, by);
        ctx.bezierCurveTo(-wd - 5, by - ht * 1.2, -wd * 0.4, by - ht * 2.1 - wob, 0, by - ht * 2.05 - wob);
        ctx.bezierCurveTo(wd * 0.4, by - ht * 2.1 - wob, wd + 5, by - ht * 1.2, wd, by);
        ctx.closePath();
        var gr = ctx.createLinearGradient(0, by - ht * 2, 0, by);
        gr.addColorStop(0, fl ? "#fff" : light); gr.addColorStop(1, fl ? "#ddd" : col);
        ctx.globalAlpha = 0.9; ctx.fillStyle = gr; ctx.fill(); ctx.globalAlpha = 1;
        ctx.lineWidth = 3.5; ctx.strokeStyle = "#0a0f16"; ctx.stroke();
        if (!fl) {
            ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.ellipse(-wd * 0.4, by - ht * 1.6, 7, 4, -0.5, 0, 7); ctx.fill();
            ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(f * -4, by - ht * 0.8, 8, 0, 7); ctx.fill(); // inner core
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(f * 8 - 7, by - ht * 1.25, 5.5, 0, 7); ctx.arc(f * 8 + 7, by - ht * 1.25, 5.5, 0, 7); ctx.fill();
            ctx.fillStyle = "#0a0f16"; ctx.beginPath(); ctx.arc(f * 8 - 7 + f * 1.5, by - ht * 1.25, 2.6, 0, 7); ctx.arc(f * 8 + 7 + f * 1.5, by - ht * 1.25, 2.6, 0, 7); ctx.fill();
            ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f * 8, by - ht * 0.95, 6, 0.2, Math.PI - 0.2); ctx.stroke();
        }
    } else if (skin === "BAT") {
        var flap = st.ragdoll ? 0.2 : Math.sin(t * 0.03 + (st.id || 0));
        var wy = -6 + flap * 22;
        // wings
        skinPoly([[-8, -4], [-40, wy - 6], [-34, wy + 12], [-24, wy + 4], [-20, wy + 16], [-8, 8]], dark, fl);
        skinPoly([[8, -4], [40, wy - 6], [34, wy + 12], [24, wy + 4], [20, wy + 16], [8, 8]], dark, fl);
        // body, ears, head
        skinCirc(0, 6, 13, col, fl);
        skinPoly([[-11, -12], [-7, -30], [-1, -14]], col, fl);
        skinPoly([[11, -12], [7, -30], [1, -14]], col, fl);
        skinCirc(0, -8, 12, light, fl);
        skinSeg(-5, 17, -7, 26, 3, "#0a0f16", fl); skinSeg(5, 17, 7, 26, 3, "#0a0f16", fl);
        if (!fl) {
            ctx.fillStyle = "#ff2e63"; ctx.fillRect(-7, -11, 5, 5); ctx.fillRect(2, -11, 5, 5);
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(-3, 5); ctx.lineTo(-1, -2); ctx.moveTo(1, -2); ctx.lineTo(3, 5); ctx.lineTo(5, -2); ctx.fill();
        }
    } else if (skin === "ARCHER") {
        var ga = enemyGait(st, 10);
        var bn = "#e5e7eb", ba = ga.bob;
        skinLimb(-6, 8 + ba, ga.fax, ga.fay, f * 3, 5, bn, fl);
        skinLimb(6, 8 + ba, ga.fbx, ga.fby, f * 3, 5, bn, fl);
        skinSeg(0, 8 + ba, 0, -12 + ba, 5, bn, fl);
        for (let r = 0; r < 3; r++) skinSeg(-10, -10 + r * 6 + ba, 10, -10 + r * 6 + ba, 3.5, bn, fl);
        skinPoly([[-14, -12 + ba], [-18, -4 + ba], [-14, 8 + ba]], col, fl);           // quiver
        for (let q = 0; q < 3; q++) skinSeg(-16 + q * 2, -14 + ba, -17 + q * 2, -22 + ba, 2, "#fde68a", fl);
        // bow arm along the aim
        var bhx = ax * 24, bhy = -8 + ba + ay * 24;
        var hnd = enemyHand(st, 0, bhx, bhy);
        skinLimb(4, -9 + ba, hnd[0], hnd[1], ay * -3, 5, bn, fl);
        if (!st.ragdoll) {
            var px = -ay, py = ax;
            var t1 = [bhx + px * 20, bhy + py * 20], t2 = [bhx - px * 20, bhy - py * 20];
            ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 7; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.quadraticCurveTo(bhx + ax * 12, bhy + ay * 12, t2[0], t2[1]); ctx.stroke();
            ctx.strokeStyle = fl ? "#fff" : "#a16207"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.quadraticCurveTo(bhx + ax * 12, bhy + ay * 12, t2[0], t2[1]); ctx.stroke();
            var pull = st.firing ? -2 : -9;
            ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(bhx + ax * pull, bhy + ay * pull); ctx.lineTo(t2[0], t2[1]); ctx.stroke();
            if (!st.firing) skinSeg(bhx + ax * pull, bhy + ay * pull, bhx + ax * 22, bhy + ay * 22, 2.5, "#fde68a", fl);
        }
        // skull under a tan hood
        skinCirc(0, -26 + ba, 11.5, fl ? "#fff" : "#f8fafc", false);
        skinPoly([[-13, -22 + ba], [-11, -38 + ba], [0, -42 + ba], [11, -38 + ba], [13, -22 + ba], [8, -26 + ba], [-8, -26 + ba]], col, fl);
        if (!fl) { ctx.fillStyle = "#0a0f16"; ctx.beginPath(); ctx.arc(-4, -24 + ba, 3.4, 0, 7); ctx.arc(4, -24 + ba, 3.4, 0, 7); ctx.fill(); ctx.fillStyle = "#00f5d4"; ctx.fillRect(-5, -25 + ba, 2, 2); ctx.fillRect(3, -25 + ba, 2, 2); ctx.fillRect(-4, -17 + ba, 8, 2); }
    } else if (skin === "KNIGHT") {
        var gk = enemyGait(st, 9);
        var kb = gk.bob, steel = "#9ca3af", steelD = "#6b7280";
        skinLimb(-7, 8 + kb, gk.fax, gk.fay, f * 3, 12, steelD, fl);
        skinLimb(7, 8 + kb, gk.fbx, gk.fby, f * 3, 12, steelD, fl);
        skinPoly([[gk.fax - 9, gk.fay + 6], [gk.fax + 9 * f, gk.fay + 6], [gk.fax + 10 * f, gk.fay - 4], [gk.fax - 7, gk.fay - 4]], "#374151", fl);
        skinPoly([[gk.fbx - 9, gk.fby + 6], [gk.fbx + 9 * f, gk.fby + 6], [gk.fbx + 10 * f, gk.fby - 4], [gk.fbx - 7, gk.fby - 4]], "#374151", fl);
        skinPoly([[-17, -15 + kb], [17, -15 + kb], [14, 11 + kb], [-14, 11 + kb]], steel, fl);
        if (!fl) { ctx.fillStyle = "#e63946"; ctx.fillRect(-3, -12 + kb, 6, 20); ctx.fillStyle = "#374151"; ctx.fillRect(-16, 6 + kb, 32, 5); }
        // sword arm (back) + shield arm (front)
        var sh = enemyHand(st, 0, -f * 20, -2 + kb + Math.sin(ph) * 3 * (st.moving || 0));
        skinLimb(-f * 14, -9 + kb, sh[0], sh[1], -f * 3, 9, steelD, fl);
        if (!st.ragdoll) {
            skinSeg(sh[0], sh[1], sh[0] - f * 2 + (st.firing ? f * 16 : 0), sh[1] - 26, 4, "#e5e7eb", fl);
            skinSeg(sh[0] - 5, sh[1] - 2, sh[0] + 5, sh[1] - 2, 3, "#fbbf24", fl);
        }
        var shh = enemyHand(st, 1, f * 20, -2 + kb);
        skinLimb(f * 14, -9 + kb, shh[0], shh[1], f * 3, 9, steelD, fl);
        skinCirc(shh[0] + f * 3, shh[1], 13, "#b91c1c", fl);
        if (!fl) { ctx.fillStyle = "#e5e7eb"; ctx.fillRect(shh[0] + f * 3 - 1.5, shh[1] - 10, 3, 20); ctx.fillRect(shh[0] + f * 3 - 10, shh[1] - 1.5, 20, 3); }
        // helmet with plume + visor
        skinCirc(0, -28 + kb, 12.5, steel, fl);
        skinPoly([[-12, -30 + kb], [12, -30 + kb], [12, -22 + kb], [-12, -22 + kb]], steel, fl);
        if (!fl) { ctx.fillStyle = "#0a0f16"; ctx.fillRect(-9, -29 + kb, 18, 4); ctx.fillRect(-1.5, -29 + kb, 3, 11); }
        skinPoly([[-3, -40 + kb], [3, -40 + kb], [-f * 14 - 3, -40 + kb + Math.sin(t * 0.012) * 3 + 8], [-f * 18, -30 + kb]], "#e63946", fl);
    } else if (skin === "MAGE") {
        var hover = st.ragdoll ? 0 : Math.sin(t * 0.005 + (st.id || 0)) * 3;
        var mb = hover - 2;
        // flowing robe (no legs) + swaying hem
        skinPoly([[-13, -14 + mb], [13, -14 + mb], [24, 34 + mb + Math.sin(t * 0.01) * 2], [8, 28 + mb], [0, 36 + mb], [-8, 28 + mb], [-24, 34 + mb - Math.sin(t * 0.01) * 2]], col, fl);
        if (!fl) { ctx.fillStyle = "#c77dff"; ctx.fillRect(-14, 4 + mb, 28, 4); ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -12 + mb); ctx.lineTo(0, 30 + mb); ctx.stroke(); }
        // staff arm + orb
        var casting = st.firing;
        var hsx = f * 24, hsy = (casting ? -22 : -2) + mb;
        var sh2 = enemyHand(st, 0, hsx, hsy);
        skinLimb(f * 10, -9 + mb, sh2[0], sh2[1], -3, 7, "#7e22ce", fl);
        if (!st.ragdoll) {
            skinSeg(sh2[0], sh2[1] + 30, sh2[0], sh2[1] - 20, 4, "#78350f", fl);
            var orbP = 0.5 + 0.5 * Math.sin(t * 0.015);
            ctx.shadowColor = "#e0aaff"; ctx.shadowBlur = 14;
            skinCirc(sh2[0], sh2[1] - 26, 7 + orbP * 2 + (casting ? 4 : 0), "#e0aaff", fl);
            ctx.shadowBlur = 0;
        }
        skinCirc(-f * 12, -2 + mb + Math.sin(t * 0.007) * 2, 5, "#e9d5ff", fl);
        // hood + glowing eyes
        skinPoly([[-14, -16 + mb], [-12, -36 + mb], [0, -44 + mb], [12, -36 + mb], [14, -16 + mb], [0, -12 + mb]], dark, fl);
        skinCirc(0, -26 + mb, 9, "#1e1b4b", fl);
        if (!fl) { ctx.shadowColor = "#fde047"; ctx.shadowBlur = 8; ctx.fillStyle = "#fde047"; ctx.fillRect(-6, -28 + mb, 4, 4); ctx.fillRect(2, -28 + mb, 4, 4); ctx.shadowBlur = 0; }
    } else if (skin === "BOSS_KING") {
        var gb = enemyGait(st, 8);
        var bb = gb.bob;
        // cape
        skinPoly([[-18, -14 + bb], [18, -14 + bb], [30 + Math.sin(t * 0.006) * 3, 36 + bb], [-30 - Math.sin(t * 0.006) * 3, 36 + bb]], "#7f1d1d", fl);
        skinLimb(-9, 8 + bb, gb.fax - 2, gb.fay, f * 3, 15, "#1f2937", fl);
        skinLimb(9, 8 + bb, gb.fbx + 2, gb.fby, f * 3, 15, "#1f2937", fl);
        skinPoly([[-22, -16 + bb], [22, -16 + bb], [19, 14 + bb], [-19, 14 + bb]], col, fl);
        if (!fl) { ctx.fillStyle = "#f8fafc"; ctx.fillRect(-22, -16 + bb, 44, 7); ctx.fillStyle = "#fbbf24"; ctx.fillRect(-19, 6 + bb, 38, 5); ctx.fillStyle = "#111827"; for (let sp = 0; sp < 6; sp++) ctx.fillRect(-20 + sp * 7, -15 + bb, 2.5, 5); }
        // sword arm along the aim + off-hand fist
        var kh = enemyHand(st, 0, ax * 28, -8 + bb + ay * 28);
        skinLimb(f * 18, -10 + bb, kh[0], kh[1], 3, 13, light, fl);
        if (!st.ragdoll) {
            skinSeg(kh[0], kh[1], kh[0] + ax * 26, kh[1] + ay * 26, 6, "#e5e7eb", fl);
            skinSeg(kh[0] - ay * 7, kh[1] + ax * 7, kh[0] + ay * 7, kh[1] - ax * 7, 4, "#fbbf24", fl);
            if (st.firing) { ctx.shadowColor = "#ff9f1c"; ctx.shadowBlur = 16; skinCirc(kh[0] + ax * 36, kh[1] + ay * 36, 8, "#ff9f1c", false, false); ctx.shadowBlur = 0; }
        }
        var kh2 = enemyHand(st, 1, -f * 24, 2 + bb);
        skinLimb(-f * 18, -10 + bb, kh2[0], kh2[1], -3, 13, light, fl);
        skinCirc(kh2[0], kh2[1], 7, light, fl);
        // head, beard, crown
        skinCirc(0, -28 + bb, 12, light, fl);
        skinPoly([[-9, -22 + bb], [9, -22 + bb], [6, -9 + bb], [0, -5 + bb], [-6, -9 + bb]], "#e5e7eb", fl);
        if (!fl) { ctx.shadowColor = "#ff2e63"; ctx.shadowBlur = 8; ctx.fillStyle = "#ff2e63"; ctx.fillRect(-7, -31 + bb, 5, 4); ctx.fillRect(2, -31 + bb, 5, 4); ctx.shadowBlur = 0; }
        skinPoly([[-12, -36 + bb], [-12, -50 + bb], [-6, -42 + bb], [0, -54 + bb], [6, -42 + bb], [12, -50 + bb], [12, -36 + bb]], "#fbbf24", fl);
        skinCirc(0, -44 + bb, 2.6, "#ef4444", fl, false);
    } else {
        // unknown enemy type: generic block with eyes
        skinPoly([[-18, -20], [18, -20], [18, 24], [-18, 24]], col, fl);
    }
    ctx.restore();
}
