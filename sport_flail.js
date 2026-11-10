// ============================================================================
// ZOMBIE BALL - "FLAIL" STYLE: one-button physics soccer
//   Each team fields two wobbly, stiff-legged ragdoll players with big heads. ONE button per team
//   (P1: W / F / click / pad A,  P2: ↑ / Enter / pad A, CPUs time their own): every player on your team
//   jumps and swings both legs toward the enemy goal; hold it in the air to keep tipping forward.
//   They try to stand back up on their own. The physics decides the rest.
//   Pause menu -> "Style: Flail (one button)" to switch. Uses the normal ball, goals, clock and score.
// ============================================================================
var Flail = {
    men: [], idleT: 0,
    on: function() { return typeof sportCfg !== "undefined" && sportCfg.style === "flail"; },

    // who presses for each team: { kind: "p1" | "p2" | "cpu" }
    controllers: function() {
        var f = sportCfg.format;
        if (f === "pvp") return [{ kind: "p1" }, { kind: "p2" }];
        if (f === "coop") return [{ kind: "p1" }, { kind: "cpu" }];   // both humans share red: P1 or P2 button
        return [{ kind: "p1" }, { kind: "cpu" }];
    },

    spawnTeams: function() {
        this.clearMen();
        var C = this.controllers();
        for (let t = 0; t < 2; t++) for (let k = 0; k < 2; k++) {
            var x = (t === 0 ? -1 : 1) * (k === 0 ? 450 : 1150);
            this.men.push(this.makeMan(x, 0, t, k, C[t]));
        }
    },

    clearMen: function() {
        for (let i = 0; i < this.men.length; i++) Ragdolls.remove(this.men[i]);
        this.men = [];
    },

    makeMan: function(x, ground, team, k, ctrl) {
        var rd = new Ragdoll({ kind: "flail", thick: 3 }, 1);
        var S = 1.5;                               // big, readable players
        rd.addPoint(x, ground + 170 * S, 26 * S);      // 0 head (big)
        rd.addPoint(x, ground + 82 * S, 9 * S);        // 1 hip
        rd.addPoint(x - 16 * S, ground + 12 * S, 11 * S);  // 2 left foot
        rd.addPoint(x + 16 * S, ground + 12 * S, 11 * S);  // 3 right foot
        rd.addStick(0, 1, 1);                  // spine
        rd.addStick(1, 2, 1); rd.addStick(1, 3, 1);   // stiff legs
        rd.addStick(2, 3, 0.35, true);         // feet don't cross
        rd.addStick(0, 2, 0.08, true); rd.addStick(0, 3, 0.08, true);
        rd.life = -1;
        rd.flailTeam = team; rd.flailCtrl = ctrl; rd.flailK = k;
        rd.home = x;
        rd.drawFn = Flail.drawMan;
        Ragdolls.list.push(rd);
        return rd;
    },

    pressed: function(ctrl, t) {
        if (ctrl.kind === "p1") {
            var pad = (typeof Pads !== "undefined") ? Pads.state[0] : null;
            return WASDupPressed || (PlayerInput[0] && PlayerInput[0].shoot) || mouseDown || (sportCfg.format === "coop" && (ULDRupPressed || PlayerInput[1].shoot)) || !!(pad && pad.active && pad.up);
        }
        if (ctrl.kind === "p2") {
            var pad2 = (typeof Pads !== "undefined") ? Pads.state[1] : null;
            return ULDRupPressed || (PlayerInput[1] && PlayerInput[1].shoot) || !!(pad2 && pad2.active && pad2.up);
        }
        // CPU: press when one of its men is close to the ball and roughly behind it
        var dir = t === 0 ? 1 : -1, best = Infinity;
        for (let i = 0; i < this.men.length; i++) {
            var m = this.men[i];
            if (m.flailTeam !== t) continue;
            var dx = (Ball.x - m.pts[1].x) * dir, dy = Ball.y - m.pts[1].y;
            if (dx > -40 && dx < 260 && Math.abs(dy) < 240) best = Math.min(best, dx);
        }
        var lvl = sportCfg.level || 2;
        this.cpuT = (this.cpuT || 0) + 1;
        return best < Infinity && (this.cpuT % [0, 26, 14, 8][lvl] === 0 || best < 120);
    },

    update: function() {
        if (!this.on()) return;
        if (!this.men.length || Ragdolls.list.indexOf(this.men[0]) === -1) this.spawnTeams();
        var play = Sport.phase === "play";
        var C = this.controllers();
        var press = [play && this.pressed(C[0], 0), play && this.pressed(C[1], 1)];
        this.fresh = this.fresh || [false, false];
        for (let i = 0; i < this.men.length; i++) {
            var m = this.men[i], P = m.pts, t = m.flailTeam, dir = t === 0 ? 1 : -1;
            var grounded = (P[2].contact > 0 || P[3].contact > 0);
            if (P[2].contact > 0) P[2].contact--;
            if (P[3].contact > 0) P[3].contact--;
            var head = P[0], hip = P[1];
            // shuffle toward a spot just behind the ball (front man) or a bit further back (back man)
            if (grounded && play) {
                var want = Ball.x - dir * (90 + m.flailK * 260);
                var dx = want - hip.x;
                if (Math.abs(dx) > 30) { var step = Math.sign(dx) * Math.min(1.1, Math.abs(dx) * 0.01); for (let j = 0; j < 4; j++) P[j].px -= step * 0.35; }
            }
            // try to stand up: pull the head over the hip (weaker in the air)
            var k = grounded ? 0.045 : 0.012;
            head.px -= (hip.x - head.x) * k * 0.6;
            head.py -= (hip.y + 135 - head.y) * k * 0.5;
            if (press[t]) {
                if (grounded && !this.fresh[t]) {
                    // jump + kick: feet whip toward the enemy goal, head rocks back -> the whole body rotates
                    for (let j = 0; j < 4; j++) P[j].py -= 12.5;
                    P[2].px -= dir * 13; P[3].px -= dir * 15;
                    P[0].px += dir * 6;
                    if (typeof SFX !== "undefined" && i % 2 === 0) SFX.play("jump", hip.x, hip.y, 0.5, 1.2);
                } else if (!grounded) {
                    // keep tipping forward while held
                    P[2].px -= dir * 0.6; P[3].px -= dir * 0.6; P[0].px += dir * 0.35;
                }
            }
            m.wake();
            // ball contact: feet and head hit it with their real velocity
            for (let j = 0; j < 4; j++) {
                var p = P[j], dx = Ball.x - p.x, dy = Ball.y - p.y, d = Math.hypot(dx, dy), minD = Ball.r + p.r;
                if (d < minD && d > 0.01) {
                    var nx = dx / d, ny = dy / d;
                    Ball.x = p.x + nx * minD; Ball.y = p.y + ny * minD;
                    var pvx = p.x - p.px, pvy = p.y - p.py;
                    var rel = (Ball.vx - pvx) * nx + (Ball.vy - pvy) * ny;
                    if (rel < 0) { Ball.vx -= 1.6 * rel * nx; Ball.vy -= 1.6 * rel * ny; }
                    Ball.vx += pvx * 0.35; Ball.vy += Math.max(0, pvy) * 0.35;
                    Ball.lastTeam = t; Ball.lastTouch = null;
                    if (-rel > 8 && typeof SFX !== "undefined") SFX.play("kick", Ball.x, Ball.y, Math.min(1, -rel / 25));
                }
            }
        }
        this.fresh = [press[0], press[1]];
        // a ball that sits dead for 6 s gets dropped back in at the centre
        if (play && Math.hypot(Ball.vx, Ball.vy) < 0.6) { if (++this.idleT > 360) { this.idleT = 0; Ball.x = 0; Ball.y = 700; Ball.vx = (Math.random() - 0.5) * 6; Ball.vy = 0; Components.addFloatingText("BALL DROP!", 0, 820, "#fde047", 22); } }
        else this.idleT = 0;
    },

    kickoff: function() {
        if (!this.on()) return;
        this.spawnTeams();
    },

    drawMan: function(rd) {
        var P = rd.pts, k = cameraScaleX, col = TEAM_COLORS[rd.flailTeam];
        var S = function(p) { return [wsx(p.x), wsy(p.y)]; };
        var h = S(P[0]), hip = S(P[1]), f1 = S(P[2]), f2 = S(P[3]);
        ctx.lineCap = "round";
        var seg = function(a, b, w, c) { ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = w + 5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
        seg(hip, f1, 14 * k + 2, "#f8fafc"); seg(hip, f2, 14 * k + 2, "#f8fafc");                // socks/legs
        [f1, f2].forEach(function(f) { ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.ellipse(f[0], f[1], 20 * k + 2, 10 * k + 2, 0, 0, 7); ctx.fill(); });
        seg(hip, h, 24 * k + 3, col);                                                            // jersey
        ctx.fillStyle = "#f2c9a0"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(h[0], h[1], P[0].r * k, 0, 7); ctx.fill(); ctx.stroke();         // big head
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(h[0], h[1], P[0].r * k, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();   // hair band in team colour
        var dir = rd.flailTeam === 0 ? 1 : -1;
        ctx.fillStyle = "#0a0f16";
        ctx.beginPath(); ctx.arc(h[0] + dir * 12 * k, h[1] + 3 * k, 4.5 * k + 1, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(h[0] + dir * 27 * k, h[1] + 3 * k, 4.5 * k + 1, 0, 7); ctx.fill();
        ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h[0] + dir * 20 * k, h[1] + 16 * k, 7 * k, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "900 " + Math.round(13 * k + 6) + "px " + UI_FONT; ctx.textAlign = "center";
        var ctrl = rd.flailCtrl.kind;
        ctx.fillText(ctrl === "cpu" ? "CPU" : ctrl.toUpperCase(), (hip[0] + h[0]) / 2, (hip[1] + h[1]) / 2 + 5);
    }
};
