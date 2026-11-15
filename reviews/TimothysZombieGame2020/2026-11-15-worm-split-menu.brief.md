# Split worm in the menu panel

Range `91d5d0d..de60ca6`: 1 commit(s), 9 file(s) changed (9 files changed, 139 insertions(+), 6 deletions(-)).

**3 You decide, 11 Found**

| # | You asked / the agent said | Result | Evidence |
| --- | --- | --- | --- |
| c1 | The menu panel (Game tab, Game Rules) has a slider "Split worm into (pieces)" from 2 to 30, a switch "Pieces can rejoin (head to tail)" and a button "Split my worm now", in Arena Mix and in Worm Arena. | **You decide** | file game_snake.js: changed<br>file tunables.js: changed<br>file game_mix.js: changed<br>test tests/worm_split_menu.js: exists (tests/worm_split_menu.js)<br>look: the three new rows at the top of Game Rules |
| c2 | Pressing "Split my worm now" with the slider at 6 cuts a worm of 120 into 6 worms of length 20 (total kept, same owner, name, colour and stats). | **You decide** | test tests/worm_split_menu.js: exists (tests/worm_split_menu.js)<br>look: the split in play |
| c3 | Any number up to 30 works: a worm of 150 splits into 30; a worm of 24 asked for 30 makes 8 (each piece needs 3 segments); a worm of 5 does not split. | **Found** | test tests/worm_split_menu.js: exists (tests/worm_split_menu.js)<br>weak evidence: this shows the change exists, not that it works (add run: to prove it) |
| c4 | With "Pieces can rejoin" off, a head touching another piece's tail does nothing (2 worms stay 2). With it on, the same touch joins them into 1. The setting is saved. | **You decide** | test tests/worm_split_menu.js: exists (tests/worm_split_menu.js)<br>look: pieces never recombine when the switch is off |
| c5 | The Worm Arena game also has the three rows and the button splits there. | **Found** | test tests/worm_split_menu.js: exists (tests/worm_split_menu.js)<br>weak evidence: this shows the change exists, not that it works (add run: to prove it) |
| c6 | The menu panel and the old cheats panel can show an action row (a button), so a game can offer "do this now" in its rules. | **Found** | file sandbox_ui.js: changed<br>file devpanel.js: changed<br>test tests/worm_split_menu.js: exists (tests/worm_split_menu.js)<br>weak evidence: this shows the change exists, not that it works (add run: to prove it) |
| c7 | Spike splits can now make up to 30 pieces per player (the cap was 4). | **Found** | file game_snake.js: changed<br>test tests/worm_split.js: exists (tests/worm_split.js)<br>weak evidence: this shows the change exists, not that it works (add run: to prove it) |
| c8 | The earlier split-worm, blob-split and blob-settings tests still pass. | **Found** | test tests/worm_split.js: exists (tests/worm_split.js)<br>test tests/blob_split_eat.js: exists (tests/blob_split_eat.js)<br>test tests/blob_settings.js: exists (tests/blob_settings.js)<br>weak evidence: this shows the change exists, not that it works (add run: to prove it) |
| c9 | `node --check game_snake.js` is clean. | **Found** | run node --check game_snake.js: exit 0 in the run (last line: (no output)) |
| c10 | `node --check game_mix.js` is clean. | **Found** | run node --check game_mix.js: exit 0 in the run (last line: (no output)) |
| c11 | `node --check tunables.js` is clean. | **Found** | run node --check tunables.js: exit 0 in the run (last line: (no output)) |
| c12 | `node --check sandbox_ui.js` is clean. | **Found** | run node --check sandbox_ui.js: exit 0 in the run (last line: (no output)) |
| c13 | `node --check devpanel.js` is clean. | **Found** | run node --check devpanel.js: exit 0 in the run (last line: (no output)) |
| c14 | `tools/verify_mix.py` ended with "ALL ASSERTIONS PASSED!" and "VERIFY MIX COMPLETE: 0 errors" on this computer after my change (it also passed before). The checker cannot run it: the script starts a command named `chromium`, and here the browser is only at /opt/pw-browsers/chromium (I put a one-line wrapper named `chromium` first on PATH, outside the repository). | **Found** | test tools/verify_mix.py: exists (tools/verify_mix.py)<br>weak evidence: this shows the change exists, not that it works (add run: to prove it) |

## What the commits say

- `de60ca6` 2026-11-15 Claude: Menu panel: 'Split my worm now' button, pieces slider (2-30) and a 'Pieces can rejoin' switch for Worm Arena and Arena Mix; Snake.splitInto; button row type in the menu panel and cheats panel; tests/worm_split_menu.js

## Questions for you

- **q1** Should "Split my worm now" be one of the keyboard keys too (for example T)? (Yes / No)
- **q2** Should LAN joiners be able to use the split button for their own worm? (Today only the host or a single player can.) (Yes / No)
- **q3** Does it feel right in use? (Better / Same / Worse)
