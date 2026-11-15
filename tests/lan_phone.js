// A phone joins a LAN game with touch controls: taps 📡 and Join, holds ▶, and its hero moves on the host. Starts server.js on 8099.
const { chromium, devices } = require('playwright');
const srv = require('child_process').spawn(process.execPath, [require('path').resolve(__dirname, '..', 'server.js'), '8099'], { stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch();
  const H = await (await b.newContext({ viewport: { width: 1100, height: 650 } })).newPage(); await H.addInitScript(init);
  await H.goto('http://localhost:8099/'); await H.waitForTimeout(1200);
  await H.evaluate(() => { Hub.close(); GameModes.launch('survival'); Net.connect('host', 'Tim'); }); await H.waitForTimeout(800);
  const P = await (await b.newContext({ ...devices['Pixel 7'], viewport: { width: 915, height: 412 } })).newPage(); await P.addInitScript(init);
  const errs = []; P.on('pageerror', e => errs.push(e.message));
  await P.goto('http://localhost:8099/'); await P.waitForTimeout(1500);
  await P.tap('#lan-btn'); await P.waitForTimeout(2600);
  await P.tap('#lan-join'); await P.waitForTimeout(2500);
  const st = await P.evaluate(() => [Net.role, Net.inGame, TouchUI.on, document.body.classList.contains('touch-hide')]);
  // close the panel (tap Back to the game) and hold ▶
  if (await P.evaluate(() => NetUI.isOpen())) await P.tap('#lan-close'); await P.waitForTimeout(400);
  const x0 = await H.evaluate(() => { const c = characters.find(c => c.isRemote); return c && Math.round(c.x); });
  await P.evaluate(() => { const el = [...document.querySelectorAll('#touch-ui .tb')].find(d => d.textContent.startsWith('▶')); const r = el.getBoundingClientRect(); const t = new Touch({ identifier: 3, target: el, clientX: r.x + 5, clientY: r.y + 5 }); el.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true })); window.__t = [el, t]; });
  await P.waitForTimeout(1200);
  await P.evaluate(() => { const [el, t] = window.__t; el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true, cancelable: true })); });
  await P.waitForTimeout(300);
  const x1 = await H.evaluate(() => { const c = characters.find(c => c.isRemote); return c && Math.round(c.x); });
  console.log('phone: role/inGame/touchUI/hidden', st, 'phone hero on host x', x0, '->', x1, errs.slice(0, 3));
  await b.close();
  process.exit(0);
})();
