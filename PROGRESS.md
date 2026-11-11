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

### 2026-11-11 — started: LAN fluidity
Measured first (`tests/lan_perf.js`, host + 2 joiners, 17 enemies, same machine):
about 5 KB per packet, 30 packets a second (145 KB/s), 1 ms of host time per packet, and **80 ms** between a joiner
pressing a key and seeing their own hero move. The 80 ms is the design (key → host → picture back), not packet size.
What fills the packets: enemies are 70%, mostly route-planning data only the host needs; a bug resends every empty
field in every packet; resting bodies resend all their points.
**Doing now:** joiner-side movement for its own hero + host correction; packet diet.
**Next:** the two LAN joiner bugs (Blob Arena food, soccer movement).
