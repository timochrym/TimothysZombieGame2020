"""How much of the recent work is covered by a review? Read-only.

For each project: the commits on its default branch in the last N days, and how many of them fall inside the range (base..head) of some
checklist. Each commit is attributed to a kind of writer from its Co-Authored-By trailer or its author: Claude, Codex, Gemini, a CI bot, or a human.
A checklist with no base (such as the converted legacy cards) or with a base this clone cannot find covers nothing: it is a to-do list, not a review of a range.
The number to watch is the share of commits that no checklist covers: that work was never put next to evidence.
"""
import re
import subprocess
import time

import review_branches
import review_brief as rb
import review_stats
import review_status as rs

WRITERS = (('Claude', re.compile(r'claude|anthropic', re.I)), ('Codex', re.compile(r'codex|openai', re.I)),
           ('Gemini', re.compile(r'gemini|antigravity', re.I)), ('CI bot', re.compile(r'github-actions|\[bot\]', re.I)))


def _git(folder, *args):
    try:
        done = subprocess.run(['git', '-C', folder, *args], capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    return done.stdout if done.returncode == 0 else None


def writer_of(author, trailers):
    text = '%s %s' % (author or '', trailers or '')
    for name, rx in WRITERS:
        if rx.search(text):
            return name
    return 'human'


def covered_commits(project, projects):
    """The set of commit ids inside any checklist's base..head range in this project's review folders."""
    covered = set()
    for folder in review_stats.folders(project, projects):
        for path in rs.checklist_files(folder):
            try:
                with open(path, encoding='utf-8') as fh:
                    meta = rb.parse(fh.read())[0]
            except (OSError, rb.BriefError):
                continue
            if not meta.get('base'):
                continue
            out = _git(project['folder'], 'rev-list', '%s..%s' % (meta['base'], meta.get('head') or 'HEAD'))
            if out:
                covered.update(out.split())
    return covered


def coverage(project, projects, days=30):
    """-> {'days', 'default', 'total', 'covered', 'by_writer': {name: [total, covered]}} (zeros when there is no git history to read)."""
    out = {'days': days, 'default': '', 'total': 0, 'covered': 0, 'by_writer': {}, 'shallow': (_git(project['folder'], 'rev-parse', '--is-shallow-repository') or '').strip() == 'true'}
    base = review_branches.default_branch(project['folder'], project['meta'])
    ref = ('origin/' + base) if base else 'HEAD'
    # Filter by date here, not with `git log --since`: that stops at the first old commit it meets, so one mis-dated commit (a rebase, a cherry-pick) would hide the rest.
    log = _git(project['folder'], 'log', ref, '-n', '50000', '--no-merges', '--format=%H%x09%an%x09%ct%x09%(trailers:key=Co-Authored-By,valueonly,separator=;)')
    cutoff = time.time() - days * 86400
    if log is None:
        return out
    out['default'] = base
    covered = covered_commits(project, projects)
    for line in log.splitlines():
        parts = (line.split('\t') + ['', '', '0', ''])[:4]
        if not parts[0] or int(parts[2] or 0) < cutoff:
            continue
        who = writer_of(parts[1], parts[3])
        slot = out['by_writer'].setdefault(who, [0, 0])
        slot[0] += 1
        out['total'] += 1
        if parts[0] in covered:
            slot[1] += 1
            out['covered'] += 1
    return out


def line(c):
    if not c['total']:
        return 'no commits in the last %d days' % c['days']
    return '%d of %d commit(s) in the last %d days are covered by a review (%d%%)%s' % (c['covered'], c['total'], c['days'], round(100 * c['covered'] / c['total']),
                                                                                         ' [shallow clone: older commits are missing, so counts may be low]' if c.get('shallow') else '')
