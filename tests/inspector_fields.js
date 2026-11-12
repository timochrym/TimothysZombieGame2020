// Inspector: Weight / Impact damage / Gravity rows for physics blocks, and "All fields" (every value on the object,
// editable). Block impact damage: scales with weight, heroes only get bruised by a stray crate. Exits non-zero on failure.
const { open } = require('./lib'); const path = require('path');
(async () => {
  const { b, p, errs } = await open('survival', { w: 1280, h: 720 });
  const ev = (f, a) => p.evaluate(f, a); const out = {};
  await ev(() => { SummonManager.pauseWaves = true; zombies.length = 0; }); await p.waitForTimeout(600);
  // select a crate through the inspector
  await ev(() => { SummonManager.togglePanel(); DevUI.switchTab('inspect'); const c = movingObjects.find(o => o.name === 'Crate'); SummonManager.selectObject(c); });
  await p.waitForTimeout(300);
  out.rows = await ev(() => ['weight', 'impact', 'grav'].map(k => k + ':' + (getComputedStyle(document.getElementById('sp-edit-' + k + '-row')).display !== 'none')).join(' '));
  // drag the Weight slider through the real input event
  await ev(() => { const el = document.getElementById('sp-edit-weight'); el.value = 4; el.dispatchEvent(new Event('input', { bubbles: true })); });
  out.weightSet = await ev(() => SummonManager.selectedObject.weight);
  // All fields: open, count, edit a number, a text and a switch
  await p.click('#sp-all-fields summary'); await p.waitForTimeout(200);
  out.allCount = await ev(() => document.querySelectorAll('#sp-all-rows [data-field]').length + ' editable of ' + document.getElementById('sp-all-count').textContent);
  await p.fill('#sp-all-rows [data-field="bounciness"]', '0.9');
  await ev(() => { const el = document.querySelector('#sp-all-rows [data-field="noCollide"]') || document.querySelector('#sp-all-rows input[type=checkbox]'); window.__bf = el.dataset.field; el.click(); });
  out.edited = await ev(() => { const o = SummonManager.selectedObject; return 'bounciness=' + o.bounciness + ' ' + __bf + '=' + o[__bf]; });
  await ev(() => { const o = SummonManager.selectedObject; o[__bf] = !o[__bf]; });
  await p.fill('#sp-all-filter', 'speed'); await p.waitForTimeout(150);
  out.filter = await ev(() => [...document.querySelectorAll('#sp-all-rows label[title]')].map(l => l.title).join(','));
  await p.fill('#sp-all-filter', ''); await p.screenshot({ path: path.join(__dirname, 'shots', 'inspector_fields.png') });
  // a character has every field too (speed, jumpSpeed, maxHealth…)
  await ev(() => { spawnZombie('TANK', redGuy.x + 400, redGuy.y + 40); SummonManager.selectObject(zombies[zombies.length - 1]); }); await p.waitForTimeout(200);
  out.enemyFields = await ev(() => { const k = [...document.querySelectorAll('#sp-all-rows [data-field]')].map(e => e.dataset.field); return k.length + ' incl. ' + ['speed', 'jumpSpeed', 'maxHealth', 'health'].filter(x => k.includes(x)).join(','); });
  await ev(() => SummonManager.togglePanel());
  // ---- block impact damage ----
  const hit = (weight, speed, thrown, victim, mult) => ev(([w, sp, th, vic, m]) => {
    zombies.length = 0; spawnZombie('TANK', redGuy.x + 600, redGuy.y + 40); const z = zombies[0]; z.maxHealth = z.health = 5000;
    const c = movingObjects.find(o => o.name === 'Crate'); c.weight = w; c.impactMult = m === null ? undefined : m; c.xspeed = sp; c.yspeed = 0; c.thrownTimer = th ? 30 : 0; c.thrownBy = th ? { fake: 1 } : null;
    const t = vic === 'hero' ? redGuy : z; godMode = false; t.hitCooldown = 0; t.invulnTimer = 0; t.dashTimer = 0; t.shield = 0; const h0 = t.health; if (vic === 'hero') { t.maxHealth = 100; t.health = 100; }
    const before = t.health; c.checkThrownImpact(t); const d = Math.round(before - t.health); if (vic === 'hero') { t.health = 100; if (t.liveRagdoll) t.endLiveRagdoll(); t.ragdollTimer = 0; } return d; }, [weight, speed, thrown, victim, mult === undefined ? null : mult]);
  out.dmg = {
    enemy_w1_fast: await hit(1, 20, true, 'enemy'), enemy_w4_fast: await hit(4, 20, true, 'enemy'), enemy_w025_fast: await hit(0.25, 20, true, 'enemy'),
    enemy_impact0: await hit(1, 20, true, 'enemy', 0),
    hero_bumped_slow: await hit(1, 12, false, 'hero'), hero_bumped_fast: await hit(1, 26, false, 'hero'), hero_bumped_heavy: await hit(6, 26, false, 'hero'), hero_thrownAt: await hit(1, 26, true, 'hero')
  };
  console.log(JSON.stringify(out, null, 1)); console.log(errs);
  const d = out.dmg;
  const ok = out.rows === 'weight:true impact:true grav:true' && out.weightSet === 4 && parseInt(out.allCount) > 15 && /bounciness=0.9/.test(out.edited) && /speed/.test(out.filter) && /speed,jumpSpeed,maxHealth,health/.test(out.enemyFields)
    && d.enemy_w4_fast > d.enemy_w1_fast && d.enemy_w1_fast > d.enemy_w025_fast && d.enemy_impact0 === 0 && d.hero_bumped_slow === 0 && d.hero_bumped_fast > 0 && d.hero_bumped_fast <= 18 && d.hero_bumped_heavy <= 18 && d.hero_thrownAt <= 35 && d.hero_thrownAt > d.hero_bumped_fast && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();
