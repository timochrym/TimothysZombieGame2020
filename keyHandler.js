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
    if (typeof Net !== "undefined" && Net.role === "client") { if (idx === 0) Net.localDash++; return; }
    var ch = (idx === 0) ? redGuy : blueGuy;
    if (ch && !ch.dead && !ch.isZombie) ch.triggerNinjaDash();
}

function queueGrab(idx) {
    if (typeof Net !== "undefined" && Net.role === "client") { if (idx === 0) Net.localGrab++; return; }
    var bch = (idx === 0) ? redGuy : blueGuy;
    if (bch && bch.buildMode && typeof Build !== "undefined") { Build.removeAt(bch); return; }
    var ch = (idx === 0) ? redGuy : blueGuy;
    if (!ch || ch.dead) return;
    if (GameModes.call("onSecondary", ch)) return;
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
    if (typeof SFX !== "undefined") SFX.unlock();
    var k = e.key;
    var c = e.code;

    // LAN client: the host owns menus; Esc opens the small LAN menu
    if (typeof Net !== "undefined" && Net.role === "client" && Net.clientKey(e)) return;
    if (typeof Net !== "undefined" && Net.role === "client") { if (Hub.isOpen) Hub.close(); paused = false; }
    // Pause menu owns the keyboard while it is open (restart / co-op / levels live there)
    if (typeof Hub !== "undefined" && Hub.isOpen) { Hub.key(e); return; }
    if (c == "Escape") {
        if (!e.repeat) { if (paused && pauseSub) { pauseSub = null; pauseIndex = 0; } else togglePause(); }
        e.preventDefault();
        return;
    }
    if (paused) { pauseKey(e); return; }
    if (GameModes.call("onKey", c, e)) { e.preventDefault(); return; }

    if (k == "ArrowRight") { ULDRrightPressed = true; e.preventDefault(); }
    if (k == "ArrowLeft") { ULDRleftPressed = true; e.preventDefault(); }
    if (k == "ArrowUp") { ULDRupPressed = true; e.preventDefault(); }
    if (k == "ArrowDown") { ULDRdownPressed = true; e.preventDefault(); }
    if (c == "KeyD") WASDrightPressed = true;
    if (c == "KeyA") WASDleftPressed = true;
    if (c == "KeyW") WASDupPressed = true;
    if (c == "KeyS") WASDdownPressed = true;

    // ----- Player 1 actions -----
    if (c == "Space") { PlayerInput[0].kbJet = true; SpacePressed = true; e.preventDefault(); }
    if (c == "KeyF") { PlayerInput[0].kbShoot = true; EnterPressed = true; }
    if (c == "KeyE" || c == "KeyQ") { PlayerInput[0].kbInteract = true; EPressed = true; }
    if (c == "ShiftLeft" && !e.repeat) { ShiftPressed = true; queueDash(0); }
    if (c == "KeyG" && !e.repeat) queueGrab(0);
    if (c == "KeyX" && !e.repeat) PlayerInput[0].reloadQueued = true;

    // ----- Player 2 actions -----
    if (c == "Enter" || c == "NumpadEnter") { PlayerInput[1].kbShoot = true; e.preventDefault(); }
    if (c == "Period" || c == "Numpad0") { PlayerInput[1].kbJet = true; e.preventDefault(); }
    if (c == "Slash" || c == "Numpad1") { PlayerInput[1].kbInteract = true; e.preventDefault(); }
    if (c == "ShiftRight" && !e.repeat) { queueDash(1); }
    if ((c == "Comma" || c == "Numpad2") && !e.repeat) queueGrab(1);
    if ((c == "Quote" || c == "Numpad3") && !e.repeat) { PlayerInput[1].reloadQueued = true; e.preventDefault(); }

    if (e.repeat) return;

    if (c == "KeyV") { if (typeof SummonManager !== "undefined") SummonManager.toggleGodMode(); }
    // ----- Building (C / ; toggle, 1-4 / [ piece, T material) -----
    if (typeof Build !== "undefined" && !e.repeat) {
        var lanC = typeof Net !== "undefined" && Net.role === "client";
        if (c == "KeyC") { if (lanC) Net.localBuildToggle = (Net.localBuildToggle || 0) + 1; else Build.toggle(redGuy); }
        if (c == "Semicolon") Build.toggle(blueGuy);
        if (/^Digit[1-4]$/.test(c)) { var bi = Number(c.charAt(5)) - 1; if (lanC) Build.localPiece = bi; else if (redGuy) Build.pick(redGuy, bi); }
        if (c == "BracketLeft" && blueGuy) Build.pick(blueGuy, (blueGuy.buildPiece || 0) + 1);
        if (c == "KeyT") { if (lanC) Build.localMat = (Build.localMat + 1) % BUILD_MATS.length; else { Build.cycleMat(redGuy); if (blueGuy && blueGuy.buildMode && !(redGuy && redGuy.buildMode)) Build.cycleMat(blueGuy); } }
    }
    if (typeof Feel !== "undefined" && !e.repeat) {
        if (c == "KeyZ") { if (typeof Net !== "undefined" && Net.role === "client") Net.localPunch = (Net.localPunch || 0) + 1; else Feel.punch(redGuy); }
        if (c == "KeyM") Feel.punch(blueGuy);
    }
    if (c == "KeyB") { if (typeof Studio !== "undefined") Studio.toggle(); else if (typeof SummonManager !== "undefined") SummonManager.togglePanel(); }
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

    if (c == "Space") { PlayerInput[0].kbJet = false; SpacePressed = false; }
    if (c == "KeyF") { PlayerInput[0].kbShoot = false; EnterPressed = false; }
    if (c == "KeyE" || c == "KeyQ") { PlayerInput[0].kbInteract = false; EPressed = false; }
    if (c == "ShiftLeft") ShiftPressed = false;

    if (c == "Enter" || c == "NumpadEnter") PlayerInput[1].kbShoot = false;
    if (c == "Period" || c == "Numpad0") PlayerInput[1].kbJet = false;
    if (c == "Slash" || c == "Numpad1") PlayerInput[1].kbInteract = false;
}

// Releasing every key when the window loses focus avoids "stuck" movement
window.addEventListener("blur", function() {
    ULDRrightPressed = ULDRleftPressed = ULDRupPressed = ULDRdownPressed = false;
    WASDrightPressed = WASDleftPressed = WASDupPressed = WASDdownPressed = false;
    SpacePressed = EnterPressed = EPressed = ShiftPressed = false;
    mouseDown = false;
    for (var i = 0; i < PlayerInput.length; i++) {
        PlayerInput[i].shoot = PlayerInput[i].jet = PlayerInput[i].interact = false;
        PlayerInput[i].kbShoot = PlayerInput[i].kbJet = PlayerInput[i].kbInteract = false;
    }
});

function mouseMoveHandler(e) {
    var rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    if (typeof Hub !== "undefined" && Hub.isOpen) { Hub.hover(mouseX, mouseY); return; }
    if (paused) { pauseHover(mouseX, mouseY); return; }
    useMouseAim = true;
    if (typeof SummonManager !== "undefined") SummonManager.handleCanvasMouseMove(e);
}

function mouseDownHandler(e) {
    var rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    if (typeof SFX !== "undefined") SFX.unlock();
    if (typeof Net !== "undefined" && Net.role === "client") {
        useMouseAim = true;
        if (e.button === 0) mouseDown = true;
        else if (e.button === 2) { rightMouseDown = true; Net.localGrab++; }
        return;
    }
    if (typeof Hub !== "undefined" && Hub.isOpen) { if (e.button === 0) Hub.click(mouseX, mouseY); return; }
    if (paused) { if (e.button === 0) pauseClick(mouseX, mouseY); return; }
    useMouseAim = true;
    if (GameModes.has("onClick")) {
        if (e.button === 0) mouseDown = true;
        var cwp = Components.getMouseWorldPos();
        if (GameModes.call("onClick", cwp[0], cwp[1], e.button)) return;
    }

    if (typeof SummonManager !== "undefined" && SummonManager.handleCanvasMouseDown(e)) return;

    if (e.button === 0) {
        mouseDown = true;
    } else if (e.button === 2) {
        rightMouseDown = true;
        if (redGuy && redGuy.buildMode && typeof Build !== "undefined") { Build.removeAt(redGuy); return; }
        if (redGuy && !redGuy.dead && GameModes.call("onSecondary", redGuy)) return;
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

// ============================================================================
// GAMEPADS (standard mapping) - pad 1 drives Player 1, pad 2 drives Player 2. Keyboard keeps working.
//   Left stick / D-pad move   A jump   RT (or push the right stick) shoot   right stick aims
//   RB / LT jetpack   B dash   Y shockwave / hold to revive   LB grab & throw   X reload   Start pause
// ============================================================================
var Pads = {
    state: [{ active: false }, { active: false }],
    prev: [{}, {}],
    announced: {},

    poll: function() {
        var gps = (navigator.getGamepads && navigator.getGamepads()) || [];
        var list = [];
        for (let i = 0; i < gps.length; i++) if (gps[i] && gps[i].connected) list.push(gps[i]);
        for (let i = 0; i < 2; i++) {
            var g = list[i];
            var st = { active: false };
            var prev = this.prev[i];
            if (g) {
                if (!this.announced[g.index]) {
                    this.announced[g.index] = true;
                    if (typeof showBanner === "function") showBanner("🎮 CONTROLLER " + (i + 1) + " CONNECTED", "It now controls Player " + (i + 1) + (i === 1 ? " (turn on co-op / PvP in the pause menu)" : ""), "#7ff0ff");
                }
                var B = function(n) { var b = g.buttons[n]; return !!(b && (b.pressed || b.value > 0.5)); };
                var ax = g.axes[0] || 0, ay = g.axes[1] || 0, rx = g.axes[2] || 0, ry = g.axes[3] || 0;
                st.active = true;
                st.left = ax < -0.35 || B(14);
                st.right = ax > 0.35 || B(15);
                st.down = ay > 0.6 || B(13);
                st.up = B(0) || B(12);
                st.aim = Math.hypot(rx, ry) > 0.3 ? [rx, ry] : null;
                st.shoot = B(7) || Math.hypot(rx, ry) > 0.8;
                st.jet = B(5) || B(6);
                st.interact = B(3);
                var now = {};
                for (let b = 0; b < 17; b++) now[b] = B(b);
                now.su = ay < -0.6; now.sd = ay > 0.6; now.sl = ax < -0.6; now.sr = ax > 0.6;
                var edge = function(key) { return now[key] && !prev[key]; };
                if (now[0] || now[7] || now[9]) { if (typeof SFX !== "undefined") SFX.unlock(); }

                if (typeof Hub !== "undefined" && Hub.isOpen) {
                    var hk = function(code) { Hub.key({ code: code, preventDefault: function() {} }); };
                    if (edge(12) || edge("su")) hk("ArrowUp");
                    if (edge(13) || edge("sd")) hk("ArrowDown");
                    if (edge(14) || edge("sl")) hk("ArrowLeft");
                    if (edge(15) || edge("sr")) hk("ArrowRight");
                    if (edge(0) || edge(9)) hk("Enter");
                } else if (typeof paused !== "undefined" && paused) {
                    var fake = function(code) { pauseKey({ code: code, preventDefault: function() {} }); };
                    if (edge(12) || edge("su")) fake("ArrowUp");
                    if (edge(13) || edge("sd")) fake("ArrowDown");
                    if (edge(14) || edge("sl")) fake("ArrowLeft");
                    if (edge(15) || edge("sr")) fake("ArrowRight");
                    if (edge(0)) fake("Enter");
                    if (edge(1) || edge(9)) { if (pauseSub) { pauseSub = null; pauseIndex = 0; } else if (!pauseFromGameOver) closePause(); }
                } else {
                    if (edge(9)) togglePause();
                    if (edge(1)) queueDash(i);
                    if (edge(4)) queueGrab(i);
                    if (edge(2)) PlayerInput[i].reloadQueued = true;
                }
                this.prev[i] = now;
            } else {
                this.prev[i] = {};
            }
            this.state[i] = st;
            // Compose final action buttons = keyboard OR controller
            var inp = PlayerInput[i];
            inp.shoot = inp.kbShoot || !!st.shoot;
            inp.jet = inp.kbJet || !!st.jet;
            inp.interact = inp.kbInteract || !!st.interact;
        }
    }
};
