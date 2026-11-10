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
- [x] Controller: Level Studio gamepad editing (cursor, A place/select/drag, B delete, X rotate, LB/RB pieces, LT/RT
      zoom, Y play-test, Start save, Back close); Wobble Wheels pads 3-4 get their own riders.
- [x] Controller: remapping screen (Settings → Controls): all 20 P1/P2 keys and 7 gamepad action buttons, clash
      highlight, reset to defaults, saved. (A remapped key's old default still works too — harmless, noted.)
- [x] **Textures for the new blocks** — 21 new pixel textures (textures.js) used by building pieces, Terra tiles,
      platformer pipes / used blocks, Bed Brawl beds, Siege glass, Crash Lab spikes; all listed in Level Studio.
- [ ] More textures still to do: vehicles (car body, cart), rails, Bed Brawl pedestals/generators, Wobble Wheels
      course pieces, Crash Lab lab props, enemies' weapons.
- [x] **More detailed characters when big** — skinned heroes and enemies get limb shading + highlights and shine on
      round parts; the original pixel hero gets soft lighting, a rim light and eye catch-lights (Settings toggle).
- [ ] Character detail still to do: ragdoll bodies (they use their own drawing), hands/feet on the square look.

## Genre-feel pass (your request: "make each game closer to the game it's trying to be")
Play and feel like the genre's best, with ORIGINAL look (no copied characters, art style, music or levels):
- [x] Stomp Squad (platformer): run button with momentum (Shift / Right-Shift / pad X·B), skid dust, ground-pound,
      Shellback shells (chain kills, wall bounce, vanish off-screen), flagpole slide + walk-off, wall-slide / wall-jump
      (was already on), power-ups rising out of blocks (already there), course themes: Meadow / dark Cave with
      stalactites and crystals / bright Sky with drifting clouds (new `drawBack` hook).
      Left for the polish pass with you: crouch, a dedicated shell sprite, chunkier hero / enemy sprites (taste calls).
- [x] Terra (resumed after the other tasks, as "pause in favor of other tasks" implied): pickaxe tiers (hands → wood →
      stone → iron → gold) gating stone / iron / gold / crystal and speeding mining up, crafting panel (C: planks,
      workbench, torches, pickaxes, bricks — tools need a workbench nearby), torches + a per-tile light map (sky light
      by time of day fading underground, torches, heroes' glow), day / night cycle (4 min) with monsters on the surface
      at night (gone at dawn), inventory screen (I), save / load (K / L) + autosave every minute + continue on launch,
      ore veins, a deep layer (deepstone + crystals), no game over (you wake at spawn). E shockwave to fight.
      LAN: the tile grid streams to clients (re-sent when it changes); LAN players dig / place into a shared stash. Still open: axes / swords, more biomes.
- [x] Zombie Ball "Flail" style (pause menu → Style): one-button physics soccer — two big-headed, stiff-legged
      ragdoll players per team, tap = jump & kick, hold = tip forward, they stand back up; CPUs time presses.
- [x] Flail polish: goalkeepers (on by default; they hold the goal line and spring straight up), modifiers in the
      pause menu (Wind with gusts that change after goals, Big heads, Ice pitch, Random each match), slow-mo on goals.
      Not done (low value for now): a 2-button variant, full instant replays.
- [x] Siege Birds: opening fly-by over the fort (click skips), dotted trail of the last shot, the next bird sits in the
      sling, crack lines on hurt wood/glass/stone, +250 / +500 / +1000 / +1500 pop-ups, and breakable fort STONE in
      Birds mode (bird impacts, especially the Boulder, and explosions; what it holds up falls). Helmeted zombies are
      the existing Knights; the pause menu's Fort row already shows each fort's stars.
      Left for the polish pass with you: more stone in the forts, score-based star thresholds vs the current
      "spare birds" rule (a design call).
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
- [~] Brawl: DONE — KO blast (a beam of the fighter's colour fires in from the edge they flew out of), the damage
      percent jolts when hit, results table on GAME! (KOs credited to the last hitter within 5 s, falls, damage dealt),
      eliminated panels no longer show the percent under "OUT". STILL TO DO: shield/dodge button, ledge grab,
      character-specific moves, more stages, items like a bat or a bomb to throw.

## Your suggestions not built yet (backlog, all original games in the genre — no copied names/art)
- [x] B3 — "Lower generated level": heading east, the Survival frontier now dips underground — an Old Mine entrance
      (stepped shaft under timber roofing), a Deep Mine tunnel 560 px below the trail (scaffolds, ore crates, dynamite,
      knights / archers / bats) and a climb back to daylight, before the Deep Echo Caverns. (West of the start is
      unchanged: chunk heights chain west→east only.)
- [x] B3 — Terraria-like generation + block-game capabilities → Terra (above): save/load, crafting, torch lighting,
      night enemies, LAN tile sync done.
- [x] B4 — Cell arena (agar-style) → **Blob Arena**: eat pellets and blobs 25% smaller, bigger = slower, split to lunge
      (pieces merge back after 9 s), eject mass, spiky viruses pop big blobs into pieces, 14 CPU blobs that flee /
      chase / lunge / dodge viruses, leaderboard, best mass, local P2 + pads. Next: LAN, teams, feeding viruses.
- [x] B4 — Tank arena (diep-style) → **Tank Arena**: squares / triangles / pentagons (nest in the middle) for XP, 45
      levels, 8 stats on 1-8, classes at 15 (Twin, Sniper, Machine Gun, Flank Guard) and 30 (Triple Shot, Assassin,
      Destroyer, Tri-Angle), recoil, bullet pierce + bullet-vs-bullet, body ramming, 8 CPU tanks that farm / fight /
      flee, auto-fire, local P2 with auto-aim + pads. Next: LAN, drone classes, team mode, more tier-2 classes.
- [x] B4 — Snake arena (slither-style) → **Worm Arena**: round arena, mouse / A-D steering, boost burns length and drops
      food, head-into-body kills and bursts into pellets, 11 CPU worms that hunt food and cut smaller worms off,
      leaderboard, minimap, best length, local P2 (shared zooming camera), pads. Next: LAN, skins, team mode.
- [~] B4 — Word sandbox → **Word Lab**: 5 rooms with a star to reach; Enter/T opens a text box; ~90 nouns (crates,
      boulders, TNT, balls, walls, platforms, bridges, clouds, stairs, ramps, trampolines, fans, cars, 10 monster kinds,
      dummies, power-ups, jetpack, explosions) + adjectives (big/huge/tiny, heavy/light, bouncy, explosive, 13 colours,
      angry); unknown and "cheat" words get a reply; 3 stars for meeting the word par. STILL TO DO: many more nouns
      (water, rope, balloon that lifts, animals that follow you), more rooms, verbs ("fly", "shrink").
- [x] B4 — Endless jetpack runner → **Jet Dash**: hold to fly, speeds up over distance, zappers (static, gates,
      spinning), missiles that lock on behind a blinking ! warning, laser beams that charge then fire, coin ribbons,
      shield bubble, best distance + banked coins, local P2 on the same run, pads. Next: a coin shop (outfits,
      jetpack styles), vehicles to ride, daily missions.
- [~] B4 — Board party → **Party Board**: 2-4 players (P1 Space, P2 Enter, pads 3-4 join, rest CPUs), 28-space loop,
      blue/red/event spaces, a star that moves after each purchase (20 coins), 5 random events, a minigame every
      round (Mash, Quick Draw, Stop It), 5-20 rounds, results. STILL TO DO: more minigames (re-use Jet Dash / Worm
      Arena / Flick Soccer as minigames), items, branching board paths, more boards.
- [~] B4 — Property board game → **Rent Rush**: 24 spaces, 5 colour groups + 2 transit lines, buy / rent / full-set
      double rent / houses (3 per street), chance cards, city tax into a Lounge pot, detention, doubles, selling to
      raise cash, bankruptcy, round limit; 2-4 players (P1/P2 keys + click, pads 3-4, CPUs that buy/build sensibly).
      STILL TO DO: trading between players, mortgages, auctions.
- [x] B4 — Powder toy (falling sand) → **Sand Lab**: sand, water, wall, fire, oil, plant, lava, stone, steam, wood +
      eraser; lava+water → stone & steam, fire spreads through oil/plants/wood, plants grow into water, steam rains back
      down; brush size, pause, fast-forward, save/load. Next: more elements (acid, ice, gunpowder, seeds), gamepad cursor.
- [~] B4 — 2-player minigame pack → **Table Games**: Flick Soccer (5 discs a side, drag-back flicks, posts, goals, first
      to 3, CPU that picks the best disc/angle, keyboard/pad aiming) and Four in a Row (minimax CPU, 3 skills), vs CPU or
      pass-and-play. STILL TO DO: more minigames (air hockey, pool-style cue game, darts, word grid, tanks artillery),
      online/LAN turns.

## Known issues / polish found while building (from RETROS.md)
- LAN: all nine new games work over LAN now (turn-based ones seat LAN players in CPU seats; Worm / Blob / Tank Arena
  give each LAN player their own worm / blob / tank; Jet Dash adds them as runners; Sand Lab lets them paint into the
  host's box). Known limits: Tank Arena LAN tanks get auto stats / class; Sand Lab LAN painters pick materials with
  1-0 (palette clicks are host-only); ~0.3-0.5 MB/s per client in the arenas.
- Pathfinding: "60 FPS with 60+ enemies" met for the JS budget, not in headless software rendering; frontier pathing ~1 ms.
- LAN: bandwidth is per client through the relay (~340 KB/s with 60 enemies); mode HUD state only synced for Stomp
  Squad and Bed Brawl; minecarts/rails not visible on LAN clients (Terra tiles: done). (Wobble Wheels LAN riders: done.)
- Stomp Squad: courses tuned by eye; bubble co-op and courses 2-3 only smoke-tested. (Fireballs now bounce along the
  ground; enemy health bars are hidden via the new `noEnemyBars` flag.)
- Level Studio: no multi-level campaigns; mover end points are numbers (not draggable); no thumbnails.
- Building: hold-to-spam can feel unresponsive over your own last piece.
- Bed Brawl: bots don't use the pathfinder's bridge/tower edges; one map; slow restock at the start.
- 2.5D view: faces are flat-shaded, not textured.
- Crash Lab / Wobble Wheels: wheelchair is a weak climber; rider pose on the bike is crude.
- Siege Birds: abilities assigned by shot slot (stone is breakable now).
- Zombie Ball: confirm the "soccer physics like the actual character" interpretation (ball = zombie ragdoll).
- Players panel: per-seat Human / CPU / Off toggles and CPU counts now exist for Party Board, Rent Rush, Table Games,
  the three arenas and Jet Dash (`seats()` hook). Brawl / Zombie Ball / Bed Brawl keep their line-up cards. Pads still
  can't be reassigned to a different player number.
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
