# Progress log

What's being worked on right now, what just shipped, and what's planned next. Newest entry first.
RETROS.md has the detail for each shipped update; TODO.md has the full checklists.

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

## Log

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
