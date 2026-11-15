---
base: 3e0aa2c
head: HEAD
---
# Review: Universal Side Menu, Best-Ever Inspect Menu & Pixel-Art Soccer Physics

- [ ] `sport_flail.js` `Flail.drawMan` renders blocky pixel-art Soccer Physics characters (thick dark outline, square head, brown flat-top hair & bangs, headband, black eye, raised arms, shorts, skin knees, sock bands, shin socks, blocky boots) | file: sport_flail.js | test: node --check sport_flail.js
- [ ] `inspect.js` `UniversalInspect` maps screen/world coordinates and picks/highlights entities across all 24 games (standard world + `ownScreen` arenas `mix`, `tanks`, `cells`, `snake`, plus `sport` `Ball` & `Flail.men`) | file: inspect.js | test: node --check inspect.js
- [ ] `sandbox_ui.js` provides a collapsible Universal Side Menu (`Controls`, `Inspect`, `Tools`, `Games`) with live time-scale/pause/step, `GameTuning.rows()`, universal cheats, live property editors, raw property explorer, and 1-click game switching | file: sandbox_ui.js | test: node --check sandbox_ui.js
- [ ] `frame.js` integrates `UniversalInspect.followTarget`, `_sbFrozen` pinning, and `UniversalInspect.drawOverlay()` in both `ownScreen` and standard world frames | file: frame.js | test: node --check frame.js
- [ ] Verified with `node --check` on all modified JS files and `python3 tools/verify_universal_soccer.py` (5/5 checks, 0 JS errors, visual inspection of 4 screenshots) | file: tools/verify_universal_soccer.py | run: python3 tools/verify_universal_soccer.py
