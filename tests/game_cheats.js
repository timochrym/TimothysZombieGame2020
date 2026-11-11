// Game-specific cheats (Cheats panel -> Game tab -> "This game"): Parkour Rush freeze clock (and no best time saved),
// Portal Lab portals on any wall, Ragdoll Siege unlimited shots, Stomp Squad infinite lives, Brawl "damage you take".
// Each is flipped through the same row object the panel uses, then checked in the game.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('race', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a);
  const row = (label, v) => ev(([l, x]) => { const r = GameTuning.rows().find(r => r.label === l); r.set(x); return r.get(); }, [label, v]);
  const out = {};
  // Parkour Rush
  await ev(() => { Race.phase = 'run'; Race.timer = 0; }); await p.waitForTimeout(500);
  out.raceRows = await ev(() => GameTuning.rows().map(r => r.label).join(', '));
  await row('Freeze the clock', true);
  const t0 = await ev(() => Race.time); await p.waitForTimeout(800); const t1 = await ev(() => Race.time);
  out.raceFrozen = t0 === t1 && t0 > 0 ? 'yes (' + t0 + ')' : 'NO ' + t0 + '->' + t1;
  // finish the run while cheating: no best time may be written
  out.raceNoBest = await ev(() => { const key = LevelManager.currentLevelKey, before = raceSave.best[key];
    Race.finish = { 0: 5 }; GameModes.current.finishRace ? GameModes.current.finishRace() : Race.finishRace && Race.finishRace();
    return 'cheated=' + Race.cheated + ' phase=' + Race.phase + ' best ' + before + ' -> ' + raceSave.best[key]; });
  await row('Freeze the clock', false);
  // Portal Lab: find a non-white wall the ray hits, fire at it with and without the cheat
  await ev(() => GameModes.launch('portal')); await p.waitForTimeout(1200);
  out.portal = await ev(() => {
    const ch = characters[0]; let dir = null;
    for (let a = 0; a < 360 && !dir; a += 5) { const dx = Math.cos(a * Math.PI / 180), dy = Math.sin(a * Math.PI / 180); const h = Portals.raycast(ch.x, ch.y + 10, dx, dy);
      if (h && !h.obj.portalable && (h.nx !== 0 ? h.obj.h : h.obj.w) >= PORTAL_LEN + 10) dir = [dx, dy]; }
    if (!dir) return 'no dark wall found';
    const aim = Portals.aimDir; Portals.aimDir = () => dir;
    Portals.clear(); Portals.place(ch, 0); const off = !!Portals.pairFor(ch.playerIndex)[0];
    gameCheats.portalAnywhere = true; Portals.clear(); Portals.place(ch, 0); const on = !!Portals.pairFor(ch.playerIndex)[0];
    gameCheats.portalAnywhere = false; Portals.aimDir = aim; Portals.clear();
    return 'dark wall: off=' + off + ' on=' + on;
  });
  // Ragdoll Siege: out of shots with zombies still standing
  await ev(() => GameModes.launch('siege')); await p.waitForTimeout(1500);
  await row('Unlimited shots', true);
  out.siege = await ev(() => { Siege.introT = 0; Siege.shotIdx = Siege.shots.length; Siege.phase = 'settle'; Siege.settleT = 400; return 'shots=' + Siege.shots.length; });
  await p.waitForTimeout(300);
  out.siege += await ev(() => ' -> phase=' + Siege.phase + ' shots=' + Siege.shots.length + ' over=' + !!gameOver);
  await row('Unlimited shots', false);
  // Stomp Squad: die with infinite lives on
  await ev(() => GameModes.launch('platform')); await p.waitForTimeout(1500);
  await row('Infinite lives', true);
  out.plat = await ev(() => { const l0 = Plat.lives; characters[0].y = -5000; return l0; });
  await p.waitForTimeout(1500);
  out.plat = 'lives ' + out.plat + ' -> ' + await ev(() => Plat.lives + ' (' + Plat.phase + ')');
  await row('Infinite lives', false);
  // Brawl: human takes no damage, CPU still does
  await ev(() => GameModes.launch('brawl')); await p.waitForTimeout(4500);
  await row('Damage you take', 0);
  out.brawl = await ev(() => { const h = characters.find(c => !c.isCPU), c = characters.find(c => c.isCPU); h.hitCooldown = 0; c.hitCooldown = 0; h.invulnTimer = 0; c.invulnTimer = 0;
    const a = h.damagePct, b2 = c.damagePct; brawlApplyHit(h, -30, 5, 5, c); brawlApplyHit(c, -30, -5, 5, h); return 'human ' + Math.round(a) + '->' + Math.round(h.damagePct) + ', cpu ' + Math.round(b2) + '->' + Math.round(c.damagePct); });
  await row('Damage you take', 1);
  console.log(JSON.stringify(out, null, 1)); console.log(errs);
  const ok = /^yes/.test(out.raceFrozen) && /phase=done best (\w+) -> \1$/.test(out.raceNoBest) && /off=false on=true/.test(out.portal) && /phase=aim/.test(out.siege) && /lives (\d+) -> \1 /.test(out.plat) && /human (\d+)->\1,/.test(out.brawl) && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
