// ============================================================================
// INPUT
//   Player 1 :  WASD move | F shoot | X reload | Space jetpack | Left-Shift dash | E shockwave / hold to REVIVE | G grab
//   Player 2 :  Arrows move | Enter shoot | ' reload | . jetpack | Right-Shift dash | / shockwave / hold to REVIVE | , grab
//   Solo     :  Arrow keys also fire twin-stick style, mouse aims & shoots.
//   Esc      :  Pause menu - restart, co-op toggle and level select live there (no stray-key resets).
// ============================================================================
function isTypingTarget(e) {
    return e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA");
}

function queueDash(idx) {
    var ch = (idx === 0) ? redGuy : blueGuy;
    if (ch && !ch.dead && !ch.isZombie) ch.triggerNinjaDash();
}

function queueGrab(idx) {
    var ch = (idx === 0) ? redGuy : blueGuy;
    if (!ch || ch.dead) return;
    if (idx === 0 && useMouseAim) {
        var mPos = Components.getMouseWorldPos();
        ch.tryGrabOrThrow(mPos[0], mPos[1]);
    } else {
        var rad = Math.radians(ch.degree);
        ch.tryGrabOrThrow(ch.x + Math.sin(rad) * 160, ch.y + Math.cos(rad) * 160);
    }
}

function keyDownHandler(e) {
    if (isTypingTarget(e)) return;
    var k = e.key;
    var c = e.code;

    // Pause menu owns the keyboard while it is open (restart / co-op / levels live there)
    if (c == "Escape") { if (!e.repeat) togglePause(); e.preventDefault(); return; }
    if (paused) { pauseKey(e); return; }

    if (k == "ArrowRight") { ULDRrightPressed = true; e.preventDefault(); }
    if (k == "ArrowLeft") { ULDRleftPressed = true; e.preventDefault(); }
    if (k == "ArrowUp") { ULDRupPressed = true; e.preventDefault(); }
    if (k == "ArrowDown") { ULDRdownPressed = true; e.preventDefault(); }
    if (c == "KeyD") WASDrightPressed = true;
    if (c == "KeyA") WASDleftPressed = true;
    if (c == "KeyW") WASDupPressed = true;
    if (c == "KeyS") WASDdownPressed = true;

    // ----- Player 1 actions -----
    if (c == "Space") { PlayerInput[0].jet = true; SpacePressed = true; e.preventDefault(); }
    if (c == "KeyF") { PlayerInput[0].shoot = true; EnterPressed = true; }
    if (c == "KeyE" || c == "KeyQ") { PlayerInput[0].interact = true; EPressed = true; }
    if (c == "ShiftLeft" && !e.repeat) { ShiftPressed = true; queueDash(0); }
    if (c == "KeyG" && !e.repeat) queueGrab(0);
    if (c == "KeyX" && !e.repeat) PlayerInput[0].reloadQueued = true;

    // ----- Player 2 actions -----
    if (c == "Enter" || c == "NumpadEnter") { PlayerInput[1].shoot = true; e.preventDefault(); }
    if (c == "Period" || c == "Numpad0") { PlayerInput[1].jet = true; e.preventDefault(); }
    if (c == "Slash" || c == "Numpad1") { PlayerInput[1].interact = true; e.preventDefault(); }
    if (c == "ShiftRight" && !e.repeat) { queueDash(1); }
    if ((c == "Comma" || c == "Numpad2") && !e.repeat) queueGrab(1);
    if ((c == "Quote" || c == "Numpad3") && !e.repeat) { PlayerInput[1].reloadQueued = true; e.preventDefault(); }

    if (e.repeat) return;

    if (c == "KeyV") { if (typeof SummonManager !== "undefined") SummonManager.toggleGodMode(); }
    if (c == "KeyB") { if (typeof SummonManager !== "undefined") SummonManager.togglePanel(); }
    if (c == "KeyP") { if (typeof Pathfinder !== "undefined") Pathfinder.showDebug = !Pathfinder.showDebug; }
    if (c == "KeyH") { devOpts.showHelp = !devOpts.showHelp; helpTimer = devOpts.showHelp ? 60 * 14 : 0; }
    if (k == "Delete" || k == "Backspace") {
        if (typeof SummonManager !== "undefined" && SummonManager.selectedObject) {
            SummonManager.deleteSelected();
            e.preventDefault();
        }
    }
    if (k == "-" || k == "_") { userZoom = Math.max(0.55, userZoom - 0.1); }
    if (k == "=" || k == "+") { userZoom = Math.min(1.9, userZoom + 0.1); }
}

function keyUpHandler(e) {
    var k = e.key;
    var c = e.code;
    if (k == "ArrowRight") ULDRrightPressed = false;
    if (k == "ArrowLeft") ULDRleftPressed = false;
    if (k == "ArrowUp") ULDRupPressed = false;
    if (k == "ArrowDown") ULDRdownPressed = false;
    if (c == "KeyD") WASDrightPressed = false;
    if (c == "KeyA") WASDleftPressed = false;
    if (c == "KeyW") WASDupPressed = false;
    if (c == "KeyS") WASDdownPressed = false;

    if (c == "Space") { PlayerInput[0].jet = false; SpacePressed = false; }
    if (c == "KeyF") { PlayerInput[0].shoot = false; EnterPressed = false; }
    if (c == "KeyE" || c == "KeyQ") { PlayerInput[0].interact = false; EPressed = false; }
    if (c == "ShiftLeft") ShiftPressed = false;

    if (c == "Enter" || c == "NumpadEnter") PlayerInput[1].shoot = false;
    if (c == "Period" || c == "Numpad0") PlayerInput[1].jet = false;
    if (c == "Slash" || c == "Numpad1") PlayerInput[1].interact = false;
}

// Releasing every key when the window loses focus avoids "stuck" movement
window.addEventListener("blur", function() {
    ULDRrightPressed = ULDRleftPressed = ULDRupPressed = ULDRdownPressed = false;
    WASDrightPressed = WASDleftPressed = WASDupPressed = WASDdownPressed = false;
    SpacePressed = EnterPressed = EPressed = ShiftPressed = false;
    mouseDown = false;
    for (var i = 0; i < PlayerInput.length; i++) {
        PlayerInput[i].shoot = PlayerInput[i].jet = PlayerInput[i].interact = false;
    }
});

function mouseMoveHandler(e) {
    var rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    if (paused) { pauseHover(mouseX, mouseY); return; }
    useMouseAim = true;
    if (typeof SummonManager !== "undefined") SummonManager.handleCanvasMouseMove(e);
}

function mouseDownHandler(e) {
    var rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    if (paused) { if (e.button === 0) pauseClick(mouseX, mouseY); return; }
    useMouseAim = true;

    if (typeof SummonManager !== "undefined" && SummonManager.handleCanvasMouseDown(e)) return;

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
    if (typeof SummonManager !== "undefined") SummonManager.handleCanvasMouseUp(e);
    if (e.button === 0) mouseDown = false;
    else if (e.button === 2) rightMouseDown = false;
}

window.addEventListener("contextmenu", function(e) { e.preventDefault(); });
