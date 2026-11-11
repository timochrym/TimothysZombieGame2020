// Touch controls on an emulated phone: tap into a game from the Arcade, hold ▶ to walk, hold on the screen to shoot, ⏸ pauses.
const { chromium, devices } = require('playwright');
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
const hold = async (p, sel, ms) => {
  await p.evaluate((sel) => { const el = [...document.querySelectorAll('#touch-ui .tb')].find(d => d.textContent.startsWith(sel)); const r = el.getBoundingClientRect(); const t = new Touch({ identifier: 7, target: el, clientX: r.x + 10, clientY: r.y + 10 }); el.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true })); window.__held = [el, t]; }, sel);
  await p.waitForTimeout(ms);
  await p.evaluate(() => { const [el, t] = window.__held; el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true, cancelable: true })); });
};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 915, height: 412 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(init);
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(1500);
  const vis0 = await p.evaluate(() => [TouchUI.on, Hub.isOpen, document.body.classList.contains('touch-hide')]);
  // tap the first Arcade card (where the hub draws it)
  const card = await p.evaluate(() => { Hub.hover(-1, -1); const r = Hub.rects && Hub.rects.length ? Hub.rects[0] : null; return r ? [r.x + r.w / 2, r.y + r.h / 2] : [180, 200]; });
  await p.touchscreen.tap(card[0], card[1]); await p.waitForTimeout(400);
  await p.touchscreen.tap(card[0], card[1]); await p.waitForTimeout(1200);
  const st = await p.evaluate(() => [Hub.isOpen, GameModes.current && GameModes.current.id]);
  await p.waitForTimeout(300);
  const x0 = await p.evaluate(() => redGuy && Math.round(redGuy.x));
  await hold(p, '▶', 1000);
  const x1 = await p.evaluate(() => redGuy && Math.round(redGuy.x));
  const l0 = await p.evaluate(() => redGuy.ammoMag);
  await p.evaluate(() => { const cv = canvas; const t = new Touch({ identifier: 9, target: cv, clientX: 800, clientY: 150 }); cv.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true })); window.__ct = t; });
  await p.waitForTimeout(400);
  await p.evaluate(() => { canvas.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [__ct], bubbles: true, cancelable: true })); });
  const l1 = await p.evaluate(() => redGuy.ammoMag);
  await hold(p, '⏸', 80); await p.waitForTimeout(200);
  console.log('touch on / hub / hidden', vis0, 'after taps hub/mode', st, 'hero x', x0, '->', x1, 'ammo', l0, '->', l1, 'paused', await p.evaluate(() => paused), errs.slice(0, 3));
  await b.close();
})();
