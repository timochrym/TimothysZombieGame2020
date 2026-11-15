const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('bedwars', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(1500);
  const r = await ev(() => {
    const before = staticObjects.filter(o => o.name === 'Built Bridge').length;
    // face toward the middle (P1's island is on the left: x < 0 -> throw right)
    redGuy.degree = 90; redGuy.lastFacing = 1; redGuy.bwIron = 25;
    const ok = bwBuy(redGuy, BW_SHOP.find(i => i.id === 'egg'));
    return { ok, iron: redGuy.bwIron, heroX: Math.round(redGuy.x), feet: Math.round(redGuy.y - redGuy.s2 / 2), before };
  });
  await p.waitForTimeout(2500);
  const blocks = await ev(() => staticObjects.filter(o => o.name === 'Built Bridge').map(o => [Math.round(o.x), Math.round(o.y + o.h / 2)]));
  // walk along it: hold D for 3 s and check the hero is still on top (not fallen into the void)
  await p.keyboard.down('KeyD'); await p.waitForTimeout(2500); await p.keyboard.up('KeyD');
  const hero = await ev(() => [Math.round(redGuy.x), Math.round(redGuy.y - redGuy.s2 / 2), redGuy.dead]);

  console.log(JSON.stringify(r), 'blocks', blocks.length, 'first/last', JSON.stringify([blocks[0], blocks[blocks.length - 1]]), 'hero after walking', hero, errs.slice(0, 3));
  await b.close();
})();
