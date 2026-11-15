// Blob Arena settings (Cheats panel -> Game tab): CPU blob count changes live, decay off / brutal / grows with size,
// spawn shield, power-up pickups, set-size cheat. The game loop is paused and stepped by hand so numbers are exact.
const { open } = require('./lib'); const path = require('path');
(async () => {
  const { b, p, errs } = await open('cells', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a); const out = {};
  const row = (label, v) => ev(([l, x]) => { const r = GameTuning.rows().find(r => r.label === l); r.set(x); return r.get(); }, [label, v]);
  await ev(() => { localStorage.removeItem('timsBlobArenaCfg'); paused = true; });
  out.rows = await ev(() => GameTuning.rows().map(r => r.label).join(' | '));
  // CPU blobs, live
  const cpus = () => ev(() => { for (let i = 0; i < 31; i++) Cells.step(); return Cells.players.filter(p => p.human === undefined).length; });
  await row('CPU blobs', 5); out.bots5 = await cpus(); await row('CPU blobs', 25); out.bots25 = await cpus();
  // decay: one human blob of 2000, no food nearby eaten into the sum (compare the same 200 ticks under each setting)
  const decay = (rate, grow) => ev(([r, g]) => { cellsCfg.decay = r; cellsCfg.decayGrow = g; cellsCfg.bots = 0; Cells.syncBots(); const h = Cells.locals()[0]; Cells.blobs = [{ pl: h, x: 0, y: 0, m: 2000, vx: 0, vy: 0, mergeT: 0 }]; h.alive = true; Cells.pellets = []; const food = cellsCfg.food; cellsCfg.food = 0;
    for (let i = 0; i < 200; i++) { Cells.step(); } cellsCfg.food = food; return Math.round(Cells.blobs[0].m); }, [rate, grow]);
  out.decay = { off: await decay(0, false), slow: await decay(0.00015, false), brutal: await decay(0.0025, false), brutalGrowing: await decay(0.0025, true) };
  // spawn shield: a fresh human under a huge CPU blob
  const eaten = (secs) => ev((s) => { cellsCfg.shield = s; cellsCfg.bots = 1; Cells.players = Cells.players.filter(p => p.human !== undefined); Cells.blobs = []; Cells.syncBots(); const h = Cells.locals()[0], foe = Cells.players.find(p => p.human === undefined);
    Cells.spawn(h); const hb = Cells.mine(h)[0]; Cells.blobs = [hb, { pl: foe, x: hb.x, y: hb.y, m: 900, vx: 0, vy: 0, mergeT: 0 }]; foe.alive = true; foe.fx = null;
    for (let i = 0; i < 60; i++) { Cells.step(); const f = Cells.blobs.find(q => q.pl === foe); if (f) { f.x = hb.x; f.y = hb.y; } } return !h.alive; }, secs);
  out.shield = { with3s: (await eaten(3)) ? 'EATEN' : 'safe', with0s: (await eaten(0)) ? 'eaten' : 'SAFE' };
  // power-up pickup
  out.pickup = await ev(() => { cellsCfg.bots = 0; Cells.syncBots(); const h = Cells.locals()[0]; Cells.spawn(h); const hb = Cells.mine(h)[0]; Cells.blobs = [hb]; Cells.pickups = [{ x: hb.x, y: hb.y, kind: 'magnet' }, { x: hb.x, y: hb.y, kind: 'mass' }]; const m0 = hb.m; Cells.step(); Cells.step(); return 'magnet ' + (h.fx.magnet > 0) + ', mass +' + Math.round(hb.m - m0) + ', left on map ' + Cells.pickups.length; });
  out.setSize = await row('Set human size now', 5000);
  await ev(() => { cellsCfg.bots = 14; cellsCfg.decay = 0.00015; cellsCfg.decayGrow = false; cellsCfg.shield = 3; saveCellsCfg(); Cells.reset(); paused = false; SummonManager.togglePanel(); });
  await p.waitForTimeout(900); await p.screenshot({ path: path.join(__dirname, 'shots', 'blob_settings.png') });
  console.log(JSON.stringify(out, null, 1)); console.log(errs);
  const d = out.decay;
  const ok = out.bots5 === 5 && out.bots25 === 25 && d.off === 2000 && d.slow < 2000 && d.slow > 1900 && d.brutal < 1300 && d.brutalGrowing < d.brutal - 150 && out.shield.with3s === 'safe' && out.shield.with0s === 'eaten'
    && /magnet true, mass \+6\d, left on map 0/.test(out.pickup) && out.setSize >= 4900 && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
