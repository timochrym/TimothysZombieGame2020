// ============================================================================
// ARCADE HUB - retro game-select screen listing every game registered with GameModes.
// Opens on boot and from the pause menu ("Arcade - switch game"). Keyboard, mouse and gamepad.
// ============================================================================
var HUB_ICONS = {
    survival: { s: ["..gggggg..", ".gggggggg.", "gg.rr.rr.g", "gg.rr.rr.g", "gggggggggg", "gg.wwwww.g", "gg.w.w.w.g", ".gggggggg.", "..g....g..", ".ggg..ggg."], p: { g: "#4d9a36", r: "#ff3b4a", w: "#f1f5f9" } },
    brawl: { s: ["..yy..yy..", ".yyyyyyyy.", "yyyyyyyyyy", "yyyyyyyyyy", "yyyyyyyyyy", ".yyyyyyyy.", "..ssssss..", "..ssssss..", "..ssssss..", "..ssssss.."], p: { y: "#ffd23f", s: "#f2c9a0" } },
    sport: { s: ["...wwww...", ".wwkkkkww.", ".wkkkkkkw.", "wwwkkkkwww", "wkwwwwwwkw", "wkkwkkwkkw", "wwwkkkkwww", ".wkwwwwkw.", ".wwkkkkww.", "...wwww..."], p: { w: "#f8fafc", k: "#1f2937" } },
    puzzle: { s: ["oooooooooo", "o..o..o..o", "oooooooooo", "o.o....o.o", "o..o..o..o", "o...oo...o", "o..o..o..o", "o.o....o.o", "oooooooooo", "oooooooooo"], p: { o: "#d9a05b", ".": "#7c4a1e" } },
    portal: { s: ["...bbbb...", "..b....b..", ".b......b.", ".b..oo..b.", ".b.o..o.b.", ".b.o..o.b.", ".b..oo..b.", ".b......b.", "..b....b..", "...bbbb..."], p: { b: "#38bdf8", o: "#fb923c" } },
    siege: { s: ["w.......w.", "w.......w.", ".w.....w..", ".w.....w..", "..wsssw...", "...www....", "....w.....", "....w.....", "....w.....", "...www...."], p: { w: "#9c6644", s: "#e5e7eb" } },
    creative: { s: ["....ww....", "...wwww...", "....ww....", "c...ww...c", "cccwwwwccc", "c..wwww..c", "....ww....", "...wwww...", "gggggggggg", "dddddddddd"], p: { w: "#e0f2fe", c: "#7dd3fc", g: "#4ade80", d: "#92400e" } },
    platform: { s: ["oooooooooo", "o.yyyyyy.o", "o.yy..yy.o", "o.....yy.o", "o....yy..o", "o...yy...o", "o...yy...o", "o........o", "o...yy...o", "oooooooooo"], p: { o: "#b45309", ".": "#f59e0b", y: "#fef3c7" } },
    bedwars: { s: ["..........", "..........", "ww........", "wwrrrrrrrr", "wwrrrrrrrr", "rrrrrrrrrr", "b........b", "b........b", "..........", ".........."], p: { w: "#f8fafc", r: "#ef4444", b: "#7f1d1d" } },
    dummy: { s: ["...yy.....", "...yy.....", "..yyyy....", ".y.yy.y...", "...yy...b.", "...yy..bbb", "..y..y.bbb", ".y....y.b.", ".y....y...", ".........."], p: { y: "#facc15", b: "#f97316" } },
    wheels: { s: ["..........", "....hh....", "....hh....", "...bbbb...", "..b.bb.b..", "..oooooo..", ".kkk..kkk.", "k...kk...k", "k...kk...k", ".kkk..kkk."], p: { h: "#fde68a", b: "#3b82f6", o: "#f97316", k: "#111827" } },
    terra: { s: ["..........", "...gg.....", "..gggg....", "...ww.....", "gggwwggggg", "dddddddddd", "ddsdddssdd", "sssyssssss", "ss..ssyss.", "ssssssssss"], p: { g: "#4f8a33", w: "#8b5a2b", d: "#7c4a26", s: "#6b7280", y: "#d4a017" } },
    race: { s: ["pkwkwkwk..", "pwkwkwkw..", "pkwkwkwk..", "pwkwkwkw..", "p.........", "p.........", "p.........", "p.........", "p.........", "pp........"], p: { p: "#e5e7eb", k: "#111827", w: "#f8fafc" } }
};

var Hub = {
    isOpen: false,
    idx: 0,
    rects: [],
    t: 0,
    boot: false,
    stars: null,

    games: function() { return GameModes.list.filter(function(m) { return !m.hidden; }); },

    openHub: function(boot) {
        this.isOpen = true;
        this.boot = !!boot;
        var games = this.games();
        var last = null;
        try { last = localStorage.getItem("timsArcadeLastGame"); } catch (e) {}
        var cur = boot ? (last || "survival") : (GameModes.current ? GameModes.current.id : "survival");
        this.idx = Math.max(0, games.findIndex(function(g) { return g.id === cur; }));
        for (let i = 0; i < PlayerInput.length; i++) PlayerInput[i].shoot = PlayerInput[i].jet = PlayerInput[i].interact = false;
        mouseDown = false;
    },

    close: function() { this.isOpen = false; },

    choose: function(i) {
        var g = this.games()[i];
        if (!g) return;
        if (typeof SFX !== "undefined") SFX.play("select");
        this.close();
        GameModes.launch(g.id);
    },

    key: function(e) {
        if (typeof SFX !== "undefined") SFX.unlock();
        var c = e.code, n = this.games().length, cols = this.cols();
        if (c === "ArrowRight" || c === "KeyD") this.idx = (this.idx + 1) % n;
        else if (c === "ArrowLeft" || c === "KeyA") this.idx = (this.idx - 1 + n) % n;
        else if (c === "ArrowDown" || c === "KeyS") this.idx = Math.min(n - 1, this.idx + cols);
        else if (c === "ArrowUp" || c === "KeyW") this.idx = Math.max(0, this.idx - cols);
        else if (c === "Enter" || c === "NumpadEnter" || c === "Space") { this.choose(this.idx); if (e.preventDefault) e.preventDefault(); return; }
        else if (c === "Escape") {
            if (this.boot) this.choose(this.idx); else this.close();
            return;
        } else return;
        if (typeof SFX !== "undefined") SFX.play("ui");
        if (e.preventDefault) e.preventDefault();
    },

    hover: function(mx, my) {
        for (let i = 0; i < this.rects.length; i++) {
            var r = this.rects[i];
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) { if (this.idx !== i && typeof SFX !== "undefined") SFX.play("ui"); this.idx = i; return; }
        }
    },

    click: function(mx, my) {
        if (typeof SFX !== "undefined") SFX.unlock();
        for (let i = 0; i < this.rects.length; i++) {
            var r = this.rects[i];
            if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) { this.choose(i); return; }
        }
    },

    cols: function() { return cssW > 1250 ? 4 : (cssW > 900 ? 3 : 2); },

    draw: function() {
        this.t++;
        ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
        var W = cssW, H = cssH;
        // CRT-style backdrop: deep gradient, drifting pixel stars, scanlines
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#0b1020");
        g.addColorStop(1, "#1a0f2e");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        if (!this.stars) { this.stars = []; for (let i = 0; i < 90; i++) this.stars.push([Math.random(), Math.random(), 1 + Math.random() * 2]); }
        ctx.fillStyle = "#c7d2fe";
        for (let i = 0; i < this.stars.length; i++) {
            var s = this.stars[i];
            var x = ((s[0] * W + this.t * s[2] * 0.3) % W), y = s[1] * H;
            ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(this.t * 0.02 + i));
            ctx.fillRect(Math.round(x), Math.round(y), s[2] * 2, s[2] * 2);
        }
        ctx.globalAlpha = 1;
        // pixel horizon grid
        ctx.strokeStyle = "rgba(217,70,239,0.18)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
            var gy = H * 0.72 + Math.pow(i / 12, 2) * H * 0.3;
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
        }

        uiText("TIM'S ARCADE", W / 2, 84, 58, "#ffd23f", "center", "900");
        uiText("One engine  ·  " + this.games().length + " games  ·  pick one!", W / 2, 118, 16, "#c4b5fd", "center", "700");

        var games = this.games();
        var cols = this.cols();
        var cw = Math.min(290, (W - 80 - (cols - 1) * 22) / cols), ch = 200;
        var rows = Math.ceil(games.length / cols);
        var totalW = cols * cw + (cols - 1) * 22;
        var x0 = W / 2 - totalW / 2;
        var y0 = Math.max(150, Math.min(170, H / 2 - (rows * (ch + 22)) / 2 + 40));
        if (y0 + rows * (ch + 22) > H - 60) { ch = Math.max(150, (H - 60 - y0) / rows - 22); }
        this.rects = [];
        for (let i = 0; i < games.length; i++) {
            var m = games[i];
            var col = i % cols, row = Math.floor(i / cols);
            var cx = x0 + col * (cw + 22), cy = y0 + row * (ch + 22);
            var sel = (i === this.idx);
            var bob = sel ? Math.sin(this.t * 0.12) * 3 - 4 : 0;
            this.rects.push({ x: cx, y: cy, w: cw, h: ch });
            ctx.save();
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            uiRoundRect(cx + 4, cy + 6 + bob, cw, ch, 16);
            ctx.fill();
            ctx.fillStyle = sel ? "#1e1b4b" : "#111827";
            uiRoundRect(cx, cy + bob, cw, ch, 16);
            ctx.fill();
            ctx.lineWidth = sel ? 4 : 2;
            ctx.strokeStyle = sel ? (m.color || "#22d3ee") : "rgba(148,163,184,0.35)";
            ctx.stroke();
            // pixel icon
            var ic = HUB_ICONS[m.id] || m.icon;
            if (ic) {
                var px = Math.min(7, (ch - 110) / 10);
                PixelArt.draw(ic.s, cx + cw / 2 - 5 * px, cy + 18 + bob, px, ic.p);
            }
            uiText(m.title, cx + cw / 2, cy + ch - 62 + bob, 18, sel ? (m.color || "#fff") : "#e2e8f0", "center", "900");
            // wrapped tagline
            ctx.font = "600 12px " + UI_FONT;
            var words = (m.tagline || "").split(" "), line = "", lines = [];
            for (let wI = 0; wI < words.length; wI++) {
                var test = line ? line + " " + words[wI] : words[wI];
                if (ctx.measureText(test).width > cw - 28) { lines.push(line); line = words[wI]; } else line = test;
            }
            if (line) lines.push(line);
            for (let li = 0; li < Math.min(2, lines.length); li++) uiText(lines[li], cx + cw / 2, cy + ch - 38 + li * 15 + bob, 12, "#94a3b8", "center", "600");
            if (sel) uiText("▶ PRESS ENTER", cx + cw / 2, cy - 8 + bob, 12, m.color || "#22d3ee", "center", "900");
            ctx.restore();
        }
        // scanlines
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
        uiText("← → ↑ ↓ choose  ·  Enter / click / (A) play  ·  " + (this.boot ? "Esc quick-start" : "Esc back"), W / 2, H - 22, 13, "#a5b4fc", "center", "700");
    }
};
