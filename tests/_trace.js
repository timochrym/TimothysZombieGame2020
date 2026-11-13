const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('survival', { w: 1280, h: 720 });
  await p.evaluate((l) => LevelManager.selectLevel(l), process.argv[2] || 'bunker_bridges'); await p.waitForTimeout(1200);
  const r = await p.evaluate(async () => {
    SummonManager.pauseWaves = true; godMode = true; zombies.length = 0;
    const hero = redGuy, hx0 = hero.x, hy0 = hero.y;
    const tops = staticObjects.filter(o => !o.isRamp && !o.dead && (o.w || 0) >= 160 && Math.hypot(o.x - hx0, o.y - hy0) > 450).map(o => ({ x: o.x + (o.w * 0.25), y: o.y + o.h / 2 + 70 }));
    const pts = []; const step = Math.max(1, Math.floor(tops.length / 9)); for (let i = 0; i < tops.length && pts.length < 9; i += step) pts.push(tops[i]);
    const kinds = ['NORMAL', 'LEAPER', 'KNIGHT'];
    const list = pts.map((pt, i) => { spawnZombie(kinds[i % 3], pt.x, pt.y); const z = zombies[zombies.length - 1]; z.hunter = true; z.maxHealth = z.health = 99999; z.tr = []; return z; });
    for (let f = 0; f < 60 * 16; f++) { await new Promise(r => requestAnimationFrame(r)); if (f % 60 === 0) for (const z of list) z.tr.push([Math.round(z.x), Math.round(z.y - z.s2 / 2), z.navPath && z.navPath[0] ? z.navPath[0].action + '@' + Math.round(z.navPath[0].x) + ',' + Math.round(z.navPath[0].y) : '-', z.navNodeId, z.leftPressed ? 'L' : (z.rightPressed ? 'R' : '.'), z.upPressed ? 'U' : ''].join(' ')); }
    return { hero: [Math.round(hero.x), Math.round(hero.y - hero.s2 / 2)], list: list.map(z => ({ kind: z.zombiePower, d: Math.round(Math.hypot(z.x - hero.x, z.y - hero.y)), tr: z.tr })) };
  });
  console.log('hero foot', r.hero);
  r.list.filter(z => z.d > 300).slice(0, 2).forEach(z => { console.log('---', z.kind, 'final distance', z.d); z.tr.forEach((t, i) => console.log(String(i).padStart(2), t)); });
  console.log(errs); await b.close();
})();
