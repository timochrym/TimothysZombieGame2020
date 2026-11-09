class SummonManager {

    static init() {
        this.isOpen = false;
        this.toolMode = "shoot"; // "shoot" | "place" | "select"
        this.spawnType = "box";
        this.spawnW = 480;
        this.spawnH = 80;
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

        // Presets are authored at the 2x structure scale
        this.presets = {
            "box": { w: 480, h: 160, color: "#b84a27", texture: "brick", label: "Solid Block" },
            "grass_box": { w: 640, h: 80, color: "#7f4f24", texture: "grass_dirt", label: "Grass Platform" },
            "platform": { w: 480, h: 80, color: "#2b3a4a", texture: "lab_metal", label: "One-way Platform" },
            "wall": { w: 80, h: 480, color: "#4a5568", texture: "castle_stone", label: "Wall" },
            "ramp_right": { w: 480, h: 320, color: "#6c3c28", texture: "dojo_wood", label: "Stairs /" },
            "ramp_left": { w: 480, h: 320, color: "#6c3c28", texture: "dojo_wood", label: "Stairs \\" },
            "slope_right": { w: 480, h: 240, color: "#7f4f24", texture: "grass_dirt", label: "Slope /" },
            "slope_left": { w: 480, h: 240, color: "#7f4f24", texture: "grass_dirt", label: "Slope \\" },
            "slide_right": { w: 480, h: 240, color: "#38bdf8", texture: "solid", label: "Slide /" },
            "slide_left": { w: 480, h: 240, color: "#38bdf8", texture: "solid", label: "Slide \\" },
            "bumper": { w: 240, h: 80, color: "#ff2e63", texture: "solid", bounce: 24, label: "Bounce Pad" },
            "crate": { w: 80, h: 80, color: "#d9a05b", texture: "crate_plank", label: "Wooden Crate" },
            "tnt": { w: 80, h: 80, color: "#e84545", texture: "solid", label: "TNT Barrel" },
            "bouncy_cube": { w: 80, h: 80, color: "#00f5d4", texture: "neon_grid", label: "Bouncy Cube" },
            "zombie": { w: 80, h: 80, color: "#2d6e32", texture: "solid", label: "Enemy" },
            "powerup": { w: 56, h: 56, color: "#ffdd33", texture: "question_gold", label: "Power-Up" }
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
            for (let i = 0; i < characters.length; i++) if (godMode && characters[i].isZombie) characters[i].reviveAsHuman();
            redGuy.health = redGuy.maxHealth;
            redGuy.jetpackFuel = redGuy.jetpackMaxFuel;
            Components.addFloatingText(godMode ? "GOD MODE ACTIVATED!" : "GOD MODE OFF", redGuy.x, redGuy.y + 80, "#ffdd00", 24);
        }
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

    static refreshLevelDropdown() {
        var sel = document.getElementById("level-select-dropdown");
        if (!sel || typeof LevelManager === "undefined") return;
        var all = LevelManager.getAllLevels();
        var html = "";
        var modeId = (typeof GameModes !== "undefined" && GameModes.current) ? GameModes.current.id : "survival";
        for (var k in all) {
            if (typeof GameModes !== "undefined" && GameModes.modeOf(all[k]) !== modeId) continue;
            var selected = (k === LevelManager.currentLevelKey) ? "selected" : "";
            html += `<option value="${k}" ${selected}>${all[k].name}</option>`;
        }
        sel.innerHTML = html;
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
