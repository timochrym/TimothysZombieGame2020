class SummonManager {

    static init() {
        this.isOpen = false;
        this.toolMode = "shoot"; // "shoot" | "place" | "select"
        this.spawnType = "box";
        this.spawnW = 240;
        this.spawnH = 40;
        this.spawnColor = "#b84a27";
        this.spawnTexture = "brick";
        this.spawnBounce = 24;
        this.spawnZombieType = "NORMAL";
        this.spawnPowerType = "RAPID";

        // Default 40px Grid for new objects to adhere to!
        this.gridSnap = 40;
        this.showGrid = false;
        this.paletteDragging = false;

        this.selectedObject = null;
        this.hoveredObject = null;
        this.draggingObject = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.resizingObject = null;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        this.hoveredHandle = null;
        this.pauseWaves = false;

        this.presets = {
            "box": { w: 240, h: 40, color: "#b84a27", texture: "brick", label: "Brick Platform" },
            "grass_box": { w: 320, h: 40, color: "#7f4f24", texture: "grass_dirt", label: "Grass Platform" },
            "ramp_right": { w: 240, h: 120, color: "#6c3c28", texture: "dojo_wood", label: "Ramp Right (/)" },
            "ramp_left": { w: 240, h: 120, color: "#6c3c28", texture: "dojo_wood", label: "Ramp Left (\\)" },
            "bumper": { w: 120, h: 40, color: "#ff2e63", texture: "solid", bounce: 24, label: "Bounce Pad" },
            "crate": { w: 80, h: 80, color: "#d9a05b", texture: "crate_plank", label: "Wooden Crate" },
            "tnt": { w: 80, h: 80, color: "#e84545", texture: "solid", label: "TNT Barrel" },
            "bouncy_cube": { w: 80, h: 80, color: "#00f5d4", texture: "neon_grid", label: "Bouncy Cube" },
            "zombie": { w: 80, h: 80, color: "#2d6e32", texture: "solid", label: "Zombie" },
            "powerup": { w: 40, h: 40, color: "#ffdd33", texture: "question_gold", label: "Power-Up" }
        };

        this.buildUI();
        this.refreshLevelDropdown();
        this.refreshObjectList();
    }

    // Aligns coordinates and sizes so new objects adhere cleanly to the World Grid
    static snapVal(val) {
        if (!this.gridSnap || this.gridSnap <= 1) return Math.round(val);
        return Math.round(val / this.gridSnap) * this.gridSnap;
    }

    static snapCenterForSize(worldVal, size) {
        if (!this.gridSnap || this.gridSnap <= 1) return Math.round(worldVal);
        var g = this.gridSnap;
        // Align the bottom-left edge of the object to the grid cell boundary
        var half = size / 2;
        var snappedEdge = Math.round((worldVal - half) / g) * g;
        return snappedEdge + half;
    }

    static toggleGodMode() {
        godMode = !godMode;
        var btn = document.getElementById("god-mode-btn");
        if (btn) {
            btn.classList.toggle("active", godMode);
            btn.innerHTML = godMode ? "⚡ GOD MODE: ON [V]" : "⚡ God Mode [V]";
        }
        if (redGuy) {
            if (godMode && redGuy.isZombie) redGuy.reviveAsHuman();
            redGuy.health = redGuy.maxHealth;
            redGuy.jetpackFuel = redGuy.jetpackMaxFuel;
            Components.addFloatingText(godMode ? "GOD MODE ACTIVATED!" : "GOD MODE OFF", redGuy.x, redGuy.y + 80, "#ffdd00", 24);
        }
    }

    static buildUI() {
        var style = document.createElement("style");
        style.textContent = `
            #top-right-bar {
                position: fixed;
                top: 14px;
                right: 16px;
                z-index: 1000;
                display: flex;
                gap: 8px;
                align-items: center;
                user-select: none;
            }
            #level-select-dropdown {
                background: #14222e;
                color: #55ff88;
                border: 2px solid #3c6e82;
                padding: 8px 10px;
                font-family: monospace;
                font-size: 12px;
                font-weight: bold;
                border-radius: 6px;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.45);
            }
            .top-bar-btn {
                background: #14222e;
                color: #ffdd44;
                border: 2px solid #3c6e82;
                padding: 8px 12px;
                font-family: monospace;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.45);
                transition: all 0.15s;
            }
            .top-bar-btn:hover {
                background: #1f3649;
            }
            .top-bar-btn.active {
                background: #ffdd00;
                color: #111;
                border-color: #fff;
                box-shadow: 0 0 14px rgba(255, 221, 0, 0.7);
            }

            /* Mario Maker Inspired Drag-and-Drop Bottom Palette Dock (Only visible in Developer Mode!) */
            #mario-maker-dock {
                position: fixed;
                bottom: 12px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000;
                background: rgba(14, 23, 32, 0.94);
                border: 2px solid #ffdd44;
                border-radius: 10px;
                padding: 8px 12px;
                display: none;
                align-items: center;
                gap: 8px;
                box-shadow: 0 8px 26px rgba(0,0,0,0.7);
                user-select: none;
                font-family: monospace;
            }
            #mario-maker-dock.open {
                display: flex;
            }
            .mm-tile {
                width: 68px;
                height: 54px;
                background: #1b2e3d;
                border: 2px solid #3c6e82;
                border-radius: 7px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: grab;
                color: #fff;
                font-size: 10px;
                font-weight: bold;
                text-align: center;
                transition: transform 0.1s, border-color 0.1s, background 0.1s;
                position: relative;
            }
            .mm-tile:hover {
                transform: translateY(-3px);
                border-color: #ffdd44;
                background: #253f52;
            }
            .mm-tile.selected {
                border-color: #00f5d4;
                background: #1f4e5f;
                box-shadow: 0 0 10px rgba(0, 245, 212, 0.45);
            }
            .mm-tile:active {
                cursor: grabbing;
            }
            .mm-icon {
                font-size: 18px;
                margin-bottom: 3px;
            }
            .mm-divider {
                width: 2px;
                height: 44px;
                background: #2b4558;
                margin: 0 2px;
            }
            .mm-controls {
                display: flex;
                flex-direction: column;
                gap: 4px;
                color: #98c1d9;
                font-size: 11px;
            }
            .mm-mini-select {
                background: #0b131b;
                color: #ffdd44;
                border: 1px solid #3c6e82;
                padding: 3px 5px;
                font-family: monospace;
                font-size: 11px;
                font-weight: bold;
                border-radius: 4px;
                cursor: pointer;
            }

            #summon-panel {
                position: fixed;
                top: 58px;
                right: 16px;
                width: 370px;
                max-height: calc(100vh - 148px);
                background: rgba(12, 20, 28, 0.95);
                border: 2px solid #3c6e82;
                border-radius: 8px;
                color: #e0fbfc;
                font-family: monospace;
                font-size: 12px;
                z-index: 1000;
                display: none;
                flex-direction: column;
                overflow: hidden;
                box-shadow: 0 8px 24px rgba(0,0,0,0.65);
                user-select: none;
            }
            #summon-panel.open {
                display: flex;
            }
            .sp-section {
                padding: 8px 12px;
                border-bottom: 1px solid #264152;
            }
            .sp-title {
                font-size: 12px;
                font-weight: bold;
                color: #ffdd44;
                margin-bottom: 6px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .sp-modes {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 6px;
            }
            .sp-btn {
                background: #1d3242;
                color: #ffffff;
                border: 1px solid #3c6e82;
                padding: 5px 8px;
                font-family: monospace;
                font-size: 11px;
                font-weight: bold;
                border-radius: 4px;
                cursor: pointer;
                text-align: center;
            }
            .sp-btn:hover {
                background: #29475e;
            }
            .sp-btn.active {
                background: #ffdd44;
                color: #111;
                border-color: #ffffff;
            }
            .sp-btn.primary {
                background: #2a9d8f;
                border-color: #52b788;
            }
            .sp-btn.warn {
                background: #e76f51;
                border-color: #f4a261;
            }
            .sp-row {
                display: flex;
                gap: 6px;
                align-items: center;
                margin-bottom: 5px;
            }
            .sp-row label {
                width: 64px;
                color: #98c1d9;
                flex-shrink: 0;
            }
            .sp-input, .sp-select {
                background: #0b131b;
                color: #fff;
                border: 1px solid #3c6e82;
                padding: 4px 6px;
                font-family: monospace;
                font-size: 11px;
                border-radius: 4px;
                width: 100%;
                box-sizing: border-box;
            }
            .sp-color {
                width: 42px;
                height: 24px;
                padding: 0;
                border: 1px solid #3c6e82;
                background: none;
                cursor: pointer;
            }
            #sp-obj-list {
                overflow-y: auto;
                max-height: 150px;
                padding: 6px 10px;
            }
            .sp-obj-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 6px;
                margin-bottom: 4px;
                background: #152431;
                border: 1px solid #253d50;
                border-radius: 4px;
                cursor: pointer;
            }
            .sp-obj-item:hover {
                border-color: #5bc0be;
            }
            .sp-obj-item.selected {
                background: #213c50;
                border-color: #ffdd44;
            }
            .sp-swatch {
                width: 11px;
                height: 11px;
                border-radius: 2px;
                display: inline-block;
                margin-right: 6px;
                border: 1px solid rgba(255,255,255,0.4);
                vertical-align: middle;
            }
            .sp-small-btn {
                background: #264653;
                color: #fff;
                border: 1px solid #457b9d;
                padding: 2px 6px;
                font-family: monospace;
                font-size: 10px;
                border-radius: 3px;
                cursor: pointer;
                margin-left: 3px;
            }
            .sp-small-btn.del {
                background: #9b2226;
                border-color: #ae2012;
            }
        `;
        document.head.appendChild(style);

        // Top-Right Bar: Level Select + God Mode + Inspector Toggle
        var topBar = document.createElement("div");
        topBar.id = "top-right-bar";
        topBar.addEventListener("mousedown", function(e) { e.stopPropagation(); });
        topBar.addEventListener("click", function(e) { e.stopPropagation(); });

        var lvlSelect = document.createElement("select");
        lvlSelect.id = "level-select-dropdown";
        lvlSelect.addEventListener("change", function() {
            if (typeof LevelManager !== "undefined") {
                LevelManager.selectLevel(this.value);
            }
            this.blur();
        });
        topBar.appendChild(lvlSelect);

        var trailBtn = document.createElement("button");
        trailBtn.className = "top-bar-btn";
        trailBtn.innerHTML = "🌲 Frontier [6]";
        trailBtn.title = "Launch Procedural Frontier Side-Scroller!";
        trailBtn.addEventListener("click", function() {
            if (typeof LevelManager !== "undefined") {
                LevelManager.selectLevel("infinite_frontier");
            }
        });
        topBar.appendChild(trailBtn);

        var godBtn = document.createElement("button");
        godBtn.id = "god-mode-btn";
        godBtn.className = "top-bar-btn";
        godBtn.style.display = "none";
        godBtn.innerHTML = "⚡ God Mode [V]";
        godBtn.addEventListener("click", function(e) {
            e.stopPropagation();
            SummonManager.toggleGodMode();
        });
        topBar.appendChild(godBtn);

        var toggleBtn = document.createElement("button");
        toggleBtn.id = "summon-toggle-btn";
        toggleBtn.className = "top-bar-btn";
        toggleBtn.innerHTML = "🛠️ Dev Mode [B]";
        toggleBtn.addEventListener("click", function(e) {
            e.stopPropagation();
            SummonManager.togglePanel();
        });
        topBar.appendChild(toggleBtn);
        document.body.appendChild(topBar);

        // Bottom Mario-Maker Drag-Out Dock!
        var dock = document.createElement("div");
        dock.id = "mario-maker-dock";
        dock.addEventListener("mousedown", function(e) { e.stopPropagation(); });
        dock.addEventListener("click", function(e) { e.stopPropagation(); });

        var dockItems = [
            { id: "box", icon: "🧱", label: "Brick Box" },
            { id: "grass_box", icon: "🌿", label: "Grass Plat" },
            { id: "ramp_right", icon: "📐", label: "Ramp /" },
            { id: "ramp_left", icon: "📐", label: "Ramp \\" },
            { id: "bumper", icon: "⏫", label: "Bounce Pad" },
            { id: "crate", icon: "📦", label: "Wood Crate" },
            { id: "tnt", icon: "🧨", label: "TNT Barrel" },
            { id: "bouncy_cube", icon: "💎", label: "Bouncy Cube" },
            { id: "zombie", icon: "🧟", label: "Zombie" },
            { id: "powerup", icon: "⚡", label: "Power-Up" }
        ];

        var dockHTML = `<div style="color:#ffdd44;font-weight:bold;font-size:11px;margin-right:4px;line-height:1.2;">DRAG OUT<br>TO GAME:</div>`;
        for (let i = 0; i < dockItems.length; i++) {
            var it = dockItems[i];
            dockHTML += `
                <div class="mm-tile ${i === 0 ? 'selected' : ''}" data-type="${it.id}"
                     onmousedown="SummonManager.startPaletteDrag('${it.id}', event)"
                     title="Drag onto the map or click to select">
                    <span class="mm-icon">${it.icon}</span>
                    <span>${it.label}</span>
                </div>
            `;
        }

        dockHTML += `
            <div class="mm-divider"></div>
            <div class="mm-controls">
                <div>
                    Tex:
                    <select id="dock-texture" class="mm-mini-select" onchange="SummonManager.setTexture(this.value)">
                        <option value="brick">🧱 Brick</option>
                        <option value="grass_dirt">🌿 Grass/Dirt</option>
                        <option value="castle_stone">🏰 Stone</option>
                        <option value="lab_metal">⚙️ Lab Metal</option>
                        <option value="dojo_wood">🎋 Dojo Wood</option>
                        <option value="neon_grid">🌐 Neon Grid</option>
                        <option value="question_gold">🪙 Gold Block</option>
                        <option value="crate_plank">📦 Crate Wood</option>
                        <option value="solid">🎨 Solid Color</option>
                    </select>
                </div>
                <div style="display:flex;gap:4px;align-items:center;">
                    Grid:
                    <select id="dock-grid" class="mm-mini-select" onchange="SummonManager.setGridSnap(Number(this.value))">
                        <option value="40" selected>40px (On)</option>
                        <option value="20">20px (Fine)</option>
                        <option value="80">80px (Large)</option>
                        <option value="0">Free (Off)</option>
                    </select>
                    <button class="sp-small-btn" id="dock-grid-vis" onclick="SummonManager.toggleShowGrid()">📏 Grid</button>
                    <button class="sp-small-btn" id="dock-edit-btn" onclick="SummonManager.setToolMode(SummonManager.toolMode=='select'?'shoot':'select')">✋ Move</button>
                </div>
            </div>
        `;
        dock.innerHTML = dockHTML;
        document.body.appendChild(dock);

        // Right-side Inspector & Level Editor Panel
        var panel = document.createElement("div");
        panel.id = "summon-panel";
        panel.addEventListener("mousedown", function(e) { e.stopPropagation(); });
        panel.addEventListener("click", function(e) { e.stopPropagation(); });
        panel.addEventListener("keydown", function(e) { e.stopPropagation(); });

        panel.innerHTML = `
            <div class="sp-section">
                <div class="sp-title">
                    <span>🗺 LEVEL EDITOR & STRESS LAB</span>
                </div>
                <div class="sp-row">
                    <input type="text" id="sp-level-name" class="sp-input" placeholder="Custom Level Name..." value="My Custom Arena">
                    <button class="sp-btn primary" style="flex-shrink:0;" onclick="LevelManager.saveCustomLevel(document.getElementById('sp-level-name').value)">💾 Save</button>
                    <button class="sp-btn" style="flex-shrink:0;" onclick="LevelManager.createNewBlankLevel()">➕ Blank</button>
                </div>
                <div style="display:flex;gap:5px;margin-top:4px;">
                    <button class="sp-btn warn" style="flex:1;" onclick="LevelManager.selectLevel('stress_test')">⚠️ Stress Lab</button>
                    <button class="sp-btn" style="flex:1;" onclick="LevelManager.rainStressCrates(18)">🌧 Rain 18</button>
                    <button class="sp-btn" style="flex:1;" onclick="LevelManager.joltAllObjects()">⚡ Jolt</button>
                </div>
            </div>

            <div class="sp-section">
                <div class="sp-title">
                    <span>MOUSE CURSOR MODE</span>
                    <span id="sp-mode-hint" style="font-size:10px;color:#88cc99;">Click: Shoot | R-Click: Grab</span>
                </div>
                <div class="sp-modes">
                    <button class="sp-btn active" id="mode-shoot" onclick="SummonManager.setToolMode('shoot')">🔫 Play/Shoot</button>
                    <button class="sp-btn" id="mode-place" onclick="SummonManager.setToolMode('place')">➕ Place Obj</button>
                    <button class="sp-btn" id="mode-select" onclick="SummonManager.setToolMode('select')">✋ Edit/Drag</button>
                </div>
            </div>

            <div class="sp-section">
                <div class="sp-title"><span>📐 NEW OBJECT SIZE & TEXTURE</span></div>
                <div class="sp-row" id="sp-size-row">
                    <label>W / H:</label>
                    <input type="number" id="sp-w" class="sp-input" value="240" step="40" min="20" max="2000" onchange="SummonManager.spawnW = Number(this.value)">
                    <input type="number" id="sp-h" class="sp-input" value="40" step="40" min="20" max="2000" onchange="SummonManager.spawnH = Number(this.value)">
                    <input type="color" id="sp-color" class="sp-color" value="#b84a27" onchange="SummonManager.spawnColor = this.value">
                </div>
                <div class="sp-row" id="sp-zombie-row" style="display:none;">
                    <label>Zombie:</label>
                    <select id="sp-zombie-type" class="sp-select" onchange="SummonManager.spawnZombieType = this.value">
                        <option value="NORMAL">Normal Zombie</option>
                        <option value="LEAPER">Leaper Zombie (High Jump)</option>
                        <option value="TANK">Tank Zombie (Giant)</option>
                        <option value="EXPLODER">Exploder Zombie</option>
                        <option value="SPITTER">Spitter Zombie (Laser)</option>
                    </select>
                </div>
                <div class="sp-row" id="sp-power-row" style="display:none;">
                    <label>Power:</label>
                    <select id="sp-power-type" class="sp-select" onchange="SummonManager.spawnPowerType = this.value">
                        <option value="RAPID">RAPID (Triple Laser)</option>
                        <option value="SPEED">SPEED (Fast + High Jump)</option>
                        <option value="HEAL">HEAL (+50 Health)</option>
                        <option value="BLOWUP">BLOWUP (Mega Blast)</option>
                    </select>
                </div>
            </div>

            <div class="sp-section" id="sp-inspector" style="display:none;">
                <div class="sp-title">
                    <span id="sp-insp-title">SELECTED OBJECT</span>
                    <button class="sp-small-btn del" onclick="SummonManager.deleteSelected()">🗑 Delete [Del]</button>
                </div>
                <div class="sp-row">
                    <label>Pos X/Y:</label>
                    <input type="number" id="sp-edit-x" class="sp-input" step="20" onchange="SummonManager.updateSelectedProps()">
                    <input type="number" id="sp-edit-y" class="sp-input" step="20" onchange="SummonManager.updateSelectedProps()">
                </div>
                <div class="sp-row" id="sp-edit-size-row">
                    <label>Size W/H:</label>
                    <input type="number" id="sp-edit-w" class="sp-input" step="20" min="16" max="3000" onchange="SummonManager.updateSelectedProps()">
                    <input type="number" id="sp-edit-h" class="sp-input" step="20" min="16" max="3000" onchange="SummonManager.updateSelectedProps()">
                    <input type="color" id="sp-edit-color" class="sp-color" onchange="SummonManager.updateSelectedProps()">
                </div>
                <div class="sp-row">
                    <label>Texture:</label>
                    <select id="sp-edit-texture" class="sp-select" onchange="SummonManager.updateSelectedProps()">
                        <option value="brick">🧱 Brick</option>
                        <option value="grass_dirt">🌿 Grass/Dirt</option>
                        <option value="castle_stone">🏰 Castle Stone</option>
                        <option value="lab_metal">⚙️ Lab Metal</option>
                        <option value="dojo_wood">🎋 Dojo Wood</option>
                        <option value="neon_grid">🌐 Neon Grid</option>
                        <option value="question_gold">🪙 Gold Block</option>
                        <option value="crate_plank">📦 Crate Wood</option>
                        <option value="solid">🎨 Solid Color</option>
                    </select>
                </div>
                <div style="display:flex;gap:6px;margin-top:5px;">
                    <button class="sp-btn" id="sp-toggle-physics" style="flex:1;" onclick="SummonManager.toggleSelectedPhysics()">Toggle Physics</button>
                    <button class="sp-btn" style="flex:1;" onclick="SummonManager.duplicateSelected()">Duplicate</button>
                </div>
            </div>

            <div class="sp-section" style="padding-bottom:4px;">
                <div class="sp-title">
                    <span>📦 EXISTING OBJECTS (<span id="sp-obj-count">0</span>)</span>
                    <div>
                        <button class="sp-small-btn" onclick="if(typeof Pathfinder!=='undefined'){Pathfinder.showDebug=!Pathfinder.showDebug;}">🧭 Paths [P]</button>
                        <button class="sp-small-btn" id="sp-wave-btn" onclick="SummonManager.toggleWavePause()">⏸ Waves</button>
                        <button class="sp-small-btn del" onclick="SummonManager.clearCrates()">Clear Crates</button>
                    </div>
                </div>
            </div>
            <div id="sp-obj-list"></div>
        `;
        document.body.appendChild(panel);
    }

    static startPaletteDrag(type, event) {
        if (event) event.preventDefault();
        this.onPresetChange(type);
        this.paletteDragging = true;

        var tiles = document.querySelectorAll(".mm-tile");
        for (let i = 0; i < tiles.length; i++) {
            tiles[i].classList.toggle("selected", tiles[i].getAttribute("data-type") === type);
        }
    }

    static setTexture(tex) {
        this.spawnTexture = tex;
        if (this.selectedObject && !(this.selectedObject instanceof Character)) {
            this.selectedObject.texture = (tex == "solid") ? null : tex;
        }
    }

    static setGridSnap(val) {
        this.gridSnap = val;
    }

    static toggleShowGrid() {
        this.showGrid = !this.showGrid;
        var btn = document.getElementById("dock-grid-vis");
        if (btn) {
            btn.style.background = this.showGrid ? "#2a9d8f" : "#264653";
        }
    }

    static refreshLevelDropdown() {
        var sel = document.getElementById("level-select-dropdown");
        if (!sel || typeof LevelManager === "undefined") return;
        var all = LevelManager.getAllLevels();
        var html = "";
        for (var k in all) {
            var selected = (k === LevelManager.currentLevelKey) ? "selected" : "";
            html += `<option value="${k}" ${selected}>${all[k].name}</option>`;
        }
        sel.innerHTML = html;
    }

    static togglePanel() {
        this.isOpen = !this.isOpen;
        var panel = document.getElementById("summon-panel");
        var dock = document.getElementById("mario-maker-dock");
        var godBtn = document.getElementById("god-mode-btn");
        var devBtn = document.getElementById("summon-toggle-btn");

        if (this.isOpen) {
            if (panel) panel.classList.add("open");
            if (dock) dock.classList.add("open");
            if (godBtn) godBtn.style.display = "inline-block";
            if (devBtn) {
                devBtn.classList.add("active");
                devBtn.innerHTML = "🛠️ Dev Mode: ON [B]";
            }
            this.refreshLevelDropdown();
            this.refreshObjectList();
        } else {
            if (panel) panel.classList.remove("open");
            if (dock) dock.classList.remove("open");
            if (godBtn && !godMode) godBtn.style.display = "none";
            if (devBtn) {
                devBtn.classList.remove("active");
                devBtn.innerHTML = "🛠️ Dev Mode [B]";
            }
            this.showGrid = false;
            this.setToolMode("shoot");
        }
    }

    static setToolMode(mode) {
        this.toolMode = mode;
        var mShoot = document.getElementById("mode-shoot");
        var mPlace = document.getElementById("mode-place");
        var mSelect = document.getElementById("mode-select");
        if (mShoot) mShoot.classList.toggle("active", mode == "shoot");
        if (mPlace) mPlace.classList.toggle("active", mode == "place");
        if (mSelect) mSelect.classList.toggle("active", mode == "select");

        var dockEditBtn = document.getElementById("dock-edit-btn");
        if (dockEditBtn) {
            dockEditBtn.style.background = (mode == "select") ? "#ffdd44" : "#264653";
            dockEditBtn.style.color = (mode == "select") ? "#111" : "#fff";
        }

        var hint = document.getElementById("sp-mode-hint");
        if (hint) {
            if (mode == "shoot") {
                hint.textContent = "Click: Shoot | R-Click: Grab";
                hint.style.color = "#88cc99";
            } else if (mode == "place") {
                hint.textContent = "L-Click: Place | R-Click: Delete";
                hint.style.color = "#ffdd44";
            } else if (mode == "select") {
                hint.textContent = "Drag Edges: Extend | Alt/Shift+Drag or 📋: Copy | R-Click: Del";
                hint.style.color = "#5bc0be";
            }
        }
    }

    static onPresetChange(type) {
        this.spawnType = type;
        var p = this.presets[type];
        if (p) {
            this.spawnW = p.w;
            this.spawnH = p.h;
            this.spawnColor = p.color;
            this.spawnTexture = p.texture || "solid";
            var wEl = document.getElementById("sp-w");
            var hEl = document.getElementById("sp-h");
            var cEl = document.getElementById("sp-color");
            var tEl = document.getElementById("dock-texture");
            if (wEl) wEl.value = p.w;
            if (hEl) hEl.value = p.h;
            if (cEl) cEl.value = p.color;
            if (tEl) tEl.value = this.spawnTexture;
        }
        var zRow = document.getElementById("sp-zombie-row");
        var pRow = document.getElementById("sp-power-row");
        if (zRow) zRow.style.display = (type == "zombie") ? "flex" : "none";
        if (pRow) pRow.style.display = (type == "powerup") ? "flex" : "none";
    }

    static spawnAt(worldX, worldY) {
        var w = Math.max(20, Number(document.getElementById("sp-w") ? document.getElementById("sp-w").value : this.spawnW) || this.spawnW);
        var h = Math.max(20, Number(document.getElementById("sp-h") ? document.getElementById("sp-h").value : this.spawnH) || this.spawnH);
        var rx = this.snapCenterForSize(worldX, w);
        var ry = this.snapCenterForSize(worldY, h);
        var col = (document.getElementById("sp-color") ? document.getElementById("sp-color").value : this.spawnColor) || this.spawnColor;
        var tex = (this.spawnTexture == "solid") ? null : this.spawnTexture;
        var created = null;

        if (this.spawnType == "box" || this.spawnType == "grass_box") {
            created = Object.addBox(rx, ry, w, h, col, { name: "Platform", texture: tex });
        } else if (this.spawnType == "ramp_right") {
            created = Object.addRamp(rx, ry, w, h, "right", col, { name: "Ramp (/)", texture: tex });
        } else if (this.spawnType == "ramp_left") {
            created = Object.addRamp(rx, ry, w, h, "left", col, { name: "Ramp (\\)", texture: tex });
        } else if (this.spawnType == "bumper") {
            created = Object.addBumper(rx, ry, w, h, this.spawnBounce || 24, col, { name: "Bounce Pad", texture: tex });
        } else if (this.spawnType == "crate") {
            created = Object.addCrate(rx, ry, w, col, { w: w, h: h, name: "Crate", texture: tex || "crate_plank" });
        } else if (this.spawnType == "tnt") {
            created = Object.addCrate(rx, ry, w, "#e84545", { w: w, h: h, explosive: true, name: "TNT Barrel" });
        } else if (this.spawnType == "bouncy_cube") {
            created = Object.addCrate(rx, ry, w, col, { w: w, h: h, bounciness: -0.92, name: "Bouncy Cube", texture: tex || "neon_grid" });
        } else if (this.spawnType == "zombie") {
            var zType = this.spawnZombieType || "NORMAL";
            var zBox = Math.makeHitbox(w, h);
            var zSpeed = speed * (zType == "LEAPER" ? 0.86 : (zType == "TANK" ? 0.44 : 0.65));
            var zHP = zType == "TANK" ? 200 : 75;
            created = new Character(
                "Zombie_" + zType,
                zBox,
                zBox,
                col,
                [rx, ry],
                maxspeed * 0.85,
                slower,
                gravity,
                bounciness,
                zSpeed,
                "ZOMBIE",
                zHP,
                "NONE",
                true,
                zType
            );
            zombies.push(created);
        } else if (this.spawnType == "powerup") {
            var pType = this.spawnPowerType || "RAPID";
            var colors = { "RAPID": "#ffdd33", "SPEED": "#33ddff", "HEAL": "#33ff88", "BLOWUP": "#ff7722" };
            powerUps.push({
                x: rx,
                y: ry,
                type: pType,
                color: colors[pType] || "#ffdd33",
                hitbox: Math.makeHitbox(40, 40),
                poly: Math.makeHitbox(40, 40),
                bobPhase: 0,
                life: 1800
            });
            Components.spawnSparks(rx, ry, colors[pType] || "#ffdd33", 8);
        }

        if (created) {
            Components.spawnSparks(rx, ry, col, 8);
            Components.addFloatingText("PLACED!", rx, ry + 30, "#ffdd44", 15);
            this.selectObject(created);
        }
        rebuildAllObjects();
        if (typeof Pathfinder !== "undefined") Pathfinder.rebuildGraph(true);
        this.refreshObjectList();
    }

    static summonNearPlayer() {
        var px = redGuy ? redGuy.x : 0;
        var py = redGuy ? redGuy.y : 200;
        var rad = redGuy ? Math.radians(redGuy.degree) : Math.PI / 2;
        var offsetX = Math.sin(rad) * 160;
        var offsetY = Math.max(60, Math.cos(rad) * 140 + 80);
        this.spawnAt(px + offsetX, py + offsetY);
    }

    static getObjectAtWorld(wx, wy) {
        var testPoint = {
            x: wx,
            y: wy,
            hitbox: Math.makeHitbox(4, 4),
            poly: Math.makeHitbox(4, 4)
        };
        for (let i = zombies.length - 1; i >= 0; i--) {
            if (!zombies[i].dead && CollisionDetector.collision(testPoint, [0, 0], [zombies[i]])) {
                return zombies[i];
            }
        }
        for (let i = movingObjects.length - 1; i >= 0; i--) {
            if (!movingObjects[i].dead && CollisionDetector.collision(testPoint, [0, 0], [movingObjects[i]])) {
                return movingObjects[i];
            }
        }
        for (let i = staticObjects.length - 1; i >= 0; i--) {
            if (!staticObjects[i].dead && CollisionDetector.collision(testPoint, [0, 0], [staticObjects[i]])) {
                return staticObjects[i];
            }
        }
        return null;
    }

    static selectObject(obj) {
        this.selectedObject = obj;
        var insp = document.getElementById("sp-inspector");
        if (!obj || obj.dead) {
            this.selectedObject = null;
            if (insp) insp.style.display = "none";
            this.refreshObjectList();
            return;
        }
        if (insp) {
            insp.style.display = "block";
            document.getElementById("sp-insp-title").textContent = "EDIT: " + obj.name + " (#" + obj.id + ")";
            document.getElementById("sp-edit-x").value = Math.round(obj.x);
            document.getElementById("sp-edit-y").value = Math.round(obj.y);
            document.getElementById("sp-edit-w").value = Math.round(obj.w || obj.s1 || 100);
            document.getElementById("sp-edit-h").value = Math.round(obj.h || obj.s2 || 100);
            if (obj.color && obj.color.startsWith("#") && obj.color.length == 7) {
                document.getElementById("sp-edit-color").value = obj.color;
            }
            var texSel = document.getElementById("sp-edit-texture");
            if (texSel) {
                texSel.value = obj.texture || "solid";
            }
            var physBtn = document.getElementById("sp-toggle-physics");
            if (obj instanceof Character) {
                physBtn.style.display = "none";
            } else {
                physBtn.style.display = "inline-block";
                physBtn.textContent = obj.movable ? "Freeze (Make Static)" : "Enable Gravity/Physics";
            }
        }
        this.refreshObjectList();
    }

    static updateSelectedProps() {
        var obj = this.selectedObject;
        if (!obj || obj.dead) return;
        obj.x = Number(document.getElementById("sp-edit-x").value) || 0;
        obj.y = Number(document.getElementById("sp-edit-y").value) || 0;
        var newW = Math.max(16, Number(document.getElementById("sp-edit-w").value) || 60);
        var newH = Math.max(16, Number(document.getElementById("sp-edit-h").value) || 60);
        obj.color = document.getElementById("sp-edit-color").value || obj.color;
        var newTex = document.getElementById("sp-edit-texture").value;
        obj.texture = (newTex == "solid") ? null : newTex;

        if (typeof obj.resize === "function") {
            obj.resize(newW, newH);
        } else if (obj instanceof Character) {
            obj.s1 = newW;
            obj.s2 = newH;
            obj.w = newW;
            obj.h = newH;
            obj.sizeScale = newW / s1;
            obj.hitbox = Math.makeHitbox(newW, newH);
            obj.poly = Math.makeHitbox(newW, newH);
        }
        if (typeof Pathfinder !== "undefined") Pathfinder.rebuildGraph(true);
        this.refreshObjectList();
    }

    static toggleSelectedPhysics() {
        var obj = this.selectedObject;
        if (!obj || (obj instanceof Character)) return;
        if (obj.movable) {
            obj.movable = false;
            obj.xspeed = 0;
            obj.yspeed = 0;
            var idx = movingObjects.indexOf(obj);
            if (idx !== -1) movingObjects.splice(idx, 1);
            if (staticObjects.indexOf(obj) === -1) staticObjects.push(obj);
        } else {
            obj.movable = true;
            obj.maxspeed = maxspeed;
            obj.slower = slower * 0.45;
            obj.gravity = gravity;
            obj.bounciness = bounciness;
            var sIdx = staticObjects.indexOf(obj);
            if (sIdx !== -1) staticObjects.splice(sIdx, 1);
            if (movingObjects.indexOf(obj) === -1) movingObjects.push(obj);
        }
        rebuildAllObjects();
        if (typeof Pathfinder !== "undefined") Pathfinder.rebuildGraph(true);
        this.selectObject(obj);
    }

    static cloneObject(obj, offsetX = 40, offsetY = 40) {
        if (!obj || obj.dead) return null;
        var w = obj.w || obj.s1 || 80;
        var h = obj.h || obj.s2 || 80;
        var copy = null;
        if (obj instanceof Character) {
            var zBox = Math.makeHitbox(w, h);
            copy = new Character(obj.name, zBox, zBox, obj.color, [obj.x + offsetX, obj.y + offsetY], obj.maxspeed, obj.slower, obj.gravity, obj.bounciness, obj.speed, obj.moveType, obj.maxHealth, obj.lazerType, obj.isZombie, obj.zombiePower);
            zombies.push(copy);
        } else if (obj.isRamp) {
            copy = Object.addRamp(obj.x + offsetX, obj.y + offsetY, w, h, obj.rampDir, obj.color, { name: obj.name, texture: obj.texture });
        } else if (obj.isBumper) {
            copy = Object.addBumper(obj.x + offsetX, obj.y + offsetY, w, h, obj.bounceForce, obj.color, { name: obj.name, texture: obj.texture });
        } else if (obj.movable) {
            copy = Object.addCrate(obj.x + offsetX, obj.y + offsetY, w, obj.color, { w: w, h: h, explosive: obj.explosive, bounciness: obj.bounciness, name: obj.name, texture: obj.texture });
        } else {
            copy = Object.addBox(obj.x + offsetX, obj.y + offsetY, w, h, obj.color, { name: obj.name, texture: obj.texture });
        }
        rebuildAllObjects();
        this.selectObject(copy);
        return copy;
    }

    static duplicateSelected() {
        var obj = this.selectedObject;
        if (!obj || obj.dead) return;
        var copy = this.cloneObject(obj, 40, 40);
        if (copy) {
            Components.addFloatingText("DUPLICATED!", copy.x, copy.y + 40, "#00f5d4", 15);
        }
    }

    // Returns the 8 edge/corner resize handles + floating Duplicate & Flip action pills for an object in screen coordinates
    static getHandlesForObject(obj) {
        if (!obj || obj.dead) return [];
        var b = CollisionDetector.getBounds(obj);
        var sx = b.left * cameraScaleX + xc;
        var sy = -b.top * cameraScaleY + yc;
        var sw = (b.right - b.left) * cameraScaleX;
        var sh = (b.top - b.bottom) * cameraScaleY;
        var mx = sx + sw / 2;
        var my = sy + sh / 2;

        var handles = [
            { id: "w",  x: sx,      y: my,      cursor: "ew-resize",   obj: obj, label: "Extend Left" },
            { id: "e",  x: sx + sw, y: my,      cursor: "ew-resize",   obj: obj, label: "Extend Right" },
            { id: "n",  x: mx,      y: sy,      cursor: "ns-resize",   obj: obj, label: "Extend Top" },
            { id: "s",  x: mx,      y: sy + sh, cursor: "ns-resize",   obj: obj, label: "Extend Bottom" },
            { id: "nw", x: sx,      y: sy,      cursor: "nwse-resize", obj: obj, label: "Resize Corner" },
            { id: "ne", x: sx + sw, y: sy,      cursor: "nesw-resize", obj: obj, label: "Resize Corner" },
            { id: "sw", x: sx,      y: sy + sh, cursor: "nesw-resize", obj: obj, label: "Resize Corner" },
            { id: "se", x: sx + sw, y: sy + sh, cursor: "nwse-resize", obj: obj, label: "Resize Corner" },
            // Floating on-canvas Duplicate drag pill
            { id: "copy", x: sx + sw - 34, y: sy - 20, w: 68, h: 20, isPill: true, cursor: "copy", obj: obj, text: "📋 Copy" }
        ];
        if (obj.isRamp) {
            handles.push({ id: "flip", x: sx + 32, y: sy - 20, w: 64, h: 20, isPill: true, cursor: "pointer", obj: obj, text: "🔄 Flip" });
        }
        return handles;
    }

    static getHandleAtScreen(screenX, screenY) {
        var candidates = [];
        if (this.selectedObject && !this.selectedObject.dead) candidates.push(this.selectedObject);
        if (this.hoveredObject && !this.hoveredObject.dead && this.hoveredObject !== this.selectedObject) {
            candidates.push(this.hoveredObject);
        }
        for (let c = 0; c < candidates.length; c++) {
            var handles = this.getHandlesForObject(candidates[c]);
            for (let i = 0; i < handles.length; i++) {
                var h = handles[i];
                if (h.isPill) {
                    if (Math.abs(screenX - h.x) <= h.w / 2 + 4 && Math.abs(screenY - h.y) <= h.h / 2 + 4) {
                        return h;
                    }
                } else {
                    if (Math.hypot(screenX - h.x, screenY - h.y) <= 11) {
                        return h;
                    }
                }
            }
        }
        return null;
    }

    static applyResizeHandleDrag(obj, handleId, startB, wx, wy) {
        var g = (this.gridSnap && this.gridSnap > 1) ? this.gridSnap : 20;
        var minSize = Math.max(20, g);
        var snapW = this.snapVal(wx);
        var snapH = this.snapVal(wy);

        var left = startB.left;
        var right = startB.right;
        var bottom = startB.bottom;
        var top = startB.top;

        if (handleId.indexOf("e") !== -1) {
            right = Math.max(left + minSize, snapW);
        }
        if (handleId.indexOf("w") !== -1) {
            left = Math.min(right - minSize, snapW);
        }
        if (handleId.indexOf("n") !== -1) {
            top = Math.max(bottom + minSize, snapH);
        }
        if (handleId.indexOf("s") !== -1) {
            bottom = Math.min(top - minSize, snapH);
        }

        var newW = Math.round(right - left);
        var newH = Math.round(top - bottom);
        obj.x = Math.round(left + newW / 2);
        obj.y = Math.round(bottom + newH / 2);

        if (typeof obj.resize === "function") {
            obj.resize(newW, newH);
        } else if (obj instanceof Character) {
            obj.s1 = newW;
            obj.s2 = newH;
            obj.w = newW;
            obj.h = newH;
            obj.sizeScale = newW / s1;
            obj.hitbox = Math.makeHitbox(newW, newH);
            obj.poly = Math.makeHitbox(newW, newH);
        }

        if (this.selectedObject == obj && document.getElementById("sp-edit-x")) {
            document.getElementById("sp-edit-x").value = obj.x;
            document.getElementById("sp-edit-y").value = obj.y;
            document.getElementById("sp-edit-w").value = newW;
            document.getElementById("sp-edit-h").value = newH;
        }
    }

    static deleteObject(obj) {
        if (!obj) return;
        obj.dead = true;
        var sIdx = staticObjects.indexOf(obj);
        if (sIdx !== -1) staticObjects.splice(sIdx, 1);
        var mIdx = movingObjects.indexOf(obj);
        if (mIdx !== -1) movingObjects.splice(mIdx, 1);
        var zIdx = zombies.indexOf(obj);
        if (zIdx !== -1) zombies.splice(zIdx, 1);

        Components.spawnSparks(obj.x, obj.y, obj.color || "#ff4444", 10);
        if (this.selectedObject == obj) {
            this.selectObject(null);
        }
        rebuildAllObjects();
        if (typeof Pathfinder !== "undefined") Pathfinder.rebuildGraph(true);
        this.refreshObjectList();
    }

    static deleteSelected() {
        if (this.selectedObject) {
            this.deleteObject(this.selectedObject);
        }
    }

    static deleteById(id) {
        var all = [].concat(staticObjects, movingObjects, zombies);
        for (let i = 0; i < all.length; i++) {
            if (all[i].id === id) {
                this.deleteObject(all[i]);
                return;
            }
        }
    }

    static selectById(id) {
        var all = [].concat(staticObjects, movingObjects, zombies);
        for (let i = 0; i < all.length; i++) {
            if (all[i].id === id) {
                this.selectObject(all[i]);
                return;
            }
        }
    }

    static clearCrates() {
        movingObjects = [];
        if (this.selectedObject && this.selectedObject.movable && !(this.selectedObject instanceof Character)) {
            this.selectObject(null);
        }
        rebuildAllObjects();
        this.refreshObjectList();
    }

    static toggleWavePause() {
        this.pauseWaves = !this.pauseWaves;
        var btn = document.getElementById("sp-wave-btn");
        if (btn) {
            btn.textContent = this.pauseWaves ? "▶ Resume Waves" : "⏸ Waves";
            btn.style.background = this.pauseWaves ? "#2a9d8f" : "#264653";
        }
    }

    static refreshObjectList() {
        var listEl = document.getElementById("sp-obj-list");
        var countEl = document.getElementById("sp-obj-count");
        if (!listEl || !this.isOpen) return;

        var items = [];
        for (let i = movingObjects.length - 1; i >= 0; i--) {
            if (!movingObjects[i].dead) items.push({ obj: movingObjects[i], tag: movingObjects[i].explosive ? "TNT" : "Physics" });
        }
        for (let i = zombies.length - 1; i >= 0; i--) {
            if (!zombies[i].dead) items.push({ obj: zombies[i], tag: "Zombie" });
        }
        for (let i = staticObjects.length - 1; i >= 0; i--) {
            if (!staticObjects[i].dead) {
                var t = staticObjects[i].isRamp ? "Ramp" : (staticObjects[i].isBumper ? "Bumper" : "Static");
                items.push({ obj: staticObjects[i], tag: t });
            }
        }

        if (countEl) countEl.textContent = items.length.toString();

        var maxShow = Math.min(items.length, 60);
        var html = "";
        for (let i = 0; i < maxShow; i++) {
            var o = items[i].obj;
            var isSel = (this.selectedObject && this.selectedObject.id === o.id);
            html += `
                <div class="sp-obj-item ${isSel ? 'selected' : ''}" onclick="SummonManager.selectById(${o.id})">
                    <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        <span class="sp-swatch" style="background:${o.color};"></span>
                        <strong>${o.name}</strong>
                        <span style="color:#88a2b5;font-size:10px;">[${items[i].tag}] (${Math.round(o.x)}, ${Math.round(o.y)})</span>
                    </div>
                    <div style="flex-shrink:0;">
                        <button class="sp-small-btn del" onclick="event.stopPropagation();SummonManager.deleteById(${o.id})">✕</button>
                    </div>
                </div>
            `;
        }
        listEl.innerHTML = html;
    }

    static handleCanvasMouseDown(e) {
        if (this.toolMode == "shoot" && !this.paletteDragging) return false;

        var mPos = Components.getMouseWorldPos();
        var wx = mPos[0];
        var wy = mPos[1];

        if (e.button === 2) {
            var hitDel = this.getObjectAtWorld(wx, wy);
            if (hitDel) {
                this.deleteObject(hitDel);
            }
            return true;
        }

        // Middle-click in Edit or Place mode immediately duplicates the clicked object and lets you drag the copy!
        if (e.button === 1) {
            var hitMid = this.getObjectAtWorld(wx, wy);
            if (hitMid) {
                e.preventDefault();
                var midCopy = this.cloneObject(hitMid, 0, 0);
                this.draggingObject = midCopy;
                this.dragOffsetX = midCopy.x - wx;
                this.dragOffsetY = midCopy.y - wy;
                Components.addFloatingText("DUPLICATED! (Drag to place)", midCopy.x, midCopy.y + 45, "#00f5d4", 15);
                return true;
            }
        }

        if (e.button === 0) {
            if (this.toolMode == "place") {
                this.spawnAt(wx, wy);
                // Allow click-and-dragging in Place mode to stretch/extend the newly spawned object!
                if (this.selectedObject && !this.selectedObject.dead) {
                    this.resizingObject = this.selectedObject;
                    this.resizeHandle = "e";
                    this.resizeStartBounds = CollisionDetector.getBounds(this.selectedObject);
                }
                return true;
            } else if (this.toolMode == "select") {
                // 1. Check if clicking an Extend/Resize Handle or the on-canvas Duplicate / Flip pill!
                var handle = this.getHandleAtScreen(mouseX, mouseY);
                if (handle) {
                    this.selectObject(handle.obj);
                    if (handle.id === "copy") {
                        var copy = this.cloneObject(handle.obj, 0, 0);
                        this.draggingObject = copy;
                        this.dragOffsetX = 0;
                        this.dragOffsetY = 0;
                        Components.addFloatingText("COPYING! Drag to place", copy.x, copy.y + 45, "#00f5d4", 15);
                        return true;
                    } else if (handle.id === "flip" && handle.obj.isRamp) {
                        handle.obj.rampDir = (handle.obj.rampDir == "left") ? "right" : "left";
                        handle.obj.resize(handle.obj.w, handle.obj.h);
                        if (typeof Pathfinder !== "undefined") Pathfinder.rebuildGraph(true);
                        return true;
                    } else {
                        this.resizingObject = handle.obj;
                        this.resizeHandle = handle.id;
                        this.resizeStartBounds = CollisionDetector.getBounds(handle.obj);
                        return true;
                    }
                }

                // 2. Otherwise check if clicking an object body (Alt/Shift/Ctrl + Drag = Duplicate & Drag!)
                var hit = this.getObjectAtWorld(wx, wy);
                if (hit && (e.altKey || e.shiftKey || e.ctrlKey || e.metaKey)) {
                    var dup = this.cloneObject(hit, 0, 0);
                    this.draggingObject = dup;
                    this.dragOffsetX = dup.x - wx;
                    this.dragOffsetY = dup.y - wy;
                    Components.addFloatingText("DUPLICATED!", dup.x, dup.y + 45, "#00f5d4", 15);
                    return true;
                }

                this.selectObject(hit);
                if (hit) {
                    this.draggingObject = hit;
                    this.dragOffsetX = hit.x - wx;
                    this.dragOffsetY = hit.y - wy;
                }
                return true;
            }
        }
        return false;
    }

    static handleCanvasMouseMove(e) {
        var mPos = Components.getMouseWorldPos();
        var wx = mPos[0];
        var wy = mPos[1];

        if (this.resizingObject && !this.resizingObject.dead && this.resizeHandle && this.resizeStartBounds) {
            this.applyResizeHandleDrag(this.resizingObject, this.resizeHandle, this.resizeStartBounds, wx, wy);
            return;
        }

        if (this.draggingObject && !this.draggingObject.dead) {
            var objW = this.draggingObject.w || this.draggingObject.s1 || 80;
            var objH = this.draggingObject.h || this.draggingObject.s2 || 80;
            this.draggingObject.x = this.snapCenterForSize(wx + this.dragOffsetX, objW);
            this.draggingObject.y = this.snapCenterForSize(wy + this.dragOffsetY, objH);
            this.draggingObject.xspeed = 0;
            this.draggingObject.yspeed = 0;
            if (this.selectedObject == this.draggingObject && document.getElementById("sp-edit-x")) {
                document.getElementById("sp-edit-x").value = this.draggingObject.x;
                document.getElementById("sp-edit-y").value = this.draggingObject.y;
            }
        } else if (this.toolMode == "select") {
            this.hoveredHandle = this.getHandleAtScreen(mouseX, mouseY);
            if (this.hoveredHandle) {
                canvas.style.cursor = this.hoveredHandle.cursor || "pointer";
            } else {
                this.hoveredObject = this.getObjectAtWorld(wx, wy);
                canvas.style.cursor = this.hoveredObject ? "move" : "crosshair";
            }
        } else {
            this.hoveredHandle = null;
            canvas.style.cursor = "crosshair";
        }
    }

    static handleCanvasMouseUp(e) {
        // Drop object dragged out from the Bottom Mario-Maker Palette Dock onto the Canvas!
        if (this.paletteDragging) {
            this.paletteDragging = false;
            if (mouseY < h - 75) {
                var mPos = Components.getMouseWorldPos();
                this.spawnAt(mPos[0], mPos[1]);
            }
            return;
        }

        if (this.resizingObject) {
            this.resizingObject = null;
            this.resizeHandle = null;
            this.resizeStartBounds = null;
            rebuildAllObjects();
            if (typeof Pathfinder !== "undefined") Pathfinder.rebuildGraph(true);
            this.refreshObjectList();
        }

        if (this.draggingObject) {
            this.draggingObject = null;
            if (typeof Pathfinder !== "undefined") Pathfinder.rebuildGraph(true);
            this.refreshObjectList();
        }
    }

    static drawWorldGrid() {
        var g = this.gridSnap || 40;
        if (g < 10) return;

        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
        ctx.lineWidth = 1;

        var leftWorld = Math.floor(((0 - xc) / cameraScaleX) / g) * g;
        var rightWorld = Math.ceil(((w - xc) / cameraScaleX) / g) * g;
        var topWorld = Math.ceil(((yc - 0) / cameraScaleY) / g) * g;
        var bottomWorld = Math.floor(((yc - h) / cameraScaleY) / g) * g;

        ctx.beginPath();
        for (var gx = leftWorld; gx <= rightWorld; gx += g) {
            var sx = Math.round(gx * cameraScaleX + xc) + 0.5;
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, h);
        }
        for (var gy = bottomWorld; gy <= topWorld; gy += g) {
            var sy = Math.round(-gy * cameraScaleY + yc) + 0.5;
            ctx.moveTo(0, sy);
            ctx.lineTo(w, sy);
        }
        ctx.stroke();
        ctx.restore();
    }

    static drawOverlay() {
        var isPlacingOrDragging = (this.paletteDragging || this.toolMode == "place" || this.draggingObject || this.resizingObject || this.showGrid);
        if (isPlacingOrDragging) {
            this.drawWorldGrid();
        }

        var mPos = Components.getMouseWorldPos();

        // Live Ghost Object when dragging out from Bottom Dock OR in Place mode (when not actively stretching)
        if ((this.paletteDragging || this.toolMode == "place") && !this.resizingObject) {
            var w = Math.max(20, Number(document.getElementById("sp-w") ? document.getElementById("sp-w").value : this.spawnW) || this.spawnW);
            var h = Math.max(20, Number(document.getElementById("sp-h") ? document.getElementById("sp-h").value : this.spawnH) || this.spawnH);
            var wx = this.snapCenterForSize(mPos[0], w);
            var wy = this.snapCenterForSize(mPos[1], h);
            var col = (document.getElementById("sp-color") ? document.getElementById("sp-color").value : this.spawnColor) || this.spawnColor;
            var tex = (this.spawnTexture == "solid") ? null : this.spawnTexture;

            var poly;
            if (this.spawnType == "ramp_left") {
                poly = [[-w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]];
            } else if (this.spawnType == "ramp_right") {
                poly = [[-w / 2, -h / 2], [w / 2, h / 2], [w / 2, -h / 2]];
            } else if (this.spawnType == "powerup") {
                poly = Math.makeHitbox(40, 40);
            } else {
                poly = Math.makeHitbox(w, h);
            }

            ctx.save();
            ctx.globalAlpha = 0.72;
            Polygon.create(poly, col, { x: wx, y: wy, texture: tex, isRamp: this.spawnType.startsWith("ramp") });

            var sx = (wx - w / 2) * cameraScaleX + xc;
            var sy = (-wy - h / 2) * cameraScaleY + yc;
            ctx.strokeStyle = "#00f5d4";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([5, 4]);
            ctx.strokeRect(sx, sy, w * cameraScaleX, h * cameraScaleY);
            ctx.restore();

            ctx.fillStyle = "#ffdd44";
            ctx.font = "bold 12px monospace";
            ctx.textAlign = "center";
            var labelText = this.paletteDragging ? "Release Mouse to Drop on Grid (" + Math.round(wx) + ", " + Math.round(wy) + ")" : "Click or Drag to Place & Extend (" + Math.round(wx) + ", " + Math.round(wy) + ")";
            ctx.fillText(labelText, wx * cameraScaleX + xc, sy - 10);
        }

        var targets = [];
        if (this.hoveredObject && !this.hoveredObject.dead && this.toolMode == "select" && this.hoveredObject !== this.selectedObject) {
            targets.push({ obj: this.hoveredObject, color: "#5bc0be", label: "Drag: Move | Drag Edge: Extend | Alt/Shift+Drag: Copy" });
        }
        if (this.selectedObject && !this.selectedObject.dead) {
            var bSel = CollisionDetector.getBounds(this.selectedObject);
            var dimStr = Math.round(bSel.right - bSel.left) + "x" + Math.round(bSel.top - bSel.bottom);
            targets.push({ obj: this.selectedObject, color: "#ffdd44", label: this.selectedObject.name + " [" + dimStr + "]" });
        }

        for (let i = 0; i < targets.length; i++) {
            var t = targets[i].obj;
            var b = CollisionDetector.getBounds(t);
            var sx = b.left * cameraScaleX + xc;
            var sy = -b.top * cameraScaleY + yc;
            var sw = (b.right - b.left) * cameraScaleX;
            var sh = (b.top - b.bottom) * cameraScaleY;

            ctx.save();
            ctx.strokeStyle = targets[i].color;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(sx - 2, sy - 2, sw + 4, sh + 4);
            ctx.setLineDash([]);

            // Draw interactive Extend/Resize Handles & Duplicate Pill when in Select/Edit mode
            if (this.toolMode == "select" || this.isOpen) {
                var handles = this.getHandlesForObject(t);
                for (let hIdx = 0; hIdx < handles.length; hIdx++) {
                    var h = handles[hIdx];
                    var isHov = (this.hoveredHandle && this.hoveredHandle.obj === t && this.hoveredHandle.id === h.id);
                    if (h.isPill) {
                        ctx.fillStyle = isHov ? "#00f5d4" : "#14222e";
                        ctx.strokeStyle = isHov ? "#ffffff" : "#ffdd44";
                        ctx.lineWidth = 1.5;
                        ctx.fillRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h);
                        ctx.strokeRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h);
                        ctx.fillStyle = isHov ? "#111111" : "#ffdd44";
                        ctx.font = "bold 11px monospace";
                        ctx.textAlign = "center";
                        ctx.fillText(h.text, h.x, h.y + 4);
                    } else {
                        var rad = isHov ? 7 : 5;
                        ctx.fillStyle = isHov ? "#00f5d4" : "#ffdd44";
                        ctx.strokeStyle = "#0b131b";
                        ctx.lineWidth = 1.5;
                        ctx.fillRect(h.x - rad, h.y - rad, rad * 2, rad * 2);
                        ctx.strokeRect(h.x - rad, h.y - rad, rad * 2, rad * 2);
                    }
                }
            }

            ctx.fillStyle = targets[i].color;
            ctx.font = "bold 12px monospace";
            ctx.textAlign = "center";
            ctx.fillText(targets[i].label, sx + sw / 2, sy - 34);
            ctx.restore();
        }
    }
}
