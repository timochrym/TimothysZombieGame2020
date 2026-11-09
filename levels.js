class LevelManager {

    static init() {
        this.currentLevelKey = "classic_arena";

        // All built-in levels are constructed 100% flush on the 40px World Grid!
        this.builtInLevels = {
            "classic_arena": {
                name: "1. Overworld Arena (Mario/Dojo)",
                spawnP1: [-80, 120],
                spawnP2: [80, 120],
                wavesEnabled: true,
                layout: [
                    // Floor (top = 40) & Arena Walls (left = -1560, right = 1560)
                    { type: "box", name: "Main Floor", x: 0, y: -440, w: 3360, h: 960, color: "#7f4f24", texture: "grass_dirt" },
                    { type: "box", name: "Left Wall", x: -1620, y: 1000, w: 120, h: 1920, color: "#4a5568", texture: "castle_stone" },
                    { type: "box", name: "Right Wall", x: 1620, y: 1000, w: 120, h: 1920, color: "#4a5568", texture: "castle_stone" },

                    // Ground Ramps (bottom = 40, top = 200)
                    { type: "ramp", name: "Left Ground Ramp", x: -280, y: 120, w: 320, h: 160, dir: "left", color: "#b84a27", texture: "brick" },
                    { type: "ramp", name: "Right Ground Ramp", x: 280, y: 120, w: 320, h: 160, dir: "right", color: "#b84a27", texture: "brick" },

                    // Left & Right Lower Platforms (bottom = 160, top = 200 — flush with Ground Ramps at x = ±440)
                    { type: "box", name: "Left Lower Plat", x: -680, y: 180, w: 480, h: 40, color: "#7f4f24", texture: "grass_dirt" },
                    { type: "box", name: "Right Lower Plat", x: 680, y: 180, w: 480, h: 40, color: "#7f4f24", texture: "grass_dirt" },

                    // Mid Ramps on Lower Platforms (bottom = 200, top = 360)
                    { type: "ramp", name: "Left Mid Ramp", x: -560, y: 280, w: 240, h: 160, dir: "right", color: "#6c3c28", texture: "dojo_wood" },
                    { type: "ramp", name: "Right Mid Ramp", x: 560, y: 280, w: 240, h: 160, dir: "left", color: "#6c3c28", texture: "dojo_wood" },

                    // Center Mid Platform (bottom = 360, top = 400) & Upper Platforms (bottom = 480, top = 520)
                    { type: "box", name: "Center Mid Plat", x: 0, y: 380, w: 560, h: 40, color: "#b84a27", texture: "brick" },
                    { type: "box", name: "Left High Plat", x: -1080, y: 500, w: 480, h: 40, color: "#7f4f24", texture: "grass_dirt" },
                    { type: "box", name: "Right High Plat", x: 1080, y: 500, w: 480, h: 40, color: "#7f4f24", texture: "grass_dirt" },

                    // High Ramps on Upper Platforms (bottom = 520, top = 640)
                    { type: "ramp", name: "Left High Ramp", x: -960, y: 580, w: 240, h: 120, dir: "right", color: "#6c3c28", texture: "dojo_wood" },
                    { type: "ramp", name: "Right High Ramp", x: 960, y: 580, w: 240, h: 120, dir: "left", color: "#6c3c28", texture: "dojo_wood" },

                    // Top Gold Bridge (bottom = 680, top = 720)
                    { type: "box", name: "Top Gold Bridge", x: 0, y: 700, w: 400, h: 40, color: "#f4a261", texture: "question_gold" },

                    // Bounce Pads (40px high, aligned on grid)
                    { type: "bumper", name: "Left Bounce Pad", x: -1280, y: 60, w: 160, h: 40, bounce: 24, color: "#ff2e63" },
                    { type: "bumper", name: "Right Bounce Pad", x: 1280, y: 60, w: 160, h: 40, bounce: 24, color: "#ff2e63" },
                    { type: "bumper", name: "Center Bounce Pad", x: 0, y: 420, w: 160, h: 40, bounce: 22, color: "#ff2e63" },

                    // 80x80 Crates & TNT Barrels aligned on 40px Grid
                    { type: "crate", name: "Crate", x: -800, y: 240, size: 80, color: "#d9a05b", texture: "crate_plank" },
                    { type: "crate", name: "Crate", x: 800, y: 240, size: 80, color: "#d9a05b", texture: "crate_plank" },
                    { type: "crate", name: "Crate", x: -80, y: 80, size: 80, color: "#d9a05b", texture: "crate_plank" },
                    { type: "crate", name: "TNT Barrel", x: -160, y: 440, size: 80, explosive: true },
                    { type: "crate", name: "TNT Barrel", x: 160, y: 440, size: 80, explosive: true },
                    { type: "crate", name: "Crate", x: 0, y: 760, size: 80, color: "#d9a05b", texture: "crate_plank" }
                ]
            },

            "zigzag_tower": {
                name: "2. Stick Ninja Dojo Tower",
                spawnP1: [-640, 120],
                spawnP2: [640, 120],
                wavesEnabled: true,
                layout: [
                    // Floor (top = 40) & Dojo Walls
                    { type: "box", name: "Main Floor", x: 0, y: -440, w: 3360, h: 960, color: "#4a5568", texture: "castle_stone" },
                    { type: "box", name: "Left Wall", x: -1620, y: 1000, w: 120, h: 1920, color: "#6c3c28", texture: "dojo_wood" },
                    { type: "box", name: "Right Wall", x: 1620, y: 1000, w: 120, h: 1920, color: "#6c3c28", texture: "dojo_wood" },

                    // Tier 1: Climb from Floor (y=40) to Center Deck (top=200)
                    { type: "ramp", name: "T1 Left Ramp", x: -320, y: 120, w: 320, h: 160, dir: "right", color: "#6c3c28", texture: "dojo_wood" },
                    { type: "ramp", name: "T1 Right Ramp", x: 320, y: 120, w: 320, h: 160, dir: "left", color: "#6c3c28", texture: "dojo_wood" },
                    { type: "box", name: "T1 Center Deck", x: 0, y: 180, w: 320, h: 40, color: "#b84a27", texture: "brick" },

                    // Tier 2: Climb outward from y=200 to Outer Decks (top=360)
                    { type: "ramp", name: "T2 Left Ramp", x: -320, y: 280, w: 320, h: 160, dir: "left", color: "#6c3c28", texture: "dojo_wood" },
                    { type: "ramp", name: "T2 Right Ramp", x: 320, y: 280, w: 320, h: 160, dir: "right", color: "#6c3c28", texture: "dojo_wood" },
                    { type: "box", name: "T2 Left Deck", x: -720, y: 340, w: 480, h: 40, color: "#b84a27", texture: "brick" },
                    { type: "box", name: "T2 Right Deck", x: 720, y: 340, w: 480, h: 40, color: "#b84a27", texture: "brick" },

                    // Tier 3: Climb inward from y=360 to Top Citadel (top=520)
                    { type: "ramp", name: "T3 Left Ramp", x: -440, y: 440, w: 400, h: 160, dir: "right", color: "#6c3c28", texture: "dojo_wood" },
                    { type: "ramp", name: "T3 Right Ramp", x: 440, y: 440, w: 400, h: 160, dir: "left", color: "#6c3c28", texture: "dojo_wood" },
                    { type: "box", name: "Top Citadel", x: 0, y: 500, w: 480, h: 40, color: "#f4a261", texture: "question_gold" },

                    // Side Launchers (bottom=40, top=80)
                    { type: "bumper", name: "Left Launcher", x: -1200, y: 60, w: 160, h: 40, bounce: 27, color: "#ff2e63" },
                    { type: "bumper", name: "Right Launcher", x: 1200, y: 60, w: 160, h: 40, bounce: 27, color: "#ff2e63" },

                    // 80x80 Crates & TNT Barrels on the 40px Grid
                    { type: "crate", name: "TNT Barrel", x: -160, y: 560, size: 80, explosive: true },
                    { type: "crate", name: "TNT Barrel", x: 160, y: 560, size: 80, explosive: true },
                    { type: "crate", name: "Tower Crate", x: 0, y: 560, size: 80, color: "#d9a05b", texture: "crate_plank" },
                    { type: "crate", name: "Left Crate", x: -800, y: 400, size: 80, color: "#d9a05b", texture: "crate_plank" },
                    { type: "crate", name: "Right Crate", x: 800, y: 400, size: 80, color: "#d9a05b", texture: "crate_plank" }
                ]
            },

            "bunker_bridges": {
                name: "3. Jetpack Joyride Sci-Fi Lab",
                spawnP1: [-80, 120],
                spawnP2: [80, 120],
                wavesEnabled: true,
                layout: [
                    // Floor (top = 40) & Lab Walls
                    { type: "box", name: "Main Floor", x: 0, y: -440, w: 3360, h: 960, color: "#2b3a4a", texture: "lab_metal" },
                    { type: "box", name: "Left Wall", x: -1620, y: 1000, w: 120, h: 1920, color: "#2b3a4a", texture: "lab_metal" },
                    { type: "box", name: "Right Wall", x: 1620, y: 1000, w: 120, h: 1920, color: "#2b3a4a", texture: "lab_metal" },

                    // Central Bunker Roof (bottom=240, top=280) & Flush Side Ramps (bottom=40, top=280)
                    { type: "box", name: "Bunker Roof", x: 0, y: 260, w: 640, h: 40, color: "#2b3a4a", texture: "lab_metal" },
                    { type: "ramp", name: "Bunker Left Ramp", x: -480, y: 160, w: 320, h: 240, dir: "right", color: "#2b3a4a", texture: "lab_metal" },
                    { type: "ramp", name: "Bunker Right Ramp", x: 480, y: 160, w: 320, h: 240, dir: "left", color: "#2b3a4a", texture: "lab_metal" },

                    // Outer Watchtowers (bottom=400, top=440) & Ramps (bottom=280, top=440)
                    { type: "box", name: "Left Watchtower", x: -1160, y: 420, w: 480, h: 40, color: "#2b3a4a", texture: "lab_metal" },
                    { type: "box", name: "Right Watchtower", x: 1160, y: 420, w: 480, h: 40, color: "#2b3a4a", texture: "lab_metal" },
                    { type: "ramp", name: "Left Tower Ramp", x: -800, y: 360, w: 240, h: 160, dir: "left", color: "#2b3a4a", texture: "lab_metal" },
                    { type: "ramp", name: "Right Tower Ramp", x: 800, y: 360, w: 240, h: 160, dir: "right", color: "#2b3a4a", texture: "lab_metal" },

                    // High Sky Bridge (bottom=560, top=600) & Bunker Roof Bounce Pad (bottom=280, top=320)
                    { type: "box", name: "Sky Bridge", x: 0, y: 580, w: 720, h: 40, color: "#f4a261", texture: "question_gold" },
                    { type: "bumper", name: "Bunker Roof Pad", x: 0, y: 300, w: 160, h: 40, bounce: 24, color: "#ff2e63" },

                    // 80x80 Crates & TNT Barrels on the 40px Grid
                    { type: "crate", name: "Bunker Ammo Crate", x: -160, y: 80, size: 80, color: "#d9a05b", texture: "crate_plank" },
                    { type: "crate", name: "Bunker Ammo Crate", x: 160, y: 80, size: 80, color: "#d9a05b", texture: "crate_plank" },
                    { type: "crate", name: "TNT Barrel", x: -1160, y: 480, size: 80, explosive: true },
                    { type: "crate", name: "TNT Barrel", x: 1160, y: 480, size: 80, explosive: true },
                    { type: "crate", name: "Sky Crate", x: -120, y: 640, size: 80, color: "#d9a05b", texture: "crate_plank" },
                    { type: "crate", name: "Sky Crate", x: 120, y: 640, size: 80, color: "#d9a05b", texture: "crate_plank" }
                ]
            },

            "bounce_chaos": {
                name: "4. Neon Arcade Pinball",
                spawnP1: [0, 320],
                spawnP2: [80, 320],
                wavesEnabled: true,
                layout: [
                    // Floor (top = 40) & Neon Walls
                    { type: "box", name: "Main Floor", x: 0, y: -440, w: 3360, h: 960, color: "#10002b", texture: "neon_grid" },
                    { type: "box", name: "Left Wall", x: -1620, y: 1000, w: 120, h: 1920, color: "#10002b", texture: "neon_grid" },
                    { type: "box", name: "Right Wall", x: 1620, y: 1000, w: 120, h: 1920, color: "#10002b", texture: "neon_grid" },

                    // Giant Bowl Ramps on Left & Right (bottom=40, top=360, flush against walls at ±1560)
                    { type: "ramp", name: "Left Bowl Ramp", x: -1240, y: 200, w: 640, h: 320, dir: "left", color: "#5a189a", texture: "neon_grid" },
                    { type: "ramp", name: "Right Bowl Ramp", x: 1240, y: 200, w: 640, h: 320, dir: "right", color: "#5a189a", texture: "neon_grid" },

                    // Row of 4 Mega Bounce Pads along Floor (bottom=40, top=80)
                    { type: "bumper", name: "Mega Pad 1", x: -640, y: 60, w: 160, h: 40, bounce: 26, color: "#f72585" },
                    { type: "bumper", name: "Mega Pad 2", x: -240, y: 60, w: 160, h: 40, bounce: 25, color: "#f72585" },
                    { type: "bumper", name: "Mega Pad 3", x: 240, y: 60, w: 160, h: 40, bounce: 25, color: "#f72585" },
                    { type: "bumper", name: "Mega Pad 4", x: 640, y: 60, w: 160, h: 40, bounce: 26, color: "#f72585" },

                    // Floating Pinball Islands (40px high, aligned on 40px Grid)
                    { type: "box", name: "Center Island", x: 0, y: 220, w: 320, h: 40, color: "#7209b7", texture: "neon_grid" },
                    { type: "box", name: "Left High Island", x: -560, y: 460, w: 400, h: 40, color: "#3a0ca3", texture: "neon_grid" },
                    { type: "box", name: "Right High Island", x: 560, y: 460, w: 400, h: 40, color: "#3a0ca3", texture: "neon_grid" },
                    { type: "bumper", name: "Top Pinball Bumper", x: 0, y: 580, w: 240, h: 40, bounce: 26, color: "#4cc9f0" },

                    // 80x80 Bouncy Cubes & TNT Barrels on the 40px Grid
                    { type: "crate", name: "Bouncy Cube", x: -640, y: 280, size: 80, color: "#00f5d4", bounciness: -0.92, texture: "neon_grid" },
                    { type: "crate", name: "Bouncy Cube", x: 640, y: 280, size: 80, color: "#00f5d4", bounciness: -0.92, texture: "neon_grid" },
                    { type: "crate", name: "Bouncy Cube", x: -240, y: 320, size: 80, color: "#00f5d4", bounciness: -0.92, texture: "neon_grid" },
                    { type: "crate", name: "Bouncy Cube", x: 240, y: 320, size: 80, color: "#00f5d4", bounciness: -0.92, texture: "neon_grid" },
                    { type: "crate", name: "TNT Barrel", x: -560, y: 520, size: 80, explosive: true },
                    { type: "crate", name: "TNT Barrel", x: 560, y: 520, size: 80, explosive: true }
                ]
            },

            "stress_test": {
                name: "5. ⚠️ Collision Stress Test Lab",
                spawnP1: [-1200, 120],
                spawnP2: [-1080, 120],
                wavesEnabled: false,
                layout: [
                    // Lab Floor (top = 40) & Walls (left = -1560, right = 1560)
                    { type: "box", name: "Lab Floor", x: 0, y: -440, w: 3360, h: 960, color: "#141b24", texture: "lab_metal" },
                    { type: "box", name: "Lab Left Wall", x: -1620, y: 1000, w: 120, h: 1920, color: "#141b24", texture: "lab_metal" },
                    { type: "box", name: "Lab Right Wall", x: 1620, y: 1000, w: 120, h: 1920, color: "#141b24", texture: "lab_metal" },

                    // TEST ZONE 1 (Left): Low-Ceiling Ramp Pinch Test (100% Grid Aligned)
                    { type: "ramp", name: "Pinch Test Ramp", x: -880, y: 120, w: 320, h: 160, dir: "right", color: "#2a9d8f", texture: "lab_metal" },
                    { type: "box", name: "Low Pinch Ceiling", x: -800, y: 260, w: 320, h: 40, color: "#e76f51", texture: "brick" },

                    // TEST ZONE 2 (Center): V-Funnel Pileup Crusher (Meets at (0, 40), rims flush at (±400, 280))
                    { type: "ramp", name: "Funnel Left Ramp (\\)", x: -200, y: 160, w: 400, h: 240, dir: "left", color: "#3d5a80", texture: "castle_stone" },
                    { type: "ramp", name: "Funnel Right Ramp (/)", x: 200, y: 160, w: 400, h: 240, dir: "right", color: "#3d5a80", texture: "castle_stone" },
                    { type: "box", name: "Funnel Left Rim", x: -480, y: 260, w: 160, h: 40, color: "#293241", texture: "question_gold" },
                    { type: "box", name: "Funnel Right Rim", x: 480, y: 260, w: 160, h: 40, color: "#293241", texture: "question_gold" },

                    // TEST ZONE 3 (Right): Rapid Sawtooth Ramps (/\/\/\, each 160x80 on 40px Grid)
                    { type: "ramp", name: "Sawtooth 1 /", x: 680, y: 80, w: 160, h: 80, dir: "right", color: "#457b9d", texture: "dojo_wood" },
                    { type: "ramp", name: "Sawtooth 2 \\", x: 840, y: 80, w: 160, h: 80, dir: "left", color: "#457b9d", texture: "dojo_wood" },
                    { type: "ramp", name: "Sawtooth 3 /", x: 1000, y: 80, w: 160, h: 80, dir: "right", color: "#457b9d", texture: "dojo_wood" },
                    { type: "ramp", name: "Sawtooth 4 \\", x: 1160, y: 80, w: 160, h: 80, dir: "left", color: "#457b9d", texture: "dojo_wood" },

                    // High-Speed Bouncer Cage (Far Right, x = 1240..1560, y = 40..560)
                    { type: "box", name: "Cage Left Divider", x: 1260, y: 280, w: 40, h: 480, color: "#2b2d42", texture: "lab_metal" },
                    { type: "bumper", name: "Cage Bottom Bouncer", x: 1420, y: 60, w: 280, h: 40, bounce: 28, color: "#ff2e63" },
                    { type: "box", name: "Cage Ceiling", x: 1400, y: 540, w: 320, h: 40, color: "#e63946", texture: "brick" }
                ]
            },

            "infinite_frontier": {
                name: "6. 🌲 Oregon Trail: Infinite Frontier [Procedural]",
                spawnP1: [80, 120],
                spawnP2: [200, 120],
                wavesEnabled: true,
                isProcedural: true,
                layout: []
            }
        };

        // Every built-in structure is built at STRUCT_SCALE (2x): scale layouts about the ground line (x = 0, y = 40)
        for (var lk in this.builtInLevels) {
            if (lk === "infinite_frontier") continue;
            this.scaleLevel(this.builtInLevels[lk], STRUCT_SCALE);
        }

        this.customLevels = {};
        try {
            var saved = localStorage.getItem("timsZombieGameCustomLevels");
            if (saved) {
                this.customLevels = JSON.parse(saved) || {};
            }
        } catch (e) {}
    }

    static scaleLevel(lvl, S) {
        if (!lvl || lvl._scaled) return;
        lvl._scaled = true;
        var gy = 40;
        var sy = function(y) { return gy + (y - gy) * S; };
        if (lvl.spawnP1) lvl.spawnP1 = [lvl.spawnP1[0] * S, sy(lvl.spawnP1[1])];
        if (lvl.spawnP2) lvl.spawnP2 = [lvl.spawnP2[0] * S, sy(lvl.spawnP2[1])];
        var items = lvl.layout || [];
        for (let i = 0; i < items.length; i++) {
            var it = items[i];
            it.x *= S;
            it.y = sy(it.y);
            if (it.type != "crate") {
                it.w *= S;
                it.h *= S;
            }
        }
    }

    static getAllLevels() {
        var result = {};
        for (var k in this.builtInLevels) {
            result[k] = this.builtInLevels[k];
        }
        for (var ck in this.customLevels) {
            result[ck] = this.customLevels[ck];
        }
        return result;
    }

    static getCurrentLevel() {
        var all = this.getAllLevels();
        return all[this.currentLevelKey] || this.builtInLevels["classic_arena"];
    }

    static selectLevel(key) {
        var all = this.getAllLevels();
        if (!all[key]) return;
        this.currentLevelKey = key;
        var lvl = all[key];

        if (typeof SummonManager !== "undefined") {
            SummonManager.pauseWaves = !lvl.wavesEnabled;
            var btn = document.getElementById("sp-wave-btn");
            if (btn) {
                btn.textContent = SummonManager.pauseWaves ? "▶ Resume Waves" : "⏸ Waves";
                btn.style.background = SummonManager.pauseWaves ? "#2a9d8f" : "#264653";
            }
            SummonManager.refreshLevelDropdown();
        }

        resetGame();

        if (key == "stress_test") {
            this.populateStressTestObjects();
        }
    }

    static populateStressTestObjects() {
        var idx = 0;
        for (let row = 0; row < 5; row++) {
            for (let col = -2; col <= 2; col++) {
                var cx = col * 80;
                var cy = 360 + row * 80;
                if (idx % 4 == 0) {
                    Object.addCrate(cx, cy, 80, "#00f5d4", { bounciness: -0.9, name: "Stress Cube", texture: "neon_grid" });
                } else if (idx % 7 == 0) {
                    Object.addCrate(cx, cy, 80, "#e84545", { explosive: true, name: "TNT Barrel" });
                } else {
                    Object.addCrate(cx, cy, 80, "#d9a05b", { name: "Stress Crate", texture: "crate_plank" });
                }
                idx++;
            }
        }

        for (let i = 0; i < 4; i++) {
            var cube = Object.addCrate((1360 + (i % 2) * 80) * STRUCT_SCALE, 160 + i * 80, 80, "#ffbe0b", {
                bounciness: -0.95,
                name: "Cage Cube",
                texture: "question_gold"
            });
            cube.xspeed = (i % 2 == 0 ? 12 : -12);
            cube.yspeed = 15;
        }

        rebuildAllObjects();
        if (typeof SummonManager !== "undefined" && SummonManager.isOpen) {
            SummonManager.refreshObjectList();
        }
        Components.addFloatingText("STRESS TEST LAB LOADED!", -1100, 360, "#00f5d4", 22);
    }

    static rainStressCrates(count = 18) {
        var centerX = redGuy ? redGuy.x : 0;
        for (let i = 0; i < count; i++) {
            var rx = Math.round((centerX + (Math.random() - 0.5) * 720) / 40) * 40;
            var ry = Math.round((640 + Math.random() * 360) / 40) * 40;
            var isBouncy = Math.random() < 0.45;
            var c = Object.addCrate(
                rx,
                ry,
                80,
                isBouncy ? "#00f5d4" : "#d9a05b",
                {
                    bounciness: isBouncy ? -0.92 : -0.35,
                    name: isBouncy ? "Bouncy Cube" : "Stress Crate",
                    texture: isBouncy ? "neon_grid" : "crate_plank"
                }
            );
            c.xspeed = (Math.random() - 0.5) * 14;
            c.yspeed = -Math.random() * 8;
        }
        rebuildAllObjects();
        if (typeof SummonManager !== "undefined" && SummonManager.isOpen) {
            SummonManager.refreshObjectList();
        }
        Components.addFloatingText("RAINING " + count + " BLOCKS!", centerX, 450, "#ffdd44", 22);
    }

    static joltAllObjects() {
        var list = [].concat(movingObjects, zombies);
        for (let i = 0; i < list.length; i++) {
            var o = list[i];
            if (o.dead) continue;
            o.xspeed += (Math.random() - 0.5) * 28;
            o.yspeed += 10 + Math.random() * 18;
        }
        screenShake = 12;
        Components.addFloatingText("CHAOS IMPULSE!", cameraTargetX, cameraTargetY + 120, "#ff2e63", 24);
    }

    static serializeCurrentMap() {
        var layout = [];
        for (let i = 0; i < staticObjects.length; i++) {
            var s = staticObjects[i];
            if (s.dead || s.isInfiniteBase) continue;
            if (s.isRamp) {
                layout.push({
                    type: "ramp",
                    name: s.name,
                    x: Math.round(s.x),
                    y: Math.round(s.y),
                    w: Math.round(s.w),
                    h: Math.round(s.h),
                    dir: s.rampDir,
                    color: s.color,
                    texture: s.texture
                });
            } else if (s.isBumper) {
                layout.push({
                    type: "bumper",
                    name: s.name,
                    x: Math.round(s.x),
                    y: Math.round(s.y),
                    w: Math.round(s.w),
                    h: Math.round(s.h),
                    bounce: s.bounceForce,
                    color: s.color,
                    texture: s.texture
                });
            } else {
                layout.push({
                    type: "box",
                    name: s.name,
                    x: Math.round(s.x),
                    y: Math.round(s.y),
                    w: Math.round(s.w),
                    h: Math.round(s.h),
                    color: s.color,
                    texture: s.texture
                });
            }
        }
        for (let i = 0; i < movingObjects.length; i++) {
            var m = movingObjects[i];
            if (m.dead) continue;
            layout.push({
                type: "crate",
                name: m.name,
                x: Math.round(m.x),
                y: Math.round(m.y),
                size: Math.round(m.w),
                w: Math.round(m.w),
                h: Math.round(m.h),
                color: m.color,
                explosive: !!m.explosive,
                bounciness: m.bounciness,
                texture: m.texture
            });
        }
        return layout;
    }

    static saveCustomLevel(levelName) {
        var cleanName = (levelName || "").trim() || ("Custom Level " + (Object.keys(this.customLevels).length + 1));
        var key = "custom_" + cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        this.customLevels[key] = {
            name: "★ " + cleanName,
            spawnP1: redGuy ? [Math.round(redGuy.x), Math.round(redGuy.y)] : [-80, 120],
            spawnP2: blueGuy ? [Math.round(blueGuy.x), Math.round(blueGuy.y)] : [80, 120],
            wavesEnabled: !(typeof SummonManager !== "undefined" && SummonManager.pauseWaves),
            layout: this.serializeCurrentMap()
        };
        try {
            localStorage.setItem("timsZombieGameCustomLevels", JSON.stringify(this.customLevels));
        } catch (e) {}
        this.currentLevelKey = key;
        if (typeof SummonManager !== "undefined") {
            SummonManager.refreshLevelDropdown();
        }
        Components.addFloatingText("SAVED LEVEL: " + cleanName, cameraTargetX, cameraTargetY + 100, "#55ff88", 22);
    }

    static createNewBlankLevel() {
        staticObjects = [];
        movingObjects = [];
        zombies = [];
        lazers = [];
        powerUps = [];
        Object.loadMap([
            { type: "box", name: "Main Floor", x: 0, y: -440, w: 3360, h: 960, color: "#7f4f24", texture: "grass_dirt" },
            { type: "box", name: "Left Wall", x: -1620, y: 1000, w: 120, h: 1920, color: "#4a5568", texture: "castle_stone" },
            { type: "box", name: "Right Wall", x: 1620, y: 1000, w: 120, h: 1920, color: "#4a5568", texture: "castle_stone" }
        ]);
        if (redGuy) {
            redGuy.x = 0;
            redGuy.y = 120;
            redGuy.xspeed = 0;
            redGuy.yspeed = 0;
        }
        if (typeof SummonManager !== "undefined") {
            if (!SummonManager.pauseWaves) SummonManager.toggleWavePause();
            SummonManager.selectObject(null);
            SummonManager.refreshObjectList();
        }
        rebuildAllObjects();
        if (typeof Pathfinder !== "undefined") Pathfinder.rebuildGraph();
        Components.addFloatingText("BLANK 40px GRID CANVAS READY!", 0, 220, "#ffdd44", 22);
    }
}

// ============================================================================
// RECURSIVE PROCEDURAL SIDE-SCROLLER GENERATOR ("Oregon Trail: Infinite Frontier")
// Generates 40px-grid-snapped Fields, Trees, Rivers, Houses, Mountains, Castles & Dungeons!
// ============================================================================
class WorldGenerator {

    static init() {
        // Chunks are authored on a 2240px design grid (56 tiles of 40px / 70 tiles of 32px) and BUILT at STRUCT_SCALE x
        // so every castle, house, bridge and cavern is twice as large as before.
        this.designWidth = 2240;
        this.chunkWidth = this.designWidth * STRUCT_SCALE;
        this.buildOriginX = 0;
        this.buildOriginY = 40;
        this.generatedChunks = {};
        this.chunkBoundaryY = { 0: 40 }; // Left edge surface Y of chunk 0 starts at y = 40
        this.currentBiomeTitle = "🌾 Frontier Trailhead";
        this.maxMilesTraveled = 0;
        this.activeBuildChunk = null;
        if (typeof worldOriginOffsetX !== "undefined") {
            worldOriginOffsetX = 0;
        }
    }

    static reset() {
        this.init();
    }

    // Shifts the entire world around the player in multiples of 1600px (divisible by 40px grid & 32px textures)
    // so coordinates always stay near 0 and performance stays 100% locked at 60 FPS forever!
    static shiftWorldOrigin(shiftX) {
        if (shiftX === 0) return;
        worldOriginOffsetX += shiftX;
        cameraTargetX -= shiftX;

        var shiftList = function(arr) {
            if (!arr) return;
            for (let i = 0; i < arr.length; i++) {
                if (arr[i] && typeof arr[i].x === "number") {
                    arr[i].x -= shiftX;
                }
            }
        };

        shiftList(characters);
        shiftList(zombies);
        shiftList(movingObjects);
        shiftList(lazers);
        shiftList(particles);
        shiftList(powerUps);
        shiftList(coinOrbs);
        shiftList(floatingTexts);
        shiftList(afterImages);
        if (typeof treasureChests !== "undefined") {
            shiftList(treasureChests);
        }

        for (let i = 0; i < staticObjects.length; i++) {
            var s = staticObjects[i];
            if (s && !s.isInfiniteBase) {
                s.x -= shiftX;
            }
        }
        if (typeof BackgroundMosaic !== "undefined") {
            if (BackgroundMosaic.bgProps) shiftList(BackgroundMosaic.bgProps);
            if (BackgroundMosaic.bgWalls) shiftList(BackgroundMosaic.bgWalls);
        }
        for (let z = 0; z < zombies.length; z++) {
            var zom = zombies[z];
            if (zom && zom.navPath) {
                for (let p = 0; p < zom.navPath.length; p++) {
                    zom.navPath[p].x -= shiftX;
                }
            }
        }
    }

    // Unloads chunks far behind/ahead of the player so object count stays tiny & lag-free forever!
    static unloadDistantChunks(centerChunk) {
        var minKeep = centerChunk - 2;
        var maxKeep = centerChunk + 2;
        var removedAny = false;

        for (var k in this.generatedChunks) {
            var cIdx = parseInt(k, 10);
            if (cIdx < minKeep || cIdx > maxKeep) {
                delete this.generatedChunks[k];
                removedAny = true;
            }
        }
        if (!removedAny) return false;

        for (let i = staticObjects.length - 1; i >= 0; i--) {
            var s = staticObjects[i];
            if (s.chunkIdx !== undefined && s.chunkIdx !== null) {
                if (s.chunkIdx < minKeep || s.chunkIdx > maxKeep) {
                    staticObjects.splice(i, 1);
                }
            }
        }
        for (let i = movingObjects.length - 1; i >= 0; i--) {
            var m = movingObjects[i];
            if (m.heldBy) continue;
            if (m.chunkIdx !== undefined && m.chunkIdx !== null) {
                if (m.chunkIdx < minKeep || m.chunkIdx > maxKeep) {
                    movingObjects.splice(i, 1);
                }
            }
        }
        if (typeof treasureChests !== "undefined") {
            for (let i = treasureChests.length - 1; i >= 0; i--) {
                var ch = treasureChests[i];
                if (ch.chunkIdx !== undefined && ch.chunkIdx !== null) {
                    if (ch.chunkIdx < minKeep || ch.chunkIdx > maxKeep) {
                        treasureChests.splice(i, 1);
                    }
                }
            }
        }
        if (typeof BackgroundMosaic !== "undefined") {
            if (BackgroundMosaic.bgProps) {
                for (let i = BackgroundMosaic.bgProps.length - 1; i >= 0; i--) {
                    var bp = BackgroundMosaic.bgProps[i];
                    if (bp.chunkIdx !== undefined && bp.chunkIdx !== null) {
                        if (bp.chunkIdx < minKeep || bp.chunkIdx > maxKeep) {
                            BackgroundMosaic.bgProps.splice(i, 1);
                        }
                    }
                }
            }
            if (BackgroundMosaic.bgWalls) {
                for (let i = BackgroundMosaic.bgWalls.length - 1; i >= 0; i--) {
                    var bw = BackgroundMosaic.bgWalls[i];
                    if (bw.chunkIdx !== undefined && bw.chunkIdx !== null) {
                        if (bw.chunkIdx < minKeep || bw.chunkIdx > maxKeep) {
                            BackgroundMosaic.bgWalls.splice(i, 1);
                        }
                    }
                }
            }
        }
        return true;
    }

    // Grid-exact builder helpers: (left, bottom, w, h) are all multiples of 40px!
    // Design-space -> world-space transform (scale about the current chunk's left edge & ground line)
    static tx(x) { return this.buildOriginX + (x - this.buildOriginX) * STRUCT_SCALE; }
    static ty(y) { return this.buildOriginY + (y - this.buildOriginY) * STRUCT_SCALE; }

    static addGridBox(left, bottom, w, h, color, opts = {}) {
        left = this.tx(left); bottom = this.ty(bottom); w *= STRUCT_SCALE; h *= STRUCT_SCALE;
        var obj = Object.addBox(left + w / 2, bottom + h / 2, w, h, color, opts);
        obj.chunkIdx = this.activeBuildChunk;
        return obj;
    }

    static addGridRamp(left, bottom, w, h, dir, color, opts = {}) {
        left = this.tx(left); bottom = this.ty(bottom); w *= STRUCT_SCALE; h *= STRUCT_SCALE;
        var obj = Object.addRamp(left + w / 2, bottom + h / 2, w, h, dir, color, opts);
        obj.chunkIdx = this.activeBuildChunk;
        return obj;
    }

    static addGridBumper(left, bottom, w, h, bounce, color, opts = {}) {
        left = this.tx(left); bottom = this.ty(bottom); w *= STRUCT_SCALE; h *= STRUCT_SCALE;
        var obj = Object.addBumper(left + w / 2, bottom + h / 2, w, h, bounce, color, opts);
        obj.chunkIdx = this.activeBuildChunk;
        return obj;
    }

    static addGridCrate(left, bottom, size, color, opts = {}) {
        left = this.tx(left); bottom = this.ty(bottom);
        var obj = Object.addCrate(left + size / 2, bottom + size / 2, size, color, opts);
        obj.chunkIdx = this.activeBuildChunk;
        return obj;
    }

    static addInteriorWall(left, bottom, w, h, style = "castle") {
        left = this.tx(left); bottom = this.ty(bottom); w *= STRUCT_SCALE; h *= STRUCT_SCALE;
        if (typeof BackgroundMosaic !== "undefined") {
            BackgroundMosaic.addInteriorBackWall(left, bottom, w, h, style, this.activeBuildChunk);
        }
    }

    static addChest(x, bottomY) {
        if (typeof Components !== "undefined" && Components.spawnChest) {
            Components.spawnChest(this.tx(x), this.ty(bottomY), "Royal Treasure Chest", this.activeBuildChunk);
        }
    }

    // Spawns biome-specific enemy guardians inside castles, caves, bridges & mountains
    static spawnChunkEnemy(power, x, y) {
        if (zombies.length >= 16) return;
        x = this.tx(x);
        y = this.ty(y);
        var specs = {
            "BAT":       { color: "#6c5ce7", size: 56, hp: 34 + level * 6,  spd: speed * 0.72 },
            "SLIME":     { color: "#00f5d4", size: 76, hp: 62 + level * 10, spd: speed * 0.56 },
            "ARCHER":    { color: "#d4a373", size: 78, hp: 52 + level * 8,  spd: speed * 0.58 },
            "KNIGHT":    { color: "#7f8c8d", size: 96, hp: 120 + level * 18, spd: speed * 0.52 },
            "MAGE":      { color: "#7209b7", size: 80, hp: 64 + level * 10, spd: speed * 0.54 },
            "BOSS_KING": { color: "#9b2226", size: 136, hp: 260 + level * 35, spd: speed * 0.46 }
        };
        var cfg = specs[power] || { color: "#2d6e32", size: 80, hp: 55, spd: speed * 0.6 };
        var zBox = Math.makeHitbox(cfg.size, cfg.size);
        var z = new Character(
            "Enemy_" + power,
            zBox,
            zBox,
            cfg.color,
            [x, y],
            maxspeed * 0.85,
            slower,
            gravity,
            bounciness,
            cfg.spd,
            "ZOMBIE",
            cfg.hp,
            "NONE",
            true,
            power
        );
        zombies.push(z);
    }

    // Deterministic-yet-varied pseudo-random helper per chunk & step
    static rand(seed) {
        var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
    }

    static getLeftEdgeY(chunkIdx) {
        if (this.chunkBoundaryY[chunkIdx] !== undefined) {
            return this.chunkBoundaryY[chunkIdx];
        }
        return 40;
    }

    static setRightEdgeY(chunkIdx, yVal) {
        this.chunkBoundaryY[chunkIdx + 1] = yVal;
    }

    static update(focusX) {
        if (typeof LevelManager === "undefined" || LevelManager.currentLevelKey !== "infinite_frontier") return;
        if (!this.generatedChunks) this.init();

        // 1. Floating Origin: Move the world around the player whenever player drifts > 2400px from local origin 0!
        var playerRefX = redGuy ? redGuy.x : focusX;
        if (Math.abs(playerRefX) >= this.chunkWidth) {
            var shiftChunks = Math.trunc(playerRefX / this.chunkWidth);
            this.shiftWorldOrigin(shiftChunks * this.chunkWidth);
            focusX = cameraTargetX;
        }

        var trueWorldX = (redGuy ? redGuy.x : focusX) + (typeof worldOriginOffsetX !== "undefined" ? worldOriginOffsetX : 0);
        var centerChunk = Math.floor(trueWorldX / this.chunkWidth);

        // 2. Unload distant chunks outside [centerChunk - 2, centerChunk + 2]
        var unloadedAny = this.unloadDistantChunks(centerChunk);

        // 3. Stream in nearby chunks within [centerChunk - 1, centerChunk + 1]
        var addedAny = false;
        for (let c = centerChunk - 1; c <= centerChunk + 1; c++) {
            if (!this.generatedChunks[c]) {
                this.generateChunk(c);
                addedAny = true;
            }
        }

        // Remove enemies that fell way out of range so active enemy slots stay fresh
        var localCenter = redGuy ? redGuy.x : focusX;
        for (let z = zombies.length - 1; z >= 0; z--) {
            var zom = zombies[z];
            if (!zom.dead && Math.abs(zom.x - localCenter) > 5600) {
                zombies.splice(z, 1);
            }
        }

        // Update current biome HUD title & Oregon Trail miles milestone
        if (this.generatedChunks[centerChunk]) {
            this.currentBiomeTitle = this.generatedChunks[centerChunk].title;
        }
        var miles = Math.floor(Math.abs(trueWorldX) / 240);
        if (miles > this.maxMilesTraveled) {
            if (miles % 15 === 0 && miles > 0 && redGuy) {
                coins += 5;
                heroXP += 35;
                Components.addFloatingText("🗺️ TRAIL MILESTONE: " + miles + " MILES! (+5 🪙, +35 XP)", redGuy.x, redGuy.y + 95, "#ffdd00", 20);
            }
            this.maxMilesTraveled = miles;
        }

        if (addedAny || unloadedAny) {
            rebuildAllObjects();
            if (typeof Pathfinder !== "undefined") {
                Pathfinder.rebuildGraph(true);
            }
            if (typeof SummonManager !== "undefined" && SummonManager.isOpen) {
                SummonManager.refreshObjectList();
            }
        }
    }

    // Adds a non-colliding Background Mosaic Tree so gameplay movement & shooting are 100% unobstructed!
    static buildTree(trunkLeftX, groundTopY, trunkHeight = 160, hasTreasure = false, style = "oak") {
        if (typeof BackgroundMosaic !== "undefined") {
            BackgroundMosaic.addBackgroundTree(this.tx(trunkLeftX + 20), this.ty(groundTopY), trunkHeight * STRUCT_SCALE, style, this.activeBuildChunk, STRUCT_SCALE);
        }
        if (hasTreasure && typeof Components !== "undefined") {
            Components.spawnCoins(this.tx(trunkLeftX + 20), this.ty(groundTopY) + 80, 2);
        }
    }

    static generateChunk(chunkIdx) {
        this.activeBuildChunk = chunkIdx;
        var originOff = (typeof worldOriginOffsetX !== "undefined") ? worldOriginOffsetX : 0;
        var leftX = chunkIdx * this.chunkWidth - originOff;
        var rightX = leftX + this.designWidth;
        var startY = this.getLeftEdgeY(chunkIdx);
        this.buildOriginX = leftX;
        this.buildOriginY = startY;

        // Starting Chunk 0: Safe Oregon Trail Outpost & Frontier Lodge
        if (chunkIdx === 0) {
            this.generatedChunks[chunkIdx] = { type: "OUTPOST", title: "🏕️ Independence Frontier Outpost" };
            this.setRightEdgeY(chunkIdx, 40);
            this.addGridBox(leftX, -440, this.designWidth, 480, "#588157", { name: "Trailhead Ground", texture: "grass_dirt" });
            this.buildTree(leftX + 160, 40, 180, false, "oak");
            this.buildTownBuilding(leftX + 480, 40, 640, 3, true);
            this.buildTree(leftX + 1320, 40, 170, false, "pine");
            this.buildTownBuilding(leftX + 1480, 40, 560, 2, false);
            this.addGridCrate(leftX + 280, 40, 80, "#d9a05b", { name: "Wagon Supply Crate", texture: "crate_plank" });
            this.activeBuildChunk = null;
            return;
        }

        // Cycle cleanly through distinct, non-repetitive macro-biomes (Chunk 1 starts with GRAND_CASTLE so you can explore the 12-story Mega-Citadel immediately!)
        var biomes = ["GRAND_CASTLE", "BRIDGE_GORGE", "FRONTIER_TOWN", "MOUNTAIN_PASS", "DEEP_CAVERN"];
        var idx = (Math.abs(chunkIdx) - 1 + (chunkIdx < 0 ? 1 : 0)) % biomes.length;
        var pick = biomes[idx];

        var endY = startY;
        this.setRightEdgeY(chunkIdx, endY);

        // ====================================================================
        // 1. 🌉 HIGH SUSPENSION BRIDGE & UNDER-BRIDGE SMUGGLER GORGE
        //    You can run straight across the high bridge (flush ramps!) OR drop
        //    down and walk completely UNDERNEATH the bridge into the cavern!
        // ====================================================================
        if (pick === "BRIDGE_GORGE") {
            this.generatedChunks[chunkIdx] = { type: "BRIDGE_GORGE", title: "🌉 Whispering Gorge & Under-Bridge Cavern" };
            var gorgeFloorY = startY - 320;
            var bridgeTopY = startY + 80;

            // West & East Cliff Banks (320px wide each, top = startY)
            this.addGridBox(leftX, startY - 560, 320, 560, "#588157", { name: "West Gorge Cliff", texture: "grass_dirt" });
            this.addGridBox(rightX - 320, startY - 560, 320, 560, "#588157", { name: "East Gorge Cliff", texture: "grass_dirt" });

            // HIGH OVERHEAD BRIDGE DECK (top = bridgeTopY = startY + 80, bottom = startY + 40 — 100% flush with approach ramps!)
            // And leaving open 240px chasm entry shafts at x = leftX+320..560 and rightX-560..rightX-320 so you can drop or walk right UNDER the bridge!
            this.addGridRamp(leftX + 160, startY, 160, 80, "right", "#9c6644", { name: "West Bridge Approach /", texture: "dojo_wood" });
            this.addGridBox(leftX + 320, bridgeTopY - 40, 1600, 40, "#9c6644", { name: "High Gorge Bridge Deck", texture: "dojo_wood" });
            this.addGridRamp(rightX - 320, startY, 160, 80, "left", "#9c6644", { name: "East Bridge Approach \\", texture: "dojo_wood" });

            // Recessed Under-Bridge Cavern Backdrop
            this.addInteriorWall(leftX + 320, gorgeFloorY, 1600, 360, "cavern");

            // Stepped Canyon Ledges & Flush Ramps leading down UNDERNEATH the bridge from both sides!
            this.addGridBox(leftX + 320, startY - 120, 200, 40, "#4a5568", { name: "West Under-Bridge Ledge 1", texture: "castle_stone" });
            this.addGridBox(leftX + 520, startY - 220, 200, 40, "#4a5568", { name: "West Under-Bridge Ledge 2", texture: "castle_stone" });
            this.addGridBox(rightX - 520, startY - 120, 200, 40, "#4a5568", { name: "East Under-Bridge Ledge 1", texture: "castle_stone" });
            this.addGridBox(rightX - 720, startY - 220, 200, 40, "#4a5568", { name: "East Under-Bridge Ledge 2", texture: "castle_stone" });

            // Deep Gorge Floor & Underground River Pool (top = gorgeFloorY = startY - 320)
            this.addGridBox(leftX + 320, gorgeFloorY - 320, 1600, 320, "#3d5a80", { name: "Gorge Riverbed", texture: "castle_stone" });
            // Smuggler's Under-Bridge Raised Dock with flush stairs on both sides!
            var dockTopY = gorgeFloorY + 80;
            this.addGridRamp(leftX + 760, gorgeFloorY, 160, 80, "right", "#6c3c28", { name: "Smuggler Dock West Stairs /", texture: "dojo_wood" });
            this.addGridBox(leftX + 920, dockTopY - 40, 400, 40, "#6c3c28", { name: "Under-Bridge Smuggler Dock", texture: "dojo_wood" });
            this.addGridRamp(leftX + 1320, gorgeFloorY, 160, 80, "left", "#6c3c28", { name: "Smuggler Dock East Stairs \\", texture: "dojo_wood" });

            this.addGridBumper(leftX + 360, gorgeFloorY, 160, 40, 28, "#ff2e63", { name: "West Gorge Updraft Pad" });
            this.addGridBumper(rightX - 520, gorgeFloorY, 160, 40, 28, "#ff2e63", { name: "East Gorge Updraft Pad" });

            // Treasure Chest & Enemies hidden UNDER the bridge!
            this.addChest(leftX + 1120, dockTopY);
            this.spawnChunkEnemy("BAT", leftX + 800, startY - 20);
            this.spawnChunkEnemy("BAT", leftX + 1440, startY - 20);
            this.spawnChunkEnemy("SLIME", leftX + 640, gorgeFloorY + 60);
            this.spawnChunkEnemy("ARCHER", leftX + 1120, bridgeTopY + 60);

            this.buildTree(leftX + 60, startY, 170, false, "pine");
            this.buildTree(rightX - 100, startY, 170, false, "pine");
        }

        // ====================================================================
        // 2. 🏰 COLOSSAL 12-STORY + 2-CRYPT MEGA-CITADEL CASTLE (~2 Screens Wide, 6+ Screens Tall!)
        //    - Width: 2080px wide (cLeft to cRight)
        //    - Height: 2,480px tall across 15 playable vertical tiers:
        //      * Sub-Level B2 (startY - 320): Deep Abyssal Catacombs & Vault
        //      * Sub-Level B1 (startY - 160): Royal Crypt & Dungeon
        //      * Levels 1..12 (startY to startY + 1760): 12 Full Castle Stories
        //        with 100% flush switchback grand staircases on both wings,
        //        express bounce-lift shafts, open balcony windows, and varied halls!
        //      * Level 13 (startY + 1920..2080): Celestial Observatory Spire & Crown!
        // ====================================================================
        else if (pick === "GRAND_CASTLE") {
            this.generatedChunks[chunkIdx] = { type: "GRAND_CASTLE", title: "🏰 Colossal 12-Story Dreadkeep Mega-Citadel" };
            var cLeft = leftX + 80;
            var cRight = rightX - 80;
            var cWidth = cRight - cLeft; // 2080px wide (~2 full screens wide!)
            var storyH = 160;
            var numStories = 12;
            var topRoofY = startY + numStories * storyH; // startY + 1920!
            var cryptB1Y = startY - 160;
            var cryptB2Y = startY - 320;

            // Recessed Torchlit Castle Interior Backdrop spanning from Sub-Crypt B2 (-320) all the way to Floor 12 (+1920) = 2,240px tall!
            this.addInteriorWall(cLeft, cryptB2Y, cWidth, topRoofY - cryptB2Y, "castle");

            // ----------------------------------------------------------------
            // UNDERGROUND CRYPT LEVELS B1 (startY - 160) & B2 (startY - 320)
            // ----------------------------------------------------------------
            // Surface Ground with central 480px Grand Crypt Descent Opening (x = cLeft + 800 .. cLeft + 1280)
            this.addGridBox(leftX, startY - 40, cLeft - leftX + 800, 40, "#4a5568", { name: "Castle West Courtyard Floor", texture: "castle_stone" });
            this.addGridBox(cLeft + 1280, startY - 40, rightX - (cLeft + 1280), 40, "#4a5568", { name: "Castle East Courtyard Floor", texture: "castle_stone" });

            // Sub-Level B1: Royal Crypt (top = cryptB1Y = startY - 160, flush stairs up to Courtyard!)
            this.addGridRamp(cLeft + 560, cryptB1Y, 240, 160, "left", "#4a5568", { name: "Crypt B1 West Stairs \\", texture: "castle_stone" });
            this.addGridBox(cLeft + 160, cryptB1Y - 40, 720, 40, "#3d5a80", { name: "Crypt B1 West Hall", texture: "castle_stone" });
            this.addGridBox(cLeft + 1200, cryptB1Y - 40, 720, 40, "#3d5a80", { name: "Crypt B1 East Hall", texture: "castle_stone" });
            this.addGridRamp(cLeft + 1280, cryptB1Y, 240, 160, "right", "#4a5568", { name: "Crypt B1 East Stairs /", texture: "castle_stone" });

            // Sub-Level B2: Deep Abyssal Vault (top = cryptB2Y = startY - 320)
            this.addGridBox(cLeft + 80, cryptB2Y - 240, cWidth - 160, 240, "#1d3557", { name: "Crypt B2 Abyssal Vault Floor", texture: "castle_stone" });
            this.addGridRamp(cLeft + 640, cryptB2Y, 240, 160, "left", "#3d5a80", { name: "Abyssal Vault West Stairs \\", texture: "castle_stone" });
            this.addGridRamp(cLeft + 1200, cryptB2Y, 240, 160, "right", "#3d5a80", { name: "Abyssal Vault East Stairs /", texture: "castle_stone" });
            this.addGridBumper(cLeft + 200, cryptB2Y, 160, 40, 30, "#ff2e63", { name: "Crypt West Express Lift" });
            this.addGridBumper(cRight - 360, cryptB2Y, 160, 40, 30, "#ff2e63", { name: "Crypt East Express Lift" });
            this.addChest(cLeft + 1040, cryptB2Y);
            this.spawnChunkEnemy("MAGE", cLeft + 920, cryptB2Y + 60);
            this.spawnChunkEnemy("SLIME", cLeft + 1160, cryptB2Y + 60);

            // ----------------------------------------------------------------
            // EXTERIOR CASTLE TOWER WALLS (with open 160px Ground Gates & Balcony Windows on Floors 4, 7, 10!)
            // ----------------------------------------------------------------
            for (let s = 1; s < numStories; s++) {
                var wallBotY = startY + s * storyH;
                // Leave open panoramic castle window archways on Floors 4, 7, and 10!
                if (s === 4 || s === 7 || s === 10) continue;
                this.addGridBox(cLeft, wallBotY, 40, storyH, "#3d5a80", { name: "Castle West Outer Wall F" + (s + 1), texture: "castle_stone" });
                this.addGridBox(cRight - 40, wallBotY, 40, storyH, "#3d5a80", { name: "Castle East Outer Wall F" + (s + 1), texture: "castle_stone" });
            }

            // ----------------------------------------------------------------
            // 12 FULL ABOVE-GROUND STORIES (Levels 1..12, climbing to startY + 1920!)
            // Every single floor slab has bottom = floorTopY - 40, h = 40 so its top is 100% FLUSH with the 240x160 stairs!
            // West Wing: [cLeft + 40 .. cLeft + 680] (640px wide)
            // Central Grand Atrium / Hall: [cLeft + 680 .. cRight - 680] (720px wide)
            // East Wing: [cRight - 680 .. cRight - 40] (640px wide)
            // ----------------------------------------------------------------
            for (let lvl = 1; lvl <= numStories; lvl++) {
                var prevTopY = startY + (lvl - 1) * storyH;
                var floorTopY = startY + lvl * storyH;
                var slabBotY = floorTopY - 40;
                var oddFloor = (lvl % 2 === 1);

                // 1. WEST WING STAIRCASE & FULL PASS-THROUGH FLOOR (Separated stair bays so ramps never touch corner-to-corner!)
                this.addGridBox(cLeft + 40, slabBotY, 640, 40, "#4a5568", { name: "West Wing Floor " + (lvl + 1), texture: "castle_stone" });
                if (oddFloor) {
                    // Bay A (Left): Stairs climb RIGHT (/) from cLeft + 80..cLeft + 280
                    this.addGridRamp(cLeft + 80, prevTopY, 200, storyH, "right", "#6c3c28", { name: "West Stairs F" + lvl + " /", texture: "dojo_wood" });
                } else {
                    // Bay B (Right): Stairs climb LEFT (\) from cLeft + 560..cLeft + 360 (leaving 120px runway on the right and 80px gap in middle!)
                    this.addGridRamp(cLeft + 360, prevTopY, 200, storyH, "left", "#6c3c28", { name: "West Stairs F" + lvl + " \\", texture: "dojo_wood" });
                }

                // 2. EAST WING STAIRCASE & FULL PASS-THROUGH FLOOR (Mirrored separated stair bays!)
                this.addGridBox(cRight - 680, slabBotY, 640, 40, "#4a5568", { name: "East Wing Floor " + (lvl + 1), texture: "castle_stone" });
                if (oddFloor) {
                    // Bay B (Right): Stairs climb LEFT (\) from cRight - 80..cRight - 280
                    this.addGridRamp(cRight - 280, prevTopY, 200, storyH, "left", "#6c3c28", { name: "East Stairs F" + lvl + " \\", texture: "dojo_wood" });
                } else {
                    // Bay A (Left): Stairs climb RIGHT (/) from cRight - 560..cRight - 360
                    this.addGridRamp(cRight - 560, prevTopY, 200, storyH, "right", "#6c3c28", { name: "East Stairs F" + lvl + " /", texture: "dojo_wood" });
                }

                // 3. CENTRAL 720px GRAND HALLS, BRIDGES, LIBRARIES, BARRACKS & THRONE ROOM!
                var hallLeft = cLeft + 680;
                var hallW = 720;
                var hallMidX = hallLeft + hallW / 2;

                if (lvl === 2) {
                    // Floor 3 (+320): Grand Banquet Hall & Chandelier Floor
                    this.addGridBox(hallLeft, slabBotY, hallW, 40, "#b84a27", { name: "3F Grand Banquet Hall", texture: "brick" });
                    this.addChest(hallMidX, floorTopY);
                    this.spawnChunkEnemy("KNIGHT", hallMidX - 160, floorTopY + 60);
                } else if (lvl === 3) {
                    // Floor 4 (+480): Royal Armory & Twin Anvil Balconies (with central bounce lift!)
                    this.addGridBox(hallLeft, slabBotY, 240, 40, "#2b3a4a", { name: "4F West Armory Balcony", texture: "lab_metal" });
                    this.addGridBox(hallLeft + hallW - 240, slabBotY, 240, 40, "#2b3a4a", { name: "4F East Armory Balcony", texture: "lab_metal" });
                    this.addGridBumper(hallMidX - 80, slabBotY + 40, 160, 40, 28, "#ff2e63", { name: "4F Central Lift Pad" });
                    this.addGridCrate(hallLeft + 80, floorTopY, 80, "#e84545", { explosive: true, name: "Armory Powder Keg" });
                } else if (lvl === 4) {
                    // Floor 5 (+640): Arcane Library & Scriptorium
                    this.addGridBox(hallLeft + 80, slabBotY, hallW - 160, 40, "#6c3c28", { name: "5F Arcane Library Floor", texture: "dojo_wood" });
                    this.addChest(hallMidX, floorTopY);
                    this.spawnChunkEnemy("MAGE", hallMidX + 120, floorTopY + 60);
                } else if (lvl === 5) {
                    // Floor 6 (+800): Gargoyle Sky-Bridge
                    this.addGridBox(hallLeft + 160, slabBotY, hallW - 320, 40, "#f4a261", { name: "6F Golden Sky-Bridge", texture: "question_gold" });
                    this.spawnChunkEnemy("BAT", hallMidX - 180, floorTopY + 70);
                    this.spawnChunkEnemy("ARCHER", hallMidX, floorTopY + 60);
                } else if (lvl === 6) {
                    // Floor 7 (+960): Knights' Grand Training Hall
                    this.addGridBox(hallLeft, slabBotY, hallW, 40, "#6c3c28", { name: "7F Knights' Grand Barracks", texture: "dojo_wood" });
                    this.spawnChunkEnemy("KNIGHT", hallMidX - 140, floorTopY + 60);
                    this.spawnChunkEnemy("KNIGHT", hallMidX + 140, floorTopY + 60);
                    if (typeof spawnPowerUp === "function") spawnPowerUp(hallMidX, floorTopY + 60);
                } else if (lvl === 7) {
                    // Floor 8 (+1120): Alchemist's Conservatory
                    this.addGridBox(hallLeft + 120, slabBotY, hallW - 240, 40, "#2b3a4a", { name: "8F Alchemist Conservatory", texture: "lab_metal" });
                    this.addChest(hallMidX, floorTopY);
                    this.spawnChunkEnemy("SLIME", hallMidX - 100, floorTopY + 60);
                } else if (lvl === 8) {
                    // Floor 9 (+1280): Clockwork Belfry Balconies & Central Updraft
                    this.addGridBox(hallLeft, slabBotY, 220, 40, "#4a5568", { name: "9F West Belfry Ledge", texture: "castle_stone" });
                    this.addGridBox(hallLeft + hallW - 220, slabBotY, 220, 40, "#4a5568", { name: "9F East Belfry Ledge", texture: "castle_stone" });
                    this.addGridBumper(hallMidX - 80, slabBotY + 40, 160, 40, 28, "#ff2e63", { name: "9F Belfry Updraft" });
                    this.spawnChunkEnemy("BAT", hallMidX + 160, floorTopY + 70);
                } else if (lvl === 9) {
                    // Floor 10 (+1440): Royal War Council Chamber
                    this.addGridBox(hallLeft + 80, slabBotY, hallW - 160, 40, "#b84a27", { name: "10F Royal War Council", texture: "brick" });
                    this.addChest(hallMidX, floorTopY);
                    this.spawnChunkEnemy("MAGE", hallMidX - 140, floorTopY + 60);
                    this.spawnChunkEnemy("ARCHER", hallMidX + 140, floorTopY + 60);
                } else if (lvl === 10) {
                    // Floor 11 (+1600): EMPEROR'S SKY-THRONE ROOM (with Citadel Boss King!)
                    this.addGridBox(hallLeft, slabBotY, hallW, 40, "#b84a27", { name: "11F Emperor's Sky-Throne Room", texture: "brick" });
                    this.addChest(hallMidX - 180, floorTopY);
                    this.addChest(hallMidX + 180, floorTopY);
                    this.spawnChunkEnemy("BOSS_KING", hallMidX, floorTopY + 90);
                } else if (lvl === 12) {
                    // Floor 12 (+1920): High Battlement Roof Terrace & Spire Approach!
                    this.addGridBox(hallLeft, slabBotY, hallW, 40, "#3d5a80", { name: "12F High Citadel Roof Terrace", texture: "castle_stone" });
                }
            }

            // ----------------------------------------------------------------
            // LEVEL 13 (+2080): CELESTIAL OBSERVATORY SPIRE & SKY CROWN
            // ----------------------------------------------------------------
            var spireTopY = topRoofY + 160; // startY + 2080!
            var hallCenter = cLeft + cWidth / 2;
            this.addGridRamp(hallCenter - 440, topRoofY, 200, 160, "right", "#f4a261", { name: "Sky-Spire West Ascent /", texture: "question_gold" });
            this.addGridBox(hallCenter - 240, spireTopY - 40, 480, 40, "#f4a261", { name: "13F Celestial Spire Crown", texture: "question_gold" });
            this.addGridRamp(hallCenter + 240, topRoofY, 200, 160, "left", "#f4a261", { name: "Sky-Spire East Ascent \\", texture: "question_gold" });
            this.addChest(hallCenter, spireTopY);

            // Crenellations along the 12th-floor Battlement Roof
            for (let bx = cLeft; bx < cRight; bx += 160) {
                if (Math.abs(bx - hallCenter) > 480) {
                    this.addGridBox(bx, topRoofY, 40, 40, "#3d5a80", { name: "High Roof Battlement", texture: "castle_stone" });
                }
            }
        }

        // ====================================================================
        // 3. 🏘️ MULTI-STORY FRONTIER TOWN (3-Story Grand Hotel + 4-Story Clocktower)
        // ====================================================================
        else if (pick === "FRONTIER_TOWN") {
            this.generatedChunks[chunkIdx] = { type: "FRONTIER_TOWN", title: "🏘️ Gold Rush Frontier Town" };
            this.addGridBox(leftX, startY - 480, this.designWidth, 480, "#588157", { name: "Town Main Street", texture: "grass_dirt" });

            this.buildTree(leftX + 80, startY, 170, false, "oak");
            // West Building: 3-Story Frontier Grand Saloon & Hotel (width = 720px)
            this.buildTownBuilding(leftX + 200, startY, 720, 3, true);
            this.spawnChunkEnemy("KNIGHT", leftX + 560, startY + 60);

            // Town Plaza Well & Bounce Canopy between buildings
            this.addGridBumper(leftX + 1040, startY, 160, 40, 26, "#ff2e63", { name: "Town Market Canopy" });

            // East Building: 4-Story Clocktower Guildhall (width = 760px) with Attic Treasure Chest!
            this.buildTownBuilding(leftX + 1320, startY, 760, 4, true);
            this.spawnChunkEnemy("ARCHER", leftX + 1700, startY + 220);
            this.spawnChunkEnemy("MAGE", leftX + 1700, startY + 540);
        }

        // ====================================================================
        // 4. ⛰️ HOLLOWED MOUNTAIN TUNNEL PASS & HIGH ALPINE SWITCHBACKS
        //    Walk straight THROUGH the hollowed-out mountain cave tunnel at startY,
        //    drop into the subterranean crystal grotto below, OR climb OVER the
        //    high mountain peak switchbacks above (all 100% flush ramps)!
        // ====================================================================
        else if (pick === "MOUNTAIN_PASS") {
            this.generatedChunks[chunkIdx] = { type: "MOUNTAIN_PASS", title: "⛰️ Thunderhead Peak & Hollow Mountain Tunnel" };
            var grottoY = startY - 240;

            // Recessed Dark Rock Wall inside the Mountain Tunnel & Grotto
            this.addInteriorWall(leftX + 240, grottoY, 1760, 720, "cavern");

            // Ground Floor with central 320px Subterranean Grotto Entrance inside the mountain tunnel!
            this.addGridBox(leftX, startY - 120, 960, 120, "#4a5568", { name: "West Mountain Tunnel Floor", texture: "castle_stone" });
            this.addGridBox(leftX + 1280, startY - 120, 960, 120, "#4a5568", { name: "East Mountain Tunnel Floor", texture: "castle_stone" });

            // Subterranean Crystal Grotto inside the mountain root (top = grottoY = startY - 240)
            this.addGridBox(leftX + 240, grottoY - 280, 1760, 280, "#1d3557", { name: "Subterranean Grotto Floor", texture: "castle_stone" });
            this.addGridBumper(leftX + 1040, grottoY, 160, 40, 28, "#ff2e63", { name: "Geyser Updraft" });
            this.addChest(leftX + 720, grottoY);
            this.spawnChunkEnemy("SLIME", leftX + 840, grottoY + 60);
            this.spawnChunkEnemy("BAT", leftX + 1360, startY + 80);

            // Tier 1 Mountain Tunnel Ceiling / Ridge 1 (top = ridge1Y = startY + 160, slab bottom = ridge1Y - 40 = startY + 120!)
            var ridge1Y = startY + 160;
            this.addGridRamp(leftX + 80, startY, 240, 160, "right", "#4a5568", { name: "West Foothill Slope /", texture: "castle_stone" });
            this.addGridBox(leftX + 320, ridge1Y - 40, 1600, 40, "#4a5568", { name: "Mountain Tunnel Roof / Ridge 1", texture: "castle_stone" });
            this.addGridRamp(rightX - 320, startY, 240, 160, "left", "#4a5568", { name: "East Foothill Slope \\", texture: "castle_stone" });

            // Tier 2 Alpine Ridge (top = ridge2Y = startY + 320, slab bottom = ridge2Y - 40!)
            var ridge2Y = startY + 320;
            this.addGridRamp(leftX + 440, ridge1Y, 240, 160, "right", "#3d5a80", { name: "Alpine Ascent /", texture: "castle_stone" });
            this.addGridBox(leftX + 680, ridge2Y - 40, 880, 40, "#3d5a80", { name: "Mid Mountain Ridge", texture: "castle_stone" });
            this.addGridRamp(leftX + 1560, ridge1Y, 240, 160, "left", "#3d5a80", { name: "Alpine Descent \\", texture: "castle_stone" });

            // Tier 3 High Summit Peak (top = peakY = startY + 480, slab bottom = peakY - 40!)
            var peakY = startY + 480;
            this.addGridRamp(leftX + 760, ridge2Y, 200, 160, "right", "#3d5a80", { name: "Summit Climb /", texture: "castle_stone" });
            this.addGridBox(leftX + 960, peakY - 40, 320, 40, "#f4a261", { name: "High Mountain Summit", texture: "question_gold" });
            this.addGridRamp(leftX + 1280, ridge2Y, 200, 160, "left", "#3d5a80", { name: "Summit Descent \\", texture: "castle_stone" });

            this.addChest(leftX + 1120, peakY);
            this.spawnChunkEnemy("ARCHER", leftX + 1120, peakY + 60);
            this.spawnChunkEnemy("KNIGHT", leftX + 900, ridge1Y + 60);
        }

        // ====================================================================
        // 5. 💎 DEEP SUBTERRANEAN CRYSTAL CAVERN & ANCIENT CATACOMBS
        //    Descend 2 full tiers underground (-240px and -480px) into a massive
        //    glowing cavern complex!
        // ====================================================================
        else if (pick === "DEEP_CAVERN") {
            this.generatedChunks[chunkIdx] = { type: "DEEP_CAVERN", title: "💎 Deep Echo Caverns & Catacombs" };
            var tier1Y = startY - 240;
            var tier2Y = startY - 480;

            this.addInteriorWall(leftX + 200, tier2Y, 1840, 680, "cavern");

            // Surface West & East Rims with an Overhead Stone Arch Bridge spanning the chasm
            this.addGridBox(leftX, startY - 120, 360, 120, "#4a5568", { name: "Cavern West Rim", texture: "castle_stone" });
            this.addGridBox(rightX - 360, startY - 120, 360, 120, "#4a5568", { name: "Cavern East Rim", texture: "castle_stone" });
            this.addGridBox(leftX + 680, startY - 40, 880, 40, "#3d5a80", { name: "Cavern Surface Overpass", texture: "castle_stone" });

            // Tier 1 Underground Ledges (top = tier1Y = startY - 240)
            this.addGridBox(leftX + 200, tier1Y - 40, 640, 40, "#2b2d42", { name: "Upper Cavern West Shelf", texture: "lab_metal" });
            this.addGridBox(rightX - 840, tier1Y - 40, 640, 40, "#2b2d42", { name: "Upper Cavern East Shelf", texture: "lab_metal" });

            // Tier 2 Deep Abyss Floor (top = tier2Y = startY - 480)
            this.addGridBox(leftX + 160, tier2Y - 280, 1920, 280, "#1d3557", { name: "Deep Crystal Cavern Floor", texture: "lab_metal" });
            this.addGridRamp(leftX + 640, tier2Y, 240, 240, "left", "#2b2d42", { name: "Cavern West Ramp \\", texture: "lab_metal" });
            this.addGridRamp(rightX - 880, tier2Y, 240, 240, "right", "#2b2d42", { name: "Cavern East Ramp /", texture: "lab_metal" });
            this.addGridBumper(leftX + 280, tier2Y, 160, 40, 32, "#ff2e63", { name: "West Cavern Geyser" });
            this.addGridBumper(rightX - 440, tier2Y, 160, 40, 32, "#ff2e63", { name: "East Cavern Geyser" });

            // Deep Cavern Treasure Sanctuary
            this.addChest(leftX + 1120, tier2Y);
            this.addGridCrate(leftX + 920, tier2Y, 80, "#e84545", { explosive: true, name: "Mining Dynamite Crate" });
            this.spawnChunkEnemy("MAGE", leftX + 1120, tier2Y + 70);
            this.spawnChunkEnemy("SLIME", leftX + 760, tier2Y + 60);
            this.spawnChunkEnemy("BAT", leftX + 520, tier1Y + 80);
            this.spawnChunkEnemy("BAT", rightX - 520, tier1Y + 80);
        }

        this.activeBuildChunk = null;
    }

    // Builds an enterable multi-story Frontier Building with 100% flush floors (bottom = floorTopY - 40, h = 40) & stairs!
    static buildTownBuilding(houseLeftX, groundTopY, houseW = 640, stories = 3, hasChest = true) {
        var storyH = 160;
        var totalH = stories * storyH;
        this.addInteriorWall(houseLeftX, groundTopY, houseW, totalH, "wood");

        for (let s = 1; s <= stories; s++) {
            var floorTopY = groundTopY + s * storyH;
            var slabBotY = floorTopY - 40;
            var prevTopY = groundTopY + (s - 1) * storyH;
            var stairsOnLeft = (s % 2 === 1);

            // Full continuous semi-solid floor across the building (pass-through when climbing stairs from below!)
            this.addGridBox(houseLeftX + 40, slabBotY, houseW - 80, 40, "#bc4749", { name: "Building Floor " + (s + 1), texture: "brick" });

            if (stairsOnLeft) {
                this.addGridRamp(houseLeftX + 80, prevTopY, 200, storyH, "right", "#9c6644", { name: "Building Stairs /", texture: "dojo_wood" });
            } else {
                this.addGridRamp(houseLeftX + houseW - 280, prevTopY, 200, storyH, "left", "#9c6644", { name: "Building Stairs \\", texture: "dojo_wood" });
            }

            // Upper story exterior side pillars (leaving 160px ground doorways completely open!)
            this.addGridBox(houseLeftX, floorTopY, 40, 120, "#9c6644", { name: "Building West Wall", texture: "dojo_wood" });
            this.addGridBox(houseLeftX + houseW - 40, floorTopY, 40, 120, "#9c6644", { name: "Building East Wall", texture: "dojo_wood" });
        }

        // Pitched Roof on top of the highest story
        var roofBaseY = groundTopY + totalH + 120;
        var halfSpan = Math.floor((houseW / 2) / 40) * 40;
        this.addGridRamp(houseLeftX, roofBaseY, halfSpan, 80, "right", "#bc4749", { name: "Building Roof /", texture: "brick" });
        this.addGridRamp(houseLeftX + halfSpan, roofBaseY, houseW - halfSpan, 80, "left", "#bc4749", { name: "Building Roof \\", texture: "brick" });

        if (hasChest) {
            this.addChest(houseLeftX + houseW / 2, groundTopY + totalH);
        }
    }
}

