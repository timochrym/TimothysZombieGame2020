const assert = require('node:assert/strict');
const { open } = require('./lib');
(async () => {
 const {b,p,errs}=await open('table');
 try {
  await p.evaluate(()=>{tableCfg.vs='p2'; multiplayer=true; Flick.kickoff(1);});
  await p.keyboard.press('Tab'); await p.waitForTimeout(80);
  assert.equal(await p.evaluate(()=>Flick.discs[Flick.sel].t),1);
  await p.keyboard.press('Space',{delay:80});
  assert.equal(await p.evaluate(()=>Flick.phase),'move','P2 shared Space flicks');
  await p.evaluate(()=>Flick.kickoff(1));
  const pt=await p.evaluate(()=>Flick.toScreen(Flick.discs[7].x,Flick.discs[7].y));
  await p.mouse.move(...pt);await p.mouse.down();await p.waitForTimeout(80);
  await p.mouse.move(pt[0]+90,pt[1],{steps:8});await p.mouse.up();await p.waitForTimeout(80);
  assert.equal(await p.evaluate(()=>Flick.phase),'move','P2 mouse drag flicks');
  await p.evaluate(()=>{GameModes.launch('snake'); Snake.worms=Snake.worms.filter(w=>w.human===0);});
  await p.keyboard.down('Space');await p.waitForTimeout(100);
  assert.equal(await p.evaluate(()=>Snake.worms[0].boosting),true);
  await p.keyboard.up('Space');await p.waitForTimeout(100);
  assert.equal(await p.evaluate(()=>Snake.worms[0].boosting),false,'boost releases');
  await p.evaluate(()=>GameModes.launch('sport'));
  assert.equal(await p.evaluate(()=>sportCfg.ball),'classic');
  const sync=await p.evaluate(()=>{
    const mode=GameModes.current; Ball.x=500;Ball.y=350;Sport.score=[2,1];
    const s=JSON.parse(JSON.stringify(mode.netState())); Ball.x=-999; Sport.score=[0,0]; mode.applyNetState(s);
    return [Ball.x,Ball.y,...Sport.score];
  });assert.deepEqual(sync,[500,350,2,1]);
  await p.evaluate(()=>{sportCfg.ball='zombie'; Ball.ensureBody(true);});
  assert.equal(await p.evaluate(()=>{
    let n=0;const draw=Ragdolls.draw;Ragdolls.draw=function(rd){if(rd===Ball.body)n++;};
    Ragdolls.drawCorpses();Ball.draw();Ragdolls.draw=draw;return n;
  }),1,'zombie ball drawn exactly once in front');
  await p.evaluate(()=>{GameModes.launch('survival');SummonManager.pauseWaves=true;zombies.length=0;});
  await p.waitForTimeout(700);
  assert.equal(await p.evaluate(()=>{
    redGuy.x=0;redGuy.y=200;redGuy.yspeed=-15;redGuy.xspeed=0;redGuy.upPressed=false;
    let bounced=false;for(let i=0;i<100;i++){redGuy.move();if(redGuy.yspeed>0.1)bounced=true;}return bounced;
  }),false,'ordinary landing does not bounce');
  const nav=await p.evaluate(()=>{
    const edge={action:'ride',from:0,to:1,boardX:10,boardY:20,exitX:30,exitY:40};
    const w=Pathfinder.waypoint(edge,{x:0,y:0},{id:1,x:30,y:40});
    const z={id:1,x:0,y:80,s1:80,s2:80,onGround:true,navVersion:-1,navNodeId:999,navPath:[{x:NaN}],navBan:{bad:999}};
    Pathfinder.steer(z,{x:1000,y:80,s2:80});
    return {ride:[w.boardX,w.boardY,w.exitX,w.exitY],fresh:z.navVersion===Pathfinder.graphVersion,ban:!!z.navBan.bad};
  });assert.deepEqual(nav,{ride:[10,20,30,40],fresh:true,ban:false});
  assert.deepEqual(errs,[]);console.log('PASS: P2 mouse/keys, boost release, ball sync/render, landing, navigation invalidation/platforms');
 } finally {await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
