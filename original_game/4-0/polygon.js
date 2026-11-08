class Polygon {

    static create(poly, color, object) {

        //Color
        ctx.fillStyle = color;

        //Path
        ctx.beginPath();

        //Start
        ctx.moveTo(Math.round((poly[0][0] + xc + object.x) * rounder) / rounder, Math.round((-poly[0][1] + yc - object.y) * rounder) / rounder);

        //Every Other Point
        for (let item = 0; item < poly.length; item += 1) {
            ctx.lineTo(Math.round((poly[item][0] + xc + object.x) * rounder) / rounder, Math.round((-poly[item][1] + yc - object.y) * rounder) / rounder);
        };

        //Finish
        ctx.closePath();

        //Fill
        ctx.fill();
    };
    static rotate(poly, anchorPoint, degree) {

        //Anchor Points
        this.anchorPointX = anchorPoint[0];
        this.anchorPointY = anchorPoint[1];

        //New Poly
        this.newPoly = [];

        //For Every Point in Poly
        for (let point = 0; point < poly.length; point += 1) {

            //Seperating X and Y
            this.pointX = poly[point][0];
            this.pointY = poly[point][1];

            //Triangle Points
            this.a = this.pointY - this.anchorPointY;
            this.b = this.pointX - this.anchorPointX;
            this.c = Math.sqrt(Math.pow(this.a, 2) + Math.pow(this.b, 2), 2);

            //Radius
            this.radius = this.c

            //New Degree & Reverse of New Degree
            this.orginalDegree = Math.degrees(Math.atan(this.b / this.a));
            this.newDegree = this.orginalDegree + degree;
            this.reverseDegree = 90 + this.newDegree;

            //New Triangle
            this.a2 = Math.cos(Math.radians(this.reverseDegree)) * this.radius;
            this.b2 = Math.sin(Math.radians(this.reverseDegree)) * this.radius;
            this.c2 = this.radius

            //New location Coordinates (Relative)
            this.xAdd = this.a2;
            this.yAdd = this.b2;

            //New Coordinates
            this.x = this.anchorPointX + this.xAdd;
            this.y = this.anchorPointY + this.yAdd;

            //Appending New Point to New Poly Array
            this.newPoly.push([this.x, this.y]);
        }
        //Return New Poly
        return this.newPoly;
    }
}