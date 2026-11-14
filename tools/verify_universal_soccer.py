#!/usr/bin/env python3
"""Headless Chromium CDP verification for Soccer Physics pixel-art characters,
Universal Side Menu across all games, and the Universal Inspect Menu."""
import base64
import json
import os
import socket
import struct
import subprocess
import sys
import time
import urllib.request

ROOT = "/home/antigravity/timochrym/TimothysZombieGame2020"
ART = "/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/a4d36bc5-02d6-4235-bdce-8eccce4ceec6"
PORT = 8766


def ws_connect(url):
    host_port = url.split("ws://")[1].split("/")[0]
    host, port = host_port.split(":")
    path = "/" + url.split("/", 3)[3]
    s = socket.create_connection((host, int(port)), timeout=20)
    key = base64.b64encode(b"antigravity12345").decode()
    req = f"GET {path} HTTP/1.1\r\nHost: {host_port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
    s.sendall(req.encode())
    buf = b""
    while b"\r\n\r\n" not in buf:
        buf += s.recv(4096)
    return s


def ws_send(s, msg):
    data = msg.encode()
    frame = bytearray([0x81])
    n = len(data)
    if n < 126:
        frame.append(0x80 | n)
    elif n < 65536:
        frame.append(0x80 | 126)
        frame.extend(struct.pack("!H", n))
    else:
        frame.append(0x80 | 127)
        frame.extend(struct.pack("!Q", n))
    mask = b"\x12\x34\x56\x78"
    frame.extend(mask)
    for i, b in enumerate(data):
        frame.append(b ^ mask[i % 4])
    s.sendall(bytes(frame))


def ws_recv(s):
    def read_exact(k):
        out = b""
        while len(out) < k:
            chunk = s.recv(k - len(out))
            if not chunk:
                raise EOFError()
            out += chunk
        return out
    h = read_exact(2)
    n = h[1] & 0x7f
    if n == 126:
        n = struct.unpack("!H", read_exact(2))[0]
    elif n == 127:
        n = struct.unpack("!Q", read_exact(8))[0]
    if h[1] & 0x80:
        read_exact(4)
    return read_exact(n).decode("utf-8", "replace")


class CDP:
    def __init__(self, ws_url):
        self.ws = ws_connect(ws_url)
        self.id = 0
        self.errors = []

    def call(self, method, params=None):
        self.id += 1
        cid = self.id
        ws_send(self.ws, json.dumps({"id": cid, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(ws_recv(self.ws))
            if msg.get("method") == "Runtime.exceptionThrown":
                self.errors.append(json.dumps(msg["params"]))
            elif msg.get("method") == "Log.entryAdded" and msg["params"]["entry"].get("level") == "error":
                txt = msg["params"]["entry"].get("text", "")
                if "favicon.ico" not in msg["params"]["entry"].get("url", "") and "404" not in txt:
                    self.errors.append(txt)
            if msg.get("id") == cid:
                if "error" in msg:
                    raise RuntimeError(msg["error"])
                return msg.get("result", {})

    def eval(self, expr):
        res = self.call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        if "exceptionDetails" in res:
            raise RuntimeError(res["exceptionDetails"])
        return res.get("result", {}).get("value")

    def screenshot(self, path):
        res = self.call("Page.captureScreenshot", {"format": "png"})
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(base64.b64decode(res["data"]))


def main():
    srv = subprocess.Popen(["python3", "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                           cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    chrome = subprocess.Popen([
        "/usr/bin/chromium", "--headless", "--no-sandbox", "--disable-gpu",
        "--remote-debugging-port=9224", "--window-size=1280,760",
        f"http://127.0.0.1:{PORT}/index.html"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        ws_url = None
        for _ in range(40):
            try:
                pages = json.loads(urllib.request.urlopen("http://127.0.0.1:9224/json").read())
                if pages and pages[0].get("webSocketDebuggerUrl"):
                    ws_url = pages[0]["webSocketDebuggerUrl"]
                    break
            except Exception:
                time.sleep(0.2)
        assert ws_url, "Chromium CDP did not start"

        cdp = CDP(ws_url)
        cdp.call("Runtime.enable")
        cdp.call("Log.enable")
        time.sleep(1.5)

        # 1. Launch Zombie Ball in Flail (Soccer Physics) mode
        cdp.eval("""
            Hub.close();
            sportCfg.style = 'flail';
            GameModes.launch('sport');
            Flail.spawnTeams();
            Sport.phase = 'play';
            userZoom = 1.65;
            cameraTargetX = -1100;
            cameraTargetY = 160;
        """)
        time.sleep(0.8)
        flail_count = cdp.eval("Flail.men.length")
        assert flail_count >= 4, f"Expected >=4 Flail men, got {flail_count}"
        cdp.screenshot(f"{ART}/verify_soccer_flail.png")

        # 2. Test Universal Side Menu + Inspect in Zombie Ball
        cdp.eval("userZoom = 1; SandboxUI.sideOpen = true; SandboxUI.sideTab = 'controls'; SandboxUI.render();")
        time.sleep(0.3)
        has_tunables = cdp.eval("!!document.querySelector('[data-gtune]')")
        assert has_tunables, "Controls tab should render Zombie Ball tunables"

        # Test timeScale button
        cdp.eval("document.querySelector('[data-ts=\"0.5\"]').click()")
        assert abs(cdp.eval("devOpts.timeScale") - 0.5) < 0.01, "TimeScale should be 0.5"
        cdp.eval("document.querySelector('[data-ts=\"1\"]').click()")

        # Switch to Inspect tab and quick-pick Ball
        cdp.eval("document.querySelector('[data-stab=\"inspect\"]').click()")
        time.sleep(0.2)
        cdp.eval("document.querySelector('[data-qpick=\"ball\"]').click()")
        time.sleep(0.3)
        assert cdp.eval("UniversalInspect.selected && UniversalInspect.selected.kind === 'ball'"), "Ball should be selected"
        cdp.eval("document.getElementById('sb-in-freeze').click()")
        assert cdp.eval("!!Ball._sbFrozen"), "Ball should be frozen"
        cdp.eval("document.getElementById('sb-in-freeze').click()")
        cdp.screenshot(f"{ART}/verify_inspect_sport.png")

        # 3. Switch to Arena Mix via Universal Side Menu Games tab
        cdp.eval("document.querySelector('[data-stab=\"games\"]').click()")
        time.sleep(0.2)
        cdp.eval("document.querySelector('[data-gmlaunch=\"mix\"]').click()")
        time.sleep(0.8)
        assert cdp.eval("GameModes.current.id === 'mix'"), "Should switch to Arena Mix"
        cdp.eval("SandboxUI.sideOpen = true; SandboxUI.sideTab = 'inspect'; SandboxUI.render();")
        time.sleep(0.2)
        cdp.eval("document.querySelector('[data-qpick=\"tank0\"]').click()")
        time.sleep(0.3)
        assert cdp.eval("UniversalInspect.selected && UniversalInspect.selected.kind === 'tank'"), "Tank should be selected in Mix"
        cdp.screenshot(f"{ART}/verify_inspect_mix.png")

        # 4. Switch to Zombie Survival via Games tab and inspect enemy
        cdp.eval("document.querySelector('[data-stab=\"games\"]').click()")
        time.sleep(0.2)
        cdp.eval("document.querySelector('[data-gmlaunch=\"survival\"]').click()")
        time.sleep(0.6)
        assert cdp.eval("GameModes.current.id === 'survival'"), "Should switch to Survival"
        cdp.eval("spawnZombie('KNIGHT', redGuy.x + 180, redGuy.y + 40);")
        time.sleep(0.2)
        cdp.eval("SandboxUI.sideOpen = true; SandboxUI.sideTab = 'inspect'; SandboxUI.render();")
        time.sleep(0.2)
        cdp.eval("document.querySelector('[data-qpick=\"z0\"]').click()")
        time.sleep(0.3)
        assert cdp.eval("UniversalInspect.selected && UniversalInspect.selected.kind === 'enemy'"), "Enemy should be selected"
        cdp.screenshot(f"{ART}/verify_inspect_survival.png")

        # 5. Switch to Blank Sandbox and verify regression
        cdp.eval("document.querySelector('[data-stab=\"games\"]').click()")
        time.sleep(0.2)
        cdp.eval("document.querySelector('[data-gmlaunch=\"sandbox\"]').click()")
        time.sleep(0.5)
        assert cdp.eval("SandboxUI.isSandbox() && SandboxUI.sideOpen"), "Sandbox should open with side menu"

        assert len(cdp.errors) == 0, f"JS runtime errors detected: {cdp.errors}"
        print("VERIFICATION PASSED: 0 JS errors, all 5 checks + screenshots succeeded.")
    finally:
        chrome.terminate()
        srv.terminate()


if __name__ == "__main__":
    main()
