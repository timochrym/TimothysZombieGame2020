// Level Studio + Ragdoll Siege / Word Lab: a built-in fort opens with its zombies and ammo and play-tests with edited
// ammo; a new Word Lab room with a task, par and star play-tests and can be cleared.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('siege', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(800);
  const out = {};
  // Siege: open fort 2, check zombies + ammo came across, play-test it
  await ev(() => { Studio.open('siege_1'); Studio.hideStart(); });
  await p.waitForTimeout(400);
  out.siegeDoc = await ev(() => Studio.doc.mode + ', ' + Studio.doc.ents.filter(e => e.cat === 'enemy').length + ' zombies, ammo "' + Studio.doc.ammo + '"');
  out.siegeInspector = await ev(() => !!document.getElementById('std-ammo'));
  await ev(() => { Studio.doc.ammo = 'bomb, heavy'; Studio.doc.name = 'My Fort'; Studio.save(); Studio.playtest(); });
  await p.waitForTimeout(2500);
  out.siegePlay = await ev(() => ({ mode: GameModes.current.id, zombies: zombies.length, ammo: (Siege.shots || []).join(',') }));
  await ev(() => { Studio.endPlaytest(); });
  // Word Lab: a new room with a star and a task
  await ev(() => {
    Studio.doc = Studio.newDoc(); Studio.doc.mode = 'words'; Studio.doc.name = 'My Room'; Studio.doc.task = 'Get up to the star with one word!'; Studio.doc.par = 1;
    Studio.doc.ents.push({ cat: 'gadget', type: 'star', x: 600, y: 700 }); Studio.withIds(Studio.doc); Studio.rebuild(); Studio.renderAll(); Studio.save(); Studio.playtest();
  });
  await p.waitForTimeout(1200);
  out.wordsPlay = await ev(() => ({ mode: GameModes.current.id, stars: Gadgets.starsTotal, msg: WordLab.msg, par: LevelManager.getCurrentLevel().par }));
  await ev(() => { WordLab.make('fly'); redGuy.x = 600; redGuy.y = 700; });
  await p.waitForTimeout(800);
  out.wordsWon = await ev(() => [Gadgets.starsGot, WordLab.done]);
  console.log(JSON.stringify(out, null, 1), errs.slice(0, 3));
  await b.close();
})();
