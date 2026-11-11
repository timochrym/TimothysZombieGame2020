const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('table', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { tableCfg.game = 'arty'; tableCfg.vs = 'cpu'; tableCfg.level = 3; Arty.reset(0); });
  await p.waitForTimeout(300);

  const log = [];
  for (let shot = 0; shot < 30; shot++) {
    const st = await ev(() => ({ turn: Arty.turn, over: Arty.over, hp: Arty.tank.map(t => t.hp), shell: !!Arty.shell }));
    if (st.over) break;
    if (st.turn === 0 && !st.shell) {
      // P1 aims by the same search the CPU uses, a bit worse (keys would do the same)
      await ev(() => { const keep = tableCfg.level; tableCfg.level = 2; Arty.cpuMove(); tableCfg.level = keep; });
    }
    await p.waitForTimeout(1500);
    log.push((await ev(() => Arty.tank.map(t => t.hp).join('/'))));
  }

  console.log(log.join(' '), 'over', await ev(() => [Arty.over, Arty.win]), errs.slice(0, 3));
  await b.close();
})();
