"""A short plain-text digest of what needs the owner, for any destination (email, a phone push, a chat message, a terminal).

`build(projects)` collects, across every project on this computer: reviews waiting for an answer (and how long they have waited), and
projects with something to look at (uncommitted or unpushed work, rules or tools that are behind, a manifest with no goal). `text(digest)`
makes a subject line and a body of at most about twenty lines. Nothing here sends anything: a scheduler (cron, launchd, Task Scheduler, a
GitHub Action) runs `review.py digest` and passes the text on. `--only-if-waiting` makes it exit 1 with no output when there is nothing to say,
so a scheduled job can skip sending an empty message.

`commits`, `decided` and `for_page` feed the Digest tab of the Updater page (portfolio_html.py): what changed in each project, what the
owner answered, and what he asked for that is still queued. Reading git is one fixed `git log` argument list (see LOG_ARGS): no text from a
page, a request or a project file ever reaches a git command line, and nothing is changed.
"""
import os
import subprocess
import time

import review_answers as ra
import review_health
import review_projects as rp
import review_stats
import review_status as rs

MAX_LINES = 20


def age_days(date, today):
    try:
        return int((time.mktime(time.strptime(today, '%Y-%m-%d')) - time.mktime(time.strptime(date, '%Y-%m-%d'))) // 86400)
    except ValueError:
        return 0


def build(projects, today=None):
    today = today or time.strftime('%Y-%m-%d')
    waiting, look = [], []
    for p in projects:
        loc = rp.review_location(p, projects)
        for row in (rs.scan(loc['path']) if loc['path'] else []):
            if row['open'] and not row['error']:
                waiting.append({'project': p['name'], 'title': row['title'], 'open': row['open'], 'days': age_days(row['date'], today)})
        try:
            flags = review_health.health(p)['flags']
        except Exception as err:
            flags = ['Could not be checked: %s' % err]
        flags = [f for f in flags if not f.startswith(('No commit identity', 'The manifest'))]          # standing housekeeping, not news
        if flags:
            look.append({'project': p['name'], 'flags': flags})
    waiting.sort(key=lambda w: -w['days'])
    return {'date': today, 'waiting': waiting, 'look': look}


def subject(d):
    w, n = len(d['waiting']), len(d['look'])
    if not w and not n:
        return 'Review digest %s: nothing needs you' % d['date']
    return 'Review digest %s: %d review(s) waiting, %d project(s) to look at' % (d['date'], w, n)


def text(d):
    out = [subject(d), '']
    if d['waiting']:
        out.append('WAITING FOR YOUR ANSWER')
        for w in d['waiting']:
            out.append('- %s: %s (%s; open %s)' % (w['project'], w['title'], 'today' if not w['days'] else '%d day(s) old' % w['days'], ', '.join(w['open'])))
    if d['look']:
        out += [''] if d['waiting'] else []
        out.append('WORTH A LOOK')
        for item in d['look']:
            out.append('- %s: %s' % (item['project'], item['flags'][0] + ((' (+%d more)' % (len(item['flags']) - 1)) if len(item['flags']) > 1 else '')))
    if len(out) > MAX_LINES:
        out = out[:MAX_LINES - 1] + ['... and %d more line(s): run `review.py status` and `review.py health`.' % (len(out) - MAX_LINES + 1)]
    return '\n'.join(out) + '\n'


# ---- the Digest tab: everything in one place, per project, read-only
DAYS, MAX_COMMITS, MAX_DECIDED = 30, 200, 15
LOG_ARGS = ['log', '-n', str(MAX_COMMITS), '--since=%d.days.ago' % DAYS, '--no-merges', '--numstat', '--no-color', '--no-ext-diff',
            '--format=%x1e%h%x1f%cI%x1f%an%x1f%s']            # fixed: nothing user-controlled is ever added
RS, US = '\x1e', '\x1f'


def commits(folder):
    """The project's commits of the last DAYS days, newest first: [{'sha', 'date' (ISO), 'author', 'subject', 'files'}]. [] when git cannot be read."""
    try:
        done = subprocess.run(['git', '-C', folder, *LOG_ARGS], capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.SubprocessError):
        return []
    if done.returncode != 0:
        return []
    out = []
    for chunk in done.stdout.split(RS)[1:]:
        head, _, stat = chunk.partition('\n')
        parts = head.split(US, 3)
        if len(parts) != 4:
            continue
        out.append({'sha': parts[0], 'date': parts[1], 'author': parts[2], 'subject': parts[3][:160], 'files': len([l for l in stat.splitlines() if l.strip()])})
    return out


def _paths(project, projects):
    seen, found = set(), []
    for folder in review_stats.folders(project, projects):
        for path in rs.checklist_files(folder):
            real = os.path.realpath(path)
            if real not in seen:
                seen.add(real)
                found.append(path)
    return found


def decided(projects, limit=MAX_DECIDED):
    """The owner's newest answers across projects, newest first: project, review title, item id and text, his answer and note, and the day."""
    rows = []
    for p in projects:
        for path in _paths(p, projects):
            row = rs.status(path)
            data = None if row['error'] else ra.read_answers(path)
            if not data:
                continue
            try:
                stamp = os.path.getmtime(ra.answers_path(path))
            except OSError:
                stamp = 0
            text = {i['id']: i['text'] for i in row['claims'] + row['questions']}
            for id_, a in data['answers'].items():
                if isinstance(a, dict) and id_ in text and str(a.get('v', '')).strip():
                    at = str(a.get('at', '')) or row['date']
                    rows.append({'project': p['name'], 'project_id': p['id'], 'name': row['name'], 'title': row['title'], 'id': id_, 'text': text[id_],
                                 'v': str(a['v']), 'note': str(a.get('note', '')), 'at': at, '_k': (at, stamp, row['name'], id_)})
    rows.sort(key=lambda r: r['_k'], reverse=True)
    return [{k: v for k, v in r.items() if k != '_k'} for r in rows[:limit]]


def asked_items(orders):
    """The changes the owner asked for that are still queued, from review_next's orders: [{'title', 'date', 'id', 'text', 'verdict', 'note'}]."""
    return [{'title': o['title'], 'date': o['date'], 'id': f['id'], 'text': f['text'], 'verdict': f['verdict'], 'note': f['note']} for o in orders for f in o['fix']]


def for_page(projects, orders_by_id, waiting_by_id):
    """-> the `digest` key of the Updater page model. `orders_by_id` and `waiting_by_id` come from portfolio_html.build_model (already read there)."""
    return {'days': DAYS, 'max_commits': MAX_COMMITS,
            'projects': [{'id': p['id'], 'name': p['name'], 'commits': commits(p['folder']), 'waiting': waiting_by_id.get(p['id'], 0),
                          'asked': asked_items(orders_by_id.get(p['id'], []))} for p in projects],
            'decided': decided(projects)}
