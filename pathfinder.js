// ============================================================================
// PATHFINDER - navigation graph + shared flow fields for enemy AI (and CPU bots)
//
//   Graph: one node per ~100px of walkable surface (floors, platform tops, ramps). Edges are
//   walk / jump / drop / bounce / ride (moving platform) / teleport (portal link) / bridge + tower
//   (only for agents that can build). Jump edges store the height + distance they need, and every
//   agent has a jump PROFILE measured from the real physics, so each enemy only takes jumps it can make.
//
//   Coverage: the whole level for bounded levels; a large window around the camera on the endless
//   frontier (rebuilt when chunks stream in). Edits are patched locally with invalidateRect().
//
//   Search: one Dijkstra flow field per (goal node, profile), shared by every enemy chasing that goal
//   and refreshed a few times a second (a small number per frame). Each enemy reads its next hop and
//   avoids crowded nodes, so groups spread over alternate routes. A* (binary heap) remains for one-off
//   goals and for the "goal unreachable -> get as close as possible" fallback.
//
//   Public API (unchanged + new):
//     Pathfinder.init() / rebuildGraph(force) / findPath(sx, sy, gx, gy) / updateZombieNavigation(z, target)
//     Pathfinder.invalidateRect(x, y, w, h)       patch the graph after level geometry changes (centre + size)
//     Pathfinder.shiftWorld(dx)                   floating-origin shift on the frontier
//     Pathfinder.flySteer(ch, tx, ty)             -> {x, y} next waypoint for flyers (coarse air-grid A*)
//     Pathfinder.addLink(ax, ay, bx, by, action, data) / clearLinks(tag)   extra edges (portals ...)
//     Pathfinder.profileOf(ch)                    jump profile; set ch.navProfile / ch.navBuilder to override
//     Pathfinder.stats                             { ms, frames, nodes, edges, fields } for the debug overlay
// ============================================================================

// Jump reach measured in-game (peak height with jump held / flat-ground distance at run speed), with a
// safety margin. NORMAL/TANK/KNIGHT/... ~320px up, SLIME ~445, LEAPER ~640.
var NAV_PROFILES = {
    normal: { idx: 0, up: 250, gap: 300 },
    high:   { idx: 1, up: 360, gap: 340 },
    leaper: { idx: 2, up: 520, gap: 390 }
};
var NAV_PROFILE_LIST = [NAV_PROFILES.normal, NAV_PROFILES.high, NAV_PROFILES.leaper];

class NavHeap {
    constructor() { this.ids = []; this.keys = []; }
    get size() { return this.ids.length; }
    push(id, key) {
        var ids = this.ids, keys = this.keys, i = ids.length;
        ids.push(id); keys.push(key);
        while (i > 0) {
            var p = (i - 1) >> 1;
            if (keys[p] <= key) break;
            ids[i] = ids[p]; keys[i] = keys[p]; i = p;
        }
        ids[i] = id; keys[i] = key;
    }
    pop() {
        var ids = this.ids, keys = this.keys;
        var top = ids[0];
        var lastId = ids.pop(), lastKey = keys.pop();
        var n = ids.length;
        if (n > 0) {
            var i = 0;
            while (true) {
                var l = 2 * i + 1, r = l + 1, m = i, mk = lastKey;
                if (l < n && keys[l] < mk) { m = l; mk = keys[l]; }
                if (r < n && keys[r] < mk) { m = r; mk = keys[r]; }
                if (m === i) break;
                ids[i] = ids[m]; keys[i] = keys[m]; i = m;
            }
            ids[i] = lastId; keys[i] = lastKey;
        }
        return top;
    }
}

class Pathfinder {

    static init() {
        this.nodes = [];
        this.links = [];
        this.showDebug = false;
        this.STEP = 100;          // node spacing along floors
        this.HCELL = 200;         // spatial hash cell
        this.bounds = null;       // graph coverage {l, r, b, t}
        this.windowed = false;
        this.fields = new Map();
        this.fieldsThisFrame = 0;
        this.frameNo = 0;
        this.crowd = new Map();
        this.crowdFrame = -1;
        this.stats = { ms: 0, frames: 0, nodes: 0, edges: 0, fields: 0, lastMs: 0 };
        this._msAcc = 0; this._msFrames = 0;
        this.rebuildGraph(true);
    }

    // ------------------------------------------------------------------ blockers (solid boxes)
    static isSolidBlocker(st) {
        return st && !st.dead && !st.noCollide && !st.isRamp && !this.isMoverObj(st) && !CollisionDetector.isSemiSolidPlatform(st);
    }

    static buildBlockerHash() {
        this.blockHash = new Map();
        this.solidBlockers = [];
        this.bigBlockers = [];
        if (typeof staticObjects === "undefined") return;
        var cs = this.HCELL;
        for (let i = 0; i < staticObjects.length; i++) {
            var st = staticObjects[i];
            if (!this.isSolidBlocker(st)) continue;
            this.solidBlockers.push(st);
            var hw = (st.w || 40) * 0.5, hh = (st.h || 40) * 0.5;
            var x0 = Math.floor((st.x - hw) / cs), x1 = Math.floor((st.x + hw) / cs);
            var y0 = Math.floor((st.y - hh) / cs), y1 = Math.floor((st.y + hh) / cs);
            if ((x1 - x0) * (y1 - y0) > 4000) { this.bigBlockers.push(st); continue; }
            for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
                var k = cx * 73856093 ^ cy * 19349663;
                var a = this.blockHash.get(k);
                if (!a) { a = []; this.blockHash.set(k, a); }
                a.push(st);
            }
        }
        this.blockStamp = (this.blockStamp || 0) + 1;
    }

    // kept for compatibility (older callers)
    static refreshSolidBlockers() { this.buildBlockerHash(); }

    static boxBlocked(cx, cy, hw, hh, ignoreId) {
        if (!this.blockHash) this.buildBlockerHash();
        var cs = this.HCELL;
        var x0 = Math.floor((cx - hw) / cs), x1 = Math.floor((cx + hw) / cs);
        var y0 = Math.floor((cy - hh) / cs), y1 = Math.floor((cy + hh) / cs);
        for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
            var a = this.blockHash.get(gx * 73856093 ^ gy * 19349663);
            if (!a) continue;
            for (let i = 0; i < a.length; i++) {
                var st = a[i];
                if (st.dead || st.noCollide || st.id === ignoreId) continue;
                if (Math.abs(cx - st.x) < hw + (st.w || 40) * 0.5 && Math.abs(cy - st.y) < hh + (st.h || 40) * 0.5) return true;
            }
        }
        var big = this.bigBlockers;
        if (big) for (let i = 0; i < big.length; i++) {
            var b = big[i];
            if (b.dead || b.noCollide || b.id === ignoreId) continue;
            if (Math.abs(cx - b.x) < hw + (b.w || 40) * 0.5 && Math.abs(cy - b.y) < hh + (b.h || 40) * 0.5) return true;
        }
        return false;
    }

    static isPointBlocked(wx, wy, w = 44, h = 56, ignoreId = -1) {
        return this.boxBlocked(wx, wy, w * 0.5, h * 0.5, ignoreId);
    }

    // swept body-sized clearance between two foot positions (samples every ~36px)
    static hasLineClearance(x1, y1, x2, y2) {
        var d = Math.hypot(x2 - x1, y2 - y1);
        var samples = Math.max(2, Math.ceil(d / 36));
        for (let s = 1; s < samples; s++) {
            var t = s / samples;
            if (this.boxBlocked(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + 30, 16, 22)) return false;
        }
        return true;
    }

    // arc clearance for jumps: up over the higher end, then across
    static hasJumpClearance(x1, y1, x2, y2) {
        var peakY = Math.max(y1, y2) + 60;
        var midX = (x1 + x2) / 2;
        if (this.boxBlocked(midX, peakY, 18, 22)) return false;
        if (y2 > y1 + 40) {
            // rise mostly vertically near the take-off, then move over the ledge
            var riseX = x1 + (x2 - x1) * 0.25;
            return this.hasLineClearance(x1, y1 + 10, riseX, peakY - 20) && this.hasLineClearance(riseX, peakY - 20, x2, y2 + 10);
        }
        return this.hasLineClearance(x1, y1 + 16, midX, peakY - 20) && this.hasLineClearance(midX, peakY - 20, x2, y2 + 16);
    }

    // any standable surface top in [footY - depth, footY + 24] under x (solid, semi-solid or ramp)
    static groundBelow(x, footY, depth) {
        if (typeof StaticGrid === "undefined") return true;
        var list = StaticGrid.query(x - 4, footY - depth, x + 4, footY + 24, false, this._gbuf || (this._gbuf = []));
        for (let i = 0; i < list.length; i++) {
            var s = list[i];
            if (s.dead || s.noCollide) continue;
            var hw = (s.w || 40) / 2;
            if (Math.abs(x - s.x) > hw) continue;
            var top = s.y + (s.h || 40) / 2;
            if (top <= footY + 24 && top >= footY - depth) return true;
        }
        return false;
    }

    // ------------------------------------------------------------------ hazards (spikes, kill zones)
    static collectHazards() {
        this.hazards = [];
        if (typeof Gadgets !== "undefined" && Gadgets.list) {
            for (let i = 0; i < Gadgets.list.length; i++) {
                var g = Gadgets.list[i];
                if (g.type === "spikes") this.hazards.push({ l: g.x - g.w / 2 - 20, r: g.x + g.w / 2 + 20, b: g.y - 10, t: g.y + 60 });
            }
        }
        if (typeof staticObjects !== "undefined") {
            for (let i = 0; i < staticObjects.length; i++) {
                var s = staticObjects[i];
                if (s && !s.dead && (s.hazard || s.lava)) this.hazards.push({ l: s.x - s.w / 2 - 20, r: s.x + s.w / 2 + 20, b: s.y - s.h / 2, t: s.y + s.h / 2 + 60 });
            }
        }
    }

    static inHazard(x, y) {
        var hz = this.hazards;
        if (!hz) return false;
        for (let i = 0; i < hz.length; i++) if (x > hz[i].l && x < hz[i].r && y > hz[i].b && y < hz[i].t) return true;
        return false;
    }

    static segmentHitsHazard(x1, y1, x2, y2) {
        var hz = this.hazards;
        if (!hz || !hz.length) return false;
        var n = Math.max(2, Math.ceil(Math.abs(x2 - x1) / 30));
        for (let s = 0; s <= n; s++) {
            var t = s / n;
            if (this.inHazard(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + 4)) return true;
        }
        return false;
    }

    // ------------------------------------------------------------------ graph coverage
    static computeBounds() {
        var cx = (typeof cameraTargetX !== "undefined") ? cameraTargetX : 0;
        var cy = (typeof cameraTargetY !== "undefined") ? cameraTargetY : 0;
        var l = Infinity, r = -Infinity, b = Infinity, t = -Infinity;
        for (let i = 0; i < staticObjects.length; i++) {
            var s = staticObjects[i];
            if (!s || s.dead || s.isInfiniteBase || (s.w || 0) > 20000) continue;
            var hw = (s.w || 40) / 2, hh = (s.h || 40) / 2;
            l = Math.min(l, s.x - hw); r = Math.max(r, s.x + hw);
            b = Math.min(b, s.y - hh); t = Math.max(t, s.y + hh);
        }
        var frontier = (typeof LevelManager !== "undefined" && LevelManager.currentLevelKey === "infinite_frontier");
        if (typeof levelBounds !== "undefined" && levelBounds) {
            this.windowed = false;
            return { l: levelBounds.minX - 100, r: levelBounds.maxX + 100, b: Math.min(b, -400) - 200, t: Math.max(t, levelBounds.topY) + 400 };
        }
        if (!frontier && isFinite(l) && r - l <= 16000) {
            this.windowed = false;
            return { l: l - 600, r: r + 600, b: b - 400, t: t + 1200 };
        }
        this.windowed = true;
        return { l: cx - 3200, r: cx + 3200, b: cy - 1800, t: cy + 2200 };
    }

    // ------------------------------------------------------------------ nodes
    static nodeKey(x, y) { return Math.floor(x / this.HCELL) * 73856093 ^ Math.floor(y / this.HCELL) * 19349663; }

    static hashNode(n) {
        var k = this.nodeKey(n.x, n.y);
        var a = this.nodeHash.get(k);
        if (!a) { a = []; this.nodeHash.set(k, a); }
        a.push(n);
    }

    static unhashNode(n) {
        var a = this.nodeHash.get(this.nodeKey(n.x, n.y));
        if (!a) return;
        var i = a.indexOf(n);
        if (i !== -1) a.splice(i, 1);
    }

    // nodes in a box (callback form avoids allocation)
    static forNodesIn(l, b, r, t, fn) {
        var cs = this.HCELL;
        var x0 = Math.floor(l / cs), x1 = Math.floor(r / cs), y0 = Math.floor(b / cs), y1 = Math.floor(t / cs);
        for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
            var a = this.nodeHash.get(gx * 73856093 ^ gy * 19349663);
            if (!a) continue;
            for (let i = 0; i < a.length; i++) {
                var n = a[i];
                if (n.x >= l && n.x <= r && n.y >= b && n.y <= t) fn(n);
            }
        }
    }

    static isMoverObj(s) { return s && s.gadget && s.gadget.type === "mover"; }

    // candidate surface points of static `s` inside region (l..r, b..t); positions are world-grid aligned
    static surfacePoints(s, reg, out) {
        if (!s || s.dead || s.noCollide || this.isMoverObj(s)) return;
        var bd = CollisionDetector.getBounds(s);
        var w = bd.right - bd.left, h = bd.top - bd.bottom;
        if (h > 520 && w <= 120) return;                         // tall boundary walls are not floors
        if (bd.top < reg.b || bd.top > reg.t) return;
        var L = Math.max(bd.left, this.bounds.l), R = Math.min(bd.right, this.bounds.r);
        if (R <= L) return;
        var base = { platLeft: bd.left, platRight: bd.right, isBumper: !!s.isBumper, bounceForce: s.bounceForce || 0, sourceId: s.id };
        var push = function(x, y, extra) {
            if (x < reg.l || x > reg.r) return;
            var n = { x: x, y: y, edges: [], inEdges: [], isRamp: false, isLeftEdge: false, isRightEdge: false };
            for (var k in base) n[k] = base[k];
            if (extra) for (var k2 in extra) n[k2] = extra[k2];
            out.push(n);
        };
        if (s.isRamp) {
            var steps = Math.max(2, Math.ceil(w / this.STEP));
            for (let k = 0; k <= steps; k++) {
                var t = k / steps;
                var nx = bd.left + t * w;
                if (nx < L || nx > R) continue;
                var ny = (s.rampDir == "left") ? (bd.top - t * h) : (bd.bottom + t * h);
                push(nx, ny, { isRamp: true, rampDir: s.rampDir, isLeftEdge: k === 0, isRightEdge: k === steps });
            }
            return;
        }
        var uL = L + 24, uR = R - 24;
        if (uR < uL) { push((L + R) / 2, bd.top, { isLeftEdge: true, isRightEdge: true }); return; }
        var leftIsEdge = Math.abs(L - bd.left) < 1, rightIsEdge = Math.abs(R - bd.right) < 1;
        push(uL, bd.top, { isLeftEdge: leftIsEdge });
        push(uR, bd.top, { isRightEdge: rightIsEdge });
        var st = this.STEP;
        for (let x = Math.ceil((uL + 40) / st) * st; x < uR - 40; x += st) push(x, bd.top);
    }

    // add generated candidates as nodes (skip buried / hazardous / duplicate)
    // Is a standing body at (x, y) inside the solid wedge of a ramp? (Ramps are not "solid blockers" because their
    // own surface is walkable, so floor nodes under a ramp used to stay in the graph. Enemies on the ramp then tried to
    // "walk" down to a node inside the rock and bounced back and forth: the bunker-bridges chase failure.)
    static insideRamp(ramps, x, y, ownId) {
        for (let i = 0; i < ramps.length; i++) {
            var s = ramps[i];
            if (s.id === ownId) continue;
            var bd = CollisionDetector.getBounds(s), w = bd.right - bd.left, h = bd.top - bd.bottom;
            if (x < bd.left + 2 || x > bd.right - 2 || w <= 0) continue;
            var t = (x - bd.left) / w;
            var surf = (s.rampDir == "left") ? (bd.top - t * h) : (bd.bottom + t * h);
            if (y < surf - 6 && y > bd.bottom) return true;
        }
        return false;
    }

    static addCandidates(cands) {
        var added = [];
        var ramps = (typeof staticObjects !== "undefined") ? staticObjects.filter(function(s) { return s.isRamp && !s.dead && !s.noCollide; }) : [];
        for (let i = 0; i < cands.length; i++) {
            var n = cands[i];
            if (this.isPointBlocked(n.x, n.y + 34, 42, 54, n.sourceId)) continue;
            if (ramps.length && this.insideRamp(ramps, n.x, n.y + 20, n.sourceId)) continue;
            if (this.inHazard(n.x, n.y + 2)) continue;
            var dup = null;
            this.forNodesIn(n.x - 28, n.y - 24, n.x + 28, n.y + 24, function(e) { if (!dup) dup = e; });
            if (dup) {
                if (n.isBumper) dup.isBumper = true;
                if (n.isLeftEdge) dup.isLeftEdge = true;
                if (n.isRightEdge) dup.isRightEdge = true;
                if (n.isRamp) dup.isRamp = true;
                continue;
            }
            n.id = this.nodes.length;
            this.nodes.push(n);
            this.hashNode(n);
            added.push(n);
        }
        return added;
    }

    // ------------------------------------------------------------------ edges
    // bit i set = profile i can take this edge (jump reach shrinks horizontally as the climb gets taller)
    static jumpMask(adx, dy) {
        var m = 0;
        for (let i = 0; i < NAV_PROFILE_LIST.length; i++) {
            var p = NAV_PROFILE_LIST[i];
            var up = Math.max(0, dy);
            if (up > p.up) continue;
            if (adx > p.gap * (1 - 0.45 * up / p.up) + 40) continue;
            m |= 1 << i;
        }
        return m;
    }

    static addEdge(a, b, action, cost, mask, extra) {
        var e = { to: b.id, from: a.id, action: action, cost: cost, mask: mask };
        if (extra) for (var k in extra) e[k] = extra[k];
        if (e.special) a.hasSpecial = true;
        a.edges.push(e);
        return e;
    }

    static buildEdgesFor(a) {
        a.edges = [];
        var self = this;
        var ALL = (1 << NAV_PROFILE_LIST.length) - 1;
        if (a.isBumper) { this.buildBounceEdges(a, ALL); return; }
        this.forNodesIn(a.x - 420, a.y - 1100, a.x + 420, a.y + 560, function(b) {
            if (b === a) return;
            var dx = b.x - a.x, adx = Math.abs(dx), dy = b.y - a.y;
            var dist = Math.hypot(dx, dy);
            // stepping onto a bounce pad always launches you: only worth it when the bounce helps
            var padCost = b.isBumper ? 90 : 0;
            // 1. walk / ramp
            if (adx <= 160 && Math.abs(dy) <= 130 && (Math.abs(dy) <= 44 || a.isRamp || b.isRamp)) {
                if (self.hasLineClearance(a.x, a.y, b.x, b.y) && !self.segmentHitsHazard(a.x, a.y, b.x, b.y)) {
                    self.addEdge(a, b, "walk", dist * (dy > 10 ? 1.1 : 1.0) + padCost, ALL);
                    return;
                }
            }
            // 3. drop off a ledge
            if (dy < -28 && adx >= 24 && adx <= 300) {
                var offL = dx < 0 && a.isLeftEdge && b.x < a.platLeft + 16;
                var offR = dx > 0 && a.isRightEdge && b.x > a.platRight - 16;
                if (offL || offR) {
                    var ox = dx < 0 ? a.platLeft - 28 : a.platRight + 28;
                    if (!self.isPointBlocked(ox, a.y + 34, 38, 52) && self.hasLineClearance(ox, a.y, b.x, b.y)) {
                        self.addEdge(a, b, "drop", dist * 1.05 + 12 + Math.max(0, -dy - 400) * 0.5, ALL, { fromX: ox });
                        return;
                    }
                }
            }
            // 4. jump (up onto a ledge or across a gap); skip pointless hops along the same surface
            if (dy >= -45 && dy <= 560 && adx <= 430 && !(Math.abs(dy) < 20 && adx <= 160)) {
                var sameSurface = a.sourceId === b.sourceId && Math.abs(dy) < 20;
                if (sameSurface) return;
                var mask = self.jumpMask(adx, dy);
                if (mask && self.hasJumpClearance(a.x, a.y, b.x, b.y) && !self.inHazard(b.x, b.y + 2)) {
                    self.addEdge(a, b, "jump", dist * 1.35 + 30 + Math.max(0, dy) * 0.4 + padCost, mask, { dy: dy, adx: adx });
                }
            }
        });
        // builder-only edges: bridge across a gap from a ledge, or tower straight up to a higher floor
        if (a.isLeftEdge || a.isRightEdge) {
            this.forNodesIn(a.x - 1000, a.y - 60, a.x + 1000, a.y + 60, function(b) {
                if (b === a || b.sourceId === a.sourceId) return;
                var dx = b.x - a.x;
                if ((dx < 0 && !a.isLeftEdge) || (dx > 0 && !a.isRightEdge)) return;
                if (Math.abs(dx) < 200) return;
                if (!self.hasLineClearance(a.x, a.y + 4, b.x, b.y + 4)) return;
                var blocks = Math.ceil(Math.abs(dx) / 40);
                self.addEdge(a, b, "bridge", Math.abs(dx) * 1.2 + blocks * 25, 0, { build: true, blocks: blocks });
            });
        }
        this.forNodesIn(a.x - 160, a.y + 200, a.x + 160, a.y + 700, function(b) {
            if (b === a) return;
            var dy = b.y - a.y;
            if (!self.hasLineClearance(a.x, a.y, a.x, b.y + 20)) return;
            var blocks = Math.ceil(dy / 40);
            self.addEdge(a, b, "tower", dy * 1.6 + blocks * 25, 0, { build: true, blocks: blocks });
        });
    }

    // A pad launches everyone straight up (~F^2/1.6 px for bounce force F); in the air an agent can steer
    // ~400px sideways, so every landing spot inside that envelope is a bounce edge. Nothing else leaves a pad.
    static buildBounceEdges(a, ALL) {
        var self = this;
        var F = a.bounceForce || 24;
        var H = F * F / 1.6;
        if (!this.hasLineClearance(a.x, a.y, a.x, a.y + Math.max(60, H - 60))) H = 140;   // low ceiling over the pad
        this.forNodesIn(a.x - 460, a.y - 420, a.x + 460, a.y + H, function(b) {
            if (b === a || b.isBumper && Math.abs(b.y - a.y) < 30) return;
            var dx = b.x - a.x, dy = b.y - a.y, adx = Math.abs(dx);
            if (dy > H - 30) return;
            var reach = 120 + 330 * Math.min(1, (H - Math.max(0, dy)) / H + 0.3);
            if (adx > reach) return;
            var apexX = a.x + dx * 0.35, apexY = Math.max(a.y, b.y) + 60;
            if (!self.hasLineClearance(apexX, apexY - 40, b.x, b.y + 10)) return;
            self.addEdge(a, b, "bounce", Math.hypot(dx, dy) * 0.8 + 20, ALL);
        });
    }

    static addSpecialEdges() {
        for (let i = 0; i < this.nodes.length; i++) {
            var nd = this.nodes[i];
            if (nd && nd.hasSpecial) { nd.edges = nd.edges.filter(function(e) { return !e.special; }); nd.hasSpecial = false; }
        }
        // moving platforms: wait at one end, ride, step off at the other
        if (typeof Gadgets !== "undefined" && Gadgets.list) {
            for (let i = 0; i < Gadgets.list.length; i++) {
                var g = Gadgets.list[i];
                if (g.type !== "mover" || !g.obj) continue;
                var endA = { x: g.ax, y: g.ay + g.h / 2 }, endB = { x: g.x2, y: g.y2 + g.h / 2 };
                var na = this.closestNodeTo(endA.x, endA.y, 300), nb = this.closestNodeTo(endB.x, endB.y, 300);
                if (!na || !nb || na === nb) continue;
                var len = Math.hypot(endB.x - endA.x, endB.y - endA.y);
                var ALL = (1 << NAV_PROFILE_LIST.length) - 1;
                this.addEdge(na, nb, "ride", len * 1.2 + 140, ALL, { special: true, mover: g, boardX: endA.x, boardY: endA.y, exitX: endB.x, exitY: endB.y });
                this.addEdge(nb, na, "ride", len * 1.2 + 140, ALL, { special: true, mover: g, boardX: endB.x, boardY: endB.y, exitX: endA.x, exitY: endA.y });
            }
        }
        // registered links (portals etc.)
        for (let i = 0; i < this.links.length; i++) {
            var L = this.links[i];
            var a = this.closestNodeTo(L.ax, L.ay, 260), b = this.closestNodeTo(L.bx, L.by, 260);
            if (!a || !b || a === b) continue;
            this.addEdge(a, b, L.action || "teleport", L.cost || 80, (1 << NAV_PROFILE_LIST.length) - 1, { special: true, enterX: L.ax, enterY: L.ay, link: L });
        }
    }

    static rebuildInEdges() {
        var E = 0;
        for (let i = 0; i < this.nodes.length; i++) if (this.nodes[i]) this.nodes[i].inEdges = [];
        for (let i = 0; i < this.nodes.length; i++) {
            var a = this.nodes[i];
            if (!a) continue;
            for (let k = 0; k < a.edges.length; k++) {
                var e = a.edges[k];
                var b = this.nodes[e.to];
                if (!b) { a.edges.splice(k, 1); k--; continue; }
                b.inEdges.push(e);
                E++;
            }
        }
        this.stats.edges = E;
        this.stats.nodes = this.nodes.filter(Boolean).length;
        this.fields.clear();
        this.graphVersion = (this.graphVersion || 0) + 1;
    }

    // ------------------------------------------------------------------ full rebuild / patching
    static rebuildGraph(force = false) {
        if (typeof staticObjects === "undefined" || typeof CollisionDetector === "undefined") return;
        if (!this.stats) { this.init(); return; }
        var now = Date.now();
        if (!force && now - (this.lastRebuildTime || 0) < 250 && this.nodes && this.nodes.length > 0) return;
        this.lastRebuildTime = now;
        var t0 = performance.now();
        this.bounds = this.computeBounds();
        this.lastRebuildCenterX = (typeof cameraTargetX !== "undefined") ? cameraTargetX : 0;
        this.lastRebuildCenterY = (typeof cameraTargetY !== "undefined") ? cameraTargetY : 0;
        this.nodes = [];
        this.nodeHash = new Map();
        this.bigBlockers = [];
        this.buildBlockerHash();
        this.collectHazards();
        var cands = [];
        for (let i = 0; i < staticObjects.length; i++) this.surfacePoints(staticObjects[i], this.bounds, cands);
        this.addCandidates(cands);
        for (let i = 0; i < this.nodes.length; i++) this.buildEdgesFor(this.nodes[i]);
        this.addSpecialEdges();
        this.rebuildInEdges();
        this.stats.lastBuildMs = +(performance.now() - t0).toFixed(2);
    }

    // Patch the graph after geometry inside the box (centre x,y + size) changed: placed/broken blocks,
    // doors opening, editor edits. Only nodes and edges near the box are rebuilt.
    static invalidateRect(x, y, w, h) {
        if (!this.nodes || !this.bounds || !this.nodeHash) { this.rebuildGraph(true); return; }
        var t0 = performance.now();
        var reg = { l: x - w / 2 - 80, r: x + w / 2 + 80, b: y - h / 2 - 80, t: y + h / 2 + 80 };
        this.buildBlockerHash();
        this.collectHazards();
        var self = this;
        // 1. drop nodes in the region
        var doomed = [];
        this.forNodesIn(reg.l, reg.b, reg.r, reg.t, function(n) { doomed.push(n); });
        for (let i = 0; i < doomed.length; i++) { this.unhashNode(doomed[i]); this.nodes[doomed[i].id] = null; }
        // 2. regenerate surface points in the region
        var cands = [];
        var list = staticObjects;
        for (let i = 0; i < list.length; i++) {
            var s = list[i];
            if (!s || s.dead) continue;
            var hw = (s.w || 40) / 2, hh = (s.h || 40) / 2;
            if (s.x + hw < reg.l || s.x - hw > reg.r || s.y + hh < reg.b - 10 || s.y - hh > reg.t) continue;
            this.surfacePoints(s, reg, cands);
        }
        this.addCandidates(cands);
        // 3. rebuild outgoing edges of everything that could reach into the region
        this.forNodesIn(reg.l - 1000, reg.b - 700, reg.r + 1000, reg.t + 1100, function(n) { self.buildEdgesFor(n); });
        this.addSpecialEdges();
        this.rebuildInEdges();
        this.stats.lastPatchMs = +(performance.now() - t0).toFixed(2);
    }

    static shiftWorld(dx) {
        if (!this.nodes) return;
        for (let i = 0; i < this.nodes.length; i++) {
            var n = this.nodes[i];
            if (!n) continue;
            n.x -= dx; n.platLeft -= dx; n.platRight -= dx;
            for (let k = 0; k < n.edges.length; k++) {
                var e = n.edges[k];
                if (e.fromX !== undefined) e.fromX -= dx;
                if (e.enterX !== undefined) e.enterX -= dx;
            }
        }
        if (this.bounds) { this.bounds.l -= dx; this.bounds.r -= dx; }
        this.lastRebuildCenterX -= dx;
        // rehash everything at the new coordinates
        this.nodeHash = new Map();
        for (let i = 0; i < this.nodes.length; i++) if (this.nodes[i]) this.hashNode(this.nodes[i]);
        this.buildBlockerHash();
        this.collectHazards();
    }

    // ------------------------------------------------------------------ links (portals ...)
    static addLink(ax, ay, bx, by, action, data) {
        var L = { ax: ax, ay: ay, bx: bx, by: by, action: action || "teleport", tag: data && data.tag, cost: data && data.cost };
        this.links.push(L);
        return L;
    }

    // re-attach link + mover edges after links changed (cheap; no geometry rebuild)
    static refreshLinks() {
        if (!this.nodes || !this.nodeHash) return;
        this.addSpecialEdges();
        this.rebuildInEdges();
    }

    static clearLinks(tag) {
        this.links = tag ? this.links.filter(function(l) { return l.tag !== tag; }) : [];
    }

    // ------------------------------------------------------------------ lookups
    static closestNodeTo(wx, wy, maxD) {
        var best = null, bd = Infinity;
        this.forNodesIn(wx - maxD, wy - maxD, wx + maxD, wy + maxD, function(n) {
            var d = Math.hypot(n.x - wx, n.y - wy);
            if (d < bd) { bd = d; best = n; }
        });
        return best;
    }

    // best node for an entity whose feet are at (wx, wy): prefers the surface under / just below the feet
    static findClosestNode(wx, wy) {
        if (!this.nodes || this.nodes.length === 0) return null;
        var best = null, bestScore = Infinity;
        var scan = function(n) {
            var dx = Math.abs(n.x - wx), dy = wy - n.y;
            var vp = (dy >= -24 && dy <= 160) ? Math.abs(dy) * 1.3 : (dy > 160 ? dy * 2.2 : Math.abs(dy) * 6.5 + 450);
            var sc = dx + vp;
            if (sc < bestScore) { bestScore = sc; best = n; }
        };
        this.forNodesIn(wx - 400, wy - 700, wx + 400, wy + 260, scan);
        if (!best) for (let i = 0; i < this.nodes.length; i++) if (this.nodes[i]) scan(this.nodes[i]);
        return best;
    }

    // goal lookups are shared by every enemy chasing the same spot this frame
    static goalNode(x, y) {
        if (this._goalFrame !== this.frameNo) { this._goalFrame = this.frameNo; this._goalCache = new Map(); }
        var key = Math.round(x / 30) * 100003 + Math.round(y / 30);
        var hit = this._goalCache.get(key);
        if (hit !== undefined) return hit;
        var n = this.findClosestNode(x, y);
        this._goalCache.set(key, n);
        return n;
    }

    static profileOf(ch) {
        if (ch.navProfile) return NAV_PROFILES[ch.navProfile] || ch.navProfile;
        var p = ch.zombiePower;
        if (p == "LEAPER") return NAV_PROFILES.leaper;
        if (p == "SLIME" || p == "MINI_SLIME") return NAV_PROFILES.high;
        return NAV_PROFILES.normal;
    }

    static edgeAllowed(e, prof, builder) {
        if (e.build) return !!builder;
        return (e.mask & (1 << prof.idx)) !== 0;
    }

    // ------------------------------------------------------------------ shared flow fields
    static getField(goal, prof, builder) {
        var key = goal.id * 8 + prof.idx * 2 + (builder ? 1 : 0);
        var f = this.fields.get(key);
        var fresh = f && f.version === this.graphVersion && this.frameNo - f.frame < 18;
        if (fresh) return f;
        if (this.fieldsThisFrame >= 6) return (f && f.version === this.graphVersion) ? f : null;   // per-frame budget
        this.fieldsThisFrame++;
        var n = this.nodes.length;
        if (!f || f.dist.length !== n) f = { dist: new Float32Array(n) };
        f.dist.fill(Infinity);
        f.frame = this.frameNo; f.version = this.graphVersion; f.goal = goal.id;
        var dist = f.dist, heap = new NavHeap();
        dist[goal.id] = 0;
        heap.push(goal.id, 0);
        while (heap.size) {
            var u = heap.pop();
            var du = dist[u], node = this.nodes[u];
            if (!node) continue;
            var ins = node.inEdges;
            for (let i = 0; i < ins.length; i++) {
                var e = ins[i];
                if (!this.edgeAllowed(e, prof, builder)) continue;
                var nd = du + e.cost;
                if (nd < dist[e.from]) { dist[e.from] = nd; heap.push(e.from, nd); }
            }
        }
        this.fields.set(key, f);
        this.stats.fields = this.fields.size;
        if (this.fields.size > 64) {                       // drop the oldest fields
            var oldest = null, ok = null;
            this.fields.forEach(function(v, k) { if (!oldest || v.frame < oldest.frame) { oldest = v; ok = k; } });
            this.fields.delete(ok);
        }
        return f;
    }

    static crowdCount(id) {
        if (this.crowdFrame !== this.frameNo) return 0;
        return this.crowd.get(id) || 0;
    }

    static addCrowd(id) {
        if (this.crowdFrame !== this.frameNo) { this.crowd.clear(); this.crowdFrame = this.frameNo; }
        this.crowd.set(id, (this.crowd.get(id) || 0) + 1);
    }

    // follow the field from node `cur` for a few hops -> waypoint list (keeps zombie.navPath meaningful)
    static chainFromField(f, cur, prof, builder, agent, goalX, goalY) {
        var path = [];
        var node = cur;
        var self = this;
        for (let hop = 0; hop < 7 && node; hop++) {
            if (f.dist[node.id] === 0) break;
            var best = null, bestCost = Infinity;
            for (let i = 0; i < node.edges.length; i++) {
                var e = node.edges[i];
                if (!this.edgeAllowed(e, prof, builder)) continue;
                var dTo = f.dist[e.to];
                if (dTo === Infinity || dTo >= f.dist[node.id]) continue; // every hop must make progress; crowd costs must not create loops
                if (agent && agent.navBan && agent.navBan[node.id + ">" + e.to] > this.frameNo) continue;
                var c = e.cost + dTo + (hop === 0 ? this.crowdCount(e.to) * 45 : 0);
                if (c < bestCost) { bestCost = c; best = e; }
            }
            if (!best) break;
            var nx = this.nodes[best.to];
            path.push(self.waypoint(best, node, nx));
            node = nx;
        }
        if (path.length && agent) this.addCrowd(path[0].nodeId);
        if (goalX !== undefined && (path.length === 0 || f.dist[node.id] === 0)) {
            var last = path.length ? path[path.length - 1] : cur;
            if (this.hasLineClearance(last.x, last.y, goalX, goalY)) path.push({ x: goalX, y: goalY, action: "walk" });
        }
        return path;
    }

    static waypoint(e, from, to) {
        return { x: to.x, y: to.y, action: e.action, nodeId: to.id, fromId: from.id, fromX: e.fromX !== undefined ? e.fromX : from.x, fromY: from.y,
                 edge: e, mover: e.mover, enterX: e.enterX, blocks: e.blocks,
                 boardX: e.boardX, boardY: e.boardY, exitX: e.exitX, exitY: e.exitY };
    }

    // ------------------------------------------------------------------ A* (one-off goals + fallback)
    static findPath(startX, startY, goalX, goalY, prof, builder) {
        this.ensureFresh();
        if (!this.nodes || this.nodes.length === 0) return [];
        prof = prof || NAV_PROFILES.leaper;
        var start = this.findClosestNode(startX, startY), goal = this.findClosestNode(goalX, goalY);
        if (!start || !goal) return [];
        if (start === goal) return [{ x: goalX, y: goalY, action: "walk" }];
        var n = this.nodes.length;
        var g = new Float32Array(n).fill(Infinity), came = new Int32Array(n).fill(-1);
        var cameEdge = new Array(n), closed = new Uint8Array(n);
        var heap = new NavHeap();
        g[start.id] = 0;
        heap.push(start.id, Math.hypot(goal.x - start.x, goal.y - start.y));
        var found = false, expanded = 0;
        while (heap.size && expanded < 4000) {
            var u = heap.pop();
            if (closed[u]) continue;
            closed[u] = 1; expanded++;
            if (u === goal.id) { found = true; break; }
            var node = this.nodes[u];
            if (!node) continue;
            for (let i = 0; i < node.edges.length; i++) {
                var e = node.edges[i];
                if (!this.edgeAllowed(e, prof, builder) || closed[e.to]) continue;
                var ng = g[u] + e.cost;
                if (ng < g[e.to]) {
                    g[e.to] = ng; came[e.to] = u; cameEdge[e.to] = e;
                    var nb = this.nodes[e.to];
                    heap.push(e.to, ng + Math.hypot(goal.x - nb.x, goal.y - nb.y));
                }
            }
        }
        var endId = goal.id;
        if (!found) {
            // unreachable: head for the explored node closest to the goal
            var bd = Infinity; endId = -1;
            for (let i = 0; i < n; i++) if (closed[i] && this.nodes[i]) {
                var d = Math.hypot(this.nodes[i].x - goalX, this.nodes[i].y - goalY);
                if (d < bd) { bd = d; endId = i; }
            }
            if (endId === -1 || endId === start.id) return [{ x: goalX, y: goalY, action: (goalY > startY + 60) ? "jump" : "walk" }];
        }
        var path = [];
        for (var c = endId; c !== start.id && c !== -1; c = came[c]) {
            path.unshift(this.waypoint(cameEdge[c], this.nodes[came[c]], this.nodes[c]));
        }
        if (found && this.hasLineClearance(goal.x, goal.y, goalX, goalY)) path.push({ x: goalX, y: goalY, action: "walk" });
        return path;
    }

    // windowed graphs follow the camera
    static ensureFresh() {
        if (!this.nodes || this.nodes.length === 0) { this.rebuildGraph(true); return; }
        if (this.windowed && typeof cameraTargetX !== "undefined") {
            if (Math.abs(cameraTargetX - this.lastRebuildCenterX) > 1500 || Math.abs((cameraTargetY || 0) - this.lastRebuildCenterY) > 1000) this.rebuildGraph(true);
        }
    }

    // called once per simulation tick from frame()
    static beginFrame() {
        if (!this.stats) return;
        this.frameNo++;
        this.fieldsThisFrame = 0;
        this._msFrames++;
        if (this._msFrames >= 60) {
            this.stats.ms = +(this._msAcc / this._msFrames).toFixed(3);
            this._msAcc = 0; this._msFrames = 0;
        }
    }

    // ------------------------------------------------------------------ agent steering
    static updateZombieNavigation(zombie, target) {
        var t0 = performance.now();
        try { this.steer(zombie, target); }
        finally { this._msAcc += performance.now() - t0; }
    }

    static steer(z, target) {
        this.ensureFresh();
        // Node IDs are rebuilt after streaming or editing geometry. Discard routes and bans
        // from the old graph before interpreting those IDs in the new one.
        if (z.navVersion !== this.graphVersion) {
            z.navVersion = this.graphVersion;
            z.navNodeId = undefined; z.navPath = []; z.navBan = {};
            z.navReplan = 0; z.navAstarCd = 0;
        }
        var footY = z.y - z.s2 / 2;
        var tFoot = target.y - (target.s2 || 80) / 2;
        var prof = this.profileOf(z), builder = !!z.navBuilder;

        // Direct pursuit on the same floor, only with a clear line and continuous ground in between
        if (z.onGround && Math.abs(target.x - z.x) < 340 && Math.abs(tFoot - footY) < 48 && this.directOk(z.x, footY, target.x, tFoot)) {
            z.navPath = [];
            z.navDirect = true;
            if (target.x > z.x + 10) z.rightPressed = true;
            else if (target.x < z.x - 10) z.leftPressed = true;
            this.stepOverLip(z);
            return;
        }
        z.navDirect = false;

        // stuck detection (on the ground, wanting to move, not moving)
        if (z.lastNavX === undefined) { z.lastNavX = z.x; z.stuckTimer = 0; }
        if (Math.abs(z.x - z.lastNavX) < 3 && z.onGround) z.stuckTimer++;
        else { z.lastNavX = z.x; z.stuckTimer = 0; }

        // current node: re-pick while grounded (mid-air we keep the edge we committed to)
        if ((z.onGround && (Math.abs(z.x - (z.navLookX || 1e9)) > 18 || Math.abs(footY - z.navLookY) > 18)) || z.navNodeId === undefined || !this.nodes[z.navNodeId]) {
            var cn = this.findClosestNode(z.x, footY);
            z.navNodeId = cn ? cn.id : undefined;
            z.navLookX = z.x; z.navLookY = footY;
        }
        var cur = this.nodes[z.navNodeId];
        if (!cur) { this.fallbackSteer(z, target.x, tFoot); return; }

        if (z.stuckTimer > 45 && z.navPath && z.navPath[0] && z.navPath[0].fromId !== undefined) {
            z.navBan = z.navBan || {};
            z.navBan[z.navPath[0].fromId + ">" + z.navPath[0].nodeId] = this.frameNo + 300;
            z.stuckTimer = 0;
            z.upPressed = true;
            z.navReplan = 0;
        }

        // re-plan when the node changes or every ~12 frames
        var goal = this.goalNode(target.x, tFoot);
        z.navReplan = (z.navReplan || 0) - 1;
        if (z.onGround && (z.navReplan <= 0 || z.navPlannedFrom !== cur.id || z.navGoalId !== (goal && goal.id))) {
            z.navReplan = 10 + (z.id % 6);
            z.navPlannedFrom = cur.id;
            z.navGoalId = goal && goal.id;
            var path = null, f = null;
            if (goal) {
                f = this.getField(goal, prof, builder);
                if (f && f.dist[cur.id] !== Infinity) path = this.chainFromField(f, cur, prof, builder, z, target.x, tFoot);
            }
            if (!path || path.length === 0) {
                // field budget used up this frame: keep the current route a little longer
                if (goal && !f && z.navPath && z.navPath.length) { path = z.navPath; z.navReplan = 2; }
                // goal unreachable for this profile: A* towards the closest reachable spot
                else if ((z.navAstarCd || 0) <= 0) { path = this.findPath(z.x, footY, target.x, tFoot, prof, builder); z.navAstarCd = 40; }
                else path = z.navPath || [];
            }
            z.navPath = path;
            // Progress watchdog. If the route length from the enemy's node does not get shorter for about 2.5 s, the
            // enemy is swinging between two hops (a graph error, a pad, a crowd). Ban the hop it keeps trying, replan.
            if (goal && f && f.dist[cur.id] !== Infinity) {
                var dn = f.dist[cur.id];
                if (z.navWdGx === undefined || Math.hypot(goal.x - z.navWdGx, goal.y - z.navWdGy) > 450) { z.navWdGx = goal.x; z.navWdGy = goal.y; z.navWdBest = dn; z.navWdT = 0; }
                else if (dn < z.navWdBest - 40) { z.navWdBest = dn; z.navWdT = 0; }
                else z.navWdT += 12;
                if (z.navWdT > 150 && path && path.length && path[0].fromId !== undefined) {
                    z.navBan = z.navBan || {};
                    z.navBan[path[0].fromId + ">" + path[0].nodeId] = this.frameNo + 420;
                    z.navWdT = 0; z.navWdBest = dn; z.navReplan = 0; z.navWdBans = (z.navWdBans || 0) + 1;
                }
            }
        }
        if (z.navAstarCd > 0) z.navAstarCd--;
        this.follow(z, target.x, tFoot);
    }

    static directOk(x1, y1, x2, y2) {
        if (!this.hasLineClearance(x1, y1, x2, y2)) return false;
        var n = Math.ceil(Math.abs(x2 - x1) / 40);
        for (let i = 1; i < n; i++) {
            var x = x1 + (x2 - x1) * i / n;
            if (!this.groundBelow(x, y1 + (y2 - y1) * i / n, 70)) return false;
            if (this.inHazard(x, y1 + 4)) return false;
        }
        return true;
    }

    // hop small lips / blocked steps while walking
    static stepOverLip(z) {
        var dir = z.rightPressed ? 1 : (z.leftPressed ? -1 : 0);
        if (!dir || !z.onGround) return;
        if (CollisionDetector.collision(z, [dir * 12, 0], staticObjects) && !z.collidedRamp) z.upPressed = true;
    }

    static fallbackSteer(z, tx, ty) {
        if (tx > z.x + 15) z.rightPressed = true; else if (tx < z.x - 15) z.leftPressed = true;
        this.stepOverLip(z);
    }

    static follow(z, goalX, goalY) {
        var footY = z.y - z.s2 / 2;
        var path = z.navPath || [];
        // launched by a pad: the pad waypoint is done, steer for the landing
        if (!z.onGround && path.length > 1 && path[1].action === "bounce" && footY > path[0].y + 30) path.shift();
        // advance past reached waypoints
        while (path.length > 1) {
            var w0 = path[0];
            if (Math.abs(w0.x - z.x) < 30 && Math.abs(w0.y - footY) < 46 && (z.onGround || w0.action === "walk")) path.shift();
            else break;
        }
        var wp = path[0] || { x: goalX, y: goalY, action: "walk" };
        var dx = wp.x - z.x, dy = wp.y - footY;
        var act = wp.action;
        var goRight = function() { z.rightPressed = true; z.leftPressed = false; };
        var goLeft = function() { z.leftPressed = true; z.rightPressed = false; };
        var steerTo = function(x, dead) { if (x > z.x + (dead || 8)) goRight(); else if (x < z.x - (dead || 8)) goLeft(); };

        if (act === "jump") {
            if (z.onGround) {
                var fromX = wp.fromX !== undefined ? wp.fromX : z.x;
                var atTakeoff = Math.abs(z.x - fromX) < 34;
                var gap = Math.abs(dy) <= 45;
                if (gap) {
                    // run toward the gap; take off at the platform edge with full speed
                    steerTo(wp.x);
                    if (atTakeoff || (Math.abs(dx) < 300 && !this.groundBelow(z.x + Math.sign(dx) * 40, footY, 40))) z.upPressed = true;
                } else {
                    // climb: get under / beside the ledge first, then jump and hold
                    if (Math.abs(dx) > 150 && !atTakeoff) steerTo(fromX);
                    else { steerTo(wp.x, 4); z.upPressed = true; }
                }
            } else {
                steerTo(wp.x, 4);
                if (z.yspeed > 0 && footY < wp.y + 70) z.upPressed = true;          // hold for full height
            }
        } else if (act === "bounce") {
            steerTo(z.onGround ? (wp.fromX !== undefined ? wp.fromX : wp.x) : wp.x);
        } else if (act === "drop") {
            steerTo(wp.x);          // walk off the edge; never jump
        } else if (act === "ride") {
            this.followRide(z, wp, footY, steerTo);
        } else if (act === "teleport") {
            steerTo(wp.enterX !== undefined ? wp.enterX : wp.x, 2);
        } else if ((act === "bridge" || act === "tower") && typeof z.navBuild === "function") {
            z.navBuild(z, wp);
        } else {
            steerTo(wp.x);
            this.stepOverLip(z);
            if (dy > 52 && Math.abs(dx) < 160 && z.onGround && this.hasLineClearance(z.x, footY, wp.x, wp.y)) z.upPressed = true;
        }
    }

    static followRide(z, wp, footY, steerTo) {
        var g = wp.mover;
        if (!g || !g.obj) { steerTo(wp.x); return; }
        var top = g.obj.y + g.h / 2;
        var onIt = Math.abs(footY - top) < 14 && Math.abs(z.x - g.obj.x) < g.w / 2 - 6;
        if (onIt) {
            var nearExit = Math.hypot(g.obj.x - wp.exitX, top - wp.exitY) < 90;
            if (nearExit) steerTo(wp.x);
            else steerTo(g.obj.x, 18);            // stay centred while riding
            return;
        }
        var arrived = Math.hypot(g.obj.x - wp.boardX, top - wp.boardY) < 70;
        if (arrived && Math.abs(top - footY) < 40) steerTo(g.obj.x, 10);     // step on
        else steerTo(wp.fromX !== undefined ? wp.fromX : wp.boardX, 14);     // wait at the boarding point
    }

    // ------------------------------------------------------------------ flyers: coarse air grid A*
    // Returns the next point to fly toward. Straight line when clear, otherwise a cached grid path.
    static flySteer(ch, tx, ty) {
        var t0 = performance.now();
        try {
            if (!this.blockHash) this.buildBlockerHash();
            var hw = (ch.s1 || 56) / 2 + 6, hh = (ch.s2 || 56) / 2 + 6;
            if (this.airClear(ch.x, ch.y, tx, ty, hw, hh)) { ch.flyPath = null; return { x: tx, y: ty }; }
            var stale = !ch.flyPath || (ch.flyPathT || 0) <= 0 || Math.hypot(ch.flyGoalX - tx, ch.flyGoalY - ty) > 160;
            if (stale) {
                ch.flyPath = this.airAstar(ch.x, ch.y, tx, ty, hw, hh);
                ch.flyPathT = 24 + (ch.id % 8);
                ch.flyGoalX = tx; ch.flyGoalY = ty;
            } else ch.flyPathT--;
            var p = ch.flyPath;
            if (!p || !p.length) return { x: tx, y: ty };
            // skip ahead to the furthest waypoint in sight
            while (p.length > 1 && this.airClear(ch.x, ch.y, p[1].x, p[1].y, hw, hh)) p.shift();
            if (p.length === 1 && Math.hypot(p[0].x - ch.x, p[0].y - ch.y) < 40) p.shift();
            return p[0] || { x: tx, y: ty };
        } finally { this._msAcc += performance.now() - t0; }
    }

    static airClear(x1, y1, x2, y2, hw, hh) {
        var d = Math.hypot(x2 - x1, y2 - y1);
        var n = Math.max(1, Math.ceil(d / 40));
        for (let i = 1; i <= n; i++) {
            var t = i / n;
            if (this.boxBlocked(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, hw * 0.8, hh * 0.8)) return false;
        }
        return true;
    }

    static airAstar(sx, sy, tx, ty, hw, hh) {
        var C = 80;
        var l = Math.min(sx, tx) - 900, r = Math.max(sx, tx) + 900, b = Math.min(sy, ty) - 600, t = Math.max(sy, ty) + 900;
        var W = Math.min(90, Math.ceil((r - l) / C)), H = Math.min(60, Math.ceil((t - b) / C));
        var cx = function(x) { return Math.max(0, Math.min(W - 1, Math.floor((x - l) / C))); };
        var cy = function(y) { return Math.max(0, Math.min(H - 1, Math.floor((y - b) / C))); };
        var N = W * H, blocked = new Uint8Array(N), g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1);
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            if (this.boxBlocked(l + (i + 0.5) * C, b + (j + 0.5) * C, Math.max(hw, C * 0.45), Math.max(hh, C * 0.45))) blocked[j * W + i] = 1;
        }
        var s = cy(sy) * W + cx(sx), goal = cy(ty) * W + cx(tx);
        blocked[s] = 0;
        var heap = new NavHeap();
        g[s] = 0; heap.push(s, 0);
        var gx = goal % W, gy = (goal / W) | 0;
        var best = s, bestH = Infinity;
        var closed = new Uint8Array(N);
        while (heap.size) {
            var u = heap.pop();
            if (closed[u]) continue;
            closed[u] = 1;
            var ux = u % W, uy = (u / W) | 0;
            var hgt = Math.hypot(ux - gx, uy - gy);
            if (hgt < bestH) { bestH = hgt; best = u; }
            if (u === goal) break;
            for (let ddx = -1; ddx <= 1; ddx++) for (let ddy = -1; ddy <= 1; ddy++) {
                if (!ddx && !ddy) continue;
                var vx = ux + ddx, vy = uy + ddy;
                if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
                var v = vy * W + vx;
                if (blocked[v] || closed[v]) continue;
                if (ddx && ddy && (blocked[uy * W + vx] || blocked[vy * W + ux])) continue;   // no corner cutting
                var ng = g[u] + (ddx && ddy ? 1.414 : 1);
                if (ng < g[v]) { g[v] = ng; came[v] = u; heap.push(v, ng + Math.hypot(vx - gx, vy - gy)); }
            }
        }
        var out = [];
        for (var c = best; c !== -1 && c !== s; c = came[c]) out.unshift({ x: l + (c % W + 0.5) * C, y: b + (((c / W) | 0) + 0.5) * C });
        if (best === goal) out.push({ x: tx, y: ty });
        return out;
    }

    // ------------------------------------------------------------------ debug overlay (P key / dev panel)
    static drawDebug() {
        if (!this.showDebug || !this.nodes) return;
        ctx.save();
        var colors = { walk: "rgba(136,204,153,0.35)", jump: "rgba(255,221,68,0.45)", drop: "rgba(96,165,250,0.45)", bounce: "rgba(255,46,99,0.6)",
                       ride: "rgba(192,132,252,0.8)", teleport: "rgba(251,146,60,0.8)", bridge: "rgba(255,255,255,0.12)", tower: "rgba(255,255,255,0.12)" };
        ctx.lineWidth = 1.2;
        for (let i = 0; i < this.nodes.length; i++) {
            var n = this.nodes[i];
            if (!n) continue;
            var sx = n.x * cameraScaleX + xc, sy = -n.y * cameraScaleY + yc;
            if (sx < -400 || sx > cssW + 400 || sy < -400 || sy > cssH + 400) continue;
            for (let k = 0; k < n.edges.length; k++) {
                var e = n.edges[k];
                if (e.build) continue;
                var b = this.nodes[e.to];
                if (!b) continue;
                ctx.strokeStyle = colors[e.action] || "#fff";
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                var bx = b.x * cameraScaleX + xc, by = -b.y * cameraScaleY + yc;
                if (e.action === "jump") ctx.quadraticCurveTo((sx + bx) / 2, Math.min(sy, by) - 50 * cameraScaleY, bx, by);
                else ctx.lineTo(bx, by);
                ctx.stroke();
            }
        }
        for (let i = 0; i < this.nodes.length; i++) {
            var n2 = this.nodes[i];
            if (!n2) continue;
            ctx.fillStyle = n2.isRamp ? "#00f5d4" : (n2.isBumper ? "#ff2e63" : (n2.isLeftEdge || n2.isRightEdge ? "#ffdd44" : "#88cc99"));
            ctx.beginPath();
            ctx.arc(n2.x * cameraScaleX + xc, -n2.y * cameraScaleY + yc, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }
        // active enemy routes
        for (let z = 0; z < zombies.length; z++) {
            var zom = zombies[z];
            if (zom.dead) continue;
            var pts = zom.flyPath || zom.navPath;
            if (!pts || pts.length === 0) continue;
            ctx.strokeStyle = zom.flyPath ? "#c084fc" : "#33ff77";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(zom.x * cameraScaleX + xc, -zom.y * cameraScaleY + yc);
            for (let p = 0; p < pts.length; p++) ctx.lineTo(pts[p].x * cameraScaleX + xc, -(pts[p].y + (zom.flyPath ? 0 : 25)) * cameraScaleY + yc);
            ctx.stroke();
        }
        ctx.fillStyle = "rgba(10,15,22,0.75)";
        ctx.fillRect(cssW - 330, cssH - 120, 316, 54);
        ctx.fillStyle = "#88ffaa";
        ctx.font = "12px monospace";
        ctx.fillText("NAV " + this.stats.nodes + " nodes  " + this.stats.edges + " edges  " + this.stats.fields + " fields", cssW - 320, cssH - 100);
        ctx.fillText("pathing " + this.stats.ms + " ms/frame   build " + (this.stats.lastBuildMs || 0) + " ms" + (this.windowed ? " (window)" : ""), cssW - 320, cssH - 80);
        ctx.restore();
    }
}
