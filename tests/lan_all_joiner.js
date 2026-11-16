// Every game over LAN, seen only from player 2 (the joiner): the host switches game, the joiner presses keys for a few
// seconds in each, and we collect page errors / console errors / warnings per game plus whether snapshots kept coming.
//   node lan_all_joiner.js            (SECS=8 per game; ONLY=mix,snake limits the list)
const { spawn } = require('child_process'); const path = require('path'); const { chromium } = require('playwright');
const PORT = 8091, SECS = Number(process.env.SECS || 7), ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' }); srv.unref();
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch(); let cur = 'setup'; const log = {};
  const add = (tag, t) => { (log[cur] = log[cur] || new Set()).add(tag + ' ' + t.slice(0, 220)); };
  const mk = async (tag) => { const p = await b.newPage({ viewport: { width: 1100, height: 650 } });
    p.on('pageerror', e => add(tag + ' PAGEERROR:', e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') add(tag + ' ' + m.type() + ':', m.text()); });
    await p.addInitScript(init); await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1200); return p; };
  const H = await mk('host'), J = await mk('joiner');
  await H.evaluate(() => { Hub.close(); GameModes.launch('survival'); }); await H.waitForTimeout(600);
  await H.evaluate(() => Net.connect('host', 'Host')); await H.waitForTimeout(500);
  await J.evaluate(() => Net.connect('client', 'Player2')); await J.waitForTimeout(3000);
  const modes = (await H.evaluate(() => GameModes.list.map(m => m.id))).filter(m => !ONLY.length || ONLY.includes(m));
  const rows = [];
  for (const m of modes) {
    cur = m;
    const s0 = await J.evaluate(() => Net.snapCount);
    await H.evaluate((m) => { Hub.close(); GameModes.launch(m); }, m); await J.waitForTimeout(1500);
    const t0 = Date.now(); let i = 0;
    while (Date.now() - t0 < SECS * 1000) { i++;
      await J.keyboard.down(['KeyD', 'KeyW', 'KeyA', 'KeyS'][i % 4]); await J.mouse.move(300 + (i * 111) % 500, 200 + (i * 71) % 300); await J.mouse.down(); await J.waitForTimeout(220); await J.mouse.up(); await J.keyboard.up(['KeyD', 'KeyW', 'KeyA', 'KeyS'][i % 4]);
      await J.keyboard.press('Space'); await J.keyboard.press('KeyE'); if (i % 4 === 0) { await J.keyboard.press('Escape'); await J.waitForTimeout(200); await J.keyboard.press('Escape'); } }
    const st = await J.evaluate(() => ({ mode: GameModes.current && GameModes.current.id, inGame: Net.inGame, snaps: Net.snapCount, age: Math.round(performance.now() - Net.lastSnapAt), fps: measuredFPS, lost: Net.lost }));
    rows.push({ game: m, joinerMode: st.mode, snaps: st.snaps - s0, ageMs: st.age, fps: st.fps, errors: (log[m] ? log[m].size : 0) });
  }
  console.table(rows);
  let bad = 0; for (const k in log) { console.log('== ' + k + ' (' + log[k].size + ')'); [...log[k]].slice(0, 6).forEach(l => console.log('   ' + l)); bad += log[k].size; }
  const stuck = rows.filter(r => r.joinerMode !== r.game || r.snaps < 20);
  console.log(bad || stuck.length ? 'FAIL: ' + bad + ' distinct errors/warnings; not following: ' + stuck.map(r => r.game).join(',') : 'PASS');
  await b.close(); process.exit(bad || stuck.length ? 1 : 0);
})();
