#!/usr/bin/env python3
"""Review brief: put what an agent CLAIMED next to what git and the tests SHOW.

    python review_brief.py CHECKLIST.md [--repo FOLDER] [--run] [--html OUT.html] [--md OUT.md] [--strict]

A checklist is a Markdown file. The lines between the first two `---` are settings:

    ---
    title: Enemy pathfinding
    base: d75547e^        the commit BEFORE the work (not part of it)
    head: 136c22f         the last commit of the work (default: HEAD)
    ---
    - [ ] Enemies reach the hero more often | file: pathfinder.js | test: enemy_chase | run: node enemy_chase.js | expect: "reachedPct":\\s*7[3-9]
    - [ ] Enemies no longer swing on bridges | file: pathfinder.js | look: watch one cross bunker_bridges
    ? Is the chase better when you play? | options: Better, Same, Worse

Every claim line needs at least one of these fields, or it is Rejected (a vague claim cannot be checked):
    file:   one or more paths or globs (comma separated) that must have changed between base and head
    test:   one or more test file names that must exist at head (with or without the extension)
    run:    a command that must exit 0 (only with --run; the repository must be checked out at head)
    runs:   how many times to run it (1 to 10, default 1). Every run must exit 0 and match expect:
    expect: a regular expression that must match the command's output (needs run:)
    number: a regular expression with ONE group that reads a number from the output (needs run: and want:)
    want:   what the MEDIAN of that number must be: <= 0.5, >= 73, ~ 0.5 +- 0.1 (see review_brief_run.py)
    look:   what a person must look at; the result is then "You decide"

Results: Found (every machine check passed and nothing needs a person), Not found (a check failed),
You decide (checks passed but a person must look, or a run was not made), Rejected (the line cannot be checked).

`run:` commands are split into words and run WITHOUT a shell. Only node, python, python3, npm, npx and pytest
are allowed (add more with --allow NAME). Only standard-library Python is used.

A test whose numbers change from run to run (a game with random spawns) needs runs: 3 or more and number:/want:,
so one lucky or unlucky run cannot decide the claim.
"""
import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys

import review_brief_run as rr

FOUND, NOT_FOUND, DECIDE, REJECTED = 'Found', 'Not found', 'You decide', 'Rejected'
CLAIM_KEYS = ('file', 'test', 'run', 'runs', 'expect', 'number', 'want', 'look')
DISPLAY_KEYS = ('link', 'pic')          # shown beside the claim (see review_media.py); they are not evidence, so a claim with only these is still Rejected
ALLOWED = rr.ALLOWED
META_RE = re.compile(r'^([A-Za-z_][\w-]*):\s*(.*?)\s*$')


class BriefError(Exception):
    pass


def git(repo, *args):
    done = subprocess.run(['git', '-C', repo, *args], capture_output=True, text=True)
    if done.returncode:
        raise BriefError('git ' + ' '.join(args) + ': ' + (done.stderr.strip() or 'failed'))
    return done.stdout


def _fields(text):
    """'claim text | key: value | key: value' -> (claim text, {key: value})."""
    parts = [p.strip() for p in re.split(r'\s\|\s', text)]
    fields, unknown = {}, []
    for part in parts[1:]:
        m = re.match(r'^(\w+):\s*(.*)$', part)
        if m and m.group(1).lower() in CLAIM_KEYS + DISPLAY_KEYS + ('options',):
            fields[m.group(1).lower()] = m.group(2).strip()
        else:
            unknown.append(part)                  # a stray " | " or a misspelt field must never be dropped silently
    if unknown:
        fields['_unknown'] = unknown
    return parts[0], fields


def front_matter(text):
    """The `---` settings block at the top of a Markdown file -> ({key: value}, the lines after it)."""
    lines = text.lstrip('\ufeff').split('\n')
    meta, body = {}, lines
    if lines and lines[0].strip() == '---':
        end = next((i for i in range(1, len(lines)) if lines[i].strip() == '---'), None)
        if end is None:
            raise BriefError('The settings block has no closing ---.')
        for line in lines[1:end]:
            m = META_RE.match(line)
            if m and not line.lstrip().startswith('#'):
                meta[m.group(1).lower()] = m.group(2)
        body = lines[end + 1:]
    return meta, body


def parse(text):
    """Checklist text -> (settings, claims, questions)."""
    meta, body = front_matter(text)
    claims, questions = [], []
    for line in body:
        s = line.strip()
        m = re.match(r'^[-*]\s*\[[ xX]\]\s*(.+)$', s)
        if m:
            said, fields = _fields(m.group(1))
            claims.append({'id': 'c%d' % (len(claims) + 1), 'text': said, 'fields': fields})
        elif s.startswith('?'):
            asked, fields = _fields(s[1:].strip())
            options = [o.strip() for o in fields.get('options', '').split(',') if o.strip()]
            questions.append({'id': 'q%d' % (len(questions) + 1), 'text': asked, 'options': options, 'fields': fields})
    if not claims and not questions:
        raise BriefError('The checklist has no claim lines (- [ ] ...) and no questions (? ...).')
    return meta, claims, questions


def evidence(repo, base, head):
    span = '%s..%s' % (base, head)
    commits = []
    for row in git(repo, 'log', '--format=%h\t%ad\t%an\t%s', '--date=short', span).splitlines():
        h, d, who, subject = (row.split('\t', 3) + ['', '', '', ''])[:4]
        commits.append({'hash': h, 'date': d, 'author': who, 'subject': subject})
    return {
        'span': span, 'head_sha': git(repo, 'rev-parse', head).strip(), 'commits': commits,
        'changed': [n for n in git(repo, 'diff', '--name-only', '--no-renames', span).splitlines() if n],
        'tracked': [n for n in git(repo, 'ls-tree', '-r', '--name-only', head).splitlines() if n],
        'shortstat': git(repo, 'diff', '--shortstat', span).strip() or 'no changes',
    }


def _items(value):
    return [x.strip() for x in value.split(',') if x.strip()]


def _validate(f):
    """A problem with the fields of one claim (found before anything runs), or ''."""
    if 'run' not in f and any(k in f for k in ('runs', 'expect', 'number', 'want')):
        return 'runs:, expect:, number: and want: all need a run: command.'
    if 'runs' in f and not (f['runs'].isdigit() and 1 <= int(f['runs']) <= rr.MAX_RUNS):
        return 'runs: must be a whole number from 1 to %d (got "%s").' % (rr.MAX_RUNS, f['runs'])
    if ('number' in f) != ('want' in f):
        return 'number: and want: go together (what to read, and what it must be).'
    try:
        if 'expect' in f:
            re.compile(f['expect'])
        if 'number' in f:
            if re.compile(f['number']).groups != 1:
                return 'number: needs a pattern with exactly one (group) around the number.'
            rr.parse_want(f['want'])
    except (re.error, ValueError) as err:
        return 'Not valid: %s' % err
    return ''


def check(claim, ev, repo, run=False, allow=ALLOWED, timeout=600, rundir=None, cache=None):
    """One claim -> (result, [evidence lines]). `cache` lets claims that name the same command share one run."""
    f, lines, bad, manual = claim['fields'], [], False, False
    if f.get('_unknown'):
        return REJECTED, ['Not understood: %s (fields are separated by " | " and look like key: value; keys: %s).'
                          % (' / '.join(f['_unknown']), ', '.join(CLAIM_KEYS + DISPLAY_KEYS))]
    if not any(k in f for k in CLAIM_KEYS):
        return REJECTED, ['Add file:, test:, run: or look: so this can be checked.']
    problem = _validate(f)
    if problem:
        return REJECTED, [problem]
    for pattern in _items(f.get('file', '')):
        hit = [n for n in ev['changed'] if n == pattern or fnmatch.fnmatch(n, pattern)]
        bad |= not hit
        lines.append('file %s: %s' % (pattern, 'changed' if hit else 'NOT changed in this range'))
    for name in _items(f.get('test', '')):
        hit = [n for n in ev['tracked'] if n == name or re.search(r'(^|/)' + re.escape(name) + r'(\.\w+)?$', n)]
        bad |= not hit
        lines.append('test %s: %s' % (name, ('exists (%s)' % hit[0]) if hit else 'no such file at head'))
    if 'run' in f:
        n = int(f.get('runs', '1'))
        if not run:
            manual = True
            lines.append('run %s: not run (use --run)%s' % (f['run'], ' (%d runs planned)' % n if n > 1 else ''))
        else:
            runs = rr.run_many(f['run'], rundir or repo, allow, timeout, n, cache if cache is not None else {})
            if runs[-1][0] is None:
                bad = True
                lines.append('run %s: %s' % (f['run'], runs[-1][1]))
            else:
                failed = [i + 1 for i, (done, _) in enumerate(runs) if done.returncode]
                bad |= bool(failed)
                tail = ([x for x in runs[-1][1].splitlines() if x.strip()] or ['(no output)'])[-1][:120]
                lines.append('run %s: %s (last line: %s)' % (f['run'], 'exit 0 in %s' % ('the run' if n == 1 else 'all %d runs' % n) if not failed
                                                           else 'FAILED in run %s of %d' % (', '.join(map(str, failed)), n), tail))
                outputs = [out for _, out in runs]
                if 'expect' in f:
                    hits = [bool(re.search(f['expect'], out)) for out in outputs]
                    bad |= not all(hits)
                    lines.append('expect %s: %s' % (f['expect'], 'matched in %s' % ('the run' if n == 1 else 'all %d runs' % n) if all(hits)
                                                    else 'NOT matched in run %s of %d' % (', '.join(str(i + 1) for i, h in enumerate(hits) if not h), n)))
                if 'number' in f:
                    ok, line = rr.judge_number(f['number'], f['want'], outputs)
                    bad |= not ok
                    lines.append(line)
    if 'look' in f:
        manual = True
        lines.append('look: ' + f['look'])
    result = NOT_FOUND if bad else DECIDE if manual else FOUND
    if result == FOUND and 'run' not in f:
        lines.append('weak evidence: this shows the change exists, not that it works (add run: to prove it)')
    return result, lines


def load_pins(path):
    """A Review Point export -> clean pins. A file that is not one is an error, never half read."""
    try:
        with open(path, encoding='utf-8') as fh:
            data = json.load(fh)
    except (OSError, ValueError) as err:
        raise BriefError('Cannot read pins from %s: %s' % (path, err))
    if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get('pins'), list):
        raise BriefError('%s is not a Review Point export (version 1).' % path)
    pins = []
    for raw in data['pins']:
        if not isinstance(raw, dict):
            continue
        tgt = raw.get('target') if isinstance(raw.get('target'), dict) else {}
        cv = tgt.get('canvas') if isinstance(tgt.get('canvas'), dict) else None
        img = raw.get('image') if isinstance(raw.get('image'), str) else ''
        pins.append({
            'id': str(raw.get('id', ''))[:12], 'claim': str(raw.get('claim', ''))[:8], 'note': str(raw.get('note', ''))[:500],
            'target': {'selector': str(tgt.get('selector', ''))[:200], 'text': str(tgt.get('text', ''))[:80],
                       'canvas': {k: cv[k] for k in ('x', 'y') if isinstance(cv.get(k), (int, float))} if cv else None},
            'image': img if img.startswith('data:image/jpeg;base64,') and len(img) < 400000 else ''})
    return pins


def build(text, repo, run=False, base=None, head=None, allow=ALLOWED, timeout=600, pins_file=None):
    meta, claims, questions = parse(text)
    repo = os.path.abspath(repo or meta.get('repo') or '.')
    base, head = base or meta.get('base'), head or meta.get('head') or 'HEAD'
    if not base:
        raise BriefError('Set base: (the commit before the work) in the checklist or with --base.')
    ev = evidence(repo, base, head)
    if run and git(repo, 'rev-parse', 'HEAD').strip() != ev['head_sha']:
        raise BriefError('--run checks the code that is checked out. Check out %s first.' % head)
    cache = {}
    for claim in claims:
        claim['result'], claim['evidence'] = check(claim, ev, repo, run, allow, timeout, meta.get('rundir') and os.path.join(repo, meta['rundir']), cache)
    return {'title': meta.get('title') or 'Review brief', 'repo': repo, 'ev': ev, 'claims': claims, 'questions': questions,
            'pins': load_pins(pins_file) if pins_file else []}


def markdown(brief):
    ev = brief['ev']
    out = ['# ' + brief['title'], '',
           'Range `%s`: %d commit(s), %d file(s) changed (%s).' % (ev['span'], len(ev['commits']), len(ev['changed']), ev['shortstat']), '']
    counts = {}
    for c in brief['claims']:
        counts[c['result']] = counts.get(c['result'], 0) + 1
    out += ['**' + ', '.join('%d %s' % (n, k) for k, n in counts.items()) + '**', '',
            '| # | You asked / the agent said | Result | Evidence |', '| --- | --- | --- | --- |']
    for c in brief['claims']:
        out.append('| %s | %s | **%s** | %s |' % (c['id'], c['text'].replace('|', '/'), c['result'], '<br>'.join(e.replace('|', '/') for e in c['evidence'])))
    out += ['', '## What the commits say', ''] + ['- `%s` %s %s: %s' % (c['hash'], c['date'], c['author'], c['subject']) for c in ev['commits']]
    if brief['questions']:
        out += ['', '## Questions for you', ''] + ['- **%s** %s%s' % (q['id'], q['text'], ' (' + ' / '.join(q['options']) + ')' if q['options'] else '') for q in brief['questions']]
    if brief.get('pins'):
        out += ['', '## Pins (where you pointed)', '']
        for p in brief['pins']:
            t = p['target']
            where = ('canvas %s at %s,%s' % (t['selector'], t['canvas'].get('x'), t['canvas'].get('y'))) if t['canvas'] else t['selector']
            out.append('- **%s**%s %s (%s)' % (p['id'], ' (%s)' % p['claim'] if p['claim'] else '', p['note'].replace('\n', ' ') or '(no note)', where))
    return '\n'.join(out) + '\n'


def main(argv=None):
    ap = argparse.ArgumentParser(description='Compare what an agent claimed with what git and the tests show.')
    ap.add_argument('checklist')
    ap.add_argument('--repo')
    ap.add_argument('--base')
    ap.add_argument('--head')
    ap.add_argument('--run', action='store_true', help='run the run: commands (the repo must be checked out at head)')
    ap.add_argument('--allow', action='append', default=[], help='allow one more command name for run:')
    ap.add_argument('--timeout', type=int, default=600)
    ap.add_argument('--pins', help='a review-pins.json exported by review_point.user.js; shown under the claims it names')
    ap.add_argument('--md')
    ap.add_argument('--html')
    ap.add_argument('--strict', action='store_true', help='exit 1 when any claim is Not found or Rejected')
    args = ap.parse_args(argv)
    try:
        brief = build(open(args.checklist, encoding='utf-8').read(), args.repo, args.run, args.base, args.head,
                      ALLOWED | set(args.allow), args.timeout, args.pins)
    except (BriefError, OSError) as err:
        print('Error: %s' % err, file=sys.stderr)
        return 2
    text = markdown(brief)
    if args.md:
        open(args.md, 'w', encoding='utf-8').write(text)
    if args.html:
        import review_brief_html
        open(args.html, 'w', encoding='utf-8').write(review_brief_html.page(brief, roots=[brief['repo'], os.path.dirname(os.path.abspath(args.checklist))]))
    print(text)
    return 1 if args.strict and any(c['result'] in (NOT_FOUND, REJECTED) for c in brief['claims']) else 0


if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    sys.exit(main())
