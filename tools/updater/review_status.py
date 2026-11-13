"""What is waiting on the owner: every checklist in a review folder, with its answers and its brief.

A review folder holds, per piece of work (all sharing one name):
    2026-11-13-pathfinding.md            the checklist (claims and questions)
    2026-11-13-pathfinding.brief.md      the brief the tool printed (claims next to evidence)
    2026-11-13-pathfinding.brief.html    the same as a page
    2026-11-13-pathfinding.answers.json  the owner's answers
`scan()` reads them all and says, for each checklist, which claims and questions are still open.
"""
import os
import re
import time

import review_answers as ra
import review_brief as rb

DATE = re.compile(r'^(\d{4}-\d{2}-\d{2})')


def checklist_files(review_dir):
    if not review_dir or not os.path.isdir(review_dir):
        return []
    return sorted(os.path.join(review_dir, n) for n in os.listdir(review_dir)
                  if n.endswith('.md') and not n.endswith(('.brief.md', '.details.md')) and n.lower() != 'readme.md')


def brief_counts(path):
    """{'Found': 6, 'You decide': 1} from the first bold line of a .brief.md, or None."""
    try:
        with open(path, encoding='utf-8') as fh:
            for line in fh:
                m = re.match(r'^\*\*(.+)\*\*\s*$', line.strip())
                if not m:
                    continue
                counts = {}
                for piece in m.group(1).split(', '):
                    n = re.match(r'^(\d+)\s+(.+)$', piece.strip())
                    if n:
                        counts[n.group(2)] = int(n.group(1))
                return counts or None
    except OSError:
        pass
    return None


def status(path):
    name = os.path.basename(path)[:-3]
    stem = path[:-3]
    m = DATE.match(name)
    out = {'name': name, 'path': path, 'date': m.group(1) if m else time.strftime('%Y-%m-%d', time.localtime(os.path.getmtime(path))),
           'title': name, 'claims': [], 'questions': [], 'answers': {}, 'open': [], 'error': '',
           'brief': brief_counts(stem + '.brief.md'), 'brief_html': stem + '.brief.html' if os.path.isfile(stem + '.brief.html') else ''}
    try:
        with open(path, encoding='utf-8') as fh:
            meta, claims, questions = rb.parse(fh.read())
    except (OSError, rb.BriefError) as err:
        out['error'] = str(err)
        return out
    out['title'] = meta.get('title') or name
    out['project'] = meta.get('project', '')
    out['claims'] = [{'id': c['id'], 'text': c['text']} for c in claims]
    out['questions'] = [{'id': q['id'], 'text': q['text'], 'options': q['options']} for q in questions]
    got = ra.read_answers(path)
    out['answers'] = {k: v.get('v', '') for k, v in (got or {}).get('answers', {}).items() if isinstance(v, dict)}
    out['open'] = [i['id'] for i in out['claims'] + out['questions'] if i['id'] not in out['answers']]
    return out


def scan(review_dir):
    """Every checklist in the folder, newest first."""
    rows = [status(p) for p in checklist_files(review_dir)]
    return sorted(rows, key=lambda r: (r['date'], r['name']), reverse=True)
