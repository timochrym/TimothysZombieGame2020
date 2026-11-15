const { open } = require('./lib');
const birds = process.argv[2] === 'birds';
(async () => {
  const { b, p, errs } = await open('siege');
  const out = [];
  for (const n of [0, 1, 2, 3, 4]) {
    await p.evaluate(([n, birds]) => { siegeSave.birds = birds; LevelManager.selectLevel(SIEGE_LEVELS[n]); Siege.shots = ['dummy', 'dummy', 'dummy', 'dummy', 'dummy']; }, [n, birds]);
    await p.waitForTimeout(600);
    const r = await p.evaluate(async () => {
      const log = [];
      // throw 4 bodies that land short / around the fort base (no direct hits on the towers)
      for (let s = 0; s < 5; s++) {
        const tw = movingObjects.filter(o => !o.dead).sort((a, b2) => b2.y - a.y)[s % 3] || movingObjects[0];
        const fake = { x: tw.x - 350, y: tw.y + 120, s1: 80, s2: 80, zombiePower: 'NORMAL', lastFacing: 1, xspeed: 0, yspeed: 0 };
        const rd = Ragdolls.spawnFrom(fake, { vx: 16 + s * 3, vy: 2, corpse: true, life: 900 }); rd.gScale = 0.55; rd.thrownBy = redGuy; rd.projectileTimer = 400;
        await new Promise(r => setTimeout(r, 3500));
      }
      // now watch 6 s with nobody touching anything: what moves, what dies?
      const zAlive0 = zombies.filter(z => !z.dead).length;
      const prev = new Map(); let bounces = 0, maxV = 0; const t0 = performance.now(); let movingFrames = 0;
      await new Promise(res => { (function f() {
        let mv = 0;
        movingObjects.forEach(o => { const pv = prev.get(o); if (pv !== undefined && pv < -3 && o.yspeed > 3) bounces++; prev.set(o, o.yspeed); const v = Math.hypot(o.xspeed, o.yspeed); maxV = Math.max(maxV, v); if (v > 1.5) mv++; });
        if (mv) movingFrames++;
        if (performance.now() - t0 < 6000) requestAnimationFrame(f); else res(); })(); });
      return { corpses: Ragdolls.list.length, bouncesAtRest: bounces, maxVAtRest: +maxV.toFixed(1), framesWithMovingCrates: movingFrames, zombiesDiedWhileIdle: zAlive0 - zombies.filter(z => !z.dead).length };
    });
    out.push(n + ' ' + JSON.stringify(r));
  }
  console.log((birds ? 'BIRDS ' : 'RAGDOLLS ') + '\n' + out.join('\n'), errs.slice(0, 3)); await b.close();
})();
