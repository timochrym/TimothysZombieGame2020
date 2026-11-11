const { chromium } = require('playwright');
const PORT = global.PORT || 8099;
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  const b = await chromium.launch();
  const mk = async (tag) => { const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); const errs = []; p.on('pageerror', e => errs.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(tag + ' console: ' + m.text()); }); await p.addInitScript(init); await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1200); return { p, errs }; };
  const H = await mk('host'); const C = await mk('client'); const C2 = await mk('client2');
  await H.p.evaluate(() => { Hub.close(); GameModes.launch('survival'); });
  await H.p.waitForTimeout(800);
  await H.p.evaluate(() => { Net.connect('host', 'Tim'); });
  await H.p.waitForTimeout(500);
  await C.p.evaluate(() => { Net.connect('client', 'Bob'); });
  await C2.p.evaluate(() => { Net.connect('client', 'Ann'); });
  await C.p.waitForTimeout(2000);
  const st1 = await H.p.evaluate(() => ({ peers: Net.peerCount(), chars: characters.map(c => [c.playerLabel, Math.round(c.x), c.isRemote || false]), bytes: Net.lastSnapBytes }));
  const cs1 = await C.p.evaluate(() => ({ inGame: Net.inGame, chars: characters.length, zombies: zombies.length, statics: staticObjects.length, me: Net.myChar() && Net.myChar().playerLabel, mx: Net.myChar() && Math.round(Net.myChar().x) }));
  // client holds D for 1.2s
  await C.p.keyboard.down('KeyD'); await C.p.waitForTimeout(1200); await C.p.keyboard.up('KeyD');
  await C.p.waitForTimeout(400);
  const st2 = await H.p.evaluate(() => characters.filter(c => c.isRemote).map(c => [c.playerLabel, Math.round(c.x)]));
  const cs2 = await C.p.evaluate(() => Net.myChar() && Math.round(Net.myChar().x));
  // client shoots with the mouse
  await C.p.mouse.move(900, 300); await C.p.mouse.down(); await C.p.waitForTimeout(600);
  const lz = await H.p.evaluate(() => lazers.length); const lzc = await C.p.evaluate(() => lazers.length);
  await C.p.mouse.up();
  await C.p.screenshot({ path: 'lan_client.png' }); await H.p.screenshot({ path: 'lan_host.png' });
  console.log('host', JSON.stringify(st1), '\nclient', JSON.stringify(cs1), '\nafter D host', JSON.stringify(st2), 'client sees', cs2, '\nlazers host/client', lz, lzc);
  const fps = await C.p.evaluate(() => measuredFPS); console.log('client fps', fps);
  console.log([...H.errs, ...C.errs, ...C2.errs].slice(0, 10));
  await b.close();
})();
