// Enemy chase: on every Survival level, enemies start at spread-out spots (different floors) while the hero stands
// still, then while the hero walks. Measures per enemy: seconds until it touches the hero, and "stuck" time (hardly
// moving, far from the hero, not frozen). Prints a table; exits non-zero when the averages are worse than the limits.
//   node enemy_chase.js            (all levels)      node enemy_chase.js bounce_chaos   (one level)
const { open } = require('./lib');
const LEVELS = ['classic_arena', 'zigzag_tower', 'bunker_bridges', 'bounce_chaos', 'stress_test'];
const KINDS = ['NORMAL', 'LEAPER', 'KNIGHT'];
(async () => {
  const only = process.argv[2]; const rows = []; const allErrs = [];
  for (const lvl of LEVELS.filter(l => !only || l === only)) {
    const { b, p, errs } = await open('survival', { w: 1280, h: 720 });
    await p.evaluate((l) => { LevelManager.selectLevel(l); }, lvl); await p.waitForTimeout(1200);
    for (const mode of ['still', 'walking']) {
      const r = await p.evaluate(async ([mode, kinds]) => {
        SummonManager.pauseWaves = true; godMode = true; zombies.length = 0; lazers.length = 0;
        const hero = redGuy; const hx0 = hero.x, hy0 = hero.y;
        // spawn spots: tops of platforms, spread over the level, away from the hero
        const tops = staticObjects.filter(o => !o.isRamp && !o.dead && (o.w || 0) >= 160 && Math.hypot(o.x - hx0, o.y - hy0) > 450).map(o => ({ x: o.x + ((o.w || 0) * 0.25) * (Math.random() < 0.5 ? -1 : 1), y: o.y + (o.h || 0) / 2 + 70 }));
        const pts = []; const step = Math.max(1, Math.floor(tops.length / 9)); for (let i = 0; i < tops.length && pts.length < 9; i += step) pts.push(tops[i]);
        const list = pts.map((pt, i) => { spawnZombie(kinds[i % kinds.length], pt.x, pt.y); const z = zombies[zombies.length - 1]; z.hunter = true; z.maxHealth = z.health = 99999; z.t0 = null; z.reach = -1; z.stuck = 0; z.px = z.x; z.py = z.y; z.far = 0; return z; });
        const T = 60 * 22, out = { n: list.length, reached: 0, times: [], stuck: [], farEnd: [], why: [] };
        let dir = 1, leg = 0;
        for (let f = 0; f < T; f++) {
            await new Promise(r => requestAnimationFrame(r));
            if (mode === 'walking') { leg++; if (leg > 55) { leg = 0; dir = -dir; } /* short legs (about 500 px) so the hero stays on its platform */ hero.rightPressed = dir > 0; hero.leftPressed = dir < 0; }
            for (const z of list) {
                if (z.dead) continue;
                const d = Math.hypot(z.x - hero.x, z.y - hero.y);
                if (z.reach < 0 && d < 190 && Math.abs(z.y - hero.y) < 110) z.reach = f / 60;      // melee enemies stop about 130 px beside the hero on purpose (they surround it)
                if (f % 30 === 29) { const moved = Math.hypot(z.x - z.px, z.y - z.py); if (z.reach < 0 && d > 200 && moved < 6 && z.frozenTimer <= 0) z.stuck += 0.5; z.px = z.x; z.py = z.y; }
            }
        }
        hero.rightPressed = hero.leftPressed = false;
        for (const z of list) { if (z.reach >= 0) { out.reached++; out.times.push(z.reach); } else out.times.push(22); out.stuck.push(z.stuck); out.farEnd.push(Math.round(Math.hypot(z.x - hero.x, z.y - hero.y)));
          if (z.reach < 0) out.why.push([z.zombiePower, 'dx' + Math.round(hero.x - z.x), 'dy' + Math.round(hero.y - z.y), z.onGround ? 'gnd' : 'air', 'path' + (z.navPath ? z.navPath.length : '-'), (z.navPath && z.navPath[0] && z.navPath[0].action) || '-', z.navDirect ? 'direct' : '', 'stuck' + (z.stuckTimer | 0)].join(' '));
        }
        zombies.length = 0; hero.x = hx0; hero.y = hy0; hero.xspeed = hero.yspeed = 0;
        return out;
      }, [mode, KINDS]);
      const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
      rows.push({ lvl, mode, n: r.n, reached: r.reached, avgTime: +avg(r.times).toFixed(1), avgStuck: +avg(r.stuck).toFixed(1), worst: Math.max(...r.stuck), farEnd: r.farEnd.join(','), why: r.why });
    }
    allErrs.push(...errs); await b.close();
  }
  console.log('level'.padEnd(16) + 'hero'.padEnd(9) + 'reached  avg time(s)  avg stuck(s)  worst stuck  left behind (px)');
  for (const r of rows) { if (process.env.WHY) r.why.forEach(w => console.log('      ' + r.lvl + '/' + r.mode + ': ' + w)); }
  for (const r of rows) console.log(r.lvl.padEnd(16) + r.mode.padEnd(9) + (r.reached + '/' + r.n).padEnd(9) + String(r.avgTime).padEnd(14) + String(r.avgStuck).padEnd(14) + String(r.worst).padEnd(13) + r.farEnd);
  const tot = k => rows.reduce((a, r) => a + r[k] * r.n, 0) / rows.reduce((a, r) => a + r.n, 0);
  const summary = { reachedPct: Math.round(rows.reduce((a, r) => a + r.reached, 0) / rows.reduce((a, r) => a + r.n, 0) * 100), avgTime: +tot('avgTime').toFixed(1), avgStuck: +tot('avgStuck').toFixed(1) };
  console.log(JSON.stringify(summary), allErrs.slice(0, 3));
  const LIM = { reachedPct: +(process.env.MIN_REACHED || 85), avgTime: +(process.env.MAX_TIME || 12), avgStuck: +(process.env.MAX_STUCK || 3) };
  const ok = summary.reachedPct >= LIM.reachedPct && summary.avgTime <= LIM.avgTime && summary.avgStuck <= LIM.avgStuck && !allErrs.length;
  console.log(ok ? 'PASS' : 'FAIL  (limits: reached >= ' + LIM.reachedPct + '%, avg time <= ' + LIM.avgTime + ' s, avg stuck <= ' + LIM.avgStuck + ' s)');
  process.exit(ok ? 0 : 1);
})();
