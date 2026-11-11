// Themes (theme.js): every theme changes the shared sky/hills, panels and full-screen game backgrounds; brightness
// filters the whole canvas; both persist, show in Pause -> Settings and in the panel's "Shared by every game" box.
// Saves screenshots to tests/shots/theme_<theme>_<game>.png for a look.
const { open } = require('./lib');
const fs = require('fs'), path = require('path');
(async () => {
  const { b, p, errs } = await open('survival', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a);
  const dir = path.join(__dirname, 'shots'); fs.mkdirSync(dir, { recursive: true });
  const out = {};
  const games = ['survival', 'platform', 'snake', 'table', 'tanks'];
  for (const th of ['night', 'day', 'sunset', 'meadow', 'retro']) {
    await ev(t => Theme.set(t), th);
    const row = [];
    for (const g of games) {
      await ev(m => { GameModes.launch(m); }, g); await p.waitForTimeout(700);
      // average brightness of the top strip (sky / background), read straight from the canvas pixels
      const shot = await p.screenshot({ clip: { x: 0, y: 60, width: 1280, height: 120 } });
      const lum = await ev(async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
        let s = 0, n = 0; for (let i = 0; i < d.length; i += 64) { s += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; n++; } return Math.round(s / n); }, 'data:image/png;base64,' + shot.toString('base64'));
      row.push(g + ':' + lum);
      if (g === 'survival' || g === 'table' || g === 'snake' || g === 'tanks') await p.screenshot({ path: path.join(dir, 'theme_' + th + '_' + g + '.png') });
    }
    out[th] = row.join(' ');
  }
  // brightness filter on the canvas, and saved settings
  await ev(() => Theme.setBright(1.3));
  out.filter = await ev(() => document.getElementById('screen').style.filter);
  out.saved = await ev(() => { const s = JSON.parse(localStorage.getItem('timsZombieGameSettings')); return s.theme + ' ' + s.bright; });
  // pause menu settings rows, and the ◀ ▶ cycle
  out.pauseRows = await ev(() => { pauseSub = 'settings'; const it = pauseItems(); return it.filter(i => i.id === 'stheme' || i.id === 'sbright').map(i => i.label.replace(/\s+/g, ' ')).join(' | '); });
  await ev(() => pauseActivate('stheme', 1)); out.afterCycle = await ev(() => Theme.id);
  await ev(() => { pauseSub = null; });
  // panel select works from a full-screen game too
  await ev(() => { GameModes.launch('table'); SummonManager.togglePanel(); DevUI.switchTab('game'); }); await p.waitForTimeout(500);
  out.panelVisible = await ev(() => getComputedStyle(document.getElementById('dp-shared')).display !== 'none' && document.querySelectorAll('#dp-shared-rows select').length);
  await ev(() => { const el = [...document.querySelectorAll('#dp-shared-rows select')].find(s => [...s.options].some(o => o.value === 'day')); el.value = 'day'; el.dispatchEvent(new Event('change')); });
  out.panelSet = await ev(() => Theme.id + ' dp-bg=' + getComputedStyle(document.documentElement).getPropertyValue('--dp-bg'));
  await ev(() => { Theme.set('night'); Theme.setBright(1); });
  console.log(JSON.stringify(out, null, 1)); console.log(errs);
  await b.close();
})();
