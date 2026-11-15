// Brawl character moves: each hero look's E move hits a CPU placed in front (Original = shockwave, Stick = Rising
// Uppercut, Brawler = Ground Slam, Cap = Rocket Punch). Prints the CPU's damage per move; all should be > 0.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('brawl', { w: 1100, h: 650 });
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { brawlCfg.stage = 'brawl_battlefield'; GameModes.launch('brawl'); });
  await p.waitForTimeout(3800);
  const out = {};
  for (const skin of ['original', 'stick', 'brawler', 'cap']) {
    const r = await ev((skin) => {
      heroSkins[0] = skin;
      const c = characters.find(c => c !== redGuy && !c.eliminated); window.__c = c;
      redGuy.dead = false; redGuy.x = brawl.stage.centerX - 150; redGuy.y = brawl.stage.topY + redGuy.s2 / 2 + 2; redGuy.xspeed = redGuy.yspeed = 0; redGuy.lastFacing = 1;
      redGuy.brSpCd = 0; redGuy.abilityCooldown = 0; redGuy.brSlam = 0; redGuy.brDash = 0; redGuy.liveRagdoll = null; redGuy.hitstun = 0;
      c.isCPU_save = c.isCPU; c.dead = false; c.x = redGuy.x + 120; c.y = redGuy.y; c.xspeed = c.yspeed = 0; c.damagePct = 0; c.shielding = false; c.invulnTimer = 0; c.dashTimer = 0; c.hitCooldown = 0;
      window.__x0 = c.x; window.__y0 = c.y;
      return true;
    }, skin);
    await p.keyboard.down('KeyE'); await p.waitForTimeout(90); await p.keyboard.up('KeyE');
    await p.waitForTimeout(1200);
    out[skin] = await ev(() => ({ cpuPct: Math.round(__c.damagePct), moved: [Math.round(__c.x - __x0), Math.round(__c.y - __y0)] }));
    await ev(() => { if (__c.liveRagdoll) { Ragdolls.remove(__c.liveRagdoll); __c.liveRagdoll = null; } });
    await p.waitForTimeout(300);
  }
  console.log(JSON.stringify(out), errs.slice(0, 3));
  await b.close();
})();
