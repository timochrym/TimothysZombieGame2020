"""Turn the owner's answers into work for the next agent session: the other half of the review loop.

`review.py next` prints this as a prompt an agent can read first. It looks at every checklist for a project (in its review
repository and in the project's own reviews/ folder, where an agent writes one when the review repository is not on its machine):

  asked for changes   claims answered Not right, Wrong idea or Okay (small tweaks), with the owner's note and any pins on that claim
  decisions made      question answers, and what was chosen
  waiting on owner    claims and questions with no answer yet: do not redo them, and do not assume an answer
  accepted            claims answered Great or Good: leave them alone

A checklist whose claims are all answered and need no change is not listed again.
"""
import json
import os

import review_answers as ra
import review_brief as rb
import review_status as rs

FIX = ('Not right', 'Wrong idea', 'Okay')


def pins_for(checklist_path):
    path = checklist_path[:-3] + '.pins.json'
    if not os.path.isfile(path):
        return []
    try:
        return rb.load_pins(path)
    except rb.BriefError:
        return []


def read_notes(checklist_path):
    try:
        with open(ra.answers_path(checklist_path), encoding='utf-8') as fh:
            data = json.load(fh)
        return {k: v.get('note', '') for k, v in data.get('answers', {}).items() if isinstance(v, dict)}
    except (OSError, ValueError, AttributeError):
        return {}


def work_order(path):
    """One checklist -> {'title', 'date', 'name', 'fix': [...], 'decisions': [...], 'waiting': [...], 'accepted': [...]}, or None if nothing is left."""
    row = rs.status(path)
    if row['error']:
        return None
    notes, pins = read_notes(path), pins_for(path)
    order = {'title': row['title'], 'date': row['date'], 'name': row['name'], 'fix': [], 'decisions': [], 'waiting': list(row['open']), 'accepted': []}
    for claim in row['claims']:
        verdict = row['answers'].get(claim['id'])
        if verdict in FIX:
            order['fix'].append({'id': claim['id'], 'text': claim['text'], 'verdict': verdict, 'note': notes.get(claim['id'], ''),
                                 'pins': [p for p in pins if p['claim'] == claim['id']]})
        elif verdict in ('Great', 'Good'):
            order['accepted'].append(claim['id'])
    for q in row['questions']:
        if q['id'] in row['answers']:
            order['decisions'].append({'id': q['id'], 'text': q['text'], 'answer': row['answers'][q['id']], 'note': notes.get(q['id'], '')})
    return order if order['fix'] or order['waiting'] or order['decisions'] else None


def orders_for(folders, limit=3):
    """The newest `limit` checklists in the folders that still ask something of the next session."""
    seen, found = set(), []
    for folder in folders:
        for path in rs.checklist_files(folder):
            real = os.path.realpath(path)
            if real in seen:
                continue
            seen.add(real)
            order = work_order(path)
            if order:
                found.append(order)
    return sorted(found, key=lambda o: (o['date'], o['name']), reverse=True)[:limit]


def text(project, orders):
    meta = project['meta']
    out = ['# Next work for %s' % project['name'], '']
    if meta.get('goal'):
        out.append('Goal: %s' % meta['goal'])
    if meta.get('done'):
        out.append('Done when: %s' % meta['done'])
    out += ['Read AGENT-RULES.md first. Before you finish, write a new review checklist and check it.', '']
    if not orders:
        return '\n'.join(out + ['The owner has asked for nothing: no open changes, no unanswered claims or questions.', ''])
    for o in orders:
        out += ['## %s (%s)' % (o['title'], o['date']), '']
        if o['fix']:
            out.append('The owner asked for changes:')
            for f in o['fix']:
                out.append('- %s "%s": %s%s' % (f['id'], f['text'], f['verdict'], (' - ' + f['note']) if f['note'] else ''))
                for p in f['pins']:
                    where = ('canvas %s,%s' % (p['target']['canvas'].get('x'), p['target']['canvas'].get('y'))) if p['target']['canvas'] else p['target']['selector']
                    out.append('    - pointed at %s: %s' % (where, p['note'] or '(no note)'))
        if o['decisions']:
            out.append('Decisions already made (follow them):')
            out += ['- %s "%s": %s%s' % (d['id'], d['text'], d['answer'], (' - ' + d['note']) if d['note'] else '') for d in o['decisions']]
        if o['waiting']:
            out.append('Waiting on the owner (do not redo these, and do not guess the answer): %s' % ', '.join(o['waiting']))
        if o['accepted']:
            out.append('Accepted, leave alone: %s' % ', '.join(o['accepted']))
        out.append('')
    return '\n'.join(out)
