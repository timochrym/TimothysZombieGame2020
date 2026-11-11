const assert=require('node:assert/strict');const {open}=require('./lib');
(async()=>{const {b,p,errs}=await open();try {
const ids=await p.evaluate(()=>GameModes.list.map(m=>m.id));
for(const id of ids){await p.evaluate(id=>{Hub.close();GameModes.launch(id);},id);await p.waitForTimeout(450);assert.deepEqual(errs,[],id);console.log('OK',id);}
await p.evaluate(()=>{Hub.openHub();ArcadeStats.save();});await p.screenshot({path:'/workspace/scratch/arcade.png'});
const data=await p.evaluate(()=>JSON.parse(localStorage.getItem('timsArcadeStatsV1')));for(const id of ids)assert.ok(data[id]?.plays>=1,id+' stats');
console.log('PASS all modes and saved stats');}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
