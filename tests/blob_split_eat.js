// Arena Mix: splitting a blob with a worm INSIDE it halves the worm (floor 12) and adds that length to the blob as mass.
// Staged with Cells.split plus one real Space keypress in the live game. Exits non-zero on failure.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('mix', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a); const out = {};
  await ev(() => { SNK.CPUS = 0; TNK.CPUS = 0; cellsCfg.bots = 0; SNK.PELLETS = 0; Mix.reset(); Mix.setBody('blob'); }); await p.waitForTimeout(500);
  out.staged = await ev(() => {
    const R = {}; paused = true;
    const clear = () => { Tanks.tanks = []; Tanks.bullets = []; Tanks.shapes = []; Cells.players = []; Cells.blobs = []; Cells.pellets = []; Cells.viruses = []; Cells.pickups = []; Snake.worms = []; Snake.pellets = []; Snake.buildGrid(); Mix.t += 5; Mix.log = []; };
    const blob = (x, y, m, human) => { const pl = Cells.addPlayer({ name: 'B', color: '#a78bfa', human }); Cells.blobs = Cells.blobs.filter(q => q.pl !== pl); const bb = { pl, x, y, m, vx: 0, vy: 0, mergeT: 0 }; Cells.blobs.push(bb); pl.fx = { speed: 0, shield: 0, magnet: 0 }; pl.aimX = x + 500; pl.aimY = y; pl.alive = true; return bb; };
    const worm = (hx, hy, len, o) => { const w = Snake.spawn({ name: 'W', color: '#f472b6', human: o && o.human }); w.len = len; w.ang = 0; w.want = 0; w.safeT = (o && o.safe) || 0; w.segs = []; for (let i = 0; i < len; i++) w.segs.push({ x: hx - i * SNK.SEG, y: hy }); Snake.buildGrid(); return w; };
    const total = (pl) => Math.round(Cells.mass(pl));
    const split = (bb) => { Mix.t++; Cells.split(bb.pl, Cells.mine(bb.pl)); };
    // 1. worm head inside the blob: halved, mass added before the blob divides
    clear(); let bb = blob(0, 0, 100), w = worm(10, 0, 60);                  // head inside the blob (radius 50); body trails outside
    split(bb);
    R.headInside = 'worm 60 -> ' + Math.round(w.len) + ', blob 100 -> ' + total(bb.pl) + ' in ' + Cells.mine(bb.pl).length + ' pieces';
    R.headInsideOk = Math.round(w.len) === 30 && total(bb.pl) === 130 && Cells.mine(bb.pl).length === 2 && w.alive && w.segs.length === 30;
    R.feedback = Mix.log.length > 0 && /ate half of 1 worm/.test(Mix.log[0].text) && Mix.stat.splitEat === 1;
    R.bothHalvesShare = Cells.mine(bb.pl).every(q => Math.round(q.m) === 65);
    // 2. only the body is inside (head outside)
    clear(); bb = blob(0, 0, 100); w = worm(200, 0, 60);                     // head 200 px away, body passes through the blob at x in [-?..]
    w.segs.forEach((s, i) => { s.x = 200 - i * SNK.SEG; });                  // segments at 200, 191 ... 2 ... : some inside radius*0.7 = 35
    split(bb); R.bodyInside = 'worm 60 -> ' + Math.round(w.len); R.bodyInsideOk = Math.round(w.len) === 30 && total(bb.pl) === 130;
    // 3. outside: untouched
    clear(); bb = blob(0, 0, 100); w = worm(400, 400, 60); split(bb); R.outsideUntouched = Math.round(w.len) === 60 && total(bb.pl) === 100 && Cells.mine(bb.pl).length === 2;
    // 4. blob too small to split: nothing happens
    clear(); bb = blob(0, 0, 30); w = worm(5, 0, 60); split(bb); R.tooSmallNoEffect = Math.round(w.len) === 60 && Cells.mine(bb.pl).length === 1 && total(bb.pl) === 30;
    // 5. length floor: a 20-long worm gives only 8 and stays at 12; a 14-long (or shorter) worm is left alone
    clear(); bb = blob(0, 0, 100); w = worm(5, 0, 20); split(bb); R.floor = 'worm 20 -> ' + Math.round(w.len) + ', blob +' + (total(bb.pl) - 100); R.floorOk = Math.round(w.len) === 12 && total(bb.pl) === 108;
    clear(); bb = blob(0, 0, 100); w = worm(5, 0, 14); split(bb); R.tinyLeftAlone = Math.round(w.len) === 14 && total(bb.pl) === 100;
    // 6. a spawn-protected worm is left alone
    clear(); bb = blob(0, 0, 100); w = worm(5, 0, 60, { safe: 60 }); split(bb); R.protectedLeftAlone = Math.round(w.len) === 60 && total(bb.pl) === 100;
    // 7. two worms inside: both halved
    clear(); bb = blob(0, 0, 100); const w1 = worm(5, 10, 60), w2 = worm(-5, -10, 40); w2.segs.forEach((s, i) => { s.y = -10; }); split(bb);
    R.twoWorms = 'worms 60,40 -> ' + Math.round(w1.len) + ',' + Math.round(w2.len) + ', blob +' + (total(bb.pl) - 100); R.twoWormsOk = Math.round(w1.len) === 30 && Math.round(w2.len) === 20 && total(bb.pl) === 150 && /ate half of 2 worms/.test(Mix.log[0].text);
    // 8. two blobs of one player both hold the same worm: it is halved once per press, not twice
    clear(); bb = blob(0, 0, 100); const pl = bb.pl; Cells.blobs.push({ pl, x: 20, y: 0, m: 100, vx: 0, vy: 0, mergeT: 0 }); w = worm(10, 0, 60); Mix.t++; Cells.split(pl, Cells.mine(pl));
    R.oncePerPress = 'worm 60 -> ' + Math.round(w.len); R.oncePerPressOk = Math.round(w.len) === 30;
    // 9. a second press later halves it again
    Mix.t += 2; Cells.split(pl, Cells.mine(pl)); R.secondPress = 'worm -> ' + Math.round(w.len); R.secondPressOk = Math.round(w.len) < 30 && Math.round(w.len) >= 12;
    // 10. a split worm: each piece inside the blob is halved
    clear(); bb = blob(0, 0, 100); w = worm(5, 0, 60); w.kinId = 1; const w2b = worm(-5, 5, 40); w2b.kinId = 1; split(bb); R.kinPieces = Math.round(w.len) === 30 && Math.round(w2b.len) === 20;
    // 11. the player's own worm (swap case) is never eaten by their own blob
    clear(); bb = blob(0, 0, 100, 0); w = worm(5, 0, 60, { human: 0 }); split(bb); R.ownWormSafe = Math.round(w.len) === 60;
    // 12. a bubble worm does not split (it lunges), so nothing is eaten
    clear(); bb = blob(0, 0, 100); bb.pl.chain = true; w = worm(5, 0, 60); Cells.chainDash && Cells.chainDash(bb.pl); R.bubbleWormNoSplit = Math.round(w.len) === 60;
    paused = false; return R;
  });
  // ---- the real thing: blob body, press Space with a worm inside
  out.live = await ev(async () => {
    Mix.reset(); Mix.setBody('blob'); Cells.viruses = []; const me = Cells.players.find(q => q.human === 0), bb = Cells.mine(me)[0]; bb.m = 120; bb.popCd = 9999; me.fx.shield = 0;       // popCd: the separate "blob pops on a worm" rule must not fire first
    const w = Snake.spawn({ name: 'W', color: '#f472b6' }); w.len = 80; w.safeT = 0; w.ang = w.want = 0; w.segs = []; for (let i = 0; i < 80; i++) w.segs.push({ x: bb.x + 8 - i * SNK.SEG, y: bb.y });
    window.__live = { w, me, m0: Cells.mass(me), l0: w.len }; return { m0: Math.round(window.__live.m0), l0: window.__live.l0 };
  });
  await p.keyboard.down('Space'); await p.waitForTimeout(120); await p.keyboard.up('Space'); await p.waitForTimeout(200);
  out.live.after = await ev(() => ({ wormLen: Math.round(__live.w.len), blobMass: Math.round(Cells.mass(__live.me)), pieces: Cells.mine(__live.me).length, splits: Mix.stat.splitEat || 0, swallowed: Mix.lastSwallow && Mix.lastSwallow.taken, before: Mix.lastSwallow && Mix.lastSwallow.before }));
  console.log(JSON.stringify(out, null, 1)); console.log(errs);
  const S = out.staged, L = out.live.after;
  const ok = S.headInsideOk && S.feedback && S.bothHalvesShare && S.bodyInsideOk && S.outsideUntouched && S.tooSmallNoEffect && S.floorOk && S.tinyLeftAlone && S.protectedLeftAlone && S.twoWormsOk && S.oncePerPressOk && S.secondPressOk && S.kinPieces && S.ownWormSafe && S.bubbleWormNoSplit
    && L.pieces >= 2 && L.wormLen < 50 && L.before >= 70 && Math.abs(L.swallowed - L.before / 2) <= 1 && L.blobMass >= out.live.m0 + 10 && L.splits >= 1 && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
