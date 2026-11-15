"""
Control Panel add-on: one-click LAN play.

  Start LAN game  starts the game's own server (server.js, needs Node.js) in the background on a free port and
                  opens the game in the browser with the LAN panel already hosting. Pressing it again while the
                  server runs just reopens the game.
  Stop LAN game   stops that server.

The project's normal Start server button is left alone: it serves the page but can't relay players.
"""
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

STATE = 'lan.pid'          # *.pid is git-ignored


def _info(port):
    """The server's /lan-info answer, or None if the game's LAN server isn't on that port."""
    try:
        with urllib.request.urlopen('http://127.0.0.1:%d/lan-info' % port, timeout=1.5) as r:
            data = json.loads(r.read().decode('utf-8'))
            return data if 'port' in data else None
    except Exception:
        return None


def _state(root):
    try:
        return json.loads((root / STATE).read_text())
    except Exception:
        return None


def _free_port(start):
    for port in range(start, start + 20):
        if _info(port):
            return port, True                      # our server is already there (started some other way)
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(('0.0.0.0', port))
            return port, False
        except OSError:
            continue
        finally:
            s.close()
    return None, False


def _find_node():
    node = shutil.which('node')
    if node:
        return node
    for p in ('/opt/homebrew/bin/node', '/usr/local/bin/node', r'C:\Program Files\nodejs\node.exe'):
        if os.path.isfile(p):
            return p
    return None


def _links(port, info):
    return ['http://%s:%d' % (a, port) for a in (info or {}).get('addresses', [])]


def start_lan(project, ctx):
    root = Path(project.root)
    st = _state(root)
    if st and _info(st.get('port', 0)):
        port = st['port']
        webbrowser.open('http://localhost:%d/?lan=host' % port)
        ctx.ok('The LAN game is already running. Others on your Wi-Fi open: ' + (', '.join(_links(port, _info(port))) or 'http://<this computer>:%d' % port))
        return True
    node = _find_node()
    if not node:
        ctx.err('LAN play needs Node.js (free). Install the LTS version from https://nodejs.org, then press Start LAN game again.')
        webbrowser.open('https://nodejs.org/en/download')
        return False
    port, already = _free_port(8080)
    if port is None:
        ctx.err('No free port between 8080 and 8099.')
        return False
    if not already:
        logs = root / 'logs'
        logs.mkdir(exist_ok=True)
        log = open(logs / 'lan-server.log', 'a')
        kw = {}
        if os.name == 'nt':
            kw['creationflags'] = getattr(subprocess, 'CREATE_NO_WINDOW', 0) | getattr(subprocess, 'DETACHED_PROCESS', 0) | getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0)
        else:
            kw['start_new_session'] = True
        p = subprocess.Popen([node, 'server.js', str(port)], cwd=str(root), stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, **kw)
        (root / STATE).write_text(json.dumps({'pid': p.pid, 'port': port}))
        for _ in range(40):
            if _info(port) or p.poll() is not None:
                break
            time.sleep(0.15)
        if not _info(port):
            ctx.err('The LAN server did not start. The reason is in logs/lan-server.log.')
            return False
    webbrowser.open('http://localhost:%d/?lan=host' % port)
    links = _links(port, _info(port))
    ctx.ok('LAN game started. Others on your Wi-Fi open ' + (' or '.join(links) if links else 'http://<this computer>:%d' % port)
           + ' and press Join. If they can\'t connect, allow Node.js through the firewall.')
    return True


def stop_lan(project, ctx):
    root = Path(project.root)
    st = _state(root)
    if not st:
        ctx.warn('No LAN game was started from here.')
        return True
    pid = st.get('pid')
    try:
        if os.name == 'nt':
            subprocess.call(['taskkill', '/PID', str(pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        else:
            os.kill(pid, signal.SIGTERM)
    except Exception:
        pass
    try:
        (root / STATE).unlink()
    except OSError:
        pass
    ctx.ok('LAN game stopped.')
    return True


def register(api):
    kw = {}
    try:
        if int(str(getattr(api, 'version', '1')).split('.')[0]) >= 2:
            kw = {'group': 'Play together', 'home': True}
    except ValueError:
        pass
    api.command('lan', start_lan, label='Start LAN game', help='Play with others on the same Wi-Fi: starts the LAN server and opens the game, ready to host', **kw)
    api.command('lan-stop', stop_lan, label='Stop LAN game', help='Stop the LAN server started here', **kw)
