import {chromium,type Page} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL??'http://localhost:3107',out='/tmp/jorata-drive-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors:string[]=[],bad:string[]=[];const page=await browser.newPage({viewport:{width:1100,height:700}});
page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('ERROR',m.text())}});page.on('response',r=>{if(r.status()>=400)bad.push(`${r.status()} ${r.url()}`)});
const state=()=>page.evaluate(()=>{const e=(window as any).__drive;return {ready:e.ready,...e.state,chunks:e.chunks?.chunks.size,render:{...e.renderer.info.render},memory:{...e.renderer.info.memory},paused:e.paused,lights:e.lamps.map((l:any)=>l.visible),spin:e.rig?.nodes.spin.map((n:any)=>n.rotation.x),steering:e.rig?.nodes.steer.map((n:any)=>n.rotation.y)};});
const stop=()=>page.evaluate(()=>{const e=(window as any).__drive;cancelAnimationFrame(e.frame);});
const advance=(seconds:number)=>page.evaluate(s=>{const e=(window as any).__drive;for(let i=0;i<s*60;i++)e.advance(1/60);},seconds);
const render=()=>page.evaluate(()=>{const e=(window as any).__drive;e.snap=true;e.tick(performance.now());cancelAnimationFrame(e.frame);});
const shot=async(name:string)=>{await render();if(!process.argv.includes('--screenshots'))return;await page.screenshot({path:`${out}/${name}.png`,timeout:60000});};
const choose=async(label:string,value:string)=>{console.log('Choose',label,value);await page.getByLabel(label,{exact:true}).selectOption(value);await page.waitForFunction(()=>{const e=(window as any).__drive;return e.ready&&!document.querySelector('.drive-message');});};
if(process.argv.includes('--live')){
 try{
  await page.setViewportSize({width:640,height:360});
  await page.addInitScript(()=>localStorage.setItem('jorata-endless-drive',JSON.stringify({quality:'low',autodrive:true})));
  await page.goto(`${base}/games/endless-drive`);await page.waitForFunction(()=>(window as any).__drive?.ready,{timeout:60000});
  const hardware=await page.evaluate(()=>{const e=(window as any).__drive,gl=e.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),cores:navigator.hardwareConcurrency}});
  const samples=[];for(let i=0;i<6;i++){await page.waitForTimeout(30000);const s=await state();samples.push(s);assert.equal(s.chunks,5);assert.ok(s.speed>10);console.log('Live drive',30*(i+1),'seconds',JSON.stringify(s));}
  assert.ok(samples[5].distance>300);assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);await stop();await shot('live-endurance');await writeFile(`${out}/live-results.json`,JSON.stringify({hardware,samples,errors,bad},null,2));console.log('PASS three wall-clock minutes',hardware);
 }finally{await browser.close();}
}else if(process.argv.includes('--focus')){
 try{
  await page.setViewportSize({width:640,height:360});await page.addInitScript(()=>localStorage.setItem('jorata-endless-drive',JSON.stringify({quality:'low'})));
  await page.goto(`${base}/games/endless-drive`);await page.waitForFunction(()=>(window as any).__drive?.ready,{timeout:60000});await stop();
  for(const tag of ['input','textarea','div']){
   await page.evaluate(tag=>{const el=document.createElement(tag);el.id='drive-focus-test';if(tag==='div')el.setAttribute('contenteditable','');document.body.append(el);el.focus();},tag);
   const before=await state();for(const key of ['w','a','s','d','c','r','Escape'])await page.keyboard.press(key);await advance(1);const after=await state();assert.equal(after.z,before.z);assert.equal(after.x,before.x);assert.equal(after.paused,before.paused);await page.evaluate(()=>document.getElementById('drive-focus-test')?.remove());
  }
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);console.log('PASS input, textarea and empty-attribute contenteditable ignore driving shortcuts, including Escape');
 }finally{await browser.close();}
}else{
try{
 await page.addInitScript(()=>{if(!localStorage.getItem('jorata-endless-drive'))localStorage.setItem('jorata-endless-drive',JSON.stringify({quality:'low'}));});
 await page.goto(`${base}/games`);await page.getByRole('link',{name:'Go for a drive',exact:false}).click();await page.waitForFunction(()=>(window as any).__drive?.ready,{timeout:60000});await stop();
 const bounds=await page.locator('.drive').boundingBox();assert.equal(bounds?.height,700);assert.equal(bounds?.width,1100);await shot('highlands');if(process.argv.includes('--screenshots'))await page.screenshot({path:`${out}/cover.png`,style:'.drive > :not(.drive-scene), .drive-companion { visibility:hidden !important; }',timeout:60000});
 await page.locator('.drive-scene').click({position:{x:500,y:250}});const initial=await state();await page.keyboard.down('w');await advance(4);await page.keyboard.up('w');const moving=await state();assert.ok(moving.speed>12&&moving.z<initial.z-20);assert.notEqual(moving.spin[0],initial.spin[0]);
 await page.keyboard.down('a');await advance(.5);await page.keyboard.up('a');const turned=await state();assert.ok(turned.yaw>moving.yaw+.1);assert.ok(turned.steering[0]>.01);await page.keyboard.down(' ');await advance(3);await page.keyboard.up(' ');assert.equal((await state()).speed,0);
 await page.keyboard.down('s');await advance(3);await page.keyboard.up('s');assert.ok((await state()).speed< -3);await page.keyboard.press('r');assert.equal((await state()).speed,0);
 await page.keyboard.press('Escape');assert.ok((await state()).paused);const paused=await state();await advance(2);assert.equal((await state()).z,paused.z);await page.keyboard.press('Escape');assert.equal((await state()).paused,false);
 console.log('PASS foundation: acceleration, steering, supplied wheel rotation and steering pivots, hard brake, reverse, reset, pause');
 // Genuine actual-engine road following and bounded chunk ownership over six simulated minutes.
 await page.getByRole('button',{name:'Autodrive off',exact:true}).click();await page.locator('.drive-scene').click({position:{x:500,y:250}});const samples=[];
 for(let i=0;i<12;i++){await advance(30);await render();const s=await state();assert.equal(s.chunks,5);const lateral=await page.evaluate(()=>{const e=(window as any).__drive;const z=e.state.z;return Math.abs(e.state.x-(18*Math.sin(z/74)+8*Math.sin(z/157))-1.65)});assert.ok(lateral<3,`autodrive error ${lateral}`);samples.push({z:s.z,geometries:s.memory.geometries,textures:s.memory.textures,calls:s.render.calls,triangles:s.render.triangles});}
 assert.ok((await state()).distance>3000);assert.ok(Math.max(...samples.map(s=>s.geometries))-Math.min(...samples.map(s=>s.geometries))<75);console.log('PASS six simulated minutes',samples);await shot('endurance');
 await page.keyboard.down('d');assert.equal(await page.evaluate(()=>(window as any).__drive.settings.autodrive),false);await page.keyboard.up('d');await page.keyboard.press('r');
 await page.getByRole('button',{name:'Drive settings',exact:true}).click();assert.ok((await state()).paused);await shot('settings');console.log('Settings opened');
 const vehicleResults=[];for(const v of ['sedan_modern','sports_coupe','suv_offroad','classic_vintage','pickup_truck','hatchback_compact']){await choose('Vehicle',v);const details=await page.evaluate(()=>{const e=(window as any).__drive;return {vehicle:e.settings.vehicle,wheels:e.rig.nodes.spin.length,steer:e.rig.nodes.steer.length,paint:e.paint.length,y:e.vehicle.position.y}});assert.equal(details.vehicle,v);assert.equal(details.wheels,4);assert.equal(details.steer,2);assert.ok(details.paint>0);vehicleResults.push(details);}
 await page.getByRole('button',{name:'Dark red',exact:true}).click();assert.equal(await page.evaluate(()=>(window as any).__drive.settings.paint),'dark_red');
 for(const environment of ['alpine','coastal','green_highlands']){await choose('Environment',environment);await page.getByRole('button',{name:'Close drive settings',exact:true}).click();await advance(1);await shot(environment);await page.getByRole('button',{name:'Drive settings',exact:true}).click();}
 for(const camera of ['chase','close','cockpit','cinematic','free_look']){await choose('Camera',camera);await page.getByRole('button',{name:'Close drive settings',exact:true}).click();await shot(`camera-${camera}`);await page.getByRole('button',{name:'Drive settings',exact:true}).click();}
 for(const weather of ['clear','cloudy','foggy','light_rain','heavy_rain','snow']){await choose('Weather',weather);await render();const count=await page.evaluate(()=>{const e=(window as any).__drive;return e.precipitation?.mesh.geometry.attributes.position.count??0});assert.ok(count<=400);if(weather.includes('rain')||weather==='snow')assert.ok(count>0);}
 for(const time of ['clear_morning','sunny_afternoon','golden_sunset','overcast_afternoon','blue_hour','moonlit_night']){await choose('Time of day',time);await render();}assert.ok((await state()).lights.every((v:boolean)=>v));await page.getByRole('button',{name:'Close drive settings',exact:true}).click();await shot('night-snow');await page.getByRole('button',{name:'Drive settings',exact:true}).click();
 for(const quality of ['medium','high','low']){await choose('Graphics',quality);assert.equal((await state()).chunks,quality==='low'?5:quality==='medium'?7:9);}
 await choose('Weather','clear');await choose('Time of day','clear_morning');await choose('Camera','chase');await page.getByRole('button',{name:'Close drive settings',exact:true}).click();
 await page.getByRole('button',{name:'Open driving companion'}).click();const robot=await page.locator('.drive-companion').evaluate(el=>({position:getComputedStyle(el).position,parent:el.parentElement?.tagName}));assert.deepEqual(robot,{position:'fixed',parent:'BODY'});assert.ok((await state()).paused);await page.keyboard.press('Escape');assert.equal((await state()).paused,false);
 await page.keyboard.down('w');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.ok((await state()).paused);await page.keyboard.up('w');await page.getByRole('button',{name:'Resume drive',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await shot('narrow');assert.ok(await page.getByRole('button',{name:'Accelerate',exact:true}).isVisible());await page.getByRole('button',{name:'Drive settings',exact:true}).click();await shot('narrow-settings');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Back to Jorata games',exact:true}).click();assert.equal(await page.locator('.drive-companion').count(),0);assert.equal(await page.locator('canvas').count(),0);await page.getByRole('link',{name:'Go for a drive',exact:false}).click();await page.waitForFunction(()=>(window as any).__drive?.ready,{timeout:60000});await stop();assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.locator('.drive-companion').count(),1);assert.equal(await page.evaluate(()=>(window as any).__drive.settings.paint),'dark_red');
 await page.getByRole('button',{name:'Back to Jorata games',exact:true}).click();await page.getByRole('link',{name:'Play Surgery',exact:false}).click();await page.getByText('Surgery Simulator',{exact:true}).first().waitFor();await page.goto(`${base}/notes`);await page.waitForSelector('.jn-workspace');await page.goto(`${base}/play`);await page.waitForSelector('canvas');
 console.log('vehicles',vehicleResults);console.log('errors',errors,'bad requests',bad);assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);await writeFile(`${out}/results.json`,JSON.stringify({samples,vehicleResults,errors,bad},null,2));console.log('PASS all vehicles, environments, cameras, weather, time, quality, portal companion, focus pause, persistence, cleanup, narrow layout and existing feature smoke checks');
}finally{await browser.close();}

}
