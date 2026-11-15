const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('brawl', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { brawlCfg.stage = 'brawl_battlefield'; GameModes.launch('brawl'); });
  await p.waitForTimeout(3800);
  await ev(() => { brawl.dropN = 2; brawl.itemTimer = 1; });      // next drop is the bat
  await p.waitForTimeout(1500);
  const bat = await ev(() => (brawl.bats || []).map(B => [Math.round(B.x), Math.round(B.y)]));
  // walk P1 onto it
  const got = await ev(() => { const B = brawl.bats[0]; B.x = redGuy.x + 30; B.y = brawl.stage.topY; B.vy = 0; return true; });
  const held = await ev(() => redGuy.brBat);
  // put the CPU right in front and swing
  await ev(() => { const c = characters.find(c => c !== redGuy && !c.eliminated); window.__c = c; c.x = redGuy.x + 110; c.y = redGuy.y; c.xspeed = c.yspeed = 0; c.damagePct = 0; c.shielding = false; c.invulnTimer = 0; c.dashTimer = 0; redGuy.lastFacing = 1; window.__x0 = c.x; });
  await ev(() => { const c = __c; c.x = redGuy.x + 110; c.y = redGuy.y; c.xspeed = c.yspeed = 0; window.__x0 = c.x; redGuy.abilityPressed = true; brawlBats(); redGuy.abilityPressed = false; });
  await p.waitForTimeout(500);

  console.log('bat dropped at', JSON.stringify(bat), 'held swings', held, 'after swing', await ev(() => [redGuy.brBat, Math.round(__c.damagePct), Math.round(__c.x - __x0)]), errs.slice(0, 3));
  await b.close();
})();
