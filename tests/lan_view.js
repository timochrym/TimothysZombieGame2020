// Parity inside player 2's own view: for pickups / shapes / bullets, count what the HOST has inside the rectangle the
// joiner is looking at, and what the JOINER has there. Sampled while the joiner moves. Missing = invisible objects.
const { spawn } = require('child_process'); const path = require('path'); const { chromium } = require('playwright');
const PORT = 8089, GAME = process.argv[2] || 'cells', SECS = Number(process.env.SECS || 8);
const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' }); srv.unref();
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch();
  const mk = async () => { const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); await p.addInitScript(init); await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1200); return p; };
  const H = await mk(), J = await mk();
  await H.evaluate((g) => { Hub.close(); GameModes.launch(g); }, GAME); await H.waitForTimeout(800);
  await H.evaluate(() => Net.connect('host', 'Host')); await H.waitForTimeout(500);
  await J.evaluate(() => Net.connect('client', 'P2')); await J.waitForTimeout(4000);
  // the joiner's view rectangle in world units (read on the joiner), then count items in it on both sides
  const view = () => J.evaluate(() => { const id = GameModes.current.id; let c = null;
    if (id === 'cells' || id === 'mix') c = Cells.cam && { x: Cells.cam.x, y: Cells.cam.y, hw: cssW / 2 / Cells.cam.z, hh: cssH / 2 / Cells.cam.z };
    if (!c || id === 'tanks') { const k = Tanks.tanks.find(q => q.pid === Net.pid) || Tanks.tanks.find(q => q.human === 'lan'); const cam = Tanks.cam || {}; c = { x: cam.x !== undefined ? cam.x : (k ? k.x : 0), y: cam.y !== undefined ? cam.y : (k ? k.y : 0), hw: (cssW / 2) / (cam.z || 1), hh: (cssH / 2) / (cam.z || 1) }; }
    return c; });
  const count = (v) => `(() => { const v = ${JSON.stringify(v)}; const inV = (x, y) => Math.abs(x - v.x) < v.hw && Math.abs(y - v.y) < v.hh; const o = {};
    if (typeof Cells !== 'undefined') o.pellets = Cells.pellets.filter(p => inV(p.x, p.y)).length;
    if (typeof Cells !== 'undefined') o.blobs = Cells.blobs.filter(p => inV(p.x, p.y)).length;
    if (typeof Cells !== 'undefined') o.viruses = Cells.viruses.filter(p => inV(p.x, p.y)).length;
    if (typeof Tanks !== 'undefined') { o.shapes = Tanks.shapes.filter(p => inV(p.x, p.y)).length; o.bullets = Tanks.bullets.filter(p => inV(p.x, p.y)).length; o.tanks = Tanks.tanks.filter(p => inV(p.x, p.y)).length; }
    return o; })()`;
  const rows = []; const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < SECS * 1000) { i++; const k = ['KeyD', 'KeyS', 'KeyA', 'KeyW'][(i >> 1) % 4]; await J.keyboard.down(k); await J.waitForTimeout(450);
    const v = await view(); const [h, j] = await Promise.all([H.evaluate(count(v)), J.evaluate(count(v))]); rows.push({ h, j }); await J.keyboard.up(k); }
  const sum = {}; rows.forEach(r => { for (const k in r.h) { sum[k] = sum[k] || { host: 0, joiner: 0, worstMissing: 0 }; sum[k].host += r.h[k]; sum[k].joiner += r.j[k]; sum[k].worstMissing = Math.max(sum[k].worstMissing, r.h[k] - r.j[k]); } });
  for (const k in sum) sum[k].joinerSeesPct = sum[k].host ? Math.round(100 * Math.min(sum[k].joiner, sum[k].host) / sum[k].host) : 100;
  console.log(GAME, 'samples', rows.length, JSON.stringify(sum)); await b.close(); process.exit(0);
})();
