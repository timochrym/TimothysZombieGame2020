"""The task list of every project, and the owner's ranking of it, from whatever the project already keeps. Read-mostly; the writes are few and named.

Where tasks come from (all read, in this order, merged):
    task-log.txt        rows `[TODO] title: detail #ab12`, `[IN_PROGRESS]`, `[REVIEW]` (waiting on the owner), `[DONE]`   (Universal Apps)
    TODO.md, TASKS.md   check boxes `- [ ] title` / `- [x] title`, grouped under their headings                          (the Zombie Game)
    tasks.md            the Updater's own file, in the project's review folder, for a project that keeps nothing:
                        `- [ ] title`, `- [~] title` (doing), `- [?] title` (waiting on you), `- [x] title` (done); lines may end `#ab12`
The ranking (the owner's order, and what is parked for later) is `priority.json` as Tasks & Goals writes it: {"order": [ids], "later": [ids]}. A project that
already has notes/priority.json keeps using that file, so both tools agree; otherwise it lives in the review folder next to tasks.md.

Writes (never to a project's own task files):  priority.json (rank / park a task)  and  tasks.md in the review folder (add a task, change its status).
Agents read the owner's order first: `review.py next` prints it.
"""
import hashlib
import json
import os
import re
import time

STATUS_WORDS = {'TODO': 'todo', 'IN_PROGRESS': 'doing', 'REVIEW': 'waiting', 'BLOCKED': 'waiting', 'DONE': 'done'}
BOX = {' ': 'todo', 'x': 'done', 'X': 'done', '~': 'doing', '?': 'waiting'}
LOG_RE = re.compile(r'^\s*(?:[-*]\s*)?\[(TODO|IN_PROGRESS|REVIEW|BLOCKED|DONE)\]\s+(.*\S)\s*$')
BOX_RE = re.compile(r'^\s*[-*]\s*\[([ xX~?])\]\s+(.*\S)\s*$')
LABEL_RE = re.compile(r'^[^\u2014:]{0,40}\([^)]{0,30}\d{4}-\d{2}-\d{2}\)\s+[\u2014-]\s+')
ID_RE = re.compile(r'\s*#([0-9a-f]{4,8})\s*$')
HEAD_RE = re.compile(r'^#{1,4}\s+(.*\S)\s*$')
MAX_TITLE = 200
MAX_TASKS = 2000


def _split(text):
    """'Title: detail' or 'Title — detail' -> (title, detail), the title at most about 120 characters."""
    text = ID_RE.sub('', text).strip()
    text = LABEL_RE.sub('', text, count=1) or text                                  # "Focus (Tim, 2026-11-11) - Print my day: ..." -> "Print my day: ..."
    for sep in (' — ', ': ', ' - '):
        head, mark, tail = text.partition(sep)
        if mark and 8 <= len(head) <= 120:
            return head.strip(), tail.strip()
    return (text[:117] + '...', text) if len(text) > 120 else (text, '')


def _ident(source, text, used):
    m = ID_RE.search(text)
    base = m.group(1) if m else hashlib.sha1((source + '|' + ID_RE.sub('', text).strip()).encode('utf-8')).hexdigest()[:4]
    ident, n = base, 0
    while ident in used:
        n += 1
        ident = hashlib.sha1((base + str(n)).encode('utf-8')).hexdigest()[:4]
    used.add(ident)
    return ident


def review_folder(project, projects):
    """The folder where the Updater keeps this project's tasks.md and priority.json (its review folder), or ''."""
    import review_projects as rp
    return (rp.review_location(project, projects) or {}).get('path') or ''


def _read(path):
    try:
        with open(path, encoding='utf-8', errors='replace') as fh:
            return fh.read()
    except OSError:
        return ''


def _parse_log(text, source, used):
    out = []
    for line in text.splitlines():
        m = LOG_RE.match(line)
        if m:
            title, detail = _split(m.group(2))
            out.append({'id': _ident(source, m.group(2), used), 'title': title, 'detail': detail, 'status': STATUS_WORDS[m.group(1)], 'source': source, 'section': ''})
    return out


def _parse_boxes(text, source, used):
    out, section = [], ''
    for line in text.splitlines():
        h = HEAD_RE.match(line)
        if h:
            section = h.group(1)
            continue
        m = BOX_RE.match(line)
        if m:
            title, detail = _split(m.group(2))
            out.append({'id': _ident(source, m.group(2), used), 'title': title, 'detail': detail, 'status': BOX[m.group(1)], 'source': source, 'section': section})
    return out


def read_tasks(project, projects):
    """Every task the project has, from all its sources -> [{id, title, detail, status, source, section, project, project_id, editable}]."""
    folder, used, out = project['folder'], set(), []
    out += _parse_log(_read(os.path.join(folder, 'task-log.txt')), 'task-log.txt', used)
    for name in ('TODO.md', 'TASKS.md'):
        out += _parse_boxes(_read(os.path.join(folder, name)), name, used)
    review = review_folder(project, projects)
    if review:
        own = _parse_boxes(_read(os.path.join(review, 'tasks.md')), 'tasks.md', used)
        for t in own:
            t['editable'] = True
        out += own
    for t in out[:MAX_TASKS]:
        t.setdefault('editable', False)
        t['project'], t['project_id'] = project['name'], project['id']
    return out[:MAX_TASKS]


# ---- the owner's ranking

def priority_path(project, projects):
    own = os.path.join(project['folder'], 'notes', 'priority.json')
    if os.path.isfile(own):
        return own
    review = review_folder(project, projects)
    return os.path.join(review, 'priority.json') if review else ''


def load_priority(project, projects):
    path = priority_path(project, projects)
    try:
        with open(path, encoding='utf-8') as fh:
            data = json.load(fh)
        order, later = [str(x) for x in data.get('order', [])], [str(x) for x in data.get('later', [])]
    except (OSError, ValueError, AttributeError):
        order, later = [], []
    return {'order': order, 'later': later}


def save_priority(project, projects, order, later):
    path = priority_path(project, projects)
    if not path:
        raise ValueError('There is no review folder for this project on this computer, so the order cannot be saved.')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump({'order': order, 'later': later, 'updated': time.strftime('%Y-%m-%dT%H:%M:%S'), 'by': 'updater'}, fh, indent=2)
        fh.write('\n')
    os.replace(tmp, path)


def board(project, projects):
    """-> {'next': [...], 'doing': [...], 'waiting': [...], 'later': [...], 'done': [...]} with the owner's order applied to next and later."""
    tasks = read_tasks(project, projects)
    prio = load_priority(project, projects)
    rank = {i: n for n, i in enumerate(prio['order'])}
    todo = [t for t in tasks if t['status'] == 'todo']
    later = [t for t in todo if t['id'] in set(prio['later'])]
    nxt = [t for t in todo if t['id'] not in set(prio['later'])]
    key = lambda t: rank.get(t['id'], len(rank) + 1)                      # noqa: E731  (unranked ones keep the file order after the ranked ones)
    nxt.sort(key=key)
    later.sort(key=key)
    return {'next': nxt, 'doing': [t for t in tasks if t['status'] == 'doing'], 'waiting': [t for t in tasks if t['status'] == 'waiting'], 'later': later,
            'done': [t for t in tasks if t['status'] == 'done'][-20:][::-1]}


def move(project, projects, ident, to):
    """Rank or park one task: to is top | up | down | at:<place> | later | next. Writes priority.json only."""
    cols = board(project, projects)
    if ident not in {t['id'] for c in ('next', 'later') for t in cols[c]}:
        raise ValueError('Only a task that is waiting for its turn can be ranked.')
    order = [t['id'] for t in cols['next']]                                # the whole visible order becomes the saved order, so a move is exact
    later = [t['id'] for t in cols['later']]
    if to == 'later':
        order = [i for i in order if i != ident]
        later = [i for i in later if i != ident] + [ident]
    elif to == 'next':
        later = [i for i in later if i != ident]
        order = order + [ident] if ident not in order else order
    elif ident in order:
        at = order.index(ident)
        order.pop(at)
        if to.startswith('at:') and to[3:].isdigit():                       # an exact place, for drag and drop
            order.insert(min(int(to[3:]), len(order)), ident)
        elif to in ('top', 'up', 'down'):
            order.insert({'top': 0, 'up': max(at - 1, 0), 'down': min(at + 1, len(order))}[to], ident)
        else:
            raise ValueError('Move a task to top, up, down, later, next or at:<place>.')
    else:
        raise ValueError('That task is parked; move it back to Up next first.')
    save_priority(project, projects, order, later)
    return {'order': order, 'later': later}


# ---- the Updater's own tasks.md

def _own_path(project, projects):
    review = review_folder(project, projects)
    if not review:
        raise ValueError('There is no review folder for this project on this computer, so a task cannot be added.')
    return os.path.join(review, 'tasks.md')


def add_task(project, projects, title, status=' '):
    title = re.sub(r'\s+', ' ', str(title or '')).strip()
    if not title:
        raise ValueError('Write what the task is.')
    if len(title) > MAX_TITLE:
        raise ValueError('Keep a task title under %d characters; put the rest in the project.' % MAX_TITLE)
    path = _own_path(project, projects)
    text = _read(path)
    used = {t['id'] for t in read_tasks(project, projects)}
    ident = _ident('tasks.md', title, used)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    head = '' if text else '# Tasks\n\nKept by the Updater. `- [ ]` to do, `- [~]` doing, `- [?]` waiting on you, `- [x]` done.\n\n'
    with open(path, 'a', encoding='utf-8', newline='\n') as fh:
        fh.write(head + ('' if not text or text.endswith('\n') else '\n') + '- [%s] %s #%s\n' % (status, title, ident))
    return ident


def set_status(project, projects, ident, status):
    """Change a task in the Updater's own tasks.md: todo | doing | waiting | done."""
    mark = {'todo': ' ', 'doing': '~', 'waiting': '?', 'done': 'x'}.get(status)
    if mark is None:
        raise ValueError('Status must be todo, doing, waiting or done.')
    path = _own_path(project, projects)
    lines, hit = _read(path).split('\n'), False
    used = set()
    for n, line in enumerate(lines):
        m = BOX_RE.match(line)
        if m and _ident('tasks.md', m.group(2), used) == ident:
            lines[n], hit = re.sub(r'\[[ xX~?]\]', '[%s]' % mark, line, count=1), True
            break
    if not hit:
        raise ValueError('That task is kept in the project\'s own file, so change its status there.')
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(lines))
    return ident


# ---- spreadsheet import (csv / tsv)

def _tasks_from_rows(rows, limit=500):
    rows = [[str(c) for c in r] for r in rows if any(str(c).strip() for c in r)]
    if not rows:
        return []
    head = [c.strip().lower() for c in rows[0]]
    tcol = next((i for i, c in enumerate(head) if c in ('title', 'task', 'name', 'summary', 'item')), None)
    scol = next((i for i, c in enumerate(head) if c in ('status', 'state', 'done', 'complete', 'completed')), None)
    body = rows[1:] if tcol is not None else rows
    tcol = tcol if tcol is not None else 0
    out = []
    for r in body[:limit]:
        title = re.sub(r'\s+', ' ', r[tcol]).strip() if tcol < len(r) else ''
        if not title:
            continue
        raw = (r[scol].strip().lower() if scol is not None and scol < len(r) else '')
        out.append({'title': title[:MAX_TITLE], 'status': 'done' if raw in ('done', 'complete', 'completed', 'closed', 'yes', 'true', 'x', '1') else 'todo'})
    return out


def parse_table(text, limit=500):
    """csv or tsv text -> [{'title', 'status'}]. A header row with Title/Task/Name (and optionally Status/Done) is used; without one, the first column is the title."""
    import csv
    import io
    text = text.lstrip('\ufeff')
    if not text.strip():
        return []
    delim = '\t' if text.count('\t') >= text.count(',') and '\t' in text else ','
    return _tasks_from_rows(list(csv.reader(io.StringIO(text), delimiter=delim)), limit)


XLSX_MAX_PART = 3 * 1024 * 1024             # an uploaded file is untrusted: no part of the zip may expand past this, and no DOCTYPE is accepted
XLSX_MAX_BYTES = 1024 * 1024


def parse_xlsx(data, limit=500):
    """The first sheet of an .xlsx file (bytes) -> the same [{'title', 'status'}] as parse_table. Raises ValueError for anything that is not a plain workbook."""
    import io
    import xml.etree.ElementTree as ET
    import zipfile
    if len(data) > XLSX_MAX_BYTES:
        raise ValueError('That spreadsheet is too large (1 MB at most).')

    def part(zf, name):
        info = zf.getinfo(name)
        if info.file_size > XLSX_MAX_PART:
            raise ValueError('That spreadsheet is not a plain workbook.')
        raw = zf.read(name)
        if b'<!DOCTYPE' in raw[:2048].upper() or b'<!ENTITY' in raw.upper():
            raise ValueError('That spreadsheet is not a plain workbook.')
        return ET.fromstring(raw)

    ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
        names = set(zf.namelist())
        shared = []
        if 'xl/sharedStrings.xml' in names:
            shared = [''.join(t.text or '' for t in si.iter(ns + 't')) for si in part(zf, 'xl/sharedStrings.xml').iter(ns + 'si')]
        sheet = next((n for n in sorted(names) if re.match(r'^xl/worksheets/sheet\d+\.xml$', n)), None)
        if not sheet:
            raise ValueError('That file has no sheet in it.')
        rows = []
        for row in part(zf, sheet).iter(ns + 'row'):
            cells = {}
            for c in row.iter(ns + 'c'):
                col = re.match(r'^([A-Z]+)', c.get('r', 'A'))
                idx = 0
                for ch in (col.group(1) if col else 'A'):
                    idx = idx * 26 + ord(ch) - 64
                kind, v = c.get('t'), c.find(ns + 'v')
                if kind == 's' and v is not None and (v.text or '').isdigit() and int(v.text) < len(shared):
                    text = shared[int(v.text)]
                elif kind == 'inlineStr':
                    text = ''.join(t.text or '' for t in c.iter(ns + 't'))
                else:
                    text = (v.text or '') if v is not None else ''
                cells[idx - 1] = text
            rows.append([cells.get(i, '') for i in range(max(cells) + 1)] if cells else [])
            if len(rows) > limit + 5:
                break
    except (zipfile.BadZipFile, KeyError, ET.ParseError) as err:
        raise ValueError('That file is not a readable .xlsx workbook (%s).' % err.__class__.__name__)
    return _tasks_from_rows(rows, limit)


def import_rows(project, projects, rows):
    """Add the rows from parse_table to the Updater's own tasks.md. -> number added."""
    n = 0
    for row in rows[:500]:
        add_task(project, projects, row['title'], 'x' if row.get('status') == 'done' else ' ')
        n += 1
    return n


def owner_order(project, projects, count=5):
    """The first few 'Up next' titles, for the agent's briefing."""
    return [t['title'] for t in board(project, projects)['next'][:count]]
