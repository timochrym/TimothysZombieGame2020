test = new Object("test", [
    [-50, 50],
    [50, 50],
    [50, -50],
    [-50, -50]
], [
    [-50, 50],
    [50, 50],
    [50, -50],
    [-50, -50]
], "#FFF", [0, 300], maxspeed, slower, gravity, bounciness)
test1 = new Object("test", [
    [-50, 50],
    [50, 50],
    [50, -50],
    [-50, -50]
], [
    [-50, 50],
    [50, 50],
    [50, -50],
    [-50, -50]
], "#FFF", [200, 138.4], maxspeed, slower, gravity, bounciness)
floor = new Object("floor", [
    [-700, 50],
    [700, 50],
    [700, -1000],
    [-700, -1000]
], [
    [-700, 50],
    [700, 50],
    [700, -1000],
    [-700, -1000]
], "#00F", [0, 0])
redGuy = new Character("name", [
    [-50, 50],
    [50, 50],
    [50, -50],
    [-50, -50]
], [
    [-50, 50],
    [50, 50],
    [50, -50],
    [-50, -50]
], "#F00", [200, 300], maxspeed, slower, gravity, bounciness, speed, "WASD", health)
staticObjects = [floor]
characters = [redGuy]
movingObjects = [redGuy, test]
allObjects = [floor, redGuy, test]

function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    floor.staticObject()

    test.movingObject()
    test1.staticObject()

    redGuy.animate()

    xc = xcMaster - redGuy.x
    yc = ycMaster + redGuy.y - 200
}

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

setInterval(frame, 1000/fps);