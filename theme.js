// ============================================================================
// THEMES: one look setting shared by every game (Pause -> Settings, or the
// Cheats panel's "Shared by every game" box).
//   Theme.c          -> the current palette (sky, hills, cavern, panel, bg...)
//   Theme.set(id)    -> switch theme, rebuild cached backgrounds, save
//   Theme.setBright(v) -> whole-screen brightness (works in every game, even
//                         ones that paint their own background)
// ============================================================================
var THEMES = {
    night:  { label: "🌙 Night (classic)",
              sky: ["#0d1b2a", "#1b2e3c", "#0f1e26"], peaks: ["#142433", "#17293b", "#12202e"], hills: "#19303d", castle: "#152833",
              cavern: "#0a121a", wall: "#1c2433", bg: "#0b1220", panel: "9,14,22", page: "#0d1b2a", filter: "",
              dp: { bg: "rgba(10,16,24,0.94)", line: "rgba(130,180,210,0.22)" } },
    day:    { label: "☀️ Day (light)",
              sky: ["#6fb8ea", "#b5def6", "#e4f3fb"], peaks: ["#93b6cf", "#a6c5da", "#8aaec8"], hills: "#86b98f", castle: "#73a27f",
              cavern: "#5c4634", wall: "#6d7d90", bg: "#3d6f94", panel: "26,46,70", page: "#6fb8ea", floor: "#eef2f5", grid: "#d3dce5", filter: "",
              dp: { bg: "rgba(24,44,66,0.94)", line: "rgba(170,210,235,0.35)" } },
    sunset: { label: "🌅 Sunset",
              sky: ["#2c1a4d", "#a9497a", "#f2a05a"], peaks: ["#4b2b60", "#5b3369", "#43285a"], hills: "#5f3a5e", castle: "#4e2f50",
              cavern: "#22132a", wall: "#3a2840", bg: "#3a2147", panel: "36,18,42", page: "#2c1a4d", floor: "#2e1a3c", grid: "#452b55", filter: "",
              dp: { bg: "rgba(38,20,46,0.94)", line: "rgba(240,160,200,0.28)" } },
    meadow: { label: "🌿 Meadow (bright)",
              sky: ["#9fd8f5", "#d6f0e0", "#f4f9e6"], peaks: ["#a9c7b0", "#b7d3bb", "#9cbfa5"], hills: "#6fae63", castle: "#5f9a57",
              cavern: "#6a5238", wall: "#7b8a6c", bg: "#4b7f5a", panel: "28,54,40", page: "#9fd8f5", floor: "#e7f2df", grid: "#cde0c2", filter: "saturate(1.1)",
              dp: { bg: "rgba(26,52,38,0.94)", line: "rgba(180,230,190,0.35)" } },
    retro:  { label: "📼 Retro (warm film)",
              sky: ["#1d1a14", "#3a3020", "#20190f"], peaks: ["#2f2818", "#3a321e", "#2a2415"], hills: "#3d3420", castle: "#30291a",
              cavern: "#14100a", wall: "#2a2418", bg: "#1a160f", panel: "22,18,10", page: "#1d1a14", floor: "#1d170e", grid: "#2e2617", filter: "sepia(0.35) contrast(1.06)",
              dp: { bg: "rgba(26,22,14,0.94)", line: "rgba(230,200,140,0.28)" } }
};
var THEME_ORDER = ["night", "day", "sunset", "meadow", "retro"];
var BRIGHT_STEPS = [0.85, 1, 1.15, 1.3, 1.5];

var Theme = {
    id: "night",
    c: THEMES.night,
    init: function() {
        if (typeof settings === "undefined") return;
        if (!THEMES[settings.theme]) settings.theme = "night";
        if (typeof settings.bright !== "number" || settings.bright < 0.6 || settings.bright > 1.8) settings.bright = 1;
        this.id = settings.theme; this.c = THEMES[this.id];
        this.applyPage();
    },
    // Background colour for full-screen games (cards, tables, menus).
    bg: function() { return this.c.bg; },
    // Arena floor / grid for top-down games; Night keeps each game's own colours.
    floor: function(nightCol) { return this.c.floor || nightCol; },
    grid: function(nightCol) { return this.c.grid || nightCol; },
    panel: function(a) { return "rgba(" + this.c.panel + "," + a + ")"; },
    set: function(id) {
        if (!THEMES[id]) return;
        this.id = id; this.c = THEMES[id];
        if (typeof settings !== "undefined") { settings.theme = id; if (typeof saveSettings === "function") saveSettings(); }
        if (typeof BackgroundMosaic !== "undefined") {
            BackgroundMosaic._skyGrad = null;
            if (BackgroundMosaic.layers) BackgroundMosaic.buildMosaicLayers();
        }
        this.applyPage();
    },
    cycle: function(dir) {
        var i = THEME_ORDER.indexOf(this.id);
        this.set(THEME_ORDER[(i + (dir || 1) + THEME_ORDER.length) % THEME_ORDER.length]);
    },
    setBright: function(v) {
        settings.bright = Math.max(0.6, Math.min(1.8, Math.round(v * 100) / 100));
        if (typeof saveSettings === "function") saveSettings();
        this.applyPage();
    },
    stepBright: function(dir) {
        var i = 0, best = 9;
        for (var k = 0; k < BRIGHT_STEPS.length; k++) { var d = Math.abs(BRIGHT_STEPS[k] - settings.bright); if (d < best) { best = d; i = k; } }
        this.setBright(BRIGHT_STEPS[Math.max(0, Math.min(BRIGHT_STEPS.length - 1, i + (dir || 1)))]);
    },
    filterCss: function() {
        var f = this.c.filter || "";
        var b = (typeof settings !== "undefined" && settings.bright) || 1;
        if (Math.abs(b - 1) > 0.001) f += (f ? " " : "") + "brightness(" + b + ")";
        return f;
    },
    // Page colour, canvas filter (brightness + theme tint) and the panel colours.
    applyPage: function() {
        if (typeof document === "undefined") return;
        var c = this.c, f = this.filterCss();
        var cv = document.getElementById("screen");
        if (cv) { cv.style.filter = f; cv.style.background = c.page; }
        if (document.body) document.body.style.background = c.page;
        var root = document.documentElement;
        if (root && root.style) { root.style.setProperty("--dp-bg", c.dp.bg); root.style.setProperty("--dp-line", c.dp.line); }
        root.dataset.theme = this.id;
    }
};
Theme.init();
if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function() { Theme.applyPage(); });
