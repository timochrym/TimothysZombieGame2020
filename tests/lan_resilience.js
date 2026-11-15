// LAN resilience: ping shows in the menus, a dropped connection re-joins by itself, and the shorter packets still rebuild
// the same world on the joiner (short field names, id lists sent only when they change).
const { spawn } = require('child_process'); const path = require('path'); const { chromium } = require('playwright');
const PORT = 8094;
const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' }); srv.unref();
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
const init = () => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, values: O.values, assign: O.assign };
  window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); };
(async () => {
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch(); const errs = [];
  const mk = async (tag) => { const p = await b.newPage({ viewport: { width: 1100, height: 650 } }); p.on('pageerror', e => errs.push(tag + ': ' + e.message)); await p.addInitScript(init); await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1200); return p; };
  const H = await mk('host'), C = await mk('client');
  await H.evaluate(() => { Hub.close(); GameModes.launch('survival'); }); await H.waitForTimeout(600);
  await H.evaluate(() => Net.connect('host', 'Tim')); await H.waitForTimeout(500);
  await C.evaluate(() => Net.connect('client', 'Bob')); await C.waitForTimeout(3500);
  const out = {};

  // 1. ping: the joiner measures it, the host learns it from the joiner, both menus show it and colour the button
  await C.waitForTimeout(2500);
  out.ping = {
    joinerRtt: await C.evaluate(() => Math.round(Net.rtt)),
    hostSeesPeer: await H.evaluate(() => { const p = Net.peerList()[0]; return p ? Math.round(p.rtt) : -1; }),
    joinerLabel: await C.evaluate(() => SandboxUI.lanLabel()),
    hostLabel: await H.evaluate(() => SandboxUI.lanLabel()),
    hostButtonClass: await H.evaluate(() => (document.getElementById('sb-quick-lan') || {}).dataset ? document.getElementById('sb-quick-lan').dataset.ping : null),
  };

  // 2. packets: the joiner's world matches the host's even though names are short and id lists are skipped
  await H.evaluate(() => { godMode = true; SummonManager.pauseWaves = true; for (let i = 0; i < 5; i++) spawnZombie('NORMAL', redGuy.x + 300 + i * 90, redGuy.y + 60); });
  await C.waitForTimeout(1500);
  out.sync = await Promise.all([H.evaluate(() => ({ zombies: zombies.length, crates: movingObjects.length, heroes: characters.length })), C.evaluate(() => ({ zombies: zombies.length, crates: movingObjects.length, heroes: characters.length }))]);
  out.shortNamesUsed = await C.evaluate(() => zombies.every(z => typeof z.health === 'number' && typeof z.xspeed === 'number' && !('E' in z) && !('U' in z)));
  // a zombie dies and a new one spawns: the id list must follow
  await H.evaluate(() => { zombies[0].dead = true; spawnZombie('LEAPER', redGuy.x - 400, redGuy.y + 80); });
  await C.waitForTimeout(900);
  out.afterChange = await Promise.all([H.evaluate(() => zombies.map(z => z.zombiePower).join(',')), C.evaluate(() => zombies.map(z => z.zombiePower).join(','))]);

  // 3. the connection drops: the joiner comes back by itself, as a hero again, without the player touching anything
  const before = await H.evaluate(() => Net.peerCount());
  await C.evaluate(() => { window.__lostSeen = false; const iv = setInterval(() => { if (Net.lost) window.__lostSeen = true; }, 20); setTimeout(() => clearInterval(iv), 8000); Net.ws.close(); });
  await C.waitForTimeout(300);
  out.duringDrop = await C.evaluate(() => ({ lost: Net.lost, role: Net.role, label: SandboxUI.lanLabel(), onlineGetter: Net.online }));
  await C.waitForTimeout(5000);
  out.afterRejoin = await C.evaluate(() => ({ lostSeen: window.__lostSeen, lostNow: Net.lost, role: Net.role, inGame: Net.inGame, me: !!Net.myChar(), retries: Net.retries }));
  out.hostPeers = { before, after: await H.evaluate(() => Net.peerCount()) };

  // 4. leaving on purpose does NOT try to reconnect
  await C.evaluate(() => Net.disconnect()); await C.waitForTimeout(2500);
  out.leave = await C.evaluate(() => ({ role: Net.role, lost: Net.lost, ws: !!Net.ws }));

  console.log(JSON.stringify(out, null, 1)); console.log(errs.slice(0, 5));
  const ok = out.ping.joinerRtt > 0 && out.ping.hostSeesPeer > 0 && /ms/.test(out.ping.joinerLabel) && /ms/.test(out.ping.hostLabel)
    && out.sync[0].zombies === out.sync[1].zombies && out.sync[0].heroes === out.sync[1].heroes && out.shortNamesUsed
    && out.afterChange[0] === out.afterChange[1]
    && out.duringDrop.lost && out.afterRejoin.lostSeen && !out.afterRejoin.lostNow && out.afterRejoin.inGame && out.afterRejoin.me
    && out.leave.role === null && !out.leave.lost && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL');
  await b.close(); process.exit(ok ? 0 : 1);
})();
