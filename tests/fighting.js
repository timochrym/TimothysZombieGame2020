// Fighting (fighting.js): Weapon = Fists turns the fire button into punch, punch, KICK; UP+fire uppercut; air DOWN+fire
// ground pound; no bullets fired, no gun drawn. Ammo setting (unlimited by default). Ragdoll-on-hit: off / short / full.
// Brawl with fists: CPUs walk in and punch. Settings rows in Pause -> Settings and the panel's shared box.
const { open } = require('./lib');
(async () => {
  const { b, p, errs } = await open('survival', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a);
  const out = {};
  await ev(() => { SummonManager.pauseWaves = true; zombies.length = 0; settings.weapon = 'fists'; settings.hitRagdoll = 'short'; });
  await p.waitForTimeout(1500);
  // one tough enemy right in front of the hero, standing on the same floor
  const place = () => ev(() => { zombies.length = 0; lazers.length = 0; spawnZombie('TANK', redGuy.x + 95, redGuy.y + 20); const z = zombies[zombies.length - 1]; z.maxHealth = z.health = 2000; z.moveType = 'NONE'; redGuy.lastFacing = 1; return z.health; });
  await place(); await p.waitForTimeout(500);
  const hp0 = await ev(() => zombies[0].health);
  const moves = [];
  for (let i = 0; i < 3; i++) {
    await p.keyboard.down('KeyF'); await p.waitForTimeout(60);
    moves.push(await ev(() => redGuy.mlMove)); await p.keyboard.up('KeyF'); await p.waitForTimeout(400);
  }
  out.combo = moves.join(' > ');
  out.comboDamage = await ev(h => Math.round(h - zombies[0].health), hp0);
  out.bulletsFired = await ev(() => lazers.filter(l => l.owner === redGuy).length);
  await p.screenshot({ path: __dirname + '/shots/fists_survival.png' });
  // uppercut: hold W + F
  await p.keyboard.down('KeyW'); await p.keyboard.down('KeyF'); await p.waitForTimeout(60);
  out.upper = await ev(() => redGuy.mlMove + ' heroRising=' + (redGuy.yspeed > 0));
  await p.keyboard.up('KeyF'); await p.keyboard.up('KeyW'); await p.waitForTimeout(900);
  // ground pound: jump, then S + F in the air, landing next to the enemy
  await place(); await p.waitForTimeout(300);
  const hp1 = await ev(() => zombies[0].health);
  await ev(() => { redGuy.yspeed = 16; redGuy.onGround = false; });
  await p.waitForTimeout(250);
  await p.keyboard.down('KeyS'); await p.keyboard.down('KeyF'); await p.waitForTimeout(80);
  out.poundStarted = await ev(() => !!redGuy.mlPound);
  await p.keyboard.up('KeyF'); await p.keyboard.up('KeyS'); await p.waitForTimeout(1200);
  out.poundDamage = await ev(h => Math.round(h - zombies[0].health), hp1);
  // ammo: unlimited by default, limited on request
  out.ammo = await ev(() => { const a = redGuy.unlimitedAmmo(); settings.ammo = 'limited'; const b2 = redGuy.unlimitedAmmo(); settings.ammo = 'unlimited'; return 'default unlimited=' + a + ', limited -> unlimited=' + b2; });
  // ragdoll on hit
  out.ragdoll = await ev(() => ['off', 'short', 'full'].map(m => { settings.hitRagdoll = m; redGuy.ragdollTimer = 0; redGuy.ragdollImmune = 0; if (redGuy.liveRagdoll) redGuy.endLiveRagdoll();
    redGuy.startRagdoll(5, 5, 55); const t = redGuy.ragdollTimer; if (redGuy.liveRagdoll) redGuy.endLiveRagdoll(); redGuy.ragdollTimer = 0; return m + ':' + t; }).join(' '));
  await ev(() => { settings.hitRagdoll = 'short'; });
  // menus
  out.pauseRows = await ev(() => { pauseSub = 'settings'; const r = pauseItems().filter(i => /^s(weapon|ammo|ragdoll)$/.test(i.id)).map(i => i.label.replace(/\s+/g, ' ')); pauseSub = null; return r; });
  out.panelRows = await ev(() => SHARED_TUNABLES.map(r => r.label.replace(' (every game)', '')).join(', '));
  // blaster again: a shot comes out and the gun is back
  await ev(() => { settings.weapon = 'blaster'; lazers.length = 0; redGuy.lazerCooldown = 0; window.__n = 0; const push = lazers.push; lazers.push = function(l) { if (l.owner === redGuy) __n++; return push.apply(this, arguments); }; });
  await p.keyboard.down('KeyF'); await p.waitForTimeout(250); await p.keyboard.up('KeyF');
  out.blasterShots = await ev(() => __n);

  // Brawl with fists: 1 human (idle) + CPUs; CPUs should close in and land punches
  await ev(() => { settings.weapon = 'fists'; GameModes.launch('brawl'); }); await p.waitForTimeout(9000);
  out.brawl = await ev(() => characters.map(c => (c.playerLabel || '?') + ' hits=' + (c.fightHits || 0) + ' dmg=' + Math.round(c.damagePct || 0) + '%').join(' | '));
  await p.screenshot({ path: __dirname + '/shots/fists_brawl.png' });
  await ev(() => { settings.weapon = 'blaster'; });
  console.log(JSON.stringify(out, null, 1)); console.log(errs);
  await b.close();
})();
