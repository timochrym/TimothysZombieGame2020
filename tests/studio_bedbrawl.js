// Level Studio + Bed Brawl: Sky Islands opens with its beds / generators / shop rows as pieces; moving the red bed and
// spawn play-tests with them in the new places.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('bedwars', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(800);
  const out = {};
  await ev(() => { Studio.open('bedwars_sky'); Studio.hideStart(); }); await p.waitForTimeout(400);
  out.opened = await ev(() => Studio.doc.mode + ', ' + Studio.doc.ents.filter(e => e.cat === 'bw').map(e => e.kind + (e.team !== undefined ? e.team : '')).join(' '));
  // move the red bed inward and the red spawn, then play-test
  await ev(() => { const bed = Studio.doc.ents.find(e => e.cat === 'bw' && e.kind === 'bed' && e.team === 0); bed.x = -2000; const sp = Studio.doc.ents.find(e => e.cat === 'spawn' && e.player === 1); if (sp) sp.x = -2700; Studio.doc.name = 'Moved Beds'; Studio.save(); Studio.playtest(); });
  await p.waitForTimeout(800);
  out.playing = await ev(() => ({ mode: GameModes.current.id, redBedX: Math.round(BW.beds[0].x), blueBedX: Math.round(BW.beds[1].x), gens: BW.gens.map(g => g.x), p1: Math.round(redGuy.x), shops: BW.shops[0].length }));

  console.log(JSON.stringify(out, null, 1), errs.slice(0, 3));
  await b.close();
})();
