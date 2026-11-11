const { open } = require('./lib');
(async () => {
  // 1. Zombie Ball: the ball is a real zombie ragdoll and the players are full characters with ragdoll physics
  let { b, p, errs } = await open('sport', { w: 1100, h: 650 });
  let ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(3500);
  console.log('Zombie Ball:', JSON.stringify(await ev(() => ({ ballStyle: sportCfg.ball, ragdollBall: !!(Ball.body && Ragdolls.list.indexOf(Ball.body) !== -1), ballPoints: Ball.body ? Ball.body.pts.length : 0,
      players: characters.map(c => c.playerLabel + (c.isCPU ? '(CPU)' : '')), playersRagdollCapable: characters.every(c => typeof c.startRagdoll === 'function') }))));
  await ev(() => { const c = characters[0]; c.ragdollImmune = 0; c.startRagdoll(12, 10, 60); });
  await p.waitForTimeout(300);
  console.log('  P1 tackled into a ragdoll:', await ev(() => !!characters[0].liveRagdoll), errs.slice(0, 2));
  await b.close();
  // 2. Players panel: per-seat Human / CPU / Off toggles in Party Board
  ({ b, p, errs } = await open('party', { w: 1100, h: 650 })); ev = (f, a) => p.evaluate(f, a);
  await ev(() => PlayersUI.open()); await p.waitForTimeout(300);
  console.log('Players panel seats:', await ev(() => [...document.querySelectorAll('#players-panel button')].map(b => b.textContent.trim()).filter(t => /Human|CPU|Off/.test(t)).slice(0, 12).join(' | ')), errs.slice(0, 2));
  await p.screenshot({ path: 'ev_players.png' });
  await b.close();
})();
