// Inspect tab + game objects (inspect.js): Edit-mode clicks pick a Bed Brawl bed / generator, a Brawl fighter, a Wobble
// Wheels rider; their sliders and buttons change the game; Table Games shows a live match card; a Survival zombie still
// opens the old inspector.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('bedwars', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(1200);
  const clickAt = (wx, wy) => ev(([wx, wy]) => { mouseX = wsx(wx); mouseY = wsy(wy); SummonManager.handleCanvasMouseDown({ button: 0 }); }, [wx, wy]);
  await ev(() => { if (!SummonManager.isOpen) SummonManager.togglePanel(); SummonManager.setToolMode('select'); });
  const out = {};
  const card = () => ev(() => { const c = document.getElementById('sp-game-card'); return c.style.display !== 'none' ? c.innerText.split('\n').slice(0, 3).join(' | ') : null; });
  // Bed Brawl: the red bed
  const bed = await ev(() => [BW.beds[0].x, BW.beds[0].y]);
  await clickAt(bed[0], bed[1]); await p.waitForTimeout(100);
  out.bedCard = await card();
  out.bedHP = await ev(() => { const el = document.querySelector('#sp-game-card [data-gc="0"]'); el.value = 20; el.dispatchEvent(new Event('input')); return BW.beds[0].buildHP; });

  const gen = await ev(() => [BW.gens[0].x, BW.gens[0].y]);
  await clickAt(gen[0], gen[1]); await p.waitForTimeout(100); out.genCard = await card();
  // Brawl fighter
  await ev(() => GameModes.launch('brawl')); await p.waitForTimeout(3800);
  const f = await ev(() => [redGuy.x, redGuy.y]);
  await clickAt(f[0], f[1]); await p.waitForTimeout(100); out.brawlCard = await card();
  out.pct = await ev(() => { const el = document.querySelector('#sp-game-card [data-gc="0"]'); el.value = 150; el.dispatchEvent(new Event('input')); return redGuy.damagePct; });
  // Wobble Wheels rider
  await ev(() => GameModes.launch('wheels')); await p.waitForTimeout(1500);
  const r = await ev(() => { const q = Wheels.riders[0].pts[Wheels.riders[0].vbase + 2]; return [q.x, q.y]; });
  await clickAt(r[0], r[1]); await p.waitForTimeout(100); out.riderCard = await card();
  out.eject = await ev(() => { document.querySelector('#sp-game-card [data-gca="0"]').click(); return Wheels.riders[0].crashed; });
  // Table Games: match state on the Inspect tab
  await ev(() => GameModes.launch('table')); await p.waitForTimeout(800);
  await ev(() => DevUI.switchTab('inspect'));
  await p.waitForTimeout(700);
  out.match = await ev(() => document.getElementById('sp-match-state').innerText.replace(/\n/g, ' | '));
  // Survival: clicking a zombie still uses the old inspector
  await ev(() => GameModes.launch('survival')); await p.waitForTimeout(1500);
  await ev(() => { const z = spawnZombie('NORMAL', redGuy.x + 300, 60); z.x = redGuy.x + 300; mouseX = wsx(z.x); mouseY = wsy(z.y); SummonManager.handleCanvasMouseDown({ button: 0 }); });
  await p.waitForTimeout(100);
  out.zombieOld = await ev(() => [SummonManager.selectedObject && SummonManager.selectedObject.name, document.getElementById('sp-inspector').style.display]);
  console.log(JSON.stringify(out, null, 1), errs.slice(0, 3));
  await b.close();
})();
