"""Record an answer line next to its checklist, so an answer typed in the chat lands in the repository.

    c1 Good · c4 Not right (still swings on the bridge) · q1 Better

Claim verdicts are the six words the review page offers (Great, Good, Okay, Not right, Wrong idea, Not looked).
A question answer must be one of the options the checklist lists (any text when it lists none). A note goes in brackets.
The line is checked as a whole before anything is written: one wrong id or word and the file is left alone.
The result is `<checklist name>.answers.json` beside the checklist, the same file the review page downloads.
"""
import json
import os
import re
import time

import review_brief as rb
import review_brief_html as rh

VERDICTS = {short.lower(): short for short, _ in rh.SCALE}
SPLIT = re.compile(r"\s*(?:·|\n)\s*")                        # a middle dot or a new line; notes may contain , and ;
ITEM = re.compile(r'^([cq]\d+)\s+(.*?)\s*(?:\((.*)\))?$', re.S | re.I)


class AnswerError(Exception):
    pass


def parse_line(line):
    """'c1 Good · q1 Better (why)' -> [('c1', 'Good', ''), ('q1', 'Better', 'why')]."""
    items = []
    for part in SPLIT.split((line or '').strip()):
        if not part:
            continue
        m = ITEM.match(part)
        if not m or not m.group(2):
            raise AnswerError('Cannot read "%s". Write it like:  c1 Good · c4 Not right (why) · q1 Better' % part)
        items.append((m.group(1).lower(), m.group(2).strip(), (m.group(3) or '').strip()))
    if not items:
        raise AnswerError('The answer line is empty.')
    return items


def answers_path(checklist_path):
    return re.sub(r'\.md$', '', checklist_path) + '.answers.json'


def read_answers(checklist_path):
    try:
        with open(answers_path(checklist_path), encoding='utf-8') as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) and isinstance(data.get('answers'), dict) else None
    except (OSError, ValueError):
        return None


def apply_line(checklist_path, line, source='an answer line from the chat'):
    """Check the line against the checklist, then merge it into the answers file. -> {'saved': [ids], 'open': [ids], 'path': ...}"""
    with open(checklist_path, encoding='utf-8') as fh:
        meta, claims, questions = rb.parse(fh.read())
    claim_ids = [c['id'] for c in claims]
    options = {q['id']: q['options'] for q in questions}
    chosen = {}
    for id_, text, note in parse_line(line):
        if id_.startswith('c'):
            if id_ not in claim_ids:
                raise AnswerError('%s is not a claim in this checklist (claims: %s).' % (id_, ', '.join(claim_ids) or 'none'))
            verdict = VERDICTS.get(re.sub(r'\s+', ' ', text.lower()))
            if not verdict:
                raise AnswerError('"%s" is not a verdict. Use one of: %s.' % (text, ', '.join(VERDICTS.values())))
            chosen[id_] = {'v': verdict}
        else:
            if id_ not in options:
                raise AnswerError('%s is not a question in this checklist (questions: %s).' % (id_, ', '.join(options) or 'none'))
            allowed = {o.lower(): o for o in options[id_]}
            if allowed and text.lower() not in allowed:
                raise AnswerError('"%s" is not an answer to %s. Use one of: %s.' % (text, id_, ', '.join(options[id_])))
            chosen[id_] = {'v': allowed.get(text.lower(), text)}
        if note:
            chosen[id_]['note'] = note
        chosen[id_]['at'] = time.strftime('%Y-%m-%d')
    data = read_answers(checklist_path) or {'title': meta.get('title') or os.path.basename(checklist_path)[:-3],
                                            'span': '%s..%s' % (meta.get('base', ''), meta.get('head') or 'HEAD'), 'answers': {}}
    data['answers'].update(chosen)
    data['source'] = source
    data['open'] = [i for i in claim_ids + list(options) if i not in data['answers']]
    target = answers_path(checklist_path)
    tmp = target + '.tmp%d' % os.getpid()
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write('\n')
    os.replace(tmp, target)
    return {'saved': list(chosen), 'open': data['open'], 'path': target}
