// Level Studio + Wobble Wheels: a built-in course opens with its traps as pieces; a new course (mines, checkpoint,
// finish) play-tests as a real Wobble Wheels run and appears in the game's course select after saving.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('wheels', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(800);
  const out = {};
  // 1. a built-in course opens in the Studio with its traps as pieces
  await ev(() => { Studio.open('wheels_1'); Studio.hideStart(); });
  await p.waitForTimeout(500);
  out.loadedTrapNo = await ev(() => Studio.doc.ents.filter(e => e.cat === 'wtrap').length + ' traps, finish ' + (Studio.doc.ents.find(e => e.cat === 'wfinish') || {}).x + ', mode ' + Studio.doc.mode);
  out.paletteHasWheels = await ev(() => [...document.querySelectorAll('#studio-left h4')].map(h => h.textContent).join(' / '));
  // 2. make a new course: ground, 2 mines, a checkpoint, a finish; save; play-test it
  await ev(() => {
    Studio.doc = Studio.newDoc(); Studio.doc.mode = 'wheels'; Studio.doc.name = 'My Wheels Course';
    const E = Studio.doc.ents;
    E.push({ cat: 'layout', type: 'box', name: 'Ground', x: 2000, y: -800, w: 6000, h: 1600, color: '#5d8a3a', texture: 'grass_dirt', kind: 'block' });
    E.push({ cat: 'wtrap', kind: 'mine', x: 900, y: 0 }, { cat: 'wtrap', kind: 'mine', x: 1500, y: 0 }, { cat: 'gadget', type: 'checkpoint', x: 1200, y: 0 }, { cat: 'wfinish', x: 3000, y: 0 });
    Studio.withIds(Studio.doc); Studio.rebuild(); Studio.renderAll(); Studio.save();
  });
  await p.waitForTimeout(300);
  out.def = await ev(() => { const d = Studio.docToDef(Studio.doc); return JSON.stringify({ traps: d.traps, finishX: d.finishX, cps: d.cps, mode: d.mode }); });

  await ev(() => Studio.playtest()); await p.waitForTimeout(3600);
  out.playing = await ev(() => ({ mode: GameModes.current.id, riders: Wheels.riders.length, mines: Wheels.mines.length, finishX: Wheels.finishX, cps: Wheels.cps }));
  // 3. the saved course shows up in Wobble Wheels' course select
  await ev(() => { Studio.endPlaytest(); Studio.close(); });
  await p.waitForTimeout(800);
  await ev(() => { GameModes.launch('wheels'); }); await p.waitForTimeout(600);
  await ev(() => { openPause(false); pauseActivate('wh_select', 0); }); await p.waitForTimeout(200);
  out.courseSelect = await ev(() => [...document.querySelectorAll('#course-select .t')].map(e => e.textContent).join(', '));
  console.log(JSON.stringify(out, null, 1), errs.slice(0, 3));
  await b.close();
})();
