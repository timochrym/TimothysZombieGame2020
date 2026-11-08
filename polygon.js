class TextureManager {

    static init() {
        this.patterns = {};
        this.canvases = {};
        this.buildAllPatterns();
    }

    static createTileCanvas(w, h, drawFn) {
        var c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        var tctx = c.getContext("2d");
        tctx.imageSmoothingEnabled = false;
        drawFn(tctx, w, h);
        return c;
    }

    static buildAllPatterns() {
        // 1. Clean, cohesive Brick (subtle mortar, easy on the eyes)
        this.canvases["brick"] = this.createTileCanvas(32, 32, function(g) {
            g.fillStyle = "#9e3b24";
            g.fillRect(0, 0, 32, 32);
            g.fillStyle = "#b0462d";
            g.fillRect(2, 2, 12, 11);
            g.fillRect(18, 2, 12, 11);
            g.fillRect(10, 18, 14, 11);
            g.fillStyle = "#6e2615";
            g.fillRect(0, 15, 32, 2);
            g.fillRect(0, 31, 32, 1);
            g.fillRect(15, 0, 2, 15);
            g.fillRect(7, 17, 2, 14);
        });

        // 2. Clean Overworld Earth & Turf (warm, low-noise soil)
        this.canvases["grass_dirt"] = this.createTileCanvas(32, 32, function(g) {
            g.fillStyle = "#5c3d28";
            g.fillRect(0, 0, 32, 32);
            g.fillStyle = "#66452e";
            g.fillRect(0, 0, 16, 16);
            g.fillRect(16, 16, 16, 16);
        });

        // 3. Fortress & Cavern Stone (smooth slate masonry)
        this.canvases["castle_stone"] = this.createTileCanvas(32, 32, function(g) {
            g.fillStyle = "#3b4454";
            g.fillRect(0, 0, 32, 32);
            g.fillStyle = "#465063";
            g.fillRect(2, 2, 13, 12);
            g.fillRect(18, 2, 12, 12);
            g.fillRect(8, 18, 16, 12);
            g.fillStyle = "#282f3b";
            g.fillRect(0, 15, 32, 2);
            g.fillRect(0, 31, 32, 1);
            g.fillRect(16, 0, 2, 15);
        });

        // 4. Ancient Tech / Dungeon Iron
        this.canvases["lab_metal"] = this.createTileCanvas(32, 32, function(g) {
            g.fillStyle = "#263340";
            g.fillRect(0, 0, 32, 32);
            g.strokeStyle = "#344657";
            g.lineWidth = 2;
            g.strokeRect(2, 2, 28, 28);
        });

        // 5. Timber & Bridge Planks
        this.canvases["dojo_wood"] = this.createTileCanvas(32, 32, function(g) {
            g.fillStyle = "#6e472b";
            g.fillRect(0, 0, 32, 32);
            g.fillStyle = "#7a5032";
            g.fillRect(0, 3, 32, 10);
            g.fillRect(0, 19, 32, 10);
            g.fillStyle = "#4d301b";
            g.fillRect(0, 15, 32, 2);
            g.fillRect(0, 31, 32, 1);
        });

        // 6. Shimmering Water / Arcane Crystal
        this.canvases["neon_grid"] = this.createTileCanvas(32, 32, function(g) {
            g.fillStyle = "#124e78";
            g.fillRect(0, 0, 32, 32);
            g.fillStyle = "#1a659e";
            g.fillRect(0, 4, 32, 8);
            g.fillRect(0, 20, 32, 6);
        });

        // 7. Gold Treasure / Relic Trim
        this.canvases["question_gold"] = this.createTileCanvas(32, 32, function(g) {
            g.fillStyle = "#d99b26";
            g.fillRect(0, 0, 32, 32);
            g.fillStyle = "#f2b84b";
            g.fillRect(3, 3, 26, 26);
            g.strokeStyle = "#8c5e0a";
            g.lineWidth = 2;
            g.strokeRect(1, 1, 30, 30);
        });

        // 8. Wooden Supply Crate
        this.canvases["crate_plank"] = this.createTileCanvas(32, 32, function(g) {
            g.fillStyle = "#b07d4f";
            g.fillRect(0, 0, 32, 32);
            g.strokeStyle = "#6e4b2a";
            g.lineWidth = 2.5;
            g.strokeRect(1.5, 1.5, 29, 29);
            g.beginPath();
            g.moveTo(2, 2);
            g.lineTo(30, 30);
            g.stroke();
        });
    }

    static getPattern(name) {
        if (!name || name == "solid") return null;
        if (!this.canvases) this.init();
        var tile = this.canvases[name];
        if (!tile) return null;

        if (!this.patterns[name]) {
            this.patterns[name] = ctx.createPattern(tile, "repeat");
        }
        var pat = this.patterns[name];
        if (pat && typeof DOMMatrix !== "undefined") {
            var stateKey = Math.round(xc * 10) + "_" + Math.round(yc * 10) + "_" + cameraScaleX;
            if (pat._lastTransformKey !== stateKey) {
                pat._lastTransformKey = stateKey;
                var periodX = 32 * cameraScaleX;
                var periodY = 32 * cameraScaleY;
                var modX = ((xc % periodX) + periodX) % periodX;
                var modY = ((yc % periodY) + periodY) % periodY;
                if (!this._sharedMatrix) this._sharedMatrix = new DOMMatrix();
                this._sharedMatrix.a = cameraScaleX;
                this._sharedMatrix.b = 0;
                this._sharedMatrix.c = 0;
                this._sharedMatrix.d = cameraScaleY;
                this._sharedMatrix.e = modX;
                this._sharedMatrix.f = modY;
                pat.setTransform(this._sharedMatrix);
            }
        }
        return pat;
    }
}

// ============================================================================
// CLEAN ATMOSPHERIC PARALLAX BACKGROUND & RECESSED INTERIOR BACK-WALLS
// Calm, muted depth layers so foreground gameplay, enemies, and castles pop!
// ============================================================================
class BackgroundMosaic {

    static init() {
        this.layers = {};
        this.bgProps = []; // Non-colliding background trees & scenery
        this.bgWalls = []; // Recessed interior background walls for castles, houses & caves
        this.buildMosaicLayers();
    }

    static buildMosaicLayers() {
        // Layer 1: Soft Distant Mountain Range (800x360 repeating strip, muted twilight tones)
        this.layers.farMountains = TextureManager.createTileCanvas(800, 360, function(g, w, h) {
            var peaks = [
                { cx: 160, w: 380, topY: 90,  color: "#142433" },
                { cx: 460, w: 440, topY: 50,  color: "#17293b" },
                { cx: 700, w: 320, topY: 120, color: "#12202e" }
            ];
            for (let p = 0; p < peaks.length; p++) {
                var pk = peaks[p];
                g.fillStyle = pk.color;
                g.beginPath();
                g.moveTo(pk.cx - pk.w / 2, h);
                g.lineTo(pk.cx, pk.topY);
                g.lineTo(pk.cx + pk.w / 2, h);
                g.closePath();
                g.fill();
            }
        });

        // Layer 2: Soft Mid-Horizon Rolling Hills & Distant Watchtowers (800x260)
        this.layers.midHills = TextureManager.createTileCanvas(800, 260, function(g, w, h) {
            g.fillStyle = "#19303d";
            g.fillRect(0, 140, w, 120);
            g.beginPath();
            g.arc(200, 150, 180, Math.PI, 0);
            g.arc(600, 160, 220, Math.PI, 0);
            g.fill();

            // Subtle distant castle silhouette
            g.fillStyle = "#152833";
            g.fillRect(540, 45, 70, 95);
            g.fillRect(530, 30, 22, 110);
            g.fillRect(598, 30, 22, 110);
        });
    }

    static draw(ctx) {
        if (!this.layers || !this.layers.farMountains) this.init();

        var totalWorldX = (typeof cameraTargetX !== "undefined" ? cameraTargetX : 0) +
                          (typeof worldOriginOffsetX !== "undefined" ? worldOriginOffsetX : 0);

        // 0. Clean Cached Atmospheric Sky Gradient (zero per-frame allocation!)
        if (!this._skyGrad || this._skyGradH !== canvas.height) {
            this._skyGradH = canvas.height;
            this._skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            this._skyGrad.addColorStop(0, "#0d1b2a");
            this._skyGrad.addColorStop(0.65, "#1b2e3c");
            this._skyGrad.addColorStop(1, "#0f1e26");
        }
        ctx.fillStyle = this._skyGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        var horizonScreenY = Math.min(canvas.height - 40, Math.max(200, yc + 40 * cameraScaleY));

        // 1. Far Mountains (0.12x parallax rate)
        var mtnTile = this.layers.farMountains;
        var mtnOffX = -((totalWorldX * 0.12) % mtnTile.width + mtnTile.width) % mtnTile.width;
        var mtnY = Math.round(horizonScreenY - mtnTile.height + 60);
        for (let x = mtnOffX; x < canvas.width; x += mtnTile.width) {
            ctx.drawImage(mtnTile, Math.round(x), mtnY);
        }

        // 2. Mid Hills (0.28x parallax rate)
        var midTile = this.layers.midHills;
        var midOffX = -((totalWorldX * 0.28) % midTile.width + midTile.width) % midTile.width;
        var midY = Math.round(horizonScreenY - midTile.height + 70);
        for (let x = midOffX; x < canvas.width; x += midTile.width) {
            ctx.drawImage(midTile, Math.round(x), midY);
        }

        // 3. Fill below horizon with dark subterranean cavern backdrop so going underground feels deep!
        if (horizonScreenY < canvas.height) {
            ctx.fillStyle = "#0a121a";
            ctx.fillRect(0, horizonScreenY, canvas.width, canvas.height - horizonScreenY);
        }

        // 4. Draw World-Anchored Background Trees (muted tones so they never clutter gameplay)
        this.drawBackgroundTrees(ctx);

        // 5. Draw Recessed Interior Background Walls (inside Castles, Houses, Bridges & Caverns)
        this.drawInteriorBackWalls(ctx);
    }

    static addBackgroundTree(worldX, groundTopY, height = 180, style = "oak", chunkIdx = null) {
        if (!this.bgProps) this.init();
        this.bgProps.push({
            x: worldX,
            y: groundTopY,
            h: height,
            style: style,
            chunkIdx: chunkIdx
        });
    }

    static addInteriorBackWall(leftX, bottomY, w, h, style = "castle", chunkIdx = null) {
        if (!this.bgWalls) this.init();
        this.bgWalls.push({
            x: leftX + w / 2,
            y: bottomY + h / 2,
            w: w,
            h: h,
            style: style,
            chunkIdx: chunkIdx
        });
    }

    static drawInteriorBackWalls(ctx) {
        if (!this.bgWalls || this.bgWalls.length === 0) return;
        ctx.save();
        for (let i = 0; i < this.bgWalls.length; i++) {
            var bw = this.bgWalls[i];
            var sx = (bw.x - bw.w / 2) * cameraScaleX + xc;
            var sw = bw.w * cameraScaleX;
            if (sx + sw < -40 || sx > canvas.width + 40) continue;

            var sy = (-bw.y - bw.h / 2) * cameraScaleY + yc;
            var sh = bw.h * cameraScaleY;
            if (sy + sh < -40 || sy > canvas.height + 40) continue;

            var visX = Math.max(0, sx);
            var visY = Math.max(0, sy);
            var visW = Math.min(canvas.width, sx + sw) - visX;
            var visH = Math.min(canvas.height, sy + sh) - visY;
            if (visW <= 0 || visH <= 0) continue;

            if (bw.style === "castle") {
                ctx.fillStyle = "#181e29";
                ctx.fillRect(visX, visY, visW, visH);
                ctx.strokeStyle = "rgba(255,255,255,0.06)";
                ctx.lineWidth = 2;
                ctx.strokeRect(sx, sy, sw, sh);
            } else if (bw.style === "wood") {
                ctx.fillStyle = "#261810";
                ctx.fillRect(visX, visY, visW, visH);
            } else if (bw.style === "cavern") {
                ctx.fillStyle = "#0d1520";
                ctx.fillRect(visX, visY, visW, visH);
            }
        }
        ctx.restore();
    }

    static drawBackgroundTrees(ctx) {
        if (!this.bgProps || this.bgProps.length === 0) return;
        ctx.save();
        for (let i = 0; i < this.bgProps.length; i++) {
            var t = this.bgProps[i];
            var sx = t.x * cameraScaleX + xc;
            if (sx < -180 || sx > canvas.width + 180) continue;

            var baseSy = -t.y * cameraScaleY + yc;
            var trunkW = 28 * cameraScaleX;
            var trunkH = t.h * cameraScaleY;

            // Muted dark bark & foliage so background trees sit calmly behind the action
            ctx.fillStyle = "rgba(52, 34, 22, 0.75)";
            ctx.fillRect(sx - trunkW / 2, baseSy - trunkH, trunkW, trunkH);

            var cY = baseSy - trunkH;
            if (t.style === "pine") {
                for (let k = 0; k < 3; k++) {
                    var tw = (136 - k * 34) * cameraScaleX;
                    var th = 42 * cameraScaleY;
                    var ty = cY - k * 30 * cameraScaleY;
                    ctx.fillStyle = (k % 2 === 0) ? "rgba(27, 67, 50, 0.78)" : "rgba(45, 106, 79, 0.78)";
                    ctx.fillRect(sx - tw / 2, ty - th, tw, th);
                }
            } else {
                var w1 = 156 * cameraScaleX, h1 = 42 * cameraScaleY;
                var w2 = 112 * cameraScaleX, h2 = 36 * cameraScaleY;
                ctx.fillStyle = "rgba(24, 58, 45, 0.78)";
                ctx.fillRect(sx - w1 / 2, cY - h1 + 8 * cameraScaleY, w1, h1);
                ctx.fillStyle = "rgba(38, 84, 65, 0.78)";
                ctx.fillRect(sx - w2 / 2, cY - h1 - h2 + 14 * cameraScaleY, w2, h2);
            }
        }
        ctx.restore();
    }
}

class Polygon {

    static create(poly, color, object, offsetY = 0) {
        if (!poly || poly.length === 0) return;

        var ox = object ? object.x : 0;
        var oy = object ? object.y : 0;
        var halfW = (object && object.w) ? object.w * 0.6 : 200;
        var halfH = (object && object.h) ? object.h * 0.6 : 200;
        var screenLeft = (ox - halfW) * cameraScaleX + xc;
        var screenRight = (ox + halfW) * cameraScaleX + xc;
        var screenTop = (-oy - halfH - offsetY) * cameraScaleY + yc;
        var screenBottom = (-oy + halfH - offsetY) * cameraScaleY + yc;
        if (screenRight < -60 || screenLeft > canvas.width + 60 || screenBottom < -60 || screenTop > canvas.height + 60) {
            return;
        }

        ctx.save();
        var pat = (object && object.texture) ? TextureManager.getPattern(object.texture) : null;
        ctx.fillStyle = pat ? pat : color;
        ctx.beginPath();

        var startX = Math.round(((poly[0][0] + ox) * cameraScaleX + xc) * rounder) / rounder;
        var startY = Math.round(((-poly[0][1] - oy - offsetY) * cameraScaleY + yc) * rounder) / rounder;
        ctx.moveTo(startX, startY);

        for (let item = 1; item < poly.length; item += 1) {
            var px = Math.round(((poly[item][0] + ox) * cameraScaleX + xc) * rounder) / rounder;
            var py = Math.round(((-poly[item][1] - oy - offsetY) * cameraScaleY + yc) * rounder) / rounder;
            ctx.lineTo(px, py);
        }

        ctx.closePath();
        ctx.fill();

        if (object && (object.texture || object.isRamp || object.movable) && !(object instanceof Character)) {
            ctx.strokeStyle = object.texture == "neon_grid" ? "#00b4d8" : "rgba(0, 0, 0, 0.5)";
            ctx.lineWidth = Math.max(1.5, 2 * cameraScaleX);
            ctx.stroke();

            if (object.texture == "grass_dirt" && !object.isRamp) {
                var b = CollisionDetector.getBounds(object);
                var gx = Math.max(-20, b.left * cameraScaleX + xc);
                var gr = Math.min(canvas.width + 20, b.right * cameraScaleX + xc);
                var gy = -b.top * cameraScaleY + yc;
                if (gr > gx) {
                    ctx.fillStyle = "#40916c";
                    ctx.fillRect(gx, gy, gr - gx, Math.max(4, 7 * cameraScaleY));
                }
            }
        }
        ctx.restore();
    }

    static rotate(poly, anchorPoint, degree) {
        this.anchorPointX = anchorPoint[0];
        this.anchorPointY = anchorPoint[1];
        this.newPoly = [];

        for (let point = 0; point < poly.length; point += 1) {
            this.pointX = poly[point][0];
            this.pointY = poly[point][1];

            this.a = this.pointY - this.anchorPointY;
            this.b = this.pointX - this.anchorPointX;
            this.c = Math.sqrt(Math.pow(this.a, 2) + Math.pow(this.b, 2));

            this.radius = this.c;

            this.orginalDegree = Math.degrees(Math.atan2(this.b, this.a));
            this.newDegree = this.orginalDegree + degree;
            this.reverseDegree = 90 - this.newDegree;

            this.a2 = Math.cos(Math.radians(this.reverseDegree)) * this.radius;
            this.b2 = Math.sin(Math.radians(this.reverseDegree)) * this.radius;

            this.x = this.a2;
            this.y = this.b2;

            this.newPoly.push([this.x, this.y]);
        }

        return this.newPoly;
    }
}
