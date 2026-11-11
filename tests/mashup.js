// Mash-up (mashup.js): in Parkour Rush, mix in zombie waves, building, word magic (Y), a pet and the jetpack through the
// panel; Y + "big crate" makes a crate, C builds; the shared CPU skill reaches every game; full-screen games untouched.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('race', { w: 1280, h: 720 });     // Parkour Rush: no waves, no jetpack, no building by default
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(800);
  await ev(() => { localStorage.removeItem('timsMashup'); Mashup.mix = {}; SummonManager.togglePanel(); DevUI.switchTab('game'); });
  await p.waitForTimeout(400);
  const out = {};
  out.defaults = await ev(() => ['waves', 'building', 'jetpack', 'words', 'pet'].map(id => id + ':' + Mashup.isOn(id)).join(' '));
  out.panelRows = await ev(() => document.querySelectorAll('#dp-mash-rows [data-mash]').length);
  // mix Survival waves, building, word magic and a pet into Parkour Rush through the panel's selects
  await ev(() => { ['waves', 'building', 'words', 'pet', 'jetpack'].forEach(id => { const el = document.querySelector('[data-mash="' + id + '"]'); el.value = 'on'; el.dispatchEvent(new Event('change')); }); });
  await p.waitForTimeout(3000);
  out.mixed = await ev(() => ({ mode: GameModes.current.id, wavesFlag: GameModes.flag('waves', true), zombies: zombies.length, buildFlag: GameModes.flag('building', false), jetpack: jetpackEnabled, pet: movingObjects.filter(o => o.pet).length }));
  // word magic in Parkour: T opens the box, "crate" makes a crate
  await ev(() => SummonManager.togglePanel());
  await p.keyboard.press('KeyY'); await p.waitForTimeout(150);
  out.boxOpen = await ev(() => WordLab.open);
  await p.keyboard.type('big crate'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  out.made = await ev(() => movingObjects.filter(o => o.name === 'Crate').length + ' crate(s), msg "' + WordLab.msg + '"');
  // build mode toggles with C now
  await p.keyboard.press('KeyC'); await p.waitForTimeout(100);
  out.buildMode = await ev(() => !!(redGuy && redGuy.buildMode));

  // shared CPU skill reaches every game's config
  await ev(() => SHARED_TUNABLES[0].set(3));
  out.cpu = await ev(() => [brawlCfg.cpuLevel, sportCfg.level, tableCfg.level]);
  // full-screen games are left alone, and "default" puts things back
  await ev(() => GameModes.launch('table')); await p.waitForTimeout(500);
  out.tableUntouched = await ev(() => [Mashup.world(), GameModes.flag('waves', true)]);
  await ev(() => { MASHUP_MIX.forEach(m => Mashup.set(m[0], 'default')); GameModes.launch('race'); }); await p.waitForTimeout(800);
  out.reset = await ev(() => [GameModes.flag('waves', true), GameModes.flag('building', false), localStorage.getItem('timsMashup')]);
  console.log(JSON.stringify(out, null, 1), errs.slice(0, 3));
  await b.close();
})();
