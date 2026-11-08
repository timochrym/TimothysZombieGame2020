class Components {

    static directionArrow(object) {
        if (object.upPressed) {
            object.degreeToGoCW = 0;
            object.degreeToGoCCW = 360;
        } else if (object.downPressed) {
            object.degreeToGoCW = 180;
            object.degreeToGoCCW = 180;
        } else if (object.leftPressed) {
            object.degreeToGoCW = 90;
            object.degreeToGoCCW = 270;
        } else if (object.rightPressed) {
            object.degreeToGoCW = 270;
            object.degreeToGoCCW = 90;
        }

        object.distanceCW = object.degreeToGoCW - object.degree
        if (object.distanceCW > 360) {
            object.distanceCW -= 360;
        }
        if (object.distanceCW < 0) {
            object.distanceCW += 360;
        }
        object.distanceCCW = object.degreeToGoCCW + object.degree
        if (object.distanceCCW > 360) {
            object.distanceCCW -= 360;
        }
        if (object.distanceCCW < 0) {
            object.distanceCCW += 360;
        }

        if (object.distanceCW < object.distanceCCW) {
            object.degreeSpeedX += degreeSpeed;
        }
        if (object.distanceCW > object.distanceCCW) {
            object.degreeSpeedX -= degreeSpeed;
        }

        if (object.degreeSpeedX != 0) {
            object.degreeSpeedX = Math.subtractToZero(object.degreeSpeedX, degreeSpeed / 2);
        }

        object.degree += object.degreeSpeedX

        if (object.degree > 360) {
            object.degree -= 360;
        }
        if (object.degree < 0) {
            object.degree += 360;
        }

        object.arrow = Polygon.rotate(arrow, [0, 0], object.degree);
        Polygon.create(object.arrow, speedIndicatorColor, object);
    }

    static moveTypeFinder(object) {
        if (object.moveType == "WASD") {
            object.upPressed = WASDupPressed;
            object.downPressed = WASDdownPressed;
            object.leftPressed = WASDleftPressed;
            object.rightPressed = WASDrightPressed;
        }
        if (object.moveType == "ULDR") {
            object.upPressed = ULDRupPressed;
            object.downPressed = ULDRdownPressed;
            object.leftPressed = ULDRleftPressed;
            object.rightPressed = ULDRrightPressed;
        }
        if (object.upPressed == false) {
            object.upPressed = SpacePressed;
        }

        if (object.lazerType == "WASD") {
            object.lazerUp = WASDupPressed;
            object.lazerDown = WASDdownPressed;
            object.lazerLeft = WASDleftPressed;
            object.lazerRight = WASDrightPressed;
        }
        if (object.lazerType == "ULDR") {
            object.lazerUp = ULDRupPressed;
            object.lazerDown = ULDRdownPressed;
            object.lazerLeft = ULDRleftPressed;
            object.lazerRight = ULDRrightPressed;
        }

        Components.directionArrow(object);
    }
}