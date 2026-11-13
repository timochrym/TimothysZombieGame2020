"""Links and pictures on a review claim: `link:` (the page to open) and `pic:` (screenshots saved in the repository).

    - [ ] The card spacing is calmer | file: styles.css | look: open the page | link: NotePrinter.html | pic: reviews/pics/np-after.png, reviews/pics/np-before.png

A link is shown only when it can be opened from a browser: a full http(s) address, or a relative page joined to the project's `app_url:` (UPDATER.md).
A picture is shown only when it is a real image file (png, jpg, gif, webp) that sits inside the project folder or its review folder and is not huge;
anything else is left out and the claim still shows its plain text. Pictures are read here and nowhere else, so every page gets the same limits.
"""
import base64
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

TYPES = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp'}
MAX_SERVE = 5 * 1024 * 1024         # the website sends a picture up to this size
MAX_INLINE = 700 * 1024             # a self-contained page embeds a picture up to this size


def items(value):
    return [x.strip() for x in (value or '').split(',') if x.strip()]


def app_url(meta):
    """Where a project's pages are served: its `app_url:`, else its own server (`server_port:`) on this computer, else ''."""
    meta = meta or {}
    if (meta.get('app_url') or '').strip():
        return meta['app_url'].strip()
    port = (meta.get('server_port') or '').strip()
    return 'http://localhost:%s/' % port if port.isdigit() and (meta.get('server') or '').strip().lower() not in ('off', 'no', 'false') else ''


_FOUND = {}
COMMON_PORTS = tuple(range(8000, 8010)) + tuple(range(8080, 8090)) + (3000, 3001, 4173, 5000, 5173, 5500, 8765, 8766)


def _same_page(port, page, head):
    """True when the server on this port serves a page that starts the same as the file on disk (so it is this project, not another app)."""
    try:
        req = urllib.request.Request('http://127.0.0.1:%d/%s' % (port, urllib.parse.quote(page, safe='/')), headers={'Range': 'bytes=0-1023'})
        with urllib.request.urlopen(req, timeout=0.5) as resp:
            body = resp.read(1024)
            return resp.status in (200, 206) and len(body) >= 32 and head[:len(body)] == body[:len(head)]
    except (OSError, ValueError, urllib.error.URLError):
        return False


def find_running(folder, meta, now=None):
    """The base address ('http://localhost:8080/') of the local server that is really serving this project, or ''. Looked up fresh every 15 seconds."""
    meta = meta or {}
    page = (meta.get('open') or 'index.html').strip()
    key = (os.path.realpath(folder or '.'), page, (meta.get('app_url') or '') + (meta.get('server_port') or ''))
    now = now if now is not None else time.time()
    if key in _FOUND and now - _FOUND[key][0] < 15:
        return _FOUND[key][1]
    found = ''
    try:
        with open(os.path.join(folder, page), 'rb') as fh:
            head = fh.read(1024)
    except OSError:
        head = b''
    if len(head) >= 32:
        wanted = []
        for text in ((meta.get('app_url') or ''), 'x:' + (meta.get('server_port') or '')):
            m = re.search(r':(\d{2,5})', text)
            if m:
                wanted.append(int(m.group(1)))
        for port in dict.fromkeys(wanted + list(COMMON_PORTS)):
            if _same_page(port, page, head):
                found = 'http://localhost:%d/' % port
                break
    _FOUND[key] = (now, found)
    return found


def resolve_app(folder, meta, name=''):
    """-> {'text', 'base', 'url', 'running', 'hint'}. `base` and `url` are only set when the app is really answering, so a button never points at nothing."""
    meta = meta or {}
    explicit = (meta.get('app_url') or '').strip()
    page = (meta.get('open') or '').strip()
    remote = bool(re.match(r'^https?://', explicit, re.I)) and not re.match(r'^https?://(localhost|127\.|0\.0\.0\.0|\[::1\])', explicit, re.I)
    base = explicit if remote else find_running(folder, meta)
    start = (meta.get('start') or '').strip()
    hint = ('Start it first: %s' % start) if start else ('Start it from the Control Panel (Run server).' if (meta.get('server') or '').strip().lower() in ('on', 'yes', 'true', '1') else 'Start the app first.')
    url = ''
    if base:
        url = link_url(page, base) if page and not page.startswith(('/', '.')) else base
    return {'text': name or 'the app', 'base': base, 'url': url or base, 'running': bool(base), 'hint': '' if base else hint}


def app_link(meta, name='the app'):
    """The project's own page as a button: {'text': 'Zombie Game', 'url': 'http://localhost:8000/index.html'}, or None when it has no address."""
    base = app_url(meta)
    if not base:
        return None
    page = (meta or {}).get('open', '').strip()
    url = link_url(page, base) if page and not page.startswith(('/', '.')) else base
    return {'text': name or 'the app', 'url': url or base}


def link_url(value, app_url=''):
    """The address a person can click, or '' when there is none (the page name is then shown as plain text)."""
    value = (value or '').strip()
    if re.match(r'^https?://[^\s]+$', value, re.I):
        return value
    base = (app_url or '').strip()
    if value and re.match(r'^https?://', base, re.I) and not re.match(r'^[a-z][a-z0-9+.-]*:', value, re.I) and not value.startswith('/'):
        return base.rstrip('/') + '/' + urllib.parse.quote(value, safe='/#?=&.-_~')
    return ''


def resolve(path, roots, limit=MAX_SERVE):
    """A picture path (relative to any of the roots) -> its real path, or '' unless it is a small image inside a root."""
    if not path or '\x00' in path or os.path.splitext(path)[1].lower() not in TYPES:
        return ''
    real_roots = [os.path.realpath(r) for r in roots if r and os.path.isdir(r)]
    candidates = [path] if os.path.isabs(path) else [os.path.join(r, path) for r in real_roots]
    for cand in candidates:
        real = os.path.realpath(cand)
        if any(real == r or real.startswith(r + os.sep) for r in real_roots) and os.path.isfile(real):
            try:
                if os.path.getsize(real) <= limit:
                    return real
            except OSError:
                pass
    return ''


def content_type(path):
    return TYPES.get(os.path.splitext(path)[1].lower(), 'application/octet-stream')


def data_uri(real_path):
    """For a page that must be one file. '' when the picture is too large to embed."""
    try:
        if os.path.getsize(real_path) > MAX_INLINE:
            return ''
        with open(real_path, 'rb') as fh:
            return 'data:%s;base64,%s' % (content_type(real_path), base64.b64encode(fh.read()).decode('ascii'))
    except OSError:
        return ''
