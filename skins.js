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

var heroSkins = ["original", "original"];
try {
    var savedSkins = JSON.parse(localStorage.getItem("timsZombieGameSkins") || "null");
    if (savedSkins && savedSkins.length === 2) {
        heroSkins = [
            SKINS.some(function(s) { return s.id === savedSkins[0]; }) ? savedSkins[0] : "original",
            SKINS.some(function(s) { return s.id === savedSkins[1]; }) ? savedSkins[1] : "original"
        ];
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
    try { localStorage.setItem("timsZombieGameSkins", JSON.stringify(heroSkins)); } catch (e) {}
}

// ---------------------------------------------------------------------------
// Drawing helpers (all coordinates are in a design space where the character box is 80 x 80,
// origin at the centre, +y downward; everything is scaled by S/80 and drawn onto `ctx`)
// ---------------------------------------------------------------------------
function skinSeg(x1, y1, x2, y2, lw, col, flash) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a0f16";
    ctx.lineWidth = lw + 5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = flash ? "#ffffff" : col;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
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
        skinSeg(hx, hy, hx + ax * 13, hy + ay * 13, 7, "#334155", fl);
        if (st.firing) skinCirc(hx + ax * 17, hy + ay * 17, 6, "#fff3a0", false, false);
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
        if (st.firing) {
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
        skinSeg(gx, gy, gx + ax * 12, gy + ay * 12, 7, "#334155", fl);
        skinCirc(gx, gy, 6, fl ? "#fff" : "#ffffff", false);
        if (st.firing) skinCirc(gx + ax * 17, gy + ay * 17, 6, "#fff3a0", false, false);
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
