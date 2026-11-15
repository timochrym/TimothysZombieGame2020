const { open } = require('./lib');
(async () => {
  const out = {};
  for (const [mode, id] of [['race', 'rc_select'], ['puzzle', 'pz_select'], ['portal', 'pt_select'], ['wheels', 'wh_select']]) {
    const { b, p, errs } = await open(mode, { w: 1100, h: 650 });
    const ev = (f, a) => p.evaluate(f, a);
    await p.waitForTimeout(400);
    await ev((id) => { openPause(false); const its = pauseItems(); pauseActivate(id, 0); }, id);
    await p.waitForTimeout(200);
    const r = await ev(() => ({ open: CourseSelect.isOpen(), paused, cards: [...document.querySelectorAll('#course-select .c')].map(c => c.className.replace('c ', '').trim() + ':' + c.querySelector('.t').textContent) }));
    
    // keyboard: Right then Enter picks the next unlocked course (or nothing if locked)
    const before = await ev(() => LevelManager.currentLevelKey);
    if (mode === 'race' || mode === 'wheels') { await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); }
    else { await p.click('#course-select .c[data-i="0"]'); }
    await p.waitForTimeout(400);
    r.after = [before, await ev(() => LevelManager.currentLevelKey), await ev(() => CourseSelect.isOpen())];
    out[mode] = r; out[mode].errs = errs.slice(0, 2);
    await b.close();
  }
  console.log(JSON.stringify(out, null, 1));
})();
