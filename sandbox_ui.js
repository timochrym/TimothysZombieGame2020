// ============================================================================
// UNIVERSAL SIDE MENU & SANDBOX UI
//   Works across ALL 24 games:
//   - Collapsible Universal Side Menu (Controls, Best-Ever Inspect, Tools, Games)
//   - Universal Click-to-Inspect across standard worlds & ownScreen arenas
//   - Blank Sandbox Pro Studio Dock, Spawner (Spotlight/Dock/Radial/Browser),
//     Entity Takeover Roster, Tactical Pie Ring & Split Pause Menu
// ============================================================================
var SandboxUI = {
    sideOpen: false,
    sideTab: "controls", // controls | inspect | tools | games
    gameSearch: "",
    rawFilter: "",
    rawOpen: false,

    spawnerOpen: false,
    spawnerMode: "spotlight", // spotlight | dock | radial | browser
    spawnerCat: "All",
    spawnerSearch: "",
    selectedCatalogId: null,

    rosterOpen: false,
    pauseOpen: false,
    pauseTab: "creative",

    tool: "play", // play | inspect | select | drawFloor | drawPlat | drawWall | spawn | possess | grapple | delete
    selectedObj: null,
    selectedEnt: null,
    selectedGroup: [],
    piePos: null,
    ctxMenu: null,
    dragDraw: null, // { x1, y1, x2, y2, wx1, wy1 }
    dragSelect: null, // { x1, y1, x2, y2, wx1, wy1, additive }
    dragMove: null, // { obj, ox, oy, group }
    _root: null,
    _lastMode: null,
    _lastModeId: null,

    isSelected: function(item) {
        return !!item && this.selectedGroup.indexOf(item) !== -1;
    },
    clearSelection: function() {
        this.selectedGroup = [];
        this.selectedObj = null;
        this.selectedEnt = null;
        this.piePos = null;
    },
    toggleSelect: function(item) {
        if (!item) return;
        var idx = this.selectedGroup.indexOf(item);
        if (idx === -1) this.selectedGroup.push(item);
        else this.selectedGroup.splice(idx, 1);
        this.selectedObj = this.selectedGroup.length === 1 ? this.selectedGroup[0] : null;
    },
    selectAllObjects: function() {
        var all = [].concat(typeof staticObjects !== "undefined" ? staticObjects : [], typeof movingObjects !== "undefined" ? movingObjects : []);
        this.selectedGroup = all.filter(function(o) { return o && !o.dead; });
        this.selectedObj = this.selectedGroup.length === 1 ? this.selectedGroup[0] : null;
        this.selectedEnt = null;
        this.piePos = null;
        this.render();
    },
    selectAllEnemies: function() {
        var zs = typeof zombies !== "undefined" ? zombies : [];
        this.selectedGroup = zs.filter(function(z) { return z && !z.dead; });
        this.selectedObj = null;
        this.selectedEnt = null;
        this.piePos = null;
        this.render();
    },

    isActive: function() {
        return typeof GameModes !== "undefined" && GameModes.current &&
            (typeof Hub === "undefined" || !Hub.isOpen) &&
            (typeof Studio === "undefined" || !Studio.isOpen);
    },

    isSandbox: function() {
        return this.isActive() && GameModes.current.id === "sandbox";
    },

    sendNet: function(act) {
        if (typeof Net !== "undefined" && Net.role === "client") {
            Net.send({ t: "sb", act: act });
            return true;
        }
        return false;
    },

    init: function() {
        if (this._root) return;
        var style = document.createElement("style");
        style.textContent = `
          #sb-ui-root { position: fixed; inset: 0; pointer-events: none; z-index: 900; font-family: system-ui, -apple-system, sans-serif; color: #e2e8f0; font-size: 13px; }
          #sb-ui-root * { box-sizing: border-box; }
          .sb-pe { pointer-events: auto; }
          .sb-glass { background: rgba(15, 23, 42, 0.93); backdrop-filter: blur(12px); border: 1px solid rgba(148, 163, 184, 0.25); box-shadow: 0 16px 40px rgba(0,0,0,0.55); }
          .sb-btn { background: rgba(30, 41, 59, 0.9); color: #e2e8f0; border: 1px solid rgba(148,163,184,0.25); border-radius: 8px; padding: 5px 9px; cursor: pointer; font-weight: 600; font-size: 12px; transition: 0.12s; }
          .sb-btn:hover { border-color: #38bdf8; color: #fff; }
          .sb-btn.active { background: #38bdf8; color: #0f172a; border-color: #38bdf8; font-weight: 800; }
          .sb-input { background: rgba(15, 23, 42, 0.95); color: #f8fafc; border: 1px solid rgba(148,163,184,0.3); border-radius: 8px; padding: 6px 9px; outline: none; font-size: 12px; width: 100%; }
          .sb-input:focus { border-color: #38bdf8; }
          .sb-card { background: rgba(30, 41, 59, 0.55); border: 1px solid rgba(148,163,184,0.18); border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; }
          .sb-sec { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #38bdf8; margin: 8px 0 6px; }
          .sb-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; }
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
            if (!self.isActive()) return;
            if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) {
                if (e.code === "Escape") { self.spawnerOpen = false; self.render(); e.target.blur(); }
                return;
            }
            // Universal side menu toggle: F2 or Backquote (when not playtesting from Level Studio)
            if (e.code === "F2" || (e.code === "Backquote" && !(typeof Studio !== "undefined" && Studio.playtesting))) {
                e.preventDefault();
                e.stopImmediatePropagation();
                self.sideOpen = !self.sideOpen;
                self.render();
                return;
            }
            if (self.isSandbox()) {
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
            }
        }, true);

        if (cv) {
            cv.addEventListener("mousedown", function(e) {
                if (!self.isActive()) return;
                self.ctxMenu = null;
                if (self.spawnerOpen) { self.spawnerOpen = false; self.render(); }
                if (e.button === 2) return; // handled in contextmenu

                // In Play mode, let the game handle all clicks normally
                if (self.tool === "play") {
                    if (self.piePos) { self.piePos = null; self.render(); }
                    return;
                }

                var rect = cv.getBoundingClientRect();
                var sx = e.clientX - rect.left, sy = e.clientY - rect.top;

                // Universal Inspect Tool (works in ALL 24 games!)
                if (self.tool === "inspect") {
                    e.stopImmediatePropagation();
                    if (typeof mouseDown !== "undefined") mouseDown = false;
                    if (typeof PlayerInput !== "undefined" && PlayerInput[0]) PlayerInput[0].shoot = false;
                    var hit = typeof UniversalInspect !== "undefined" ? UniversalInspect.findAt(sx, sy) : null;
                    if (hit) {
                        UniversalInspect.selected = hit;
                        self.sideOpen = true;
                        self.sideTab = "inspect";
                        self.render();
                    }
                    return;
                }

                // Remaining editor/build tools
                if (typeof mouseDown !== "undefined") mouseDown = false;
                if (typeof PlayerInput !== "undefined" && PlayerInput[0]) PlayerInput[0].shoot = false;

                var wpos = typeof sbScreenToWorld === "function" ? sbScreenToWorld(sx, sy) : { x: 0, y: 0 };

                if (self.tool === "drawFloor" || self.tool === "drawPlat" || self.tool === "drawWall") {
                    self.dragDraw = { x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY, wx1: wpos.x, wy1: wpos.y };
                    self.render();
                    return;
                }
                if (self.tool === "grapple" && typeof GrappleHook !== "undefined") {
                    GrappleHook.fire(GrappleHook.activeTarget(), wpos.x, wpos.y);
                    return;
                }
                if (self.tool === "spawn" && self.selectedCatalogId && typeof UniversalSpawner !== "undefined") {
                    if (!self.sendNet({ k: "spawn", id: self.selectedCatalogId, x: wpos.x, y: wpos.y })) {
                        UniversalSpawner.spawnById(self.selectedCatalogId, wpos.x, wpos.y);
                    }
                    self.render();
                    return;
                }

                // Check entity hit for L3 Tactical Pie Ring or Possess tool
                var hitEnt = typeof EntityTakeover !== "undefined" ? EntityTakeover.findAt(wpos.x, wpos.y) : null;
                if (hitEnt) {
                    if (self.tool === "possess") {
                        EntityTakeover.possess(hitEnt.ent, e.shiftKey ? 1 : 0);
                        self.selectedEnt = hitEnt;
                        self.piePos = null;
                        self.render();
                        return;
                    }
                    if (self.tool === "delete") {
                        if (hitEnt.ent !== redGuy && hitEnt.ent !== blueGuy) {
                            if (!self.sendNet({ k: "delObj", nid: hitEnt.ent._nid })) hitEnt.ent.dead = true;
                        }
                        self.selectedEnt = null;
                        self.piePos = null;
                        self.render();
                        return;
                    }
                    if (e.shiftKey) {
                        self.toggleSelect(hitEnt.ent);
                        self.selectedEnt = hitEnt;
                        self.piePos = null;
                        self.render();
                        return;
                    }
                    self.selectedEnt = hitEnt;
                    self.selectedObj = null;
                    self.selectedGroup = [hitEnt.ent];
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
                        if (!self.sendNet({ k: "delObj", nid: hitObj._nid })) {
                            hitObj.dead = true;
                            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                        }
                        self.clearSelection();
                    } else if (e.shiftKey) {
                        self.toggleSelect(hitObj);
                        self.selectedEnt = null;
                        self.piePos = null;
                    } else {
                        if (self.selectedGroup.indexOf(hitObj) === -1 || self.selectedGroup.length <= 1) {
                            self.selectedGroup = [hitObj];
                            self.selectedObj = hitObj;
                        } else {
                            self.selectedObj = null;
                        }
                        self.selectedEnt = null;
                        self.piePos = null;
                        var grp = self.selectedGroup.filter(function(it) { return it && !it.dead; }).map(function(it) {
                            return { ref: it, dx: it.x - hitObj.x, dy: it.y - hitObj.y };
                        });
                        self.dragMove = { obj: hitObj, ox: hitObj.x - wpos.x, oy: hitObj.y - wpos.y, group: grp };
                    }
                    self.render();
                    return;
                }

                if (self.tool === "select") {
                    if (!e.shiftKey) self.clearSelection();
                    self.dragSelect = { x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY, wx1: wpos.x, wy1: wpos.y, additive: !!e.shiftKey };
                    self.render();
                    return;
                }

                self.piePos = null;
                self.render();
            }, true);

            window.addEventListener("mousemove", function(e) {
                if (!self.isActive()) return;
                if (self.tool === "inspect" && typeof UniversalInspect !== "undefined") {
                    var rect = cv.getBoundingClientRect();
                    var sx = e.clientX - rect.left, sy = e.clientY - rect.top;
                    if (sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height) {
                        UniversalInspect.hovered = UniversalInspect.findAt(sx, sy);
                    } else {
                        UniversalInspect.hovered = null;
                    }
                } else if (typeof UniversalInspect !== "undefined") {
                    UniversalInspect.hovered = null;
                }

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
                } else if (self.dragSelect) {
                    self.dragSelect.x2 = e.clientX;
                    self.dragSelect.y2 = e.clientY;
                    var sbox = document.getElementById("sb-drag-select");
                    if (sbox) {
                        var sl = Math.min(self.dragSelect.x1, self.dragSelect.x2), st = Math.min(self.dragSelect.y1, self.dragSelect.y2);
                        var sw = Math.max(4, Math.abs(self.dragSelect.x2 - self.dragSelect.x1));
                        var sh = Math.max(4, Math.abs(self.dragSelect.y2 - self.dragSelect.y1));
                        sbox.style.left = sl + "px"; sbox.style.top = st + "px"; sbox.style.width = sw + "px"; sbox.style.height = sh + "px";
                    }
                } else if (self.dragMove && self.dragMove.obj) {
                    var rect2 = cv.getBoundingClientRect();
                    var wpos = typeof sbScreenToWorld === "function" ? sbScreenToWorld(e.clientX - rect2.left, e.clientY - rect2.top) : { x: 0, y: 0 };
                    var nx = Math.round((wpos.x + self.dragMove.ox) / 20) * 20;
                    var ny = Math.round((wpos.y + self.dragMove.oy) / 20) * 20;
                    if (self.dragMove.group && self.dragMove.group.length > 1) {
                        for (var gi = 0; gi < self.dragMove.group.length; gi++) {
                            var gm = self.dragMove.group[gi];
                            if (gm.ref && !gm.ref.dead) { gm.ref.x = nx + gm.dx; gm.ref.y = ny + gm.dy; }
                        }
                    } else {
                        self.dragMove.obj.x = nx;
                        self.dragMove.obj.y = ny;
                    }
                }
            });

            window.addEventListener("mouseup", function(e) {
                if (!self.isActive()) return;
                if (self.dragDraw) {
                    var rect = cv.getBoundingClientRect();
                    var wpos2 = typeof sbScreenToWorld === "function" ? sbScreenToWorld(e.clientX - rect.left, e.clientY - rect.top) : { x: 0, y: 0 };
                    var cx = (self.dragDraw.wx1 + wpos2.x) / 2, cy = (self.dragDraw.wy1 + wpos2.y) / 2;
                    var bw = Math.max(80, Math.round(Math.abs(wpos2.x - self.dragDraw.wx1) / 20) * 20);
                    var bh = Math.max(self.tool === "drawPlat" ? 36 : 60, Math.round(Math.abs(wpos2.y - self.dragDraw.wy1) / 20) * 20);
                    if (Math.abs(wpos2.x - self.dragDraw.wx1) < 20 && Math.abs(wpos2.y - self.dragDraw.wy1) < 20) {
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
                    if (!self.sendNet({ k: "addBox", x: cx, y: cy, w: bw, h: bh, col: col, opts: opts })) {
                        self.selectedObj = GameObject.addBox(cx, cy, bw, bh, col, opts);
                        self.selectedGroup = self.selectedObj ? [self.selectedObj] : [];
                        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                    }
                    self.dragDraw = null;
                    self.render();
                }
                if (self.dragSelect) {
                    var rectS = cv.getBoundingClientRect();
                    var wposS = typeof sbScreenToWorld === "function" ? sbScreenToWorld(e.clientX - rectS.left, e.clientY - rectS.top) : { x: 0, y: 0 };
                    if (Math.hypot(self.dragSelect.x2 - self.dragSelect.x1, self.dragSelect.y2 - self.dragSelect.y1) > 10) {
                        var minX = Math.min(self.dragSelect.wx1, wposS.x), maxX = Math.max(self.dragSelect.wx1, wposS.x);
                        var minY = Math.min(self.dragSelect.wy1, wposS.y), maxY = Math.max(self.dragSelect.wy1, wposS.y);
                        var cands = [].concat(staticObjects || [], movingObjects || [], zombies || []);
                        for (var si = 0; si < cands.length; si++) {
                            var it = cands[si];
                            if (!it || it.dead) continue;
                            var hwS = (it.w || it.s1 || 40) / 2, hhS = (it.h || it.s2 || 40) / 2;
                            if (it.x + hwS >= minX && it.x - hwS <= maxX && it.y + hhS >= minY && it.y - hhS <= maxY) {
                                if (self.selectedGroup.indexOf(it) === -1) self.selectedGroup.push(it);
                            }
                        }
                        self.selectedObj = self.selectedGroup.length === 1 ? self.selectedGroup[0] : null;
                    }
                    self.dragSelect = null;
                    self.render();
                }
                if (self.dragMove) {
                    if (self.dragMove.group && self.dragMove.group.length > 1) {
                        for (var gj = 0; gj < self.dragMove.group.length; gj++) {
                            var gr = self.dragMove.group[gj].ref;
                            if (gr && !gr.dead) self.sendNet({ k: "moveObj", nid: gr._nid, x: gr.x, y: gr.y });
                        }
                        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                    } else if (self.dragMove.obj && !self.sendNet({ k: "moveObj", nid: self.dragMove.obj._nid, x: self.dragMove.obj.x, y: self.dragMove.obj.y })) {
                        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                    }
                    self.dragMove = null;
                    self.render();
                }
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

        // Poll mode transitions & refresh live inspect telemetry
        setInterval(function() {
            var active = self.isActive();
            var modeId = (typeof GameModes !== "undefined" && GameModes.current) ? GameModes.current.id : null;
            if (active !== self._lastMode || modeId !== self._lastModeId) {
                self._lastMode = active;
                self._lastModeId = modeId;
                if (!active) {
                    self.spawnerOpen = false; self.rosterOpen = false; self.pauseOpen = false;
                    self.ctxMenu = null; self.piePos = null;
                } else {
                    var sb = self.isSandbox();
                    self.sideOpen = sb;
                    self.tool = sb ? "select" : "play";
                    if (typeof UniversalInspect !== "undefined") {
                        UniversalInspect.selected = null;
                        UniversalInspect.hovered = null;
                        UniversalInspect.followTarget = null;
                    }
                }
                self.render();
            } else if (active) {
                if (self.rosterOpen) self.renderRosterOnly();
                if (self.sideOpen && self.sideTab === "inspect") self.refreshInspectLive();
            }
        }, 220);
    },

    openPause: function() { this.pauseOpen = true; this.spawnerOpen = false; this.ctxMenu = null; this.render(); },
    closePause: function() { this.pauseOpen = false; this.render(); },

    refreshInspectLive: function() {
        var box = document.getElementById("sb-insp-live");
        if (!box || typeof UniversalInspect === "undefined") return;
        var sel = UniversalInspect.selected;
        if (sel && sel.isDead && sel.isDead()) {
            UniversalInspect.selected = null;
            this.render();
            return;
        }
        if (!sel) {
            var fpsEl = document.getElementById("sb-world-fps");
            if (fpsEl && typeof measuredFPS !== "undefined") fpsEl.textContent = measuredFPS + " FPS";
            return;
        }
        var p = sel.pos ? sel.pos() : { x: 0, y: 0 };
        var v = sel.vel ? sel.vel() : { vx: 0, vy: 0 };
        var hp = sel.hpInfo ? sel.hpInfo() : null;
        var spd = Math.hypot(v.vx, v.vy);
        var pct = hp && hp.max > 0 ? Math.max(0, Math.min(100, Math.round((hp.val / hp.max) * 100))) : 100;
        box.innerHTML =
            (hp ? '<div style="margin-bottom:6px"><div class="sb-row" style="margin-bottom:2px"><span>' + hp.label + '</span><strong>' + hp.val + ' / ' + hp.max + '</strong></div>' +
                '<div style="height:6px;background:rgba(15,23,42,0.9);border-radius:999px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + (sel.color || '#38bdf8') + '"></div></div></div>' : '') +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#cbd5e1">' +
            '<div>Pos: <strong>' + Math.round(p.x) + ', ' + Math.round(p.y) + '</strong></div>' +
            '<div>Vel: <strong>' + v.vx.toFixed(1) + ', ' + v.vy.toFixed(1) + '</strong></div>' +
            '<div>Speed: <strong>' + spd.toFixed(1) + '</strong></div>' +
            '<div>FPS: <strong>' + (typeof measuredFPS !== "undefined" ? measuredFPS : 60) + '</strong></div>' +
            '</div>';
    },

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
                if (item && item.ent && !SandboxUI.sendNet({ k: "fling", nid: item.ent._nid })) item.ent.yspeed = 26;
            };
        });
        el.querySelectorAll("[data-rdel]").forEach(function(b) {
            b.onclick = function() {
                var item = list[Number(b.dataset.rdel)];
                if (item && item.ent && item.ent !== redGuy) {
                    if (!SandboxUI.sendNet({ k: "delObj", nid: item.ent._nid })) item.ent.dead = true;
                    SandboxUI.render();
                }
            };
        });
    },

    render: function() {
        if (!this._root) return;
        if (!this.isActive()) { this._root.innerHTML = ""; return; }

        var html = "";
        var sb = this.isSandbox();
        var m = GameModes.current;
        var posTarget = typeof EntityTakeover !== "undefined" ? EntityTakeover.target : null;

        // 1. Sandbox Top-Left Quick Action Bar
        if (sb) {
            html += '<div class="sb-pe sb-glass" style="position:fixed;top:10px;left:12px;border-radius:12px;padding:5px 10px;display:flex;align-items:center;gap:6px">' +
                '<span style="font-weight:900;color:#38bdf8;padding:0 4px">✨ BLANK SANDBOX</span>' +
                '<button class="sb-btn ' + (this.spawnerOpen ? 'active' : '') + '" id="sb-top-spawn">🔍 Spawner [B]</button>' +
                '<button class="sb-btn ' + (this.rosterOpen ? 'active' : '') + '" id="sb-top-roster">👥 Entities [Tab]</button>' +
                '<button class="sb-btn ' + (sandboxCfg.showFloor ? 'active' : '') + '" id="sb-top-floor">▦ Floor</button>' +
                (posTarget ? '<button class="sb-btn active" id="sb-top-eject">↩ Eject [F]</button>' : '') +
                '<button class="sb-btn" id="sb-top-pause">⚙ Menu [Esc]</button>' +
                '</div>';
        }

        // 2. Universal Side Menu Handle (when collapsed) OR Full Side Drawer (when open)
        if (!this.sideOpen) {
            html += '<div class="sb-pe sb-glass" style="position:fixed;top:' + (sb ? 62 : 12) + 'px;left:12px;border-radius:12px;padding:4px 6px;display:flex;align-items:center;gap:5px">' +
                '<button class="sb-btn" id="sb-side-open" title="Open Universal Side Menu [F2 / `]">☰ Side Menu</button>' +
                '<button class="sb-btn ' + (this.tool === 'inspect' ? 'active' : '') + '" id="sb-quick-inspect" title="Click anything to inspect">🔍 Inspect</button>' +
                (this.tool !== "play" ? '<button class="sb-btn" id="sb-quick-play" title="Return to Play mode">🎮 Play</button>' : '') +
                '</div>';
        } else {
            html += this.renderSideDrawerHTML(sb, m);
        }

        if (this.dragDraw) {
            var dl = Math.min(this.dragDraw.x1, this.dragDraw.x2), dt = Math.min(this.dragDraw.y1, this.dragDraw.y2);
            var dw = Math.max(8, Math.abs(this.dragDraw.x2 - this.dragDraw.x1)), dh = Math.max(8, Math.abs(this.dragDraw.y2 - this.dragDraw.y1));
            html += '<div id="sb-drag-preview" style="position:fixed;left:' + dl + 'px;top:' + dt + 'px;width:' + dw + 'px;height:' + dh + 'px;border:2px dashed #38bdf8;background:rgba(56,189,248,0.2);border-radius:4px"></div>';
        }
        if (this.dragSelect) {
            var sl = Math.min(this.dragSelect.x1, this.dragSelect.x2), st = Math.min(this.dragSelect.y1, this.dragSelect.y2);
            var sw = Math.max(4, Math.abs(this.dragSelect.x2 - this.dragSelect.x1)), sh = Math.max(4, Math.abs(this.dragSelect.y2 - this.dragSelect.y1));
            html += '<div id="sb-drag-select" style="position:fixed;left:' + sl + 'px;top:' + st + 'px;width:' + sw + 'px;height:' + sh + 'px;border:2px dashed #22d3ee;background:rgba(34,211,238,0.14);border-radius:4px"></div>';
        }

        // 3. Sandbox Right Property Inspector (single object OR multi-select group)
        var grpAlive = this.selectedGroup.filter(function(it) { return it && !it.dead; });
        if (sb && grpAlive.length > 1 && !this.rosterOpen) {
            html += '<div class="sb-pe sb-glass" style="position:fixed;top:88px;right:12px;width:236px;border-radius:12px;padding:12px">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                '<strong style="color:#22d3ee">GROUP (' + grpAlive.length + ')</strong>' +
                '<button class="sb-btn" style="padding:2px 6px" id="sb-grp-clear">✕</button></div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px">' +
                '<button class="sb-btn" id="sb-grp-snap">▦ Snap 20px</button>' +
                '<button class="sb-btn" id="sb-grp-alignl">⬅ Align Left</button>' +
                '<button class="sb-btn" id="sb-grp-aligncx">↔ Center X</button>' +
                '<button class="sb-btn" id="sb-grp-alignt">⬆ Align Top</button>' +
                '</div>' +
                '<div style="display:flex;gap:6px">' +
                '<button class="sb-btn" style="flex:1" id="sb-grp-dup">Duplicate All</button>' +
                '<button class="sb-btn" style="color:#f87171" id="sb-grp-del">Delete All</button>' +
                '</div></div>';
        } else if (sb && this.selectedObj && !this.selectedObj.dead && !this.rosterOpen) {
            var o = this.selectedObj;
            html += '<div class="sb-pe sb-glass" style="position:fixed;top:88px;right:12px;width:230px;border-radius:12px;padding:12px">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                '<strong style="color:#38bdf8">OBJECT</strong>' +
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
            html += '<div class="sb-pe" style="position:fixed;left:' + this.piePos.x + 'px;top:' + this.piePos.y + 'px;transform:translate(-50%,-50%);width:155px;height:155px;border-radius:999px;border:2px dashed #38bdf8;background:rgba(15,23,42,0.45)">' +
                '<div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);display:flex;gap:4px;white-space:nowrap">' +
                '<button class="sb-btn active" id="sb-pie-pos">⚡ P1</button>' +
                '<button class="sb-btn" id="sb-pie-pos2" style="border-color:#60a5fa;color:#93c5fd">⚡ P2</button></div>' +
                '<button class="sb-btn" id="sb-pie-fling" style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%)">⬆ Fling</button>' +
                '<button class="sb-btn" id="sb-pie-clone" style="position:absolute;right:-26px;top:50%;transform:translateY(-50%)">Clone</button>' +
                '<button class="sb-btn" id="sb-pie-del" style="position:absolute;left:-20px;top:50%;transform:translateY(-50%);color:#f87171">🗑</button>' +
                '</div>';
        }

        // 6. Universal Object Spawner
        if (this.spawnerOpen) html += this.renderSpawnerHTML();

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
        if (this.pauseOpen) html += this.renderPauseHTML();

        this._root.innerHTML = html;
        this.bindDynamicEvents();
        if (this.rosterOpen) this.renderRosterOnly();
        if (this.sideOpen && this.sideTab === "inspect") this.refreshInspectLive();
    },

    renderSideDrawerHTML: function(sb, m) {
        var self = this;
        var topY = sb ? 62 : 12;
        var ts = typeof devOpts !== "undefined" ? (devOpts.timeScale || 1) : 1;
        var isPaused = typeof paused !== "undefined" && paused;
        var tabs = [
            ["controls", "🎛 Ctrl"],
            ["inspect", "🔍 Insp"],
            ["tools", "🛠 Tool"],
            ["games", "🕹 Game"],
            ["admin", "👑 Admin"]
        ];

        var body = "";
        if (this.sideTab === "controls") body = this.renderSideControlsHTML(m);
        else if (this.sideTab === "inspect") body = this.renderSideInspectHTML();
        else if (this.sideTab === "tools") body = this.renderSideToolsHTML(sb);
        else if (this.sideTab === "admin") body = this.renderAdminHTML();
        else body = this.renderSideGamesHTML(m);

        return '<div class="sb-pe sb-glass" style="position:fixed;top:' + topY + 'px;left:12px;bottom:16px;width:296px;max-width:88vw;border-radius:14px;display:flex;flex-direction:column;overflow:hidden">' +
            // Header
            '<div style="padding:10px 10px 8px;border-bottom:1px solid rgba(148,163,184,0.18);background:rgba(15,23,42,0.65)">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">' +
            '<span style="font-weight:900;font-size:12px;color:' + (m && m.color ? m.color : '#38bdf8') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (m ? m.title : 'UNIVERSAL MENU') + '</span>' +
            '<button class="sb-btn" style="padding:2px 7px" id="sb-side-close" title="Collapse [F2 / `]">✕</button>' +
            '</div>' +
            // Time Scale & Pause/Step Bar
            '<div style="display:flex;gap:3px;align-items:center">' +
            '<button class="sb-btn ' + (isPaused ? 'active' : '') + '" style="padding:3px 7px" id="sb-tm-pause" title="Pause / Resume">' + (isPaused ? '▶' : '⏸') + '</button>' +
            '<button class="sb-btn" style="padding:3px 7px" id="sb-tm-step" title="Step +1 Frame">⏭</button>' +
            [0.25, 0.5, 1, 2, 4].map(function(v) {
                return '<button class="sb-btn ' + (Math.abs(ts - v) < 0.05 ? 'active' : '') + '" style="flex:1;padding:3px 2px;font-size:11px" data-ts="' + v + '">' + v + 'x</button>';
            }).join("") +
            '</div>' +
            // Tabs
            '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-top:8px">' +
            tabs.map(function(t) {
                return '<button class="sb-btn ' + (self.sideTab === t[0] ? 'active' : '') + '" style="padding:5px 2px;font-size:10px" data-stab="' + t[0] + '">' + t[1] + '</button>';
            }).join("") +
            '</div></div>' +
            // Scrollable Content
            '<div class="sb-scroll" style="flex:1;overflow-y:auto;padding:10px">' + body + '</div>' +
            '</div>';
    },

    renderAdminHTML: function() {
        var isGod = !!(typeof godMode !== "undefined" && godMode) || !!(typeof arenaCheats !== "undefined" && arenaCheats.god) || !!(typeof sandboxCfg !== "undefined" && sandboxCfg.invincible);
        var unlimAmmo = typeof settings !== "undefined" && settings.ammo === "unlimited";
        var grav = typeof devOpts !== "undefined" ? (devOpts.gravityMult || 1) : 1;
        var isClient = typeof Net !== "undefined" && Net.role === "client";
        var isHost = typeof Net !== "undefined" && Net.role === "host";
        var html = '<div class="sb-sec">👑 Admin Commands</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px">' +
            '<button class="sb-btn" id="sb-adm-boss">👑 Spawn Boss</button>' +
            '<button class="sb-btn" id="sb-adm-horde">🧟 Summon Horde</button>' +
            '<button class="sb-btn" id="sb-adm-heal">❤ Heal All</button>' +
            '<button class="sb-btn" id="sb-adm-respawn">🔄 Respawn All</button>' +
            '<button class="sb-btn" id="sb-adm-clearfoe">🧹 Clear Foes</button>' +
            '<button class="sb-btn" style="color:#f87171" id="sb-adm-clearworld">💥 Clear World</button>' +
            '</div>' +
            '<div class="sb-sec">Global Rules</div><div class="sb-card">' +
            '<label class="sb-row" style="cursor:pointer"><span>🛡 God Mode (All)</span><input type="checkbox" id="sb-adm-god" ' + (isGod ? 'checked' : '') + '></label>' +
            '<label class="sb-row" style="cursor:pointer"><span>∞ Unlimited Ammo</span><input type="checkbox" id="sb-adm-ammo" ' + (unlimAmmo ? 'checked' : '') + '></label>' +
            '<div style="margin-bottom:2px"><div class="sb-row" style="margin-bottom:2px"><span>🌍 Gravity</span><strong>' + grav.toFixed(1) + 'x</strong></div>' +
            '<input type="range" id="sb-adm-grav" min="0" max="2.5" step="0.1" value="' + grav + '" style="width:100%"></div>' +
            '</div>';
        if (isHost || isClient) {
            var plist = isHost ? Net.peerList() : (Net.lobbyPlayers || []);
            html += '<div class="sb-sec">📡 LAN Players (' + (plist.length + (isHost ? 1 : 0)) + ')</div><div class="sb-card">';
            if (isHost) html += '<div class="sb-row"><span><strong>You (Host)</strong></span><span style="color:#4ade80">Host</span></div>';
            if (plist.length) {
                html += plist.map(function(p) {
                    return '<div class="sb-row"><span>' + (p.name || 'Player') + '</span>' +
                        (p.pid !== undefined ? '<button class="sb-btn" style="padding:2px 6px;font-size:10px" data-admresp="' + p.pid + '">Respawn</button>' : '') +
                        '</div>';
                }).join("");
            } else if (!isHost) {
                html += '<div style="color:#94a3b8;font-size:11px">Connected to ' + (Net.hostName || 'Host') + '</div>';
            }
            if (isClient) {
                html += '<button class="sb-btn" style="width:100%;margin-top:6px;color:#f87171" id="sb-adm-leave">📡 Leave LAN Game</button>';
            }
            html += '</div>';
        }
        return html;
    },

    renderSideControlsHTML: function(m) {
        var rows = (typeof GameTuning !== "undefined") ? GameTuning.rows() : [];
        var html = "";

        if (rows.length) {
            html += '<div class="sb-sec">Game Controls · ' + (m ? m.title : '') + '</div><div class="sb-card">';
            html += rows.map(function(r, idx) {
                var val = r.get ? r.get() : "";
                if (r.type === "toggle") {
                    return '<label class="sb-row" style="cursor:pointer"><span>' + r.label + '</span><input type="checkbox" data-gtune="' + idx + '" ' + (val ? 'checked' : '') + '></label>';
                }
                if (r.type === "choice") {
                    return '<div style="margin-bottom:7px"><div style="font-size:11px;color:#94a3b8;margin-bottom:2px">' + r.label + '</div>' +
                        '<select class="sb-input" data-gtune="' + idx + '">' +
                        (r.options || []).map(function(o) { return '<option value="' + o[0] + '" ' + (String(o[0]) === String(val) ? 'selected' : '') + '>' + o[1] + '</option>'; }).join("") +
                        '</select></div>';
                }
                return '<div style="margin-bottom:7px"><div class="sb-row" style="margin-bottom:2px"><span>' + r.label + '</span><strong>' + val + '</strong></div>' +
                    '<input type="range" style="width:100%" data-gtune="' + idx + '" min="' + r.min + '" max="' + r.max + '" step="' + (r.step || 1) + '" value="' + val + '"></div>';
            }).join("");
            html += '</div>';
        }

        // Universal Physics & Cheats
        var isGod = !!(typeof godMode !== "undefined" && godMode) || !!(typeof arenaCheats !== "undefined" && arenaCheats.god);
        var unlimAmmo = typeof settings !== "undefined" && settings.ammo === "unlimited";
        var grav = typeof devOpts !== "undefined" ? (devOpts.gravityMult || 1) : 1;
        var uz = typeof userZoom !== "undefined" ? userZoom : 1;
        var hb = typeof devOpts !== "undefined" && !!devOpts.showHitboxes;

        html += '<div class="sb-sec">Universal Physics & Cheats</div><div class="sb-card">' +
            '<label class="sb-row" style="cursor:pointer"><span>🛡 God Mode (Invincible)</span><input type="checkbox" id="sb-u-god" ' + (isGod ? 'checked' : '') + '></label>' +
            '<label class="sb-row" style="cursor:pointer"><span>∞ Unlimited Ammo</span><input type="checkbox" id="sb-u-ammo" ' + (unlimAmmo ? 'checked' : '') + '></label>' +
            '<label class="sb-row" style="cursor:pointer"><span>🟩 Show Hitboxes</span><input type="checkbox" id="sb-u-hb" ' + (hb ? 'checked' : '') + '></label>' +
            '<div style="margin-bottom:6px"><div class="sb-row" style="margin-bottom:2px"><span>🌍 Gravity</span><strong>' + grav.toFixed(1) + 'x</strong></div>' +
            '<input type="range" id="sb-u-grav" min="0" max="2.5" step="0.1" value="' + grav + '" style="width:100%"></div>' +
            '<div><div class="sb-row" style="margin-bottom:2px"><span>🔎 Camera Zoom</span><strong>' + uz.toFixed(2) + 'x</strong></div>' +
            '<input type="range" id="sb-u-zoom" min="0.4" max="2.2" step="0.05" value="' + uz + '" style="width:100%"></div>' +
            '</div>';

        html += '<div class="sb-sec">Quick Actions</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
            '<button class="sb-btn" id="sb-act-heal">❤ Heal All</button>' +
            '<button class="sb-btn" id="sb-act-clear">🧹 Clear Foes</button>' +
            '<button class="sb-btn" id="sb-act-restart">🔄 Restart</button>' +
            '<button class="sb-btn active" id="sb-act-hub">🕹 Arcade Hub</button>' +
            '</div>';
        return html;
    },

    renderSideInspectHTML: function() {
        var ui = typeof UniversalInspect !== "undefined" ? UniversalInspect : null;
        var sel = ui ? ui.selected : null;
        var html = '<div style="display:flex;gap:5px;margin-bottom:8px">' +
            '<button class="sb-btn ' + (this.tool === 'inspect' ? 'active' : '') + '" style="flex:1" id="sb-insp-pick">🎯 Click to Inspect</button>' +
            (sel ? '<button class="sb-btn" id="sb-insp-clear" title="Clear Selection">✕</button>' : '') +
            '</div>';

        // Quick target chips for the active game
        html += this.renderQuickTargetsHTML();

        if (!sel) {
            html += '<div class="sb-card" style="text-align:center;color:#94a3b8;padding:14px 10px">' +
                '<div style="font-size:20px;margin-bottom:4px">🔍</div>' +
                '<div style="font-weight:700;color:#e2e8f0;margin-bottom:4px">Universal Inspector</div>' +
                'Click <strong>🎯 Click to Inspect</strong> and tap any player, zombie, ball, tank, blob, worm, virus, block, or tile!' +
                '</div>';
        } else {
            var o = sel.obj;
            var isFollowing = ui.followTarget && ui.followTarget.obj === o;
            var isFrozen = !!(o && o._sbFrozen);
            var isInv = !!(o && (o._sbInv || o.invulnTimer > 9999));

            html += '<div class="sb-card" style="border-color:' + (sel.color || '#38bdf8') + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:start;gap:6px;margin-bottom:6px">' +
                '<div><div style="font-weight:800;font-size:13px">' + sel.icon + ' ' + sel.title + '</div>' +
                '<div style="font-size:11px;color:#94a3b8">' + sel.sub + '</div></div>' +
                '<span style="font-size:10px;padding:2px 6px;border-radius:999px;background:rgba(56,189,248,0.2);color:#38bdf8;font-weight:800">' + sel.kind.toUpperCase() + '</span>' +
                '</div>' +
                '<div id="sb-insp-live" style="background:rgba(15,23,42,0.65);border-radius:8px;padding:7px;margin-bottom:8px"></div>' +
                // Action Buttons
                '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:8px">' +
                '<button class="sb-btn ' + (isFollowing ? 'active' : '') + '" id="sb-in-follow" style="padding:4px">🎯 Follow</button>' +
                '<button class="sb-btn" id="sb-in-heal" style="padding:4px">❤ Heal/+</button>' +
                '<button class="sb-btn" id="sb-in-yeet" style="padding:4px">🚀 Yeet</button>' +
                ((sel.kind === "character" || sel.kind === "enemy") ? '<button class="sb-btn" id="sb-in-pos" style="padding:4px">⚡ Possess</button>' : '') +
                '<button class="sb-btn ' + (isFrozen ? 'active' : '') + '" id="sb-in-freeze" style="padding:4px">' + (isFrozen ? '❄ Frozen' : '❄ Freeze') + '</button>' +
                '<button class="sb-btn" id="sb-in-del" style="padding:4px;color:#f87171">🗑 Delete</button>' +
                '</div>';

            // Direct Live Editors
            html += '<div class="sb-sec" style="margin-top:2px">Live Properties</div>';
            if (sel.kind === "character" || sel.kind === "enemy") {
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">' +
                    '<label style="font-size:10px;color:#94a3b8">HP<input class="sb-input" type="number" id="sb-ed-hp" value="' + Math.round(o.health || 0) + '"></label>' +
                    '<label style="font-size:10px;color:#94a3b8">Max HP<input class="sb-input" type="number" id="sb-ed-mhp" value="' + Math.round(o.maxHealth || 100) + '"></label>' +
                    '<label style="font-size:10px;color:#94a3b8">Speed<input class="sb-input" type="number" id="sb-ed-spd" value="' + Math.round(o.maxspeed || 10) + '"></label>' +
                    '<label style="font-size:10px;color:#94a3b8">Size<input class="sb-input" type="number" id="sb-ed-sz" value="' + Math.round(o.s1 || 80) + '"></label>' +
                    '</div>' +
                    '<label class="sb-row" style="cursor:pointer"><span>🛡 Invincible</span><input type="checkbox" id="sb-ed-inv" ' + (isInv ? 'checked' : '') + '></label>';
            } else if (sel.kind === "tank") {
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">' +
                    '<label style="font-size:10px;color:#94a3b8">HP<input class="sb-input" type="number" id="sb-ed-thp" value="' + Math.round(o.hp || 0) + '"></label>' +
                    '<label style="font-size:10px;color:#94a3b8">Level<input class="sb-input" type="number" id="sb-ed-tlvl" value="' + (o.lvl || 1) + '"></label>' +
                    '<label style="font-size:10px;color:#94a3b8">Stat Pts<input class="sb-input" type="number" id="sb-ed-tpts" value="' + (o.pts || 0) + '"></label>' +
                    '<label style="font-size:10px;color:#94a3b8">Color<input class="sb-input" type="color" id="sb-ed-col" value="' + (o.col || '#38bdf8') + '" style="height:28px;padding:2px"></label>' +
                    '</div>';
            } else if (sel.kind === "blob" || sel.kind === "virus") {
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">' +
                    '<label style="font-size:10px;color:#94a3b8">Mass<input class="sb-input" type="number" id="sb-ed-mass" value="' + Math.round(o.m || 50) + '"></label>' +
                    '<label style="font-size:10px;color:#94a3b8">X<input class="sb-input" type="number" id="sb-ed-x" value="' + Math.round(o.x || 0) + '"></label>' +
                    '</div>';
            } else if (sel.kind === "worm") {
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">' +
                    '<label style="font-size:10px;color:#94a3b8">Length<input class="sb-input" type="number" id="sb-ed-len" value="' + Math.round(o.len || 30) + '"></label>' +
                    '<label style="font-size:10px;color:#94a3b8">Color<input class="sb-input" type="color" id="sb-ed-col" value="' + (o.col || '#a855f7') + '" style="height:28px;padding:2px"></label>' +
                    '</div>';
            } else if (sel.kind === "object") {
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">' +
                    '<label style="font-size:10px;color:#94a3b8">X<input class="sb-input" type="number" id="sb-ed-x" value="' + Math.round(o.x || 0) + '"></label>' +
                    '<label style="font-size:10px;color:#94a3b8">Y<input class="sb-input" type="number" id="sb-ed-y" value="' + Math.round(o.y || 0) + '"></label>' +
                    '<label style="font-size:10px;color:#94a3b8">W<input class="sb-input" type="number" id="sb-ed-w" value="' + Math.round(o.w || 60) + '"></label>' +
                    '<label style="font-size:10px;color:#94a3b8">H<input class="sb-input" type="number" id="sb-ed-h" value="' + Math.round(o.h || 60) + '"></label>' +
                    '</div>';
            } else if (sel.kind === "ball") {
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">' +
                    '<label style="font-size:10px;color:#94a3b8">Radius<input class="sb-input" type="number" id="sb-ed-br" value="' + Math.round(Ball.r || 44) + '"></label>' +
                    '<label style="font-size:10px;color:#94a3b8">X<input class="sb-input" type="number" id="sb-ed-x" value="' + Math.round(Ball.x || 0) + '"></label>' +
                    '</div>';
            }

            // Mode-specific extra fields (Bedwars, Brawl, Terra, etc.)
            if (sel.extra && sel.extra.fields && sel.extra.fields.length) {
                html += '<div class="sb-sec">Mode Properties</div>';
                sel.extra.fields.forEach(function(f, fi) {
                    var v = f.get ? f.get() : "";
                    if (f.type === "range") {
                        html += '<div style="margin-bottom:5px"><div class="sb-row" style="margin-bottom:1px"><span>' + f.label + '</span><strong>' + v + '</strong></div>' +
                            '<input type="range" style="width:100%" data-exf="' + fi + '" min="' + f.min + '" max="' + f.max + '" step="' + (f.step || 1) + '" value="' + v + '"></div>';
                    } else if (f.type === "choice") {
                        html += '<div style="margin-bottom:5px"><div style="font-size:10px;color:#94a3b8">' + f.label + '</div>' +
                            '<select class="sb-input" data-exf="' + fi + '">' + (f.options || []).map(function(op) { return '<option value="' + op[0] + '" ' + (String(op[0]) === String(v) ? 'selected' : '') + '>' + op[1] + '</option>'; }).join("") + '</select></div>';
                    } else {
                        html += '<div class="sb-row"><span>' + f.label + '</span><strong>' + v + '</strong></div>';
                    }
                });
            }
            if (sel.extra && sel.extra.actions && sel.extra.actions.length) {
                html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">' +
                    sel.extra.actions.map(function(a, ai) { return '<button class="sb-btn" data-exa="' + ai + '" style="flex:1;padding:4px">' + a.label + '</button>'; }).join("") +
                    '</div>';
            }

            // Collapsible Raw Property Explorer
            html += '<details ' + (this.rawOpen ? 'open' : '') + ' id="sb-raw-det" style="margin-top:8px">' +
                '<summary style="cursor:pointer;font-size:11px;font-weight:700;color:#38bdf8">🧬 Raw Property Explorer</summary>' +
                '<input class="sb-input" id="sb-raw-filter" placeholder="Filter keys (hp, x, vx, color...)" value="' + this.rawFilter + '" style="margin:6px 0">' +
                '<div class="sb-scroll" style="max-height:170px;overflow-y:auto">' + this.renderRawPropsHTML(o) + '</div></details>';

            html += '</div>';
        }

        // World Telemetry Footer
        html += '<div class="sb-sec">World Telemetry</div><div class="sb-card" style="font-size:11px">' +
            '<div class="sb-row"><span>Frame Rate</span><strong id="sb-world-fps">' + (typeof measuredFPS !== "undefined" ? measuredFPS : 60) + ' FPS</strong></div>' +
            '<div class="sb-row"><span>Players / Enemies</span><strong>' + (typeof characters !== "undefined" ? characters.length : 0) + ' / ' + (typeof zombies !== "undefined" ? zombies.length : 0) + '</strong></div>' +
            '<div class="sb-row" style="margin-bottom:0"><span>Ragdolls / Objects</span><strong>' + (typeof Ragdolls !== "undefined" ? Ragdolls.list.length : 0) + ' / ' + (typeof staticObjects !== "undefined" ? staticObjects.length : 0) + '</strong></div>' +
            '</div>';
        return html;
    },

    renderQuickTargetsHTML: function() {
        var id = GameModes.current ? GameModes.current.id : "";
        var chips = [];
        if (id === "sport" && typeof Ball !== "undefined") {
            chips.push(["⚽ Ball", "ball"]);
            if (typeof Flail !== "undefined" && Flail.on() && Flail.men[0]) chips.push(["🟢 Keeper", "flail0"]);
        } else if (id === "mix" || id === "tanks" || id === "cells" || id === "snake") {
            if (typeof Tanks !== "undefined" && Tanks.tanks[0]) chips.push(["🛡 Tank", "tank0"]);
            if (typeof Cells !== "undefined" && Cells.blobs[0]) chips.push(["🟢 Blob", "blob0"]);
            if (typeof Snake !== "undefined" && Snake.worms[0]) chips.push(["🐍 Worm", "worm0"]);
            if (typeof Cells !== "undefined" && Cells.viruses[0]) chips.push(["🦠 Virus", "virus0"]);
        } else {
            if (typeof redGuy !== "undefined" && redGuy && !redGuy.dead) chips.push(["🧑 P1", "p1"]);
            if (typeof blueGuy !== "undefined" && blueGuy && !blueGuy.dead) chips.push(["🧑 P2", "p2"]);
            if (typeof zombies !== "undefined" && zombies[0]) chips.push(["🧟 Enemy", "z0"]);
        }
        if (!chips.length) return "";
        return '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">' +
            chips.map(function(c) { return '<button class="sb-btn" style="padding:3px 7px;font-size:11px" data-qpick="' + c[1] + '">' + c[0] + '</button>'; }).join("") +
            '</div>';
    },

    renderRawPropsHTML: function(o) {
        if (!o || typeof o !== "object") return "";
        var q = this.rawFilter.toLowerCase();
        var keys = Object.keys(o).filter(function(k) {
            if (k.charAt(0) === "_") return false;
            var t = typeof o[k];
            if (t !== "number" && t !== "boolean" && t !== "string") return false;
            return !q || k.toLowerCase().indexOf(q) !== -1;
        }).slice(0, 40);
        return keys.map(function(k) {
            var v = o[k], t = typeof v;
            if (t === "boolean") {
                return '<label class="sb-row" style="margin-bottom:3px;font-size:11px"><span style="color:#94a3b8">' + k + '</span><input type="checkbox" data-rawk="' + k + '" ' + (v ? 'checked' : '') + '></label>';
            }
            return '<div class="sb-row" style="margin-bottom:3px;font-size:11px"><span style="color:#94a3b8;overflow:hidden;text-overflow:ellipsis">' + k + '</span>' +
                '<input class="sb-input" data-rawk="' + k + '" type="' + (t === "number" ? "number" : "text") + '" value="' + (t === "number" ? Math.round(v * 100) / 100 : String(v).replace(/"/g, '&quot;')) + '" style="width:95px;padding:2px 5px;font-size:11px"></div>';
        }).join("");
    },

    renderSideToolsHTML: function(sb) {
        var tools = [
            ["play", "🎮 Play / Normal"],
            ["inspect", "🔍 Inspect Anything"],
            ["select", "✋ Select / Box"],
            ["drawFloor", "🧱 Draw Floor"],
            ["drawPlat", "➖ Draw Platform"],
            ["drawWall", "🏰 Draw Wall"],
            ["spawn", "➕ Spawn Selected"],
            ["possess", "⚡ Possess Entity"],
            ["grapple", "🪝 Grappling Hook"],
            ["delete", "🗑 Delete"]
        ];
        var selCount = this.selectedGroup.filter(function(it) { return it && !it.dead; }).length;
        return '<div class="sb-sec">Active Tool</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:10px">' +
            tools.map(function(t) {
                return '<button class="sb-btn ' + (SandboxUI.tool === t[0] ? 'active' : '') + '" style="text-align:left;padding:6px 7px;font-size:11px" data-sbtool="' + t[0] + '">' + t[1] + '</button>';
            }).join("") + '</div>' +
            '<div class="sb-sec">Selection Tools (' + selCount + ' selected)</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:10px">' +
            '<button class="sb-btn" style="font-size:11px" id="sb-sel-allobj">▦ All Objects</button>' +
            '<button class="sb-btn" style="font-size:11px" id="sb-sel-allmob">🧟 All Enemies</button>' +
            '<button class="sb-btn" style="font-size:11px;grid-column:span 2" id="sb-sel-clear">✕ Clear Selection</button>' +
            '</div>' +
            '<div class="sb-sec">Character Swap &amp; Overlays</div>' +
            '<button class="sb-btn" style="width:100%;margin-bottom:5px" id="sb-tl-swap">🔄 Swap P1 ↔ P2 [V]</button>' +
            '<button class="sb-btn" style="width:100%;margin-bottom:5px" id="sb-tl-spawn">🔍 Universal Spawner [B]</button>' +
            '<button class="sb-btn" style="width:100%;margin-bottom:5px" id="sb-tl-roster">👥 Entity Roster</button>' +
            (sb ? '<button class="sb-btn" style="width:100%" id="sb-tl-floor">▦ Toggle Sandbox Floor</button>' : '');
    },

    renderSideGamesHTML: function(cur) {
        var list = typeof GameModes !== "undefined" ? GameModes.list : [];
        var q = this.gameSearch.toLowerCase();
        var filtered = list.filter(function(g) {
            return !q || g.title.toLowerCase().indexOf(q) !== -1 || (g.tagline && g.tagline.toLowerCase().indexOf(q) !== -1);
        });
        return '<input class="sb-input" id="sb-gm-search" placeholder="Search all ' + list.length + ' games..." value="' + this.gameSearch + '" style="margin-bottom:8px">' +
            filtered.map(function(g) {
                var act = cur && cur.id === g.id;
                return '<button class="sb-btn ' + (act ? 'active' : '') + '" data-gmlaunch="' + g.id + '" style="width:100%;text-align:left;margin-bottom:5px;padding:7px 9px">' +
                    '<div style="font-weight:800;font-size:12px">' + g.title + '</div>' +
                    '<div style="font-size:10px;opacity:0.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (g.tagline || '') + '</div></button>';
            }).join("");
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
            return '<div class="sb-pe sb-glass" style="position:fixed;top:64px;left:50%;transform:translateX(-50%);width:580px;max-width:92vw;border-radius:14px;padding:12px">' +
                modeSwitcher +
                '<input class="sb-input" id="sb-sp-search" placeholder="Search EVERY object & enemy from all games (zombie, boss, bed, tnt, portal, tank...)" value="' + this.spawnerSearch + '" />' +
                '<div class="sb-scroll" style="display:flex;gap:4px;overflow-x:auto;margin-top:8px;padding-bottom:4px">' +
                cats.map(function(c) {
                    return '<button class="sb-btn ' + (self.spawnerCat === c ? 'active' : '') + '" style="white-space:nowrap;padding:3px 8px;font-size:11px" data-spcat="' + c + '">' + c + '</button>';
                }).join("") + '</div>' +
                '<div class="sb-scroll" style="max-height:290px;overflow-y:auto;margin-top:6px;display:flex;flex-direction:column;gap:4px">' +
                filtered.map(function(it) {
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

        return '<div class="sb-pe sb-glass" style="position:fixed;top:68px;left:304px;width:480px;max-width:90vw;height:360px;border-radius:14px;padding:10px;display:flex;flex-direction:column">' +
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
        var isClient = typeof Net !== "undefined" && Net.role === "client";
        var tabs = [["creative", "Creative Rules"], ["cheats", "Cheats & Physics"], ["entities", "Entity Controls"], ["arcade", "Switch Game"], ["admin", "👑 Admin"]];
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
            body = '<button class="sb-btn" style="width:100%;margin-bottom:6px" id="sb-p-swap">🔄 Swap P1 ↔ P2 Characters</button>' +
                '<button class="sb-btn" style="width:100%;margin-bottom:6px" id="sb-p-eject">↩ Eject to Hero</button>' +
                '<button class="sb-btn" style="width:100%" id="sb-p-roster">👥 Open Entity Roster</button>';
        } else if (this.pauseTab === "admin") {
            body = this.renderAdminHTML();
        } else {
            body = '<button class="sb-btn active" style="width:100%;margin-bottom:8px" id="sb-p-hub">🕹 ' + (isClient ? 'Open Games List' : 'Open Arcade Hub') + '</button>' +
                '<button class="sb-btn" style="width:100%;margin-bottom:8px" id="sb-p-reset">✨ Reset Blank World</button>' +
                (isClient ? '<button class="sb-btn" style="width:100%;color:#f87171" id="sb-p-leave">📡 Leave LAN Game</button>' : '');
        }

        return '<div class="sb-pe" style="position:fixed;inset:0;background:rgba(2,6,23,0.65);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center">' +
            '<div class="sb-glass" style="width:560px;max-width:94vw;min-height:330px;max-height:85vh;border-radius:16px;display:grid;grid-template-columns:165px 1fr;overflow:hidden">' +
            '<div style="background:rgba(15,23,42,0.9);padding:12px;border-right:1px solid rgba(148,163,184,0.2);display:flex;flex-direction:column;gap:4px">' +
            '<div style="font-weight:900;color:#38bdf8;margin-bottom:6px">PAUSED</div>' +
            tabs.map(function(t) {
                return '<button class="sb-btn ' + (self.pauseTab === t[0] ? 'active' : '') + '" style="text-align:left" data-ptab="' + t[0] + '">' + t[1] + '</button>';
            }).join("") +
            (isClient ? '<button class="sb-btn" style="margin-top:auto;color:#f87171" id="sb-p-leave2">📡 Leave LAN</button>' : '') +
            '<button class="sb-btn" style="' + (isClient ? 'margin-top:4px' : 'margin-top:auto') + '" id="sb-p-resume">▶ Resume</button>' +
            '</div>' +
            '<div class="sb-scroll" style="padding:16px;overflow-y:auto">' + body + '</div>' +
            '</div></div>';
    },

    bindDynamicEvents: function() {
        var self = this;
        var el = function(id) { return document.getElementById(id); };

        // Top Bar (Sandbox)
        if (el("sb-top-spawn")) el("sb-top-spawn").onclick = function() { self.spawnerOpen = !self.spawnerOpen; self.render(); };
        if (el("sb-top-roster")) el("sb-top-roster").onclick = function() { self.rosterOpen = !self.rosterOpen; self.render(); };
        if (el("sb-top-floor")) el("sb-top-floor").onclick = function() {
            sandboxCfg.showFloor = !sandboxCfg.showFloor; saveSandboxCfg();
            if (!self.sendNet({ k: "floor", v: sandboxCfg.showFloor }) && typeof SandboxFloor !== "undefined") SandboxFloor.sync();
            self.render();
        };
        if (el("sb-top-eject")) el("sb-top-eject").onclick = function() { EntityTakeover.release(false); self.render(); };
        if (el("sb-top-pause")) el("sb-top-pause").onclick = function() {
            if (typeof Net !== "undefined" && Net.role === "client") { self.pauseOpen = !self.pauseOpen; self.render(); }
            else togglePause();
        };

        // Universal Side Handle & Drawer
        if (el("sb-side-open")) el("sb-side-open").onclick = function() { self.sideOpen = true; self.render(); };
        if (el("sb-side-close")) el("sb-side-close").onclick = function() { self.sideOpen = false; self.render(); };
        if (el("sb-quick-inspect")) el("sb-quick-inspect").onclick = function() {
            self.tool = self.tool === "inspect" ? "play" : "inspect";
            if (self.tool === "inspect") { self.sideOpen = true; self.sideTab = "inspect"; }
            self.render();
        };
        if (el("sb-quick-play")) el("sb-quick-play").onclick = function() { self.tool = "play"; self.render(); };

        // Time Scale & Pause/Step
        if (el("sb-tm-pause")) el("sb-tm-pause").onclick = function() {
            if (!self.sendNet({ k: "pause", v: !(typeof paused !== "undefined" && paused) })) {
                if (typeof togglePause === "function") togglePause();
            }
            self.render();
        };
        if (el("sb-tm-step")) el("sb-tm-step").onclick = function() {
            if (typeof paused !== "undefined" && !paused && typeof openPause === "function") openPause(false);
            if (typeof frame === "function") frame();
            if (typeof pauseSnap !== "undefined" && pauseSnap && typeof canvas !== "undefined") pauseSnap.getContext("2d").drawImage(canvas, 0, 0);
            self.render();
        };
        this._root.querySelectorAll("[data-ts]").forEach(function(b) {
            b.onclick = function() {
                devOpts.timeScale = Number(b.dataset.ts);
                self.sendNet({ k: "ts", v: devOpts.timeScale });
                self.render();
            };
        });
        this._root.querySelectorAll("[data-stab]").forEach(function(b) {
            b.onclick = function() { self.sideTab = b.dataset.stab; self.render(); };
        });

        // Controls Tab: Game Tunables
        var gRows = (typeof GameTuning !== "undefined") ? GameTuning.rows() : [];
        this._root.querySelectorAll("[data-gtune]").forEach(function(inp) {
            var idx = Number(inp.dataset.gtune);
            var r = gRows[idx];
            if (!r || !r.set) return;
            var handler = function() {
                var val = r.type === "toggle" ? inp.checked : (r.type === "choice" ? (isNaN(Number(inp.value)) ? inp.value : Number(inp.value)) : Number(inp.value));
                r.set(val);
                if (!r.localOnly) self.sendNet({ k: "tune", idx: idx, val: val });
                if (inp.type === "range" && inp.previousElementSibling) {
                    var strong = inp.previousElementSibling.querySelector("strong");
                    if (strong) strong.textContent = r.get();
                } else self.render();
            };
            inp.oninput = handler;
            if (inp.tagName === "SELECT" || inp.type === "checkbox") inp.onchange = handler;
        });

        // Controls Tab: Universal Cheats
        if (el("sb-u-god")) el("sb-u-god").onchange = function(e) {
            var v = e.target.checked;
            if (typeof godMode !== "undefined") godMode = v;
            if (typeof arenaCheats !== "undefined") arenaCheats.god = v;
            if (typeof sandboxCfg !== "undefined") sandboxCfg.invincible = v;
            if (typeof creativeCfg !== "undefined") creativeCfg.invincible = v;
            self.sendNet({ k: "god", v: v });
        };
        if (el("sb-u-ammo")) el("sb-u-ammo").onchange = function(e) {
            if (typeof settings !== "undefined") { settings.ammo = e.target.checked ? "unlimited" : "limited"; if (typeof saveSettings === "function") saveSettings(); }
            self.sendNet({ k: "ammo", v: e.target.checked });
        };
        if (el("sb-u-hb")) el("sb-u-hb").onchange = function(e) { devOpts.showHitboxes = e.target.checked; };
        if (el("sb-u-grav")) el("sb-u-grav").oninput = function(e) {
            devOpts.gravityMult = Number(e.target.value);
            self.sendNet({ k: "grav", v: devOpts.gravityMult });
            var st = e.target.previousElementSibling && e.target.previousElementSibling.querySelector("strong");
            if (st) st.textContent = devOpts.gravityMult.toFixed(1) + "x";
        };
        if (el("sb-u-zoom")) el("sb-u-zoom").oninput = function(e) {
            if (typeof userZoom !== "undefined") userZoom = Number(e.target.value);
            var st = e.target.previousElementSibling && e.target.previousElementSibling.querySelector("strong");
            if (st) st.textContent = userZoom.toFixed(2) + "x";
        };
        if (el("sb-act-heal") && typeof DevActions !== "undefined") el("sb-act-heal").onclick = function() { if (!self.sendNet({ k: "healAll" })) DevActions.healAll(); };
        if (el("sb-act-clear") && typeof DevActions !== "undefined") el("sb-act-clear").onclick = function() { if (!self.sendNet({ k: "clearEnemies" })) DevActions.clearEnemies(); };
        if (el("sb-act-restart")) el("sb-act-restart").onclick = function() {
            if (!self.sendNet({ k: "restart" })) {
                if (GameModes.has("onRestart")) GameModes.call("onRestart");
                else if (typeof resetGame === "function") resetGame();
            }
            self.render();
        };
        if (el("sb-act-hub")) el("sb-act-hub").onclick = function() {
            if (typeof Net !== "undefined" && Net.role === "client") { self.sideOpen = true; self.sideTab = "games"; self.render(); }
            else if (typeof Hub !== "undefined") Hub.openHub(false);
        };

        // Inspect Tab
        if (el("sb-insp-pick")) el("sb-insp-pick").onclick = function() {
            self.tool = self.tool === "inspect" ? (self.isSandbox() ? "select" : "play") : "inspect";
            self.render();
        };
        if (el("sb-insp-clear")) el("sb-insp-clear").onclick = function() {
            UniversalInspect.selected = null;
            UniversalInspect.followTarget = null;
            self.render();
        };
        this._root.querySelectorAll("[data-qpick]").forEach(function(b) {
            b.onclick = function() {
                var k = b.dataset.qpick, d = null;
                if (k === "ball" && typeof Ball !== "undefined") d = UniversalInspect._ballDesc();
                else if (k === "flail0" && typeof Flail !== "undefined" && Flail.men[0]) d = UniversalInspect._flailDesc(Flail.men[0]);
                else if (k === "tank0" && typeof Tanks !== "undefined" && Tanks.tanks[0]) d = UniversalInspect._tankDesc(Tanks.tanks[0]);
                else if (k === "blob0" && typeof Cells !== "undefined" && Cells.blobs[0]) d = UniversalInspect._blobDesc(Cells.blobs[0]);
                else if (k === "worm0" && typeof Snake !== "undefined" && Snake.worms[0]) d = UniversalInspect._wormDesc(Snake.worms[0]);
                else if (k === "virus0" && typeof Cells !== "undefined" && Cells.viruses[0]) d = UniversalInspect._virusDesc(Cells.viruses[0]);
                else if (k === "p1" && typeof redGuy !== "undefined" && redGuy) d = UniversalInspect._charDesc(redGuy);
                else if (k === "p2" && typeof blueGuy !== "undefined" && blueGuy) d = UniversalInspect._charDesc(blueGuy);
                else if (k === "z0" && typeof zombies !== "undefined" && zombies[0]) d = UniversalInspect._charDesc(zombies[0]);
                if (d) { UniversalInspect.selected = d; self.render(); }
            };
        });

        var sel = typeof UniversalInspect !== "undefined" ? UniversalInspect.selected : null;
        if (sel && sel.obj) {
            var o = sel.obj;
            if (el("sb-in-follow")) el("sb-in-follow").onclick = function() {
                UniversalInspect.followTarget = (UniversalInspect.followTarget && UniversalInspect.followTarget.obj === o) ? null : sel;
                self.render();
            };
            if (el("sb-in-heal")) el("sb-in-heal").onclick = function() {
                if (sel.kind === "character" || sel.kind === "enemy") o.health = o.maxHealth;
                else if (sel.kind === "tank") o.hp = o.maxHp;
                else if (sel.kind === "blob" || sel.kind === "virus") o.m = (o.m || 50) + 100;
                else if (sel.kind === "worm") o.len += 80;
                else if (sel.kind === "ball") { Ball.x = 0; Ball.y = 420; Ball.vx = Ball.vy = 0; }
                self.render();
            };
            if (el("sb-in-yeet")) el("sb-in-yeet").onclick = function() {
                if (sel.kind === "character" || sel.kind === "enemy") { o.yspeed = 26; o.xspeed = (Math.random() - 0.5) * 28; }
                else if (sel.kind === "ball") { Ball.vx = (Math.random() < 0.5 ? -1 : 1) * 24; Ball.vy = 20; }
                else if (sel.kind === "ragdoll" || sel.kind === "flail") o.addVelocity((Math.random() - 0.5) * 20, 28);
                else if (o.vx !== undefined) { o.vx += (Math.random() - 0.5) * 18; o.vy = (o.vy || 0) - 10; }
            };
            if (el("sb-in-pos")) el("sb-in-pos").onclick = function() {
                if (typeof EntityTakeover !== "undefined") EntityTakeover.possess(o);
                self.render();
            };
            if (el("sb-in-freeze")) el("sb-in-freeze").onclick = function() {
                o._sbFrozen = !o._sbFrozen;
                if (o._sbFrozen) { var p = sel.pos(); o._sbPinX = p.x; o._sbPinY = p.y; }
                self.render();
            };
            if (el("sb-in-del")) el("sb-in-del").onclick = function() {
                if (sel.kind === "character" || sel.kind === "enemy" || sel.kind === "object") {
                    if (o !== redGuy) o.dead = true;
                } else if (sel.kind === "tank") o.alive = false;
                else if (sel.kind === "worm") o.alive = false;
                else if (sel.kind === "blob") o.m = 0;
                else if (sel.kind === "virus" && typeof Cells !== "undefined") {
                    var vi = Cells.viruses.indexOf(o); if (vi !== -1) Cells.viruses.splice(vi, 1);
                } else if (sel.kind === "ragdoll" && typeof Ragdolls !== "undefined") Ragdolls.remove(o);
                if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                UniversalInspect.selected = null;
                self.render();
            };

            var bindNum = function(id, fn) {
                var inp = el(id);
                if (inp) inp.onchange = function() { var v = Number(inp.value); if (!isNaN(v)) fn(v); };
            };
            bindNum("sb-ed-hp", function(v) { o.health = v; });
            bindNum("sb-ed-mhp", function(v) { o.maxHealth = Math.max(1, v); });
            bindNum("sb-ed-spd", function(v) { o.maxspeed = Math.max(1, v); });
            bindNum("sb-ed-sz", function(v) { o.s1 = o.s2 = Math.max(16, v); });
            bindNum("sb-ed-thp", function(v) { o.hp = v; });
            bindNum("sb-ed-tlvl", function(v) { o.lvl = Math.max(1, v); });
            bindNum("sb-ed-tpts", function(v) { o.pts = Math.max(0, v); });
            bindNum("sb-ed-mass", function(v) { o.m = Math.max(10, v); });
            bindNum("sb-ed-len", function(v) { o.len = Math.max(10, v); });
            bindNum("sb-ed-x", function(v) { o.x = v; if (o._sbFrozen) o._sbPinX = v; });
            bindNum("sb-ed-y", function(v) { o.y = v; if (o._sbFrozen) o._sbPinY = v; });
            bindNum("sb-ed-w", function(v) { o.w = Math.max(10, v); if (typeof rebuildAllObjects === "function") rebuildAllObjects(); });
            bindNum("sb-ed-h", function(v) { o.h = Math.max(10, v); if (typeof rebuildAllObjects === "function") rebuildAllObjects(); });
            bindNum("sb-ed-br", function(v) { Ball.r = Math.max(12, v); });
            if (el("sb-ed-col")) el("sb-ed-col").oninput = function(e) { o.col = e.target.value; };
            if (el("sb-ed-inv")) el("sb-ed-inv").onchange = function(e) { o._sbInv = e.target.checked; o.invulnTimer = e.target.checked ? 999999 : 0; };

            // Mode extra fields & actions
            if (sel.extra && sel.extra.fields) {
                this._root.querySelectorAll("[data-exf]").forEach(function(inp) {
                    var f = sel.extra.fields[Number(inp.dataset.exf)];
                    if (!f || !f.set) return;
                    inp.oninput = inp.onchange = function() {
                        f.set(isNaN(Number(inp.value)) ? inp.value : Number(inp.value));
                        self.render();
                    };
                });
            }
            if (sel.extra && sel.extra.actions) {
                this._root.querySelectorAll("[data-exa]").forEach(function(b) {
                    b.onclick = function() { sel.extra.actions[Number(b.dataset.exa)].fn(); self.render(); };
                });
            }

            // Raw Property Explorer
            if (el("sb-raw-det")) el("sb-raw-det").ontoggle = function(e) { self.rawOpen = e.target.open; };
            if (el("sb-raw-filter")) {
                var rf = el("sb-raw-filter");
                rf.oninput = function() { self.rawFilter = rf.value; self.render(); };
            }
            this._root.querySelectorAll("[data-rawk]").forEach(function(inp) {
                var k = inp.dataset.rawk;
                inp.onchange = function() {
                    if (inp.type === "checkbox") o[k] = inp.checked;
                    else if (typeof o[k] === "number") { var n = Number(inp.value); if (!isNaN(n)) o[k] = n; }
                    else o[k] = inp.value;
                };
            });
        }

        // Tools Tab
        this._root.querySelectorAll("[data-sbtool]").forEach(function(b) {
            b.onclick = function() { self.tool = b.dataset.sbtool; self.render(); };
        });
        if (el("sb-sel-allobj")) el("sb-sel-allobj").onclick = function() { self.selectAllObjects(); };
        if (el("sb-sel-allmob")) el("sb-sel-allmob").onclick = function() { self.selectAllEnemies(); };
        if (el("sb-sel-clear")) el("sb-sel-clear").onclick = function() { self.clearSelection(); self.render(); };
        if (el("sb-tl-swap")) el("sb-tl-swap").onclick = function() {
            if (!self.sendNet({ k: "swap" }) && typeof EntityTakeover !== "undefined") EntityTakeover.swapPlayers();
            self.render();
        };
        if (el("sb-tl-spawn")) el("sb-tl-spawn").onclick = function() { self.spawnerOpen = !self.spawnerOpen; self.render(); };
        if (el("sb-tl-roster")) el("sb-tl-roster").onclick = function() { self.rosterOpen = !self.rosterOpen; self.render(); };
        if (el("sb-tl-floor")) el("sb-tl-floor").onclick = function() {
            sandboxCfg.showFloor = !sandboxCfg.showFloor; saveSandboxCfg();
            if (typeof SandboxFloor !== "undefined") SandboxFloor.sync();
            self.render();
        };

        // Games Tab
        if (el("sb-gm-search")) {
            var gs = el("sb-gm-search");
            gs.oninput = function() { self.gameSearch = gs.value; self.render(); };
        }
        this._root.querySelectorAll("[data-gmlaunch]").forEach(function(b) {
            b.onclick = function() {
                if (self.sendNet({ k: "launch", id: b.dataset.gmlaunch })) {
                    self.pauseOpen = false;
                    self.render();
                    return;
                }
                if (typeof paused !== "undefined" && paused && typeof closePause === "function") closePause();
                GameModes.launch(b.dataset.gmlaunch);
                self.render();
            };
        });

        // Group Selection Inspector
        var grpAlive = self.selectedGroup.filter(function(it) { return it && !it.dead; });
        if (el("sb-grp-clear")) el("sb-grp-clear").onclick = function() { self.clearSelection(); self.render(); };
        if (el("sb-grp-snap")) el("sb-grp-snap").onclick = function() {
            grpAlive.forEach(function(it) {
                it.x = Math.round(it.x / 20) * 20; it.y = Math.round(it.y / 20) * 20;
                self.sendNet({ k: "moveObj", nid: it._nid, x: it.x, y: it.y });
            });
            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            self.render();
        };
        if (el("sb-grp-alignl")) el("sb-grp-alignl").onclick = function() {
            var minX = Math.min.apply(null, grpAlive.map(function(it) { return it.x - (it.w || it.s1 || 40) / 2; }));
            grpAlive.forEach(function(it) {
                it.x = minX + (it.w || it.s1 || 40) / 2;
                self.sendNet({ k: "moveObj", nid: it._nid, x: it.x, y: it.y });
            });
            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            self.render();
        };
        if (el("sb-grp-aligncx")) el("sb-grp-aligncx").onclick = function() {
            var avgX = grpAlive.reduce(function(s, it) { return s + it.x; }, 0) / grpAlive.length;
            grpAlive.forEach(function(it) {
                it.x = Math.round(avgX);
                self.sendNet({ k: "moveObj", nid: it._nid, x: it.x, y: it.y });
            });
            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            self.render();
        };
        if (el("sb-grp-alignt")) el("sb-grp-alignt").onclick = function() {
            var maxY = Math.max.apply(null, grpAlive.map(function(it) { return it.y + (it.h || it.s2 || 40) / 2; }));
            grpAlive.forEach(function(it) {
                it.y = maxY - (it.h || it.s2 || 40) / 2;
                self.sendNet({ k: "moveObj", nid: it._nid, x: it.x, y: it.y });
            });
            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            self.render();
        };
        if (el("sb-grp-dup")) el("sb-grp-dup").onclick = function() {
            var clones = [];
            grpAlive.forEach(function(it) {
                if (it.w !== undefined || it.h !== undefined) {
                    if (!self.sendNet({ k: "dupObj", nid: it._nid })) {
                        var c = GameObject.addBox(it.x + 40, it.y + 40, it.w || it.s1 || 80, it.h || it.s2 || 80, it.color || "#64748b", { name: it.name, texture: it.texture, kind: it.kind });
                        if (c) clones.push(c);
                    }
                } else if (typeof spawnZombie === "function") {
                    if (!self.sendNet({ k: "spawnZombie", pick: it.power || "NORMAL", x: it.x + 40, y: it.y + 40 })) {
                        var zc = spawnZombie(it.power || "NORMAL", it.x + 40, it.y + 40);
                        if (zc) clones.push(zc);
                    }
                }
            });
            if (clones.length) self.selectedGroup = clones;
            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            self.render();
        };
        if (el("sb-grp-del")) el("sb-grp-del").onclick = function() {
            grpAlive.forEach(function(it) {
                if (it === redGuy || it === blueGuy) return;
                if (!self.sendNet({ k: "delObj", nid: it._nid })) it.dead = true;
            });
            if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            self.clearSelection();
            self.render();
        };

        // Sandbox Right Inspector
        if (el("sb-insp-close")) el("sb-insp-close").onclick = function() { self.clearSelection(); self.render(); };
        if (el("sb-insp-del") && self.selectedObj) el("sb-insp-del").onclick = function() {
            if (!self.sendNet({ k: "delObj", nid: self.selectedObj._nid })) {
                self.selectedObj.dead = true;
                if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            }
            self.clearSelection();
            self.render();
        };
        if (el("sb-insp-dup") && self.selectedObj) el("sb-insp-dup").onclick = function() {
            var o = self.selectedObj;
            if (!self.sendNet({ k: "dupObj", nid: o._nid })) {
                GameObject.addBox(o.x + 50, o.y + 30, o.w || o.s1 || 80, o.h || o.s2 || 80, o.color || "#64748b", { name: o.name, texture: o.texture, kind: o.kind });
                if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            }
            self.render();
        };
        ["ix", "iy", "iw", "ih"].forEach(function(k) {
            var inp = el("sb-i" + k.slice(1));
            if (inp && self.selectedObj) inp.onchange = function() {
                var val = Number(inp.value);
                if (!isNaN(val)) {
                    var prop = k.slice(1);
                    if (prop === "w" || prop === "h") val = Math.max(10, val);
                    self.selectedObj[prop] = val;
                    var msg = { k: "moveObj", nid: self.selectedObj._nid };
                    msg[prop] = val;
                    if (!self.sendNet(msg)) {
                        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
                    }
                }
            };
        });

        // Roster
        if (el("sb-roster-add")) el("sb-roster-add").onclick = function() {
            var types = ["NORMAL", "LEAPER", "TANK", "KNIGHT", "MAGE", "BOSS_KING"];
            var pick = types[Math.floor(Math.random() * types.length)];
            var ref = redGuy || { x: 0, y: 120 };
            var sx = ref.x + (Math.random() - 0.5) * 300, sy = ref.y + 120;
            if (!self.sendNet({ k: "spawnZombie", pick: pick, x: sx, y: sy })) {
                if (typeof spawnZombie === "function") spawnZombie(pick, sx, sy);
            }
            self.render();
        };

        // Pie Ring
        if (el("sb-pie-pos")) el("sb-pie-pos").onclick = function() { EntityTakeover.possess(self.selectedEnt.ent, 0); self.piePos = null; self.render(); };
        if (el("sb-pie-pos2")) el("sb-pie-pos2").onclick = function() { EntityTakeover.possess(self.selectedEnt.ent, 1); self.piePos = null; self.render(); };
        if (el("sb-pie-fling")) el("sb-pie-fling").onclick = function() {
            if (!self.sendNet({ k: "fling", nid: self.selectedEnt.ent._nid })) self.selectedEnt.ent.yspeed = 26;
            self.piePos = null; self.render();
        };
        if (el("sb-pie-clone")) el("sb-pie-clone").onclick = function() {
            var e = self.selectedEnt.ent;
            if (!self.sendNet({ k: "spawnZombie", pick: e.power || "NORMAL", x: e.x + 60, y: e.y + 30 })) {
                if (typeof spawnZombie === "function") spawnZombie(e.power || "NORMAL", e.x + 60, e.y + 30);
            }
            self.piePos = null; self.render();
        };
        if (el("sb-pie-del")) el("sb-pie-del").onclick = function() {
            if (self.selectedEnt.ent !== redGuy && self.selectedEnt.ent !== blueGuy) {
                if (!self.sendNet({ k: "delObj", nid: self.selectedEnt.ent._nid })) self.selectedEnt.ent.dead = true;
            }
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
                var ref = (typeof GrappleHook !== "undefined" ? GrappleHook.activeTarget() : null) || { x: 0, y: 120 };
                if (!self.sendNet({ k: "spawn", id: self.selectedCatalogId, x: ref.x + 120, y: ref.y + 40 })) {
                    UniversalSpawner.spawnById(self.selectedCatalogId, ref.x + 120, ref.y + 40);
                }
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
            if (id && !self.sendNet({ k: "spawn", id: id, x: self.ctxMenu.wx, y: self.ctxMenu.wy })) {
                UniversalSpawner.spawnById(id, self.ctxMenu.wx, self.ctxMenu.wy);
            }
            self.ctxMenu = null; self.render();
        };
        if (el("sb-ctx-grapple")) el("sb-ctx-grapple").onclick = function() {
            GrappleHook.fire(GrappleHook.activeTarget(), self.ctxMenu.wx, self.ctxMenu.wy);
            self.ctxMenu = null; self.render();
        };
        if (el("sb-ctx-floor")) el("sb-ctx-floor").onclick = function() {
            sandboxCfg.showFloor = !sandboxCfg.showFloor; saveSandboxCfg();
            if (!self.sendNet({ k: "floor", v: sandboxCfg.showFloor }) && typeof SandboxFloor !== "undefined") SandboxFloor.sync();
            self.ctxMenu = null; self.render();
        };
        if (el("sb-ctx-clear")) el("sb-ctx-clear").onclick = function() {
            if (!self.sendNet({ k: "clearWorld" })) {
                for (var i = 0; i < staticObjects.length; i++) staticObjects[i].dead = true;
                for (var j = 0; j < movingObjects.length; j++) movingObjects[j].dead = true;
                for (var z = 0; z < zombies.length; z++) zombies[z].dead = true;
                if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            }
            self.ctxMenu = null; self.render();
        };

        // Pause menu
        this._root.querySelectorAll("[data-ptab]").forEach(function(b) {
            b.onclick = function() { self.pauseTab = b.dataset.ptab; self.render(); };
        });
        if (el("sb-p-resume")) el("sb-p-resume").onclick = function() {
            if (typeof Net !== "undefined" && Net.role === "client") { self.pauseOpen = false; self.render(); }
            else closePause();
        };
        if (el("sb-p-floor")) el("sb-p-floor").onchange = function(e) {
            sandboxCfg.showFloor = e.target.checked; saveSandboxCfg();
            if (!self.sendNet({ k: "floor", v: sandboxCfg.showFloor }) && typeof SandboxFloor !== "undefined") SandboxFloor.sync();
        };
        if (el("sb-p-noclip")) el("sb-p-noclip").onchange = function(e) {
            sandboxCfg.noclip = e.target.checked; saveSandboxCfg();
            self.sendNet({ k: "noclip", v: sandboxCfg.noclip });
        };
        if (el("sb-p-inv")) el("sb-p-inv").onchange = function(e) {
            sandboxCfg.invincible = e.target.checked; saveSandboxCfg();
            self.sendNet({ k: "god", v: sandboxCfg.invincible });
        };
        if (el("sb-p-grav")) el("sb-p-grav").oninput = function(e) {
            devOpts.gravityMult = Number(e.target.value);
            self.sendNet({ k: "grav", v: devOpts.gravityMult });
            self.render();
        };
        if (el("sb-p-clear")) el("sb-p-clear").onclick = function() {
            if (!self.sendNet({ k: "clearWorld" })) {
                for (var i = 0; i < staticObjects.length; i++) staticObjects[i].dead = true;
                for (var z = 0; z < zombies.length; z++) zombies[z].dead = true;
                if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            }
            if (typeof Net !== "undefined" && Net.role === "client") { self.pauseOpen = false; self.render(); } else closePause();
        };
        if (el("sb-p-horde")) el("sb-p-horde").onclick = function() {
            if (!self.sendNet({ k: "horde" })) {
                var ref = redGuy || { x: 0, y: 120 };
                for (var i = 0; i < 6; i++) spawnZombie(null, ref.x + (i % 2 ? 1 : -1) * (400 + i * 70), ref.y + 180);
            }
            if (typeof Net !== "undefined" && Net.role === "client") { self.pauseOpen = false; self.render(); } else closePause();
        };
        if (el("sb-p-swap")) el("sb-p-swap").onclick = function() {
            if (!self.sendNet({ k: "swap" }) && typeof EntityTakeover !== "undefined") EntityTakeover.swapPlayers();
            if (typeof Net !== "undefined" && Net.role === "client") { self.pauseOpen = false; self.render(); } else closePause();
        };
        if (el("sb-p-eject")) el("sb-p-eject").onclick = function() { EntityTakeover.release(false); closePause(); };
        if (el("sb-p-roster")) el("sb-p-roster").onclick = function() {
            if (typeof Net !== "undefined" && Net.role === "client") self.pauseOpen = false; else closePause();
            self.rosterOpen = true; self.render();
        };
        if (el("sb-p-hub")) el("sb-p-hub").onclick = function() {
            if (typeof Net !== "undefined" && Net.role === "client") {
                self.pauseOpen = false; self.sideOpen = true; self.sideTab = "games"; self.render();
            } else { closePause(); Hub.openHub(false); }
        };
        if (el("sb-p-reset")) el("sb-p-reset").onclick = function() {
            if (self.sendNet({ k: "resetBlank" })) { self.pauseOpen = false; self.render(); return; }
            closePause(); LevelManager.selectLevel("sandbox_blank");
        };
        if (el("sb-p-leave")) el("sb-p-leave").onclick = function() { self.pauseOpen = false; self.render(); if (typeof Net !== "undefined") Net.disconnect(); };
        if (el("sb-p-leave2")) el("sb-p-leave2").onclick = function() { self.pauseOpen = false; self.render(); if (typeof Net !== "undefined") Net.disconnect(); };

        // Admin Tab (Side Drawer & Pause Menu)
        if (el("sb-adm-boss")) el("sb-adm-boss").onclick = function() {
            if (!self.sendNet({ k: "admin", cmd: "spawnBoss" }) && typeof spawnZombie === "function") {
                var ref = redGuy || { x: 0, y: 120 }; spawnZombie("BOSS_KING", ref.x + 240, ref.y + 120);
            }
        };
        if (el("sb-adm-horde")) el("sb-adm-horde").onclick = function() {
            if (!self.sendNet({ k: "horde" }) && typeof spawnZombie === "function") {
                var ref = redGuy || { x: 0, y: 120 };
                for (var i = 0; i < 6; i++) spawnZombie(null, ref.x + (i % 2 ? 1 : -1) * (400 + i * 70), ref.y + 180);
            }
        };
        if (el("sb-adm-heal")) el("sb-adm-heal").onclick = function() {
            if (!self.sendNet({ k: "healAll" }) && typeof DevActions !== "undefined") DevActions.healAll();
        };
        if (el("sb-adm-respawn")) el("sb-adm-respawn").onclick = function() {
            if (!self.sendNet({ k: "admin", cmd: "respawnAll" })) {
                for (var i = 0; i < characters.length; i++) { characters[i].dead = false; characters[i].health = characters[i].maxHealth; characters[i].invulnTimer = 90; }
                if (typeof Net !== "undefined" && Net.role === "host") for (var pk in Net.peers) if (!Net.peers[pk].ch || Net.peers[pk].ch.dead) Net.spawnRemoteHero(Net.peers[pk]);
            }
        };
        if (el("sb-adm-clearfoe")) el("sb-adm-clearfoe").onclick = function() {
            if (!self.sendNet({ k: "clearEnemies" }) && typeof DevActions !== "undefined") DevActions.clearEnemies();
        };
        if (el("sb-adm-clearworld")) el("sb-adm-clearworld").onclick = function() {
            if (!self.sendNet({ k: "clearWorld" })) {
                for (var i = 0; i < staticObjects.length; i++) staticObjects[i].dead = true;
                for (var j = 0; j < movingObjects.length; j++) movingObjects[j].dead = true;
                for (var z = 0; z < zombies.length; z++) zombies[z].dead = true;
                if (typeof rebuildAllObjects === "function") rebuildAllObjects();
            }
        };
        if (el("sb-adm-god")) el("sb-adm-god").onchange = function(e) {
            var v = e.target.checked;
            if (typeof godMode !== "undefined") godMode = v;
            if (typeof arenaCheats !== "undefined") arenaCheats.god = v;
            if (typeof sandboxCfg !== "undefined") sandboxCfg.invincible = v;
            if (typeof creativeCfg !== "undefined") creativeCfg.invincible = v;
            self.sendNet({ k: "god", v: v });
        };
        if (el("sb-adm-ammo")) el("sb-adm-ammo").onchange = function(e) {
            if (typeof settings !== "undefined") { settings.ammo = e.target.checked ? "unlimited" : "limited"; if (typeof saveSettings === "function") saveSettings(); }
            self.sendNet({ k: "ammo", v: e.target.checked });
        };
        if (el("sb-adm-grav")) el("sb-adm-grav").oninput = function(e) {
            devOpts.gravityMult = Number(e.target.value);
            self.sendNet({ k: "grav", v: devOpts.gravityMult });
            var st = e.target.previousElementSibling && e.target.previousElementSibling.querySelector("strong");
            if (st) st.textContent = devOpts.gravityMult.toFixed(1) + "x";
        };
        this._root.querySelectorAll("[data-admresp]").forEach(function(b) {
            b.onclick = function() {
                var pid = Number(b.dataset.admresp);
                if (!self.sendNet({ k: "admin", cmd: "respawnPeer", pid: pid }) && typeof Net !== "undefined" && Net.role === "host") {
                    Net.hostExecSandbox(pid, { k: "admin", cmd: "respawnPeer", pid: pid });
                }
            };
        });
        if (el("sb-adm-leave")) el("sb-adm-leave").onclick = function() {
            self.pauseOpen = false; self.sideOpen = false; self.render();
            if (typeof Net !== "undefined") Net.disconnect();
        };
    },

    drawOverlay: function() {
        if (!this.isSandbox() || typeof ctx === "undefined" || typeof sbWorldToScreen !== "function") return;
        var items = this.selectedGroup.length ? this.selectedGroup : (this.selectedObj ? [this.selectedObj] : []);
        if (!items.length) return;
        ctx.save();
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it || it.dead) continue;
            var w = (it.w || it.s1 || 40) * (typeof camZoom !== "undefined" ? camZoom : 1);
            var h = (it.h || it.s2 || 40) * (typeof camZoom !== "undefined" ? camZoom : 1);
            var p = sbWorldToScreen(it.x, it.y);
            ctx.strokeRect(p.x - w / 2 - 4, p.y - h / 2 - 4, w + 8, h + 8);
        }
        ctx.restore();
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() { SandboxUI.init(); });
} else {
    SandboxUI.init();
}
