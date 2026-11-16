// Arena Mix over LAN, seen ONLY from player 2 (the joiner). The host just starts Mix and waits. Everything checked
// here is read in the joiner's browser: errors, warnings, snapshots arriving, FPS, its own body answering the keys,
// the menu, the body switch, the ping. Runs about 70 seconds. Exits non-zero on any error.
//   node lan_mix_joiner.js            (SECONDS=120 node lan_mix_joiner.js for longer)
const { spawn } = require('child_process'); const path = require('path'); const { chromium } = require('playwright');
const PORT = 8093, SECONDS = Number(process.env.SECONDS || 66);
const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' }); srv.unref();
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch(); const joinerLog = [], hostLog = [];
  const mk = async (tag, log) => { const p = await b.newPage({ viewport: { width: 1100, height: 650 } });
    p.on('pageerror', e => log.push(tag + ' PAGEERROR: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.push(tag + ' console.' + m.type() + ': ' + m.text()); });
    await p.addInitScript(init); await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1200); return p; };
  const H = await mk('host', hostLog), J = await mk('joiner', joinerLog);
  await H.evaluate(() => { Hub.close(); GameModes.launch('mix'); }); await H.waitForTimeout(800);
  await H.evaluate(() => Net.connect('host', 'Host'));  await H.waitForTimeout(600);
  await H.evaluate(() => { window.__sz = []; const sd = Net.send; Net.send = function(o) { if (typeof o === 'string' && o.charCodeAt(2) === 116 && o.indexOf('"snap"') > 0 && o.indexOf('"hub"') < 0) window.__sz.push(o.length); return sd.apply(this, arguments); }; });
  await J.evaluate(() => Net.connect('client', 'Player2')); await J.waitForTimeout(3500);

  const out = { samples: [] };
  out.joined = await J.evaluate(() => ({ role: Net.role, inGame: Net.inGame, mode: GameModes.current && GameModes.current.id, snaps: Net.snapCount }));
  const sample = async (label) => J.evaluate((label) => { const me = (typeof Mix !== 'undefined' && Mix.me) ? Mix.me() : null;
    return { label, t: Math.round(performance.now() / 1000), fps: measuredFPS, snaps: Net.snapCount, ageMs: Math.round(performance.now() - Net.lastSnapAt), rtt: Math.round(Net.rtt || 0), inGame: Net.inGame, lost: Net.lost,
      body: typeof mixCfg !== 'undefined' ? mixCfg.body : null, me: me ? [Math.round(me.x || me.cx || (me.segs && me.segs[0].x) || 0), Math.round(me.y || me.cy || (me.segs && me.segs[0].y) || 0)] : null,
      tanks: typeof Tanks !== 'undefined' ? Tanks.tanks.length : -1, blobs: typeof Cells !== 'undefined' ? Cells.blobs.length : -1, worms: typeof Snake !== 'undefined' ? Snake.worms.length : -1 }; }, label);
  const key = async (k, ms) => { await J.keyboard.down(k); await J.waitForTimeout(ms); await J.keyboard.up(k); };
  const t0 = Date.now(); let step = 0;
  out.samples.push(await sample('start'));
  while ((Date.now() - t0) / 1000 < SECONDS) {
    step++;
    // player 2 plays: steer all round, shoot / split with the mouse, switch body, open and close the menu
    await key(['KeyW', 'KeyD', 'KeyS', 'KeyA'][step % 4], 700);
    await J.mouse.move(300 + (step * 97) % 500, 200 + (step * 53) % 300);
    await J.mouse.down(); await J.waitForTimeout(250); await J.mouse.up();
    await key('Space', 120);
    if (step % 7 === 0) { await J.keyboard.press('KeyQ'); }
    if (step % 9 === 0) { await J.keyboard.press('Escape'); await J.waitForTimeout(350); out.menuWhileLive = out.menuWhileLive || await J.evaluate(() => ({ drawerOpen: !!document.querySelector('#sb-ui-root .sb-glass'), netMenu: Net.menuOpen, paused })); await J.keyboard.press('Escape'); await J.waitForTimeout(250); }
    if (step % 5 === 0) out.samples.push(await sample('t+' + Math.round((Date.now() - t0) / 1000) + 's'));
  }
  out.end = await sample('end');
  await J.screenshot({ path: path.join(__dirname, 'shots', 'lan_mix_joiner.png') }).catch(() => {});
  out.sizes = await H.evaluate(() => { const a = window.__sz.slice().sort((x, y) => x - y), n = a.length; return { snaps: n, avg: Math.round(a.reduce((x, y) => x + y, 0) / n), p50: a[Math.floor(n * 0.5)], p95: a[Math.floor(n * 0.95)], max: a[n - 1], over16k: a.filter(v => v > 16000).length, kbPerSec: Math.round(a.reduce((x, y) => x + y, 0) / 1024 / ((n * 2) / 60)) }; });
  out.hostSide = await H.evaluate(() => ({ peers: Net.peerCount(), mode: GameModes.current.id, lastSnapBytes: Net.lastSnapBytes,
    lanBodies: [].concat(Tanks.tanks.filter(k => k.human === 'lan').map(k => 'tank@' + Math.round(k.x) + ',' + Math.round(k.y)), Cells.players.filter(c => c.human === 'lan').map(c => 'blob@' + Math.round(c.cx || 0) + ',' + Math.round(c.cy || 0)),
      Snake.worms.filter(w => w.human === 'lan').map(w => 'worm@' + (w.segs && w.segs[0] ? Math.round(w.segs[0].x) + ',' + Math.round(w.segs[0].y) : '?'))) }));
  out.moved = (() => { const pts = out.samples.map(s => s.me).filter(Boolean); let d = 0; for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return { points: pts.length, totalTravel: Math.round(d) }; })();

  const fps = out.samples.map(s => s.fps).filter(x => x > 0), minFps = Math.min(...fps), avgFps = Math.round(fps.reduce((a, c) => a + c, 0) / fps.length);
  const maxAge = Math.max(...out.samples.map(s => s.ageMs));
  const summary = { seconds: SECONDS, samples: out.samples.length, minFps, avgFps, maxSnapAgeMs: maxAge, snapsReceived: out.end.snaps - out.samples[0].snaps, rtt: out.end.rtt, bodies: [...new Set(out.samples.map(s => s.body))], everLost: out.samples.some(s => s.lost) };
  console.log(JSON.stringify({ joined: out.joined, menuWhileLive: out.menuWhileLive, summary, moved: out.moved, packetSizes: out.sizes, hostSide: out.hostSide, firstSamples: out.samples.slice(0, 6).map(x => [x.label, x.body, x.me, x.tanks + 't/' + x.blobs + 'b/' + x.worms + 'w']) }, null, 1));
  console.log('JOINER errors/warnings (' + joinerLog.length + '):'); [...new Set(joinerLog)].slice(0, 25).forEach(l => console.log('  ' + l.slice(0, 260)));
  console.log('HOST errors/warnings (' + hostLog.length + '):'); [...new Set(hostLog)].slice(0, 10).forEach(l => console.log('  ' + l.slice(0, 260)));
  const ok = out.joined.inGame && out.joined.mode === 'mix' && !joinerLog.length && !hostLog.length && summary.snapsReceived > SECONDS * 8 && maxAge < 1500 && !summary.everLost && minFps >= 20 && out.moved.totalTravel > 200;
  console.log(ok ? 'PASS' : 'FAIL');
  await b.close(); process.exit(ok ? 0 : 1);
})();
