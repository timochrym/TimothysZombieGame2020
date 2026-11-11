const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('sport', { w: 1280, h: 800 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(600);
  await p.click('#coop-btn'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'players_sport.png' });
  const before = await ev(() => PlayersUI.summary());
  await p.click('#players-panel .lu[data-i="2"]'); await p.waitForTimeout(600);
  const after = await ev(() => ({ summary: PlayersUI.summary(), fmt: sportCfg.format, chars: characters.map(c => c.playerLabel + (c.isCPU ? '(cpu)' : '') + ':' + c.fighterTeam) }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // survival: solo -> coop via the panel
  await ev(() => { Hub.close(); GameModes.launch('survival'); }); await p.waitForTimeout(600);
  await p.click('#coop-btn'); await p.waitForTimeout(200);
  await p.click('#players-panel .lu[data-i="1"]'); await p.waitForTimeout(500);
  const surv = await ev(() => ({ mp: multiplayer, summary: PlayersUI.summary(), btn: document.getElementById('coop-btn').textContent }));
  await p.screenshot({ path: 'players_surv.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
  await p.screenshot({ path: 'players_badge.png' });
  // brawl
  await ev(() => { Hub.close(); GameModes.launch('brawl'); }); await p.waitForTimeout(600);
  await p.click('#coop-btn'); await p.waitForTimeout(200);
  await p.click('#players-panel .lu[data-i="2"]'); await p.waitForTimeout(500);
  const br = await ev(() => ({ opp: brawlCfg.opponents, summary: PlayersUI.summary() }));
  console.log(JSON.stringify({ before, after, surv, br })); console.log(errs.slice(0, 5)); await b.close();
})();
