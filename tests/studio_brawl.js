// Level Studio + Brawl: Skybridge opens as pieces + spawns; a new stage play-tests as a real Brawl match (falling
// off loses a stock) and joins Brawl's stage rotation after saving.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('brawl', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(800);
  const out = {};
  await ev(() => { Studio.open('brawl_skybridge'); Studio.hideStart(); });
  await p.waitForTimeout(400);
  out.loaded = await ev(() => Studio.doc.mode + ', ' + Studio.doc.ents.filter(e => e.cat === 'bspawn').length + ' spawns, ' + Studio.doc.ents.filter(e => e.cat === 'layout').length + ' pieces');
  // a new stage: one main stage, two floating platforms, two spawns
  await ev(() => {
    Studio.doc = { name: 'My Arena', mode: 'brawl', waves: false, ents: [
      { cat: 'layout', type: 'box', name: 'Main Stage', x: 0, y: -100, w: 1800, h: 360, color: '#4a5568', texture: 'castle_stone', kind: 'block' },
      { cat: 'layout', type: 'box', name: 'Platform', x: -600, y: 400, w: 500, h: 60, color: '#b84a27', texture: 'brick', kind: 'platform' },
      { cat: 'layout', type: 'box', name: 'Platform', x: 600, y: 400, w: 500, h: 60, color: '#b84a27', texture: 'brick', kind: 'platform' },
      { cat: 'bspawn', x: -500, y: 160 }, { cat: 'bspawn', x: 500, y: 160 } ] };
    Studio.withIds(Studio.doc); Studio.rebuild(); Studio.renderAll(); Studio.save();
  });
  out.def = await ev(() => { const d = Studio.docToDef(Studio.doc); return JSON.stringify({ isBrawl: d.isBrawl, top: d.stageTopY, blast: d.blast, spawns: d.brawlSpawns }); });
  await ev(() => Studio.playtest()); await p.waitForTimeout(4200);
  out.playing = await ev(() => ({ mode: GameModes.current.id, active: brawl.active, phase: brawl.phase, fighters: characters.map(c => c.playerLabel + '@' + Math.round(c.x)), stage: brawl.stage && brawl.stage.key }));
  // knock P1 off the side: a stock is lost
  const s0 = await ev(() => redGuy.stocks);
  await ev(() => { redGuy.x = brawl.stage.maxX + 50; }); await p.waitForTimeout(400);
  out.stockLost = [s0, await ev(() => redGuy.stocks)];
  await ev(() => { Studio.endPlaytest(); Studio.close(); }); await p.waitForTimeout(600);
  out.stageList = await ev(() => { const seen = []; for (let i = 0; i < 6; i++) { cycleBrawlStage(1); seen.push(brawlCfg.stage); } return seen.join(' > '); });
  console.log(JSON.stringify(out, null, 1), errs.slice(0, 3));
  await b.close();
})();
