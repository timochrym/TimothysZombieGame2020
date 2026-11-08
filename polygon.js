class Polygon {

    static create(poly, color, object, offsetY = 0) {
        ctx.fillStyle = color;
        ctx.beginPath();

        var startX = Math.round(((poly[0][0] + object.x) * cameraScaleX + xc) * rounder) / rounder;
        var startY = Math.round(((-poly[0][1] - object.y - offsetY) * cameraScaleY + yc) * rounder) / rounder;
        ctx.moveTo(startX, startY);

        for (let item = 1; item < poly.length; item += 1) {
            var px = Math.round(((poly[item][0] + object.x) * cameraScaleX + xc) * rounder) / rounder;
            var py = Math.round(((-poly[item][1] - object.y - offsetY) * cameraScaleY + yc) * rounder) / rounder;
            ctx.lineTo(px, py);
        }

        ctx.closePath();
        ctx.fill();
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

            // Use atan2 so all 4 quadrants and zero-denominators rotate cleanly
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
