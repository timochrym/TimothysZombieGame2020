// ============================================================================
// DEPTH - optional "2.5D" look (Settings -> 3D view). Render-only: gameplay stays 2D.
//   Every level piece and crate gets side faces extruded toward a vanishing point at the screen centre,
//   shaded by the direction each face points. All side faces are drawn first (far ones first), then the
//   normal front faces on top. Characters stay flat billboards.
//   This is a camera trick, not real 3D: true 3D would need a different engine (WebGL, 3D physics).
// ============================================================================
var Depth = {
    DEPTH: 0.11,          // how far the back face moves toward the vanishing point (0..1)

    on: function() { return typeof settings !== "undefined" && settings.view3d; },

    // screen-space polygon of an object
    screenPoly: function(o) {
        var poly = o.poly || o.hitbox;
        if (!poly || !poly.length) return null;
        var out = [];
        for (let i = 0; i < poly.length; i++) out.push([(poly[i][0] + o.x) * cameraScaleX + xc, (-poly[i][1] - o.y) * cameraScaleY + yc]);
        return out;
    },

    // side faces for a list of objects (call before the objects draw themselves)
    drawSides: function(list) {
        if (!this.on() || !list || !list.length) return;
        var vx = cssW / 2, vy = cssH * 0.42, d = this.DEPTH;
        var faces = [];
        for (let i = 0; i < list.length; i++) {
            var o = list[i];
            if (!o || o.dead || o.noCollide || o.invisible) continue;
            var P = this.screenPoly(o);
            if (!P) continue;
            // cull off-screen
            var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (let k = 0; k < P.length; k++) { minX = Math.min(minX, P[k][0]); maxX = Math.max(maxX, P[k][0]); minY = Math.min(minY, P[k][1]); maxY = Math.max(maxY, P[k][1]); }
            if (maxX < -200 || minX > cssW + 200 || maxY < -200 || minY > cssH + 200) continue;
            // orientation (screen y points down): make normals point outward whatever the winding
            var area = 0;
            for (let k = 0; k < P.length; k++) { var a = P[k], b = P[(k + 1) % P.length]; area += a[0] * b[1] - b[0] * a[1]; }
            var sgn = area > 0 ? 1 : -1;
            for (let k = 0; k < P.length; k++) {
                var A = P[k], B = P[(k + 1) % P.length];
                var ex = B[0] - A[0], ey = B[1] - A[1];
                var nx = ey * sgn, ny = -ex * sgn;                 // outward normal (screen space)
                var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
                if (nx * (vx - mx) + ny * (vy - my) <= 0) continue; // this face points away from the eye
                var A2 = [A[0] + (vx - A[0]) * d, A[1] + (vy - A[1]) * d];
                var B2 = [B[0] + (vx - B[0]) * d, B[1] + (vy - B[1]) * d];
                var len = Math.hypot(nx, ny) || 1;
                // light from above: faces whose normal points up (screen -y) are brightest
                var lit = (-ny / len) * 0.8 + (nx / len) * -0.2;
                faces.push({ pts: [A, B, B2, A2], dist: Math.hypot(mx - vx, my - vy), col: o.color, lit: lit });
            }
        }
        faces.sort(function(p, q) { return q.dist - p.dist; });
        ctx.save();
        ctx.lineJoin = "round";
        for (let i = 0; i < faces.length; i++) {
            var f = faces[i];
            ctx.beginPath();
            ctx.moveTo(f.pts[0][0], f.pts[0][1]);
            for (let k = 1; k < 4; k++) ctx.lineTo(f.pts[k][0], f.pts[k][1]);
            ctx.closePath();
            ctx.fillStyle = Components.shade(f.col && f.col[0] === "#" ? f.col : "#475569", Math.round(-60 + f.lit * 55));
            ctx.fill();
            ctx.strokeStyle = "rgba(6,10,16,0.55)";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
    }
};
