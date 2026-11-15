const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open(null);
  // fake gamepads: navigator.getGamepads returns objects we control
  await p.evaluate(() => {
    window.__pads = [0, 1, 2].map((i) => ({ index: i, connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }));
    Reflect.defineProperty(Navigator.prototype, 'getGamepads', { value: () => window.__pads, configurable: true, writable: true });
    window.__press = async (pad, btn, ms) => { __pads[pad].buttons[btn].pressed = true; await new Promise(r => setTimeout(r, ms || 80)); __pads[pad].buttons[btn].pressed = false; await new Promise(r => setTimeout(r, 60)); };
  });
  const ev = (f, a) => p.evaluate(f, a);
  // hub: pad navigates + A picks
  await ev(() => Hub.openHub(false)); await p.waitForTimeout(200);
  const hub0 = await ev(() => Hub.idx);
  await ev(async () => { await __press(0, 15); await __press(0, 15); });
  const hub1 = await ev(() => Hub.idx);
  await ev(async () => { Hub.idx = Hub.games().findIndex(g => g.id === 'brawl'); await __press(0, 0); });
  await p.waitForTimeout(800);
  const brawlState = await ev(() => ({ mode: GameModes.current.id, hubOpen: Hub.isOpen, chars: characters.map(c => c.playerLabel + (c.isCPU ? '(cpu)' : '') + (c.padIdx !== undefined ? '[pad' + c.padIdx + ']' : '')) }));
  // pad 3 (index 2) should have claimed a CPU; drive it right
  await p.waitForTimeout(3500); const claimed = await ev(async () => { const c = Pads.charFor(2); if (!c) return null; const x0 = c.x; __pads[2].axes[0] = 1; await new Promise(r => setTimeout(r, 900)); __pads[2].axes[0] = 0; return { label: c.playerLabel, moved: Math.round(c.x - x0) }; });
  // survival: build mode with Select, place with RT, punch with LT
  await ev(() => { Hub.close(); GameModes.launch('survival'); }); await p.waitForTimeout(800);
  const build = await ev(async () => { zombiesRemainingToSpawn = 0; await __press(0, 8); const on = redGuy.buildMode; await __press(0, 5); const piece = redGuy.buildPiece; redGuy.buildAimX = redGuy.x + 200; redGuy.buildAimY = redGuy.y; const w0 = Build.mats(redGuy).wood; useMouseAim = false; redGuy.degree = 90; __pads[0].buttons[7].pressed = true; await new Promise(r => setTimeout(r, 200)); __pads[0].buttons[7].pressed = false; await new Promise(r => setTimeout(r, 100)); const placed = w0 - Build.mats(redGuy).wood; await __press(0, 8); return { on, piece, placed, off: !redGuy.buildMode }; });
  const punch = await ev(async () => { const z = spawnZombie('NORMAL', redGuy.x + 90, redGuy.y + 10); z.health = 200; await new Promise(r => setTimeout(r, 200)); z.x = redGuy.x + 90; z.y = redGuy.y; redGuy.lastFacing = 1; const h0 = z.health; await __press(0, 6); return Math.round(h0 - z.health); });
  // pause with Start, B closes
  const pause = await ev(async () => { await __press(0, 9); const a = paused; await __press(0, 1); return { opened: a, closed: !paused }; });
  console.log(JSON.stringify({ hub0, hub1, brawlState, claimed, build, punch, pause })); console.log(errs.slice(0, 5)); await b.close();
})();
