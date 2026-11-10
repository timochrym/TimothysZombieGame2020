// ============================================================================
// CONTROLS - remap keyboard keys (P1 and P2) and gamepad buttons (Settings -> Controls).
//   Works as a thin translation layer: a pressed key is turned into the DEFAULT key of the action it is bound to
//   before the normal key handler sees it, so every game keeps reading the same keys. Gamepad buttons work the same
//   way (logical button -> the physical button you chose). Saved in localStorage.
// ============================================================================
var KEY_ACTIONS = [
    // [id, label, default code]
    ["p1up", "P1 jump / up", "KeyW"], ["p1left", "P1 left", "KeyA"], ["p1down", "P1 down", "KeyS"], ["p1right", "P1 right", "KeyD"],
    ["p1shoot", "P1 shoot", "KeyF"], ["p1jet", "P1 jetpack", "Space"], ["p1dash", "P1 dash", "ShiftLeft"], ["p1ability", "P1 shockwave / use", "KeyE"],
    ["p1grab", "P1 grab & throw", "KeyG"], ["p1reload", "P1 reload", "KeyX"],
    ["p2up", "P2 jump / up", "ArrowUp"], ["p2left", "P2 left", "ArrowLeft"], ["p2down", "P2 down", "ArrowDown"], ["p2right", "P2 right", "ArrowRight"],
    ["p2shoot", "P2 shoot", "Enter"], ["p2jet", "P2 jetpack", "Period"], ["p2dash", "P2 dash", "ShiftRight"], ["p2ability", "P2 shockwave / use", "Slash"],
    ["p2grab", "P2 grab & throw", "Comma"], ["p2reload", "P2 reload", "Quote"]
];
var PAD_ACTIONS = [
    // [id, label, default (standard-mapping) button index]
    ["jump", "Jump", 0], ["shoot", "Shoot", 7], ["jet", "Jetpack", 5], ["run", "Dash / run", 1], ["run2", "Dash / run (alt)", 2], ["punch", "Punch", 6], ["use", "Use / shockwave", 3]
];
var PAD_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "Back", "Start", "L-stick", "R-stick", "D-up", "D-down", "D-left", "D-right", "Home"];

var KeyMap = {
    binds: {}, pad: {}, map: {}, padMap: {},
    load: function() {
        try { var s = JSON.parse(localStorage.getItem("timsControls") || "null"); if (s) { this.binds = s.binds || {}; this.pad = s.pad || {}; } } catch (e) {}
        this.rebuild();
    },
    save: function() { try { localStorage.setItem("timsControls", JSON.stringify({ binds: this.binds, pad: this.pad })); } catch (e) {} this.rebuild(); },
    rebuild: function() {
        this.map = {};
        var self = this;
        KEY_ACTIONS.forEach(function(a) { var phys = self.binds[a[0]]; if (phys && phys !== a[2]) self.map[phys] = a[2]; });
        this.padMap = {};
        PAD_ACTIONS.forEach(function(a) { var phys = self.pad[a[0]]; if (phys !== undefined && phys !== a[2]) self.padMap[a[2]] = phys; });
    },
    codeFor: function(id) { var a = KEY_ACTIONS.find(function(x) { return x[0] === id; }); return this.binds[id] || (a && a[2]); },
    // physical key -> the code the game expects
    tr: function(code) { return this.map[code] || code; },
    // e.key equivalent for a translated code (the handler checks e.key for arrows)
    keyFor: function(code, fallback) { return code.indexOf("Arrow") === 0 ? code : (code === "Delete" || code === "Backspace" ? code : fallback); },
    // logical pad button -> physical button
    padPhys: function(n) { return this.padMap[n] !== undefined ? this.padMap[n] : n; },
    pretty: function(code) {
        if (!code) return "—";
        return code.replace(/^Key/, "").replace(/^Digit/, "").replace("ShiftLeft", "L-Shift").replace("ShiftRight", "R-Shift").replace("ArrowUp", "↑").replace("ArrowDown", "↓").replace("ArrowLeft", "←").replace("ArrowRight", "→").replace("Period", ".").replace("Comma", ",").replace("Slash", "/").replace("Quote", "'").replace("Semicolon", ";");
    }
};
KeyMap.load();

// ---------------------------------------------------------------- the panel
var ControlsUI = {
    el: null, waiting: null,
    isOpen: function() { return !!(this.el && this.el.style.display === "flex"); },
    open: function() {
        if (!this.el) this.build();
        this.render();
        this.el.style.display = "flex";
    },
    close: function() { if (this.el) this.el.style.display = "none"; this.waiting = null; },
    build: function() {
        var el = document.createElement("div");
        el.style.cssText = "position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,.72);z-index:60;font:600 14px system-ui,sans-serif;color:#e2e8f0";
        el.innerHTML = "<div id='ctl-box' style='background:#0f172a;border:2px solid #38bdf8;border-radius:14px;padding:18px 20px;max-height:86vh;overflow:auto;min-width:min(760px,92vw)'></div>";
        document.body.appendChild(el);
        var self = this;
        el.addEventListener("mousedown", function(e) { e.stopPropagation(); if (e.target === el) self.close(); });
        el.addEventListener("click", function(e) { e.stopPropagation(); });
        // capture the next key for a rebind (before the game sees it)
        document.addEventListener("keydown", function(e) {
            if (!self.isOpen()) return;
            e.preventDefault(); e.stopImmediatePropagation();
            if (e.code === "Escape") { if (self.waiting) { self.waiting = null; self.render(); } else self.close(); return; }
            if (self.waiting && self.waiting.kind === "key") { KeyMap.binds[self.waiting.id] = e.code; KeyMap.save(); self.waiting = null; self.render(); }
        }, true);
        document.addEventListener("keyup", function(e) { if (self.isOpen()) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
        this.el = el;
    },
    // polled from the game loop while open: the next pad button press completes a pad rebind
    poll: function() {
        if (!this.isOpen() || !this.waiting || this.waiting.kind !== "pad") return;
        var gps = (navigator.getGamepads && navigator.getGamepads()) || [];
        for (let i = 0; i < gps.length; i++) {
            var g = gps[i];
            if (!g || !g.connected) continue;
            for (let b = 0; b < g.buttons.length; b++) {
                var pressed = g.buttons[b] && g.buttons[b].pressed;
                if (pressed && !(this.waiting.held || {})[b]) { KeyMap.pad[this.waiting.id] = b; KeyMap.save(); this.waiting = null; this.render(); return; }
            }
        }
    },
    render: function() {
        var self = this, box = this.el.querySelector("#ctl-box"), used = {};
        KEY_ACTIONS.forEach(function(a) { var c = KeyMap.codeFor(a[0]); used[c] = (used[c] || 0) + 1; });
        var btn = "background:#1e293b;color:#f8fafc;border:1px solid #475569;border-radius:8px;padding:4px 10px;cursor:pointer;font:700 13px system-ui;min-width:90px";
        var row = function(a, kind) {
            var cur = kind === "key" ? KeyMap.pretty(KeyMap.codeFor(a[0])) : PAD_NAMES[KeyMap.pad[a[0]] !== undefined ? KeyMap.pad[a[0]] : a[2]];
            var wait = self.waiting && self.waiting.id === a[0];
            var clash = kind === "key" && used[KeyMap.codeFor(a[0])] > 1;
            return "<div style='display:flex;justify-content:space-between;align-items:center;gap:10px;padding:3px 0'><span>" + a[1] + "</span><button data-k='" + kind + "' data-id='" + a[0] + "' style='" + btn + (wait ? ";border-color:#fde047;color:#fde047" : "") + (clash ? ";border-color:#f87171" : "") + "'>" + (wait ? (kind === "key" ? "press a key…" : "press a button…") : cur) + "</button></div>";
        };
        var col = function(list, kind) { return "<div style='flex:1;min-width:230px'>" + list.map(function(a) { return row(a, kind); }).join("") + "</div>"; };
        box.innerHTML = "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:8px'><b style='font-size:20px;color:#7dd3fc'>🎮 CONTROLS</b><span><button id='ctl-reset' style='" + btn + "'>Reset to defaults</button> <button id='ctl-close' style='" + btn + "'>Done (Esc)</button></span></div>" +
            "<div style='color:#94a3b8;margin-bottom:10px'>Click a binding, then press the new key (or gamepad button). Red = two actions share a key.</div>" +
            "<div style='display:flex;gap:22px;flex-wrap:wrap'>" + col(KEY_ACTIONS.slice(0, 10), "key") + col(KEY_ACTIONS.slice(10), "key") + "</div>" +
            "<div style='margin:12px 0 6px;color:#7dd3fc;font-weight:800'>Gamepad buttons (every pad)</div>" +
            "<div style='display:flex;gap:22px;flex-wrap:wrap'>" + col(PAD_ACTIONS.slice(0, 4), "pad") + col(PAD_ACTIONS.slice(4), "pad") + "</div>";
        box.querySelectorAll("button[data-id]").forEach(function(b) {
            b.onclick = function() {
                var held = {};
                if (b.dataset.k === "pad") { var gps = (navigator.getGamepads && navigator.getGamepads()) || []; for (let i = 0; i < gps.length; i++) if (gps[i]) gps[i].buttons.forEach(function(x, n) { if (x.pressed) held[n] = true; }); }
                self.waiting = { id: b.dataset.id, kind: b.dataset.k, held: held }; self.render();
            };
        });
        box.querySelector("#ctl-reset").onclick = function() { KeyMap.binds = {}; KeyMap.pad = {}; KeyMap.save(); self.render(); };
        box.querySelector("#ctl-close").onclick = function() { self.close(); };
    }
};
