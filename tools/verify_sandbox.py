#!/usr/bin/env python3
"""Visual & movement verifier for Blank Sandbox (captures still frames + tests FPS, movement, grapple, UI)."""
import subprocess, time, json, urllib.request, socket, base64, struct, os, sys

OUT_DIR = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sandbox_frames"
os.makedirs(OUT_DIR, exist_ok=True)

def ws_connect(url):
    host_port = url.split("ws://")[1].split("/")[0]
    host, port = host_port.split(":")
    path = "/" + url.split("/", 3)[3]
    s = socket.create_connection((host, int(port)), timeout=15)
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
    if n < 126: frame.append(0x80 | n)
    elif n < 65536: frame.append(0x80 | 126); frame.extend(struct.pack("!H", n))
    else: frame.append(0x80 | 127); frame.extend(struct.pack("!Q", n))
    mask = b"\x12\x34\x56\x78"
    frame.extend(mask)
    for i, b in enumerate(data): frame.append(b ^ mask[i % 4])
    s.sendall(bytes(frame))

def ws_recv(s):
    def read_exact(k):
        out = b""
        while len(out) < k:
            chunk = s.recv(k - len(out))
            if not chunk: raise EOFError()
            out += chunk
        return out
    h = read_exact(2)
    n = h[1] & 0x7f
    if n == 126: n = struct.unpack("!H", read_exact(2))[0]
    elif n == 127: n = struct.unpack("!Q", read_exact(8))[0]
    if h[1] & 0x80: read_exact(4)
    return read_exact(n).decode("utf-8", "replace")

srv = subprocess.Popen(["python3", "-m", "http.server", "8771"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
chrome = subprocess.Popen(["chromium", "--headless", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=9234", "--window-size=1280,800", "http://127.0.0.1:8771/index.html"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2.4)

errors = []
try:
    pages = json.loads(urllib.request.urlopen("http://127.0.0.1:9234/json").read())
    ws = ws_connect(pages[0]["webSocketDebuggerUrl"])
    cid = [1]
    def cdp(method, params=None):
        i = cid[0]; cid[0] += 1
        ws_send(ws, json.dumps({"id": i, "method": method, "params": params or {}}))
        while True:
            resp = json.loads(ws_recv(ws))
            if resp.get("method") == "Runtime.exceptionThrown":
                errors.append(resp["params"])
            if resp.get("id") == i:
                return resp.get("result", {})

    cdp("Runtime.enable")
    cdp("Page.enable")
    def eval_js(expr):
        r = cdp("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        if "exceptionDetails" in r:
            errors.append(r["exceptionDetails"])
        return r.get("result", {}).get("value")

    def snap(name):
        r = cdp("Page.captureScreenshot", {"format": "png"})
        with open(os.path.join(OUT_DIR, name), "wb") as f:
            f.write(base64.b64decode(r["data"]))
        print("Saved:", os.path.join(OUT_DIR, name))

    time.sleep(0.4)
    snap("frame1_hub.png")
    eval_js("Hub.choose(0)")
    time.sleep(0.6)

    eval_js("window._rafCount = 0; window._rafStart = performance.now(); (function loop(){ window._rafCount++; if (performance.now() - window._rafStart < 800) requestAnimationFrame(loop); })()")
    time.sleep(0.95)
    fps = eval_js("Math.round(window._rafCount / ((performance.now() - window._rafStart) / 1000))")
    print(f"Measured rAF FPS: {fps}")

    x0, y0 = eval_js("redGuy.x"), eval_js("redGuy.y")
    eval_js("WASDrightPressed = true"); time.sleep(0.3); eval_js("WASDrightPressed = false")
    x1 = eval_js("redGuy.x")
    eval_js("WASDleftPressed = true"); time.sleep(0.3); eval_js("WASDleftPressed = false")
    x2 = eval_js("redGuy.x")
    eval_js("WASDupPressed = true"); time.sleep(0.3); eval_js("WASDupPressed = false")
    y1 = eval_js("redGuy.y")
    print(f"Hero movement -> right: {x0:.1f}->{x1:.1f}, left: {x1:.1f}->{x2:.1f}, up: {y0:.1f}->{y1:.1f}")
    assert x1 > x0 and x2 < x1 and y1 > y0

    eval_js("document.querySelector('[data-sbtool=\"drawFloor\"]').click()")
    eval_js("""(function(){
        var cv = document.getElementById('screen');
        cv.dispatchEvent(new MouseEvent('mousedown', {clientX: 460, clientY: 420, button: 0, bubbles: true}));
        window.dispatchEvent(new MouseEvent('mouseup', {clientX: 720, clientY: 460, button: 0, bubbles: true}));
    })()""")
    time.sleep(0.25)
    snap("frame2_sandbox_floor.png")

    eval_js("window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyB', bubbles:true}))")
    time.sleep(0.25)
    snap("frame3_spotlight_spawner.png")
    eval_js("document.getElementById('sb-sp-close').click()")

    eval_js("document.getElementById('sb-top-roster').click()")
    eval_js("spawnZombie('KNIGHT', 180, 120)")
    eval_js("EntityTakeover.possess(zombies[0])")
    zx0 = eval_js("zombies[0].x")
    eval_js("WASDrightPressed = true"); time.sleep(0.3); eval_js("WASDrightPressed = false")
    zx1 = eval_js("zombies[0].x")
    print(f"Possessed Knight movement -> right: {zx0:.1f}->{zx1:.1f}")
    assert zx1 > zx0
    snap("frame4_entity_takeover.png")
    eval_js("EntityTakeover.release(false)")
    eval_js("document.getElementById('sb-top-roster').click()")

    gx0 = eval_js("redGuy.x")
    eval_js("GrappleHook.fire(redGuy, redGuy.x + 350, redGuy.y + 220)")
    time.sleep(0.35)
    gx1 = eval_js("redGuy.x")
    print(f"Grapple pull -> x: {gx0:.1f}->{gx1:.1f}")
    assert gx1 > gx0
    eval_js("GrappleHook.release(redGuy, false)")

    eval_js("document.getElementById('sb-top-pause').click()")
    time.sleep(0.25)
    snap("frame5_pause_menu.png")

    print("Runtime exceptions:", len(errors))
    assert len(errors) == 0
    print("ALL VISUAL + CODE + MOVEMENT CHECKS PASSED!")
finally:
    chrome.terminate()
    srv.terminate()
