// ============================================================================
// TOUCH CONTROLS - phones and tablets (also as LAN joiners). Appears after the first touch.
//   Left thumb: ◀ ▶ move, ▲ jump / climb, ▼ drop.   Right thumb: Jet (Space), Dash (Shift), Smash (E), Grab (G).
//   Tap / hold anywhere on the game: aim + shoot there (it is a mouse click to the game, so menus, the Arcade and
//   board games work by tapping too). ⏸ = Esc.
// The buttons send the same key events a keyboard would, so every game and the LAN client understand them.
// ============================================================================
var TouchUI = {
    on: false, el: null, held: {},

    key: function(code, key, down) {
        if (down === !!this.held[code]) return;
        this.held[code] = down;
        var ev = new KeyboardEvent(down ? "keydown" : "keyup", { code: code, key: key, bubbles: true, cancelable: true });
        document.dispatchEvent(ev);
    },

    build: function() {
        var css = document.createElement("style");
        css.textContent =
            "#touch-ui{position:fixed;inset:0;pointer-events:none;z-index:900;user-select:none;-webkit-user-select:none;font-family:'Segoe UI',Arial,sans-serif}" +
            "#touch-ui .tb{position:absolute;pointer-events:auto;width:60px;height:60px;border-radius:50%;background:rgba(15,23,42,.35);border:2px solid rgba(148,163,184,.45);color:#e2e8f0;font:800 15px 'Segoe UI',Arial;display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-tap-highlight-color:transparent}" +
            "#touch-ui .tb.on{background:rgba(34,211,238,.45);border-color:#22d3ee}" +
            "#touch-ui .tb small{font-size:10px;display:block;text-align:center;line-height:1.1}" +
            "body.touch-hide #touch-ui{display:none}" +
            "@media (max-height:480px){#touch-ui .tb{transform:scale(.82);transform-origin:center}}" +
            "canvas{touch-action:none}";
        document.head.appendChild(css);
        var el = document.createElement("div");
        el.id = "touch-ui";
        // [label, code, key, left/right side, x, y (from the bottom corner)]
        var B = [
            ["◀", "KeyA", "a", "l", 14, 86], ["▶", "KeyD", "d", "l", 150, 86], ["▲", "KeyW", "w", "l", 82, 154], ["▼", "KeyS", "s", "l", 82, 18],
            ["Jet<small>Space</small>", "Space", " ", "r", 14, 30], ["Dash<small>Shift</small>", "ShiftLeft", "Shift", "r", 86, 86],
            ["Smash<small>E</small>", "KeyE", "e", "r", 14, 112], ["Grab<small>G</small>", "KeyG", "g", "r", 158, 30]
        ];
        var self = this;
        B.forEach(function(b) {
            var d = document.createElement("div");
            d.className = "tb"; d.innerHTML = b[0];
            d.style[b[3] === "l" ? "left" : "right"] = b[4] + "px"; d.style.bottom = b[5] + "px";
            var down = function(e) { e.preventDefault(); e.stopPropagation(); d.classList.add("on"); self.key(b[1], b[2], true); };
            var up = function(e) { e.preventDefault(); e.stopPropagation(); d.classList.remove("on"); self.key(b[1], b[2], false); };
            d.addEventListener("touchstart", down, { passive: false });
            d.addEventListener("touchend", up, { passive: false });
            d.addEventListener("touchcancel", up, { passive: false });
            el.appendChild(d);
        });
        var p = document.createElement("div");
        p.className = "tb"; p.innerHTML = "⏸"; p.style.left = "50%"; p.style.bottom = "10px"; p.style.width = p.style.height = "44px"; p.style.marginLeft = "-22px";
        p.addEventListener("touchstart", function(e) { e.preventDefault(); e.stopPropagation(); self.key("Escape", "Escape", true); self.key("Escape", "Escape", false); }, { passive: false });
        el.appendChild(p);
        document.body.appendChild(el);
        this.el = el;
        // hide the buttons while a menu owns the screen (Arcade, pause, Level Studio, panels)
        setInterval(function() {
            var menu = (typeof Hub !== "undefined" && Hub.isOpen) || (typeof paused !== "undefined" && paused) || (typeof Studio !== "undefined" && Studio.isOpen) ||
                       (typeof NetUI !== "undefined" && NetUI.isOpen()) || (typeof PlayersUI !== "undefined" && PlayersUI.isOpen && PlayersUI.isOpen());
            document.body.classList.toggle("touch-hide", !!menu);
            if (menu) for (var c in self.held) if (self.held[c]) self.key(c, c, false);
        }, 250);
    },

    // one finger on the game area = the mouse: down / move / up go to the game's own mouse handlers
    canvasTouches: function() {
        var cv = typeof canvas !== "undefined" ? canvas : document.querySelector("canvas"), id = null;
        if (!cv) return;
        var send = function(type, t, target) {
            var ev = new MouseEvent(type, { clientX: t.clientX, clientY: t.clientY, button: 0, buttons: type === "mouseup" ? 0 : 1, bubbles: true, cancelable: true });
            (target || cv).dispatchEvent(ev);
        };
        var downAt = 0;
        cv.addEventListener("touchstart", function(e) {
            if (id !== null) return;
            var t = e.changedTouches[0]; id = t.identifier; downAt = performance.now();
            send("mousemove", t, window); send("mousedown", t);
            e.preventDefault();                                      // no browser-made mouse events on top of ours
        }, { passive: false });
        cv.addEventListener("touchmove", function(e) {
            for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === id) send("mousemove", e.changedTouches[i], window);
            e.preventDefault();
        }, { passive: false });
        var end = function(e) {
            for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === id) {
                var t = { clientX: e.changedTouches[i].clientX, clientY: e.changedTouches[i].clientY };
                id = null;
                // a quick tap still has to last a few frames, or the game never sees the button held (no shot)
                setTimeout(function() { send("mouseup", t, window); send("click", t); }, Math.max(0, 70 - (performance.now() - downAt)));
            }
        };
        cv.addEventListener("touchend", end); cv.addEventListener("touchcancel", end);
    },

    enable: function() {
        if (this.on) return;
        this.on = true;
        this.build();
        // the keyboard cheat-sheet is no use on a touch screen: hide it (H still brings it back)
        if (typeof helpTimer !== "undefined") helpTimer = 0;
    }
};

window.addEventListener("load", function() {
    TouchUI.canvasTouches();
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) TouchUI.enable();
    window.addEventListener("touchstart", function() { TouchUI.enable(); }, { once: true, passive: true });
});
