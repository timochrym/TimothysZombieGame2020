"""The Tasks and History tabs of the review website: the extra panes next to Now / Projects / Answered / Digest.

PANES is what portfolio_html adds to its tab strip. The panes load when first opened (so the page itself stays quick) through the token-guarded endpoints
/api/tasks and /api/history, and draw with textContent only, like every page here.

Tasks     a rank board of Up next / Doing / Waiting on you / Later for every project (what each project keeps, read as it is; see review_tasks.py),
          drag a card (or Alt+Up / Alt+Down, or its buttons) to rank it, Later parks it; add a task; import a .csv or .tsv with a preview first
History   every project's commits by day, with who wrote them (Claude, Codex, a person, CI), how big, whether a review covers them, and the reviews of that
          time; filter by project and range, search, load older
Proposals what agents suggest (notes/proposals.md): the ones waiting for your decision first, with Approve / Not now / No; the rest by state (review_notes.py)
Retros    how each agent session went, with what agents ask of you on top (notes/retros.json, RETROS.md)
"""

PANES = [('tasks', 'Tasks'), ('history', 'History'), ('proposals', 'Proposals'), ('retros', 'Retros')]

CSS = """
.wsbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 14px}.wsbar .grow{flex:1;min-width:160px}
.pills{display:flex;gap:6px;flex-wrap:wrap}.pills button{background:var(--card2)!important;color:var(--text)!important;border:1px solid var(--line);box-shadow:none!important;border-radius:999px;padding:5px 13px;font-weight:550;font-size:.9rem}
.pills button.on{background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 92%,#fff),var(--accent))!important;color:var(--on)!important;border-color:var(--accent)}
.pills button .n{opacity:.7;margin-left:5px;font-weight:500}
.board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-items:start}
@media (max-width:1000px){.board{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:620px){.board{grid-template-columns:1fr}}
.col{padding:12px!important;min-height:120px}.col>h3{margin:2px 4px 10px;font-size:.95rem;display:flex;gap:8px;align-items:baseline}.col>h3 .n{color:var(--soft);font-weight:500;font-size:.8rem}
.col .more{margin:6px 4px 2px}
.tcard{background:var(--card2);border:1px solid var(--line);border-radius:16px;padding:10px 12px;margin:0 0 8px;cursor:grab;transition:transform .14s,border-color .14s,box-shadow .14s}
.tcard:hover{border-color:color-mix(in srgb,var(--accent) 50%,var(--line))}.tcard:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.tcard.drag{opacity:.45}.col.over{outline:2px dashed var(--accent);outline-offset:-4px}.tcard.over{border-color:var(--accent);box-shadow:0 -3px 0 var(--accent)}
.tcard .t{font-weight:600;line-height:1.3;overflow-wrap:anywhere}.tcard .d{color:var(--soft);font-size:.84rem;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tcard .meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;align-items:center}.tcard .meta .badge{margin:0;font-size:.7rem;padding:0 7px}.tcard .meta .dim{font-size:.76rem}
.tcard .acts{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}.tcard .acts button{background:var(--card)!important;color:var(--soft)!important;border:1px solid var(--line);box-shadow:none!important;border-radius:10px;padding:2px 9px;font-size:.78rem;font-weight:550}
.tcard .acts button:hover{color:var(--text)!important;border-color:var(--accent)}
.compose{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 14px}.compose input[type=text]{flex:1;min-width:200px}
.import{margin:0 0 14px;padding:14px 16px}.import table{border-collapse:collapse;width:100%;font-size:.88rem;margin:8px 0}.import td,.import th{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line)}
.day{margin:0 0 20px}.day>h3{position:sticky;top:64px;z-index:3;margin:0 0 8px;padding:6px 4px;font-size:.95rem;display:flex;gap:10px;align-items:baseline;background:linear-gradient(var(--bg) 60%,transparent)}.day>h3 .n{color:var(--soft);font-weight:500;font-size:.8rem}
.hrow{display:flex;gap:10px;align-items:baseline;padding:7px 12px;border-radius:14px;border:1px solid transparent}.hrow:hover{background:var(--card);border-color:var(--line)}
.hrow .tm{font:.78rem ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--soft);min-width:3.2em}.hrow .sj{flex:1;min-width:0;overflow-wrap:anywhere}.hrow .sj a{color:var(--text);text-decoration:none}.hrow .sj a:hover{color:var(--accent)}
.hrow .st{font:.74rem ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--soft);white-space:nowrap}.hrow .st .a{color:var(--ok)}.hrow .st .r{color:var(--bad)}
.who{font-size:.7rem;font-weight:700;letter-spacing:.03em;padding:1px 8px;border-radius:999px;border:1px solid currentColor;white-space:nowrap}
.who.Claude{color:#c084fc}.who.Codex{color:#5ab0ff}.who.Gemini{color:#fbbf24}.who.human{color:var(--ok)}.who.CI{color:var(--soft)}
@media (max-width:640px){.hrow{flex-wrap:wrap;gap:4px 8px}.hrow .sj{flex-basis:100%;order:5}.hrow .st{white-space:normal}.day>h3{top:60px}}
.pcard{padding:14px 16px;margin:0 0 10px}.pcard .h{font-weight:650;letter-spacing:-.015em;margin-bottom:4px}.pcard .h .num{color:var(--soft);font-weight:500;margin-right:8px}
.pcard .body{color:var(--soft);font-size:.9rem;white-space:pre-wrap;max-height:9.5em;overflow:hidden;position:relative;margin:4px 0 8px}.pcard details[open] .body{max-height:none}
.pcard .tl{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.pcard .tl .badge{margin:0;font-size:.7rem}.pcard .decide{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.pcard .decide input{flex:1;min-width:180px}
.pcard .decide button.no{background:var(--card2)!important;color:var(--bad)!important;border:1px solid var(--line);box-shadow:none!important}.pcard .decide button.park{background:var(--card2)!important;color:var(--text)!important;border:1px solid var(--line);box-shadow:none!important}
.pcard .out{margin-top:6px;font-size:.9rem}.asks{padding:14px 18px;margin:0 0 16px;border-color:color-mix(in srgb,var(--accent) 42%,var(--line))!important}.asks h3{margin:0 0 6px;font-size:1rem}.asks li{margin:3px 0}
.rcard{padding:14px 16px;margin:0 0 10px}.rcard .h{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.rcard .h .t{font-weight:650;flex:1;min-width:0;overflow-wrap:anywhere}.rcard .stars{color:var(--ask);letter-spacing:2px;font-size:.85rem}
.rcard .sec{margin:8px 0 0}.rcard .sec b{display:block;font-size:.76rem;letter-spacing:.04em;text-transform:uppercase;color:var(--soft);margin-bottom:2px}.rcard .sec li{margin:2px 0;font-size:.92rem}
.hrow.rv{background:var(--card);border-color:color-mix(in srgb,var(--accent) 40%,var(--line))}.cov{color:var(--ok);font-size:.78rem;white-space:nowrap}
"""

JS = r"""
(function () {
  const WS = { tasks: null, taskProject: 'all', history: null, histProject: 'all', days: 30, q: '', loaded: {} };
  const api = async (path, body) => {
    const opts = body === undefined ? { headers: { 'X-Review-Token': L.token } } : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Review-Token': L.token }, body: JSON.stringify(body) };
    const r = await fetch(path, opts), j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  };
  const note = (t) => { if (typeof toast === 'function') toast(t); };
  const pane = (k) => document.getElementById('pane-' + k);
  const pill = (label, n, on, fn) => el('button', { type: 'button', className: on ? 'on' : '', onclick: fn }, label, n === undefined ? '' : el('span', { className: 'n' }, String(n)));
  const needLive = (k) => { pane(k).replaceChildren(el('div', { className: 'dim' }, 'Open this through the review website (Review.command / Review.bat) to use it.')); };

  // ---------------------------------------------------------------- Tasks
  const COLS = [['next', 'Up next'], ['doing', 'Doing'], ['waiting', 'Waiting on you'], ['later', 'Later']];
  const CAP = 25;
  const shownAll = {};
  async function loadTasks() { try { WS.tasks = await api('/api/tasks?project=all'); } catch (e) { pane('tasks').replaceChildren(el('div', { className: 'bad' }, String(e.message))); return; } drawTasks(); }
  async function act(body, okText) { try { await api('/api/tasks', body); if (okText) note(okText); await loadTasks(); } catch (e) { note('Not saved: ' + e.message); } }
  function taskCard(t, col, proj, idx) {
    const card = el('div', { className: 'tcard', tabIndex: 0, draggable: col === 'next', title: col === 'next' ? 'Drag to rank. Alt+Up / Alt+Down moves it.' : '' },
      el('div', { className: 't' }, t.title), t.detail ? el('div', { className: 'd' }, t.detail) : '',
      el('div', { className: 'meta' }, WS.taskProject === 'all' ? el('span', { className: 'badge ask' }, t.project) : '', el('span', { className: 'badge' }, t.source), t.section ? el('span', { className: 'dim' }, t.section) : ''));
    const acts = el('div', { className: 'acts' });
    const mv = (to, label, text) => acts.append(el('button', { type: 'button', onclick: () => act({ op: 'move', project: t.project_id, id: t.id, to }, text) }, label));
    if (col === 'next') { mv('top', 'Top'); mv('up', 'Up'); mv('down', 'Down'); mv('later', 'Later', 'Parked for later.'); }
    if (col === 'later') mv('next', 'Back to Up next');
    if (t.editable) {
      const st = (status, label) => acts.append(el('button', { type: 'button', onclick: () => act({ op: 'status', project: t.project_id, id: t.id, status }) }, label));
      if (col !== 'doing') st('doing', 'Start'); if (col !== 'waiting') st('waiting', 'Waiting on me'); st('done', 'Done');
    }
    if (acts.childNodes.length) card.append(acts);
    card.addEventListener('keydown', (e) => { if (col === 'next' && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); act({ op: 'move', project: t.project_id, id: t.id, to: e.key === 'ArrowUp' ? 'up' : 'down' }); } });
    if (col === 'next') {
      card.addEventListener('dragstart', (e) => { card.classList.add('drag'); e.dataTransfer.setData('text/plain', JSON.stringify({ id: t.id, project: t.project_id })); e.dataTransfer.effectAllowed = 'move'; });
      card.addEventListener('dragend', () => card.classList.remove('drag'));
      card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('over'); });
      card.addEventListener('dragleave', () => card.classList.remove('over'));
      card.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation(); card.classList.remove('over');
        let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; }
        if (d.project !== t.project_id || d.id === t.id) { if (d.project !== t.project_id) note('Drag within one project to rank it.'); return; }
        act({ op: 'move', project: t.project_id, id: d.id, to: 'at:' + idx });
      });
    }
    return card;
  }
  function drawTasks() {
    const root = pane('tasks'), data = WS.tasks.projects, sel = WS.taskProject;
    const count = (p) => p.board.next.length + p.board.doing.length + p.board.waiting.length;
    const total = data.reduce((n, p) => n + count(p), 0);
    const pills = el('div', { className: 'pills' }, pill('All projects', total, sel === 'all', () => { WS.taskProject = 'all'; drawTasks(); }),
      ...data.filter((p) => count(p) || p.board.done.length || p.can_write).map((p) => pill(p.name, count(p), sel === p.id, () => { WS.taskProject = p.id; drawTasks(); })));
    const target = data.find((p) => p.id === sel) || data.find((p) => p.can_write);
    const input = el('input', { type: 'text', placeholder: 'Add a task' + (target ? ' to ' + target.name : '') + '...', maxLength: 200 });
    const add = async () => { if (!input.value.trim() || !target) return; await act({ op: 'add', project: target.id, title: input.value.trim() }, 'Added to ' + target.name + '.'); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    const file = el('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv,text/tab-separated-values', style: 'display:none' });
    const importBox = el('div', {});
    file.onchange = async () => {
      const f = file.files[0]; if (!f) return;
      if (f.size > 200000) { note('That file is too large (200 KB at most).'); return; }
      try {
        const rows = (await api('/api/tasks', { op: 'preview', text: await f.text() })).rows;
        if (!rows.length) { importBox.replaceChildren(el('div', { className: 'dim' }, 'No tasks found in that file. It needs a Task (or Title / Name) column, or one task per line.')); return; }
        importBox.replaceChildren(el('section', { className: 'card import' }, el('strong', {}, rows.length + ' task(s) found in ' + f.name + (target ? ', to add to ' + target.name : '')),
          el('table', {}, ...rows.slice(0, 8).map((r) => el('tr', {}, el('td', {}, r.title), el('td', { className: 'dim' }, r.status)))), rows.length > 8 ? el('div', { className: 'dim' }, '... and ' + (rows.length - 8) + ' more') : '',
          el('div', { className: 'row' }, el('button', { type: 'button', onclick: async () => { importBox.replaceChildren(); await act({ op: 'import', project: target.id, rows }, 'Added ' + rows.length + ' task(s).'); } }, 'Add them'),
            el('button', { type: 'button', className: 'quiet', onclick: () => importBox.replaceChildren() }, 'Cancel'))));
      } catch (e) { note('Could not read it: ' + e.message); }
      file.value = '';
    };
    const compose = el('div', { className: 'compose' }, input, el('button', { type: 'button', onclick: add }, 'Add'), el('button', { type: 'button', className: 'quiet', onclick: () => file.click() }, 'Import a spreadsheet'), file);
    if (!target || !target.can_write) compose.append(el('span', { className: 'dim' }, 'Pick a project that has a review folder on this computer to add tasks.'));
    const cols = el('div', { className: 'board' });
    for (const [key, label] of COLS) {
      const items = [];
      for (const p of data) if (sel === 'all' || p.id === sel) p.board[key].forEach((t, idx) => items.push([t, p, idx]));
      const key2 = sel + key, cap = shownAll[key2] ? items.length : CAP;
      const col = el('section', { className: 'col glass' }, el('h3', {}, label, el('span', { className: 'n' }, String(items.length))));
      if (!items.length) col.append(el('div', { className: 'dim', style: 'margin:4px' }, key === 'next' ? 'Nothing waiting for its turn.' : 'Empty.'));
      items.slice(0, cap).forEach(([t, p, idx]) => col.append(taskCard(t, key, p, idx)));
      if (items.length > cap) col.append(el('button', { type: 'button', className: 'quiet more', onclick: () => { shownAll[key2] = true; drawTasks(); } }, 'Show all ' + items.length));
      if (key === 'next') {
        col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); }); col.addEventListener('dragleave', () => col.classList.remove('over'));
        col.addEventListener('drop', (e) => { col.classList.remove('over'); });
      }
      cols.append(col);
    }
    const done = [].concat(...data.filter((p) => sel === 'all' || p.id === sel).map((p) => p.board.done.slice(0, 8)));
    root.replaceChildren(el('div', { className: 'wsbar' }, pills), compose, importBox, cols,
      done.length ? el('details', { className: 'card', style: 'margin-top:14px' }, el('summary', {}, 'Done recently (' + done.length + ')'), ...done.map((t) => el('div', { className: 'hrow' }, el('span', { className: 'cov' }, '✓'), el('span', { className: 'sj' }, t.title), WS.taskProject === 'all' ? el('span', { className: 'badge ask' }, t.project) : ''))) : '');
  }

  // ---------------------------------------------------------------- History
  const dayName = (d) => { const t = new Date(d + 'T12:00:00'); return Number.isNaN(+t) ? d : t.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }); };
  const clock = (s) => new Date(s * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  let histTimer = 0, histOlder = [];
  async function loadHistory(more) {
    const root = pane('history');
    if (!more) root.replaceChildren(el('div', { className: 'dim' }, 'Reading the history of every project...'));
    try {
      const q = new URLSearchParams({ project: WS.histProject, days: String(WS.days), q: WS.q });
      if (more) q.set('before', String(WS.history.next));
      const got = await api('/api/history?' + q.toString());
      if (more) { got.days = mergeDays(WS.history.days, got.days); }
      WS.history = got;
    } catch (e) { root.replaceChildren(el('div', { className: 'bad' }, String(e.message))); return; }
    drawHistory();
  }
  function mergeDays(a, b) { const out = a.map((d) => ({ date: d.date, entries: d.entries.slice() })); for (const d of b) { const hit = out.find((x) => x.date === d.date); if (hit) hit.entries.push(...d.entries); else out.push(d); } return out; }
  function histRow(e) {
    if (e.type === 'review') return el('div', { className: 'hrow rv' }, el('span', { className: 'tm' }, 'review'), el('span', { className: 'badge ask' }, e.project),
      el('span', { className: 'sj' }, 'Review: ', L ? el('a', { href: '/review/' + encodeURIComponent(e.project_id) + '/' + encodeURIComponent(e.name) }, e.title) : e.title), el('span', { className: 'st' }, e.answered + ' of ' + e.total + ' answered'));
    const kind = e.who === 'CI bot' ? 'CI' : e.who;
    const subject = e.url ? el('a', { href: e.url, target: '_blank', rel: 'noopener noreferrer' }, e.subject) : e.subject;
    return el('div', { className: 'hrow' }, el('span', { className: 'tm' }, clock(e.time)), el('span', { className: 'badge ask' }, e.project), el('span', { className: 'who ' + kind }, e.who),
      el('span', { className: 'sj' }, subject), e.covered ? el('span', { className: 'cov', title: 'A review covers this change' }, '✓ reviewed') : '',
      e.stat ? el('span', { className: 'st' }, e.files + ' files ', el('span', { className: 'a' }, '+' + e.add), ' ', el('span', { className: 'r' }, '-' + e.del)) : '');
  }
  function drawHistory() {
    const root = pane('history'), h = WS.history, s = h.summary;
    const projs = D.projects;
    const pills = el('div', { className: 'pills' }, pill('All projects', undefined, WS.histProject === 'all', () => { WS.histProject = 'all'; loadHistory(); }),
      ...projs.map((p) => pill(p.name, undefined, WS.histProject === p.id, () => { WS.histProject = p.id; loadHistory(); })));
    const range = el('select', { onchange: (e) => { WS.days = +e.target.value; loadHistory(); } }, ...[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last year'], [3650, 'Everything']].map(([v, l]) => el('option', { value: v, selected: WS.days === v }, l)));
    const search = el('input', { type: 'text', className: 'grow', placeholder: 'Search changes, writers and reviews...', value: WS.q, maxLength: 80 });
    search.addEventListener('input', () => { clearTimeout(histTimer); histTimer = setTimeout(() => { WS.q = search.value; loadHistory(); }, 350); });
    const writers = Object.keys(s.by_writer).map((k) => s.by_writer[k] + ' ' + k).join(' · ');
    const line = el('div', { className: 'dim', style: 'margin:0 0 14px' }, s.commits + ' change(s)' + (s.reviews ? ', ' + s.reviews + ' review(s)' : '') + (writers ? ' — ' + writers : '') + (s.commits ? ' — ' + s.covered + ' inside a review (' + Math.round(100 * s.covered / s.commits) + '%)' : ''));
    const body = h.days.length ? h.days.map((d) => el('section', { className: 'day' }, el('h3', {}, dayName(d.date), el('span', { className: 'n' }, d.entries.length + ' item(s)')), ...d.entries.map(histRow))) : [el('div', { className: 'dim' }, 'Nothing matches.')];
    root.replaceChildren(el('div', { className: 'wsbar' }, pills), el('div', { className: 'wsbar' }, range, search), line, ...body,
      h.next ? el('button', { type: 'button', className: 'quiet', onclick: () => loadHistory(true) }, 'Load older') : '');
    if (document.activeElement === document.body && WS.q) search.focus();
  }

  // ---------------------------------------------------------------- Proposals
  let propProject = 'all', retroProject = 'all'; const retroShown = {};
  async function loadProposals() { try { WS.proposals = await api('/api/proposals?project=all'); } catch (e) { pane('proposals').replaceChildren(el('div', { className: 'bad' }, String(e.message))); return; } drawProposals(); }
  const confirmArm = (btn, label, run) => { let armed = 0; btn.onclick = () => { if (!armed) { armed = setTimeout(() => { armed = 0; btn.textContent = label; }, 4000); btn.textContent = 'Confirm: ' + label; return; } clearTimeout(armed); armed = 0; run(); }; };
  function proposalCard(proj, p, deciding) {
    const body = el('details', {}, el('summary', {}, 'Read the prompt'), el('div', { className: 'body', textContent: p.body }));
    const card = el('section', { className: 'card pcard' }, el('div', { className: 'h' }, el('span', { className: 'num' }, '#' + p.n), p.title),
      p.states.length ? el('div', { className: 'tl' }, ...p.states.map((s) => el('span', { className: 'badge ' + (s[0] === 'done' ? 'ok' : s[0] === 'declined' || s[0] === 'not-now' ? 'bad' : 'ask') }, s[0] + (s[1] ? ' ' + s[1] : '')))) : '',
      p.note ? el('div', { className: 'dim' }, 'Your note: ' + p.note) : '', p.reason ? el('div', { className: 'dim' }, 'Your reason: ' + p.reason) : '', p.outcome ? el('div', { className: 'out' }, el('b', {}, 'Outcome: '), p.outcome) : '', p.body ? body : '');
    if (deciding) {
      const note = el('input', { type: 'text', placeholder: 'Note or reason (optional)', maxLength: 300 });
      const go = async (action, text) => { try { const j = await api('/api/proposals', { project: proj.id, n: p.n, action, note: note.value.trim() }); note_(text); WS.loaded.proposals = false; await loadProposals(); } catch (e) { note_('Not saved: ' + e.message); } };
      const yes = el('button', { type: 'button' }, 'Approve'), park = el('button', { type: 'button', className: 'park' }, 'Not now'), no = el('button', { type: 'button', className: 'no' }, 'No');
      confirmArm(yes, 'Approve', () => go('approve', 'Approved. The prompt was added to notes/approved.md.')); confirmArm(park, 'Not now', () => go('notnow', 'Parked for later.')); confirmArm(no, 'No', () => go('no', 'Declined.'));
      card.append(el('div', { className: 'decide' }, note, yes, park, no));
    }
    return card;
  }
  const note_ = (t) => note(t);
  function drawProposals() {
    const root = pane('proposals'), data = WS.proposals.projects;
    if (!data.length) { root.replaceChildren(el('div', { className: 'dim' }, 'No project keeps proposals yet. Agents add them to notes/proposals.md.')); return; }
    const waiting = data.reduce((n, p) => n + p.proposals.groups[0].items.length, 0); tabCount('proposals', waiting);
    const pills = el('div', { className: 'pills' }, pill('All projects', undefined, propProject === 'all', () => { propProject = 'all'; drawProposals(); }), ...data.map((p) => pill(p.name, p.proposals.groups[0].items.length || undefined, propProject === p.id, () => { propProject = p.id; drawProposals(); })));
    const out = [el('div', { className: 'wsbar' }, pills)];
    for (const proj of data) {
      if (propProject !== 'all' && propProject !== proj.id) continue;
      for (const g of proj.proposals.groups) {
        if (!g.items.length) continue;
        const items = g.key === 'waiting' ? g.items : g.items.slice().reverse();
        const list = el('div', {}, ...items.slice(0, g.key === 'waiting' ? 50 : 30).map((p) => proposalCard(proj, p, g.key === 'waiting')));
        out.push(g.key === 'waiting' ? el('div', {}, el('h2', { style: 'margin-top:8px' }, g.label + ' ', el('span', { className: 'dim' }, proj.name + ' · ' + g.items.length)), list)
          : el('details', { className: 'card', style: 'margin:0 0 12px;padding:12px 16px' }, el('summary', { style: 'margin:0' }, g.label + ' · ' + proj.name + ' · ' + g.items.length), el('div', { style: 'margin-top:10px' }, list)));
      }
    }
    root.replaceChildren(...out);
  }

  // ---------------------------------------------------------------- Retros
  async function loadRetros() { try { WS.retros = await api('/api/retros?project=all'); } catch (e) { pane('retros').replaceChildren(el('div', { className: 'bad' }, String(e.message))); return; } drawRetros(); }
  function drawRetros() {
    const root = pane('retros'), data = WS.retros.projects;
    if (!data.length) { root.replaceChildren(el('div', { className: 'dim' }, 'No project keeps retros yet. Agents add them to notes/retros.json or RETROS.md.')); return; }
    const pills = el('div', { className: 'pills' }, pill('All projects', undefined, retroProject === 'all', () => { retroProject = 'all'; drawRetros(); }), ...data.map((p) => pill(p.name, p.retros.entries.length, retroProject === p.id, () => { retroProject = p.id; drawRetros(); })));
    const out = [el('div', { className: 'wsbar' }, pills)];
    const sel = data.filter((p) => retroProject === 'all' || p.id === retroProject);
    const asks = [].concat(...sel.map((p) => p.retros.asks.slice(0, 5).map((a) => [p.name, a])));
    if (asks.length) out.push(el('section', { className: 'card asks' }, el('h3', {}, 'What agents ask of you'), el('ul', {}, ...asks.slice(0, 8).map(([n, a]) => el('li', {}, el('span', { className: 'badge ask' }, n), ' ' + a)))));
    for (const proj of sel) {
      const cap = retroShown[proj.id] ? proj.retros.entries.length : 12;
      for (const e of proj.retros.entries.slice(0, cap)) {
        const stars = +e.rating > 0 ? '★'.repeat(Math.min(+e.rating, 5)) : '';
        out.push(el('section', { className: 'card rcard' }, el('div', { className: 'h' }, el('span', { className: 'badge ask' }, proj.name), el('span', { className: 't' }, e.title), stars ? el('span', { className: 'stars', title: 'How the session felt: ' + e.rating + ' of 5' }, stars) : '', e.when ? el('span', { className: 'dim' }, e.when) : ''),
          ...e.sections.map(([label, lines]) => el('div', { className: 'sec' }, el('b', {}, label), el('ul', { style: 'margin:0;padding-left:18px' }, ...lines.map((l) => el('li', {}, l)))))));
      }
      if (proj.retros.entries.length > cap) out.push(el('button', { type: 'button', className: 'quiet', onclick: () => { retroShown[proj.id] = true; drawRetros(); } }, 'Show all ' + proj.retros.entries.length + ' from ' + proj.name));
    }
    root.replaceChildren(...out);
  }

  // ---------------------------------------------------------------- wiring: load a pane the first time it opens
  const tabCount = (k, n) => { const e = document.getElementById('tabn-' + k); if (e) e.textContent = n || ''; };
  const open = (name) => {
    const loaders = { tasks: loadTasks, history: loadHistory, proposals: loadProposals, retros: loadRetros };
    if (!loaders[name]) return;
    if (!L) { needLive(name); return; }
    if (!WS.loaded[name]) { WS.loaded[name] = true; loaders[name](); }
  };
  const base = window.showTab;
  window.showTab = function (name) { base(name); open(name); };
  const here = (location.hash || '').slice(1); open(here);
  if (L) api('/api/proposals?project=all').then((j) => { WS.proposals = j; tabCount('proposals', j.projects.reduce((n, p) => n + p.proposals.groups[0].items.length, 0)); }).catch(() => {});
  if (L) api('/api/tasks?project=all').then((j) => { WS.tasks = j; tabCount('tasks', j.projects.reduce((n, p) => n + p.board.next.length + p.board.doing.length + p.board.waiting.length, 0)); }).catch(() => {});
})();
"""
