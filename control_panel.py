#!/usr/bin/env python3
"""
Control Panel launcher: all a project needs to carry.

It fetches the shared Control Panel into a hidden .updater folder (and keeps it current), then runs it
for this project. Everything about the project itself (its name, what to open, what to rebuild) is in
UPDATER.md next to this file.

    python control_panel.py                 open the window
    python control_panel.py --update        update, plain text   (also --send --changes --restore-points --open --start
                                            --stop --doctor --no-gui; --help lists them all)
"""
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Where the shared Control Panel comes from. UPDATER.md may override both (updater_source, updater_ref).
# A ref pins a tag or branch, so a new release reaches this project only when you move the pin.
UPDATER_SOURCE = 'https://github.com/timochrym/Updater.git'
UPDATER_REF = ''

# Used only when this file is on its own with no project beside it (a fresh install from one file).
PROJECT_SOURCE = ''
PROJECT_NAME = ''
PROJECT_FOLDER = ''

ENGINE = HERE / '.updater'
NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
CHECK_EVERY = 6 * 3600           # seconds between quiet "is there a newer Control Panel?" checks


def say(text):
    """Show a message even when there is no console (double-clicked on Windows)."""
    try:
        import tkinter
        from tkinter import messagebox
        root = tkinter.Tk()
        root.withdraw()
        messagebox.showinfo('Control Panel', text)
        root.destroy()
    except Exception:
        print(text, file=sys.stderr)


def read_settings():
    path = HERE / 'UPDATER.md'
    out = {}
    try:
        text = path.read_text(encoding='utf-8').lstrip('\ufeff')
    except OSError:
        return out
    if text.startswith('---'):
        for line in text.split('---', 2)[1].splitlines():
            m = re.match(r'^([A-Za-z_][\w-]*):\s*(.*?)\s*$', line)
            if m:
                out[m.group(1).lower().replace('-', '_')] = m.group(2)
    return out


def find_git():
    found = shutil.which('git')
    if found:
        return found
    for cand in ('/usr/bin/git', '/opt/homebrew/bin/git', '/usr/local/bin/git',
                 r'C:\Program Files\Git\cmd\git.exe', r'C:\Program Files (x86)\Git\cmd\git.exe'):
        if os.path.isfile(cand):
            return cand
    return None


def note(text):
    """One line in logs/launcher.log, so "it did not update" always has a reason someone can read."""
    try:
        (HERE / 'logs').mkdir(exist_ok=True)
        with open(str(HERE / 'logs' / 'launcher.log'), 'a', encoding='utf-8') as fh:
            fh.write('%s %s\n' % (time.strftime('%Y-%m-%d %H:%M:%S'), text))
    except OSError:
        pass


def git(exe, *args, cwd=None, timeout=60):
    # core.fileMode off: a cloud drive that drops the "may run" flag must not read as a change.
    env = dict(os.environ, GIT_TERMINAL_PROMPT='0', LC_ALL='C', GIT_CONFIG_COUNT='1',
               GIT_CONFIG_KEY_0='core.fileMode', GIT_CONFIG_VALUE_0='false')
    try:
        p = subprocess.run([exe] + list(args), cwd=str(cwd) if cwd else None, env=env, capture_output=True,
                           stdin=subprocess.DEVNULL, timeout=timeout, creationflags=NO_WINDOW)
        if p.returncode != 0 and args and args[0] not in ('rev-parse', 'merge-base'):
            note('git %s failed: %s' % (' '.join(args[:3]), (p.stderr or p.stdout or b'').decode('utf-8', 'replace').strip()[-300:]))
        return p.returncode == 0
    except Exception as exc:
        note('git %s could not run: %s' % (' '.join(args[:3]), exc))
        return False


def version_tuple(text):
    return tuple(int(x) for x in re.findall(r'\d+', text or '')[:3]) or (0,)


def engine_version():
    try:
        return (ENGINE / 'VERSION').read_text(encoding='utf-8').strip()
    except OSError:
        return '0'


def refresh(exe, ref):
    """Bring .updater to the newest Control Panel (or the pinned ref). It is a download, not a place to work, so whatever
    changed inside it is overwritten rather than allowed to block the update (Tim, 2026-10-12: a Google Drive folder that
    lost the "may run" flag kept the old Control Panel for good). A commit made in it is kept on a kept-<time> branch."""
    if not git(exe, 'fetch', '--quiet', '--tags', '--force', 'origin', cwd=ENGINE, timeout=40):
        return False
    target = None
    for cand in (['origin/' + ref, ref] if ref else ['origin/main', 'origin/master']):
        if git(exe, 'rev-parse', '--verify', '--quiet', cand + '^{commit}', cwd=ENGINE):
            target = cand
            break
    if not target:
        note('nothing called %s to update to' % (ref or 'main'))
        return False
    if not git(exe, 'merge-base', '--is-ancestor', 'HEAD', target, cwd=ENGINE):
        git(exe, 'branch', '--force', 'kept-' + time.strftime('%Y%m%d-%H%M%S'), 'HEAD', cwd=ENGINE)
    if target.startswith('origin/'):
        branch = target[len('origin/'):]
        ok = git(exe, 'checkout', '--quiet', '--force', '-B', branch, target, cwd=ENGINE)
        if ok:
            git(exe, 'branch', '--quiet', '--set-upstream-to', target, cwd=ENGINE)
        return ok
    return git(exe, 'checkout', '--quiet', '--force', '--detach', target, cwd=ENGINE)


def download(exe, source, ref):
    return git(exe, 'clone', '--quiet', *(['--branch', ref] if ref else []), source, str(ENGINE), timeout=180)


def download_again(exe, source, ref):
    """Last resort when .updater cannot be brought up to date: set it aside, download a fresh copy, and put the old one
    back if that fails."""
    aside = ENGINE.with_name('.updater-old-' + time.strftime('%Y%m%d-%H%M%S'))
    try:
        ENGINE.rename(aside)
    except OSError as exc:
        note('could not set .updater aside: %s' % exc)
        return False
    if download(exe, source, ref):
        shutil.rmtree(str(aside), ignore_errors=True)
        note('downloaded the Control Panel again (%s)' % engine_version())
        return True
    shutil.rmtree(str(ENGINE), ignore_errors=True)
    try:
        aside.rename(ENGINE)
    except OSError:
        pass
    return False


def ensure_engine(source, ref, minimum=''):
    """Make sure .updater holds the shared Control Panel. Quiet; a failed refresh never blocks starting.
    It looks for a newer one every few hours, and at once when the project needs a newer one (updater_min in UPDATER.md);
    a copy that cannot be brought up to the minimum is downloaded again."""
    stamp = ENGINE / '.last_check'
    exe = find_git()
    if (ENGINE / 'control_panel.py').is_file():
        recent = stamp.exists() and time.time() - stamp.stat().st_mtime < CHECK_EVERY
        too_old = bool(minimum) and version_tuple(engine_version()) < version_tuple(minimum)
        if exe and (not recent or too_old):
            before = engine_version()
            refresh(exe, ref)
            if minimum and version_tuple(engine_version()) < version_tuple(minimum):
                note('Control Panel %s is older than the %s this project needs; downloading it again' % (engine_version(), minimum))
                download_again(exe, source, ref)
            if engine_version() != before:
                note('Control Panel %s -> %s' % (before, engine_version()))
            try:
                stamp.write_text(str(time.time()))
            except OSError:
                pass
            if minimum and version_tuple(engine_version()) < version_tuple(minimum):
                say('The Control Panel could not update itself to version %s (this copy has %s). Check your internet '
                    'connection and open it again. The reason is in logs/launcher.log.' % (minimum, engine_version()))
        return True
    if not exe:
        say('The update tool is not installed, so the Control Panel cannot be downloaded.\n\n'
            + ('On a Mac, run:  xcode-select --install' if sys.platform == 'darwin'
               else 'Install it from https://git-scm.com/download/win') + '\nthen open this again.')
        return False
    if not download(exe, source, ref):
        say("The Control Panel could not be downloaded. Check your internet connection and that you are signed in, "
            "then open this again.")
        return False
    try:
        stamp.write_text(str(time.time()))
    except OSError:
        pass
    return True


def main():
    settings = read_settings()
    source = os.environ.get('UPDATER_SOURCE') or settings.get('updater_source') or UPDATER_SOURCE
    ref = settings.get('updater_ref') or UPDATER_REF
    if not source:
        say('This project does not say where the Control Panel comes from (updater_source in UPDATER.md).')
        return 1
    if not ensure_engine(source, ref, settings.get('updater_min', '')):
        return 1
    cmd = [sys.executable, str(ENGINE / 'control_panel.py'), '--project', str(HERE)] + sys.argv[1:]
    if not (HERE / 'UPDATER.md').is_file():                      # a lone launcher: tell the engine what to install
        for flag, value in (('--source', PROJECT_SOURCE), ('--name', PROJECT_NAME), ('--folder-name', PROJECT_FOLDER)):
            if value:
                cmd += [flag, value]
    return subprocess.call(cmd)


if __name__ == '__main__':
    sys.exit(main())
