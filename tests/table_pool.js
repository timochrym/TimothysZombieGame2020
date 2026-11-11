// Table Games, Pocket Race: P1 breaks with a real mouse drag, then a match vs the hard CPU plays to the end (~1.5 min).
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('table', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { tableCfg.game = 'pool'; tableCfg.vs = 'cpu'; tableCfg.level = 3; Pool.reset(0); });
  await p.waitForTimeout(300);
  // P1 breaks with the mouse: press on the white ball, drag back (left), release
  const c = await ev(() => Pool.toScreen(Pool.cue.x, Pool.cue.y));
  await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.move(c[0] - 200, c[1], { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(200);
  const broke = await ev(() => Pool.phase);

  // let the match play out: P1 uses the CPU logic at "normal" for its own shots
  for (let i = 0; i < 220; i++) {
    const st = await ev(() => [Pool.phase, Pool.turn]);
    if (st[0] === 'over') break;
    if (st[0] === 'aim' && st[1] === 0) await ev(() => { const k = tableCfg.level; tableCfg.level = 2; Pool.cpu(); tableCfg.level = k; });
    await p.waitForTimeout(700);
  }

  console.log('break phase', broke, 'final', await ev(() => JSON.stringify({ phase: Pool.phase, score: Pool.score, left: Pool.balls.filter(b => !b.gone).length, win: Pool.win })), errs.slice(0, 3));
  await b.close();
})();
