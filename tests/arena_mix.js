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
  for (const body of ['blob', 'worm', 'chain', 'tank']) {
    await ev(bd => Mix.setBody(bd), body); await p.waitForTimeout(700);
    out.bodies.push(await ev(() => { const m = Mix.me(); return mixCfg.body + ': humans ' + [Tanks.tanks, Cells.players, Snake.worms].map(l => l.filter(x => x.human !== undefined).length).join('/') + ', camera ' + (Math.hypot(Mix.cam.x - m.x, Mix.cam.y - m.y) < 120 ? 'on me' : 'OFF'); }));
    await p.screenshot({ path: path.join(__dirname, 'shots', 'mix_' + body + '.png') });
  }
  await p.keyboard.press('KeyQ'); await p.waitForTimeout(200); out.qSwitch = await ev(() => mixCfg.body);
  // ---- staged encounters (paused, stepped by hand)
  out.rules = await ev(() => {
    paused = true; const R = {};
    const clear = () => { Tanks.tanks = []; Tanks.bullets = []; Tanks.shapes = []; Cells.players = []; Cells.blobs = []; Cells.pellets = []; Cells.viruses = []; Cells.pickups = []; Snake.worms = []; Snake.pellets = []; cellsCfg.bots = 0; Snake.buildGrid(); };
    const tank = (x, y) => { const k = Tanks.addTank({ name: 'T', color: '#60a5fa' }); k.x = x; k.y = y; k.inv = 0; k.vx = k.vy = 0; return k; };
    const blob = (x, y, m) => { const pl = Cells.addPlayer({ name: 'B', color: '#a78bfa' }); Cells.blobs = Cells.blobs.filter(q => q.pl !== pl); const bb = { pl, x, y, m, vx: 0, vy: 0, mergeT: 0 }; Cells.blobs.push(bb); pl.fx = { speed: 0, shield: 0, magnet: 0 }; pl.aimX = x; pl.aimY = y; return bb; };
    const worm = (x, y, len) => { const w = Snake.spawn({ name: 'W', color: '#f472b6' }); w.len = len; w.ang = 0; w.want = 0; w.safeT = 0; w.segs = []; for (let i = 0; i < len; i++) w.segs.push({ x: x - i * SNK.SEG, y }); return w; };
    const bots = cellsCfg.bots;
    const bullet = (x, y, k) => Tanks.bullets.push({ x, y, vx: 0, vy: 0, r: 9, dmg: 10, pen: 1, owner: k, life: 50 });
    const run = (n) => { for (let i = 0; i < (n || 1); i++) { Mix.t++; Mix.interact(); } };
    // 1. bullets shrink blobs; a blob shot below 12 is gone
    clear(); let k = tank(0, 0), bl = blob(300, 0, 200); bullet(300, 0, k); run();
    R.bulletShrinksBlob = '200 -> ' + Math.round(bl.m) + ', bullet used ' + (Tanks.bullets.length === 0);
    clear(); k = tank(0, 0); bl = blob(300, 0, 20); bullet(300, 0, k); run(); R.smallBlobShotToBits = Cells.blobs.length === 0;
    // 2. bullets hurt worms: head most, body soaked; Armor reduces it
    clear(); k = tank(0, 0); let w = worm(600, 0, 60); Snake.buildGrid(); run();
    bullet(600, 0, k); run(); const afterHead = Math.round(w.len);
    w.mx.st[1] = 5; bullet(600, 0, k); run(); const afterArmored = Math.round(w.len);
    R.bulletVsWorm = 'head 60 -> ' + afterHead + ', with 5 Armor -> ' + afterArmored;
    // 3. tanks are blobs with a gun: mass, eat smaller, eaten by bigger, size follows mass
    clear(); k = tank(0, 0); run(); const size0 = Math.round(Tanks.size(k)); k.mixMass = 400; R.tankSizeFollowsMass = size0 + ' -> ' + Math.round(Tanks.size(k));
    clear(); k = tank(0, 0); run(); k.mixMass = 400; bl = blob(10, 0, 100); run(); R.tankEatsSmallerBlob = Cells.blobs.length === 0 && Math.round(k.mixMass) === 500;
    clear(); k = tank(0, 0); run(); bl = blob(0, 0, 2500); run(); R.biggerBlobAbsorbsTank = !k.alive && Math.round(bl.m) === 2536;
    clear(); k = tank(0, 0); run(); bl = blob(40, 0, 40); const hpA = k.hp; run(3); R.equalSizesIgnoreEachOther = k.alive && k.hp === hpA && Math.round(bl.m) === 40;
    clear(); k = tank(0, 0); let k2 = tank(8, 0); run(); k.mixMass = 300; run(); R.tankEatsSmallerTank = !k2.alive && Math.round(k.mixMass) === 336;
    clear(); k = tank(0, 0); run(); Cells.pellets.push({ x: 3, y: 0, m: 10, col: '#fff', vx: 0, vy: 0 }); Mix.t = 1; run(); R.tankEatsFood = k.mixMass > 36;
    clear(); k = tank(0, 0); run(); Snake.pellets = [{ x: 3, y: 0, v: 2, col: '#fff', ph: 0 }]; Mix.t = 0; const mW = k.mixMass; run(); R.tankCollectsWormFood = 'mass +' + (k.mixMass - mW).toFixed(1);
    clear(); k = tank(2850, 2850); run(); k.mixMass = 1000; const dec0 = cellsCfg.decay;     // outside the worm ring, so no food offsets the loss
    cellsCfg.decay = CELL_DECAY_CLASSIC; run(60); R.tankMassDecays = '1000 -> ' + k.mixMass.toFixed(1) + ' in a second'; cellsCfg.decay = dec0;
    // 4. badly damaged, or a virus: pieces break off, the biggest keeps the gun, the rest are inert food
    clear(); k = tank(0, 0); run(); k.mixMass = 200; k.hp = Tanks.maxHp(k) * 0.2; Mix.t = 1; run();
    const lumps = Cells.pellets.filter(q => q.lump); R.badlyDamagedSplits = 'mass 200 -> ' + Math.round(k.mixMass) + ', ' + lumps.length + ' lumps of ' + Math.round(lumps[0] ? lumps[0].m : 0) + ', still shooting ' + k.alive + ', hp back to ' + Math.round(k.hp / Tanks.maxHp(k) * 100) + '%';
    R.lumpsAreJustFood = lumps.every(q => q.vx !== undefined && !('pl' in q));
    clear(); k = tank(0, 0); run(); k.mixMass = 200; Cells.viruses.push({ x: 0, y: 0, m: 100 }); Mix.t = 1; run(); R.virusSplitsTank = Math.round(k.mixMass) === 100 && Cells.pellets.some(q => q.lump);
    clear(); k = tank(0, 0); run(); k.mixMass = 200; k.hp = 0; Tanks.hurt(k, 1, null); k.alive = false; run(); R.deadTankDropsLumps = Cells.pellets.filter(q => q.lump).length >= 3;
    // 5. worms: break blocks, level up, bite tanks, body is a wall
    clear(); w = worm(0, 0, 40); Snake.buildGrid(); run(); Tanks.shapes.push({ type: 'square', x: 5, y: 0, vx: 0, vy: 0, hp: 10, max: 10, ang: 0, spin: 0, drift: 0, hitT: 0 });
    let ticks = 0; while (Tanks.shapes.some(q => q.x === 5 && q.y === 0) && ticks < 200) { run(); ticks++; }
    R.wormBreaksBlock = 'square broken in ' + ticks + ' ticks, xp ' + w.mx.xp + ', length ' + Math.round(w.len);
    w.mx.xp = 0; w.mx.st = [0, 0, 0]; w.mx.pts = 0; w.human = 0; Mix.wormXp(w, 20); const pts = w.mx.pts; Mix.wormStat(w, 0); w.human = undefined; R.wormLevels = 'level ' + w.mx.lvl + ', points ' + pts + ' -> Bite ' + w.mx.st[0];
    clear(); w = worm(0, 0, 80); k = tank(20, 0); Snake.buildGrid(); const hpB = k.hp; run(); R.wormBitesTank = 'tank hp -' + Math.round(hpB - k.hp) + ', worm alive ' + w.alive + ', length ' + Math.round(w.len);
    clear(); w = worm(0, 0, 80); k = tank(-30 * SNK.SEG, 0); Snake.buildGrid(); const hpC = k.hp; run(); R.wormBodyHurtsTank = k.hp < hpC && w.alive;
    // 6. a blob that touches a worm pops: splits, a quarter of its mass goes to the worm; tiny ones are taken whole
    clear(); w = worm(0, 0, 80); bl = blob(-30 * SNK.SEG, 0, 400); Snake.buildGrid(); const lenP = w.len; const massBefore = 400; run();
    const pieces = Cells.blobs.length, total = Math.round(Cells.blobs.reduce((a, q) => a + q.m, 0));
    R.blobPopsOnWorm = pieces + ' pieces, total mass ' + massBefore + ' -> ' + total + ', worm length +' + Math.round(w.len - lenP);
    run(5); R.piecesDontRepop = Cells.blobs.length === pieces;
    clear(); w = worm(0, 0, 80); bl = blob(-30 * SNK.SEG, 0, 20); Snake.buildGrid(); run(); R.tinyBlobTakenWhole = Cells.blobs.length === 0;
    // 7. food crosses over
    clear(); w = worm(0, 0, 30); Cells.pellets.push({ x: 5, y: 0, m: 1, col: '#fff', vx: 0, vy: 0 }); bl = blob(900, 0, 100); Snake.pellets = [{ x: 905, y: 0, v: 2, col: '#fff', ph: 0 }]; Snake.buildGrid(); Mix.t = 1; const l0 = w.len, m0 = bl.m; run();
    R.crossFood = 'worm +' + (w.len - l0).toFixed(1) + ', blob +' + (bl.m - m0).toFixed(0);
    // 8. shared power-ups: a tank and a worm pick up what blobs pick up
    clear(); k = tank(0, 0); w = worm(2000, 0, 40); Snake.buildGrid(); run(); const sp0 = Tanks.speed(k), mass0 = k.mixMass;
    Cells.pickups = [{ x: 0, y: 0, kind: 'speed' }, { x: 0, y: 0, kind: 'shield' }, { x: 0, y: 0, kind: 'mass' }, { x: 2000, y: 0, kind: 'magnet' }, { x: 2000, y: 0, kind: 'mass' }, { x: 2000, y: 0, kind: 'shield' }]; const wl = w.len; run();
    R.sharedPowerups = 'tank speed x' + (Tanks.speed(k) / sp0).toFixed(1) + ', shield ' + (k.inv > 300) + ', mass +' + Math.round(k.mixMass - mass0) + ' | worm magnet ' + (w.mixFx.magnet > 0) + ', length +' + Math.round(w.len - wl) + ', shield ' + (w.safeT > 300) + ' | left ' + Cells.pickups.length;
    cellsCfg.bots = bots; Mix.reset(); paused = false; return R;
  });
  // ---- the bubble worm: grows a chain as it gains mass, the chain follows the head, losing the head promotes the next
  out.chain = await ev(() => {
    paused = true; const R = {};
    Tanks.tanks = []; Tanks.bullets = []; Tanks.shapes = []; Cells.players = []; Cells.blobs = []; Cells.pellets = []; Cells.viruses = []; Cells.pickups = []; Snake.worms = []; Snake.pellets = []; Snake.buildGrid();
    const bots = cellsCfg.bots, food = cellsCfg.food, dec = cellsCfg.decay; cellsCfg.bots = 0; cellsCfg.food = 0; cellsCfg.decay = 0;
    const pl = Cells.addPlayer({ human: 0, name: 'P1', color: '#ff5a5f' }); pl.chain = true; pl.fx = { speed: 0, shield: 0, magnet: 0 };
    const head0 = Cells.mine(pl)[0]; head0.x = 0; head0.y = 0;
    const steer = (x, y, n) => { for (let i = 0; i < n; i++) { Cells.step(); pl.aimX = x; pl.aimY = y; } };
    // hold the aim by overriding the human's input for the test
    const inp = Cells.input; Cells.input = function(p) { if (p !== pl) return inp.call(this, p); };
    pl.aimX = 0; pl.aimY = 0; steer(0, 0, 5); R.at20 = pl.chainList.length + ' bubble';
    head0.m = 200; steer(0, 0, 200); R.at200 = pl.chainList.length + ' bubbles, masses ' + pl.chainList.map(b => Math.round(b.m)).join('/') + ', total ' + Math.round(Cells.mass(pl));
    // travel right: the bubbles should line up behind the head, in order
    steer(3000, 0, 240); const xs = pl.chainList.map(b => Math.round(b.x));
    R.followsInOrder = xs.every((x, i) => i === 0 || x < xs[i - 1]) + ' (head x ' + xs[0] + ', tail x ' + xs[xs.length - 1] + ')';
    R.neverMerged = pl.chainList.length >= 4;
    // lose the head: the next bubble leads
    const second = pl.chainList[1]; pl.chainList[0].dead = true; Cells.blobs = Cells.blobs.filter(b => !b.dead); steer(3000, 0, 3);
    R.headEatenNextLeads = pl.chainList[0] === second && second.lead === null && pl.alive;
    const m0 = Cells.mass(pl), hx = pl.chainList[0].x; pl.splitPrev = false; Cells.chainDash(pl); steer(3000, 0, 6);
    R.dash = 'moved ' + Math.round(pl.chainList[0].x - hx) + ' in 6 ticks, mass ' + Math.round(m0) + ' -> ' + Math.round(Cells.mass(pl)) + ', still ' + pl.chainList.length + ' bubbles';
    Cells.input = inp; cellsCfg.bots = bots; cellsCfg.food = food; cellsCfg.decay = dec; Mix.reset(); paused = false; return R;
  });
  out.cpuChains = await ev(() => Cells.players.filter(p => p.chain && p.human === undefined).length);
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
  const ok = out.world.on && out.world.sharedCam && out.world.humans === '1/0/0' && out.bodies.join(' ') === 'blob: humans 0/1/0, camera on me worm: humans 0/0/1, camera on me chain: humans 0/1/0, camera on me tank: humans 1/0/0, camera on me' && out.qSwitch === 'blob'
    && r.bulletShrinksBlob === '200 -> 187, bullet used true' && r.smallBlobShotToBits && r.tankCollectsWormFood === 'mass +0.7' && r.tankMassDecays === '1000 -> 998.0 in a second' && r.bulletVsWorm === 'head 60 -> 44, with 5 Armor -> 36' && r.tankSizeFollowsMass === '30 -> 100'
    && r.tankEatsSmallerBlob && r.biggerBlobAbsorbsTank && r.equalSizesIgnoreEachOther && r.tankEatsSmallerTank && r.tankEatsFood
    && /^mass 200 -> 120, \d lumps of \d+, still shooting true, hp back to 50%/.test(r.badlyDamagedSplits) && r.lumpsAreJustFood && r.virusSplitsTank && r.deadTankDropsLumps
    && /^square broken in 20 ticks, xp 10/.test(r.wormBreaksBlock) && /^level 2, points 1 -> Bite 1/.test(r.wormLevels) && /^tank hp -8, worm alive true/.test(r.wormBitesTank) && r.wormBodyHurtsTank
    && /^6 pieces, total mass 400 -> 300, worm length \+30/.test(r.blobPopsOnWorm) && r.piecesDontRepop && r.tinyBlobTakenWhole && /worm \+0\.6, blob \+2/.test(r.crossFood)
    && r.sharedPowerups === 'tank speed x1.5, shield true, mass +30 | worm magnet true, length +30, shield true | left 0'
    && out.chain.at20 === '1 bubble' && (() => { const m = /^5 bubbles, masses ([\d\/]+), total 200$/.exec(out.chain.at200); if (!m) return false; const a = m[1].split('/').map(Number); return a.every((v, k) => k === 0 || v < a[k - 1]); })() && /^true/.test(out.chain.followsInOrder) && out.chain.neverMerged && out.chain.headEatenNextLeads && out.cpuChains === 3
    && out.live.fps >= 45 && !out.afterLeave.on && !out.afterLeave.layer && out.afterLeave.ownCams && out.afterLeave.cellsHuman === 1 && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
