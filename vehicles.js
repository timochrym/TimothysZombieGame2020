// ============================================================================
// VEHICLES - driveable cars and minecarts on rails, in any game (backlog B2)
//   Gadgets (placeable in Level Studio):
//     car       { x, y }                    walk up + E (P2: /) to get in; A/D drive, S brake, shoot from the window;
//                                           E again to hop out. Runs over enemies. A Verlet body (same engine as ragdolls).
//     rail      { x, y, w, dy }             a straight track piece from (x - w/2, y) to (x + w/2, y + dy).
//                                           Pieces whose ends meet (within 50px) join into one line.
//     minecart  { x, y, cars }              rolls along the nearest rail; E to ride, A/D push; slopes speed it up.
//                                           cars > 1 makes a little train.
// ============================================================================
var Vehicles = {
    cars: [], carts: [], rails: [],

    clear: function() { this.cars = []; this.carts = []; this.rails = []; },

    // ---------------------------------------------------------------- spawning (called by Gadgets.add)
    spawnCar: function(g) {
        var rd = new Ragdoll({ kind: "car", thick: 5 }, 1);
        var x = g.x, y = g.y + 60;
        rd.addPoint(x - 62, y - 30, 26);   // 0 rear wheel
        rd.addPoint(x + 62, y - 30, 26);   // 1 front wheel
        rd.addPoint(x - 80, y + 20, 10);   // 2 rear body
        rd.addPoint(x + 82, y + 14, 10);   // 3 front body
        rd.addPoint(x - 20, y + 52, 8);    // 4 roof back
        rd.addPoint(x + 26, y + 52, 8);    // 5 roof front
        rd.pts[0].roll = rd.pts[0].wheel = true;
        rd.pts[1].roll = rd.pts[1].wheel = true;
        for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) rd.addStick(i, j, 1);
        rd.life = -1;
        rd.isCar = true;
        rd.color = g.color || "#e11d48";
        rd.drawFn = Vehicles.drawCar;
        Ragdolls.list.push(rd);
        var car = { rd: rd, driver: null, g: g };
        rd.car = car;
        this.cars.push(car);
        return car;
    },

    addRail: function(g) {
        var w = g.w || 400, dy = g.dy || 0;
        this.rails.push({ x1: g.x - w / 2, y1: g.y, x2: g.x + w / 2, y2: g.y + dy, g: g });
    },

    spawnCart: function(g) {
        var cart = { g: g, x: g.x, y: g.y, v: 0, rail: null, t: 0, rider: null, cars: Math.max(1, g.cars || 1) };
        this.carts.push(cart);
        return cart;
    },

    // join rail pieces into lines after a level loads
    linkRails: function() {
        var R = this.rails;
        for (let i = 0; i < R.length; i++) { R[i].next = null; R[i].prev = null; R[i].len = Math.hypot(R[i].x2 - R[i].x1, R[i].y2 - R[i].y1) || 1; }
        for (let i = 0; i < R.length; i++) for (let j = 0; j < R.length; j++) {
            if (i === j) continue;
            if (Math.hypot(R[i].x2 - R[j].x1, R[i].y2 - R[j].y1) < 50) { R[i].next = R[j]; R[j].prev = R[i]; }
        }
        for (let c = 0; c < this.carts.length; c++) {
            var cart = this.carts[c], best = null, bd = 400;
            for (let i = 0; i < R.length; i++) {
                var r = R[i], t = Math.max(0, Math.min(1, ((cart.x - r.x1) * (r.x2 - r.x1) + (cart.y - r.y1) * (r.y2 - r.y1)) / (r.len * r.len)));
                var px = r.x1 + (r.x2 - r.x1) * t, py = r.y1 + (r.y2 - r.y1) * t, d = Math.hypot(px - cart.x, py - cart.y);
                if (d < bd) { bd = d; best = r; cart.t = t * r.len; }
            }
            cart.rail = best;
        }
    },

    // ---------------------------------------------------------------- per tick
    // before characters move: E near a vehicle means "get in / out", not the shockwave
    preUpdate: function() {
        if (!this.cars.length && !this.carts.length) return;
        for (let i = 0; i < characters.length; i++) {
            var ch = characters[i];
            if (ch.dead || !ch.isPlayer) continue;
            var near = ch.vehicle || this.nearest(ch);
            if (near) ch.suppressAbility = true;
            var press = typeof pressedOnce === "function" ? pressedOnce(ch, "veh", !!(ch.input && ch.input.interact) || !!ch.abilityPressed) : false;
            if (!press) continue;
            if (ch.vehicle) this.exit(ch);
            else if (near) this.enter(ch, near);
        }
    },

    nearest: function(ch) {
        var best = null, bd = 150;
        for (let i = 0; i < this.cars.length; i++) {
            var c = this.cars[i];
            if (c.driver) continue;
            var d = Math.hypot(c.rd.centerX() - ch.x, c.rd.centerY() - ch.y);
            if (d < bd) { bd = d; best = c; }
        }
        for (let i = 0; i < this.carts.length; i++) {
            var k = this.carts[i];
            if (k.rider) continue;
            var d2 = Math.hypot(k.x - ch.x, k.y + 40 - ch.y);
            if (d2 < bd) { bd = d2; best = k; }
        }
        return best;
    },

    enter: function(ch, v) {
        ch.vehicle = v;
        if (v.rd) v.driver = ch; else v.rider = ch;
        ch.noCollide = true;
        Components.addFloatingText(v.rd ? "VROOM! (E to hop out)" : "ALL ABOARD! (E to hop out)", ch.x, ch.y + 90, "#7dd3fc", 16);
        if (typeof SFX !== "undefined") SFX.play("select", ch.x, ch.y);
    },

    exit: function(ch) {
        var v = ch.vehicle;
        if (!v) return;
        if (v.rd) v.driver = null; else v.rider = null;
        ch.vehicle = null;
        ch.noCollide = false;
        ch.y += 90; ch.yspeed = 6;
        ch.invulnTimer = Math.max(ch.invulnTimer || 0, 30);
    },

    // after characters move: drive, pin riders to their seats, run-over hits
    update: function() {
        for (let i = 0; i < this.cars.length; i++) this.driveCar(this.cars[i]);
        for (let i = 0; i < this.carts.length; i++) this.rollCart(this.carts[i]);
    },

    driveCar: function(car) {
        var rd = car.rd, P = rd.pts, ch = car.driver;
        if (Ragdolls.list.indexOf(rd) === -1) Ragdolls.list.push(rd);
        if (ch && (ch.dead || ch.vehicle !== car)) { car.driver = null; ch = null; }
        var go = 0;
        if (ch) {
            go = ch.rightPressed ? 1 : (ch.leftPressed ? -1 : 0);
            // seat: between the roof points, a little below
            var sx = (P[4].x + P[5].x) / 2, sy = (P[4].y + P[5].y) / 2 - 22;
            ch.x = sx; ch.y = sy; ch.xspeed = rd.velX(); ch.yspeed = 0;
            ch.onGround = true;
            ch.lastFacing = (P[1].x >= P[0].x) ? 1 : -1;
        }
        var grip = 0, TX = 0, TY = 0;
        for (let w = 0; w < 2; w++) {
            var p = P[w];
            p.ang = (p.ang || 0) + (p.x - p.px) / p.r;
            if (p.contact > 0) { grip++; TX += p.cny; TY += -p.cnx; p.contact--; }
        }
        if (grip && go) {
            var tl = Math.hypot(TX, TY) || 1; TX /= tl; TY /= tl;
            var along = rd.velX() * TX + rd.velY() * TY;
            if (go * along < 20) for (let i = 0; i < P.length; i++) { P[i].px -= TX * go * 0.6 * grip / 2; P[i].py -= TY * go * 0.6 * grip / 2; }
        }
        if (ch && ch.downPressed && grip) for (let i = 0; i < P.length; i++) { P[i].px = P[i].x - (P[i].x - P[i].px) * 0.9; P[i].py = P[i].y - (P[i].y - P[i].py) * 0.9; }
        rd.wake();
        // run-overs
        var sp = Math.hypot(rd.velX(), rd.velY());
        if (sp > 5) {
            for (let z = 0; z < zombies.length; z++) {
                var zz = zombies[z];
                if (zz.dead || (zz._runCd || 0) > 0) { if (zz._runCd > 0) zz._runCd--; continue; }
                for (let i = 0; i < P.length; i++) {
                    if (Math.hypot(zz.x - P[i].x, zz.y - P[i].y) < P[i].r + zz.s1 / 2) {
                        zz._runCd = 25;
                        var dir = rd.velX() >= 0 ? 1 : -1;
                        zz.takeDamage(-sp * 3.2 * (devOpts.playerDamage || 1), dir * sp * 0.6, 7, ch || null);
                        if (!zz.dead && zz.startRagdoll) { zz.ragdollImmune = 0; zz.startRagdoll(dir * sp * 0.7, 8, 50); }
                        if (typeof SFX !== "undefined") SFX.play("bonk", zz.x, zz.y, Math.min(1, sp / 15));
                        break;
                    }
                }
            }
        }
    },

    rollCart: function(cart) {
        var r = cart.rail, ch = cart.rider;
        if (!r) return;
        if (ch && (ch.dead || ch.vehicle !== cart)) { cart.rider = null; ch = null; }
        var slope = (r.y2 - r.y1) / r.len;                       // sin of the incline
        cart.v -= slope * gravity * 0.9;                          // downhill speeds up
        if (ch) cart.v += (ch.rightPressed ? 0.28 : 0) - (ch.leftPressed ? 0.28 : 0);
        cart.v *= 0.995;
        cart.v = Math.max(-26, Math.min(26, cart.v));
        cart.t += cart.v;
        // hop onto the next / previous piece, or bump to a stop at the end of the line
        while (cart.t > r.len) { if (r.next) { cart.t -= r.len; r = cart.rail = r.next; } else { cart.t = r.len; cart.v = -cart.v * 0.3; break; } }
        while (cart.t < 0) { if (r.prev) { r = cart.rail = r.prev; cart.t += r.len; } else { cart.t = 0; cart.v = -cart.v * 0.3; break; } }
        var f = cart.t / r.len;
        cart.x = r.x1 + (r.x2 - r.x1) * f; cart.y = r.y1 + (r.y2 - r.y1) * f;
        cart.ang = Math.atan2(r.y2 - r.y1, r.x2 - r.x1);
        if (ch) { ch.x = cart.x; ch.y = cart.y + 70; ch.xspeed = cart.v; ch.yspeed = 0; ch.onGround = true; }
        // carts bowl enemies over too
        if (Math.abs(cart.v) > 6) for (let z = 0; z < zombies.length; z++) {
            var zz = zombies[z];
            if (!zz.dead && Math.abs(zz.x - cart.x) < 60 + zz.s1 / 2 && Math.abs(zz.y - (cart.y + 30)) < 70 && !((zz._runCd || 0) > 0)) {
                zz._runCd = 25; zz.takeDamage(-Math.abs(cart.v) * 3, Math.sign(cart.v) * 8, 7, ch || null);
            } else if (zz._runCd > 0) zz._runCd--;
        }
    },

    // ---------------------------------------------------------------- drawing
    drawCar: function(rd) {
        var P = rd.pts, k = cameraScaleX;
        var S = function(p) { return [wsx(p.x), wsy(p.y)]; };
        var a = S(P[2]), b = S(P[3]), c = S(P[5]), d = S(P[4]);
        ctx.fillStyle = rd.color; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 3;
        // body + cabin
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[0], b[1] - 16 * k); ctx.lineTo(c[0] + 14 * k, c[1] + 18 * k); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.lineTo(a[0], a[1] - 22 * k); ctx.closePath(); ctx.fill();
        var panel = TextureManager.getPattern("panel_overlay"); if (panel) { ctx.fillStyle = panel; ctx.fill(); }     // seams + rivets over the paint
        ctx.stroke();
        ctx.fillStyle = "rgba(186,230,253,0.85)";
        ctx.beginPath(); ctx.moveTo(d[0] + 6 * k, d[1] + 8 * k); ctx.lineTo(c[0] - 2 * k, c[1] + 8 * k); ctx.lineTo(c[0] + 10 * k, c[1] + 20 * k); ctx.lineTo(d[0] + 2 * k, d[1] + 22 * k); ctx.closePath(); ctx.fill();
        if (rd.car && rd.car.driver) { var dc = rd.car.driver; ctx.fillStyle = "#f2c9a0"; ctx.beginPath(); ctx.arc((c[0] + d[0]) / 2, (c[1] + d[1]) / 2 + 16 * k, 9 * k + 2, 0, 7); ctx.fill(); ctx.fillStyle = dc.color || "#ef4444"; ctx.fillRect((c[0] + d[0]) / 2 - 9 * k, (c[1] + d[1]) / 2 + 6 * k, 18 * k, 5 * k); }
        for (let w = 0; w < 2; w++) {
            var q = P[w], sx = wsx(q.x), sy = wsy(q.y), r = q.r * k;
            ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
            ctx.fillStyle = "#9ca3af"; ctx.beginPath(); ctx.arc(sx, sy, r * 0.5, 0, 7); ctx.fill();
            ctx.strokeStyle = "#374151"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(q.ang || 0) * r * 0.5, sy + Math.sin(q.ang || 0) * r * 0.5); ctx.stroke();
        }
    },

    drawWorld: function() {
        var k = cameraScaleX;
        for (let i = 0; i < this.rails.length; i++) {
            var r = this.rails[i], ax = wsx(r.x1), ay = wsy(r.y1), bx = wsx(r.x2), by = wsy(r.y2);
            var n = Math.max(2, Math.round(r.len / 40));
            ctx.strokeStyle = TextureManager.getPattern("rail_tie") || "#78350f"; ctx.lineWidth = 6 * k + 2;
            for (let s = 0; s <= n; s++) { var t = s / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 6 * k + 2); ctx.stroke(); }
            ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 4 * k + 1;
            ctx.beginPath(); ctx.moveTo(ax, ay - 3 * k); ctx.lineTo(bx, by - 3 * k); ctx.stroke();
        }
        for (let i = 0; i < this.carts.length; i++) {
            var cart = this.carts[i];
            for (let c = 0; c < cart.cars; c++) {
                var cx = cart.x - Math.cos(cart.ang || 0) * c * 130, cy = cart.y - Math.sin(cart.ang || 0) * c * 130;
                ctx.save();
                ctx.translate(wsx(cx), wsy(cy));
                ctx.rotate(-(cart.ang || 0));
                ctx.fillStyle = TextureManager.getPattern("cart_iron") || "#6b7280"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(-55 * k, -70 * k); ctx.lineTo(55 * k, -70 * k); ctx.lineTo(45 * k, -14 * k); ctx.lineTo(-45 * k, -14 * k); ctx.closePath(); ctx.fill();
                if (c === 0 && cart.cars > 1) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fill(); }          // the engine car is darker
                ctx.stroke();
                ctx.fillStyle = "#111827";
                ctx.beginPath(); ctx.arc(-28 * k, -10 * k, 12 * k, 0, 7); ctx.arc(28 * k, -10 * k, 12 * k, 0, 7); ctx.fill();
                ctx.restore();
            }
            if (!cart.rider && characters.some(function(h) { return h.isPlayer && !h.dead && Math.hypot(h.x - cart.x, h.y - cart.y - 40) < 150; })) uiText("E: ride", wsx(cart.x), wsy(cart.y + 110), 13, "#7dd3fc", "center", "800");
        }
        for (let i = 0; i < this.cars.length; i++) {
            var car = this.cars[i];
            if (!car.driver && characters.some(function(h) { return h.isPlayer && !h.dead && Math.hypot(h.x - car.rd.centerX(), h.y - car.rd.centerY()) < 150; }))
                uiText("E: drive", wsx(car.rd.centerX()), wsy(car.rd.centerY() + 110), 13, "#7dd3fc", "center", "800");
        }
    }
};
