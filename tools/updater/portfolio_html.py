"""The review portfolio as one offline page: every project on this computer, and what is waiting on you in each.

`build_model(projects)` reads the manifests and review folders; `page(model, live=None)` draws it. The page is drawn from a JSON block
with textContent only, so text from a checklist or a manifest can never run as code. With `live={'token': ..., 'endpoint': ...}`
(used by panel_web.py) every open claim and question also gets answer controls and a Save button; without it the page is read-only.
"""
import html
import json
import pathlib
import time

import review_health
import review_theme
import review_next
import review_coverage
import review_projects as rp
import review_stats
import review_status as rs

SCALE = ['Great', 'Good', 'Okay', 'Not right', 'Wrong idea', 'Not looked']


def file_url(project, row):
    return pathlib.Path(row['brief_html']).as_uri() if row['brief_html'] else ''


def build_model(projects, brief_url=file_url):
    """-> {'generated', 'projects': [...], 'waiting': [...]}. `brief_url(project, row)` says where a brief page can be opened."""
    model = {'generated': time.strftime('%Y-%m-%d %H:%M'), 'projects': [], 'waiting': []}
    for p in projects:
        loc = rp.review_location(p, projects)
        rows = rs.scan(loc['path']) if loc['path'] else []
        m = p['meta']
        items = []
        for r in rows:
            item = {k: r[k] for k in ('name', 'title', 'date', 'claims', 'questions', 'answers', 'open', 'error', 'brief')}
            item['brief_url'] = brief_url(p, r)
            items.append(item)
            if r['open'] or r['error']:
                model['waiting'].append(dict(item, project=p['name'], project_id=p['id']))
        try:
            health = review_health.health(p)
        except Exception as err:                                    # a broken project must not take the whole page down
            health = {'flags': ['Could not be checked: %s' % err]}
        orders = review_next.orders_for(review_stats.folders(p, projects))
        model['projects'].append({
            'health': health,
            'id': p['id'], 'name': p['name'], 'folder': p['folder'], 'type': m.get('type', ''), 'goal': m.get('goal', ''),
            'output': m.get('output', ''), 'done': m.get('done', ''), 'branch': m.get('branch', ''),
            'prompt': review_next.text(p, orders), 'asked': sum(len(o['fix']) for o in orders),
            'review': {'label': loc['label'], 'dir': loc['dir'], 'problem': loc['problem'], 'count': len(items),
                       'evidence': review_stats.line(review_stats.stats(p, projects)),
                       'coverage': review_coverage.line(review_coverage.coverage(p, projects))}})
    model['waiting'].sort(key=lambda w: (w['date'], w['name']), reverse=True)
    return model


CSS = """
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,sans-serif}
main{max-width:900px;margin:0 auto;padding:24px 16px 64px}h1{font-size:1.6rem;margin:.2em 0}h2{font-size:1.15rem;margin:1.8em 0 .5em}
.sub,.dim{color:var(--soft)}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:10px 0}
.badge{display:inline-block;font-weight:700;font-size:.8rem;padding:1px 9px;border-radius:99px;border:1px solid currentColor;margin-right:6px}
.chip{display:inline-block;font-size:.85rem;padding:1px 8px;border-radius:8px;background:var(--bg);border:1px solid var(--line);margin:2px 4px 2px 0}
.ok{color:var(--ok)}.bad{color:var(--bad)}.ask{color:var(--ask)}a{color:var(--accent)}ul.flags{margin:.5em 0 0;padding-left:1.1em;color:var(--ask);font-size:.92rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px}.grid .card{margin:0}
select,input[type=text]{font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:5px 7px}input[type=text]{flex:1;min-width:140px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}button{font:inherit;font-weight:600;color:var(--on);background:var(--accent);border:0;border-radius:8px;padding:7px 14px;cursor:pointer}button.quiet{background:transparent;color:var(--accent);border:1px solid var(--line);padding:4px 10px;font-weight:500}
""" + review_theme.TOKENS

JS = """
const D = JSON.parse(document.getElementById('data').textContent), L = D.live;
const el = (tag, props, ...kids) => { const n = document.createElement(tag); if (props) for (const k in props) n[k] = props[k]; n.append(...kids); return n; };
const safeLink = (u) => typeof u === 'string' && (u.indexOf('file:///') === 0 || (u.charAt(0) === '/' && u.charAt(1) !== '/')) ? u : '';
const waitBox = document.getElementById('waiting'), grid = document.getElementById('projects');
const flagged = D.projects.filter((p) => p.health && p.health.flags.length).length;
document.getElementById('summary').textContent = D.projects.length + ' project(s), ' + D.waiting.length + ' review(s) waiting, ' + flagged + ' project(s) with something to look at. ' + (L ? 'Answers you save are written into the review folders.' : 'Read-only: answer in the chat or with review.py answer.');
async function copy(text, button) {
  const old = button.textContent;
  try { await navigator.clipboard.writeText(text); button.textContent = 'Copied'; }
  catch (e) { const t = el('textarea', { value: text }); document.body.append(t); t.select(); try { document.execCommand('copy'); button.textContent = 'Copied'; } catch (x) { button.textContent = 'Could not copy'; } t.remove(); }
  setTimeout(() => { button.textContent = old; }, 1500);
}
function controls(w) {
  const picks = {}, notes = {}, box = el('div'), msg = el('div', { className: 'dim' });
  for (const c of w.claims.filter((c) => w.open.indexOf(c.id) >= 0)) {
    const sel = el('select', {}, el('option', { value: '' }, 'Verdict\\u2026'), ...D.scale.map((v) => el('option', { value: v }, v)));
    picks[c.id] = sel; notes[c.id] = el('input', { type: 'text', placeholder: 'Note (optional)' });
    box.append(el('div', { className: 'row' }, el('strong', {}, c.id), ' ' + c.text, el('br')), el('div', { className: 'row' }, sel, notes[c.id]));
  }
  for (const q of w.questions.filter((q) => w.open.indexOf(q.id) >= 0)) {
    const sel = q.options.length ? el('select', {}, el('option', { value: '' }, 'Answer\\u2026'), ...q.options.map((o) => el('option', { value: o }, o)))
                                 : el('input', { type: 'text', placeholder: 'Answer' });
    picks[q.id] = sel; notes[q.id] = el('input', { type: 'text', placeholder: 'Note (optional)' });
    box.append(el('div', { className: 'row' }, el('strong', {}, q.id), ' ' + q.text), el('div', { className: 'row' }, sel, notes[q.id]));
  }
  const save = el('button', { type: 'button', textContent: 'Save answers', onclick: async () => {
    const parts = [];
    for (const id in picks) { const v = picks[id].value.trim(); if (v) parts.push(id + ' ' + v + (notes[id].value.trim() ? ' (' + notes[id].value.trim() + ')' : '')); }
    if (!parts.length) { msg.textContent = 'Choose at least one answer first.'; return; }
    try {
      const r = await fetch(L.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Review-Token': L.token },
        body: JSON.stringify({ project: w.project_id, checklist: w.name, line: parts.join(' \\u00b7 ') }) });
      const j = await r.json(); msg.textContent = r.ok ? 'Saved ' + j.saved.join(', ') + '. Still open: ' + (j.open.join(', ') || 'nothing') + '.' : 'Not saved: ' + (j.error || r.status);
    } catch (e) { msg.textContent = 'Not saved: ' + e; }
  } });
  box.append(el('div', { className: 'row' }, save), msg);
  return box;
}
const lead = document.getElementById('lead'), asked = D.projects.filter((p) => p.asked);
lead.append(el('div', {}, el('h3', {}, 'Waiting on you', el('span', { className: 'n' }, String(D.waiting.length))),
    ...(D.waiting.length ? D.waiting.slice(0, 6).map((w) => el('div', {}, el('strong', {}, w.project), ' \\u00b7 ' + w.title + ' ', el('span', { className: 'dim' }, w.open.length + ' open'))) : [el('div', { className: 'dim' }, 'Nothing \\u2014 you are all caught up.')])),
  el('div', {}, el('h3', {}, 'The agent does next', el('span', { className: 'n' }, String(asked.length))),
    ...(asked.length ? asked.map((p) => el('div', {}, el('strong', {}, p.name), ' \\u00b7 ' + p.asked + ' change(s) you asked for')) : [el('div', { className: 'dim' }, 'Nothing queued.')])));
if (!D.waiting.length) { waitBox.hidden = true; document.getElementById('needs').hidden = true; }
for (const w of D.waiting) {
  const link = safeLink(w.brief_url);
  const names = []; if (w.brief) for (const k in w.brief) names.push(w.brief[k] + ' ' + k);
  const counts = names.length ? names.join(', ') : 'no brief yet';
  waitBox.append(el('section', { className: 'card' },
    el('div', {}, el('strong', {}, w.project), ' \\u00b7 ' + w.title + ' ', el('span', { className: 'dim' }, w.date)),
    el('div', { className: 'dim' }, w.error ? 'Cannot be read: ' + w.error : 'Brief: ' + counts), el('div', {}, ...w.open.map((i) => el('span', { className: 'chip' }, i))),
    link ? el('div', {}, el('a', { href: link }, 'Open the brief')) : '', L && !w.error ? controls(w) : ''));
}
for (const p of D.projects) {
  grid.append(el('section', { className: 'card' }, el('div', {}, p.type ? el('span', { className: 'badge ask' }, p.type) : '', el('strong', {}, p.name)),
    p.goal ? el('div', {}, p.goal) : el('div', { className: 'dim' }, 'No goal written yet.'),
    el('div', { className: 'dim' }, p.review.count + ' review(s) \\u00b7 ' + p.review.coverage.replace(/ \\[.*$/, '')),
    el('details', {}, el('summary', {}, 'More'),
      el('div', { className: 'dim' }, 'Output: ' + (p.output || '\\u2014')), el('div', { className: 'dim' }, 'Done when: ' + (p.done || '\\u2014')),
      el('div', { className: 'dim' }, 'Branch ' + (p.branch || '?') + ' \\u00b7 reviews in ' + p.review.label + ' / ' + p.review.dir),
      el('div', { className: 'dim' }, 'Evidence: ' + p.review.evidence), el('div', { className: 'dim' }, 'Coverage: ' + p.review.coverage)),
    p.review.problem ? el('div', { className: 'bad' }, p.review.problem) : '',
    el('div', { className: 'row' }, el('button', { type: 'button', className: 'quiet', textContent: 'Copy next-work prompt', onclick: (e) => copy(p.prompt, e.target) }),
      L ? el('a', { href: '/project/' + encodeURIComponent(p.id) }, 'Details') : ''),
    p.health && p.health.flags.length ? el('ul', { className: 'flags' }, ...p.health.flags.map((f) => el('li', {}, f))) : el('div', { className: 'ok' }, 'In good order.')));
}
"""


def _json_for_script(data):
    return json.dumps(data, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def page(model, live=None):
    data = dict(model, scale=SCALE, live=live)
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Review portfolio</title><style>%s</style></head><body>%s<main><h1>Review portfolio</h1>'
            '<p class="sub">%s &middot; <span id="summary"></span></p><div class="lead" id="lead"></div><h2 id="needs">Needs you</h2><div id="waiting"></div>'
            '<h2>Projects</h2><div id="projects" class="grid"></div></main>'
            '<script id="data" type="application/json">%s</script><script>%s</script></body></html>') % (
        CSS, review_theme.bar('Reviews'), html.escape(model['generated']), _json_for_script(data), review_theme.JS + JS)
