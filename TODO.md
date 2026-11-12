# TODO — everything still to do (nothing from your suggestions is dropped)

Kept up to date on every push. Finished items move to `RETROS.md` (with measurements) and get `[DONE]` in `ROADMAP.md`.
Last updated: after the UI pass (top bar, pause menu, Level Studio, one-click LAN).

## 2026-11-12: "code so I can have snakio in agario in diepio"
- [x] **Arena Mix**: worms inside blobs inside tanks in one arena; play as tank, blob or worm (Q). `tests/arena_mix.js`.
- [x] Arena Mix rules v2 (your spec): blobs absorb bullets; tanks are blobs with a gun (mass, eat / get eaten, break
      apart on a virus or heavy damage, biggest piece keeps the gun, lumps are food); worms level up, break blocks, bite
      tanks; blobs pop on worms; shared power-ups for tanks and worms.
- [ ] Arena Mix follow-ups: P2 / LAN players, blob and worm CPUs that react to tanks, balance after your play-through.

## Your list of 2026-11-11 (evening) — order: multiplayer, then menus/tools, then games. Live status: PROGRESS.md
- [x] LAN: joiners' browsers calculate their own hero locally so play is fluid; smaller packets. → 70 → 15 ms to first movement, 120 → 55 KB/s (`tests/lan_perf.js`). Needs your feel-test on two real devices.
- [x] LAN: player 2 can't see the food I drop in Blob Arena.   - [x] Player 2 movement in the soccer game (Flail style had no team for a second player and didn't draw on a joiner's screen). Check: `tests/lan_joiner.js`.
- [x] Blob Arena: game settings (decay rate, decay that grows with size), size cheat, more players (0–40 slider, live),
      spawn shield, power-up pickups borrowed from the other games. Check: `tests/blob_settings.js`.
- [x] Cheat menu: the always-on drag-out toolbar — now only on Build + Place; arenas hide what doesn't apply. `tests/panel_dock.js`.
- [x] Zombie game: can't select the other levels. → the pause row only cycled a name with the mouse; now a click-a-card grid. `tests/level_select.js`.
- [x] Brawl: combo hits are way too strong. → chained hits fade, 6th is a combo break. `tests/brawl_combo.js`.
- [ ] Enemy tracking and pathfinding is still bad.
- [x] Blocks sometimes do too much damage; weight field; every field reachable in the inspector. `tests/inspector_fields.js`.
- [ ] Editing hand, dragging and playing all enhanced.
- [ ] Menus: pause menu, player 2 menu, inspector, editor, toolbars, game cheats, right-click options, dropdowns — all
      intuitive. "Imagine Steve Jobs designed this universal game engine."
- [ ] Zombie Ball: smaller map, closer to one-button physics soccer, bright look like the screenshot (original art).
- [ ] Wobble Wheels: movement, rotation, functions, map — rethink everything.
- [ ] Every game on the same engine and able to interact with most things; improve and test each game.
Your words: "Please fix multiplayer LAN to rely on the browsers own calculated results to as a way to keep the game fluid.
Currently its laggy probably because so much data is being sent every packet. We need a method of local calcuations for
connected players / Also AGARIO should have game settings like, if there is a decay rate if if that rate increases. There
should be cheats for changing the size, player 2 can't see the food I drop. Add more players if desired, a slider or custom
amount or something. Add ability to interact with other things we have already coded. Player 2 movement for the soccer
message game does not work / The cheat menu always having this drag out toolbar is hideous / If you could overall improve
and test the games. Each game should be connected with the same game engines and be able to interact with most things /
Zombie game I can't select the other levels, it does not work / COmbo hits for brawl are way too OP / Enemy tracking and
pathfinding is still horrible. / Sometimes the blocks do too much damage and I thought they had a weight field now. all the
fields should be accessible in the inspector menu / The editing hand and dragging and playing should all be enhanced. /
Imagine like steve jobs designed this universal game engine for simple html games. yk let's make some major improvement.
Push updates as you go and keep a log of your progress and where what changes you are planning on making next / Zombie ball
still is not that fun, make the map smaller and match it closer to soccer physics. It should really look pretty close to
the screenshot / Happy wheels app is also completely broken, the movement, rotation, functions, map, everything needs to be
rethought. / Improve core multiplayer, local calculations for connected players, then move on to making the pause menu,
player 2 menu, inspector, editor, tool bars, game cheats, menus, right click options, drop downs, make everything make
sense and intuitive. THen move on to improving the Games. What's the est way we can perfect each one the fastest"

## Latest implementation handoff (2026-11-11)
Implemented: soccer ball foreground rendering and LAN ball/score sync; Flick Soccer shared P2 keys and help;
boost release; stable character landings; navigation graph invalidation, non-looping flow routes, moving-platform waypoints;
12 enemy appearances and three object appearances; Arcade play/time and score records; arena cheats and tank difficulty;
Terra creative mode; Birds default; Wildwood Frontier name; four Sand Lab materials and brush controls;
Jet Dash coin magnet/starting-shield purchases; Wobble Wheels Wind Works course with fans and smash gates.

Still open: arbitrary object possession and using the roster in bespoke full-screen renderers; comprehensive per-player
win/loss histories and all table-game results; exhaustive cheats for every mode; further genre/art polish based on your
play-through. The older genre backlog below is not all complete. Physical two-device LAN and Control Panel integration
still need testing on your devices. See RETROS.md for validation and scope.

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
- [x] More textures: car panels (seams + rivets over any paint), riveted iron minecarts, wooden rail ties, Bed Brawl
      stone pedestals and generator grates: DONE. Enemies' weapons: already drawn in detail by the default look
      (skins.js: bow + arrow, sword + shield, staff + orb) — nothing to add. Crash Lab props (iron "1 TON" weight,
      chain-link wrecking ball with a shaded iron ball, steel-shaded spikes): DONE.
- [x] **More detailed characters when big** — skinned heroes and enemies get limb shading + highlights and shine on
      round parts; the original pixel hero gets soft lighting, a rim light and eye catch-lights (Settings toggle).
- [x] Character detail: ragdoll limbs get a soft highlight when zoomed in and boots that point along the shin; the
      square look got hands at its sides and feet that step while walking (both checked in zoomed screenshots).

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
      every bed, armor now goes to 3 from gold, cleaner shop labels; ☄ Fireball (24 iron: flies straight along your aim
      and bursts on impact, blasting placed blocks) and 🥚 Bridge Egg (20 iron: lays up to 16 blocks behind it at your
      feet's height): DONE. STILL TO DO:
      pickaxe tiers for breaking defenses, more maps / 4 teams, emerald-tier mid resource.
- [~] Wobble Wheels: DONE — vehicle specials on Space/F (P2 Enter, pad B/X/RB): bike bunny-hop, cart big jump,
      wheelchair rocket with a fuel bar; flips counted in the air (each ≈full turn landed = -0.5 s), slow-mo on crashes;
      FIXED the wheelchair (it tipped onto its back at spawn and crawled — now upright with a backrest, 10× faster).
      E eject (bail out, flung off), ghost of your best run per course + vehicle. Course 4 "Crumble Run" with
      crumbling slabs (shake, then drop) over a shallow pit, and a course select with medals per vehicle: DONE. STILL TO
      DO: destructible obstacles, fans. (Scooter with a kick-push, a sturdy shopping Trolley, and a self-bouncing
      Pogo the rider keeps balanced: DONE.)
- [~] Crash Lab: DONE — "Stair Drop" scenario (pause → Scenario): one push from the top of a 14-step staircase, the
      score runs until the dummy comes to rest, best saved; damage heat-map (head / torso / limbs drift from yellow to
      bruised red); slow-mo on huge hits. "Cliff Fall" scenario (a 2000 drop with rock outcrops, pads, crates and TNT below; best saved per scenario):
      DONE. STILL TO DO: more scenarios (highway, half-pipe), vehicles to
      launch the dummy in, pose picker before the push, replay of the run. (Closer camera in Stair Drop: DONE.)
- [~] Parkour Rush: DONE — speedrun splits (time at each checkpoint vs your best run's split, green −/red +, saved
      with the best), speed lines when you're really moving, new engine hook onCheckpoint. STILL TO DO: slide-under
      gaps and vault/ledge-grab moves. (T = back to your last checkpoint, course select with medals: DONE.)
- [~] Crate Lab: DONE — visible wiring from every plate / lever to the door, lift or bridge it powers (grey when off,
      green with flowing current when on); a hint per room on H, offered after 45 s. STILL TO DO: more rooms (lasers &
      mirrors, conveyor belts, buttons with timers). (T = crates back where they started, room-select grid with best
      times and locks: DONE.)
- [~] Portal Lab: DONE — aim reticle shows where the beam lands and whether a portal will stick (blue/orange ghost
      outline on white panels, red ✕ elsewhere); X closes your portals. STILL TO DO: more chambers (laser relays,
      light bridges, turrets that ragdoll). (Reticle for pad / P2 aim; chamber-select grid with best times; chamber names
      made original: DONE.)
- [~] Brawl: DONE — KO blast (a beam of the fighter's colour fires in from the edge they flew out of), the damage
      percent jolts when hit, results table on GAME! (KOs credited to the last hitter within 5 s, falls, damage dealt),
      eliminated panels no longer show the percent under "OUT"; ledge grab (catch the stage lip while falling, UP climbs,
      DOWN lets go); shield (hold DOWN on the solid stage: no damage or knockback, shrinks, breaks into a dizzy spell;
      CPUs raise it vs incoming shots); throwable bombs in the item drops (G grab, click throw, explode on impact;
      unused ones fizzle after 25 s); a 4th stage, Gearworks (slopes off both ends + a lift sweeping across): DONE.
      A bat in the item drops (walk over it; E swings it instead of the shockwave, 6 swings, 1.8× launch): DONE.
      Character moves on E per hero look (Original: shockwave · Stick Fighter: Rising Uppercut · Street Brawler:
      Ground Slam · Cap Hero: Rocket Punch): DONE.

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
      angry); unknown and "cheat" words get a reply; 3 stars for meeting the word par. DONE since: verbs (fly, grow,
      shrink, normal, heal), rope / vine, a balloon that floats up and lifts you while you hold it (G), "big"/"tiny"
      now really resize monsters; rooms 6-8 (Low Door needs "shrink", The Tower needs "fly" / a balloon / a giant rope,
      Pressure Point needs something heavy on a plate); pets that follow you (dog bites monsters, cat, bird hovers
      beside you); water ("water", "pool", "lake"…: fills down to the ground, you swim with W / Space, crates float):
      DONE. (Polish: a faint square outline of the pet's hidden crate still shows.)
- [x] B4 — Endless jetpack runner → **Jet Dash**: hold to fly, speeds up over distance, zappers (static, gates,
      spinning), missiles that lock on behind a blinking ! warning, laser beams that charge then fire, coin ribbons,
      shield bubble, best distance + banked coins, local P2 on the same run, pads. Next: a coin shop (outfits,
      jetpack styles), vehicles to ride, daily missions.
- [~] B4 — Board party → **Party Board**: 2-4 players (P1 Space, P2 Enter, pads 3-4 join, rest CPUs), 28-space loop,
      blue/red/event spaces, a star that moves after each purchase (20 coins), 5 random events, a minigame every
      round (Mash, Quick Draw, Stop It, Timing, Hold It), 5-20 rounds, results. STILL TO DO: more minigames (re-use Jet Dash / Worm
      Arena / Flick Soccer as minigames), items, branching board paths, more boards.
- [x] B4 — Property board game → **Rent Rush**: 24 spaces, 5 colour groups + 2 transit lines, buy / rent / full-set
      double rent / houses (3 per street), chance cards, city tax into a Lounge pot, detention, doubles, selling to
      raise cash, bankruptcy, round limit; 2-4 players (P1/P2 keys + click, pads 3-4, CPUs that buy/build sensibly).
      + auctions when a street is skipped (CPUs bid to a valuation, humans press to raise), mortgages (automatic when
      short of cash before selling; no rent while mortgaged; M / button to buy back at 55%), trading (T / TRADE: offer to
      buy the street that best completes your colour; CPUs accept fair offers that don't break their own set, humans
      ACCEPT / DECLINE; CPUs propose too). Done.
- [x] B4 — Powder toy (falling sand) → **Sand Lab**: sand, water, wall, fire, oil, plant, lava, stone, steam, wood +
      eraser; lava+water → stone & steam, fire spreads through oil/plants/wood, plants grow into water, steam rains back
      down; brush size, pause, fast-forward, save/load. Next: more elements (acid, ice, gunpowder, seeds), gamepad cursor.
- [~] B4 — 2-player minigame pack → **Table Games**: Flick Soccer (5 discs a side, drag-back flicks, posts, goals, first
      to 3, CPU that picks the best disc/angle, keyboard/pad aiming) and Four in a Row (minimax CPU, 3 skills), vs CPU or
      pass-and-play; Air Hockey (real time: mouse / WASD vs CPU, arrows or a LAN player; first to 7); Hill Cannons
      (turn-based artillery: craters, wind, CPU that simulates its shots, pass-and-play or a LAN player): DONE.
      Pocket Race (a cue game: 7 balls, pot = +1 and shoot again, scratch = -1; drag-back aiming, ghost-ball CPU, LAN):
      DONE. Sway Darts (the aim drifts in a figure-eight; hold to steady, but not too long; rings 5-50 and an outer
      ×2 ring; 3 darts × 5 rounds; CPU waits for a calm moment) and Word Hunt (a 10×10 grid hiding 8 game words in
      8 directions; race by mouse drag or keyboard cursor; CPU finds a word every 6-15 s): DONE.

## UI pass (your request: top bars, pause menus, Studio, inspector, builders, LAN start)
- [x] Top bar: 4 compact buttons + grouped ☰ menu, dims while playing, no HUD overlap, adapts to narrow windows.
- [x] Pause menu: fits any window (shrinks, then scrolls with keys / wheel), follows the mouse.
- [x] Level Studio: game parked and handed back on close, start card, one-line toolbar with File menu, Tab hides
      panels, palette search, inspector pairs (position / size) and readable names.
- [x] LAN one click: Start LAN Game launchers, Control Panel "Start LAN game" / "Stop LAN game" buttons (add-on),
      ?lan=host auto-hosts, LAN panel says which kind of page you're on and shows the join link with Copy.
- [x] Cheats & tuning panel: same name everywhere, ✕ close, Esc closes it first, fits narrow windows, its dock no longer
      covers the key help or HUD. Players panel checked at 820 px (fine as is).
- [x] All 22 games + build mode reviewed at 820×600: the line-up badge is short on narrow windows (it covered the
      Zombie Ball / Bed Brawl / Crash Lab HUDs), small centred hint lines shrink to fit (Terra's ran off both edges),
      Rent Rush buttons scale with the board, the build bar sits beside the hero card (or above the cards) instead of on it.
- [ ] Control Panel buttons only checked with a stand-in for the Control Panel (its source isn't reachable from here):
      confirm they show on Home → Play together on your machine.

## Connecting games and tools (your question: "connect all the games so the inspector menus and the games interact")
- [x] Step 1 — per-game settings in the Game tab + shared rows hidden where they do nothing (`tunables.js`).
- [x] Step 2 — `inspect.js`: Edit-mode clicks pick game objects (Bed Brawl beds / generators / player resources, Brawl
      fighters' % and stocks, Wobble Wheels riders (eject, restart), the Crash Lab dummy, Word Lab pets and water, any
      player or ragdoll) with their own sliders and buttons; full-screen games show a live match card (Table Games,
      Rent Rush, Party Board). Still open here: Terra tiles; the Level Studio inspector uses its own document fields.
- [x] Step 3 — more games in the Level Studio. Wobble Wheels: DONE (rules "Wobble Wheels (course)", its own palette
      — mine, swinging log, spike strip, crumble slab, finish line; built-in courses open with their traps; saved
      courses play as real runs and appear in its course select). Brawl: DONE (rules "Brawl (stage)", main stage /
      floating platform / fighter spawn pieces; stage top, blast zones and spawns worked out from the layout; saved
      stages join Brawl's stage rotation). Siege forts and Word Lab rooms: DONE (fort pieces + enemy pieces as the
      fort's zombies + an ammo list; rooms with a star, task text and word par — both set in the inspector when
      nothing is selected). Terra tiles in the inspector (change the block, dig it out, your inventory of it): DONE.
      Bed Brawl maps: DONE (islands, red / blue beds, generators, shop rows, the diamond generator and team spawns
      are pieces; Bed Brawl now reads them from the level, with the old positions as the default).

## Your latest list (word for word below) — shared library first, then each game
Shared (first, as you asked: "Focus on shared game library assets though first"):
- [x] S1 Themes: a light mode and other themes for textures / graphics / panels ("the current ones feel dark"). → Pause → Settings → Theme / Brightness, or the panel's 🎨 Shared box. Check: `tests/themes.js`.
- [~] S2 Character roster (enemy appearances + three objects done; arbitrary possession/full-screen games remain): more character options; play as any NPC (every enemy type) or object, in any game.
- [x] S3 Fighting: weapon setting (blaster / fists) so heroes don't always carry a gun; ammo unlimited by default; melee
      moves (punch, punch, kick, uppercut, ground pound, flying kick). Check: `tests/fighting.js`.
- [x] S4 Ragdoll on hits: a setting (Off / Short / Full; Short is the default). Check: `tests/fighting.js`.
- [~] S5 Arcade play/time and score records added; full per-player win/loss history remains. Scores and stats saved for every game, shown in the Arcade.
- [x] BUG: Zombie Ball — the ball sometimes goes invisible. → Rendering / LAN sync and shared-key fixes; regression tests added. Please report any remaining local case.
- [x] BUG: Table Games / Flick Soccer — player 2 can't move their discs on their turn. → Rendering / LAN sync and shared-key fixes; regression tests added. Please report any remaining local case.
- [x] S7 Enemy AI pathfinding: graph invalidation, moving-platform coordinates, and flow-loop prevention improved. Further terrain-specific tuning may remain; original request: (your words: "And enemey AI path finding still needs to improve").
- [~] S6 Cheats: arenas, Jet Dash, board games (other agent) + Parkour Rush freeze clock, Portal Lab portals anywhere, Siege unlimited shots, Stomp Squad infinite lives, Brawl damage taken (`tests/game_cheats.js`). Generic god mode / flight / jetpack / ammo cover every world game. Word Lab, Crash Lab, Table Games: setup rows only.
Each game (ticked = built and covered by a test; checked against tests/roadmap_regressions.js + roadmap_features.js):
- [x] Worm Arena: boost fixed (it latched on) + cheats.  - [x] Tank Arena: difficulty setting (Players / shared) + cheats.
- [x] Blob Arena: cheats (invincible, speed, mass).       - [x] Wildwood Frontier: renamed from "Infinite Frontier".
- [x] Zombie Ball: real soccer ball by default; "Style: Flail (one button)" = players only jump and kick a leg out.
- [x] Terra: creative mode (free placing, instant mining, no damage, flight). - [x] Ragdoll Siege: Birds is the default.
- [~] Sand Lab: ice, acid, gunpowder, seeds + brush size/shape/density/speed controls; more is always possible.
- [~] Stomp Squad: the weird bounce after landing is fixed (shared landing fix); look/feel closer to the genre still open.
- [~] Jet Dash: coin magnet + starting shield you buy with banked coins; look/feel closer to the genre still open.
- [~] Wobble Wheels: Wind Works course (fans, updrafts, smash gates); closer to the genre still open.
- [ ] Make multiplayer fun; games closer to their genre — needs your play-through to say which games feel off.
Your words: "Boost in slither io does not work properly. THeyre should also be cheat settings / Diepo is too hard and has
not cheats / Agario should have cheats / Jet pack joride needs to look and behave a lot closer to the first game / The
characters awlays have a gun / ammo is annoying / THeyre should be some fightning methods instead of just dash / Add more
chcaracter options, I should also be able to play as any npc or object if I desire / The ragdoll when I get hit hard it
sometimes annoying and brawl stars or smash / Mario mode needs to look more like mario mode and behave like it more, the
boucing after jumps is weird / Infinite zombie mode needs a rebrand / Happy wheels is nothing like happy wheels / THe soccer
game should be a soccer ball and called soccer physics and the characters should only be able to jump and kick out there
leg like the og game. At least make the a chartacter option / Overall connnect the games better to eachother, and also make
multiplayer fun, save scores and stats when applicable and make all these games work closer to their OG / Sand lab needs a
lot more options and cuztomization / Terraria has no creative mode and it's hard to test quickly / Ragdoll seige should be
birds / Overall, add ability to change the textures and graphics a bit. THe current ones feel dark all the time, maybe we
need a light mode or a nother theme yk." + "Focus on shared game library assests though first"
(Games stay original: closer in feel and rules, never their names, characters or art.)

## Mash-ups and shared settings (your request: "each game should share more settings… I want to be able to mash up games")
- [x] `mashup.js`: per mix-in "game default / on / off" for any game with a world — zombie waves, building, jetpack,
      blaster, dash, extra air jump, word magic (Y), item drops, a pet dog — saved between sessions; ☰ → 🧩 Mash-up.
- [x] Shared settings: one CPU skill for every game. (More shared settings come with the theme / character work below.)

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
- "Going back and fourth into and out of the level studio is a bit strange … fix these top menu bars … make all the pause
  menus and top menus and level editor and inspector and builders and uis nice, useable, adaptable, intuitive, and useful"
- "is it super easy to start a LAN from either the open index server or from the control dashboard?"
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
