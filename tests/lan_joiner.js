// LAN joiner bugs: (1) food the host drops in Blob Arena shows on the joiner's screen in its real colour,
// (2) Zombie Ball Flail style: the first joiner takes the blue team with one button and sees the flail players drawn,
// (3) a local P2 drops in on blue by pressing ↑. Exits non-zero on failure.
const { spawn } = require('child_process'); const path = require('path'); const { chromium } = require('playwright');
const PORT = 8092;
const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' }); srv.unref();
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch(); const errs = [];
  const mk = async (t) => { const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => errs.push(t + ': ' + e.message)); p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') errs.push(t + ' console: ' + m.text().slice(0, 160)); }); await p.addInitScript(init); await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1200); return p; };
  const H = await mk('host'), C = await mk('joiner'); const out = {};
  // ---- Blob Arena: the host drops food next to the joiner's blob
  await H.evaluate(() => { Hub.close(); GameModes.launch('cells'); }); await H.waitForTimeout(600);
  await H.evaluate(() => Net.connect('host', 'Tim')); await H.waitForTimeout(500);
  await C.evaluate(() => Net.connect('client', 'Bob')); await C.waitForTimeout(3000);
  out.food = await H.evaluate(() => { const me = Cells.players.find(p => p.human === 0), lan = Cells.players.find(p => p.human === 'lan');
    if (!me || !lan) return 'no players: ' + Cells.players.map(p => p.human).join(',');
    Cells.pellets.push({ x: lan.cx + 700, y: lan.cy + 500, m: 11, col: me.color, vx: 0, vy: 0 }); return me.color; });
  await C.waitForTimeout(700);
  out.joinerSeesFood = await C.evaluate(col => Cells.pellets.filter(p => p.m === 11 && p.col === col).length, out.food);
  out.joinerPellets = await C.evaluate(() => Cells.pellets.length);
  // blobs glide on the joiner's screen: count frames where the biggest moving blob's drawn position changed
  out.glide = await C.evaluate(() => new Promise(res => { let moved = 0, n = 0, last = null; const f = () => { const b2 = Cells.blobs.slice().sort((a, b) => Math.hypot(b.vx, b.vy) - Math.hypot(a.vx, a.vy))[0]; if (b2) { const k = b2.x.toFixed(2) + ',' + b2.y.toFixed(2); if (last !== null && k !== last) moved++; last = k; } if (++n < 60) requestAnimationFrame(f); else res(moved + '/59 frames'); }; requestAnimationFrame(f); }));
  // ---- Zombie Ball, Flail style
  await H.evaluate(() => { sportCfg.style = 'flail'; sportCfg.format = '1v1'; Flail.p2In = false; GameModes.launch('sport'); }); await C.waitForTimeout(6500);
  out.ctrl = await H.evaluate(() => Flail.controllers().map(c => c.kind + ':' + c.label + ':' + c.pids.length).join('  '));
  out.joinerDraws = await C.evaluate(() => { const men = Ragdolls.list.filter(r => r.flailTeam !== undefined); return men.length + ' men, custom look on ' + men.filter(m => m.drawFn === Flail.drawMan).length + ', labels ' + men.map(m => m.flailLabel).join('/'); });
  // the joiner holds its one button: blue's players jump, red's (P1 idle) stay down
  const tops = () => H.evaluate(() => [0, 1].map(t => Math.round(Math.max(...Flail.men.filter(m => m.flailTeam === t).map(m => m.pts[1].y)))));
  await H.evaluate(() => { Sport.phase = 'play'; }); const t0 = await tops(); let peak = [0, 0];
  await C.keyboard.down('KeyW');
  for (let i = 0; i < 12; i++) { await C.waitForTimeout(60); const t = await tops(); peak = [Math.max(peak[0], t[0] - t0[0]), Math.max(peak[1], t[1] - t0[1])]; }
  await C.keyboard.up('KeyW');
  out.jump = { redRose: peak[0], blueRose: peak[1] };
  await C.screenshot({ path: path.join(__dirname, 'shots', 'lan_flail_joiner.png') });
  // ---- local P2 drop-in (no LAN): ↑ takes blue from the CPU
  const L = await mk('local');
  await L.evaluate(() => { Hub.close(); sportCfg.style = 'flail'; sportCfg.format = '1v1'; Flail.p2In = false; GameModes.launch('sport'); }); await L.waitForTimeout(5500);
  const before = await L.evaluate(() => Flail.controllers()[1].kind);
  await L.keyboard.down('ArrowUp'); await L.waitForTimeout(300); await L.keyboard.up('ArrowUp');
  out.localP2 = before + ' -> ' + await L.evaluate(() => Flail.controllers()[1].kind + ' (labels ' + Flail.men.filter(m => m.flailTeam === 1).map(m => m.flailLabel).join('/') + ')');
  await L.evaluate(() => { Flail.p2In = false; sportCfg.style = 'classic'; });
  console.log(JSON.stringify(out, null, 1)); console.log(errs.slice(0, 8));
  const ok = out.joinerSeesFood >= 1 && out.joinerPellets > 50 && parseInt(out.glide) >= 50 && /lan:Bob:1/.test(out.ctrl) && /custom look on [3-9]/.test(out.joinerDraws) && out.jump.blueRose > 40 && out.jump.redRose < 25 && /^cpu -> p2/.test(out.localP2) && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
