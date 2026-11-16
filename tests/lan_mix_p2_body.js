// Arena Mix over LAN, player 2 only: P2 switches body with Q and steers. After each switch the HOST must hold P2 in
// that same body (tank / blob / worm / chain), and P2's own screen must show it moving when keys are held.
const { spawn } = require('child_process'); const path = require('path'); const { chromium } = require('playwright');
const PORT = 8092;
const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' }); srv.unref();
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch(); const log = [];
  const mk = async (tag) => { const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => log.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.push(tag + ' ' + m.type() + ': ' + m.text()); });
    await p.addInitScript(init); await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1200); return p; };
  const H = await mk('host'), J = await mk('joiner');
  await H.evaluate(() => { Hub.close(); GameModes.launch('mix'); }); await H.waitForTimeout(800);
  await H.evaluate(() => Net.connect('host', 'Host')); await H.waitForTimeout(600);
  await J.evaluate(() => Net.connect('client', 'Player2')); await J.waitForTimeout(4000);
  const hostBody = () => H.evaluate(() => { const l = [].concat(Tanks.tanks.filter(k => k.human === 'lan').map(() => 'tank'), Cells.players.filter(c => c.human === 'lan').map(c => c.chain ? 'chain' : 'blob'), Snake.worms.filter(w => w.human === 'lan').map(w => w.compact ? 'chain' : 'worm')); return l.join('+') || 'none'; });
  const myPos = () => J.evaluate(() => { const m = Mix.me && Mix.me(); if (!m) return null; return m.segs && m.segs[0] ? [m.segs[0].x, m.segs[0].y] : [m.x !== undefined ? m.x : m.cx, m.y !== undefined ? m.y : m.cy]; });
  const rows = [];
  for (let i = 0; i < 6; i++) {
    const want = await J.evaluate(() => mixCfg.body);
    await J.waitForTimeout(700);
    await J.mouse.move(150, 325); await J.waitForTimeout(500); const p0 = await myPos();   // mouse far left, then hard right: a player steering
    await J.keyboard.down('KeyD'); await J.mouse.move(1000, 325, { steps: 8 }); await J.waitForTimeout(1500); const p1 = await myPos(); await J.keyboard.up('KeyD');
    const moved = p0 && p1 ? Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])) : -1;
    rows.push({ joinerBody: want, hostHasP2As: await hostBody(), joinerMoved: moved });
    await J.keyboard.press('KeyQ'); await J.waitForTimeout(600);
  }
  console.table(rows); console.log('errors/warnings:', [...new Set(log)].slice(0, 10));
  const bad = rows.filter(r => r.hostHasP2As.indexOf(r.joinerBody) === -1 || r.joinerMoved < 5);
  console.log(bad.length || log.length ? 'FAIL ' + JSON.stringify(bad) : 'PASS');
  await b.close(); process.exit(bad.length || log.length ? 1 : 0);
})();
