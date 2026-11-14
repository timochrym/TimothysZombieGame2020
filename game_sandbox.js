// ============================================================================
// GAME: BLANK SANDBOX (sandbox) - First game in Arcade Hub.
//   Starts as a 100% blank empty world.
//   Features:
//     - Universal Creative Mode: spawn EVERY object & entity from ALL games
//     - Entity Takeover (Possession): select and control any entity
//     - Grappling Hook (G or Grapple tool): latch onto blocks/crates/entities & swing
//     - Toggleable Floor Grid (starts empty) & Void Rescue
// ============================================================================
var sandboxCfg = {
    showFloor: false,
    noclip: false,
    invincible: true,
    simPaused: false
};
try {
    var _sc = JSON.parse(localStorage.getItem("timsSandboxCfg") || "null");
    if (_sc) { for (var _sk in _sc) sandboxCfg[_sk] = _sc[_sk]; }
} catch (e) {}
function saveSandboxCfg() {
    try { localStorage.setItem("timsSandboxCfg", JSON.stringify(sandboxCfg)); } catch (e) {}
}

// Blank empty level: zero pre-placed geometry or gadgets
ModeKit.addLevel("sandbox_blank", {
    name: "✨ Blank Empty World",
    mode: "sandbox",
    wavesEnabled: false,
    spawnP1: [0, 80],
    spawnP2: [140, 80],
    layout: [],
    gadgets: []
});

// ============================================================================
// GRAPPLING HOOK SYSTEM (works in Sandbox & Creative, or with GRAPPLE power)
// ============================================================================
var GrappleHook = {
    maxDist: 1450,

    activeTarget: function() {
        if (typeof EntityTakeover !== "undefined" && EntityTakeover.target && !EntityTakeover.target.dead) {
            return EntityTakeover.target;
        }
        return redGuy;
    },

    fire: function(ch, wx, wy) {
        if (!ch || ch.dead) return false;
        var dx = wx - ch.x, dy = wy - ch.y;
        var dist = Math.hypot(dx, dy);
        if (dist < 10) return false;
        var ux = dx / dist, uy = dy / dist;

        var best = null, bestD = this.maxDist;
        var candidates = [].concat(staticObjects || [], movingObjects || [], zombies || [], characters || []);
        for (var step = 28; step <= this.maxDist; step += 16) {
            var px = ch.x + ux * step;
            var py = ch.y + uy * step;
            for (var i = 0; i < candidates.length; i++) {
                var o = candidates[i];
                if (!o || o.dead || o === ch) continue;
                var hw = (o.w || o.s1 || 40) / 2;
                var hh = (o.h || o.s2 || 40) / 2;
                if (Math.abs(px - o.x) <= hw && Math.abs(py - o.y) <= hh) {
                    best = { x: px, y: py, target: o, ox: px - o.x, oy: py - o.y };
                    bestD = step;
                    break;
                }
            }
            if (best) break;
        }

        // Also allow latching anywhere in mid-air if in Blank Sandbox when no geometry is hit
        if (!best && GameModes.current && GameModes.current.id === "sandbox") {
            var airDist = Math.min(dist, 700);
            best = { x: ch.x + ux * airDist, y: ch.y + uy * airDist, target: null, ox: 0, oy: 0 };
            bestD = airDist;
        }

        if (!best) return false;
        ch._grapple = {
            x: best.x,
            y: best.y,
            target: best.target,
            ox: best.ox,
            oy: best.oy,
            len: Math.max(60, bestD * 0.92)
        };
        if (typeof Components !== "undefined") Components.spawnSparks(best.x, best.y, "#38bdf8", 8);
        if (typeof SFX !== "undefined") SFX.play("jump", ch.x, ch.y, 0.7, 1.5);
        return true;
    },

    release: function(ch, boost) {
        if (!ch || !ch._grapple) return;
        ch._grapple = null;
        if (boost) ch.yspeed = Math.max(ch.yspeed, 11);
    },

    toggle: function(ch, wx, wy) {
        if (!ch) return;
        if (ch._grapple) this.release(ch, false);
        else this.fire(ch, wx, wy);
    },

    updateAll: function() {
        var list = [].concat(characters || [], zombies || []);
        for (var i = 0; i < list.length; i++) {
            var ch = list[i];
            var g = ch._grapple;
            if (!g || ch.dead) { ch._grapple = null; continue; }
            if (g.target) {
                if (g.target.dead) { ch._grapple = null; continue; }
                g.x = g.target.x + g.ox;
                g.y = g.target.y + g.oy;
            }
            // Reel in / let out
            if (ch.upPressed) g.len = Math.max(48, g.len - 9);
            if (ch.downPressed) g.len = Math.min(this.maxDist, g.len + 7);

            var dx = g.x - ch.x, dy = g.y - ch.y;
            var d = Math.hypot(dx, dy) || 1;
            if (d > g.len) {
                var nx = dx / d, ny = dy / d;
                var pull = Math.min(2.6, (d - g.len) * 0.08 + 0.6);
                ch.xspeed += nx * pull;
                ch.yspeed += ny * pull;
                ch.onGround = false;
            }
        }
    },

    drawAll: function() {
        if (typeof ctx === "undefined") return;
        var list = [].concat(characters || [], zombies || []);
        for (var i = 0; i < list.length; i++) {
            var ch = list[i];
            var g = ch._grapple;
            if (!g || ch.dead) continue;
            var s1 = worldToScreen(ch.x, ch.y);
            var s2 = worldToScreen(g.x, g.y);
            ctx.save();
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = Math.max(2, 3 * cameraScaleX);
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.stroke();
            ctx.fillStyle = "#facc15";
            ctx.beginPath();
            ctx.arc(s2.x, s2.y, Math.max(4, 6 * cameraScaleX), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
};

// ============================================================================
// ENTITY TAKEOVER (POSSESSION) SYSTEM
// ============================================================================
var EntityTakeover = {
    target: null,

    possess: function(ent) {
        if (!ent || ent.dead) return false;
        this.release(true);
        this.target = ent;
        ent._possessed = true;
        ent._wasCPU = !!ent.isCPU;
        ent.isCPU = false;
        if (typeof Components !== "undefined") {
            Components.addFloatingText("⚡ POSSESSED", ent.x, ent.y + 80, "#38bdf8", 18);
            Components.spawnSparks(ent.x, ent.y, "#38bdf8", 12);
        }
        return true;
    },

    release: function(silent) {
        var t = this.target;
        if (!t) return;
        t._possessed = false;
        if (t._wasCPU !== undefined) t.isCPU = t._wasCPU;
        t.leftPressed = t.rightPressed = t.upPressed = t.downPressed = false;
        this.target = null;
        if (!silent && redGuy && typeof Components !== "undefined") {
            Components.addFloatingText("↩ RETURNED TO HERO", redGuy.x, redGuy.y + 80, "#e2e8f0", 15);
        }
    },

    drive: function(ent) {
        if (!ent || ent.dead) { this.release(true); return; }
        var inp = (typeof PlayerInput !== "undefined" && PlayerInput[0]) ? PlayerInput[0] : {};
        ent.leftPressed = !!inp.left;
        ent.rightPressed = !!inp.right;
        ent.upPressed = !!inp.up;
        ent.downPressed = !!inp.down;
        if (ent.leftPressed) ent.facing = -1;
        else if (ent.rightPressed) ent.facing = 1;
        // Allow possessed zombies/entities to fly in creative/sandbox if up+down or double-tap
        if (inp.shoot && typeof ent.shoot === "function") ent.shoot();
    },

    listAll: function() {
        var out = [];
        for (var i = 0; i < (characters || []).length; i++) {
            var c = characters[i];
            if (!c.dead) out.push({ kind: "hero", label: (c.playerLabel || c.name || "Hero") + (c.isCPU ? " (CPU)" : ""), ent: c, hp: Math.round(c.health), maxHp: Math.round(c.maxHealth || 100), icon: c.isCPU ? "🤖" : "🧑" });
        }
        for (var j = 0; j < (zombies || []).length; j++) {
            var z = zombies[j];
            if (!z.dead) out.push({ kind: "enemy", label: (z.power || z.name || "Zombie"), ent: z, hp: Math.round(z.health), maxHp: Math.round(z.maxHealth || 100), icon: z.power === "BOSS_KING" ? "👑" : "🧟" });
        }
        if (typeof Ragdolls !== "undefined") {
            for (var r = 0; r < Ragdolls.list.length; r++) {
                var rd = Ragdolls.list[r];
                out.push({ kind: "ragdoll", label: rd.isVehicle ? "Vehicle Rider" : (rd.style && rd.style.kind === "ball" ? "Ball" : "Ragdoll #" + (r + 1)), ent: rd, hp: 100, maxHp: 100, icon: rd.isVehicle ? "🚲" : "🤸" });
            }
        }
        return out;
    },

    findAt: function(wx, wy) {
        var all = this.listAll();
        for (var i = all.length - 1; i >= 0; i--) {
            var e = all[i].ent;
            var ex = typeof e.centerX === "function" ? e.centerX() : e.x;
            var ey = typeof e.centerY === "function" ? e.centerY() : e.y;
            var hw = (e.s1 || e.w || 50) / 2 + 16;
            var hh = (e.s2 || e.h || 50) / 2 + 16;
            if (Math.abs(ex - wx) <= hw && Math.abs(ey - wy) <= hh) return all[i];
        }
        return null;
    }
};

// ============================================================================
// UNIVERSAL OBJECT SPAWNER CATALOG (ALL GAMES, NO DISCRIMINATION)
// ============================================================================
var UniversalSpawner = {
    catalog: null,

    buildCatalog: function() {
        var items = [];
        var add = function(id, name, game, icon, spawnFn) {
            items.push({ id: id, name: name, game: game, icon: icon, spawn: spawnFn });
        };

        // 1. Pull every item from STUDIO_PALETTE across ALL games (ignoring mode restrictions!)
        if (typeof STUDIO_PALETTE !== "undefined") {
            for (var c = 0; c < STUDIO_PALETTE.length; c++) {
                var catName = STUDIO_PALETTE[c][0];
                var entries = STUDIO_PALETTE[c][1];
                for (var e = 0; e < entries.length; e++) {
                    (function(cat, entry) {
                        var label = entry[0], icon = entry[1], tpl = entry[2];
                        add("st_" + cat + "_" + label, label, cat, icon, function(wx, wy) {
                            return UniversalSpawner.spawnStudioTemplate(tpl, wx, wy);
                        });
                    })(catName, entries[e]);
                }
            }
        }

        // 2. Pull every PowerUpDefs item (weapons, jetpack, shield, etc.)
        if (typeof PowerUpDefs !== "undefined") {
            for (var pk in PowerUpDefs) {
                (function(key, def) {
                    add("pu_" + key, def.label || key, "Power-Ups", "⚡", function(wx, wy) {
                        if (typeof spawnPowerUp === "function") return spawnPowerUp(wx, wy, key);
                    });
                })(pk, PowerUpDefs[pk]);
            }
        }

        // 3. Grappling Hook, Balls, Ragdolls, Cannons, Beds, Generators
        add("tool_grapple", "Grappling Hook (Equip)", "Gadgets", "🪝", function(wx, wy) {
            var t = GrappleHook.activeTarget();
            if (t) { GrappleHook.fire(t, wx, wy); }
        });
        add("obj_soccer_ball", "Soccer Ball (Physics)", "Zombie Ball", "⚽", function(wx, wy) {
            if (typeof Ragdolls !== "undefined" && Ragdolls.spawnBall) return Ragdolls.spawnBall(wx, wy, 28, "#f8fafc");
            return GameObject.addCrate(wx, wy, 48, "#f8fafc", { name: "Soccer Ball" });
        });
        add("obj_ragdoll", "Crash-Test Ragdoll", "Ragdoll Siege", "🤸", function(wx, wy) {
            if (typeof Ragdolls !== "undefined" && Ragdolls.spawn) return Ragdolls.spawn(wx, wy, "#facc15");
        });
        add("obj_bed", "Bed Brawl Bed", "Bed Brawl", "🛏", function(wx, wy) {
            return GameObject.addBox(wx, wy, 90, 46, "#ef4444", { name: "Team Bed", texture: "wool_red", kind: "block" });
        });
        add("obj_gen", "Ore Generator", "Bed Brawl", "⚙️", function(wx, wy) {
            return GameObject.addBox(wx, wy, 64, 64, "#94a3b8", { name: "Ore Generator", texture: "lab_metal", kind: "block" });
        });
        add("obj_turret", "Auto Turret Block", "Tanks", "🔫", function(wx, wy) {
            return GameObject.addBox(wx, wy, 64, 64, "#3b82f6", { name: "Turret", texture: "metal_plate", kind: "block" });
        });
        add("obj_acid", "Acid Pool", "Powder", "🧪", function(wx, wy) {
            return Gadgets.add({ type: "spikes", x: wx, y: wy, w: 180 });
        });

        this.catalog = items;
        return items;
    },

    getCatalog: function() {
        return this.catalog || this.buildCatalog();
    },

    spawnStudioTemplate: function(tpl, wx, wy) {
        if (!tpl) return null;
        if (tpl.cat === "layout") {
            if (tpl.type === "box") return GameObject.addBox(wx, wy, tpl.w || 160, tpl.h || 80, tpl.color || "#b84a27", tpl);
            if (tpl.type === "ramp") return GameObject.addRamp(wx, wy, tpl.w || 240, tpl.h || 160, tpl.dir || "right", tpl.color || "#6c3c28", tpl);
            if (tpl.type === "bumper") return GameObject.addBumper(wx, wy, tpl.w || 180, tpl.h || 36, tpl.bounce || 24, tpl.color || "#ff2e63", tpl);
            if (tpl.type === "crate") return GameObject.addCrate(wx, wy, tpl.size || tpl.w || 80, tpl.color || "#d9a05b", tpl);
        } else if (tpl.cat === "gadget") {
            var def = {};
            for (var k in tpl) def[k] = tpl[k];
            def.x = wx; def.y = wy;
            return Gadgets.add(def);
        } else if (tpl.cat === "enemy") {
            if (typeof spawnZombie === "function") return spawnZombie(tpl.power || "NORMAL", wx, wy);
        } else if (tpl.cat === "spawn") {
            if (tpl.player === 1 && redGuy) { redGuy.x = wx; redGuy.y = wy; redGuy.xspeed = redGuy.yspeed = 0; }
            if (tpl.player === 2 && blueGuy) { blueGuy.x = wx; blueGuy.y = wy; blueGuy.xspeed = blueGuy.yspeed = 0; }
        } else {
            return GameObject.addBox(wx, wy, tpl.w || 120, tpl.h || 60, tpl.color || "#64748b", { name: tpl.kind || tpl.cat || "Object" });
        }
        return null;
    },

    spawnById: function(id, wx, wy) {
        var list = this.getCatalog();
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) {
                var res = list[i].spawn(wx, wy);
                if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                if (typeof Components !== "undefined") Components.spawnSparks(wx, wy, "#38bdf8", 6);
                return res;
            }
        }
        return null;
    }
};

// ============================================================================
// REGISTER BLANK SANDBOX AS GAME #1
// ============================================================================
GameModes.register({
    id: "sandbox",
    firstInHub: true,
    title: "BLANK SANDBOX",
    tagline: "Empty world. Every object from all 23 games, grappling hook & entity takeover.",
    color: "#38bdf8",
    firstLevel: "sandbox_blank",
    flags: {
        waves: false, revive: false, jetpack: true, shooting: true, ability: true,
        ammo: false, noBedrock: true, scenery: false, coopToggle: true,
        dash: true, wallJump: true, airJumps: 99, flight: true, building: true, buildFree: true
    },
    overTitle: "BLANK SANDBOX",
    againLabel: "Reset Empty World",

    setupLevel: function(lvl) {
        Gadgets.load(lvl.gadgets || []);
        if (typeof SummonManager !== "undefined") SummonManager.pauseWaves = true;
        EntityTakeover.release(true);
        if (sandboxCfg.showFloor) {
            GameObject.addBox(0, -140, 12000, 200, "#1e293b", { name: "Sandbox Floor", texture: "neon_grid", kind: "block" });
            rebuildAllObjects();
        }
    },

    createPlayers: function() {
        var lvl = LevelManager.getCurrentLevel();
        var sp1 = lvl.spawnP1 || [0, 80], sp2 = lvl.spawnP2 || [140, 80];
        var p1 = ModeKit.makeHero(0, sp1[0], sp1[1]);
        p1.creativeFlying = true;
        if (multiplayer) ModeKit.makeHero(1, sp2[0], sp2[1]);
        else blueGuy = null;
        for (var i = 0; i < characters.length; i++) characters[i].noclip = sandboxCfg.noclip;
    },

    preUpdate: function() {
        for (var i = 0; i < characters.length; i++) {
            var c = characters[i];
            c.noclip = sandboxCfg.noclip;
            if (c.y < -1800) { c.x = 0; c.y = 120; c.xspeed = c.yspeed = 0; }
        }
        for (var z = 0; z < zombies.length; z++) {
            if (zombies[z].y < -1800) { zombies[z].x = 0; zombies[z].y = 120; zombies[z].xspeed = zombies[z].yspeed = 0; }
        }
        GrappleHook.updateAll();
    },

    cameraTargets: function() {
        if (EntityTakeover.target && !EntityTakeover.target.dead) return [EntityTakeover.target];
        return null;
    },

    onDamage: function(ch) {
        return !!(ch.isPlayer && sandboxCfg.invincible);
    },

    onKey: function(code) {
        if (code === "KeyG") {
            var w = typeof screenToWorld === "function" ? screenToWorld(mouseX, mouseY) : { x: 200, y: 200 };
            GrappleHook.toggle(GrappleHook.activeTarget(), w.x, w.y);
            return true;
        }
        if (code === "KeyF" && EntityTakeover.target) {
            EntityTakeover.release(false);
            return true;
        }
        if (code === "KeyN") {
            sandboxCfg.noclip = !sandboxCfg.noclip;
            saveSandboxCfg();
            if (redGuy) Components.addFloatingText(sandboxCfg.noclip ? "NOCLIP ON" : "NOCLIP OFF", redGuy.x, redGuy.y + 90, "#38bdf8", 16);
            return true;
        }
        return false;
    },

    onRestart: function() {
        LevelManager.selectLevel("sandbox_blank");
    },

    drawWorld: function() {
        if (sandboxCfg.showFloor && typeof ctx !== "undefined") {
            ctx.save();
            ctx.strokeStyle = "rgba(56,189,248,0.12)";
            ctx.lineWidth = 1;
            var left = cameraTargetX - (cssW / cameraScaleX) * 0.6;
            var right = cameraTargetX + (cssW / cameraScaleX) * 0.6;
            var bot = cameraTargetY - (cssH / cameraScaleY) * 0.6;
            var top = cameraTargetY + (cssH / cameraScaleY) * 0.6;
            var gx0 = Math.floor(left / 160) * 160;
            var gy0 = Math.floor(bot / 160) * 160;
            for (var gx = gx0; gx <= right; gx += 160) {
                var a = worldToScreen(gx, bot), b = worldToScreen(gx, top);
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
            for (var gy = gy0; gy <= top; gy += 160) {
                var c = worldToScreen(left, gy), d = worldToScreen(right, gy);
                ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
            }
            ctx.restore();
        }
    },

    drawFront: function() {
        GrappleHook.drawAll();
        if (EntityTakeover.target && !EntityTakeover.target.dead) {
            var t = EntityTakeover.target;
            var sp = worldToScreen(t.x, t.y + (t.s2 || 60) / 2 + 26);
            uiText("⚡ CONTROLLING (F to eject)", sp.x, sp.y, 12, "#38bdf8", "center", "900");
        }
    },

    drawHUD: function() {
        uiText("B / Space: Universal Spawner  ·  G: Grappling Hook  ·  Tab: Entity Roster  ·  Right-Click: Context Menu  ·  Esc: Menu",
            cssW / 2, cssH - 14, 12, "rgba(226,232,240,0.75)", "center", "700");
    }
});
