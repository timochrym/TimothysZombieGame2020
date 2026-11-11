// Word Lab water: "big water" fills from the ground to just above the pointer; a crate floats to the surface; holding
// W swims the hero up to it.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('words', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => LevelManager.selectLevel('words_0')); await p.waitForTimeout(800);
  // a big pool right on the hero, plus a crate dropped into it
  await ev(() => { Components.getMouseWorldPos = () => [redGuy.x + 100, 160]; WordLab.make('big water'); WK2.crate(redGuy.x + 150, 60, { s: 1 }); });
  const W = await ev(() => { const w = WordLab.waters[0]; return [w.x, Math.round(w.y), w.w, w.h, Math.round(w.y + w.h / 2)]; });
  await p.waitForTimeout(1500);
  const crate = await ev(() => { const o = movingObjects[movingObjects.length - 1]; return Math.round(o.y); });
  // swim up: hold W for 1.5 s
  const y0 = await ev(() => Math.round(redGuy.y));
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); await p.keyboard.up('KeyW');
  const y1 = await ev(() => [Math.round(redGuy.y), redGuy.swimming]);

  console.log('water [x,y,w,h,surface]', W, 'crate floated to y', crate, 'hero y', y0, '->', y1, errs.slice(0, 3));
  await b.close();
})();
