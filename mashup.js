// ============================================================================
// MASH-UP - mix pieces of one game into another, and settings shared by every game.
//   Each mix-in is "game default / on / off" (saved). Flag mix-ins override GameModes.flag() for the game that's on;
//   module mix-ins run their own small loop here. Full-screen games (board / table / arena) aren't touched.
//     waves     zombie waves (Survival)          building  C to build (Bed Brawl / Creative)
//     jetpack   Space jetpack (Survival)         shooting  the blaster (Survival)
//     dash      Shift dash                       airjump   an extra jump in the air (Stomp Squad style)
//     words     Y: type a thing and it appears (Word Lab; Y because T already means something in some games)
//     items     power-ups and bombs drop near you every ~15 s (Brawl)
//     pet       start every level with a dog that follows you and bites monsters (Word Lab)
//   Shared settings: one CPU skill for every game that has CPUs.
// ============================================================================
var MASHUP_MIX = [
    ["waves", "🧟 Zombie waves", "Survival", "flag"], ["building", "🧱 Building (C)", "Bed Brawl / Creative", "flag"],
    ["jetpack", "🚀 Jetpack (Space)", "Survival", "flag"], ["shooting", "🔫 Blaster", "Survival", "flag"],
    ["dash", "💨 Dash (Shift)", "Survival / Bed Brawl", "flag"], ["airJumps", "🦘 Extra air jump", "Stomp Squad", "flag"],
    ["words", "🔤 Word magic (Y)", "Word Lab", "module"], ["items", "🎁 Item drops", "Brawl", "module"], ["pet", "🐕 Pet dog", "Word Lab", "module"]
];

var Mashup = {
    mix: {},          // id -> true (on) / false (off); missing = the game's own default
    t: 0,
    load: function() { try { this.mix = JSON.parse(localStorage.getItem("timsMashup") || "{}") || {}; } catch (e) { this.mix = {}; } },
    save: function() { try { localStorage.setItem("timsMashup", JSON.stringify(this.mix)); } catch (e) {} },
    world: function() { var f = GameModes.current && GameModes.current.flags; return !(f && f.ownScreen); },
    active: function(id) { return this.world() && this.mix[id] === true; },
    // GameModes.flag() asks this first: a forced value for a flag mix-in, else undefined
    override: function(name) {
        if (!this.world() || this.mix[name] === undefined) return undefined;
        if (!MASHUP_MIX.some(function(m) { return m[0] === name && m[3] === "flag"; })) return undefined;
        if (name === "airJumps") return this.mix[name] ? 1 : 0;
        return this.mix[name];
    },
    set: function(id, v) {               // v: "default" | "on" | "off"
        if (v === "default") delete this.mix[id]; else this.mix[id] = v === "on";
        this.save();
        if (id === "jetpack" && this.world()) jetpackEnabled = v === "default" ? GameModes.flag("jetpack", true) : v === "on";
        if (id === "waves" && v === "on" && this.world()) {
            if (typeof SummonManager !== "undefined") SummonManager.pauseWaves = false;          // a game without waves keeps them paused
            if (zombies.length === 0 && typeof startLevel === "function") startLevel(Math.max(1, level));
        }
        if (id === "pet" && v === "on") this.addPet();
    },
    gameDefault: function(id) {
        var f = (GameModes.current && GameModes.current.flags) || {};
        if (id === "words") return GameModes.current && GameModes.current.id === "words";
        if (id === "items") return typeof brawl !== "undefined" && brawl.active;
        if (id === "pet") return false;
        if (id === "airJumps") return !!f.airJumps;
        return f[id] !== undefined ? !!f[id] : (id === "waves" || id === "jetpack" || id === "shooting");
    },
    isOn: function(id) { return this.mix[id] !== undefined ? this.mix[id] : this.gameDefault(id); },

    addPet: function() {
        if (!redGuy || redGuy.dead || typeof wordPet !== "function" || !this.world()) return;
        if (movingObjects.some(function(o) { return o.pet && !o.dead; })) return;
        wordPet("dog")(redGuy.x - 90, redGuy.y, { s: 1 });
        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
    },
    afterReset: function() { if (this.active("pet")) this.addPet(); },

    // runs every frame of a world game (after the game's own update)
    tick: function() {
        if (!this.world()) return;
        this.t++;
        var inWords = GameModes.current && GameModes.current.id === "words";
        if (this.mix.jetpack !== undefined) jetpackEnabled = this.mix.jetpack;
        if (!inWords && (this.active("words") || this.active("pet")) && typeof wordPetsUpdate === "function") { wordPetsUpdate(); wordWaterUpdate(); }
        if (this.active("items") && !(typeof brawl !== "undefined" && brawl.active) && redGuy && !redGuy.dead && this.t % 900 === 450) {
            var x = redGuy.x + (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 300);
            if (Math.random() < 0.5 && typeof spawnPowerUp === "function") spawnPowerUp(x, redGuy.y + 400);
            else { var bomb = Object.addCrate(x, redGuy.y + 500, 54, "#1f2937", { explosive: true, name: "Bomb" }); if (typeof rebuildAllObjects === "function") rebuildAllObjects(); Components.addFloatingText("💣 BOMB! G grab · click throw", x, redGuy.y + 560, "#fca5a5", 16); }
        }
        if (WordLab && WordLab.msgT > 0 && !inWords) WordLab.msgT--;
    },
    drawFront: function() {
        if (!this.world() || (GameModes.current && GameModes.current.id === "words")) return;
        if ((this.active("words") || this.active("pet")) && typeof wordPetsDraw === "function") { wordPetsDraw(); wordWaterDraw(); }
    },
    drawHUD: function() {
        if (!this.world() || (GameModes.current && GameModes.current.id === "words")) return;
        if (this.active("words")) {
            if (typeof WordLab !== "undefined" && WordLab.msgT > 0) uiText(WordLab.msg, cssW / 2, 150, 18, WordLab.msgCol || "#fde047", "center", "900");
            uiText("🔤 Y: type a thing", cssW - 16, cssH - 40, 12, "rgba(253,224,71,0.8)", "right", "800");
        }
    },
    onKey: function(code) {
        if (!this.active("words") || (GameModes.current && GameModes.current.id === "words")) return false;
        if (code === "KeyY" && typeof WordLab !== "undefined" && !WordLab.open) { WordLab.done = false; WordLab.openBox(); return true; }
        return false;
    }
};
Mashup.load();

// settings every game shares (shown on every game's Game tab)
var SHARED_TUNABLES = [
    { label: "CPU skill (every game)", type: "choice", options: [[1, "Easy"], [2, "Normal"], [3, "Hard"]],
      get: function() { return typeof brawlCfg !== "undefined" ? brawlCfg.cpuLevel : 2; },
      set: function(v) {
          if (typeof brawlCfg !== "undefined") { brawlCfg.cpuLevel = v; if (typeof saveBrawlCfg === "function") saveBrawlCfg(); }
          if (typeof sportCfg !== "undefined") sportCfg.level = v;
          if (typeof tableCfg !== "undefined") { tableCfg.level = v; if (typeof saveTable === "function") saveTable(); }
      } }
];
