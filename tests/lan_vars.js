// Player 2 sees what the host sees: clocks, phases and vehicles in games that keep their own state (Wobble Wheels, Parkour,
// Crate Lab, Portal Lab, Crash Lab). Everything is read in the joiner's browser and compared with the host's number.
const { spawn } = require('child_process'); const path = require('path'); const { chromium } = require('playwright');
const PORT = 8086;
const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' }); srv.unref();
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch(); const errs = [];
  const mk = async (t) => { const p = await b.newPage({ viewport: { width: 900, height: 560 } }); p.on('pageerror', e => errs.push(t + ': ' + e.message)); await p.addInitScript(init); await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1200); return p; };
  const H = await mk('host'), J = await mk('joiner');
  await H.evaluate(() => { Hub.close(); GameModes.launch('survival'); }); await H.waitForTimeout(500);
  await H.evaluate(() => Net.connect('host', 'Host')); await H.waitForTimeout(500);
  await J.evaluate(() => Net.connect('client', 'P2')); await J.waitForTimeout(3000);
  const checks = {
    wheels: { read: () => ({ phase: Wheels.phase, time: Math.round(Wheels.time), riders: Wheels.riders.length, wheelPts: Wheels.riders.reduce((n, r) => n + r.pts.filter(p => p.wheel).length, 0) }), },
    race: { read: () => ({ phase: Race.phase, time: Race.time, timer: Race.timer }) },
    puzzle: { read: () => ({ time: puzzleState.time }) },
    portal: { read: () => ({ time: portalState.time, pairs: Object.keys(Portals.pairs).length }) },
    dummy: { read: () => ({ tool: Dummy.tool }) },
  };
  const out = {}; let ok = true;
  for (const g in checks) {
    await H.evaluate((g) => { Hub.close(); GameModes.launch(g); }, g); await J.waitForTimeout(4500);
    const [h, j] = await Promise.all([H.evaluate(`(${checks[g].read})()`), J.evaluate(`(${checks[g].read})()`)]);
    const res = { host: h, joiner: j }; out[g] = res;
    for (const k in h) { const hv = h[k], jv = j[k]; const near = typeof hv === 'number' ? Math.abs(hv - jv) <= Math.max(25, Math.abs(hv) * 0.25) : hv === jv; if (!near) { ok = false; res.mismatch = (res.mismatch || []).concat(k); } }
    if (g === 'wheels' && !(j.riders > 0 && j.wheelPts >= 2)) { ok = false; res.problem = 'bikes not rebuilt on joiner'; }
  }
  console.log(JSON.stringify(out, null, 1)); console.log('errors', errs.slice(0, 3)); console.log(ok && !errs.length ? 'PASS' : 'FAIL');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
