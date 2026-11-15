---
base: 9c568aa
head: 3222387
---

- [ ] New Blank Sandbox game registered first in Arcade Hub with `#1 · NEW` card badge | file: game_sandbox.js | file: modes.js | file: hub.js | look: Blank Sandbox card appears first in Arcade Hub | link: index.html | try: Open index.html > look at top-left card in Arcade Hub > press Enter | see: BLANK SANDBOX card is #1 with #1 · NEW badge and launches into an empty world
- [ ] Universal Object Spawner with Spotlight default and Tabbed Dock, Radial Wheel, Dual-Pane Browser modes | file: sandbox_ui.js | file: game_sandbox.js | look: Spawner opens on Spotlight and switches between all 4 modes | link: index.html | try: Launch BLANK SANDBOX > press B or Space > switch Spotlight / Tabbed Dock / Radial / Browser > click an item | see: Spawner lists objects from all games and spawns selected items into the world
- [ ] Entity Takeover with Live Entity Roster Drawer (L2) and Tactical Pie Ring (L3) | file: game_sandbox.js | file: sandbox_ui.js | file: frame.js | look: Select and take over any entity in the world | link: index.html | try: Press Tab to open Entity Roster > click + Enemy > click Take Over or click the enemy on canvas > move with WASD > press F | see: Camera and WASD controls drive the possessed entity and F returns control to hero
- [ ] Grappling Hook (`G` key or Grapple tool) | file: game_sandbox.js | look: Fire grappling hook toward cursor and swing | link: index.html | try: In BLANK SANDBOX press G while pointing with mouse > hold W to reel in | see: Cyan cable latches onto target/air and pulls player toward anchor
- [ ] Pro Studio Dock (L1), Right-Click Context Menu, and Glassmorphic Split Pause & Cheats Menu (L1) | file: sandbox_ui.js | file: frame.js | look: Left tool rail, right inspector, right-click menu, and split pause card | link: index.html | try: Right-click canvas > press Esc to open Pause menu > switch tabs | see: Context menu actions work and Pause opens Glassmorphic Split Card with Creative Rules, Cheats, Entities, and Switch Game
- [ ] JS syntax check passes on `sandbox_ui.js` | run: node --check sandbox_ui.js
