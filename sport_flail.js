// ============================================================================
// ZOMBIE BALL - "FLAIL" STYLE: one-button physics soccer
//   Each team fields two wobbly, stiff-legged ragdoll players with big heads. ONE button per team
//   (P1: W / F / click / pad A,  P2: ↑ / Enter / pad A, CPUs time their own): every player on your team
//   jumps and swings both legs toward the enemy goal; hold it in the air to keep tipping forward.
//   They try to stand back up on their own. The physics decides the rest.
//   Pause menu -> "Style: Flail (one button)" to switch. Uses the normal ball, goals, clock and score.
// ============================================================================
var FLAIL_MODS = [["none", "None"], ["wind", "Wind"], ["bighead", "Big heads"], ["ice", "Ice pitch"], ["random", "Random each match"]];
var Flail = {
    men: [], idleT: 0, wind: 0, mod: "none",
    // modifiers: sportCfg.flailMod (none / wind / bighead / ice / random), sportCfg.keepers (goalkeepers on/off)
    pickMod: function() {
        var m = sportCfg.flailMod || "none";
        if (m === "random") m = ["none", "wind", "bighead", "ice"][(Math.random() * 4) | 0];
        this.mod = m;
        this.wind = m === "wind" ? (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.08) : 0;
    },
    on: function() { return typeof sportCfg !== "undefined" && sportCfg.style === "flail"; },

    // Who presses for each team: { kind: "p1" | "p2" | "lan" | "cpu", label, pids, also }.
    // A second player never has to dig through a menu: the first LAN joiner takes blue (the next one helps red, and so
    // on), and a local P2 takes blue from the CPU by pressing their button (↑ / Enter / pad 2).
    controllers: function() {
        var f = sportCfg.format;
        var red = { kind: "p1", label: "P1", pids: [] }, blue = { kind: "cpu", label: "CPU", pids: [] };
        if (f === "pvp" || this.p2In) blue = { kind: "p2", label: "P2", pids: [] };
        var lan = (typeof Net !== "undefined" && Net.role === "host") ? Net.peerList() : [];
        for (let i = 0; i < lan.length; i++) {
            if (i % 2 === 0) { if (blue.kind === "cpu") blue = { kind: "lan", label: (lan[i].name || "P2").slice(0, 6), pids: [] }; blue.pids.push(lan[i].pid); }
            else red.pids.push(lan[i].pid);
        }
        return [red, blue];
    },
    lanPressed: function(pids) {
        for (let i = 0; i < pids.length; i++) { var b = Net.peerButtons(pids[i]); if (b.go) return true; }
        return false;
    },
    // local P2 drops in on blue by pressing their button
    p2DropIn: function() {
        if (this.p2In || sportCfg.format === "pvp" || sportCfg.format === "coop") return;
        var pad2 = (typeof Pads !== "undefined") ? Pads.state[1] : null;
        if (ULDRupPressed || (PlayerInput[1] && PlayerInput[1].kbShoot) || !!(pad2 && pad2.active && (pad2.up || pad2.shoot))) {
            this.p2In = true;
            Components.addFloatingText("P2 plays BLUE!  (↑ / Enter)", 0, 420, TEAM_COLORS[1], 26);
            if (typeof SFX !== "undefined") SFX.play("select");
        }
    },
    // who controls which team changed (someone joined, left or dropped in): relabel the players, keep the match going
    syncControllers: function() {
        var C = this.controllers(), key = C.map(function(c) { return c.kind + c.label + c.pids.join("."); }).join("|");
        if (key === this.ctrlKey) return C;
        this.ctrlKey = key;
        for (let i = 0; i < this.men.length; i++) { var m = this.men[i]; m.flailCtrl = C[m.flailTeam]; m.flailLabel = C[m.flailTeam].label; }
        return C;
    },

    spawnTeams: function() {
        this.clearMen();
        var C = this.controllers();
        this.ctrlKey = null;
        var n = sportCfg.keepers === false ? 2 : 3;
        for (let t = 0; t < 2; t++) for (let k = 0; k < n; k++) {
            var x = (t === 0 ? -1 : 1) * [450, 1150, 1880][k];
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
        var headR = this.mod === "bighead" ? 26 * S * 1.75 : 26 * S;
        rd.addPoint(x, ground + 170 * S, headR);       // 0 head (big - or huge with the Big heads modifier)
        rd.addPoint(x, ground + 82 * S, 9 * S);        // 1 hip
        rd.addPoint(x - 16 * S, ground + 12 * S, 11 * S);  // 2 left foot
        rd.addPoint(x + 16 * S, ground + 12 * S, 11 * S);  // 3 right foot
        rd.addStick(0, 1, 1);                  // spine
        rd.addStick(1, 2, 1); rd.addStick(1, 3, 1);   // stiff legs
        rd.addStick(2, 3, 0.35, true);         // feet don't cross
        rd.addStick(0, 2, 0.08, true); rd.addStick(0, 3, 0.08, true);
        rd.life = -1;
        rd.flailTeam = team; rd.flailCtrl = ctrl; rd.flailLabel = ctrl.label; rd.flailK = k; rd.keeper = k === 2;
        rd.home = x;
        rd.drawFn = Flail.drawMan;
        Ragdolls.list.push(rd);
        return rd;
    },

    pressed: function(ctrl, t) {
        if (ctrl.pids && ctrl.pids.length && this.lanPressed(ctrl.pids)) return true;       // LAN players on this team
        if (ctrl.kind === "lan") return false;
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
        this.p2DropIn();
        var C = this.syncControllers();
        // the heroes are only hidden seats in this style (a LAN joiner's too)
        for (let ci = 0; ci < characters.length; ci++) if (!characters[ci].dead) { characters[ci].dead = true; characters[ci].noCollide = true; }
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
                // the keeper stays on its goal line, sliding across to cover the ball's side
                if (m.keeper) want = -dir * (Sport.goalX - 140) + Math.max(-60, Math.min(60, (Ball.x + dir * Sport.goalX) * 0.05));
                var dx = want - hip.x;
                var hurry = m.keeper ? 3.2 : 1;           // keepers get back to the line quickly
                if (Math.abs(dx) > 30) { var step = Math.sign(dx) * Math.min(1.1 * hurry, Math.abs(dx) * 0.01 * hurry); for (let j = 0; j < 4; j++) P[j].px -= step * 0.35; }
            }
            // try to stand up: pull the head over the hip (weaker in the air)
            var k = grounded ? 0.045 : 0.012;
            head.px -= (hip.x - head.x) * k * 0.6;
            head.py -= (hip.y + 135 - head.y) * k * 0.5;
            if (press[t]) {
                if (grounded && !this.fresh[t]) {
                    // jump + kick: feet whip toward the enemy goal, head rocks back -> the whole body rotates
                    if (m.keeper) {
                        // keepers spring straight up to block (arms-up dive), they don't charge upfield
                        for (let j = 0; j < 4; j++) P[j].py -= 14;
                    } else {
                        for (let j = 0; j < 4; j++) P[j].py -= 12.5;
                        P[2].px -= dir * 13; P[3].px -= dir * 15;
                        P[0].px += dir * 6;
                    }
                    if (typeof SFX !== "undefined" && i % 2 === 0) SFX.play("jump", hip.x, hip.y, 0.5, 1.2);
                } else if (!grounded && !m.keeper) {
                    // keep tipping forward while held
                    P[2].px -= dir * 0.6; P[3].px -= dir * 0.6; P[0].px += dir * 0.35;
                }
            }
            // modifiers: wind pushes everyone (and the ball, below); ice keeps feet sliding
            if (this.wind) for (let j = 0; j < 4; j++) P[j].px -= this.wind * (j === 0 ? 0.5 : 0.25);   // a breeze on bodies (the ball feels it most)
            if (this.mod === "ice" && grounded) for (let j = 1; j < 4; j++) P[j].px -= (P[j].x - P[j].px) * 0.06;
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
        if (this.wind && play) Ball.vx += this.wind * 1.4;
        // a ball that sits dead for 6 s gets dropped back in at the centre
        if (play && Math.hypot(Ball.vx, Ball.vy) < 0.6) { if (++this.idleT > 360) { this.idleT = 0; Ball.x = 0; Ball.y = 700; Ball.vx = (Math.random() - 0.5) * 6; Ball.vy = 0; Components.addFloatingText("BALL DROP!", 0, 820, "#fde047", 22); } }
        else this.idleT = 0;
    },

    kickoff: function(fresh) {
        if (!this.on()) return;
        if (fresh || !this.modPicked) { this.pickMod(); this.modPicked = true; }
        if (this.mod === "wind" && Sport.score[0] + Sport.score[1] > 0) this.wind = (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.08);   // gusts change after goals
        this.spawnTeams();
    },
    // drawn by the sport HUD: which modifier is on (and the wind arrow)
    hud: function() {
        if (!this.on()) return;
        var label = { none: "", wind: "WIND", bighead: "BIG HEADS", ice: "ICE PITCH" }[this.mod] || "";
        if (!label) return;
        uiPanel(cssW / 2 - 110, 150, 220, 34, "#67e8f9", 0.85);
        var arrow = this.mod === "wind" ? (this.wind > 0 ? "  ➜ " : "  ⬅ ") + Math.round(Math.abs(this.wind) * 100) : "";
        uiText("🌀 " + label + arrow, cssW / 2, 173, 15, "#cffafe", "center", "900");
    },

    drawMan: function(rd) {
        var P = rd.pts, k = cameraScaleX;
        var S = function(p) { return [wsx(p.x), wsy(p.y)]; };
        var h = S(P[0]), hip = S(P[1]), f1 = S(P[2]), f2 = S(P[3]);
        var dir = rd.flailTeam === 0 ? 1 : -1;
        var hs = Math.max(0.75, (P[0].r || 39) / 39); // supports Big Heads modifier

        // Iconic Soccer Physics palettes (Team 0 keeper matches the reference green+red kit; outfield is Red vs Blue)
        var pal = rd.flailTeam === 0
            ? (rd.keeper
                ? { jersey: "#5ce65c", dark: "#243d24", accent: "#ef4444", num: "1" }
                : { jersey: "#ef4444", dark: "#7f1d1d", accent: "#dc2626", num: String((rd.flailK || 0) + 2) })
            : (rd.keeper
                ? { jersey: "#38bdf8", dark: "#1e3a5f", accent: "#facc15", num: "1" }
                : { jersey: "#3b82f6", dark: "#1e3a8a", accent: "#2563eb", num: String((rd.flailK || 0) + 2) });
        var outline = "#1c1917";
        var skin = "#e6a868";
        var hair = "#5c3317";
        var ow = Math.max(2, Math.round(4 * k));

        var drawLeg = function(foot) {
            var dx = foot[0] - hip[0], dy = foot[1] - hip[1];
            var ld = Math.max(24 * k, Math.hypot(dx, dy));
            var la = Math.atan2(dy, dx);
            var lw = Math.round(16 * k);
            var bootLen = Math.round(22 * k);
            var bootH = Math.round(13 * k);
            var toeY = -dir * Math.round(10 * k); // local -y points right (+x screen) when leg points down

            ctx.save();
            ctx.translate(hip[0], hip[1]);
            ctx.rotate(la);

            // Thick pixel outline for leg + L-shaped boot
            ctx.fillStyle = outline;
            ctx.fillRect(-ow, -lw / 2 - ow, ld + ow * 2, lw + ow * 2);
            ctx.fillRect(ld - bootH - ow, (dir > 0 ? -lw / 2 - (bootLen - lw) : -lw / 2) - ow, bootH + ow * 2, bootLen + ow * 2);

            // Shorts cuff -> skin knee -> dark sock band -> shin sock
            var s1 = ld * 0.24, s2 = ld * 0.48, s3 = ld * 0.62, s4 = ld * 0.86;
            ctx.fillStyle = pal.dark;
            ctx.fillRect(0, -lw / 2, s1 + 1, lw);
            ctx.fillStyle = skin;
            ctx.fillRect(s1, -lw / 2, s2 - s1 + 1, lw);
            ctx.fillStyle = pal.dark;
            ctx.fillRect(s2, -lw / 2, s3 - s2 + 1, lw);
            ctx.fillStyle = pal.jersey;
            ctx.fillRect(s3, -lw / 2, s4 - s3 + 1, lw);

            // Blocky bright boot/cleat
            ctx.fillStyle = pal.accent;
            ctx.fillRect(ld - bootH, dir > 0 ? -lw / 2 - (bootLen - lw) : -lw / 2, bootH, bootLen);
            ctx.restore();
        };

        var sa = Math.atan2(h[1] - hip[1], h[0] - hip[0]) + Math.PI / 2;
        var sd = Math.max(40 * k, Math.hypot(h[0] - hip[0], h[1] - hip[1]));

        // 1. Back leg
        drawLeg(f1);

        // 2. Torso + raised blocky arms
        ctx.save();
        ctx.translate(hip[0], hip[1]);
        ctx.rotate(sa);

        var tw = Math.round(34 * k);
        var armW = Math.round(12 * k);
        var armH = Math.round(54 * k);
        var armY = -sd - Math.round(16 * k);
        var shY = -sd + Math.round(24 * k);

        // Raised arms (left & right, slightly flared like Soccer Physics pose)
        [-1, 1].forEach(function(side) {
            var ax = side * (tw / 2 + armW * 0.55) - armW / 2;
            ctx.fillStyle = outline;
            ctx.fillRect(ax - ow, armY - ow, armW + ow * 2, armH + ow * 2);
            // Hand (skin)
            ctx.fillStyle = skin;
            ctx.fillRect(ax, armY, armW, armH * 0.25);
            // Dark wrist cuff
            ctx.fillStyle = pal.dark;
            ctx.fillRect(ax, armY + armH * 0.25, armW, armH * 0.12);
            // Jersey sleeve
            ctx.fillStyle = pal.jersey;
            ctx.fillRect(ax, armY + armH * 0.37, armW, armH * 0.43);
            // Dark shoulder pad
            ctx.fillStyle = pal.dark;
            ctx.fillRect(ax, armY + armH * 0.80, armW, armH * 0.20);
        });

        // Torso outline + jersey + dark shoulders + dark shorts
        var torsoTop = shY - Math.round(6 * k);
        var torsoH = sd - Math.round(14 * k);
        ctx.fillStyle = outline;
        ctx.fillRect(-tw / 2 - ow, torsoTop - ow, tw + ow * 2, torsoH + ow * 2);

        ctx.fillStyle = pal.jersey;
        ctx.fillRect(-tw / 2, torsoTop, tw, torsoH * 0.72);
        // Dark shoulder trim
        ctx.fillStyle = pal.dark;
        ctx.fillRect(-tw / 2, torsoTop, Math.round(8 * k), Math.round(12 * k));
        ctx.fillRect(tw / 2 - Math.round(8 * k), torsoTop, Math.round(8 * k), Math.round(12 * k));
        // Dark shorts
        ctx.fillStyle = pal.dark;
        ctx.fillRect(-tw / 2, torsoTop + torsoH * 0.72, tw, torsoH * 0.28);

        // Crisp white vertical chest number / stripe
        ctx.fillStyle = "#ffffff";
        var numX = dir * Math.round(4 * k);
        var numY = torsoTop + torsoH * 0.34;
        if (pal.num === "1") {
            ctx.fillRect(numX - Math.round(3 * k), numY - Math.round(9 * k), Math.round(6 * k), Math.round(18 * k));
        } else {
            ctx.font = "900 " + Math.max(10, Math.round(18 * k)) + "px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(pal.num, numX, numY);
        }
        ctx.restore();

        // 3. Front leg (drawn over shorts/torso seam for clean layering)
        drawLeg(f2);

        // 4. Square pixel-art head
        ctx.save();
        ctx.translate(h[0], h[1]);
        ctx.rotate(sa);
        var hw = Math.round(38 * k * hs);
        var hh = Math.round(38 * k * hs);
        var hx = -hw / 2, hy = -hh / 2;

        // Thick pixel outline
        ctx.fillStyle = outline;
        ctx.fillRect(hx - ow, hy - ow, hw + ow * 2, hh + ow * 2);
        // Tan skin
        ctx.fillStyle = skin;
        ctx.fillRect(hx, hy, hw, hh);
        // Brown flat-top hair
        var hairH = Math.round(hh * 0.22);
        ctx.fillStyle = hair;
        ctx.fillRect(hx, hy, hw, hairH);
        // Stepped bangs on forehead side
        var bangW = Math.round(hw * 0.28);
        var bangX = dir > 0 ? hx + Math.round(hw * 0.14) : hx + hw - Math.round(hw * 0.14) - bangW;
        ctx.fillRect(bangX, hy + hairH + Math.round(hh * 0.14), bangW, Math.round(hh * 0.12));
        ctx.fillRect(bangX, hy + hairH + Math.round(hh * 0.14), Math.round(bangW * 0.5), Math.round(hh * 0.20));

        // Team/Accent headband
        ctx.fillStyle = pal.accent;
        ctx.fillRect(hx, hy + hairH, hw, Math.round(hh * 0.15));

        // Crisp square black eye + small mouth/stubble mark
        var eyeS = Math.max(3, Math.round(5.5 * k * hs));
        var eyeX = dir > 0 ? hx + hw * 0.64 : hx + hw * 0.36 - eyeS;
        var eyeY = hy + hh * 0.44;
        ctx.fillStyle = "#111111";
        ctx.fillRect(eyeX, eyeY, eyeS, eyeS);

        // Small mouth / chin mark
        ctx.fillStyle = "#78350f";
        ctx.fillRect(dir > 0 ? hx + hw * 0.52 : hx + hw * 0.26, hy + hh * 0.72, Math.round(hw * 0.22), Math.max(2, Math.round(3.5 * k * hs)));
        ctx.restore();

        // Subtle player tag above head
        if (rd.flailLabel) {
            ctx.save();
            ctx.font = "800 " + Math.max(10, Math.round(11 * k + 3)) + "px " + UI_FONT;
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(15,23,42,0.72)";
            var twTag = ctx.measureText(rd.flailLabel).width + 10;
            ctx.fillRect(h[0] - twTag / 2, h[1] - hh * 0.75 - 18, twTag, 15);
            ctx.fillStyle = rd.flailTeam === 0 ? "#fca5a5" : "#93c5fd";
            ctx.fillText(rd.flailLabel, h[0], h[1] - hh * 0.75 - 7);
            ctx.restore();
        }
    }
};
