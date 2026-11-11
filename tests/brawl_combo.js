// Brawl combo limits: 8 quick punches on the same fighter. Each chained hit does less (80% of the one before, floor 35%),
// stun shrinks, the 6th is a COMBO BREAK (victim invulnerable for a moment), and a hit after a pause is full strength again.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('brawl', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a);
  await p.waitForTimeout(4500);
  const out = await ev(() => {
    paused = true;
    const a = characters[0], v = characters[1]; const log = [];
    v.damagePct = 0; v.brChain = 0; v.brHitT = undefined; v.invulnTimer = 0; v.shield = 0; v.shielding = false;
    for (let i = 0; i < 8; i++) {
      brawl.tick += 13; v.hitCooldown = 0; v.dashTimer = 0; if (i !== 6) {} 
      const before = v.damagePct, inv = v.invulnTimer > 0;
      brawlApplyHit(v, -12, 5, 3, a);
      log.push({ hit: i + 1, added: +(v.damagePct - before).toFixed(2), stun: v.hitstun, blocked: inv });
      if (v.invulnTimer > 0 && i >= 5) v.invulnTimer = Math.max(0, v.invulnTimer - 13);
    }
    const total = +v.damagePct.toFixed(1);
    // a fresh hit after a pause is full strength
    brawl.tick += 200; v.hitCooldown = 0; v.invulnTimer = 0; const b4 = v.damagePct; brawlApplyHit(v, -12, 5, 3, a);
    paused = false;
    return { log, total, freshAfterPause: +(v.damagePct - b4).toFixed(2) };
  });
  console.log(out.log.map(l => '#' + l.hit + ' +' + l.added + '% stun ' + l.stun + (l.blocked ? ' (invulnerable)' : '')).join('\n'));
  console.log('total after 8 quick punches:', out.total + '%  (without limits: 33.6%)   fresh hit after a pause: +' + out.freshAfterPause + '%'); console.log(errs);
  const L = out.log;
  const ok = L[0].added === 4.2 && L[1].added < L[0].added && L[2].added < L[1].added && L[5].stun <= 6 && L[6].added === 0 && L[6].blocked && out.total < 22 && out.freshAfterPause === 4.2 && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
