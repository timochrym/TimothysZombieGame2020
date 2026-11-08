var canvas = document.getElementById("screen");
var ctx = canvas.getContext("2d");
var w = window.innerWidth;
var h = window.innerHeight;
canvas.width = w;
canvas.height = h;

let xcMaster = w / 2;
let ycMaster = h / 2;
var xc = xcMaster;
var yc = ycMaster;
var maxX = w / 2;
var maxY = h / 2;
var cameraScaleX = 1;
var cameraScaleY = cameraScaleX;
var cameraTargetX = 0;
var cameraTargetY = 0;

var fps = 60;
var rounder = 100;

// Character & Object Physics
var speed = 55 / fps;
var slower = speed * 1.5;
var jumpSpeed = 115 / fps;
var maxspeed = 1100 / fps;
var gravity = 45 / fps;
var bounciness = -0.35;
var xbounce = -0.4;
var ybounce = -0.3;

// Character Size & Anchor Point
var s1 = 100;
var s2 = s1;
var a1 = -s1 / 2;
var a2 = -s1 / 2;

// Character Jump
var jump = false;
var jumpTimer = 0;
var jumpTimeMax = 850 / fps;
var jumpCoolDownTimeMax = jumpTimeMax * 2;

// Health Bar
var health = 100;
var healthBarW = 100;
var healthBarH = 10;
var healthBarYChange = 75;
var healthBarDColor = "#FF0000";
var healthBarHColor = "#00FF00";

// Direction Arrow
var speedIndicatorColor = "#7ec14d";
var degreeSpeed = 120 / fps;
var arrow = [
    [-75, 0],
    [-50, 50],
    [-25, 65],
    [0, 70],
    [25, 65],
    [50, 50],
    [75, 0],

    [50, 40],
    [0, 60],
    [-75, 30],
    [-50, 40],
    [-75, 0],
];
var arrowA1 = -250 / 2;
var arrowA2 = 0;

// Lazer
var lazerSpeed = 1400 / fps;
var lazerW = 14;
var lazerH = 14;
var lazerColor = "#c84848";
var lazerDamage = -10;
var lazerCooldownMax = 10;

// Zombie
var zombieDamage = -0.6;
var zombies = [];
var lazers = [];
var particles = [];
var powerUps = [];

// Game State & Levels
var level = 1;
var score = 0;
var zombiesRemainingToSpawn = 0;
var zombieSpawnTimer = 0;
var levelTransitionTimer = 0;
var multiplayer = false;
var gameOver = false;

// Images
var zombieImg = document.getElementById("zombie");
var characterImg = document.getElementById("character");

// Keys
var ULDRrightPressed = false;
var ULDRleftPressed = false;
var ULDRupPressed = false;
var ULDRdownPressed = false;

var WASDrightPressed = false;
var WASDleftPressed = false;
var WASDupPressed = false;
var WASDdownPressed = false;

var SpacePressed = false;
var EnterPressed = false;
var EPressed = false;
var ShiftPressed = false;

window.addEventListener("resize", function() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    xcMaster = w / 2;
    ycMaster = h / 2;
});
