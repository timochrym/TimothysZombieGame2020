"""Links and pictures on a review claim: `link:` (the page to open) and `pic:` (screenshots saved in the repository).

    - [ ] The card spacing is calmer | file: styles.css | look: open the page | link: NotePrinter.html | pic: reviews/pics/np-after.png, reviews/pics/np-before.png

A link is shown only when it can be opened from a browser: a full http(s) address, or a relative page joined to the project's `app_url:` (UPDATER.md).
A picture is shown only when it is a real image file (png, jpg, gif, webp) that sits inside the project folder or its review folder and is not huge;
anything else is left out and the claim still shows its plain text. Pictures are read here and nowhere else, so every page gets the same limits.
"""
import base64
import os
import re
import urllib.parse

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
