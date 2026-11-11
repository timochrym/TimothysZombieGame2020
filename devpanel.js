// ============================================================================
// DEVELOPER MODE UI  (press [B])
//   Tabs: BUILD (place objects) | INSPECT (edit selection) | GAME (cheats + tuning) | OBJECTS | LEVEL
//   Everything is driven by data attributes:
//     data-opt="key"   -> devOpts[key]   (range / checkbox)
//     data-act="name"  -> DevActions[name]()
//     data-toggle="x"  -> special toggles (god mode, co-op, paths ...)
// ============================================================================

var DEV_TEXTURES = [
    ["brick", "🧱 Brick"], ["grass_dirt", "🌿 Grass / Dirt"], ["castle_stone", "🏰 Castle Stone"],
    ["lab_metal", "⚙️ Lab Metal"], ["dojo_wood", "🎋 Dojo Wood"], ["neon_grid", "🌐 Neon Grid"],
    ["question_gold", "🪙 Gold Block"], ["crate_plank", "📦 Crate Wood"], ["solid", "🎨 Solid Color"]
];

var DEV_ENEMY_TYPES = ["NORMAL", "LEAPER", "TANK", "EXPLODER", "SPITTER", "SLIME", "BAT", "ARCHER", "KNIGHT", "MAGE", "BOSS_KING"];

function devOptionList(list, selected) {
    var html = "";
    for (let i = 0; i < list.length; i++) {
        var v = Array.isArray(list[i]) ? list[i][0] : list[i];
        var l = Array.isArray(list[i]) ? list[i][1] : list[i];
        html += '<option value="' + v + '"' + (v === selected ? " selected" : "") + ">" + l + "</option>";
    }
    return html;
}

function devSlider(label, opt, min, max, step, fmt, tip) {
    return '<div class="dp-row" title="' + (tip || "") + '">' +
        '<label>' + label + '</label>' +
        '<input type="range" class="dp-range" data-opt="' + opt + '" data-fmt="' + (fmt || "x") + '" min="' + min + '" max="' + max + '" step="' + step + '">' +
        '<span class="dp-val" data-val="' + opt + '"></span></div>';
}

function devToggle(label, opt, tip, special) {
    return '<label class="dp-toggle" title="' + (tip || "") + '"><input type="checkbox" ' +
        (special ? 'data-toggle="' + special + '"' : 'data-opt="' + opt + '"') + '><span class="dp-switch"></span><span>' + label + '</span></label>';
}

// ---------------------------------------------------------------------------
// Actions (buttons)
// ---------------------------------------------------------------------------
var DevActions = {
    clearEnemies: function() {
        for (let i = 0; i < zombies.length; i++) {
            Components.spawnSparks(zombies[i].x, zombies[i].y, "#ff6677", 6);
            zombies[i].dead = true;
        }
        zombiesRemainingToSpawn = 0;
        DevUI.toast("Enemies cleared");
    },
    nextWave: function() {
        DevActions.clearEnemies();
        startLevel(level + 1);
        DevUI.toast("Wave " + level);
    },
    gotoWave: function() {
        var n = Math.max(1, Math.min(99, parseInt(document.getElementById("dp-wave-num").value, 10) || 1));
        DevActions.clearEnemies();
        startLevel(n);
        DevUI.toast("Jumped to wave " + n);
    },
    spawnEnemy: function() {
        var type = document.getElementById("dp-enemy-type").value;
        var count = Math.max(1, Math.min(30, parseInt(document.getElementById("dp-enemy-count").value, 10) || 1));
        var ref = redGuy || { x: 0, y: 200 };
        for (let i = 0; i < count; i++) {
            spawnZombie(type, ref.x + (i % 2 ? 1 : -1) * (360 + i * 70), ref.y + 220);
        }
        rebuildAllObjects();
        DevUI.toast("Spawned " + count + " " + type);
    },
    spawnPower: function() {
        var type = document.getElementById("dp-power-type").value;
        var ref = redGuy || { x: 0, y: 200 };
        spawnPowerUp(ref.x + 160, ref.y + 140, type);
        DevUI.toast("Spawned " + type);
    },
    spawnAllPowers: function() {
        var ref = redGuy || { x: 0, y: 200 };
        var i = 0;
        for (var k in PowerUpDefs) {
            spawnPowerUp(ref.x - 420 + i * 78, ref.y + 220, k);
            i++;
        }
        DevUI.toast("Spawned every power-up");
    },
    giveAllPowers: function() {
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (c.isZombie) continue;
            for (var k in PowerUpDefs) {
                if (PowerUpDefs[k].duration > 0) c.applyPowerUp(k);
            }
        }
        DevUI.toast("All timed power-ups granted");
    },
    clearPowers: function() {
        for (let i = 0; i < characters.length; i++) {
            characters[i].powers = {};
            characters[i].shield = 0;
            characters[i].recomputeStats();
        }
    },
    refillAmmo: function() {
        for (let i = 0; i < characters.length; i++) { characters[i].ammoMag = characters[i].ammoMagMax; characters[i].ammoReserve = characters[i].ammoReserveMax; characters[i].reloadTimer = 0; }
        DevUI.toast("Ammo refilled");
    },
    healAll: function() {
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            c.health = c.maxHealth;
            c.jetpackFuel = c.jetpackMaxFuel;
        }
        DevUI.toast("Healed");
    },
    reviveAll: function() {
        for (let i = 0; i < characters.length; i++) {
            if (characters[i].isZombie) characters[i].reviveAsHuman(1, "DEV REVIVE");
        }
        gameOver = false;
        lastStandTimer = -1;
    },
    downP1: function() { DevActions._down(redGuy); },
    downP2: function() { DevActions._down(blueGuy); },
    _down: function(c) {
        if (!c || c.isZombie) return;
        c.health = 0;
        c.handleDeath();
        DevUI.toast((c.playerLabel || "Hero") + " is down - test the revive!");
    },
    bringP2: function() {
        if (blueGuy && redGuy) { blueGuy.x = redGuy.x + 100; blueGuy.y = redGuy.y + 40; blueGuy.xspeed = blueGuy.yspeed = 0; }
        else DevUI.toast("Enable co-op first");
    },
    tpToCursor: function() {
        var m = Components.getMouseWorldPos();
        if (redGuy) { redGuy.x = m[0]; redGuy.y = m[1] + 60; redGuy.xspeed = redGuy.yspeed = 0; }
    },
    addCoins: function() {
        coins += 1000;
        heroXP += 400;
        DevUI.toast("+1000 coins, +400 XP");
    },
    levelUp: function() {
        heroXP = heroXPNext;
        coins += 1;
        DevUI.toast("Collect any coin to level up!");
        Components.spawnCoins(redGuy.x, redGuy.y + 60, 1);
    },
    jolt: function() { LevelManager.joltAllObjects(); if (typeof Ragdolls !== "undefined") Ragdolls.list.forEach(function(r) { r.addVelocity((Math.random() - 0.5) * 20, 8 + Math.random() * 12); }); },
    _dummy: function(type, x, y, vx, vy) {
        var z = spawnZombie(type, x, y);
        var idx = zombies.indexOf(z);
        if (idx !== -1) zombies.splice(idx, 1);
        z.xspeed = vx; z.yspeed = vy;
        var rd = Ragdolls.spawnFrom(z, { corpse: true, life: 1500, vx: vx, vy: vy });
        rd.style.dead = true;
        rd.lastAttacker = redGuy;
        rd.thrownBy = redGuy;
        rd.projectileTimer = 50;
        return rd;
    },
    ragdollCannon: function() {
        var m = Components.getMouseWorldPos();
        var dx = m[0] - redGuy.x, dy = m[1] - redGuy.y, l = Math.hypot(dx, dy) || 1;
        var types = ["NORMAL", "KNIGHT", "ARCHER", "TANK", "MAGE", "BAT", "SLIME", "LEAPER"];
        for (let i = 0; i < 6; i++) {
            DevActions._dummy(types[Math.floor(Math.random() * types.length)], redGuy.x + dx / l * 120, redGuy.y + 60 + i * 10, dx / l * (22 + i * 2), dy / l * (22 + i * 2) + 6);
        }
        if (typeof SFX !== "undefined") SFX.play("explode", redGuy.x, redGuy.y, 0.6);
    },
    ragdollEveryone: function() {
        for (let i = 0; i < zombies.length; i++) {
            var z = zombies[i];
            z.ragdollImmune = 0;
            z.xspeed += (Math.random() - 0.5) * 18; z.yspeed += 12 + Math.random() * 8;
            z.startRagdoll(z.xspeed, z.yspeed, 120, true);
        }
        DevUI.toast("Everybody fall down!");
    },
    ragdollRain: function() {
        var types = ["NORMAL", "KNIGHT", "ARCHER", "TANK", "MAGE", "BAT", "SLIME", "BOSS_KING", "EXPLODER", "SPITTER"];
        for (let i = 0; i < 12; i++) {
            var rd = DevActions._dummy(types[i % types.length], cameraTargetX + (Math.random() - 0.5) * 1400, cameraTargetY + 900 + i * 90, (Math.random() - 0.5) * 6, 0);
            rd.projectileTimer = 0;
        }
    },
    rain: function() { LevelManager.rainStressCrates(18); },
    clearCrates: function() { SummonManager.clearCrates(); },
    resetTuning: function() {
        devOpts.timeScale = 1; devOpts.spawnRate = 1; devOpts.enemyDamage = 1; devOpts.enemyHealth = 1;
        devOpts.playerDamage = 1; devOpts.maxEnemies = 11; devOpts.powerUpRate = 1; devOpts.gravityMult = 1; devOpts.bouncyRagdolls = false;
        userZoom = 1;
        DevUI.sync();
    },
    screenshot: function() {
        var a = document.createElement("a");
        a.download = "zombie-game-" + Date.now() + ".png";
        a.href = canvas.toDataURL("image/png");
        a.click();
    },
    saveLevel: function() { LevelManager.saveCustomLevel(document.getElementById("dp-level-name").value); DevUI.toast("Level saved"); },
    newLevel: function() { LevelManager.createNewBlankLevel(); },
    stressLab: function() { LevelManager.selectLevel("stress_test"); },
    exportLevel: function() {
        var json = JSON.stringify(LevelManager.serializeCurrentMap(), null, 1);
        document.getElementById("dp-json").value = json;
        try { navigator.clipboard.writeText(json); } catch (e) {}
        var blob = new Blob([json], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (document.getElementById("dp-level-name").value || "level") + ".json";
        a.click();
        DevUI.toast("Level exported (and copied)");
    },
    importLevel: function() {
        try {
            var items = JSON.parse(document.getElementById("dp-json").value);
            staticObjects = staticObjects.filter(function(o) { return o.isInfiniteBase; });
            movingObjects = [];
            Object.loadMap(items);
            rebuildAllObjects();
            SummonManager.refreshObjectList();
            DevUI.toast("Imported " + items.length + " objects");
        } catch (e) {
            DevUI.toast("Invalid JSON: " + e.message);
        }
    },
    deleteSelected: function() { SummonManager.deleteSelected(); },
    duplicateSelected: function() { SummonManager.duplicateSelected(); },
    togglePhysics: function() { SummonManager.toggleSelectedPhysics(); },
    flipRamp: function() {
        var o = SummonManager.selectedObject;
        if (!o || !o.isRamp) return;
        o.rampDir = (o.rampDir == "left") ? "right" : "left";
        o.resize(o.w, o.h);
        Pathfinder.rebuildGraph(true);
    },
    snapSelected: function() {
        var o = SummonManager.selectedObject;
        if (!o) return;
        var g = SummonManager.gridSnap || 40;
        o.x = Math.round(o.x / g) * g;
        o.y = Math.round(o.y / g) * g;
        SummonManager.selectObject(o);
        Pathfinder.rebuildGraph(true);
    },
    killSelected: function() {
        var o = SummonManager.selectedObject;
        if (o instanceof Character) { o.takeDamage(-99999); }
    },
    nudge: function(dx, dy) {
        var o = SummonManager.selectedObject;
        if (!o) return;
        var step = SummonManager.gridSnap || 40;
        o.x += dx * step;
        o.y += dy * step;
        SummonManager.selectObject(o);
        Pathfinder.rebuildGraph(true);
    },
    spawnAtPlayer: function() { SummonManager.summonNearPlayer(); }
};

// ---------------------------------------------------------------------------
// UI plumbing
// ---------------------------------------------------------------------------
var DevUI = {
    toastTimer: null,

    toast: function(msg) {
        var t = document.getElementById("dp-toast");
        if (!t) return;
        t.textContent = msg;
        t.classList.add("show");
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(function() { t.classList.remove("show"); }, 1800);
    },

    fmt: function(el, v) {
        var f = el.getAttribute("data-fmt");
        if (f === "x") return Number(v).toFixed(2) + "x";
        if (f === "int") return String(Math.round(v));
        if (f === "pct") return Math.round(v * 100) + "%";
        return String(v);
    },

    // Pull current state into every control
    paintRange: function(el) {
        var mn = parseFloat(el.min), mx = parseFloat(el.max), v = parseFloat(el.value);
        if (isFinite(mn) && isFinite(mx) && mx > mn) el.style.setProperty("--pct", (((v - mn) / (mx - mn)) * 100) + "%");
    },

    // the Game tab follows the game that's on: its own settings first, shared rows only where they do something
    NEED: { waves: { t: ["waves"], o: ["spawnRate", "maxEnemies", "powerUpRate"] }, enemies: { t: ["paths"], o: ["enemyHealth", "enemyDamage"] },
            world: { t: ["god", "jetpack"], o: ["flight", "infiniteAmmo", "friendlyFire", "showHitboxes", "bouncyRagdolls", "playerDamage", "gravityMult"], id: ["dp-zoom"] }, coop: { t: ["coop"] } },
    syncGame: function(panel) {
        if (typeof GameTuning === "undefined" || !GameModes.current) return;
        var hidden = 0;
        for (var need in this.NEED) {
            var N = this.NEED[need], show = GameTuning.applies(need), els = [];
            (N.t || []).forEach(function(k) { var e = panel.querySelector('[data-toggle="' + k + '"]'); if (e) els.push(e.closest(".dp-toggle")); });
            (N.o || []).forEach(function(k) { var e = panel.querySelector('[data-opt="' + k + '"]'); if (e) els.push(e.closest(".dp-toggle") || e.closest(".dp-row")); });
            (N.id || []).forEach(function(k) { var e = document.getElementById(k); if (e) els.push(e.closest(".dp-row")); });
            els.forEach(function(e) { if (e) { e.style.display = show ? "" : "none"; if (!show) hidden++; } });
        }
        panel.querySelectorAll("[data-need]").forEach(function(e) { e.style.display = GameTuning.applies(e.dataset.need) ? "" : "none"; });
        var note = document.getElementById("dp-hidden-note");
        if (note) note.textContent = hidden ? "(" + hidden + " that don't apply to this game are hidden)" : "";
        // "This game" section: rebuilt when the game changes, values refreshed every sync
        var box = document.getElementById("dp-own"), rowsEl = document.getElementById("dp-own-rows"), id = GameModes.current.id;
        var rows = GameTuning.rows();
        if (!box) return;
        box.style.display = rows.length ? "" : "none";
        if (this.ownFor !== id) {
            this.ownFor = id; this.ownRows = rows;
            document.getElementById("dp-own-title").textContent = (GameModes.current.title || id) + " — its own settings";
            rowsEl.innerHTML = rows.map(function(r, i) {
                if (r.type === "toggle") return '<label class="dp-toggle"><input type="checkbox" data-own="' + i + '"><span class="dp-switch"></span><span>' + r.label + '</span></label>';
                if (r.type === "choice") return '<div class="dp-row"><label>' + r.label + '</label><select class="dp-select" data-own="' + i + '">' + r.options.map(function(o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join("") + '</select></div>';
                return '<div class="dp-row" title="' + (r.note || "") + '"><label>' + r.label + '</label><input type="range" class="dp-range" data-own="' + i + '" min="' + r.min + '" max="' + r.max + '" step="' + r.step + '"><span class="dp-val" data-own-val="' + i + '"></span></div>';
            }).join("") + (rows.some(function(r) { return r.note; }) ? '<p class="dp-hint">Some take effect from the next match.</p>' : "");
            rowsEl.querySelectorAll("[data-own]").forEach(function(el) {
                var r = rows[Number(el.dataset.own)];
                var apply = function() { var v = el.type === "checkbox" ? el.checked : Number(el.value); r.set(v); DevUI.toast(r.label + ": " + (el.type === "checkbox" ? (v ? "on" : "off") : (r.type === "choice" ? el.options[el.selectedIndex].text : v))); };
                el.addEventListener(el.type === "range" ? "input" : "change", apply);
            });
        }
        rowsEl.querySelectorAll("[data-own]").forEach(function(el) {
            if (document.activeElement === el) return;
            var r = DevUI.ownRows[Number(el.dataset.own)], v = r.get();
            if (el.type === "checkbox") el.checked = !!v; else el.value = v;
            var lab = rowsEl.querySelector('[data-own-val="' + el.dataset.own + '"]'); if (lab) lab.textContent = String(v);
            if (el.type === "range") DevUI.paintRange(el);
        });
    },

    sync: function() {
        var panel = document.getElementById("summon-panel");
        if (!panel) return;
        var ranges = panel.querySelectorAll(".dp-range");
        for (let i = 0; i < ranges.length; i++) DevUI.paintRange(ranges[i]);
        var inputs = panel.querySelectorAll("[data-opt]");
        for (let i = 0; i < inputs.length; i++) {
            var el = inputs[i];
            var key = el.getAttribute("data-opt");
            if (el.type === "checkbox") el.checked = !!devOpts[key];
            else if (document.activeElement !== el) el.value = devOpts[key];
            var lab = panel.querySelector('[data-val="' + key + '"]');
            if (lab) lab.textContent = DevUI.fmt(el, devOpts[key]);
        }
        var tg = panel.querySelectorAll("[data-toggle]");
        for (let i = 0; i < tg.length; i++) {
            var k = tg[i].getAttribute("data-toggle");
            var on = false;
            if (k === "god") on = godMode;
            else if (k === "coop") on = multiplayer;
            else if (k === "paths") on = (typeof Pathfinder !== "undefined" && Pathfinder.showDebug);
            else if (k === "waves") on = !SummonManager.pauseWaves;
            else if (k === "jetpack") on = jetpackEnabled;
            else if (k === "grid") on = SummonManager.showGrid;
            tg[i].checked = on;
        }
        var zoom = document.getElementById("dp-zoom");
        if (zoom && document.activeElement !== zoom) {
            zoom.value = userZoom;
            var zl = panel.querySelector('[data-val="zoom"]');
            if (zl) zl.textContent = userZoom.toFixed(2) + "x";
        }
        DevUI.syncGame(panel);
        topBarRefresh();
        var godBtn = document.getElementById("god-mode-btn");
        if (godBtn) {
            godBtn.classList.toggle("active", godMode);
        }
        var info = document.getElementById("dp-live");
        if (info) {
            var wv = typeof GameTuning !== "undefined" ? GameTuning.applies("waves") : true;
            info.textContent = (wv ? "Wave " + level + " · " : (GameModes.current ? GameModes.current.title + " · " : "")) + (zombies.length ? zombies.length + " enemies · " : "") + measuredFPS + " fps";
        }
    },

    switchTab: function(name) {
        var tabs = document.querySelectorAll(".dp-tab");
        var pages = document.querySelectorAll(".dp-page");
        for (let i = 0; i < tabs.length; i++) tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tab") === name);
        for (let i = 0; i < pages.length; i++) pages[i].classList.toggle("active", pages[i].getAttribute("data-page") === name);
        SummonManager.activeTab = name;
        if (name === "objects") SummonManager.refreshObjectList();
    },

    bind: function(panel) {
        // Delegated input handling
        panel.addEventListener("input", function(e) {
            var el = e.target;
            if (el.classList && el.classList.contains("dp-range")) DevUI.paintRange(el);
            var key = el.getAttribute("data-opt");
            if (key && el.type === "range") {
                devOpts[key] = parseFloat(el.value);
                var lab = panel.querySelector('[data-val="' + key + '"]');
                if (lab) lab.textContent = DevUI.fmt(el, devOpts[key]);
            }
            if (el.id === "dp-zoom") {
                userZoom = parseFloat(el.value);
                var zl = panel.querySelector('[data-val="zoom"]');
                if (zl) zl.textContent = userZoom.toFixed(2) + "x";
            }
            // linked range <-> number pairs for the inspector / new-object size
            var link = el.getAttribute("data-link");
            if (link) {
                var other = document.getElementById(link);
                if (other) {
                    other.value = el.value;
                    DevUI.paintRange(other);
                    if (link.indexOf("sp-edit") === 0) SummonManager.updateSelectedProps();
                    DevUI.updateSizeLabels();
                }
            }
        });
        panel.addEventListener("change", function(e) {
            var el = e.target;
            var key = el.getAttribute("data-opt");
            if (key && el.type === "checkbox") {
                devOpts[key] = el.checked;
            }
            var tg = el.getAttribute("data-toggle");
            if (tg) {
                if (tg === "god") { if (godMode !== el.checked) SummonManager.toggleGodMode(); }
                else if (tg === "coop") { if (multiplayer !== el.checked) toggleMultiplayer(); }
                else if (tg === "paths") Pathfinder.showDebug = el.checked;
                else if (tg === "waves") { if (SummonManager.pauseWaves === el.checked) SummonManager.toggleWavePause(); }
                else if (tg === "jetpack") jetpackEnabled = el.checked;
                else if (tg === "grid") { SummonManager.showGrid = el.checked; }
                DevUI.sync();
            }
            var link = el.getAttribute("data-link");
            if (link && el.type === "number") {
                var other = document.getElementById(link);
                if (other) { other.value = el.value; DevUI.paintRange(other); }
            }
        });
        panel.addEventListener("click", function(e) {
            var btn = e.target.closest("[data-act]");
            if (btn) {
                var act = btn.getAttribute("data-act");
                var args = (btn.getAttribute("data-args") || "").split(",").filter(Boolean).map(Number);
                if (DevActions[act]) DevActions[act].apply(null, args);
                DevUI.sync();
                return;
            }
            var tab = e.target.closest("[data-tab]");
            if (tab) DevUI.switchTab(tab.getAttribute("data-tab"));
            var chip = e.target.closest("[data-filter]");
            if (chip) {
                SummonManager.objFilter = chip.getAttribute("data-filter");
                var chips = panel.querySelectorAll("[data-filter]");
                for (let i = 0; i < chips.length; i++) chips[i].classList.toggle("active", chips[i] === chip);
                SummonManager.refreshObjectList();
            }
            var sw = e.target.closest("[data-tex]");
            if (sw) {
                SummonManager.setTexture(sw.getAttribute("data-tex"));
                DevUI.syncTextureSwatches();
            }
        });
    },

    updateSizeLabels: function() {
        var w = document.getElementById("sp-w"), h = document.getElementById("sp-h");
        var l = document.getElementById("dp-size-label");
        if (w && h && l) {
            l.textContent = w.value + " × " + h.value + " px  (" + Math.round(w.value / 40) + " × " + Math.round(h.value / 40) + " tiles)";
        }
    },

    syncTextureSwatches: function() {
        var sws = document.querySelectorAll("[data-tex]");
        for (let i = 0; i < sws.length; i++) {
            sws[i].classList.toggle("active", sws[i].getAttribute("data-tex") === SummonManager.spawnTexture);
        }
        var dt = document.getElementById("dock-texture");
        if (dt) dt.value = SummonManager.spawnTexture;
    }
};

// ---------------------------------------------------------------------------
// SummonManager DOM-facing methods
// ---------------------------------------------------------------------------
SummonManager.buildUI = function() {
    var style = document.createElement("style");
    style.textContent = `
        :root { --dp-bg: rgba(10,16,24,0.94); --dp-line: rgba(130,180,210,0.22); --dp-accent: #22d3ee; --dp-accent2: #ffd23f; --dp-text: #e6f1f7; --dp-dim: #8aa3b5; }
        /* compact top bar: a few icon buttons + a ☰ menu with everything else; fades back while you play */
        #top-right-bar { position: fixed; top: 10px; right: 12px; z-index: 1000; display: flex; gap: 6px; align-items: center; user-select: none; font-family: 'Segoe UI', Arial, sans-serif; opacity: .62; transition: opacity .2s; }
        #top-right-bar:hover, #top-right-bar.menu-open, body.hub-open #top-right-bar, body.paused #top-right-bar { opacity: 1; }
        body.studio-open #top-right-bar { display: none; }
        .top-bar-btn { background: var(--dp-bg); color: var(--dp-text); border: 1px solid var(--dp-line); height: 36px; min-width: 38px; padding: 0 11px; font-size: 13px; font-weight: 700; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.35); transition: border-color .15s, background .15s; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
        .top-bar-btn:hover { border-color: var(--dp-accent); }
        .top-bar-btn.active { background: linear-gradient(135deg, #ffd23f, #ff9f1c); color: #1a1205; border-color: #fff3; }
        #coop-btn.active { background: linear-gradient(135deg, #22d3ee, #3b82f6); color: #04121c; }
        #lan-btn.live { background: linear-gradient(135deg, #34d399, #059669); color: #03140d; }
        @media (max-width: 1100px) { .top-bar-btn .lbl { display: none; } }
        #top-menu { position: fixed; top: 52px; right: 12px; z-index: 1001; width: 300px; max-height: calc(100vh - 70px); overflow-y: auto; background: var(--dp-bg); border: 1px solid var(--dp-line); border-radius: 14px; box-shadow: 0 18px 50px rgba(0,0,0,.6); padding: 8px; display: none; font-family: 'Segoe UI', Arial, sans-serif; color: var(--dp-text); }
        #top-menu.open { display: block; }
        #top-menu .tm-head { padding: 6px 8px 8px; border-bottom: 1px solid var(--dp-line); margin-bottom: 6px; }
        #top-menu .tm-head b { display: block; font-size: 14px; color: #fde68a; } #top-menu .tm-head span { font-size: 12px; color: var(--dp-dim); }
        #top-menu .tm-sec { font-size: 10px; font-weight: 800; letter-spacing: .1em; color: var(--dp-dim); text-transform: uppercase; margin: 8px 8px 3px; }
        #top-menu button.tm { width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; background: transparent; color: var(--dp-text); border: 0; border-radius: 9px; padding: 8px 10px; font: 600 13px inherit; cursor: pointer; }
        #top-menu button.tm:hover { background: rgba(34,211,238,.12); }
        #top-menu button.tm .ic { width: 22px; text-align: center; font-size: 16px; }
        #top-menu button.tm .tx { flex: 1; } #top-menu button.tm .tx small { display: block; color: var(--dp-dim); font-weight: 500; font-size: 11px; }
        #top-menu button.tm kbd { margin-left: auto; }
        #top-menu button.tm.active { background: rgba(255,210,63,.16); }
        #level-select-dropdown { width: calc(100% - 16px); margin: 2px 8px 6px; background: #0b1220; color: #7ff0b0; border: 1px solid var(--dp-line); border-radius: 9px; padding: 7px 8px; font: 600 13px inherit; }

        #mario-maker-dock { position: fixed; bottom: 166px; left: calc(50% - 215px); transform: translateX(-50%); z-index: 1000; background: var(--dp-bg); border: 1px solid var(--dp-line); border-radius: 16px; padding: 10px 14px; display: none; align-items: center; gap: 8px; box-shadow: 0 12px 34px rgba(0,0,0,.6); user-select: none; font-family: 'Segoe UI', Arial, sans-serif; max-width: calc(100vw - 460px); overflow-x: auto; }
        #mario-maker-dock.open { display: flex; }
        .mm-tile { flex: 0 0 auto; width: 72px; height: 64px; background: rgba(255,255,255,0.05); border: 1px solid var(--dp-line); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: grab; color: var(--dp-text); font-size: 11px; font-weight: 700; text-align: center; transition: transform .1s, border-color .1s, background .1s; }
        .mm-tile:hover { transform: translateY(-3px); border-color: var(--dp-accent2); background: rgba(255,210,63,.12); }
        .mm-tile.selected { border-color: var(--dp-accent); background: rgba(34,211,238,.16); box-shadow: 0 0 14px rgba(34,211,238,.35); }
        .mm-icon { font-size: 22px; margin-bottom: 3px; }
        .mm-divider { width: 1px; height: 48px; background: var(--dp-line); margin: 0 2px; flex: 0 0 auto; }
        .mm-label { color: var(--dp-dim); font-size: 11px; font-weight: 800; line-height: 1.25; letter-spacing: .5px; }

        #summon-panel { position: fixed; top: 62px; right: 16px; bottom: 16px; width: 410px; background: var(--dp-bg); border: 1px solid var(--dp-line); border-radius: 18px; color: var(--dp-text); font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; z-index: 1000; display: none; flex-direction: column; overflow: hidden; box-shadow: 0 18px 50px rgba(0,0,0,.65); user-select: none; backdrop-filter: blur(8px); }
        #summon-panel.open { display: flex; }
        .dp-head { padding: 12px 12px 8px 16px; display: flex; align-items: center; }
        .dp-head b { font-size: 16px; letter-spacing: .5px; color: var(--dp-accent2); }
        .dp-head span { font-size: 11px; color: var(--dp-dim); margin-left: auto; margin-right: 10px; }
        .dp-x { background: rgba(255,255,255,.06); border: 1px solid var(--dp-line); color: var(--dp-text); border-radius: 8px; width: 28px; height: 28px; cursor: pointer; font-size: 13px; flex: none; }
        .dp-x:hover { background: rgba(255,77,94,.25); }
        @media (max-width: 900px) { #summon-panel { width: min(410px, calc(100vw - 24px)); right: 12px; top: 56px; bottom: 12px; } #mario-maker-dock { left: 12px; transform: none; max-width: calc(100vw - 450px); bottom: auto; top: 150px; } }
        @media (max-width: 640px) { #mario-maker-dock.open { display: none; } }
        .dp-tabs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; padding: 0 12px 10px; border-bottom: 1px solid var(--dp-line); }
        .dp-tab { background: transparent; border: 0; color: var(--dp-dim); padding: 8px 2px; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 12px; font-family: inherit; transition: all .12s; }
        .dp-tab:hover { background: rgba(255,255,255,.06); color: var(--dp-text); }
        .dp-tab.active { background: rgba(34,211,238,.16); color: var(--dp-accent); box-shadow: inset 0 -2px 0 var(--dp-accent); }
        .dp-body { overflow-y: auto; flex: 1; padding: 6px 14px 14px; }
        .dp-body::-webkit-scrollbar { width: 8px; } .dp-body::-webkit-scrollbar-thumb { background: rgba(130,180,210,.3); border-radius: 8px; }
        .dp-page { display: none; } .dp-page.active { display: block; }
        .dp-section { margin-top: 12px; }
        .dp-title { font-size: 11px; font-weight: 800; letter-spacing: 1.2px; color: var(--dp-dim); text-transform: uppercase; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
        .dp-hint { font-size: 11px; color: var(--dp-dim); margin: 4px 0 0; line-height: 1.35; }
        .dp-row { display: flex; align-items: center; gap: 8px; margin: 7px 0; }
        .dp-row label { width: 104px; white-space: nowrap; flex: 0 0 auto; color: #c3d5e2; font-weight: 600; }
        .dp-val { width: 52px; text-align: right; font-variant-numeric: tabular-nums; color: var(--dp-accent2); font-weight: 800; flex: 0 0 auto; }
        .dp-range { -webkit-appearance: none; appearance: none; flex: 1; height: 8px; border-radius: 8px; --pct: 50%; background: linear-gradient(90deg, #22d3ee var(--pct), rgba(255,255,255,.16) var(--pct)); outline: none; min-width: 0; }
        .dp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: linear-gradient(135deg, #67e8f9, #22d3ee); border: 2px solid #04121c; box-shadow: 0 0 10px rgba(34,211,238,.6); cursor: pointer; }
        .dp-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #22d3ee; border: 2px solid #04121c; cursor: pointer; }
        .dp-num, .dp-select, .dp-text { background: rgba(0,0,0,.35); color: var(--dp-text); border: 1px solid var(--dp-line); border-radius: 8px; padding: 6px 8px; font-family: inherit; font-size: 12px; font-weight: 600; min-width: 0; }
        .dp-num { width: 70px; flex: 0 0 auto; } .dp-select { flex: 1; } .dp-text { flex: 1; }
        .dp-num:focus, .dp-select:focus, .dp-text:focus { outline: none; border-color: var(--dp-accent); }
        .dp-color { width: 38px; height: 30px; border: 1px solid var(--dp-line); border-radius: 8px; background: transparent; padding: 0; cursor: pointer; flex: 0 0 auto; }
        .dp-btn { background: rgba(255,255,255,.07); color: var(--dp-text); border: 1px solid var(--dp-line); border-radius: 10px; padding: 8px 10px; font-weight: 700; font-size: 12px; cursor: pointer; font-family: inherit; transition: all .12s; }
        .dp-btn:hover { border-color: var(--dp-accent); background: rgba(34,211,238,.12); }
        .dp-btn:active { transform: scale(.97); }
        .dp-btn.primary { background: linear-gradient(135deg, #22d3ee, #3b82f6); color: #04121c; border: 0; }
        .dp-btn.warn { background: rgba(255,90,100,.14); border-color: rgba(255,90,100,.5); color: #ffb3ba; }
        .dp-btn.good { background: rgba(61,220,132,.14); border-color: rgba(61,220,132,.5); color: #a5f3c9; }
        .dp-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; } .dp-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
        .dp-seg { display: grid; grid-template-columns: repeat(3, 1fr); background: rgba(0,0,0,.35); border-radius: 12px; padding: 3px; gap: 3px; }
        .dp-seg button { background: transparent; border: 0; color: var(--dp-dim); padding: 9px 4px; border-radius: 9px; font-weight: 700; font-size: 12px; cursor: pointer; font-family: inherit; }
        .dp-seg button.active { background: var(--dp-accent); color: #04121c; box-shadow: 0 2px 10px rgba(34,211,238,.45); }
        .dp-toggle { display: flex; align-items: center; gap: 10px; padding: 6px 0; cursor: pointer; font-weight: 600; color: #c3d5e2; }
        .dp-toggle input { display: none; }
        .dp-switch { width: 38px; height: 22px; border-radius: 12px; background: rgba(255,255,255,.14); position: relative; transition: background .15s; flex: 0 0 auto; }
        .dp-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; }
        .dp-toggle input:checked + .dp-switch { background: var(--dp-accent); }
        .dp-toggle input:checked + .dp-switch::after { transform: translateX(16px); }
        .dp-toggles { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; }
        .dp-tex { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
        .dp-tex button { background: rgba(255,255,255,.05); border: 1px solid var(--dp-line); color: var(--dp-text); border-radius: 9px; padding: 7px 2px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .dp-tex button.active { border-color: var(--dp-accent); background: rgba(34,211,238,.18); }
        .dp-card { background: rgba(255,255,255,.04); border: 1px solid var(--dp-line); border-radius: 12px; padding: 10px 12px; }
        .dp-nudge { display: grid; grid-template-columns: repeat(3, 38px); gap: 4px; justify-content: center; }
        .dp-nudge .dp-btn { padding: 6px 0; }
        #dp-live { color: var(--dp-accent); font-weight: 700; }
        #sp-obj-list { margin-top: 8px; }
        .sp-obj-item { display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 7px 10px; margin-bottom: 4px; background: rgba(255,255,255,.04); border: 1px solid transparent; border-radius: 9px; cursor: pointer; font-size: 12px; }
        .sp-obj-item:hover { border-color: var(--dp-line); background: rgba(255,255,255,.07); }
        .sp-obj-item.selected { border-color: var(--dp-accent2); background: rgba(255,210,63,.12); }
        .sp-swatch { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 6px; border: 1px solid rgba(255,255,255,.4); }
        .sp-small-btn { background: rgba(255,255,255,.08); color: var(--dp-text); border: 1px solid var(--dp-line); border-radius: 7px; padding: 3px 8px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .sp-small-btn.del { color: #ff9aa5; }
        .dp-chips { display: flex; gap: 5px; flex-wrap: wrap; }
        .dp-chips button { background: rgba(255,255,255,.06); border: 1px solid var(--dp-line); color: var(--dp-dim); border-radius: 14px; padding: 4px 10px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .dp-chips button.active { background: var(--dp-accent); color: #04121c; border-color: transparent; }
        #dp-toast { position: fixed; bottom: 160px; left: 50%; transform: translate(-50%, 20px); background: #0b1a24; border: 1px solid var(--dp-accent); color: var(--dp-text); padding: 9px 18px; border-radius: 20px; font: 700 13px 'Segoe UI', Arial, sans-serif; z-index: 1100; opacity: 0; pointer-events: none; transition: all .2s; }
        #dp-toast.show { opacity: 1; transform: translate(-50%, 0); }
        .dp-empty { color: var(--dp-dim); text-align: center; padding: 26px 8px; line-height: 1.5; }
        textarea.dp-text { width: 100%; height: 90px; resize: vertical; font-family: Consolas, monospace; font-size: 11px; box-sizing: border-box; }
        kbd { background: rgba(255,255,255,.1); border: 1px solid var(--dp-line); border-radius: 5px; padding: 1px 6px; font-size: 11px; font-family: inherit; font-weight: 700; }
    `;
    document.head.appendChild(style);

    var stop = function(e) { e.stopPropagation(); };

    // ---------- Top-right bar ----------
    var topBar = document.createElement("div");
    topBar.id = "top-right-bar";
    topBar.addEventListener("mousedown", stop);
    topBar.addEventListener("click", stop);

    var mk = function(id, icon, label, title, fn) {
        var b = document.createElement("button");
        if (id) b.id = id;
        b.className = "top-bar-btn";
        b.innerHTML = icon + (label ? " <span class='lbl'>" + label + "</span>" : "");
        b.title = title;
        b.addEventListener("click", function(e) { e.stopPropagation(); fn(); this.blur(); });
        topBar.appendChild(b);
        return b;
    };
    mk("coop-btn", "👥", "Players", "Who's playing: humans, CPUs, teams, controls", function() { closeTopMenu(); PlayersUI.open(); });
    mk("lan-btn", "📡", "LAN", "Play with other devices on the same Wi-Fi: host or join", function() { closeTopMenu(); NetUI.open(); });
    mk("studio-btn", "🛠", "Studio", "Level Studio [B]: build, test and share levels", function() { closeTopMenu(); Studio.open(); });
    var menuBtn = mk("top-menu-btn", "☰", "Menu", "Everything else: switch game, levels, settings, controls, cheats", function() { toggleTopMenu(); });

    // ---------- the ☰ menu ----------
    var menu = document.createElement("div");
    menu.id = "top-menu";
    ["mousedown", "click", "wheel", "keydown"].forEach(function(ev) { menu.addEventListener(ev, function(e) { e.stopPropagation(); }); });
    var row = function(id, icon, text, sub, key, fn) {
        var b = document.createElement("button");
        b.className = "tm"; if (id) b.id = id;
        b.innerHTML = "<span class='ic'>" + icon + "</span><span class='tx'>" + text + (sub ? "<small>" + sub + "</small>" : "") + "</span>" + (key ? "<kbd>" + key + "</kbd>" : "");
        b.addEventListener("click", function(e) { e.stopPropagation(); fn(b); });
        menu.appendChild(b);
        return b;
    };
    var sec = function(t) { var d = document.createElement("div"); d.className = "tm-sec"; d.textContent = t; menu.appendChild(d); };
    var head = document.createElement("div"); head.className = "tm-head"; head.id = "tm-head"; menu.appendChild(head);
    sec("Play");
    row("", "🕹", "Arcade — switch game", "All the games made with this engine", "", function() { closeTopMenu(); if (typeof paused !== "undefined" && paused) closePause(); Hub.openHub(false); });
    var lvlSelect = document.createElement("select");
    lvlSelect.id = "level-select-dropdown";
    lvlSelect.title = "Levels / courses of this game";
    lvlSelect.addEventListener("change", function() { closeTopMenu(); LevelManager.selectLevel(this.value); this.blur(); });
    menu.appendChild(lvlSelect);
    row("", "🌲", "Infinite Frontier", "Survival on the endless generated trail", "", function() { closeTopMenu(); LevelManager.selectLevel("infinite_frontier"); });
    row("", "⏸", "Pause menu", "Restart, game options, levels", "Esc", function() { closeTopMenu(); if (typeof openPause === "function" && !paused) openPause(false); });
    sec("People");
    row("", "👥", "Players & CPUs", "Humans, CPU seats, teams, gamepads", "", function() { closeTopMenu(); PlayersUI.open(); });
    row("", "📡", "LAN multiplayer", "Host or join on the same Wi-Fi", "", function() { closeTopMenu(); NetUI.open(); });
    sec("Make & tune");
    row("", "🛠", "Level Studio", "Build, play-test and share levels", "B", function() { closeTopMenu(); Studio.open(); });
    row("summon-toggle-btn", "🧪", "Cheats & tuning", "Dev panel: sliders, spawning, god mode", "", function() { closeTopMenu(); SummonManager.togglePanel(); });
    var god = row("god-mode-btn", "⚡", "God mode", "Invincible + unlimited everything", "V", function() { SummonManager.toggleGodMode(); DevUI.sync(); });
    god.style.display = "none";
    sec("Settings");
    row("", "⚙", "Settings", "Sound, shake, graphics, speed, 3D view", "", function() { closeTopMenu(); if (!paused) openPause(false); pauseActivate("settings"); });
    row("", "🎮", "Controls", "Remap keys and gamepad buttons", "", function() { closeTopMenu(); if (typeof ControlsUI !== "undefined") ControlsUI.open(); });
    row("tm-help", "❓", "Key help on screen", "Show / hide the control cheat-sheet", "H", function(b) { devOpts.showHelp = !devOpts.showHelp; b.classList.toggle("active", devOpts.showHelp); });
    document.body.appendChild(menu);
    window.toggleTopMenu = function() {
        var open = !menu.classList.contains("open");
        menu.classList.toggle("open", open); topBar.classList.toggle("menu-open", open);
        if (open) {
            if (typeof SummonManager !== "undefined") SummonManager.refreshLevelDropdown();
            var g = GameModes.current, lvl = LevelManager.getCurrentLevel ? LevelManager.getCurrentLevel() : null;
            head.innerHTML = "<b>" + (g ? g.title : "") + "</b><span>" + (lvl && lvl.name ? lvl.name.replace(/^[^A-Za-z0-9]+/, "") : "") + "</span>";
            var h = document.getElementById("tm-help"); if (h) h.classList.toggle("active", !!devOpts.showHelp);
        }
    };
    window.closeTopMenu = function() { menu.classList.remove("open"); topBar.classList.remove("menu-open"); };
    document.addEventListener("mousedown", function(e) { if (menu.classList.contains("open") && !menu.contains(e.target) && e.target !== menuBtn) closeTopMenu(); }, true);
    document.addEventListener("keydown", function(e) { if (e.code === "Escape" && menu.classList.contains("open")) { closeTopMenu(); e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    document.body.appendChild(topBar);

    // ---------- Bottom palette dock ----------
    var dock = document.createElement("div");
    dock.id = "mario-maker-dock";
    dock.addEventListener("mousedown", stop);
    dock.addEventListener("click", stop);
    var dockItems = [
        { id: "box", icon: "🧱", label: "Block" }, { id: "grass_box", icon: "🌿", label: "Grass" },
        { id: "wall", icon: "🏰", label: "Wall" }, { id: "platform", icon: "➖", label: "1-way Plat." },
        { id: "ramp_right", icon: "🪜", label: "Stairs /" }, { id: "ramp_left", icon: "🪜", label: "Stairs \\" },
        { id: "slope_right", icon: "⛰", label: "Slope /" }, { id: "slope_left", icon: "⛰", label: "Slope \\" },
        { id: "slide_right", icon: "🛝", label: "Slide /" }, { id: "slide_left", icon: "🛝", label: "Slide \\" },
        { id: "bumper", icon: "⏫", label: "Bouncer" }, { id: "crate", icon: "📦", label: "Crate" },
        { id: "tnt", icon: "🧨", label: "TNT" }, { id: "bouncy_cube", icon: "💎", label: "Bouncy" },
        { id: "zombie", icon: "🧟", label: "Enemy" }, { id: "powerup", icon: "⚡", label: "Power-Up" }
    ];
    var dockHTML = '<div class="mm-label">DRAG<br>TO PLACE</div>';
    for (let i = 0; i < dockItems.length; i++) {
        var it = dockItems[i];
        dockHTML += '<div class="mm-tile ' + (i === 0 ? "selected" : "") + '" data-type="' + it.id + '" onmousedown="SummonManager.startPaletteDrag(\'' + it.id + '\', event)" title="Drag onto the map or click to select"><span class="mm-icon">' + it.icon + '</span><span>' + it.label + '</span></div>';
    }
    dockHTML += '<div class="mm-divider"></div><div class="mm-label">GRID<br><select id="dock-grid" class="dp-select" style="width:92px" onchange="SummonManager.setGridSnap(Number(this.value))">' +
        '<option value="40" selected>40px</option><option value="20">20px fine</option><option value="80">80px</option><option value="160">160px big</option><option value="0">Free</option></select></div>' +
        '<input type="hidden" id="dock-texture" value="brick"><button id="dock-grid-vis" class="dp-btn" onclick="SummonManager.toggleShowGrid()">📏 Show grid</button>';
    dock.innerHTML = dockHTML;
    document.body.appendChild(dock);

    // ---------- Panel ----------
    var panel = document.createElement("div");
    panel.id = "summon-panel";
    panel.addEventListener("mousedown", stop);
    panel.addEventListener("click", stop);
    panel.addEventListener("keydown", stop);
    panel.addEventListener("keyup", stop);

    panel.innerHTML = `
        <div class="dp-head"><b>🧪 Cheats &amp; tuning</b><span id="dp-live"></span><button class="dp-x" title="Close (Esc)" onclick="SummonManager.togglePanel()">✕</button></div>
        <div class="dp-tabs">
            <button class="dp-tab active" data-tab="build">🧱 Build</button>
            <button class="dp-tab" data-tab="inspect">🔍 Inspect</button>
            <button class="dp-tab" data-tab="game">🎮 Game</button>
            <button class="dp-tab" data-tab="objects">📋 Objects</button>
            <button class="dp-tab" data-tab="level">💾 Level</button>
        </div>
        <div class="dp-body">

        <!-- ================= BUILD ================= -->
        <div class="dp-page active" data-page="build">
            <div class="dp-section">
                <div class="dp-title"><span>Cursor mode</span><span id="sp-mode-hint">Click: Shoot | R-Click: Grab</span></div>
                <div class="dp-seg">
                    <button id="mode-shoot" class="active" onclick="SummonManager.setToolMode('shoot')">🔫 Play</button>
                    <button id="mode-place" onclick="SummonManager.setToolMode('place')">➕ Place</button>
                    <button id="mode-select" onclick="SummonManager.setToolMode('select')">✋ Edit</button>
                </div>
                <p class="dp-hint">Pick an item from the "Drag to place" dock (drag it out, or click it then use <b>Place</b>). In <b>Edit</b> mode drag objects, pull edge handles to resize, hold <kbd>Alt</kbd> to copy.</p>
            </div>
            <div class="dp-section">
                <div class="dp-title"><span>New object</span><span id="dp-size-label"></span></div>
                <div class="dp-row"><label>Width</label>
                    <input type="range" class="dp-range" id="sp-w-r" data-link="sp-w" min="40" max="2400" step="40" value="480">
                    <input type="number" id="sp-w" class="dp-num" data-link="sp-w-r" value="480" step="40" min="20" max="4000" onchange="SummonManager.spawnW = Number(this.value); DevUI.updateSizeLabels()"></div>
                <div class="dp-row"><label>Height</label>
                    <input type="range" class="dp-range" id="sp-h-r" data-link="sp-h" min="40" max="2400" step="40" value="80">
                    <input type="number" id="sp-h" class="dp-num" data-link="sp-h-r" value="80" step="40" min="20" max="4000" onchange="SummonManager.spawnH = Number(this.value); DevUI.updateSizeLabels()"></div>
                <div class="dp-row"><label>Colour</label><input type="color" id="sp-color" class="dp-color" value="#b84a27" onchange="SummonManager.spawnColor = this.value">
                    <button class="dp-btn" style="flex:1" data-act="spawnAtPlayer">⬇ Drop at player</button></div>
                <div class="dp-title" style="margin-top:10px"><span>Texture</span></div>
                <div class="dp-tex" id="dp-tex-grid"></div>
                <div class="dp-row" id="sp-zombie-row" style="display:none"><label>Enemy type</label>
                    <select id="sp-zombie-type" class="dp-select" onchange="SummonManager.spawnZombieType = this.value">${devOptionList(DEV_ENEMY_TYPES, "NORMAL")}</select></div>
                <div class="dp-row" id="sp-power-row" style="display:none"><label>Power-up</label>
                    <select id="sp-power-type" class="dp-select" onchange="SummonManager.spawnPowerType = this.value"></select></div>
                <div class="dp-row" id="sp-bounce-row" style="display:none"><label>Bounce</label>
                    <input type="range" class="dp-range" id="sp-bounce" min="10" max="40" step="1" value="24" oninput="SummonManager.spawnBounce = Number(this.value); this.nextElementSibling.textContent = this.value">
                    <span class="dp-val">24</span></div>
            </div>
        </div>

        <!-- ================= INSPECT ================= -->
        <div class="dp-page" data-page="inspect">
            <div class="dp-empty" id="sp-no-selection">Nothing selected.<br>Switch to <b>✋ Edit</b> mode and click an object,<br>or pick one from the <b>Objects</b> tab.</div>
            <div id="sp-inspector" style="display:none">
                <div class="dp-section">
                    <div class="dp-title"><span id="sp-insp-title">SELECTED</span>
                        <button class="sp-small-btn del" data-act="deleteSelected">🗑 Delete</button></div>
                    <div class="dp-row"><label>Position</label>
                        <input type="number" id="sp-edit-x" class="dp-num" step="20" onchange="SummonManager.updateSelectedProps()">
                        <input type="number" id="sp-edit-y" class="dp-num" step="20" onchange="SummonManager.updateSelectedProps()">
                        <button class="dp-btn" data-act="snapSelected" title="Snap to grid">▦</button></div>
                    <div class="dp-nudge" style="margin:6px 0 4px">
                        <span></span><button class="dp-btn" data-act="nudge" data-args="0,1">▲</button><span></span>
                        <button class="dp-btn" data-act="nudge" data-args="-1,0">◀</button><button class="dp-btn" data-act="nudge" data-args="0,-1">▼</button><button class="dp-btn" data-act="nudge" data-args="1,0">▶</button>
                    </div>
                </div>
                <div class="dp-section" id="sp-edit-size-row">
                    <div class="dp-row"><label>Width</label>
                        <input type="range" class="dp-range" id="sp-edit-w-r" data-link="sp-edit-w" min="20" max="3200" step="20">
                        <input type="number" id="sp-edit-w" class="dp-num" data-link="sp-edit-w-r" step="20" min="16" max="6000" onchange="SummonManager.updateSelectedProps()"></div>
                    <div class="dp-row"><label>Height</label>
                        <input type="range" class="dp-range" id="sp-edit-h-r" data-link="sp-edit-h" min="20" max="3200" step="20">
                        <input type="number" id="sp-edit-h" class="dp-num" data-link="sp-edit-h-r" step="20" min="16" max="6000" onchange="SummonManager.updateSelectedProps()"></div>
                    <div class="dp-row"><label>Colour</label><input type="color" id="sp-edit-color" class="dp-color" onchange="SummonManager.updateSelectedProps()">
                        <select id="sp-edit-texture" class="dp-select" onchange="SummonManager.updateSelectedProps()">${devOptionList(DEV_TEXTURES, "brick")}</select></div>
                    <div class="dp-row" id="sp-edit-bounce-row" style="display:none"><label>Bounce</label>
                        <input type="range" class="dp-range" id="sp-edit-bounce" min="10" max="40" step="1" oninput="if(SummonManager.selectedObject){SummonManager.selectedObject.bounceForce=Number(this.value);} this.nextElementSibling.textContent=this.value">
                        <span class="dp-val"></span></div>
                    <div class="dp-row" id="sp-edit-hp-row" style="display:none"><label>Health</label>
                        <input type="range" class="dp-range" id="sp-edit-hp" min="10" max="800" step="10" oninput="SummonManager.setSelectedHP(Number(this.value)); this.nextElementSibling.textContent=this.value">
                        <span class="dp-val"></span></div>
                </div>
                <div class="dp-section"><div class="dp-grid2">
                    <button class="dp-btn" id="sp-toggle-physics" data-act="togglePhysics">Toggle Physics</button>
                    <button class="dp-btn" data-act="duplicateSelected">📋 Duplicate</button>
                    <button class="dp-btn" id="sp-flip-btn" data-act="flipRamp" style="display:none">↔ Flip direction</button>
                    <select id="sp-kind-select" class="dp-select" onchange="SummonManager.setSelectedKind(this.value)" title="Structure type"><option value="stairs">Stairs</option><option value="slope">Slope</option><option value="slide">Slide</option><option value="wall">Wall</option><option value="platform">One-way platform</option><option value="block">Solid block</option></select>
                    <button class="dp-btn warn" id="sp-kill-btn" data-act="killSelected" style="display:none">☠ Kill</button>
                </div></div>
            </div>
        </div>

        <!-- ================= GAME ================= -->
        <div class="dp-page" data-page="game">
            <div class="dp-section" id="dp-own" style="display:none">
                <div class="dp-title"><span id="dp-own-title">This game</span></div>
                <div id="dp-own-rows"></div>
            </div>
            <div class="dp-section">
                <div class="dp-title"><span>Toggles</span><span id="dp-hidden-note" style="text-transform:none;letter-spacing:0;font-weight:600"></span></div>
                <div class="dp-toggles">
                    ${devToggle("God mode [V]", "", "Invincible, endless fuel", "god")}
                    ${devToggle("Co-op", "", "Two players (restarts the run)", "coop")}
                    ${devToggle("Waves running", "", "Pause enemy waves", "waves")}
                    ${devToggle("Jetpack", "", "Enable jetpacks", "jetpack")}
                    ${devToggle("Creative flight", "flight", "Double-tap jump to fly (W/S up and down) in any game")}
                    ${devToggle("Infinite ammo", "infiniteAmmo", "Unlimited bullets, no fuel drain or cooldowns")}
                    ${devToggle("Friendly fire", "friendlyFire", "Heroes can hurt each other")}
                    ${devToggle("Show hitboxes", "showHitboxes", "")}
                    ${devToggle("FPS counter", "showFPS", "")}
                    ${devToggle("Nav paths [P]", "", "Enemy pathfinding debug", "paths")}
                    ${devToggle("Controls help [H]", "showHelp", "")}
                    ${devToggle("Bouncy ragdolls", "bouncyRagdolls", "Bodies bounce like rubber")}
                </div>
            </div>
            <div class="dp-section">
                <div class="dp-title"><span>Tuning</span><button class="sp-small-btn" data-act="resetTuning">Reset</button></div>
                ${devSlider("Game speed", "timeScale", 0, 2, 0.05, "x", "0 = freeze, 1 = normal")}
                <div class="dp-row"><label>Zoom [+/-]</label><input type="range" class="dp-range" id="dp-zoom" min="0.55" max="1.9" step="0.05"><span class="dp-val" data-val="zoom"></span></div>
                ${devSlider("Spawn rate", "spawnRate", 0.2, 4, 0.1, "x")}
                ${devSlider("Max enemies", "maxEnemies", 1, 40, 1, "int")}
                ${devSlider("Enemy HP", "enemyHealth", 0.25, 5, 0.25, "x")}
                ${devSlider("Enemy damage", "enemyDamage", 0, 4, 0.25, "x")}
                ${devSlider("Player damage", "playerDamage", 0.25, 6, 0.25, "x")}
                ${devSlider("Power-up drops", "powerUpRate", 0, 4, 0.25, "x")}
                ${devSlider("Gravity", "gravityMult", 0.15, 2, 0.05, "x", "Low = moon jumps & floaty bodies")}
            </div>
            <div class="dp-section" data-need="waves">
                <div class="dp-title"><span>Waves</span></div>
                <div class="dp-grid3">
                    <button class="dp-btn" data-act="nextWave">⏭ Next wave</button>
                    <button class="dp-btn warn" data-act="clearEnemies">☠ Clear enemies</button>
                    <div class="dp-row" style="margin:0"><input type="number" id="dp-wave-num" class="dp-num" style="width:44px" value="5" min="1" max="99"><button class="dp-btn" style="flex:1;padding:8px 2px" data-act="gotoWave">Go</button></div>
                </div>
            </div>
            <div class="dp-section">
                <div class="dp-title"><span>Spawn</span></div>
                <div class="dp-row"><select id="dp-enemy-type" class="dp-select">${devOptionList(DEV_ENEMY_TYPES, "NORMAL")}</select>
                    <input type="number" id="dp-enemy-count" class="dp-num" style="width:52px" value="3" min="1" max="30"><button class="dp-btn" data-act="spawnEnemy">🧟 Spawn</button></div>
                <div class="dp-row"><select id="dp-power-type" class="dp-select"></select>
                    <button class="dp-btn" data-act="spawnPower">⚡ Spawn</button></div>
                <div class="dp-grid2">
                    <button class="dp-btn" data-act="spawnAllPowers">✨ Every power-up</button>
                    <button class="dp-btn good" data-act="giveAllPowers">🎁 Give all powers</button>
                </div>
            </div>
            <div class="dp-section">
                <div class="dp-title"><span>Heroes &amp; revive testing</span></div>
                <div class="dp-grid3">
                    <button class="dp-btn good" data-act="healAll">❤ Heal all</button>
                    <button class="dp-btn good" data-act="reviveAll">✚ Revive all</button>
                    <button class="dp-btn" data-act="clearPowers">Clear powers</button>
                    <button class="dp-btn good" data-act="refillAmmo">▮ Refill ammo</button>
                    <button class="dp-btn warn" data-act="downP1">Down P1</button>
                    <button class="dp-btn warn" data-act="downP2">Down P2</button>
                    <button class="dp-btn" data-act="bringP2">Bring P2</button>
                    <button class="dp-btn" data-act="tpToCursor">⌖ P1 → cursor</button>
                    <button class="dp-btn" data-act="addCoins">+1000 🪙</button>
                    <button class="dp-btn" data-act="levelUp">⭐ Level up</button>
                </div>
            </div>
            <div class="dp-section">
                <div class="dp-title"><span>Ragdoll toys</span></div>
                <div class="dp-grid3">
                    <button class="dp-btn" data-act="ragdollCannon" title="Fires bodies from the hero toward the cursor">💥 Body cannon</button>
                    <button class="dp-btn" data-act="ragdollEveryone" title="Every enemy gets launched into a ragdoll">🤸 Launch all</button>
                    <button class="dp-btn" data-act="ragdollRain" title="Drops a pile of dummies from the sky">🌧 Body rain</button>
                </div>
            </div>
            <div class="dp-section">
                <div class="dp-title"><span>Physics lab</span></div>
                <div class="dp-grid3">
                    <button class="dp-btn" data-act="rain">🌧 Rain crates</button>
                    <button class="dp-btn" data-act="jolt">⚡ Jolt all</button>
                    <button class="dp-btn warn" data-act="clearCrates">Clear crates</button>
                </div>
            </div>
        </div>

        <!-- ================= OBJECTS ================= -->
        <div class="dp-page" data-page="objects">
            <div class="dp-section">
                <div class="dp-title"><span>World objects (<span id="sp-obj-count">0</span>)</span></div>
                <input type="text" id="sp-obj-search" class="dp-text" style="width:100%;box-sizing:border-box" placeholder="Search by name…" oninput="SummonManager.refreshObjectList()">
                <div class="dp-chips" style="margin-top:8px">
                    <button class="active" data-filter="all">All</button><button data-filter="Stairs">Stairs</button><button data-filter="Slope">Slopes</button><button data-filter="Slide">Slides</button>
                    <button data-filter="Wall">Walls</button><button data-filter="Platform">Platforms</button><button data-filter="Block">Blocks</button>
                    <button data-filter="Bouncer">Bouncers</button><button data-filter="Physics">Physics</button><button data-filter="Enemy">Enemies</button>
                </div>
                <div id="sp-obj-list"></div>
            </div>
        </div>

        <!-- ================= LEVEL ================= -->
        <div class="dp-page" data-page="level">
            <div class="dp-section">
                <div class="dp-title"><span>Save / load</span></div>
                <div class="dp-row"><input type="text" id="dp-level-name" class="dp-text" value="My Custom Arena" placeholder="Level name">
                    <button class="dp-btn primary" data-act="saveLevel">💾 Save</button></div>
                <div class="dp-grid2">
                    <button class="dp-btn" data-act="newLevel">➕ New blank level</button>
                    <button class="dp-btn warn" data-act="stressLab">⚠ Stress lab</button>
                </div>
                <p class="dp-hint">Saved levels appear in the level drop-down at the top of the screen.</p>
            </div>
            <div class="dp-section">
                <div class="dp-title"><span>Import / export JSON</span></div>
                <textarea id="dp-json" class="dp-text" placeholder="Exported level JSON appears here. Paste JSON to import."></textarea>
                <div class="dp-grid2" style="margin-top:6px">
                    <button class="dp-btn" data-act="exportLevel">⬇ Export</button>
                    <button class="dp-btn" data-act="importLevel">⬆ Import</button>
                </div>
            </div>
            <div class="dp-section">
                <div class="dp-title"><span>Capture</span></div>
                <button class="dp-btn" style="width:100%" data-act="screenshot">📸 Save screenshot</button>
            </div>
        </div>

        </div>
        <div id="dp-toast"></div>
    `;
    document.body.appendChild(panel);

    // texture swatches + power-up lists
    var texGrid = document.getElementById("dp-tex-grid");
    var th = "";
    for (let i = 0; i < DEV_TEXTURES.length; i++) {
        th += '<button data-tex="' + DEV_TEXTURES[i][0] + '">' + DEV_TEXTURES[i][1] + "</button>";
    }
    texGrid.innerHTML = th;
    var plist = [];
    for (var k in PowerUpDefs) plist.push([k, PowerUpDefs[k].icon + " " + PowerUpDefs[k].label]);
    document.getElementById("sp-power-type").innerHTML = devOptionList(plist, "RAPID");
    document.getElementById("dp-power-type").innerHTML = devOptionList(plist, "RAPID");

    DevUI.bind(panel);
    DevUI.sync();
    DevUI.updateSizeLabels();
    DevUI.syncTextureSwatches();
    // the toast lives inside the panel; make sure it is not clipped
    document.body.appendChild(document.getElementById("dp-toast"));
};

SummonManager.toggleShowGrid = function() {
    this.showGrid = !this.showGrid;
    var btn = document.getElementById("dock-grid-vis");
    if (btn) btn.classList.toggle("primary", this.showGrid);
    DevUI.sync();
};

SummonManager.togglePanel = function() {
    this.isOpen = !this.isOpen;
    var panel = document.getElementById("summon-panel");
    var dock = document.getElementById("mario-maker-dock");
    var godBtn = document.getElementById("god-mode-btn");
    var devBtn = document.getElementById("summon-toggle-btn");

    if (this.isOpen) {
        panel.classList.add("open");
        dock.classList.add("open");
        godBtn.style.display = "flex";
        devBtn.classList.add("active");
        this.refreshLevelDropdown();
        this.refreshObjectList();
        DevUI.sync();
    } else {
        panel.classList.remove("open");
        dock.classList.remove("open");
        if (!godMode) godBtn.style.display = "none";
        devBtn.classList.remove("active");
        this.showGrid = false;
        this.setToolMode("shoot");
    }
};

SummonManager.setToolMode = function(mode) {
    this.toolMode = mode;
    ["shoot", "place", "select"].forEach(function(m) {
        var el = document.getElementById("mode-" + m);
        if (el) el.classList.toggle("active", m === mode);
    });
    var hint = document.getElementById("sp-mode-hint");
    if (hint) {
        hint.textContent = (mode == "shoot") ? "Click: shoot · R-click: grab" :
            (mode == "place") ? "Click: place · R-click: delete" : "Drag: move · edges: resize · Alt: copy";
    }
};

SummonManager.onPresetChange = function(type) {
    this.spawnType = type;
    var p = this.presets[type];
    if (p) {
        this.spawnW = p.w;
        this.spawnH = p.h;
        this.spawnColor = p.color;
        this.spawnTexture = p.texture || "solid";
        var set = function(id, v) { var el = document.getElementById(id); if (el) el.value = v; };
        set("sp-w", p.w); set("sp-w-r", p.w); set("sp-h", p.h); set("sp-h-r", p.h);
        set("sp-color", p.color); set("dock-texture", this.spawnTexture);
        if (p.bounce) { this.spawnBounce = p.bounce; set("sp-bounce", p.bounce); }
    }
    var show = function(id, on) { var el = document.getElementById(id); if (el) el.style.display = on ? "flex" : "none"; };
    show("sp-zombie-row", type == "zombie");
    show("sp-power-row", type == "powerup");
    show("sp-bounce-row", type == "bumper");
    DevUI.updateSizeLabels();
    DevUI.syncTextureSwatches();
};

SummonManager.spawnAt = function(worldX, worldY) {
    var num = function(id, fallback) { var el = document.getElementById(id); return Math.max(20, Number(el ? el.value : fallback) || fallback); };
    var w = num("sp-w", this.spawnW);
    var h = num("sp-h", this.spawnH);
    var rx = this.snapCenterForSize(worldX, w);
    var ry = this.snapCenterForSize(worldY, h);
    var colEl = document.getElementById("sp-color");
    var col = (colEl ? colEl.value : this.spawnColor) || this.spawnColor;
    var tex = (this.spawnTexture == "solid") ? null : this.spawnTexture;
    var created = null;
    var t = this.spawnType;

    if (t == "box" || t == "grass_box" || t == "wall" || t == "platform") {
        var bk = (t == "wall") ? "wall" : (t == "platform" ? "platform" : "block");
        created = Object.addBox(rx, ry, w, h, col, { name: bk == "wall" ? "Wall" : (bk == "platform" ? "One-way Platform" : "Block"), texture: tex, kind: bk });
    } else if (t == "ramp_right" || t == "ramp_left") {
        created = Object.addRamp(rx, ry, w, h, t == "ramp_right" ? "right" : "left", col, { name: "Stairs", texture: tex, kind: "stairs" });
    } else if (t == "slope_right" || t == "slope_left") {
        created = Object.addRamp(rx, ry, w, h, t == "slope_right" ? "right" : "left", col, { name: "Slope", texture: tex, kind: "slope" });
    } else if (t == "slide_right" || t == "slide_left") {
        created = Object.addRamp(rx, ry, w, h, t == "slide_right" ? "right" : "left", col, { name: "Slide", texture: null, kind: "slide" });
    } else if (t == "bumper") {
        created = Object.addBumper(rx, ry, w, h, this.spawnBounce || 24, col, { name: "Bounce Pad", texture: tex });
    } else if (t == "crate") {
        created = Object.addCrate(rx, ry, w, col, { w: w, h: h, name: "Crate", texture: tex || "crate_plank" });
    } else if (t == "tnt") {
        created = Object.addCrate(rx, ry, w, "#e84545", { w: w, h: h, explosive: true, name: "TNT Barrel" });
    } else if (t == "bouncy_cube") {
        created = Object.addCrate(rx, ry, w, col, { w: w, h: h, bounciness: -0.92, name: "Bouncy Cube", texture: tex || "neon_grid" });
    } else if (t == "zombie") {
        created = spawnZombie(this.spawnZombieType || "NORMAL", rx, ry);
    } else if (t == "powerup") {
        var pu = spawnPowerUp(rx, ry, this.spawnPowerType || "RAPID");
        pu.life = 3600;
        Components.spawnSparks(rx, ry, pu.color, 8);
    }

    if (created) {
        Components.spawnSparks(rx, ry, col, 8);
        Components.addFloatingText("PLACED", rx, ry + 40, "#ffdd44", 15);
        this.selectObject(created);
    }
    rebuildAllObjects();
    if (typeof Pathfinder !== "undefined") Pathfinder.rebuildGraph(true);
    this.refreshObjectList();
};

SummonManager.setSelectedKind = function(k) {
    var o = this.selectedObject;
    if (!o || o instanceof Character || o.movable || o.isBumper) return;
    if (o.isRamp && k !== "stairs" && k !== "slide" && k !== "slope") return;
    if (!o.isRamp && (k === "stairs" || k === "slide" || k === "slope")) return;
    o.kind = k;
    o._stepKey = null;
    Pathfinder.rebuildGraph(true);
    this.refreshObjectList();
};

SummonManager.setSelectedHP = function(v) {
    var o = this.selectedObject;
    if (o && o instanceof Character) { o.maxHealth = v; o.health = v; }
};

SummonManager.selectObject = function(obj) {
    this.selectedObject = obj;
    var insp = document.getElementById("sp-inspector");
    var empty = document.getElementById("sp-no-selection");
    if (!obj || obj.dead) {
        this.selectedObject = null;
        if (insp) insp.style.display = "none";
        if (empty) empty.style.display = "block";
        this.refreshObjectList();
        return;
    }
    if (insp) {
        insp.style.display = "block";
        if (empty) empty.style.display = "none";
        var val = function(id, v) { var el = document.getElementById(id); if (el) el.value = v; };
        var isChar = obj instanceof Character;
        document.getElementById("sp-insp-title").textContent = obj.name + "  #" + obj.id;
        val("sp-edit-x", Math.round(obj.x));
        val("sp-edit-y", Math.round(obj.y));
        var ow = Math.round(obj.w || obj.s1 || 100), oh = Math.round(obj.h || obj.s2 || 100);
        val("sp-edit-w", ow); val("sp-edit-w-r", ow);
        val("sp-edit-h", oh); val("sp-edit-h-r", oh);
        if (obj.color && obj.color.startsWith("#") && obj.color.length == 7) val("sp-edit-color", obj.color);
        val("sp-edit-texture", obj.texture || "solid");

        var disp = function(id, on) { var el = document.getElementById(id); if (el) el.style.display = on ? "" : "none"; };
        disp("sp-toggle-physics", !isChar);
        disp("sp-flip-btn", !!obj.isRamp);
        var ks = document.getElementById("sp-kind-select");
        if (ks) { ks.style.display = (!isChar && !obj.movable && !obj.isBumper) ? "" : "none"; ks.value = obj.kind || "block"; }
        disp("sp-kill-btn", isChar);
        var bounceRow = document.getElementById("sp-edit-bounce-row");
        if (bounceRow) {
            bounceRow.style.display = obj.isBumper ? "flex" : "none";
            if (obj.isBumper) { val("sp-edit-bounce", obj.bounceForce); bounceRow.querySelector(".dp-val").textContent = obj.bounceForce; }
        }
        var hpRow = document.getElementById("sp-edit-hp-row");
        if (hpRow) {
            hpRow.style.display = isChar ? "flex" : "none";
            if (isChar) { val("sp-edit-hp", obj.maxHealth); hpRow.querySelector(".dp-val").textContent = Math.round(obj.maxHealth); }
        }
        var physBtn = document.getElementById("sp-toggle-physics");
        if (physBtn && !isChar) physBtn.textContent = obj.movable ? "Freeze (static)" : "Enable physics";
        if (this.isOpen && this.toolMode == "select") DevUI.switchTab("inspect");
    }
    this.refreshObjectList();
};

SummonManager.toggleWavePause = function() {
    this.pauseWaves = !this.pauseWaves;
    DevUI.sync();
};

SummonManager.objFilter = "all";

SummonManager.refreshObjectList = function() {
    var listEl = document.getElementById("sp-obj-list");
    var countEl = document.getElementById("sp-obj-count");
    if (!listEl || !this.isOpen) return;

    var items = [];
    for (let i = movingObjects.length - 1; i >= 0; i--) {
        if (!movingObjects[i].dead) items.push({ obj: movingObjects[i], tag: movingObjects[i].explosive ? "TNT" : "Physics" });
    }
    for (let i = zombies.length - 1; i >= 0; i--) {
        if (!zombies[i].dead) items.push({ obj: zombies[i], tag: "Enemy" });
    }
    for (let i = staticObjects.length - 1; i >= 0; i--) {
        var so = staticObjects[i];
        if (so.dead) continue;
        var kd = so.kind || "block";
        items.push({ obj: so, tag: kd.charAt(0).toUpperCase() + kd.slice(1) });
    }

    var search = document.getElementById("sp-obj-search");
    var q = search ? search.value.trim().toLowerCase() : "";
    var f = this.objFilter || "all";
    items = items.filter(function(it) {
        if (f !== "all" && it.tag !== f && !(f === "Physics" && it.tag === "TNT")) return false;
        return !q || it.obj.name.toLowerCase().indexOf(q) !== -1;
    });

    if (countEl) countEl.textContent = items.length.toString();

    var maxShow = Math.min(items.length, 80);
    var html = "";
    for (let i = 0; i < maxShow; i++) {
        var o = items[i].obj;
        var isSel = (this.selectedObject && this.selectedObject.id === o.id);
        html += '<div class="sp-obj-item ' + (isSel ? "selected" : "") + '" onclick="SummonManager.selectById(' + o.id + ')">' +
            '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span class="sp-swatch" style="background:' + o.color + ';"></span><strong>' + o.name + '</strong> ' +
            '<span style="color:#8aa3b5;font-size:11px;">' + items[i].tag + " · " + Math.round(o.x) + ", " + Math.round(o.y) + '</span></div>' +
            '<button class="sp-small-btn del" onclick="event.stopPropagation();SummonManager.deleteById(' + o.id + ')">✕</button></div>';
    }
    if (items.length > maxShow) html += '<div class="dp-hint" style="text-align:center">+' + (items.length - maxShow) + " more - use search to narrow down</div>";
    listEl.innerHTML = html;
};

// Light-weight periodic sync so toggles reflect V / M / P hotkeys while the panel is open
setInterval(function() {
    if (typeof SummonManager !== "undefined" && SummonManager.isOpen) DevUI.sync();
}, 400);

// keeps the compact top bar honest a few times a second: player count, LAN status, paused / arcade state
function topBarRefresh() {
        // keep the open Cheats & tuning panel in step with the game that's on
        var sp = document.getElementById("summon-panel");
        if (sp && sp.classList.contains("open") && typeof DevUI !== "undefined" && DevUI.syncGame && !topBarRefresh.inSync) { topBarRefresh.inSync = true; try { DevUI.syncGame(sp); } catch (e) {} topBarRefresh.inSync = false; }
        var coopBtn = document.getElementById("coop-btn");
        if (coopBtn) {
            coopBtn.classList.toggle("active", multiplayer || brawl.active);
            var humans = characters.filter(function(c) { return c.isPlayer && !c.isCPU; }).length, cpus = characters.filter(function(c) { return c.isPlayer && c.isCPU; }).length;
            if (GameModes.flag("ownScreen", false) && GameModes.has("seats")) {          // full-screen games: count their seats
                humans = 0; cpus = 0;
                GameModes.call("seats").forEach(function(st) { if (st.count) cpus += st.value; else if (st.value === "human") humans++; else if (st.value === "cpu") cpus++; });
            }
            var ch = "👥 <b>" + humans + "</b>" + (cpus ? "<span style='opacity:.8'>+" + cpus + "🤖</span>" : "") + " <span class='lbl'>" + (humans === 1 ? "player" : "players") + "</span>";
            if (coopBtn.innerHTML !== ch) coopBtn.innerHTML = ch;
            coopBtn.title = humans + " human" + (humans === 1 ? "" : "s") + (cpus ? " + " + cpus + " CPU" : "") + " — click to change who's playing";
        }
        var lanBtn = document.getElementById("lan-btn");
        if (lanBtn && typeof Net !== "undefined") {
            var live = Net.role === "host" || Net.role === "client";
            lanBtn.classList.toggle("live", live);
            var lh = "📡 <span class='lbl'>" + (Net.role === "host" ? "Hosting · " + (Net.peerCount() + 1) : "LAN") + "</span>";
            if (lanBtn.innerHTML !== lh) lanBtn.innerHTML = lh;
        }
    document.body.classList.toggle("paused", typeof paused !== "undefined" && !!paused);
    document.body.classList.toggle("hub-open", typeof Hub !== "undefined" && !!Hub.isOpen);
}
