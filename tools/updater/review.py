#!/usr/bin/env python3
"""review: the one command for the review system, in any project that has an UPDATER.md.

    python review.py new --base BASE [--head HEAD] [--name short-name]   start a checklist from the commits in BASE..HEAD
    python review.py brief CHECKLIST [--run] [--pins FILE]               claims next to evidence; writes .brief.md and .brief.html
    python review.py answer CHECKLIST --line "c1 Good · c4 Not right (why) · q1 Better"
    python review.py next [--all]                                        what the owner asked for: a prompt for the next agent session
    python review.py ready CHECKLIST|--latest [--run] [--strict]         is this checklist fit to push? (exit 1 when not)
    python review.py graph [--workspace FOLDER] [--out FILE.md]         a generated map of how the projects connect (Mermaid)
    python review.py pr-body CHECKLIST                                   a pull request description: claims next to evidence
    python review.py stats [--workspace FOLDER]                          how strong is the evidence agents bring, per project
    python review.py health [--workspace FOLDER]                         is each project in good order? (git, manifest, rules and tools)
    python review.py status [--workspace FOLDER] [--json]                what is waiting on you, in every project on this computer
    python review.py portfolio [--workspace FOLDER] [--out FILE]         the same as one offline page

Run it from inside a project (or give --project FOLDER). A project keeps its reviews where its UPDATER.md says: `review_repo`
(another repository, found on this computer by name) and `review_dir`. CHECKLIST is a path, or a name (or the start of one) in that folder.
"""
import argparse
import os
import re
import subprocess
import sys
import time

import review_answers as ra
import review_brief as rb
import review_graph as rg
import review_health as rh
import review_next as rn
import review_projects as rp
import review_stats as rt
import review_status as rs


class CliError(Exception):
    pass


def project_here(start):
    """The nearest folder at or above `start` that has an UPDATER.md."""
    folder = os.path.realpath(start)
    while True:
        if os.path.isfile(os.path.join(folder, 'UPDATER.md')):
            return folder
        parent = os.path.dirname(folder)
        if parent == folder:
            raise CliError('No UPDATER.md here or above. Run this inside a project, or pass --project FOLDER.')
        folder = parent


def context(args):
    folder = project_here(args.project or os.getcwd())
    workspace = getattr(args, 'workspace', None) or os.path.dirname(folder)
    projects = rp.discover(workspace, extra=[folder])
    me = next(p for p in projects if p['folder'] == folder)
    return me, projects, rp.review_location(me, projects)


def review_dir(loc):
    if loc['problem']:
        raise CliError(loc['problem'])
    return loc['path']


def own_folders(me, loc):
    """This project's own review folders (an agent writes here when the review repository is not on its machine)."""
    found = []
    for rel in ('reviews', loc['dir']):
        folder = os.path.join(me['folder'], *rel.split('/'))
        if folder not in found:
            found.append(folder)
    return found


def checklist_folders(me, loc):
    """Where to look for a checklist: the review repository's folder first, then the project's own."""
    folders = [] if loc['problem'] else [loc['path']]
    return folders + [f for f in own_folders(me, loc) if f not in folders and os.path.isdir(f)]


def target_dir(me, loc):
    """Where a new checklist goes: the review repository, or (when it is not here) the project's own reviews/ folder."""
    if loc['problem']:
        print('Note: %s Writing to this project\'s own reviews/ folder instead.' % loc['problem'])
        return os.path.join(me['folder'], 'reviews')
    return loc['path']


def find_checklist(folders, name):
    if os.path.isfile(name):
        return os.path.abspath(name)
    files = [f for folder in folders for f in rs.checklist_files(folder)]
    wanted = re.sub(r'\.md$', '', os.path.basename(name))
    exact = [f for f in files if os.path.basename(f)[:-3] == wanted]
    near = exact or [f for f in files if os.path.basename(f).startswith(wanted)]
    if len(near) != 1:
        raise CliError('%s checklist "%s" in %s.' % ('No' if not near else 'More than one', name, ', '.join(folders) or 'any review folder'))
    return near[0]


def git(folder, *a):
    done = subprocess.run(['git', '-C', folder, *a], capture_output=True, text=True)
    if done.returncode:
        raise CliError('git %s: %s' % (' '.join(a), done.stderr.strip() or 'failed'))
    return done.stdout


def cmd_new(args, me, projects, loc):
    folder = target_dir(me, loc)
    head = args.head or 'HEAD'
    rows = [r.split('\t', 1) for r in git(me['folder'], 'log', '--reverse', '--format=%h\t%s', '%s..%s' % (args.base, head)).splitlines() if r]
    if not rows:
        raise CliError('There are no commits in %s..%s.' % (args.base, head))
    slug = rp.slug(args.name or rows[-1][1])[:40]
    path = os.path.join(folder, '%s-%s.md' % (time.strftime('%Y-%m-%d'), slug))
    if os.path.exists(path):
        raise CliError('%s already exists.' % path)
    lines = ['---', 'title: %s' % (args.title or rows[-1][1][:80]), 'project: %s' % me['name'], 'base: %s' % args.base,
             'head: %s' % git(me['folder'], 'rev-parse', '--short', head).strip(), 'rundir:', '---',
             '<!--', 'DRAFT from the commit messages. Sharpen every line before you rely on it: say what a person can check, and add test:, run:',
             '(with expect: or number: and want:) or look:. A line that only names a file proves the file changed, not that it works.', '-->']
    for sha, subject in rows:
        files = [f for f in git(me['folder'], 'diff-tree', '--no-commit-id', '--name-only', '-r', '--no-renames', sha).splitlines() if f][:3]
        lines.append('- [ ] %s | file: %s' % (subject.replace(' | ', ' / ')[:110], ', '.join(files) or 'UPDATER.md'))
    lines += ['? Does it feel right in use? | options: Better, Same, Worse', '']
    os.makedirs(folder, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))
    print('Wrote %s (%d draft claim(s)). Sharpen it, then: review.py brief %s' % (path, len(rows), os.path.basename(path)[:-3]))
    return 0


def cmd_brief(args, me, projects, loc):
    path = find_checklist(checklist_folders(me, loc), args.checklist)
    pins = args.pins or (path[:-3] + '.pins.json' if os.path.isfile(path[:-3] + '.pins.json') else None)
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    brief = rb.build(text, me['folder'], run=args.run, pins_file=pins, timeout=args.timeout)
    stem = path[:-3]
    with open(stem + '.brief.md', 'w', encoding='utf-8') as fh:
        fh.write(rb.markdown(brief))
    if not args.no_html:
        import review_brief_html
        with open(stem + '.brief.html', 'w', encoding='utf-8') as fh:
            fh.write(review_brief_html.page(brief))
    print(rb.markdown(brief))
    print('Wrote %s.brief.md%s' % (stem, '' if args.no_html else ' and .brief.html'))
    return 0


def cmd_answer(args, me, projects, loc):
    path = find_checklist(checklist_folders(me, loc), args.checklist)
    done = ra.apply_line(path, args.line)
    print('Saved %s in %s' % (', '.join(done['saved']), done['path']))
    print('Still open: %s' % (', '.join(done['open']) or 'nothing'))
    return 0


def cmd_next(args, me, projects, loc):
    folders = checklist_folders(me, loc)
    print(rn.text(me, rn.orders_for(folders, limit=50 if args.all else 3)))
    return 0


def newest_checklist(folders):
    rows = [r for f in folders for r in rs.scan(f)]
    if not rows:
        raise CliError('There is no checklist yet in %s.' % (', '.join(folders) or 'any review folder'))
    return max(rows, key=lambda r: (r['date'], os.path.getmtime(r['path'])))['path']


def cmd_ready(args, me, projects, loc):
    if not args.checklist and not args.latest:
        raise CliError('Name a checklist, or use --latest.')
    path = newest_checklist(checklist_folders(me, loc)) if args.latest else find_checklist(checklist_folders(me, loc), args.checklist)
    with open(path, encoding='utf-8') as fh:
        brief = rb.build(fh.read(), me['folder'], run=args.run, pins_file=None, timeout=args.timeout)
    problems, notes = [], []
    for c in brief['claims']:
        if c['result'] == rb.REJECTED:
            problems.append('%s is Rejected: %s' % (c['id'], c['evidence'][0]))
        elif c['result'] == rb.NOT_FOUND:
            (problems if args.strict else notes).append('%s is Not found (report it to the owner as it is): %s' % (c['id'], c['text']))
    if not brief['claims']:
        problems.append('The checklist has no claims.')
    later = git(me['folder'], 'rev-list', '--count', '%s..HEAD' % brief['ev']['head_sha']).strip()
    if later not in ('', '0'):
        notes.append('%s commit(s) after the checklist head (%s) are not covered by it.' % (later, brief['ev']['head_sha'][:7]))
    for line in problems:
        print('PROBLEM  ' + line)
    for line in notes:
        print('NOTE     ' + line)
    print('NOT READY' if problems else 'READY')
    return 1 if problems else 0


def cmd_stats(args, me, projects, loc):
    for p in projects:
        s = rt.stats(p, projects)
        print('%-22s %s' % (p['name'], rt.line(s)))
        if s['claims']:
            print('    evidence: ' + ', '.join('%d %s' % (n, k) for k, n in s['kinds'].items() if n)
                  + ('; verdicts: ' + ', '.join('%d %s' % (n, k) for k, n in s['verdicts'].items()) if s['verdicts'] else ''))
    return 0


def cmd_health(args, me, projects, loc):
    bad = 0
    for p in projects:
        h = rh.health(p)
        bad += bool(h['flags'])
        print('%-22s %s' % (p['name'], 'in good order' if not h['flags'] else '%d thing(s) to look at' % len(h['flags'])))
        for flag in h['flags']:
            print('    - ' + flag)
    print('\n%d of %d project(s) in good order.' % (len(projects) - bad, len(projects)))
    return 0


def cmd_graph(args, me, projects, loc):
    text = rg.mermaid(projects, time.strftime('%Y-%m-%d'))
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, 'w', encoding='utf-8') as fh:
            fh.write(text)
        print('Wrote %s (%d project(s)).' % (args.out, len(projects)))
    else:
        print(text)
    return 0


def cmd_pr_body(args, me, projects, loc):
    path = find_checklist(checklist_folders(me, loc), args.checklist)
    with open(path, encoding='utf-8') as fh:
        brief = rb.build(fh.read(), me['folder'])
    print(rb.markdown(brief) + '\n_Claims are checked against git by `review.py brief`; "weak evidence" means a file changed but nothing ran._')
    return 0


def waiting(projects):
    """[(project name, review row)] for every checklist with something still open, newest first."""
    items = []
    for p in projects:
        loc = rp.review_location(p, projects)
        for row in rs.scan(loc['path']) if loc['path'] else []:
            if row['open'] or row['error']:
                items.append((p['name'], row))
    return sorted(items, key=lambda x: (x[1]['date'], x[1]['name']), reverse=True)


def cmd_status(args, me, projects, loc):
    items = waiting(projects)
    if args.json:
        import json
        print(json.dumps([{'project': n, **{k: r[k] for k in ('name', 'title', 'date', 'open', 'error', 'brief')}} for n, r in items], indent=2))
        return 0
    if not items:
        print('Nothing is waiting on you in %d project(s).' % len(projects))
        return 0
    for name, r in items:
        print('%-22s %s  %s' % (name, r['date'], r['title']))
        print('    %s' % (('cannot be read: ' + r['error']) if r['error'] else 'open: ' + ', '.join(r['open'])
                           + ('   brief: ' + ', '.join('%d %s' % (n, k) for k, n in r['brief'].items()) if r['brief'] else '   (no brief yet)')))
    return 0


def cmd_portfolio(args, me, projects, loc):
    import portfolio_html
    out = args.out or os.path.join(os.path.expanduser('~'), 'Updater', 'portfolio.html')
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(portfolio_html.page(portfolio_html.build_model(projects)))
    print('Wrote %s (%d project(s)).' % (out, len(projects)))
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description='The review system, in any project.')
    ap.add_argument('--project', help='the project folder (default: the one you are in)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    n = sub.add_parser('new'); n.add_argument('--base', required=True); n.add_argument('--head'); n.add_argument('--name'); n.add_argument('--title')
    b = sub.add_parser('brief'); b.add_argument('checklist'); b.add_argument('--run', action='store_true'); b.add_argument('--pins')
    b.add_argument('--timeout', type=int, default=600); b.add_argument('--no-html', action='store_true')
    a = sub.add_parser('answer'); a.add_argument('checklist'); a.add_argument('--line', required=True)
    x = sub.add_parser('next'); x.add_argument('--all', action='store_true')
    r = sub.add_parser('ready'); r.add_argument('checklist', nargs='?'); r.add_argument('--latest', action='store_true'); r.add_argument('--run', action='store_true'); r.add_argument('--strict', action='store_true'); r.add_argument('--timeout', type=int, default=600)
    t = sub.add_parser('stats'); t.add_argument('--workspace')
    h = sub.add_parser('health'); h.add_argument('--workspace')
    g = sub.add_parser('graph'); g.add_argument('--workspace'); g.add_argument('--out')
    pb = sub.add_parser('pr-body'); pb.add_argument('checklist')
    s = sub.add_parser('status'); s.add_argument('--workspace'); s.add_argument('--json', action='store_true')
    p = sub.add_parser('portfolio'); p.add_argument('--workspace'); p.add_argument('--out')
    args = ap.parse_args(argv)
    try:
        me, projects, loc = context(args)
        return {'new': cmd_new, 'brief': cmd_brief, 'answer': cmd_answer, 'next': cmd_next, 'ready': cmd_ready,
                 'stats': cmd_stats, 'health': cmd_health, 'graph': cmd_graph, 'pr-body': cmd_pr_body, 'status': cmd_status, 'portfolio': cmd_portfolio}[args.cmd](args, me, projects, loc)
    except (CliError, rb.BriefError, ra.AnswerError, OSError) as err:
        print('Error: %s' % err, file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
