# Progress log

What's being worked on right now, what just shipped, and what's planned next. Newest entry first.
RETROS.md has the detail for each shipped update; TODO.md has the full checklists.

## PICK UP HERE (handoff, 2026-11-15, Claude session)

Task from the owner: study the menus (wrong info between games, odd / doubled menus), make them fit each game, add
tabs and a clear menu tree, improve LAN packets, then feel, performance and code clean-up. **About half is done.**

**Done and pushed** (tests in `tests/`):
1. **Menu audit.** Causes found: Esc opened the drawer on a made-up tab, so it showed the list of all games; the canvas
   pause menu was hidden but still took key presses (ghost menu); pause stayed on when the game changed; God / ammo /
   gravity / heal were repeated in 3 tabs (3 separate handlers); enemy / ammo tools showed in games without them;
   mode-id lists (`["tanks","cells","snake","mix"]`) were copied in many places.
2. **One drawer, tab tree** (`sandbox_ui.js`): Game | Players | Settings | Tools | Inspect | Games. Game / Players /
   Settings rows come from `pauseItems()` (`frame.js`, now split into `pauseMainItems()` / `pauseSettingsItems()`),
   so there is one source. What shows comes from game flags: `SandboxUI.caps()`; new flags `enemyTools`, `botSwap`.
   Keyboard / gamepad work inside the drawer (`SandboxUI.menuKey`, Q/E = tabs). Editing tools are folded in Tools.
3. `SandboxUI.closeTransient()` runs when the game changes: closes pause, panels, LAN / players / controls dialogs.
4. Course games (Portal, Crate Lab, Parkour, Wheels) lost the duplicate "Chamber ◀▶" row; the select grid stays.
5. **Dead code removed:** the hidden legacy top bar + ☰ menu + `topBarRefresh` in `devpanel.js` (-173 lines).
   Button labels now come from `SandboxUI.syncLabels()` (players, LAN, Mix stat).
6. **LAN** (`net.js`): ping + quality (`Net.pingLabel()`, button border green/amber/red), automatic re-join after a
   dropped connection (6 tries), shorter field names (`NET_SHORT`), id lists sent only when they change, `NetPack`
   delta packing for worm segments. `Net.online` was never defined, so the menus never showed "connected": fixed.
   Measured with the stub-peer bench: world games -20..38% bytes per snapshot (platform 534 -> 333 B), worm data -24%.
   New test `tests/lan_resilience.js` (PASS). `lan_core/joiner/play/soccer/perf` still pass (`lan_core` needs a server on 8099).

**Not done, in this order:**
1. **Stale tests** that click removed buttons (`#top-menu-btn`, `#lan-btn`, `#coop-btn`, `#sp-all-fields summary`) were
   already failing on main before this work: `level_select`, `panel_dock`, `players`, `inspector_fields`,
   `lan_buttons`, `lan_phone`. Point them at `#sb-side-open`, `#sb-quick-players`, `#sb-quick-lan`, or the drawer rows.
2. Add `tests/menu_tabs.js`: Esc opens the Game tab; Portal Lab Tools has no ammo / foes; a game change closes pause.
   (Scratch versions: ask the owner; the logic is `SandboxUI.tabsFor / caps / curTab`.)
3. **Per-game hint strips** (about 20 `uiText("... Esc menu")` lines in `game_*.js`) ignore the "Controls help"
   setting; Survival also draws its cheat sheet. Make one `uiHint()` that obeys `devOpts.showHelp`.
4. **Perf:** only measured LAN. Not profiled: CPU profile each game (`node --cpu-prof` or CDP) and fix the top cost.
5. LAN: Terra's first full packet is 40 KB and stalls the host ~11 ms (send tiles in chunks); `.io` games' `netState`
   blobs are 2-6 KB (Arena Mix up to 28 KB; owner dropped Mix multiplayer).
6. Studio opened from Portal shows "Zombie Survival" as its game: check its start dialog.
7. Review checklist: `reviews/TimothysZombieGame2020/2026-11-15-menus-lan.md` was written by hand and NOT checked with
   `review.py ready`. Run `python tools/updater/review.py brief ... --run`, fix Rejected lines.

**Careful:** in tests, a dialog that closes on game change is intended. Pushed to `main` because the owner said so in this session.

## The plan (order you set, 2026-11-11)

1. **Core multiplayer.** Each joiner's browser moves its own hero right away; the host only corrects it. Smaller packets.
2. **LAN bugs.** Joiner can't see food dropped in Blob Arena; joiner / player 2 can't move in the soccer game.
3. **Menus and tools.** Cheat menu's drag-out toolbar only when placing; pause menu, player 2 menu, inspector (every
   field, incl. weight), editor hand / drag / play, toolbars, right-click options, dropdowns. Survival level select.
4. **Games.** Blob Arena settings (decay, number of players, size cheat); Brawl combo balance; block damage / weight;
   enemy tracking and pathfinding; Zombie Ball (smaller pitch, bright one-button physics soccer look); Wobble Wheels
   rethink; then a pass over every game.

Fastest way to perfect each game: one shared engine fix at a time (so every game gets it), a test per fix, then one
short play-through list from you per game. Your notes on what feels off are the part no test can replace.

## 2026-11-15 (3): "Split worm" in the menu panel - number of pieces and a no-rejoin switch - DONE (branch, not main)
Asked: add an option to split the worm in the menu panel; into as many pieces as wanted; an option to disable recombining.
Menu panel -> Game tab -> "Game Rules" (Worm Arena and Arena Mix), now at the TOP of the list: slider "Split worm into
(pieces)" 2-30 (saved), switch "Pieces can rejoin (head to tail)" (saved, default on), button "Split my worm now".
`Snake.splitInto(w, n)` cuts the main worm into n near-equal pieces at once (each >= 3 segments, so a worm of 24 gives at
most 8; total length kept; pieces share owner, name, colour, stats; they fan out). Rejoin off: `Snake.kinStep` returns at
once, so pieces never recombine (the HUD hint says "rejoining is OFF"). The spike split cap rose from 4 to 30 pieces.
New row type "button" (`r.fn`) in `sandbox_ui.js` and the old cheats panel (`devpanel.js`). Test: `tests/worm_split_menu.js`
(real slider, button and checkbox clicks). Limits: host or single player only (LAN joiners cannot use the button).
Rules: `AGENT-RULES.md` now applies: session branch only; checklist in `reviews/TimothysZombieGame2020/`.

## 2026-11-15 (2): blob split eats half of a worm that is inside it - DONE, on main
Asked: "Splitting inside while a snake is in you should half the snake's length and add it to agario." In Arena Mix, when a
blob splits (Space) and a worm overlaps it (head within 95% of the blob radius, or any body segment within 70%), that worm
loses half its length (never below 12; worms of 14 or less are left alone) and the blob gains that much mass BEFORE it
divides, so both halves share it. Each worm is halved once per split press, even if two blobs of the player hold it. Pieces
of a split worm are halved one by one. Spawn-protected worms and the player's own worm are skipped. Feedback: ring
"GULP +N", a log / banner line, a sound; `Mix.lastSwallow = {taken, before, worms, t}`. Code: `Mix.splitSwallow` (game_mix.js),
called from `Cells.split` (game_cells.js). Test: `tests/blob_split_eat.js` (staged cases + a real Space keypress).
Note: the older rule "a blob touching a worm pops" and the worm's nibble still run too; in the live test the pop rule is
switched off with `popCd` so the split rule is measured alone. Bubble worms do not split (they lunge), so nothing happens.

## 2026-11-15: split worms (spike cut, head-to-tail rejoin, brake key) - DONE, on main
Asked (spec from another agent / the user): a pushed spike cuts a worm in two; pieces rejoin only head to tail with
leeway; a key slows the outer piece. Built in `game_snake.js` (rules), `game_mix.js` (spike hit, camera, HUD, leaderboard),
`keyHandler.js` + `var.js` (key). Test: `tests/worm_split.js` (about 60 checks); `tools/verify_mix.py` still passes.
- **Split:** a spike that is launched or moving (`vi.launched > 0` or speed > 2) and touches a worm's SIDE cuts it at the
  body segment nearest the spike centre. Needs length >= 30 and both pieces >= 8 segments (near the head or tail the
  spike just passes). Max 4 pieces per player. The spike is used up (a new one appears if fewer than 22), with a ring,
  a "cut in two" message and a sound. Both pieces keep owner slot, name, colour, stats (`mx` is shared), power-ups.
  The tail piece's new head is the cut end; it turns about 0.9 rad away. Length is split by segment count.
- **Pieces** share a `kinId`. They never collide with each other (no accidental deaths). `splitCd` 90 frames blocks a
  second cut; `rejoinCd` 120 frames blocks a rejoin.
- **Rejoin:** one piece's head within (radiusA + radiusB) x 1.35 of the LAST 3 segments of the other. The piece whose
  tail was touched keeps its head and gets the other body as its new tail; the other is removed with no death or kill.
  Middle-of-body and head-to-head contact do nothing.
- **Brake key: R** (P2: Right Shift; pad: interact; LAN joiners send `r`). While held, exactly ONE piece of each split
  player is slowed to 45%: the one whose head is furthest from the screen centre (`Snake.cam`; for others, the centroid
  of their pieces). A 40 px margin stops the choice flipping when both are level. R was free in Worm Arena and Arena Mix.
- **Player lookup:** `Snake.primaryWorm / localWorm / kinOf`. The camera and `Mix.me()` follow the longest piece and
  zoom out to keep the others in view. One piece dying leaves the player alive; the last one dying ends the run.
  The leaderboards add the pieces together. Swapping with a bot (V) hands over every piece.
- **Known limits:** CPU worms can be split too and rejoin only by chance. Pieces ignore each other completely (no
  self-collision at all, not only for a short time). The brake slows the outer piece by distance from the camera, so
  with a lagging camera it can pick the other piece for a moment; the margin makes it stable.
- Environment note: `tools/verify_mix.py` needs a `chromium` command. Here it is installed as `/opt/pw-browsers/chromium`;
  run it with a wrapper script named `chromium` first on `PATH` (outside the repo).
- Arena Mix now HAS LAN support (the other agent added it); my earlier "no multiplayer" answer is out of date.

## FUTURE AGENDA (2026-11-13, order of work)

Writing style from now on: about 80% ASD-STE100 (short, active sentences, one topic each) in replies and new notes.
User decisions on 2026-11-13: **no multiplayer in Arena Mix** (dropped). **"Longer-term games" dropped** for now.

1. ~~Make `tests/arena_mix.js` stable.~~ Done. The test staged food badly; five clean runs.
2. ~~Tank size changes shooting and level (Arena Mix).~~ Done. Heavier tank: bigger and harder bullets, slower reload.
   New mass records give XP. A shrinking tank keeps its level.
3. **Enemy pathfinding and tracking.** In progress. Measured with `tests/enemy_chase.js` (9 enemies per level, fixed
   spawn spots, hero still or walking). Today: **73% reach the hero, 9.9 s average, 0.5 s stuck** (start: 63%, 11.4 s,
   1.8 s). Target: 85%, 8 s, 1 s. Done: (a) ramp "walk" links joined a ramp to the open floor below it, so enemies
   swung back and forth (bunker bridges); a big step is now allowed only along the same ramp. (b) A progress watchdog
   bans a hop when the route length does not shrink for 2.5 s. `tests/nav_reach.js <level>` prints how many graph
   points can reach the hero (131 of 135 on bunker_bridges now; it was 13 with a wrong fix: check this after every
   graph change). **Next:** `bunker_bridges` (4/9 still) and `zigzag_tower` (4/9 walking) are the worst. Many failing
   enemies move but arrive late: try a 35 s window, then trace one with `WHY=1 node enemy_chase.js <level>`.
   Debug switches: `window.__pfDbg = {noWd:1, oldRampWalk:1}` before the level loads; `PFDBG='{"noWd":1}'` with the test.
4. **Deeper blob / worm / bubble-worm rules.** Worm bites a bubble chain tail. Bubble worm against bubble worm.
   CPU blobs and worms must fear tanks. Check commit `220a1e2` (compact bubble worm form) against the new rules.
5. **Older list:** editing hand / drag / play; pause menu, player 2 menu and right-click menus; Zombie Ball (smaller
   pitch, bright look); Wobble Wheels rethink; a pass over every game.
6. **Only you can do:** LAN test on two real devices; Control Panel LAN button; a play-through of each game with a
   short "what feels wrong" list.

## PICK UP HERE (handoff note, 2026-11-12)

Everything below "Done" is on `main` with a passing test. Work top to bottom through "Still to do".

**Done this session** (each has a test in `tests/`, listed in `tests/README.md`):
1. LAN: joiners move their own hero locally, packets about half the size — `lan_perf.js`
2. LAN joiner bugs: Blob Arena food, Flail-style soccer teams/drawing — `lan_joiner.js`
3. Cheat menu: piece row only on Build + Place; arenas show only what applies — `panel_dock.js`
4. Blob Arena settings (bots, food, decay, spawn shield, start mass, size cheat) + pickups — `blob_settings.js`
5. Survival level select with the mouse (click-a-card grid) — `level_select.js`
6. Brawl combo limits (chained hits fade, 6th hit = combo break) — `brawl_combo.js`
7. Block damage follows weight, heroes only bruised by stray crates; inspector has Weight / Impact / Gravity and an
   "All fields" list of every value on the selected object — `inspector_fields.js`

8. **Arena Mix** (new game): worms inside blobs inside tanks in one world, play as any of them — `arena_mix.js`

**Still to do, in the user's order** (their exact words are at the top of TODO.md):
1. **Enemy tracking and pathfinding** ("still horrible"). Not started this session. Suggested start: write a test that
   spawns enemies on each Survival level with the hero on a different floor and measures seconds-until-reached and
   time spent stuck (speed near 0 while not attacking). Code: `pathfinder.js`, `Components.zombieAI` in `components.js`.
2. **Editing hand / drag / play** in the cheats panel's Build tab (`summonManager.js` mouse handlers) — not started.
3. **Menus**: pause menu, player 2 menu (`players.js`), right-click options, dropdowns. Only the cheats panel and
   Survival level select were reworked so far.
4. **Zombie Ball**: smaller pitch, bright one-button physics-soccer look (original art; don't copy the screenshot's
   game). Flail style lives in `sport_flail.js`; pitch size / goals in `game_sport.js` and the `zb_stadium` level.
5. **Wobble Wheels** rethink (movement, rotation, controls, map): `game_wheels.js`.
6. A pass over every game; Worm / Tank Arena could get the same settings depth and joiner-side gliding as Blob Arena.

**Not re-run after the block-damage change:** `siege_rest.js` (about 3 minutes). Siege crates use the same impact code,
so run it before touching Siege.
**Only the user can check:** LAN feel on two real devices; the Control Panel's LAN start/stop button.
**Conventions:** push each finished piece to `claude/vibrant-curie-rxogs0` and `main`; add a RETROS.md entry (newest
first), tick TODO.md, add the test to `tests/README.md`; original names and art only.

## Log

### 2026-11-12 — pushed (usage ran out mid-check): Arena Mix v3 + bubble worm
- Tank bullets **damage blobs again** (shrink; below 12 mass the blob is gone).
- Tanks also **collect worm food** (a third of its value) as well as blob food.
- **Decay like the genre:** new default "Classic (0.2% of mass a second)" for blobs over 35 mass; tank mass decays
  the same way. Old saves on the previous default move to Classic once. Other rates still selectable.
- **4th body: Bubble worm** (a worm made of blob bubbles). The head steers, bubbles follow in a chain and never merge;
  it buds bubbles as it grows (1 at 20 mass, 5 at 200, up to 20) and tapers from a big head (49/44/39/35/32 at 200).
  Each bubble eats / is eaten by the blob rule; lose the head and the next bubble leads. Space = lunge. In Arena Mix:
  Q cycles Tank / Blob / Worm / Bubble worm, plus 3 CPU bubble worms. In plain Blob Arena: Game tab → "Humans are
  bubble worms".
**PICK UP HERE:** `tests/arena_mix.js` passes about half its runs. The two checks that flip are
`tankEatsSmallerBlob` and `equalSizesIgnoreEachOther`; not yet diagnosed (likely the staged arena: a CPU or decay
nudging masses between steps, not confirmed). Everything else in that test is stable. Docs (RETROS / TODO /
tests README) not yet updated for this entry.

### 2026-11-12 — shipped: Arena Mix rules v2 (your spec) + shared power-ups
Supersedes the cross-game rules in the entry below.
- **Blobs absorb bullets** (each adds a little mass); bullets no longer shrink blobs.
- **Tanks are blobs with a gun:** a tank has mass and its size follows it. It eats food and any blob or tank 25%
  smaller; any blob or tank 25% bigger eats it. It can't split on purpose. A virus (loses half) or dropping below 35%
  health (loses 40%, once per 5 s, health back to half) breaks pieces off: the biggest piece keeps the gun, the rest
  are inert lumps that are plain food. A dead tank drops its mass as lumps.
- **Worms level up** from eating, breaking the tank blocks with their head (boosting breaks faster) and biting:
  points go to Bite / Armor / Appetite with keys 1 / 2 / 3. A bite hurts a tank and costs the worm a little length;
  worm bodies still hurt tanks. Worms no longer die from touching a tank.
- **Blobs pop on worms** like on a virus: up to 6 pieces, a quarter of the mass goes to the worm (length + XP);
  pieces can't re-pop for 2.5 s; a blob under 30 mass is taken whole. Blobs no longer swallow worms.
- **Shared power-ups:** tanks and worms pick up speed / shield / magnet / mass too; a dashed ring shows who has one.
- CPU tanks stopped shooting blobs (it only feeds them) and hunt worms instead.
Check: `tests/arena_mix.js` (22 staged rules). **Not checked by play:** balance. CPU blobs and worms still don't
react to tanks; one human only.

### 2026-11-12 — shipped: Arena Mix (worms inside blobs inside tanks)
Asked: "code so I can have [worms] in [blobs] in [tanks]". New Arcade game **Arena Mix** (`game_mix.js`): the three
arena games run in one world. Their arenas were already centred on the same point, so they nest: worm ring (pink
border) inside the blob zone (purple border) inside the tank arena. Each game keeps its own rules; the new file adds
one camera, "play as" (Tank / Blob / Worm: Q in play, pause menu, or the Game tab) and what happens when they meet:
bullets shrink blobs and worms (head shots most; bodies soak bullets); a clearly bigger blob swallows a tank or a
worm's head; a worm's body is a wall that hurts tanks and absorbs small blobs; a worm's head into a tank kills the
worm; tanks and blobs chip each other on contact; worms eat blob food and blobs eat worm food. CPU tanks hunt blobs
and worms too. Best score per body is saved. 61 fps in the test with 9 tanks, 14 blobs and 11 worms.
**Limits:** one human for now (no P2, not over LAN — joiners see "local-only"); CPU blobs and worms don't know to
fear tanks; balance between the three is a first guess and needs your play-through.

### 2026-11-12 — shipped: Brawl combo limits; block damage by weight; inspector shows every field
- **Brawl:** hits chained within 50 ticks each do 80% of the one before (floor 35%), stun shrinks the same way, and
  the 6th hit is a COMBO BREAK (victim pops free, can't be hit for 3/4 s). Eight quick punches: 33.6% → 15.6%.
- **Blocks:** impact damage = speed × √weight × the block's own "impact damage" setting. A weight ¼ / 1 / 4 crate at
  the same speed does 25 / 50 / 100 to an enemy. A hero bumped by a stray crate takes at most 18 (was up to 65) and
  nothing below a real impact speed; a crate thrown at a hero on purpose caps at 35.
- **Inspector:** Weight, Impact damage × and Gravity × sliders on physics blocks, and an "All fields" list (with a
  filter box) where every number, text and on/off value on the selected object or character can be edited live.

### 2026-11-11 — shipped: Survival level select works with the mouse
"Zombie game I can't select the other levels": both ways worked from the keyboard, but in the pause menu a mouse click
on the Level row only cycled the name — nothing loaded until Enter. The row is now "🗺 Level select…" and opens the
same click-a-card grid the other games use; clicking a card starts that level. The ☰ menu dropdown still works.
Two Survival levels were named after other games; they are now "1. Overworld Arena" and "3. Sci-Fi Jetpack Lab".
Check: `tests/level_select.js`.
**Next:** Brawl combo balance, then block damage / weight and "every field in the inspector".

### 2026-11-11 — shipped: cheat menu cleanup + Blob Arena settings
- **Cheat menu:** the "drag to place" row no longer sits on screen whenever the panel is open. It appears only on the
  Build tab in Place mode. The panel opens on the Game tab (the cheats). Full-screen games (arenas, boards, tables) show
  only the tabs that work there, and hide hero-only settings and the enemy spawner. Long labels wrap instead of running
  into their sliders. Leaving the Build tab drops back to Play so a stray click can't place something.
- **Blob Arena settings** (Game tab, saved): CPU blobs 0–40 (changes live), food on the map, decay Off / Slow / Normal
  / Fast / Brutal, "decay grows with size", spawn shield seconds (new: fresh spawns can't be eaten for 3 s, shown as a
  blue ring), humans' starting mass, and a "set human size now" cheat up to 20,000.
- **Borrowed from the other games:** power-up pickups in the arena — speed, shield, magnet (pulls food in) and a lump
  of mass. LAN joiners see pickups and the rings too.
Checks: `tests/panel_dock.js`, `tests/blob_settings.js`.
**Next:** Survival level select ("can't select the other levels"), then Brawl combo balance.

### 2026-11-11 — shipped: the two LAN joiner bugs (Blob Arena food, soccer)
- **Blob Arena, "player 2 can't see the food I drop":** worse than reported: a joiner whose blob was dead saw no food
  at all (the host only sent food near living LAN players), big zoomed-out blobs lost food at the edges, and dropped
  food arrived white on a near-white floor. Now food is sent for every joiner's whole view, alive or watching, in its
  real colour. Food goes 5 times a second instead of 30; the joiner's browser hides food a blob touches right away and
  makes blobs glide between packets (they used to step). A click now respawns a joiner, as the on-screen hint says.
- **Soccer, "player 2 movement does not work":** classic Zombie Ball was fine for a joiner; **Flail style** was broken
  twice over: the joiner had no team (blue was always the CPU unless you changed the format in the pause menu) and the
  flail players were not drawn on the joiner's screen at all. Now the first LAN joiner takes blue automatically (the
  next helps red, and so on), a local P2 takes blue by pressing ↑ / Enter, and joiners see the players properly.
Check: `tests/lan_joiner.js`.
**Next:** menus and tools — the cheat menu's always-on drag-out toolbar first, then Survival level select.

### 2026-11-11 — shipped: LAN joiners move their own hero; packets 62% smaller
Same test run on the old and the new code: time from a joiner's key press to its hero starting to move **70 ms → 15 ms**
(one frame); packets 4.3 KB → 2.0 KB; data 120 → 55 KB/s; host and joiner agree on the hero's spot to 1–6 px.
- The joiner's browser now runs the hero's real movement code itself the moment a key goes down. The host still runs
  the same keys and stays the referee: the joiner eases toward the host only when they disagree by more than lag
  explains, catches up fast if it got held up (crates, crowds), snaps on teleports, and hands the hero back to the
  host while it's being thrown around (ragdoll, stun, frozen, carried, brawl knockback) or keeps getting corrected.
- Damage, health and death stay the host's decision.
- Other heroes and enemies now glide along their last known speed between packets.
- Packet diet: empty fields are no longer resent every packet (bug); enemies leave out route-planning and AI timers;
  bodies lying still stop resending their points; HUD numbers and brawl state only go when they change.
**Known limits:** in a tight crowd of enemies the joiner can be held up for a moment and then slide to catch up
(up to about 90 px in the test). Full-screen games (arenas, boards) still draw from the host's packets.
`Net.predictEnabled = false` in the console switches back to the old behaviour for comparison.
**Next:** the two LAN joiner bugs — food dropped in Blob Arena not visible; movement in the soccer game.

### 2026-11-11 — started: LAN fluidity
Measured first (`tests/lan_perf.js`, host + 2 joiners, 17 enemies, same machine):
about 5 KB per packet, 30 packets a second (145 KB/s), 1 ms of host time per packet, and **80 ms** between a joiner
pressing a key and seeing their own hero move. The 80 ms is the design (key → host → picture back), not packet size.
What fills the packets: enemies are 70%, mostly route-planning data only the host needs; a bug resends every empty
field in every packet; resting bodies resend all their points.
**Doing now:** joiner-side movement for its own hero + host correction; packet diet.
**Next:** the two LAN joiner bugs (Blob Arena food, soccer movement).

## 2026-11-13: the game's `class Object` is now `class GameObject`
The game declared its own `class Object` (objects.js), which hid JavaScript's built-in `Object` on the whole page: `Object.keys`, `Object.assign`, `Object.is` were
undefined, code had to say `window.Object.keys(...)`, tools such as Playwright's page.evaluate and any userscript failed on the page, and `levels.js` called a plain
`Object.keys(...)` that threw when a custom level was saved. The class is now `GameObject` (68 replacements in 18 files: `class`, `new`, its statics `addBox`,
`addRamp`, `addBumper`, `addCrate`, `loadMap`, `nextId`, `prototype`, and the two checks in net.js). `window.Object.x` calls still work. Checked before and after on 14 of the
game's tests and 3 LAN tests: the same results (brawl_bat is flaky on both: 1 of 3 passes before, 2 of 3 after; lan_perf is a timing threshold). The tests' restore hack for
`Object.is` and friends is no longer needed but is harmless.
