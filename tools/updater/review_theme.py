"""One look for every review page: the Universal Apps dark and light themes, a theme button, and a top bar.

Colours are copied (not imported) from the suite's theme so a project that has no Universal Apps files still looks the same. The pages follow the
computer's light or dark setting, and the button in the bar cycles Auto -> Light -> Dark; the choice is kept in this browser only. The attribute is
`data-theme="light|dark"`, the same one the suite uses. No page text goes through here: `bar()` takes plain strings and escapes them. The theme code is joined to each page's one script (JS below), so a page still has exactly two script tags.
"""
import html

TOKENS = """
:root{--bg:#f5f5f7;--card:#fff;--card2:#f0f0f3;--text:#18181b;--soft:#5f5f6b;--line:#dcdce2;--accent:#059669;--on:#fff;--ok:#047857;--bad:#dc2626;--ask:#b45309;
--glow1:rgba(16,185,129,.10);--glow2:rgba(239,68,68,.05);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0a0a0c;--card:#121215;--card2:#18181c;--text:#f4f4f5;--soft:#a1a1aa;--line:#27272d;--accent:#10b981;--on:#0a0a0c;--ok:#34d399;--bad:#f87171;--ask:#fbbf24;
--glow1:rgba(16,185,129,.16);--glow2:rgba(239,68,68,.08);color-scheme:dark}}
:root[data-theme=dark]{--bg:#0a0a0c;--card:#121215;--card2:#18181c;--text:#f4f4f5;--soft:#a1a1aa;--line:#27272d;--accent:#10b981;--on:#0a0a0c;--ok:#34d399;--bad:#f87171;--ask:#fbbf24;
--glow1:rgba(16,185,129,.16);--glow2:rgba(239,68,68,.08);color-scheme:dark}
:root[data-theme=light]{color-scheme:light}
body{background:radial-gradient(60% 40% at 12% 0%,var(--glow1),transparent 70%),radial-gradient(50% 40% at 95% 100%,var(--glow2),transparent 70%),var(--bg);background-attachment:fixed}
.bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:10px 16px;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.bar .name{font-weight:700;font-size:1.05rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar a{color:var(--text);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:.9rem}
.bar button.theme{background:transparent;color:var(--text);border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:.9rem;font-weight:500}
.card{border-radius:14px}.chip{background:var(--card2)}
/* Updater (2.18): the Tasks & Goals look. A pill top bar with the brand, a clock and the theme button; a green-bordered "Needs you" lane of pill rows;
   an underlined tab strip; two-column panels; progress bars that say how far the testing is. */
.bar .mark{width:26px;height:26px;border-radius:50%;flex:none;background:conic-gradient(from 210deg,var(--accent),#22d3ee,var(--accent))}
.bar .name{flex:none;font-size:1.1rem;letter-spacing:.01em}.bar .page{flex:1;min-width:0;color:var(--soft);font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar .clock{font:.85rem ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--soft);white-space:nowrap}
.bar a,.bar button.theme,.bar button.pillbtn{border-radius:999px}
@media (max-width:640px){.bar .clock,.bar .page{display:none}.bar .name{flex:1}}
.wide{max-width:1180px!important}
.lane{border:1px solid var(--accent);border-radius:16px;background:color-mix(in srgb,var(--card) 88%,transparent);padding:12px 14px;margin:6px 0 18px}
.lane>h2{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin:0 0 8px;font-size:1.25rem}.lane>h2 .n{color:var(--soft);font-weight:400;font-size:.85rem}
.lane .big{margin:2px 0 10px}.lane .big .prog{height:8px;margin:4px 0}.lane .big .dim{font-size:.88rem}
.prow{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--text);text-decoration:none;padding:7px 12px;margin:6px 0;min-width:0}
.prow:hover,.prow:focus-visible{border-color:var(--accent);outline:none}
.prow .tag{font:700 .72rem ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);flex:none;min-width:3.4em}
.prow .tag.new{color:var(--ask)}.prow .tag.ask{color:var(--ask)}
.prow .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:1.02rem}.prow .r{color:var(--soft);font-size:.8rem;white-space:nowrap}
.prow .mini{width:64px;height:5px;background:var(--card2);border-radius:99px;overflow:hidden;flex:none}.prow .mini>i{display:block;height:100%;background:var(--accent)}
.lane .more{background:none;border:0;color:var(--accent);font-size:.9rem;padding:2px 0;cursor:pointer;font-weight:500}
.lane .foot{color:var(--soft);font-size:.78rem;margin:6px 0 0;overflow-wrap:anywhere}
nav.tabs{display:flex;gap:2px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin:22px 0 16px}
nav.tabs button.tab{background:none;border:0;border-bottom:2px solid transparent;border-radius:0;color:var(--soft);font-weight:500;padding:8px 14px;margin-bottom:-1px;cursor:pointer;font-size:.95rem}
nav.tabs button.tab.on{color:var(--accent);border-bottom-color:var(--accent)}nav.tabs button.tab:hover{color:var(--text)}
nav.tabs button.tab .n{display:inline-block;min-width:1.4em;margin-left:6px;padding:0 6px;border-radius:99px;background:var(--card2);color:var(--soft);font-size:.74rem;font-weight:700}
nav.tabs button.tab.on .n{background:var(--accent);color:var(--on)}nav.tabs button.tab:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.pane[hidden]{display:none}
.panel2{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:16px;align-items:start}
.panel2>section{border:1px solid var(--accent);border-radius:16px;padding:12px 14px;background:color-mix(in srgb,var(--card) 88%,transparent);min-width:0}
.panel2 h3{margin:0 0 8px;font-size:1rem;display:flex;gap:8px;align-items:baseline}.panel2 h3 .n{color:var(--soft);font-weight:400;font-size:.8rem}
@media (max-width:820px){.panel2{grid-template-columns:1fr}}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 16px}
.stat{border:1px solid var(--line);border-radius:14px;padding:10px 14px;background:var(--card)}.stat b{display:block;font-size:1.6rem;line-height:1.15}.stat span{color:var(--soft);font-size:.82rem}
.stat.hot{border-color:var(--accent)}
.pbar{display:flex;height:10px;border-radius:99px;overflow:hidden;background:var(--card2);gap:2px}.pbar>i{display:block;height:100%}
.pbar .s-great{background:#10b981}.pbar .s-good{background:#34d399}.pbar .s-okay{background:#fbbf24}.pbar .s-not{background:#f87171}.pbar .s-wrong{background:#ef4444}.pbar .s-look{background:#6b7280}
.legend{display:flex;gap:10px;flex-wrap:wrap;color:var(--soft);font-size:.78rem;margin-top:4px}.legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px}
.legend .s-great{background:#10b981}.legend .s-good{background:#34d399}.legend .s-okay{background:#fbbf24}.legend .s-not{background:#f87171}.legend .s-wrong{background:#ef4444}.legend .s-look{background:#6b7280}
.toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9;background:var(--card);border:1px solid var(--accent);border-radius:999px;padding:8px 16px;box-shadow:0 8px 28px #0006;display:flex;gap:10px;align-items:center}
.toast[hidden]{display:none}.toast button{padding:4px 12px;border-radius:999px}
.new-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--ask);margin-right:6px;vertical-align:middle}
.prbtn{display:inline-block;color:var(--on);background:var(--accent);border-radius:999px;padding:4px 14px;text-decoration:none;font-weight:700;font-size:.88rem}
.prbtn.off{background:transparent;color:var(--ask);border:1px dashed var(--ask);font-weight:500}
details>summary{cursor:pointer;color:var(--soft);font-size:.92rem;margin-top:6px}details[open]>summary{margin-bottom:4px}
.lead{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--accent);border-radius:14px;background:var(--card);overflow:hidden}
.lead>div{padding:14px 16px}.lead>div+div{border-left:1px solid var(--line)}.lead h3{margin:0 0 6px;font-size:1rem}.lead .n{color:var(--soft);font-weight:400;font-size:.85rem;margin-left:4px}
.media{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.media img{max-height:150px;max-width:100%;border-radius:8px;border:1px solid var(--line);cursor:zoom-in;background:var(--card2)}
.media img.zoom{max-height:none;width:100%;cursor:zoom-out}.btnlink{display:inline-block;color:var(--accent);border:1px solid var(--accent);border-radius:8px;padding:4px 12px;text-decoration:none;font-weight:600;font-size:.92rem}
@media (max-width:560px){.lead{grid-template-columns:1fr}.lead>div+div{border-left:0;border-top:1px solid var(--line)}}
"""

# Liquid glass: one additive layer over the base look above. It only restyles (colours, surfaces, type, controls); it adds no behaviour, and removing it
# leaves a working page. Selectors start with `body` so the layer wins whatever order a page concatenates its CSS in.
GLASS = """
:root{--bg:#eceff5;--card:rgba(255,255,255,.62);--card2:rgba(255,255,255,.88);--text:#14161c;--soft:#5b6272;--line:rgba(20,24,40,.10);--accent:#059669;--accent2:#0ea5e9;--on:#fff;--ok:#047857;--bad:#d92d3a;--ask:#b45309;
--glow1:rgba(16,185,129,.20);--glow2:rgba(99,102,241,.14);--glow3:rgba(251,146,60,.10);--shadow:0 1px 0 rgba(255,255,255,.9) inset,0 10px 34px rgba(31,38,64,.10);--hi:rgba(255,255,255,.7);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#060608;--card:rgba(255,255,255,.055);--card2:rgba(255,255,255,.09);--text:#f5f5f7;--soft:rgba(245,245,247,.62);--line:rgba(255,255,255,.11);--accent:#10b981;--accent2:#5ab0ff;--on:#03140d;--ok:#4ade9d;--bad:#ff7a85;--ask:#ffc65c;
--glow1:rgba(16,185,129,.20);--glow2:rgba(99,102,241,.16);--glow3:rgba(236,72,153,.07);--shadow:0 1px 0 rgba(255,255,255,.09) inset,0 12px 40px rgba(0,0,0,.45);--hi:rgba(255,255,255,.14);color-scheme:dark}}
:root[data-theme=dark]{--bg:#060608;--card:rgba(255,255,255,.055);--card2:rgba(255,255,255,.09);--text:#f5f5f7;--soft:rgba(245,245,247,.62);--line:rgba(255,255,255,.11);--accent:#10b981;--accent2:#5ab0ff;--on:#03140d;--ok:#4ade9d;--bad:#ff7a85;--ask:#ffc65c;
--glow1:rgba(16,185,129,.20);--glow2:rgba(99,102,241,.16);--glow3:rgba(236,72,153,.07);--shadow:0 1px 0 rgba(255,255,255,.09) inset,0 12px 40px rgba(0,0,0,.45);--hi:rgba(255,255,255,.14);color-scheme:dark}
:root[data-theme=light]{color-scheme:light}
html{-webkit-text-size-adjust:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Inter","Segoe UI",system-ui,sans-serif;letter-spacing:-.006em;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
background:radial-gradient(48% 38% at 8% -4%,var(--glow1),transparent 72%),radial-gradient(42% 36% at 96% 2%,var(--glow2),transparent 72%),radial-gradient(60% 40% at 70% 108%,var(--glow3),transparent 70%),var(--bg);background-attachment:fixed;min-height:100vh}
body main{padding:28px 20px 96px}body h1{font-size:2.15rem;line-height:1.12;letter-spacing:-.035em;font-weight:700}body h2{letter-spacing:-.02em;font-weight:650}body h3{letter-spacing:-.015em}
::selection{background:color-mix(in srgb,var(--accent) 35%,transparent)}
/* surfaces: a translucent fill, a hairline, a lit top edge, a soft shadow, and a blur of whatever is behind */
body .card,body .review,body .lead,body details.card,body .lane,body .panel2>section,body .stat,body .glass,body .toast{background:var(--card);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow);-webkit-backdrop-filter:blur(26px) saturate(1.7);backdrop-filter:blur(26px) saturate(1.7)}
body .lane,body .lead,body .panel2>section{border-color:color-mix(in srgb,var(--accent) 42%,var(--line))}body .stat{border-radius:18px}body .stat.hot{border-color:color-mix(in srgb,var(--accent) 55%,var(--line))}
body .card{padding:16px 18px}body .review{padding:20px 22px}body .lane{padding:18px 20px}body .panel2>section{padding:16px 18px}
body .prow{background:var(--card2);border-radius:16px;border-color:var(--line);transition:transform .14s,border-color .14s,background .14s}body .prow:hover{transform:translateY(-1px);border-color:var(--accent)}
body .chip{background:var(--card2);border-radius:999px}
body select,body input[type=text],body textarea{background:var(--card2);color:var(--text);border:1px solid var(--line);border-radius:14px;padding:9px 12px;transition:border-color .18s,box-shadow .18s}
body select:focus,body input[type=text]:focus,body textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 22%,transparent)}
body button{border-radius:14px;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 92%,#fff),var(--accent));color:var(--on);font-weight:650;letter-spacing:-.005em;box-shadow:0 1px 0 var(--hi) inset,0 6px 18px color-mix(in srgb,var(--accent) 26%,transparent);transition:transform .14s,filter .14s}
body button:hover{filter:brightness(1.05)}body button:active{transform:scale(.97)}
body button.quiet,body .lane .more,body nav.tabs button.tab,body .bar button.theme,body .bar button.pillbtn,body .toast button{box-shadow:none}
body button.quiet{background:var(--card2);color:var(--accent);border:1px solid var(--line);font-weight:600}
body .picker span{background:var(--card2);border-radius:999px;transition:background .15s,border-color .15s,transform .12s}body .picker label:hover span{border-color:var(--accent)}body .picker label:active span{transform:scale(.97)}
body .picker input:checked+span{background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 92%,#fff),var(--accent));box-shadow:0 1px 0 var(--hi) inset,0 4px 14px color-mix(in srgb,var(--accent) 30%,transparent)}
body .btnlink{border-radius:14px;background:var(--card2);padding:7px 15px;border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}body .btnlink:hover{text-decoration:none;border-color:var(--accent)}
body .badge{background:color-mix(in srgb,currentColor 11%,transparent);border-color:color-mix(in srgb,currentColor 38%,transparent)}
body .item{border-top-color:var(--line)}body .prog{background:var(--card2);height:7px}body .prog>i,body .prow .mini>i{background:linear-gradient(90deg,var(--accent),var(--accent2))}
body .media img{border-radius:14px;box-shadow:var(--shadow)}body pre{background:var(--card2);border-radius:16px}
/* the bar floats; the tab strip becomes a segmented control */
body .bar{position:sticky;top:12px;z-index:20;margin:12px auto 0;max-width:calc(1180px - 24px);width:calc(100% - 24px);padding:7px 10px 7px 14px;background:var(--card);border:1px solid var(--line);border-radius:999px;box-shadow:var(--shadow);-webkit-backdrop-filter:blur(26px) saturate(1.8);backdrop-filter:blur(26px) saturate(1.8)}
body .bar a,body .bar button.theme{background:var(--card2);border:1px solid var(--line);color:var(--text)}
body nav.tabs{display:inline-flex;max-width:100%;overflow-x:auto;scrollbar-width:none;gap:2px;padding:4px;margin:22px 0 18px;background:var(--card);border:1px solid var(--line);border-radius:999px;box-shadow:var(--shadow);-webkit-backdrop-filter:blur(20px) saturate(1.6);backdrop-filter:blur(20px) saturate(1.6)}
body nav.tabs::-webkit-scrollbar{display:none}
body nav.tabs button.tab{border:0;border-radius:999px;padding:7px 16px;margin:0;color:var(--soft);background:transparent;font-weight:560;white-space:nowrap;transition:background .16s,color .16s}
body nav.tabs button.tab:hover{color:var(--text);background:var(--card2);filter:none}
body nav.tabs button.tab.on{color:var(--text);background:var(--card2);box-shadow:0 1px 0 var(--hi) inset,0 2px 10px rgba(0,0,0,.12)}
body nav.tabs button.tab .n{background:color-mix(in srgb,var(--soft) 16%,transparent)}body nav.tabs button.tab.on .n{background:var(--accent);color:var(--on)}
body .lane .more{background:none;color:var(--accent);border:0}
@media (max-width:640px){body .bar{border-radius:26px}body h1{font-size:1.75rem}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){:root{--card:color-mix(in srgb,var(--bg) 86%,#fff);--card2:color-mix(in srgb,var(--bg) 78%,#fff)}}
"""
TOKENS = TOKENS + GLASS


JS = """
(function () {
  var root = document.documentElement, btn = document.getElementById('themebtn'), KEY = 'review-theme', modes = ['auto', 'light', 'dark'];
  function get() { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } }
  function apply(m) { if (m === 'light' || m === 'dark') root.setAttribute('data-theme', m); else root.removeAttribute('data-theme'); if (btn) btn.textContent = 'Theme: ' + m; }
  apply(get());
  if (btn) btn.onclick = function () { var m = modes[(modes.indexOf(get()) + 1) % 3]; try { localStorage.setItem(KEY, m); } catch (e) {} apply(m); };
  // The clock in the bar (the Tasks & Goals one): weekday, date and time, kept to the minute.
  var clock = document.getElementById('clock');
  function tick() { if (!clock) return; var d = new Date(); clock.textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + '  ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
  tick(); setInterval(tick, 20000);
  // The tab strip: <nav class="tabs"> buttons with data-tab, panes with data-pane. The tab is kept in the address (#projects) so a reload stays put.
  window.showTab = function (name) {
    var tabs = document.querySelectorAll('nav.tabs .tab'), panes = document.querySelectorAll('.pane'), found = false;
    tabs.forEach(function (t) { if (t.getAttribute('data-tab') === name) found = true; });
    if (!found && tabs.length) name = tabs[0].getAttribute('data-tab');
    tabs.forEach(function (t) { var on = t.getAttribute('data-tab') === name; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
    panes.forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== name; });
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
  };
  document.querySelectorAll('nav.tabs .tab').forEach(function (t) { t.addEventListener('click', function () { window.showTab(t.getAttribute('data-tab')); }); });
  if (document.querySelector('nav.tabs .tab')) window.showTab((location.hash || '').slice(1));
})();
"""

MEDIA_JS = """
// A claim's link and pictures: {link: {text, url} or null, pics: [src, ...]}. Only http(s) links and our own picture sources are used; a picture opens larger in place on click.
// A link to a page of the project. On a live page it is the address the app answers on. A saved page opened as a file (file://) cannot count on the address it was written
// with (the server may be stopped, or on another port by now): it tries that address and, when nothing answers, opens the project's own file instead (a project that needs no
// server works from its files). With no address and no file there is no link: the caller shows the plain name.
function pageLink(text, url, file, cls) {
  const onFile = location.protocol === 'file:', web = /^https?:\\/\\//i.test(url || ''), own = onFile && /^file:\\/\\//i.test(file || '');
  if (!web && !own) return null;
  const a = el('a', { className: cls || 'btnlink', href: web ? url : file, target: '_blank', rel: 'noopener noreferrer' }, 'Open ' + text);
  if (web && own) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 1500);
    fetch(url, { mode: 'no-cors', signal: ctl.signal }).then(() => clearTimeout(timer)).catch(() => { clearTimeout(timer); a.href = file; a.title = 'The app is not running, so this opens the file on this computer'; });
  } else if (!web) a.title = 'Opens the file on this computer';
  return a;
}
function mediaBox(m) {
  const kids = [];
  if (m && m.link && m.link.text) {
    const a = pageLink(m.link.text, m.link.url, m.link.file);
    if (a) kids.push(a);
    else kids.push(el('span', { className: 'dim' }, 'Page: ' + m.link.text));
  }
  for (const src of (m && m.pics) || []) {
    if (typeof src === 'string' && (src.indexOf('data:image/') === 0 || /^\\/pic\\/[\\w.\\/-]+$/.test(src))) {
      const img = el('img', { src: src, alt: 'A picture for this item', loading: 'lazy' });
      img.onclick = () => img.classList.toggle('zoom'); kids.push(img);
    }
  }
  return kids.length ? el('div', { className: 'media' }, ...kids) : '';
}
"""
JS = JS + MEDIA_JS


def bar(title, back=None):
    """The top bar: a back link when given, the brand (Updater), the page's own name, the clock and the theme button. `back` is (href, label) or None;
    everything is escaped. (The title used to be the whole name; the brand is now always Updater and the title says which page.)"""
    link = '<a href="%s">&larr; %s</a>' % (html.escape(back[0], quote=True), html.escape(back[1])) if back else ''
    return ('<div class="bar">%s<span class="mark" aria-hidden="true"></span><span class="name">Updater</span><span class="page">%s</span>'
            '<span class="clock" id="clock" aria-hidden="true"></span><button type="button" class="theme" id="themebtn">Theme: auto</button></div>') % (link, html.escape(title))


def tabs(items):
    """The tab strip: items is [(key, label)]; the page's script fills each tab's count (an element with id tabn-<key>). Labels are escaped."""
    return '<nav class="tabs" role="tablist">%s</nav>' % ''.join(
        '<button type="button" class="tab" role="tab" data-tab="%s">%s<span class="n" id="tabn-%s"></span></button>' % (html.escape(k, quote=True), html.escape(label), html.escape(k, quote=True))
        for k, label in items)
