// ============================================================================
// PLAYERS - one clear place to choose who plays (👥 Players button, pause menu, or the P key in menus).
//   Every game lists its line-ups as cards that spell out each slot: who is human (and on which keys /
//   gamepad), who is a CPU, and which team they are on. Below that: CPU skill, the control map, connected
//   gamepads, LAN players, and a live roster of who is in the match right now.
// ============================================================================
var PlayersUI = {
    el: null,

    // line-ups for the current game: [{ id, label, teams: [[slot...], [slot...]] }], slot = "p1" | "p2" | "cpu"
    lineups: function() {
        var m = GameModes.current ? GameModes.current.id : "survival";
        var T = function(a, b) { return b ? [a, b] : [a]; };
        if (typeof brawl !== "undefined" && brawl.active) return {
            kind: "brawl", current: brawlCfg.opponents, ffa: true,
            list: [["1cpu", "Duel vs CPU", T(["p1"], ["cpu"])], ["p2", "Player vs Player", T(["p1"], ["p2"])], ["2cpu", "You vs 2 CPUs", T(["p1"], ["cpu", "cpu"])],
                   ["3cpu", "You vs 3 CPUs", T(["p1"], ["cpu", "cpu", "cpu"])], ["p2+1cpu", "P1 vs P2 vs CPU", T(["p1"], ["p2", "cpu"])], ["p2+2cpu", "P1 vs P2 vs 2 CPUs", T(["p1"], ["p2", "cpu", "cpu"])]]
        };
        if (m === "tanks") return { get: arenaCheats.tankSkill, set: setTankSkill };
        if (m === "sport") return { kind: "sport", current: sportCfg.format,
            list: [["1v1", "1 v 1", T(["p1"], ["cpu"])], ["pvp", "P1 vs P2", T(["p1"], ["p2"])], ["2v2", "2 v 2", T(["p1", "cpu"], ["cpu", "cpu"])],
                   ["coop", "Co-op 2 v 2", T(["p1", "p2"], ["cpu", "cpu"])], ["3v3", "3 v 3", T(["p1", "cpu", "cpu"], ["cpu", "cpu", "cpu"])]] };
        if (m === "bedwars") return { kind: "bedwars", current: bwCfg.format,
            list: [["1v1", "1 v 1", T(["p1"], ["cpu"])], ["pvp", "P1 vs P2", T(["p1"], ["p2"])], ["2v2", "2 v 2", T(["p1", "cpu"], ["cpu", "cpu"])],
                   ["coop", "Co-op vs CPUs", T(["p1", "p2"], ["cpu", "cpu"])], ["3v3", "3 v 3", T(["p1", "cpu", "cpu"], ["cpu", "cpu", "cpu"])]] };
        if (!GameModes.flag("coopToggle", true)) return { kind: "single", current: "solo", list: [["solo", "One player", T(["p1"])]] };
        return { kind: "coop", current: multiplayer ? "coop" : "solo", list: [["solo", "Solo", T(["p1"])], ["coop", "2-player co-op", T(["p1", "p2"])]] };
    },

    apply: function(kind, id) {
        if (kind === "brawl") { brawlCfg.opponents = id; saveBrawlCfg(); resetGame(); }
        else if (kind === "sport") { sportCfg.format = id; try { localStorage.setItem("timsZombieBallCfg", JSON.stringify(sportCfg)); } catch (e) {} LevelManager.selectLevel(LevelManager.currentLevelKey); }
        else if (kind === "bedwars") { bwCfg.format = id; saveBw(); LevelManager.selectLevel(LevelManager.currentLevelKey); }
        else if (kind === "coop") { if ((id === "coop") !== multiplayer) toggleMultiplayer(); }
        if (typeof DevUI !== "undefined" && DevUI.sync) DevUI.sync();
        if (typeof showBanner === "function") showBanner("PLAYERS UPDATED", this.summary(), "#7dd3fc");
        this.render();
    },

    cpuSkill: function() {
        var m = GameModes.current ? GameModes.current.id : "";
        if (typeof brawl !== "undefined" && brawl.active) return { get: brawlCfg.cpuLevel, set: function(v) { brawlCfg.cpuLevel = v; saveBrawlCfg(); } };
        if (m === "tanks") return { get: arenaCheats.tankSkill, set: setTankSkill };
        if (m === "sport") return { get: sportCfg.level, set: function(v) { sportCfg.level = v; try { localStorage.setItem("timsZombieBallCfg", JSON.stringify(sportCfg)); } catch (e) {} } };
        return null;
    },

    // "P1 (keyboard) + CPU vs 2 CPUs" style one-liner of the match as it is right now
    summary: function() {
        // full-screen games: describe the seats (their heroes are hidden placeholders)
        if (GameModes.flag("ownScreen", false) && GameModes.has("seats")) {
            var parts = [];
            GameModes.call("seats").forEach(function(st) {
                if (st.count) { if (st.value) parts.push(st.value + " CPU" + (st.value > 1 ? "s" : "")); }
                else if (st.value === "human") parts.push("🎮 " + st.label.split(" ")[0]);
                else if (st.value === "cpu") parts.push("🤖 CPU");
            });
            return parts.join(" + ");
        }
        var cs = characters.filter(function(c) { return c.isPlayer; });
        if (!cs.length) return "";
        var teams = {};
        cs.forEach(function(c) { var t = c.fighterTeam !== undefined ? c.fighterTeam : 0; (teams[t] = teams[t] || []).push(PlayersUI.who(c).short); });
        var keys = window.Object.keys(teams);
        return keys.length > 1 ? keys.map(function(k) { return teams[k].join(" + "); }).join("  vs  ") : teams[keys[0]].join(" + ");
    },

    // how a character is controlled
    who: function(c) {
        if (c.isRemote) return { icon: "📡", short: c.playerLabel || "LAN", long: "LAN player on their own device" };
        if (c.isCPU) return { icon: "🤖", short: c.playerLabel || "CPU", long: "Computer" };
        var pad = (typeof Pads !== "undefined" && Pads.state[c.playerIndex] && Pads.state[c.playerIndex].active);
        if (c.playerIndex === 0) return { icon: "🎮", short: "P1", long: "Keyboard: WASD + mouse" + (pad ? "  ·  + gamepad 1" : "") };
        if (c.playerIndex === 1) return { icon: "🎮", short: "P2", long: "Keyboard: arrows + Enter" + (pad ? "  ·  + gamepad 2" : "") };
        return { icon: "🎮", short: c.playerLabel || ("P" + (c.playerIndex + 1)), long: "Player" };
    },

    open: function() {
        if (typeof Net !== "undefined" && Net.role === "client") { if (typeof NetUI !== "undefined") NetUI.open(); return; }
        if (!this.el) this.build();
        this.el.style.display = "flex";
        this.render();
    },
    close: function() { if (this.el) this.el.style.display = "none"; },
    isOpen: function() { return !!this.el && this.el.style.display === "flex"; },

    build: function() {
        var css = document.createElement("style");
        css.textContent =
            "#players-panel{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(5,8,14,.72);z-index:9998;font-family:'Segoe UI',Arial,sans-serif;color:#e2e8f0}" +
            "#players-panel .card{background:#0f172a;border:1px solid #334155;border-radius:14px;padding:20px 24px;width:min(760px,94vw);max-height:90vh;overflow:auto}" +
            "#players-panel h2{margin:0 0 2px;font-size:22px}#players-panel h3{margin:16px 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8}" +
            "#players-panel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}" +
            "#players-panel .lu{background:#1e293b;border:2px solid #334155;border-radius:10px;padding:9px 10px;cursor:pointer;text-align:left;color:inherit;font:inherit}" +
            "#players-panel .lu:hover{border-color:#64748b}#players-panel .lu.on{border-color:#38bdf8;background:#0c4a6e}" +
            "#players-panel .lu b{display:block;margin-bottom:6px;font-size:14px}" +
            "#players-panel .team{display:flex;flex-wrap:wrap;gap:4px;align-items:center}" +
            "#players-panel .chip{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;font-size:12px;font-weight:700;background:#0b1220;border:1px solid #334155}" +
            "#players-panel .vs{color:#94a3b8;font-size:11px;font-weight:800;margin:4px 0}" +
            "#players-panel .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:4px 0;font-size:13px}" +
            "#players-panel button.b{background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:7px;padding:5px 10px;cursor:pointer;font:inherit;font-size:13px}" +
            "#players-panel button.b.on{background:#2563eb;border-color:#60a5fa}#players-panel .muted{color:#94a3b8;font-size:12px}";
        document.head.appendChild(css);
        var el = document.createElement("div");
        el.id = "players-panel";
        el.addEventListener("mousedown", function(e) { e.stopPropagation(); if (e.target === el) PlayersUI.close(); });
        ["keydown", "keyup", "click", "wheel"].forEach(function(ev) { el.addEventListener(ev, function(e) { e.stopPropagation(); if (ev === "keydown" && e.code === "Escape") PlayersUI.close(); }); });
        document.body.appendChild(el);
        this.el = el;
    },

    chip: function(slot, teamCol) {
        var map = { p1: ["🎮", "P1 · WASD + mouse"], p2: ["🎮", "P2 · arrows"], cpu: ["🤖", "CPU"] };
        var m = map[slot] || ["?", slot];
        return "<span class='chip' style='border-color:" + teamCol + "'>" + m[0] + " " + m[1] + "</span>";
    },

    render: function() {
        if (!this.isOpen()) return;
        var self = this, L = this.lineups();
        var teamCols = L.ffa ? ["#ff4d52", "#94a3b8"] : ["#ff5a5f", "#3da5ff"];
        var title = GameModes.current ? GameModes.current.title : "";
        var h = "<div class='card'><h2>👥 Players — " + title + "</h2><div class='muted'>Right now: <b>" + (this.summary() || "—") + "</b></div>";
        var hasSeats = GameModes.has("seats") && (L.kind === "coop" || L.kind === "single");
        if (hasSeats) L = { kind: L.kind, current: "", list: [] };      // the seat rows below replace the solo / co-op cards
        if (L.list.length) h += "<h3>Who's playing</h3>";
        h += "<div class='grid'>";
        L.list.forEach(function(o, i) {
            var teams = o[2];
            var body = teams.map(function(t, ti) { return "<div class='team'>" + t.map(function(s) { return self.chip(s, teamCols[ti] || "#64748b"); }).join("") + "</div>"; })
                .join("<div class='vs'>" + (L.ffa ? "VS (everyone for themselves)" : "VS") + "</div>");
            h += "<button class='lu" + (o[0] === L.current ? " on" : "") + "' data-i='" + i + "'><b>" + (o[0] === L.current ? "✔ " : "") + o[1] + "</b>" + body + "</button>";
        });
        h += "</div>";
        // per-seat toggles (games that declare seats(): Human / CPU / Off, or a CPU count)
        var seats = GameModes.has("seats") ? GameModes.call("seats") : null;
        if (seats && seats.length) {
            h += "<h3>Seats</h3>";
            seats.forEach(function(st, si) {
                h += "<div class='row'><span class='chip' style='min-width:150px'>" + st.label + "</span>";
                if (st.count) {
                    h += "<button class='b' data-seat='" + si + "' data-v='" + (st.value - 1) + "'" + (st.value <= st.min ? " disabled" : "") + ">−</button><b style='min-width:28px;text-align:center'>" + st.value + "</b><button class='b' data-seat='" + si + "' data-v='" + (st.value + 1) + "'" + (st.value >= st.max ? " disabled" : "") + ">+</button>";
                } else {
                    var names = { human: "🎮 Human", cpu: "🤖 CPU", off: "— Off" };
                    st.options.forEach(function(o) { h += "<button class='b" + (st.value === o ? " on" : "") + "' data-seat='" + si + "' data-v='" + o + "'>" + names[o] + "</button>"; });
                }
                if (st.note) h += "<span class='muted'>" + st.note + "</span>";
                h += "</div>";
            });
        }
        if (L.kind === "single" && !(seats && seats.length)) h += "<p class='muted'>This game is single-player on one screen. For more players use LAN below.</p>";
        if (L.list.length) h += "<p class='muted'>Picking a line-up restarts the current match.</p>";
        var sk = this.cpuSkill();
        if (sk) {
            h += "<h3>CPU skill</h3><div class='row'>" + ["", "Easy", "Normal", "Hard"].map(function(n, v) { return v ? "<button class='b" + (sk.get === v ? " on" : "") + "' data-skill='" + v + "'>" + n + "</button>" : ""; }).join("") + "</div>";
        }
        // controls & devices
        var pads = (typeof Pads !== "undefined") ? Pads.state.map(function(s, i) { return s.active ? "🎮 Gamepad " + (i + 1) + " connected → drives P" + (i + 1) : null; }).filter(Boolean) : [];
        h += "<h3>Controls</h3>";
        h += "<div class='row'><span class='chip'>🎮 P1</span> WASD move/jump · mouse aim + click (or F) · Space jetpack · Shift dash · E ability · G grab · C build</div>";
        h += "<div class='row'><span class='chip'>🎮 P2</span> Arrows move/jump · Enter shoot · . jetpack · Right-Shift dash · / ability · , grab · ; build</div>";
        h += "<div class='row muted'>" + (pads.length ? pads.join("  ·  ") : "No gamepads detected (press a button on one to connect it).") + "</div>";
        var lan = (typeof Net !== "undefined" && Net.role === "host") ? Net.peerCount() : 0;
        h += "<div class='row'><span class='chip'>📡 LAN</span> " + (lan ? lan + " player(s) connected on other devices — they take CPU slots when there are any." : "Play on other devices on the same Wi-Fi.") + " <button class='b' id='pl-lan'>Open LAN…</button></div>";
        // live roster
        var cs = GameModes.flag("ownScreen", false) ? [] : characters.filter(function(c) { return c.isPlayer; });
        if (cs.length) {
            h += "<h3>In the match now</h3>";
            cs.forEach(function(c) {
                var w = self.who(c), t = c.fighterTeam;
                var tc = t === undefined ? (c.color || "#e2e8f0") : (L.ffa ? (c.color || "#e2e8f0") : teamCols[t] || "#e2e8f0");
                h += "<div class='row'><span class='chip' style='border-color:" + tc + ";color:" + tc + "'>" + w.icon + " " + (c.playerLabel || "") + "</span><span class='muted'>" + w.long + (t !== undefined && !L.ffa ? "  ·  team " + (t === 0 ? "RED" : "BLUE") : "") + (c.dead ? "  ·  down" : "") + "</span></div>";
            });
        }
        h += "<div class='row' style='margin-top:12px'><button class='b' id='pl-close'>Close (Esc)</button></div></div>";
        this.el.innerHTML = h;
        this.el.querySelectorAll(".lu").forEach(function(b) { b.onclick = function() { var o = L.list[Number(b.dataset.i)]; self.apply(L.kind, o[0]); }; });
        this.el.querySelectorAll("[data-seat]").forEach(function(b) {
            b.onclick = function() {
                var st = seats[Number(b.dataset.seat)], v = st.count ? Number(b.dataset.v) : b.dataset.v;
                st.set(v);
                if (typeof showBanner === "function") showBanner("PLAYERS UPDATED", st.label + ": " + (st.count ? v : v.toUpperCase()), "#7dd3fc");
                self.render();
            };
        });
        this.el.querySelectorAll("[data-skill]").forEach(function(b) { b.onclick = function() { sk.set(Number(b.dataset.skill)); self.render(); }; });
        var c = document.getElementById("pl-close"); if (c) c.onclick = function() { self.close(); };
        var l = document.getElementById("pl-lan"); if (l) l.onclick = function() { self.close(); NetUI.open(); };
    }
};

// in-game reminder of who is who: shows for a few seconds after the match (re)starts or the line-up changes
var PlayersBadge = {
    last: "", t: 0,
    draw: function() {
        if (typeof Studio !== "undefined" && Studio.isOpen) return;
        var s = PlayersUI.summary();
        if (s !== this.last) { this.last = s; this.t = 300; }
        if (this.t <= 0 || !s) return;
        this.t--;
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.t / 40);
        ctx.font = "800 13px " + UI_FONT;
        var txt = "👥 " + s + (cssW >= 1100 ? "   (Players: 👥 button / pause menu)" : "");   // short on narrow windows: it sat on game HUDs
        var w = ctx.measureText(txt).width + 24;
        ctx.fillStyle = "rgba(10,15,22,0.8)"; ctx.fillRect(cssW - w - 14, 58, w, 26);
        ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "left"; ctx.fillText(txt, cssW - w - 2, 76);
        ctx.restore();
    }
};

// Esc closes these panels from anywhere (not only when something inside them has focus)
document.addEventListener("keydown", function(e) {
    if (e.code !== "Escape") return;
    var closed = false;
    if (PlayersUI.isOpen()) { PlayersUI.close(); closed = true; }
    else if (typeof NetUI !== "undefined" && NetUI.isOpen && NetUI.isOpen()) { NetUI.close(); closed = true; }
    if (closed) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
