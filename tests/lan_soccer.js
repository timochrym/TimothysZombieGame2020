const assert=require('node:assert/strict');const {chromium}=require('playwright');const {spawn}=require('node:child_process');const path=require('node:path');
(async()=>{const server=spawn(process.execPath,[path.resolve(__dirname,'../server.js'),'8101'],{stdio:'ignore'});let b;try{
await new Promise(r=>setTimeout(r,600));b=await chromium.launch();const h=await b.newPage(),c=await b.newPage(),errs=[];
for(const p of [h,c]){p.on('pageerror',e=>errs.push(e.message));await p.addInitScript(()=>{const O=Object;window.addEventListener('load',()=>{for(const k of ['is','keys','entries','getPrototypeOf','values','assign'])Object[k]=O[k];});});await p.goto('http://localhost:8101/');}
await h.evaluate(()=>{Hub.close();GameModes.launch('sport');Net.connect('host','Host');});await h.waitForTimeout(400);await c.evaluate(()=>Net.connect('client','Guest'));
await c.waitForFunction(()=>Net.inGame&&GameModes.current.id==='sport');
for(const style of ['classic','zombie']){
await h.evaluate(style=>{sportCfg.ball=style;Sport.phase='over';Ball.x=700;Ball.y=500;Ball.vx=Ball.vy=0;Ball.ensureBody(true);Ball.syncBody();Sport.score=[2,1];},style);
await c.waitForFunction(style=>sportCfg.ball===style&&Ball.x===700&&Ball.y===500&&Sport.score[0]===2,style);
if(style==='zombie')assert.equal(await c.evaluate(()=>!!Ball.body&&Ragdolls.list.includes(Ball.body)),true);
}
await h.evaluate(()=>{GameModes.launch('table');Flick.turn=1;});await c.waitForFunction(()=>GameModes.current.id==='table'&&Flick.turn===1);
await c.keyboard.press('Space',{delay:200});await h.waitForFunction(()=>Flick.phase==='move');
assert.deepEqual(errs,[]);console.log('PASS: two-browser LAN soccer ball styles/score and guest Flick turn');
}finally{if(b)await b.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
