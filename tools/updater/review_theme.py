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
details>summary{cursor:pointer;color:var(--soft);font-size:.92rem;margin-top:6px}details[open]>summary{margin-bottom:4px}
.lead{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--accent);border-radius:14px;background:var(--card);overflow:hidden}
.lead>div{padding:14px 16px}.lead>div+div{border-left:1px solid var(--line)}.lead h3{margin:0 0 6px;font-size:1rem}.lead .n{color:var(--soft);font-weight:400;font-size:.85rem;margin-left:4px}
.media{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.media img{max-height:150px;max-width:100%;border-radius:8px;border:1px solid var(--line);cursor:zoom-in;background:var(--card2)}
.media img.zoom{max-height:none;width:100%;cursor:zoom-out}.btnlink{display:inline-block;color:var(--accent);border:1px solid var(--accent);border-radius:8px;padding:4px 12px;text-decoration:none;font-weight:600;font-size:.92rem}
@media (max-width:560px){.lead{grid-template-columns:1fr}.lead>div+div{border-left:0;border-top:1px solid var(--line)}}
"""

JS = """
(function () {
  var root = document.documentElement, btn = document.getElementById('themebtn'), KEY = 'review-theme', modes = ['auto', 'light', 'dark'];
  function get() { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } }
  function apply(m) { if (m === 'light' || m === 'dark') root.setAttribute('data-theme', m); else root.removeAttribute('data-theme'); if (btn) btn.textContent = 'Theme: ' + m; }
  apply(get());
  if (btn) btn.onclick = function () { var m = modes[(modes.indexOf(get()) + 1) % 3]; try { localStorage.setItem(KEY, m); } catch (e) {} apply(m); };
})();
"""

MEDIA_JS = """
// A claim's link and pictures: {link: {text, url} or null, pics: [src, ...]}. Only http(s) links and our own picture sources are used; a picture opens larger in place on click.
function mediaBox(m) {
  const kids = [];
  if (m && m.link && m.link.text) {
    if (/^https?:\\/\\//i.test(m.link.url || '')) kids.push(el('a', { className: 'btnlink', href: m.link.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open ' + m.link.text));
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
    """The top bar. `back` is (href, label) or None; both are escaped."""
    link = '<a href="%s">&larr; %s</a>' % (html.escape(back[0], quote=True), html.escape(back[1])) if back else ''
    return '<div class="bar">%s<span class="name">%s</span><button type="button" class="theme" id="themebtn">Theme: auto</button></div>' % (link, html.escape(title))
