function keyDownHandler(e) {
    if (e.key == "Right" || e.key == "ArrowRight") {
        ULDRrightPressed = true;
        e.preventDefault();
    }
    if (e.key == "Left" || e.key == "ArrowLeft") {
        ULDRleftPressed = true;
        e.preventDefault();
    }
    if (e.key == "Up" || e.key == "ArrowUp") {
        ULDRupPressed = true;
        e.preventDefault();
    }
    if (e.key == "Down" || e.key == "ArrowDown") {
        ULDRdownPressed = true;
        e.preventDefault();
    }
    if (e.key == "d" || e.key == "D" || e.key == "KeyD") {
        WASDrightPressed = true;
    }
    if (e.key == "a" || e.key == "A" || e.key == "KeyA") {
        WASDleftPressed = true;
    }
    if (e.key == "w" || e.key == "W" || e.key == "KeyW") {
        WASDupPressed = true;
    }
    if (e.key == "s" || e.key == "S" || e.key == "KeyS") {
        WASDdownPressed = true;
    }
    if (e.key == " " || e.key == "Spacebar") {
        SpacePressed = true;
        e.preventDefault();
    }
    if (e.key == "Enter" || e.key == "f" || e.key == "F") {
        EnterPressed = true;
    }
    if (e.key == "e" || e.key == "E" || e.key == "q" || e.key == "Q") {
        EPressed = true;
    }
    if (e.key == "Shift" || e.key == "/") {
        ShiftPressed = true;
    }
    if (e.key == "m" || e.key == "M") {
        if (typeof toggleMultiplayer === "function") {
            toggleMultiplayer();
        }
    }
    if (e.key == "r" || e.key == "R") {
        if (typeof resetGame === "function") {
            resetGame();
        }
    }
    if (e.key == "-" || e.key == "_") {
        cameraScaleX = Math.max(0.4, cameraScaleX - 0.1);
        cameraScaleY = cameraScaleX;
    }
    if (e.key == "=" || e.key == "+") {
        cameraScaleX = Math.min(1.6, cameraScaleX + 0.1);
        cameraScaleY = cameraScaleX;
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
    if (e.key == "d" || e.key == "D" || e.key == "KeyD") {
        WASDrightPressed = false;
    }
    if (e.key == "a" || e.key == "A" || e.key == "KeyA") {
        WASDleftPressed = false;
    }
    if (e.key == "w" || e.key == "W" || e.key == "KeyW") {
        WASDupPressed = false;
    }
    if (e.key == "s" || e.key == "S" || e.key == "KeyS") {
        WASDdownPressed = false;
    }
    if (e.key == " " || e.key == "Spacebar") {
        SpacePressed = false;
    }
    if (e.key == "Enter" || e.key == "f" || e.key == "F") {
        EnterPressed = false;
    }
    if (e.key == "e" || e.key == "E" || e.key == "q" || e.key == "Q") {
        EPressed = false;
    }
    if (e.key == "Shift" || e.key == "/") {
        ShiftPressed = false;
    }
}
