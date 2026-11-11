// Table Games, Sway Darts: a full 5-round match vs the normal CPU; P1 holds Space ~0.5 s and lets go each dart.
// Prints P1's dart scores (should vary, not all 25 / 50) and the final result.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('table', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { tableCfg.game = 'darts'; tableCfg.vs = 'cpu'; tableCfg.level = 2; Darts.reset(0); });
  await p.waitForTimeout(300);
  const mine = [];
  for (let i = 0; i < 90; i++) {
    const st = await ev(() => [Darts.over, Darts.turn, Darts.wait]);
    if (st[0]) break;
    if (st[1] === 0 && st[2] <= 0) {
      // hold Space ~0.5 s (steady), release
      await p.keyboard.down('Space'); await p.waitForTimeout(500); await p.keyboard.up('Space');
      await p.waitForTimeout(80); mine.push(await ev(() => Darts.flash && Darts.flash.v));
      await p.waitForTimeout(450);
    } else await p.waitForTimeout(400);
  }

  console.log('my darts', mine.join(','), 'final', await ev(() => JSON.stringify({ over: Darts.over, score: Darts.score, round: Darts.round, win: Darts.win })), errs.slice(0, 3));
  await b.close();
})();
