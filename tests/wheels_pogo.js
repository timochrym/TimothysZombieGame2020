// Wobble Wheels pogo: W held for ~5 s on Hill Hop - prints the foot's x/y every 0.2 s (x should climb into the
// thousands, y should show hops above 11, the ground).
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('wheels', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { wheelsSave.vehicle = 'pogo'; Wheels.cpReached = -1; LevelManager.selectLevel(WHEELS_COURSES[0]); });
  await p.waitForTimeout(3600);
  const tr = [];
  await p.keyboard.down('KeyW');
  for (let i = 0; i < 24; i++) { await p.waitForTimeout(200); tr.push(await ev(() => { const r = Wheels.riders[0], q = r.pts[r.vbase]; return Math.round(q.x) + '/' + Math.round(q.y) + (r.crashed ? 'X' : ''); })); }
  await p.keyboard.up('KeyW');

  console.log(tr.join(' '), errs.slice(0, 3));
  await b.close();
})();
