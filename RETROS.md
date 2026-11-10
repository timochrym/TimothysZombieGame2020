# Retros

One short retrospective per pushed update: what shipped, what went well, what went wrong, what's left.
Newest first. Measurements are from headless Chromium in a cloud container (software rendering, so
absolute FPS is lower than on a real GPU; compare numbers against each other, not against 60).

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
