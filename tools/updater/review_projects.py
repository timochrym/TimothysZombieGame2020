"""Find the projects on this computer, read their manifests, and find where each one keeps its reviews.

Used by review.py, portfolio_html.py and panel_web.py. Standard library only, so the whole review system also runs from the copy in a
project's tools/updater/ folder. Projects are found in three ways, merged and de-duplicated:
  - the Control Panels' shared notes (~/Updater/projects/*.json, or $UPDATER_HOME; "off" turns it off),
  - the folders next to a workspace folder that have an UPDATER.md,
  - folders you name.
A project is any folder with an UPDATER.md. Its manifest is the settings block at the top of that file.
"""
import json
import os
import re

import review_brief as rb


def read_manifest(folder):
    """{key: value} from the folder's UPDATER.md, or None when there is none (or it cannot be read)."""
    try:
        with open(os.path.join(folder, 'UPDATER.md'), encoding='utf-8') as fh:
            return rb.front_matter(fh.read())[0]
    except (OSError, rb.BriefError):
        return None


def hub_home():
    env = os.environ.get('UPDATER_HOME', '').strip()
    if env.lower() in ('off', 'none', '0', 'no'):
        return None
    return os.path.expanduser(env) if env else os.path.join(os.path.expanduser('~'), 'Updater')


def hub_folders(home):
    """Project folders named by the Control Panels' notes in <home>/projects/."""
    found = []
    folder = os.path.join(home, 'projects') if home else None
    if not folder or not os.path.isdir(folder):
        return found
    for name in sorted(os.listdir(folder)):
        if not name.endswith('.json'):
            continue
        try:
            with open(os.path.join(folder, name), encoding='utf-8') as fh:
                note = json.load(fh)
            if isinstance(note, dict) and isinstance(note.get('folder'), str):
                found.append(note['folder'])
        except (OSError, ValueError):
            continue
    return found


def sibling_folders(workspace):
    if not workspace or not os.path.isdir(workspace):
        return []
    return [os.path.join(workspace, n) for n in sorted(os.listdir(workspace)) if os.path.isdir(os.path.join(workspace, n))]


def slug(text):
    return re.sub(r'[^\w.-]+', '-', text).strip('-.').lower() or 'project'


def discover(workspace=None, home='default', extra=()):
    """-> [{'id', 'folder', 'name', 'meta'}] for every project found, in a stable order."""
    home = hub_home() if home == 'default' else home
    seen, projects = set(), []
    for folder in list(extra) + hub_folders(home) + sibling_folders(workspace):
        folder = os.path.realpath(folder)
        if folder in seen or not os.path.isdir(folder):
            continue
        meta = read_manifest(folder)
        if meta is None:
            continue
        seen.add(folder)
        projects.append({'folder': folder, 'name': meta.get('name') or os.path.basename(folder), 'meta': meta})
    used = {}
    for p in sorted(projects, key=lambda p: (p['name'].lower(), p['folder'])):
        base = slug(os.path.basename(p['folder']))
        used[base] = used.get(base, 0) + 1
        p['id'] = base if used[base] == 1 else '%s-%d' % (base, used[base])
    return sorted(projects, key=lambda p: (p['name'].lower(), p['folder']))


def safe_relative(path):
    """A folder name inside a repository: relative, no `..`, no drive. '' when it is not."""
    path = (path or '').strip().replace('\\', '/')
    if path.startswith('/'):
        return ''
    parts = [x for x in path.split('/') if x]
    return '/'.join(parts) if parts and not any(x in ('.', '..') or ':' in x for x in parts) else ''


def _repo_name(url):
    return re.sub(r'\.git$', '', (url or '').rstrip('/').split('/')[-1]).lower()


def review_location(project, projects):
    """Where a project keeps its reviews: {'repo_path', 'dir', 'path', 'label', 'problem'} ('problem' is '' when all is well)."""
    meta = project['meta']
    repo = (meta.get('review_repo') or '').strip()
    rel = safe_relative(meta.get('review_dir')) or 'reviews'
    out = {'repo_path': '', 'dir': rel, 'path': '', 'label': repo or 'this repository', 'problem': ''}
    if not repo:
        out['repo_path'] = project['folder']
    else:
        want = repo.split('/')[-1].lower()
        for p in projects:
            if _repo_name(p['meta'].get('source_url')) == want or os.path.basename(p['folder']).lower() == want:
                out['repo_path'] = p['folder']
                break
        else:
            sibling = os.path.join(os.path.dirname(project['folder']), repo.split('/')[-1])
            if os.path.isdir(sibling):
                out['repo_path'] = sibling
    if not out['repo_path']:
        out['problem'] = 'The review repository %s is not on this computer. Clone it next to this project, or open its Control Panel once.' % repo
    else:
        out['path'] = os.path.join(out['repo_path'], *rel.split('/'))
    return out
