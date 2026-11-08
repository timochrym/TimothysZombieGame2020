class Pathfinder {

    static init() {
        this.nodes = [];
        this.solidBlockers = [];
        this.showDebug = false;
        this.lastRebuildCenterX = 0;
        this.lastRebuildCenterY = 0;
        this.lastRebuildTime = 0;
        this.rebuildGraph(true);
    }

    static refreshSolidBlockers(centerX, centerY, radX, radY) {
        this.solidBlockers = [];
        if (typeof staticObjects === "undefined") return;
        for (let i = 0; i < staticObjects.length; i++) {
            var st = staticObjects[i];
            if (!st || st.dead || st.noCollide || st.isRamp) continue;
            if (CollisionDetector.isSemiSolidPlatform(st)) continue;
            var hw = (st.w || 40) * 0.5;
            var hh = (st.h || 40) * 0.5;
            if (st.x + hw < centerX - radX || st.x - hw > centerX + radX) continue;
            if (st.y + hh < centerY - radY || st.y - hh > centerY + radY) continue;
            this.solidBlockers.push(st);
        }
    }

    // Ultra-fast zero-allocation swept clearance check against solid blockers
    static hasLineClearance(x1, y1, x2, y2) {
        var blockers = this.solidBlockers || staticObjects;
        if (!blockers || blockers.length === 0) return true;
        var samples = 4;
        var halfW = 16;
        var halfH = 22;

        for (let s = 1; s < samples; s++) {
            var t = s / samples;
            var px = x1 + (x2 - x1) * t;
            var py = (y1 + (y2 - y1) * t) + 30;

            for (let i = 0; i < blockers.length; i++) {
                var st = blockers[i];
                if (st.dead || st.noCollide || st.isRamp) continue;
                var shw = (st.w || 40) * 0.5;
                var shh = (st.h || 40) * 0.5;
                if (Math.abs(px - st.x) < halfW + shw && Math.abs(py - st.y) < halfH + shh) {
                    return false;
                }
            }
        }
        return true;
    }

    static isPointBlocked(wx, wy, w = 44, h = 56, ignoreId = -1) {
        var blockers = this.solidBlockers || staticObjects;
        if (!blockers) return false;
        var hw = w * 0.5;
        var hh = h * 0.5;
        for (let i = 0; i < blockers.length; i++) {
            var st = blockers[i];
            if (st.dead || st.noCollide || st.id === ignoreId || st.isRamp) continue;
            var shw = (st.w || 40) * 0.5;
            var shh = (st.h || 40) * 0.5;
            if (Math.abs(wx - st.x) < hw + shw && Math.abs(wy - st.y) < hh + shh) {
                return true;
            }
        }
        return false;
    }

    static rebuildGraph(force = false) {
        if (typeof staticObjects === "undefined") return;
        var now = Date.now();
        if (!force && now - (this.lastRebuildTime || 0) < 250 && this.nodes && this.nodes.length > 0) {
            return;
        }
        this.lastRebuildTime = now;
        this.nodes = [];

        var centerX = (typeof cameraTargetX !== "undefined") ? cameraTargetX : 0;
        var centerY = (typeof cameraTargetY !== "undefined") ? cameraTargetY : 0;
        this.lastRebuildCenterX = centerX;
        this.lastRebuildCenterY = centerY;

        var rawNodes = [];
        var step = 140;
        var windowRadiusX = 1500;
        var windowRadiusY = 1050;

        this.refreshSolidBlockers(centerX, centerY, windowRadiusX + 300, windowRadiusY + 300);

        for (let i = 0; i < staticObjects.length; i++) {
            var s = staticObjects[i];
            if (s.dead || s.noCollide) continue;
            var b = CollisionDetector.getBounds(s);
            var w = b.right - b.left;
            var h = b.top - b.bottom;

            // Skip tall boundary walls that cannot be stood on
            if (h > 520 && w <= 120) continue;
            // Skip surfaces far outside the vertical camera window
            if (b.top < centerY - windowRadiusY || b.bottom > centerY + windowRadiusY) continue;

            // Clamp very wide floors (like the main ground or infinite base floor) to the active camera region
            var clampedLeft = Math.max(centerX - windowRadiusX, b.left);
            var clampedRight = Math.min(centerX + windowRadiusX, b.right);
            if (clampedRight <= clampedLeft) continue;

            if (s.isRamp) {
                var steps = Math.max(2, Math.ceil(w / step));
                for (let k = 0; k <= steps; k++) {
                    var t = k / steps;
                    var nx = b.left + t * w;
                    var ny = (s.rampDir == "left") ? (b.top - t * h) : (b.bottom + t * h);
                    rawNodes.push({
                        x: nx,
                        y: ny,
                        isRamp: true,
                        rampDir: s.rampDir,
                        isRampTop: (s.rampDir == "right" && k === steps) || (s.rampDir == "left" && k === 0),
                        isRampBottom: (s.rampDir == "right" && k === 0) || (s.rampDir == "left" && k === steps),
                        isLeftEdge: k === 0,
                        isRightEdge: k === steps,
                        platLeft: b.left,
                        platRight: b.right,
                        isBumper: false,
                        sourceId: s.id,
                        edges: []
                    });
                }
            } else {
                var usableLeft = clampedLeft + 24;
                var usableRight = clampedRight - 24;
                if (usableRight < usableLeft) {
                    var mid = (clampedLeft + clampedRight) / 2;
                    rawNodes.push({
                        x: mid,
                        y: b.top,
                        isRamp: false,
                        isLeftEdge: true,
                        isRightEdge: true,
                        platLeft: b.left,
                        platRight: b.right,
                        isBumper: !!s.isBumper,
                        sourceId: s.id,
                        edges: []
                    });
                } else {
                    var count = Math.max(1, Math.round((usableRight - usableLeft) / step));
                    for (let k = 0; k <= count; k++) {
                        var px = usableLeft + (usableRight - usableLeft) * (k / count);
                        rawNodes.push({
                            x: px,
                            y: b.top,
                            isRamp: false,
                            isLeftEdge: (k === 0 && Math.abs(clampedLeft - b.left) < 10),
                            isRightEdge: (k === count && Math.abs(clampedRight - b.right) < 10),
                            platLeft: b.left,
                            platRight: b.right,
                            isBumper: !!s.isBumper,
                            sourceId: s.id,
                            edges: []
                        });
                    }
                }
            }
        }

        // Filter out nodes whose standing space is buried inside another static box
        for (let i = 0; i < rawNodes.length; i++) {
            var n = rawNodes[i];
            if (this.isPointBlocked(n.x, n.y + 34, 42, 54, n.sourceId)) continue;

            // Merge if very close to an existing node
            var duplicate = false;
            for (let j = 0; j < this.nodes.length; j++) {
                var existing = this.nodes[j];
                if (Math.abs(existing.x - n.x) < 28 && Math.abs(existing.y - n.y) < 24) {
                    if (n.isBumper) existing.isBumper = true;
                    if (n.isLeftEdge) existing.isLeftEdge = true;
                    if (n.isRightEdge) existing.isRightEdge = true;
                    if (n.isRamp) existing.isRamp = true;
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) {
                n.id = this.nodes.length;
                this.nodes.push(n);
            }
        }

        // Build Walk, Ramp, Jump, Drop, and Bounce edges with strict obstacle/platform clearance
        for (let i = 0; i < this.nodes.length; i++) {
            var a = this.nodes[i];
            for (let j = 0; j < this.nodes.length; j++) {
                if (i === j) continue;
                var b = this.nodes[j];
                var dx = b.x - a.x;
                var adx = Math.abs(dx);
                if (adx > 380) continue;
                var dy = b.y - a.y;
                if (dy > 550 || dy < -560) continue;
                var dist = Math.hypot(dx, dy);

                // 1. Flat Walk or Ramp Climb/Descent Edge
                if (adx <= 185 && Math.abs(dy) <= 130) {
                    // Only allow significant elevation change on a walk edge if at least one node is a ramp or step <= 42px
                    if (Math.abs(dy) <= 44 || a.isRamp || b.isRamp) {
                        if (this.hasLineClearance(a.x, a.y, b.x, b.y)) {
                            a.edges.push({ to: b.id, cost: dist * (dy > 10 ? 1.1 : 1.0), action: "walk" });
                        }
                    }
                }
                // 2. Jump Up Edge (Platform to higher Platform)
                else if (adx >= 20 && adx <= 260 && dy > 20 && dy <= 220) {
                    if (this.hasJumpClearance(a.x, a.y, b.x, b.y)) {
                        a.edges.push({ to: b.id, cost: dist * 1.45 + 35, action: "jump" });
                    }
                }
                // 3. Jump Across Horizontal Gap
                else if (adx > 185 && adx <= 285 && Math.abs(dy) <= 45) {
                    if (this.hasJumpClearance(a.x, a.y, b.x, b.y)) {
                        a.edges.push({ to: b.id, cost: dist * 1.35 + 25, action: "jump" });
                    }
                }
                // 4. Drop Down Edge — ONLY allowed from platform edges stepping off into open air!
                else if (adx >= 24 && adx <= 260 && dy < -28 && dy >= -560) {
                    var canStepOffLeft = (dx < 0) && a.isLeftEdge && (b.x < a.platLeft + 16);
                    var canStepOffRight = (dx > 0) && a.isRightEdge && (b.x > a.platRight - 16);
                    if (canStepOffLeft || canStepOffRight) {
                        var overhangX = (dx < 0) ? (a.platLeft - 28) : (a.platRight + 28);
                        if (!this.isPointBlocked(overhangX, a.y + 34, 38, 52) &&
                            this.hasLineClearance(overhangX, a.y, b.x, b.y)) {
                            a.edges.push({ to: b.id, cost: dist * 1.1 + 12, action: "drop" });
                        }
                    }
                }
                // 5. Bounce Pad High Launch Edge
                else if (a.isBumper && adx <= 380 && dy > 90 && dy <= 550) {
                    if (this.hasJumpClearance(a.x, a.y, b.x, b.y)) {
                        a.edges.push({ to: b.id, cost: dist * 0.9, action: "bounce" });
                    }
                }
            }
        }
    }

    static hasJumpClearance(x1, y1, x2, y2) {
        var peakY = Math.max(y1, y2) + 56;
        var midX = (x1 + x2) / 2;
        if (this.isPointBlocked(midX, peakY, 36, 44)) return false;
        return this.hasLineClearance(x1, y1 + 16, midX, peakY - 20) &&
               this.hasLineClearance(midX, peakY - 20, x2, y2 + 16);
    }

    static findClosestNode(wx, wy) {
        var best = null;
        var bestScore = Infinity;
        for (let i = 0; i < this.nodes.length; i++) {
            var n = this.nodes[i];
            var dx = Math.abs(n.x - wx);
            // wy is entity footY; n.y is surface top
            var dy = wy - n.y;

            var vPenalty;
            if (dy >= -24 && dy <= 160) {
                vPenalty = Math.abs(dy) * 1.3;
            } else if (dy > 160) {
                vPenalty = dy * 2.2;
            } else {
                vPenalty = Math.abs(dy) * 6.5 + 450;
            }

            var score = dx + vPenalty;
            if (score < bestScore) {
                bestScore = score;
                best = n;
            }
        }
        return best;
    }

    // Minecraft-style A* Graph Search
    static findPath(startX, startY, goalX, goalY) {
        if (typeof cameraTargetX !== "undefined") {
            var camDY = (typeof cameraTargetY !== "undefined") ? Math.abs(cameraTargetY - (this.lastRebuildCenterY || 0)) : 0;
            if (Math.abs(cameraTargetX - this.lastRebuildCenterX) > 650 || camDY > 550) {
                this.rebuildGraph(true);
            }
        }
        if (this.nodes.length === 0) this.rebuildGraph(true);
        if (this.nodes.length === 0) return [];

        var startNode = this.findClosestNode(startX, startY);
        var goalNode = this.findClosestNode(goalX, goalY);
        if (!startNode || !goalNode) return [];
        if (startNode.id === goalNode.id) {
            return [{ x: goalX, y: goalY, action: "walk" }];
        }

        var nCount = this.nodes.length;
        var gScore = new Array(nCount).fill(Infinity);
        var fScore = new Array(nCount).fill(Infinity);
        var cameFrom = new Array(nCount).fill(-1);
        var cameAction = new Array(nCount).fill("walk");
        var closed = new Array(nCount).fill(false);
        var open = [startNode.id];

        gScore[startNode.id] = 0;
        fScore[startNode.id] = Math.hypot(goalNode.x - startNode.x, goalNode.y - startNode.y);

        while (open.length > 0) {
            var bestIdx = 0;
            for (let i = 1; i < open.length; i++) {
                if (fScore[open[i]] < fScore[open[bestIdx]]) {
                    bestIdx = i;
                }
            }
            var currentId = open.splice(bestIdx, 1)[0];

            if (currentId === goalNode.id) {
                var path = [];
                var curr = currentId;
                while (curr !== -1) {
                    var node = this.nodes[curr];
                    path.unshift({
                        x: node.x,
                        y: node.y,
                        action: cameAction[curr],
                        nodeId: curr
                    });
                    if (curr === startNode.id) break;
                    curr = cameFrom[curr];
                }
                if (this.hasLineClearance(goalNode.x, goalNode.y, goalX, goalY)) {
                    path.push({ x: goalX, y: goalY, action: "walk" });
                }
                return path;
            }

            closed[currentId] = true;
            var currentNode = this.nodes[currentId];

            for (let e = 0; e < currentNode.edges.length; e++) {
                var edge = currentNode.edges[e];
                var neighborId = edge.to;
                if (closed[neighborId]) continue;

                var tentativeG = gScore[currentId] + edge.cost;
                if (tentativeG < gScore[neighborId]) {
                    cameFrom[neighborId] = currentId;
                    cameAction[neighborId] = edge.action;
                    gScore[neighborId] = tentativeG;
                    var nb = this.nodes[neighborId];
                    fScore[neighborId] = tentativeG + Math.hypot(goalNode.x - nb.x, goalNode.y - nb.y);
                    if (open.indexOf(neighborId) === -1) {
                        open.push(neighborId);
                    }
                }
            }
        }

        // If goalNode wasn't reachable, path to the node in closed set that got closest to goalNode!
        var bestFallbackId = -1;
        var bestDist = Infinity;
        for (let i = 0; i < nCount; i++) {
            if (closed[i]) {
                var d = Math.hypot(this.nodes[i].x - goalX, this.nodes[i].y - goalY);
                if (d < bestDist) {
                    bestDist = d;
                    bestFallbackId = i;
                }
            }
        }
        if (bestFallbackId !== -1 && bestFallbackId !== startNode.id) {
            var fallbackPath = [];
            var c = bestFallbackId;
            while (c !== -1) {
                fallbackPath.unshift({
                    x: this.nodes[c].x,
                    y: this.nodes[c].y,
                    action: cameAction[c],
                    nodeId: c
                });
                if (c === startNode.id) break;
                c = cameFrom[c];
            }
            return fallbackPath;
        }

        return [{ x: goalX, y: goalY, action: (goalY > startY + 60) ? "jump" : "walk" }];
    }

    static updateZombieNavigation(zombie, target) {
        var footY = zombie.y - zombie.s2 / 2;
        var targetFootY = target.y - target.s2 / 2;

        // Fast direct pursuit when on the same floor/ramp close to the player (skips A* completely!)
        if (Math.abs(target.x - zombie.x) < 320 && Math.abs(targetFootY - footY) < 48) {
            if (target.x > zombie.x + 10) zombie.rightPressed = true;
            else if (target.x < zombie.x - 10) zombie.leftPressed = true;
            return;
        }

        // Track if zombie is stuck in one horizontal spot
        if (zombie.lastNavX === undefined) {
            zombie.lastNavX = zombie.x;
            zombie.stuckTimer = 0;
        }
        if (Math.abs(zombie.x - zombie.lastNavX) < 4) {
            zombie.stuckTimer++;
        } else {
            zombie.lastNavX = zombie.x;
            zombie.stuckTimer = 0;
        }

        if (!zombie.navTimer || zombie.navTimer <= 0 || !zombie.navPath || zombie.navPath.length === 0 || zombie.stuckTimer > 42) {
            zombie.navPath = this.findPath(zombie.x, footY, target.x, targetFootY);
            zombie.navTimer = 28 + (zombie.id % 14);
            if (zombie.stuckTimer > 42) {
                zombie.stuckTimer = 0;
                zombie.upPressed = true;
            }
        } else {
            zombie.navTimer--;
        }

        // Advance past waypoints the zombie has genuinely reached
        while (zombie.navPath.length > 1) {
            var wp = zombie.navPath[0];
            if (Math.abs(wp.x - zombie.x) < 28 && Math.abs(wp.y - footY) < 46) {
                zombie.navPath.shift();
            } else {
                break;
            }
        }

        var nextWP = zombie.navPath[0] || { x: target.x, y: targetFootY, action: "walk" };
        var dx = nextWP.x - zombie.x;
        var dy = nextWP.y - footY;

        if (dx > 8) {
            zombie.rightPressed = true;
        } else if (dx < -8) {
            zombie.leftPressed = true;
        }

        // Check if blocked horizontally by static world or crates (ignoring other zombies)
        var probeDir = zombie.rightPressed ? 12 : (zombie.leftPressed ? -12 : 0);
        var blockedByWorld = false;
        if (probeDir !== 0) {
            if (CollisionDetector.collision(zombie, [probeDir, 0], staticObjects) && !zombie.collidedRamp) {
                blockedByWorld = true;
            }
        }

        if (nextWP.action == "jump" && Math.abs(dx) < 250 && dy > 8) {
            zombie.upPressed = true;
        } else if (dy > 52 && Math.abs(dx) < 160 && this.hasLineClearance(zombie.x, footY, nextWP.x, nextWP.y)) {
            zombie.upPressed = true;
        } else if (blockedByWorld) {
            zombie.upPressed = true;
        }
    }

    static drawDebug() {
        if (!this.showDebug) return;
        ctx.save();

        // Draw nav nodes
        for (let i = 0; i < this.nodes.length; i++) {
            var n = this.nodes[i];
            var sx = n.x * cameraScaleX + xc;
            var sy = -n.y * cameraScaleY + yc;

            ctx.fillStyle = n.isRamp ? "#00f5d4" : (n.isBumper ? "#ff2e63" : (n.isLeftEdge || n.isRightEdge ? "#ffdd44" : "#88cc99"));
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw active Zombie A* Paths (Minecraft debug style)
        for (let z = 0; z < zombies.length; z++) {
            var zom = zombies[z];
            if (zom.dead || !zom.navPath || zom.navPath.length === 0) continue;

            ctx.strokeStyle = "#33ff77";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(zom.x * cameraScaleX + xc, -zom.y * cameraScaleY + yc);
            for (let p = 0; p < zom.navPath.length; p++) {
                var wp = zom.navPath[p];
                ctx.lineTo(wp.x * cameraScaleX + xc, -(wp.y + 25) * cameraScaleY + yc);
            }
            ctx.stroke();
        }

        ctx.restore();
    }
}
