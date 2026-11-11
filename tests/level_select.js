// Survival level select with the MOUSE only: pause -> click "Level select…" -> click a level card -> that level loads.
// Also the ☰ menu dropdown. (The old pause row only cycled a name until Enter was pressed.) Exits non-zero on failure.
const { open } = require('./lib'); const path = require('path');
(async () => {
  const { b, p, errs } = await open('survival', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a); const out = {};
  const cur = () => ev(() => LevelManager.currentLevelKey);
  out.start = await cur();
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  // click the Level select row where the pause menu drew it
  const r = await ev(() => { const it = pauseItems(), i = it.findIndex(x => x.id === 'level'); const rc = (typeof pauseRects !== 'undefined' && pauseRects[i]) || null; return { i, label: it[i] && it[i].label, rc }; });
  out.row = r.label;
  if (r.rc) await p.mouse.click(r.rc.x + r.rc.w * 0.3, r.rc.y + r.rc.h / 2); else await ev(() => pauseActivate('level'));
  await p.waitForTimeout(400);
  out.gridOpen = await ev(() => CourseSelect.isOpen() + ' cards=' + document.querySelectorAll('#course-select .c').length);
  await p.screenshot({ path: path.join(__dirname, 'shots', 'level_select.png') });
  await p.click('#course-select .c[data-i="2"]'); await p.waitForTimeout(1200);
  out.afterCardClick = await cur() + ' paused=' + await ev(() => paused) + ' statics=' + await ev(() => staticObjects.length);
  // ☰ menu dropdown
  await p.click('#top-menu-btn'); await p.waitForTimeout(300);
  await p.selectOption('#level-select-dropdown', 'bounce_chaos'); await p.waitForTimeout(1200);
  out.afterDropdown = await cur();
  console.log(JSON.stringify(out, null, 1)); console.log(errs);
  const ok = out.start === 'classic_arena' && /^true cards=[5-9]/.test(out.gridOpen) && /^bunker_bridges paused=false/.test(out.afterCardClick) && out.afterDropdown === 'bounce_chaos' && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
