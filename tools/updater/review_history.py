"""The history of every project, one timeline: what changed, when, and who wrote it, with the reviews of that time alongside. Read-only; it uses git, so every repository has it.

    entries(project, projects, days, before, q)  -> newest first: commits (hash, time, writer, subject, files, lines) and reviews (a checklist and how much of it you answered)
    merged(projects, ...)                         -> the same across several projects, each entry tagged with its project
    by_day(entries)                               -> [{'date', 'entries'}] for the page

A commit is marked `covered` when some review checklist's base..head range contains it (the same test as `review.py coverage`). Dates are filtered here and not
with `git log --since`, which stops at the first old commit it meets, so one mis-dated commit would hide the rest. Search matches the subject, the writer and the
review title.
"""
import re
import subprocess
import time

import review_branches
import review_coverage
import review_status as rs

PER_PROJECT = 400
STAT_COMMITS = 120
TOTAL = 500


def _git(folder, *args):
    try:
        done = subprocess.run(['git', '-C', folder, *args], capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    return done.stdout if done.returncode == 0 else None


def web_base(folder):
    """The https address of the project's repository (for a link to each commit), or ''."""
    url = (_git(folder, 'remote', 'get-url', 'origin') or '').strip()
    m = re.match(r'^(?:https?://(?:[^@/]+@)?|git@|ssh://git@)(github\.com)[:/]([\w.-]+/[\w.-]+?)(?:\.git)?/?$', url)
    return 'https://%s/%s' % (m.group(1), m.group(2)) if m else ''


_CACHE = {}


def commits(project, projects, days=60, before=None, now=None):
    """Cached for 60 seconds per project and range (the timeline is read often and git is the slow part)."""
    key = (project['folder'], days, before, now is None)
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < 60:
        return hit[1]
    rows = _commits(project, projects, days, before, now)
    _CACHE[key] = (time.time(), rows)
    return rows


def _commits(project, projects, days=60, before=None, now=None):
    folder = project['folder']
    base = review_branches.default_branch(folder, project['meta'])
    ref = ('origin/' + base) if base else 'HEAD'
    # `--since` here only saves git from walking (and diffing) all of history; the exact cut is still made below, with a margin for a mis-dated commit
    now = now if now is not None else time.time()
    log = _git(folder, 'log', ref, '-n', '4000', '--since=@%d' % int(now - (days + 14) * 86400), '--format=@@%H\t%ct\t%an\t%(trailers:key=Co-Authored-By,valueonly,separator=;)\t%s')
    if log is None:
        return []
    cutoff = now - days * 86400
    covered = review_coverage.covered_commits(project, projects)
    web = web_base(folder)
    out, cur = [], None
    for line in log.splitlines():
        if line.startswith('@@'):
            parts = (line[2:].split('\t') + ['', '0', '', '', ''])[:5]
            stamp = int(parts[1] or 0)
            cur = None
            if stamp < cutoff or (before and stamp >= before):
                continue
            who = review_coverage.writer_of(parts[2], parts[3])
            cur = {'type': 'commit', 'sha': parts[0], 'short': parts[0][:7], 'time': stamp, 'author': parts[2], 'who': who, 'subject': parts[4], 'files': 0, 'add': 0, 'del': 0, 'stat': False,
                   'covered': parts[0] in covered, 'url': (web + '/commit/' + parts[0]) if web else ''}
            out.append(cur)
    out = out[:PER_PROJECT]
    # line counts cost git a diff per commit (seconds on a big history), so only the newest few get them; the rest show no counts
    stats = _git(folder, 'log', ref, '-n', str(STAT_COMMITS), '--shortstat', '--format=@@%H') or ''
    cur, by = None, {c['sha']: c for c in out}
    for line in stats.splitlines():
        if line.startswith('@@'):
            cur = by.get(line[2:].strip())
        elif cur is not None and 'changed' in line:
            for key, pat in (('files', r'(\d+) files? changed'), ('add', r'(\d+) insertions?'), ('del', r'(\d+) deletions?')):
                m = re.search(pat, line)
                cur[key] = int(m.group(1)) if m else 0
            cur['stat'] = True
    return out


def reviews(project, projects, days=60, before=None, now=None):
    import review_projects as rp
    loc = rp.review_location(project, projects)
    if not loc.get('path'):
        return []
    now = now if now is not None else time.time()
    out = []
    for row in rs.scan(loc['path']):
        try:
            stamp = int(time.mktime(time.strptime(row['date'], '%Y-%m-%d'))) + 12 * 3600
        except (ValueError, OverflowError):
            continue
        if stamp < now - days * 86400 or (before and stamp >= before):
            continue
        total = len(row['claims']) + len(row['questions'])
        out.append({'type': 'review', 'time': stamp, 'title': row['title'], 'name': row['name'], 'answered': total - len(row['open']), 'total': total, 'error': row['error']})
    return out


def entries(project, projects, days=60, before=None, q='', now=None):
    rows = commits(project, projects, days, before, now) + reviews(project, projects, days, before, now)
    for r in rows:
        r['project'], r['project_id'] = project['name'], project['id']
    q = (q or '').strip().lower()
    if q:
        rows = [r for r in rows if q in ' '.join(str(r.get(k, '')) for k in ('subject', 'author', 'who', 'title', 'project')).lower()]
    return sorted(rows, key=lambda r: r['time'], reverse=True)


def merged(projects, selected, days=60, before=None, q='', now=None):
    """Entries of the selected projects together, newest first, at most TOTAL, plus the time to ask for the next page ('before'), or 0 when that is all."""
    rows = []
    for p in projects:
        if selected in ('all', '', None) or p['id'] == selected:
            rows += entries(p, projects, days, before, q, now)
    rows.sort(key=lambda r: r['time'], reverse=True)
    more = len(rows) > TOTAL
    rows = rows[:TOTAL]
    return rows, (rows[-1]['time'] if more and rows else 0)


def by_day(rows):
    out = {}
    for r in rows:
        out.setdefault(time.strftime('%Y-%m-%d', time.localtime(r['time'])), []).append(r)
    return [{'date': d, 'entries': out[d]} for d in sorted(out, reverse=True)]


def summary(rows):
    """One line: how many commits, by whom, and how many were inside a review."""
    cs = [r for r in rows if r['type'] == 'commit']
    who = {}
    for c in cs:
        who[c['who']] = who.get(c['who'], 0) + 1
    return {'commits': len(cs), 'reviews': len([r for r in rows if r['type'] == 'review']), 'by_writer': who, 'covered': len([c for c in cs if c['covered']])}
