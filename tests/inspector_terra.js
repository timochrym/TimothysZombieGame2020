// Inspect tab + Terra: an Edit-mode click picks the tile under the hero; the inspector changes it to brick and digs it out.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('terra', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(1500);
  await ev(() => { if (!SummonManager.isOpen) SummonManager.togglePanel(); SummonManager.setToolMode('select'); });
  // a tile just under the hero's feet
  const r = await ev(() => { const wx = redGuy.x, wy = redGuy.y - redGuy.s2 / 2 - 20; const c = terraCol(wx), rr = terraRow(wy); const before = TILES[terraGet(c, rr)][0];
    mouseX = wsx(wx); mouseY = wsy(wy); SummonManager.handleCanvasMouseDown({ button: 0 });
    const title = document.querySelector('#sp-game-card .dp-title span').textContent;
    const sel = document.querySelector('#sp-game-card [data-gc="0"]'); sel.value = String(TILE_ID.brick); sel.dispatchEvent(new Event('change'));
    const after = TILES[terraGet(c, rr)][0];
    document.querySelector('#sp-game-card [data-gca="0"]').click();
    return { before, title, after, dug: TILES[terraGet(c, rr)][0] }; });
  console.log(JSON.stringify(r), errs.slice(0, 3));
  await b.close();
})();
