"""The Updater page: every project on this computer, what is waiting for you to test, and how far the testing is (the "Review portfolio").

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
import review_workspace
import review_next
import review_coverage
import review_digest
import review_projects as rp
import review_stats
import review_status as rs

SCALE = ['Great', 'Good', 'Okay', 'Not right', 'Wrong idea', 'Not looked']


def verdict_of(answer):
    """'Good (nice and quick)' -> 'Good'; '' when the answer is not one of the scale words (a question's own answer)."""
    word = str(answer or '').strip()
    return next((v for v in SCALE if word.lower() == v.lower() or word.lower().startswith(v.lower() + ' ')), '')


def file_url(project, row):
    return pathlib.Path(row['brief_html']).as_uri() if row['brief_html'] else ''


def _media(project, row, claim, pic_url, base=''):
    """What can really be shown beside one claim: its link (text and address) and its pictures (addresses from `pic_url`)."""
    roots = [project['folder'], os.path.dirname(row['path'])]
    pics = []
    for n, name in enumerate(review_media.items(claim.get('pic', ''))):
        real = review_media.resolve(name, roots)
        src = pic_url(project, row, claim['id'], n, real) if real else ''
        if src:
            pics.append(src)
    link = claim.get('link', '').strip()
    return {'link': {'text': link, 'url': review_media.link_url(link, base), 'file': review_media.link_file(link, project['folder'], project['meta'])} if link else None, 'pics': pics}


def _evidence(project, row):
    """claim id -> {'result', 'check', 'findings'} from a read-only brief (nothing is run); {} when the checklist has no base or git cannot be read."""
    try:
        with open(row['path'], encoding='utf-8') as fh:
            brief = rb.build(fh.read(), project['folder'], run=False)
    except (rb.BriefError, OSError):
        return {}
    return {c['id']: dict(review_card.explain(c['evidence'], c['fields']), result=c['result']) for c in brief['claims']}


def facts(project, row, item, pic_url, ev=None, base=''):
    """One claim or question with everything a page draws: its media, what to check and what the tool found, in plain words."""
    got = (ev or {}).get(item['id']) or review_card.explain([], {k: item.get(k, '') for k in ('look', 'link', 'try', 'see')})
    return dict(item, media=_media(project, row, item, pic_url, base), **got)


def inline_pic(project, row, claim_id, n, real):
    """For a page that is one file: the picture embedded in it ('' when it is too large)."""
    return review_media.data_uri(real)


def build_model(projects, brief_url=file_url, pic_url=inline_pic):
    """-> {'generated', 'projects': [...], 'waiting': [...]}. `brief_url(project, row)` says where a brief page can be opened."""
    model = {'generated': time.strftime('%Y-%m-%d %H:%M'), 'projects': [], 'waiting': [], 'done': [],
             'totals': {'projects': 0, 'reviews': 0, 'waiting': 0, 'items': 0, 'answered': 0, 'open': 0, 'verdicts': {v: 0 for v in SCALE}}}
    tot = model['totals']
    orders_by_id, waiting_by_id = {}, {}
    for p in projects:
        loc = rp.review_location(p, projects)
        rows = rs.scan(loc['path']) if loc['path'] else []
        m = p['meta']
        app = review_media.resolve_app(p['folder'], m, p['name'])
        items = []
        mine = {'reviews': 0, 'waiting': 0, 'items': 0, 'answered': 0, 'open': 0, 'latest': None}
        for r in rows:
            n_items = 0 if r['error'] else len(r['claims']) + len(r['questions'])
            n_open = 0 if r['error'] else len(r['open'])
            mine['reviews'] += 1
            mine['items'] += n_items
            mine['open'] += n_open
            mine['answered'] += n_items - n_open
            if r['open'] or r['error']:
                mine['waiting'] += 1
            if not mine['latest'] or r['date'] > mine['latest']['date']:
                mine['latest'] = {'title': r['title'], 'date': r['date'], 'name': r['name']}
            for answer in r['answers'].values():
                v = verdict_of(answer)
                if v:
                    tot['verdicts'][v] += 1
            item = {k: r[k] for k in ('name', 'title', 'date', 'claims', 'questions', 'answers', 'open', 'error', 'brief')}
            ev = _evidence(p, dict(r, path=r['path'])) if r['open'] else {}
            item['claims'] = [facts(p, r, c, pic_url, ev, app['base']) for c in r['claims']]
            item['questions'] = [facts(p, r, q, pic_url, None, app['base']) for q in r['questions']]
            item['app'] = app
            item['brief_url'] = brief_url(p, r)
            items.append(item)
            if r['open'] or r['error']:
                model['waiting'].append(dict(item, project=p['name'], project_id=p['id']))
            elif n_items:                                           # finished: every claim and question has an answer
                counts = {}
                for answer in r['answers'].values():
                    v = verdict_of(answer)
                    if v:
                        counts[v] = counts.get(v, 0) + 1
                model['done'].append({'project': p['name'], 'project_id': p['id'], 'name': r['name'], 'title': r['title'], 'date': r['date'], 'items': n_items,
                                      'verdicts': counts, 'brief_url': item['brief_url'], 'app': app})
        try:
            health = review_health.health(p)
        except Exception as err:                                    # a broken project must not take the whole page down
            health = {'flags': ['Could not be checked: %s' % err]}
        all_orders = review_next.orders_for(review_stats.folders(p, projects), limit=100)
        orders = all_orders[:3]                                     # the prompt keeps its newest three; the Digest tab lists every queued change
        orders_by_id[p['id']] = all_orders
        waiting_by_id[p['id']] = mine['waiting']
        model['projects'].append({
            'health': health, 'progress': mine, 'app': app,
            'id': p['id'], 'name': p['name'], 'folder': p['folder'], 'type': m.get('type', ''), 'goal': m.get('goal', ''),
            'output': m.get('output', ''), 'done': m.get('done', ''), 'branch': m.get('branch', ''),
            'prompt': review_next.text(p, orders), 'asked': sum(len(o['fix']) for o in orders),
            'review': {'label': loc['label'], 'dir': loc['dir'], 'problem': loc['problem'], 'count': len(items),
                       'evidence': review_stats.line(review_stats.stats(p, projects)),
                       'coverage': review_coverage.line(review_coverage.coverage(p, projects))}})
    model['waiting'].sort(key=lambda w: (w['date'], w['name']), reverse=True)
    model['done'].sort(key=lambda d: (d['date'], d['name']), reverse=True)
    model['done'] = model['done'][:40]
    for pr in model['projects']:
        tot['reviews'] += pr['progress']['reviews']
        tot['items'] += pr['progress']['items']
        tot['answered'] += pr['progress']['answered']
        tot['open'] += pr['progress']['open']
    tot['projects'] = len(model['projects'])
    tot['waiting'] = len(model['waiting'])
    model['digest'] = review_digest.for_page(projects, orders_by_id, waiting_by_id)
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
.dgday{font-weight:700;font-size:.85rem;color:var(--soft);margin:10px 0 2px}.dgrow{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;padding:3px 0;border-bottom:1px solid var(--line)}.dgrow .t{flex:1;min-width:200px}
.dgsum{font-size:1.02rem;margin:4px 0}
""" + review_theme.TOKENS + review_card.CSS

JS = """
const D0 = JSON.parse(document.getElementById('data').textContent), L = D0.live;
let D = D0, dirty = false, pending = null, laneMore = false, known = null, toastTimer = 0;
const fresh = new Set();
const el = (tag, props, ...kids) => { const n = document.createElement(tag); if (props) for (const k in props) n[k] = props[k]; n.append(...kids); return n; };
const $ = (id) => document.getElementById(id);
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const safeLink = (u) => typeof u === 'string' && (u.indexOf('file:///') === 0 || (u.charAt(0) === '/' && u.charAt(1) !== '/')) ? u : '';
const webLink = (u) => typeof u === 'string' && (u.indexOf('http://') === 0 || u.indexOf('https://') === 0) ? u : '';
const SEEN = 'updater-seen';
const VCLASS = { 'Great': 's-great', 'Good': 's-good', 'Okay': 's-okay', 'Not right': 's-not', 'Wrong idea': 's-wrong', 'Not looked': 's-look' };

// What was already on the page the last time you looked: a review that is not in that list shows as New (the first visit flags nothing).
function readSeen() { try { const raw = localStorage.getItem(SEEN); return raw === null ? null : new Set(JSON.parse(raw)); } catch (e) { return null; } }
function track(list) {
  const keys = list.map((w) => w.project_id + '/' + w.name), seen = readSeen();
  if (known === null) { if (seen) keys.forEach((k) => { if (!seen.has(k)) fresh.add(k); }); }
  else keys.forEach((k) => { if (!known.has(k)) fresh.add(k); });
  known = new Set(keys);
  try { localStorage.setItem(SEEN, JSON.stringify([...new Set([...(seen ? [...seen] : []), ...keys])].slice(-500))); } catch (e) { /* not kept */ }
}
function toast(text, label, action) {
  const t = $('toast');
  t.replaceChildren(el('span', {}, text), label ? el('button', { type: 'button', textContent: label, onclick: () => { t.hidden = true; action(); } }) : '');
  t.hidden = false; clearTimeout(toastTimer);
  if (!label) toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
}
async function copy(text, button) {
  const old = button.textContent;
  try { await navigator.clipboard.writeText(text); button.textContent = 'Copied'; }
  catch (e) { const t = el('textarea', { value: text }); document.body.append(t); t.select(); try { document.execCommand('copy'); button.textContent = 'Copied'; } catch (x) { button.textContent = 'Could not copy'; } t.remove(); }
  setTimeout(() => { button.textContent = old; }, 1500);
}
const bar = (done, total, label) => el('div', { className: 'prog', title: label || (done + ' of ' + total + ' answered') }, el('i', { style: 'width:' + Math.round(100 * done / Math.max(total, 1)) + '%' }));
function appButton(app) {
  if (!app || !app.text) return '';
  if (app.running && webLink(app.url)) return el('a', { className: 'prbtn', href: app.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open ' + app.text + ' to test');
  const own = pageLink(app.text + ' to test', '', app.file, 'prbtn');          // a saved portfolio opened as a file: the project's own page, when it needs no server
  if (own) return own;
  return el('span', { className: 'prbtn off', title: app.hint || '' }, app.text + ' is not running');
}

// ---- the lane at the top, like Tasks & Goals' Needs you: what is waiting, most recent first, with how far the testing is
function renderLane() {
  const lane = $('lane'), T = D.totals, w = D.waiting;
  lane.replaceChildren(el('h2', {}, 'Needs you', el('span', { className: 'n' }, w.length ? w.length + ' waiting' + (w.length > 5 && !laneMore ? ' · showing 5' : '') : 'nothing waiting')));
  if (T.items) lane.append(el('div', { className: 'big' }, bar(T.answered, T.items),
    el('div', { className: 'dim' }, T.answered + ' of ' + T.items + ' items tested across ' + plural(T.projects, 'project', 'projects') + (T.open ? ' · ' + T.open + ' still to answer' : ' · all answered'))));
  if (!w.length) lane.append(el('div', { className: 'dim' }, 'Nothing is waiting. When an agent finishes work it writes a review, and it shows up here by itself.'));
  for (const r of (laneMore ? w : w.slice(0, 5))) {
    const key = r.project_id + '/' + r.name, total = r.claims.length + r.questions.length, isNew = fresh.has(key);
    lane.append(el('a', { className: 'prow', href: '#r-' + r.project_id + '-' + r.name, onclick: () => window.showTab('now') },
      el('span', { className: 'tag' + (isNew ? ' new' : r.error ? ' ask' : '') }, isNew ? 'New' : r.error ? 'Fix' : 'Test'),
      el('span', { className: 't' }, r.project + ' · ' + r.title),
      r.error ? '' : el('span', { className: 'mini' }, el('i', { style: 'width:' + Math.round(100 * (total - r.open.length) / Math.max(total, 1)) + '%' })),
      el('span', { className: 'r' }, r.error ? 'cannot be read' : r.open.length + ' to answer')));
  }
  if (w.length > 5) lane.append(el('button', { type: 'button', className: 'more', textContent: laneMore ? 'Show fewer' : (w.length - 5) + ' more waiting', onclick: () => { laneMore = !laneMore; renderLane(); } }));
  const lately = D.done.slice(0, 3).map((d) => d.project + ': ' + d.title).join(' · ');
  if (lately) lane.append(el('p', { className: 'foot' }, 'Answered lately: ' + lately));
  const quiet = D.projects.filter((p) => !p.progress.waiting).length, flagged = D.projects.filter((p) => p.health && p.health.flags.length).length;
  lane.append(el('p', { className: 'foot' }, 'Quiet: ' + plural(quiet, 'project has', 'projects have') + ' nothing waiting.' + (flagged ? ' ' + plural(flagged, 'project', 'projects') + ' with setup notes (Projects tab).' : '')
    + (L ? ' This page looks for new updates every 20 seconds.' : '')));
}

// ---- the numbers, and how the answers so far were split
function statsRow() {
  const T = D.totals, tile = (n, label, hot) => el('div', { className: 'stat' + (hot ? ' hot' : '') }, el('b', {}, String(n)), el('span', {}, label));
  const total = Object.values(T.verdicts).reduce((a, b) => a + b, 0);
  const split = total ? el('div', {}, el('div', { className: 'pbar', role: 'img', 'aria-label': 'How the answers so far are split' }, ...D.scale.filter((v) => T.verdicts[v]).map((v) => el('i', { className: VCLASS[v], style: 'flex:' + T.verdicts[v], title: v + ': ' + T.verdicts[v] }))),
    el('div', { className: 'legend' }, ...D.scale.filter((v) => T.verdicts[v]).map((v) => el('span', {}, el('i', { className: VCLASS[v] }), v + ' ' + T.verdicts[v])))) : '';
  return el('div', {}, el('div', { className: 'stats' }, tile(T.open, 'to answer now', T.open > 0), tile(T.answered + ' / ' + T.items, 'items answered'), tile(T.waiting, 'reviews waiting'), tile(T.projects, 'projects')), split);
}

// ---- one review: its items, with the controls to answer them
function reviewBlock(w) {
  const all = w.claims.concat(w.questions), open = all.filter((i) => w.open.indexOf(i.id) >= 0), done = all.length - open.length, picks = {}, notes = {}, key = w.project_id + '/' + w.name;
  const msg = el('div', { className: 'dim' });
  const sec = el('section', { className: 'review', id: 'r-' + w.project_id + '-' + w.name },
    el('header', {}, fresh.has(key) ? el('span', { className: 'new-dot', title: 'New since you last looked' }) : '', el('span', { className: 'badge ask' }, w.project), el('span', { className: 't' }, w.title), el('span', { className: 'dim' }, w.date)),
    el('div', { className: 'dim' }, w.error ? 'This checklist cannot be read: ' + w.error : open.length + ' of ' + all.length + ' to answer' + (done ? ' (' + done + ' already answered)' : '')),
    bar(done, all.length));
  const link = safeLink(w.brief_url), items = el('div', { className: 'media' });
  if (L) items.append(el('a', { className: 'btnlink go', href: '/test/' + encodeURIComponent(w.project_id) + '/' + encodeURIComponent(w.name) }, 'Test side by side'));
  if (L) items.append(el('a', { href: '/review/' + encodeURIComponent(w.project_id) + '/' + encodeURIComponent(w.name) }, 'See every item, with pictures'));
  if (link) items.append(el('a', { href: link }, 'Open the brief (what the tool checked)'));
  const ownApp = w.app && !w.app.running ? pageLink(w.app.text + ' to test', '', w.app.file, 'btnlink app') : null;
  if (w.app && w.app.running && webLink(w.app.url)) items.append(el('a', { className: 'btnlink app', href: w.app.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open ' + w.app.text + ' to test'));
  else if (ownApp) items.append(ownApp);
  else if (w.app && w.app.hint) items.append(el('span', { className: 'ask' }, w.app.text + ' is not running. ' + w.app.hint));
  sec.append(items);
  open.forEach((it, n) => {
    const isQ = w.questions.indexOf(it) >= 0, got = (picks[it.id] = { v: '' }), noteBox = (notes[it.id] = el('input', { type: 'text', placeholder: 'Note (optional)', oninput: () => { dirty = true; } }));
    let answer = '';
    if (L && !w.error) {
      answer = !isQ ? picker('v-' + w.name + it.id, D.scale, '', (v) => { got.v = v; dirty = true; }, SCALE_HELP)
        : it.options.length ? picker('v-' + w.name + it.id, it.options, '', (v) => { got.v = v; dirty = true; }, {})
        : el('input', { type: 'text', placeholder: 'Your answer', oninput: (e) => { got.v = e.target.value; dirty = true; } });
    }
    sec.append(el('div', { className: 'item' }, lab(isQ ? 'Question' : 'You are testing'), el('div', { className: 'what' }, el('span', { className: 'num' }, it.id), it.text, '  ', isQ ? '' : resultBadge(it), el('span', { className: 'dim' }, '  item ' + (n + 1) + ' of ' + open.length)),
      itemFacts(it, w.app), L && !w.error ? el('div', {}, lab(isQ ? 'Your answer' : 'Your verdict'), answer, el('div', { className: 'row' }, noteBox)) : ''));
  });
  if (L && !w.error && open.length) {
    const save = el('button', { type: 'button', textContent: 'Save answers', onclick: async () => {
      const parts = [];
      for (const id in picks) { const v = (picks[id].v || '').trim(); if (v) parts.push(id + ' ' + v + (notes[id].value.trim() ? ' (' + notes[id].value.trim() + ')' : '')); }
      if (!parts.length) { msg.textContent = 'Choose at least one answer first.'; return; }
      try {
        const r = await fetch(L.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Review-Token': L.token },
          body: JSON.stringify({ project: w.project_id, checklist: w.name, line: parts.join(' · ') }) });
        const j = await r.json();
        if (!r.ok) { msg.textContent = 'Not saved: ' + (j.error || r.status); return; }
        dirty = false; toast('Saved ' + j.saved.join(', ') + '. ' + (j.open.length ? plural(j.open.length, 'item', 'items') + ' still to answer.' : 'This review is finished.'));
        await refresh(true);
      } catch (e) { msg.textContent = 'Not saved: ' + e; }
    } });
    sec.append(el('div', { className: 'row' }, save), msg);
  } else if (!L && open.length) sec.append(el('div', { className: 'dim' }, 'To answer, open the Updater website (Updater.command / Updater.bat, or Review.command in a project), or tell the agent in the chat.'));
  return sec;
}

// ---- Now: the reviews to answer, and beside them what the agent does next and where each project stands
function renderNow() {
  const pane = $('pane-now'), asked = D.projects.filter((p) => p.asked);
  const left = el('section', {}, el('h3', {}, 'Waiting on you', el('span', { className: 'n' }, String(D.waiting.length))));
  if (D.waiting.length) D.waiting.forEach((w) => left.append(reviewBlock(w)));
  else left.append(el('div', { className: 'dim' }, 'Nothing to answer. New work appears here as soon as an agent writes its review.'));
  const right = el('section', {}, el('h3', {}, 'The agent does next', el('span', { className: 'n' }, String(asked.length))),
    ...(asked.length ? asked.map((p) => el('div', { className: 'prow' }, el('span', { className: 'tag' }, 'Ask'), el('span', { className: 't' }, p.name + ' · ' + plural(p.asked, 'change', 'changes') + ' you asked for'))) : [el('div', { className: 'dim' }, 'Nothing queued.')]),
    el('h3', { style: 'margin-top:16px' }, 'Projects', el('span', { className: 'n' }, String(D.projects.length))),
    ...D.projects.map((p) => el('div', { className: 'card', style: 'margin:6px 0;padding:10px 12px' }, el('div', {}, el('strong', {}, p.name), ' ', el('span', { className: 'dim' }, p.progress.items ? p.progress.answered + ' of ' + p.progress.items + ' answered' : 'no reviews yet')),
      p.progress.items ? bar(p.progress.answered, p.progress.items) : '', el('div', { className: 'row' }, appButton(p.app)))));
  pane.replaceChildren(statsRow(), el('div', { className: 'panel2' }, left, right));
}

// ---- Projects: every project, how its testing stands, and the way in to test it
function renderProjects() {
  const grid = el('div', { className: 'grid' });
  for (const p of D.projects) {
    grid.append(el('section', { className: 'card' }, el('div', {}, p.type ? el('span', { className: 'badge ask' }, p.type) : '', el('strong', {}, p.name)),
      p.goal ? el('div', {}, p.goal) : el('div', { className: 'dim' }, 'No goal written yet.'),
      p.progress.items ? bar(p.progress.answered, p.progress.items) : '',
      el('div', { className: 'dim' }, plural(p.review.count, 'review', 'reviews') + (p.progress.items ? ' · ' + p.progress.answered + ' of ' + p.progress.items + ' items answered' : '') + (p.progress.latest ? ' · latest ' + p.progress.latest.date : '')),
      el('div', { className: 'row' }, appButton(p.app)),
      el('details', {}, el('summary', {}, 'More'),
        el('div', { className: 'dim' }, 'Output: ' + (p.output || '—')), el('div', { className: 'dim' }, 'Done when: ' + (p.done || '—')),
        el('div', { className: 'dim' }, 'Branch ' + (p.branch || '?') + ' · reviews in ' + p.review.label + ' / ' + p.review.dir),
        el('div', { className: 'dim' }, 'Evidence: ' + p.review.evidence), el('div', { className: 'dim' }, 'Coverage: ' + p.review.coverage)),
      p.review.problem ? el('div', { className: 'bad' }, p.review.problem) : '',
      el('div', { className: 'row' }, el('button', { type: 'button', className: 'quiet', textContent: 'Copy next-work prompt', onclick: (e) => copy(p.prompt, e.target) }),
        L ? el('a', { href: '/project/' + encodeURIComponent(p.id) }, 'Details') : ''),
      p.health && p.health.flags.length ? el('ul', { className: 'flags' }, ...p.health.flags.map((f) => el('li', {}, f))) : el('div', { className: 'ok' }, 'In good order.')));
  }
  $('pane-projects').replaceChildren(grid);
}

// ---- Answered: what you have finished, with how it went
function renderDone() {
  const pane = $('pane-done');
  if (!D.done.length) { pane.replaceChildren(el('div', { className: 'dim' }, 'Nothing is fully answered yet.')); return; }
  pane.replaceChildren(...D.done.map((d) => el('div', { className: 'prow' }, el('span', { className: 'tag' }, 'Done'),
    L ? el('a', { className: 't', href: '/review/' + encodeURIComponent(d.project_id) + '/' + encodeURIComponent(d.name), style: 'color:inherit;text-decoration:none' }, d.project + ' · ' + d.title) : el('span', { className: 't' }, d.project + ' · ' + d.title),
    ...D.scale.filter((v) => d.verdicts[v]).map((v) => el('span', { className: 'badge ' + (v === 'Great' || v === 'Good' ? 'ok' : v === 'Okay' ? 'ask' : 'bad') }, v + ' ' + d.verdicts[v])),
    el('span', { className: 'r' }, d.date))));
}

// ---- Digest: what changed since you last looked, what you decided, and what you asked for that is still queued (read-only; the marks live in this browser)
const DKEY = 'updater-digest-read', WEEK = 7 * 864e5;
function readMarks() { try { const o = JSON.parse(localStorage.getItem(DKEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
let marks = readMarks();
const DG = () => D.digest || { projects: [], decided: [], days: 30 };
function unread(p) {
  const t = Date.parse(marks[p.id]), cut = isNaN(t) ? Date.now() - WEEK : t;          // first visit: the last 7 days
  return p.commits.filter((c) => Date.parse(c.date) > cut);
}
function unreadTotal() { return DG().projects.reduce((n, p) => n + unread(p).length, 0); }
function verdictLine(p, list) {
  const bits = [];
  if (list.length) bits.push(plural(list.length, 'commit', 'commits') + ' since you looked');
  if (p.waiting) bits.push(plural(p.waiting, 'review', 'reviews') + ' waiting');
  if (p.asked.length) bits.push(plural(p.asked.length, 'change you asked for is', 'changes you asked for are') + ' queued');
  return bits.length ? bits.join(', ') : 'Nothing new, nothing waiting.';
}
function markAllRead() {
  const now = new Date().toISOString();
  DG().projects.forEach((p) => { marks[p.id] = now; });
  try { localStorage.setItem(DKEY, JSON.stringify(marks)); } catch (e) { /* kept for this visit only */ }
  renderDigest(); tabCounts();
}
function renderDigest() {
  const dg = DG(), pane = $('pane-digest'), total = unreadTotal();
  const head = el('div', { className: 'row' }, el('strong', {}, total ? plural(total, 'commit', 'commits') + ' since you last looked' : 'Nothing new since you last looked'),
    el('button', { type: 'button', textContent: 'Mark all as read', onclick: markAllRead }));
  const glance = el('section', { className: 'card' }, el('h3', { style: 'margin-top:0' }, 'At a glance'),
    ...(dg.projects.length ? dg.projects.map((p) => el('div', { className: 'dgsum' }, el('strong', {}, p.name + ': '), verdictLine(p, unread(p)))) : [el('div', { className: 'dim' }, 'No projects yet.')]),
    el('div', { className: 'dim' }, 'Commits come from each project’s git history (the last ' + dg.days + ' days). “Since you looked” is kept in this browser; the first visit shows the last 7 days.'));
  const since = el('section', {}, el('h3', {}, 'Since you last looked', el('span', { className: 'n' }, String(total))));
  for (const p of dg.projects) {
    const list = unread(p), card = el('div', { className: 'card' }, el('div', {}, el('strong', {}, p.name), ' ', el('span', { className: 'dim' }, list.length ? plural(list.length, 'commit', 'commits') : 'nothing new')));
    let day = '';
    for (const c of list) {
      const d = String(c.date).slice(0, 10);
      if (d !== day) { day = d; card.append(el('div', { className: 'dgday' }, d)); }
      card.append(el('div', { className: 'dgrow' }, el('span', { className: 't' }, c.subject), el('span', { className: 'chip' }, plural(c.files, 'file', 'files')),
        el('span', { className: 'dim' }, c.author + ' · ' + String(c.date).slice(11, 16))));
    }
    if (p.commits.length >= (dg.max_commits || 200)) card.append(el('div', { className: 'dim' }, 'Only the newest ' + p.commits.length + ' commits are listed.'));
    since.append(card);
  }
  const decided = el('section', {}, el('h3', {}, 'What you decided', el('span', { className: 'n' }, String(dg.decided.length))),
    ...(dg.decided.length ? dg.decided.map((a) => el('div', { className: 'card', style: 'margin:6px 0;padding:10px 12px' },
      el('div', {}, el('span', { className: 'badge ask' }, a.project), el('span', { className: 'dim' }, a.title + ' · ' + a.at)),
      el('div', {}, el('span', { className: 'num' }, a.id), a.text),
      el('div', {}, el('strong', {}, a.v), a.note ? el('span', { className: 'dim' }, ' — ' + a.note) : '')))
      : [el('div', { className: 'dim' }, 'You have not answered anything yet.')]));
  const queued = dg.projects.filter((p) => p.asked.length);
  const asked = el('section', {}, el('h3', {}, 'Asked of the agent, not done yet', el('span', { className: 'n' }, String(queued.reduce((n, p) => n + p.asked.length, 0)))),
    ...(queued.length ? queued.map((p) => el('div', { className: 'card', style: 'margin:6px 0;padding:10px 12px' }, el('div', {}, el('strong', {}, p.name)),
      ...p.asked.map((a) => el('div', { className: 'dgrow' }, el('span', { className: 'tag ask' }, a.verdict), el('span', { className: 't' }, a.text + (a.note ? ' — ' + a.note : '')), el('span', { className: 'dim' }, a.title))))) : [el('div', { className: 'dim' }, 'Nothing queued.')]));
  pane.replaceChildren(head, glance, el('div', { className: 'panel2' }, since, el('div', {}, decided, asked)));
}

function tabCounts() {
  $('tabn-now').textContent = D.waiting.length ? String(D.waiting.length) : '';
  $('tabn-projects').textContent = String(D.projects.length);
  $('tabn-done').textContent = D.done.length ? String(D.done.length) : '';
  const u = unreadTotal(); $('tabn-digest').textContent = u ? String(u) : '';
}

function paint() {
  track(D.waiting);
  renderLane(); renderNow(); renderProjects(); renderDone(); renderDigest(); tabCounts();
  document.title = (D.totals.open ? '(' + D.totals.open + ') ' : '') + 'Updater · Review portfolio';
}
// What changed matters, not when it was drawn: the reviews waiting, what is answered, each project's counts and whether its app is running.
const fp = (m) => JSON.stringify([m.waiting.map((w) => [w.project_id, w.name, w.open.join(','), w.date, w.error]), m.done.map((d) => d.project_id + d.name), m.projects.map((p) => [p.id, p.progress.answered, p.progress.items, p.app && p.app.running]),
  ((m.digest || {}).projects || []).map((p) => [p.id, p.commits.length, p.commits.length ? p.commits[0].sha : '', p.asked.length]), ((m.digest || {}).decided || []).map((a) => [a.project_id, a.name, a.id, a.v, a.note])]);
function apply(next) { D = next; dirty = false; pending = null; paint(); }
async function refresh(force) {
  if (!L || !L.model) return false;
  try {
    const r = await fetch(L.model, { headers: { 'X-Review-Token': L.token } });
    if (!r.ok) return false;
    const next = await r.json(); next.scale = D.scale; next.live = L;
    if (!force && fp(next) === fp(D)) return false;
    if (dirty && !force) { pending = next; toast('New updates came in. Your unsaved answers are kept until you look.', 'Show them', () => apply(pending)); return true; }
    apply(next);
    return true;
  } catch (e) { return false; }
}
paint();
if (L && L.model) {
  setInterval(() => { if (!document.hidden) refresh(false); }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(false); });
}
"""


def _json_for_script(data):
    return json.dumps(data, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def page(model, live=None):
    data = dict(model, scale=SCALE, live=live)
    tabs = review_theme.tabs([('now', 'Now'), ('projects', 'Projects'), ('done', 'Answered'), ('digest', 'Digest')] + review_workspace.PANES)
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Updater \u00b7 Review portfolio</title><style>%s</style></head><body>%s<main class="wide"><div id="lane" class="lane"></div>%s'
            '<div class="pane" data-pane="now" id="pane-now"></div><div class="pane" data-pane="projects" id="pane-projects" hidden></div>'
            '<div class="pane" data-pane="done" id="pane-done" hidden></div><div class="pane" data-pane="digest" id="pane-digest" hidden></div>'
            + ''.join('<div class="pane" data-pane="%s" id="pane-%s" hidden></div>' % (k, k) for k, _ in review_workspace.PANES) + '<div class="toast" id="toast" role="status" hidden></div>'
            '<p class="sub" style="margin-top:28px">Updated %s</p></main>'
            '<script id="data" type="application/json">%s</script><script>%s</script></body></html>') % (
        CSS + review_workspace.CSS, review_theme.bar('test queue for every project'), tabs, html.escape(model['generated']), _json_for_script(data),
        review_theme.JS + review_card.js() + JS + review_workspace.JS)
