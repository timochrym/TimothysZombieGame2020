const assert=require('node:assert/strict');const {open}=require('./lib');
(async()=>{const {b,p,errs}=await open('tanks');try {
assert.equal(await p.evaluate(()=>{arenaCheats.god=true;const k=Tanks.locals()[0];k.inv=0;const hp=k.hp;Tanks.hurt(k,10000,null);return k.hp===hp&&k.alive;}),true);
await p.evaluate(()=>{GAME_TUNABLES.tanks.find(r=>r.label==='Human stat points').set(56);});
assert.equal(await p.evaluate(()=>Tanks.locals()[0].pts),56);
await p.evaluate(()=>GameModes.launch('cells'));
assert.equal(await p.evaluate(()=>{const h=Cells.locals()[0],foe=Cells.players.find(p=>p.human===undefined);Cells.players=[h,foe];Cells.blobs=[{pl:h,x:0,y:0,m:20,vx:0,vy:0,mergeT:0},{pl:foe,x:0,y:0,m:500,vx:0,vy:0,mergeT:0}];Cells.step();return Cells.mine(h).length;}),1);
await p.evaluate(()=>{GameModes.launch('terra');GameModes.current.onMenu('terra_creative');});
const terra=await p.evaluate(()=>{const m=GameModes.current,ch=redGuy;const hp=ch.health;ch.invulnTimer=0;ch.takeDamage(-500);const c=terraCol(ch.x)+3,r=terraRow(ch.y);terraSet(c,r,0);TERRA.sel=0;TERRA.inv[TERRA_PLACEABLE[0]]=0;m.placeAt(ch,terraCX(c),terraCY(r));terraSave(true);return {hp:ch.health===hp,tile:terraGet(c,r),stock:TERRA.inv[TERRA_PLACEABLE[0]],saved:JSON.parse(localStorage.getItem('timsTerraWorld')).creative};});
assert.equal(terra.hp,true);assert.ok(terra.tile>0);assert.equal(terra.stock,0);assert.equal(terra.saved,true);
await p.evaluate(()=>{GameModes.launch('survival');SummonManager.pauseWaves=true;zombies.length=0;});
await p.evaluate(()=>{for(const skin of SKINS){heroSkins[0]=skin.id;redGuy.createCharacter();}heroSkins[0]='npc:KNIGHT';cycleSkin(0,1);});
assert.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('timsZombieGameSkins'))[0].startsWith('npc:')));
await p.evaluate(()=>GameModes.launch('powder'));
const sand=await p.evaluate(()=>{
Powder.grid.fill(P_WALL);Powder.set(10,10,P_ICE);Powder.set(11,10,P_LAVA);Powder.step();const ice=Powder.get(10,10);
Powder.grid.fill(P_WALL);Powder.set(10,10,P_SEED);Powder.set(11,10,P_WATER);Powder.step();const seed=Powder.get(10,10);
Powder.grid.fill(P_WALL);Powder.set(10,10,P_ACID);Powder.set(11,10,P_STONE);for(let i=0;i<400&&Powder.get(10,10)===P_ACID;i++)Powder.step();const acid=Powder.get(10,10);
Powder.palette();return {ice,seed,acid,expected:[P_WATER,P_PLANT],palette:Powder.palRects.length};});
assert.notEqual(sand.ice,11, "ice melts beside lava (the denser lava can then sink into it)");assert.equal(sand.seed,sand.expected[1]);assert.notEqual(sand.acid,12);assert.equal(sand.palette,15);
await p.screenshot({path:'/workspace/scratch/sand.png'});
await p.evaluate(()=>{GameModes.launch('jetpack');jetSave.coins=250;GameModes.current.onMenu('jd_magnet');GameModes.current.onMenu('jd_shield');Jet.reset();});
assert.deepEqual(await p.evaluate(()=>[jetSave.coins,jetSave.magnet,Jet.runners[0].shield]),[0,true,true]);
await p.evaluate(()=>LevelManager.selectLevel('wheels_4'));
const wheels=await p.evaluate(()=>{const g=Gadgets.list.find(g=>g.wheelBreak),rd=Wheels.riders[0],pt=rd.pts[rd.vbase];pt.x=g.x-pt.r-12;pt.px=pt.x-8;pt.y=g.y;pt.py=pt.y;GameModes.current.preUpdate();return {broken:g.broken,fan:Gadgets.list.some(g=>g.type==='fan')};});
assert.deepEqual(wheels,{broken:true,fan:true});
assert.deepEqual(errs,[]);console.log('PASS: arena cheats, creative build/damage/save, roster, sand reactions, Jet shop, stunt gates');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
