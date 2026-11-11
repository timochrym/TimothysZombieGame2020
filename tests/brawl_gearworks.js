const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('brawl', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { brawlCfg.stage = 'brawl_gearworks'; brawlCfg.opp = '2cpu'; saveBrawlCfg && saveBrawlCfg(); GameModes.launch('brawl'); });
  await p.waitForTimeout(4000);
  const info = await ev(() => ({ lvl: LevelManager.currentLevelKey, movers: Gadgets.list.filter(g => g.type === 'mover').length, statics: staticObjects.map(o => o.name).join(','), fighters: characters.map(c => c.playerLabel).join(',') }));
  const m0 = await ev(() => { const g = Gadgets.list.find(g => g.type === 'mover'); return g && Math.round(g.obj.x); });
  // let the CPUs fight for 12 s
  await p.waitForTimeout(12000);
  const m1 = await ev(() => { const g = Gadgets.list.find(g => g.type === 'mover'); return g && Math.round(g.obj.x); });

  console.log(JSON.stringify(info), 'lift x', m0, '->', m1, 'state', await ev(() => JSON.stringify({ phase: brawl.phase, stocks: characters.map(c => c.playerLabel + ':' + c.stocks + ' ' + Math.round(c.damagePct) + '%') })), errs.slice(0, 3));
  await b.close();
})();
