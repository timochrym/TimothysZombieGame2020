// Table Games, Word Hunt: every hidden word really is spelled in the grid; P1 finds one by mouse drag (backwards)
// and one with the keyboard cursor; the CPU finds words on its own.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('table', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { tableCfg.game = 'hunt'; tableCfg.vs = 'cpu'; tableCfg.level = 2; WordHunt.reset(); });
  await p.waitForTimeout(300);
  const info = await ev(() => ({ n: WordHunt.words.length, words: WordHunt.words.map(w => w.w).join(','), spelled: WordHunt.words.every(W => { const dx = Math.sign(W.b[0] - W.a[0]), dy = Math.sign(W.b[1] - W.a[1]); let s = ''; for (let i = 0; i < W.w.length; i++) s += WordHunt.g[W.a[1] + dy * i][W.a[0] + dx * i]; return s === W.w; }) }));
  // P1 drags across the first word with the real mouse (from its LAST letter to its first: backwards works too)
  const pts = await ev(() => { const G = WordHunt.geo(), W = WordHunt.words[0]; const c = p => [G.x0 + (p[0] + 0.5) * G.cs, G.y0 + (p[1] + 0.5) * G.cs]; return [c(W.b), c(W.a)]; });
  await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down(); await p.mouse.move(pts[1][0], pts[1][1], { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(150);
  const afterDrag = await ev(() => [WordHunt.words[0].by, WordHunt.score.slice()]);
  // P1 keyboard: walk the box to word 2's first letter, Space, to its last letter, Space
  await ev(() => { const W = WordHunt.words[1]; WordHunt.cur[0] = W.a.slice(); });
  await p.keyboard.down('Space'); await p.waitForTimeout(60); await p.keyboard.up('Space'); await p.waitForTimeout(60);
  await ev(() => { const W = WordHunt.words[1]; WordHunt.cur[0] = W.b.slice(); });
  await p.keyboard.down('Space'); await p.waitForTimeout(60); await p.keyboard.up('Space'); await p.waitForTimeout(120);
  const afterKeys = await ev(() => [WordHunt.words[1].by, WordHunt.score.slice()]);

  // the CPU (normal: one word every 10 s) keeps finding words
  await p.waitForTimeout(11000);
  console.log(JSON.stringify(info), 'drag ->', afterDrag, 'keys ->', afterKeys, 'after 11 s', await ev(() => WordHunt.score.slice()), errs.slice(0, 3));
  await b.close();
})();
