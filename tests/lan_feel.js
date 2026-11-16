// How a LAN game FEELS from player 2: (1) does the joiner see every object the host has inside the joiner's own view?
// (2) how smooth is the motion on the joiner's screen (share of frames where moving things really move, longest freeze)?
// (3) how far behind the host's truth are moving things? Joiner-only measurements, host is the reference.
//   node lan_feel.js cells        (cells | snake | tanks | mix | survival | brawl)
const { spawn } = require('child_process'); const path = require('path'); const { chromium } = require('playwright');
const PORT = 8090, GAME = process.argv[2] || 'cells', SECS = Number(process.env.SECS || 8);
const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' }); srv.unref();
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch(); const errs = [];
  const mk = async (tag) => { const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => errs.push(tag + ': ' + e.message)); await p.addInitScript(init); await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1200); return p; };
  const H = await mk('host'), J = await mk('joiner');
  await H.evaluate((g) => { Hub.close(); GameModes.launch(g); }, GAME); await H.waitForTimeout(800);
  await H.evaluate(() => Net.connect('host', 'Host')); await H.waitForTimeout(500);
  await J.evaluate(() => Net.connect('client', 'P2')); await J.waitForTimeout(4000);
  // joiner keeps moving; a recorder runs on every animation frame on BOTH pages
  const rec = (key) => `(() => { window.__r = []; const t0 = performance.now(); const step = () => { window.__r.push([performance.now() - t0, ${key}()]); if (performance.now() - t0 < ${SECS * 1000}) requestAnimationFrame(step); }; requestAnimationFrame(step); })()`;
  // a snapshot of "things": [id,x,y] for moving entities, plus counts, in whatever lists the game keeps
  const things = `() => { const o = { m: {}, n: {} }; const add = (k, id, x, y) => { o.m[k + id] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10]; };
    if (typeof Cells !== 'undefined' && GameModes.current.id !== 'snake') { Cells.blobs.forEach(bb => add('b', bb.id, bb.x, bb.y)); o.n.pellets = Cells.pellets.length; }
    if (typeof Tanks !== 'undefined' && GameModes.current.id !== 'cells') { Tanks.tanks.forEach((k, i) => add('t', k.pid || k.name || i, k.x, k.y)); o.n.bullets = Tanks.bullets.length; o.n.shapes = Tanks.shapes.length; }
    if (typeof Snake !== 'undefined' && (GameModes.current.id === 'snake' || GameModes.current.id === 'mix')) { Snake.worms.forEach(w => { if (w.segs && w.segs[0]) add('w', w.id, w.segs[0].x, w.segs[0].y); }); }
    if (['survival','brawl'].includes(GameModes.current.id)) { zombies.forEach(z => add('z', z._nid || z.id, z.x, z.y)); characters.forEach(c => add('c', c._nid || c.id, c.x, c.y)); o.n.crates = movingObjects.length; }
    return o; }`;
  await J.evaluate(`window.__things = ${things}; ` + rec('window.__things'));
  await H.evaluate(`window.__things = ${things}; ` + rec('window.__things'));
  const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < SECS * 1000) { i++; const k = ['KeyD', 'KeyS', 'KeyA', 'KeyW'][(i >> 1) % 4]; await J.keyboard.down(k); await J.mouse.move(200 + (i * 130) % 700, 150 + (i * 90) % 350); await J.waitForTimeout(300); await J.keyboard.up(k); }
  await J.waitForTimeout(300);
  const [jr, hr] = await Promise.all([J.evaluate(() => window.__r), H.evaluate(() => window.__r)]);
  // (2) smoothness on the joiner: for each tracked thing, per-frame displacement; "moving" = host moved it, joiner frames where it did not move at all
  const ids = Object.keys(jr[Math.floor(jr.length / 2)][1].m).filter(k => hr.length && hr[Math.floor(hr.length / 2)][1].m[k]);
  let still = 0, tot = 0, worstFreeze = 0; const lagPx = [];
  const hostAt = (k, tMs) => { for (let n = hr.length - 1; n >= 0; n--) if (hr[n][0] <= tMs) return hr[n][1].m[k]; return null; };
  ids.forEach(k => { let freeze = 0; let hostSpeedSum = 0;
    for (let n = 1; n < jr.length; n++) { const a = jr[n - 1][1].m[k], c = jr[n][1].m[k]; if (!a || !c) continue; const hm = hostAt(k, jr[n][0]), hp = hostAt(k, jr[n - 1][0]); const hostMoved = hm && hp && Math.hypot(hm[0] - hp[0], hm[1] - hp[1]) > 0.5;
      if (hostMoved) { tot++; if (Math.hypot(c[0] - a[0], c[1] - a[1]) < 0.05) { still++; freeze++; worstFreeze = Math.max(worstFreeze, freeze); } else freeze = 0; }
      if (n % 20 === 0 && hm) lagPx.push(Math.hypot(hm[0] - c[0], hm[1] - c[1])); } });
  lagPx.sort((x, y) => x - y);
  // (1) visibility: host entities that should be on the joiner's screen vs what the joiner holds
  const vis = await Promise.all([H.evaluate(`(${things})()`), J.evaluate(`(${things})()`)]);
  const miss = ids.length ? Object.keys(vis[0].m).filter(k => !vis[1].m[k]).length : 0;
  const cnt = {}; for (const k in vis[0].n) cnt[k] = { host: vis[0].n[k], joiner: vis[1].n[k] };
  console.log(JSON.stringify({ game: GAME, tracked: ids.length, framesMovingOnHost: tot, framesFrozenOnJoiner: still, frozenPct: tot ? Math.round(100 * still / tot) : null, longestFreezeFrames: worstFreeze,
    lagPx: { median: Math.round(lagPx[Math.floor(lagPx.length / 2)] || 0), p90: Math.round(lagPx[Math.floor(lagPx.length * 0.9)] || 0) }, hostEntitiesMissingOnJoiner: miss, counts: cnt, errors: errs.slice(0, 3) }, null, 1));
  await b.close(); process.exit(0);
})();
