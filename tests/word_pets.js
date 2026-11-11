const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('words', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => LevelManager.selectLevel('words_0')); await p.waitForTimeout(800);
  await ev(() => { Components.getMouseWorldPos = () => [redGuy.x + 150, redGuy.y + 40]; WordLab.make('dog'); WordLab.make('bird'); WordLab.make('cat'); });
  await p.waitForTimeout(500);
  const d0 = await ev(() => movingObjects.filter(o => o.pet).map(o => o.pet.kind + '@' + Math.round(o.x)).join(' '));
  // walk right for 2.5 s: pets should follow
  await p.keyboard.down('KeyD'); await p.waitForTimeout(2500); await p.keyboard.up('KeyD'); await p.waitForTimeout(800);
  const after = await ev(() => ({ hero: Math.round(redGuy.x), pets: movingObjects.filter(o => o.pet).map(o => o.pet.kind + ' gap ' + Math.round(Math.abs(o.x - redGuy.x)) + ' y ' + Math.round(o.y - redGuy.y)) }));

  // a zombie near the dog: it should bite
  const bite = await ev(() => { const dog = movingObjects.find(o => o.pet && o.pet.kind === 'dog'); const z = spawnZombie('NORMAL', dog.x + 200, dog.y + 40); z.x = dog.x + 200; z.y = dog.y + 20; window.__z = z; return z.health; });
  await p.waitForTimeout(2500);
  console.log('spawned', d0, JSON.stringify(after), 'zombie hp', bite, '->', await ev(() => Math.round(__z.health) + (__z.dead ? ' (dead)' : '')), errs.slice(0, 3));
  await b.close();
})();
