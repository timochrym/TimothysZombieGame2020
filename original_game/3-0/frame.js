redGuy = new Character("redGuy", "#FF0000", s1, s2, 0, 575, "WASD", "ULDR")
floor = new Object("floor", "#111111", 40000, 1000, 0, -500)
staticObjects = [floor]
characters = [redGuy]
objects = [redGuy, floor]

function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    floor.staticObject()

    redGuy.animate()

    xc = xcMaster - redGuy.x
    yc = ycMaster + redGuy.y
}

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

setInterval(frame, 1000 / 60);