"""The review portfolio as one offline page: every project on this computer, and what is waiting on you in each.

`build_model(projects)` reads the manifests and review folders; `page(model, live=None)` draws it. The page is drawn from a JSON block
with textContent only, so text from a checklist or a manifest can never run as code. With `live={'token': ..., 'endpoint': ...}`
(used by panel_web.py) every open claim and question also gets answer controls and a Save button; without it the page is read-only.
"""
import html
import json
import os
import pathlib
import time

import review_brief as rb
import review_card
import review_health
import review_media
import review_theme
import review_next
import review_coverage
import review_projects as rp
import review_stats
import review_status as rs

SCALE = ['Great', 'Good', 'Okay', 'Not right', 'Wrong idea', 'Not looked']


def file_url(project, row):
    return pathlib.Path(row['brief_html']).as_uri() if row['brief_html'] else ''


def _media(project, row, claim, pic_url):
    """What can really be shown beside one claim: its link (text and address) and its pictures (addresses from `pic_url`)."""
    roots = [project['folder'], os.path.dirname(row['path'])]
    pics = []
    for n, name in enumerate(review_media.items(claim.get('pic', ''))):
        real = review_media.resolve(name, roots)
        src = pic_url(project, row, claim['id'], n, real) if real else ''
        if src:
            pics.append(src)
    link = claim.get('link', '').strip()
    return {'link': {'text': link, 'url': review_media.link_url(link, review_media.app_url(project['meta']))} if link else None, 'pics': pics}


def _evidence(project, row):
    """claim id -> {'result', 'check', 'findings'} from a read-only brief (nothing is run); {} when the checklist has no base or git cannot be read."""
    try:
        with open(row['path'], encoding='utf-8') as fh:
            brief = rb.build(fh.read(), project['folder'], run=False)
    except (rb.BriefError, OSError):
        return {}
    return {c['id']: dict(review_card.explain(c['evidence'], c['fields']), result=c['result']) for c in brief['claims']}


def facts(project, row, item, pic_url, ev=None):
    """One claim or question with everything a page draws: its media, what to check and what the tool found, in plain words."""
    got = (ev or {}).get(item['id']) or review_card.explain([], {'look': item.get('look', ''), 'link': item.get('link', '')})
    return dict(item, media=_media(project, row, item, pic_url), **got)


def inline_pic(project, row, claim_id, n, real):
    """For a page that is one file: the picture embedded in it ('' when it is too large)."""
    return review_media.data_uri(real)


def build_model(projects, brief_url=file_url, pic_url=inline_pic):
    """-> {'generated', 'projects': [...], 'waiting': [...]}. `brief_url(project, row)` says where a brief page can be opened."""
    model = {'generated': time.strftime('%Y-%m-%d %H:%M'), 'projects': [], 'waiting': []}
    for p in projects:
        loc = rp.review_location(p, projects)
        rows = rs.scan(loc['path']) if loc['path'] else []
        m = p['meta']
        items = []
        for r in rows:
            item = {k: r[k] for k in ('name', 'title', 'date', 'claims', 'questions', 'answers', 'open', 'error', 'brief')}
            ev = _evidence(p, dict(r, path=r['path'])) if r['open'] else {}
            item['claims'] = [facts(p, r, c, pic_url, ev) for c in r['claims']]
            item['questions'] = [facts(p, r, q, pic_url) for q in r['questions']]
            item['app'] = review_media.app_link(m, p['name'])
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
""" + review_theme.TOKENS + review_card.CSS

JS = """
const D = JSON.parse(document.getElementById('data').textContent), L = D.live;
const el = (tag, props, ...kids) => { const n = document.createElement(tag); if (props) for (const k in props) n[k] = props[k]; n.append(...kids); return n; };
const safeLink = (u) => typeof u === 'string' && (u.indexOf('file:///') === 0 || (u.charAt(0) === '/' && u.charAt(1) !== '/')) ? u : '';
const waitBox = document.getElementById('waiting'), grid = document.getElementById('projects');
const flagged = D.projects.filter((p) => p.health && p.health.flags.length).length;
document.getElementById('summary').textContent = D.waiting.length + ' review(s) waiting for you. ' + D.projects.length + ' projects' + (flagged ? ', ' + flagged + ' with setup notes (open Details on a project).' : '.') + (L ? ' Answers you save are written into the review folders.' : ' Read-only: answer in the chat or with review.py answer.');
async function copy(text, button) {
  const old = button.textContent;
  try { await navigator.clipboard.writeText(text); button.textContent = 'Copied'; }
  catch (e) { const t = el('textarea', { value: text }); document.body.append(t); t.select(); try { document.execCommand('copy'); button.textContent = 'Copied'; } catch (x) { button.textContent = 'Could not copy'; } t.remove(); }
  setTimeout(() => { button.textContent = old; }, 1500);
}
function reviewBlock(w) {
  const all = w.claims.concat(w.questions), open = all.filter((i) => w.open.indexOf(i.id) >= 0), done = all.length - open.length, picks = {}, notes = {};
  const msg = el('div', { className: 'dim' });
  const sec = el('section', { className: 'review', id: 'r-' + w.project_id + '-' + w.name },
    el('header', {}, el('span', { className: 'badge ask' }, w.project), el('span', { className: 't' }, w.title), el('span', { className: 'dim' }, w.date)),
    el('div', { className: 'dim' }, w.error ? 'This checklist cannot be read: ' + w.error : open.length + ' of ' + all.length + ' to answer' + (done ? ' (' + done + ' already answered)' : '')),
    el('div', { className: 'prog' }, el('i', { style: 'width:' + Math.round(100 * done / Math.max(all.length, 1)) + '%' })));
  const link = safeLink(w.brief_url), items = el('div', { className: 'media' });
  if (L) items.append(el('a', { href: '/review/' + encodeURIComponent(w.project_id) + '/' + encodeURIComponent(w.name) }, 'See every item, with pictures'));
  if (link) items.append(el('a', { href: link }, 'Open the brief (what the tool checked)'));
  if (w.app && /^https?:\\/\\//i.test(w.app.url || '')) items.append(el('a', { className: 'btnlink app', href: w.app.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open ' + w.app.text + ' to test'));
  sec.append(items);
  for (const it of open) {
    const isQ = w.questions.indexOf(it) >= 0, got = (picks[it.id] = { v: '' }), noteBox = (notes[it.id] = el('input', { type: 'text', placeholder: 'Note (optional)' }));
    let answer = '';
    if (L && !w.error) {
      answer = !isQ ? picker('v-' + w.name + it.id, D.scale, '', (v) => { got.v = v; }, SCALE_HELP)
        : it.options.length ? picker('v-' + w.name + it.id, it.options, '', (v) => { got.v = v; }, {})
        : el('input', { type: 'text', placeholder: 'Your answer', oninput: (e) => { got.v = e.target.value; } });
    }
    sec.append(el('div', { className: 'item' }, el('div', { className: 'what' }, el('span', { className: 'num' }, it.id), it.text, '  ', isQ ? '' : resultBadge(it)),
      itemFacts(it, w.app), L && !w.error ? el('div', {}, lab(isQ ? 'Your answer' : 'Your verdict'), answer, el('div', { className: 'row' }, noteBox)) : ''));
  }
  if (L && !w.error && open.length) {
    const save = el('button', { type: 'button', textContent: 'Save answers', onclick: async () => {
      const parts = [];
      for (const id in picks) { const v = (picks[id].v || '').trim(); if (v) parts.push(id + ' ' + v + (notes[id].value.trim() ? ' (' + notes[id].value.trim() + ')' : '')); }
      if (!parts.length) { msg.textContent = 'Choose at least one answer first.'; return; }
      try {
        const r = await fetch(L.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Review-Token': L.token },
          body: JSON.stringify({ project: w.project_id, checklist: w.name, line: parts.join(' · ') }) });
        const j = await r.json(); msg.textContent = r.ok ? 'Saved ' + j.saved.join(', ') + '. Still open: ' + (j.open.join(', ') || 'nothing') + '.' : 'Not saved: ' + (j.error || r.status);
      } catch (e) { msg.textContent = 'Not saved: ' + e; }
    } });
    sec.append(el('div', { className: 'row' }, save), msg);
  } else if (!L && open.length) sec.append(el('div', { className: 'dim' }, 'To answer, open the review website (Review.command / Review.bat), or tell the agent in the chat.'));
  return sec;
}
const lead = document.getElementById('lead'), asked = D.projects.filter((p) => p.asked);
lead.append(el('div', {}, el('h3', {}, 'Waiting on you', el('span', { className: 'n' }, String(D.waiting.length))),
    ...(D.waiting.length ? D.waiting.slice(0, 6).map((w) => el('div', {}, el('a', { href: '#r-' + w.project_id + '-' + w.name }, w.project + ' · ' + w.title), ' ', el('span', { className: 'dim' }, w.open.length + ' to answer'))) : [el('div', { className: 'dim' }, 'Nothing — you are all caught up.')])),
  el('div', {}, el('h3', {}, 'The agent does next', el('span', { className: 'n' }, String(asked.length))),
    ...(asked.length ? asked.map((p) => el('div', {}, el('strong', {}, p.name), ' · ' + p.asked + ' change(s) you asked for')) : [el('div', { className: 'dim' }, 'Nothing queued.')])));
if (!D.waiting.length) { waitBox.hidden = true; document.getElementById('needs').hidden = true; }
for (const w of D.waiting) waitBox.append(reviewBlock(w));
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
            '<p class="sub">%s &middot; <span id="summary"></span></p><div class="lead" id="lead"></div><h2 id="needs">To answer</h2><div id="waiting"></div>'
            '<h2>Projects</h2><div id="projects" class="grid"></div></main>'
            '<script id="data" type="application/json">%s</script><script>%s</script></body></html>') % (
        CSS, review_theme.bar('Reviews'), html.escape(model['generated']), _json_for_script(data), review_theme.JS + review_card.js() + JS)
