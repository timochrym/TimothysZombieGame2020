// Menu panel -> Game Rules: "Split worm into (pieces)" slider, "Pieces can rejoin" switch, "Split my worm now" button.
// Uses the real panel DOM (slider input, button click, checkbox click). Checks: N pieces (any number up to the length limit),
// length and owner kept, rejoin off = pieces never recombine, rejoin on = they do, short worm makes fewer, Worm Arena has the rows too.
const { open } = require('./lib'); const path = require('path');
(async () => {
  const { b, p, errs } = await open('mix', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a); const out = {};
  await ev(() => { localStorage.removeItem('timsWormSplitCfg'); SNK.CPUS = 0; TNK.CPUS = 0; cellsCfg.bots = 0; SNK.PELLETS = 0; Mix.reset(); Mix.setBody('worm'); Cells.viruses = []; });
  await p.waitForTimeout(400);
  await ev(() => { SandboxUI.pauseOpen = false; SandboxUI.sideOpen = true; SandboxUI.sideTab = 'game'; SandboxUI.render(); });
  await p.waitForTimeout(300);
  const rowIdx = (label) => ev((l) => GameTuning.rows().findIndex(r => r.label === l), label);
  const iPieces = await rowIdx('Split worm into (pieces)'), iRejoin = await rowIdx('Pieces can rejoin (head to tail)'), iBtn = await rowIdx('✂ Split my worm now');
  out.rowsInMix = [iPieces, iRejoin, iBtn].every(i => i >= 0);
  out.domControls = await ev(([a, b2, c]) => [!!document.querySelector('[data-gtune="' + a + '"]'), !!document.querySelector('[data-gtune="' + b2 + '"]'), !!document.querySelector('[data-gbtn="' + c + '"]')].join(','), [iPieces, iRejoin, iBtn]);
  await p.screenshot({ path: path.join(__dirname, 'shots', 'worm_split_menu.png') });
  const setPieces = (n) => ev(([i, n]) => { const el = document.querySelector('[data-gtune="' + i + '"]'); el.value = n; el.dispatchEvent(new Event('input', { bubbles: true })); }, [iPieces, n]);
  const longWorm = (len) => ev((len) => { paused = true; Tanks.tanks = []; Cells.players = []; Cells.blobs = []; Snake.worms = []; Snake.pellets = []; const w = Snake.spawn({ name: 'W', color: '#f472b6', human: 0 }); w.len = len; w.safeT = 0; w.ang = w.want = 0; w.segs = []; for (let i = 0; i < len; i++) w.segs.push({ x: 2000 - i * SNK.SEG, y: 0 }); Mix.me(); return len; }, len);
  const mine = () => ev(() => Snake.worms.filter(q => q.human === 0 && q.alive).map(q => ({ len: Math.round(q.len), segs: q.segs.length, ang: +q.ang.toFixed(2), kin: q.kinId, mx: q.mx === Snake.worms[0].mx })));
  // ---- 6 pieces from a worm of 120
  await longWorm(120); await setPieces(6);
  out.sliderValue = await ev((i) => snakeCfg.pieces + ' / saved ' + JSON.parse(localStorage.getItem('timsWormSplitCfg')).pieces, iPieces);
  await p.click('[data-gbtn="' + iBtn + '"]'); await p.waitForTimeout(150);
  let m = await mine();
  out.six = m.length + ' pieces, lengths ' + m.map(q => q.len).join('+') + ' = ' + m.reduce((a, q) => a + q.len, 0);
  out.sixOk = m.length === 6 && m.reduce((a, q) => a + q.len, 0) === 120 && new Set(m.map(q => q.kin)).size === 1 && m.every(q => q.len === 20) && new Set(m.map(q => q.ang)).size >= 5;
  out.sixSameOwner = await ev(() => Snake.worms.every(q => q.human === 0 && q.name === Snake.worms[0].name && q.color === Snake.worms[0].color && q.mx === Snake.worms[0].mx));
  // ---- as many as wanted: 30 pieces from a long worm; a short worm makes fewer
  await longWorm(150); await setPieces(30); await p.click('[data-gbtn="' + iBtn + '"]'); m = await mine(); out.thirty = m.length;
  await longWorm(24); await setPieces(30); await p.click('[data-gbtn="' + iBtn + '"]'); m = await mine(); out.shortWorm = '24-long worm asked for 30 -> ' + m.length + ' pieces';
  await longWorm(5); await setPieces(4); await p.click('[data-gbtn="' + iBtn + '"]'); m = await mine(); out.tooShort = m.length;
  // ---- rejoin switch: OFF = pieces never recombine, ON = they do
  const touchTest = () => ev(() => { // a 2-piece split; bring piece A's head onto piece B's tail, then run frames
    Snake.worms = []; const mk = (y, len) => { const w = Snake.spawn({ name: 'W', color: '#f472b6', human: 0 }); w.len = len; w.safeT = 0; w.ang = w.want = 0; w.segs = []; for (let i = 0; i < len; i++) w.segs.push({ x: 0 - i * SNK.SEG, y }); return w; };
    const B = mk(0, 40), A = mk(600, 30); A.kinId = B.kinId = 99; A.rejoinCd = B.rejoinCd = 0;
    A.segs.forEach((s, i) => { s.x = B.segs[39].x + 14 - i * SNK.SEG; s.y = 0; });
    for (let f = 0; f < 5; f++) { Mix.t++; Snake.step(); }
    return Snake.worms.filter(q => q.alive).length; });
  await ev(() => { paused = true; });
  const cb = '[data-gtune="' + iRejoin + '"]';
  out.rejoinDefault = await ev(() => snakeCfg.rejoin);
  await p.click(cb); await p.waitForTimeout(100);
  out.rejoinOffFlag = await ev(() => snakeCfg.rejoin === false && JSON.parse(localStorage.getItem('timsWormSplitCfg')).rejoin === false);
  out.offTouching = await touchTest();                                   // expect 2: touching head to tail does nothing
  await p.click(cb); await p.waitForTimeout(100);
  out.rejoinOnFlag = await ev(() => snakeCfg.rejoin === true);
  out.onTouching = await touchTest();                                    // expect 1: they recombine
  // the hint line says so while off
  // ---- Worm Arena (plain) has the rows too, and the button works there
  await ev(() => { GameModes.launch('snake'); }); await p.waitForTimeout(600);
  out.rowsInWormArena = await ev(() => GameTuning.rows().filter(r => /Split worm|Pieces can rejoin|Split my worm/.test(r.label)).length);
  await ev(() => { SandboxUI.sideOpen = true; SandboxUI.sideTab = 'game'; SandboxUI.render(); }); await p.waitForTimeout(200);
  out.wormArenaDom = await ev(() => document.querySelectorAll('[data-gbtn]').length);
  await ev(() => { paused = true; const w = Snake.localWorm(0); w.len = 60; w.segs.length = 60; for (let i = 0; i < 60; i++) w.segs[i] = { x: -i * SNK.SEG, y: 0 }; snakeCfg.pieces = 3; });
  const iBtn2 = await rowIdx('✂ Split my worm now'); await p.click('[data-gbtn="' + iBtn2 + '"]'); out.wormArenaSplit = (await mine()).length;
  console.log(JSON.stringify(out, null, 1)); console.log(errs);
  const ok = out.rowsInMix && out.domControls === 'true,true,true' && out.sliderValue === '6 / saved 6' && out.sixOk && out.sixSameOwner && out.thirty === 30 && out.shortWorm === '24-long worm asked for 30 -> 8 pieces' && out.tooShort === 1
    && out.rejoinDefault === true && out.rejoinOffFlag && out.offTouching === 2 && out.rejoinOnFlag && out.onTouching === 1 && out.rowsInWormArena === 3 && out.wormArenaDom >= 1 && out.wormArenaSplit === 3 && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
