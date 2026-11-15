"""Which branches in a project are finished, and which hold work that exists nowhere else? Read-only; it never deletes anything.

Every remote branch (as of the last fetch) is sorted:
  merged         every commit is already in the default branch
  squash-merged  not an ancestor, but every patch is already in the default branch (`git cherry`), as after a squash merge
  unmerged       has commits the default branch does not have: real work, keep it
  unknown        the clone is shallow (only recent history), so an old branch cannot be judged: run `git fetch --unshallow` and ask again
  recent         touched in the last few days: it may be in use, so it is never offered for deletion
  protected      main, master, backup/*, legacy-*: never offered
`delete_script()` writes a shell script that deletes only the merged and squash-merged ones that are not recent, with each branch's commit
id beside it so any of them can be restored. The script is text; running it is your decision, and nothing in the Updater runs it.
"""
import re
import subprocess
import time

PROTECTED_NAMES = ('main', 'master', 'head')
PROTECTED_PREFIXES = ('backup/', 'legacy-')


def _git(folder, *args):
    try:
        done = subprocess.run(['git', '-C', folder, *args], capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    return done.stdout.strip() if done.returncode == 0 else None


def default_branch(folder, meta):
    """The branch the others are compared with: the manifest's `branch`, else origin's HEAD, else main or master."""
    for candidate in (meta.get('branch'), (_git(folder, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD') or '').replace('origin/', ''), 'main', 'master'):
        if candidate and _git(folder, 'rev-parse', '--verify', '-q', 'refs/remotes/origin/' + candidate):
            return candidate
    return ''


def branches(project, recent_days=3, now=None):
    """-> {'default': name, 'items': [{'name','sha','date','age_days','ahead','kind','delete_ok'}]} newest first; empty when not a git repository."""
    folder, meta = project['folder'], project['meta']
    out = {'default': '', 'items': [], 'shallow': False}
    if _git(folder, 'rev-parse', '--git-dir') is None:
        return out
    out['shallow'] = _git(folder, 'rev-parse', '--is-shallow-repository') == 'true'
    base = default_branch(folder, meta)
    out['default'] = base
    if not base:
        return out
    now = now or time.time()
    rows = (_git(folder, 'for-each-ref', '--format=%(refname:short)\t%(objectname)\t%(committerdate:unix)', 'refs/remotes/origin') or '').splitlines()
    for row in rows:
        name, sha, stamp = (row.split('\t') + ['', '', '0'])[:3]
        name = re.sub(r'^origin/', '', name)
        if not name or name == 'origin' or name == base or name.lower() == 'head':
            continue
        age = (now - int(stamp or 0)) / 86400.0
        ahead = int(_git(folder, 'rev-list', '--count', 'origin/%s..origin/%s' % (base, name)) or 0)
        if name.lower() in PROTECTED_NAMES or name.startswith(PROTECTED_PREFIXES):
            kind = 'protected'
        elif ahead == 0:
            kind = 'merged'
        elif not [l for l in (_git(folder, 'cherry', 'origin/' + base, 'origin/' + name) or '').splitlines() if l.startswith('+')]:
            kind = 'squash-merged'
        else:
            kind = 'unknown' if out['shallow'] else 'unmerged'          # a shallow clone cannot tell old work from old merges
        if age < recent_days and kind in ('merged', 'squash-merged'):
            kind = 'recent'
        out['items'].append({'name': name, 'sha': sha, 'date': time.strftime('%Y-%m-%d', time.gmtime(int(stamp or 0))), 'age_days': int(age),
                             'ahead': ahead, 'kind': kind, 'delete_ok': kind in ('merged', 'squash-merged')})
    out['items'].sort(key=lambda i: (i['date'], i['name']), reverse=True)
    return out


def summary(result):
    counts = {}
    for item in result['items']:
        counts[item['kind']] = counts.get(item['kind'], 0) + 1
    return counts


def delete_script(project, result):
    """Text of a shell script that deletes the finished branches. Nothing is run here."""
    folder = project['folder']
    url = _git(folder, 'remote', 'get-url', 'origin') or '<remote url>'
    todo = [i for i in result['items'] if i['delete_ok']]
    lines = ['#!/bin/bash', '# Deletes finished branches of %s from its remote. Written %s by review.py branches; NOTHING has been deleted yet.' % (project['name'], time.strftime('%Y-%m-%d')),
             '# Only branches already contained in %s (merged, or squash-merged with the same patches) and untouched for days are listed.' % result['default'],
             '# Restore one with:  git push %s <SHA>:refs/heads/<branch>' % url, 'set -e', '']
    if not todo:
        return '\n'.join(lines + ['echo "Nothing to delete."', ''])
    lines += ['#   %-40s %s  %s  last:%s' % (i['name'], i['sha'][:10], i['kind'], i['date']) for i in todo]
    lines.append('git push %s --delete \\' % re.sub(r"[^\w./:@-]", '', url))
    lines.append(' \\\n'.join("  '%s'" % i['name'].replace("'", "'\\''") for i in todo))
    return '\n'.join(lines + [''])
