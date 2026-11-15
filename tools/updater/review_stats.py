"""How good is the evidence agents bring, and how fast does the owner answer? Read-only numbers over the checklists in a project.

Each claim is sorted by the strongest evidence it names: a command that runs (`run`), a test file that exists (`test`), only a changed
file (`file`: proves the file changed, not that it works), only something for a person to look at (`look`), or nothing checkable (`vague`,
which the brief rejects). `stale` counts checklists that still have open items after a week: reviews nobody has answered.
"""
import os
import time

import review_answers as ra
import review_brief as rb
import review_projects as rp
import review_status as rs

KINDS = ('run', 'test', 'file', 'look', 'vague')
STALE_DAYS = 7


def kind(fields):
    for k, name in (('run', 'run'), ('test', 'test'), ('file', 'file'), ('look', 'look')):
        if k in fields:
            return name
    return 'vague'


def folders(project, projects):
    loc = rp.review_location(project, projects)
    found = [] if loc['problem'] else [loc['path']]
    for rel in ('reviews', loc['dir']):
        own = os.path.join(project['folder'], *rel.split('/'))
        if own not in found:
            found.append(own)
    return [f for f in found if os.path.isdir(f)]


def stats(project, projects, today=None):
    today = today or time.strftime('%Y-%m-%d')
    out = {'checklists': 0, 'claims': 0, 'kinds': {k: 0 for k in KINDS}, 'answered': 0, 'verdicts': {}, 'stale': 0}
    seen = set()
    for folder in folders(project, projects):
        for path in rs.checklist_files(folder):
            if os.path.realpath(path) in seen:
                continue
            seen.add(os.path.realpath(path))
            row = rs.status(path)
            if row['error']:
                continue
            with open(path, encoding='utf-8') as fh:
                claims = rb.parse(fh.read())[1]
            out['checklists'] += 1
            out['claims'] += len(claims)
            for c in claims:
                out['kinds'][kind(c['fields'])] += 1
            out['answered'] += len(row['answers'])
            for verdict in row['answers'].values():
                if verdict in ra.VERDICTS.values():
                    out['verdicts'][verdict] = out['verdicts'].get(verdict, 0) + 1
            if row['open'] and (time.mktime(time.strptime(today, '%Y-%m-%d')) - time.mktime(time.strptime(row['date'], '%Y-%m-%d'))) > STALE_DAYS * 86400:
                out['stale'] += 1
    return out


def line(s):
    if not s['claims']:
        return 'no checklists yet'
    strong = s['kinds']['run'] + s['kinds']['test']
    return '%d checklist(s), %d claim(s): %d%% have a run or test, %d%% only a changed file%s' % (
        s['checklists'], s['claims'], round(100 * strong / s['claims']), round(100 * s['kinds']['file'] / s['claims']),
        (', %d unanswered for over a week' % s['stale']) if s['stale'] else '')
