// Arena Mix size caps: (1) food is DRAWN with a capped radius (small food unchanged; a 5000-mass lump is 14 world units, not 350);
// (2) tank bullets stop growing at radius 20 and the mass damage boost stops at x1.6; plain Tank Arena is unchanged.
const { open } = require('./lib'); const path = require('path');
(async () => {
  const { b, p, errs } = await open('mix', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a); const out = {};
  await ev(() => { SNK.CPUS = 0; TNK.CPUS = 0; cellsCfg.bots = 0; SNK.PELLETS = 0; Mix.reset(); Mix.setBody('tank'); });
  await p.waitForTimeout(500);
  // ---- (1a) the size functions
  out.food = await ev(() => ({ cells: [1, 5, 12, 100, 5000, 1e6].map(m => +Cells.pelletR(m).toFixed(1)).join(' '), worm: [1, 4, 25, 100, 5000].map(v => +Snake.pelletR(v).toFixed(1)).join(' ') }));
  // ---- (1b) a real drawn frame: the circle radius that reaches the canvas for a huge lump
  out.drawn = await ev(() => {
    paused = true; Tanks.tanks = Tanks.tanks.slice(0, 1); Cells.players = []; Cells.blobs = []; Cells.viruses = []; Cells.pickups = []; Snake.worms = []; Snake.pellets = []; Cells.pellets = [];
    const me = Tanks.tanks[0]; me.x = 0; me.y = 0; Mix.cam.x = 0; Mix.cam.y = 0;
    Cells.pellets.push({ x: 0, y: 0, m: 5000, col: '#010203', vx: 0, vy: 0 }, { x: 300, y: 0, m: 1, col: '#040506', vx: 0, vy: 0 }, { x: -300, y: 0, m: 12, col: '#070809', vx: 0, vy: 0 });
    Snake.pellets.push({ x: 0, y: 300, v: 200, col: '#0a0b0c', ph: 0 });
    const seen = {}, orig = CanvasRenderingContext2D.prototype.arc, fs = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');
    CanvasRenderingContext2D.prototype.arc = function(x, y, r) { const c = String(this.fillStyle); if (r < 200 && /^#0[0-9a-c]0[0-9a-c]0[0-9a-c]$/.test(c)) seen[c] = Math.max(seen[c] || 0, r); /* r < 200: skip the arena rings, which are drawn while an old fill colour is still set */ return orig.apply(this, arguments); };
    try { Mix.draw(); } finally { CanvasRenderingContext2D.prototype.arc = orig; }
    const Z = Mix.cam.z; const wr = (c) => seen[c] === undefined ? null : +(seen[c] / Z).toFixed(1);
    return { zoom: +Z.toFixed(2), hugeCellsFood: wr('#010203'), smallCellsFood: wr('#040506'), mediumCellsFood: wr('#070809'), wormGlob: wr('#0a0b0c') };
  });
  await p.screenshot({ path: path.join(__dirname, 'shots', 'mix_size_caps.png') });
  // ---- (2) bullets by tank mass in Arena Mix
  out.bullets = await ev(() => {
    const k = Tanks.tanks[0]; const row = (m) => { k.mixMass = m; k.mixPeak = m; k.reloadT = 0; Tanks.bullets = []; Tanks.fire(k); const bu = Tanks.bullets[0]; return { mass: m, r: +bu.r.toFixed(1), dmg: +bu.dmg.toFixed(1), reload: +Tanks.reload(k).toFixed(1) }; };
    return [36, 144, 400, 2000, 20000].map(row);
  });
  // ---- plain Tank Arena is unchanged: no mix layer, the old formulas
  out.plain = await ev(() => {
    Tanks.mixLayer = false; const k = Tanks.tanks[0]; k.mixMass = 20000; k.lvl = 1; k.cls = 'basic'; k.reloadT = 0; Tanks.bullets = []; Tanks.fire(k); const a = Tanks.bullets[0];
    k.lvl = 45; k.reloadT = 0; Tanks.bullets = []; Tanks.fire(k); const b2 = Tanks.bullets[0]; Tanks.mixLayer = true;
    return { lvl1: { r: +a.r.toFixed(1), dmg: +a.dmg.toFixed(1) }, lvl45: { r: +b2.r.toFixed(1), dmg: +b2.dmg.toFixed(1) } };
  });
  console.log(JSON.stringify(out, null, 1)); console.log(errs);
  const bl = out.bullets, d = out.drawn;
  const ok = out.food.cells === '4 8.9 11.1 14 14 14' && out.food.worm === '4.4 5.6 9.2 11 11'
    && d.hugeCellsFood <= 14.5 && d.hugeCellsFood >= 13 && d.smallCellsFood >= 3.5 && d.smallCellsFood <= 4.5 && d.mediumCellsFood >= 10.5 && d.mediumCellsFood <= 11.5 && d.wormGlob <= 11 * 2.1 * 1.13 && d.wormGlob >= 15      /* the drawn halo is 2.1 x the glob and pulses by 12% */
    && bl[0].r === 9 && bl[0].dmg === 5.5 && bl[1].r === 18 && bl[1].dmg === 8.8 && bl.slice(2).every(x => x.r === 20 && x.dmg === 8.8) && bl[4].reload > bl[0].reload
    && Math.abs(out.plain.lvl1.r - 9 * (30.45 / 30)) < 0.06 && out.plain.lvl1.dmg === 5.5 && Math.abs(out.plain.lvl45.r - 9 * (50.25 / 30)) < 0.06 && out.plain.lvl45.dmg === 5.5 && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
