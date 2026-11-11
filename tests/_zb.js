const { spawn } = require('child_process'); const path = require('path'); const { chromium } = require('playwright');
const PORT = 8093;
const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' }); srv.unref();
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch();
  const mk = async (t) => { const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => console.log('ERR', t, e.message)); p.on('console', m => { if (m.type() === 'warning') console.log('WARN', t, m.text().slice(0, 200)); }); await p.addInitScript(init); await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1200); return p; };
  const H = await mk('host'), C = await mk('joiner');
  for (const style of ['classic', 'flail']) {
    await H.evaluate((st) => { Hub.close(); sportCfg.style = st; GameModes.launch('sport'); }, style); await H.waitForTimeout(800);
    if (style === 'classic') { await H.evaluate(() => Net.connect('host', 'Tim')); await H.waitForTimeout(500); await C.evaluate(() => Net.connect('client', 'Bob')); }
    await C.waitForTimeout(6000);
    const info = () => H.evaluate(() => ({ phase: Sport.phase, fmt: sportCfg.format, style: sportCfg.style, chars: characters.map(c => [c.playerLabel, c.isRemote ? 'LAN' : (c.isCPU ? 'cpu' : 'local'), Math.round(c.x), Math.round(c.y), c.fighterTeam]), men: typeof Flail !== 'undefined' ? Flail.men.length : 0 }));
    const a = await info();
    await C.keyboard.down('KeyD'); await C.waitForTimeout(1000); await C.keyboard.up('KeyD');
    await C.keyboard.down('KeyW'); await C.waitForTimeout(400); await C.keyboard.up('KeyW'); await C.waitForTimeout(300);
    const b2 = await info();
    console.log(style, '\n before', JSON.stringify(a), '\n after ', JSON.stringify(b2.chars), '\n joiner:', JSON.stringify(await C.evaluate(() => ({ mode: GameModes.current && GameModes.current.id, me: Net.myChar() && [Net.myChar().playerLabel, Math.round(Net.myChar().x)], local: Net.predictOn, chars: characters.length, ball: typeof Ball !== 'undefined' && [Math.round(Ball.x), Math.round(Ball.y)] }))));
  }
  await b.close(); process.exit(0);
})();
