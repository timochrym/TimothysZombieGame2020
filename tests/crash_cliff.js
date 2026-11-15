const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('dummy', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(500);
  // the pause-menu scenario row cycles Sandbox -> Stair Drop -> Cliff Fall
  const order = [];
  for (let i = 0; i < 3; i++) { await ev(() => { openPause(false); pauseActivate('dm_scn', 1); }); await p.waitForTimeout(700); order.push(await ev(() => LevelManager.currentLevelKey)); }
  await ev(() => LevelManager.selectLevel('crash_cliff')); await p.waitForTimeout(800);
  const start = await ev(() => [Math.round(Dummy.rd.centerX()), Math.round(Dummy.rd.centerY()), Dummy.run]);
  await ev(() => GameModes.current.onClick(Dummy.rd.centerX() + 500, Dummy.rd.centerY() + 150, 0));
  await p.waitForTimeout(2000);
  for (let i = 0; i < 20; i++) { await p.waitForTimeout(500); if (await ev(() => Dummy.run !== 'go')) break; }
  console.log('menu order', order.join(' > '), 'start', start, 'result', await ev(() => [Dummy.run, Math.round(Dummy.total), Dummy.bones, dummyScnBest(), Math.round(Dummy.rd.centerY())]), errs.slice(0, 3));
  await b.close();
})();
