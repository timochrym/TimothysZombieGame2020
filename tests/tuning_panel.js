// Cheats & tuning, Game tab: per game it shows that game's own settings and hides the shared rows that don't apply;
// a setting changed in the panel (Wobble Wheels engine power) reaches the game.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('survival', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { SummonManager.togglePanel(); document.querySelector('.dp-tab[data-tab="game"]').click(); });
  await p.waitForTimeout(400);
  const state = () => ev(() => ({ mode: GameModes.current.id, own: [...document.querySelectorAll('#dp-own-rows .dp-row label, #dp-own-rows .dp-toggle span:last-child')].map(e => e.textContent), ownShown: document.getElementById('dp-own').style.display !== 'none',
      shownToggles: [...document.querySelectorAll('[data-page="game"] .dp-toggles .dp-toggle')].filter(e => e.style.display !== 'none').length, note: document.getElementById('dp-hidden-note').textContent }));
  const out = {};
  out.survival = await state();
  for (const m of ['brawl', 'table', 'wheels', 'bedwars']) { await ev((m) => { GameModes.launch(m); }, m); await p.waitForTimeout(900); out[m] = await state(); }
  // change a setting through the panel: Wobble Wheels engine power
  await ev(() => GameModes.launch('wheels')); await p.waitForTimeout(800);
  const changed = await ev(() => { const el = document.querySelector('#dp-own-rows [data-own="0"]'); el.value = 2; el.dispatchEvent(new Event('input')); return Wheels.powerMult; });
  console.log(JSON.stringify(out, null, 1), 'wheels engine power set via panel:', changed, errs.slice(0, 3));
  await b.close();
})();
