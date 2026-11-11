// ============================================================================
// GAME FEEL: settings, synthesized sound effects (WebAudio - no audio files), hit-stop & slow-motion
// ============================================================================

// ---- Persisted player settings (Pause menu -> Settings) ----
var settings = { volume: 0.6, shake: 1, hitStop: true, hiDPI: true, glow: true, squareChars: false, view3d: false, heroSpeed: "normal", fx: "calm", ricochet: 0, charDetail: true, theme: "night", bright: 1 };
try {
    var savedSettings = JSON.parse(localStorage.getItem("timsZombieGameSettings") || "null");
    if (savedSettings) {
        if (typeof savedSettings.volume === "number") settings.volume = Math.max(0, Math.min(1, savedSettings.volume));
        if (typeof savedSettings.shake === "number") settings.shake = Math.max(0, Math.min(1, savedSettings.shake));
        if (typeof savedSettings.hitStop === "boolean") settings.hitStop = savedSettings.hitStop;
        if (typeof savedSettings.hiDPI === "boolean") settings.hiDPI = savedSettings.hiDPI;
        if (typeof savedSettings.glow === "boolean") settings.glow = savedSettings.glow;
        if (typeof savedSettings.squareChars === "boolean") settings.squareChars = savedSettings.squareChars;
        if (typeof savedSettings.view3d === "boolean") settings.view3d = savedSettings.view3d;
        if (["normal", "fast", "turbo"].indexOf(savedSettings.heroSpeed) !== -1) settings.heroSpeed = savedSettings.heroSpeed;
        if (savedSettings.fx === "full" || savedSettings.fx === "calm") settings.fx = savedSettings.fx;
        if (typeof savedSettings.charDetail === "boolean") settings.charDetail = savedSettings.charDetail;
        if (typeof savedSettings.theme === "string") settings.theme = savedSettings.theme;
        if (typeof savedSettings.bright === "number") settings.bright = savedSettings.bright;
        if (typeof savedSettings.ricochet === "number") settings.ricochet = Math.max(0, Math.min(3, savedSettings.ricochet));
    }
} catch (e) {}

function saveSettings() {
    try { localStorage.setItem("timsZombieGameSettings", JSON.stringify(settings)); } catch (e) {}
}

// ---- Hit-stop (freeze a few frames on big impacts) and slow motion ----
var hitStopFrames = 0;
var slowMoFrames = 0;
var slowMoScale = 1;

var Juice = {
    hitStop: function(n) {
        if (!settings.hitStop) return;
        hitStopFrames = Math.max(hitStopFrames, Math.min(12, n));
    },
    slowMo: function(frames, scale) {
        slowMoFrames = Math.max(slowMoFrames, frames);
        slowMoScale = scale;
    },
    comic: function(x, y) {
        var words = ["POW!", "BONK!", "WHAM!", "KAPOW!", "BOOF!", "OOF!", "SPLAT!", "THWACK!"];
        Components.addFloatingText(words[Math.floor(Math.random() * words.length)], x, y, "#ffd23f", 22);
    }
};

// ---- Sound effects ----
var SFX = {
    ctx: null,
    master: null,
    noiseBuf: null,
    lastPlayed: {},
    voices: 0,
    minGap: { shoot: 45, enemyShoot: 70, hit: 35, bonk: 60, splat: 80, coin: 40, jump: 60, hurt: 120, explode: 70, kill: 60, boing: 90, ui: 40 },

    unlock: function() {
        try {
            if (!this.ctx) {
                var AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                this.ctx = new AC();
                var comp = this.ctx.createDynamicsCompressor();
                comp.threshold.value = -14;
                comp.ratio.value = 6;
                this.master = this.ctx.createGain();
                this.master.gain.value = settings.volume;
                this.master.connect(comp);
                comp.connect(this.ctx.destination);
                var len = this.ctx.sampleRate;
                this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
                var d = this.noiseBuf.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            }
            if (this.ctx.state === "suspended") this.ctx.resume();
        } catch (e) {}
    },

    setVolume: function(v) {
        settings.volume = Math.max(0, Math.min(1, v));
        if (this.master) this.master.gain.value = settings.volume;
        saveSettings();
    },

    // ---------- synth building blocks ----------
    out: function(pan, vol) {
        var g = this.ctx.createGain();
        g.gain.value = vol;
        if (this.ctx.createStereoPanner) {
            var p = this.ctx.createStereoPanner();
            p.pan.value = pan;
            g.connect(p);
            p.connect(this.master);
        } else g.connect(this.master);
        return g;
    },

    tone: function(f0, f1, dur, type, vol, pan, delay) {
        var c = this.ctx, t = c.currentTime + (delay || 0);
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = type || "sine";
        o.frequency.setValueAtTime(Math.max(20, f0), t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(1, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(this.out(pan, vol));
        o.start(t);
        o.stop(t + dur + 0.02);
        this.track(dur + delay);
    },

    noise: function(dur, vol, f0, f1, ftype, pan, delay, q) {
        var c = this.ctx, t = c.currentTime + (delay || 0);
        var src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        var f = c.createBiquadFilter();
        f.type = ftype || "lowpass";
        f.Q.value = q || 0.8;
        f.frequency.setValueAtTime(f0, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        var g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(1, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.out(pan, vol));
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.02);
        this.track(dur + delay);
    },

    track: function(sec) {
        var self = this;
        this.voices++;
        setTimeout(function() { self.voices = Math.max(0, self.voices - 1); }, (sec || 0.2) * 1000 + 30);
    },

    // ---------- public ----------
    play: function(name, x, y, v, pitch) {
        if (!this.ctx || settings.volume <= 0 || this.ctx.state !== "running") return;
        if (this.voices > 28) return;
        var now = performance.now();
        var gap = this.minGap[name] || 30;
        if (this.lastPlayed[name] && now - this.lastPlayed[name] < gap) return;
        this.lastPlayed[name] = now;
        v = (v === undefined) ? 1 : v;
        pitch = pitch || 1;
        var pan = 0, att = 1;
        if (typeof x === "number" && typeof cameraScaleX !== "undefined") {
            var sx = x * cameraScaleX + xc;
            pan = Math.max(-1, Math.min(1, (sx - cssW / 2) / (cssW / 2))) * 0.6;
            var off = Math.max(0, Math.abs(sx - cssW / 2) - cssW / 2) / cssW;
            att = Math.max(0.12, 1 - off * 1.6);
        }
        var vol = v * att;
        try { this.recipe(name, pan, vol, pitch); } catch (e) {}
    },

    recipe: function(n, pan, vol, p) {
        switch (n) {
            case "shoot": this.tone(920 * p, 420 * p, 0.07, "square", 0.09 * vol, pan); this.noise(0.04, 0.05 * vol, 4000, 1500, "bandpass", pan); break;
            case "spit": this.tone(260, 140, 0.12, "sawtooth", 0.08 * vol, pan); this.noise(0.08, 0.08 * vol, 900, 300, "lowpass", pan); break;
            case "enemyShoot": this.tone(340, 190, 0.11, "sawtooth", 0.06 * vol, pan); break;
            case "hit": this.noise(0.06, 0.2 * vol, 2600, 700, "bandpass", pan, 0, 1.2); this.tone(220, 120, 0.06, "triangle", 0.12 * vol, pan); break;
            case "hurt": this.tone(340, 90, 0.22, "sawtooth", 0.13 * vol, pan); this.noise(0.1, 0.12 * vol, 1200, 300, "lowpass", pan); break;
            case "kill": this.noise(0.16, 0.22 * vol, 1100, 160, "lowpass", pan); this.tone(160, 55, 0.18, "square", 0.08 * vol, pan); break;
            case "explode": this.noise(0.75, 0.55 * vol, 1400, 60, "lowpass", pan); this.tone(95, 32, 0.6, "sine", 0.5 * vol, pan); break;
            case "shockwave": this.tone(180, 50, 0.35, "sine", 0.45 * vol, pan); this.noise(0.3, 0.25 * vol, 2500, 200, "bandpass", pan); break;
            case "jump": this.tone(300 * p, 640 * p, 0.1, "triangle", 0.1 * vol, pan); break;
            case "dash": this.noise(0.17, 0.2 * vol, 3500, 700, "bandpass", pan, 0, 1.5); break;
            case "bonk": this.tone(190, 85, 0.09, "sine", 0.32 * vol, pan); this.noise(0.04, 0.16 * vol, 900, 400, "bandpass", pan); break;
            case "splat": this.noise(0.12, 0.25 * vol, 600, 120, "lowpass", pan); this.tone(120, 60, 0.12, "sine", 0.2 * vol, pan); break;
            case "boing": this.tone(180, 520, 0.09, "sine", 0.22 * vol, pan); this.tone(520, 240, 0.22, "sine", 0.16 * vol, pan, 0.09); break;
            case "pickup": [660, 880, 1320].forEach(function(f, i) { SFX.tone(f, f * 1.01, 0.08, "square", 0.07 * vol, pan, i * 0.055); }); break;
            case "coin": this.tone(988, 988, 0.05, "square", 0.06 * vol, pan); this.tone(1318, 1318, 0.12, "square", 0.06 * vol, pan, 0.05); break;
            case "reload": this.noise(0.025, 0.2 * vol, 5000, 3000, "highpass", pan); this.noise(0.03, 0.22 * vol, 4000, 2500, "highpass", pan, 0.13); break;
            case "empty": this.tone(1300, 1250, 0.03, "square", 0.05 * vol, pan); break;
            case "revive": [523, 659, 784, 1046].forEach(function(f, i) { SFX.tone(f, f, 0.14, "triangle", 0.1 * vol, pan, i * 0.07); }); break;
            case "levelup": [523, 784, 1046, 1568].forEach(function(f, i) { SFX.tone(f, f, 0.12, "square", 0.07 * vol, pan, i * 0.06); }); break;
            case "wave": [392, 523, 659].forEach(function(f, i) { SFX.tone(f, f, 0.2, "triangle", 0.12 * vol, pan, i * 0.11); }); break;
            case "freeze": this.tone(1800, 700, 0.35, "sine", 0.12 * vol, pan); this.noise(0.3, 0.08 * vol, 6000, 3000, "highpass", pan); break;
            case "ko": this.noise(0.9, 0.5 * vol, 2000, 80, "lowpass", pan); this.tone(880, 110, 0.8, "sawtooth", 0.14 * vol, pan); break;
            case "beep": this.tone(660, 660, 0.12, "square", 0.08 * vol, pan); break;
            case "go": this.tone(990, 990, 0.3, "square", 0.1 * vol, pan); break;
            case "ui": this.tone(620, 620, 0.04, "square", 0.05 * vol, pan); break;
            case "select": this.tone(740, 990, 0.08, "square", 0.06 * vol, pan); break;
            case "grab": this.tone(240, 160, 0.08, "triangle", 0.15 * vol, pan); break;
            case "portal": this.tone(300 * p, 1100 * p, 0.18, "sine", 0.14 * vol, pan); this.noise(0.18, 0.08 * vol, 3000, 800, "bandpass", pan); break;
            case "warp": this.tone(900, 220, 0.2, "triangle", 0.12 * vol, pan); this.noise(0.15, 0.1 * vol, 6000, 1500, "highpass", pan); break;
            case "fizzle": this.noise(0.25, 0.14 * vol, 5000, 900, "bandpass", pan, 0, 2); break;
            case "kick": this.tone(140, 70, 0.08, "sine", 0.35 * vol, pan); this.noise(0.05, 0.2 * vol, 1500, 500, "bandpass", pan); break;
            case "whistle": this.tone(2100, 2100, 0.12, "sine", 0.09 * vol, pan); this.tone(2100, 2100, 0.3, "sine", 0.09 * vol, pan, 0.16); break;
            case "goal": this.noise(1.2, 0.35 * vol, 800, 2600, "bandpass", pan, 0, 0.6); [523, 659, 784, 1046, 1318].forEach(function(f, i) { SFX.tone(f, f, 0.18, "square", 0.08 * vol, pan, i * 0.08); }); break;
            case "sling": this.tone(120, 420, 0.25, "sawtooth", 0.08 * vol, pan); break;
            case "clear": [523, 659, 784, 1046, 784, 1046].forEach(function(f, i) { SFX.tone(f, f, 0.14, "square", 0.08 * vol, pan, i * 0.09); }); break;
        }
    }
};

// ---- Glow switch: canvas shadowBlur is very expensive; when "Glow effects" is off (or auto-disabled
// because the game is running slowly) every shadowBlur assignment in the codebase becomes a no-op.
var glowAutoDisabled = false;
function installGlowSwitch(context) {
    try {
        var proto = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
        var desc = proto && window.Object.getOwnPropertyDescriptor(proto, "shadowBlur");
        if (!desc || !desc.set) return;
        window.Object.defineProperty(context, "shadowBlur", {
            configurable: true,
            get: function() { return desc.get.call(context); },
            set: function(v) { desc.set.call(context, (settings.glow && !glowAutoDisabled) ? v : 0); }
        });
    } catch (e) {}
}
