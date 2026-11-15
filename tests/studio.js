const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('survival', { w: 1400, h: 820 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.keyboard.press('KeyB'); await p.waitForTimeout(300); await p.click('#ss-new'); await p.waitForTimeout(200);
  const s0 = await ev(() => ({ open: Studio.isOpen, frozen: simFrozen, ents: Studio.doc.ents.length, statics: staticObjects.length }));
  await p.screenshot({ path: 'studio_0.png' });
  // pick "Block" from palette and place two
  await p.click('#studio-left button.pi[data-i="0"]');
  await p.mouse.click(700, 500); await p.mouse.click(900, 380);
  // stairs
  await p.click('#studio-left button.pi[data-i="6"]'); await p.mouse.click(600, 600);
  await p.keyboard.press('Escape');
  const s1 = await ev(() => ({ ents: Studio.doc.ents.length, sel: Studio.sel.length, statics: staticObjects.length, undo: Studio.undoStack.length }));
  // select by clicking the placed block, move it with drag
  const pos = await ev(() => { const e = Studio.doc.ents.find(e => e.name === 'Block'); return { sx: wsx(e.x), sy: wsy(e.y), x: e.x, y: e.y }; });
  await p.mouse.move(pos.sx, pos.sy); await p.mouse.down(); await p.mouse.move(pos.sx + 120, pos.sy - 40, { steps: 5 }); await p.mouse.up();
  const moved = await ev((o) => { const e = Studio.sel[0]; return { name: e && e.name, dx: e.x - o.x, dy: e.y - o.y }; }, pos);
  // inspector edit: width
  await p.fill('#sti-w', '800'); await p.press('#sti-w', 'Enter');
  const w = await ev(() => Studio.sel[0].w);
  // undo twice, redo once
  await p.keyboard.press('Control+z'); const wu = await ev(() => Studio.sel[0] && Studio.sel[0].w);
  await p.keyboard.press('Control+y'); const wr = await ev(() => Studio.sel[0] && Studio.sel[0].w);
  // duplicate + delete
  await p.keyboard.press('Control+d'); const nd = await ev(() => Studio.doc.ents.length);
  await p.keyboard.press('Delete'); const ndel = await ev(() => Studio.doc.ents.length);
  // add an enemy and an exit
  const enemyIdx = await ev(() => Studio.paletteRefs.findIndex(p => p[2].cat === 'enemy'));
  await p.click('#studio-left button.pi[data-i="' + enemyIdx + '"]'); await p.mouse.click(1000, 470);
  const exitIdx = await ev(() => Studio.paletteRefs.findIndex(p => p[2].type === 'exit'));
  await p.click('#studio-left button.pi[data-i="' + exitIdx + '"]'); await p.mouse.click(500, 470);
  await p.keyboard.press('Escape');
  await p.screenshot({ path: 'studio_1.png' });
  const s2 = await ev(() => ({ ents: Studio.doc.ents.length, zombies: zombies.length, gadgets: Gadgets.list.length }));
  // save
  await ev(() => { Studio.doc.name = 'Test Level'; }); await p.keyboard.press('Control+s');
  const saved = await ev(() => ({ studio: __O.keys(Studio.savedAll()), custom: __O.keys(LevelManager.customLevels) }));
  // play-test
  const docBefore = await ev(() => JSON.stringify(Studio.doc));
  await p.click('#st-play'); await p.waitForTimeout(1200);
  const pt = await ev(() => ({ testing: Studio.playtesting, open: Studio.isOpen, lvl: LevelManager.currentLevelKey, heroes: characters.length, zombies: zombies.length, frozen: simFrozen }));
  await p.screenshot({ path: 'studio_play.png' });
  console.log(JSON.stringify({ s0, s1, moved, w, wu, wr, nd, ndel, s2, saved, pt })); console.log(await ev(() => JSON.stringify(Studio.doc.ents.filter(e => e.cat !== 'layout' || e.name === 'Block'))), await ev(() => JSON.stringify(Gadgets.list.map(g => g.type)))); console.log(errs);
  // walk the hero into the exit
  await ev(() => { const g = Gadgets.list.find(g => g.type === 'exit'); redGuy.x = g.x; redGuy.y = g.y + 60; });
  await p.waitForTimeout(600);
  const back = await ev((before) => ({ testing: Studio.playtesting, open: Studio.isOpen, same: JSON.stringify(Studio.doc) === before, toast: Studio.toast }), docBefore);
  // close studio -> back to a playable level
  await p.keyboard.press('KeyB'); await p.waitForTimeout(600);
  const closed = await ev(() => ({ open: Studio.isOpen, frozen: simFrozen, lvl: LevelManager.currentLevelKey, heroes: characters.length }));
  console.log(JSON.stringify({ s0, s1, moved, w, wu, wr, nd, ndel, s2, saved, pt, back, closed }, null, 1));
  console.log(errs.slice(0, 8));
  await b.close();
})();
