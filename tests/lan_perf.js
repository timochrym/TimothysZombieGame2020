// LAN performance: a host in Survival (waves on) + 2 joiners. Prints snapshot size, bytes/second, the host's cost per
// snapshot, both sides' FPS, and the joiner's input delay (key down -> own hero moves on the joiner's own screen).
const { spawn } = require('child_process'); const path = require('path'); const { chromium } = require('playwright');
const PORT = 8097;
const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' }); srv.unref();
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch();
  const mk = async (tag) => { const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); const errs = []; p.on('pageerror', e => errs.push(tag + ': ' + e.message)); await p.addInitScript(init); await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1200); return { p, errs }; };
  const H = await mk('host'), C = await mk('client'), C2 = await mk('client2');
  await H.p.evaluate(() => { Hub.close(); GameModes.launch('survival'); }); await H.p.waitForTimeout(800);
  await H.p.evaluate(() => Net.connect('host', 'Tim')); await H.p.waitForTimeout(500);
  await C.p.evaluate(() => Net.connect('client', 'Bob')); await C2.p.evaluate(() => Net.connect('client', 'Ann'));
  await C.p.waitForTimeout(2500);
  // a busy scene: 14 enemies
  await H.p.evaluate(() => { godMode = true; for (let i = 0; i < 14; i++) spawnZombie(undefined, redGuy.x + (i % 2 ? 1 : -1) * (300 + i * 60), redGuy.y + 200); });
  await H.p.evaluate(() => { window.__nb = []; window.__nt = []; const hf = Net.hostFrame; Net.hostFrame = function() { const t = performance.now(); const r = hf.apply(this, arguments); const dt = performance.now() - t; if (this.tickNo % (this.snapEvery || 2) === 0) { __nt.push(dt); __nb.push(this.lastSnapBytes || 0); } return r; }; });
  await H.p.waitForTimeout(5000);
  const host = await H.p.evaluate(() => { const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); return { snaps: __nb.length, avgBytes: Math.round(avg(__nb)), maxBytes: Math.max(...__nb), kbPerSec: Math.round(__nb.reduce((x, y) => x + y, 0) / 5 / 1024), msPerSnap: +avg(__nt).toFixed(2), fps: measuredFPS, zombies: zombies.length, statics: staticObjects.length }; });
  // input delay on the joiner: press D, time until its own hero's x moves by > 3 px on its own screen (5 tries)
  const delays = [];
  for (let i = 0; i < 5; i++) {
    await C.p.waitForTimeout(500);
    const d = await C.p.evaluate(() => new Promise(res => { const me = Net.myChar(); if (!me) return res(-1); const x0 = me.x, t0 = performance.now();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd', bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd', bubbles: true }));
      const iv = setInterval(() => { const m = Net.myChar(); if (m && Math.abs(m.x - x0) > 3) { clearInterval(iv); res(Math.round(performance.now() - t0)); } else if (performance.now() - t0 > 2000) { clearInterval(iv); res(2000); } }, 2); }));
    await C.p.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'd', bubbles: true })); document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'd', bubbles: true })); });
    delays.push(d);
  }
  const cl = await C.p.evaluate(() => ({ fps: measuredFPS, me: !!Net.myChar(), predicted: !!(Net.predicting) }));
  // do host and joiner agree on where the joiner's hero is once it stops?
  await C.p.waitForTimeout(900);
  const hx = await H.p.evaluate(() => characters.filter(c => c.isRemote).map(c => Math.round(c.x))[0]);
  const cx = await C.p.evaluate(() => Math.round(Net.myChar().x));
  console.log(JSON.stringify({ host, inputDelayMs: delays, client: cl, agree: { host: hx, joiner: cx, diff: Math.abs(hx - cx) } }, null, 1));
  console.log([...H.errs, ...C.errs, ...C2.errs].slice(0, 8));
  await b.close(); process.exit(0);
})();
