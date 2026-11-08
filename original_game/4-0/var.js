var canvas = document.getElementById("screen");
var ctx = canvas.getContext("2d");
var w = window.innerWidth / 1;
var h = window.innerHeight / 1;
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
var fps = 60;
var rounder = 100;



var speed = 60 / fps;
var slower = speed * 2;
var jumpSpeed = 100 / fps;
var maxspeed = 2000 / fps;
var gravity = 60 / fps;
var bounciness = -0.4;


//Character Jump
var jump = false;
var jumpTimer = 0;
var jumpCoolDownTimeMax = jumpTimeMax * 6;
var jumpTimeMax = 850 / fps;

//Health Bar
var health = 100;
var healthBarW = 100;
var healthBarH = 10;
var healthBarYChange = 100;
var healthBarDColor = "#FF0000";
var healthBarHColor = "#00FF00";

//Arrow
var speedIndicatorColor = "#7ec14d";
var degreeSpeed = 100 / fps;
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

//Lazer
var lazerSpeed = 5000 / fps;
var lazerW = 10;
var lazerH = 10;
var lazerColor = "#c84848";
var lazerDamage = -10;

//Zombie
var zombieDamage = -1;

//Images
var zombie = document.getElementById("zombie");
var character = document.getElementById("character");

//Keys
var ULDRrightPressed = false;
var ULDRleftPressed = false;
var ULDRupPressed = false;
var ULDRdownPressed = false;

var WASDrightPressed = false;
var WASDleftPressed = false;
var WASDupPressed = false;
var WASDdownPressed = false;

var SpacePressed = false;