import {chromium,type Page} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL??'http://localhost:3112',out='/tmp/jorata-rooftop-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors:string[]=[],bad:string[]=[];
function observe(page:Page){page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(`${r.status()} ${r.url()}`);});}
const page=await browser.newPage({viewport:{width:1440,height:1000}});observe(page);
const state=()=>page.evaluate(()=>{const s=(window as any).__rooftop,r=s.run;return {phase:r.phase,x:r.player.x,y:r.player.y,state:r.player.state,cp:r.checkpointIndex,gap:r.chase.gap(r.player),time:r.elapsed,health:r.health,score:r.score,world:s.world.length,guards:s.guards.length};});
const advance=(ticks:number)=>page.evaluate(n=>{const s=(window as any).__rooftop;s.game.loop.stop();for(let i=0;i<n;i++)s.game.headlessStep(performance.now()+i*1000/120,1000/120);s.game.step(performance.now(),0);},ticks);
try{
 await page.goto(`${base}/games`);await page.getByRole('link',{name:'Start escape',exact:false}).click();await page.getByRole('button',{name:'Start escape →'}).waitFor({timeout:30000});await page.screenshot({path:`${out}/desktop-menu.png`});
 await page.getByRole('button',{name:'Start escape →'}).click();await advance(30);const before=await state();await page.keyboard.down('Space');await advance(20);assert.ok((await state()).y<before.y-40,'keyboard jump changes physical position');await page.keyboard.up('Space');await page.keyboard.press('Escape');assert.equal((await state()).phase,'paused');const x=(await state()).x;await advance(100);assert.equal((await state()).x,x);await page.getByRole('button',{name:'Keep running →'}).click();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await state()).phase,'paused');await page.getByRole('button',{name:'Keep running →'}).click();await page.keyboard.press('r');
 for(let level=0;level<3;level++){
  let complete=false;for(let chunk=0;chunk<55;chunk++){
   const result=await page.evaluate(async()=>{
    const url='/src/rooftop/movement.ts';const {routeInput}=await import(url);const s=(window as any).__rooftop,r=s.run;s.game.loop.stop();
    for(let i=0;i<180&&r.phase==='playing';i++){
     const a=r.player,desired=routeInput(a,r.level);desired.attack=!!r.guards.find((g:any)=>g.hp>0&&g.x>a.x-20&&g.x-a.x<60&&Math.abs(g.y-a.y)<85)&&r.cooldown===0;
     for(const [control,key] of [['jump',' '],['slide','s'],['attack','j']])if(s.inputState[control]!==desired[control])window.dispatchEvent(new KeyboardEvent(desired[control]?'keydown':'keyup',{key,bubbles:true,cancelable:true}));
     s.game.headlessStep(performance.now()+i*1000/120,1000/120);
    }
    s.game.step(performance.now(),0);return {phase:r.phase,reason:r.reason,x:r.player.x,y:r.player.y,time:r.elapsed,cp:r.checkpointIndex,health:r.health,gap:r.chase.gap(r.player),guards:r.guards.map((g:any)=>g.hp)};
   });
   if(chunk===12||chunk===30)await page.screenshot({path:`${out}/level-${level+1}-${chunk}.png`});
   assert.notEqual(result.phase,'failed',JSON.stringify(result));
   if(result.phase==='complete'){assert.equal(result.cp,2);assert.ok(result.guards.every((n:number)=>n===0));assert.ok(result.time>60&&result.time<90);console.log('Browser keyboard playthrough',level+1,result);complete=true;break;}
  }
  assert.ok(complete,`Level ${level+1} completes`);await page.screenshot({path:`${out}/level-${level+1}-complete.png`});
  if(level<2)await page.getByRole('button',{name:'Next rooftop →'}).click();
 }
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('jorata-rooftop-v1')!));assert.equal(stored.unlocked,2);assert.ok(stored.best.every((n:number)=>n>0));
 await page.getByRole('button',{name:'Choose level',exact:true}).click();await page.getByRole('button',{name:'Last Rooftop',exact:false}).click();await advance(4);const initial=await state();
 for(let i=0;i<20;i++){await page.keyboard.press('r');await advance(1);}const retried=await state();assert.equal(retried.world,initial.world);assert.equal(retried.guards,initial.guards);assert.equal(await page.locator('canvas').count(),1);
 await page.getByRole('button',{name:'Mute',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('jorata-rooftop-v1')!).muted),true);
 await page.getByRole('button',{name:'Back to game library'}).click();await page.getByRole('link',{name:'Start escape',exact:false}).click();await page.getByRole('button',{name:'Start escape →'}).waitFor();assert.equal(await page.locator('canvas').count(),1);await page.getByRole('button',{name:'Choose level',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Last Rooftop',exact:false}).isEnabled(),true);
 const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});observe(mobile);await mobile.goto(`${base}/games/rooftop-escape`);await mobile.getByRole('button',{name:'Start escape →'}).waitFor();await mobile.screenshot({path:`${out}/mobile-menu.png`});await mobile.getByRole('button',{name:'Start escape →'}).click();
 await mobile.evaluate(()=>{const s=(window as any).__rooftop;s.game.loop.stop();});
 const jump=mobile.getByRole('button',{name:'Jump, hold for height'}),bounds=(await jump.boundingBox())!;await mobile.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await mobile.mouse.down();
 await mobile.evaluate(()=>{const s=(window as any).__rooftop;for(let i=0;i<20;i++)s.game.headlessStep(performance.now()+i*1000/120,1000/120);s.game.step(performance.now(),0);});
 assert.ok(await mobile.evaluate(()=>(window as any).__rooftop.run.player.y<390),'touch jump works');await mobile.mouse.up();assert.equal(await mobile.evaluate(()=>(window as any).__rooftop.inputState.jump),false);await mobile.screenshot({path:`${out}/mobile-playing.png`});
 await mobile.setViewportSize({width:844,height:390});await mobile.waitForTimeout(150);await mobile.evaluate(()=>{const s=(window as any).__rooftop;s.game.step(performance.now(),0);});await mobile.screenshot({path:`${out}/mobile-landscape.png`});
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);console.log('PASS: all three routes via keyboard events; pause/focus, touch, persistence, 20 retries, navigation, desktop/phone screenshots. No browser errors or failed assets.');
}finally{await browser.close();}
