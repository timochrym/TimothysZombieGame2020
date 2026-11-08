function keyDownHandler(e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) {
        return;
    }

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
    if (e.key == "g" || e.key == "G") {
        if (redGuy && !redGuy.dead) {
            var mPos = Components.getMouseWorldPos();
            redGuy.tryGrabOrThrow(mPos[0], mPos[1]);
        }
    }
    if (e.key == "v" || e.key == "V") {
        if (typeof SummonManager !== "undefined") {
            SummonManager.toggleGodMode();
        }
    }
    if (e.key == "b" || e.key == "B") {
        if (typeof SummonManager !== "undefined") {
            SummonManager.togglePanel();
        }
    }
    if (e.key == "p" || e.key == "P") {
        if (typeof Pathfinder !== "undefined") {
            Pathfinder.showDebug = !Pathfinder.showDebug;
        }
    }
    if (e.key == "Delete" || e.key == "Backspace") {
        if (typeof SummonManager !== "undefined" && SummonManager.selectedObject) {
            SummonManager.deleteSelected();
            e.preventDefault();
        }
    }
    if (e.key == "Shift" || e.key == "/") {
        ShiftPressed = true;
        if (!multiplayer && redGuy && !redGuy.dead && !redGuy.isZombie) {
            redGuy.triggerNinjaDash();
        }
    }
    if (e.key == "1" && typeof LevelManager !== "undefined") LevelManager.selectLevel("classic_arena");
    if (e.key == "2" && typeof LevelManager !== "undefined") LevelManager.selectLevel("zigzag_tower");
    if (e.key == "3" && typeof LevelManager !== "undefined") LevelManager.selectLevel("bunker_bridges");
    if (e.key == "4" && typeof LevelManager !== "undefined") LevelManager.selectLevel("bounce_chaos");
    if (e.key == "5" && typeof LevelManager !== "undefined") LevelManager.selectLevel("stress_test");
    if (e.key == "6" && typeof LevelManager !== "undefined") LevelManager.selectLevel("infinite_frontier");

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

function mouseMoveHandler(e) {
    var rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    useMouseAim = true;

    if (typeof SummonManager !== "undefined") {
        SummonManager.handleCanvasMouseMove(e);
    }
}

function mouseDownHandler(e) {
    var rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    useMouseAim = true;

    if (typeof SummonManager !== "undefined" && SummonManager.handleCanvasMouseDown(e)) {
        return;
    }

    if (e.button === 0) {
        mouseDown = true;
    } else if (e.button === 2) {
        rightMouseDown = true;
        if (redGuy && !redGuy.dead) {
            var mPos = Components.getMouseWorldPos();
            redGuy.tryGrabOrThrow(mPos[0], mPos[1]);
        }
    }
}

function mouseUpHandler(e) {
    if (typeof SummonManager !== "undefined") {
        SummonManager.handleCanvasMouseUp(e);
    }
    if (e.button === 0) {
        mouseDown = false;
    } else if (e.button === 2) {
        rightMouseDown = false;
    }
}

window.addEventListener("contextmenu", function(e) {
    e.preventDefault();
});
