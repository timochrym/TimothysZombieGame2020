#!/usr/bin/env python3
"""Profiler, rule verifier, and visual tester for Arena Mix (game_mix.js)."""
import subprocess, time, json, urllib.request, socket, base64, struct, os, sys

OUT_DIR = sys.argv[1] if len(sys.argv) > 1 else "/tmp/mix_frames"
os.makedirs(OUT_DIR, exist_ok=True)

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

srv = subprocess.Popen(["python3", "-m", "http.server", "8772"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
chrome = subprocess.Popen(["chromium", "--headless", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=9235", "--window-size=1280,720", "http://127.0.0.1:8772/index.html"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2.4)

errors = []
try:
    pages = json.loads(urllib.request.urlopen("http://127.0.0.1:9235/json").read())
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

    # Launch Arena Mix (close Hub like Hub.choose does)
    eval_js("Hub.close(); GameModes.launch('mix')")
    time.sleep(0.8)

    # Profile 120 frames of Arena Mix (headless deterministic step timing + rAF FPS)
    prof = eval_js("""(() => {
        const N = 120;
        let tTotal = 0, tInteract = 0, tDraw = 0, tTanks = 0, tCells = 0, tSnake = 0;
        for (let i = 0; i < N; i++) {
            const t0 = performance.now();
            Mix.t++;
            const a0 = performance.now();
            Tanks.step();
            const a1 = performance.now();
            Cells.step();
            const a2 = performance.now();
            Snake.step();
            const a3 = performance.now();
            Mix.interact();
            const a4 = performance.now();
            Mix.draw();
            const t1 = performance.now();
            tTanks += a1 - a0;
            tCells += a2 - a1;
            tSnake += a3 - a2;
            tInteract += a4 - a3;
            tDraw += t1 - a4;
            tTotal += t1 - t0;
        }
        return JSON.stringify({
            avgTotalMs: +(tTotal / N).toFixed(3),
            avgTanksMs: +(tTanks / N).toFixed(3),
            avgCellsMs: +(tCells / N).toFixed(3),
            avgSnakeMs: +(tSnake / N).toFixed(3),
            avgInteractMs: +(tInteract / N).toFixed(3),
            avgDrawMs: +(tDraw / N).toFixed(3),
            counts: {
                tanks: Tanks.tanks.length,
                bullets: Tanks.bullets.length,
                shapes: Tanks.shapes.length,
                blobs: Cells.blobs.length,
                cellPellets: Cells.pellets.length,
                worms: Snake.worms.length,
                snakePellets: Snake.pellets.length
            }
        });
    })()""")
    print("PROFILE:", prof)

    # Measure rAF FPS
    eval_js("window._rafCount = 0; window._rafStart = performance.now(); (function loop(){ window._rafCount++; if (performance.now() - window._rafStart < 900) requestAnimationFrame(loop); })()")
    time.sleep(1.05)
    fps = eval_js("Math.round(window._rafCount / ((performance.now() - window._rafStart) / 1000))")
    print(f"Measured rAF FPS: {fps}")

    # Test body switching & camera tracking
    for body in ["tank", "blob", "worm", "chain"]:
        eval_js(f"Mix.setBody('{body}')")
        time.sleep(0.35)
        res = eval_js("""(() => {
            const m = Mix.me();
            return {
                body: mixCfg.body,
                humans: [Tanks.tanks, Cells.players, Snake.worms].map(l => l.filter(x => x.human !== undefined).length).join('/'),
                camDist: m ? Math.round(Math.hypot(Mix.cam.x - m.x, Mix.cam.y - m.y)) : -1,
                pills: Mix._pills.length
            };
        })()""")
        print(f"Body {body}: {res}")
        assert res["camDist"] >= 0 and res["camDist"] < 150, f"Camera off for {body}: {res}"
        assert res["pills"] == 4, f"Expected 4 body pills, got {res['pills']}"
        snap(f"mix_{body}.png")

    # Test clickable body pill
    pill_ok = eval_js("""(() => {
        const p = Mix._pills.find(q => q.id === 'blob');
        mouseX = p.x + p.w * 0.5; mouseY = p.y + p.h * 0.5;
        GameModes.get('mix').onClick(0, 0, 0);
        return mixCfg.body === 'blob';
    })()""")
    assert pill_ok, "Clicking blob pill did not switch body"
    print("Pill click switch: chain -> blob OK")

    # Test Q key body switch
    b_before = eval_js("mixCfg.body")
    eval_js("GameModes.get('mix').onKey('KeyQ')")
    b_after = eval_js("mixCfg.body")
    print(f"KeyQ switch: {b_before} -> {b_after}")
    assert b_before != b_after

    # Run staged cross-game rule invariants from tests/arena_mix.js
    rules_json = eval_js("""(() => {
        paused = true; const R = {};
        const clear = () => { Tanks.tanks = []; Tanks.bullets = []; Tanks.shapes = []; Cells.players = []; Cells.blobs = []; Cells.pellets = []; Cells.viruses = []; Cells.pickups = []; Snake.worms = []; Snake.pellets = []; cellsCfg.bots = 0; SNK.PELLETS = 0; Snake.buildGrid(); };
        const tank = (x, y) => { const k = Tanks.addTank({ name: 'T', color: '#60a5fa' }); k.x = x; k.y = y; k.inv = 0; k.vx = k.vy = 0; return k; };
        const blob = (x, y, m) => { const pl = Cells.addPlayer({ name: 'B', color: '#a78bfa' }); Cells.blobs = Cells.blobs.filter(q => q.pl !== pl); const bb = { pl, x, y, m, vx: 0, vy: 0, mergeT: 0 }; Cells.blobs.push(bb); pl.fx = { speed: 0, shield: 0, magnet: 0 }; pl.aimX = x; pl.aimY = y; return bb; };
        const worm = (x, y, len) => { const w = Snake.spawn({ name: 'W', color: '#f472b6' }); w.len = len; w.ang = 0; w.want = 0; w.safeT = 0; w.segs = []; for (let i = 0; i < len; i++) w.segs.push({ x: x - i * SNK.SEG, y }); return w; };
        const bots = cellsCfg.bots;
        const bullet = (x, y, k) => Tanks.bullets.push({ x, y, vx: 0, vy: 0, r: 9, dmg: 10, pen: 1, owner: k, life: 50 });
        const run = (n) => { for (let i = 0; i < (n || 1); i++) { Mix.t++; Mix.interact(); } };

        clear(); let k = tank(0, 0), bl = blob(300, 0, 200); bullet(300, 0, k); run();
        R.bulletShrinksBlob = '200 -> ' + Math.round(bl.m) + ', bullet used ' + (Tanks.bullets.length === 0);
        clear(); k = tank(0, 0); bl = blob(300, 0, 20); bullet(300, 0, k); run(); R.smallBlobShotToBits = Cells.blobs.length === 0;

        clear(); k = tank(0, 0); let w = worm(600, 0, 60); Snake.buildGrid(); run();
        bullet(600, 0, k); run(); const afterHead = Math.round(w.len);
        w.mx.st[1] = 5; bullet(600, 0, k); run(); const afterArmored = Math.round(w.len);
        R.bulletVsWorm = 'head 60 -> ' + afterHead + ', with 5 Armor -> ' + afterArmored;

        clear(); k = tank(0, 0); run(); const size0 = Math.round(Tanks.size(k)); k.mixMass = 400; k.mixPeak = 400; R.tankSizeFollowsMass = size0 + ' -> ' + Math.round(Tanks.size(k));
        clear(); k = tank(0, 0); run(); k.mixMass = 400; k.mixPeak = 400; bl = blob(10, 0, 100); run(); R.tankEatsSmallerBlob = Cells.blobs.length === 0 && Math.round(k.mixMass) === 500;
        clear(); k = tank(0, 0); run(); bl = blob(0, 0, 2500); run(); R.biggerBlobAbsorbsTank = !k.alive && Math.round(bl.m) === 2536;
        clear(); k = tank(0, 0); run(); bl = blob(40, 0, 40); const hpA = k.hp; run(3); R.equalSizesIgnoreEachOther = k.alive && k.hp === hpA && Math.round(bl.m) === 40;
        clear(); k = tank(0, 0); let k2 = tank(8, 0); run(); k.mixMass = 300; k.mixPeak = 300; run(); R.tankEatsSmallerTank = !k2.alive && Math.round(k.mixMass) === 336;
        clear(); k = tank(0, 0); run(); Cells.pellets.push({ x: 3, y: 0, m: 10, col: '#fff', vx: 0, vy: 0 }); Mix.t = 1; run(); R.tankEatsFood = k.mixMass > 36;
        clear(); k = tank(0, 0); run(); Snake.pellets = [{ x: 3, y: 0, v: 2, col: '#fff', ph: 0 }]; Mix.t = 0; const mW = k.mixMass; run(); R.tankCollectsWormFood = 'mass +' + (k.mixMass - mW).toFixed(1);
        clear(); k = tank(2850, 2850); run(); k.mixMass = 1000; k.mixPeak = 1000; k.mixLvl = k.lvl; const dec0 = cellsCfg.decay;
        cellsCfg.decay = CELL_DECAY_CLASSIC; run(60); R.tankMassDecays = '1000 -> ' + k.mixMass.toFixed(1) + ' in a second'; cellsCfg.decay = dec0;

        clear(); k = tank(2850, 2850); run(); const fire = (m) => { k.mixMass = m; k.mixPeak = m; k.reloadT = 0; Tanks.bullets = []; Tanks.fire(k); const bu = Tanks.bullets[0]; return { r: +bu.r.toFixed(1), dmg: +bu.dmg.toFixed(1), reload: +Tanks.reload(k).toFixed(1) }; };
        R.sizeAffectsShooting = JSON.stringify([fire(36), fire(144), fire(400)]);
        k.mixMass = 36; k.mixPeak = 36; k.lvl = 1; k.xp = 0; run(); k.mixMass = 300; run(); R.sizeGivesLevel = 'level 1 -> ' + k.lvl + ', xp from mass ' + Math.round(k.score);
        k.mixMass = 100; const lv = k.lvl; run(5); R.shrinkKeepsLevel = k.lvl === lv;

        clear(); k = tank(0, 0); run(); k.mixMass = 200; k.mixPeak = 200; k.hp = Tanks.maxHp(k) * 0.2; Mix.t = 1; run();
        const lumps = Cells.pellets.filter(q => q.lump); R.badlyDamagedSplits = 'mass 200 -> ' + Math.round(k.mixMass) + ', ' + lumps.length + ' lumps of ' + Math.round(lumps[0] ? lumps[0].m : 0) + ', still shooting ' + k.alive + ', hp back to ' + Math.round(k.hp / Tanks.maxHp(k) * 100) + '%';
        R.lumpsAreJustFood = lumps.every(q => q.vx !== undefined && !('pl' in q));
        clear(); k = tank(0, 0); run(); k.mixMass = 200; k.mixPeak = 200; Cells.viruses.push({ x: 0, y: 0, m: 100 }); Mix.t = 1; run(); R.virusSplitsTank = Math.round(k.mixMass) === 100 && Cells.pellets.some(q => q.lump);
        clear(); k = tank(0, 0); run(); k.mixMass = 200; k.mixPeak = 200; k.hp = 0; Tanks.hurt(k, 1, null); k.alive = false; run(); R.deadTankDropsLumps = Cells.pellets.filter(q => q.lump).length >= 3;

        clear(); w = worm(0, 0, 40); Snake.buildGrid(); run(); Tanks.shapes.push({ type: 'square', x: 5, y: 0, vx: 0, vy: 0, hp: 10, max: 10, ang: 0, spin: 0, drift: 0, hitT: 0 });
        let ticks = 0; while (Tanks.shapes.some(q => q.x === 5 && q.y === 0) && ticks < 200) { run(); ticks++; }
        R.wormBreaksBlock = 'square broken in ' + ticks + ' ticks, xp ' + w.mx.xp + ', length ' + Math.round(w.len);
        w.mx.xp = 0; w.mx.st = [0, 0, 0]; w.mx.pts = 0; w.human = 0; Mix.wormXp(w, 20); const pts = w.mx.pts; Mix.wormStat(w, 0); w.human = undefined; R.wormLevels = 'level ' + w.mx.lvl + ', points ' + pts + ' -> Bite ' + w.mx.st[0];
        clear(); w = worm(0, 0, 80); k = tank(20, 0); Snake.buildGrid(); const hpB = k.hp; run(); R.wormBitesTank = 'tank hp -' + Math.round(hpB - k.hp) + ', worm alive ' + w.alive + ', length ' + Math.round(w.len);
        clear(); w = worm(0, 0, 80); k = tank(-30 * SNK.SEG, 0); Snake.buildGrid(); const hpC = k.hp; run(); R.wormBodyHurtsTank = k.hp < hpC && w.alive;

        clear(); w = worm(0, 0, 80); bl = blob(-30 * SNK.SEG, 0, 400); Snake.buildGrid(); const lenP = w.len; const massBefore = 400; run();
        const pieces = Cells.blobs.length, total = Math.round(Cells.blobs.reduce((a, q) => a + q.m, 0));
        R.blobPopsOnWorm = pieces + ' pieces, total mass ' + massBefore + ' -> ' + total + ', worm length +' + Math.round(w.len - lenP);
        run(5); R.piecesDontRepop = Cells.blobs.length === pieces;
        clear(); w = worm(0, 0, 80); bl = blob(-30 * SNK.SEG, 0, 20); Snake.buildGrid(); run(); R.tinyBlobTakenWhole = Cells.blobs.length === 0;

        clear(); w = worm(0, 0, 30); Cells.pellets.push({ x: 5, y: 0, m: 1, col: '#fff', vx: 0, vy: 0 }); bl = blob(900, 0, 100); Snake.pellets = [{ x: 905, y: 0, v: 2, col: '#fff', ph: 0 }]; Snake.buildGrid(); Mix.t = 1; const l0 = w.len, m0 = bl.m; run();
        R.crossFood = 'worm +' + (w.len - l0).toFixed(1) + ', blob +' + (bl.m - m0).toFixed(0);

        clear(); k = tank(0, 0); w = worm(2000, 0, 40); Snake.buildGrid(); run(); const sp0 = Tanks.speed(k), mass0 = k.mixMass;
        Cells.pickups = [{ x: 0, y: 0, kind: 'speed' }, { x: 0, y: 0, kind: 'shield' }, { x: 0, y: 0, kind: 'mass' }, { x: 2000, y: 0, kind: 'magnet' }, { x: 2000, y: 0, kind: 'mass' }, { x: 2000, y: 0, kind: 'shield' }]; const wl = w.len; run();
        R.sharedPowerups = 'tank speed x' + (Tanks.speed(k) / sp0).toFixed(1) + ', shield ' + (k.inv > 300) + ', mass +' + Math.round(k.mixMass - mass0) + ' | worm magnet ' + (w.mixFx.magnet > 0) + ', length +' + Math.round(w.len - wl) + ', shield ' + (w.safeT > 300) + ' | left ' + Cells.pickups.length;

        // 9. buffed virus burns 25% mass on giant blobs & all players can feed viruses
        clear(); bl = blob(0, 0, 400); Cells.viruses.push({ x: 0, y: 0, m: 100, feed: 0, vx: 0, vy: 0 }); Cells.step();
        const vTotal = Math.round(Cells.blobs.reduce((a, q) => a + q.m, 0));
        R.virusBurnsBigBlob = Cells.blobs.length >= 4 && vTotal <= 310;

        clear(); const vi = { x: 0, y: 0, m: 100, feed: 0, vx: 0, vy: 0 }; Cells.viruses.push(vi);
        Cells.pellets.push({ x: 0, y: 0, m: 11, col: '#fff', vx: 10, vy: 0, ejected: true }); Cells.step();
        const afterEject = vi.feed;
        k = tank(-100, 0); Tanks.bullets.push({ x: 0, y: 0, vx: 10, vy: 0, r: 9, dmg: 10, pen: 1, owner: k, life: 50 }); run();
        const afterBullet = vi.feed;
        w = worm(0, 0, 40); w.boosting = false; w.ang = 0; Snake.buildGrid(); run();
        const afterWorm = vi.feed;
        w.segs[0].x = 600;
        for (let b = 0; b < 3; b++) {
            Tanks.bullets.push({ x: 0, y: 0, vx: 10, vy: 0, r: 9, dmg: 10, pen: 1, owner: k, life: 50 }); run();
        }
        const splitOk = (afterEject === 1 && afterBullet === 2 && afterWorm === 4 && Cells.viruses.length === 2);
        clear(); Cells.viruses.push({ x: 0, y: 0, m: 100, feed: 0, vx: 0, vy: 0 });
        w = worm(0, 0, 40); w.boosting = true; w.ang = 0; Snake.buildGrid(); run();
        const popOk = Cells.pellets.filter(q => q.m === 12).length >= 5 && Snake.pellets.filter(q => q.v === 10).length >= 4;
        R.allFeedVirus = splitOk && popOk;

        // 10. bullet falloff & high-dmg soft-cap balance
        clear(); bl = blob(300, 0, 200); Tanks.bullets.push({ x: 300, y: 0, vx: 10, vy: 0, r: 9, dmg: 30, pen: 1, owner: k, life: 100, maxLife: 100 }); run();
        const dmgNear = 200 - bl.m;
        clear(); bl = blob(300, 0, 200); Tanks.bullets.push({ x: 300, y: 0, vx: 10, vy: 0, r: 9, dmg: 30, pen: 1, owner: k, life: 10, maxLife: 100 }); run();
        const dmgFar = 200 - bl.m;
        R.bulletBalanceFalloff = dmgNear < 30 * 1.3 && dmgFar < dmgNear * 0.65;

        cellsCfg.bots = bots; SNK.PELLETS = 1400; Mix.reset(); paused = false;
        return JSON.stringify(R);
    })()""")
    r = json.loads(rules_json)
    print("RULES:", json.dumps(r, indent=2))
    assert r["bulletShrinksBlob"] == "200 -> 187, bullet used true", r["bulletShrinksBlob"]
    assert r["smallBlobShotToBits"] is True
    assert r["tankCollectsWormFood"] == "mass +0.7", r["tankCollectsWormFood"]
    assert r["tankMassDecays"] == "1000 -> 998.0 in a second", r["tankMassDecays"]
    assert r["bulletVsWorm"] == "head 60 -> 44, with 5 Armor -> 36", r["bulletVsWorm"]
    assert r["tankSizeFollowsMass"] == "30 -> 100", r["tankSizeFollowsMass"]
    assert r["tankEatsSmallerBlob"] is True
    assert r["biggerBlobAbsorbsTank"] is True
    assert r["equalSizesIgnoreEachOther"] is True
    assert r["tankEatsSmallerTank"] is True
    assert r["tankEatsFood"] is True
    assert r["virusSplitsTank"] is True
    assert r["deadTankDropsLumps"] is True
    assert r["wormBodyHurtsTank"] is True
    assert r["piecesDontRepop"] is True
    assert r["tinyBlobTakenWhole"] is True
    assert r["virusBurnsBigBlob"] is True, r["virusBurnsBigBlob"]
    assert r["allFeedVirus"] is True, r["allFeedVirus"]
    assert r["bulletBalanceFalloff"] is True, r["bulletBalanceFalloff"]
    assert r["sharedPowerups"] == "tank speed x1.5, shield true, mass +30 | worm magnet true, length +30, shield true | left 0", r["sharedPowerups"]
    print("ALL ASSERTIONS PASSED!")

finally:
    chrome.terminate()
    srv.terminate()

if errors:
    print("ERRORS:", errors)
    sys.exit(1)
print("VERIFY MIX COMPLETE: 0 errors")
