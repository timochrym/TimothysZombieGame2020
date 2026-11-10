# TODO — everything still to do (nothing from your suggestions is dropped)

Kept up to date on every push. Finished items move to `RETROS.md` (with measurements) and get `[DONE]` in `ROADMAP.md`.
Last updated: after Vehicles (backlog B2), during Terra (B3) and controller support.

## In progress right now
- [x] **Terra (B3 world generation)** — `game_terra.js`: deep generated world (forest/desert/hill biomes, trees,
      dirt over stone, caves, coal/iron/gold, bedrock), chunk-streamed collision, mining and placing with a 9-slot
      hotbar, underground darkness with a light around the hero, 60 FPS. (Genre-feel extras are in the pass below.)
- [x] **Controller support** — 4 pads (3-4 take CPU slots), build mode on Select (LB/RB piece, X material, RT place,
      LT take back), LT punch, Y vehicles/shops, menus (Arcade, pause, Players/LAN close with B), Siege (stick aim +
      RT fire), Crash Lab (RT uses the tool at the aim point, Select cycles tools), Terra (Select cycles blocks).
- [ ] Controller: Level Studio has no gamepad editing (mouse/keyboard only); Wobble Wheels P3/P4; button remapping.
- [x] **Textures for the new blocks** — 21 new pixel textures (textures.js) used by building pieces, Terra tiles,
      platformer pipes / used blocks, Bed Brawl beds, Siege glass, Crash Lab spikes; all listed in Level Studio.
- [ ] More textures still to do: vehicles (car body, cart), rails, Bed Brawl pedestals/generators, Wobble Wheels
      course pieces, Crash Lab lab props, enemies' weapons.
- [x] **More detailed characters when big** — skinned heroes and enemies get limb shading + highlights and shine on
      round parts; the original pixel hero gets soft lighting, a rim light and eye catch-lights (Settings toggle).
- [ ] Character detail still to do: ragdoll bodies (they use their own drawing), hands/feet on the square look.

## Genre-feel pass (your request: "make each game closer to the game it's trying to be")
Play and feel like the genre's best, with ORIGINAL look (no copied characters, art style, music or levels):
- [~] Stomp Squad (platformer): DONE — run button with momentum (Shift / Right-Shift / pad X·B), skid dust,
      ground-pound (S in the air: hang, slam, kills nearby foes, big heroes break bricks underneath), Shellback
      enemies that turn into kickable shells (chain kills, wall bounce, vanish off-screen), flagpole slide + walk-off.
      STILL TO DO: crouch, wall-slide, power-up pop-out animations, overworld/underground themes,
      cleaner chunky original sprites for heroes, enemies and blocks, a proper shell sprite (now a squashed foe).
- [ ] ⏸ PAUSED — Terra (sandbox): tools (pickaxe/axe tiers), crafting bench + recipes, torches & real light map, day/night with
      night enemies, inventory screen, world save/load, ore veins and biomes underground.
- [x] Zombie Ball "Flail" style (pause menu → Style): one-button physics soccer — two big-headed, stiff-legged
      ragdoll players per team, tap = jump & kick, hold = tip forward, they stand back up; CPUs time presses.
- [ ] Flail polish: goalkeepers, wind / big-head / ice modifiers, slow-mo replays of goals, 2-button variants.
- [~] Siege Birds: DONE — opening fly-by over the fort (click skips), dotted trail of the last shot, the next bird sits
      in the sling, crack lines on hurt wood/glass, +250 / +1000 / +1500 score pop-ups (blocks / zombies / spare
      birds). STILL TO DO: stone blocks that can break, helmeted "boss" zombies, a fort-select screen with stars,
      score-based star thresholds, a proper mid-flight camera follow on very long shots.
- [~] Bed Brawl: DONE — kill feed (kills, FINAL KILLs, void falls, beds, upgrades), team upgrades bought with mid-island
      diamonds (Forge ×2 = faster generator, Sharp = +25% team damage; bots buy them too), sudden death at 5:00 breaks
      every bed, armor now goes to 3 from gold, cleaner shop labels. STILL TO DO: fireball & bridge-egg style items,
      pickaxe tiers for breaking defenses, more maps / 4 teams, emerald-tier mid resource.
- [~] Wobble Wheels: DONE — vehicle specials on Space/F (P2 Enter, pad B/X/RB): bike bunny-hop, cart big jump,
      wheelchair rocket with a fuel bar; flips counted in the air (each ≈full turn landed = -0.5 s), slow-mo on crashes;
      FIXED the wheelchair (it tipped onto its back at spawn and crawled — now upright with a backrest, 10× faster).
      STILL TO DO: more courses + a course select with medals, eject button, ghost of your best run, more vehicles
      (pogo, scooter, shopping trolley), destructible obstacles, hazards that react (falling platforms, fans).
- [~] Crash Lab: DONE — "Stair Drop" scenario (pause → Scenario): one push from the top of a 14-step staircase, the
      score runs until the dummy comes to rest, best saved; damage heat-map (head / torso / limbs drift from yellow to
      bruised red); slow-mo on huge hits. STILL TO DO: more scenarios (cliff + car, highway, half-pipe), vehicles to
      launch the dummy in, pose picker before the push, replay of the run, a closer camera in Stair Drop.
- [~] Parkour Rush: DONE — speedrun splits (time at each checkpoint vs your best run's split, green −/red +, saved
      with the best), speed lines when you're really moving, new engine hook onCheckpoint. STILL TO DO: slide-under
      gaps and vault/ledge-grab moves, a level select showing medals, a per-checkpoint quick restart key.
- [~] Crate Lab: DONE — visible wiring from every plate / lever to the door, lift or bridge it powers (grey when off,
      green with flowing current when on); a hint per room on H, offered after 45 s. STILL TO DO: more rooms (lasers &
      mirrors, conveyor belts, buttons with timers), a room-select grid with best times, an undo-free "reset crate" key.
- [~] Portal Lab: DONE — aim reticle shows where the beam lands and whether a portal will stick (blue/orange ghost
      outline on white panels, red ✕ elsewhere); X closes your portals. STILL TO DO: more chambers (laser relays,
      light bridges, turrets that ragdoll), pad-aim reticle, chamber-select grid.
- [ ] Brawl: same pass —
      list each genre's core feel features and close the gaps.

## Your suggestions not built yet (backlog, all original games in the genre — no copied names/art)
- [ ] B3 — "Lower generated level": make the Survival frontier generate lower / more underground terrain (Terra is a
      separate deep world; the frontier itself is unchanged so far).
- [ ] ⏸ PAUSED by you — B3 — Terraria-like generation + block-game capabilities → Terra (above). Next: save/load worlds, crafting
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
- "Add lots of textures for all the new blocks and stuff" · "make the characters a bit more detailed when they are scaled up"
- "Make each game closer to the game it's trying to be both visually, functionally, and in game play. Mario should look more like mario, terraria like terraria, soccer physics like soccer physics"
