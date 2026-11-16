// For every game: after player 2 has played a few seconds, compare what the HOST holds with what the JOINER holds, list by list
// (level pieces, crates, enemies, heroes, bullets, pickups, gadgets, ragdolls ...). A difference = something drawn on one screen only.
const { spawn } = require('child_process'); const path = require('path'); const { chromium } = require('playwright');
const PORT = 8088, ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' }); srv.unref();
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch();
  const mk = async () => { const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); await p.addInitScript(init); await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1200); return p; };
  const H = await mk(), J = await mk();
  await H.evaluate(() => { Hub.close(); GameModes.launch('survival'); }); await H.waitForTimeout(500);
  await H.evaluate(() => Net.connect('host', 'Host')); await H.waitForTimeout(500);
  await J.evaluate(() => Net.connect('client', 'P2')); await J.waitForTimeout(3000);
  const lists = () => { const L = (n, f) => { try { return f(); } catch (e) { return -1; } }; const alive = a => a.filter(o => o && !o.dead).length;
    return { statics: L('s', () => alive(staticObjects)), crates: L('m', () => alive(movingObjects)), heroes: L('c', () => alive(characters)), enemies: L('z', () => alive(zombies)), bullets: L('l', () => lazers.length),
      powerups: L('p', () => powerUps.length), coins: L('o', () => coinOrbs.length), chests: L('t', () => (typeof treasureChests !== 'undefined' ? treasureChests.length : 0)), gadgets: L('g', () => (typeof Gadgets !== 'undefined' ? Gadgets.list.length : 0)),
      ragdolls: L('r', () => (typeof Ragdolls !== 'undefined' ? Ragdolls.list.length : 0)), particles: L('x', () => particles.length) }; };
  const modes = (await H.evaluate(() => GameModes.list.filter(m => !(m.flags && m.flags.ownScreen)).map(m => m.id))).filter(m => !ONLY.length || ONLY.includes(m));
  const bad = [];
  for (const m of modes) {
    await H.evaluate((m) => { Hub.close(); GameModes.launch(m); }, m); await J.waitForTimeout(1500);
    for (let i = 0; i < 8; i++) { await J.keyboard.down(['KeyD', 'KeyW', 'KeyA', 'KeyS'][i % 4]); await J.mouse.down(); await J.waitForTimeout(350); await J.mouse.up(); await J.keyboard.up(['KeyD', 'KeyW', 'KeyA', 'KeyS'][i % 4]); }
    await J.keyboard.press('KeyE'); await J.waitForTimeout(900);
    const [h, j] = await Promise.all([H.evaluate(`(${lists})()`), J.evaluate(`(${lists})()`)]);
    const diff = {}; for (const k in h) if (k !== 'particles' && h[k] !== j[k]) diff[k] = h[k] + ' vs ' + j[k] + ' (host vs joiner)';
    console.log(m.padEnd(9), Object.keys(diff).length ? 'DIFF ' + JSON.stringify(diff) : 'same lists ' + JSON.stringify({ statics: h.statics, crates: h.crates, enemies: h.enemies, gadgets: h.gadgets }));
    if (Object.keys(diff).length) bad.push(m);
  }
  console.log(bad.length ? 'DIFFERENCES in: ' + bad.join(', ') : 'PASS: no differences'); await b.close(); process.exit(0);
})();
