const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('wheels', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  const res = {};
  for (const v of ['trolley', 'scooter']) {
    await ev((v) => { wheelsSave.vehicle = v; Wheels.cpReached = -1; LevelManager.selectLevel(WHEELS_COURSES[0]); }, v);
    await p.waitForTimeout(3600);
    await p.keyboard.down('KeyW');
    const kicks = [];
    for (let i = 0; i < 10; i++) { await p.waitForTimeout(500); if (v === 'scooter' && i % 3 === 0) { await p.keyboard.press('Space'); } }
    await p.keyboard.up('KeyW');
    res[v] = await ev(() => { const r = Wheels.riders[0], q = r.pts[r.vbase]; return { x: Math.round(q.x), crashed: !!r.crashed, upright: Math.abs(Math.atan2(r.pts[r.vbase + 1].y - q.y, r.pts[r.vbase + 1].x - q.x)) < 1 }; });

  }
  console.log(JSON.stringify(res), errs.slice(0, 3));
  await b.close();
})();
