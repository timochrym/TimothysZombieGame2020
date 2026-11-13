"""Is each project in good order? A read-only look at git, the manifest and the agent baseline, for the portfolio and `review.py health`.

Nothing here changes anything: it runs `git status`, `git rev-list` and `git log`, reads UPDATER.md, and (when the Updater is on this
computer) asks baseline_sync what it would write. Every finding is a plain sentence in `flags`; a project with no flags is in good order.
"""
import subprocess


def _git(folder, *args):
    try:
        done = subprocess.run(['git', '-C', folder, *args], capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.SubprocessError):
        return None
    return done.stdout.strip() if done.returncode == 0 else None


def baseline_behind(folder):
    """How many baseline files are missing or out of date, or None when the Updater is not on this computer (a tool copy)."""
    try:
        import baseline_sync
        return len(baseline_sync.plan(folder))
    except Exception:                      # no Updater here, or a manifest it cannot read: say nothing rather than guess
        return None


def health(project):
    folder, meta = project['folder'], project['meta']
    out = {'branch': '', 'dirty': 0, 'ahead': 0, 'behind': 0, 'last': '', 'baseline': None, 'flags': []}
    flags = out['flags']
    if _git(folder, 'rev-parse', '--git-dir') is None:
        flags.append('Not a git repository: nothing can be pushed or reviewed from here.')
    else:
        out['branch'] = _git(folder, 'branch', '--show-current') or '(detached)'
        out['last'] = _git(folder, 'log', '-1', '--format=%cs') or ''
        status = _git(folder, 'status', '--porcelain') or ''
        out['dirty'] = len([x for x in status.splitlines() if x.strip()])
        counts = _git(folder, 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}')
        if counts:
            out['ahead'], out['behind'] = [int(x) for x in counts.split()]
        if out['dirty']:
            flags.append('%d uncommitted file(s).' % out['dirty'])
        if out['ahead']:
            flags.append('%d commit(s) not pushed.' % out['ahead'])
        if out['behind']:
            flags.append('%d commit(s) behind its remote (as of the last fetch).' % out['behind'])
    out['baseline'] = baseline_behind(folder)
    if out['baseline']:
        flags.append('Agent rules and review tools are out of date (%d file(s)). Run baseline_sync.py.' % out['baseline'])
    for key, text in (('goal', 'The manifest has no goal.'), ('done', 'The manifest does not say when the work is done.'), ('type', 'The manifest has no type.')):
        if not (meta.get(key) or '').strip():
            flags.append(text)
    if not ((meta.get('commit_name') or '').strip() and (meta.get('commit_email') or '').strip()):
        flags.append('No commit identity in UPDATER.md (commits use whatever git is set to).')
    return out
