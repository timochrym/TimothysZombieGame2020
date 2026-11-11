// ============================================================================
// COURSE SELECT - one grid for every game with numbered courses / rooms / chambers:
// name, best time, medal (0-3) and locked state per card. Opened from each game's pause menu.
//   CourseSelect.open({ title, items: [{ name, best, medal, locked, current }], onPick: function(i) {} })
// Mouse, arrows + Enter, Esc (or B on a pad via the pause menu) close.
// ============================================================================
var CourseSelect = {
    el: null, cfg: null, sel: 0,
    MEDALS: ["", "🥉", "🥈", "🥇"],

    build: function() {
        var css = document.createElement("style");
        css.textContent =
            "#course-select{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(4,8,14,.78);z-index:9998;font-family:'Segoe UI',Arial,sans-serif}" +
            "#course-select .card{background:#0f172a;color:#e2e8f0;border:1px solid #22d3ee;border-radius:14px;padding:18px 20px;width:min(760px,94vw);max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.6)}" +
            "#course-select h2{margin:0 0 4px;color:#facc15;font-size:22px}#course-select p{margin:0 0 12px;color:#94a3b8;font-size:13px}" +
            "#course-select .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}" +
            "#course-select .c{background:#1e293b;border:2px solid #334155;border-radius:12px;padding:10px 12px;text-align:left;color:#e2e8f0;cursor:pointer;font:inherit;min-height:86px;display:flex;flex-direction:column;gap:3px}" +
            "#course-select .c:hover,#course-select .c.sel{border-color:#22d3ee;background:#164e63}#course-select .c.cur{box-shadow:inset 0 0 0 2px #facc15}" +
            "#course-select .c.lock{opacity:.4;cursor:default}#course-select .n{font-size:12px;color:#94a3b8;font-weight:800}#course-select .t{font-size:15px;font-weight:800}" +
            "#course-select .b{font-size:12px;color:#7dd3fc;margin-top:auto}#course-select .m{float:right;font-size:20px}" +
            "#course-select .foot{display:flex;justify-content:space-between;align-items:center;margin-top:12px;color:#94a3b8;font-size:12px}" +
            "#course-select .foot button{background:#334155;color:#fff;border:0;border-radius:8px;padding:8px 14px;font:700 14px 'Segoe UI',Arial;cursor:pointer}";
        document.head.appendChild(css);
        var el = document.createElement("div");
        el.id = "course-select";
        el.addEventListener("mousedown", function(e) { e.stopPropagation(); if (e.target === el) CourseSelect.close(); });
        document.body.appendChild(el);
        this.el = el;
        // keys while open (capture: before the game sees them)
        document.addEventListener("keydown", function(e) {
            if (!CourseSelect.isOpen()) return;
            var n = CourseSelect.cfg.items.length, c = e.code, cols = CourseSelect.cols();
            if (c === "Escape") CourseSelect.close();
            else if (c === "ArrowRight" || c === "KeyD") CourseSelect.move(1);
            else if (c === "ArrowLeft" || c === "KeyA") CourseSelect.move(-1);
            else if (c === "ArrowDown" || c === "KeyS") CourseSelect.move(cols);
            else if (c === "ArrowUp" || c === "KeyW") CourseSelect.move(-cols);
            else if (c === "Enter" || c === "Space" || c === "NumpadEnter") CourseSelect.pick(CourseSelect.sel);
            else return;
            e.preventDefault(); e.stopImmediatePropagation();
        }, true);
    },

    cols: function() { var g = this.el.querySelector(".grid"); return g ? Math.max(1, Math.round(g.clientWidth / 170)) : 4; },
    isOpen: function() { return !!this.el && this.el.style.display === "flex"; },
    close: function() { if (this.el) this.el.style.display = "none"; },
    move: function(d) { var n = this.cfg.items.length; this.sel = Math.max(0, Math.min(n - 1, this.sel + d)); this.render(); },

    open: function(cfg) {
        if (!this.el) this.build();
        if (typeof paused !== "undefined" && paused && typeof closePause === "function") closePause();
        this.cfg = cfg;
        this.sel = Math.max(0, cfg.items.findIndex(function(it) { return it.current; }));
        this.el.style.display = "flex";
        this.render();
    },

    pick: function(i) {
        var it = this.cfg.items[i];
        if (!it || it.locked) return;
        this.close();
        this.cfg.onPick(i);
    },

    render: function() {
        var cfg = this.cfg, self = this;
        var esc = function(s) { return String(s).replace(/[&<>"]/g, function(c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
        var got = cfg.items.filter(function(it) { return it.medal; }).length;
        var h = "<div class='card'><h2>" + esc(cfg.title) + "</h2><p>" + (cfg.note ? esc(cfg.note) + " · " : "") + cfg.items.length + " in total" + (got ? " · medals on " + got : "") + "</p><div class='grid'>";
        cfg.items.forEach(function(it, i) {
            h += "<button class='c" + (i === self.sel ? " sel" : "") + (it.current ? " cur" : "") + (it.locked ? " lock" : "") + "' data-i='" + i + "'>" +
                 "<span class='n'>" + (i + 1) + (it.current ? " · now" : "") + "<span class='m'>" + (it.locked ? "🔒" : self.MEDALS[it.medal || 0]) + "</span></span>" +
                 "<span class='t'>" + esc(it.name) + "</span>" +
                 "<span class='b'>" + (it.locked ? "finish the one before to unlock" : (it.best ? "best " + esc(it.best) : "not finished yet")) + "</span></button>";
        });
        h += "</div><div class='foot'><span>Click or ← → ↑ ↓ + Enter · Esc closes</span><button id='cs-close'>Close</button></div></div>";
        this.el.innerHTML = h;
        this.el.querySelectorAll(".c").forEach(function(b) { b.onclick = function() { self.pick(Number(b.dataset.i)); }; });
        document.getElementById("cs-close").onclick = function() { self.close(); };
    }
};
