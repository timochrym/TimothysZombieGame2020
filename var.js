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
var STRUCT_SCALE = 2; // Every castle / house / platform is built at 2x its original size
var baseZoom = 0.56;
var userZoom = 1.0;
var cameraScaleX = baseZoom;
var cameraScaleY = cameraScaleX;
var cameraTargetX = 0;
var cameraTargetY = 0;
var worldOriginOffsetX = 0;

var fps = 60;
var rounder = 100;

// Character & Object Physics
var speed = 68 / fps;
var slower = speed * 1.6;
var jumpSpeed = 125 / fps;
var maxspeed = 1200 / fps;
var gravity = 48 / fps;
var bounciness = -0.35;
var xbounce = -0.4;
var ybounce = -0.3;

// Character Size & Anchor Point
var s1 = 80;
var s2 = s1;
var a1 = -s1 / 2;
var a2 = -s1 / 2;

// Character Jump
var jump = false;
var jumpTimer = 0;
var jumpTimeMax = 800 / fps;
var jumpCoolDownTimeMax = jumpTimeMax * 1.5;

// Health Bar
var health = 100;
var healthBarW = 86;
var healthBarH = 10;
var healthBarYChange = 68;
var healthBarDColor = "#FF2244";
var healthBarHColor = "#22FF66";

// Direction Arrow
var speedIndicatorColor = "#7ec14d";
var degreeSpeed = 150 / fps;
var arrow = [
    [-65, 0],
    [-42, 42],
    [-20, 56],
    [0, 62],
    [20, 56],
    [42, 42],
    [65, 0],

    [42, 34],
    [0, 50],
    [-65, 24],
    [-42, 34],
    [-65, 0],
];
var arrowA1 = -250 / 2;
var arrowA2 = 0;

// Lazer
var lazerSpeed = 1600 / fps;
var lazerW = 14;
var lazerH = 14;
var lazerColor = "#ff4d4d";
var lazerDamage = -12;
var lazerCooldownMax = 9;

// Zombie & Entities
var zombieDamage = -0.55;
var zombies = [];
var lazers = [];
var particles = [];
var powerUps = [];
var floatingTexts = [];
var coinOrbs = [];
var afterImages = [];
var treasureChests = [];

// God Mode & RPG / Arcade State
var godMode = false;
var jetpackEnabled = true;
var heroLevel = 1;
var heroXP = 0;
var heroXPNext = 100;
var coins = 0;
var rpgDamageMult = 1.0;

var level = 1;
var score = 0;
var highScore = 0;
try {
    highScore = parseInt(localStorage.getItem("timsZombieGameHighScore") || "0", 10) || 0;
} catch (e) {}
var combo = 1;
var comboTimer = 0;
var comboTimerMax = 210;
var screenShake = 0;

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

// Mouse Aim & Click-to-Shoot
var mouseX = w / 2;
var mouseY = h / 2;
var mouseDown = false;
var rightMouseDown = false;
var useMouseAim = false;

window.addEventListener("resize", function() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    xcMaster = w / 2;
    ycMaster = h / 2;
});


// ---------------------------------------------------------------------------
// Per-player input (P1 = WASD cluster, P2 = Arrow cluster). Filled by keyHandler.js
// ---------------------------------------------------------------------------
var PlayerInput = [
    { shoot: false, jet: false, interact: false, dashQueued: false, grabQueued: false },
    { shoot: false, jet: false, interact: false, dashQueued: false, grabQueued: false }
];

// ---------------------------------------------------------------------------
// Developer / tuning options (driven by the Dev Mode panel)
// ---------------------------------------------------------------------------
var devOpts = {
    timeScale: 1.0,          // 0.2x slow-mo .. 2x fast
    spawnRate: 1.0,          // enemy spawn speed multiplier
    enemyDamage: 1.0,        // damage dealt by enemies
    enemyHealth: 1.0,        // enemy HP multiplier
    playerDamage: 1.0,       // extra player damage multiplier
    maxEnemies: 11,          // simultaneous enemy cap
    infiniteAmmo: false,     // no jetpack drain / ability cooldowns
    showHitboxes: false,
    showFPS: false,
    showHelp: true,
    friendlyFire: false,
    powerUpRate: 1.0         // drop chance multiplier
};

var helpTimer = 60 * 14; // controls cheat-sheet fades after 14 seconds (toggle with H)
var lastSecondStamp = Date.now();
var framesThisSecond = 0;
var measuredFPS = 60;

// Last Stand: when every hero has fallen the team has this long to earn a life back
var lastStandTimerMax = 60 * 40;
var lastStandTimer = -1;
