#!/usr/bin/env node
// ============================================================================
// LAN SERVER - serves the game to every device on your network and relays multiplayer traffic.
//
//   node server.js            (port 8080)        node server.js 3000      (custom port)
//   node server.js --open     also opens the game in this computer's browser, ready to host
//                             (what the "Start LAN Game" launchers and the Control Panel button run)
//
// Then open the printed http://192.168.x.x:8080 address on each computer / tablet on the same Wi-Fi.
// The first browser that presses "Host" runs the game; everyone else who joins sends their controls
// and sees the host's world. No npm packages needed: plain Node.js (v14+).
// ============================================================================
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const ARGS = process.argv.slice(2);
const OPEN = ARGS.indexOf("--open") !== -1;
const PORT_ASKED = ARGS.filter(a => /^\d+$/.test(a))[0];
let PORT = Number(PORT_ASKED || process.env.PORT || 8080);
const { spawn } = require("child_process");
const ROOT = __dirname;
const MIME = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml",
    ".json": "application/json", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".ico": "image/x-icon",
    ".md": "text/plain; charset=utf-8", ".woff2": "font/woff2"
};

function lanAddresses() {
    const out = [];
    const ifs = os.networkInterfaces();
    for (const name of Object.keys(ifs)) {
        for (const a of ifs[name] || []) {
            if ((a.family === "IPv4" || a.family === 4) && !a.internal) out.push(a.address);
        }
    }
    return out;
}

// ---------------------------------------------------------------- static files
const server = http.createServer((req, res) => {
    let url = decodeURIComponent((req.url || "/").split("?")[0]);
    if (url === "/lan-info") {
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ port: PORT, addresses: lanAddresses(), hasHost: !!room.host, players: room.clients.size }));
        return;
    }
    if (url === "/") url = "/index.html";
    const file = path.normalize(path.join(ROOT, url));
    if (!file.startsWith(ROOT) || path.basename(file).startsWith(".")) { res.writeHead(403); res.end("Forbidden"); return; }
    fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404); res.end("Not found"); return; }
        res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
        fs.createReadStream(file).pipe(res);
    });
});

// ---------------------------------------------------------------- minimal WebSocket (RFC 6455)
class Socket {
    constructor(sock) {
        this.sock = sock;
        this.buf = Buffer.alloc(0);
        this.frags = [];
        this.open = true;
        this.onmessage = null;
        this.onclose = null;
        sock.setNoDelay(true);
        sock.on("data", (d) => this.feed(d));
        sock.on("close", () => this.closed());
        sock.on("error", () => this.closed());
    }
    feed(d) {
        this.buf = Buffer.concat([this.buf, d]);
        while (this.buf.length >= 2) {
            const b0 = this.buf[0], b1 = this.buf[1];
            const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
            let len = b1 & 0x7f, off = 2;
            if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
            else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
            if (len > 8 * 1024 * 1024) { this.close(); return; }
            const need = off + (masked ? 4 : 0) + len;
            if (this.buf.length < need) return;
            let payload = this.buf.subarray(off + (masked ? 4 : 0), need);
            if (masked) {
                const mask = this.buf.subarray(off, off + 4);
                payload = Buffer.from(payload);
                for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
            }
            this.buf = this.buf.subarray(need);
            if (op === 0x8) { this.close(); return; }
            if (op === 0x9) { this.frame(0xA, payload); continue; }
            if (op === 0xA) continue;
            if (op === 0x1 || op === 0x2 || op === 0x0) {
                this.frags.push(payload);
                if (fin) {
                    const msg = Buffer.concat(this.frags).toString("utf8");
                    this.frags = [];
                    if (this.onmessage) this.onmessage(msg);
                }
            }
        }
    }
    frame(op, payload) {
        if (!this.open) return;
        const len = payload.length;
        let head;
        if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
        else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
        else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
        head[0] = 0x80 | op;
        this.sock.write(Buffer.concat([head, payload]));
    }
    send(text) { this.frame(0x1, Buffer.from(text, "utf8")); }
    // drop snapshots for a client whose connection is backed up instead of letting lag pile up
    get congested() { return this.sock.writableLength > 512 * 1024; }
    close() { if (this.open) { try { this.frame(0x8, Buffer.alloc(0)); } catch (e) {} this.sock.end(); } this.closed(); }
    closed() { if (!this.open) return; this.open = false; if (this.onclose) this.onclose(); }
}

server.on("upgrade", (req, sock) => {
    const key = req.headers["sec-websocket-key"];
    if (!key || (req.url || "").split("?")[0] !== "/lan") { sock.destroy(); return; }
    const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
    attach(new Socket(sock));
});

// ---------------------------------------------------------------- room (one game per server)
const room = { host: null, clients: new Map(), nextPid: 1 };

function sendJSON(ws, obj) { if (ws && ws.open) ws.send(JSON.stringify(obj)); }
function lobby() {
    const players = [...room.clients.values()].map(c => ({ pid: c.pid, name: c.name }));
    for (const c of room.clients.values()) sendJSON(c.ws, { t: "lobby", players, hasHost: !!room.host });
}

function attach(ws) {
    let me = null;    // { role, pid, name, ws }
    ws.onmessage = (raw) => {
        if (!me) {
            let m;
            try { m = JSON.parse(raw); } catch (e) { return; }
            if (m.t !== "hello") return;
            const name = String(m.name || "Player").slice(0, 16);
            if (m.role === "host") {
                if (room.host) { sendJSON(ws, { t: "error", msg: "This LAN game already has a host. Join it instead." }); ws.close(); return; }
                me = { role: "host", pid: 0, name, ws };
                room.host = me;
                sendJSON(ws, { t: "welcome", role: "host", pid: 0, addresses: lanAddresses(), port: PORT });
                for (const c of room.clients.values()) {
                    sendJSON(ws, { t: "join", pid: c.pid, name: c.name });
                    sendJSON(c.ws, { t: "hostup" });
                }
                console.log("[lan] host connected: " + name);
            } else {
                if (room.clients.size >= 15) { sendJSON(ws, { t: "error", msg: "Game is full (16 players)." }); ws.close(); return; }
                me = { role: "client", pid: room.nextPid++, name, ws };
                room.clients.set(me.pid, me);
                sendJSON(ws, { t: "welcome", role: "client", pid: me.pid, hasHost: !!room.host });
                if (room.host) sendJSON(room.host.ws, { t: "join", pid: me.pid, name });
                console.log("[lan] player " + me.pid + " joined: " + name);
            }
            lobby();
            return;
        }
        if (me.role === "host") {
            // host -> everyone (snapshots) or -> one player ("to")
            if (raw.charCodeAt(0) === 123 && raw.startsWith('{"t":"to"')) {
                let m; try { m = JSON.parse(raw); } catch (e) { return; }
                const c = room.clients.get(m.pid);
                if (c) sendJSON(c.ws, m.msg);
                return;
            }
            const isSnap = raw.startsWith('{"t":"snap"');
            for (const c of room.clients.values()) {
                if (isSnap && c.ws.congested) continue;
                c.ws.send(raw);
            }
        } else if (room.host) {
            // client -> host, tagged with the sender's pid (clients can't speak for anyone else)
            room.host.ws.send('{"from":' + me.pid + ',"m":' + raw + "}");
        }
    };
    ws.onclose = () => {
        if (!me) return;
        if (me.role === "host" && room.host === me) {
            room.host = null;
            for (const c of room.clients.values()) sendJSON(c.ws, { t: "hostdown" });
            console.log("[lan] host left");
        } else if (me.role === "client") {
            room.clients.delete(me.pid);
            if (room.host) sendJSON(room.host.ws, { t: "leave", pid: me.pid });
            console.log("[lan] player " + me.pid + " left");
        }
        lobby();
    };
}

// open a page in this computer's default browser (best effort)
function openBrowser(url) {
    try {
        const cmd = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
        const p = spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" });
        p.on("error", () => console.log("  Open " + url + " in your browser."));
        p.unref();
    } catch (e) { console.log("  Open " + url + " in your browser."); }
}

// is the game's own server already on this port? (double-clicking the launcher twice should just reopen it)
function probe(port, cb) {
    const req = http.get({ host: "127.0.0.1", port: port, path: "/lan-info", timeout: 1500 }, res => {
        let body = "";
        res.on("data", d => body += d);
        res.on("end", () => { try { cb(JSON.parse(body).port !== undefined); } catch (e) { cb(false); } });
    });
    req.on("error", () => cb(false));
    req.on("timeout", () => { req.destroy(); cb(false); });
}

let tries = 0;
server.on("error", err => {
    if (err.code !== "EADDRINUSE") { console.error(err); process.exit(1); }
    probe(PORT, isGame => {
        if (isGame) {
            console.log("\n  The game's LAN server is already running on port " + PORT + ".");
            if (OPEN) openBrowser("http://localhost:" + PORT + "/?lan=host");
            setTimeout(() => process.exit(0), 300);
            return;
        }
        if (PORT_ASKED || ++tries > 10) { console.error("\n  Port " + PORT + " is in use by another program. Try: node server.js " + (PORT + 1)); process.exit(1); }
        console.log("  Port " + PORT + " is busy, trying " + (PORT + 1) + "...");
        PORT++;
        server.listen(PORT, "0.0.0.0");
    });
});

server.on("listening", () => {
    const addrs = lanAddresses();
    console.log("\n  Timothy's Zombie Game - LAN server running\n");
    console.log("  On this computer:   http://localhost:" + PORT);
    for (const a of addrs) console.log("  On your network:    http://" + a + ":" + PORT);
    console.log("\n  1. Open the network link on every other device (same Wi-Fi) and press Join.");
    console.log("  2. This computer hosts: press Host in the LAN panel (it opens by itself with --open).");
    console.log("  3. If other devices can't connect, allow Node.js through your firewall.");
    console.log("  Keep this window open while you play; close it (or press Ctrl+C) to stop.\n");
    if (OPEN) openBrowser("http://localhost:" + PORT + "/?lan=host");
});
server.listen(PORT, "0.0.0.0");
