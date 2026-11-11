// LAN through the real buttons: 📡 LAN → Host, a second browser opens the join page → 📡 LAN → Join, the host picks
// a game and the joiner ends up in it. Starts its own server.js on 8099.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const srv = spawn(process.execPath, [require('path').resolve(__dirname, '..', 'server.js'), '8099'], { stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const ip = 'localhost';   // (a cloud test box can't use its network address; on a real LAN that works the same)
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const mk = async (tag, url) => { const ctx = await b.newContext({ viewport: { width: 1100, height: 650 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(tag + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(tag + ' console: ' + m.text()); }); await p.addInitScript(init); await p.goto(url); await p.waitForTimeout(1500); return { p, errs }; };
  const H = await mk('host', 'http://' + ip + ':8099/');
  await H.p.click('#lan-btn'); await H.p.waitForTimeout(1200);
  const hostPanel = await H.p.evaluate(() => document.getElementById('lan-panel').innerText.slice(0, 300));
  const hostBtn = await H.p.$('#lan-host');
  console.log('HOST PANEL:', hostPanel.replace(/\n+/g, ' | '));
  if (hostBtn) { await hostBtn.click(); await H.p.waitForTimeout(1500); }
  console.log('host role', await H.p.evaluate(() => [Net.role, Net.status]));
  const link = await H.p.evaluate(() => { const l = document.getElementById('lan-link'); return l && l.textContent; });
  console.log('join link', link);
  const C = await mk('client', 'http://' + ip + ':8099/');
  await C.p.click('#lan-btn'); await C.p.waitForTimeout(3000);
  const cPanel = await C.p.evaluate(() => document.getElementById('lan-panel').innerText.slice(0, 300));
  console.log('CLIENT PANEL:', cPanel.replace(/\n+/g, ' | '));
  const jb = await C.p.$('#lan-join');
  console.log('join disabled?', jb && await jb.isDisabled());
  if (jb && !(await jb.isDisabled())) { await jb.click(); await C.p.waitForTimeout(2500); }
  console.log('client role', await C.p.evaluate(() => [Net.role, Net.status, Net.inGame]), 'host peers', await H.p.evaluate(() => Net.peerCount()));
  // host picks a game from the Arcade (Enter on the first card)
  await H.p.evaluate(() => NetUI.close()); await H.p.keyboard.press('Enter'); await H.p.waitForTimeout(2500);
  console.log('host mode', await H.p.evaluate(() => [GameModes.current && GameModes.current.id, Hub.isOpen]), 'client', await C.p.evaluate(() => [Net.inGame, GameModes.current && GameModes.current.id, characters.length, Net.status]));
  console.log(H.errs.concat(C.errs).slice(0, 8));
  await b.close();
  process.exit(0);
})();
