// ============================================================================
// GAME: WOBBLE WHEELS  (wheels)  -  ragdoll rider on wobbly vehicles over trap courses
//   Pick a bike, a wheelchair, a scooter, a trolley or a cart. W/S (P2: ↑/↓) drive and brake, A/D (P2: ←/→) lean.
//   The rider is a ragdoll held on by joints: land badly or hit a trap and they tear off (no gore -
//   they just go flying). R restarts from the last checkpoint. Reach the finish flag fast.
//   Traps: spike strips, mines, swinging logs; helpers: bounce pads, ramps; crates to smash through.
// ============================================================================
var WHEELS_VEHICLES = {
    bike:       { label: "Bike", pts: [[-48, -46, 30, "w"], [54, -46, 30, "w"], [-6, 0, 8, "seat"], [36, 22, 8, "bar"]], accel: 0.55, cap: 19, special: "hop", hop: 9.5, cd: 45, sp: "Space: bunny-hop" },
    wheelchair: { label: "Wheelchair", pts: [[-30, -36, 36, "w"], [48, -62, 12, "w"], [0, 0, 8, "seat"], [22, 14, 7, "bar"], [-8, 26, 6, "back"]], accel: 0.62, cap: 16, special: "rocket", sp: "Space: rocket boost (fuel)" },
    scooter:    { label: "Scooter", pts: [[-40, -40, 16, "w"], [46, -40, 16, "w"], [-4, -10, 7, "seat"], [42, 40, 7, "bar"]], accel: 0.7, cap: 18, special: "kick", kick: 3.2, cd: 60, color: "#22c55e", sp: "Space: kick-push (speed burst)" },
    trolley:    { label: "Trolley", pts: [[-46, -42, 17, "w"], [42, -42, 17, "w"], [-6, 2, 8, "seat"], [-58, 30, 7, "bar"], [44, 6, 8, "basket"]], accel: 0.56, cap: 15, special: "hop", hop: 6, cd: 30, color: "#cbd5e1", sp: "Space: little hop" },
    pogo:       { label: "Pogo", pts: [[0, -84, 11, "w"], [6, 46, 5, "w"], [0, -6, 7, "seat"], [12, 30, 6, "bar"]], accel: 0.15, cap: 14, special: "pogo", color: "#ec4899", sp: "bounces by itself · W/S bigger/smaller hops · A/D lean the way to go" },
    cart:       { label: "Cart", pts: [[-52, -42, 24, "w"], [52, -42, 24, "w"], [-8, 0, 8, "seat"], [46, 18, 8, "bar"], [-56, 14, 8, "tail"]], accel: 0.5, cap: 17, special: "hop", hop: 13, cd: 90, sp: "Space: big jump" }
};
var WHEELS_COURSES = [];
var wheelsSave = { vehicle: "bike", best: {}, ghost: {} };
try { var _ws = JSON.parse(localStorage.getItem("timsWobbleWheels") || "null"); if (_ws) { wheelsSave.vehicle = _ws.vehicle || "bike"; wheelsSave.best = _ws.best || {}; wheelsSave.ghost = _ws.ghost || {}; } } catch (e) {}
function saveWheels() { try { localStorage.setItem("timsWobbleWheels", JSON.stringify(wheelsSave)); } catch (e) {} }

var Wheels = { riders: [], mines: [], logs: [], spikes: [], cps: [], finishX: 0, time: 0, phase: "ready", t: 0, done: {} };

// ---------------------------------------------------------------- course kit
var WK = {
    ground: function(x0, x1, top) { return { type: "box", name: "Ground", x: (x0 + x1) / 2, y: (top - 1600) / 2, w: x1 - x0, h: top + 1600, color: "#5d8a3a", texture: "grass_dirt", kind: "block" }; },
    ramp: function(x0, y0, x1, y1) { var lo = Math.min(y0, y1), h = Math.abs(y1 - y0); return [{ type: "ramp", name: "Slope", x: (x0 + x1) / 2, y: lo + h / 2, w: x1 - x0, h: h, dir: y1 > y0 ? "right" : "left", color: "#5d8a3a", texture: "grass_dirt" }, WK.ground(x0, x1, lo)]; },
    pad: function(x, top) { return { type: "bumper", name: "Bounce Pad", x: x, y: top + 13, w: 200, h: 26, bounce: 30 }; },
    crates: function(x, top, n) { var o = []; for (let i = 0; i < n; i++) o.push({ type: "crate", name: "Crate", x: x + (i % 2) * 10, y: top + 40 + i * 80, size: 76 }); return o; }
};

function wheelsCourse(n, title, layout, traps, finishX, cps, par) {
    var key = "wheels_" + n;
    var items = ModeKit.room(-800, finishX + 900, 3200, { tex: "brick", color: "#1e293b", noFloor: true }).concat(layout);
    var gad = [{ type: "sign", x: -350, y: 0, text: "W / S drive · A / D lean · R restart from checkpoint" }];
    cps.forEach(function(x) { gad.push({ type: "checkpoint", x: x, y: traps.groundAt ? traps.groundAt(x) : 0 }); });
    ModeKit.addLevel(key, { name: "🚲 Wobble Wheels " + (n + 1) + ": " + title, mode: "wheels", wavesEnabled: false, spawnP1: [-300, 120], spawnP2: [-480, 120],
        layout: items, gadgets: gad, title: title, traps: traps, finishX: finishX, cps: cps, par: par });
    WHEELS_COURSES[n] = key;
}

(function() {
    var A = function(L, a) { if (Array.isArray(a)) L.push.apply(L, a); else L.push(a); };
    // 1: Hill Hop
    var L = [];
    A(L, WK.ground(-800, 900, 0));
    A(L, WK.ramp(900, 0, 1500, 200)); A(L, WK.ground(1500, 1800, 200)); A(L, WK.ramp(1800, 200, 2200, 0));
    A(L, WK.ground(2200, 2800, 0)); A(L, WK.ramp(2800, 0, 3200, 260));
    A(L, WK.ground(3700, 5200, 0)); A(L, WK.crates(4200, 0, 3));
    A(L, WK.pad(4700, 0)); A(L, WK.ground(5200, 5600, 420)); A(L, WK.ramp(5600, 420, 6200, 0)); A(L, WK.ground(6200, 7400, 0));
    wheelsCourse(0, "Hill Hop", L, { mines: [], logs: [], spikes: [] }, 7100, [3900], [25, 35, 50]);
    // 2: Trap Alley
    L = [];
    A(L, WK.ground(-800, 1400, 0));
    A(L, WK.ramp(1400, 0, 1800, 160)); A(L, WK.ground(1800, 3400, 160)); A(L, WK.ramp(3400, 160, 3800, 0));
    A(L, WK.ground(3800, 7600, 0)); A(L, WK.crates(5600, 0, 4));
    wheelsCourse(1, "Trap Alley", L, { mines: [[900, 0], [2500, 160], [4400, 0], [4500, 0]], logs: [[2200, 900], [3000, 900], [6400, 800]], spikes: [[1100, 0, 160], [5000, 0, 200]] }, 7300, [3900], [30, 42, 60]);
    // 3: Big Air
    L = [];
    A(L, WK.ground(-800, 600, 0));
    A(L, WK.ramp(600, 0, 1500, 500)); A(L, WK.ground(1500, 1700, 500));
    A(L, WK.ground(2900, 4300, 0)); A(L, WK.pad(3300, 0));
    A(L, WK.ground(4300, 4700, 600)); A(L, WK.ramp(4700, 600, 5300, 0)); A(L, WK.ground(5300, 8200, 0));
    A(L, WK.ramp(6200, 0, 6800, 300)); A(L, WK.ground(6800, 7000, 300));
    wheelsCourse(2, "Big Air", L, { mines: [[3000, 0], [3700, 0], [5700, 0]], logs: [[3800, 900]], spikes: [[7300, 0, 240]], groundAt: function(x) { return 0; } }, 7900, [2950, 5400], [28, 40, 55]);
    // 4: Crumble Run - slabs over a pit shake when you land on them, then drop away; keep moving
    L = [];
    A(L, WK.ground(-800, 900, 0)); A(L, WK.ramp(900, 0, 1200, 200));
    A(L, WK.ground(1200, 3400, -40)); A(L, WK.ramp(3400, -40, 3700, 120)); A(L, WK.ground(3700, 3900, 120)); A(L, WK.ramp(3900, 120, 4100, 0));   // shallow pit: the slow way round
    [[1210, 1640], [1680, 2140], [2180, 2640], [2680, 3150]].forEach(function(sl) {
        L.push({ type: "box", name: "Crumble slab", x: (sl[0] + sl[1]) / 2, y: 180, w: sl[1] - sl[0], h: 40, color: "#a8a29e", texture: "stone_raw", kind: "block" });
    });
    L.push({ type: "box", name: "Ledge", x: 3500, y: 180, w: 700, h: 40, color: "#5d8a3a", texture: "grass_dirt", kind: "block" });   // solid: the pit runs underneath
    A(L, WK.ground(4100, 5200, 0)); A(L, WK.pad(4600, 0));
    A(L, WK.ground(5200, 5400, 360)); A(L, WK.ramp(5400, 360, 5900, 0)); A(L, WK.ground(5900, 7600, 0));
    [[6200, 6600], [6800, 7200]].forEach(function(sl) { L.push({ type: "box", name: "Crumble slab", x: (sl[0] + sl[1]) / 2, y: 20, w: sl[1] - sl[0], h: 40, color: "#a8a29e", texture: "stone_raw", kind: "block" }); });
    wheelsCourse(3, "Crumble Run", L, { mines: [[4300, 0]], logs: [[5000, 900]], spikes: [[6400, 0, 160]] }, 7300, [3950], [30, 42, 58]);
})();

// ---------------------------------------------------------------- vehicle + rider body (one Verlet body)
function wheelsSpawn(slot, x, y, hero) {
    var def = WHEELS_VEHICLES[wheelsSave.vehicle] || WHEELS_VEHICLES.bike;
    var style = Ragdolls.styleFor(hero);
    style.kind = "vehicle";
    var rd = new Ragdoll(style, 1);
    // seated rider (design space, y down): head, neck, pelvis, elbows, hands, knees, feet
    var seat = [x, y];
    var R = [[0, -66, 11], [0, -52, 6], [0, -28, 9], [-6, -42, 4.5], [24, -46, 5], [6, -42, 4.5], [28, -48, 5], [16, -26, 5], [22, -6, 6], [20, -24, 5], [26, -4, 6]];
    for (let i = 0; i < R.length; i++) rd.addPoint(seat[0] + R[i][0], seat[1] - R[i][1] - 28, R[i][2]);
    for (let i = 0; i < RAGDOLL_STICKS.length; i++) { var st = RAGDOLL_STICKS[i]; rd.addStick(st[0], st[1], st[2], st[3]); }
    var base = rd.pts.length, idx = {};
    for (let i = 0; i < def.pts.length; i++) {
        var d = def.pts[i];
        rd.addPoint(seat[0] + d[0], seat[1] + d[1], d[2]);
        var p = rd.pts[base + i];
        if (d[3] === "w") { p.roll = true; p.wheel = true; p.ang = 0; }
        idx[d[3] + (d[3] === "w" ? i : "")] = base + i;
        if (d[3] === "seat") idx.seat = base + i;
        if (d[3] === "bar") idx.bar = base + i;
    }
    // rigid frame: connect every vehicle point to every other
    for (let i = base; i < rd.pts.length; i++) for (let j = i + 1; j < rd.pts.length; j++) rd.addStick(i, j, 1);
    // breakable joints: pelvis to seat, both hands to the bar, feet near the front
    var J = [];
    var joint = function(a, b, br) { rd.addStick(a, b, 0.9); var s = rd.sticks[rd.sticks.length - 1]; s.breakAt = br; s.joint = true; J.push(s); };
    joint(2, idx.seat, 22); joint(4, idx.bar, 18); joint(6, idx.bar, 18); joint(8, idx.seat, 26); joint(10, idx.seat, 26);
    if (idx.back !== undefined) joint(1, idx.back, 20);          // backrest keeps a seated rider upright
    rd.life = -1;
    rd.isVehicle = true;
    rd.wheelsSlot = slot;
    rd.vbase = base;
    rd.def = def;
    rd.joints = J;
    rd.onBreak = function(st) {
        if (!st.joint || rd.crashed) return;
        var broken = rd.joints.filter(function(j) { return j.broken; }).length;
        if (broken >= 2 || (st === rd.joints[0])) wheelsCrash(rd);
    };
    rd.drawFn = wheelsDraw;
    Ragdolls.list.push(rd);
    return rd;
}

// eject: the rider lets go and is flung up and forward (a deliberate bail-out; counts as a crash for the run)
function wheelsEject(rd) {
    if (rd.crashed) return;
    rd.joints.forEach(function(j) { j.broken = true; });
    for (let i = 0; i < rd.vbase; i++) { var p = rd.pts[i]; p.py = p.y - 16; p.px = p.x - 9; }
    Components.addFloatingText("EJECT!", rd.pts[0].x, rd.pts[0].y + 80, "#fde047", 24);
    wheelsCrash(rd);
}
function wheelsCrash(rd) {
    if (rd.crashed) return;
    rd.crashed = true;
    rd.joints.forEach(function(j) { j.broken = true; });
    rd.crashT = 110;
    var h = rd.pts[0];
    Components.addFloatingText("CRASH!", h.x, h.y + 80, "#f87171", 26);
    if (typeof SFX !== "undefined") SFX.play("bonk", h.x, h.y, 1, 0.6);
    screenShake = Math.max(screenShake, 6);
    if (typeof Juice !== "undefined" && Juice.slowMo) Juice.slowMo(45, 0.35);    // savour the wipe-out
    Wheels.crashes = (Wheels.crashes || 0) + 1;
}

function wheelsDraw(rd) {
    var k = cameraScaleX, b = rd.vbase, P = rd.pts;
    // frame
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 9 * k + 3;
    var frame = [];
    for (let i = b; i < P.length; i++) if (!P[i].wheel) frame.push(P[i]);
    var wheels = [];
    for (let i = b; i < P.length; i++) if (P[i].wheel) wheels.push(P[i]);
    var seg = function(a, c, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(wsx(a.x), wsy(a.y)); ctx.lineTo(wsx(c.x), wsy(c.y)); ctx.stroke(); };
    var col = rd.def.color || (rd.def === WHEELS_VEHICLES.wheelchair ? "#94a3b8" : (rd.def === WHEELS_VEHICLES.cart ? "#f97316" : "#2563eb"));
    for (let w = 0; w < wheels.length; w++) for (let f = 0; f < frame.length; f++) { seg(wheels[w], frame[f], "#0a0f16", 8 * k + 3); seg(wheels[w], frame[f], col, 5 * k + 1); }
    for (let f = 0; f + 1 < frame.length; f++) { seg(frame[f], frame[f + 1], "#0a0f16", 9 * k + 3); seg(frame[f], frame[f + 1], col, 6 * k + 1); }
    // wheels with spinning spokes
    for (let w = 0; w < wheels.length; w++) {
        var q = wheels[w], sx = wsx(q.x), sy = wsy(q.y), r = q.r * k;
        ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
        ctx.fillStyle = "#475569"; ctx.beginPath(); ctx.arc(sx, sy, r * 0.72, 0, 7); ctx.fill();
        ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = Math.max(1.5, 2.5 * k);
        for (let s = 0; s < 4; s++) { var a = (q.ang || 0) + s * Math.PI / 4; ctx.beginPath(); ctx.moveTo(sx - Math.cos(a) * r * 0.7, sy - Math.sin(a) * r * 0.7); ctx.lineTo(sx + Math.cos(a) * r * 0.7, sy + Math.sin(a) * r * 0.7); ctx.stroke(); }
    }
    // the rider is an ordinary ragdoll on top
    Ragdolls.drawHumanoid(rd);
}

function wheelsControls(rd) {
    var p2 = rd.wheelsSlot === 1;
    if (typeof Net !== "undefined" && rd.netPeer) { var i = rd.netPeer.inp || {}; return { go: i.u ? 1 : (i.d ? -1 : 0), lean: i.r ? 1 : (i.l ? -1 : 0), sp: !!(i.jt || i.it) }; }
    var pad = (typeof Pads !== "undefined") ? Pads.state[rd.wheelsSlot] : null;
    var up = p2 ? ULDRupPressed : WASDupPressed, dn = p2 ? ULDRdownPressed : WASDdownPressed;
    var lf = p2 ? ULDRleftPressed : WASDleftPressed, rt = p2 ? ULDRrightPressed : WASDrightPressed;
    if (!multiplayer && !p2) { up = up || ULDRupPressed; dn = dn || ULDRdownPressed; lf = lf || ULDRleftPressed; rt = rt || ULDRrightPressed; }
    var sp = p2 ? !!PlayerInput[1].kbShoot : (SpacePressed || EnterPressed || (!multiplayer && !!PlayerInput[1].kbShoot));   // P1 Space/F, P2 Enter
    if (pad && pad.active) { up = up || pad.shoot || pad.up; dn = dn || pad.down; lf = lf || pad.left; rt = rt || pad.right; sp = sp || pad.run || pad.jet; }
    return { go: up ? 1 : (dn ? -1 : 0), lean: rt ? 1 : (lf ? -1 : 0), sp: !!sp };
}

// pogo: the rider keeps the stick balanced, tilted a little forward (A / D lean it more or less) - runs every
// frame from the start, or the stick just topples over during the countdown
function wheelsPogoBalance(rd) {
    if (rd.crashed || rd.def.special !== "pogo") return;
    var P = rd.pts, w1 = P[rd.vbase], w2 = P[rd.vbase + 1], cx = rd.centerX(), cy = rd.centerY();
    var c = Wheels.phase === "ride" ? wheelsControls(rd) : { lean: 0 };
    var tilt = Math.atan2(w2.x - w1.x, w2.y - w1.y), target = (Wheels.phase === "ride" ? 0.18 : 0) + (c.lean || 0) * 0.22;
    var dTilt = tilt - (rd.lastTilt === undefined ? tilt : rd.lastTilt);
    rd.lastTilt = tilt;
    var wb = -((target - tilt) * 0.09 - dTilt * 0.6);
    wb = Math.max(-0.08, Math.min(0.08, wb));
    for (let i = 0; i < P.length; i++) { var q = P[i], rx = q.x - cx, ry = q.y - cy; q.px += ry * wb; q.py -= rx * wb; }
}

function wheelsDrive(rd) {
    if (rd.crashed) return;
    var c = wheelsControls(rd), P = rd.pts, def = rd.def;
    var cx = rd.centerX(), cy = rd.centerY();
    var anyContact = false, grip = 0, nWheels = 0, TX = 0, TY = 0;
    for (let i = rd.vbase; i < P.length; i++) {
        var p = P[i];
        if (!p.wheel) continue;
        nWheels++;
        var vx = p.x - p.px, vy = p.y - p.py;
        p.ang = (p.ang || 0) + vx / p.r;
        if (p.contact > 0) {
            anyContact = true;
            grip++;
            TX += p.cny; TY += -p.cnx;                      // surface tangent, pointing "forward" (right)
            p.contact--;
        }
    }
    // traction: a gripping wheel pushes the WHOLE body (frame + rider) along the surface, like real torque would
    if (grip && c.go) {
        var tl = Math.hypot(TX, TY) || 1; TX /= tl; TY /= tl;
        var bvx = rd.velX(), bvy = rd.velY(), along = bvx * TX + bvy * TY;
        var share = grip / nWheels;
        var push = 0;
        if (c.go > 0 && along < def.cap) push = def.accel * share;
        else if (c.go < 0) {
            if (along > 1) { for (let i = rd.vbase; i < P.length; i++) if (P[i].wheel && P[i].contact >= 0) { P[i].px = P[i].x - (P[i].x - P[i].px) * 0.88; P[i].py = P[i].y - (P[i].y - P[i].py) * 0.88; } }   // brake
            else if (along > -def.cap * 0.4) push = -def.accel * 0.6 * share;                                                       // reverse
        }
        if (push) for (let i = 0; i < P.length; i++) { P[i].px -= TX * push; P[i].py -= TY * push; }
    }
    // lean: spin the whole body about its centre (works in the air too, weaker on the ground)
    if (c.lean) {
        var w = -c.lean * (anyContact ? 0.0022 : 0.0045);     // lean right = clockwise (nose down)
        for (let i = 0; i < P.length; i++) {
            var q = P[i], rx = q.x - cx, ry = q.y - cy;
            q.px += ry * w; q.py -= rx * w;                     // add angular velocity w about the centre
        }
    }
    // vehicle special: hop (bike / cart) or rocket (wheelchair)
    var w1 = P[rd.vbase], w2 = P[rd.vbase + 1];
    var fwx = w2.x - w1.x, fwy = w2.y - w1.y, fl = Math.hypot(fwx, fwy) || 1; fwx /= fl; fwy /= fl;
    if (rd.spCd > 0) rd.spCd--;
    if (def.special === "hop" && c.sp && !rd.spPrev && anyContact && !(rd.spCd > 0)) {
        for (let i = 0; i < P.length; i++) P[i].py -= def.hop;
        rd.spCd = def.cd;
        if (typeof SFX !== "undefined") SFX.play("jump", cx, cy, 0.6, 0.9);
    }
    // pogo: the spring foot springs off the ground by itself; W makes bigger hops, leaning sets the direction
    if (def.special === "pogo") {
        var foot = P[rd.vbase];

        if (rd.pogoCd > 0) rd.pogoCd--;
        if (anyContact && !(rd.pogoCd > 0)) {
            var up = 9 + (c.go > 0 ? 4 : c.go < 0 ? -4 : 0), ux = fwx, uy = fwy;        // along the stick, foot -> handle
            var ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
            for (let i = 0; i < P.length; i++) { P[i].px -= ux * up * 0.55 + 1.6; P[i].py -= uy * up; }
            rd.pogoCd = 14;
            if (typeof SFX !== "undefined" && Wheels.t % 2 === 0) SFX.play("boing", cx, cy, 0.4, 1.4);
        }
    }
    if (def.special === "kick" && c.sp && !rd.spPrev && anyContact && !(rd.spCd > 0)) {
        for (let i = 0; i < P.length; i++) { P[i].px -= fwx * def.kick; P[i].py -= fwy * def.kick; }
        rd.spCd = def.cd;
        Components.spawnSparks(w1.x, w1.y - 20, "#bbf7d0", 5);
        if (typeof SFX !== "undefined") SFX.play("dash", cx, cy, 0.6, 1.2);
    }
    if (def.special === "rocket") {
        if (rd.fuel === undefined) rd.fuel = 100;
        if (c.sp && rd.fuel > 0) {
            for (let i = 0; i < P.length; i++) { P[i].px -= fwx * 0.42; P[i].py -= fwy * 0.42; }
            rd.fuel = Math.max(0, rd.fuel - 1.1);
            if (Wheels.t % 2 === 0) Components.spawnSparks(w1.x - fwx * 50, w1.y - fwy * 50 + 30, Wheels.t % 4 ? "#f97316" : "#fde047", 2);
        } else if (anyContact) rd.fuel = Math.min(100, rd.fuel + 0.2);
    }
    rd.spPrev = c.sp;
    // flips: add up how far the frame turns while airborne, pay out on landing (each full turn = -0.5 s)
    var ang = Math.atan2(fwy, fwx);
    if (rd.lastAng !== undefined && !anyContact) {
        var da = ang - rd.lastAng;
        if (da > Math.PI) da -= Math.PI * 2; else if (da < -Math.PI) da += Math.PI * 2;
        rd.spin = (rd.spin || 0) + da;
    }
    if (anyContact && rd.spin) {
        var flips = Math.floor(Math.abs(rd.spin) / (Math.PI * 1.6));     // ~290°+ and still on your wheels counts
        if (flips > 0 && Wheels.phase === "ride") {
            var name = (rd.spin > 0 ? "BACKFLIP" : "FRONTFLIP") + (flips > 1 ? " ×" + flips : "") + "!  -" + (flips * 0.5).toFixed(1) + "s";
            Wheels.time = Math.max(0, Wheels.time - flips * 30);
            Wheels.flips = (Wheels.flips || 0) + flips;
            Components.addFloatingText(name, cx, cy + 150, "#a5f3fc", 22);
            if (typeof SFX !== "undefined") SFX.play("coin", cx, cy, 0.7, 1.2);
        }
        rd.spin = 0;
    }
    rd.lastAng = ang;
    rd.wake();
}

// ---------------------------------------------------------------- traps
function wheelsTraps() {
    for (let r = 0; r < Wheels.riders.length; r++) {
        var rd = Wheels.riders[r];
        var P = rd.pts;
        for (let m = Wheels.mines.length - 1; m >= 0; m--) {
            var mn = Wheels.mines[m];
            for (let i = 0; i < P.length; i++) if (Math.hypot(P[i].x - mn[0], P[i].y - mn[1]) < P[i].r + 26) {
                Components.blowUp(mn[0], mn[1] + 20, "#ff6b00", 22, 300, -30, null);
                Wheels.mines.splice(m, 1);
                break;
            }
        }
        for (let s = 0; s < Wheels.spikes.length; s++) {
            var sp = Wheels.spikes[s];
            for (let i = 0; i < P.length; i++) {
                var q = P[i];
                if (Math.abs(q.x - sp[0]) < sp[2] / 2 + q.r && q.y - q.r < sp[1] + 30 && q.y > sp[1] - 10) {
                    if (q.wheel) { if (!q.flat) { q.flat = true; q.r *= 0.7; q.roll = false; Components.addFloatingText("FLAT!", q.x, q.y + 60, "#fbbf24", 16); } }
                    else if (i < rd.vbase) wheelsCrash(rd);
                }
            }
        }
        for (let l = 0; l < Wheels.logs.length; l++) {
            var log = Wheels.logs[l].pts[1], lvx = log.x - log.px, lvy = log.y - log.py;
            for (let i = 0; i < P.length; i++) {
                var q2 = P[i], d = Math.hypot(q2.x - log.x, q2.y - log.y);
                if (d < log.r + q2.r) {
                    var nx = (q2.x - log.x) / (d || 1), ny = (q2.y - log.y) / (d || 1);
                    q2.x = log.x + nx * (log.r + q2.r); q2.y = log.y + ny * (log.r + q2.r);
                    q2.px = q2.x - lvx * 1.3 - nx * 4; q2.py = q2.y - lvy * 1.3 - ny * 4;
                }
            }
        }
    }
    for (let l = 0; l < Wheels.logs.length; l++) { var b = Wheels.logs[l]; b.pts[0].x = b.pts[0].px = b.pin[0]; b.pts[0].y = b.pts[0].py = b.pin[1]; b.wake(); }
    wheelsDrops();
}

// crumbling slabs: a wheel or body on top starts a 55-frame shake, then the slab falls away
function wheelsDrops() {
    var changed = false;
    for (let d = 0; d < (Wheels.drops || []).length; d++) {
        var D = Wheels.drops[d], o = D.o;
        if (D.t < 0) {
            var top = o.y + o.h / 2;
            for (let r = 0; r < Wheels.riders.length && D.t < 0; r++) {
                var P = Wheels.riders[r].pts;
                for (let i = 0; i < P.length; i++) if (Math.abs(P[i].x - o.x) < o.w / 2 && P[i].y - P[i].r < top + 6 && P[i].y > top - 10) { D.t = 0; break; }
            }
            continue;
        }
        D.t++;
        if (D.t < 55) { o.x += (D.t % 4 < 2 ? 3 : -3); if (D.t % 8 === 0) Components.spawnSparks(o.x + (Math.random() - 0.5) * o.w, top, "#a8a29e", 2); }
        else if (D.t === 55) {
            var k = staticObjects.indexOf(o); if (k !== -1) staticObjects.splice(k, 1);
            changed = true;
            for (let q = 0; q < 6; q++) Components.spawnSparks(o.x - o.w / 2 + q * o.w / 5, o.y, "#78716c", 3);
            if (typeof SFX !== "undefined") SFX.play("kill", o.x, o.y);
            D.fallY = o.y; D.vy = 0;
        } else if (D.fallY !== undefined && D.t < 175) { D.vy -= 0.9; D.fallY += D.vy; }       // the falling slab (drawn below)
    }
    if (changed) { if (typeof rebuildAllObjects === "function") rebuildAllObjects(); if (typeof StaticGrid !== "undefined") StaticGrid.build(); }
}

function wheelsMakeLog(x, len) {
    var top = 2400;
    var bl = new Ragdoll({ kind: "ball" }, 1);
    bl.addPoint(x, top, 4);
    bl.addPoint(x - 500, top - Math.min(len, 2200), 60);
    bl.addStick(0, 1, 1);
    bl.pin = [x, top];
    bl.life = -1;
    bl.drawFn = function(r) {
        var a = r.pts[0], c = r.pts[1];
        ctx.strokeStyle = "#a8a29e"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wsx(a.x), wsy(a.y)); ctx.lineTo(wsx(c.x), wsy(c.y)); ctx.stroke();
        ctx.fillStyle = "#78350f"; ctx.beginPath(); ctx.arc(wsx(c.x), wsy(c.y), c.r * cameraScaleX, 0, 7); ctx.fill();
        ctx.strokeStyle = "#451a03"; ctx.lineWidth = 3; ctx.stroke();
    };
    Ragdolls.list.push(bl);
    return bl;
}

// ---------------------------------------------------------------- the mode
GameModes.register({
    id: "wheels",
    title: "WOBBLE WHEELS",
    tagline: "Ragdoll riders on bikes, wheelchairs and carts. Survive the traps, beat the clock.",
    color: "#f97316",
    firstLevel: function() { return WHEELS_COURSES[0]; },
    flags: { waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, noBedrock: true, scenery: true,
        coopToggle: true, dash: false, wallJump: false, airJumps: 0, playerControl: false },
    overTitle: "COURSE COMPLETE",
    againLabel: "Ride again",

    setupLevel: function(lvl) {
        Gadgets.load(lvl.gadgets);
        var tr = lvl.traps || {};
        Wheels.mines = (tr.mines || []).map(function(m) { return [m[0], m[1] + 12]; });
        Wheels.spikes = (tr.spikes || []).map(function(s) { return [s[0], s[1], s[2]]; });
        Wheels.logs = [];
        Wheels.finishX = lvl.finishX; Wheels.cps = lvl.cps || [];
        Wheels.drops = staticObjects.filter(function(o) { return o.name === "Crumble slab"; }).map(function(o) { return { o: o, t: -1, y0: o.y }; });
        var sameCourse = Wheels.cpKey === LevelManager.currentLevelKey;
        Wheels.riders = []; Wheels.time = 0; Wheels.phase = "ready"; Wheels.t = 0; Wheels.done = {}; Wheels.rec = [];
        if (!sameCourse) Wheels.crashes = 0;
        Wheels.cpReached = Wheels.cpReached && Wheels.cpKey === LevelManager.currentLevelKey ? Wheels.cpReached : -1;
        Wheels.cpKey = LevelManager.currentLevelKey;
    },

    createPlayers: function() {
        var lvl = LevelManager.getCurrentLevel();
        var heroes = [ModeKit.makeHero(0, lvl.spawnP1[0], lvl.spawnP1[1])];
        if (multiplayer) heroes.push(ModeKit.makeHero(1, lvl.spawnP2[0], lvl.spawnP2[1])); else blueGuy = null;
        // the heroes are only "seats" (skins, LAN slots); the ragdoll riders are what you see and steer
        for (let i = 0; i < heroes.length; i++) { heroes[i].dead = true; heroes[i].noCollide = true; }
    },

    onReset: function() {
        var lvl = LevelManager.getCurrentLevel();
        for (let i = 0; i < Wheels.riders.length; i++) Ragdolls.remove(Wheels.riders[i]);
        Wheels.riders = [];
        var hs = characters.filter(function(c) { return c.isPlayer && !c.isRemote; });
        var startX = Wheels.cpReached >= 0 ? Wheels.cps[Wheels.cpReached] : lvl.spawnP1[0];
        for (let i = 0; i < hs.length; i++) Wheels.riders.push(wheelsSpawn(i, startX - i * 200, 150, hs[i]));
        // LAN players keep riding after a restart
        if (typeof Net !== "undefined" && Net.role === "host") characters.forEach(function(c) {
            if (!c.isRemote || !Net.peers[c.netPid]) return;
            var rd = wheelsSpawn(c.playerIndex, startX - c.playerIndex * 120, 150, c); rd.netPeer = Net.peers[c.netPid]; rd.seat = c; Wheels.riders.push(rd);
        });
        var tr = lvl.traps || {};
        Wheels.logs = (tr.logs || []).map(function(l) { return wheelsMakeLog(l[0], l[1]); });
    },

    cameraTargets: function() {
        return Wheels.riders.map(function(r) { return { x: r.pts[r.vbase].x, y: r.pts[r.vbase].y + 120 }; });
    },

    onKey: function(code) {
        if (code === "KeyE" || code === "Slash") { var who = code === "KeyE" ? 0 : 1, r = Wheels.riders.find(function(q) { return q.wheelsSlot === who && !q.netPeer; }); if (r && Wheels.phase === "ride") wheelsEject(r); return true; }
        if (code === "KeyR") { LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        if (code === "KeyV") { var ks = window.Object.keys(WHEELS_VEHICLES); wheelsSave.vehicle = ks[(ks.indexOf(wheelsSave.vehicle) + 1) % ks.length]; saveWheels(); Wheels.cpReached = -1; LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        return false;
    },

    // LAN: a joining player gets a hidden seat hero plus a rider of their own (driven by their keys)
    addNetPlayer: function(slot, p) {
        var lvl = LevelManager.getCurrentLevel(), sx = Wheels.cpReached >= 0 ? Wheels.cps[Wheels.cpReached] : lvl.spawnP1[0];
        var seat = ModeKit.makeHero(slot, sx - 120 * slot, 150, { label: p.name, color: p.color });
        seat.dead = true; seat.noCollide = true;
        var rd = wheelsSpawn(slot, sx - 120 * slot, 150, seat);
        rd.netPeer = p; rd.seat = seat;
        Wheels.riders.push(rd);
        return seat;
    },
    preUpdate: function() {
        Wheels.t++;
        // LAN riders whose player left go away; seats follow their riders (camera / LAN "you" marker)
        for (let i = Wheels.riders.length - 1; i >= 0; i--) {
            var lr = Wheels.riders[i];
            if (lr.netPeer && typeof Net !== "undefined" && !Net.peers[lr.netPeer.pid]) { Ragdolls.remove(lr); Wheels.riders.splice(i, 1); continue; }
            if (lr.seat) { lr.seat.x = lr.pts[lr.vbase].x; lr.seat.y = lr.pts[lr.vbase].y + 60; }
        }
        // gamepads 3-4 get riders of their own (there are no CPUs here to take over)
        if (typeof Pads !== "undefined") for (let i = 2; i < 4; i++) {
            var on = Pads.state[i] && Pads.state[i].active, rider = Wheels.riders.find(function(r) { return r.padRider === i; });
            if (on && !rider) {
                var lvl = LevelManager.getCurrentLevel(), sx = Wheels.cpReached >= 0 ? Wheels.cps[Wheels.cpReached] : lvl.spawnP1[0];
                var seat = ModeKit.makeHero(i, sx - i * 200, 150, { label: "P" + (i + 1) }); seat.dead = true; seat.noCollide = true;
                var pr = wheelsSpawn(i, sx - i * 200, 150, seat); pr.padRider = i; Wheels.riders.push(pr);
                showBanner("P" + (i + 1) + " JOINS!", "gamepad " + (i + 1) + ": stick lean, A drive, B / X special", "#7ff0ff");
            } else if (!on && rider) { Ragdolls.remove(rider); Wheels.riders.splice(Wheels.riders.indexOf(rider), 1); }
        }
        if (Wheels.phase === "ready" && Wheels.t > 60) Wheels.phase = "ride";
        for (let i = 0; i < Wheels.riders.length; i++) { wheelsPogoBalance(Wheels.riders[i]); if (Wheels.phase === "ride") wheelsDrive(Wheels.riders[i]); }
    },

    update: function() {
        if (Wheels.phase === "ride") Wheels.time++;
        var r0 = Wheels.riders.find(function(r) { return r.wheelsSlot === 0 && !r.netPeer; });
        if (r0 && Wheels.phase === "ride" && Wheels.time % 4 === 0 && !r0.crashed && Wheels.rec.length < 9000) Wheels.rec.push(Math.round(r0.pts[r0.vbase].x), Math.round(r0.pts[r0.vbase].y), Math.round(r0.pts[r0.vbase + 1].x), Math.round(r0.pts[r0.vbase + 1].y));
        wheelsTraps();
        var lvl = LevelManager.getCurrentLevel();
        for (let i = 0; i < Wheels.riders.length; i++) {
            var rd = Wheels.riders[i], vx = rd.pts[rd.vbase].x, vy = rd.pts[rd.vbase].y;
            // keep the (invisible) hero with its rider so LAN / camera helpers have a position
            if (!rd.seat) { var h = characters.find(function(c) { return c.isPlayer && !c.isRemote && c.playerIndex === rd.wheelsSlot; }); if (h) { h.x = vx; h.y = vy + 60; } }
            if (rd.crashed && --rd.crashT === 0) { LevelManager.selectLevel(LevelManager.currentLevelKey); return; }
            if (vy < -900 && !rd.crashed) wheelsCrash(rd);
            for (let c = 0; c < Wheels.cps.length; c++) if (c > Wheels.cpReached && vx > Wheels.cps[c] && !rd.crashed) { Wheels.cpReached = c; Components.addFloatingText("CHECKPOINT", vx, vy + 160, "#4ade80", 20); }
            if (vx > Wheels.finishX && !rd.crashed && Wheels.done[i] === undefined && Wheels.phase === "ride") {
                Wheels.done[i] = Wheels.time;
                var key = LevelManager.currentLevelKey + ":" + wheelsSave.vehicle;
                var newBest = !wheelsSave.best[key] || Wheels.time < wheelsSave.best[key];
                if (newBest && Wheels.cpReached < 0) { wheelsSave.best[key] = Wheels.time; if (i === 0) wheelsSave.ghost[key] = Wheels.rec.slice(); saveWheels(); }
                showBanner("FINISH!  " + (Wheels.time / 60).toFixed(2) + "s", (Wheels.cpReached >= 0 ? "(from a checkpoint - no record)" : (newBest ? "NEW BEST!" : "best " + (wheelsSave.best[key] / 60).toFixed(2) + "s")), "#fde047");
                if (typeof SFX !== "undefined") SFX.play("clear");
                Wheels.phase = "done"; Wheels.endT = 200;
            }
        }
        if (Wheels.phase === "done" && --Wheels.endT <= 0) {
            Wheels.cpReached = -1;
            var n = WHEELS_COURSES.indexOf(LevelManager.currentLevelKey);
            LevelManager.selectLevel(WHEELS_COURSES[(n + 1) % WHEELS_COURSES.length]);
        }
    },

    drawWorld: function() {
        // crumbled slabs falling away
        (Wheels.drops || []).forEach(function(D) {
            if (D.fallY === undefined || D.t >= 175) return;
            var o = D.o, k = cameraScaleX;
            ctx.save(); ctx.globalAlpha = Math.max(0, 1 - (D.t - 55) / 120);
            ctx.translate(wsx(o.x), wsy(D.fallY)); ctx.rotate((D.t - 55) * 0.01);
            ctx.fillStyle = "#a8a29e"; ctx.fillRect(-o.w / 2 * k, -o.h / 2 * k, o.w * k, o.h * k);
            ctx.strokeStyle = "#57534e"; ctx.lineWidth = 2; ctx.strokeRect(-o.w / 2 * k, -o.h / 2 * k, o.w * k, o.h * k);
            ctx.restore();
        });
        // ghost of your best run on this course + vehicle
        var gk = LevelManager.currentLevelKey + ":" + wheelsSave.vehicle, G = wheelsSave.ghost[gk];
        if (G && G.length && Wheels.phase !== "ready") {
            var gi = Math.min(Math.floor(Wheels.time / 4), G.length / 4 - 1) * 4, a = [wsx(G[gi]), wsy(G[gi + 1])], b2 = [wsx(G[gi + 2]), wsy(G[gi + 3])], gr = 26 * cameraScaleX;
            ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = "#a5f3fc"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(a[0], a[1], gr, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(b2[0], b2[1], gr, 0, 7); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo((a[0] + b2[0]) / 2, Math.min(a[1], b2[1]) - 50 * cameraScaleX); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
            ctx.globalAlpha = 0.7; uiText("GHOST", (a[0] + b2[0]) / 2, Math.min(a[1], b2[1]) - 62 * cameraScaleX, 11, "#a5f3fc", "center", "900");
            ctx.restore();
        }
        var k = cameraScaleX;
        for (let m = 0; m < Wheels.mines.length; m++) {
            var mn = Wheels.mines[m], sx = wsx(mn[0]), sy = wsy(mn[1]);
            ctx.fillStyle = "#374151"; ctx.beginPath(); ctx.arc(sx, sy, 16 * k + 3, Math.PI, 0); ctx.fill();
            ctx.fillStyle = (Wheels.t % 40 < 20) ? "#ef4444" : "#7f1d1d"; ctx.beginPath(); ctx.arc(sx, sy - 8 * k, 4 * k + 2, 0, 7); ctx.fill();
        }
        for (let s = 0; s < Wheels.spikes.length; s++) {
            var sp = Wheels.spikes[s], n = Math.round(sp[2] / 30), l = wsx(sp[0] - sp[2] / 2), b = wsy(sp[1]);
            ctx.fillStyle = "#cbd5e1"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 1.5;
            for (let i = 0; i < n; i++) { var bx = l + i * sp[2] * k / n; ctx.beginPath(); ctx.moveTo(bx, b); ctx.lineTo(bx + sp[2] * k / n / 2, b - 30 * k); ctx.lineTo(bx + sp[2] * k / n, b); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        }
        // finish flag
        var fx = wsx(Wheels.finishX), fy = wsy(0);
        ctx.fillStyle = "#e5e7eb"; ctx.fillRect(fx - 4, fy - 300 * k, 8, 300 * k);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { ctx.fillStyle = (r + c) % 2 ? "#111827" : "#f8fafc"; ctx.fillRect(fx + 4 + c * 14 * k, fy - 300 * k + r * 14 * k, 14 * k, 14 * k); }
    },

    drawHUD: function() {
        var lvl = LevelManager.getCurrentLevel(), n = WHEELS_COURSES.indexOf(LevelManager.currentLevelKey);
        var key = LevelManager.currentLevelKey + ":" + wheelsSave.vehicle, best = wheelsSave.best[key];
        uiPanel(14, 14, 430, 84, "#f97316");
        uiText("WOBBLE WHEELS", 30, 42, 22, "#fdba74", "left", "900");
        uiText("Course " + (n + 1) + "/" + WHEELS_COURSES.length + ": " + (lvl.title || "") + "  ·  " + WHEELS_VEHICLES[wheelsSave.vehicle].label + " (V to switch)", 30, 66, 13, "#e2e8f0", "left", "800");
        uiText("⏱ " + (Wheels.time / 60).toFixed(2) + "s   best " + (best ? (best / 60).toFixed(2) + "s" : "--") + "   crashes " + (Wheels.crashes || 0) + "   flips " + (Wheels.flips || 0), 30, 86, 12, "#cbd5e1", "left", "700");
        for (let i = 0; i < Wheels.riders.length; i++) {
            var wr = Wheels.riders[i];
            if (wr.def.special !== "rocket") continue;
            var fy0 = 108 + i * 22;
            uiPanel(14, fy0, 200, 18, "#f97316", 0.8);
            ctx.fillStyle = (wr.fuel || 0) > 25 ? "#f97316" : "#ef4444"; ctx.fillRect(70, fy0 + 5, 136 * (wr.fuel === undefined ? 1 : wr.fuel / 100), 8);
            uiText("P" + (i + 1) + " fuel", 22, fy0 + 13, 10, "#fdba74", "left", "800");
        }
        if (Wheels.phase === "ready") uiText("GET READY", cssW / 2, cssH / 2 - 60, 48, "#fdba74", "center", "900");
        uiText("W/S drive & brake · A/D lean (flips = -0.5 s) · " + WHEELS_VEHICLES[wheelsSave.vehicle].sp + " · E eject · R restart · V vehicle" + (multiplayer ? " · P2: arrows" : "") + " · Esc menu", cssW / 2, cssH - 16, 12, "rgba(220,230,240,0.75)", "center", "700");
    },

    menuItems: function(items) {
        var n = Math.max(0, WHEELS_COURSES.indexOf(LevelManager.currentLevelKey));
        items.push({ id: "wh_course", label: "Course:  ◀  " + (n + 1) + " / " + WHEELS_COURSES.length + "  ▶", hint: "", cycle: true });
        items.push({ id: "wh_select", label: "🗺 Course select…", hint: "best times + medals for the " + WHEELS_VEHICLES[wheelsSave.vehicle].label });
        items.push({ id: "wh_vehicle", label: "Vehicle:  ◀  " + WHEELS_VEHICLES[wheelsSave.vehicle].label + "  ▶", hint: "V", cycle: true });
    },
    onMenu: function(id, dir) {
        if (id === "wh_course") { var n = Math.max(0, WHEELS_COURSES.indexOf(LevelManager.currentLevelKey)); Wheels.cpReached = -1; closePause(); LevelManager.selectLevel(WHEELS_COURSES[(n + (dir || 1) + WHEELS_COURSES.length) % WHEELS_COURSES.length]); return true; }
        if (id === "wh_select") {
            var name = function(k) { var L = LevelManager.getAllLevels()[k] || {}; return (L.title || L.name || k).replace(/^[^A-Za-z0-9]+/, ""); };
            CourseSelect.open({ title: "🚲 Wobble Wheels — courses", note: "times for the " + WHEELS_VEHICLES[wheelsSave.vehicle].label + " (V switches vehicle)",
                items: WHEELS_COURSES.map(function(k) {
                    var b = wheelsSave.best[k + ":" + wheelsSave.vehicle], par = (LevelManager.getAllLevels()[k] || {}).par || [30, 45, 60], s = b / 60;
                    return { name: name(k), best: b ? s.toFixed(2) + "s" : "", medal: !b ? 0 : s <= par[0] ? 3 : s <= par[1] ? 2 : s <= par[2] ? 1 : 0, current: k === LevelManager.currentLevelKey };
                }),
                onPick: function(i) { Wheels.cpReached = -1; LevelManager.selectLevel(WHEELS_COURSES[i]); } });
            return true;
        }
        if (id === "wh_vehicle") { var ks = window.Object.keys(WHEELS_VEHICLES); wheelsSave.vehicle = ks[(ks.indexOf(wheelsSave.vehicle) + (dir || 1) + ks.length) % ks.length]; saveWheels(); Wheels.cpReached = -1; closePause(); LevelManager.selectLevel(LevelManager.currentLevelKey); return true; }
        return false;
    },
    onRestart: function() { Wheels.cpReached = -1; LevelManager.selectLevel(LevelManager.currentLevelKey); }
});
