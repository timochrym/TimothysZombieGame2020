// Local, versioned Arcade history. Save during play as well as on exit so a lost run
// still retains its progress. Sandbox games record time without inventing a score.
var ArcadeStats = {
    data: {}, active: null, frames: 0,
    load: function() {
        try { var d = JSON.parse(localStorage.getItem('timsArcadeStatsV1') || '{}'); if (d && typeof d === 'object' && !Array.isArray(d)) this.data = d; } catch (e) {}
    },
    save: function() { try { localStorage.setItem('timsArcadeStatsV1', JSON.stringify(this.data)); } catch (e) {} },
    start: function() { this.save(); this.active = null; this.frames = 0; this.lastTick = null; },
    metric: function(id) {
        if (id === 'survival') return ['score', score];
        if (id === 'sport') return ['goals', Sport.score[0]];
        if (id === 'snake') return ['length', Math.max(snakeSave.best, ...Snake.humans().map(function(w) { return w.len; }), 0)];
        if (id === 'cells') return ['mass', Math.max(cellsSave.best, ...Cells.locals().map(function(p) { return Cells.mass(p); }), 0)];
        if (id === 'mix') return ['best', Math.max(mixSave.best.tank, mixSave.best.blob, mixSave.best.worm, mixSave.best.chain || 0)];
        if (id === 'tanks') return ['XP', Math.max(tanksSave.best, ...Tanks.locals().map(function(k) { return k.score; }), 0)];
        if (id === 'jetpack') return ['meters', Math.max(jetSave.best, ...Jet.runners.map(function(r) { return r.dist; }), 0)];
        if (id === 'platform') return ['score', Plat.score];
        if (id === 'siege') return ['score', Siege.score || 0];
        if (id === 'dummy') return ['damage', Dummy.total || 0];
        if (id === 'words') return ['stars', window.Object.values(wordsSave.best).reduce(function(a, b) { return a + b; }, 0)];
        if (id === 'party') return ['stars', Party.pl[0] ? Party.pl[0].stars : 0];
        if (id === 'bedwars') return ['KOs', redGuy ? redGuy.kills || 0 : 0];
        if (id === 'brawl') return ['KOs', characters[0] ? characters[0].brKOs || 0 : 0];
        if (id === 'property') return ['wealth', Rent.pl[0] ? Rent.worth(Rent.pl[0]) : 0];
        var times = id === 'race' ? raceSave.best : id === 'wheels' ? wheelsSave.best : id === 'puzzle' ? puzzleState.best : id === 'portal' ? portalState.best : null;
        if (times) {
            var key = LevelManager.currentLevelKey + (id === 'wheels' ? ':' + wheelsSave.vehicle : '');
            var time = times[key];
            return time ? [key + ' seconds', time / (id === 'race' || id === 'wheels' ? 60 : 1), true, (LevelManager.getCurrentLevel().title || LevelManager.getCurrentLevel().name || 'Course') + ' · seconds'] : null;
        }
        if (id === 'table') {
            var g = tableCfg.game, value = g === 'flick' ? Flick.score[0] : g === 'hockey' ? Hockey.score[0] : g === 'pool' ? Pool.score[0] : g === 'darts' ? Darts.score[0] : g === 'hunt' ? WordHunt.score[0] : null;
            return value === null ? null : [g + ' points', value];
        }
        return null;
    },
    tick: function() {
        var m = GameModes.current;
        if (!m || (typeof Hub !== 'undefined' && Hub.isOpen)) return;
        var id = m.id, row = this.data[id];
        if (!row || typeof row !== 'object') row = this.data[id] = { plays: 0, seconds: 0, best: {} };
        if (!row.best || typeof row.best !== 'object') row.best = {};
        if (this.active !== id) { this.active = id; row.plays = (Number(row.plays) || 0) + 1; this.save(); }
        var now = performance.now();
        if (this.lastTick) row.seconds = (Number(row.seconds) || 0) + Math.min(0.1, (now - this.lastTick) / 1000);
        this.lastTick = now;
        this.frames++;
        var metric = this.metric(id);
        if (metric && Number.isFinite(metric[1])) {
            var value = Math.round(metric[1] * 100) / 100, prev = Number(row.best[metric[0]]);
            if (metric[3]) { row.labels = row.labels || {}; row.labels[metric[0]] = metric[3]; }
            row.best[metric[0]] = metric[2] ? Math.min(prev > 0 ? prev : Infinity, value) : Math.max(prev || 0, value);
        }
        if (this.frames % 300 === 0) this.save();
    },
    summary: function(id) {
        var r = this.data[id]; if (!r) return 'No plays yet';
        var text = (r.plays || 0) + ' plays · ' + Math.floor((r.seconds || 0) / 60) + 'm';
        var keys = window.Object.keys(r.best || {});
        if (keys.length) { var key = keys[Math.floor(Date.now() / 4000) % keys.length]; text += ' · Best ' + r.best[key] + ' ' + ((r.labels || {})[key] || key); }
        return text;
    }
};
ArcadeStats.load();
window.addEventListener('pagehide', function() { ArcadeStats.save(); });
document.addEventListener('visibilitychange', function() { if (document.hidden) ArcadeStats.save(); });
