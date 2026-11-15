const { open } = require('./lib');
(async () => {
  const { b, p } = await open('survival', { w: 1280, h: 720 });
  await p.evaluate(([l, d]) => { window.__pfDbg = d; LevelManager.selectLevel(l); }, [process.argv[2] || 'zigzag_tower', JSON.parse(process.env.PFDBG || '{}')]); await p.waitForTimeout(1200);
  console.log(JSON.stringify(await p.evaluate(() => {
    const hero = redGuy, tFoot = hero.y - hero.s2 / 2, goal = Pathfinder.goalNode(hero.x, tFoot), out = { hero: [Math.round(hero.x), Math.round(tFoot)], goal: goal && [goal.id, Math.round(goal.x), Math.round(goal.y)] };
    const total = Pathfinder.nodes.filter(Boolean).length; out.nodes = total;
    for (const [name, prof] of [['normal', NAV_PROFILES.normal], ['high', NAV_PROFILES.high], ['leaper', NAV_PROFILES.leaper]]) {
      const f = Pathfinder.getField(goal, prof, false); if (!f) { out[name] = 'no field'; continue; }
      const ok = Pathfinder.nodes.filter(n => n && f.dist[n.id] !== Infinity).length; out[name] = ok + ' of ' + total + ' nodes can reach the hero';
      const gnd = Pathfinder.nodes.filter(n => n && n.y < 60).length, gok = Pathfinder.nodes.filter(n => n && n.y < 60 && f.dist[n.id] !== Infinity).length; out[name] += ' (floor nodes: ' + gok + ' of ' + gnd + ')';
    }
    return out; }), null, 1));
  await b.close();
})();
