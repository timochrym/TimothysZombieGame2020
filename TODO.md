# TODO — everything still to do (nothing from your suggestions is dropped)

Kept up to date on every push. Finished items move to `RETROS.md` (with measurements) and get `[DONE]` in `ROADMAP.md`.
Last updated: after Vehicles (backlog B2), during Terra (B3) and controller support.

## In progress right now
- [ ] **Terra (B3 world generation)** — `game_terra.js` generates a deep world (biomes, trees, dirt/stone, caves,
      coal/iron/gold, bedrock), streams collision chunks near the camera and draws ~2,300 tiles at 60 FPS.
      **Not working yet:** mining (hold F / left mouse) and placing (right mouse / G) — the headless test dug 0 tiles.
- [ ] **Controller support (your request)** — gamepads already drive P1/P2 movement/aim/shoot/jet/dash/grab/reload.
      Still needed: build mode / piece / material buttons, punch, vehicle enter/exit, menus (Arcade hub, pause,
      Players & LAN panels, Level Studio basics), pads 3-4 for Brawl/Soccer/Bed Wars slots, and showing which pad
      drives which player in the Players panel.

## Genre-feel pass (your request: "make each game closer to the game it's trying to be")
Play and feel like the genre's best, with ORIGINAL look (no copied characters, art style, music or levels):
- [ ] Stomp Squad (platformer): run button with momentum, skid turns, crouch, ground-pound, wall-slide, enemies that
      turn into kickable shells, power-up pop-out animations, flagpole slide + walk-off, overworld/underground themes,
      cleaner chunky original sprites for heroes, enemies and blocks.
- [ ] Terra (sandbox): tools (pickaxe/axe tiers), crafting bench + recipes, torches & real light map, day/night with
      night enemies, inventory screen, world save/load, ore veins and biomes underground.
- [ ] Zombie Ball (physics soccer): one-button stiff-legged ragdoll players that swing and flail, bouncy big-head
      characters, unpredictable physics goals — the "soccer physics" feel — alongside the current mode.
- [ ] Bed Brawl, Siege (Birds), Wobble Wheels, Crash Lab, Parkour Rush, Crate Lab, Portal Lab, Brawl: same pass —
      list each genre's core feel features and close the gaps.

## Your suggestions not built yet (backlog, all original games in the genre — no copied names/art)
- [ ] B3 — "Lower generated level": make the Survival frontier generate lower / more underground terrain (Terra is a
      separate deep world; the frontier itself is unchanged so far).
- [ ] B3 — Terraria-like generation + block-game capabilities → Terra (above). Next: save/load worlds, crafting
      (planks from wood, torches), lighting from torches, enemies at night / in caves, LAN sync of the tile grid.
- [ ] B4 — Cell arena (agar-style): eat pellets & smaller cells, split, eject mass.
- [ ] B4 — Tank arena (diep-style): shoot shapes for XP, level up, upgrades, tank classes.
- [ ] B4 — Snake arena (slither-style): growing snake, boost, cut others off.
- [ ] B4 — Word sandbox (scribblenauts-style): type a noun, it appears with sensible behaviour.
- [ ] B4 — Endless jetpack runner (jetpack-joyride-style): hold to fly, dodge lasers/missiles, coins.
- [ ] B4 — Board party (mario-party-style): dice board + quick minigames between turns, stars/coins.
- [ ] B4 — Property board game (monopoly-style, original): buy, trade, build, rent.
- [ ] B4 — Powder toy (falling sand): sand, water, fire, oil, plants, lava, walls.
- [ ] B4 — 2-player minigame pack (GamePigeon-style), led by tabletop flick soccer (the Plato Android one).

## Known issues / polish found while building (from RETROS.md)
- Pathfinding: "60 FPS with 60+ enemies" met for the JS budget, not in headless software rendering; frontier pathing ~1 ms.
- LAN: bandwidth is per client through the relay (~340 KB/s with 60 enemies); mode HUD state only synced for Stomp
  Squad and Bed Brawl; minecarts/rails and Terra tiles not visible on LAN clients; Wobble Wheels has no LAN riders.
- Stomp Squad: courses tuned by eye; fireballs don't bounce; enemies show unneeded health bars; bubble co-op and
  courses 2-3 only smoke-tested.
- Level Studio: no multi-level campaigns; mover end points are numbers (not draggable); no thumbnails.
- Building: hold-to-spam can feel unresponsive over your own last piece.
- Bed Brawl: bots don't use the pathfinder's bridge/tower edges; one map; slow restock at the start.
- 2.5D view: faces are flat-shaded, not textured.
- Crash Lab / Wobble Wheels: wheelchair is a weak climber; rider pose on the bike is crude.
- Siege Birds: abilities assigned by shot slot; stone is unbreakable.
- Zombie Ball: confirm the "soccer physics like the actual character" interpretation (ball = zombie ragdoll).
- Players panel: no free per-slot Human/CPU/Off toggles yet; pads can't be reassigned.
- Head stomps make Survival easier — difficulty not re-measured. Square-look Settings row only checked in code.

## Final pass you asked for
- [ ] "At the very end we'll work on perfecting all of the features together and possible bug fixes" — a full
      play-through of every game with you, fixing what you find.

## Your suggestions, word for word (so nothing gets lost)
- Head stomps; square-character toggle; NSMB-style platformer; Level Studio replacing the dev screen; Minecraft /
  Fortnite building; Bed Wars; 3D view toggle; bigger physics; Flakboy-style sandbox; Happy Wheels-style game.
- "and better enemy AI path finding"
- "Soccer physics like character, like the actual character"
- "The blocks bounce randomly in the ragdoll seige game (Add an option to do angry birds)"
- "Dev improvement" · "Better mulitplayer experience" · "Better multiplayer and cpu toggles, make it way more clear whats going on"
- "local LAN multiplayer with mulitple players … add this first"
- "Bouncing bullets" · "Grab and throw players" · "Zoomed in ragdoll punchy based attacks and physics" · "Faster speed"
- "Driveable cars" · "Train / minecart" · "Lower generated level" · "Teraria like generation" · "BLock game capabiliteis"
- "Agrio" · "deepio" · "Slitherio" · "Scribblenauts" · "Jetpack Joyride" · "Mario party mode, monopoly"
- "Object should have an optional weight factor"
- "A bit less visually busy during waves and lots of text and hits and action"
- "A version of the pixels powder game"
- "all the game pigeon games espcially the soccer tabletop one from the andriod clone (plato)"
- "Add controller support and push to main"
- "make sure in the angry birds like clones, after throwing more than 2 dudes, the blocks don't stop randomly and incorrectly bouncing and accidentally killing everything"
- "Make each game closer to the game it's trying to be both visually, functionally, and in game play. Mario should look more like mario, terraria like terraria, soccer physics like soccer physics"
