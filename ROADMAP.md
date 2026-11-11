# Roadmap

Paste-ready brief for future sessions. Feed one numbered section at a time
("Do section 3 of ROADMAP.md"). The Level Studio (5) and Bed Wars (7) are the biggest pieces.
Mark a section `[DONE]` here when it ships.

## Context

Repo: timochrym/TimothysZombieGame2020 (vanilla JS canvas game, no build step; open index.html).
Read ENGINE.md first: it documents the multi-game engine (GameModes plugin registry with flags and
hooks, ModeKit.addLevel/makeHero/room, Gadgets, PixelArt, the BALANCE table in var.js, the Arcade
hub in hub.js). Each game is a game_*.js file loaded in index.html before hub.js.

Engine gotchas:
- objects.js defines `class Object`, which shadows the native Object. Use window.Object for native
  calls. Playwright tests need an init script that restores Object.is/keys/entries/getPrototypeOf
  on load.
- World coordinates are +y up. Convert to screen with wsx(x)/wsy(y) and scale with cameraScaleX.
- frame() in frame.js runs simulation and drawing in one pass. tick() runs a fixed 60 Hz loop.
- The game boots into the Arcade hub (Hub.openHub). Tests must call Hub.close() and
  GameModes.launch(id).
- Test with headless Playwright (Chromium is preinstalled): screenshots, no page errors, 60 FPS.
  Commit after each feature.

Each new game: register a mode, add a HUB_ICONS pixel icon, update ENGINE.md, and verify it in
headless Chromium before committing.

## Also done (outside the numbered sections)

- LAN multiplayer: `node server.js`, then 📡 LAN -> Host / Join. See ENGINE.md "LAN multiplayer". [DONE]

## Your named feedback items — what "done" means, and the check that proves it

Each line is the bar I hold the item to, and a script in `tests/` that re-checks it (`node <file>` from `tests/`).

| Your words | Done when | Check | Last result |
| :--- | :--- | :--- | :--- |
| "Soccer physics like character, like the actual character" | the ball is a real zombie ragdoll (same Verlet body as characters) and the players are full characters that ragdoll when tackled | `zombieball_seats.js` | ragdoll ball (11 points), tackled P1 ragdolls, no errors |
| "The blocks bounce randomly in the ragdoll siege game" | after bodies land in every fort and things settle: 0 crate bounces, 0 movement, 0 zombies dying on their own | `siege_rest.js` | all 5 forts: 0 / 0 / 0 |
| "(Add an option to do angry birds)" | a Birds ammo mode in the Siege pause menu, with the same 0-bounce bar | `siege_rest.js birds` | all 5 forts: 0 / 0 / 0 |
| "Dev improvement" | the old dev screen is replaced by the Level Studio: place, drag, resize, edit in an inspector, undo/redo, save into the level list, play-test and come back, game handed back untouched on close | `studio.js` | all steps pass, play-test exit returns to the editor |
| "Better multiplayer experience" | LAN: a host and 2 joiners play the same match, joiners move on every screen, clients at 60 FPS; local: pads 3-4 take CPU seats and every menu works on a pad | `lan_play.js`, `gamepad.js` | positions match host/client, 60 FPS; pad claimed a CPU seat, built, punched, paused |
| "Better multiplayer and cpu toggles, make it way more clear" | one Players panel (👥 button / pause menu) with per-seat Human / CPU / Off, line-up formats, and a summary of who is who shown in the top bar and at match start | `players.js`, `zombieball_seats.js` | 1v1 → 2v2 summary "P1 + CPU1 vs CPU2 + CPU3", seats Human/CPU/Off shown |

Still needs you: the final play-through ("we'll work on perfecting all of the features together"), and a look at the
Control Panel's Start LAN game button on your machine.

## Sections (build in order)

### 1. Head stomps (engine-wide) [DONE]
In Character.handleCharacterCollision (character.js): if a hero lands on an enemy from above
(hero clearly above, falling or level), damage the enemy (~35 x rpgDamageMult), bounce the hero
(higher if jump is held), and skip the hero's contact damage for a few frames. Add mode hooks
onStomp(hero, foe) and onContact(hero, foe); returning true means the mode handled it.

### 2. Square-character toggle [DONE]
Add settings.squareChars (fx.js settings, persisted) and a Settings row
"Character look: Detailed / Classic squares". In Character.createCharacter, after the aura, draw a
rounded square in the character's color with eyes that look the way it faces (enemies: angry brows
and red pupils), then draw the overlays and health bar. In Ragdolls.draw, draw a square rotated to
the neck-pelvis angle.

### 3. Better enemy AI pathfinding [DONE]
Upgrade pathfinder.js in place (keep the Pathfinder API and the P-key / dev-panel debug overlay);
do not rewrite from scratch. Fix these known defects:
- Graph only exists in a ~1500x1050 window around the camera (rebuildGraph). Build it for the
  whole level once at level load, and patch it incrementally: add
  Pathfinder.invalidateRect(x,y,w,h) and call it from object create/destroy, so later
  building/breaking only rebuilds nearby nodes.
- Edge building is O(n^2) over all nodes. Bucket nodes into a spatial hash and only test
  neighbours within jump range.
- Jump/gap edge limits are hardcoded (260/220/285 px). Derive reach from the physics constants
  (jump velocity, gravity, max speed) and tag edges with the minimum jump power needed, so each
  enemy type only uses edges it can physically make.
- Every zombie runs its own A* every ~28-42 frames. Replace with a shared Dijkstra flow field per
  target hero, recomputed a few times a second and spread across frames; each enemy just reads its
  node's next hop. Keep per-enemy A* only for special goals (flanking, beds, items). Keep
  zombie.navPath populated from the flow field so components.js code that reads it still works.
- The "same floor within 320px, skip A*" shortcut ignores walls in between; require a clear line.
- Better path following: compute a run-up/take-off point for jump edges, wait at ledges for drop
  edges, and replan on a stuck timer before falling back to jumping in place.
- Flyers (BAT, flies=true) steer straight at the target. Give them a coarse air grid with A* (or a
  flow field) so they route around walls and ceilings and keep their hover/dive states.
- Edge types for: doors/gadgets (blocked when closed), portals (Portal game), moving platforms
  (wait-and-ride), void/kill zones (never path into them).
- Group behaviour: spread enemies over alternate routes (cost penalty on edges already in use) so
  they don't queue single-file, and keep the existing flanking offsets.
- Hook for later sections: an optional "buildable" edge type (cost = blocks needed) that Bed Wars
  bots can enable to bridge gaps and tower up; off for normal enemies.

Stress test: 60+ enemies on the largest level must hold 60 FPS. Show before/after timings (ms per
frame spent in Pathfinder), and screenshot the debug overlay on two levels.

### 4. Platformer game [DONE] (STOMP SQUAD, game_platform.js)
In the style of New Super Mario Bros. Wii but fully original (no Nintendo names, characters or
art). Example name: "STOMP SQUAD". Add engine gadgets in gadgets.js so the editor can place them:
- ? block: hit from below, gives coin / power-up / 5 coins / star.
- Brick: breaks if the hero is big, otherwise bumps.
- Floating coin.
- Goal pole: score depends on how high you grab it, then calls onExit.

Platformer rules:
- Hero sizes: small, big (survives one hit) and fire (can shoot). Add a canShoot(ch) hook checked
  in Components.shootLazer.
- Star power: invincible, and touching enemies kills them.
- Lives, 100 coins = extra life, a timer, and a stomp chain score (100, 200, 400 ... then an extra
  life).
- Co-op bubble respawn: a dead player floats in a bubble until the partner pops it.
- Enemy patrol AI (enemiesPassive plus your own left/right steering that turns at walls and
  ledges): walker, hopper, flyer, a spiky enemy that can't be stomped, and a tank that takes 3
  stomps.
- 3 levels with a midpoint checkpoint and a goal. Flags: airJumps 0, dash false, wallJump true.

### 5. Level Studio [DONE] (studio.js — B or 🛠 Level Studio)
Replaces the weak dev screen and the bottom drag-out dock (#mario-maker-dock / SummonManager).
It is a full editor:
- The simulation freezes while editing: add a simFrozen flag around the update half of frame(),
  and use a free camera (pan with drag or WASD, zoom with the wheel).
- Left palette by category: terrain, stairs/slopes/slides, pads, crates/TNT, every gadget,
  enemies, items, P1/P2 spawns.
- Tools: select, box-select, move, resize handles, rotate/flip ramps, duplicate, delete,
  copy/paste, undo/redo, grid snap.
- Right inspector for every property, including gadget ids/links, sign text, enemy type and
  portalable.
- Level settings: name, which game's rules apply (survival / creative / platformer / puzzle /
  race / portal / bed wars), waves on or off.
- Save, load, new, and JSON export/import (file download/upload).
- Play-test button: build the document into a temporary level and play it under the chosen rules.
  Reaching an exit returns you to the editor with the document unchanged.
- The document (layout + gadgets + enemies + items + spawns) is the source of truth; rebuild the
  world from it after every edit (use Pathfinder.invalidateRect / full rebuild from section 3).
  Keep the old cheats/tuning panel reachable as a tab.

### 6. Building during play (Minecraft/Fortnite-style) [DONE] (build.js)
A build toggle with a grid-snapped ghost preview at the cursor, piece picker (block, wall, floor,
ramp/stairs), materials that cost resources, breaking blocks by hitting or shooting them, and fast
Fortnite-style piece placement. Placing/breaking calls Pathfinder.invalidateRect.

### 7. Bed Wars (uses the building system) [DONE] (BED BRAWL, game_bedwars.js)
Teams on islands over the void, each with a bed. Resource generators (iron, gold, plus diamonds in
the middle) feed a shop for blocks, weapons and armor. You respawn while your bed stands; break the
enemy bed, then eliminate them. 2-player local PvP plus CPU bots that bridge toward the enemy,
fight and break beds. CPU bots use Pathfinder with buildable edges enabled.

### 8. 3D view toggle (settings.view3d) [DONE] (depth.js)
Render-only "2.5D". Each static box/ramp polygon gets side faces extruded toward a vanishing point
at screen centre, shaded by face normal. Draw all side faces first, then all front faces.
Characters stay billboards. Gameplay stays 2D. Be honest that true 3D would need a new engine.

### 9. Bigger physics and two new physics games [DONE] (grids + CRASH LAB + WOBBLE WHEELS)
- Scale up physics: more ragdolls and crates at once, sleeping, cheaper broad-phase, a
  stress-tested 60 FPS budget.
- Flakboy-style sandbox: launch and abuse a crash-test-dummy ragdoll with weapons, explosives and
  props; a damage meter scores it.
- Happy Wheels-style game: a ragdoll rider on vehicles (bike, wheelchair, cart) with wheel/joint
  constraints over obstacle courses with traps; the rider detaches on big hits (no gore).

## Backlog (added after section 6) — do after sections 7-9 and the three feedback items

All new games are ORIGINAL games in the named genre (own name, art, rules text); the reference is only for the
kind of mechanics. Mark items `[DONE]` as they ship.

### B1. Feel & polish (engine-wide, cheap, every game benefits) [DONE] (feel.js)
- Bouncing bullets: optional ricochet off walls (per-weapon / per-mode flag, max bounces).
- Grab and throw players (heroes, CPU fighters, ragdolls) with the existing grab key; thrown players ragdoll.
- Punchy melee: a zoomed-in, ragdoll-driven punch/kick attack with hit-stop and knockback.
- Faster movement option (speed setting / mode flag).
- Optional weight factor on every object (`weight`): affects pushing, throwing, explosions and pressure plates;
  editable in Level Studio.
- Calmer screens during big waves: cap floating texts / sparks, merge damage numbers, a "reduce effects" setting.

### B2. Vehicles (pairs with section 9) [DONE] (vehicles.js)
- Driveable cars (enter/exit, wheel physics, ramps, crashes).
- Train / minecart on placeable rails (Level Studio piece), riders and cargo.

### B3. World generation [DONE] (TERRA, game_terra.js — tools, crafting, torch light, day/night, save/load; frontier dips into an Old Mine heading east)
- Frontier generates lower (more underground) terrain.
- Terraria-like generation: layered dirt/stone, caves, ores, surface biomes, trees.
- Block-game capabilities: dig and place tiles in the generated world (builds on `build.js`).

### B4. New games (original, genre-inspired) [DONE] — first versions of all nine; follow-ups in TODO.md
- Cell arena → **Blob Arena** (`game_cells.js`). [DONE]
- Tank arena → **Tank Arena** (`game_tanks.js`). [DONE]
- Snake arena → **Worm Arena** (`game_snake.js`). [DONE]
- Word sandbox → **Word Lab** (`game_words.js`). [DONE] (more nouns / rooms to come)
- Endless jetpack runner → **Jet Dash** (`game_jetpack.js`). [DONE]
- Board party → **Party Board** (`game_party.js`). [DONE] (more minigames to come)
- Property board game → **Rent Rush** (`game_property.js`). [DONE] (no trading yet)
- Powder toy → **Sand Lab** (`game_powder.js`). [DONE]
- 2-player minigame pack → **Table Games** (`game_table.js`): Flick Soccer + Four in a Row. [DONE] (more minigames to come)
- Engine: the `ownScreen` flag lets a game draw the whole screen itself (all of the above except Word Lab use it).
