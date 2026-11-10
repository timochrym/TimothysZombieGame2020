// ============================================================================
// NET - local network (LAN) multiplayer for every game on this engine.
//
//   Run `node server.js`, open the printed http://<ip>:8080 link on each device, press "📡 LAN".
//
//   HOST   runs the real game. Each player who joins gets a hero (P3, P4 ...). Every 2 ticks the host
//          sends a snapshot: the level/mode, every character, enemy, crate, level piece, bullet, pickup,
//          ragdoll and gadget (only the fields that changed), a few HUD globals, and the sounds /
//          floating texts / sparks that happened, so remote screens feel the same.
//   CLIENT does no simulation. It sends its keys/mouse/pad 60x a second and draws the host's world
//          from the snapshots (smoothed), with its own camera following its own hero.
//
//   Modes can sync private HUD state with  netState() -> json  and  applyNetState(json)  hooks.
// ============================================================================
var NET_COLORS = ["#ff4d52", "#3da5ff", "#ffd23f", "#4ade80", "#c084fc", "#fb923c", "#f472b6", "#2dd4bf",
                  "#a3e635", "#f87171", "#60a5fa", "#facc15", "#e879f9", "#34d399", "#fda4af", "#93c5fd"];
var NET_GLOBALS = ["level", "score", "highScore", "combo", "comboTimer", "heroLevel", "heroXP", "heroXPNext", "coins", "gameOver",
                   "lastStandTimer", "levelTransitionTimer", "zombiesRemainingToSpawn", "godMode", "jetpackEnabled", "rpgDamageMult", "baseZoom"];
// fields that are bookkeeping, huge, or meaningless on another machine
var NET_SKIP = { collidedWith: 1, collidedRamp: 1, target: 1, cpuIn: 1, netIn: 1, hitCd: 1, sticks: 1, navPath: 1, navBan: 1,
                 flyPath: 1, pts: 1, lastAttacker: 1, thrownBy: 1, navTarget: 1, homeX: 0 };

var Net = {
    role: null,            // null | "host" | "client"
    ws: null,
    pid: 0,
    name: "",
    status: "",
    peers: {},             // host: pid -> { pid, name, slot, color, ch, inp, seen:{da,gr,rl} }
    lobbyPlayers: [],
    addresses: [],
    tickNo: 0,
    resetNo: 0,
    events: [],
    nextNid: 1,
    fullNext: true,
    // client state
    objs: new Map(),
    myNid: 0,
    lastSnapAt: 0,
    snapCount: 0,
    hostInHub: false,
    inGame: false,
    menuOpen: false,
    localDash: 0, localGrab: 0, localReload: 0,
    lastInpStr: "",
    lastInpSent: 0,

    available: function() { return /^https?:$/.test(location.protocol); },
    active: function() { return !!this.role; },
    peerCount: function() { var n = 0; for (var k in this.peers) n++; return n; },

    // ------------------------------------------------------------------ connection
    // Make sure this page really comes from the game's server.js (a plain web server can't relay players)
    connect: function(role, name) {
        if (this.ws) this.disconnect();
        this.name = (name || "Player").slice(0, 16);
        try { localStorage.setItem("timsLanName", this.name); } catch (e) {}
        var self = this;
        this.status = "Checking for the LAN server…";
        this.statusKind = "info";
        this.serverMissing = false;
        NetUI.render();
        fetch("/lan-info", { cache: "no-store" }).then(function(r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
        }).then(function(info) {
            if (!info || info.port === undefined) throw new Error("not the game server");
            if (role === "host" && info.hasHost) {
                self.status = "Someone on this network is already hosting. Press Join to play in their game.";
                self.statusKind = "error";
                NetUI.render();
                return;
            }
            self.openSocket(role);
        }).catch(function() {
            self.serverMissing = true;
            self.status = "This page isn't coming from the game's LAN server, so there's nothing to connect to.";
            self.statusKind = "error";
            NetUI.render();
        });
    },

    openSocket: function(role) {
        var url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/lan";
        var ws;
        try { ws = new WebSocket(url); } catch (e) { this.status = "Could not open a connection: " + e.message; this.statusKind = "error"; NetUI.render(); return; }
        this.ws = ws;
        this.status = "Connecting…";
        this.statusKind = "info";
        var self = this;
        ws.onopen = function() { ws.send(JSON.stringify({ t: "hello", role: role, name: self.name })); };
        ws.onmessage = function(ev) { self.onMessage(ev.data); };
        ws.onclose = function() {
            if (self.ws !== ws) return;
            var was = self.role;
            self.cleanup();
            self.status = was ? "Disconnected from the LAN game." : "Could not connect to the LAN server. Is `node server.js` still running?";
            self.statusKind = "error";
            NetUI.render();
        };
        NetUI.render();
    },

    disconnect: function() {
        var ws = this.ws;
        this.cleanup();
        if (ws) { try { ws.close(); } catch (e) {} }
        this.status = "Left the LAN game.";
        NetUI.render();
    },

    cleanup: function() {
        var wasClient = this.role === "client";
        document.body.classList.remove("lan-client");
        if (this.role === "host") this.removeAllRemoteHeroes();
        this.uncapture();
        this.role = null;
        this.ws = null;
        this.peers = {};
        this.lobbyPlayers = [];
        this.inGame = false;
        this.menuOpen = false;
        if (wasClient) {
            // back to a normal local game
            this.objs = new Map();
            try { resetGame(); } catch (e) {}
            if (typeof Hub !== "undefined") Hub.openHub(false);
        }
    },

    send: function(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(typeof obj === "string" ? obj : JSON.stringify(obj)); },

    onMessage: function(raw) {
        var m;
        try { m = JSON.parse(raw); } catch (e) { return; }
        if (this.role === "host" && m.from !== undefined) { this.hostOnClientMsg(m.from, m.m); return; }
        switch (m.t) {
            case "welcome":
                this.role = m.role; this.pid = m.pid;
                if (m.addresses) this.addresses = m.addresses;
                this.statusKind = "ok";
                if (m.role === "host") {
                    if (typeof paused !== "undefined" && paused && typeof closePause === "function") closePause();
                    this.status = "Hosting. Players can join now.";
                    this.capture();
                    this.fullNext = true;
                } else {
                    this.status = m.hasHost ? "Joined! Waiting for the host's game…" : "Connected. Waiting for someone to host…";
                    this.inGame = false;
                    document.body.classList.add("lan-client");
                    setTimeout(function() { NetUI.close(); }, 600);
                    if (typeof SummonManager !== "undefined" && SummonManager.isOpen) SummonManager.togglePanel();
                }
                break;
            case "error": this.status = m.msg; this.statusKind = "error"; break;
            case "lobby": this.lobbyPlayers = m.players || []; break;
            case "join": if (this.role === "host") this.hostAddPeer(m.pid, m.name); break;
            case "leave": if (this.role === "host") this.hostRemovePeer(m.pid); break;
            case "hostdown": this.status = "The host left. Waiting for a new host…"; this.inGame = false; break;
            case "hostup": this.status = "Host connected. Loading…"; break;
            case "snap": if (this.role === "client") this.clientApply(m); break;
        }
        NetUI.render();
    },

    // ================================================================== HOST
    hostAddPeer: function(pid, name) {
        var used = {};
        for (var k in this.peers) used[this.peers[k].slot] = 1;
        var slot = 2;
        while (used[slot]) slot++;
        var p = { pid: pid, name: name || ("Player " + (slot + 1)), slot: slot, color: NET_COLORS[slot % NET_COLORS.length], ch: null,
                  inp: {}, seen: { da: 0, gr: 0, rl: 0 } };
        this.peers[pid] = p;
        if (!(typeof Hub !== "undefined" && Hub.isOpen)) this.spawnRemoteHero(p);
        Components.addFloatingText(p.name + " JOINED!", redGuy ? redGuy.x : 0, (redGuy ? redGuy.y : 0) + 140, p.color, 22);
        if (typeof SFX !== "undefined") SFX.play("pickup");
        this.fullNext = true;
    },

    hostRemovePeer: function(pid) {
        var p = this.peers[pid];
        if (!p) return;
        this.removeHero(p);
        delete this.peers[pid];
        Components.addFloatingText(p.name + " left", redGuy ? redGuy.x : 0, (redGuy ? redGuy.y : 0) + 140, "#94a3b8", 18);
    },

    // a joining player takes over a CPU (Brawl / Soccer ...) so teams and stocks stay fair
    takeOverCpu: function(p) {
        var humans = {}, cpu = null;
        for (let i = 0; i < characters.length; i++) {
            var c = characters[i];
            if (c.isCPU) continue;
            var t = c.fighterTeam !== undefined ? c.fighterTeam : -1;
            humans[t] = (humans[t] || 0) + 1;
        }
        for (let i = 0; i < characters.length; i++) {
            var c2 = characters[i];
            if (!c2.isCPU || c2.dead || c2.isRemote) continue;
            var t2 = c2.fighterTeam !== undefined ? c2.fighterTeam : -1;
            if (!cpu || (humans[t2] || 0) < (humans[cpu.fighterTeam] || 0)) cpu = c2;
        }
        if (!cpu) return null;
        cpu.isCPU = false;
        cpu.wasCPU = cpu.playerLabel;
        cpu.color = p.color;
        cpu.name = p.name;
        Components.addFloatingText(p.name + " takes over " + cpu.playerLabel, cpu.x, cpu.y + 120, p.color, 18);
        return cpu;
    },

    newBrawlFighter: function(p) {
        var sp = brawl.stage && brawl.stage.spawns ? brawl.stage.spawns[characters.length % brawl.stage.spawns.length] : [0, 300];
        var ch = ModeKit.makeHero(p.slot, sp[0], sp[1], { name: p.name, color: p.color });
        var used = {};
        for (let i = 0; i < characters.length; i++) if (characters[i] !== ch) used[characters[i].fighterTeam] = 1;
        var t = 0; while (used[t]) t++;
        ch.fighterTeam = t;
        ch.stocks = (typeof brawlCfg !== "undefined") ? brawlCfg.stocks : 3;
        ch.damagePct = 0; ch.eliminated = false; ch.maxAirJumps = ch.airJumps = 2; ch.invulnTimer = 120;
        return ch;
    },

    removeHero: function(p) {
        if (!p.ch) return;
        if (p.ch.wasCPU && characters.indexOf(p.ch) !== -1) {
            // hand the slot back to the computer
            var c = p.ch;
            c.isCPU = true; c.isRemote = false; c.netIn = null; c.playerLabel = c.wasCPU; c.wasCPU = null;
            c.cpuIn = c.cpuIn || { shoot: false, jet: false, interact: false, reloadQueued: false };
            p.ch = null;
            return;
        }
        var i = characters.indexOf(p.ch);
        if (i !== -1) characters.splice(i, 1);
        p.ch.dead = true;
        p.ch = null;
        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
    },

    removeAllRemoteHeroes: function() { for (var k in this.peers) this.removeHero(this.peers[k]); },

    spawnRemoteHero: function(p) {
        if (p.ch && characters.indexOf(p.ch) !== -1) return;
        var anchor = redGuy || characters[0];
        var lvl = (typeof LevelManager !== "undefined") ? LevelManager.getCurrentLevel() : null;
        var sp = (lvl && lvl.spawnP1) ? lvl.spawnP1 : [anchor ? anchor.x : 0, anchor ? anchor.y : 200];
        var off = ((p.slot % 2) ? 1 : -1) * (60 + 50 * Math.floor(p.slot / 2));
        var ch;
        if (GameModes.has("addNetPlayer")) ch = GameModes.call("addNetPlayer", p.slot, p);
        if (!ch) ch = this.takeOverCpu(p);
        if (!ch && typeof brawl !== "undefined" && brawl.active) ch = this.newBrawlFighter(p);
        if (!ch) {
            ch = ModeKit.makeHero(p.slot, sp[0] + off, sp[1] + 20, { name: p.name, color: p.color, label: "P" + (p.slot + 1), hp: anchor ? anchor.maxHealth : 100 });
            if (anchor) { ch.team = anchor.team; if (anchor.fighterTeam !== undefined) ch.fighterTeam = anchor.fighterTeam; }
        }
        ch.isRemote = true;
        ch.netPid = p.pid;
        ch.netIn = { shoot: false, jet: false, interact: false, reloadQueued: false, kbShoot: false, kbJet: false, kbInteract: false };
        ch.playerLabel = p.name.length <= 10 ? p.name : ("P" + (p.slot + 1));
        p.ch = ch;
        if (typeof rebuildAllObjects === "function") rebuildAllObjects();
        this.fullNext = true;
    },

    // called by resetGame() after the mode created its players
    afterPlayersCreated: function() {
        if (this.role !== "host") return;
        this.resetNo++;
        for (var k in this.peers) { this.peers[k].ch = null; this.spawnRemoteHero(this.peers[k]); }
        this.fullNext = true;
    },

    hostOnClientMsg: function(pid, m) {
        var p = this.peers[pid];
        if (!p || !m) return;
        if (m.full) { this.fullNext = true; return; }
        if (m.t === "in") p.inp = m;
    },

    // per-tick input for a remote hero (called from Components.moveTypeFinder)
    applyRemoteInput: function(ch) {
        var p = this.peers[ch.netPid];
        var i = (p && p.inp) || {};
        ch.upPressed = !!i.u; ch.downPressed = !!i.d; ch.leftPressed = !!i.l; ch.rightPressed = !!i.r;
        ch.shootPressed = !!i.sh;
        ch.abilityPressed = !!i.it;
        var n = ch.netIn;
        n.shoot = !!i.sh; n.jet = !!i.jt; n.interact = !!i.it;
        ch.netAim = false;
        if (i.ax !== undefined && i.ay !== undefined) {
            ch.degree = ch.degreeToGoCW = (Math.degrees(Math.atan2(i.ax - ch.x, i.ay - ch.y)) + 360) % 360;
            ch.degreeSpeedX = 0;
            ch.netAim = true;
        } else if (i.ag !== undefined) {
            ch.degree = ch.degreeToGoCW = i.ag;
            ch.netAim = true;
        }
        if (!p) return;
        if ((i.da || 0) > p.seen.da) { p.seen.da = i.da; if (!ch.dead && !ch.isZombie) ch.triggerNinjaDash(); }
        if ((i.pu || 0) > (p.seen.pu || 0)) { p.seen.pu = i.pu; if (typeof Feel !== "undefined") Feel.punch(ch); }
        if (typeof Build !== "undefined") {
            if ((i.bt || 0) > (p.seen.bt || 0)) { p.seen.bt = i.bt; Build.toggle(ch); }
            ch.buildPiece = i.bp || 0; ch.buildMat = i.bm || 0;
            ch.netAimX = i.ax; ch.netAimY = i.ay;
            if (ch.buildMode && (i.gr || 0) > p.seen.gr) { p.seen.gr = i.gr; Build.removeAt(ch); }
        }
        if ((i.rl || 0) > p.seen.rl) { p.seen.rl = i.rl; n.reloadQueued = true; }
        if ((i.gr || 0) > p.seen.gr) {
            p.seen.gr = i.gr;
            if (!ch.dead && !GameModes.call("onSecondary", ch)) {
                var gx = i.ax !== undefined ? i.ax : ch.x + Math.sin(Math.radians(ch.degree)) * 160;
                var gy = i.ay !== undefined ? i.ay : ch.y + Math.cos(Math.radians(ch.degree)) * 160;
                ch.tryGrabOrThrow(gx, gy);
            }
        }
    },

    // ---- capture effects (sounds, texts, sparks) so remote screens replay them
    capture: function() {
        if (this._cap) return;
        var self = this;
        this._cap = {
            sfx: typeof SFX !== "undefined" ? SFX.play : null,
            txt: Components.addFloatingText,
            spk: Components.spawnSparks,
            ring: Components.addRing
        };
        if (this._cap.sfx) SFX.play = function(n, x, y, v, p) { self.pushEv(["s", n, r1(x), r1(y), v, p]); return self._cap.sfx.apply(SFX, arguments); };
        Components.addFloatingText = function(t, x, y, c, s) { self.pushEv(["t", String(t), r1(x), r1(y), c, s]); return self._cap.txt.apply(Components, arguments); };
        Components.spawnSparks = function(x, y, c, n) { self.pushEv(["p", r1(x), r1(y), c, Math.min(12, n | 0)]); return self._cap.spk.apply(Components, arguments); };
        if (this._cap.ring) Components.addRing = function() { self.pushEv(["r"].concat(Array.prototype.slice.call(arguments))); return self._cap.ring.apply(Components, arguments); };
    },

    uncapture: function() {
        if (!this._cap) return;
        if (this._cap.sfx) SFX.play = this._cap.sfx;
        Components.addFloatingText = this._cap.txt;
        Components.spawnSparks = this._cap.spk;
        if (this._cap.ring) Components.addRing = this._cap.ring;
        this._cap = null;
    },

    pushEv: function(e) {
        if (this.role !== "host" || this.peerCount() === 0) return;
        if (this.events.length < 120) this.events.push(e);
    },

    // ---- entity serialisation (delta against the last snapshot)
    nid: function(o) {
        if (!o._nid) window.Object.defineProperty(o, "_nid", { value: this.nextNid++, enumerable: false, writable: true });
        return o._nid;
    },

    ser: function(o, full) {
        var last = o._ns;
        if (!last || full) { last = {}; window.Object.defineProperty(o, "_ns", { value: last, enumerable: false, writable: true, configurable: true }); }
        var out = null;
        for (var k in o) {
            if (k.charCodeAt(0) === 95 || NET_SKIP[k] === 1) continue;     // "_" private
            var v = o[k], t = typeof v, enc;
            if (t === "number") enc = isFinite(v) ? Math.round(v * 100) / 100 : null;
            else if (t === "string" || t === "boolean") enc = v;
            else if (v === null) enc = null;
            else if (t === "object") {
                if (v._nid || v instanceof Character || v instanceof Ragdoll || (v instanceof Object && v.constructor === Object)) {
                    enc = { $: this.nid(v) };
                    if (last[k] && last[k].$ === enc.$) continue;
                } else {
                    var s;
                    try { s = JSON.stringify(v); } catch (e) { continue; }
                    if (!s || s.length > 3000) continue;
                    if (last[k] === s) continue;
                    last[k] = s;
                    (out || (out = {}))[k] = { j: s };
                    continue;
                }
            } else continue;
            if (t !== "object" && last[k] === enc && k in last) continue;
            last[k] = enc;
            (out || (out = {}))[k] = enc;
        }
        return out;
    },

    serRagdoll: function(rd, full) {
        var d = this.ser(rd, full) || {};
        var pts = [];
        for (let i = 0; i < rd.pts.length; i++) pts.push(Math.round(rd.pts[i].x * 10) / 10, Math.round(rd.pts[i].y * 10) / 10, rd.pts[i].r);
        d.pts = pts;
        return d;
    },

    collection: function(list, full, every, ragdoll) {
        var o = [], d = {}, any = false;
        for (let i = 0; i < list.length; i++) {
            var e = list[i];
            if (!e || (e.dead && !ragdoll && !(e instanceof Character))) continue;
            var id = this.nid(e);
            o.push(id);
            if (!every && !full && e._ns) continue;
            var x = ragdoll ? this.serRagdoll(e, full) : this.ser(e, full);
            if (x) { d[id] = x; any = true; }
        }
        return any || full ? { o: o, d: d } : { o: o };
    },

    hostFrame: function() {
        if (this.role !== "host") return;
        this.tickNo++;
        if (this.peerCount() === 0) { this.events.length = 0; return; }
        if (this.tickNo % 2) return;
        var full = this.fullNext;
        this.fullNext = false;
        var staticsEvery = full || this.tickNo % 20 === 0 || staticObjects.length !== this._lastStaticCount;
        this._lastStaticCount = staticObjects.length;
        var C = {
            ch: this.collection(characters, full, true),
            zb: this.collection(zombies, full, true),
            mv: this.collection(movingObjects, full, true),
            lz: this.collection(lazers, full, true),
            pu: this.collection(powerUps, full, true),
            co: this.collection(coinOrbs, full, this.tickNo % 6 === 0),
            tc: this.collection(typeof treasureChests !== "undefined" ? treasureChests : [], full, this.tickNo % 10 === 0),
            gd: this.collection(typeof Gadgets !== "undefined" ? Gadgets.list : [], full, true),
            rd: this.collection(typeof Ragdolls !== "undefined" ? Ragdolls.list : [], full, true, true)
        };
        if (staticsEvery) C.st = this.collection(staticObjects, full, true);
        var g = {};
        for (let i = 0; i < NET_GLOBALS.length; i++) g[NET_GLOBALS[i]] = window[NET_GLOBALS[i]];
        g.multiplayer = multiplayer;
        var you = {};
        for (var k in this.peers) if (this.peers[k].ch) you[k] = this.nid(this.peers[k].ch);
        var snap = {
            t: "snap", f: this.tickNo, full: full ? 1 : 0, rs: this.resetNo,
            mode: GameModes.current ? GameModes.current.id : "survival",
            lvl: (typeof LevelManager !== "undefined") ? LevelManager.currentLevelKey : "",
            g: g, br: brawl, gs: (typeof Gadgets !== "undefined") ? { starsGot: Gadgets.starsGot, starsTotal: Gadgets.starsTotal, deaths: Gadgets.deaths, keys: Gadgets.keys } : null,
            r: { red: redGuy ? this.nid(redGuy) : 0, blue: blueGuy ? this.nid(blueGuy) : 0 },
            you: you, c: C, ev: this.events,
            ms: GameModes.has("netState") ? GameModes.call("netState") : undefined
        };
        var s;
        try { s = JSON.stringify(snap); } catch (e) { this.events = []; return; }
        this.events = [];
        this.send(s);
        this.lastSnapBytes = s.length;
    },

    // host sitting in the Arcade menu: let clients know
    hostIdle: function() {
        if (this.role !== "host" || this.peerCount() === 0) return;
        this.tickNo++;
        if (this.tickNo % 30) return;
        this.send('{"t":"snap","hub":1}');
        this.fullNext = true;
    },

    // ================================================================== CLIENT
    clientApply: function(s) {
        this.lastSnapAt = performance.now();
        if (s.hub) { this.hostInHub = true; return; }
        this.hostInHub = false;
        this.snapCount++;
        // level / game changed: rebuild the backdrop locally (geometry itself comes from the host)
        if (s.mode !== this.curMode || s.lvl !== this.curLvl || s.rs !== this.curReset) {
            this.curMode = s.mode; this.curLvl = s.lvl; this.curReset = s.rs;
            if (typeof Hub !== "undefined") Hub.close();
            paused = false;
            try { GameModes.activate(s.mode); } catch (e) {}
            if (typeof LevelManager !== "undefined" && s.lvl) LevelManager.currentLevelKey = s.lvl;
            try { staticObjects = []; movingObjects = []; createMap(); } catch (e) { console.warn("net: createMap", e); }
            if (!s.full) this.requestFull();
        }
        this.inGame = true;
        var self = this;
        var C = s.c;
        var map = this.objs;
        var protoFor = { ch: Character.prototype, zb: Character.prototype, mv: Object.prototype, st: Object.prototype, rd: Ragdoll.prototype };
        var fresh = [];
        var missing = false;
        var build = function(key, assign) {
            var col = C[key];
            if (!col) return;
            var arr = [];
            for (let i = 0; i < col.o.length; i++) {
                var id = col.o[i];
                var e = map.get(id);
                var d = col.d ? col.d[id] : null;
                if (!e) {
                    e = protoFor[key] ? window.Object.create(protoFor[key]) : {};
                    window.Object.defineProperty(e, "_nid", { value: id, enumerable: false, writable: true });
                    map.set(id, e);
                    e._new = true;
                }
                if (d) fresh.push([e, d, key]);
                else if (e._new) { map.delete(id); missing = true; continue; }     // never got its data: ask again
                arr.push(e);
            }
            assign(arr);
        };
        build("ch", function(a) { characters = a; });
        build("zb", function(a) { zombies = a; });
        build("mv", function(a) { movingObjects = a; });
        build("st", function(a) { staticObjects = a; });
        build("lz", function(a) { lazers = a; });
        build("pu", function(a) { powerUps = a; });
        build("co", function(a) { coinOrbs = a; });
        build("tc", function(a) { if (typeof treasureChests !== "undefined") treasureChests = a; });
        build("gd", function(a) {
            if (typeof Gadgets === "undefined") return;
            Gadgets.list = a; Gadgets.byId = {};
            for (let i = 0; i < a.length; i++) if (a[i].id) Gadgets.byId[a[i].id] = a[i];
        });
        build("rd", function(a) { if (typeof Ragdolls !== "undefined") Ragdolls.list = a; });
        // apply field updates (refs resolve after every object exists)
        for (let i = 0; i < fresh.length; i++) {
            var e = fresh[i][0], d = fresh[i][1], key = fresh[i][2];
            var smooth = (key === "ch" || key === "zb" || key === "mv") && !e._new;
            var ox = e.x, oy = e.y;
            for (var k in d) {
                var v = d[k];
                if (k === "pts" && key === "rd") {
                    var pts = e.pts || (e.pts = []);
                    pts.length = v.length / 3;
                    for (let p = 0; p < pts.length; p++) {
                        var pp = pts[p] || (pts[p] = {});
                        pp.x = v[p * 3]; pp.y = v[p * 3 + 1]; pp.r = v[p * 3 + 2]; pp.px = pp.x; pp.py = pp.y;
                    }
                    continue;
                }
                if (v && typeof v === "object") {
                    if (v.$ !== undefined) { e[k] = map.get(v.$) || null; continue; }
                    if (v.j !== undefined) { try { e[k] = JSON.parse(v.j); } catch (er) {} continue; }
                }
                e[k] = v;
            }
            if (smooth && ox !== undefined && Math.hypot(e.x - ox, e.y - oy) < 260) {
                e._tx = e.x; e._ty = e.y; e.x = ox; e.y = oy;
            } else { e._tx = undefined; }
            e._new = false;
        }
        // forget objects that no longer exist anywhere (statics are only listed every 20 ticks)
        if (s.full || this.snapCount % 60 === 0) {
            var live = new Set();
            for (var ck in C) for (let i = 0; i < C[ck].o.length; i++) live.add(C[ck].o[i]);
            if (!C.st) for (let i = 0; i < staticObjects.length; i++) live.add(staticObjects[i]._nid);
            map.forEach(function(v, k) { if (!live.has(k)) map.delete(k); });
        }
        for (var gk in s.g) window[gk] = s.g[gk];
        if (s.br) for (var bk in s.br) brawl[bk] = s.br[bk];
        if (s.gs && typeof Gadgets !== "undefined") { Gadgets.starsGot = s.gs.starsGot; Gadgets.starsTotal = s.gs.starsTotal; Gadgets.deaths = s.gs.deaths; Gadgets.keys = s.gs.keys || {}; }
        this.myNid = s.you ? s.you[this.pid] : 0;
        // the HUD on this screen shows MY hero (falls back to the host's P1 while spectating)
        var mine = map.get(this.myNid);
        redGuy = mine || map.get(s.r.red) || characters[0] || null;
        blueGuy = mine ? null : (map.get(s.r.blue) || null);
        if (s.ms !== undefined && GameModes.has("applyNetState")) { try { GameModes.call("applyNetState", s.ms); } catch (e) {} }
        // replay effects
        var ev = s.ev || [];
        for (let i = 0; i < ev.length; i++) {
            var x = ev[i];
            try {
                if (x[0] === "s" && typeof SFX !== "undefined") SFX.play(x[1], x[2], x[3], x[4], x[5]);
                else if (x[0] === "t") Components.addFloatingText(x[1], x[2], x[3], x[4], x[5]);
                else if (x[0] === "p") Components.spawnSparks(x[1], x[2], x[3], x[4]);
                else if (x[0] === "r" && Components.addRing) Components.addRing.apply(Components, x.slice(1));
            } catch (e) {}
        }
        if (typeof StaticGrid !== "undefined" && C.st) StaticGrid.build();
        if (missing && performance.now() - (this.lastFullAsk || 0) > 500) { this.lastFullAsk = performance.now(); this.requestFull(); }
    },

    requestFull: function() { this.send({ t: "in", full: 1 }); },

    myChar: function() { return this.objs.get(this.myNid) || null; },

    // read this device's keyboard / mouse / pad and send it to the host
    sendInput: function() {
        var inp = PlayerInput[0];
        var pad = (typeof Pads !== "undefined") ? Pads.state[0] : null;
        var padOn = pad && pad.active;
        var me = this.myChar();
        var m = {
            t: "in",
            u: (WASDupPressed || ULDRupPressed || (padOn && pad.up)) ? 1 : 0,
            d: (WASDdownPressed || ULDRdownPressed || (padOn && pad.down)) ? 1 : 0,
            l: (WASDleftPressed || ULDRleftPressed || (padOn && pad.left)) ? 1 : 0,
            r: (WASDrightPressed || ULDRrightPressed || (padOn && pad.right)) ? 1 : 0,
            sh: (inp.kbShoot || inp.shoot || (mouseDown && !this.menuOpen) || (padOn && pad.shoot)) ? 1 : 0,
            jt: (inp.kbJet || inp.jet || (padOn && pad.jet)) ? 1 : 0,
            it: (inp.kbInteract || inp.interact || (padOn && pad.interact)) ? 1 : 0,
            da: this.localDash, gr: this.localGrab, rl: this.localReload,
            pu: this.localPunch || 0,
            bt: this.localBuildToggle || 0, bp: typeof Build !== "undefined" ? Build.localPiece : 0, bm: typeof Build !== "undefined" ? Build.localMat : 0
        };
        if (inp.reloadQueued) { inp.reloadQueued = false; this.localReload++; m.rl = this.localReload; }
        if (padOn && pad.aim) m.ag = Math.round((Math.degrees(Math.atan2(pad.aim[0], -pad.aim[1])) + 360) % 360);
        else if (useMouseAim && me) { var mp = Components.getMouseWorldPos(); m.ax = Math.round(mp[0]); m.ay = Math.round(mp[1]); }
        var str = JSON.stringify(m);
        var now = performance.now();
        if (str !== this.lastInpStr || now - this.lastInpSent > 100) {
            this.send(str);
            this.lastInpStr = str;
            this.lastInpSent = now;
        }
    },

    // replaces tick() on a client: draw the host's world
    clientTick: function() {
        this.sendInput();
        ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);
        if (!this.inGame || this.hostInHub) {
            this.drawWaiting(this.hostInHub ? "The host is picking a game…" : (this.status || "Waiting for the host…"));
            return;
        }
        // smooth toward the latest snapshot positions; bullets keep flying between snapshots
        var lists = [characters, zombies, movingObjects];
        for (let l = 0; l < lists.length; l++) for (let i = 0; i < lists[l].length; i++) {
            var e = lists[l][i];
            if (e._tx !== undefined) { e.x += (e._tx - e.x) * 0.45; e.y += (e._ty - e.y) * 0.45; }
        }
        for (let i = 0; i < lazers.length; i++) { lazers[i].x += (lazers[i].xspeed || 0) * 0.5; lazers[i].y += (lazers[i].yspeed || 0) * 0.5; }

        // camera: my hero (or the host's view when I'm dead / spectating)
        var me = this.myChar();
        var focus = (me && !me.dead) ? me : (redGuy || characters[0]);
        if (focus) {
            var desired = baseZoom * userZoom;
            cameraScaleX += (desired - cameraScaleX) * 0.08;
            cameraScaleY = cameraScaleX;
            cameraTargetX += (focus.x - cameraTargetX) * 0.16;
            cameraTargetY += (focus.y - cameraTargetY) * 0.16;
        }
        var shX = 0, shY = 0;
        if (screenShake > 0) { shX = (Math.random() - 0.5) * screenShake * 2 * settings.shake; shY = (Math.random() - 0.5) * screenShake * 2 * settings.shake; screenShake *= 0.85; }
        xc = xcMaster - cameraTargetX * cameraScaleX + shX;
        yc = ycMaster + (cameraTargetY + 110) * cameraScaleY + shY;

        var safe = function(fn) { try { fn(); } catch (e) { if (!Net._warned) { Net._warned = true; console.warn("net draw", e); } } };
        safe(function() { if (typeof BackgroundMosaic !== "undefined") BackgroundMosaic.draw(ctx); });
        safe(function() { if (typeof Depth !== "undefined" && Depth.on()) Depth.drawSides(staticObjects.concat(movingObjects)); });
        for (let i = 0; i < staticObjects.length; i++) safe(function() { if (!staticObjects[i].dead) staticObjects[i].staticObject(); });
        safe(function() { if (typeof Gadgets !== "undefined") Gadgets.draw(); });
        safe(function() { GameModes.call("drawWorld"); });
        for (let i = 0; i < movingObjects.length; i++) safe(function() {
            var o = movingObjects[i];
            if (o.dead) return;
            Polygon.create(o.poly, o.color, o);
            if (o.drawDecorations) o.drawDecorations();
        });
        safe(function() { if (typeof Ragdolls !== "undefined") Ragdolls.drawCorpses(); });
        safe(function() { Net.drawPickups(); });
        for (let i = 0; i < characters.length; i++) safe(function() { if (!characters[i].dead) characters[i].createCharacter(); });
        for (let i = 0; i < zombies.length; i++) safe(function() { if (!zombies[i].dead) zombies[i].createCharacter(); });
        if (me && !me.dead) safe(function() { Net.drawYouMarker(me); });
        for (let i = 0; i < lazers.length; i++) safe(function() { Components.drawProjectile(lazers[i]); });
        safe(function() { Components.updateParticles(); });
        safe(function() { Components.drawEffects(); });
        safe(function() { GameModes.call("drawFront"); });
        safe(function() { if (typeof Build !== "undefined") { Build.drawWorld(); Build.drawFront(); } });
        safe(function() { Components.updateFloatingTexts(); });
        safe(function() { drawHUD(); });
        safe(function() { if (typeof Build !== "undefined") Build.drawHUD(); });
        this.drawClientBadge(me);
        if (this.menuOpen) this.drawClientMenu();
    },

    drawPickups: function() {
        var t = performance.now() / 1000;
        for (let i = 0; i < powerUps.length; i++) {
            var p = powerUps[i];
            var def = (typeof PowerUpDefs !== "undefined" && PowerUpDefs[p.type]) || { icon: "?", color: p.color || "#fff" };
            var sx = wsx(p.x), sy = wsy(p.y + Math.sin(t * 4 + i) * 9);
            ctx.fillStyle = def.color || "#ffdd33";
            ctx.beginPath(); ctx.arc(sx, sy, 22 * cameraScaleX + 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#0a0f16"; ctx.font = "800 " + Math.round(18 * cameraScaleX + 8) + "px " + UI_FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(def.icon || "?", sx, sy + 1);
        }
        ctx.fillStyle = "#ffd23f";
        for (let i = 0; i < coinOrbs.length; i++) {
            var c = coinOrbs[i];
            ctx.beginPath(); ctx.arc(wsx(c.x), wsy(c.y), 9 * cameraScaleX + 3, 0, Math.PI * 2); ctx.fill();
        }
        if (typeof treasureChests !== "undefined") for (let i = 0; i < treasureChests.length; i++) {
            var tc = treasureChests[i];
            ctx.fillStyle = tc.opened ? "#5b3a1e" : "#b7791f";
            ctx.fillRect(wsx(tc.x - tc.w / 2), wsy(tc.y + tc.h / 2), tc.w * cameraScaleX, tc.h * cameraScaleY);
        }
        ctx.textBaseline = "alphabetic";
    },

    drawYouMarker: function(me) {
        var sx = wsx(me.x), sy = wsy(me.y + me.s2 / 2) - 46;
        ctx.save();
        ctx.fillStyle = me.color || "#fff";
        ctx.beginPath(); ctx.moveTo(sx - 9, sy - 8); ctx.lineTo(sx + 9, sy - 8); ctx.lineTo(sx, sy + 4); ctx.closePath(); ctx.fill();
        ctx.font = "800 12px " + UI_FONT; ctx.textAlign = "center";
        ctx.fillText("YOU", sx, sy - 12);
        ctx.restore();
    },

    drawClientBadge: function(me) {
        var age = performance.now() - this.lastSnapAt;
        var txt = "📡 LAN · " + (me ? (me.playerLabel || "you") : "spectating") + (age > 1000 ? " · host not responding…" : "") + "   Esc: menu";
        ctx.save();
        ctx.font = "700 13px " + UI_FONT;
        var wdt = ctx.measureText(txt).width + 24;
        ctx.fillStyle = age > 1000 ? "rgba(127,29,29,0.85)" : "rgba(10,15,22,0.72)";
        ctx.fillRect(cssW / 2 - wdt / 2, cssH - 34, wdt, 24);
        ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
        ctx.fillText(txt, cssW / 2, cssH - 17);
        ctx.restore();
    },

    drawWaiting: function(msg) {
        ctx.fillStyle = "#0b1220"; ctx.fillRect(0, 0, cssW, cssH);
        ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
        ctx.font = "800 30px " + UI_FONT; ctx.fillText("📡 LAN GAME", cssW / 2, cssH / 2 - 40);
        ctx.font = "600 17px " + UI_FONT; ctx.fillStyle = "#94a3b8"; ctx.fillText(msg, cssW / 2, cssH / 2);
        var names = this.lobbyPlayers.map(function(p) { return p.name; }).join(", ");
        if (names) ctx.fillText("Players here: " + names, cssW / 2, cssH / 2 + 30);
        ctx.fillText("Esc: menu", cssW / 2, cssH / 2 + 60);
        if (this.menuOpen) this.drawClientMenu();
    },

    drawClientMenu: function() {
        ctx.save();
        ctx.fillStyle = "rgba(5,8,14,0.78)"; ctx.fillRect(0, 0, cssW, cssH);
        ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
        ctx.font = "800 26px " + UI_FONT; ctx.fillText("LAN MENU", cssW / 2, cssH / 2 - 50);
        ctx.font = "600 17px " + UI_FONT;
        ctx.fillText("Enter / L — leave this LAN game", cssW / 2, cssH / 2);
        ctx.fillText("Esc — back to the game", cssW / 2, cssH / 2 + 30);
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("Only the host can change games or levels.", cssW / 2, cssH / 2 + 70);
        ctx.restore();
    },

    // keyboard on a client: Esc menu; everything else is just sent as input
    clientKey: function(e) {
        if (e.code === "Escape") { if (!e.repeat) this.menuOpen = !this.menuOpen; e.preventDefault(); return true; }
        if (this.menuOpen) {
            if (e.code === "Enter" || e.code === "KeyL") { this.menuOpen = false; this.disconnect(); }
            e.preventDefault();
            return true;
        }
        return false;
    }
};

function r1(v) { return typeof v === "number" ? Math.round(v * 10) / 10 : v; }

// ============================================================================
// LAN panel (DOM): host / join, the join link to share, and who's connected
// ============================================================================
var NetUI = {
    el: null,
    open: function() {
        if (!this.el) this.build();
        this.el.style.display = "flex";
        this.render();
    },
    close: function() { if (this.el) this.el.style.display = "none"; },
    isOpen: function() { return this.el && this.el.style.display !== "none"; },

    build: function() {
        var css = document.createElement("style");
        css.textContent =
            "#lan-panel{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(5,8,14,.72);z-index:9999;font-family:'Segoe UI',Arial,sans-serif}" +
            "#lan-panel .card{background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:14px;padding:22px 26px;width:min(560px,92vw);max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.5)}" +
            "#lan-panel h2{margin:0 0 4px;font-size:24px}#lan-panel p{margin:6px 0;color:#94a3b8;line-height:1.45}" +
            "#lan-panel input{background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:8px;padding:9px 12px;font-size:16px;width:200px}" +
            "#lan-panel button{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-size:15px;font-weight:700;cursor:pointer;margin:4px 6px 4px 0}" +
            "#lan-panel button.sec{background:#334155}#lan-panel button.warn{background:#b91c1c}" +
            "#lan-panel code{background:#1e293b;padding:3px 7px;border-radius:6px;color:#7dd3fc;font-size:15px;user-select:all}" +
            "#lan-panel .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0}" +
            "#lan-panel .pl{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;background:#1e293b;margin:5px 0}" +
            "#lan-panel .dot{width:14px;height:14px;border-radius:4px;flex:none}#lan-panel .st{color:#fbbf24;font-weight:600}#lan-panel .err{color:#fca5a5;font-weight:700;background:rgba(127,29,29,.35);padding:8px 10px;border-radius:8px}" +
            "#lan-panel button:disabled{opacity:.45;cursor:default}" +
            "body.lan-client .top-bar-btn:not(#lan-btn),body.lan-client #level-select-dropdown,body.lan-client #mario-maker-dock{display:none!important}";
        document.head.appendChild(css);
        var el = document.createElement("div");
        el.id = "lan-panel";
        el.addEventListener("mousedown", function(e) { e.stopPropagation(); if (e.target === el) NetUI.close(); });
        el.addEventListener("keydown", function(e) { e.stopPropagation(); if (e.code === "Escape") NetUI.close(); });
        el.addEventListener("keyup", function(e) { e.stopPropagation(); });
        document.body.appendChild(el);
        this.el = el;
    },

    render: function() {
        if (!this.el || !this.isOpen()) return;
        var esc = function(s) { return String(s).replace(/[&<>"]/g, function(c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
        var h = '<div class="card"><h2>📡 LAN Multiplayer</h2>';
        if (!Net.available()) {
            h += "<p>LAN play needs the little game server, because a web page opened from a file can't accept connections from other devices.</p>" +
                 "<p><b>1.</b> On the computer with the game folder, run:</p><div class='row'><code>node server.js</code></div>" +
                 "<p><b>2.</b> It prints a link like <code>http://192.168.1.20:8080</code>. Open that link on every computer, tablet or phone on the same Wi-Fi (including this one).</p>" +
                 "<p><b>3.</b> One player presses <b>Host</b>, everyone else presses <b>Join</b>.</p>" +
                 "<p>Needs <a href='https://nodejs.org' target='_blank' style='color:#7dd3fc'>Node.js</a> (free). If others can't connect, allow Node through the firewall.</p>";
        } else if (!Net.role) {
            var nm = "";
            try { nm = localStorage.getItem("timsLanName") || ""; } catch (e) {}
            var busy = !!Net.ws || Net.statusKind === "info" && /Checking/.test(Net.status);
            h += "<p>Play together on one Wi-Fi network. The <b>host</b> runs the game and picks what to play; every player who <b>joins</b> gets their own hero and camera on their own screen. Up to 16 players.</p>" +
                 "<div class='row'>Your name: <input id='lan-name' maxlength='16' value='" + esc(Net.name || nm || "Player") + "'></div>" +
                 "<div class='row'><button id='lan-host'" + (busy ? " disabled" : "") + ">🏠 Host a game</button><button id='lan-join'" + (busy ? " disabled" : "") + ">🎮 Join the game</button><button class='sec' id='lan-close'>Close</button></div>";
            if (Net.status) h += "<p class='" + (Net.statusKind === "error" ? "err" : "st") + "'>" + esc(Net.status) + "</p>";
            if (Net.serverMissing) {
                h += "<p>This page is being served from <code>" + esc(location.host) + "</code> by a regular web server (for example <code>python -m http.server</code> or an editor preview). Multiplayer needs the game's own server:</p>" +
                     "<p><b>1.</b> Stop the current server. <b>2.</b> Open a terminal in the game folder and run:</p><div class='row'><code>node server.js</code></div>" +
                     "<p><b>3.</b> Open <code>http://localhost:8080</code> (other devices use the <code>http://192.168…:8080</code> link it prints). Want to keep port " + esc(location.port || "80") + "? Run <code>node server.js " + esc(location.port || "80") + "</code> instead.</p>";
            }
        } else if (Net.role === "host") {
            var link = Net.addresses.length ? ("http://" + Net.addresses[0] + ":" + location.port) : location.origin;
            h += "<p class='st'>" + esc(Net.status) + "</p><p>Tell other players to open this link and press <b>Join</b>:</p><div class='row'><code>" + esc(link) + "</code></div>";
            if (Net.addresses.length > 1) h += "<p>Other addresses for this computer: " + Net.addresses.slice(1).map(function(a) { return "<code>http://" + esc(a) + ":" + location.port + "</code>"; }).join(" ") + "</p>";
            h += "<p><b>Players</b> (pick the game from the Arcade as usual; everyone follows you):</p>";
            h += "<div class='pl'><span class='dot' style='background:" + (redGuy ? redGuy.color : "#ff4d52") + "'></span><b>You (host)</b> — P1, keyboard/mouse" + (multiplayer ? " + P2 on this keyboard" : "") + "</div>";
            var any = false;
            for (var k in Net.peers) {
                var p = Net.peers[k]; any = true;
                h += "<div class='pl'><span class='dot' style='background:" + p.color + "'></span><b>" + esc(p.name) + "</b> — P" + (p.slot + 1) + " · on their own device" + (p.ch ? "" : " · joins at the next round") + "</div>";
            }
            if (!any) h += "<p>No one has joined yet.</p>";
            h += "<div class='row'><button class='sec' id='lan-close'>Back to the game</button><button class='warn' id='lan-leave'>Stop hosting</button></div>";
        } else {
            h += "<p class='st'>" + esc(Net.status) + "</p><p>You control your hero with WASD/arrows + mouse (or a controller). Your camera follows you; the host chooses the game.</p>";
            h += "<p><b>In this game:</b> " + (Net.lobbyPlayers.map(function(p) { return esc(p.name); }).join(", ") || "—") + "</p>";
            h += "<div class='row'><button class='sec' id='lan-close'>Back to the game</button><button class='warn' id='lan-leave'>Leave</button></div>";
        }
        h += "</div>";
        this.el.innerHTML = h;
        var $ = function(id) { return document.getElementById(id); };
        var name = function() { return ($("lan-name") && $("lan-name").value.trim()) || "Player"; };
        if ($("lan-host")) $("lan-host").onclick = function() { Net.connect("host", name()); };
        if ($("lan-join")) $("lan-join").onclick = function() { Net.connect("client", name()); };
        if ($("lan-close")) $("lan-close").onclick = function() { NetUI.close(); };
        if ($("lan-leave")) $("lan-leave").onclick = function() { Net.disconnect(); };
    }
};

// open the panel straight away for links like http://192.168.1.20:8080/?lan
if (/[?&]lan\b/.test(location.search)) window.addEventListener("load", function() { setTimeout(function() { NetUI.open(); }, 300); });
window.addEventListener("load", function() { if (!NetUI.el) NetUI.build(); });
