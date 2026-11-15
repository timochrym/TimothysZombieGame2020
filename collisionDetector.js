// ============================================================================
// STATIC SPATIAL HASH (broad-phase): rebuilt once per frame, so collision queries only test the
// handful of level pieces near an entity instead of every object in the level.
// ============================================================================
var StaticGrid = {
    cell: 320,
    map: new Map(),
    stamp: 1,
    bufA: [], bufB: [], bufC: [],
    key: function(cx, cy) { return (cx + 50000) * 100000 + (cy + 50000); },
    build: function() {
        this.map.clear();
        var cs = this.cell;
        for (let i = 0; i < staticObjects.length; i++) {
            var s = staticObjects[i];
            if (!s || s.dead) continue;
            var hw = (s.w || 40) / 2, hh = (s.h || 40) / 2;
            var x0 = Math.floor((s.x - hw) / cs), x1 = Math.floor((s.x + hw) / cs);
            var y0 = Math.floor((s.y - hh) / cs), y1 = Math.floor((s.y + hh) / cs);
            for (let cx = x0; cx <= x1; cx++) {
                for (let cy = y0; cy <= y1; cy++) {
                    var k = this.key(cx, cy);
                    var arr = this.map.get(k);
                    if (!arr) { arr = []; this.map.set(k, arr); }
                    arr.push(s);
                }
            }
        }
        this.built = true;
    },
    // Statics overlapping the box (+ every dynamic object when withDynamic) into `out`
    query: function(l, b, r, t, withDynamic, out) {
        out.length = 0;
        if (!this.built) this.build();
        var cs = this.cell;
        var st = ++this.stamp;
        var x0 = Math.floor(l / cs), x1 = Math.floor(r / cs), y0 = Math.floor(b / cs), y1 = Math.floor(t / cs);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                var arr = this.map.get(this.key(cx, cy));
                if (!arr) continue;
                for (let i = 0; i < arr.length; i++) {
                    var o = arr[i];
                    if (o._gs !== st) { o._gs = st; out.push(o); }
                }
            }
        }
        if (withDynamic) {
            if (DynGrid.built) DynGrid.query(l, b, r, t, out, st);
            else {
                for (let i = 0; i < movingObjects.length; i++) if (!movingObjects[i].dead) out.push(movingObjects[i]);
                for (let i = 0; i < characters.length; i++) out.push(characters[i]);
                for (let i = 0; i < zombies.length; i++) if (!zombies[i].dead) out.push(zombies[i]);
            }
        }
        return out;
    }
};

// Same idea for things that move (crates, heroes, enemies): rebuilt once per tick in rebuildAllObjects(), each object
// filed with a margin so it is still found after moving during the tick. Turns crate-vs-everything into a local check.
var DynGrid = {
    cell: 256, PAD: 96,
    map: new Map(),
    built: false,
    key: function(cx, cy) { return (cx + 50000) * 100000 + (cy + 50000); },
    build: function() {
        this.map.clear();
        var cs = this.cell, P = this.PAD;
        var add = function(o) {
            if (!o || o.dead) return;
            var hw = (o.w || o.s1 || 40) / 2 + P, hh = (o.h || o.s2 || 40) / 2 + P;
            var x0 = Math.floor((o.x - hw) / cs), x1 = Math.floor((o.x + hw) / cs), y0 = Math.floor((o.y - hh) / cs), y1 = Math.floor((o.y + hh) / cs);
            for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
                var k = DynGrid.key(cx, cy), arr = DynGrid.map.get(k);
                if (!arr) { arr = []; DynGrid.map.set(k, arr); }
                arr.push(o);
            }
        };
        for (let i = 0; i < movingObjects.length; i++) add(movingObjects[i]);
        for (let i = 0; i < characters.length; i++) add(characters[i]);
        for (let i = 0; i < zombies.length; i++) add(zombies[i]);
        this.built = true;
    },
    query: function(l, b, r, t, out, stamp) {
        var cs = this.cell;
        var x0 = Math.floor(l / cs), x1 = Math.floor(r / cs), y0 = Math.floor(b / cs), y1 = Math.floor(t / cs);
        for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
            var arr = this.map.get(this.key(cx, cy));
            if (!arr) continue;
            for (let i = 0; i < arr.length; i++) {
                var o = arr[i];
                if (o.dead || o._gs === stamp) continue;
                o._gs = stamp;
                out.push(o);
            }
        }
    }
};

class CollisionDetector {

    static getBounds(obj, xyAdd = [0, 0]) {
        var ox = obj.x + (xyAdd ? xyAdd[0] : 0);
        var oy = obj.y + (xyAdd ? xyAdd[1] : 0);
        var w = obj.w || obj.s1;
        var h = obj.h || obj.s2;
        if (w && h) {
            var hw = w * 0.5;
            var hh = h * 0.5;
            return {
                left: ox - hw,
                right: ox + hw,
                bottom: oy - hh,
                top: oy + hh,
                halfW: hw,
                halfH: hh
            };
        }
        var pts = obj.poly || obj.hitbox;
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < pts.length; i++) {
            var px = pts[i][0] + ox;
            var py = pts[i][1] + oy;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
        }
        obj.w = maxX - minX;
        obj.h = maxY - minY;
        return {
            left: minX,
            right: maxX,
            bottom: minY,
            top: maxY,
            halfW: obj.w * 0.5,
            halfH: obj.h * 0.5
        };
    }

    static getWorldVertices(obj, xyAdd = [0, 0]) {
        var ox = obj.x + xyAdd[0];
        var oy = obj.y + xyAdd[1];
        var pts = obj.poly || obj.hitbox;
        var out = [];
        for (let i = 0; i < pts.length; i++) {
            out.push([pts[i][0] + ox, pts[i][1] + oy]);
        }
        return out;
    }

    static getAxes(verts) {
        var axes = [];
        for (let i = 0; i < verts.length; i++) {
            var p1 = verts[i];
            var p2 = verts[(i + 1) % verts.length];
            var ex = p2[0] - p1[0];
            var ey = p2[1] - p1[1];
            var len = Math.hypot(ex, ey);
            if (len > 0.0001) {
                axes.push([-ey / len, ex / len]);
            }
        }
        return axes;
    }

    static project(verts, axis) {
        var min = Infinity;
        var max = -Infinity;
        for (let i = 0; i < verts.length; i++) {
            var dot = verts[i][0] * axis[0] + verts[i][1] * axis[1];
            if (dot < min) min = dot;
            if (dot > max) max = dot;
        }
        return [min, max];
    }

    // Exact Separating Axis Theorem (SAT) test between any two convex polygons (boxes, ramps, crates, characters)
    static satTest(objA, xyAddA, objB) {
        var oxA = objA.x + (xyAddA ? xyAddA[0] : 0);
        var oyA = objA.y + (xyAddA ? xyAddA[1] : 0);
        var wA = objA.w || objA.s1;
        var hA = objA.h || objA.s2;
        var wB = objB.w || objB.s1;
        var hB = objB.h || objB.s2;

        // Ultra-fast O(1) Box-vs-Box path (zero array allocations, zero vertex loops!)
        if (wA && hA && wB && hB) {
            var dx = oxA - objB.x;
            var overlapX = (wA + wB) * 0.5 - Math.abs(dx);
            if (overlapX <= 0) return null;

            var dy = oyA - objB.y;
            var overlapY = (hA + hB) * 0.5 - Math.abs(dy);
            if (overlapY <= 0) return null;

            if (!objA.isRamp && !objB.isRamp) {
                if (overlapX < overlapY) {
                    var nx = dx >= 0 ? 1 : -1;
                    return {
                        overlap: overlapX,
                        nx: nx,
                        ny: 0,
                        dx: nx * overlapX,
                        dy: 0,
                        other: objB
                    };
                } else {
                    var ny = dy >= 0 ? 1 : -1;
                    return {
                        overlap: overlapY,
                        nx: 0,
                        ny: ny,
                        dx: 0,
                        dy: ny * overlapY,
                        other: objB
                    };
                }
            }
        }

        var bA = this.getBounds(objA, xyAddA);
        var bB = this.getBounds(objB, [0, 0]);

        // Fast broadphase AABB reject
        if (bA.right <= bB.left || bA.left >= bB.right || bA.top <= bB.bottom || bA.bottom >= bB.top) {
            return null;
        }

        var vertsA = this.getWorldVertices(objA, xyAddA);
        var vertsB = this.getWorldVertices(objB, [0, 0]);

        var axes = [
            [1, 0],
            [0, 1]
        ];
        if (objA.isRamp) {
            var axesA = this.getAxes(vertsA);
            for (let i = 0; i < axesA.length; i++) axes.push(axesA[i]);
        }
        if (objB.isRamp) {
            var axesB = this.getAxes(vertsB);
            for (let i = 0; i < axesB.length; i++) axes.push(axesB[i]);
        }

        var minOverlap = Infinity;
        var bestAxis = null;

        for (let i = 0; i < axes.length; i++) {
            var axis = axes[i];
            var pA = this.project(vertsA, axis);
            var pB = this.project(vertsB, axis);

            var overlap = Math.min(pA[1], pB[1]) - Math.max(pA[0], pB[0]);
            if (overlap <= 0) {
                return null; // Separating axis found -> mathematically zero intersection!
            }
            if (overlap < minOverlap) {
                minOverlap = overlap;
                bestAxis = axis;
            }
        }

        // Ensure normal points from B toward A (direction to push A out of B)
        var centerA = [(bA.left + bA.right) / 2, (bA.bottom + bA.top) / 2];
        var centerB = [(bB.left + bB.right) / 2, (bB.bottom + bB.top) / 2];
        if (objB.isRamp) {
            // Use the lower-corner centroid of the right-triangle ramp so slope normals always push upward
            centerB = [
                objB.rampDir == "left" ? (bB.left + (bB.right - bB.left) * 0.25) : (bB.right - (bB.right - bB.left) * 0.25),
                bB.bottom + (bB.top - bB.bottom) * 0.25
            ];
        }
        var dx = centerA[0] - centerB[0];
        var dy = centerA[1] - centerB[1];
        if (dx * bestAxis[0] + dy * bestAxis[1] < 0) {
            bestAxis = [-bestAxis[0], -bestAxis[1]];
        }

        return {
            overlap: minOverlap,
            nx: bestAxis[0],
            ny: bestAxis[1],
            dx: bestAxis[0] * minOverlap,
            dy: bestAxis[1] * minOverlap,
            other: objB
        };
    }

    // Computes the exact analytical slope surface Y of a ramp underneath an entity's center-foot sensor
    // Using a narrow center-foot span (instead of the full 80px box width) eliminates toe-snagging at the bottom
    // and eliminates hanging 40px off the top ledge when starting to walk downhill!
    static getRampSlopeY(ramp, bA, bRamp) {
        var rw = bRamp.right - bRamp.left;
        var rh = bRamp.top - bRamp.bottom;
        if (rw <= 0.001) return bRamp.top;

        var centerA = (bA.left + bA.right) * 0.5;
        var footPad = Math.min(6, (bA.right - bA.left) * 0.08);

        if (ramp.rampDir == "left") {
            // Slopes down from (left, top) to (right, bottom)
            var sampleX = centerA - footPad;
            var cx = Math.max(bRamp.left, Math.min(bRamp.right, sampleX));
            var t = (bRamp.right - cx) / rw;
            return bRamp.bottom + t * rh;
        } else {
            // Slopes up from (left, bottom) to (right, top)
            var sampleX = centerA + footPad;
            var cx = Math.max(bRamp.left, Math.min(bRamp.right, sampleX));
            var t = (cx - bRamp.left) / rw;
            return bRamp.bottom + t * rh;
        }
    }

    // Checks if bA is approaching or standing on the walkable slope of a ramp.
    // Ramps act strictly as walkable top slopes: you can walk past their back-wall on the lower floor
    // or climb a lower staircase underneath them without ever bonking your head or getting wedged!
    static isWalkableRampContact(ramp, bA, bRamp, hit) {
        if (!ramp || !ramp.isRamp) return false;
        var centerA = (bA.left + bA.right) * 0.5;
        if (centerA < bRamp.left - 10 || centerA > bRamp.right + 10) return false;

        var slopeY = this.getRampSlopeY(ramp, bA, bRamp);
        // Active slope contact only when feet are within the walkable band [slopeY - 30, slopeY + 14]
        return bA.bottom >= slopeY - 30 && bA.bottom <= slopeY + 14;
    }

    // Stairs are OPT-IN for heroes: you only climb them while holding Up (or already standing on them)
    static ignoresStairs(entity, ramp) {
        return ramp && ramp.kind === "stairs" && entity && entity.isPlayer && !(entity.stairsGrip > 0);
    }

    // Helper: returns true if `st` is a thin horizontal interior floor / platform slab (h <= 60)
    // that should be solid from above and pass-through from below/sides (Mario / Terraria / Smash Bros style!)
    static isSemiSolidPlatform(st) {
        return st && !st.movable && !st.isRamp && !st.isBumper && !st.isInfiniteBase && st.kind !== "wall" && st.kind !== "block" && st.w >= 80 && st.h <= 100;
    }

    // Checks if an entity's center is currently on a ramp that smoothly adjoins the top of `box`.
    static getActiveRampAtCenter(entity, xyAdd, objects) {
        var bA = this.getBounds(entity, xyAdd);
        var centerA = (bA.left + bA.right) * 0.5;
        var bestRamp = null;
        var bestSlopeY = -Infinity;

        for (let i = 0; i < objects.length; i++) {
            var obj = objects[i];
            if (!obj || !obj.isRamp || obj.dead || obj.noCollide) continue;
            if (this.ignoresStairs(entity, obj)) continue;
            var bR = this.getBounds(obj, [0, 0]);
            if (centerA >= bR.left - 8 && centerA <= bR.right + 8) {
                var sy = this.getRampSlopeY(obj, bA, bR);
                if (bA.bottom >= sy - 30 && bA.bottom <= bR.top + 18) {
                    if (sy > bestSlopeY) {
                        bestSlopeY = sy;
                        bestRamp = obj;
                    }
                }
            }
        }
        return bestRamp ? { ramp: bestRamp, slopeY: bestSlopeY } : null;
    }

    static collision(objectToTest, xyAdd, objects) {
        objectToTest.collidedWith = null;
        objectToTest.xOver = 0;
        objectToTest.yOver = 0;
        objectToTest.collidedRamp = null;
        objectToTest.hitNormal = [0, 0];

        if (objectToTest.noCollide) return false;

        var bA = this.getBounds(objectToTest, xyAdd);
        var bCurr = this.getBounds(objectToTest, [0, 0]);
        // Broad-phase: only test level pieces near the swept box
        if (objects === allObjects || objects === staticObjects) {
            objects = StaticGrid.query(Math.min(bA.left, bCurr.left) - 60, Math.min(bA.bottom, bCurr.bottom) - 60,
                Math.max(bA.right, bCurr.right) + 60, Math.max(bA.top, bCurr.top) + 60, objects === allObjects, StaticGrid.bufA);
        }
        var centerA = (bA.left + bA.right) * 0.5;
        var activeRampInfo = (objectToTest.movable) ? this.getActiveRampAtCenter(objectToTest, xyAdd, objects) : null;

        var rampHit = null;
        var rampOther = null;
        var rampSlopeY = -Infinity;
        var solidHit = null;
        var solidOther = null;

        for (let i = 0; i < objects.length; i++) {
            var other = objects[i];
            if (other == objectToTest || other.dead || other.noCollide) continue;
            if (objectToTest.heldBy == other || other.heldBy == objectToTest) continue;

            // Let zombies pass smoothly through fellow zombies during horizontal walking so hordes don't traffic-jam on platforms
            if (objectToTest.isZombie && other.isZombie && xyAdd[1] === 0) continue;

            var hit = this.satTest(objectToTest, xyAdd, other);
            if (hit) {
                // 1. Staircase Ramps: ONLY collide along their walkable top slope! Never block from underneath or behind!
                if (other.isRamp) {
                    if (this.ignoresStairs(objectToTest, other)) continue;
                    var bR = this.getBounds(other, [0, 0]);
                    if (this.isWalkableRampContact(other, bA, bR, hit) && (objectToTest.yspeed === undefined || objectToTest.yspeed <= 5)) {
                        var sy = this.getRampSlopeY(other, bA, bR);
                        if (bA.bottom <= sy + 1.5) {
                            if (sy > rampSlopeY) {
                                rampSlopeY = sy;
                                rampHit = hit;
                                rampOther = other;
                            }
                        }
                    }
                    continue;
                }

                // 2. Semi-Solid Interior Floors & Platforms (h <= 60):
                //    Solid when landing/standing on top (bCurr.bottom >= bO.top - 22 and not moving upward);
                //    100% pass-through when jumping up from below, climbing a ramp, or intentionally dropping through!
                if ((this.isSemiSolidPlatform(other) || other.isBumper) && objectToTest.movable) {
                    if (objectToTest.dropThroughTimer && objectToTest.dropThroughTimer > 0) {
                        continue;
                    }
                    var bO = this.getBounds(other, [0, 0]);
                    if (activeRampInfo) {
                        var bAR = this.getBounds(activeRampInfo.ramp, [0, 0]);
                        if (Math.abs(bO.top - bAR.top) <= 12 && centerA >= bAR.left && centerA <= bAR.right) {
                            continue;
                        }
                    }
                    var isAbovePlatform = (bCurr.bottom >= bO.top - 22) && (objectToTest.yspeed === undefined || objectToTest.yspeed <= 3.5);
                    if (!isAbovePlatform) {
                        continue; // Pass right through from below or while climbing stairs!
                    }
                    // When on top of the platform, only collide vertically with its top surface (never snag horizontally on its side edges)
                    if (xyAdd[1] === 0 && bA.bottom >= bO.top - 22) {
                        continue;
                    }
                    hit = {
                        overlap: Math.max(0, bO.top - bA.bottom),
                        nx: 0,
                        ny: 1,
                        dx: 0,
                        dy: Math.max(0, bO.top - bA.bottom),
                        other: other
                    };
                } else if (!other.movable && activeRampInfo) {
                    var bO2 = this.getBounds(other, [0, 0]);
                    var bAR2 = this.getBounds(activeRampInfo.ramp, [0, 0]);
                    var isAdjoiningTopFloor = Math.abs(bO2.top - bAR2.top) <= 10 && bA.bottom >= bO2.top - 42;
                    var isAdjoiningBottomFloor = Math.abs(bO2.top - bAR2.bottom) <= 10 && bA.bottom >= bO2.top - 16;
                    if ((isAdjoiningTopFloor || isAdjoiningBottomFloor) && centerA >= bAR2.left && centerA <= bAR2.right) {
                        continue;
                    }
                }

                if (!solidHit || hit.overlap > solidHit.overlap) {
                    solidHit = hit;
                    solidOther = other;
                }
            }
        }

        // Smooth Stair & Lip Step-Up: if moving horizontally into a static step/lip <= 42px high, treat it like a smooth step-up!
        if (!rampOther && solidOther && !solidOther.movable && !solidOther.isBumper && Math.abs(xyAdd[0]) > 0.001 && xyAdd[1] === 0) {
            var bSolid = this.getBounds(solidOther, [0, 0]);
            var stepUp = bSolid.top - bA.bottom;
            if (stepUp > 0 && stepUp <= 42) {
                if (!this.hitsStatic(objectToTest, xyAdd[0], stepUp + 1.0, typeof staticObjects !== "undefined" ? staticObjects : objects, solidOther)) {
                    objectToTest.collidedWith = solidOther;
                    objectToTest.collidedRamp = solidOther;
                    objectToTest.hitNormal = [0, 1];
                    objectToTest.xOver = 0;
                    objectToTest.yOver = Math.min(stepUp + 0.25, Math.max(stepUp * 0.65, Math.abs(xyAdd[0]) * 1.35 + 4));
                    return true;
                }
            }
        }

        if (rampHit && rampOther && (!solidOther || rampSlopeY >= bA.bottom - 2)) {
            var lift = Math.max(0, rampSlopeY - bA.bottom);
            objectToTest.collidedWith = rampOther;
            objectToTest.collidedRamp = rampOther;
            objectToTest.hitNormal = [rampHit.nx, rampHit.ny];
            objectToTest.xOver = 0;
            objectToTest.yOver = lift;
            return true;
        }

        if (solidHit && solidOther) {
            objectToTest.collidedWith = solidOther;
            objectToTest.hitNormal = [solidHit.nx, solidHit.ny];
            objectToTest.xOver = solidHit.dx;
            objectToTest.yOver = solidHit.dy;
            return true;
        }

        return false;
    }

    // Smoothly keeps a grounded/gliding entity glued to a ramp slope or stair step when moving downhill at any speed!
    static snapDownToRamp(entity, stepX, staticList) {
        var canSnap = entity.onGround || (entity.coyoteTimer && entity.coyoteTimer > 0);
        if (!canSnap || entity.yspeed > 2.5 || Math.abs(stepX) < 0.01) return false;

        var maxSnap = Math.abs(stepX) * 1.65 + 22;
        var bEntity = this.getBounds(entity, [0, 0]);
        var centerA = (bEntity.left + bEntity.right) * 0.5;

        var bestGap = Infinity;
        var bestRamp = null;

        for (let i = 0; i < staticList.length; i++) {
            var s = staticList[i];
            if (!s || s.dead || s.noCollide || !s.isRamp) continue;
            if (this.ignoresStairs(entity, s)) continue;
            var bR = this.getBounds(s, [0, 0]);
            if (centerA < bR.left - 10 || centerA > bR.right + 10) continue;

            var slopeY = this.getRampSlopeY(s, bEntity, bR);
            var gap = bEntity.bottom - slopeY;
            if (gap >= -1.0 && gap <= maxSnap && gap < bestGap) {
                bestGap = gap;
                bestRamp = s;
            }
        }

        if (bestRamp && bestGap > 0) {
            entity.y -= bestGap;
            entity.onGround = true;
            if (entity.coyoteTimer !== undefined) entity.coyoteTimer = 7;
            if (entity.yspeed < 0) entity.yspeed = 0;
            return true;
        }
        return false;
    }

    // Checks if shifting entity by (dx, dy) would intersect any blocking static wall/floor
    static hitsStatic(entity, dx, dy, staticList, ignoreObj = null) {
        var bA = this.getBounds(entity, [dx, dy]);
        if (staticList === staticObjects) staticList = StaticGrid.query(bA.left - 10, bA.bottom - 10, bA.right + 10, bA.top + 10, false, StaticGrid.bufC);
        for (let i = 0; i < staticList.length; i++) {
            var s = staticList[i];
            if (s == entity || s == ignoreObj || s.dead || s.noCollide) continue;
            // Ramps and semi-solid interior platforms never block upward/horizontal stair climbing
            if (s.isRamp || this.isSemiSolidPlatform(s)) continue;
            var hit = this.satTest(entity, [dx, dy], s);
            if (hit) {
                var bS = this.getBounds(s, [0, 0]);
                if (bA.bottom >= bS.top - 1.5) continue;
                return true;
            }
        }
        return false;
    }

    // Transfers momentum from source into target and propagates it through any touching chain of objects,
    // even if target is wedged/sandwiched and has nowhere to go!
    static transferMomentum(source, target, dirX, dirY) {
        if (!source || !target || !target.movable || target.dead || target.noCollide) return false;

        var len = Math.hypot(dirX, dirY);
        if (len < 0.0001) return false;
        var dx = dirX / len;
        var dy = dirY / len;

        var sourceSpeedAlongDir = source.xspeed * dx + source.yspeed * dy;
        if (sourceSpeedAlongDir <= 0.05) return false;
        // Landing on something that is already resting on the ground: the ground takes the hit. Pushing it
        // down would only make it bounce back up (that is what made Siege towers bounce for seconds).
        if (dy < -0.5 && target.onGround) return false;

        var boost = 0.85;
        if (source.zombiePower == "TANK" || (typeof godMode !== "undefined" && godMode && !source.isZombie) || source.dashTimer > 0) {
            boost = 1.2;
        } else if (source.thrownTimer > 0) {
            boost = 1.05;
        }

        var baseImpulse = sourceSpeedAlongDir * boost;
        var visited = [source];
        var anyBlockedByWall = false;

        var propagate = (curr, imp, depth) => {
            if (!curr || curr.dead || !curr.movable || curr.noCollide || depth > 6) return;
            if (visited.indexOf(curr) !== -1) return;
            visited.push(curr);

            // Apply momentum along collision direction + shear transfer
            var wgt = curr.weight || 1;
            curr.xspeed += (dx * imp + (Math.abs(dy) > 0.5 ? source.xspeed * 0.35 : 0)) / wgt;
            curr.yspeed += (dy * imp + (Math.abs(dx) > 0.5 ? Math.max(0, source.yspeed * 0.25) : 0)) / wgt;

            var maxLim = (curr.maxspeed || 20) * 1.45;
            if (curr.xspeed > maxLim) curr.xspeed = maxLim;
            if (curr.xspeed < -maxLim) curr.xspeed = -maxLim;
            if (curr.yspeed > maxLim) curr.yspeed = maxLim;
            if (curr.yspeed < -maxLim) curr.yspeed = -maxLim;

            // Check if curr is touching other dynamic objects in the push direction (chain propagation!)
            var probeDist = 5;
            var pushedNext = false;
            if (typeof allObjects !== "undefined") {
                for (let i = 0; i < allObjects.length; i++) {
                    var nextObj = allObjects[i];
                    if (nextObj == curr || nextObj == source || nextObj.dead || nextObj.noCollide || !nextObj.movable) continue;
                    if (visited.indexOf(nextObj) !== -1) continue;

                    var hitNext = this.satTest(curr, [dx * probeDist, dy * probeDist], nextObj);
                    if (hitNext) {
                        pushedNext = true;
                        if (typeof curr.checkThrownImpact === "function") curr.checkThrownImpact(nextObj);
                        if (typeof curr.handleCharacterCollision === "function") curr.handleCharacterCollision(nextObj);
                        propagate(nextObj, imp * 0.9, depth + 1);
                    }
                }
            }

            // Check if curr is blocked by static world geometry in the push direction ("nowhere to go")
            var blockedByStatic = (typeof staticObjects !== "undefined") && this.hitsStatic(curr, dx * probeDist, dy * probeDist, staticObjects);
            if (blockedByStatic) {
                anyBlockedByWall = true;
                // Convert trapped normal momentum into perpendicular squeeze/escape velocity!
                if (Math.abs(dy) > 0.5 && imp > 3) {
                    // Blocked vertically (e.g. sitting on floor and hit from above) -> squeeze sideways
                    // (only on a real impact: resting weight must not make stacks walk apart)
                    var offX = curr.x - source.x;
                    var sideSign = Math.abs(offX) > 2 ? Math.sign(offX) : (Math.abs(source.xspeed) > 0.2 ? Math.sign(source.xspeed) : ((curr.id % 2 === 0) ? 1 : -1));
                    var squeezeX = sideSign * Math.min(14, imp * 0.6) + source.xspeed * 0.55;
                    if (!this.hitsStatic(curr, squeezeX, 0, staticObjects)) {
                        curr.xspeed += squeezeX;
                    }
                } else if (Math.abs(dx) > 0.5) {
                    // Blocked horizontally (pinned against a wall) -> pop upward along the wall
                    if (!this.hitsStatic(curr, 0, 6, staticObjects)) {
                        curr.yspeed = Math.max(curr.yspeed, Math.min(11, imp * 0.5 + 2));
                    }
                }
            } else if (!pushedNext) {
                // If curr has free space right in front of it, nudge it slightly so chained collisions resolve immediately
                var nudgeX = dx * Math.min(3, imp * 0.2);
                var nudgeY = dy * Math.min(3, imp * 0.2);
                if (!this.hitsStatic(curr, nudgeX, nudgeY, staticObjects)) {
                    curr.x += nudgeX;
                    curr.y += nudgeY;
                }
            }
        };

        propagate(target, baseImpulse, 0);
        return !anyBlockedByWall;
    }

    // Hard mathematical non-penetration solver run every frame so NOTHING can ever clip into ramps, walls, or other objects
    static enforceNonPenetration(staticList, dynamicList) {
        var iterations = 3;

        var leftOf = function(o) { return o.x - (o.w || o.s1 || 40) / 2; };
        for (let iter = 0; iter < iterations; iter++) {
            // 1. Resolve Dynamic vs Dynamic (Characters + Crates) without pushing either into Static walls/ramps.
            //    Sort-and-sweep on x: once the next object starts right of this one's right edge, nothing later can touch.
            var sorted = dynamicList.slice().sort(function(p, q) { return leftOf(p) - leftOf(q); });
            for (let i = 0; i < sorted.length; i++) {
                var a = sorted[i];
                if (a.dead || a.noCollide) continue;
                var aRight = a.x + (a.w || a.s1 || 40) / 2 + 1;

                for (let j = i + 1; j < sorted.length; j++) {
                    var b = sorted[j];
                    if (leftOf(b) > aRight) break;
                    if (b.dead || b.noCollide) continue;

                    var hit = this.satTest(a, [0, 0], b);
                    if (hit && hit.overlap > 0.01) {
                        if (typeof a.handleCharacterCollision === "function") a.handleCharacterCollision(b);
                        if (typeof b.handleCharacterCollision === "function") b.handleCharacterCollision(a);

                        // Gentle crowd separation between two zombies so they don't form rigid walls blocking pathfinding
                        if (a.isZombie && b.isZombie) {
                            var sep = (a.x >= b.x ? 1 : -1) * Math.min(1.5, hit.overlap * 0.12);
                            if (!this.hitsStatic(a, sep, 0, staticList)) a.x += sep;
                            if (!this.hitsStatic(b, -sep, 0, staticList)) b.x -= sep;
                            continue;
                        }

                        var pushX = hit.dx;
                        var pushY = hit.dy;

                        // Check if A or B is blocked by static world in the push direction
                        var aBlocked = this.hitsStatic(a, pushX * 0.5, pushY * 0.5, staticList);
                        var bBlocked = this.hitsStatic(b, -pushX * 0.5, -pushY * 0.5, staticList);

                        if (aBlocked && !bBlocked) {
                            b.x -= pushX;
                            b.y -= pushY;
                        } else if (bBlocked && !aBlocked) {
                            a.x += pushX;
                            a.y += pushY;
                        } else if (!aBlocked && !bBlocked) {
                            a.x += pushX * 0.5;
                            a.y += pushY * 0.5;
                            b.x -= pushX * 0.5;
                            b.y -= pushY * 0.5;
                        }

                        // Exchange relative velocity and propagate momentum through touching chains
                        var rvx = a.xspeed - b.xspeed;
                        var rvy = a.yspeed - b.yspeed;
                        var velAlongNormal = rvx * hit.nx + rvy * hit.ny;
                        if (velAlongNormal < 0) {
                            var imp = -velAlongNormal * 0.65;
                            a.xspeed += hit.nx * imp;
                            a.yspeed += hit.ny * imp;
                            b.xspeed -= hit.nx * imp;
                            b.yspeed -= hit.ny * imp;
                        }
                    }
                }
            }

            // 2. Resolve Dynamic vs Static (Ramps, Floors, Platforms, Walls) — Static objects are 100% immovable
            for (let i = 0; i < dynamicList.length; i++) {
                var d = dynamicList[i];
                if (d.dead || d.noCollide) continue;
                var nearList = staticList;
                if (staticList === staticObjects) {
                    var hwD = (d.w || d.s1 || 40) / 2 + 40, hhD = (d.h || d.s2 || 40) / 2 + 40;
                    nearList = StaticGrid.query(d.x - hwD, d.y - hhD, d.x + hwD, d.y + hhD, false, StaticGrid.bufB);
                }
                var activeRampInfo = this.getActiveRampAtCenter(d, [0, 0], nearList);

                for (let s = 0; s < nearList.length; s++) {
                    var st = nearList[s];
                    if (st.dead || st.noCollide) continue;

                    var hit = this.satTest(d, [0, 0], st);
                    if (hit && hit.overlap > 0.001) {
                        var bD = this.getBounds(d, [0, 0]);
                        var centerD = (bD.left + bD.right) * 0.5;

                        // 1. Staircase Ramps: align bottom strictly to center-foot slopeY when on the walkable slope; never block from underneath/behind!
                        if (st.isRamp) {
                            if (this.ignoresStairs(d, st)) continue;
                            var bR = this.getBounds(st, [0, 0]);
                            if (this.isWalkableRampContact(st, bD, bR, hit) && (d.yspeed === undefined || d.yspeed <= 5)) {
                                var slopeY = this.getRampSlopeY(st, bD, bR);
                                var stepUp = slopeY - bD.bottom;
                                if (stepUp > 0 && !this.hitsStatic(d, 0, stepUp, staticList, st)) {
                                    d.y += stepUp;
                                    d.onGround = true;
                                    if (d.yspeed < 0) d.yspeed = 0;
                                } else if (Math.abs(stepUp) <= 4) {
                                    d.onGround = true;
                                }
                            }
                            continue;
                        }

                        // 2. Semi-Solid Interior Floors & Platforms (h <= 60): only push UP onto the top surface when feet are near top; never push down or sideways!
                        if (this.isSemiSolidPlatform(st) || st.isBumper) {
                            if (d.dropThroughTimer && d.dropThroughTimer > 0) {
                                continue;
                            }
                            var bPlat = this.getBounds(st, [0, 0]);
                            if (activeRampInfo) {
                                var bAR0 = this.getBounds(activeRampInfo.ramp, [0, 0]);
                                if (Math.abs(bPlat.top - bAR0.top) <= 12 && centerD >= bAR0.left && centerD <= bAR0.right) {
                                    continue;
                                }
                            }
                            if (bD.bottom >= bPlat.top - 22 && (d.yspeed === undefined || d.yspeed <= 3.5)) {
                                var liftPlat = bPlat.top - bD.bottom;
                                if (liftPlat > 0) {
                                    d.y += liftPlat;
                                    d.onGround = true;
                                    if (d.yspeed < 0) d.yspeed = 0;
                                }
                            }
                            continue;
                        }

                        if (activeRampInfo) {
                            // Do not let an adjoining top/bottom platform corner push the entity off the active ramp's slope!
                            var bS = this.getBounds(st, [0, 0]);
                            var bAR = this.getBounds(activeRampInfo.ramp, [0, 0]);
                            var adjoinsTop = Math.abs(bS.top - bAR.top) <= 10 && bD.bottom >= bS.top - 42;
                            var adjoinsBot = Math.abs(bS.top - bAR.bottom) <= 10 && bD.bottom >= bS.top - 16;
                            if ((adjoinsTop || adjoinsBot) && centerD >= bAR.left && centerD <= bAR.right) {
                                continue;
                            }
                        }

                        // Smooth stair/lip step-up in solver if overlapping the top corner of a step <= 40px
                        if (!st.isRamp && !st.isBumper && Math.abs(hit.nx) > 0.5) {
                            var bStep = this.getBounds(st, [0, 0]);
                            var lip = bStep.top - bD.bottom;
                            if (lip > 0 && lip <= 40 && !this.hitsStatic(d, 0, lip + 1, staticList, st)) {
                                d.y += lip;
                                d.onGround = true;
                                if (d.yspeed < 0) d.yspeed = 0;
                                continue;
                            }
                        }

                        // Otherwise apply exact Minimum Translation Vector (MTV) out of the static polygon
                        d.x += hit.dx;
                        d.y += hit.dy;

                        if (hit.ny > 0.5) {
                            d.onGround = true;
                            if (st.isBumper && d.yspeed <= 0) {
                                d.yspeed = st.bounceForce;
                                d.onGround = false;
                            } else if (d.yspeed < 0) {
                                d.yspeed = 0;
                            }
                        } else if (hit.ny < -0.5 && d.yspeed > 0) {
                            d.yspeed = 0;
                        }

                        var vn = d.xspeed * hit.nx + d.yspeed * hit.ny;
                        if (vn < 0) {
                            d.xspeed -= hit.nx * vn;
                            d.yspeed -= hit.ny * vn;
                        }
                    }
                }
            }
        }
    }

    static rangeOverlap(aPair, bPair) {
        var a0 = Math.min(aPair[0], aPair[1]);
        var a1 = Math.max(aPair[0], aPair[1]);
        var b0 = Math.min(bPair[0], bPair[1]);
        var b1 = Math.max(bPair[0], bPair[1]);

        if (a0 < b1 && a1 > b0) {
            var centerA = (a0 + a1) / 2;
            var centerB = (b0 + b1) / 2;
            var overlap = (centerA >= centerB) ? (b1 - a0) : (b0 - a1);
            return [true, overlap];
        }
        return [false, 0];
    }
}
