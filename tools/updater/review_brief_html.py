"""The browser page for a review brief (used by review_brief.py --html).

One self-contained file: no server, nothing is uploaded. The page is drawn from a JSON block with textContent only,
so text from a checklist or a commit message can never run as code. Your answers become one line you can paste
into the chat ("c1 Good · c2 Not right (why) · q1 Too big") and a JSON file you can save.
"""
import html
import json

import os

import review_media
import review_theme

SCALE = [('Great', 'Great: keep it'), ('Good', 'Good: keep it'), ('Okay', 'Okay: small tweaks'),
         ('Not right', 'Not right: redo it'), ('Wrong idea', 'Wrong idea: start over'), ('Not looked', "Haven't looked yet")]

CSS = """
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,sans-serif}
main{max-width:820px;margin:0 auto;padding:24px 16px 64px}h1{font-size:1.6rem;margin:.2em 0}h2{font-size:1.1rem;margin:1.6em 0 .5em}
.sub{color:var(--soft)}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:10px 0}
.badge{display:inline-block;font-weight:700;font-size:.85rem;padding:2px 10px;border-radius:99px;border:1px solid currentColor}
.Found{color:var(--ok)}.Not-found,.Rejected{color:var(--bad)}.You-decide{color:var(--ask)}
ul.ev{margin:.4em 0 .6em;padding-left:1.2em;color:var(--soft);font-size:.92rem}code{font-family:ui-monospace,monospace;font-size:.9em}
label.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}select,input[type=text],textarea{font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:6px 8px}
input[type=text]{flex:1;min-width:160px}textarea{width:100%;min-height:90px}button{font:inherit;font-weight:600;color:var(--on);background:var(--accent);border:0;border-radius:8px;padding:8px 14px;cursor:pointer}
.opts label{margin-right:14px;white-space:nowrap}.pin{border-top:1px solid var(--line);padding:8px 0;font-size:.92rem}.dim{color:var(--soft)}.commit{font-size:.92rem;color:var(--soft)}
""" + review_theme.TOKENS

JS = """
const D = JSON.parse(document.getElementById('data').textContent), SCALE = D.scale;
const KEY = 'review-brief:' + D.span + ':' + D.head; let S = {};
try { S = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { S = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const el = (tag, props, ...kids) => { const n = document.createElement(tag); Object.assign(n, props || {}); n.append(...kids); return n; };
const root = document.getElementById('root'), out = document.getElementById('answer'), cardById = {};
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
function clean(p) {
  const t = p && typeof p.target === 'object' && p.target ? p.target : {}, c = t.canvas && typeof t.canvas === 'object' ? t.canvas : null;
  return { id: str(p && p.id, 12), claim: str(p && p.claim, 8), note: str(p && p.note, 500),
    target: { selector: str(t.selector, 200), text: str(t.text, 80), canvas: c ? { x: +c.x || 0, y: +c.y || 0 } : null },
    image: p && typeof p.image === 'string' && p.image.indexOf('data:image/jpeg;base64,') === 0 && p.image.length < 400000 ? p.image : '' };
}
D.pins = (D.pins || []).map(clean);
function line() {
  const parts = [];
  for (const c of D.claims) { const s = S[c.id] || {}; if (s.v) parts.push(c.id + ' ' + s.v + (s.note ? ' (' + s.note + ')' : '')); }
  for (const q of D.questions) { const s = S[q.id] || {}; if (s.v || s.note) parts.push(q.id + ' ' + (s.v || '') + (s.note ? (s.v ? ' (' : '(') + s.note + ')' : '')); }
  out.value = parts.join(' \\u00b7 ');
}
function note(id) { return el('input', { type: 'text', placeholder: 'Note (optional)', value: (S[id] || {}).note || '', oninput(e) { (S[id] = S[id] || {}).note = e.target.value; save(); line(); } }); }
for (const c of D.claims) {
  const sel = el('select', { onchange(e) { (S[c.id] = S[c.id] || {}).v = e.target.value; save(); line(); } }, el('option', { value: '' }, 'Your verdict\\u2026'),
    ...SCALE.map(([short, long]) => el('option', { value: short, selected: (S[c.id] || {}).v === short }, long)));
  const card = el('section', { className: 'card' }, el('div', {}, el('strong', {}, c.id + '  ' + c.text), '  ', el('span', { className: 'badge ' + c.result.replace(' ', '-') }, c.result)),
    mediaBox(c.media), el('ul', { className: 'ev' }, ...c.evidence.map(t => el('li', {}, t))), el('label', { className: 'row' }, sel, note(c.id)));
  cardById[c.id] = card; root.append(card);
}
if (D.questions.length) root.append(el('h2', {}, 'Questions for you'));
for (const q of D.questions) {
  const box = el('div', { className: 'opts' }, ...q.options.map(o => el('label', {}, el('input', { type: 'radio', name: q.id, checked: (S[q.id] || {}).v === o, onchange() { (S[q.id] = S[q.id] || {}).v = o; save(); line(); } }), ' ' + o)));
  const card = el('section', { className: 'card' }, el('strong', {}, q.id + '  ' + q.text), mediaBox(q.media), box, el('label', { className: 'row' }, note(q.id)));
  cardById[q.id] = card; root.append(card);
}
const pinNodes = [], pinBox = document.getElementById('pinbox');
function pinCard(p) {
  const where = p.target.canvas ? 'canvas ' + p.target.selector + ' at ' + p.target.canvas.x + ', ' + p.target.canvas.y : p.target.selector + (p.target.text ? ' "' + p.target.text + '"' : '');
  const kids = [el('strong', {}, p.id + (p.claim ? ' (' + p.claim + ')' : '')), ' ', p.note || '(no note)', el('br'), el('span', { className: 'dim' }, where)];
  if (p.image) kids.push(el('br'), el('img', { src: p.image, alt: 'The canvas with the pointed spot circled', style: 'max-width:100%;border-radius:8px;margin-top:6px' }));
  return el('div', { className: 'pin' }, ...kids);
}
function showPins() {
  pinNodes.splice(0).forEach(n => n.remove());
  document.getElementById('pinhead').hidden = !D.pins.length;
  for (const p of D.pins) { const n = pinCard(p); (cardById[p.claim] || pinBox).append(n); pinNodes.push(n); }
}
document.getElementById('pinfile').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (d.version !== 1 || !Array.isArray(d.pins)) throw new Error('shape'); D.pins = d.pins.map(clean); }
  catch (x) { alert('That is not a Review Point export (review-pins.json).'); return; }
  showPins();
};
showPins();
document.getElementById('commits').append(...D.commits.map(c => el('li', { className: 'commit' }, el('code', {}, c.hash), ' ' + c.date + ' ' + c.author + ': ' + c.subject)));
document.getElementById('copy').onclick = async () => { line(); try { await navigator.clipboard.writeText(out.value); } catch (e) { out.select(); document.execCommand('copy'); } };
document.getElementById('dl').onclick = () => {
  const blob = new Blob([JSON.stringify({ title: D.title, span: D.span, head: D.head, answers: S, pins: D.pins.map(p => Object.assign({}, p, { image: undefined })) }, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'review-answers.json' }); document.body.append(a); a.click(); a.remove();
};
line();
"""


def _json_for_script(data):
    return json.dumps(data, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def app_url_of(repo):
    """The `app_url:` line of the project's UPDATER.md (where its pages are served), or ''."""
    import review_brief as rb
    try:
        with open(os.path.join(repo, 'UPDATER.md'), encoding='utf-8') as fh:
            return review_media.app_url(rb.front_matter(fh.read())[0])
    except (OSError, rb.BriefError):
        return ''


def media_for(claim, roots, app_url):
    """-> {'link': {'text', 'url'} or None, 'pics': [data uri, ...]} for one claim; only what can really be shown."""
    f = claim.get('fields', {})
    link = f.get('link', '').strip()
    pics = []
    for name in review_media.items(f.get('pic', '')):
        real = review_media.resolve(name, roots, review_media.MAX_INLINE)
        uri = review_media.data_uri(real) if real else ''
        if uri:
            pics.append(uri)
    return {'link': {'text': link, 'url': review_media.link_url(link, app_url)} if link else None, 'pics': pics}


def page(brief, roots=None, app_url=None):
    ev = brief['ev']
    roots = roots or [brief.get('repo', '')]
    app_url = app_url if app_url is not None else app_url_of(brief.get('repo', ''))
    data = {'title': brief['title'], 'span': ev['span'], 'head': ev['head_sha'], 'scale': SCALE, 'commits': ev['commits'],
            'claims': [dict({k: c[k] for k in ('id', 'text', 'result', 'evidence')}, media=media_for(c, roots, app_url)) for c in brief['claims']], 'questions': [dict(q, media=media_for(q, roots, app_url)) for q in brief['questions']],
            'pins': brief.get('pins', [])}
    counts = {}
    for c in brief['claims']:
        counts[c['result']] = counts.get(c['result'], 0) + 1
    summary = ', '.join('%d %s' % (n, k) for k, n in counts.items()) or 'no claims'
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Review brief</title><style>%s</style></head><body>%s<main>'
            '<h1>%s</h1><p class="sub">Range <code>%s</code> &middot; %d commit(s) &middot; %d file(s) changed &middot; %s</p>'
            '<p><strong>%s</strong></p><div id="root"></div>'
            '<h2 id="pinhead" hidden>Pins (where you pointed)</h2><div id="pinbox"></div>'
            '<p class="sub"><label>Import pins: <input type="file" id="pinfile" accept="application/json,.json"></label> (review-pins.json from Review Point)</p>'
            '<h2>What the commits say</h2><ul id="commits" style="padding-left:1.2em"></ul>'
            '<h2>Your answer, as one line</h2><textarea id="answer" readonly aria-label="Your answer line"></textarea>'
            '<p><button id="copy" type="button">Copy the line</button> <button id="dl" type="button">Download answers.json</button></p>'
            '<p class="sub">Nothing leaves this page. Paste the line into the chat, or save the file in the review folder.</p>'
            '</main><script id="data" type="application/json">%s</script><script>%s</script></body></html>') % (
        CSS, review_theme.bar('Review brief'), html.escape(brief['title']), html.escape(ev['span']), len(ev['commits']), len(ev['changed']), html.escape(ev['shortstat']),
        html.escape(summary), _json_for_script(data), review_theme.JS + JS)
