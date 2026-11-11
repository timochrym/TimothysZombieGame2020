// ============================================================================
// GAME: RENT RUSH  (property)  -  property-trading board game (original, monopoly-style)
//   24 spaces: five colour streets of three, two transit lines, tax, chance and four corners. Roll two dice, buy what
//   you land on, charge rent when others land on yours. Own a whole colour = double rent and you can build houses
//   (up to 3 per street, rent climbs steeply). Doubles roll again. Run out of cash and you sell houses; still short
//   = bankrupt. Last one standing - or the richest after the round limit - wins.
//   Buttons: P1 Space = roll / buy, X = skip, H = build.   P2 Enter = roll / buy, ' = skip, . = build.
//   Mouse: click the on-screen buttons. Gamepads 3-4 join as P3/P4 (A roll/buy, B skip, Y build). The rest are CPUs.
// ============================================================================
var rentCfg = { humans: 1, players: 3, rounds: 20 };
try { var _rc = JSON.parse(localStorage.getItem("timsRentRush") || "null"); if (_rc) for (var _k3 in _rc) rentCfg[_k3] = _rc[_k3]; } catch (e) {}
function saveRent() { try { localStorage.setItem("timsRentRush", JSON.stringify(rentCfg)); } catch (e) {} }
var RENT_PCOL = ["#ef4444", "#3b82f6", "#22c55e", "#facc15"];
var RENT_GROUPS = [
    { col: "#a16207", names: ["Mud Lane", "Puddle Row", "Gravel Way"], price: 60 },
    { col: "#38bdf8", names: ["Kite Street", "Breeze Ave", "Sky Court"], price: 110 },
    { col: "#ec4899", names: ["Candy Lane", "Bubble Rd", "Sherbet Sq"], price: 160 },
    { col: "#f97316", names: ["Ember St", "Lantern Way", "Torch Plaza"], price: 210 },
    { col: "#22c55e", names: ["Emerald Hill", "Jade Park", "Crown Heights"], price: 270 }
];
var RENT_MULT = [1, 4, 9, 16];      // rent multiplier by houses (0-3); a full colour set doubles the base

var Rent = {
    sp: [], pl: [], turn: 0, round: 1, phase: "roll", t: 0, d: [1, 1], pot: 0, msg: "", msgT: 0, log: [], offer: null, doubles: 0, btns: [],

    build: function() {
        var S = [], g = 0, k = 0;
        // layout: corner, 5 sides spaces..., 24 total going clockwise from START
        var order = ["start", "p", "chance", "p", "transit", "p", "detention", "p", "p", "tax", "p", "p", "lounge", "p", "chance", "p", "transit", "p", "gotojail", "p", "p", "chance", "p", "p"];
        var pi = 0;
        for (let i = 0; i < order.length; i++) {
            var t = order[i], s = { k: t, i: i };
            if (t === "p") { var grp = Math.floor(pi / 3); s.g = grp; s.name = RENT_GROUPS[grp].names[pi % 3]; s.price = RENT_GROUPS[grp].price + (pi % 3) * 10; s.rent = Math.round(s.price / 9); s.owner = -1; s.h = 0; pi++; }
            else if (t === "transit") { s.name = ["North Line", "South Line"][k++]; s.price = 150; s.owner = -1; }
            else s.name = { start: "START", chance: "Chance", detention: "Detention", tax: "City Tax", lounge: "Lounge", gotojail: "Go to Detention" }[t];
            S.push(s);
        }
        this.sp = S;
    },
    reset: function() {
        this.build();
        this.pl = [];
        for (let i = 0; i < rentCfg.players; i++) {
            var pad = (typeof Pads !== "undefined") ? Pads.state[i] : null, cpu = i < 2 ? i >= rentCfg.humans : !(pad && pad.active);
            this.pl.push({ i: i, name: cpu ? "CPU " + (i + 1) : "P" + (i + 1), cpu: cpu, pos: 0, cash: 1500, out: false, jail: 0, col: RENT_PCOL[i], hop: 0 });
        }
        this.turn = 0; this.round = 1; this.phase = "roll"; this.t = 0; this.pot = 0; this.log = []; this.offer = null; this.doubles = 0; this.winner = null; this.auction = null; this.trade = null;
        multiplayer = rentCfg.humans > 1;
        this.say(this.pl[0].name + " goes first");
    },
    say: function(m) { this.msg = m; this.msgT = 170; this.log.unshift(m); if (this.log.length > 7) this.log.pop(); },
    owned: function(p) { return this.sp.filter(function(s) { return s.owner === p.i; }); },
    fullSet: function(p, g) { return this.sp.filter(function(s) { return s.g === g; }).every(function(s) { return s.owner === p.i; }); },
    worth: function(p) { var w = p.cash; this.owned(p).forEach(function(s) { w += s.price + (s.h || 0) * Math.round(s.price / 2); }); return w; },
    rentOf: function(s) {
        if (s.k === "transit") { var n = this.sp.filter(function(q) { return q.k === "transit" && q.owner === s.owner; }).length; return 25 * Math.pow(2, n - 1); }
        var base = s.rent * (this.fullSet(this.pl[s.owner], s.g) && !s.h ? 2 : 1);
        return base * RENT_MULT[s.h || 0];
    },
    canBuild: function(p) { var self = this; return this.owned(p).filter(function(s) { return s.k === "p" && s.h < 3 && self.fullSet(p, s.g) && p.cash >= Math.round(s.price / 2); }); },

    // ---------------- input (buttons are edge-triggered)
    // is this seat played at THIS screen? (on a LAN client: the seat with my id)
    mine: function(p) { if (typeof Net !== "undefined" && Net.role === "client") return p.pid === Net.pid; return !p.cpu && !p.pid; },
    keys: function(p) {
        if (p.pid && typeof Net !== "undefined") { var nb = Net.peerButtons(p.pid); return { go: nb.go, no: nb.no, build: nb.build }; }
        var pad = (typeof Pads !== "undefined") ? Pads.state[p.i] : null, pa = pad && pad.active;
        var k = p.i === 0 ? { go: SpacePressed, no: !!Rent.k0no, build: !!Rent.k0b } : (p.i === 1 ? { go: !!PlayerInput[1].kbShoot, no: !!Rent.k1no, build: !!Rent.k1b } : { go: false, no: false, build: false });
        if (pa) { k.go = k.go || pad.up || pad.shoot; k.no = k.no || pad.run; k.build = k.build || pad.interact; }
        if (Rent.click) { k[Rent.click] = true; }
        return k;
    },
    edge: function(p) {
        var k = this.keys(p), pr = p.prev || {}, e = { go: k.go && !pr.go, no: k.no && !pr.no, build: k.build && !pr.build };
        p.prev = k; return e;
    },

    pay: function(p, amt, to) {
        p.cash -= amt; if (to) to.cash += amt;
        if (p.cash < 0) this.raise(p);
        if (p.cash < 0) this.bankrupt(p, to);
    },
    raise: function(p) {
        // sell houses (half price back), priciest first
        var hs = this.owned(p).filter(function(s) { return s.h > 0; }).sort(function(a, b) { return b.price - a.price; });
        for (let i = 0; i < hs.length && p.cash < 0; i++) while (hs[i].h > 0 && p.cash < 0) { hs[i].h--; p.cash += Math.round(hs[i].price / 4); this.say(p.name + " sells a house on " + hs[i].name); }
        // then mortgage streets (half price; you keep them but they earn no rent until bought back at 55%)
        var ms = this.owned(p).filter(function(q) { return !q.mort; }).sort(function(a, b) { return a.price - b.price; });
        for (let i = 0; i < ms.length && p.cash < 0; i++) { ms[i].mort = true; p.cash += Math.round(ms[i].price / 2); this.say("🏦 " + p.name + " mortgages " + ms[i].name); }
    },
    bankrupt: function(p, to) {
        p.out = true;
        this.owned(p).forEach(function(s) { s.owner = -1; s.h = 0; s.mort = false; });
        this.say("💥 " + p.name + " is BANKRUPT" + (to ? " (owes " + to.name + ")" : ""));
        if (typeof SFX !== "undefined") SFX.play("ko");
        var alive = this.pl.filter(function(q) { return !q.out; });
        if (alive.length <= 1) this.end(alive[0]);
    },
    end: function(w) {
        if (!w) w = this.pl.filter(function(q) { return !q.out; }).sort(function(a, b) { return Rent.worth(b) - Rent.worth(a); })[0];
        this.winner = w; this.phase = "over"; this.t = 0;
        showBanner(w.name + " WINS!", "net worth " + this.worth(w), w.col);
        if (typeof SFX !== "undefined") SFX.play("clear");
    },

    move: function(p, n) {
        var from = p.pos;
        p.pos = (p.pos + n) % this.sp.length;
        if (p.pos < from) { p.cash += 200; this.say(p.name + " passes START: +200"); }
        p.hop = 12;
        this.landOn(p);
    },
    landOn: function(p) {
        var s = this.sp[p.pos];
        if (s.k === "p" || s.k === "transit") {
            if (s.owner === -1) { this.offer = s; this.phase = "buy"; this.t = 0; return; }
            if (s.owner !== p.i && !this.pl[s.owner].out && s.mort) this.say(s.name + " is mortgaged — no rent");
            else if (s.owner !== p.i && !this.pl[s.owner].out) { var r = this.rentOf(s); this.say(p.name + " pays " + this.pl[s.owner].name + " $" + r + " rent (" + s.name + ")"); this.pay(p, r, this.pl[s.owner]); if (typeof SFX !== "undefined") SFX.play("coin"); }
        } else if (s.k === "tax") { this.say(p.name + " pays $100 city tax (into the Lounge pot)"); this.pot += 100; this.pay(p, 100, null); }
        else if (s.k === "lounge") { if (this.pot) { this.say(p.name + " collects the Lounge pot: $" + this.pot); p.cash += this.pot; this.pot = 0; } }
        else if (s.k === "gotojail") { this.jail(p); }
        else if (s.k === "chance") this.chance(p);
        // a chance card can move you onto a street (buy offer) and rent can end the game: don't overwrite those
        if (this.phase !== "buy" && this.phase !== "over") { this.phase = "after"; this.t = 0; }
    },
    jail: function(p) { p.pos = 6; p.jail = 1; this.doubles = 0; this.say("🚔 " + p.name + " goes to Detention (misses a turn)"); },
    chance: function(p) {
        var r = Math.random(), self = this;
        if (r < 0.2) { p.cash += 100; this.say("Chance: " + p.name + " wins a baking contest: +$100"); }
        else if (r < 0.35) { this.say("Chance: parking fine, " + p.name + " pays $50"); this.pot += 50; this.pay(p, 50, null); }
        else if (r < 0.5) { this.say("Chance: " + p.name + " takes the express to START"); p.cash += 200; p.pos = 0; }
        else if (r < 0.6) { this.jail(p); }
        else if (r < 0.75) { this.say("Chance: it's " + p.name + "'s birthday — everyone pays $20"); this.pl.forEach(function(q) { if (q !== p && !q.out) self.pay(q, 20, p); }); }
        else if (r < 0.88) { var hs = 0; this.owned(p).forEach(function(s) { hs += s.h || 0; }); this.say("Chance: house repairs, " + p.name + " pays $" + (hs * 25)); if (hs) this.pay(p, hs * 25, null); }
        else { this.say("Chance: " + p.name + " jumps back 3 spaces"); p.pos = (p.pos + this.sp.length - 3) % this.sp.length; this.landOn(p); }
    },

    cpuWantsBuy: function(p, s) {
        var after = p.cash - s.price;
        if (after < 0) return false;
        var completes = s.g !== undefined && this.sp.filter(function(q) { return q.g === s.g && q !== s; }).every(function(q) { return q.owner === p.i; });
        return completes || after > 220 || (s.k === "transit" && after > 120);
    },

    nextTurn: function() {
        var p = this.pl[this.turn];
        if (this.doubles > 0 && !p.out && !p.jail) { this.phase = "roll"; this.t = 0; this.say(p.name + " rolled doubles — roll again!"); return; }
        this.doubles = 0;
        for (let k = 0; k < this.pl.length; k++) {
            this.turn = (this.turn + 1) % this.pl.length;
            if (this.turn === 0) { this.round++; if (this.round > rentCfg.rounds) { this.end(null); return; } }
            if (!this.pl[this.turn].out) break;
        }
        var q = this.pl[this.turn];
        if (q.jail) { q.jail = 0; this.say(q.name + " sits out a turn in Detention"); this.phase = "after"; this.t = 0; return; }
        this.phase = "roll"; this.t = 0;
    },

    update: function() {
        this.t++;
        if (this.msgT > 0) this.msgT--;
        // LAN players take over CPU seats (and give them back when they leave)
        if (typeof Net !== "undefined" && Net.role === "host" && Net.seatPeers(this.pl, function(i) { return "CPU " + (i + 1); })) this.say("LAN seats: " + this.pl.map(function(q) { return q.name; }).join(", "));
        var p = this.pl[this.turn];
        for (let i = 0; i < this.pl.length; i++) if (this.pl[i].hop > 0) this.pl[i].hop--;
        if (this.phase === "over") { var e0 = this.edge(this.pl[0]); if (this.t > 120 && e0.go) this.reset(); this.click = null; return; }
        var e = p.cpu ? null : this.edge(p);
        if (this.phase === "roll") {
            // building happens before the roll
            if (p.cpu) {
                if (this.t === 10 && p.cash > 400 && this.owned(p).some(function(q) { return q.mort; })) this.unmortgage(p);
                if (this.t === 15 && p.cash > 500 && !p.tradedRound && Math.random() < 0.35) { p.tradedRound = this.round; var w = this.tradeWish(p); if (w && this.sp.filter(function(x) { return x.g === w.g && x.owner === p.i; }).length === 2) { this.proposeTrade(p); this.click = null; return; } }
                if (this.t === 20 && p.cash > 450) { var cb = this.canBuild(p); if (cb.length) this.buildOn(p, cb.sort(function(a, b) { return a.h - b.h; })[0]); }
                if (this.t > 45) this.roll(p);
            } else {
                if (this.click === "trade" || (p.i === 0 && Rent.k0t)) { Rent.k0t = false; this.proposeTrade(p); this.click = null; return; }
                if (this.click === "unmort" || (p.i === 0 && Rent.k0m)) { Rent.k0m = false; this.unmortgage(p); }
                if (e.build) { var opts = this.canBuild(p); if (opts.length) this.buildOn(p, opts.sort(function(a, b) { return a.h - b.h || b.price - a.price; })[0]); else this.say("Build: you need a whole colour set and $"); }
                if (e.go) this.roll(p);
            }
        } else if (this.phase === "buy") {
            var s = this.offer, yes = false, no = false;
            if (p.cpu) { if (this.t > 40) { if (this.cpuWantsBuy(p, s)) yes = true; else no = true; } }
            else { yes = e.go; no = e.no; }
            if (yes) { if (p.cash >= s.price) { p.cash -= s.price; s.owner = p.i; this.say(p.name + " buys " + s.name + " for $" + s.price); if (typeof SFX !== "undefined") SFX.play("pickup"); } else this.say("Not enough cash for " + s.name); }
            if (yes) { this.offer = null; this.phase = "after"; this.t = 0; }
            else if (no) { this.say(p.name + " passes on " + s.name); this.offer = null; this.startAuction(s, p); }
        } else if (this.phase === "auction") {
            this.auctionTick();
        } else if (this.phase === "trade") {
            var T = this.trade, owner = this.pl[T.to];
            T.t++;
            if (owner.cpu) { if (T.t > 50) this.finishTrade(this.cpuAcceptsTrade(owner, this.sp[T.sp], T.cash)); }
            else { var eo = this.edge(owner); if (eo.go) this.finishTrade(true); else if (eo.no || T.t > 900) this.finishTrade(false); }
        } else if (this.phase === "after") {
            if (this.t > (p.cpu ? 60 : 50)) this.nextTurn();
        }
        this.click = null;
    },
    roll: function(p) {
        this.d = [1 + ((Math.random() * 6) | 0), 1 + ((Math.random() * 6) | 0)];
        this.doubles = this.d[0] === this.d[1] ? this.doubles + 1 : 0;
        if (this.doubles >= 3) { this.jail(p); this.doubles = 0; this.phase = "after"; this.t = 0; return; }
        this.phase = "moving";
        if (typeof SFX !== "undefined") SFX.play("select");
        this.say(p.name + " rolls " + this.d[0] + " + " + this.d[1]);
        this.move(p, this.d[0] + this.d[1]);
    },
    unmortgage: function(p) {
        var m = this.owned(p).filter(function(q) { return q.mort; }).sort(function(a, b) { return a.price - b.price; })[0];
        if (!m) { this.say("Nothing mortgaged"); return; }
        var c = Math.round(m.price * 0.55);
        if (p.cash < c) { this.say("Need $" + c + " to buy back " + m.name); return; }
        p.cash -= c; m.mort = false; this.say("🏦 " + p.name + " buys back " + m.name + " for $" + c);
    },
    // the street p would most like to buy from someone else: one that completes a colour set, else the one of the
    // colour p owns most of
    tradeWish: function(p) {
        var best = null, bs = -1, self = this;
        this.sp.forEach(function(q) {
            if (q.k !== "p" || q.owner < 0 || q.owner === p.i || self.pl[q.owner].out || q.h) return;
            var grp = self.sp.filter(function(x) { return x.g === q.g; }), mine = grp.filter(function(x) { return x.owner === p.i; }).length;
            var sc = mine * 10 + (mine === grp.length - 1 ? 100 : 0);
            if (sc > bs) { bs = sc; best = q; }
        });
        return bs >= 10 ? best : null;
    },
    proposeTrade: function(p) {
        var q = this.tradeWish(p);
        if (!q) { this.say(p.name + ": nothing worth trading for yet"); return; }
        var offer = Math.min(p.cash - 50, Math.round(q.price * 1.6 / 10) * 10);
        if (offer < q.price) { this.say(p.name + " can't afford a fair offer for " + q.name); return; }
        this.trade = { from: p.i, to: q.owner, sp: this.sp.indexOf(q), cash: offer, t: 0 };
        this.say("🤝 " + p.name + " offers " + this.pl[q.owner].name + " $" + offer + " for " + q.name);
        this.phase = "trade"; this.t = 0;
    },
    cpuAcceptsTrade: function(o, q, cash) {
        var grp = this.sp.filter(function(x) { return x.g === q.g; });
        if (grp.every(function(x) { return x.owner === o.i; })) return false;                 // never break up its own set
        return cash >= q.price * 1.5 || o.cash < 150;
    },
    finishTrade: function(ok) {
        var T = this.trade, q = this.sp[T.sp], a = this.pl[T.from], b = this.pl[T.to];
        if (ok && a.cash >= T.cash) { a.cash -= T.cash; b.cash += T.cash; q.owner = a.i; this.say("🤝 Deal! " + a.name + " now owns " + q.name); if (typeof SFX !== "undefined") SFX.play("pickup"); }
        else this.say(b.name + " turns the offer down");
        this.trade = null; this.phase = "roll"; this.t = 0;
    },
    startAuction: function(s, skipper) {
        this.auction = { sp: this.sp.indexOf(s), price: Math.round(s.price * 0.5 / 10) * 10, lead: -1, t: 0, last: 0, skipper: skipper.i };
        this.phase = "auction"; this.t = 0;
        this.say("🔨 AUCTION: " + s.name + " — press your button to bid +$10");
    },
    auctionTick: function() {
        var A = this.auction, s = this.sp[A.sp], self = this;
        A.t++;
        this.pl.forEach(function(q) {
            if (q.out || q.i === A.lead || q.cash < A.price + 10) return;
            var bid = false;
            if (q.cpu) {
                var val = s.price * (0.85 + ((q.i * 37 + A.sp) % 10) / 25) + (self.sp.filter(function(x) { return x.g === s.g && x.owner === q.i; }).length * s.price * 0.3);
                bid = A.t - A.last > 20 && A.price + 10 <= val && q.cash - (A.price + 10) > 120 && Math.random() < 0.08;
            } else bid = self.edge(q).go;
            if (bid) { A.price += 10; A.lead = q.i; A.last = A.t; }
        });
        if (A.t - A.last > 150 || A.t > 900) {
            if (A.lead >= 0) { var w = this.pl[A.lead]; w.cash -= A.price; s.owner = w.i; this.say("🔨 SOLD to " + w.name + " for $" + A.price); if (typeof SFX !== "undefined") SFX.play("coin"); }
            else this.say("🔨 No bids — " + s.name + " stays with the bank");
            this.auction = null; this.phase = "after"; this.t = 0;
        }
    },
    buildOn: function(p, s) {
        var c = Math.round(s.price / 2);
        if (p.cash < c || s.h >= 3) return;
        p.cash -= c; s.h++;
        this.say("🏠 " + p.name + " builds on " + s.name + " (" + s.h + "/3) for $" + c);
        if (typeof SFX !== "undefined") SFX.play("pickup", 0, 0, 0.6, 0.8);
    },

    // ---------------- drawing
    geo: function() {
        var size = Math.min(cssH - 110, cssW - 420), x0 = 30, y0 = 70;
        return { size: size, x0: x0, y0: y0, cell: size / 7 };
    },
    cellRect: function(i) {
        // 24 spaces on a 7x7 ring: bottom row right->left from START at bottom-right, then up the left, along the top, down the right
        var G = this.geo(), c = G.cell, x, y;
        if (i <= 6) { x = 6 - i; y = 6; } else if (i <= 12) { x = 0; y = 6 - (i - 6); } else if (i <= 18) { x = i - 12; y = 0; } else { x = 6; y = i - 18; }
        return [G.x0 + x * c, G.y0 + y * c, c, c];
    },
    draw: function() {
        ctx.fillStyle = Theme.bg(); ctx.fillRect(0, 0, cssW, cssH);
        var G = this.geo();
        ctx.fillStyle = "#14532d"; ctx.fillRect(G.x0, G.y0, G.size, G.size);
        ctx.fillStyle = "#dcfce7"; ctx.fillRect(G.x0 + G.cell, G.y0 + G.cell, G.size - 2 * G.cell, G.size - 2 * G.cell);
        this.txt("RENT RUSH", G.x0 + G.size / 2, G.y0 + G.size / 2 - 40, Math.max(24, G.cell * 0.55), "#166534", "900");
        for (let i = 0; i < this.sp.length; i++) {
            var s = this.sp[i], r = this.cellRect(i);
            ctx.fillStyle = "#f8fafc"; ctx.fillRect(r[0] + 1, r[1] + 1, r[2] - 2, r[3] - 2);
            if (s.k === "p") { ctx.fillStyle = RENT_GROUPS[s.g].col; ctx.fillRect(r[0] + 1, r[1] + 1, r[2] - 2, r[3] * 0.24); }
            if (s.owner >= 0) { ctx.strokeStyle = this.pl[s.owner].col; ctx.lineWidth = 4; ctx.strokeRect(r[0] + 3, r[1] + 3, r[2] - 6, r[3] - 6); }
            if (s.mort) { ctx.fillStyle = "rgba(100,116,139,0.45)"; ctx.fillRect(r[0] + 1, r[1] + 1, r[2] - 2, r[3] - 2); this.txt("MORTGAGED", r[0] + r[2] / 2, r[1] + r[3] * 0.82, Math.max(7, r[2] * 0.1), "#334155", "900"); }
            var fs = Math.max(8, r[2] * 0.13);
            var label = s.k === "chance" ? "❓ Chance" : (s.k === "transit" ? "🚆 " + s.name : (s.k === "tax" ? "🏛 Tax $100" : s.name));
            var words = label.split(" ");
            this.txt(words.slice(0, 2).join(" "), r[0] + r[2] / 2, r[1] + r[3] * 0.48, fs, "#0f172a", "800");
            if (words.length > 2) this.txt(words.slice(2).join(" "), r[0] + r[2] / 2, r[1] + r[3] * 0.48 + fs + 1, fs, "#0f172a", "800");
            if (s.price) this.txt("$" + s.price, r[0] + r[2] / 2, r[1] + r[3] - 8, fs, "#475569", "700");
            for (let h = 0; h < (s.h || 0); h++) { ctx.fillStyle = "#16a34a"; ctx.fillRect(r[0] + 6 + h * r[2] * 0.22, r[1] + 4, r[2] * 0.18, r[3] * 0.16); }
            if (s.k === "lounge" && this.pot) this.txt("pot $" + this.pot, r[0] + r[2] / 2, r[1] + r[3] - 8, fs, "#16a34a", "900");
        }
        // tokens
        for (let k = 0; k < this.pl.length; k++) {
            var P = this.pl[k];
            if (P.out) continue;
            var cr = this.cellRect(P.pos), off = (k % 2) * cr[2] * 0.3 - cr[2] * 0.15, offy = Math.floor(k / 2) * cr[3] * 0.22, hop = Math.sin(P.hop / 12 * Math.PI) * 10;
            ctx.fillStyle = P.col; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(cr[0] + cr[2] / 2 + off, cr[1] + cr[3] * 0.66 + offy - hop, cr[2] * 0.13, 0, 7); ctx.fill(); ctx.stroke();
        }
        // centre: dice + current action
        var cx = G.x0 + G.size / 2, cy = G.y0 + G.size / 2 + 10, P0 = this.pl[this.turn];
        for (let j = 0; j < 2; j++) { ctx.fillStyle = "#fff"; ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 3; ctx.fillRect(cx - 62 + j * 70, cy - 20, 54, 54); ctx.strokeRect(cx - 62 + j * 70, cy - 20, 54, 54); this.txt(String(this.d[j]), cx - 35 + j * 70, cy + 18, 30, "#0f172a", "900"); }
        this.btns = [];
        // buttons are laid out for a big board; on a small one they shrink around the centre so they stay inside it
        this.bcx = cx; this.bs = Math.min(1, (G.size - 2 * G.cell - 20) / 350);
        var bY = cy + 52;
        if (this.phase === "over") uiText("🏆 " + this.winner.name + " wins! (Space for a new game)", cx, bY + 20, 16, this.winner.col, "center", "900");
        else if (this.mine(P0)) {
            if (this.phase === "roll") {
                this.button("ROLL", "go", cx - 180, bY, P0.col); this.button("BUILD", "build", cx - 60, bY, "#16a34a", !this.canBuild(P0).length);
                this.button("TRADE", "trade", cx + 60, bY, "#0ea5e9", !this.tradeWish(P0));
                if (this.owned(P0).some(function(q) { return q.mort; })) this.button("UNMORTGAGE", "unmort", cx - 60, bY + 42, "#a16207");
            }
            else if (this.phase === "buy") { this.txt("Buy " + this.offer.name + " for $" + this.offer.price + "?", cx, bY - 2, 14, "#0f172a", "900"); this.button("BUY", "go", cx - 120, bY + 8, P0.col, P0.cash < this.offer.price); this.button("SKIP", "no", cx + 10, bY + 8, "#64748b"); }
        } else if (this.phase !== "auction" && this.phase !== "trade") this.txt(P0.name + " is thinking…", cx, bY + 20, 14, "#166534", "900");
        if (this.phase === "auction" && this.auction) {
            var A = this.auction;
            this.txt("🔨 AUCTION: " + this.sp[A.sp].name + " — $" + A.price + (A.lead >= 0 ? " (" + this.pl[A.lead].name + ")" : " (no bids)"), cx, bY + 4, 15, "#0f172a", "900");
            this.txt("press your button (Space / Enter / pad A) to bid +$10", cx, bY + 26, 12, "#166534", "800");
        }
        if (this.phase === "trade" && this.trade) {
            var T2 = this.trade, own = this.pl[T2.to];
            this.txt("🤝 " + this.pl[T2.from].name + " offers $" + T2.cash + " for " + this.sp[T2.sp].name, cx, bY + 4, 14, "#0f172a", "900");
            if (this.mine(own)) { this.button("ACCEPT", "go", cx - 120, bY + 16, "#16a34a"); this.button("DECLINE", "no", cx + 10, bY + 16, "#64748b"); }
            else this.txt(own.name + " is deciding…", cx, bY + 30, 12, "#166534", "800");
        }
        // side panel: players + log
        var sx = G.x0 + G.size + 20, sw = cssW - sx - 16;
        for (let k = 0; k < this.pl.length; k++) {
            var Q = this.pl[k], y = 70 + k * 78;
            uiPanel(sx, y, sw, 70, Q.col, k === this.turn ? 0.98 : 0.75);
            uiText(Q.name + (Q.out ? "  — BANKRUPT" : "") + (Q.jail ? "  🚔" : "") + (k === this.turn && !Q.out ? "  ◀" : ""), sx + 14, y + 24, 15, Q.col, "left", "900");
            uiText("$" + Q.cash + "   ·   worth $" + this.worth(Q) + "   ·   " + this.owned(Q).length + " props", sx + 14, y + 48, 13, "#e2e8f0", "left", "800");
            var dots = this.owned(Q);
            for (let d = 0; d < dots.length; d++) { ctx.fillStyle = dots[d].k === "transit" ? "#94a3b8" : RENT_GROUPS[dots[d].g].col; ctx.fillRect(sx + 14 + d * 12, y + 56, 10, 8); }
        }
        var ly = 70 + this.pl.length * 78 + 6;
        uiPanel(sx, ly, sw, Math.min(cssH - ly - 40, 30 + this.log.length * 20), "#475569", 0.7);
        for (let i = 0; i < this.log.length; i++) uiText(this.log[i], sx + 12, ly + 22 + i * 20, 12, i ? "#94a3b8" : "#f8fafc", "left", i ? "600" : "800");
        uiPanel(14, 10, 300, 48, "#16a34a");
        uiText("RENT RUSH", 28, 36, 20, "#86efac", "left", "900");
        uiText("Round " + Math.min(this.round, rentCfg.rounds) + " / " + rentCfg.rounds + "  ·  whole colour = 2× rent + houses", 28, 52, 11, "#cbd5e1", "left", "800");
        var lanC = typeof Net !== "undefined" && Net.role === "client";
        uiText(lanC ? "Your turn when your name is lit: Space roll / buy · S skip · E build" : ("P1: Space roll/buy/bid · X skip · H build · T trade · M unmortgage" + (multiplayer ? "   P2: Enter roll/buy · ' skip · . build" : "") + "   ·   or click the buttons   ·   LAN players can join   ·   Esc menu"), cssW / 2, cssH - 12, 12, "rgba(220,230,240,0.7)", "center", "700");
    },
    // plain (un-outlined) text for the light board surface
    txt: function(t, x, y, size, col, weight) { ctx.font = (weight || "800") + " " + Math.round(size) + "px " + UI_FONT; ctx.textAlign = "center"; ctx.fillStyle = col; ctx.fillText(t, x, y); },
    button: function(label, act, x, y, col, disabled) {
        var k = this.bs || 1, bw = 110 * k, bh = 36;
        x = this.bcx !== undefined ? this.bcx + (x - this.bcx) * k : x;
        ctx.globalAlpha = disabled ? 0.35 : 1;
        ctx.fillStyle = col; ctx.fillRect(x, y, bw, bh); ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 2; ctx.strokeRect(x, y, bw, bh);
        uiText(label, x + bw / 2, y + 24, Math.max(10, Math.round(15 * Math.min(1, k * 1.1))), "#fff", "center", "900");
        ctx.globalAlpha = 1;
        if (!disabled) this.btns.push([x, y, bw, bh, act]);
    }
};

ModeKit.addLevel("rent_board", { name: "🏠 Rent Rush", mode: "property", wavesEnabled: false, spawnP1: [0, 60], spawnP2: [60, 60], layout: ModeKit.room(-600, 600, 800, {}), title: "Rent Rush" });

GameModes.register({
    id: "property",
    title: "RENT RUSH",
    tagline: "Property board game: buy streets, charge rent, complete colours, build houses, bankrupt your rivals.",
    color: "#16a34a",
    firstLevel: "rent_board",
    flags: { ownScreen: true, waves: false, revive: false, jetpack: false, shooting: false, ability: false, ammo: false, scenery: false, coopToggle: false },
    overTitle: "RENT RUSH",
    seats: function() {
        var C = rentCfg, out = [{ label: "P1", options: ["human"], value: "human", set: function() {} }];
        for (let i = 1; i < 4; i++) (function(i) {
            var v = i >= C.players ? "off" : (i === 1 ? (C.humans > 1 ? "human" : "cpu") : "cpu");
            out.push({ label: "Seat " + (i + 1), options: i === 1 ? ["human", "cpu", "off"] : ["cpu", "off"], value: v, note: i >= 2 ? "a gamepad " + (i + 1) + " makes it human" : (i === 1 ? "Enter / ↑" : ""),
                set: function(nv) {
                    if (nv === "off") { C.players = Math.max(2, i); if (i === 1) C.humans = 1; }
                    else { C.players = Math.max(C.players, i + 1); if (i === 1) C.humans = nv === "human" ? 2 : 1; }
                    saveRent(); Rent.reset();
                } });
        })(i);
        return out;
    },
    setupLevel: function() { Rent.reset(); },
    screenFrame: function() { Rent.update(); Rent.draw(); },
    screenDraw: function() { Rent.draw(); },
    netState: function() {
        return { sp: Rent.sp.map(function(q) { return [q.owner === undefined ? -2 : q.owner, q.h || 0, q.mort ? 1 : 0]; }), au: Rent.auction, tr: Rent.trade, pl: Rent.pl.map(function(q) { return { i: q.i, name: q.name, cpu: q.cpu, pid: q.pid || null, pos: q.pos, cash: q.cash, out: q.out, jail: q.jail, col: q.col, hop: q.hop }; }),
            turn: Rent.turn, round: Rent.round, phase: Rent.phase, d: Rent.d, pot: Rent.pot, log: Rent.log, msg: Rent.msg, msgT: Rent.msgT, offer: Rent.offer ? Rent.sp.indexOf(Rent.offer) : -1, win: Rent.winner ? Rent.winner.i : -1, players: rentCfg.players, rounds: rentCfg.rounds };
    },
    applyNetState: function(m) {
        if (!Rent.sp.length) Rent.build();
        m.sp.forEach(function(a, i) { if (Rent.sp[i] && a[0] !== -2) { Rent.sp[i].owner = a[0]; Rent.sp[i].h = a[1]; Rent.sp[i].mort = !!a[2]; } });
        Rent.auction = m.au; Rent.trade = m.tr;
        Rent.pl = m.pl; Rent.turn = m.turn; Rent.round = m.round; Rent.phase = m.phase; Rent.d = m.d; Rent.pot = m.pot; Rent.log = m.log; Rent.msg = m.msg; Rent.msgT = m.msgT;
        Rent.offer = m.offer >= 0 ? Rent.sp[m.offer] : null; Rent.winner = m.win >= 0 ? Rent.pl[m.win] : null; rentCfg.rounds = m.rounds;
    },
    onClick: function(wx, wy, button) {
        if (button !== 0) return true;
        for (let i = 0; i < Rent.btns.length; i++) { var b = Rent.btns[i]; if (mouseX >= b[0] && mouseX <= b[0] + b[2] && mouseY >= b[1] && mouseY <= b[1] + b[3]) Rent.click = b[4]; }
        mouseDown = false;
        return true;
    },
    onKey: function(code) {
        var flag = function(n) { Rent[n] = true; setTimeout(function() { Rent[n] = false; }, 90); return true; };
        if (code === "KeyX") return flag("k0no");
        if (code === "KeyT") { Rent.k0t = true; return true; }
        if (code === "KeyM") { Rent.k0m = true; return true; }
        if (code === "KeyH") return flag("k0b");
        if (code === "Quote") return flag("k1no");
        if (code === "Period") return flag("k1b");
        return false;
    },
    menuItems: function(items) {
        items.push({ id: "rr_hum", label: "Humans:  ◀  " + rentCfg.humans + "  ▶", hint: "gamepads 3-4 join as P3 / P4; the rest are CPUs", cycle: true });
        items.push({ id: "rr_pl", label: "Players:  ◀  " + rentCfg.players + "  ▶", hint: "", cycle: true });
        items.push({ id: "rr_rounds", label: "Round limit:  ◀  " + rentCfg.rounds + "  ▶", hint: "richest wins at the limit", cycle: true });
        items.push({ id: "rr_new", label: "New game", hint: "" });
    },
    onMenu: function(id, dir) {
        dir = dir || 1;
        if (id === "rr_hum") { rentCfg.humans = rentCfg.humans === 1 ? 2 : 1; saveRent(); return true; }
        if (id === "rr_pl") { rentCfg.players = Math.max(2, Math.max(rentCfg.humans, ((rentCfg.players - 2 + dir + 3) % 3) + 2)); saveRent(); return true; }
        if (id === "rr_rounds") { var R = [10, 20, 30, 50], i = R.indexOf(rentCfg.rounds); rentCfg.rounds = R[(i + dir + R.length) % R.length]; saveRent(); return true; }
        if (id === "rr_new") { closePause(); Rent.reset(); return true; }
        return false;
    },
    onRestart: function() { Rent.reset(); },
    overSub: function() { return "Property board game"; }
});
