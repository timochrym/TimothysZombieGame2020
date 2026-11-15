---
title: Food and tank bullets too big in Arena Mix
project: Zombie Game
base: d99de3b
head: 5f8c0ae
rundir:
---
# Food and tank bullets too big in Arena Mix (2026-11-15)

Asked: "Sometimes the food gets too large visually, and also the Diepo bullets get too large and powerful." The earlier work (up to d99de3b) was pushed to `main` first, as asked. This work is on the session branch only (AGENT-RULES). The private repository `timochrym/Universal_Apps` was not attached, so this file is in this project's `reviews/` folder.

- [ ] Blob food is drawn at most 14 world units wide: a 5000-mass lump was 350 units; small food (mass 1) is still 4. | file: game_cells.js | run: node tests/mix_size_caps.js | expect: PASS | look: a big lump of food | link: index.html | try: Arcade > Arena Mix > play as a tank > shoot another tank to pieces (or turn up tank mass) and look at the lumps it drops | see: the lumps are small circles, not huge discs | pic: reviews/TimothysZombieGame2020/pics/2026-11-15-mix-size-caps.png
- [ ] Worm food globs are drawn at most 11 units (was 18). | file: game_snake.js | test: tests/mix_size_caps.js
- [ ] In Arena Mix a tank's bullet radius stops growing at 20 (it is reached at mass about 180); before, it grew with mass without limit (mass 2000 gave a bullet 6 times wider than at the start). | file: game_tanks.js | test: tests/mix_size_caps.js | look: a heavy tank's bullets | link: index.html | try: Arcade > Arena Mix > Tank > eat blobs until Mass shows 500 or more > hold fire | see: bullets are about twice as wide as at the start, not huge
- [ ] The mass damage boost of a tank stops at x1.6 (damage 5.5 to 8.8 at most; it was up to x3.2). A heavy tank still reloads more slowly (22 to 36.5). | file: game_tanks.js | test: tests/mix_size_caps.js
- [ ] Plain Tank Arena is unchanged: level 1 bullet radius 9.1 and level 45 radius 15.1, damage 5.5 in both. | test: tests/mix_size_caps.js
- [ ] `tools/verify_mix.py` still ends with "ALL ASSERTIONS PASSED!" and "VERIFY MIX COMPLETE: 0 errors" (the checker cannot run it here: the script needs a command named `chromium`; I used a one-line wrapper to /opt/pw-browsers/chromium, outside the repository). | test: tools/verify_mix.py
- [ ] The worm split, menu split, blob split and blob settings tests still pass. | test: tests/worm_split.js, tests/worm_split_menu.js, tests/blob_split_eat.js, tests/blob_settings.js
- [ ] `node --check game_tanks.js` is clean. | run: node --check game_tanks.js
- [ ] `node --check game_cells.js` is clean. | run: node --check game_cells.js
- [ ] `node --check game_snake.js` is clean. | run: node --check game_snake.js

Not fixed, found on the way: `tests/arena_mix.js` (my older test) crashes with "Cells.chainDash is not a function" since the bubble worm rework by the other agent. It crashes the same way without my change. `tools/verify_mix.py` is the test that is kept up to date.

? Are bullet radius 20 and damage x1.6 about right, or still too big? | options: Right, Still too big, Too small now
? Is food at most 14 units about right? | options: Right, Still too big, Too small now
? Should I fix or delete the old tests/arena_mix.js? | options: Fix it, Delete it
