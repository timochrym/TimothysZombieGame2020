# Retros

One short retrospective per pushed update: what shipped, what went well, what went wrong, what's left.
Newest first. Measurements are from headless Chromium in a cloud container (software rendering, so
absolute FPS is lower than on a real GPU; compare numbers against each other, not against 60).

---

## Inspector: Terra tiles

**Shipped:** in Terra an Edit-mode click picks the tile under the pointer: the card shows what it is (and the pickaxe
tier it needs), lets you change it to any block, dig it out or turn it to stone, and set how many of that block you
carry. Changes go through the normal tile setter, so collision and LAN clients follow.

**Measured (`tests/inspector_terra.js`):** the grass under the hero was picked, changed to brick, then dug to air; no
errors.

---

## Level Studio: Siege forts and Word Lab rooms

**Shipped:** rules "Ragdoll Siege (fort)" (palette: crate, plank, stone pillar, TNT; enemy pieces become the fort's
zombies; an ammo list such as "dummy, heavy, bomb"; the sling's stone base is added if missing) and "Word Lab (room)"
(a ⭐ star, a task line and a word par). The level-wide settings appear in the Studio inspector when nothing is
selected. Built-in forts and rooms open with their zombies / ammo / task / par.

**Measured (`tests/studio_siege_words.js`):** fort 2 opened with 3 zombies and ammo "dummy, heavy, dummy"; with ammo
changed to "bomb, heavy" it play-tested as Siege with 3 zombies and those 2 shots; a new room with task "Get up to the
star with one word!" and par 1 play-tested, showed the task, and "fly" + reaching the star cleared it; no errors.

---

## Level Studio: Brawl stages

**Shipped:** rules "Brawl (stage)" with a Brawl palette (main stage, floating platform, fighter spawn). The Studio works
out what Brawl needs from the layout: the widest solid block is the stage (its top and centre), the blast zones sit
1400 px beyond the sides and well above / below everything, and up to 4 spawns come from the spawn pieces (filled in
across the stage if there are fewer). Built-in stages open with their spawns; saved stages join Brawl's stage rotation
and are remembered as the chosen stage across reloads.

**Measured (`tests/studio_brawl.js`):** Skybridge opened (4 spawns, 6 pieces); a new 3-piece stage play-tested as a
real match (fight phase, P1 + CPU), pushing P1 past the edge cost a stock (3 → 2); the rotation went Plaza → Skybridge
→ Gearworks → My Arena → Battlefield; no errors.

---

## Connecting the games and the Level Studio (step 3, first game: Wobble Wheels)

**Shipped:** Wobble Wheels can be built in the Level Studio. Pick the rules "Wobble Wheels (course)" and a Wobble
Wheels palette appears (mine, swinging log, spike strip, crumble slab, finish line — game-specific categories only show
for their game); checkpoints are the usual gadget. The Studio converts the document to the game's course format
(traps, finish line, checkpoints) for play-testing and saving, and back: the built-in courses open with all their
traps as editable pieces. Saved courses appear in Wobble Wheels' course select.

**Measured (`tests/studio_wheels.js`):** Trap Alley opened with 9 traps and its finish at 7300; a new course with 2
mines, a checkpoint and a finish play-tested as a real Wobble Wheels run (1 rider, 2 mines, finish 3000, checkpoint
1200); after saving, the course select listed "My Wheels Course" after the 4 built-ins; no errors.

---

## Connecting the games and the inspector (step 2 of 3)

**Shipped:** `inspect.js`. Before, Edit mode could only pick blocks, crates and enemies. Now a click asks the game
first: Bed Brawl beds (health, repair), generators (speed, drop 5 now) and players (health, iron / gold / diamond);
Brawl fighters (damage %, stocks); Wobble Wheels riders (crashed?, engine power, eject, restart); the Crash Lab dummy
(damage, new dummy, launch); Word Lab pets (size, send home) and water (width, drain); and, in any game, heroes / CPU
players (health, max health, speed) and ragdolls. Each shows as a card on the Inspect tab with live values and a dashed
outline on the object. Full-screen games show a live match card (Table Games scores, Rent Rush cash, Party Board stars).

**Measured (`tests/inspector.js`):** bed picked and its slider set its health to ~20; generator picked; Brawl fighter
picked and set to 150 %; rider picked and ejected; Table Games match card listed game / opponent / scores; a Survival
zombie still opens the old inspector. **Went wrong (test only):** the zombie walked off the clicked spot during a 200 ms
wait — the test now clicks right after spawning.

---

## Connecting the games and the tuning panel (step 1 of 3)

**Asked:** "How can we connect all the games so that the inspector menus and the games interact well with each other."
The answer: one small contract per game that every tool reads — `tunables()` (its settings), `inspect(x, y)` (what can
be selected and edited) and `studio` (palette + level conversion). **Shipped, step 1:** `tunables.js` — the Game tab
now shows "<GAME> — its own settings" (Brawl: stocks, CPU skill · Zombie Ball: goals, minutes, CPU · Table Games: CPU ·
Bed Brawl: generator speed (new) · Wobble Wheels: engine power (new) · Party Board / Rent Rush: rounds · Creative:
noclip, invincible), and hides shared rows that do nothing there (waves, spawn rate, enemy HP… outside wave games;
world rows in the full-screen games), with a note saying how many. The header no longer says "Wave 1" in Brawl.

**Measured (`tests/tuning_panel.js`):** Survival unchanged (nothing hidden); Brawl shows its 2 settings and hides 8
rows; Table Games hides 18 (only FPS and controls help left); Wobble Wheels / Bed Brawl show theirs; moving the engine
power slider set the game's value to 2; no errors. **Next:** `inspect()` and `studio` (steps 2 and 3).

---

## Character detail: ragdolls and the square look

**Shipped:** ragdoll limbs and torsos get a soft highlight stripe when they're drawn thick enough to see it (close
zoom), and the feet are boots pointing along the shin instead of dots. The classic square look got small hands at its
sides and two feet under the body; both swing / step while walking.

**Measured:** the square hero shows hands and stepping feet in a zoomed screenshot; the Crash Lab dummy at 2.5× zoom
shows the lighter stripe along arms and torso and the boots; no errors. **Went wrong:** the first highlight never drew
— ragdoll colours are "rgb(...)" strings, not "#hex", and limbs are 4-5 px thick (under my 6 px threshold); a pixel
sample across the arm (one flat colour) caught it.

---

## Crash Lab props

**Shipped:** the heavy weight is riveted iron with a "1 TON" label; the wrecking ball hangs on a chain of links and is
an iron ball with a highlight and shading; spike blocks have steel-shaded spikes. That closes the texture list (enemy
weapons turned out to be drawn in detail already by the default look — an edit to an old, unused drawing path was
reverted).

**Measured:** weight, spikes and wrecking ball placed with their tools and drawn; no errors.

---

## Textures: vehicles, rails, Bed Brawl props

**Shipped:** five more procedural 32 px textures in the same seeded style — `panel_overlay` (see-through seams, rivets
and a highlight drawn over a car's paint, so every colour gets detail), `cart_iron` (riveted iron plates for
minecarts; the engine car is shaded darker), `rail_tie` (grained wood for the rail sleepers), `pedestal_stone` (chiselled
stone with a gold top edge for Bed Brawl shop pedestals) and `gen_grate` (metal grate for the generators).

**Measured:** all five built into the texture table; screenshots of a car, a two-car minecart on rails and the Bed Brawl
pedestals show them; no errors.

---

## Word Lab: water

**Shipped:** "water" (pool, lake, river, sea…) makes a block of water whose surface is just above the pointer and
which fills down to the ground beneath it (or 300 deep in mid-air; size words work). In it you're nearly weightless —
you sink slowly and W / Space strokes you up — and crates, balls and barrels float to the surface. Drawn as a
see-through pool with a moving wavy surface.

**Measured (`tests/word_water.js`):** "big water" at the hero: surface 200, bottom on the floor at 0; a dropped crate
floated to 200; holding W swam the hero up and out at the surface; no errors. **Went wrong:** the first pool hung
300 deep from the pointer straight through the floor; it now stops at the ground.

---

## Table Games: Word Hunt

**Shipped:** a seventh table game — 8 words from a list of 40 game words (ZOMBIE, PORTAL, RAGDOLL, TROLLEY…) hidden in a
10×10 grid in any of 8 directions, the rest random letters. Both players race: drag from the first letter to the last
(either way round), or move a box with WASD / arrows and press Space / Enter on both ends. The CPU finds a word every
15 / 10 / 6 s by skill. Pass-and-play and LAN (grid, words, cursors sync). No dictionary needed: the game placed the
words, so it knows them.

**Measured (`tests/table_wordhunt.js`):** all 8 placed words spell correctly in the grid; a real mouse drag (backwards)
found one, the keyboard cursor found another, the normal CPU found one within 11 s; no errors.

---

## Table Games: Sway Darts

**Shipped:** a sixth table game — the aim point drifts in a figure-eight (and the whole pattern wanders); hold Space or
the mouse to steady your hand (halves the sway for about a second, then you start to shake), let go to throw. Bull 50,
inner 25, rings 20 / 15 / 10 / 5, the outer gold ring doubles. 3 darts a turn, 5 rounds. The CPU waits for a calm
moment in its own sway and throws with skill-based error. Pass-and-play and LAN (board, darts, sway sync).

**Measured (`tests/table_darts.js`):** a full match vs the normal CPU finished 315 - 290; P1's darts (blind timing,
0.5 s holds) scored 15-50. **Went wrong:** the first tuning was far too easy — steadying cut the sway to a quarter
and the figure-eight always crossed the bull: 13 of 15 darts were 25 or 50.

---

## Wobble Wheels: Pogo

**Shipped:** a sixth vehicle — a pink pogo stick. It bounces by itself every time its spring foot lands; W makes the
hops bigger, S smaller, A/D lean it the way you want to go. The rider keeps the stick balanced (a small push back
toward upright, tilted a little forward), from the countdown on.

**Measured (`tests/wheels_pogo.js`, W held on Hill Hop):** upright (handle 120+ above the foot), hopping, x 4164
after ~5 s (the bike does 4185); the other vehicles' test unchanged. **Went wrong, three times:** the bounce read a
ground-contact counter that the wheel code had already used up (it never fired); the push went down the stick
instead of up; and the stick — a balanced-on-one-point pendulum — toppled during the 1 s countdown before any
balancing ran, then skated along on its side. Fixed by bouncing on "any contact this frame", the right sign, and a
balance step that runs every frame from spawn and is strong enough to lift a fallen stick.

---

## Table Games: Pocket Race (cue game)

**Shipped:** a fifth table game — 7 coloured balls racked against the white on a six-pocket table. Drag back from the
white and let go (or ←/→ aim, ↑/↓ power, Space). Pot a ball: +1 and shoot again; pot the white: -1 and the turn
passes; the higher score when the table is clear wins. The CPU uses the ghost-ball method (where the white must hit
each ball to send it at each pocket), skips blocked lines, prefers straight short shots, aim noise by skill. Pass-and-
play and LAN (balls, scores, turn and aim sync).

**Measured (`tests/table_pool.js`):** a real mouse drag broke the rack; a full match vs the hard CPU ran to the end,
3 - 4 to BLUE, all 7 balls potted, about 1.5 minutes; no errors.

---

## Brawl: character moves

**Shipped:** every hero look now has its own E move in Brawl instead of everyone sharing the shockwave: Original Hero
keeps the shockwave; Stick Fighter — Rising Uppercut (leaps up, launching anyone above or in front upward); Street
Brawler — Ground Slam (hop, dive, the landing blasts everyone within 260 px); Cap Hero — Rocket Punch (a lunge forward
that strikes the first fighter in the way). 1.25 s cooldown; the bat still takes over E while held; CPUs use them
because they already press E up close.

**Measured (`tests/brawl_moves.js`, a real E press with the CPU 120 px in front):** shockwave 13 %, uppercut 21 %,
slam 13 %, rocket punch 22 %; no errors. **Went wrong (test only):** setting the "E pressed" flag from the test did
nothing — the game re-reads it from the keyboard every frame — so the test presses the real key.

---

## Touch controls (phones and tablets, also as LAN players)

**Why:** the LAN instructions say "open the link on every computer, tablet or phone", but the game had no touch input
at all: a phone could tap Join and then do nothing — it looked exactly like "LAN doesn't work".

**Shipped:** `touch.js`. On a touch screen (or after the first touch) on-screen buttons appear: ◀ ▶ ▲ ▼ on the left,
Jet / Dash / Smash / Grab on the right, ⏸ (Esc) at the bottom. They send the same key events a keyboard does, so every
game, the pause menu and the LAN client understand them. One finger on the game area is the mouse (hover, press,
release, click), so the Arcade, menus and board games work by tapping and you aim + shoot by touching where you want
to fire; quick taps are held for ~70 ms so they register. The buttons hide while a menu owns the screen; the keyboard
cheat-sheet is hidden on touch devices.

**Measured:** emulated Pixel 7 — tapping the first Arcade card started Zombie Survival, holding ▶ walked 550 px,
holding on the screen fired 3 rounds, ⏸ paused (`tests/touch_phone.js`); as a LAN joiner it tapped 📡 and Join,
got into the host's game, and holding ▶ moved its hero on the host's screen (`tests/lan_phone.js`); the desktop LAN
tests still pass. **Went wrong:** the first version was called `Touch`, which overwrote the browser's own `Touch` class.

---

## LAN fix: wrong join address, firewall, clearer failures

**Reported:** "The LAN won't work at the moment."

**Found:** the game's own LAN code works end to end through the real buttons (📡 → Host, a second browser → Join, the
host picks a game, the joiner is in it) — so the failure is between two real devices. Two causes there were ours:
1. **The join link could be an address nobody can reach.** The server listed every network adapter in whatever order
   the system gave and the game showed the first one. On Windows with WSL / Hyper-V / VirtualBox / VPNs installed that
   is often a virtual adapter (172.x / 192.168.56.x), not the Wi-Fi. Now real adapters are ranked first (192.168 → 10
   → 172.16-31, virtual adapter names last, 169.254 "no network" addresses dropped), and the server window prints
   each address with its adapter name. With a typical WSL + VirtualBox laptop the old link would have been
   172.25.96.1 (WSL); now it's the Wi-Fi's 192.168.1.23.
2. **Nothing helped with the firewall.** If the "Allow Node.js?" prompt was cancelled, Windows adds a *block* rule that
   overrides everything; on a Wi-Fi marked Public it blocks by default. New: **Allow LAN (Windows firewall).bat** —
   asks for admin, removes those block rules and allows Node.js for the local network only. The server window and
   the host's LAN panel ("Nobody can join? Check these") now walk through: same Wi-Fi, exact link with the port,
   the firewall, router client isolation.

Also: a failed connection now names the likely causes (server window closed, VPN / proxy / filtering app) instead of
"Is node server.js still running?", and a joiner's status says "Playing in the host's game" once the game arrives
(it kept saying "waiting").

**Measured:** `tests/lan_buttons.js` (new, real clicks) and `tests/lan_play.js` pass; adapter ranking checked on a
simulated WSL + VirtualBox + Wi-Fi laptop. **Can't test here:** two physical devices and a real Windows firewall.
This cloud box's browser goes through a proxy that refuses WebSocket upgrades to its own network address (403),
so the cross-device path was tested via localhost; on a home network there's no such proxy.

---

## Word Lab: pets

**Shipped:** "dog", "cat" and "bird" (and puppy, kitten, parrot…) make a pet that follows you: dogs and cats trot after
you and hop when blocked or when you climb; the dog chases and bites monsters that come within reach; the bird hovers
beside your head. They're light invisible crates underneath (so they walk on the ground and can be grabbed or stood
on), drawn on top as a rounded animal with ears, eyes, trotting legs and a wagging tail; size and colour words work.

**Measured (`tests/word_pets.js`):** after a 2.5 s sprint the dog was 75 px behind, the cat 105, the bird 72 px beside
the hero's head; a zombie spawned 200 px from the dog went 78 → 0 HP; no errors. **Went wrong:** the first drawing
sat behind the crate body (only the tail showed), so the pets are now drawn in front and the crate is invisible.

---

## Word Lab: rooms 6-8

**Shipped:** three rooms built around the new words — Low Door (the star is behind a 60 px gap: "shrink"), The Tower
(the star is on top of a 1400-high tower, taller than giant stairs: "fly", a balloon or a giant rope), Pressure Point
(a door that only stays open while its plate is weighed down: a crate or boulder on the plate).

**Measured (`tests/word_rooms.js`, `tests/word_tower_fly.js`):** none can be solved by just walking right; shrink →
star; fly + steer at the top → star; a boulder on the plate → star; giant stairs top out at 572 and fail on the
tower as intended. **Went wrong:** the first Low Door gap (100 px) let the normal 80 px hero walk under; the first
"shaft" room had no way in — replaced by the tower.

---

## Brawl: the bat

**Shipped:** item drops now rotate power-up → bomb → bat. The bat falls onto the stage; walk over it to take it. While
you hold it, E swings it (in the direction you face, short range) instead of the shockwave — 6 swings, a 1.8× launch,
"BONK!". CPUs already press E up close, so they use it too. It's drawn on the stage and in the holder's hand.

**Measured (`tests/brawl_bat.js`):** the third drop was a bat; P1 picked it up (6 swings); one swing at the CPU: 12 %,
launched 448 px, 5 swings left; the bomb test still passes; no errors. **Went wrong:** at first a bat hit launched
the CPU only 14 px (just under the ragdoll-launch threshold) — hence the 1.8× multiplier.

---

## Brawl: Gearworks stage

**Shipped:** a fourth Brawl stage — a metal deck whose ends slope away into the blast zone (no ledge to catch, so
recovering low is harder), a lift platform sweeping from side to side above it, and a small hub on top.

**Measured (`tests/brawl_gearworks.js`):** the stage loads with its lift (a mover gadget) moving; a 12 s fight vs the
CPU ran (the idle P1 lost a stock, the CPU dealt 16 %); no errors.

---

## Bed Brawl: Bridge Egg

**Shipped:** a 🥚 Bridge Egg pedestal (20 iron): the egg flies the way you face (tilting a little with your aim) and
lays a team-coloured wood block every 80 px behind it, top level with your feet — up to 16, until it hits something.
It skips spots that are already solid and flies over beds. A fast way to the middle island or straight at the enemy.

**Measured (`tests/bedbrawl_egg.js`):** bought for 20 iron; 12 blocks laid from x -2068 to -794, all with their top at
the hero's feet height; holding D walked the hero 1400 px along it without falling. **Went wrong:** the first egg flew
into its own team's bed (beds are solid) and stopped before laying anything; it now passes over beds.

---

## Crash Lab: Cliff Fall scenario

**Shipped:** one-push scenarios are now a list (each with its own start and saved best), and a second one joins Stair
Drop: Cliff Fall — a 2000-high cliff with rock outcrops sticking out of the face, two bounce pads, crates and a TNT
barrel below. Pause → Scenario cycles Sandbox / Stair Drop / Cliff Fall (◀ ▶ both work now).

**Measured (`tests/crash_cliff.js`):** the menu row cycled stairs → cliff → sandbox; the dummy started on the cliff
top waiting for the push; one push scored 254 with 1 bone and saved it as the Cliff Fall best; no errors.

---

## Wobble Wheels: Scooter and Trolley

**Shipped:** two more vehicles (V / pause menu): a green Scooter — small wheels, tall bar, quick, Space kick-pushes
for a speed burst once a second; and a shopping Trolley — slow but hard to tip, Space does a little hop. Best times,
ghosts and course-select medals are kept per vehicle as before.

**Measured (`tests/wheels_vehicles.js`, W held for 5 s on Hill Hop):** trolley 2462 px and still upright; scooter
with kicks 4079 px (about the bike's 4185) before crashing at the jump gap, where the W-only bike also lands badly.
**Went wrong:** the first trolley (accel 0.42, 14 px wheels) stalled on the first ramp at 1174 px; now 0.56 / 17 px.

---

## Table Games: Hill Cannons (artillery)

**Shipped:** a fourth table game — two cannons on generated hills; ←/→ angle, ↑/↓ power, Space fires (or hold the
mouse to aim, release to fire). Shells carry a per-turn wind, carve craters (so a hit cannon often ends up in a pit
it has to lob out of), and deal damage by distance; 100 HP each. The CPU simulates a grid of shots and adds aim noise
by skill. Pass-and-play and LAN (the joiner is BLUE; terrain, cannons, shell and wind sync).

**Measured (`tests/table_cannons.js`):** a match vs the hard CPU ended BLUE wins after 3 hits (100 → 59 → 11 → 0);
over LAN the CPU left BLUE's turn to the joiner, their ← raised the angle 130 → 155 and Space fired, the client saw
the same terrain (161 points) and HP; no errors.

---

## Bed Brawl: Fireball

**Shipped:** a ☄ Fireball pedestal (24 iron): a small, nearly weightless bomb launched fast along your aim; it bursts
on the first thing it hits, knocking players back and blasting placed blocks — the answer to a turtled bed. Uses the
new per-object `gravityMult` and the thrower-safe explosives fix.

**Measured (`tests/bedbrawl_fireball.js`):** bought for 24 iron (30 → 6), flew level at 26 px/frame and burst at the
wall 480 px away; all 4 built blocks of the wall destroyed; no errors.

---

## Brawl: throwable bombs

**Shipped:** every other Brawl item drop is a bomb: grab it (G / right-click), click to throw, it explodes on impact
with the usual percent-based knockback; bullets set it off too; unused bombs fizzle after 25 s.

**Bug found on the way (all games):** a thrown TNT barrel or bomb counted the thrower as "hit" the moment it left their
hands and blew up on them (P1 took 34 % from their own throw). Explosives now ignore their thrower while in flight.

**Measured (`tests/brawl_bomb.js`):** the item timer dropped a bomb; P1 grabbed one and threw it at the CPU: CPU +14 %,
P1 0 %; no errors.

---

## Course select for Parkour Rush, Crate Lab, Portal Lab and Wobble Wheels

**Shipped:** one shared grid (`courseselect.js`) opened from each game's pause menu: every course / room / chamber
as a card with its number, name, best time and medal (Parkour: saved medals; Wobble Wheels: medals from the course par
for the vehicle you're on), locked ones greyed out, the current one outlined. Mouse, arrows + Enter, Esc. Portal Lab
now records best times per chamber.

**Also:** Portal Lab still carried lines and chamber names echoing the game it's modelled on (a cake joke, a famous
momentum quote, "Companion" crate); all replaced with original wording ("First Light", "Fling Theory", "Crate Courier").

**Measured (`tests/course_select.js`):** all four open from the pause menu; Parkour and Wheels: → + Enter loaded
course 2; Crate Lab / Portal Lab show 7 / 4 locked cards and clicking the open one loads it; no errors.

---

## Wobble Wheels: course 4 "Crumble Run" (falling platforms)

**Shipped:** a new trap — crumbling slabs: land on one and it shakes for ~1 s, then drops away (falls and fades). Course
4 runs four of them over a shallow pit (falling in costs time; a ramp leads back up), then a bounce pad, a log, a mine,
spikes and two more slabs near the finish.

**Measured:** a rider held at ~13 px/frame stayed on top of the slabs the whole way (lowest y 230 vs slab top 200) while
all four crumbled behind; a slow rider dropped into the pit and could drive on. **Went wrong:** the first layout put a
full-height block after the slabs, a wall inside the pit that trapped anyone who fell (now a thin ledge); the first pit
was 500 px deep and flipped the bike (now 240).

---

## Portal Lab: reticle for every local player

**Shipped:** the "where will my portal land" reticle was mouse-only for P1. It now shows for every local hero —
mouse, gamepad stick or P2's keyboard aim — in that player's portal colours, using the same aim direction as the
shot itself (`Portals.aimDir`).

**Measured:** stick aim at 90° → direction (1, 0) and one reticle drawn; mouse aim unchanged; the old reticle /
placement test still passes; no errors.

---

## Word Lab: verbs, rope, balloon + a respawn bug

**Shipped:** verbs that change your hero (fly, grow, shrink, normal, heal); "rope" / "vine" (a column of footholds);
"balloon" now floats up and lifts you while you hold it (G) — objects can opt out of the global gravity with
`gravityMult`. A new `Character.scaleSize(k)` makes "big zombie" / "tiny knight" actually resize monsters (the old
code called a method that didn't exist, so sizes were silently ignored). The unknown-word reply lists the new words.

**Bug found on the way:** in Word Lab, being killed respawned the hero at an unset spawn point, so their position
became NaN and the hero vanished (the canvas then threw on every frame). `Gadgets.killPlayer` now falls back to the
level's start for any game without a spawn point.

**Measured:** big zombie 80→128 px; grow 128 / shrink 44 / normal 80; balloon rose 230→387 in 1 s; holding it lifted
the hero 71→296, letting go dropped him; rope = 7 footholds; big hero vs big zombie for 10 frames: no NaN, no errors;
the old Word Lab test still passes.

---

## Crash Lab: Stair Drop close-up

**Shipped:** a new engine hook `cameraZoom()` (a game's zoom multiplier); Stair Drop uses it to follow the dummy
itself at 1.5× (0.84 instead of 0.56), framed slightly ahead and below so the next steps are in view.

**Measured:** Crash Lab stays at 0.56; Stair Drop runs at 0.84 and the dummy is readable mid-fall (a 712-point run
in the test); no errors.

---

## Parkour Rush + Crate Lab: T keys

**Shipped:** Parkour Rush — T puts you straight back on your last checkpoint (clock keeps running, not counted as a
fall). Crate Lab — T returns every crate to where the room started it (a held crate is dropped first; blown-up TNT
still needs R). Both are in the bottom key legend.

**Measured:** checkpoint at x 3550 → moved 900 away → T → 3550, deaths unchanged; Crate Lab room 1 crate pushed from
-650 to -50 → T → -650; no errors.

---

## UI pass 4: every game at 820×600

**Shipped:** screenshots of all 22 games and build mode at 820×600 found four problems, all fixed generally rather
than per game: the "👥 P1 vs CPU1 (Players: …)" badge drops its suffix under 1100 px (it sat on the Zombie Ball
scoreboard, Bed Brawl's bed timer and Crash Lab's damage panel); `uiText` shrinks small centred lines (≤14 px) that
would run off the screen, which fixed Terra's control legend; Rent Rush's ROLL/BUILD/TRADE buttons scale to the
board's inner square; the build bar moves beside the hero card in solo, or above the cards, when it doesn't fit
between them.

**Measured:** re-shot the affected games: no overlaps; Rent Rush tests (full game, mortgage, trade) and the build
test still pass; no console errors.

---

## UI pass 3: cheats & tuning panel

**Shipped:** the panel is called "🧪 Cheats & tuning" (as in every menu) instead of "DEV MODE", has a ✕ button,
and Esc closes it before a second Esc pauses. Below 900 px it narrows to fit and its "Drag to place" dock moves under
the wave panel instead of over the key help / hero card; under 640 px the dock hides. The key-help sheet stays hidden
while the panel is open.

**Measured:** 1280×720 and 820×600 screenshots with no overlaps; Esc → panel closed, not paused; second Esc → paused.

---

## One-click LAN

**Shipped:** before this, LAN play needed a terminal whether the game was opened as a file or served by the Control
Panel (whose server can't relay players), and the panel's advice was terminal commands. Now:
**Start LAN Game.bat / .command** (checks for Node.js and opens its download page if missing, finds Homebrew / nvm
installs on a Mac) runs `node server.js --open`, which opens the game already hosting. A **Control Panel add-on**
(`updater_addons/lan.py`) adds **Start LAN game** / **Stop LAN game** to Home → Play together: background server on a
free port, browser opens hosting, the join links are printed in the panel's log. server.js moves to the next port when
one is taken and reuses itself when started twice. The LAN panel checks which server it's on: file / plain server →
the two one-click ways; game server → Host or Join highlighted depending on whether someone already hosts (it
re-checks every 2.5 s); hosting → the join link large, with Copy.

**Measured:** file and plain-server pages show the start steps; `/?lan=host` hosted by itself and showed
http://<ip>:8099; a second page saw "A game is being hosted" with Host disabled, joined, the host counted 1 peer;
add-on start → start again (reused) → stop all worked against a stand-in Control Panel; busy port 8080 → 8081;
second launch exited 0 after reopening; the earlier LAN test (2 joiners, movement, 60 FPS) still passes.

**Went wrong / limits:** the Control Panel's own source can't be reached from this environment, so the add-on
uses only the API in UPDATER.md and its buttons haven't been seen in the real window yet. The panel re-renders on
every server change, so it keeps the typed name by hand.

---

## UI pass 2: Level Studio in and out

**Shipped:** opening the Studio no longer throws your game away. The world is parked and handed back untouched when
you close it (same score, wave and positions) unless you play-tested, which has to replace the world. Opening from a
game shows a start card instead of silently dropping you into your last edit: edit a copy of the level you were
playing, continue the autosave, start blank, or open a saved level (Esc/B goes straight back). The toolbar went from
18 controls in a scrolling strip to one line that fits 820 px: name, rules, waves, ▶ Play-test, undo/redo, one grid
picker, a 📁 File menu (new, copy current, save, saved levels with delete, export/import, start screen, cheats),
a panel toggle (Tab) and a clear ◀ Back button. Side panels shrink on small windows and the camera, framing and hint
lines follow their real width. The palette has a search box (type, Enter picks the first match). The inspector shows
position and size as pairs first and uses readable names ("links (door ids)", "open until powered").

**Measured:** score 1234 and the hero's position survived open → edit a copy → close at 1280 and 820 wide; after a
play-test, close reloads the original level; the old Studio regression test (place, drag, inspector, undo/redo,
save, play-test, exit back) passes; gamepad editing test passes; no console errors.

**Went wrong:** the first toolbar still overflowed at 820 px (1027 px of controls); short labels below 980 px fixed it.

---

## UI pass 1: compact top bar, adaptive pause menu

**Shipped:** the six-button top-right strip (which covered HUD text and wrapped at narrow widths) is now four icon
buttons — 👥 Players (shows humans + CPUs), 📡 LAN (shows "Hosting · N" while live), 🛠 Studio, ☰ Menu — that dim
while you play and light up on hover, pause or when a menu is open; labels drop below 1100 px. ☰ opens one grouped
menu (Play / People / Make & tune / Settings) with shortcut keys shown, closing on Esc or a click outside. The pause
menu now starts below the bar, shrinks its rows to fit the window, scrolls (keys, wheel) when it still doesn't fit,
and follows the mouse. The key-help sheet moves up instead of colliding with the side HUDs on narrow windows.

**Measured:** screenshots at 1280×720, 820×600 and 800×450: nothing clipped, Settings (14 rows) scrolls at 450 px;
Esc closes the menu without pausing; no console errors.

**Went wrong:** the old cheats toggle rewrote its button's HTML and wiped the label, so it was rewritten to only flip
classes.

---

## Wobble Wheels: eject + best-run ghost

**Shipped:** E (P2 /) ejects — the rider lets go and is flung up and forward (a deliberate bail-out that counts as a
crash). A ghost outline of your best run (per course and vehicle, recorded every 4 frames, only from full runs)
rides along with you.

**Measured:** a full run saved a 200-sample ghost (best 202 frames) and it shows on the next attempt; E broke every
joint and ended the run; no errors.

---

## Table Games: Air Hockey

**Shipped:** a third table game — Air Hockey: an air-hole rink with goal mouths, RED on the mouse (or WASD), BLUE as a
CPU (guards the mouth, strikes when the puck is on its side; speed by skill), on the arrows, or a LAN player; puck
physics with mallet momentum, a speed cap and table friction; first to 7, serve to the side that conceded. Syncs over
LAN like the other table games.

**Measured:** an 18 s scripted rally vs the normal CPU: 2-1, 60 FPS, no errors.

---

## Rent Rush: auctions, mortgages, trading

**Shipped:** skipping a street starts an AUCTION (from half price; CPUs bid up to a valuation that rises if the
street helps their colour; humans press their button to raise $10; 2.5 s without a bid closes it). Short of cash you
now MORTGAGE before losing streets (half price, you keep the street, no rent while mortgaged, grey "MORTGAGED" tile;
buy back at 55% with M / UNMORTGAGE). TRADING: on your turn T / TRADE offers to buy the street that best completes
your colour for ~1.6× its price; CPU owners accept fair offers that don't break their own set, human owners get
ACCEPT / DECLINE; CPUs make offers too when they're two-thirds of the way to a set. All of it syncs over LAN.

**Measured:** P1 skipped Mud Lane → auction → CPU 2 bought it for $70; P1 with $30 owing $100 mortgaged two streets
instead of going bankrupt, and landing on a mortgaged street charged no rent; T → "P1 offers CPU 2 $100 for Mud Lane"
→ accepted, the set completed; the unattended 4-player game still ends with a winner; no errors.

---

## Party Board: two more minigames

**Shipped:** TIMING (a marker sweeps across a bar — press when it's in the green; closest to the middle wins) and
HOLD IT (hold your button for exactly 3.00 s and let go; closest wins; "never let go" loses). Five minigames now
rotate; both work for local, CPU and LAN players.

**Measured:** Timing — all four stopped (P1 off by 15, a CPU by 0 won); Hold It — P1 held 3.00 s → off by 0.00 s and
won +10 coins; no errors.

---

## Brawl: ledge grab and shield

**Shipped:** falling past the lip of a solid stage block catches it (once per trip through the air, brief
invulnerability); UP / jump climbs on, DOWN lets go, you drop after ~3 s. Holding DOWN while standing on the solid
main stage raises a shield bubble: hits do no damage or knockback but shrink it; it regrows when lowered; if it breaks
you're dizzy for about a second. CPUs raise their shield against incoming shots.

**Measured:** P1 dropped beside the right edge → caught at the lip (x 1143, y 58), held steadily, W → climbed onto the
stage (x 1046); shield up → a 20-damage hit left the percent unchanged and knockback 0; no errors.

**Went wrong:** (1) the first hang spot overlapped the stage corner, so the engine called it "on ground", which
cleared the hang and re-grabbed every other frame; (2) W on the ledge became a normal jump before my code saw it → it
now hangs fully outside the wall and an engine jump while hanging counts as the climb.

---

## Terra over LAN

**Shipped:** Terra's tile grid now streams to LAN clients (run-length encoded; re-sent whenever a tile changes and every
3 s for late joiners) together with the clock, tool and stash, so clients see the same world, light and day/night.
LAN players dig with their own shoot button at their own aim and place blocks with their grab button; everything
goes into one shared co-op stash.

**Measured:** host + client: grid checksums identical after joining; the client held the mouse on the tile under its
feet → the tile was mined on the host, dirt 20 → 21 in the stash, checksums still identical; no errors.

---

## Terra resumed: tools, crafting, light, day/night, saving

**Shipped:** you paused Terra "in favor of other tasks"; those are done, so it's back. Pickaxe tiers (hands → wooden →
stone → iron → gold) decide what you can mine (stone needs wood, iron needs stone, gold and crystal need iron) and how
fast. C opens a crafting panel (planks, workbench, torches, the pickaxes, bricks; tools need a workbench within a few
tiles). Torches are placeable and light the caves through a per-tile light map (sky light by time of day that fades
below the surface, torches radius 8, your own glow radius 5) — it replaces the old radial darkness. A 4-minute day /
night cycle: at night monsters walk in on the surface and vanish at dawn; E shockwave fights back; no game over (you
wake at spawn with your stuff). I = inventory, K / L = save / load (run-length encoded, ~38 KB), autosave every minute
and the saved world is continued on launch, N twice = new world. Generation: ore veins instead of single specks, the
world is 30% deeper with a deepstone layer holding crystals.

**Measured:** fresh world: 28k deepstone, 190 crystal, 1087 coal / 653 iron / 263 gold in veins; hands can't dig
stone (gated), wood → planks → workbench → wooden pickaxe → stone dug; torches crafted from wood + coal; at 21:45
two night monsters spawned; save → change → load restored the grid checksum and tool; the original Terra test still
passes; no errors.

**Left / known:** LAN sync of the tile grid, axes / swords, more biomes.

---

## Wobble Wheels over LAN

**Shipped:** LAN players get a rider of their own in Wobble Wheels (an `addNetPlayer` hook: hidden seat hero + rider
steered by their keys, W/S drive, A/D lean, Space special), they keep riding after restarts and their rider goes away
when they leave. Fixed a clash found while testing: the gamepad 3-4 rider code found riders by slot number, and LAN
players also start at slot 2 — so it deleted the LAN rider as an "unplugged pad". Pad riders are tagged now.

**Measured:** client held W → its rider drove from x -589 to 1847 on the host; after a restart it was back at the
start; leaving removed it; the pad-3 join/unplug test still passes.

---

## Stomp Squad: bouncing fireballs, no enemy health bars

**Shipped:** fire-flower shots in Stomp Squad are now fireballs — they leave at a fixed speed, arc down under gravity
and hop along the floor (up to 8 bounces, reusing the ricochet code). New engine flag `noEnemyBars` hides enemy health
bars; Stomp Squad turns it on (foes there are stomped, not whittled down).

**Measured:** one shot hopped from x 210 to 947 with y bouncing between 17 and 68 (floor at ~0); platformer regression
run unchanged; no errors.

---

## Players panel: per-seat Human / CPU / Off toggles

**Shipped:** a `seats()` mode hook; the 👥 Players panel renders it as one row per seat with 🎮 Human / 🤖 CPU / — Off
buttons (or a −/+ CPU count) and a note on keys. Party Board and Rent Rush: P1 human, seat 2 human (Enter) / CPU / off,
seats 3-4 CPU / off ("a gamepad 3 makes it human"); Table Games: BLUE human (pass-and-play) / CPU; Worm / Blob / Tank
Arena: P2 human / off + CPU opponents count; Jet Dash: P2 runner on / off. The "Right now:" summary for these games is
built from the seats (e.g. "🎮 P1 + 🎮 Seat + 🤖 CPU") instead of listing the hidden placeholder hero.

**Measured:** clicking seat 2 → Human and seat 4 → Off in Party Board gave humans 2 / players 3 (P1, P2, CPU 3);
Worm Arena CPU count 11 → 10 and P2 on → 12 worms incl. P2; Table Games BLUE human ↔ CPU switches `vs`; no errors.

---

## Controls remapping (keyboard P1 / P2 + gamepad buttons)

**Shipped:** `controls.js` — Settings → "Controls: remap keys & buttons" opens a panel with every P1 and P2 action
(move ×4, shoot, jetpack, dash, use, grab, reload) and the 7 gamepad action buttons (jump, shoot, jetpack, dash ×2,
punch, use). Click a binding, press the new key / button; clashes are outlined red; Reset to defaults; saved. It's a
translation layer in front of the normal key handler (a pressed key becomes the default key of the action it's bound
to), so every game picks it up without changes; pads go through a logical → physical button table.

**Measured:** rebinding P1 jump to I through the panel → pressing I set the jump flag and the hero rose 280; a pad
with jump moved to X jumps on X and not on A; Esc closes the panel; gamepad regression test unchanged.

---

## Controllers: Level Studio gamepad editing, Wobble Wheels pads 3-4

**Shipped:** Level Studio works with a gamepad — a yellow world cursor on the left stick / D-pad (the camera follows it
near the edges; right stick pans), A places the current piece or selects what's under the cursor and drags it while
held (grid-snapped), B deletes or cancels placing, X rotates, LB/RB step through the palette, LT/RT zoom, Y
play-tests, Start saves, Back closes; the hint line switches to the pad legend. Wobble Wheels: gamepads 3 and 4 now
get riders of their own (there are no CPUs to take over), joining mid-course and leaving on unplug.

**Measured:** with a simulated pad: RB → "Block", A placed it (7 entities), hold-A + stick dragged it 1200 up, B
deleted it (6), Studio stayed open; a pad-3 rider joined and drove to x 1438, unplugging removed it.

---

## LAN for the real-time full-screen games (arenas, Jet Dash, Sand Lab)

**Shipped:** a `netInput()` hook — a full-screen game can send its own controls from a LAN client (steering angle,
aim point, buttons) — plus `Net.peerList()` / `Net.peerX(pid)`. Worm Arena, Blob Arena and Tank Arena give every LAN
player their own worm / blob / tank (steered with their mouse, boost / split / fire with their buttons, respawn on
their button, removed when they leave); clients get the host's state (pellets only near LAN players to keep it
small) and a camera that follows their own piece. Jet Dash adds LAN players as extra runners on the same run. Sand
Lab streams the grid run-length encoded every other snapshot and lets LAN players paint with their own material and
brush. No full-screen game is local-only any more.

**Measured:** host + client over the relay — Worm: client mouse turned the worm right (angle 0) then down (1.57),
click boosted (length 26 → 14), leaving removed it; Blob: the blob followed the client's mouse; Tank: D drove it
right, click fired; Jet Dash: holding flew the runner up; Sand Lab: client painted 378 lava cells, identical on both
screens. Snapshots 9-15 KB at 30 Hz in the arenas; all-games smoke test 0 errors.

---

## LAN for the turn-based games (Rent Rush, Party Board, Table Games)

**Shipped:** a draw-only LAN path for full-screen games: a mode can now offer `screenDraw()` plus `netState()` /
`applyNetState()`, and LAN clients render the host's state with the game's own drawing instead of the "local-only"
screen. Net helpers: `Net.seatPeers(players)` (LAN players take free CPU seats and give them back when they leave)
and `Net.peerButtons(pid)` (Space / F / ↑ = go, ↓ = no, E = extra, ← →). Rent Rush and Party Board seat every LAN
player; Table Games gives the first LAN player the blue side (Four in a Row and Flick Soccer with keys), and the
host's mouse can't play their turn. Labels say who's who ("BLUE (you)" on the client, "BLUE (Bob)" on the host).

**Measured:** host + client over the real relay: Rent Rush — Bob took the CPU 2 seat, rolled and bought 2 streets
from the client, cash matches on both screens; Four in a Row — Bob's ←/→ + Space dropped a blue counter; Party
Board — Bob rolled and mashed in the minigame (15 taps); no errors.

**Left / known:** the real-time full-screen games (arenas, Jet Dash, Sand Lab) are still local-only.

---

## Siege Birds: breakable stone

**Shipped:** in Birds mode the fort's stone blocks (never the one the slingshot stands on) have 240 HP: a bird that
hits stone fast enough chips it (the Boulder ~3× harder), explosions take 160, cracks appear as it weakens, and at 0
it shatters (+500), waking the sleeping blocks around it so whatever it held up comes down.

**Measured:** fort 4 — a Boulder chip, then two blasts → both stone pillars gone, score 3750; the idle-bounce
regression in Birds mode on all 5 forts is still 0 bounces / 0 idle deaths.

---

## Stomp Squad course themes (+ engine `drawBack` hook)

**Shipped:** a new `drawBack()` mode hook (drawn behind the level pieces, over the scenery). Stomp Squad uses it so the
Cavern course is a dark cave with parallax stalactites and glinting crystals and Sky Bridges is a bright sky gradient
with drifting clouds; Meadow keeps the normal hills. Checked the TODO: wall-slide / wall-jump and power-ups rising out
of ? blocks were already in, so those entries were stale.

**Measured:** both themed courses render; the platformer regression run (blocks, stomp, pit, goal → next course)
unchanged; no errors.

---

## Zombie Ball Flail polish — keepers, modifiers, goal slow-mo

**Shipped:** a third player per side in Flail style — a goalkeeper that slides along its goal line toward the ball's
side and springs straight up on your button instead of charging upfield (pause menu → Goalkeepers on/off). Modifiers
(pause menu → Modifier): Wind (a gust pushes the ball, and players a little; it changes after every goal; HUD shows
the direction and strength), Big heads (heads 1.75× — great for headers), Ice pitch (feet keep sliding), Random each
match. Every goal plays in slow motion for a moment.

**Measured:** keepers stay at x ≈ ±1880 (goal line ±2100) through 12 s of mashing in all four modes; big-head radius
39 → 68; goal → 70 slow-mo frames; no errors.

**Went wrong:** first keepers jumped with the normal forward kick and walked back slowly → ended up at midfield
(x -800); wind at full strength knocked everyone flat → bodies feel a quarter of it now.

---

## LAN clarity for the full-screen games

**Shipped:** the nine full-screen games skipped the host's snapshot step, so a LAN client stayed frozen on the
previous game. The host now keeps sending (mode + lobby) from those games too; the client shows "The host is playing
SAND LAB — local-only for now (play it on the host's screen)", and the host's arcade cards say "local only (no LAN
yet)". Switching back to a LAN game (e.g. Brawl) brings the client straight back in.

**Measured:** host Survival → Sand Lab → Brawl with a client attached: client follows to "powder" (message shown) and
back to Brawl with 2 fighters; no errors.

---

## Frontier goes underground (B3 "lower generated level") + all-games smoke test

**Shipped:** three new frontier chunks in `levels.js`, in the eastward biome cycle between Thunderhead Peak and the
Deep Echo Caverns: **Old Mine Entrance** (yard → seven-step shaft down under timber roof beams → gallery 560 px below
the trail, iron ore, dynamite, a chest, bat + slime), **Deep Mine Tunnels** (a full chunk of floor + ceiling with
one-way scaffolds, gold / coal ore crates, dynamite, a chest, knight / archer / bat) and **Mine Exit** (tunnel →
spring → seven steps up to a grassy hillside back at trail height). Each chunk passes its right-edge height to the
next, so the world really is lower for two chunks.

**Measured:** chunk edge heights 40 → 40 → -520 → -520 → 40; walking east from the mine yard the hero reaches the
tunnel floor (y -480), crosses it and climbs back out; no errors. Plus a smoke test of all 22 games (launch, input,
pause, resume): 0 errors, 47-61 FPS headless.

**Went wrong / decided:** (1) Deep Echo Caverns can't follow a descent — its lowest tier would end up under the
rescue line and inside the bedrock — so the mine climbs back out first. (2) Heights only chain west→east, so the
mine only appears heading east. (3) A hanging support beam looked like a floating log → removed.

**Left / known:** a deeper multi-level underground (needs the rescue line / bedrock to follow the terrain).

---

## Rent Rush (new game, B4 — property board game) — B4 complete

**Shipped:** `game_property.js` (ownScreen): an original property game on a 7×7 ring of 24 spaces — five colour
groups of three streets with made-up names, two transit lines (rent doubles per line owned), chance ×3, city tax
(feeds a pot you win on the Lounge corner), Detention (go-to-detention corner, three doubles, a chance card; you miss a
turn) and START (+200). Two dice; doubles roll again. Land on an unowned street → BUY / SKIP; others pay rent; a whole
colour doubles base rent and unlocks houses (1-3, rent ×4 / ×9 / ×16, half the street price each). Short of cash you
sell houses then streets back at a loss; still short = bankrupt. Ends when one player is left or at the round limit
(richest net worth wins). Buttons on screen + keys (P1 Space / X / H, P2 Enter / ' / .), pads 3-4 join, CPUs buy
when it completes a set or keeps a cash cushion and build when rich. Side panel: cash, net worth, colour chips, log.

**Measured:** two unattended games (20 and 10 rounds, 1 human + 3 CPUs) played to a winner; a CPU completed a set
and built 9 houses; rent, tax pot, chance and detention all fired; no errors.

**Went wrong:** (1) a chance card that moved you back onto a street lost its buy offer, and a bankruptcy that ended
the game got overwritten — both by an unconditional "after" phase → guarded. (2) Dark HUD-style text with an outline
was unreadable on the light board → plain text for the board.

**Left / known:** trading, mortgages, auctions (TODO.md). **With this, all nine B4 suggestions exist as games** (some
marked [~] with follow-ups in TODO.md).

---

## Party Board (new game, B4 — dice board party)

**Shipped:** `game_party.js` (ownScreen): a 28-space loop on a green island. Each turn the die spins until you hit your
button (P1 Space, P2 Enter, gamepads 3-4 join as P3/P4, the rest are CPUs that roll on their own), your piece hops
along: passing START +5, BLUE +3, RED -3, "?" = one of five events (treasure, pickpocket the richest, warp next to
the star, coin rain, the star flies away). Passing the ★ with 20 coins buys a star, and it moves. After everyone has
moved: a minigame — MASH (most taps in 5 s), QUICK DRAW (fastest press after GO, pressing early disqualifies),
STOP IT (stop a running counter on a target) — winners +10 coins. 5/10/15/20 rounds; most stars (then coins) wins,
with a final ranking. Pause menu: humans, players, rounds, new party.

**Measured:** an unattended 2-round party (P1 pressing on a rhythm, 3 CPUs) went intro → rolls → moves → events →
mini:draw / stop / mash → results → winner, then restarted; stars were bought in the 5-round run; no errors.

**Went wrong:** (1) a "human" P3/P4 without a gamepad would have had no button and hung the game on their turn →
P3/P4 are human only while their pad is connected. (2) The bottom row of spaces sat under the score panels → the
board now fits between the message bar and the panels.

**Left / known:** more minigames (reuse the arcade games), items, branching paths (TODO.md).

---

## Word Lab (new game, B4 — type-a-thing sandbox)

**Shipped:** `game_words.js`, built on the normal platformer engine (hero, physics, monsters, gadgets). Five rooms —
High Shelf, The Gap, Guarded, Vault, Sky Star — each with a star you can't reach as-is. Enter or T opens a real text
box at the bottom; what you type appears at the mouse (or next to you if the mouse is inside a wall). It knows about
90 nouns, mapped onto engine pieces: crates / boulders / TNT / bouncy balls, walls, platforms, bridges, clouds,
staircases, ramps, trampolines, fans, cars, ten monster kinds, crash dummies, power-ups (medkit, shield, gun, boots,
sword, ice, lightning, magnet), explosions and a jetpack. Adjectives stack: size (big / huge / giant / tiny…),
heavy / light, bouncy, explosive, 13 colours, angry monsters (double health). Unknown words get "I don't know X yet"
with suggestions; "star", "key", "portal"… get "Nice try!". Words used vs par → 1-3 stars per room, saved. No game
over: losing all health just puts you back at the room start. Pause menu: room select + word list.

**Measured:** "big stairs" → 10 steps, the hero walked up and took the star with 1 word (3 stars), next room loaded;
12 more words (bridge, heavy red crate, tiny bouncy ball, angry knight, trampoline, car, tnt, fan, medkit, jetpack,
cloud, dummy) all spawned; no errors.

**Went wrong:** escaped quotes in two strings came out double-escaped (a syntax error) → fixed before the first run.

**Left / known:** more nouns and verbs, more rooms (TODO.md).

---

## Table Games (new game, B4 — 2-player minigame pack)

**Shipped:** `game_table.js` (ownScreen) with two original tabletop games, picked in the pause menu (Game / Opponent /
CPU skill). **Flick Soccer**: a felt pitch on a wooden table, five discs a side; on your turn press a disc, drag back
and let go to flick (dashed aim line + pull line); real circle physics (mass, restitution, friction, goal posts,
open goal mouths); a goal resets the formation and the side that conceded kicks off; first to 3. Keyboard / pad
alternative: Tab / L1 picks a disc, A/D turns the aim, W/S power, Space shoots. The CPU scores every disc: contact
point behind the ball toward the goal, how straight the cut is, distance and blockers, plus skill noise.
**Four in a Row**: drop counters (click or ←/→ + Space), winning line highlighted; CPU = alpha-beta minimax (depth
1 / 4 / 6 by skill, a heuristic that counts open twos and threes and likes the centre). Pass-and-play for both.

**Measured:** a human flick reached x 484 on the ball; the CPU answered with its own flick; a forced goal scored 1-0;
the hard Four in a Row CPU blocks an open three; hard search ≈ 130 ms per move.

**Went wrong:** pucks rolled for ~5 s per turn → more table friction. The hover counter hid behind the turn banner →
board moved down.

**Left / known:** more minigames (air hockey, cue game, darts, artillery), LAN turns (TODO.md).

---

## Jet Dash (new game, B4 — jetpack runner)

**Shipped:** `game_jetpack.js` (ownScreen): an original lab-corridor runner. You run right on your own (7 → 17 px/frame
over distance); hold Space / W / click (pads: A / RT) to thrust, let go to fall. Hazards: electric zappers (single bars
at four angles, some spinning, and two-bar gates), missiles that lock onto your height behind a blinking "!" and then
streak across, and laser beams that show a dashed charge line and then fire across the corridor (sometimes in pairs).
Coin ribbons and sprinkles, a rare shield bubble that saves you once. Death = a tumble and skid, then a results card
(distance, cause, coins, banked total, best). P2 flies the same run on ↑ / Enter.

**Measured:** an autopilot test survived 685 m and grabbed 19 coins; restart after death works; 60 FPS.

**Went wrong:** (1) dying didn't end the run — the "everyone dead?" check ran before that frame's collisions → moved
to the end of the step. (2) Missiles parked at `cssW` (screen pixels) in a world that is scaled → uses the scaled
corridor width. (3) The P1/P2 labels were scaled twice.

**Left / known:** coin shop, rideable vehicles, missions (TODO.md).

---

## Tank Arena (new game, B4 — diep-style)

**Shipped:** `game_tanks.js` (ownScreen): a 6000² arena with 240 drifting shapes (yellow squares, red triangles,
purple pentagons that crowd the glowing middle), 8 CPU tanks and you. Shapes and tanks give XP; 45 levels; a stat
point per level for 8 stats (regen, max health, body damage, bullet speed, pierce, damage, reload, move speed — keys
1-8 or click); class picks at 15 (Twin, Sniper, Machine Gun, Flank Guard) and 30 (Triple Shot, Assassin, Destroyer,
Tri-Angle) on U/I/O/P or click. Recoil, pierce, bullets cancel each other, ramming hurts both sides, regen after 4 s,
spawn protection. CPUs farm the best XP-per-distance shape, keep a fighting distance and strafe, run (shooting back)
below 40% health, spend points to a build and pick classes. E = auto-fire. P2 on the arrows + Enter with auto-aim
(its points and class are chosen for it). Snipers / Assassins see further.

**Measured:** 0.29 ms per step; level 15 → class card, U → Twin, stats spent with keys; no errors.

**Went wrong:** (1) the first numbers made it a grind — about 2 s per square and ~10 000 XP to level 15 → more bullet
damage, faster reload, a gentler XP curve (~1 000 XP to 15, ~6 300 to 30). (2) Stat names and the XP bar text were
dark on dark → light text. (3) Delayed second barrels used `setTimeout`, which keeps running while paused → a
frame-timed queue.

**Left / known:** LAN, drone classes, teams (TODO.md).

---

## Blob Arena (new game, B4 — agar-style)

**Shipped:** `game_cells.js` (ownScreen): a 5200² arena with 2000 pellets, 14 viruses and 14 CPU blobs. You eat pellets
and any blob at least 25% smaller once it's mostly inside you; mass makes you slower; Space splits every piece toward
the cursor (they push apart, then merge back after 9 s); W ejects mass you can feed or bait with; viruses burst a blob
over 130 mass into up to 8 pieces. CPU blobs flee anything 25% bigger (and steer off walls), chase prey, split-lunge
at small targets, and big ones avoid viruses. Camera zooms with your mass (and to fit your pieces / P2), leaderboard,
best mass, death card + respawn, local P2 (arrows / Enter / "/") and pads.

**Measured:** 0.17–0.25 ms per step with 16 players; split → 2 pieces, virus → 9 pieces, all merged back to 1 after
the timer; P1 grows 20 → 33 in 10 s just wandering.

**Went wrong:** the bottom hint was dark-outlined text on the light floor — unreadable → dark strip behind it.
1100 pellets were too sparse (CPUs gained ~1.5/s) → 2000.

**Left / known:** LAN, team mode, feeding viruses to shoot them (TODO.md).

---

## Worm Arena (new game, B4 — slither-style)

**Shipped:** `game_snake.js` on the new `ownScreen` path: a round arena with 1400 glowing pellets and 11 CPU worms.
Mouse steers (A/D switch to keyboard turning), click / Space / W boosts at double speed but burns length and leaves food
behind; a head that touches another worm's body bursts into pellets; the wall kills too. CPU worms probe seven rays
for bodies / the wall, chase the best nearby food and, when bigger, try to cut in front of smaller worms. Leaderboard
(you're always listed), minimap, best length saved, 2 s spawn protection, local P2 on the arrows with a camera that
zooms to fit both, gamepad sticks.

**Measured:** 0.45 ms per simulation step with 13 worms; CPUs grow 28 → 60 in 12 s; eating, death message, respawn and
best-length save verified headless.

**Went wrong:** (1) my `onKey` swallowed Space, so the global Space flag never got set and Space-boost did nothing →
removed. (2) P1 could die two seconds after spawning in a crowd → spawn protection. (3) 700 pellets in this arena were
too sparse to grow by hand → 1400 and worth a bit more.

**Left / known:** LAN, skins, team mode (TODO.md).

---

## Sand Lab (new game, B4) + arcade scrolling

**Shipped:** `game_powder.js` — an original falling-sand toy on a 320×180 grid: sand, water, wall, fire, oil, plant,
lava, stone, steam, wood and an eraser. Sand and stone pile and sink through liquids, oil floats on water, lava is
sluggish and turns water into stone + steam, fire climbs and spreads through oil / plants / wood (water puts it out),
plants drink water and grow, steam rises and rains back down. Left mouse paints (powders sprinkle, solids fill), right
erases, wheel or [ ] sets the brush, 1-0 / palette picks the material, Space pauses, F fast-forwards, S / L save and
load the box. New engine flag **`ownScreen`** + hook `screenFrame()` so a game can own the whole screen without the
platformer world underneath (ENGINE.md). The arcade grid now **scrolls** (keyboard follows the selection, mouse wheel,
"▼ more games" hints) — with 14 games the fourth row was already cut off before this.

**Measured:** 0.28 ms per simulation step (60 FPS with room to spare); lava into the pond: water 2180 → 1109,
759 stone, steam raining back; save → clear → load restores all 5445 cells; switching Sand Lab → Survival is clean.

**Went wrong:** the eraser's palette label showed "1" (key numbering wrapped) → "E". The save encoding started out
convoluted → plain one-char-per-cell string.

**Left / known:** more elements, gamepad cursor (TODO.md).

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
