// Cheats panel: opens on the Game tab; the "drag to place" row only shows on Build + Place (never just because the panel
// is open); full-screen games hide Build / Objects / Level. Screenshots in tests/shots/panel_*.png. Exits non-zero on failure.
const { open } = require('./lib'); const path = require('path');
(async () => {
  const { b, p, errs } = await open('survival', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a); const out = {};
  const dock = () => ev(() => getComputedStyle(document.getElementById('mario-maker-dock')).display !== 'none');
  const tabs = () => ev(() => [...document.querySelectorAll('.dp-tab')].filter(t => t.offsetParent !== null).map(t => t.dataset.tab).join(','));
  await ev(() => SummonManager.togglePanel()); await p.waitForTimeout(400);
  out.opensOn = await ev(() => document.querySelector('.dp-tab.active').dataset.tab); out.dockOnOpen = await dock(); out.worldTabs = await tabs();
  await p.screenshot({ path: path.join(__dirname, 'shots', 'panel_open_survival.png') });
  await p.click('.dp-tab[data-tab="build"]'); await p.waitForTimeout(150); out.dockOnBuildPlay = await dock();
  await p.click('#mode-place'); await p.waitForTimeout(150); out.dockOnPlace = await dock();
  await p.screenshot({ path: path.join(__dirname, 'shots', 'panel_place_survival.png') });
  await p.click('#mode-select'); await p.waitForTimeout(150); out.dockOnEdit = await dock();
  await p.click('#mode-place'); await p.click('.dp-tab[data-tab="game"]'); await p.waitForTimeout(150);
  out.leavingBuild = await ev(() => SummonManager.toolMode) + ' dock=' + await dock();
  // a full-screen game
  await ev(() => GameModes.launch('cells')); await p.waitForTimeout(700);
  out.arenaTabs = await tabs(); out.arenaActive = await ev(() => document.querySelector('.dp-tab.active').dataset.tab); out.arenaDock = await dock();
  await p.screenshot({ path: path.join(__dirname, 'shots', 'panel_open_arena.png') });
  await ev(() => GameModes.launch('survival')); await p.waitForTimeout(700); out.backTabs = await tabs();
  console.log(JSON.stringify(out, null, 1)); console.log(errs);
  const ok = out.opensOn === 'game' && !out.dockOnOpen && !out.dockOnBuildPlay && out.dockOnPlace && !out.dockOnEdit && out.leavingBuild === 'shoot dock=false'
    && out.arenaTabs === 'game,inspect' && out.arenaActive === 'game' && !out.arenaDock && out.backTabs === 'game,build,inspect,objects,level' && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
