"""One review item (a claim or a question) in plain words, shared by the portfolio, the brief page and the items page.

An item shows, in this order: what was done, what to check (and a button to open the page and test it), what the tool found (in plain words, each
line marked good / look / problem), and how to answer. `explain()` turns the tool's evidence lines into those plain lines; the JS draws them.
The words the pages use for a result are here so every page says the same thing.
"""
import re

RESULT_WORDS = {'Found': ('ok', 'Evidence found'), 'Not found': ('bad', 'Evidence missing'), 'You decide': ('ask', 'Your call'), 'Rejected': ('bad', "Can't be checked")}
RESULT_HELP = {
    'Found': 'The tool found what the agent said it did.',
    'Not found': 'Something the agent said is not backed up. Read the red lines.',
    'You decide': "The tool can't judge this. Please open it and look.",
    'Rejected': 'This line is not written so it can be checked. Ask the agent to rewrite it.',
}


def explain(lines, fields=None):
    """-> {'check': what a person must look at, 'findings': [{'k': 'ok'|'ask'|'bad', 't': plain sentence}]} from a claim's evidence lines."""
    fields = fields or {}
    check, found, weak = fields.get('look', ''), [], False
    for line in lines or []:
        m = re.match(r'^look:\s*(.*)$', line)
        if m:
            check = check or m.group(1)
            continue
        m = re.match(r'^file (.+?): changed$', line)
        if m:
            found.append({'k': 'ok', 't': '%s was changed.' % m.group(1)})
            continue
        m = re.match(r'^file (.+?): NOT changed in this range$', line)
        if m:
            found.append({'k': 'bad', 't': '%s was NOT changed, although the agent said it was.' % m.group(1)})
            continue
        m = re.match(r'^test (.+?): exists \((.+)\)$', line)
        if m:
            found.append({'k': 'ok', 't': 'The test %s exists (%s).' % (m.group(1), m.group(2))})
            continue
        m = re.match(r'^test (.+?): no such file at head$', line)
        if m:
            found.append({'k': 'bad', 't': 'The test %s does not exist.' % m.group(1)})
            continue
        m = re.match(r'^run (.+?): not run \(use --run\)(.*)$', line)
        if m:
            found.append({'k': 'ask', 't': ("The agent's command was not run here: %s %s" % (m.group(1), m.group(2).strip())).strip()})
            continue
        m = re.match(r'^run (.+?): exit 0 in (.+?) \(last line: (.*)\)$', line)
        if m:
            found.append({'k': 'ok', 't': 'The command passed in %s: %s' % (m.group(2), m.group(1))})
            continue
        m = re.match(r'^run (.+?): FAILED in run (.+)$', line)
        if m:
            found.append({'k': 'bad', 't': 'The command FAILED (run %s): %s' % (m.group(2), m.group(1))})
            continue
        if line.startswith('weak evidence'):
            weak = True
            found.append({'k': 'ask', 't': 'This only shows a file changed. Nothing proves it works, so check it yourself.'})
            continue
        bad = bool(re.search(r'NOT matched|not within|FAILED|Not valid|Not understood|Add file', line))
        found.append({'k': 'bad' if bad else 'ok', 't': line})
    if check and not fields.get('link'):
        found.append({'k': 'ask', 't': 'No link was given for this item, so you have to find it in the app yourself.'})
    return {'check': check, 'findings': found, 'weak': weak}


CSS = """
.review{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:14px 0}
.review>header{display:flex;gap:10px;flex-wrap:wrap;align-items:baseline;margin-bottom:6px}.review>header .t{font-weight:700;font-size:1.05rem}
.prog{height:6px;background:var(--card2);border-radius:99px;overflow:hidden;margin:6px 0 4px}.prog>i{display:block;height:100%;background:var(--accent)}
.item{border-top:1px solid var(--line);padding:12px 0}.item:first-of-type{border-top:0}.what{font-weight:600}.num{color:var(--soft);font-weight:400;margin-right:8px}.ok{color:var(--ok)}.bad{color:var(--bad)}.ask{color:var(--ask)}
.badge{display:inline-block;font-weight:700;font-size:.8rem;padding:1px 9px;border-radius:99px;border:1px solid currentColor}
.lab{display:block;color:var(--soft);font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;margin:10px 0 3px}
.find{list-style:none;margin:0;padding:0}.find li{padding-left:22px;position:relative;margin:2px 0;font-size:.93rem}.find li:before{position:absolute;left:0;font-weight:700}
.find li.ok:before{content:"\\2713";color:var(--ok)}.find li.ask:before{content:"!";color:var(--ask)}.find li.bad:before{content:"\\2717";color:var(--bad)}
.picker{display:flex;flex-wrap:wrap;gap:6px}.picker label{cursor:pointer}.picker input{position:absolute;opacity:0;pointer-events:none}
.picker span{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:5px 13px;font-size:.92rem}
.picker input:checked+span{background:var(--accent);color:var(--on);border-color:var(--accent);font-weight:600}.picker input:focus-visible+span{outline:2px solid var(--accent);outline-offset:2px}
.helpline{color:var(--soft);font-size:.88rem;margin-top:4px;min-height:1.2em}
.btnlink.app{border-style:dashed}
"""

JS = """
const RESULT = %RESULT%, RESULT_HELP = %HELP%;
const SCALE_HELP = { 'Great': 'Great: keep it exactly as it is', 'Good': 'Good: keep it', 'Okay': 'Okay: it needs small tweaks', 'Not right': 'Not right: it should be redone',
  'Wrong idea': 'Wrong idea: start over', 'Not looked': "Not looked yet: I'll come back to it" };
const lab = (t) => el('span', { className: 'lab' }, t);
function resultBadge(it) {
  if (it.result === 'Found' && it.weak) return el('span', { className: 'badge ask', title: 'The tool only saw that a file changed. Nothing shows it works.' }, 'Weak evidence');
  const r = RESULT[it.result]; return r ? el('span', { className: 'badge ' + r[0], title: RESULT_HELP[it.result] || '' }, r[1]) : '';
}
// What to check + the buttons to open it, then what the tool found. `app` is {url, text} for the project's own page, used when the item has no link of its own.
function itemFacts(it, app) {
  const kids = [];
  if (it.check || (it.media && (it.media.link || it.media.pics.length))) {
    kids.push(lab('What to check'));
    if (it.check) kids.push(el('div', {}, it.check));
    const m = it.media || { link: null, pics: [] };
    const box = mediaBox(m);
    if (box) kids.push(box);
    if (!(m.link && m.link.url) && it.check && app && /^https?:\\/\\//i.test(app.url || '')) kids.push(el('div', { className: 'media' }, el('a', { className: 'btnlink app', href: app.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open ' + app.text)));
  }
  if (it.findings && it.findings.length) kids.push(lab('What the tool found'), el('ul', { className: 'find' }, ...it.findings.map((f) => el('li', { className: f.k }, f.t))));
  return el('div', {}, ...kids);
}
// A row of choices that reads like buttons. `pick` is called with the chosen value; the line under it says what the choice means.
function picker(name, choices, current, pick, help) {
  const note = el('div', { className: 'helpline' }, current ? (help[current] || '') : '');
  const row = el('div', { className: 'picker', role: 'radiogroup' }, ...choices.map((c) => {
    const input = el('input', { type: 'radio', name: name, value: c, checked: current === c });
    input.onchange = () => { pick(c); note.textContent = help[c] || ''; };
    return el('label', { title: help[c] || '' }, input, el('span', {}, c));
  }));
  return el('div', {}, row, note);
}
"""


def js():
    import json
    return JS.replace('%RESULT%', json.dumps({k: list(v) for k, v in RESULT_WORDS.items()})).replace('%HELP%', json.dumps(RESULT_HELP))
