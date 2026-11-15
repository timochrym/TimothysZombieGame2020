const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('words', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => LevelManager.selectLevel('words_6')); await p.waitForTimeout(800);
  await ev(() => { WordLab.make('fly'); redGuy.x = 380; });
  await p.keyboard.down('Space');
  const tr = [];
  for (let i = 0; i < 60; i++) { await p.waitForTimeout(50); const h = await ev(() => Math.round(redGuy.y - redGuy.s2 / 2)); tr.push(h); if (h > 1460) break; }
  await p.keyboard.down('KeyD'); await p.waitForTimeout(500); await p.keyboard.up('Space'); await p.waitForTimeout(1200); await p.keyboard.up('KeyD');
  console.log('climb', tr.join(','), 'end', await ev(() => [Gadgets.starsGot + '/' + Gadgets.starsTotal, Math.round(redGuy.x), Math.round(redGuy.y - redGuy.s2 / 2), WordLab.done]), errs.slice(0, 2));
  await b.close();
})();
