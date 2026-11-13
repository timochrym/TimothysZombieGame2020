"""A short plain-text digest of what needs the owner, for any destination (email, a phone push, a chat message, a terminal).

`build(projects)` collects, across every project on this computer: reviews waiting for an answer (and how long they have waited), and
projects with something to look at (uncommitted or unpushed work, rules or tools that are behind, a manifest with no goal). `text(digest)`
makes a subject line and a body of at most about twenty lines. Nothing here sends anything: a scheduler (cron, launchd, Task Scheduler, a
GitHub Action) runs `review.py digest` and passes the text on. `--only-if-waiting` makes it exit 1 with no output when there is nothing to say,
so a scheduled job can skip sending an empty message.
"""
import time

import review_health
import review_projects as rp
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
