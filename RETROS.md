# Retros

One short retrospective per pushed update: what shipped, what went well, what went wrong, what's left.
Newest first. Measurements are from headless Chromium in a cloud container (software rendering, so
absolute FPS is lower than on a real GPU; compare numbers against each other, not against 60).

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
