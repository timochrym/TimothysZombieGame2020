// ============================================================================
// GAME: ZOMBIE BALL  (sport)  -  Rocket-League-style ragdoll soccer
//   Kick (F / Enter / click / RT), dash-tackle opponents (Shift / B), shockwave the ball (E / Y),
//   jump for headers. 1v1 to 3v3 with CPU teammates/opponents, or P1 vs P2.
// ============================================================================
var sportCfg = { format: "1v1", level: 2, minutes: 2, goals: 5 };
try { var _sc = JSON.parse(localStorage.getItem("timsZombieBallCfg") || "null"); if (_sc) { for (var _k in _sc) sportCfg[_k] = _sc[_k]; } } catch (e) {}
var SPORT_FORMATS = [
    ["1v1", "P1 vs CPU"], ["pvp", "P1 vs P2"], ["2v2", "P1 + CPU vs 2 CPU"], ["coop", "P1 + P2 vs 2 CPU"], ["3v3", "P1 + 2 CPU vs 3 CPU"]
];
var TEAM_COLORS = ["#ff5a5f", "#3da5ff"];
var TEAM_NAMES = ["RED", "BLUE"];

var Ball = {
    x: 0, y: 300, vx: 0, vy: 0, r: 44, angle: 0, lastTeam: -1, lastTouch: null,

    reset: function() { this.x = 0; this.y = 420; this.vx = 0; this.vy = 0; this.angle = 0; this.lastTeam = -1; },

    step: function() {
        var g = gravity * (devOpts.gravityMult || 1) * 0.78;
        var sub = 3;
        for (let s = 0; s < sub; s++) {
            this.vy -= g / sub;
            this.x += this.vx / sub;
            this.y += this.vy / sub;
            this.collideStatics();
        }
        this.vx *= 0.997; this.vy *= 0.999;
        this.angle += this.vx / this.r;
        var sp = Math.hypot(this.vx, this.vy);
        if (sp > 34) { this.vx *= 34 / sp; this.vy *= 34 / sp; }
    },

    collideStatics: function() {
        var r = this.r;
        var near = StaticGrid.query(this.x - r - 10, this.y - r - 10, this.x + r + 10, this.y + r + 10, false, StaticGrid.bufC);
        for (let i = 0; i < near.length; i++) {
            var o = near[i];
            if (o.dead || o.noCollide) continue;
            var L = o.x - o.w / 2, R = o.x + o.w / 2, B = o.y - o.h / 2, T = o.y + o.h / 2;
            var cx = Math.max(L, Math.min(R, this.x)), cy = Math.max(B, Math.min(T, this.y));
            var dx = this.x - cx, dy = this.y - cy;
            var d = Math.hypot(dx, dy);
            if (d >= r) continue;
            var nx, ny;
            if (d < 0.001) { nx = 0; ny = 1; d = 0; } else { nx = dx / d; ny = dy / d; }
            this.x += nx * (r - d);
            this.y += ny * (r - d);
            var vn = this.vx * nx + this.vy * ny;
            if (vn < 0) {
                var e = o.isBumper ? 1.4 : 0.7;
                this.vx -= (1 + e) * vn * nx;
                this.vy -= (1 + e) * vn * ny;
                // rolling friction on the ground
                if (ny > 0.7) this.vx *= 0.985;
                if (-vn > 7 && typeof SFX !== "undefined") SFX.play("kick", this.x, this.y, Math.min(1, -vn / 25) * 0.6);
            }
        }
    },

    collideCharacters: function() {
        var r = this.r;
        var all = characters;
        for (let i = 0; i < all.length; i++) {
            var c = all[i];
            if (c.dead) continue;
            var hw = c.s1 / 2, hh = c.s2 / 2;
            var cx = Math.max(c.x - hw, Math.min(c.x + hw, this.x)), cy = Math.max(c.y - hh, Math.min(c.y + hh, this.y));
            var dx = this.x - cx, dy = this.y - cy;
            var d = Math.hypot(dx, dy);
            if (d >= r) continue;
            var nx, ny;
            if (d < 0.001) { nx = (this.x >= c.x) ? 1 : -1; ny = 0.3; var l = Math.hypot(nx, ny); nx /= l; ny /= l; d = 0; } else { nx = dx / d; ny = dy / d; }
            this.x += nx * (r - d);
            this.y += ny * (r - d);
            var rvx = this.vx - c.xspeed, rvy = this.vy - c.yspeed;
            var vn = rvx * nx + rvy * ny;
            if (vn < 0) {
                this.vx -= 1.5 * vn * nx;
                this.vy -= 1.5 * vn * ny;
            }
            // carry some of the player's momentum, plus a little pop
            this.vx += c.xspeed * 0.25;
            this.vy += Math.max(0, c.yspeed * 0.25) + (Math.abs(c.xspeed) > 4 ? 1.5 : 0);
            if (c.dashTimer > 0) {
                var dl = Math.hypot(c.dashVX, c.dashVY) || 1;
                this.vx = c.dashVX / dl * 27; this.vy = c.dashVY / dl * 27 + 6;
                Components.addFloatingText("POWER SHOT!", this.x, this.y + 90, "#ffd23f", 18);
                if (typeof SFX !== "undefined") SFX.play("kick", this.x, this.y, 1);
            }
            this.lastTeam = c.fighterTeam; this.lastTouch = c;
        }
    },

    draw: function() {
        var sx = wsx(this.x), sy = wsy(this.y), r = this.r * cameraScaleX;
        // ground shadow
        var floorY = wsy(0);
        var hgt = Math.max(0, this.y - this.r);
        ctx.fillStyle = "rgba(0,0,0," + Math.max(0.08, 0.35 - hgt / 2500) + ")";
        ctx.beginPath(); ctx.ellipse(sx, floorY, r * Math.max(0.4, 1 - hgt / 1600), r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(-this.angle);
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        // retro pixel patches
        ctx.fillStyle = "#1f2937";
        var px = Math.max(2, r / 5);
        var patches = [[0, 0], [-2, -2], [2, -2], [-2, 2], [2, 2], [0, -3.4], [0, 3.4], [-3.4, 0], [3.4, 0]];
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
        for (let i = 0; i < patches.length; i++) {
            var p = patches[i], sz = i === 0 ? 1.6 : 1;
            ctx.fillRect(p[0] * px - px * sz / 2, p[1] * px - px * sz / 2, px * sz, px * sz);
        }
        ctx.restore();
        ctx.lineWidth = 3; ctx.strokeStyle = "#0a0f16";
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
        if (sx < 0 || sx > cssW || sy < 0 || sy > cssH) drawEdgeIndicator(this.x, this.y, "#ffffff", "BALL");
    }
};

var Sport = {
    phase: "kickoff", timer: 0, score: [0, 0], clock: 0, sudden: false, goalTeam: -1, celebrate: 0,
    goalX: 2100,   // goal mouth starts at |x| > goalX
    barY: 360,     // crossbar underside

    teamDir: function(team) { return team === 0 ? 1 : -1; }, // red attacks right, blue attacks left

    kickoff: function(fresh) {
        Ball.reset();
        var spots = [[-500, 40], [-1100, 40], [-1600, 40]];
        var counts = [0, 0];
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            var t = c.fighterTeam, k = counts[t]++;
            var sp = spots[Math.min(k, 2)];
            if (c.liveRagdoll) { Ragdolls.remove(c.liveRagdoll); c.liveRagdoll = null; c.ragdollTimer = 0; }
            c.x = t === 0 ? sp[0] : -sp[0]; c.y = sp[1] + 40; c.xspeed = c.yspeed = 0;
            c.lastFacing = t === 0 ? 1 : -1;
            c.degree = t === 0 ? 90 : 270;
        }
        this.phase = "kickoff";
        this.timer = fresh ? 180 : 130;
    },

    goal: function(team) {
        this.score[team]++;
        this.phase = "goal";
        this.timer = 170;
        this.goalTeam = team;
        if (typeof SFX !== "undefined") SFX.play("goal");
        Juice.slowMo(70, 0.35);
        screenShake = 10;
        var gx = team === 0 ? this.goalX + 150 : -this.goalX - 150;
        for (let i = 0; i < 70; i++) {
            if (particles.length > 160) particles.shift();
            var cols = ["#ffd23f", "#ff5a5f", "#3da5ff", "#4ade80", "#ffffff", "#f472b6"];
            particles.push({ x: gx + (Math.random() - 0.5) * 200, y: 200 + Math.random() * 200, w: 12, h: 12, xspeed: (Math.random() - 0.5) * 24, yspeed: 8 + Math.random() * 20, poly: Math.makeHitbox(12, 12), color: cols[i % cols.length], life: 70 + Math.random() * 40 });
        }
        // the losing side gets blown over by the goal blast (ragdolls!)
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (c.fighterTeam !== team && Math.abs(c.x - gx) < 900) { c.ragdollImmune = 0; c.startRagdoll(Math.sign(c.x - gx) * 9, 8, 60); }
        }
        var who = Ball.lastTouch && Ball.lastTouch.fighterTeam !== team ? " (OWN GOAL!)" : "";
        if (typeof showBanner === "function") showBanner("GOOOAL!" + who, TEAM_NAMES[team] + " scores  ·  " + this.score[0] + " - " + this.score[1], TEAM_COLORS[team]);
    },

    endMatch: function() {
        this.phase = "over";
        gameOver = true;
        var w = this.score[0] > this.score[1] ? 0 : 1;
        if (typeof SFX !== "undefined") SFX.play("whistle");
        if (typeof showBanner === "function") showBanner("FULL TIME", TEAM_NAMES[w] + " WINS  " + this.score[0] + " - " + this.score[1], TEAM_COLORS[w]);
        GameModes.current.overTitle = TEAM_NAMES[w] + " WINS!";
    }
};

ModeKit.addLevel("zb_stadium", {
    name: "⚽ Zombie Ball: Graveyard Stadium", mode: "sport", wavesEnabled: false,
    spawnP1: [-500, 80], spawnP2: [500, 80],
    layout: [
        { type: "box", name: "Pitch", x: 0, y: -200, w: 5000, h: 400, color: "#2d6a4f", texture: "grass_dirt", kind: "block" },
        { type: "box", name: "Left Wall", x: -2500, y: 900, w: 200, h: 2600, color: "#334155", texture: "castle_stone", kind: "wall" },
        { type: "box", name: "Right Wall", x: 2500, y: 900, w: 200, h: 2600, color: "#334155", texture: "castle_stone", kind: "wall" },
        { type: "box", name: "Ceiling", x: 0, y: 2100, w: 5400, h: 200, color: "#334155", texture: "castle_stone", kind: "block" },
        { type: "box", name: "Left Crossbar", x: -2250, y: 380, w: 300, h: 40, color: "#e5e7eb", texture: "solid", kind: "block" },
        { type: "box", name: "Right Crossbar", x: 2250, y: 380, w: 300, h: 40, color: "#e5e7eb", texture: "solid", kind: "block" },
        { type: "ramp", name: "Left Corner Slope", x: -2300, y: 1900, w: 200, h: 200, dir: "right", color: "#334155", texture: "castle_stone", kind: "slope" },
        { type: "ramp", name: "Right Corner Slope", x: 2300, y: 1900, w: 200, h: 200, dir: "left", color: "#334155", texture: "castle_stone", kind: "slope" }
    ]
});

GameModes.register({
    id: "sport",
    title: "ZOMBIE BALL",
    tagline: "Rocket-League-style ragdoll soccer. Kick, dash-tackle, shockwave the ball!",
    color: "#4ade80",
    firstLevel: "zb_stadium",
    flags: { waves: false, revive: false, jetpack: false, shooting: false, ability: true, ammo: false, noBedrock: true, scenery: false, coopToggle: false, playerControl: true, airJumps: 1 },
    overTitle: "FULL TIME",
    againLabel: "Rematch",

    onActivate: function() { jetpackEnabled = false; },

    createPlayers: function() {
        var f = sportCfg.format;
        var red = [{ cpu: false, idx: 0 }], blue = [];
        if (f === "1v1") blue = [{ cpu: true }];
        else if (f === "pvp") blue = [{ cpu: false, idx: 1 }];
        else if (f === "2v2") { red.push({ cpu: true }); blue = [{ cpu: true }, { cpu: true }]; }
        else if (f === "coop") { red.push({ cpu: false, idx: 1 }); blue = [{ cpu: true }, { cpu: true }]; }
        else if (f === "3v3") { red.push({ cpu: true }, { cpu: true }); blue = [{ cpu: true }, { cpu: true }, { cpu: true }]; }
        var slot = 2, n = 1;
        var make = function(p, team) {
            var idx = p.cpu ? slot++ : p.idx;
            var ch = ModeKit.makeHero(idx, team === 0 ? -500 : 500, 80, { team: team, accent: TEAM_COLORS[team], cpu: p.cpu, label: p.cpu ? "CPU" + (n++) : ("P" + (p.idx + 1)) });
            ch.fighterTeam = team;
        };
        red.forEach(function(p) { make(p, 0); });
        blue.forEach(function(p) { make(p, 1); });
        multiplayer = (f === "pvp" || f === "coop");
    },

    onReset: function() {
        Sport.score = [0, 0];
        Sport.clock = sportCfg.minutes * 60 * 60;
        Sport.sudden = false;
        GameModes.current.overTitle = "FULL TIME";
        Sport.kickoff(true);
    },

    preUpdate: function() {
        this.flags.playerControl = (Sport.phase === "play");
        if (Sport.phase !== "play") {
            for (let i = 0; i < characters.length; i++) { if (!characters[i].liveRagdoll) characters[i].xspeed *= 0.8; }
        }
    },

    update: function() {
        var S = Sport;
        if (S.phase === "kickoff") {
            S.timer--;
            if (S.timer % 60 === 0 && S.timer > 0 && typeof SFX !== "undefined") SFX.play("beep");
            if (S.timer <= 0) { S.phase = "play"; if (typeof SFX !== "undefined") SFX.play("whistle"); }
        } else if (S.phase === "play") {
            if (!S.sudden) {
                S.clock--;
                if (S.clock <= 0) {
                    if (S.score[0] === S.score[1]) { S.sudden = true; if (typeof showBanner === "function") showBanner("SUDDEN DEATH", "Next goal wins!", "#ffd23f"); }
                    else { S.endMatch(); }
                }
            }
        } else if (S.phase === "goal") {
            S.timer--;
            if (S.timer <= 0) {
                if (S.sudden || S.score[0] >= sportCfg.goals || S.score[1] >= sportCfg.goals) S.endMatch();
                else S.kickoff(false);
            }
        }

        // Ball physics (keeps rolling during celebrations - it looks great)
        if (S.phase !== "over") {
            Ball.step();
            Ball.collideCharacters();
        }

        // Kicks: shoot button near the ball
        if (S.phase === "play") {
            for (let i = 0; i < characters.length; i++) {
                var c = characters[i];
                if (c.dead || c.liveRagdoll) continue;
                c.kickCd = Math.max(0, (c.kickCd || 0) - 1);
                var want = pressedOnce(c, "kick", !!c.shootPressed);
                var d = Math.hypot(Ball.x - c.x, Ball.y - c.y);
                if (want && c.kickCd <= 0 && d < Ball.r + 95) {
                    var rad = Math.radians(c.degree);
                    var ax = Math.sin(rad), ay = Math.cos(rad);
                    if (ay < 0.15) ay = 0.15 + ay * 0.3;
                    var l = Math.hypot(ax, ay);
                    Ball.vx = ax / l * 25 + c.xspeed * 0.3;
                    Ball.vy = ay / l * 25 + 3;
                    Ball.lastTeam = c.fighterTeam; Ball.lastTouch = c;
                    c.kickCd = 16;
                    if (typeof SFX !== "undefined") SFX.play("kick", Ball.x, Ball.y, 1);
                    Components.spawnSparks(Ball.x, Ball.y, "#ffffff", 6);
                }
                // dash tackles knock opponents into ragdolls
                if (c.dashTimer > 0) {
                    for (let j = 0; j < characters.length; j++) {
                        var o = characters[j];
                        if (o === c || o.fighterTeam === c.fighterTeam || o.liveRagdoll || o.dead) continue;
                        if (Math.abs(o.x - c.x) < 80 && Math.abs(o.y - c.y) < 80) {
                            o.ragdollImmune = 0;
                            o.startRagdoll(Math.sign(c.dashVX || 1) * 10, 7, 55);
                            Components.addFloatingText("TACKLE!", o.x, o.y + 100, TEAM_COLORS[c.fighterTeam], 20);
                        }
                    }
                }
            }
            // Goals
            if (Ball.y < S.barY - 10) {
                if (Ball.x > S.goalX + Ball.r * 0.4) S.goal(0);
                else if (Ball.x < -S.goalX - Ball.r * 0.4) S.goal(1);
            }
        }
    },

    onDamage: function(ch, amount, kx, ky) {
        // no health in Zombie Ball - big hits (shockwaves) just knock you flat
        if (amount <= -30) { ch.ragdollImmune = 0; ch.startRagdoll(kx || (Math.random() - 0.5) * 10, 7, 45); }
        return true;
    },

    onExplosion: function(x, y, radius, power) {
        var dx = Ball.x - x, dy = Ball.y - y, d = Math.hypot(dx, dy);
        if (d < radius * 1.1 && d > 1) {
            var f = (1 - d / (radius * 1.1)) * power * 2.4;
            Ball.vx += dx / d * f; Ball.vy += dy / d * f + f * 0.4;
        }
    },

    cameraTargets: function() {
        var pts = [{ x: Ball.x, y: Ball.y }, { x: Ball.x, y: Ball.y }];
        for (let i = 0; i < characters.length; i++) if (!characters[i].dead) pts.push(characters[i]);
        return pts;
    },

    // ---- CPU footballer ----
    cpuThink: function(ch) {
        ch.leftPressed = ch.rightPressed = ch.upPressed = ch.downPressed = false;
        ch.shootPressed = false; ch.abilityPressed = false;
        if (Sport.phase !== "play" || ch.ragdollTimer > 0 || ch.hitstun > 0) return;
        var lvl = sportCfg.level;
        var dir = Sport.teamDir(ch.fighterTeam);
        var ownGoalX = -dir * (Sport.goalX + 150), enemyGoalX = dir * (Sport.goalX + 150);
        // the team-mate farthest from the ball plays keeper
        var mates = characters.filter(function(o) { return o.fighterTeam === ch.fighterTeam && !o.dead; });
        var keeper = null;
        if (mates.length > 1) {
            keeper = mates.slice().sort(function(a, b) { return Math.abs(b.x - Ball.x) - Math.abs(a.x - Ball.x); })[0];
            if (!keeper.isCPU) keeper = null;
        }
        var targetX;
        var bdx = Ball.x - ch.x;
        if (keeper === ch) {
            targetX = ownGoalX * 0.75 + Ball.x * 0.25;
            if (Math.abs(Ball.x - ownGoalX) < 900) targetX = Ball.x - dir * 60;
        } else {
            // get BEHIND the ball (relative to the goal we attack), then push through it
            var behind = (ch.x - Ball.x) * dir < -20;
            targetX = behind ? Ball.x + dir * 30 : Ball.x - dir * 140;
            if (!behind && Math.abs(bdx) < 150 && ch.onGround) ch.upPressed = true; // hop over to get around
        }
        var tdx = targetX - ch.x;
        if (Math.abs(tdx) > 25) { if (tdx > 0) ch.rightPressed = true; else ch.leftPressed = true; }
        // jump for high balls
        if (ch.onGround && Ball.y > ch.y + 110 && Math.abs(bdx) < 170 && Ball.vy < 4 && Math.random() < 0.25 * lvl) ch.upPressed = true;
        // kick toward the enemy goal
        var d = Math.hypot(Ball.x - ch.x, Ball.y - ch.y);
        if (d < Ball.r + 90 && (ch.x - Ball.x) * dir < 30) {
            var err = (3 - lvl) * 9;
            var gy = 180 + (Math.random() - 0.5) * 140;
            ch.degree = (Math.degrees(Math.atan2(enemyGoalX - ch.x, gy - ch.y)) + (Math.random() - 0.5) * 2 * err + 360) % 360;
            if (Math.random() < 0.25 + lvl * 0.2) ch.shootPressed = true;
        }
        // power-dash into a lined-up ball
        if (ch.dashCooldown <= 0 && d < 330 && d > 120 && Math.abs(Ball.y - ch.y) < 90 && (Ball.x - ch.x) * dir > 0 && Math.random() < 0.012 * lvl) {
            ch.degree = (Math.degrees(Math.atan2(Ball.x - ch.x, Ball.y - ch.y)) + 360) % 360;
            ch.triggerNinjaDash();
        }
        // shockwave when an opponent is about to take the ball
        if (ch.abilityCooldown <= 0 && d < 220 && lvl >= 2 && Math.random() < 0.02) {
            for (let i = 0; i < characters.length; i++) {
                var o = characters[i];
                if (o.fighterTeam !== ch.fighterTeam && Math.hypot(o.x - Ball.x, o.y - Ball.y) < 200) { ch.abilityPressed = true; break; }
            }
        }
    },

    // ---- drawing ----
    drawWorld: function() {
        var k = cameraScaleX;
        var g0 = wsy(0);
        // pitch markings
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = Math.max(2, 4 * k);
        ctx.beginPath(); ctx.moveTo(wsx(0), g0); ctx.lineTo(wsx(0), g0 + 30 * k); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(wsx(0), g0 + 12 * k, 300 * k, 26 * k, 0, 0, Math.PI * 2); ctx.stroke();
        // goals: net + posts, glowing in the team colour that defends them
        for (let side = -1; side <= 1; side += 2) {
            var xIn = side * Sport.goalX, xOut = side * 2400;
            var col = side < 0 ? TEAM_COLORS[0] : TEAM_COLORS[1];
            var lx = wsx(Math.min(xIn, xOut)), rx = wsx(Math.max(xIn, xOut));
            var top = wsy(Sport.barY), bot = g0;
            ctx.fillStyle = col + "22";
            ctx.fillRect(lx, top, rx - lx, bot - top);
            ctx.strokeStyle = "rgba(255,255,255,0.35)";
            ctx.lineWidth = 1.5;
            for (let x = lx; x <= rx; x += 22 * k) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke(); }
            for (let y = top; y <= bot; y += 22 * k) { ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(rx, y); ctx.stroke(); }
            ctx.fillStyle = col;
            ctx.fillRect(wsx(xIn) - 6 * k, top, 12 * k, bot - top);
        }
        ctx.restore();
    },

    drawFront: function() { Ball.draw(); },

    drawHUD: function() {
        var S = Sport;
        var cx = cssW / 2;
        uiPanel(cx - 230, 12, 460, 78, "#4ade80");
        uiText(TEAM_NAMES[0], cx - 150, 46, 18, TEAM_COLORS[0], "center", "900");
        uiText(TEAM_NAMES[1], cx + 150, 46, 18, TEAM_COLORS[1], "center", "900");
        uiText(S.score[0] + "  -  " + S.score[1], cx, 58, 40, "#ffffff", "center", "900");
        var secs = Math.max(0, Math.ceil(S.clock / 60));
        uiText(S.sudden ? "SUDDEN DEATH" : (Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0")), cx, 82, 13, S.sudden ? "#ffd23f" : "#cbd5e1", "center", "800");
        uiText("first to " + sportCfg.goals, cx - 150, 72, 11, "#94a3b8", "center", "700");
        uiText(SPORT_FORMATS.find(function(f) { return f[0] === sportCfg.format; })[1], cx + 150, 72, 11, "#94a3b8", "center", "700");
        if (S.phase === "kickoff") {
            var n = Math.ceil(S.timer / 60);
            uiText(n > 0 ? String(n) : "GO!", cx, cssH / 2 - 60, 110, "#ffd23f", "center", "900");
            uiText("KICK-OFF", cx, cssH / 2 - 4, 22, "#e2e8f0", "center", "800");
        }
        // controls strip
        uiPanel(14, cssH - 64, 560, 50, "rgba(120,170,200,0.4)", 0.8);
        uiText("P1: A/D move · W jump · F / click KICK · Shift DASH-TACKLE · E shockwave", 28, cssH - 34, 12, "#dbe7f0", "left", "700");
        if (multiplayer) uiText("P2: arrows · Enter KICK · R-Shift DASH · / shockwave", 28, cssH - 18, 11, "#94a3b8", "left", "700");
        uiText("Esc: menu (format, CPU skill, match length)", cssW - 20, cssH - 22, 12, "rgba(200,220,235,0.6)", "right", "700");
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (!c.dead) drawEdgeIndicator(c.x, c.y, TEAM_COLORS[c.fighterTeam], c.playerLabel);
        }
    },

    menuItems: function(items) {
        var fmt = SPORT_FORMATS.find(function(f) { return f[0] === sportCfg.format; });
        items.push({ id: "zb_fmt", label: "Teams:  ◀  " + fmt[1] + "  ▶", hint: "Applies on Rematch", cycle: true });
        items.push({ id: "zb_lvl", label: "CPU skill:  ◀  " + ["", "Easy", "Normal", "Hard"][sportCfg.level] + "  ▶", hint: "", cycle: true });
        items.push({ id: "zb_min", label: "Match length:  ◀  " + sportCfg.minutes + " min  ▶", hint: "Applies on Rematch", cycle: true });
        items.push({ id: "zb_goals", label: "Goals to win:  ◀  " + sportCfg.goals + "  ▶", hint: "", cycle: true });
        if (!pauseFromGameOver) items.push({ id: "again", label: "Rematch", hint: "Start a new match" });
    },

    onMenu: function(id, dir) {
        dir = dir || 1;
        var save = function() { try { localStorage.setItem("timsZombieBallCfg", JSON.stringify(sportCfg)); } catch (e) {} };
        if (id === "zb_fmt") {
            var i = SPORT_FORMATS.findIndex(function(f) { return f[0] === sportCfg.format; });
            sportCfg.format = SPORT_FORMATS[(i + dir + SPORT_FORMATS.length) % SPORT_FORMATS.length][0];
            save(); return true;
        }
        if (id === "zb_lvl") { sportCfg.level = ((sportCfg.level - 1 + dir + 3) % 3) + 1; save(); return true; }
        if (id === "zb_min") { sportCfg.minutes = Math.max(1, Math.min(10, sportCfg.minutes + dir)); save(); return true; }
        if (id === "zb_goals") { sportCfg.goals = Math.max(1, Math.min(15, sportCfg.goals + dir)); save(); return true; }
        return false;
    }
});
