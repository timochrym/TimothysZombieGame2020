// ============================================================================
// MENUS - the UI shell shared by every game.
//
//   * ONE surface at a time: arcade hub, playing, or the pause menu. The HTML toolbar / dev panel / palette
//     dock are only visible while playing (body[data-ui]), so nothing ever stacks on top of a menu.
//   * The toolbar and the pause menu are built from what the CURRENT game declares, so Portal Lab never
//     shows waves or a "Frontier" button and Zombie Survival never shows a room picker.
//   * The pause menu is a tabbed tree:  Game | Players | Settings | Tools | Online
//   * One shared controls hint (H) replaces the per-game hint strips.
//
// A game describes its UI in its mode object (see ENGINE.md):
//   ui: { edit, dev, players, net, levelPicker, restart, enemies, help, toolbar() }
//   menuRows(over)  -> extra pause-menu rows:
//        { label, value, hint, cycle, toggle, act(dir), go(), tab: "game"|"players"|"tools" }
//   restartLabel    -> text of the standard "restart" row (default "Restart")
// ============================================================================

// ---- tiny persistence helper (JSON in localStorage, never throws) ----
var Store = {
    get: function(key, def) {
        try { var v = localStorage.getItem(key); return v === null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set: function(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
    },
    // merge a saved object into `target` (only keys that already exist there are accepted)
    load: function(key, target) {
        var v = this.get(key, null);
        if (v && typeof v === "object") for (var k in target) if (v[k] !== undefined) target[k] = v[k];
        return target;
    }
};

// ============================================================================
// UI - which surface is showing, what the current game supports, the toolbar
// ============================================================================
var UI = {
    surface: "",
    modeId: "",
    items: [],        // toolbar items for the current game
    bar: null,
    frame: 0,

    // what an engine flag means when a game does not set it (same defaults the engine code uses)
    FLAG_DEFAULTS: { waves: true, revive: true, jetpack: true, shooting: true, ability: true, ammo: true, coopToggle: true,
        dash: true, wallJump: true, scenery: true, playerControl: true, enemiesPassive: false, flight: false, noBedrock: false },
    UI_DEFAULTS: { edit: false, dev: true, players: true, net: true, levelPicker: true, restart: true, enemies: false },

    flagOn: function(name) { return !!GameModes.flag(name, this.FLAG_DEFAULTS[name]); },
    spec: function(name) {
        var u = GameModes.current && GameModes.current.ui;
        return (u && u[name] !== undefined) ? u[name] : this.UI_DEFAULTS[name];
    },

    // Requirement strings used by data-req="..." attributes in the dev panel and by the menus
    //   flag:waves   ui:edit   multi   enemies   !flag:waves (negation)   a,b (any of)
    has: function(req) {
        if (!req) return true;
        if (req.indexOf(",") !== -1) return req.split(",").some(function(r) { return UI.has(r.trim()); });
        var neg = req.charAt(0) === "!";
        if (neg) req = req.slice(1);
        var p = req.split(":"), ok = true;
        if (p[0] === "flag") ok = this.flagOn(p[1]);
        else if (p[0] === "ui") ok = !!this.spec(p[1]);
        else if (p[0] === "multi") ok = characters.length > 1;
        else if (p[0] === "enemies") ok = (this.flagOn("waves") && !this.flagOn("enemiesPassive")) || !!this.spec("enemies");
        else if (p[0] === "net") ok = typeof Net !== "undefined" && !!this.spec("net");
        return neg ? !ok : ok;
    },

    // "Crate Lab 1: Weighty Matters" under the title CRATE LAB -> "1: Weighty Matters"
    levelLabel: function(mode, name) {
        var n = String(name || "").replace(/^[^A-Za-z0-9]+/, "");
        var words = mode.title.toLowerCase().split(/\s+/), low = n.toLowerCase();
        for (let i = 0; i < words.length; i++) {
            if (low.indexOf(words[i]) === 0) { n = n.slice(words[i].length).replace(/^\s+/, ""); low = n.toLowerCase(); } else break;
        }
        return n.replace(/^[:\-·\s]+/, "");
    },

    currentSurface: function() {
        if (typeof Hub !== "undefined" && Hub.isOpen) return "hub";
        if (Menu.isOpen) return "pause";
        return "play";
    },

    // ---------------------------------------------------------------- DOM toolbar
    init: function() {
        var style = document.createElement("style");
        style.textContent = [
            "#ui-toolbar { position: fixed; top: 12px; right: 14px; z-index: 1000; display: flex; gap: 6px; align-items: center; user-select: none; font-family: 'Segoe UI', Arial, sans-serif; }",
            "#ui-toolbar .ui-chip { color: var(--chip, #7ff0b0); font-size: 12px; font-weight: 900; letter-spacing: .8px; padding: 0 6px 0 2px; text-transform: uppercase; text-shadow: 0 1px 4px #000; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
            "#ui-toolbar .ui-btn { background: var(--dp-bg, rgba(10,16,24,.94)); color: var(--dp-text, #e6f1f7); border: 1px solid var(--dp-line, rgba(130,180,210,.22)); padding: 7px 11px; font-size: 12.5px; font-weight: 700; border-radius: 10px; cursor: pointer; box-shadow: 0 5px 16px rgba(0,0,0,.4); font-family: inherit; white-space: nowrap; }",
            "#ui-toolbar .ui-btn:hover { border-color: var(--dp-accent, #22d3ee); transform: translateY(-1px); }",
            "#ui-toolbar .ui-btn.active { background: linear-gradient(135deg, #22d3ee, #3b82f6); color: #04121c; border-color: transparent; }",
            "#ui-toolbar .ui-btn.dev.active { background: linear-gradient(135deg, #ffd23f, #ff9f1c); color: #1a1205; }",
            "#ui-toolbar .ui-sep { width: 1px; height: 22px; background: var(--dp-line, rgba(130,180,210,.22)); margin: 0 2px; }",
            "#ui-toolbar .ui-pill { font-size: 11.5px; font-weight: 800; padding: 6px 10px; border-radius: 10px; background: rgba(34,197,94,.16); border: 1px solid rgba(34,197,94,.5); color: #86efac; }",
            "@media (max-width: 1000px) { #ui-toolbar .ui-lbl { display: none; } #ui-toolbar .ui-chip { display: none; } }",
            // only ever ONE surface: the DOM tools disappear behind the hub and the pause menu
            "body[data-ui='hub'] #ui-toolbar, body[data-ui='pause'] #ui-toolbar, body[data-ui='hub'] #summon-panel, body[data-ui='pause'] #summon-panel,",
            "body[data-ui='hub'] #mario-maker-dock, body[data-ui='pause'] #mario-maker-dock, body[data-ui='hub'] #dp-toast, body[data-ui='pause'] #dp-toast { display: none !important; }"
        ].join("\n");
        document.head.appendChild(style);

        var bar = document.createElement("div");
        bar.id = "ui-toolbar";
        var stop = function(e) { e.stopPropagation(); };
        bar.addEventListener("mousedown", stop);
        bar.addEventListener("click", stop);
        document.body.appendChild(bar);
        this.bar = bar;
        this.onModeChange();
    },

    // Toolbar = [game chip] [game actions] | [Dev] [Arcade] [Menu]
    buildItems: function() {
        var mode = GameModes.current;
        var items = [];
        var own = GameModes.call("toolbarItems");
        if (own) for (let i = 0; i < own.length; i++) items.push(own[i]);
        if (this.spec("dev")) items.push({ id: "dev", icon: "🛠", label: "Dev", title: "Developer tools for this game (B)", cls: "dev",
            run: function() { SummonManager.togglePanel(); }, active: function() { return SummonManager.isOpen; } });
        items.push({ id: "arcade", icon: "🕹", label: "Arcade", title: "Switch to another game", run: function() { Hub.openHub(false); } });
        items.push({ id: "menu", icon: "☰", label: "Menu", title: "Pause menu (Esc)", run: function() { Menu.open(false); } });
        return items;
    },

    onModeChange: function() {
        if (!this.bar) return;
        var mode = GameModes.current;
        this.modeId = mode ? mode.id : "";
        this.items = this.buildItems();
        var bar = this.bar;
        bar.innerHTML = "";
        bar.style.setProperty("--chip", (mode && mode.color) || "#7ff0b0");
        var chip = document.createElement("span");
        chip.className = "ui-chip";
        chip.id = "ui-chip";
        bar.appendChild(chip);
        for (let i = 0; i < this.items.length; i++) {
            var it = this.items[i];
            if (it.id === "dev") { var sep = document.createElement("span"); sep.className = "ui-sep"; bar.appendChild(sep); }
            var b = document.createElement("button");
            b.className = "ui-btn" + (it.cls ? " " + it.cls : "");
            b.id = "ui-btn-" + it.id;
            b.title = it.title || "";
            b.addEventListener("click", (function(item) { return function(e) { e.stopPropagation(); item.run(); this.blur(); UI.refresh(true); }; })(it));
            it.el = b;
            it._txt = null;
            bar.appendChild(b);
        }
        var pill = document.createElement("span");
        pill.className = "ui-pill";
        pill.id = "ui-net";
        pill.style.display = "none";
        bar.insertBefore(pill, bar.children[1]);
        this.refresh(true);
        if (typeof DevUI !== "undefined" && DevUI.applyContext) DevUI.applyContext();
    },

    // keep labels / active states current (cheap: text only touched when it changed)
    refresh: function(force) {
        if (!this.bar) return;
        var mode = GameModes.current;
        for (let i = 0; i < this.items.length; i++) {
            var it = this.items[i];
            var lbl = (typeof it.label === "function") ? it.label() : it.label;
            var html = (it.icon ? it.icon + " " : "") + '<span class="ui-lbl">' + lbl + "</span>";
            if (force || it._txt !== html) { it.el.innerHTML = html; it._txt = html; }
            if (it.active) it.el.classList.toggle("active", !!it.active());
        }
        var chip = document.getElementById("ui-chip");
        if (chip && mode) {
            var lv = LevelManager.getCurrentLevel();
            var t = mode.title + (lv && lv.name && GameModes.modeOf(lv) === mode.id && mode.id !== "survival" ? "" : "");
            if (chip.textContent !== t) chip.textContent = t;
            chip.title = lv ? lv.name : "";
        }
        var pill = document.getElementById("ui-net");
        if (pill) {
            var txt = (typeof Net !== "undefined") ? Net.pillText() : "";
            pill.style.display = txt ? "" : "none";
            if (txt && pill.textContent !== txt) pill.textContent = txt;
        }
    },

    // called every frame; touches the DOM only when something changed
    sync: function() {
        var s = this.currentSurface();
        if (s !== this.surface) {
            this.surface = s;
            document.body.setAttribute("data-ui", s);
            if (s === "play") this.refresh(true);
        }
        if (++this.frame % 20 === 0 && s === "play") this.refresh(false);
    }
};

// ============================================================================
// HELP - one shared "controls" hint, declared by each game (mode.ui.help)
//   help: [["WASD", "move"], ["F", "shoot"], ...]   or   [{ title: "P1", color, items: [[k, a], ...] }, ...]
//   (a function returning either is fine, e.g. to show two groups in co-op)
// ============================================================================
var Help = {
    timer: 0,
    cache: null,

    reset: function() { this.timer = devOpts.showHelp ? 60 * 12 : 0; this.cache = null; },
    toggle: function() { this.timer = this.timer > 0 ? 0 : 60 * 14; },

    groups: function() {
        var h = UI.spec("help");
        if (typeof h === "function") h = h();
        if (!h || !h.length) return [];
        if (Array.isArray(h[0])) return [{ title: "", items: h }];
        return h;
    },

    // columns (one per group) of [key chip] action rows
    layout: function(groups) {
        var key = GameModes.current.id + "|" + groups.map(function(g) { return g.title + g.items.length + g.items[0][1]; }).join("|");
        if (this.cache && this.cache.key === key) return this.cache;
        ctx.save();
        var cols = [], totalW = 28 + (groups.length - 1) * 24, maxH = 0;
        for (let g = 0; g < groups.length; g++) {
            var grp = groups[g], km = 0, am = 0;
            for (let i = 0; i < grp.items.length; i++) {
                ctx.font = "800 11px " + UI_FONT; km = Math.max(km, ctx.measureText(grp.items[i][0]).width);
                ctx.font = "600 12px " + UI_FONT; am = Math.max(am, ctx.measureText(grp.items[i][1]).width);
            }
            var col = { title: grp.title, color: grp.color || "#7ff0ff", items: grp.items, kw: km + 14, w: km + 14 + 8 + am, h: (grp.title ? 26 : 0) + grp.items.length * 22 };
            cols.push(col);
            totalW += col.w;
            maxH = Math.max(maxH, col.h);
        }
        ctx.restore();
        this.cache = { key: key, cols: cols, w: totalW, h: maxH + 20 };
        return this.cache;
    },

    draw: function() {
        if (Menu.isOpen) return;
        var groups = this.groups();
        if (!groups.length) return;
        if (this.timer <= 0) {
            uiText("H · controls", cssW / 2, cssH - 10, 11, "rgba(200,220,235,0.5)", "center", "600");
            return;
        }
        this.timer--;
        var L = this.layout(groups);
        var px = 14, py = Math.max(150, Math.min(cssH / 2 - L.h / 2, cssH - L.h - 230));
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.timer / 50);
        uiPanel(px, py, L.w, L.h, "rgba(120,170,200,0.4)", 0.82);
        var x = px + 14;
        for (let c = 0; c < L.cols.length; c++) {
            var col = L.cols[c], y = py + 22;
            if (col.title) { uiText(col.title, x, y, 12, col.color, "left", "900"); y += 26; }
            for (let i = 0; i < col.items.length; i++) {
                ctx.fillStyle = "rgba(255,255,255,0.14)";
                uiRoundRect(x, y - 14, col.kw, 19, 5);
                ctx.fill();
                uiText(col.items[i][0], x + col.kw / 2, y, 11, "#ffffff", "center", "800");
                uiText(col.items[i][1], x + col.kw + 8, y, 12, "#cbd9e4", "left", "600");
                y += 22;
            }
            x += col.w + 24;
        }
        ctx.restore();
    }
};

// ============================================================================
// MENU - the tabbed pause / game-over menu (canvas drawn; mouse, keyboard and gamepad)
// ============================================================================
var paused = false;             // true while the simulation is frozen behind the menu
var pauseFromGameOver = false;  // kept for older code; same as Menu.over

var Menu = {
    isOpen: false,
    over: false,
    tab: 0,
    row: 0,
    scroll: 0,
    levelIdx: 0,
    levelKeys: [],
    confirm: null,       // { title, label, yes() } while a yes/no question is showing
    snap: null,
    rects: [],
    tabRects: [],
    tabsNow: [],

    // while a LAN match is live the world keeps running behind the menu
    freezes: function() { return !(typeof Net !== "undefined" && Net.live()); },

    open: function(over) {
        this.over = !!over;
        pauseFromGameOver = this.over;
        this.confirm = null;
        this.tab = 0; this.row = 0; this.scroll = 0;
        this.levelKeys = [];
        var all = LevelManager.getAllLevels();
        for (var k in all) if (GameModes.modeOf(all[k]) === GameModes.current.id) this.levelKeys.push(k);
        this.levelIdx = Math.max(0, this.levelKeys.indexOf(LevelManager.currentLevelKey));
        this.isOpen = true;
        paused = this.freezes();
        this.snap = null;
        if (paused) {
            this.snap = document.createElement("canvas");
            this.snap.width = canvas.width;
            this.snap.height = canvas.height;
            this.snap.getContext("2d").drawImage(canvas, 0, 0);
        }
        for (let i = 0; i < PlayerInput.length; i++) PlayerInput[i].shoot = PlayerInput[i].jet = PlayerInput[i].interact = false;
        UI.sync();
    },

    close: function() {
        this.isOpen = false;
        this.confirm = null;
        this.snap = null;
        paused = false;
        UI.sync();
    },

    toggle: function() { if (this.isOpen) this.close(); else this.open(false); },

    // Esc / gamepad B: cancel a question, otherwise close
    back: function() {
        if (this.confirm) { this.confirm = null; this.row = 0; return; }
        this.close();
    },

    restart: function() {
        if (GameModes.has("onRestart")) { GameModes.call("onRestart"); return; }
        if (brawl.active && LevelManager.currentLevelKey !== brawlCfg.stage) LevelManager.selectLevel(brawlCfg.stage);
        else resetGame();
    },

    ask: function(title, label, yes) { this.confirm = { title: title, label: label, yes: yes }; this.row = 1; },

    // ---------------------------------------------------------------- content
    buildTabs: function() {
        var mode = GameModes.current, over = this.over;
        var extra = GameModes.call("menuRows", over) || [];
        var pick = function(tab) { return extra.filter(function(r) { return (r.tab || "game") === tab; }); };
        var self = this, tabs = [];

        // ---- GAME ----
        var game = [];
        game.push(over
            ? { label: mode.againLabel || "Play again", hint: "Start a fresh run", act: function() { self.close(); self.restart(); } }
            : { label: "Resume", hint: "Esc", act: function() { self.close(); } });
        game = game.concat(pick("game"));
        if (UI.spec("levelPicker") && this.levelKeys.length > 1) {
            game.push({ label: "Level", cycle: true, icon: "🗺",
                value: function() { var l = LevelManager.getAllLevels()[self.levelKeys[self.levelIdx]]; return l ? l.name : "?"; },
                hint: "◀ ▶ choose, Enter loads it",
                act: function(d) { self.levelIdx = (self.levelIdx + d + self.levelKeys.length) % self.levelKeys.length; },
                go: function() { var k = self.levelKeys[self.levelIdx]; self.close(); LevelManager.selectLevel(k); } });
        }
        if (!over && UI.spec("restart")) {
            var rl = mode.restartLabel || "Restart";
            game.push({ label: rl, icon: "↻", hint: "Asks for confirmation", danger: true, act: function() { self.ask("RESTART?", rl, function() { self.close(); self.restart(); }); } });
        }
        game.push({ label: "Arcade - switch game", icon: "🕹", hint: "Pick any game made with this engine", act: function() { self.close(); Hub.openHub(false); } });
        tabs.push({ id: "game", icon: "🎮", label: "Game", rows: game });

        // ---- PLAYERS ----
        if (UI.spec("players")) {
            var pl = [];
            if (UI.flagOn("coopToggle") && !brawl.active) {
                pl.push({ label: "Players", cycle: true, icon: "👥", value: function() { return multiplayer ? "2-player co-op" : "Solo"; },
                    hint: "Switching restarts the run", act: function() { self.close(); toggleMultiplayer(); } });
            }
            pl = pl.concat(pick("players"));
            pl.push({ label: "Player 1 character", cycle: true, preview: 0, value: function() { return skinName(heroSkins[0]); }, hint: "◀ ▶ - applies instantly", act: function(d) { cycleSkin(0, d); } });
            var humanP2 = characters.some(function(c) { return c.playerIndex === 1 && !c.isCPU; });
            if (multiplayer || humanP2) {
                pl.push({ label: "Player 2 character", cycle: true, preview: 1, value: function() { return skinName(heroSkins[1]); }, hint: "◀ ▶ - applies instantly", act: function(d) { cycleSkin(1, d); } });
            }
            var pads = (Pads.state[0] && Pads.state[0].active ? 1 : 0) + (Pads.state[1] && Pads.state[1].active ? 1 : 0);
            pl.push({ info: true, label: pads ? ("🎮 " + pads + " controller" + (pads > 1 ? "s" : "") + " connected - pad 1 plays P1" + (pads > 1 ? ", pad 2 plays P2" : "")) : "🎮 Plug in a controller any time - it joins automatically" });
            tabs.push({ id: "players", icon: "👥", label: "Players", rows: pl });
        }

        // ---- SETTINGS ----
        var st = [
            { header: "AUDIO" },
            { label: "Sound volume", cycle: true, value: function() { return settings.volume <= 0 ? "OFF" : Math.round(settings.volume * 100) + "%"; },
              act: function(d) { SFX.setVolume(Math.max(0, Math.min(1, Math.round((settings.volume + d * 0.1) * 10) / 10))); } },
            { header: "DISPLAY" },
            { label: "Screen shake", cycle: true, value: function() { return Math.round(settings.shake * 100) + "%"; }, hint: "0% turns it off",
              act: function(d) { settings.shake = Math.max(0, Math.min(1, Math.round((settings.shake + d * 0.25) * 4) / 4)); saveSettings(); } },
            { label: "Hit-stop on big hits", toggle: function() { return settings.hitStop; }, act: function() { settings.hitStop = !settings.hitStop; saveSettings(); } },
            { label: "Sharp hi-DPI graphics", toggle: function() { return settings.hiDPI; }, hint: "Turn off if the game runs slowly",
              value: function() { return renderScaleAutoReduced ? "auto-reduced" : ""; },
              act: function() { settings.hiDPI = !settings.hiDPI; renderScaleAutoReduced = false; saveSettings(); applyCanvasSize(); xcMaster = w / 2; ycMaster = h / 2; } },
            { label: "Glow effects", toggle: function() { return settings.glow; }, hint: "Turn off for more FPS on slower computers",
              value: function() { return glowAutoDisabled ? "auto-reduced" : ""; },
              act: function() { settings.glow = !settings.glow; glowAutoDisabled = false; saveSettings(); } },
            { label: "FPS counter", toggle: function() { return devOpts.showFPS; }, act: function() { devOpts.showFPS = !devOpts.showFPS; } },
            { header: "HELP" },
            { label: "Show controls hint at start", toggle: function() { return devOpts.showHelp; }, hint: "Press H any time to show or hide it",
              act: function() { devOpts.showHelp = !devOpts.showHelp; Help.timer = devOpts.showHelp ? 60 * 14 : 0; } }
        ];
        tabs.push({ id: "settings", icon: "⚙", label: "Settings", rows: st });

        // ---- TOOLS ----
        if (UI.spec("dev")) {
            var tl = [];
            tl.push({ label: "Developer panel", icon: "🛠", hint: "Same as pressing B", act: function() { self.close(); if (!SummonManager.isOpen) SummonManager.togglePanel(); } });
            tl.push({ label: "God mode", toggle: function() { return godMode; }, hint: "Invincible, endless fuel (V)", act: function() { SummonManager.toggleGodMode(); } });
            tl.push({ label: "Creative flight", toggle: function() { return !!devOpts.flight; }, hint: "Double-tap jump to fly", act: function() { devOpts.flight = !devOpts.flight; } });
            tl.push({ label: "Game speed", cycle: true, value: function() { return devOpts.timeScale.toFixed(2).replace(/\.?0+$/, "") + "x"; },
                act: function(d) { var s = [0.25, 0.5, 1, 1.5, 2], i = s.indexOf(devOpts.timeScale); if (i < 0) i = 2; devOpts.timeScale = s[Math.max(0, Math.min(s.length - 1, i + d))]; } });
            tl.push({ label: "Show hitboxes", toggle: function() { return devOpts.showHitboxes; }, act: function() { devOpts.showHitboxes = !devOpts.showHitboxes; } });
            tl = tl.concat(pick("tools"));
            tabs.push({ id: "tools", icon: "🛠", label: "Tools", rows: tl });
        }

        // ---- ONLINE ----
        if (UI.has("net") && !over) tabs.push({ id: "online", icon: "🌐", label: "Online", rows: Net.menuRows() });

        return tabs;
    },

    rowsNow: function() {
        if (this.confirm) {
            var c = this.confirm, self = this;
            return [
                { label: "No - go back", act: function() { self.confirm = null; self.row = 0; } },
                { label: "Yes - " + c.label.toLowerCase(), danger: true, act: function() { var y = c.yes; self.confirm = null; y(); } }
            ];
        }
        var tabs = this.buildTabs();
        this.tabsNow = tabs;
        if (this.tab >= tabs.length) this.tab = 0;
        return tabs[this.tab].rows;
    },

    val: function(v) { return typeof v === "function" ? v() : v; },
    selectable: function(r) { return !r.header && !r.info && !r.disabled; },

    move: function(dir) {
        var rows = this.rowsNow(), n = rows.length, i = this.row;
        for (let s = 0; s < n; s++) {
            i = (i + dir + n) % n;
            if (this.selectable(rows[i])) { this.row = i; break; }
        }
        if (typeof SFX !== "undefined") SFX.play("ui");
    },

    switchTab: function(dir) {
        if (this.confirm) return;
        this.rowsNow();
        var n = this.tabsNow.length;
        this.tab = (this.tab + dir + n) % n;
        this.row = 0; this.scroll = 0;
        var rows = this.rowsNow();
        while (this.row < rows.length - 1 && !this.selectable(rows[this.row])) this.row++;
        if (typeof SFX !== "undefined") SFX.play("ui");
    },

    // Enter / click on the row body
    activate: function(row, dir) {
        if (!row || !this.selectable(row)) return;
        if (typeof SFX !== "undefined") SFX.play("select");
        if (row.cycle) { if (dir) row.act(dir); else if (row.go) row.go(); else row.act(1); }
        else row.act(dir || 0);
    },

    key: function(e) {
        var c = e.code, rows = this.rowsNow();
        if (this.row >= rows.length || !this.selectable(rows[this.row])) { this.row = 0; while (this.row < rows.length - 1 && !this.selectable(rows[this.row])) this.row++; }
        var row = rows[this.row];
        if (c === "ArrowUp" || c === "KeyW") this.move(-1);
        else if (c === "ArrowDown" || c === "KeyS") this.move(1);
        else if (c === "ArrowLeft" || c === "KeyA") { if (row && row.cycle) this.activate(row, -1); else this.switchTab(-1); }
        else if (c === "ArrowRight" || c === "KeyD") { if (row && row.cycle) this.activate(row, 1); else this.switchTab(1); }
        else if (c === "KeyQ") this.switchTab(-1);
        else if (c === "KeyE" || c === "Tab") this.switchTab(e.shiftKey ? -1 : 1);
        else if (c === "Enter" || c === "NumpadEnter" || c === "Space") this.activate(row, 0);
        else if (/^Digit[1-9]$/.test(c) && !this.confirm) { var t = +c.slice(5) - 1; if (t < this.tabsNow.length) { this.tab = t; this.row = 0; this.scroll = 0; } }
        if (e.preventDefault) e.preventDefault();
    },

    hover: function(mx, my) {
        for (let i = 0; i < this.rects.length; i++) {
            var r = this.rects[i];
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) { this.row = r.i; return; }
        }
    },

    click: function(mx, my) {
        for (let i = 0; i < this.tabRects.length; i++) {
            var t = this.tabRects[i];
            if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) { this.tab = t.i; this.row = 0; this.scroll = 0; if (typeof SFX !== "undefined") SFX.play("ui"); return true; }
        }
        var rows = this.rowsNow();
        for (let i = 0; i < this.rects.length; i++) {
            var r = this.rects[i];
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                this.row = r.i;
                var row = rows[r.i], dir = 0;
                if (row && row.cycle) { var rel = (mx - r.x) / r.w; dir = rel > 0.82 ? 1 : (rel > 0.6 ? -1 : 0); }
                this.activate(row, dir);
                return true;
            }
        }
        return false;
    },

    wheel: function(dy) { this.scroll = Math.max(0, this.scroll + (dy > 0 ? 50 : -50)); },

    // ---------------------------------------------------------------- drawing
    draw: function() {
        ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
        if (this.snap) ctx.drawImage(this.snap, 0, 0, cssW, cssH);
        ctx.fillStyle = "rgba(4, 8, 14, 0.74)";
        ctx.fillRect(0, 0, cssW, cssH);

        var mode = GameModes.current, rows = this.rowsNow();
        if (this.row >= rows.length) this.row = 0;
        var accent = this.over ? "#ff4d5e" : (mode.color || "#22d3ee");
        var W = Math.min(700, cssW - 24);
        var hasTabs = !this.confirm && this.tabsNow.length > 1;
        var headH = 92 + (hasTabs ? 46 : 0), footH = 34, rowH = 46;
        var maxList = Math.max(150, cssH - 24 - headH - footH);
        var rowsH = 0;
        for (let i = 0; i < rows.length; i++) rowsH += rows[i].header ? 30 : rowH;
        var listH = Math.min(rowsH, maxList);
        var PH = headH + listH + footH;
        var X = cssW / 2 - W / 2, Y = Math.max(12, cssH / 2 - PH / 2);
        uiPanel(X, Y, W, PH, accent, 0.97);

        // title + subtitle (always about the game you are in)
        var title = this.confirm ? this.confirm.title : (this.over ? (mode.overTitle || "GAME OVER") : "PAUSED");
        uiText(title, cssW / 2, Y + 46, 38, this.over ? "#ff4d5e" : "#ffd23f", "center", "900");
        var lvl = LevelManager.getCurrentLevel();
        var sub = GameModes.has("overSub") && this.over ? GameModes.call("overSub", true) : (mode.title + (lvl && lvl.name && mode.id !== "brawl" ? "  ·  " + UI.levelLabel(mode, lvl.name) : ""));
        uiText(sub, cssW / 2, Y + 72, 14, "#a8c0d0", "center", "700");

        // tabs
        this.tabRects = [];
        if (hasTabs) {
            var tabs = this.tabsNow, tw = (W - 36) / tabs.length, ty = Y + 86;
            for (let i = 0; i < tabs.length; i++) {
                var tx = X + 18 + i * tw, on = i === this.tab;
                ctx.save();
                ctx.fillStyle = on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)";
                uiRoundRect(tx + 2, ty, tw - 4, 34, 10);
                ctx.fill();
                if (on) { ctx.fillStyle = accent; ctx.fillRect(tx + 14, ty + 31, tw - 28, 3); }
                ctx.restore();
                uiText(tabs[i].icon + " " + tabs[i].label, tx + tw / 2, ty + 23, 14, on ? "#ffffff" : "#8aa3b5", "center", "800");
                this.tabRects.push({ x: tx, y: ty, w: tw, h: 34, i: i });
            }
        }

        // rows (scrollable)
        var LX = X + 18, LW = W - 36, LY = Y + headH;
        var y = 0, selTop = 0, selBot = 0;
        for (let i = 0; i < rows.length; i++) {
            var rh = rows[i].header ? 30 : rowH;
            if (i === this.row) { selTop = y; selBot = y + rh; }
            y += rh;
        }
        if (selTop < this.scroll) this.scroll = selTop;
        if (selBot > this.scroll + listH) this.scroll = selBot - listH;
        this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, rowsH - listH)));

        ctx.save();
        ctx.beginPath();
        ctx.rect(LX - 6, LY, LW + 12, listH);
        ctx.clip();
        this.rects = [];
        y = 0;
        for (let i = 0; i < rows.length; i++) {
            var r = rows[i], rh2 = r.header ? 30 : rowH, ry = LY + y - this.scroll;
            y += rh2;
            if (ry + rh2 < LY || ry > LY + listH) continue;
            if (r.header) { uiText(r.header, LX + 6, ry + 21, 11, "#7ea0b8", "left", "900"); continue; }
            if (r.info) { uiText(this.val(r.label), cssW / 2, ry + 28, 12, "#8aa3b5", "center", "600"); continue; }
            var sel = i === this.row;
            ctx.fillStyle = sel ? "rgba(34,211,238,0.20)" : "rgba(255,255,255,0.05)";
            uiRoundRect(LX, ry + 2, LW, rowH - 6, 11);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = sel ? (r.danger ? "#ff6b7a" : accent) : "rgba(255,255,255,0.07)";
            ctx.stroke();
            var lx = LX + 16;
            if (r.preview !== undefined) { drawSkinPreview(heroSkins[r.preview], LX + 36, ry + (rowH - 6) / 2 + 2, 34, r.preview === 0 ? "#ff5a5f" : "#3da5ff", "P" + (r.preview + 1)); lx = LX + 66; }
            else if (r.icon) { uiText(r.icon, lx, ry + 29, 17, "#fff", "left", "700"); lx += 30; }
            var disabled = !!r.disabled;
            uiText(this.val(r.label), lx, ry + 29, 17, disabled ? "#64748b" : (sel ? "#ffffff" : "#c3d5e2"), "left", "800");
            // right side: value with arrows / switch
            var rx = LX + LW - 16;
            if (r.toggle) {
                var on2 = !!r.toggle();
                var vtxt = this.val(r.value);
                if (vtxt) uiText(vtxt, rx - 54, ry + 28, 11, "#8aa3b5", "right", "600");
                ctx.fillStyle = on2 ? accent : "rgba(255,255,255,0.18)";
                uiRoundRect(rx - 40, ry + 12, 40, 20, 10); ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(rx - (on2 ? 10 : 30), ry + 22, 7, 0, Math.PI * 2); ctx.fill();
            } else if (r.cycle) {
                uiText("▶", rx, ry + 29, 15, sel ? accent : "#5f7385", "right", "900");
                uiText(String(this.val(r.value) || ""), rx - 24, ry + 29, 15, "#ffd23f", "right", "800");
                var vw = (function(t) { ctx.save(); ctx.font = "800 15px " + UI_FONT; var m = ctx.measureText(t).width; ctx.restore(); return m; })(String(this.val(r.value) || ""));
                uiText("◀", rx - 24 - vw - 12, ry + 29, 15, sel ? accent : "#5f7385", "right", "900");
            }
            if (sel && r.hint) {
                var hint = this.val(r.hint);
                uiText(hint, cssW / 2, LY + listH + 20, 12, "#7ff0ff", "center", "600");
            }
            this.rects.push({ x: LX, y: Math.max(ry, LY), w: LW, h: rowH - 4, i: i });
        }
        ctx.restore();
        if (rowsH > listH) {
            var barH = Math.max(30, listH * listH / rowsH), barY = LY + (listH - barH) * (this.scroll / (rowsH - listH));
            ctx.fillStyle = "rgba(255,255,255,0.22)"; uiRoundRect(X + W - 10, barY, 4, barH, 2); ctx.fill();
        }
        // footer: selected hint (above) or key legend
        var selRow = rows[this.row];
        if (!(selRow && selRow.hint)) uiText("↑ ↓ select    ← → change    Enter confirm    Q / E tabs    Esc " + (this.over ? "close" : "resume"), cssW / 2, LY + listH + 20, 12, "#8ba2b4", "center", "600");
    }
};

// wheel scrolls long menus
window.addEventListener("wheel", function(e) { if (Menu.isOpen) { Menu.wheel(e.deltaY); e.preventDefault(); } }, { passive: false });

// ---- compatibility names used by game files and the key handler ----
function openPause(over) { Menu.open(over); }
function closePause() { Menu.close(); }
function togglePause() { Menu.toggle(); }
