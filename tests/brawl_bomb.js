const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('brawl', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(3800);
  await ev(() => { brawl.dropN = 1; brawl.itemTimer = 1; }); await p.waitForTimeout(1500);
  const dropped = await ev(() => movingObjects.filter(o => o.name === 'Bomb').length + ' bomb(s) dropped by the timer');
  const r = await ev(() => {
    redGuy.dead = false; redGuy.x = brawl.stage.centerX - 200; redGuy.y = brawl.stage.topY + 60;
    const o = Object.addCrate(redGuy.x + 60, redGuy.y, 54, '#1f2937', { explosive: true, name: 'Bomb' }); o.brawlBomb = brawl.tick; rebuildAllObjects();
    const cpu = characters.find(c => c !== redGuy && !c.eliminated); window.__cpu = cpu;
    redGuy.dead = false; redGuy.x = o.x - 60; redGuy.y = o.y + 10; redGuy.xspeed = redGuy.yspeed = 0; redGuy.damagePct = 0;
    cpu.x = redGuy.x + 420; cpu.y = redGuy.y; cpu.xspeed = cpu.yspeed = 0; cpu.damagePct = 0; cpu.shielding = false; cpu.isCPU = false; cpu.input = cpu.input || {};
    window.__boom = []; const ob = Components.blowUp; Components.blowUp = function(x, y) { __boom.push([Math.round(x), Math.round(y)]); return ob.apply(this, arguments); };
    redGuy.tryGrabOrThrow(o.x, o.y);
    return !!(redGuy.heldObject && redGuy.heldObject.name === 'Bomb');
  });
  const scr = await ev(() => [wsx(__cpu.x), wsy(__cpu.y + 80)]);
  await p.mouse.move(scr[0], scr[1]); await p.waitForTimeout(250);
  await ev(() => { __cpu.x = redGuy.x + 420; __cpu.y = redGuy.y; redGuy.tryGrabOrThrow(__cpu.x, __cpu.y + 60); });
  await p.waitForTimeout(1200);
  console.log(dropped, 'grabbed', r, 'boom at', await ev(() => JSON.stringify(__boom)), 'P1 x', await ev(() => Math.round(redGuy.x)), 'P1 %', await ev(() => Math.round(redGuy.damagePct)), 'CPU %', await ev(() => Math.round(__cpu.damagePct)), errs.slice(0, 3));
  await b.close();
})();
