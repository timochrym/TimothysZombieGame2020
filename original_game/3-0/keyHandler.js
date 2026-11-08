function keyDownHandler(e) {
    if (e.key == "Right" || e.key == "ArrowRight") {
        ULDRrightPressed = true;
    }
    if (e.key == "Left" || e.key == "ArrowLeft") {
        ULDRleftPressed = true;
    }
    if (e.key == "Up" || e.key == "ArrowUp") {
        ULDRupPressed = true;
    }
    if (e.key == "Down" || e.key == "ArrowDown") {
        ULDRdownPressed = true;
    }
    if (e.key == "d" || e.key == "KeyD") {
        WASDrightPressed = true;
    }
    if (e.key == "a" || e.key == "KeyA") {
        WASDleftPressed = true;
    }
    if (e.key == "w" || e.key == "KeyW") {
        WASDupPressed = true;
    }
    if (e.key == "s" || e.key == "KeyS") {
        WASDdownPressed = true;
    }
    if (e.key == ' ' || e.key == 'Spacebar') {
        SpacePressed = true;
    }
}

function keyUpHandler(e) {
    if (e.key == "Right" || e.key == "ArrowRight") {
        ULDRrightPressed = false;
    }
    if (e.key == "Left" || e.key == "ArrowLeft") {
        ULDRleftPressed = false;
    }
    if (e.key == "Up" || e.key == "ArrowUp") {
        ULDRupPressed = false;
    }
    if (e.key == "Down" || e.key == "ArrowDown") {
        ULDRdownPressed = false;
    }
    if (e.key == "d" || e.key == "KeyD") {
        WASDrightPressed = false;
    }
    if (e.key == "a" || e.key == "KeyA") {
        WASDleftPressed = false;
    }
    if (e.key == "w" || e.key == "KeyW") {
        WASDupPressed = false;
    }
    if (e.key == "s" || e.key == "KeyS") {
        WASDdownPressed = false;
    }
    if (e.key == ' ' || e.key == 'Spacebar') {
        SpacePressed = false;
    }
}