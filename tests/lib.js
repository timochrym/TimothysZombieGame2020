const { chromium } = require('playwright');
exports.open = async function(mode, opts = {}) {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: opts.w || 1280, height: opts.h || 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript(() => { const O = Object; window.__O = { is: O.is, keys: O.keys, entries: O.entries, gp: O.getPrototypeOf, assign: O.assign, values: O.values };
    window.addEventListener('load', () => { Object.is = __O.is; Object.keys = __O.keys; Object.entries = __O.entries; Object.getPrototypeOf = __O.gp; Object.values = __O.values; Object.assign = __O.assign; }); });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html') + ''); await p.waitForTimeout(1200);
  if (mode) { await p.evaluate((m) => { Hub.close(); GameModes.launch(m); }, mode); await p.waitForTimeout(1000); }
  return { b, p, errs };
};
