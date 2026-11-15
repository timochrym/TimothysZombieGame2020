// Deterministic bubble-worm controls, mass accounting, and eating regression.
const assert = require('node:assert/strict');
const { open } = require('./lib');
(async () => {
    const { b, p, errs } = await open('mix');
    try {
        await p.evaluate(() => {
            paused = true;
            Mix.setBody('chain');
            const pl = Mix.me().ref;
            Cells.players = [pl]; Cells.blobs = Cells.mine(pl);
            Cells.pellets = []; Cells.pickups = []; Cells.viruses = [];
            cellsCfg.bots = 0; cellsCfg.food = 0; cellsCfg.decay = 0; cellsCfg.powerups = false;
            const head = Cells.blobs[0];
            head.x = head.y = 0; head.m = 200; head.vx = head.vy = 0;
            for (let i = 0; i < 180; i++) { Cells.t++; Cells.chainStep(pl); }
            window.testChain = pl;
            Cells.cam.x = Cells.cam.y = 0; Cells.cam.z = 1;
            mouseX = cssW; mouseY = cssH / 2;
        });
        await p.evaluate(() => { WASDupPressed = true; });
        const compact = await p.evaluate(() => {
            Cells.step();
            const pl = window.testChain, head = pl.chainList[0];
            const x = head.x, y = head.y;
            for (let i = 0; i < 20; i++) Cells.step();
            return { compact: pl.compact, count: Cells.mine(pl).length, mass: Cells.mass(pl), stopped: head.x === x && head.y === y };
        });
        assert.equal(compact.compact, true); assert.equal(compact.count, 1);
        assert.ok(Math.abs(compact.mass - 200) < 1e-8); assert.ok(compact.stopped);
        await p.evaluate(() => { WASDupPressed = false; });
        await p.evaluate(() => Cells.step());
        await p.evaluate(() => { SpacePressed = true; });
        const moving = await p.evaluate(() => {
            const pl = window.testChain, head = pl.chainList[0], x = head.x;
            for (let i = 0; i < 60; i++) Cells.step();
            return { moved: head.x !== x, mass: Cells.mass(pl), dropped: Cells.pellets.reduce((sum, q) => sum + q.m, 0), count: Cells.mine(pl).length };
        });
        assert.ok(moving.moved); assert.ok(moving.mass < 200); assert.equal(moving.count, 1);
        assert.ok(Math.abs(moving.mass + moving.dropped - 200) < 1e-8);
        await p.evaluate(() => { SpacePressed = false; });
        assert.ok(await p.evaluate(() => {
            const head = window.testChain.chainList[0], x = head.x, y = head.y;
            Cells.step(); return head.x === x && head.y === y;
        }));
        assert.ok(await p.evaluate(() => {
            const pl = window.testChain, head = pl.chainList[0], mass = head.m;
            const prey = Cells.addPlayer({ name: 'Prey', color: '#fff' });
            const food = Cells.mine(prey)[0];
            food.x = head.x; food.y = head.y; food.m = 40; prey.fx.shield = 0;
            Cells.step();
            return !prey.alive && Math.abs(head.m - mass - 40) < 1e-8;
        }));
        await p.evaluate(() => { WASDupPressed = true; });
        assert.ok(await p.evaluate(() => {
            Cells.step();
            for (let i = 0; i < 180; i++) Cells.step();
            return !window.testChain.compact && window.testChain.chainList.length > 1;
        }));
        await p.evaluate(() => { WASDupPressed = false; });
        assert.ok(await p.evaluate(() => {
            const pl = window.testChain;
            pl.compact = true; pl.chainMoving = true; Cells.spawn(pl);
            return !pl.compact && !pl.chainMoving;
        }));
        assert.match(await p.locator('canvas').first().evaluate(el => getComputedStyle(el).cursor), /cursor.svg.*24 24/);
        assert.deepEqual(errs, []);
        console.log('PASS: combine, stop, held movement, mass drops, eating, return to chain, respawn, cursor');
    } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
