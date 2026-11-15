---
title: Split worm in the menu panel
project: Zombie Game
base: 91d5d0d
head: de60ca6
rundir:
---
# Split worm in the menu panel (2026-11-15)

Asked: an option to split the worm in the menu panel, into as many pieces as wanted, and an option to disable recombining.
Not pushed to `main` (AGENT-RULES: session branch only). The private repository `timochrym/Universal_Apps` was not attached, so this file is in this project's `reviews/` folder.

- [ ] The menu panel (Game tab, Game Rules) has a slider "Split worm into (pieces)" from 2 to 30, a switch "Pieces can rejoin (head to tail)" and a button "Split my worm now", in Arena Mix and in Worm Arena. | file: game_snake.js, tunables.js, game_mix.js | test: tests/worm_split_menu.js | look: the three new rows at the top of Game Rules | link: index.html | try: Arcade > Arena Mix > press Q until "Worm" > Menu (top left) > Game tab > scroll to Game Rules | see: "Split worm into (pieces)" slider, "Pieces can rejoin (head to tail)" switch, "Split my worm now" button, right under "Play as" | pic: reviews/TimothysZombieGame2020/pics/2026-11-15-worm-split-menu.png
- [ ] Pressing "Split my worm now" with the slider at 6 cuts a worm of 120 into 6 worms of length 20 (total kept, same owner, name, colour and stats). | test: tests/worm_split_menu.js | look: the split in play | link: index.html | try: Arena Mix > Worm > eat a little > Menu > Game tab > set the slider to 6 > click "Split my worm now" | see: a banner "SPLIT into 6" and 6 worms of the same colour fanning out; the leaderboard shows you once, with the total length
- [ ] Any number up to 30 works: a worm of 150 splits into 30; a worm of 24 asked for 30 makes 8 (each piece needs 3 segments); a worm of 5 does not split. | test: tests/worm_split_menu.js
- [ ] With "Pieces can rejoin" off, a head touching another piece's tail does nothing (2 worms stay 2). With it on, the same touch joins them into 1. The setting is saved. | test: tests/worm_split_menu.js | look: pieces never recombine when the switch is off | link: index.html | try: Arena Mix > Worm > Menu > Game tab > turn off "Pieces can rejoin" > split > steer one piece's head to another piece's tail | see: nothing joins, and the hint at the bottom says "rejoining is OFF"
- [ ] The Worm Arena game also has the three rows and the button splits there. | test: tests/worm_split_menu.js
- [ ] The menu panel and the old cheats panel can show an action row (a button), so a game can offer "do this now" in its rules. | file: sandbox_ui.js, devpanel.js | test: tests/worm_split_menu.js
- [ ] Spike splits can now make up to 30 pieces per player (the cap was 4). | file: game_snake.js | test: tests/worm_split.js
- [ ] The earlier split-worm, blob-split and blob-settings tests still pass. | test: tests/worm_split.js, tests/blob_split_eat.js, tests/blob_settings.js
- [ ] `node --check game_snake.js` is clean. | run: node --check game_snake.js
- [ ] `node --check game_mix.js` is clean. | run: node --check game_mix.js
- [ ] `node --check tunables.js` is clean. | run: node --check tunables.js
- [ ] `node --check sandbox_ui.js` is clean. | run: node --check sandbox_ui.js
- [ ] `node --check devpanel.js` is clean. | run: node --check devpanel.js
- [ ] `tools/verify_mix.py` ended with "ALL ASSERTIONS PASSED!" and "VERIFY MIX COMPLETE: 0 errors" on this computer after my change (it also passed before). The checker cannot run it: the script starts a command named `chromium`, and here the browser is only at /opt/pw-browsers/chromium (I put a one-line wrapper named `chromium` first on PATH, outside the repository). | test: tools/verify_mix.py

? Should "Split my worm now" be one of the keyboard keys too (for example T)? | options: Yes, No
? Should LAN joiners be able to use the split button for their own worm? (Today only the host or a single player can.) | options: Yes, No
? Does it feel right in use? | options: Better, Same, Worse
