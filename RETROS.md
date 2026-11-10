# Retros

One short retrospective per pushed update: what shipped, what went well, what went wrong, what's left.
Newest first. Measurements are from headless Chromium in a cloud container (software rendering, so
absolute FPS is lower than on a real GPU; compare numbers against each other, not against 60).

---

## Brawl — genre-feel pass (platform fighter)

**Shipped:** KO blast — losing a stock fires a big beam in the fighter's colour from the screen edge they flew out of
toward the stage; the big percent number jolts when that fighter gets hit; the GAME! screen now has a results table
(winner first with a crown; KOs credited to whoever landed the last hit in the 5 s before the fall; falls; damage
dealt); an eliminated fighter's panel shows only OUT (the old percent used to show through it).

**Measured:** forced KOs: P1 credited with 2 KOs, falls/damage tallied, beam drawn from the right edge; no errors.

**Went wrong:** the beam first started at the real exit point — which is always off-screen — so nothing showed →
clamped to the screen edge.

**Left / known:** shield/dodge, ledge grab, per-character moves, more stages (TODO.md).

---

## Portal Lab — genre-feel pass (portal test chambers)

**Shipped:** an aim reticle for mouse aiming — a faint line to where the portal beam would land, and at that spot a
ghost portal outline (half blue, half orange) if the surface takes portals, or a red ✕ if it doesn't (non-white
surface or a face too short). X closes your own portals (the chamber's fixed orange one stays).

**Measured:** chamber 1: reticle on the white wall vs ✕ on the floor; F places, X clears; no errors.

**Went wrong:** first picked Q to close portals — Q is already the alternate grab key → moved to X (reload, unused here).

**Left / known:** reticle for gamepad aim, more chambers and gadgets (TODO.md).

---

## Crate Lab — genre-feel pass (physics puzzle rooms)

**Shipped:** wiring — every pressure plate and lever now draws a cable to whatever it powers (doors get a junction box,
lifts and bridges get a cable that follows them); it's grey and still when off, green with current flowing along it
when on, so "what does this plate do?" answers itself. Hints: H shows a one-line hint for the room; after 45 s
in a room a "Stuck? Press H" nudge appears.

**Measured:** room 1 crate-on-plate turns the cable green; rooms 3, 4, 7, 8 render their wiring, no errors.

**Went wrong:** first cables ran along the floor line and vanished into the floor texture → they now rise above the
floor before crossing over. The hint text overflowed its panel → wider panel.

**Left / known:** more rooms and gadget types, room-select grid (TODO.md).

---

## Parkour Rush — genre-feel pass (speedrun courses)

**Shipped:** speedrun splits — each checkpoint P1 reaches shows the split time and the difference to the best run's
split (green −0.68 / red +0.42, also as a pop-up), and the splits are saved with a new best; speed lines stream past
the screen edges once you go fast; a new engine hook `onCheckpoint(ch, gadget)` (documented use: Parkour Rush).

**Measured:** run 1 reached CP1 at 1.82 s (no comparison yet), run 2 at 1.13 s → "−0.68" in green, splits saved with
the new best; Stomp Squad (which also uses checkpoints) regression unchanged.

**Went wrong:** the split box first sat on top of the course progress bar → moved below it (and the 2-player
"HURRY!" text too, which had the same overlap).

**Left / known:** slides/vaults, medal level select, checkpoint restart key (TODO.md).

---

## Crash Lab — genre-feel pass (dummy dismount)

**Shipped:** a second scenario, **Stair Drop** (pause menu → Scenario): the dummy stands on top of a 14-step stone
staircase; you get ONE push (click where to push — further = harder, a dashed line shows it), the damage score runs
until the dummy has been still for 1.5 s (or 20 s), then you get a score banner and a saved best; R resets. The
camera follows only the dummy there. In both scenarios the dummy now shows a damage heat-map (head, torso and limbs
drift from test-dummy yellow to bruised red) and the biggest hits get a short slow-mo.

**Measured:** two pushes scored 560 and 717 (steeper 84-px steps; with 110-px steps it stopped a third of the way down
at 351 / 452); sandbox regression unchanged (cannon/bomb/blaster/fling → 1710, no errors).

**Went wrong:** first staircase was too shallow — the dummy landed flat on step 5 and stopped every time → narrower,
steeper steps. Not fixed: the mode's base zoom keeps the dummy fairly small on screen.

**Left / known:** more scenarios and vehicles, pose picker, replays (TODO.md).

---

## Wobble Wheels — genre-feel pass (ragdoll vehicle trials)

**Shipped:** every vehicle has a special on Space / F (P2 Enter, pad B/X/RB): the bike bunny-hops, the cart does a
bigger, slower-recharging jump, the wheelchair fires a rocket with a fuel bar that refills while you roll; air
rotation is counted and a landed flip (≈290°+ and still on your wheels) shows BACKFLIP / FRONTFLIP and takes 0.5 s off
your time; crashes get a short slow-motion; the HUD shows flips and the current vehicle's special.

**Went wrong (found while testing):** the wheelchair had been broken since it shipped — the rider sat right over the
big wheel's axle, so it tipped onto its back at spawn and dragged its seat (98 px in 75 frames vs the bike's ~900).
Moved the big wheel back, put the hand anchor on the armrest and strapped the rider to a new backrest point:
960 px in 75 frames, rider upright. The old test only checked "it moved", not how far — the speed is now part of the
check.

**Measured:** hop +6.4 px/frame upward; rocket 1370 vs 960 px in 73 frames; a landed 6.6-rad spin = 1 flip, -30 frames;
regression course runs unchanged (bike 4160 px in 5 s, cart 2400, no errors).

**Left / known:** pure lean only reaches ~300° on the biggest drops, so flips mostly come off pads/ramps; course select,
eject, ghost runs, more vehicles (TODO.md).

---

## Bed Brawl — genre-feel pass (bed defence)

**Shipped:** a kill feed in the top-right (who killed whom, FINAL KILL once a bed is gone, void falls, beds broken,
upgrades bought; synced over LAN); team upgrades on two new pedestals paid with diamonds from the middle island —
Forge (2 levels, generator ×1.5 / ×2) and Sharp (+25% damage for the whole team) — and the CPU bots go buy them when
they carry diamonds; a sudden-death clock (beds break at 5:00, countdown in the HUD) so matches can't stall; armor
upgrades to level 3 with gold (the diamond-armor pedestal made way for the upgrades); "Maxed out" instead of silently
taking your resources.

**Measured:** Forge 2 doubles iron (9 vs ~5 drops in 6 s); feed + sudden death verified headless; 3v3 bot match still
ends with a winner at 82 s, 0 errors.

**Went wrong:** 8 pedestals side by side made every label overlap → only the pedestal you stand on shows its full
label (above your name tag), the others show a tiny cost. Upgrade icons collided with the format line → moved next
to each team's name; the clock went to the second line.

**Left / known:** fireball / bridge items, pickaxe tiers, more maps, 4 teams (TODO.md).

---

## Ragdoll Siege Birds — genre-feel pass (slingshot)

**Shipped:** every fort opens with a 2-second fly-by over the fort before the camera pans back to the sling (any
click/Space skips it); each shot leaves a dotted trail that stays until the next launch, so you can correct your aim;
in Birds mode the next bird sits in the sling pouch (it showed a ragdoll before); hurt wood and glass blocks show crack
lines that grow as they near breaking; score pop-ups for broken blocks (+250), popped zombies (+1000) and spare birds
at the end (+1500 each).

**Measured:** 3-bird run on Fort 2: trail 50–60 dots per shot, no errors; idle-bounce regression (both ammo modes,
5 forts): 0 bounces at rest, 0 idle deaths — unchanged.

**Went wrong:** nothing broke; the fly-by returns early from the mode's update, so it can't fire shots or end the level.

**Left / known:** breakable stone, helmeted zombies, fort select with stars, score-based stars (TODO.md).

---

## Stomp Squad — genre-feel pass (platformer)

**Shipped:** hold RUN (Shift for P1, Right-Shift for P2, pad X/B) to build up to ~1.7× walking speed (walk is a touch
slower than before); skid dust when reversing at speed; ground-pound (S/↓ in the air: short hang, then a slam that
shakes the screen, flattens foes within 120 px and breaks a brick under a big hero); new Shellback enemy — stomp it
into a shell, stomp/walk into it to kick, it slides at 15 px/frame, bounces off walls, chain-kills everything in its
path (score climbs per kill) and despawns once off-screen; flagpole slide down + walk-off. New engine hook `runMult`.

**Measured:** walk 8.8 vs run 14.9 px/frame; one kicked shell took out hopper + 2 walkers + spiky (score 100 → 1600);
ground-pound lands dead still; both regression runs (blocks, stomp, pit, goal → course 2) unchanged.

**Went wrong:** (1) the kicked shell crawled at 6 px/frame because enemies share the soft speed cap → it now lifts its own
cap while sliding. (2) The bounce off a fresh shell landed on it again and kicked it straight back at you → 45-frame
grace. (3) Course 1's shell sat between two pipes = an unavoidable ricochet death trap → moved to an open stretch with
foes ahead. (4) After the pound the hero bounced off the ground → speed zeroed on landing. (5) the walk-off kept walking
through the right wall after the hero hid → stops once hidden.

**Left / known:** crouch, wall-slide, pop-out animations, themes, shell sprite (TODO.md).

---

## Zombie Ball "Flail" style — genre-feel pass (physics soccer)

**Shipped:** `sport_flail.js` — an alternate style for Zombie Ball (pause menu → Style). Two original big-headed,
stiff-legged ragdoll players per team on ONE button: tap to jump and whip both legs toward the enemy goal, hold to
keep tipping forward; they pull themselves upright and shuffle behind the ball; the ball (zombie or classic) is
kicked by their feet/head with real velocity. PvP (W vs ↑), vs CPU (presses timed by skill), co-op. Heroes stay as
hidden seats so LAN/Players still work.

**Measured:** 32 s of button mashing vs CPU: 1–2, ball crossing the whole pitch, players tumbling and recovering.

**Went wrong:** the first version let the ball get stuck behind everyone for 12+ s (kicks only push toward the enemy
goal) → players shuffle behind the ball and a dead ball is dropped back in after 6 s. Players were also too small to
read → 1.5×.

**Left / known:** no keeper, no modifiers, no goal replays.

---

## Textures + character detail

**Shipped:** `textures.js` — 21 procedurally drawn 32-px textures (planks, cut stone, metal plate, glass, pipe, used
block, red/blue wool, dirt, grass top, raw stone, coal/iron/gold ore, log, leaves, sand, bedrock, hazard stripes, ice,
mossy brick), installed into `TextureManager` (survive its re-inits) and used across the newer games; Terra draws its
tiles with them. Characters: a `SKIN_DETAIL` level from on-screen size adds shading/highlights to skinned limbs and
shine to round parts; the original sprite hero gets lighting + catch-lights; Settings → "Character detail when
zoomed in".

**Measured:** all 21 textures installed; Creative gallery + Terra at 60 FPS; zoomed screenshots show the detail. No errors.

**Left / known:** vehicles, rails and some props still flat-coloured; ragdolls don't get the detail layer.

---

## Controller support

**Shipped:** 4 gamepads (pads 3-4 borrow CPU slots and hand them back on disconnect), build-mode controls, punch on LT,
vehicles/shops on Y, menu navigation, B closes the Players / LAN panels, per-game buttons through a new `onPad` mode
hook (Terra hotbar, Crash Lab tools at the aim point, Siege aim + fire). `tests/gamepad.js` drives fake pads.

**Measured (fake pads, headless):** Arcade navigation + A launches Brawl; pad 3 takes over the CPU and moves 478 px;
Select → build mode, RB next piece, RT places (−10 wood), Select leaves; LT punch 16 dmg; Start pauses, B resumes.

**Went wrong (caught by the test):** the LAN panel's "is it open" check read an empty inline style as "open" from page
load — combined with the new "B closes panels" code it would have swallowed all gamepad input in every menu. Both
panels now check for `display: flex`.

**Left / known:** no gamepad editing in Level Studio; no remapping; Wobble Wheels only reads pads 1-2.

---

## Terra — backlog B3 (world generation, block-game)

**Shipped:** `game_terra.js`: seeded 640×170-tile world (forest / desert / hill biomes, trees, dirt over stone,
two-layer noise caves that widen with depth, coal / iron / gold by depth, bedrock); only chunks near the camera
become collision boxes (row runs merged), so ~700 boxes instead of 108,800 tiles; mining by hardness (mouse or the
first solid tile along the aim), placing from a 9-slot hotbar, darkness underground with a light around the hero.
Engine: `deepWorld` flag (no "rescue" below the old floor), invisible collision-only statics.

**Measured:** 60 FPS at the surface and 60 m down; digging gave +5 dirt in 6 s; placing works. No errors.

**Went wrong:** keyboard aiming targeted a fixed point 70 px away — the empty tile at the hero's feet — so nothing
could be mined; it now walks the aim line to the first solid tile.

**Left / known:** no crafting / tools / torches / day-night / saving / LAN yet; the Survival frontier itself is not
lower yet.

---

## Vehicles — backlog B2

**Shipped:** driveable cars (enter/exit with E, A/D drive, S brake, shoot from the window, run-over damage) and
rails + minecarts / trains (joined track pieces, slope physics) as gadgets usable in any game and in Level Studio;
Creative now has a car and a hill track with a 3-car train.

**Measured:** in Creative: enter car → 1,735 px in 2 s → ran a zombie over for 124 damage → exit; minecart train ridden
over the hill line to the end. No errors.

**Went wrong:** the car first spawned inside the Tower Stairs ramp and got crumpled on frame one, and the ragdoll
engine treated the driver as someone kicking the car. Both fixed (moved the car; ragdolls ignore riders).

**Left / known:** minecarts and rails don't show on LAN clients yet (cars do); no car HP / wrecking; trains are one
physics cart with drawn followers.

---

## Feel & polish — backlog B1

**Shipped (`feel.js` + small engine hooks):** punch (Z / M) with ragdoll knockback, hit-stop and a zoom kick; grab &
throw players and enemies; Settings for hero speed (Normal / Fast / Turbo), effects (Calm by default: merged damage
numbers, half sparks, fewer texts, softer shake), and bouncing bullets (0-3 ricochets); a `weight` on every object
(Level Studio can set it on crates). LAN clients can punch.

**Measured:** punch 16 dmg + ragdoll + zoom; grab holds the enemy 89 px in front, throw ragdolls it; ricocheting
bolts bounce; Turbo +16% distance in the first second; six "-12" hits show as one "-72"; a weight-4 crate moved 84 px
from a blast that threw a normal crate 468 px. No errors.

**Went wrong:** the first punch launched a zombie ~880 px — toned down.

**Left / known:** gamepads have no punch button yet; the punch has no wind-up animation beyond the fist.

---

## Players panel — "better multiplayer and CPU toggles, make it way clearer"

**Shipped:** `players.js`. One **👥 Players** panel (top-bar button, which now reads e.g. "👥 1 player + 3 CPU", and a
pause-menu row) for every game: line-up cards that spell out each slot (🎮 P1 WASD + mouse, 🎮 P2 arrows, 🤖 CPU) per
team; CPU skill; the full control map for P1 and P2; connected gamepads; LAN status with a button to the LAN panel;
and a live roster of who is in the match (human / CPU / LAN, team, down or not). After any change a short
"P1 + CPU1 vs CPU2 + CPU3" badge shows in-game. Esc now closes this panel and the LAN panel from anywhere.

**Measured:** Soccer 1v1 → 2v2 (roster P1, CPU1 red vs CPU2, CPU3 blue); Survival solo → co-op (button "👥 2 players");
Brawl → "P1 vs CPU 1 vs CPU 2". No errors.

**Went wrong:** Esc didn't close the panel unless it had keyboard focus (same latent bug in the LAN panel) — fixed
with a page-level handler.

**Left / known:** per-slot "Human / CPU / Off" toggles for arbitrary custom line-ups aren't possible yet — each game
still offers its fixed formats; gamepads can't be reassigned to other slots.

---

## Feedback fixes: Zombie Ball ball, Siege bouncing, Birds mode

**Zombie Ball:** the ball is now a real zombie ragdoll (its spine follows the ball's reliable circle core; head and
limbs use the normal ragdoll physics). Pause menu toggles back to the classic ball. *Interpretation:* the request
was "soccer physics like the actual character"; the players already were real characters, so the ball was the
odd one out. Say if you meant something else.

**Siege "blocks bounce randomly":** reproduced on fort 5's TNT (45 bounces, crates bouncing up to 9 times, still
moving after 8 s). Cause: a crate landing on a resting crate pushed its momentum down the whole stack into the
ground, every crate bounced back up, and crate-on-crate landings kept 35% bounce. Fix: a crate resting on the
ground can't be pushed into it, and crate-on-crate landings are almost dead. After: 0 bounces, settled in ~1 s.
Forts at rest were already perfectly still (0 drift in 8 s on all 5).

**Angry Birds option (original "Birds" ammo):** round birds — Rocky (plain), Trio (tap: split in three), Zip (tap:
speed burst), Boulder (tap: slam down), Boomer (tap: explode) — and fort blocks with materials: wood cracks,
glass shatters (+250 each). Toggle in the Siege pause menu. Verified: shots launch, abilities fire, a zombie was
knocked out and a block shattered, no errors.

**Follow-up ("after more than 2 throws the blocks bounce and kill everything"):** reproduced on the code from before
the fix — fort 4 with bodies piled in: 20 bounces while idle, crates moving for the whole 6 s, 2 zombies dying on
their own. On the fixed code, all 5 forts × ragdolls and birds × 5 bodies each: 0 bounces, 0 movement, 0 idle deaths.
`main` only got the fix just now, which is likely what you were playing. The check lives in `tests/siege_rest.js`.

**Left / known:** bird abilities are assigned by shot slot, not chosen per level; stone stays unbreakable.

---

## Bigger physics, Crash Lab, Wobble Wheels — ROADMAP section 9

**Shipped:**
- Physics scale: per-tick spatial hash for moving objects (`DynGrid`), sort-and-sweep in the non-penetration solver
  and ragdoll pile-ups, sleeping pairs skipped, ragdoll level lookups through `StaticGrid`, ragdoll cap 30 → 60
  (auto 30 under 40 FPS). Breakable joints, custom ragdoll drawing, rolling-wheel friction and contact normals.
- CRASH LAB (`game_dummy.js`): a crash-test dummy and 9 tools (blaster, grab & fling, TNT, bomb, cannon, bounce pad,
  spike block, heavy weight, wrecking ball); damage scored from each body part's sudden change in velocity (head
  2.5x), bone cracks, combos, saved best.
- WOBBLE WHEELS (`game_wheels.js`): bike / wheelchair / cart as one Verlet body with the ragdoll rider on breakable
  joints (rider flies off on big hits, no gore), whole-body traction along the surface, lean/flip control, three
  courses with spikes (flat tyres), mines, swinging logs, pads and crates, checkpoints, best times per vehicle, 2P.

**Measured:** 122 crates + 102 ragdolls + ~30 enemies: 12.3 → 6.8 ms JS per tick (crate moves 5.7 → 1.8 ms,
solver 1.9 → 0.5 ms), headless FPS 35 → 50. Crash Lab: resting dummy scores 0; cannon ~900, bomb ~400, blaster ~35,
fling ~430. Wobble Wheels: bike climbs the first hill and reaches the checkpoint (~4,000 px in 5 s); cart ~2,400 px
in 3 s; trap course crashes and restarts from the checkpoint as designed. No errors anywhere.

**Went wrong (all caught by the tests):**
- The dummy spawned above a bounce pad and "scored" ~670 per bounce while doing nothing → spawn moved, pad bounces
  don't count, short grace after spawning.
- Dragging the dummy counted as damage (and a flick could throw at engine max speed) → no scoring while held,
  throw speed capped.
- Driving only the wheel points couldn't climb a slope (2 of 15 points pushed against gravity on all 15) → traction
  pushes the whole body along the surface in proportion to wheels with grip.
- A restart reset the crash counter, hiding crashes.

**Left / known:** the 60 FPS target with 60+ enemies is met for the JS budget but headless software rendering still
drops below 60; the rider pose on the bike is crude; wheelchair is the weakest climber; LAN players don't get vehicles.

---

## 2.5D view — ROADMAP section 8

**Shipped:** `depth.js` + Settings → "3D view (2.5D)". Every level piece and crate gets side faces extruded toward a
vanishing point near the screen centre, culled to the faces that point at the eye, shaded by direction (tops lit,
undersides dark), drawn far-to-near before all front faces. Characters stay flat. Works on LAN clients too.

**Honest limit:** this is a camera trick. Gameplay, collisions and physics are still 2D; real 3D would need a new
engine (WebGL rendering + 3D physics), which is out of scope for this codebase.

**Measured:** 60 FPS with it on in Overworld Arena and Parkour Rush 2 (61 off). No errors.

**Left / known:** the vanishing point is fixed to the screen, so depth shifts slightly as the camera pans (intended
parallax); textured faces are flat-shaded, not textured.

---

## Bed Brawl (Bed Wars) — ROADMAP section 7

**Shipped:** `game_bedwars.js`: two team islands over the void plus a diamond island; beds with HP (shoot them or
hold E next to them; your own team can't hurt yours); iron/gold/diamond generators; a walk-up shop of 7 pedestals
(blocks, stone, heal, blaster upgrade, armor, TNT, diamond armor); respawn while your bed stands, elimination after;
armor/damage upgrades and knockback in one damage hook; formats 1v1, 2P PvP, 2v2, co-op vs CPUs, 3v3; LAN players
take CPU slots. Engine: `onPieceDamage` hook, `noHeroContact` flag, camera follows the humans at this screen.

**CPU bots:** farm iron, tap the shop for blocks, bridge across the void one grid cell at a time, hop small holes,
fight with lead aim, defend their bed, break the enemy bed, then hunt. Stuck detection hops and backs off.

**Measured:** a 3v3 CPU-vs-CPU match (P1 removed) runs to a win on its own: blue bridged ~1750 px, broke the red bed
at ~80 s and won at ~92 s (simulated at 2x). No errors.

**Went wrong (each found by watching the bot test):**
- Bots fell, clutch-placed blocks under themselves and stood just above the void line forever → void raised.
- Bridges got one-block holes (a "+40px retry" landed in the next cell) → bots now fill the first empty cell.
- Bots holding E never re-triggered a purchase → shop presses are taps.
- The camera tried to fit six fighters → follows local humans.

**Left / known:** bots don't use the pathfinder's bridge/tower edges yet (direct bridging is enough for this flat
map); only one map; no team chat/pings; bots are slow to restock at the start.

---

## Building during play — ROADMAP section 6

**Shipped:** `build.js`: build mode, block / wall / floor / ramp, wood / stone / metal, grid-snapped green/red ghost,
hold-to-spam placement, take-back with half refund, piece HP worn down by bullets, explosions and enemies, costs and
kill rewards in Survival, free in Creative, hotbar HUD, pathfinding patched on every change, LAN support.

**Measured (scripted headless run):** place a block (60 → 50 wood), place a wall, refused at 5 wood, right-click
take-back (+5 refund), shooting a piece destroys it, a walking enemy wore a wall from 60 to 48 HP. No errors.

**Went wrong:** the hotbar sat on top of the controls help card; build mode now dismisses the card.

**Left / known:** hold-to-spam only places where the ghost is valid, so sweeping too slowly over your own last piece
places nothing (correct, but can feel unresponsive); gamepads have no build buttons yet.

---

## Level Studio — ROADMAP section 5 (and the "dev improvement" request)

**Shipped:** `studio.js` replaces the dev screen and the drag-out dock. Frozen world with a free camera (right/middle
drag or WASD, wheel zoom at the cursor), palette by category (terrain, stairs/slopes/slides, pads & crates, all 17
gadgets, 16 enemy types, every power-up, P1/P2 starts), select / shift-select / box-select / drag-move / resize
handles / rotate / flip / duplicate / delete / copy-paste / 120-step undo-redo / arrow nudges / grid snap with sizes.
The inspector edits every property (textures, kinds, door ids and links, sign text, enemy type, portalable…).
Level settings: name, which game's rules apply, waves. Save / load / delete, JSON export and import, autosave,
"Edit current level". Play-test runs the document under the chosen game; exits and goal poles bring you back with
the document unchanged. The old cheats/tuning panel is still one click away.

**Measured (scripted headless run):** place 3 pieces, drag-move (+520, +160), set width 800 in the inspector,
undo → 480, redo → 800, Ctrl+D → +1, Delete → −1, add an enemy and an exit, save (shows in the level list),
play-test (hero + enemy spawned, simulation running), touch the exit → back in the editor with an identical document,
B → back to Overworld Arena. No errors.

**Went wrong (caught by the test):**
- Keyboard focus stayed in the inspector after editing a number, so Ctrl+Z / Ctrl+D / Delete edited the text box.
  Fields now hand focus back, and clicking the world does too.
- Zombie Survival never loaded level gadgets at all, so the exit vanished in play-test. Fixed in the engine:
  any level's gadgets now load in any game.

**Left / known:** no multi-level "campaign" building yet; mover end points are edited as numbers (dx2/dy2), not dragged;
no thumbnails in the Load list.

---

## Stomp Squad platformer — ROADMAP section 4

**Shipped:** `game_platform.js` + new engine gadgets (? block, brick, coin, goal pole) and hooks (`canShoot`, `canBreak`,
`enemyAI`, `onEnemyDamage`, block/coin/goal events). Small / big / fire sizes, star power, lives, 100 coins = 1UP,
a 300-tick timer, stomp-chain scoring (100 … 8000 then 1UP), checkpoints, co-op bubbles, five original enemies
(Shambler, Blob, Flapper, Spikehelm, Brute), and three courses (Meadow Dash, Cavern Crawl, Sky Bridges).
All names and art are original. Works over LAN (HUD numbers and pickups sync via `netState`).

**Measured (scripted headless run):** power block → seed → BIG → brick broken → walker stomped (+100) → hit shrinks
to small → pit costs a life and restarts the course → goal pole clears it and course 2 loads. 61 FPS, no errors.

**Went well:** the existing gadget and hook system took a whole new genre with only ~60 lines of engine changes.

**Went wrong:** the first HUD ran under the level dropdown, and "COURSE 1-3" read like "World 1-3". Fixed.

**Left / known:** courses are tuned by eye, not playtested by a person; fireballs fly straight (no bounce); the
co-op bubble path and courses 2–3 were only smoke-tested; enemies still show health bars they don't need.

---

## Pathfinding upgrade — ROADMAP section 3

**Shipped:** whole-level nav graph (camera window only on the endless frontier), spatial hashes, jump edges limited
by per-enemy jump profiles measured in the game (normal ~320 px peak, slime ~445, leaper ~640), shared Dijkstra flow
fields with a per-frame budget and crowd spreading, `invalidateRect()` patching (doors, cracked walls), floating-origin
shift, take-off points and hold-to-full-height jumps, ledge drops, moving-platform ride edges, portal teleport links
(enemies now use portals), bounce-pad routing, bats routing around walls on an air grid, builder-only bridge/tower
edges for the future Bed Wars bots, and a richer P-key debug overlay.

**Result** (16 melee enemies chasing a hero parked on the highest platform, 25 s):

| Level | Old | New |
|---|---|---|
| Overworld Arena, hero off the pad (3 runs each) | 5, 5, 1 of 16 reached (avg 3.7) | 10, 13, 7 of 16 (avg 10), latest run 9 |
| Zigzag Tower | 16/16, median 8.4 s | 16/16, median 7.7 s |
| Bunker Bridges | 11/16, median 10.8 s | 12–15/16, median 9–13 s |
| Bounce Chaos | 9/16, median 11.2 s | 11/16, median 12.4 s |

Cost with 60 enemies: 0.36 ms/frame on the arena, ~1.0 ms on the frontier (old: 0.25–0.32 ms).

**Went well:** measuring the real jump arcs first. The old graph assumed 220 px for everyone, so most routes were missing.

**Went wrong:**
- Single runs are too noisy to judge. One arena run said the new code was *worse* (5/16) because the test hero stood
  on a bounce pad. Three runs with the hero off the pad showed the real gap.
- The first version treated bounce pads as floor, so enemies kept launching themselves at random. Bounce Chaos
  regressed until pads became launch-only nodes.
- The worker restarted in the middle of an old-vs-new swap and left the old file on disk. It was caught and restored
  from git before anything was committed.

**Left / known:** the "60 FPS with 60+ enemies" target isn't met in headless runs (35–50 FPS). Pathfinding is only
~1 ms of the 16.7 ms frame, so the rest is rendering and collisions; that belongs to section 9 (physics scale).
Frontier pathing (~1 ms) is the most expensive case.

---

## LAN panel fix

**Shipped:** the LAN panel now detects when the page isn't served by `server.js` (e.g. `python -m http.server 8001`)
and says exactly what to run; errors and "Connecting…" always show; Join waits for a real connection; hosting closes
the pause menu.

**Went wrong:** the first LAN release only showed connection errors once you were *connected*, so a failed Host
click looked like a dead button. Reported from a real machine on port 8001 and reproduced headless before fixing.

**Lesson:** test the failure path (wrong server, no server), not just the happy path.

---

## LAN multiplayer

**Shipped:** `server.js` (static files + WebSocket relay, no npm packages) and `net.js` (host-authoritative). Joiners get
their own hero, camera and HUD on their own device; joiners take over CPU slots in Brawl/Soccer and give them back on
leave; host-only buttons are hidden on clients.

**Measured:** host + 2 clients; client input moves its hero and fires; all 8 game modes load on the client with no
errors. With 60 enemies: ~17 KB per snapshot, ~340 KB/s per client, 0.37 ms/tick on the host, client at 61 FPS.

**Went wrong:** clients briefly drew no level geometry. They were pruning level pieces from snapshots that didn't
include statics (sent every 20 ticks), then recreating them empty. Fixed, and clients now request a full snapshot if
they ever see an object without data.

**Left / known:** bandwidth is per client through the relay, so many players on weak Wi-Fi may stutter. Mode-specific
HUD state only syncs where a mode implements `netState`/`applyNetState` (none do yet). Soccer/Brawl HUD labels don't
say which slot is a LAN player yet (part of the "multiplayer + CPU toggles clarity" task).

---

## Square-character toggle — ROADMAP section 2

**Shipped:** Settings → Character look: Detailed / Classic squares (saved). Squares with eyes that follow facing;
enemies get angry brows and red pupils; ragdolls and corpses draw as a tilted square (X eyes on corpses).

**Left / known:** the Settings row was checked in code, not clicked in a test.

---

## Head stomps — ROADMAP section 1

**Shipped:** landing on an enemy deals 35 × `rpgDamageMult` (ignores the knight shield), bounces the hero (133 px tap,
245 px with jump held), and blocks contact damage for ~10 frames. `onStomp` / `onContact` mode hooks.

**Left / known:** stomps make Zombie Survival easier; the difficulty impact hasn't been measured.
