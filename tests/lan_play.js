// LAN: starts the game's server on a spare port, then a host and two joiners play Survival together.
// Prints each side's view (positions must match, joiners move on both screens) and any page errors ([] = none).
const { spawn } = require('child_process');
const path = require('path');
global.PORT = 8099;
const srv = spawn(process.execPath, [path.resolve(__dirname, '..', 'server.js'), String(PORT)], { stdio: 'ignore' });
srv.unref();
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
setTimeout(() => require('./lan_core.js'), 1000);
