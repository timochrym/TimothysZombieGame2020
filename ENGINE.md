# Tim's Arcade engine

One engine, seven games. Physics, characters, ragdolls, rendering, input, audio, menus and the
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

## Performance notes

- `StaticGrid` (`collisionDetector.js`) is a 320px spatial hash over the static level geometry.
  Collision queries against `allObjects` or `staticObjects` only test nearby pieces.
  Call `StaticGrid.build()` after moving static geometry yourself; gadgets already do.
- Glows use cheap layered halos instead of `shadowBlur`. The **Glow effects** setting and the
  adaptive-quality fallback (glow first, then resolution) keep slow machines at 60 FPS.
- Settled ragdolls sleep. Siege forts use their own crate sleeping (`SiegeSleep`) so tall stacks
  cost nothing until something hits them.
