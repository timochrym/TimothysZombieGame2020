// Arena Mix: worms, blobs and tanks in one world. Runs each "play as" body, checks every cross-game rule with a
// staged encounter (so it doesn't depend on luck), then lets the whole thing run and counts what happened.
const { open } = require('./lib'); const path = require('path');
(async () => {
  const { b, p, errs } = await open('mix', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a); const out = {};
  await p.waitForTimeout(600);
  out.world = await ev(() => ({ on: Mix.on, tanks: Tanks.tanks.length, blobPlayers: Cells.players.length, worms: Snake.worms.length, humans: [Tanks.tanks, Cells.players, Snake.worms].map(l => l.filter(x => x.human !== undefined).length).join('/'), sharedCam: Tanks.cam === Cells.cam && Cells.cam === Snake.cam }));
  // play as each body: exactly one human, in the right game, and the camera follows it
  out.bodies = [];
  for (const body of ['blob', 'worm', 'tank']) {
    await ev(bd => Mix.setBody(bd), body); await p.waitForTimeout(700);
    out.bodies.push(await ev(() => { const m = Mix.me(); return mixCfg.body + ': humans ' + [Tanks.tanks, Cells.players, Snake.worms].map(l => l.filter(x => x.human !== undefined).length).join('/') + ', camera ' + (Math.hypot(Mix.cam.x - m.x, Mix.cam.y - m.y) < 120 ? 'on me' : 'OFF'); }));
    await p.screenshot({ path: path.join(__dirname, 'shots', 'mix_' + body + '.png') });
  }
  await p.keyboard.press('KeyQ'); await p.waitForTimeout(200); out.qSwitch = await ev(() => mixCfg.body);
  // ---- staged encounters (paused, stepped by hand)
  out.rules = await ev(() => {
    paused = true; const R = {};
    const clear = () => { Tanks.tanks = []; Tanks.bullets = []; Tanks.shapes = []; Cells.players = []; Cells.blobs = []; Cells.pellets = []; Cells.viruses = []; Cells.pickups = []; Snake.worms = []; Snake.pellets = []; cellsCfg.bots = 0; };
    const tank = (x, y) => { const k = Tanks.addTank({ name: 'T', color: '#60a5fa' }); k.x = x; k.y = y; k.inv = 0; k.vx = k.vy = 0; return k; };
    const blob = (x, y, m) => { const pl = Cells.addPlayer({ name: 'B', color: '#a78bfa' }); Cells.blobs = Cells.blobs.filter(q => q.pl !== pl); const bb = { pl, x, y, m, vx: 0, vy: 0, mergeT: 0 }; Cells.blobs.push(bb); pl.fx = { speed: 0, shield: 0, magnet: 0 }; pl.aimX = x; pl.aimY = y; return bb; };
    const worm = (x, y, len) => { const w = Snake.spawn({ name: 'W', color: '#f472b6' }); w.len = len; w.ang = 0; w.want = 0; w.safeT = 0; w.segs = []; for (let i = 0; i < len; i++) w.segs.push({ x: x - i * SNK.SEG, y }); return w; };
    const bots = cellsCfg.bots;
    // 1. a bullet shrinks a blob
    clear(); let k = tank(0, 0), bl = blob(300, 0, 200); Tanks.bullets.push({ x: 300, y: 0, vx: 0, vy: 0, r: 9, dmg: 10, pen: 1, owner: k, life: 50 }); Mix.interact();
    R.bulletShrinksBlob = '200 -> ' + Math.round(bl.m) + ', bullet used ' + (Tanks.bullets.length === 0);
    // 2. a head shot shrinks a worm; a body shot is soaked
    clear(); k = tank(0, 0); let w = worm(600, 0, 60); Snake.buildGrid();
    Tanks.bullets.push({ x: 600, y: 0, vx: 0, vy: 0, r: 9, dmg: 10, pen: 1, owner: k, life: 50 }); Mix.interact(); const afterHead = Math.round(w.len);
    Tanks.bullets.push({ x: 600 - 30 * SNK.SEG, y: 0, vx: 0, vy: 0, r: 9, dmg: 10, pen: 1, owner: k, life: 50 }); Mix.interact();
    R.bulletVsWorm = 'head 60 -> ' + afterHead + ', body -> ' + Math.round(w.len) + ', soaked ' + (Tanks.bullets.length === 0);
    // 3. a big blob swallows a tank; a small one only chips
    clear(); k = tank(0, 0); bl = blob(0, 0, 2500); Mix.interact(); R.bigBlobSwallowsTank = !k.alive && bl.m > 2500;
    clear(); k = tank(0, 0); bl = blob(40, 0, 60); const hp0 = k.hp; Mix.interact(); R.smallBlobChips = k.alive && bl.m < 60 && k.hp < hp0;
    // 4. a worm's body is a wall for tanks; a worm's head into a tank kills the worm
    clear(); w = worm(0, 0, 80); k = tank(-30 * SNK.SEG, 0); Snake.buildGrid(); const hp1 = k.hp; Mix.interact(); R.wormBodyHurtsTank = k.hp < hp1 && w.alive;
    clear(); w = worm(0, 0, 80); k = tank(20, 0); Snake.buildGrid(); Mix.interact(); R.headIntoTankKillsWorm = !w.alive && k.alive;
    // 5. a big blob swallows a worm's head; a small blob on a worm's body is absorbed
    clear(); w = worm(0, 0, 60); bl = blob(0, 0, 3000); Snake.buildGrid(); Mix.interact(); R.bigBlobSwallowsWorm = !w.alive && bl.m > 3000;
    clear(); w = worm(0, 0, 80); bl = blob(-30 * SNK.SEG, 0, 20); Snake.buildGrid(); const len0 = w.len; Mix.interact(); R.wormAbsorbsSmallBlob = Cells.blobs.length === 0 && w.len > len0;
    // 6. food crosses over
    clear(); w = worm(0, 0, 30); Cells.pellets.push({ x: 5, y: 0, m: 1, col: '#fff', vx: 0, vy: 0 }); bl = blob(900, 0, 100); Snake.pellets = [{ x: 905, y: 0, v: 2, col: '#fff', ph: 0 }]; Snake.buildGrid(); Mix.t = 0; const l0 = w.len, m0 = bl.m; Mix.interact();
    R.crossFood = 'worm +' + (w.len - l0).toFixed(1) + ', blob +' + (bl.m - m0).toFixed(0);
    cellsCfg.bots = bots; Mix.reset(); paused = false; return R;
  });
  // ---- let it run for real and count
  await ev(() => { arenaCheats.god = true; Mix.setBody('tank'); });
  await p.mouse.move(900, 300); await p.mouse.down(); await p.waitForTimeout(9000); await p.mouse.up();
  out.live = await ev(() => ({ stat: Mix.stat, fps: measuredFPS, tanksAlive: Tanks.tanks.filter(k => k.alive).length, blobs: Cells.blobs.length, wormsAlive: Snake.worms.filter(w => w.alive).length, feed: Mix.log.map(l => l.text) }));
  await p.screenshot({ path: path.join(__dirname, 'shots', 'mix_live.png') });
  // leaving the mode gives each game its own camera and floor back
  await ev(() => { arenaCheats.god = false; GameModes.launch('cells'); }); await p.waitForTimeout(600);
  out.afterLeave = await ev(() => ({ on: Mix.on, layer: !!Cells.mixLayer, ownCams: Tanks.cam !== Cells.cam && Cells.cam !== Snake.cam, cellsHuman: Cells.players.filter(q => q.human !== undefined).length }));
  console.log(JSON.stringify(out, null, 1)); console.log(errs);
  const r = out.rules;
  const ok = out.world.on && out.world.sharedCam && out.world.humans === '1/0/0' && out.bodies.join(' ') === 'blob: humans 0/1/0, camera on me worm: humans 0/0/1, camera on me tank: humans 1/0/0, camera on me' && out.qSwitch === 'blob'
    && /^200 -> 187, bullet used true/.test(r.bulletShrinksBlob) && /^head 60 -> 44, body -> 4[12], soaked true/.test(r.bulletVsWorm) && r.bigBlobSwallowsTank && r.smallBlobChips && r.wormBodyHurtsTank && r.headIntoTankKillsWorm && r.bigBlobSwallowsWorm && r.wormAbsorbsSmallBlob && /worm \+0\.6, blob \+2/.test(r.crossFood)
    && out.live.fps >= 45 && !out.afterLeave.on && !out.afterLeave.layer && out.afterLeave.ownCams && out.afterLeave.cellsHuman === 1 && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
