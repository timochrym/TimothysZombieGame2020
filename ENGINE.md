# Tim's Arcade engine

One engine, eight games. Physics, characters, ragdolls, rendering, input, audio, menus and the
dev tools are shared. Each game is a **mode**: a plain object that switches engine features on or off
with flags and adds its own rules through hooks.

| Game | Mode id | File | What it adds on top of the engine |
|---|---|---|---|
| Zombie Survival | `survival` | `modes.js` | The original: waves, co-op, revive, castles, the endless frontier |
| Brawl | `brawl` | `brawl.js` | Smash-style ring-outs, stocks, CPU fighters |
| Zombie Ball | `sport` | `game_sport.js` | A physics ball, goals, teams, kick-off and match clock |
| Crate Lab | `puzzle` | `game_puzzle.js` | 8 puzzle rooms built only from gadgets |
| Portal Lab | `portal` | `game_portal.js` | A two-portal gun with momentum-preserving teleports |
| Parkour Rush | `race` | `game_race.js` | Speedrun courses, medals, saved ghost replays, 2-player races |
| Ragdoll Siege | `siege` | `game_siege.js` | A slingshot that launches ragdolls into sleeping crate forts |
| Creative | `creative` | `game_creative.js` | Flight, noclip, invincibility and the dev build tools in a sky sandbox |

The Arcade menu (`hub.js`) lists every registered mode. The pause menu always has
**🕹 Arcade - switch game**.

## Making a new game

1. Create `game_mygame.js` and add it to `index.html` **after** the other `game_*.js` files and
   **before** `hub.js`.
2. Register your levels with `ModeKit.addLevel`, then register the mode with `GameModes.register`.
3. Optionally add a pixel icon for the hub in `HUB_ICONS` (`hub.js`).

```js
ModeKit.addLevel("golf_1", {
    name: "⛳ Mini Golf 1", mode: "golf", wavesEnabled: false,
    spawnP1: [0, 60], spawnP2: [120, 60],
    layout: ModeKit.room(-1200, 1200, 1400).concat([
        { type: "ramp", name: "Slope", x: 400, y: 100, w: 400, h: 200, dir: "right" }
    ]),
    gadgets: [ { type: "exit", x: 1000, y: 0 } ]
});

GameModes.register({
    id: "golf", title: "MINI GOLF", tagline: "Putt putt.", color: "#4ade80",
    firstLevel: "golf_1",
    flags: { waves: false, revive: false, jetpack: false, shooting: false, ammo: false },
    setupLevel: function(lvl) { Gadgets.load(lvl.gadgets); },
    createPlayers: function() { ModeKit.makeHero(0, 0, 100); blueGuy = null; },
    onExit: function(ch) { showBanner("HOLE IN ONE!", "", "#4ade80"); },
    drawHUD: function() { uiPanel(14, 14, 300, 60, "#4ade80"); uiText("MINI GOLF", 30, 50, 24, "#fff", "left", "900"); }
});
```

## Flags

Flags switch shared engine features. A flag you leave out keeps the engine default.

| Flag | Default | Effect |
|---|---|---|
| `waves` | on | Zombie waves spawn |
| `revive` | on | Downed heroes can be revived; undead heroes |
| `jetpack` | on | Jetpacks |
| `shooting` | on | Lasers / primary fire |
| `ability` | on | Shockwave ability |
| `ammo` | on | Ammo limits (off means unlimited) |
| `playerControl` | on | Set to `false` to freeze heroes' inputs (countdowns, slingshot aiming) |
| `noBedrock` | off | No safety floor under the level |
| `scenery` | on | Background castles and hills |
| `enemiesPassive` | off | Zombies don't run their AI (targets, props) |
| `coopToggle` | on | Shows the Players row in the pause menu |
| `dash` | on | Shift dash |
| `wallJump` | on | Wall slide and wall jump |
| `airJumps` | 1 | Extra jumps in the air (0 = no double jump) |
| `bigPads` | off | Bounce pads and portal flings may exceed the normal vertical speed cap |
| `flight` | off | Double-tap jump to fly (W/S rise and sink). Also available in any game via the dev panel's **Creative flight** toggle |
| `noEnemyBars` | off | Hide enemy health bars (stomp-based games) |
| `ownScreen` | off | The mode draws the whole screen itself: each frame calls its `screenFrame()` hook instead of simulating and drawing the platformer world (grid sims, board games — Sand Lab). Input: the usual key flags, `mouseX`/`mouseY` (screen px), `mouseDown`, and `onKey` / `onClick` |

A mode can change its own flags at runtime. For example, Zombie Ball sets
`this.flags.playerControl = (Sport.phase === "play")` during kick-off.

## Hooks

Every hook is optional. The engine calls `GameModes.call("hook", ...)` at these points.

| Hook | When |
|---|---|
| `onActivate()` / `onDeactivate()` | Switching into or out of this game |
| `setupLevel(lvl)` | After the level geometry is built. Load gadgets and spawn props here |
| `createPlayers()` | Replaces the default hero spawning |
| `onReset()` | End of `resetGame()` |
| `preUpdate()` | Every frame, before characters move |
| `update()` | Every frame, after physics and collisions |
| `drawWorld()` / `drawFront()` | Draw behind characters / in front of them |
| `drawHUD()` | Replaces the whole standard HUD |
| `cameraTargets()` | Return `[{x, y}, ...]` points the camera keeps in frame |
| `cpuThink(ch)` | Set inputs for CPU heroes (`ch.isCPU`) |
| `onSecondary(ch)` | Right-click / LB. Return `true` to consume it |
| `onKey(code, e)` | Key pressed. Return `true` to consume it |
| `onDamage(ch, amount, kx, ky, attacker)` | A character is hurt. Return `true` to cancel the damage |
| `onStomp(hero, foe)` | A hero landed on an enemy's head (engine-wide head stomps: 35 x `rpgDamageMult` damage, bounce higher while jump is held, ~10 frames without contact damage). Return `true` to replace the default damage + bounce |
| `onEnemyDamage(foe, amount, kx, ky, attacker)` | An enemy is hurt. Return `true` to handle it yourself (custom deaths, no Survival loot) |
| `canShoot(ch)` / `canBreak(ch)` | May this hero fire right now / smash bricks |
| `enemyAI(z)` | Drive an enemy yourself (set its `left/right/upPressed`); return `true` to skip the built-in AI |
| `onBlockHit(ch, g)` / `onCoin(ch, g)` / `onGoal(ch, g, frac)` / `onBrickBreak(ch, g)` | Platform gadget events |
| `screenDraw()` / `netInput()` | Full-screen games on LAN: `screenDraw` draws the synced state on a client (no simulation); `netInput` returns extra client controls, read on the host with `Net.peerX(pid)`. Seat helpers: `Net.seatPeers(list)`, `Net.peerButtons(pid)`, `Net.peerList()` |
| `drawBack()` | Draw a backdrop behind the level pieces but over the scenery (Stomp Squad's cave course) |
| `onCheckpoint(ch, g)` | A hero touched a checkpoint gadget (every new touch; splits in Parkour Rush) |
| `runMult(ch)` -> number | Multiplies a player's run speed cap each frame (Stomp Squad: hold RUN for ×1.55) |
| `onContact(hero, foe)` | A hero touches an enemy from the side/below. Return `true` to skip the default contact damage (e.g. star power) |
| `onExplosion(x, y, radius, power)` | Any explosion |
| `onExit(ch, gadget)` / `onHazard(ch, gadget)` | A hero reaches an exit gadget / touches spikes. Return `true` from `onHazard` to cancel the kill |
| `menuItems(items)` / `onMenu(id, dir)` | Add pause-menu rows. Set `cycle: true` for ◀ ▶ rows; `dir` is ±1 for the arrows and empty for Enter |
| `overTitle`, `overSub(over)`, `againLabel`, `onRestart()` | Game-over screen title, subtitle, retry button and its behaviour |

## ModeKit

- `ModeKit.addLevel(key, def)` registers a level. Levels are authored at final scale and never
  auto-scaled. `def.mode` picks the game, `def.layout` is geometry, and any extra fields
  (`gadgets`, `par`, `siege` ...) are yours to read in `setupLevel`.
- `ModeKit.makeHero(index, x, y, {name, color, hp, label, team, accent, cpu})` spawns a hero.
  Index 0 is Player 1 (WASD + mouse), 1 is Player 2 (arrows), and higher slots are usually CPUs.
- `ModeKit.room(left, right, ceilingY, {tex, color, noFloor, portalWalls ...})` returns a floor
  (top at `y = 0`), side walls and a ceiling. The walls also act as the arena bounds.
- `pressedOnce(ch, key, held)` edge-detects a held button per character.

## Level layout pieces

Coordinates are world units with **+y up**. Every piece is centred on `x, y`.

| `type` | Fields | Notes |
|---|---|---|
| `box` | `w, h, color, texture, kind` | `kind`: `block`, `wall`, `platform` (one-way). `portalable: true` accepts portals |
| `ramp` | `w, h, dir: "right" or "left"` | The **name** sets the behaviour: `Stairs` are opt-in (hold Up), `Slide` is slippery, anything else is a walkable slope |
| `bumper` | `w, h, bounce` | Bounce pad |
| `crate` | `size` or `w, h`, `explosive` | Movable physics object. `explosive: true` is a TNT barrel |

Textures: `brick`, `grass_dirt`, `castle_stone`, `lab_metal`, `dojo_wood`, `neon_grid`,
`question_gold`, `crate_plank`, or leave it unset for a solid colour.

## Gadgets

Interactive pieces from `gadgets.js`. Load them with `Gadgets.load(lvl.gadgets)` in `setupLevel`.
Activators power every gadget whose `id` is in their `links`.

| `type` | Fields | Behaviour |
|---|---|---|
| `plate` | `w, links` | Powered while anything heavy (hero, zombie, crate, ragdoll) stands on it |
| `switch` | `links` | A lever. **E** toggles it, and shooting it also works |
| `door` | `id, w, h, need: "all", invert` | Opens while powered. `need: "all"` requires every linked activator |
| `lockdoor` | `w, h, color` | Opens for a hero carrying the matching `key` |
| `key` | `color` | Pick-up |
| `mover` | `id, w, h, x2, y2, speed, needsPower` | Moving platform that carries riders |
| `fan` | `w, h, power` | Updraft column; lifts heroes, crates and ragdolls |
| `spikes` | `w` | Kills (respawn at the last checkpoint) unless `onHazard` cancels it |
| `checkpoint` | | Sets the respawn point |
| `star` | | Collectible. `Gadgets.starsGot` / `starsTotal` |
| `cracked` | `w, h` | Wall that crumbles in explosions |
| `exit` | | Calls the mode's `onExit` |
| `sign` | `text` | Tutorial speech bubble |

Platform gadgets (used by Stomp Squad, available to any game and the editor): `qblock { x, y, item: coin|power|coins5|star|life }`
(hit from below), `brick { x, y, item? }` (breaks when `canBreak`, otherwise bumps; knocks out enemies standing on it),
`coin { x, y }`, `goalpole { x, y, h }` (grab height -> `onGoal`, then `onExit`).

## Other shared systems

- **Ragdolls** (`ragdoll.js`): `Ragdolls.spawnFrom(character, {vx, vy, spin, corpse, life})`.
  Bodies with `thrownBy` and `projectileTimer` hit enemies like bowling balls. A body can override
  its own `gScale` (gravity scale) and `drag`.
- **Pixel art** (`gadgets.js`): `PixelArt.draw(sprite, x, y, pixelSize, palette)`. Sprites are arrays
  of strings, and each character maps to a palette colour.
- **UI helpers** (`frame.js`): `uiPanel`, `uiText`, `uiBar`, `uiRoundRect`, `showBanner(title, sub, color)`.
- **Audio** (`fx.js`): `SFX.play(name, x, y)`, using synthesized recipes such as `portal`, `goal`,
  `sling`, `clear`, `whistle` and `fizzle`.
- **Saving**: each game keeps its own `localStorage` key (`timsCrateLab`, `timsPortalLab`,
  `timsZombieBallCfg`, `timsParkourRush`, `timsRagdollSiege`).

## Vehicles (`vehicles.js`)

Gadgets `car { x, y, color }`, `rail { x, y, w, dy }` and `minecart { x, y, cars }` (all in Level Studio → Vehicles).
E (interact) near one gets in/out (it takes priority over the shockwave there). Cars are Verlet bodies (rolling wheels,
traction along the surface, run-over damage); the driver can shoot from the window. Rail pieces whose ends meet
join into one line; carts roll along it, slopes speed them up, A/D push, a train is a cart with `cars > 1`.

## Feel (`feel.js`)

Z (P1) / M (P2) punch: short-range hit with ragdoll knockback, hit-stop and a camera zoom kick (`Feel.zoomMult()`
feeds `updateCamera`). G / right-click with nothing else in reach grabs a player or enemy (`ch.heldChar`,
`o.grabbedBy`); grab again to throw them as a ragdoll; they wriggle free after 6 s. Settings: hero speed
(Normal / Fast / Turbo via `Feel.speedMult()`), effects Calm (default: damage numbers on the same spot add up,
half the sparks, 10 texts max, softer shake) or Full, bouncing bullets (0-3 ricochets off solid pieces).
Every object has `weight` (default 1, editable on crates in Level Studio): pushes, throws, explosions and ragdoll
impacts are divided by it.

## Building (`build.js`)

Flag `building: true` turns it on (Survival, Creative, Bed Wars); `buildFree: true` makes it free (Creative).
C / ; toggle build mode, 1-4 / [ pick block, wall, floor, ramp; T cycles wood / stone / metal (60 / 150 / 280 HP);
click / F / Enter places at the grid-snapped ghost (hold to spam), right-click / G / , takes a piece back for half.
Placed pieces are ordinary statics with `buildHP`; bullets (`Build.damage`), explosions (`Build.onExplosion`) and
enemies pushing on them wear them down. Every change calls `Pathfinder.invalidateRect`. Survival kills give wood
(and sometimes stone). Hooks: `buildCost(ch, piece, mat)`, `canBuild(ch)`, `onBuild(ch, obj)`, `onBreakPiece(obj, by)`.
Works for LAN players (toggle/piece/material and the aim point travel in the input packet).

## Level Studio (`studio.js`)

B (or the 🛠 button / pause menu) opens the editor; the old developer panel lives on as **🧪 Cheats & tuning**.
The document `{ name, mode, waves, ents }` is the source of truth; each entity has `cat`: `layout` (Object.loadMap
format), `gadget` (Gadgets format; movers store `dx2/dy2` relative to their start), `enemy` `{ power }`, `item`
`{ power }`, `spawn` `{ player }`. `Studio.docToDef(doc)` turns it into a normal level definition (with `studioSpawns`
for enemies/items, spawned by `Studio.afterReset()` at the end of `resetGame`). Saving also registers the level in
`LevelManager.customLevels`, so it shows up in the level list. While editing, `simFrozen` is true and `tick()` calls
`Studio.tick()` instead of `frame()`. During play-test, exits and goal poles return to the editor.
Opening from a game calls `Studio.park()`, which keeps references to every world array (statics, characters, zombies,
gadgets, vehicles, ragdolls...) so `rebuild()` can replace them freely; `close()` hands them back with `unpark()` and
the game carries on exactly where it was. A play-test replaces the world for real, so after one, closing reloads the
level you came from. The start card (`showStart`) picks what to edit; side-panel widths (`Studio.lw/rw`, Tab hides
them) drive the editing camera.
`createMap()` now loads a level's `gadgets` for any game whose `setupLevel` didn't.

## LAN multiplayer (`server.js` + `net.js`)

- **Run it:** double-click **Start LAN Game** (.bat / .command), press **Start LAN game** in the Control Panel
  (`updater_addons/lan.py`, a documented add-on command; it runs server.js in the background on a free port from 8080,
  remembers it in `lan.pid`, **Stop LAN game** ends it), or `node server.js [port] [--open]`. `--open` opens
  `/?lan=host`, which opens the LAN panel and hosts at once; a busy port moves to the next one, and a second launch finds
  the running server through `/lan-info` and just reopens the page. Everyone else opens the printed
  `http://<your-ip>:8080` and presses **Join**. The LAN panel probes `/lan-info` while open: as a file or from a plain
  server (the Control Panel's own Start server) it shows the two one-click ways to start instead of Host / Join.
- **Model:** host-authoritative. The host runs the normal game; each joiner gets a hero (`ch.isRemote`, `ch.netPid`,
  `playerIndex` 2+). `Components.moveTypeFinder` feeds remote heroes from `Net.applyRemoteInput` (keys, mouse-aim world point
  or pad angle, dash/grab/reload counters). Clients run no simulation: `tick()` calls `Net.clientTick()`, which draws the host's
  world from snapshots with its own camera on its own hero, and the HUD shows that hero.
- **Snapshots** (every 2 ticks): every character, enemy, crate, level piece (every 20 ticks), bullet, pickup, ragdoll and gadget,
  delta-encoded per field; HUD globals (`NET_GLOBALS`); `brawl`; and the sounds / floating texts / sparks / rings that happened.
  A new joiner triggers a full snapshot.
- **CPUs:** a joiner takes over a CPU slot if there is one (keeps team / stocks), and the CPU takes it back when they leave.
- **Mode hooks:** `addNetPlayer(slot, peer)` -> return a hero to use instead of the default; `netState()` -> JSON of private
  HUD state, applied on clients with `applyNetState(json)`.
- **Limits:** up to 16 players per server; the host's camera follows the people at the host's screen; only the host changes
  games, levels and settings.

## Difficulty and rewards

Zombie Survival's balance lives in one table, `BALANCE` in `var.js`: enemy health, damage, speed and
fire rate, the hero's post-hit invulnerability, and the drop chances for power-ups, ammo and frontier
chests. The dev panel's sliders (enemy damage, enemy health, power-up rate) multiply on top of it.

## Performance notes

- `StaticGrid` (`collisionDetector.js`) is a 320px spatial hash over the static level geometry.
  Collision queries against `allObjects` or `staticObjects` only test nearby pieces.
  Call `StaticGrid.build()` after moving static geometry yourself; gadgets already do.
- Glows use cheap layered halos instead of `shadowBlur`. The **Glow effects** setting and the
  adaptive-quality fallback (glow first, then resolution) keep slow machines at 60 FPS.
- Settled ragdolls sleep. Siege forts use their own crate sleeping (`SiegeSleep`) so tall stacks
  cost nothing until something hits them.
