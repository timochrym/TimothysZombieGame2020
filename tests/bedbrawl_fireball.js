const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('bedwars', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(1500);
  const r = await ev(() => {
    // a wall of placed blocks in front of P1, then fire
    const before = staticObjects.length;
    for (let i = 0; i < 4; i++) { const bx = Object.addBox(redGuy.x + 500, redGuy.y - 20 + i * 80, 80, 80, '#a16207', { name: 'Wood', kind: 'block' }); bx.buildHP = 40; bx.buildMaxHP = 40; }
    rebuildAllObjects(); if (typeof StaticGrid !== 'undefined') StaticGrid.build();
    redGuy.degree = 90; redGuy.bwIron = 30;
    const item = BW_SHOP.find(i => i.id === 'fireball');
    const ok = bwBuy(redGuy, item);
    window.__boom = []; const ob = Components.blowUp; Components.blowUp = function(x, y) { __boom.push([Math.round(x), Math.round(y)]); return ob.apply(this, arguments); };
    return { ok, iron: redGuy.bwIron, wallBefore: staticObjects.length - before, heroX: Math.round(redGuy.x), fire: (() => { const f = movingObjects.find(o => o.bwFire); return f && [Math.round(f.x), Math.round(f.y), f.xspeed]; })() };
  });
  const track = [];
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(80); track.push(await ev(() => { const f = movingObjects.find(o => o.bwFire && !o.dead); return f ? Math.round(f.x) + ',' + Math.round(f.y) : 'gone'; })); }
  console.log(JSON.stringify(r), track.join(' '), 'boom', await ev(() => JSON.stringify(__boom)), 'wall blocks left', await ev(() => staticObjects.filter(o => o.name === 'Wood' && !o.dead).length + '/4'), errs.slice(0, 3));
  await b.close();
})();
