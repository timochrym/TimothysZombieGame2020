"""Convert Universal Apps' older review cards (notes/debrief/questions.json and answers.json) into a new-style checklist and answers file.

Only cards that are still open (status "open") are converted; the old files are never changed, so nothing is lost and the old dashboard keeps
working until you retire it. Mapping:
  kind "review"    -> a claim `[r-xxxx] title | look: open <page>`; the old 5 4 3 2 1 later verdicts become Great Good Okay "Not right" "Wrong idea" "Not looked"
  kind "question"  -> a `?` line with the old options as its options
  other kinds (proposals) are not reviews and are left alone
  an answer already in answers.json becomes an answer in the new file, with its note and date
Everything else on a card (why it was asked, its pictures, the original answer) goes in `<name>.details.md` next to the checklist.
The checklist has no base/head: it is for answering and for `review.py next`, not for `review.py brief`.
"""
import json
import os
import re
import time

VERDICT = {'5': 'Great', '4': 'Good', '3': 'Okay', '2': 'Not right', '1': 'Wrong idea', 'later': 'Not looked'}


def _clean(text, limit=110):
    """One line, none of the characters the checklist format reserves."""
    text = re.sub(r'\s+', ' ', str(text or '')).replace(' | ', ' / ').replace('·', '-').strip()
    return text[:limit]


def _label(option):
    return _clean(re.sub(r'\s*,\s*', ' / ', option.get('label') or option.get('value') or ''), 80)


def convert(questions, answers, today=None, status='open'):
    """-> (checklist text, answers dict in the new format or None, details markdown, count of converted cards)."""
    today = today or time.strftime('%Y-%m-%d')
    cards = [c for c in questions if isinstance(c, dict) and c.get('status') == status and c.get('kind') in ('review', 'question')]
    cards.sort(key=lambda c: (c.get('order', 0), str(c.get('id'))))
    lines = ['---', 'title: Legacy review cards (converted %s)' % today, 'project: Universal Apps', '---', '<!--',
             'Converted from notes/debrief/questions.json by review.py import-cards. Each line starts with the old card id; the old files are untouched.',
             'There is no base: this checklist is for answering and for `review.py next`, not for `review.py brief`. Full card text: see the .details.md file.', '-->']
    details = ['# Legacy review cards (converted %s)' % today, '']
    got, claim_no, q_no = {}, 0, 0
    for card in cards:
        old = (answers or {}).get(card.get('id')) or {}
        title = _clean(card.get('title'), 100)
        if card['kind'] == 'review':
            claim_no += 1
            ident = 'c%d' % claim_no
            lines.append('- [ ] [%s] %s | look: %s' % (card['id'], title, _clean('open %s%s' % (card.get('page') or 'the page', (' (' + card['component'] + ')') if card.get('component') else ''), 100)))
            verdict = VERDICT.get(str(old.get('choice')))
            if verdict:
                got[ident] = {'v': verdict}
        else:
            q_no += 1
            ident = 'q%d' % q_no
            options = card.get('options') or []
            lines.append('? [%s] %s%s | options: %s' % (card['id'], title, (' - ' + _clean(card.get('ask'), 70)) if card.get('ask') and card.get('ask') != card.get('title') else '',
                                                       ', '.join(_label(o) for o in options)))
            chosen = next((o for o in options if str(o.get('value')) == str(old.get('choice'))), None)
            if chosen:
                got[ident] = {'v': _label(chosen)}
        if ident in got:
            if old.get('note'):
                got[ident]['note'] = _clean(old['note'], 300)
            got[ident]['at'] = str(old.get('answeredAt') or today)[:10]
        details += ['## %s (%s)  %s' % (card['id'], card['kind'], ident), '', '**%s**' % (card.get('title') or ''), '', (card.get('why') or '').strip(), '']
        if card.get('ask'):
            details.append('Asked: %s' % card['ask'])
        if card.get('page'):
            details.append('Page: %s' % card['page'])
        for image in ([card['image']] if card.get('image') else []) + [i.get('src') for i in (card.get('images') or []) if isinstance(i, dict) and i.get('src')]:
            details.append('Picture: %s' % image)
        if old:
            details.append('Your old answer: %s%s (%s)' % (old.get('label') or old.get('choice'), (' - ' + old['note']) if old.get('note') else '', str(old.get('answeredAt') or '')[:10]))
        details.append('')
    count = claim_no + q_no
    if not count:
        return '', None, '', 0
    data = {'title': 'Legacy review cards (converted %s)' % today, 'span': '', 'source': 'converted from notes/debrief/answers.json', 'answers': got,
            'open': ['c%d' % i for i in range(1, claim_no + 1) if 'c%d' % i not in got] + ['q%d' % i for i in range(1, q_no + 1) if 'q%d' % i not in got]}
    return '\n'.join(lines) + '\n', data, '\n'.join(details) + '\n', count


def import_cards(source_dir, out_dir, today=None, status='open'):
    """Read source_dir/questions.json and answers.json, write the three files into out_dir. -> (path or None, count). Never overwrites."""
    today = today or time.strftime('%Y-%m-%d')
    with open(os.path.join(source_dir, 'questions.json'), encoding='utf-8') as fh:
        questions = json.load(fh)
    try:
        with open(os.path.join(source_dir, 'answers.json'), encoding='utf-8') as fh:
            answers = json.load(fh)
    except (OSError, ValueError):
        answers = {}
    text, data, details, count = convert(questions if isinstance(questions, list) else [], answers if isinstance(answers, dict) else {}, today, status)
    if not count:
        return None, 0
    stem = os.path.join(out_dir, '%s-legacy-cards' % today)
    if os.path.exists(stem + '.md'):
        raise FileExistsError('%s.md already exists: not overwritten.' % stem)
    os.makedirs(out_dir, exist_ok=True)
    for suffix, body in ((".md", text), (".details.md", details), (".answers.json", json.dumps(data, indent=2, ensure_ascii=False) + '\n')):
        with open(stem + suffix, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(body)
    return stem + '.md', count
