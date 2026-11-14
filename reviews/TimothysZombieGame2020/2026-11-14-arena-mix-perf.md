---
base: 7bff4dc
head: 432fec7
---

- [ ] Optimized Snake.buildGrid and Snake.hitBody with integer-keyed Map, flat cell arrays, and squared-distance checks | file: game_snake.js
- [ ] Optimized Snake.step and Cells.step pellet eating loops with cached blob radii, squared-distance checks, and swap-and-pop removals | file: game_snake.js | file: game_cells.js
- [ ] Optimized Mix.interact with 32x32 2D pellet spatial bucket grid, cached entity radii, squared-distance checks, worm-ring bounds skip, swap-and-pop removals, and in-place compaction | file: game_mix.js
- [ ] Cached 3-in-1 radar background and 4-body quick-switch pills to offscreen canvases, plus cross-game burst FX | file: game_mix.js | look: Arena Mix HUD body pills, spawn ring, and 3-in-1 mini-radar | link: index.html | try: Open Arcade Hub > select ARENA MIX > click the top-left body pills or press Q > watch the 3-in-1 radar in the bottom-right | see: Instant body switch with golden spawn ring, clickable pills, and live 3-in-1 radar | pic: reviews/TimothysZombieGame2020/pics/mix_tank.png
- [ ] Arena Mix verifier (26 staged cross-game rule assertions, 4-body switching, Q switch, pill click, 0 errors) | run: python3 tools/verify_mix.py
