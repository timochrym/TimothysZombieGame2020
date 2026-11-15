// Worm split / rejoin / brake (Arena Mix, worm body). Checks, each staged by hand with the game paused:
//   (a) a pushed spike hitting a worm's SIDE cuts it into 2 worms of one owner (length is conserved, spike consumed);
//       a spike at the head/tail band, a stopped spike, and a short worm do NOT split
//   (b) pieces overlapping mid-body do NOT rejoin and do not hurt each other
//   (c) head -> tail within leeway rejoins into ONE worm with the combined length, no death; not before the cooldown
//   (d) the brake key slows ONLY the split worm furthest from the screen centre; no key = no slowing
// Also: the camera / player lookup follow the main worm; killing one piece leaves the player alive. Exits non-zero on failure.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('mix', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a); const out = {};
  await ev(() => { Mix.setBody('worm'); }); await p.waitForTimeout(500);
  const stage = `
    window.T = {
      clear() { paused = true; Tanks.tanks = []; Tanks.bullets = []; Tanks.shapes = []; Cells.players = []; Cells.blobs = []; Cells.pellets = []; Cells.viruses = []; Cells.pickups = []; Snake.worms = []; Snake.pellets = []; SNK.PELLETS = 0; cellsCfg.bots = 0; Snake.buildGrid(); },
      // a straight worm along +x: head at (x, y), body behind it (to the left)
      worm(x, y, len, o) { const w = Snake.spawn({ name: (o && o.name) || 'W', color: '#f472b6', human: o && o.human }); w.len = len; w.ang = 0; w.want = 0; w.safeT = 0; w.segs = []; for (let i = 0; i < len; i++) w.segs.push({ x: x - i * SNK.SEG, y }); return w; },
      spike(x, y, vx, vy) { const v = { x, y, m: 100, feed: 0, vx: vx || 0, vy: vy || 0, launched: vx || vy ? 45 : 0 }; Cells.viruses.push(v); return v; },
      tick(n) { for (let i = 0; i < (n || 1); i++) { Mix.t++; Snake.step(); Mix.interact(); } }
    };`;
  await ev(stage);
  // ---------------- (a) spike split
  out.a = await ev(() => {
    const R = {}; T.clear();
    let w = T.worm(0, 0, 60, { human: 0 }); Snake.buildGrid();
    const bodyX = w.segs[30].x, before = w.len;
    const v = T.spike(bodyX, 40, 0, -6);                 // flying up into the middle of the body
    Snake.buildGrid(); T.tick(1);
    // the spike moved only by our step counter; place it directly on the body to be exact
    R.stepSplit = null;
    T.clear(); w = T.worm(0, 0, 60, { human: 0 }); Snake.buildGrid();
    const v2 = T.spike(w.segs[30].x, w.segs[30].y, 3, 0); Mix.spikeSplit();
    const kin = Snake.worms.filter(q => q.human === 0);
    R.pieces = kin.length; R.sameOwner = kin.every(q => q.human === 0 && q.name === w.name && q.color === w.color && q.mx === w.mx && q.kinId && q.kinId === kin[0].kinId);
    R.lengths = kin.map(q => Math.round(q.len)).join('+') + ' (was 60)'; R.lenConserved = Math.abs(kin.reduce((a, q) => a + q.len, 0) - 60) < 0.01 && kin.every(q => q.segs.length >= 8);
    R.spikeUsed = !Cells.viruses.includes(v2) && Cells.viruses.length >= 1;           // consumed (the arena tops the count back up)
    R.cooldowns = kin.map(q => q.rejoinCd + '/' + q.splitCd).join(' ');
    R.feedback = Mix.log.length > 0 && /cut in two/.test(Mix.log[0].text);
    // not split: stopped spike, head band, tail band, short worm, split cooldown
    T.clear(); w = T.worm(0, 0, 60, { human: 0 }); Snake.buildGrid(); T.spike(w.segs[30].x, w.segs[30].y, 0, 0); Mix.spikeSplit(); R.stoppedSpikeNoSplit = Snake.worms.length === 1;
    T.clear(); w = T.worm(0, 0, 60, { human: 0 }); Snake.buildGrid(); T.spike(w.segs[5].x, w.segs[5].y, 3, 0); Mix.spikeSplit(); R.headBandNoSplit = Snake.worms.length === 1;
    T.clear(); w = T.worm(0, 0, 60, { human: 0 }); Snake.buildGrid(); T.spike(w.segs[57].x, w.segs[57].y, 3, 0); Mix.spikeSplit(); R.tailBandNoSplit = Snake.worms.length === 1;
    T.clear(); w = T.worm(0, 0, 24, { human: 0 }); Snake.buildGrid(); T.spike(w.segs[12].x, w.segs[12].y, 3, 0); Mix.spikeSplit(); R.shortWormNoSplit = Snake.worms.length === 1;
    T.clear(); w = T.worm(0, 0, 60, { human: 0 }); Snake.buildGrid(); T.spike(w.segs[30].x, w.segs[30].y, 3, 0); Mix.spikeSplit(); const piece = Snake.worms[0]; Snake.buildGrid();
    T.spike(piece.segs[Math.floor(piece.segs.length / 2)].x, piece.segs[Math.floor(piece.segs.length / 2)].y, 3, 0); Mix.spikeSplit(); R.cooldownNoDoubleCut = Snake.worms.length === 2;
    // a piece dying leaves the player alive; the last one dying ends the run
    T.clear(); w = T.worm(0, 0, 60, { human: 0 }); Snake.buildGrid(); T.spike(w.segs[30].x, w.segs[30].y, 3, 0); Mix.spikeSplit();
    const [p1, p2] = Snake.worms.slice(); Snake.kill(p2, null); T.tick(1);
    R.onePieceDies = Snake.worms.length === 1 && Snake.worms[0].alive && !p2.alive && Snake.localWorm(0) === Snake.worms[0] && Mix.me().alive;
    Snake.kill(Snake.worms[0], null); R.lastPieceDiesMeansDead = !Mix.me().alive;
    return R;
  });
  // ---------------- (b) mid-body overlap: no rejoin, no damage
  out.b = await ev(() => {
    const R = {}; T.clear();
    const A = T.worm(0, 0, 40, { human: 0 }); A.kinId = 77; A.rejoinCd = 0;
    const B = T.worm(0, 3, 40, { human: 0 }); B.kinId = 77; B.rejoinCd = 0;          // B lies on top of A, body over body, heads 0 apart
    B.segs.forEach(s => { s.x += 10; });                                              // heads side by side, bodies overlapping in the middle
    A.segs = A.segs.map(s => ({ x: s.x, y: s.y })); const lenA = A.len, lenB = B.len;
    // put A's head against the MIDDLE of B (not B's tail): A head at B.segs[18]
    A.segs.forEach((s, i) => { s.x = B.segs[18].x + 20 - i * SNK.SEG; s.y = B.segs[18].y + 4; });
    Snake.buildGrid(); T.tick(20);
    R.stillTwo = Snake.worms.filter(q => q.alive).length === 2; R.noGone = !A.gone && !B.gone && A.alive && B.alive;
    R.noDamage = A.len >= lenA - 1 && B.len >= lenB - 1;
    // head touching the very FIRST segments of the other (its head area) does not rejoin either
    A.segs.forEach((s, i) => { s.x = B.segs[2].x + 6 - i * SNK.SEG; s.y = B.segs[2].y; }); T.tick(2);
    R.headToHeadNoRejoin = Snake.worms.filter(q => q.alive).length === 2;
    return R;
  });
  // ---------------- (c) head -> tail rejoin
  out.c = await ev(() => {
    const R = {}; T.clear();
    const mk = () => { T.clear(); const B = T.worm(0, 0, 40, { human: 0 }); B.kinId = 55; const A = T.worm(0, 600, 30, { human: 0 }); A.kinId = 55; return [A, B]; };
    // A's head arrives at B's tail (B's tail end is at x = -39 * SEG)
    let [A, B] = mk(); const tailX = B.segs[39].x; A.rejoinCd = B.rejoinCd = 0;
    const lenSum = A.len + B.len; const bHead = B.segs[0];
    A.segs.forEach((s, i) => { s.x = tailX + 14 - i * SNK.SEG; s.y = 4; });              // A's head 14 px from B's last segment: inside the leeway
    const reach = (Snake.radius(A) + Snake.radius(B)) * 1.35; R.leeway = Math.round(reach) + ' px';
    T.tick(1);
    R.oneWorm = Snake.worms.filter(q => q.alive).length === 1 && Snake.worms.length === 1;
    const W = Snake.worms[0]; R.keptFrontHead = W === B; R.lenCombined = Math.round(W.len) + ' vs ' + Math.round(lenSum) + ' (head decay aside)'; R.lenOk = Math.abs(W.len - lenSum) < 2;
    R.noKill = Mix.me().alive && A.alive === false && A.gone === true && !A.deathMsg;
    R.segsCombined = W.segs.length > 60;
    // just outside the leeway: no rejoin
    [A, B] = mk(); A.rejoinCd = B.rejoinCd = 0; const tailX2 = B.segs[39].x; const far = (Snake.radius(A) + Snake.radius(B)) * 1.35 + 14;
    A.segs.forEach((s, i) => { s.x = tailX2 - far - i * SNK.SEG; s.y = 0; }); T.tick(1); R.outsideLeewayStaysTwo = Snake.worms.filter(q => q.alive).length === 2;
    // a head at the middle of the other worm does not count; one within the last 3 segments does
    [A, B] = mk(); A.rejoinCd = B.rejoinCd = 0; A.segs.forEach((s, i) => { s.x = B.segs[30].x + 3 - i * SNK.SEG; s.y = 0; }); T.tick(1); R.midBodyNoRejoin = Snake.worms.filter(q => q.alive).length === 2;
    [A, B] = mk(); A.rejoinCd = B.rejoinCd = 0; A.segs.forEach((s, i) => { s.x = B.segs[37].x + 3 - i * SNK.SEG; s.y = 0; }); T.tick(1); R.thirdFromLastRejoins = Snake.worms.filter(q => q.alive).length === 1;
    // cooldown: touching right after the split does not rejoin; it does once the cooldown is over
    [A, B] = mk(); A.rejoinCd = B.rejoinCd = 5; A.segs.forEach((s, i) => { s.x = B.segs[39].x + 14 - i * SNK.SEG; s.y = 0; });
    Snake.buildGrid(); const before = Snake.worms.filter(q => q.alive).length; T.tick(2); R.cooldownHolds = before === 2 && Snake.worms.filter(q => q.alive).length === 2;
    A.segs.forEach((s, i) => { s.x = B.segs[39].x + 14 - i * SNK.SEG; s.y = 0; }); T.tick(5); A.segs.forEach((s, i) => { s.x = B.segs[B.segs.length - 1].x + 14 - i * SNK.SEG; s.y = 0; }); T.tick(1);
    R.rejoinsAfterCooldown = Snake.worms.filter(q => q.alive).length === 1;
    // the other direction: B's head onto A's tail
    T.clear(); A = T.worm(0, 0, 40, { human: 0 }); B = T.worm(0, 600, 30, { human: 0 }); A.kinId = B.kinId = 9; A.rejoinCd = B.rejoinCd = 0; B.segs.forEach((s, i) => { s.x = A.segs[39].x + 14 - i * SNK.SEG; s.y = 0; }); T.tick(1);
    R.eitherDirection = Snake.worms.filter(q => q.alive).length === 1 && Snake.worms[0] === A;
    return R;
  });
  // ---------------- (d) brake key
  await ev(() => { T.clear(); window.__A = T.worm(0, 0, 40, { human: 0 }); window.__B = T.worm(0, 400, 40, { human: 0 }); __A.kinId = __B.kinId = 31; __A.rejoinCd = __B.rejoinCd = 9999; __A.splitCd = __B.splitCd = 9999; });
  const speeds = (label) => ev(() => { const mv = (w) => { const x0 = w.segs[0].x, y0 = w.segs[0].y; return [x0, y0]; };
    const a0 = mv(__A), b0 = mv(__B); T.tick(10); const a1 = mv(__A), b1 = mv(__B); return { a: +(Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) / 10).toFixed(2), b: +(Math.hypot(b1[0] - b0[0], b1[1] - b0[1]) / 10).toFixed(2), slowed: [__A.slowed, __B.slowed] }; });
  const setCam = (x, y) => ev(([x, y]) => { Mix.cam.x = x; Mix.cam.y = y; }, [x, y]);
  out.d = {};
  await setCam(0, 150);                                    // screen centre is nearer to A (y=0) than B (y=400): B is the outer worm
  out.d.noKey = await speeds();
  const keyDown = async () => { await ev(() => { paused = false; }); await p.keyboard.down('KeyR'); await ev(() => { paused = true; }); };
  const keyUp = async () => { await ev(() => { paused = false; }); await p.keyboard.up('KeyR'); await ev(() => { paused = true; }); };
  await keyDown(); out.d.keyIsHeld = await ev(() => BrakePressed);
  await setCam(0, 150); out.d.keyHeldOuterB = await speeds();
  await ev(() => { __A.segs.forEach((s, i) => { s.x = -i * SNK.SEG; s.y = 0; }); __B.segs.forEach((s, i) => { s.x = -i * SNK.SEG; s.y = 400; }); __A.slowed = __B.slowed = false; });
  await setCam(0, 250);                                    // now B is nearer the centre, A is the outer worm
  out.d.keyHeldOuterA = await speeds();
  await keyUp(); out.d.keyIsReleased = !(await ev(() => BrakePressed)); await setCam(0, 250);
  out.d.keyReleased = await speeds();
  // three pieces: only ONE is slowed
  out.d.threePieces = await ev(() => { const C = T.worm(0, 800, 40, { human: 0 }); C.kinId = 31; C.rejoinCd = C.splitCd = 9999; BrakePressed = true; Mix.cam.x = 0; Mix.cam.y = 100; Snake.brakeStep(); BrakePressed = false; return [__A, __B, C].map(w => w.slowed ? 1 : 0).join(''); });
  // ---------------- camera follows the main worm and keeps the pieces in view
  out.cam = await ev(() => { T.clear(); const A = T.worm(0, 0, 50, { human: 0 }); const B = T.worm(1500, 0, 30, { human: 0 }); A.kinId = B.kinId = 5; const m = Mix.me(); return { leads: m.ref === A, span: Math.round(m.span), x: Math.round(m.x) }; });
  // ---------------- swapping with a bot while split: every piece changes hands together
  out.swap = await ev(() => {
    T.clear(); const A = T.worm(0, 0, 60, { human: 0 }); Snake.buildGrid(); T.spike(A.segs[30].x, A.segs[30].y, 3, 0); Mix.spikeSplit();
    const bot = T.worm(0, 900, 40, {}); const mine = Snake.worms.filter(q => q.human === 0);
    Snake.swapBot(); const nowHuman = Snake.worms.filter(q => q.human === 0).map(q => q === bot ? 'bot' : 'piece').join(',');
    return { pieces: mine.length, humansAfter: nowHuman, formerPiecesBots: mine.every(q => q.human === undefined) };
  });
  // ---------------- real game loop: a spike pushed at a worm during live play
  await ev(() => { SNK.PELLETS = 1400; SNK.CPUS = 0; TNK.CPUS = 0; cellsCfg.bots = 0; Mix.reset(); Mix.setBody('worm'); Cells.viruses = []; paused = false; });
  out.live = await ev(async () => {
    const w = Snake.localWorm(0); w.len = 70; w.safeT = 9999; w.segs = []; for (let i = 0; i < 70; i++) w.segs.push({ x: 300 - i * SNK.SEG, y: 0 });
    Cells.viruses.push({ x: 150, y: 120, m: 100, feed: 0, vx: 0, vy: -9, launched: 45 });
    for (let f = 0; f < 60; f++) await new Promise(r => requestAnimationFrame(r));
    return { pieces: Snake.worms.filter(q => q.human === 0 && q.alive).length, splits: Mix.stat.spikeSplit || 0 };
  });
  console.log(JSON.stringify(out, null, 1)); console.log(errs);
  const A = out.a, B = out.b, C = out.c, D = out.d;
  const ok = A.pieces === 2 && A.sameOwner && A.lenConserved && A.spikeUsed && A.feedback && A.stoppedSpikeNoSplit && A.headBandNoSplit && A.tailBandNoSplit && A.shortWormNoSplit && A.cooldownNoDoubleCut && A.onePieceDies && A.lastPieceDiesMeansDead
    && B.stillTwo && B.noGone && B.noDamage && B.headToHeadNoRejoin
    && C.oneWorm && C.keptFrontHead && C.lenOk && C.noKill && C.segsCombined && C.outsideLeewayStaysTwo && C.midBodyNoRejoin && C.thirdFromLastRejoins && C.cooldownHolds && C.rejoinsAfterCooldown && C.eitherDirection
    && D.keyIsHeld === true && D.keyIsReleased && D.noKey.a === D.noKey.b && D.noKey.slowed.join() === 'false,false'
    && D.keyHeldOuterB.slowed.join() === 'false,true' && D.keyHeldOuterB.b < D.keyHeldOuterB.a * 0.6 && D.keyHeldOuterB.a > 2.5
    && D.keyHeldOuterA.slowed.join() === 'true,false' && D.keyHeldOuterA.a < D.keyHeldOuterA.b * 0.6
    && D.keyReleased.slowed.join() === 'false,false' && D.keyReleased.a === D.keyReleased.b && D.threePieces === '001'
    && out.swap.pieces === 2 && out.swap.humansAfter === 'bot' && out.swap.formerPiecesBots && out.cam.leads && out.cam.span >= 2900 && out.live.pieces === 2 && out.live.splits >= 1 && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
