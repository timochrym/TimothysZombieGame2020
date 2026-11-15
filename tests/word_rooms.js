const { open } = require('./lib');
// each new room: can it be solved with its intended word, and NOT by just walking right?
(async () => {
  const { b, p, errs } = await open('words', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  const out = {};
  const run = async (room, word, mouseWorld, steps) => {
    await ev((k) => LevelManager.selectLevel(k), room); await p.waitForTimeout(800);
    if (word) {
      await ev(([w, m]) => { Components.getMouseWorldPos = (function(orig) { return function() { return m || orig(); }; })(Components.getMouseWorldPos); WordLab.make(w); }, [word, mouseWorld]);
      await p.waitForTimeout(600);
    }
    for (const s of steps) { if (s.k) await p.keyboard.down(s.k); await p.waitForTimeout(s.t || 0); if (s.k) await p.keyboard.up(s.k); if (s.f) await ev(s.f); }
    return await ev(() => [Gadgets.starsGot + '/' + Gadgets.starsTotal, Math.round(redGuy.x), Math.round(redGuy.y), WordLab.done]);
  };
  out.lowDoor_noWord = await run('words_5', null, null, [{ k: 'KeyD', t: 3000 }]);
  out.lowDoor_shrink = await run('words_5', 'shrink', null, [{ k: 'KeyD', t: 3500 }]);
  out.tower_noWord = await run('words_6', null, null, [{ k: 'KeyD', t: 2500 }]);
  
  out.tower_bigStairs = await run('words_6', 'giant stairs', [-200, 40], [{ k: 'KeyD', t: 4000 }]);
  out.plate_noWord = await run('words_7', null, null, [{ k: 'KeyD', t: 3000 }]);
  out.plate_boulder = await run('words_7', 'boulder', [-200, 120], [{ t: 800 }, { f: () => { redGuy.x = 0; } }, { k: 'KeyD', t: 3500 }]);
  console.log(JSON.stringify(out, null, 1), errs.slice(0, 3));
  await b.close();
})();
