// ============================================================================
// SANDBOX UI - Enhanced UIs for Blank Sandbox & Creative Mode:
//   - Universal Object Spawner: Spotlight (default) + Tabbed Dock + Radial Wheel + Dual-Pane Browser
//   - Entity Takeover: L2 Live Entity Roster Drawer + L3 Tactical Pie Ring
//   - Editor: L1 Pro Studio Dock (Left Tool Rail + Right Inspector + Right-Click Context Menu)
//   - Pause & Cheats: L1 Glassmorphic Split Card
// ============================================================================
var SandboxUI = {
    spawnerOpen: false,
    spawnerMode: "spotlight", // spotlight | dock | radial | browser
    spawnerCat: "All",
    spawnerSearch: "",
    selectedCatalogId: null,

    rosterOpen: false,
    pauseOpen: false,
    pauseTab: "creative",

    tool: "select", // select | drawFloor | drawPlat | drawWall | spawn | possess | grapple | delete
    selectedObj: null,
    selectedEnt: null,
    piePos: null,
    ctxMenu: null,
    dragDraw: null, // { x1, y1, x2, y2, wx1, wy1 }
    dragMove: null, // { obj, ox, oy }
    _root: null,
    _lastMode: null,

    isSandbox: function() {
        return typeof GameModes !== "undefined" && GameModes.current && GameModes.current.id === "sandbox" && (typeof Hub === "undefined" || !Hub.isOpen);
    },

    init: function() {
        if (this._root) return;
        var style = document.createElement("style");
        style.textContent = `
          #sb-ui-root { position: fixed; inset: 0; pointer-events: none; z-index: 900; font-family: system-ui, -apple-system, sans-serif; color: #e2e8f0; font-size: 13px; }
          #sb-ui-root * { box-sizing: border-box; }
          .sb-pe { pointer-events: auto; }
          .sb-glass { background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(10px); border: 1px solid rgba(148, 163, 184, 0.25); box-shadow: 0 16px 40px rgba(0,0,0,0.5); }
          .sb-btn { background: rgba(30, 41, 59, 0.9); color: #e2e8f0; border: 1px solid rgba(148,163,184,0.25); border-radius: 8px; padding: 6px 10px; cursor: pointer; font-weight: 600; font-size: 12px; transition: 0.12s; }
          .sb-btn:hover { border-color: #38bdf8; color: #fff; }
          .sb-btn.active { background: #38bdf8; color: #0f172a; border-color: #38bdf8; font-weight: 800; }
          .sb-input { background: rgba(15, 23, 42, 0.95); color: #f8fafc; border: 1px solid rgba(148,163,184,0.3); border-radius: 8px; padding: 7px 10px; outline: none; font-size: 12px; width: 100%; }
          .sb-input:focus { border-color: #38bdf8; }
          .sb-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
          .sb-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.35); border-radius: 999px; }
        `;
        document.head.appendChild(style);

        var root = document.createElement("div");
        root.id = "sb-ui-root";
        document.body.appendChild(root);
        this._root = root;

        this.bindEvents();
        this.render();
    },

    bindEvents: function() {
        var self = this;
        var cv = document.getElementById("screen");

        window.addEventListener("keydown", function(e) {
            if (!self.isSandbox()) return;
            if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) {
                if (e.code === "Escape") { self.spawnerOpen = false; self.render(); e.target.blur(); }
                return;
            }
            if (e.code === "KeyB" || e.code === "Slash" || ((e.ctrlKey || e.metaKey) && e.code === "KeyK")) {
                e.preventDefault();
                e.stopImmediatePropagation();
                self.spawnerOpen = !self.spawnerOpen;
                self.ctxMenu = null;
                self.render();
            } else if (e.code === "Escape" && self.spawnerOpen) {
                e.preventDefault();
                e.stopImmediatePropagation();
                self.spawnerOpen = false;
                self.render();
            } else if (e.code === "Tab") {
                e.preventDefault();
                e.stopImmediatePropagation();
                self.rosterOpen = !self.rosterOpen;
                self.render();
            }
        }, true);

        if (cv) {
            cv.addEventListener("mousedown", function(e) {
                if (!self.isSandbox()) return;
                self.ctxMenu = null;
                if (self.spawnerOpen) { self.spawnerOpen = false; self.render(); }
                if (e.button === 2) return; // handled in contextmenu

                var rect = cv.getBoundingClientRect();
                var sx = e.clientX - rect.left, sy = e.clientY - rect.top;
                var wpos = typeof sbScreenToWorld === "function" ? sbScreenToWorld(sx, sy) : { x: 0, y: 0 };

                if (self.tool === "drawFloor" || self.tool === "drawPlat" || self.tool === "drawWall") {
                    self.dragDraw = { x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY, wx1: wpos.x, wy1: wpos.y };
                    self.render();
                    return;
                }
                if (self.tool === "grapple") {
                    GrappleHook.fire(GrappleHook.activeTarget(), wpos.x, wpos.y);
                    return;
                }
                if (self.tool === "spawn" && self.selectedCatalogId) {
                    UniversalSpawner.spawnById(self.selectedCatalogId, wpos.x, wpos.y);
                    self.render();
                    return;
                }

                // Check entity hit for L3 Tactical Pie Ring or Possess tool
                var hitEnt = typeof EntityTakeover !== "undefined" ? EntityTakeover.findAt(wpos.x, wpos.y) : null;
                if (hitEnt) {
                    if (self.tool === "possess") {
                        EntityTakeover.possess(hitEnt.ent);
                        self.selectedEnt = hitEnt;
                        self.piePos = null;
                        self.render();
                        return;
                    }
                    if (self.tool === "delete") {
                        if (hitEnt.ent !== redGuy) hitEnt.ent.dead = true;
                        self.selectedEnt = null;
                        self.piePos = null;
                        self.render();
                        return;
                    }
                    self.selectedEnt = hitEnt;
                    self.selectedObj = null;
                    self.piePos = { x: e.clientX, y: e.clientY };
                    self.render();
                    return;
                }

                // Check static/moving object hit for Pro Studio Inspector, Drag-Move, or Delete
                var allObjs = [].concat(staticObjects || [], movingObjects || []);
                var hitObj = null;
                for (var i = allObjs.length - 1; i >= 0; i--) {
                    var o = allObjs[i];
                    if (o.dead) continue;
                    var hw = (o.w || o.s1 || 40) / 2 + 8, hh = (o.h || o.s2 || 40) / 2 + 8;
                    if (Math.abs(o.x - wpos.x) <= hw && Math.abs(o.y - wpos.y) <= hh) { hitObj = o; break; }
                }
                if (hitObj) {
                    if (self.tool === "delete") {
                        hitObj.dead = true;
                        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                        self.selectedObj = null;
                    } else {
                        self.selectedObj = hitObj;
                        self.selectedEnt = null;
                        self.piePos = null;
                        self.dragMove = { obj: hitObj, ox: hitObj.x - wpos.x, oy: hitObj.y - wpos.y };
                    }
                    self.render();
                    return;
                }

                self.piePos = null;
                self.render();
            });

            window.addEventListener("mousemove", function(e) {
                if (!self.isSandbox()) return;
                if (self.dragDraw) {
                    self.dragDraw.x2 = e.clientX;
                    self.dragDraw.y2 = e.clientY;
                    var box = document.getElementById("sb-drag-preview");
                    if (box) {
                        var l = Math.min(self.dragDraw.x1, self.dragDraw.x2), t = Math.min(self.dragDraw.y1, self.dragDraw.y2);
                        var w = Math.max(8, Math.abs(self.dragDraw.x2 - self.dragDraw.x1));
                        var h = Math.max(8, Math.abs(self.dragDraw.y2 - self.dragDraw.y1));
                        box.style.left = l + "px"; box.style.top = t + "px"; box.style.width = w + "px"; box.style.height = h + "px";
                    }
                } else if (self.dragMove && self.dragMove.obj) {
                    var rect = cv.getBoundingClientRect();
                    var wpos = typeof sbScreenToWorld === "function" ? sbScreenToWorld(e.clientX - rect.left, e.clientY - rect.top) : { x: 0, y: 0 };
                    self.dragMove.obj.x = Math.round((wpos.x + self.dragMove.ox) / 20) * 20;
                    self.dragMove.obj.y = Math.round((wpos.y + self.dragMove.oy) / 20) * 20;
                    if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                }
            });

            window.addEventListener("mouseup", function(e) {
                if (!self.isSandbox()) return;
                if (self.dragDraw) {
                    var rect = cv.getBoundingClientRect();
                    var wpos2 = typeof sbScreenToWorld === "function" ? sbScreenToWorld(e.clientX - rect.left, e.clientY - rect.top) : { x: 0, y: 0 };
                    var cx = (self.dragDraw.wx1 + wpos2.x) / 2, cy = (self.dragDraw.wy1 + wpos2.y) / 2;
                    var bw = Math.max(80, Math.round(Math.abs(wpos2.x - self.dragDraw.wx1) / 20) * 20);
                    var bh = Math.max(self.tool === "drawPlat" ? 36 : 60, Math.round(Math.abs(wpos2.y - self.dragDraw.wy1) / 20) * 20);
                    if (Math.abs(wpos2.x - self.dragDraw.wx1) < 20 && Math.abs(wpos2.y - self.dragDraw.wy1) < 20) {
                        // Quick single click defaults to a nice wide floor / platform / tall wall
                        if (self.tool === "drawFloor") { bw = 480; bh = 80; }
                        else if (self.tool === "drawPlat") { bw = 360; bh = 36; }
                        else { bw = 80; bh = 360; }
                    }
                    var opts = self.tool === "drawPlat"
                        ? { name: "Platform", texture: "dojo_wood", kind: "platform" }
                        : (self.tool === "drawWall"
                            ? { name: "Wall", texture: "castle_stone", kind: "wall" }
                            : { name: "Floor", texture: "grass_dirt", kind: "block" });
                    var col = self.tool === "drawPlat" ? "#8b6b4a" : (self.tool === "drawWall" ? "#475569" : "#4d7c36");
                    self.selectedObj = GameObject.addBox(cx, cy, bw, bh, col, opts);
                    if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                    self.dragDraw = null;
                    self.render();
                }
                if (self.dragMove) { self.dragMove = null; self.render(); }
            });

            cv.addEventListener("contextmenu", function(e) {
                if (!self.isSandbox()) return;
                e.preventDefault();
                var rect = cv.getBoundingClientRect();
                var wpos = typeof sbScreenToWorld === "function" ? sbScreenToWorld(e.clientX - rect.left, e.clientY - rect.top) : { x: 0, y: 0 };
                var mx = Math.min(window.innerWidth - 205, Math.max(8, e.clientX));
                var my = Math.min(window.innerHeight - 210, Math.max(8, e.clientY));
                self.ctxMenu = { sx: mx, sy: my, wx: wpos.x, wy: wpos.y };
                self.render();
            });
        }

        // Poll mode transitions so UI auto-appears in sandbox and hides in other games
        setInterval(function() {
            var active = self.isSandbox();
            if (active !== self._lastMode) {
                self._lastMode = active;
                if (!active) { self.spawnerOpen = false; self.rosterOpen = false; self.pauseOpen = false; self.ctxMenu = null; self.piePos = null; }
                self.render();
            } else if (active && self.rosterOpen) {
                self.renderRosterOnly();
            }
        }, 250);
    },

    openPause: function() { this.pauseOpen = true; this.spawnerOpen = false; this.ctxMenu = null; this.render(); },
    closePause: function() { this.pauseOpen = false; this.render(); },

    renderRosterOnly: function() {
        var el = document.getElementById("sb-roster-list");
        if (!el || typeof EntityTakeover === "undefined") return;
        var list = EntityTakeover.listAll();
        el.innerHTML = list.map(function(item, idx) {
            var isPos = EntityTakeover.target === item.ent;
            return '<div style="padding:8px;border-radius:8px;border:1px solid ' + (isPos ? '#38bdf8' : 'rgba(148,163,184,0.2)') + ';background:rgba(15,23,42,0.75);margin-bottom:6px">' +
                '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:12px"><span>' + item.icon + ' ' + item.label + '</span><span style="color:#94a3b8">' + item.hp + ' HP</span></div>' +
                '<div style="display:flex;gap:4px;margin-top:6px">' +
                '<button class="sb-btn ' + (isPos ? 'active' : '') + '" style="flex:1;padding:4px 6px" data-rpos="' + idx + '">' + (isPos ? 'Controlling' : 'Take Over') + '</button>' +
                '<button class="sb-btn" style="padding:4px 6px" data-rfling="' + idx + '">⬆</button>' +
                '<button class="sb-btn" style="padding:4px 6px" data-rdel="' + idx + '">🗑</button>' +
                '</div></div>';
        }).join("");

        el.querySelectorAll("[data-rpos]").forEach(function(b) {
            b.onclick = function() {
                var item = list[Number(b.dataset.rpos)];
                if (!item) return;
                if (EntityTakeover.target === item.ent) EntityTakeover.release(false);
                else EntityTakeover.possess(item.ent);
                SandboxUI.render();
            };
        });
        el.querySelectorAll("[data-rfling]").forEach(function(b) {
            b.onclick = function() {
                var item = list[Number(b.dataset.rfling)];
                if (item && item.ent) item.ent.yspeed = 26;
            };
        });
        el.querySelectorAll("[data-rdel]").forEach(function(b) {
            b.onclick = function() {
                var item = list[Number(b.dataset.rdel)];
                if (item && item.ent && item.ent !== redGuy) { item.ent.dead = true; SandboxUI.render(); }
            };
        });
    },

    render: function() {
        if (!this._root) return;
        if (!this.isSandbox()) { this._root.innerHTML = ""; return; }

        var html = "";

        // 1. Top-Left Compact Action Bar (never overlaps #top-right-bar)
        var posTarget = typeof EntityTakeover !== "undefined" ? EntityTakeover.target : null;
        html += '<div class="sb-pe sb-glass" style="position:fixed;top:10px;left:12px;border-radius:12px;padding:5px 10px;display:flex;align-items:center;gap:6px">' +
            '<span style="font-weight:900;color:#38bdf8;padding:0 4px">✨ BLANK SANDBOX</span>' +
            '<button class="sb-btn ' + (this.spawnerOpen ? 'active' : '') + '" id="sb-top-spawn">🔍 Spawner [B]</button>' +
            '<button class="sb-btn ' + (this.rosterOpen ? 'active' : '') + '" id="sb-top-roster">👥 Entities [Tab]</button>' +
            '<button class="sb-btn ' + (sandboxCfg.showFloor ? 'active' : '') + '" id="sb-top-floor">▦ Floor</button>' +
            (posTarget ? '<button class="sb-btn active" id="sb-top-eject">↩ Eject [F]</button>' : '') +
            '<button class="sb-btn" id="sb-top-pause">⚙ Menu [Esc]</button>' +
            '</div>';

        // 2. Pro Studio Dock (L1): Left Tool Rail
        var tools = [
            ["select", "✋ Select / Move"],
            ["drawFloor", "🧱 Draw Floor"],
            ["drawPlat", "➖ Draw Platform"],
            ["drawWall", "🏰 Draw Wall"],
            ["spawn", "➕ Spawn"],
            ["possess", "⚡ Possess"],
            ["grapple", "🪝 Grapple"],
            ["delete", "🗑 Delete"]
        ];
        html += '<div class="sb-pe sb-glass" style="position:fixed;top:68px;left:12px;border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:4px">' +
            tools.map(function(t) {
                return '<button class="sb-btn ' + (SandboxUI.tool === t[0] ? 'active' : '') + '" style="text-align:left" data-sbtool="' + t[0] + '">' + t[1] + '</button>';
            }).join("") +
            '</div>';

        if (this.dragDraw) {
            var dl = Math.min(this.dragDraw.x1, this.dragDraw.x2), dt = Math.min(this.dragDraw.y1, this.dragDraw.y2);
            var dw = Math.max(8, Math.abs(this.dragDraw.x2 - this.dragDraw.x1)), dh = Math.max(8, Math.abs(this.dragDraw.y2 - this.dragDraw.y1));
            html += '<div id="sb-drag-preview" style="position:fixed;left:' + dl + 'px;top:' + dt + 'px;width:' + dw + 'px;height:' + dh + 'px;border:2px dashed #38bdf8;background:rgba(56,189,248,0.2);border-radius:4px"></div>';
        }

        // 3. Pro Studio Dock (L1): Right Property Inspector (when object selected & roster closed)
        if (this.selectedObj && !this.selectedObj.dead && !this.rosterOpen) {
            var o = this.selectedObj;
            html += '<div class="sb-pe sb-glass" style="position:fixed;top:88px;right:12px;width:230px;border-radius:12px;padding:12px">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                '<strong style="color:#38bdf8">INSPECTOR</strong>' +
                '<button class="sb-btn" style="padding:2px 6px" id="sb-insp-close">✕</button></div>' +
                '<div style="font-weight:700;margin-bottom:8px">' + (o.name || "Object") + '</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">' +
                '<label style="font-size:11px;color:#94a3b8">X<input class="sb-input" type="number" id="sb-ix" value="' + Math.round(o.x) + '"></label>' +
                '<label style="font-size:11px;color:#94a3b8">Y<input class="sb-input" type="number" id="sb-iy" value="' + Math.round(o.y) + '"></label>' +
                '<label style="font-size:11px;color:#94a3b8">W<input class="sb-input" type="number" id="sb-iw" value="' + Math.round(o.w || o.s1 || 60) + '"></label>' +
                '<label style="font-size:11px;color:#94a3b8">H<input class="sb-input" type="number" id="sb-ih" value="' + Math.round(o.h || o.s2 || 60) + '"></label>' +
                '</div>' +
                '<div style="display:flex;gap:6px">' +
                '<button class="sb-btn" style="flex:1" id="sb-insp-dup">Duplicate</button>' +
                '<button class="sb-btn" style="color:#f87171" id="sb-insp-del">Delete</button>' +
                '</div></div>';
        }

        // 4. L2 Live Entity Roster Drawer (Right Side)
        if (this.rosterOpen) {
            html += '<div class="sb-pe sb-glass" style="position:fixed;top:88px;right:12px;bottom:40px;width:260px;border-radius:12px;padding:12px;display:flex;flex-direction:column">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                '<strong style="color:#38bdf8">ENTITY ROSTER</strong>' +
                '<button class="sb-btn active" style="padding:3px 8px" id="sb-roster-add">+ Enemy</button></div>' +
                '<div id="sb-roster-list" class="sb-scroll" style="flex:1;overflow-y:auto"></div></div>';
        }

        // 5. L3 Tactical Pie Ring around clicked entity
        if (this.piePos && this.selectedEnt && this.selectedEnt.ent && !this.selectedEnt.ent.dead) {
            html += '<div class="sb-pe" style="position:fixed;left:' + this.piePos.x + 'px;top:' + this.piePos.y + 'px;transform:translate(-50%,-50%);width:150px;height:150px;border-radius:999px;border:2px dashed #38bdf8;background:rgba(15,23,42,0.45)">' +
                '<button class="sb-btn active" id="sb-pie-pos" style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);white-space:nowrap">⚡ Take Over</button>' +
                '<button class="sb-btn" id="sb-pie-fling" style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%)">⬆ Fling</button>' +
                '<button class="sb-btn" id="sb-pie-clone" style="position:absolute;right:-26px;top:50%;transform:translateY(-50%)">Clone</button>' +
                '<button class="sb-btn" id="sb-pie-del" style="position:absolute;left:-20px;top:50%;transform:translateY(-50%);color:#f87171">🗑</button>' +
                '</div>';
        }

        // 6. Universal Object Spawner (Spotlight Default + All 4 Layouts Switchable)
        if (this.spawnerOpen) {
            html += this.renderSpawnerHTML();
        }

        // 7. Right-Click Context Menu
        if (this.ctxMenu) {
            html += '<div class="sb-pe sb-glass" style="position:fixed;left:' + this.ctxMenu.sx + 'px;top:' + this.ctxMenu.sy + 'px;width:190px;border-radius:10px;padding:4px;display:flex;flex-direction:column;gap:2px">' +
                '<button class="sb-btn" style="text-align:left;border:none" id="sb-ctx-pos">⚡ Take Over Nearest</button>' +
                '<button class="sb-btn" style="text-align:left;border:none" id="sb-ctx-spawn">➕ Spawn Selected Here</button>' +
                '<button class="sb-btn" style="text-align:left;border:none" id="sb-ctx-grapple">🪝 Grapple Here</button>' +
                '<button class="sb-btn" style="text-align:left;border:none" id="sb-ctx-floor">▦ Toggle Floor Grid</button>' +
                '<button class="sb-btn" style="text-align:left;border:none;color:#f87171" id="sb-ctx-clear">🧹 Clear World</button>' +
                '</div>';
        }

        // 8. L1 Glassmorphic Split Card Pause & Cheats Menu
        if (this.pauseOpen) {
            html += this.renderPauseHTML();
        }

        this._root.innerHTML = html;
        this.bindDynamicEvents();
        if (this.rosterOpen) this.renderRosterOnly();
    },

    renderSpawnerHTML: function() {
        var catalog = typeof UniversalSpawner !== "undefined" ? UniversalSpawner.getCatalog() : [];
        var cats = ["All"];
        for (var i = 0; i < catalog.length; i++) {
            if (cats.indexOf(catalog[i].game) === -1) cats.push(catalog[i].game);
        }
        var q = this.spawnerSearch.toLowerCase();
        var self = this;
        var filtered = catalog.filter(function(item) {
            return (self.spawnerCat === "All" || item.game === self.spawnerCat) &&
                (!q || item.name.toLowerCase().indexOf(q) !== -1 || item.game.toLowerCase().indexOf(q) !== -1);
        });

        var modeSwitcher = '<div style="display:flex;gap:4px;align-items:center;margin-bottom:8px">' +
            '<span style="font-size:11px;color:#94a3b8;margin-right:auto">SPAWNER VIEW:</span>' +
            [["spotlight", "Spotlight"], ["dock", "Tabbed Dock"], ["radial", "Radial"], ["browser", "Browser"]].map(function(m) {
                return '<button class="sb-btn ' + (self.spawnerMode === m[0] ? 'active' : '') + '" style="padding:3px 8px;font-size:11px" data-spmode="' + m[0] + '">' + m[1] + '</button>';
            }).join("") +
            '<button class="sb-btn" style="padding:3px 8px" id="sb-sp-close">✕</button></div>';

        if (this.spawnerMode === "spotlight") {
            return '<div class="sb-pe sb-glass" style="position:fixed;top:64px;left:50%;transform:translateX(-50%);width:540px;max-width:92vw;border-radius:14px;padding:12px">' +
                modeSwitcher +
                '<input class="sb-input" id="sb-sp-search" placeholder="Search EVERY object from all 23 games (bed, tnt, portal, grapple, boss, tank...)" value="' + this.spawnerSearch + '" />' +
                '<div class="sb-scroll" style="max-height:290px;overflow-y:auto;margin-top:8px;display:flex;flex-direction:column;gap:4px">' +
                filtered.slice(0, 60).map(function(it) {
                    var sel = self.selectedCatalogId === it.id;
                    return '<button class="sb-btn ' + (sel ? 'active' : '') + '" data-spitem="' + it.id + '" style="display:flex;justify-content:space-between;align-items:center;text-align:left">' +
                        '<span>' + it.icon + ' <strong>' + it.name + '</strong></span>' +
                        '<span style="opacity:0.7;font-size:11px">' + it.game + '</span></button>';
                }).join("") +
                '</div></div>';
        }

        if (this.spawnerMode === "dock") {
            return '<div class="sb-pe sb-glass" style="position:fixed;bottom:28px;left:16px;right:16px;border-radius:14px;padding:10px">' +
                modeSwitcher +
                '<div class="sb-scroll" style="display:flex;gap:4px;overflow-x:auto;padding-bottom:6px">' +
                cats.map(function(c) {
                    return '<button class="sb-btn ' + (self.spawnerCat === c ? 'active' : '') + '" style="white-space:nowrap;padding:4px 8px" data-spcat="' + c + '">' + c + '</button>';
                }).join("") + '</div>' +
                '<div class="sb-scroll" style="display:flex;gap:6px;overflow-x:auto;padding-top:4px">' +
                filtered.slice(0, 50).map(function(it) {
                    return '<button class="sb-btn ' + (self.selectedCatalogId === it.id ? 'active' : '') + '" data-spitem="' + it.id + '" style="white-space:nowrap">' + it.icon + ' ' + it.name + '</button>';
                }).join("") + '</div></div>';
        }

        if (this.spawnerMode === "radial") {
            var ring = filtered.slice(0, 10);
            return '<div class="sb-pe sb-glass" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:300px;height:300px;border-radius:999px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px">' +
                '<div style="font-weight:800;color:#38bdf8;font-size:12px;margin-bottom:4px">RADIAL SPAWNER</div>' +
                '<div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center">' +
                [["spotlight", "Spot"], ["dock", "Dock"], ["radial", "Pie"], ["browser", "Tree"]].map(function(m) {
                    return '<button class="sb-btn ' + (self.spawnerMode === m[0] ? 'active' : '') + '" style="padding:2px 6px;font-size:10px" data-spmode="' + m[0] + '">' + m[1] + '</button>';
                }).join("") + '</div>' +
                ring.map(function(it, idx) {
                    var ang = (idx / Math.max(1, ring.length)) * Math.PI * 2 - Math.PI / 2;
                    var rx = Math.round(115 * Math.cos(ang)), ry = Math.round(115 * Math.sin(ang));
                    return '<button class="sb-btn ' + (self.selectedCatalogId === it.id ? 'active' : '') + '" data-spitem="' + it.id + '" title="' + it.name + '" style="position:absolute;transform:translate(' + rx + 'px,' + ry + 'px);width:42px;height:42px;border-radius:999px;padding:0;font-size:16px">' + it.icon + '</button>';
                }).join("") +
                '</div>';
        }

        // browser (Dual-Pane)
        return '<div class="sb-pe sb-glass" style="position:fixed;top:68px;left:130px;width:480px;max-width:90vw;height:360px;border-radius:14px;padding:10px;display:flex;flex-direction:column">' +
            modeSwitcher +
            '<div style="flex:1;display:flex;gap:8px;min-height:0">' +
            '<div class="sb-scroll" style="width:130px;overflow-y:auto;display:flex;flex-direction:column;gap:3px">' +
            cats.map(function(c) {
                return '<button class="sb-btn ' + (self.spawnerCat === c ? 'active' : '') + '" style="text-align:left;padding:4px 8px" data-spcat="' + c + '">' + c + '</button>';
            }).join("") + '</div>' +
            '<div class="sb-scroll" style="flex:1;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:6px;align-content:start">' +
            filtered.slice(0, 60).map(function(it) {
                return '<button class="sb-btn ' + (self.selectedCatalogId === it.id ? 'active' : '') + '" data-spitem="' + it.id + '" style="text-align:left">' + it.icon + ' ' + it.name + '</button>';
            }).join("") + '</div></div></div>';
    },

    renderPauseHTML: function() {
        var self = this;
        var tabs = [["creative", "Creative Rules"], ["cheats", "Cheats & Physics"], ["entities", "Entity Controls"], ["arcade", "Switch Game"]];
        var body = "";
        if (this.pauseTab === "creative") {
            body = '<label style="display:flex;justify-content:space-between;padding:8px;background:rgba(15,23,42,0.6);border-radius:8px;margin-bottom:6px"><span>Floor Grid</span><input type="checkbox" id="sb-p-floor" ' + (sandboxCfg.showFloor ? "checked" : "") + '></label>' +
                '<label style="display:flex;justify-content:space-between;padding:8px;background:rgba(15,23,42,0.6);border-radius:8px;margin-bottom:6px"><span>Noclip Flight</span><input type="checkbox" id="sb-p-noclip" ' + (sandboxCfg.noclip ? "checked" : "") + '></label>' +
                '<label style="display:flex;justify-content:space-between;padding:8px;background:rgba(15,23,42,0.6);border-radius:8px;margin-bottom:6px"><span>Invincible (God Mode)</span><input type="checkbox" id="sb-p-inv" ' + (sandboxCfg.invincible ? "checked" : "") + '></label>';
        } else if (this.pauseTab === "cheats") {
            body = '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px"><span>Gravity</span><span>' + (devOpts.gravityMult || 1).toFixed(1) + 'x</span></div>' +
                '<input type="range" id="sb-p-grav" min="0" max="2.5" step="0.1" value="' + (devOpts.gravityMult || 1) + '" style="width:100%"></div>' +
                '<button class="sb-btn" style="width:100%;margin-bottom:6px" id="sb-p-clear">🧹 Clear All Objects &amp; Enemies</button>' +
                '<button class="sb-btn" style="width:100%" id="sb-p-horde">🧟 Summon Test Horde</button>';
        } else if (this.pauseTab === "entities") {
            body = '<button class="sb-btn" style="width:100%;margin-bottom:6px" id="sb-p-eject">↩ Eject to Hero</button>' +
                '<button class="sb-btn" style="width:100%" id="sb-p-roster">👥 Open Entity Roster</button>';
        } else {
            body = '<button class="sb-btn active" style="width:100%;margin-bottom:8px" id="sb-p-hub">🕹 Open Arcade Hub</button>' +
                '<button class="sb-btn" style="width:100%" id="sb-p-reset">✨ Reset Blank World</button>';
        }

        return '<div class="sb-pe" style="position:fixed;inset:0;background:rgba(2,6,23,0.65);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center">' +
            '<div class="sb-glass" style="width:520px;max-width:94vw;min-height:300px;border-radius:16px;display:grid;grid-template-columns:160px 1fr;overflow:hidden">' +
            '<div style="background:rgba(15,23,42,0.9);padding:12px;border-right:1px solid rgba(148,163,184,0.2);display:flex;flex-direction:column;gap:4px">' +
            '<div style="font-weight:900;color:#38bdf8;margin-bottom:6px">PAUSED</div>' +
            tabs.map(function(t) {
                return '<button class="sb-btn ' + (self.pauseTab === t[0] ? 'active' : '') + '" style="text-align:left" data-ptab="' + t[0] + '">' + t[1] + '</button>';
            }).join("") +
            '<button class="sb-btn" style="margin-top:auto" id="sb-p-resume">▶ Resume</button>' +
            '</div>' +
            '<div style="padding:16px">' + body + '</div>' +
            '</div></div>';
    },

    bindDynamicEvents: function() {
        var self = this;
        var el = function(id) { return document.getElementById(id); };

        if (el("sb-top-spawn")) el("sb-top-spawn").onclick = function() { self.spawnerOpen = !self.spawnerOpen; self.render(); };
        if (el("sb-top-roster")) el("sb-top-roster").onclick = function() { self.rosterOpen = !self.rosterOpen; self.render(); };
        if (el("sb-top-floor")) el("sb-top-floor").onclick = function() {
            sandboxCfg.showFloor = !sandboxCfg.showFloor; saveSandboxCfg();
            if (typeof SandboxFloor !== "undefined") SandboxFloor.sync();
            self.render();
        };
        if (el("sb-top-eject")) el("sb-top-eject").onclick = function() { EntityTakeover.release(false); self.render(); };
        if (el("sb-top-pause")) el("sb-top-pause").onclick = function() { togglePause(); };

        this._root.querySelectorAll("[data-sbtool]").forEach(function(b) {
            b.onclick = function() { self.tool = b.dataset.sbtool; self.render(); };
        });

        // Inspector
        if (el("sb-insp-close")) el("sb-insp-close").onclick = function() { self.selectedObj = null; self.render(); };
        if (el("sb-insp-del") && self.selectedObj) el("sb-insp-del").onclick = function() {
            self.selectedObj.dead = true; self.selectedObj = null;
            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            self.render();
        };
        if (el("sb-insp-dup") && self.selectedObj) el("sb-insp-dup").onclick = function() {
            var o = self.selectedObj;
            GameObject.addBox(o.x + 50, o.y + 30, o.w || o.s1 || 80, o.h || o.s2 || 80, o.color || "#64748b", { name: o.name, texture: o.texture, kind: o.kind });
            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            self.render();
        };
        ["ix", "iy", "iw", "ih"].forEach(function(k) {
            var inp = el("sb-i" + k.slice(1));
            if (inp && self.selectedObj) inp.onchange = function() {
                var val = Number(inp.value);
                if (!isNaN(val)) {
                    if (k === "ix") self.selectedObj.x = val;
                    if (k === "iy") self.selectedObj.y = val;
                    if (k === "iw") self.selectedObj.w = Math.max(10, val);
                    if (k === "ih") self.selectedObj.h = Math.max(10, val);
                    if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                }
            };
        });

        // Roster
        if (el("sb-roster-add")) el("sb-roster-add").onclick = function() {
            var types = ["NORMAL", "LEAPER", "TANK", "KNIGHT", "MAGE", "BOSS_KING"];
            var pick = types[Math.floor(Math.random() * types.length)];
            var ref = redGuy || { x: 0, y: 120 };
            if (typeof spawnZombie === "function") spawnZombie(pick, ref.x + (Math.random() - 0.5) * 300, ref.y + 120);
            self.render();
        };

        // Pie Ring
        if (el("sb-pie-pos")) el("sb-pie-pos").onclick = function() { EntityTakeover.possess(self.selectedEnt.ent); self.piePos = null; self.render(); };
        if (el("sb-pie-fling")) el("sb-pie-fling").onclick = function() { self.selectedEnt.ent.yspeed = 26; self.piePos = null; self.render(); };
        if (el("sb-pie-clone")) el("sb-pie-clone").onclick = function() {
            var e = self.selectedEnt.ent;
            if (typeof spawnZombie === "function") spawnZombie(e.power || "NORMAL", e.x + 60, e.y + 30);
            self.piePos = null; self.render();
        };
        if (el("sb-pie-del")) el("sb-pie-del").onclick = function() {
            if (self.selectedEnt.ent !== redGuy) self.selectedEnt.ent.dead = true;
            self.piePos = null; self.selectedEnt = null; self.render();
        };

        // Spawner
        if (el("sb-sp-close")) el("sb-sp-close").onclick = function() { self.spawnerOpen = false; self.render(); };
        if (el("sb-sp-search")) {
            var si = el("sb-sp-search");
            si.oninput = function() { self.spawnerSearch = si.value; self.render(); };
            si.focus();
            si.setSelectionRange(si.value.length, si.value.length);
        }
        this._root.querySelectorAll("[data-spmode]").forEach(function(b) {
            b.onclick = function() { self.spawnerMode = b.dataset.spmode; self.render(); };
        });
        this._root.querySelectorAll("[data-spcat]").forEach(function(b) {
            b.onclick = function() { self.spawnerCat = b.dataset.spcat; self.render(); };
        });
        this._root.querySelectorAll("[data-spitem]").forEach(function(b) {
            b.onclick = function() {
                self.selectedCatalogId = b.dataset.spitem;
                self.tool = "spawn";
                var ref = GrappleHook.activeTarget() || { x: 0, y: 120 };
                UniversalSpawner.spawnById(self.selectedCatalogId, ref.x + 120, ref.y + 40);
                self.spawnerOpen = false;
                self.render();
            };
        });

        // Context Menu
        if (el("sb-ctx-pos")) el("sb-ctx-pos").onclick = function() {
            var all = EntityTakeover.listAll();
            var best = null, bd = Infinity;
            for (var i = 0; i < all.length; i++) {
                if (all[i].ent === redGuy) continue;
                var d = Math.hypot(all[i].ent.x - self.ctxMenu.wx, all[i].ent.y - self.ctxMenu.wy);
                if (d < bd) { bd = d; best = all[i].ent; }
            }
            if (best) EntityTakeover.possess(best);
            self.ctxMenu = null; self.render();
        };
        if (el("sb-ctx-spawn")) el("sb-ctx-spawn").onclick = function() {
            var id = self.selectedCatalogId || (UniversalSpawner.getCatalog()[0] && UniversalSpawner.getCatalog()[0].id);
            if (id) UniversalSpawner.spawnById(id, self.ctxMenu.wx, self.ctxMenu.wy);
            self.ctxMenu = null; self.render();
        };
        if (el("sb-ctx-grapple")) el("sb-ctx-grapple").onclick = function() {
            GrappleHook.fire(GrappleHook.activeTarget(), self.ctxMenu.wx, self.ctxMenu.wy);
            self.ctxMenu = null; self.render();
        };
        if (el("sb-ctx-floor")) el("sb-ctx-floor").onclick = function() {
            sandboxCfg.showFloor = !sandboxCfg.showFloor; saveSandboxCfg();
            if (typeof SandboxFloor !== "undefined") SandboxFloor.sync();
            self.ctxMenu = null; self.render();
        };
        if (el("sb-ctx-clear")) el("sb-ctx-clear").onclick = function() {
            for (var i = 0; i < staticObjects.length; i++) staticObjects[i].dead = true;
            for (var j = 0; j < movingObjects.length; j++) movingObjects[j].dead = true;
            for (var z = 0; z < zombies.length; z++) zombies[z].dead = true;
            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            self.ctxMenu = null; self.render();
        };

        // Pause menu
        this._root.querySelectorAll("[data-ptab]").forEach(function(b) {
            b.onclick = function() { self.pauseTab = b.dataset.ptab; self.render(); };
        });
        if (el("sb-p-resume")) el("sb-p-resume").onclick = function() { closePause(); };
        if (el("sb-p-floor")) el("sb-p-floor").onchange = function(e) {
            sandboxCfg.showFloor = e.target.checked; saveSandboxCfg();
            if (typeof SandboxFloor !== "undefined") SandboxFloor.sync();
        };
        if (el("sb-p-noclip")) el("sb-p-noclip").onchange = function(e) { sandboxCfg.noclip = e.target.checked; saveSandboxCfg(); };
        if (el("sb-p-inv")) el("sb-p-inv").onchange = function(e) { sandboxCfg.invincible = e.target.checked; saveSandboxCfg(); };
        if (el("sb-p-grav")) el("sb-p-grav").oninput = function(e) { devOpts.gravityMult = Number(e.target.value); self.render(); };
        if (el("sb-p-clear")) el("sb-p-clear").onclick = function() {
            for (var i = 0; i < staticObjects.length; i++) staticObjects[i].dead = true;
            for (var z = 0; z < zombies.length; z++) zombies[z].dead = true;
            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            closePause();
        };
        if (el("sb-p-horde")) el("sb-p-horde").onclick = function() {
            var ref = redGuy || { x: 0, y: 120 };
            for (var i = 0; i < 6; i++) spawnZombie(null, ref.x + (i % 2 ? 1 : -1) * (400 + i * 70), ref.y + 180);
            closePause();
        };
        if (el("sb-p-eject")) el("sb-p-eject").onclick = function() { EntityTakeover.release(false); closePause(); };
        if (el("sb-p-roster")) el("sb-p-roster").onclick = function() { closePause(); self.rosterOpen = true; self.render(); };
        if (el("sb-p-hub")) el("sb-p-hub").onclick = function() { closePause(); Hub.openHub(false); };
        if (el("sb-p-reset")) el("sb-p-reset").onclick = function() { closePause(); LevelManager.selectLevel("sandbox_blank"); };
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() { SandboxUI.init(); });
} else {
    SandboxUI.init();
}
