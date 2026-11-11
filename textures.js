// ============================================================================
// TEXTURES - extra 32x32 pixel textures for the newer blocks (building, Terra, platformer, Bed Brawl, Siege...).
//   They join TextureManager.canvases, so any object can use them by name (`texture: "wood_plank"`), the Level
//   Studio lists them, and Terra draws its tiles with them. Every texture is drawn procedurally with a seeded
//   noise so it looks hand-made but stays identical every run.
// ============================================================================
var ExtraTextures = {
    names: ["wood_plank", "stone_block", "metal_plate", "glass", "pipe_green", "used_block", "wool_red", "wool_blue",
            "tex_dirt", "grass_top", "stone_raw", "ore_coal", "ore_iron", "ore_gold", "log", "leaves", "sand", "bedrock",
            "hazard", "ice", "mossy_brick", "panel_overlay", "cart_iron", "rail_tie", "pedestal_stone", "gen_grate"],

    rnd: function(seed) { var s = seed >>> 0; return function() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; },

    speckle: function(g, r, n, cols, size) {
        for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), size || 2, size || 2); }
    },

    draw: {
        wood_plank: function(g, r) {
            for (let p = 0; p < 4; p++) {
                g.fillStyle = ["#b07a3c", "#a8713a", "#b9834a", "#a26b35"][p]; g.fillRect(0, p * 8, 32, 8);
                g.fillStyle = "#8a5a2b"; for (let k = 0; k < 3; k++) g.fillRect(Math.floor(r() * 28), p * 8 + 2 + Math.floor(r() * 4), 4 + Math.floor(r() * 6), 1);
                g.fillStyle = "#6b4423"; g.fillRect(0, p * 8 + 7, 32, 1);
                var seam = (p % 2) ? 20 : 8; g.fillRect(seam, p * 8, 1, 7);
                g.fillStyle = "#3f2a16"; g.fillRect(seam - 3, p * 8 + 3, 1, 1); g.fillRect(seam + 3, p * 8 + 3, 1, 1);
            }
        },
        stone_block: function(g, r) {
            g.fillStyle = "#6b7280"; g.fillRect(0, 0, 32, 32);
            var rows = [[0, 16], [8, 24]];
            for (let y = 0; y < 2; y++) {
                g.fillStyle = "#4b5563"; g.fillRect(0, y * 16 + 15, 32, 1);
                for (let i = 0; i < 2; i++) { var x = rows[y][i]; g.fillRect(x, y * 16, 1, 15); }
                g.fillStyle = "#9ca3af"; g.fillRect(0, y * 16, 32, 1);
            }
            this.speckle(g, r, 22, ["#7b8291", "#5b6270", "#878e9c"], 2);
        },
        metal_plate: function(g) {
            var gr = g.createLinearGradient(0, 0, 32, 32); gr.addColorStop(0, "#cbd5e1"); gr.addColorStop(1, "#64748b");
            g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
            g.fillStyle = "#475569"; g.fillRect(0, 31, 32, 1); g.fillRect(31, 0, 1, 32); g.fillRect(15, 0, 1, 32);
            g.fillStyle = "#e2e8f0"; g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32);
            g.fillStyle = "#334155"; [[3, 3], [27, 3], [3, 27], [27, 27], [11, 15], [19, 15]].forEach(function(p) { g.fillRect(p[0], p[1], 2, 2); });
        },
        glass: function(g) {
            g.fillStyle = "rgba(147,197,253,0.55)"; g.fillRect(0, 0, 32, 32);
            g.fillStyle = "rgba(255,255,255,0.6)"; for (let i = 0; i < 6; i++) g.fillRect(4 + i, 20 - i * 2, 2, 2);
            g.fillRect(16, 10, 2, 2); g.fillRect(18, 8, 2, 2);
            g.fillStyle = "#bfdbfe"; g.fillRect(0, 0, 32, 1); g.fillRect(0, 31, 32, 1); g.fillRect(0, 0, 1, 32); g.fillRect(31, 0, 1, 32);
        },
        pipe_green: function(g) {
            var cols = ["#14532d", "#166534", "#15803d", "#22c55e", "#4ade80", "#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d"];
            for (let i = 0; i < 32; i++) { g.fillStyle = cols[Math.floor(i / 32 * cols.length)]; g.fillRect(i, 0, 1, 32); }
            g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(9, 0, 2, 32);
        },
        used_block: function(g) {
            g.fillStyle = "#8b5a2b"; g.fillRect(0, 0, 32, 32);
            g.fillStyle = "#a96d36"; g.fillRect(1, 1, 30, 2); g.fillRect(1, 1, 2, 30);
            g.fillStyle = "#5c3a1a"; g.fillRect(1, 29, 30, 2); g.fillRect(29, 1, 2, 30);
            g.fillStyle = "#3b2410"; [[5, 5], [25, 5], [5, 25], [25, 25]].forEach(function(p) { g.fillRect(p[0], p[1], 3, 3); });
        },
        wool_red: function(g, r) { ExtraTextures.knit(g, "#dc2626", "#b91c1c", "#f87171"); },
        wool_blue: function(g, r) { ExtraTextures.knit(g, "#2563eb", "#1d4ed8", "#60a5fa"); },
        tex_dirt: function(g, r) { g.fillStyle = "#7c4a26"; g.fillRect(0, 0, 32, 32); this.speckle(g, r, 40, ["#6b3f20", "#8d5a31", "#5c361b", "#9a6a3c"], 2); this.speckle(g, r, 4, ["#a8a29e"], 3); },
        grass_top: function(g, r) {
            this.tex_dirt(g, r);
            g.fillStyle = "#4f8a33"; g.fillRect(0, 0, 32, 9);
            g.fillStyle = "#6fbf4a"; for (let x = 0; x < 32; x += 2) g.fillRect(x, 0, 1, 2 + Math.floor(r() * 5));
            g.fillStyle = "#3f7d2b"; for (let x = 1; x < 32; x += 3) g.fillRect(x, 8, 1, 1 + Math.floor(r() * 4));
        },
        stone_raw: function(g, r) {
            g.fillStyle = "#6b7280"; g.fillRect(0, 0, 32, 32);
            this.speckle(g, r, 30, ["#5b6270", "#7b8291", "#4b5563", "#8a919f"], 3);
            g.fillStyle = "#4b5563"; var x = 4 + Math.floor(r() * 20), y = Math.floor(r() * 10);
            for (let i = 0; i < 10; i++) { g.fillRect(x, y, 1, 2); x += Math.round(r() * 2 - 1); y += 2; }
        },
        ore_coal: function(g, r) { this.stone_raw(g, r); ExtraTextures.ore(g, r, ["#111827", "#1f2937", "#374151"]); },
        ore_iron: function(g, r) { this.stone_raw(g, r); ExtraTextures.ore(g, r, ["#e7c9a9", "#c49a6c", "#f5deb3"]); },
        ore_gold: function(g, r) { this.stone_raw(g, r); ExtraTextures.ore(g, r, ["#fde047", "#eab308", "#fef08a"]); },
        log: function(g, r) {
            g.fillStyle = "#8b5a2b"; g.fillRect(0, 0, 32, 32);
            for (let x = 0; x < 32; x += 4) { g.fillStyle = (x / 4) % 2 ? "#6f4520" : "#9c6a36"; g.fillRect(x, 0, 2, 32); }
            this.speckle(g, r, 8, ["#4a2e14"], 2);
        },
        leaves: function(g, r) {
            g.fillStyle = "#3f7d2b"; g.fillRect(0, 0, 32, 32);
            this.speckle(g, r, 40, ["#2f6a20", "#4f9a36", "#5aad3e", "#285a1b"], 4);
            g.fillStyle = "rgba(0,0,0,0.18)"; this.speckle(g, r, 10, ["rgba(0,0,0,0.25)"], 3);
        },
        sand: function(g, r) { g.fillStyle = "#d6c27a"; g.fillRect(0, 0, 32, 32); this.speckle(g, r, 45, ["#c8b26a", "#e3d08e", "#bfa65e", "#efe0a6"], 1); },
        bedrock: function(g, r) { g.fillStyle = "#1f2937"; g.fillRect(0, 0, 32, 32); this.speckle(g, r, 30, ["#374151", "#111827", "#4b5563"], 4); },
        hazard: function(g) {
            g.fillStyle = "#facc15"; g.fillRect(0, 0, 32, 32);
            g.fillStyle = "#111827";
            for (let i = -32; i < 32; i += 16) { g.beginPath(); g.moveTo(i, 32); g.lineTo(i + 8, 32); g.lineTo(i + 40, 0); g.lineTo(i + 32, 0); g.closePath(); g.fill(); }
        },
        ice: function(g, r) {
            g.fillStyle = "#bae6fd"; g.fillRect(0, 0, 32, 32);
            g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1;
            g.beginPath(); g.moveTo(3, 28); g.lineTo(12, 18); g.lineTo(10, 10); g.moveTo(12, 18); g.lineTo(22, 16); g.lineTo(28, 6); g.stroke();
            g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(4, 3, 8, 2);
        },
        // see-through car-body detail: panel seams, rivets and a highlight, drawn over any paint colour
        panel_overlay: function(g) {
            g.clearRect(0, 0, 32, 32);
            g.fillStyle = "rgba(0,0,0,0.28)"; g.fillRect(0, 15, 32, 1); g.fillRect(15, 0, 1, 15);
            g.fillStyle = "rgba(255,255,255,0.22)"; g.fillRect(0, 16, 32, 1); g.fillRect(2, 2, 10, 2);
            g.fillStyle = "rgba(0,0,0,0.35)"; [[4, 12], [27, 12], [4, 28], [27, 28]].forEach(function(p) { g.fillRect(p[0], p[1], 2, 2); });
        },
        cart_iron: function(g, r) {
            g.fillStyle = "#57534e"; g.fillRect(0, 0, 32, 32);
            this.speckle(g, r, 22, ["#44403c", "#6b6560", "#78350f"], 2);
            g.fillStyle = "#292524"; g.fillRect(0, 0, 32, 3); g.fillRect(0, 29, 32, 3);
            g.fillStyle = "#a8a29e"; for (let x = 3; x < 32; x += 8) { g.fillRect(x, 1, 2, 1); g.fillRect(x, 30, 2, 1); }
        },
        rail_tie: function(g, r) {
            g.fillStyle = "#7c4a26"; g.fillRect(0, 0, 32, 32);
            g.fillStyle = "#5c361b"; for (let y = 3; y < 32; y += 7) g.fillRect(0, y + Math.floor(r() * 2), 32, 1);
            this.speckle(g, r, 10, ["#9a6a3c", "#4a2c16"], 2);
        },
        pedestal_stone: function(g, r) {
            g.fillStyle = "#64748b"; g.fillRect(0, 0, 32, 32);
            this.speckle(g, r, 24, ["#5b6b80", "#7b8aa0", "#4b5a6e"], 2);
            g.fillStyle = "#ca8a04"; g.fillRect(0, 0, 32, 2);
            g.fillStyle = "#334155"; g.fillRect(0, 14, 32, 1); g.fillRect(10, 2, 1, 12); g.fillRect(22, 15, 1, 17);
        },
        gen_grate: function(g) {
            g.fillStyle = "#1e293b"; g.fillRect(0, 0, 32, 32);
            g.fillStyle = "#475569"; for (let x = 0; x < 32; x += 6) g.fillRect(x, 0, 2, 32);
            g.fillStyle = "#0f172a"; g.fillRect(0, 15, 32, 2);
        },
        mossy_brick: function(g, r) {
            g.fillStyle = "#7f3a26"; g.fillRect(0, 0, 32, 32);
            g.fillStyle = "#5b2416"; g.fillRect(0, 15, 32, 2); g.fillRect(0, 31, 32, 1); g.fillRect(15, 0, 2, 15); g.fillRect(7, 17, 2, 14);
            this.speckle(g, r, 26, ["#4d7c2a", "#5f9a34", "#3d6b21"], 3);
        }
    },

    knit: function(g, a, b, c) {
        g.fillStyle = a; g.fillRect(0, 0, 32, 32);
        for (let y = 0; y < 32; y += 4) for (let x = 0; x < 32; x += 4) {
            g.fillStyle = b; g.fillRect(x, y + 2, 2, 2); g.fillRect(x + 2, y, 2, 2);
            g.fillStyle = c; g.fillRect(x, y, 1, 1);
        }
    },

    ore: function(g, r, cols) {
        for (let k = 0; k < 4; k++) {
            var x = 3 + Math.floor(r() * 24), y = 3 + Math.floor(r() * 24);
            for (let i = 0; i < 5; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(x + Math.floor(r() * 5) - 2, y + Math.floor(r() * 5) - 2, 3, 3); }
        }
    },

    install: function() {
        if (typeof TextureManager === "undefined") return;
        if (!TextureManager.canvases) TextureManager.init();
        var self = this;
        this.names.forEach(function(n, i) {
            if (TextureManager.canvases[n]) return;
            var r = self.rnd(1000 + i * 7919);
            TextureManager.canvases[n] = TextureManager.createTileCanvas(32, 32, function(g) { self.draw[n].call(self.draw, g, r); });
        });
    }
};
// the per-texture functions call each other (grass_top -> tex_dirt) and the shared helpers
ExtraTextures.draw.speckle = ExtraTextures.speckle;
// re-add after every TextureManager.init() (it resets the canvas table)
(function() {
    var orig = TextureManager.buildAllPatterns;
    TextureManager.buildAllPatterns = function() { orig.apply(TextureManager, arguments); ExtraTextures.install(); };
})();
ExtraTextures.install();
