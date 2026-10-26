import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {cases,toolById,type ToolId} from '../src/surgery/data';
const base=process.env.TEST_BASE_URL??'http://localhost:3107';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir('artifacts/surgery',{recursive:true});
const select=async(id:ToolId)=>page.getByRole('button',{name:`Select ${toolById(id).name}`,exact:true}).click();
const apply=async(id:ToolId)=>{await select(id);await page.getByRole('button',{name:`Apply ${toolById(id).name} to patient`,exact:true}).click();};
const progress=async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('jorata.surgery.progress.v1')??'null'));
const start=async(name:string)=>{await page.getByRole('button',{name:/Select Disease/}).click();await page.getByLabel('Search disease',{exact:true}).fill(name);await page.getByRole('button',{name:new RegExp(`^${name}`)}).click();await page.getByRole('button',{name:`Start ${name}`,exact:true}).click();};
const follow=async()=>{for(let i=0;i<160;i++){
 if(await page.getByRole('heading',{name:'Surgery successful',exact:true}).count())return;
 if(await page.getByRole('heading',{name:'Game Over',exact:true}).count())throw new Error('Patient lost following objectives');
 const objective=await page.locator('.s-objective [role=status]').innerText();
 const ids:Record<string,ToolId>={'Scan':'ultrasound','Identify':'lab','Restore the critical':'defibrillator','Restore the weak':'transfusion','Lower the fever':'antibiotics','Stabilize one fracture':'splint','Clean the operation':'antiseptic','Put the patient':'anesthetic','Open incision':'scalpel','Stop incision':'clamp','Clear pooled':'sponge','Secure one':'pins','Repair the underlying':'fix','Close one':'stitches','Confirm recovery':'ultrasound'};
 let id:ToolId|undefined;for(const t of ['defibrillator','transfusion','clamp','sponge','lab','antibiotics','anesthetic'] as ToolId[])if(objective.startsWith(toolById(t).name+':'))id=t;
 if(!id)for(const [text,tool] of Object.entries(ids))if(objective.startsWith(text))id=tool;
 if(!id)throw new Error('Unknown objective: '+objective);await apply(id);
 }throw new Error('Too many turns');};
try{
 await page.goto(base);await page.getByRole('link',{name:'Games',exact:true}).click();await page.getByRole('link',{name:/^Play Surgery/}).click();await expect(page.getByRole('heading',{name:'Surgery Simulator',exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/surgery/selection-desktop.png',fullPage:true});
 await page.getByLabel('Body category',{exact:true}).selectOption('Heart');await expect(page.locator('.s-case-list>button')).toHaveCount(2);await page.getByLabel('Body category',{exact:true}).selectOption('All categories');
 await start('Broken Arm');
 // Uploaded art is wired to functional tool IDs, with honest missing-art fallbacks.
 const uploaded:Record<string,string>={ultrasound:'ultrasound',anesthetic:'anesthetic',antiseptic:'antiseptic',scalpel:'scalpel',stitches:'suture',clamp:'clamp',sponge:'gauze',antibiotics:'antibiotic',transfusion:'blood_transfusion',defibrillator:'defibrillator'};
 for(const [id,file] of Object.entries(uploaded)){
  const icon=page.locator(`.s-tool-grid [data-tool="${id}"] img`);
  await expect(icon).toHaveAttribute('src',`/surgery/tools/${file}.png`);
  await expect.poll(()=>icon.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(256);
 }
 await expect(page.locator('.s-tool-grid [data-fallback=true]')).toHaveCount(4);
 // Native drag-and-drop: selected tool is applied exactly once.
 await page.getByRole('button',{name:'Select Ultrasound',exact:true}).dragTo(page.locator('.s-apply-zone'));await expect(page.locator('.s-objective [role=status]')).toHaveText('Stabilize one fracture.');await expect(page.locator('.s-apply-hint img')).toHaveAttribute('src','/surgery/tools/ultrasound.png');
 await page.screenshot({path:'artifacts/surgery/operating-desktop.png',fullPage:true});
 const patientBounds=await page.locator('.s-patient').boundingBox();
 await page.getByRole('button',{name:'Guidebook',exact:false}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').locator('.s-recipes summary').filter({hasText:'Broken Arm'})).toBeVisible();
 await page.getByRole('tab',{name:'Surgical Tools',exact:true}).click();await expect(page.locator('.s-encyclopedia article')).toHaveCount(14);await page.getByRole('tab',{name:'How to Play',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await follow();expect((await progress()).completed).toBe(1);expect((await progress()).skill).toBe(3);
 const after=await page.locator('.s-patient').boundingBox();expect(after?.width).toBe(patientBounds?.width);expect(after?.height).toBe(patientBounds?.height);
 await start('Chaos Infection');await follow();expect((await progress()).completed).toBe(2);
 // Every case completes through the actual interface, with randomized complications.
 for(const c of cases.filter(c=>!['broken-arm','chaos-infection'].includes(c.id))){await start(c.name);await follow();}
 expect((await progress()).completed).toBe(14);expect(Object.keys((await progress()).best)).toHaveLength(14);
 await start('Torn Muscle');for(let i=0;i<5;i++)await apply('pins');await expect(page.getByRole('heading',{name:'Game Over',exact:true})).toBeVisible();expect((await progress()).attempts).toBe(15);expect((await progress()).completed).toBe(14);await page.screenshot({path:'artifacts/surgery/failure-desktop.png',fullPage:true});
 await page.reload();await page.getByRole('button',{name:'My Progress',exact:true}).click();await expect(page.locator('.s-progress-stats')).toContainText('93%');await expect(page.locator('.s-progress-stats')).toContainText('14 / 14');await page.screenshot({path:'artifacts/surgery/progress-desktop.png',fullPage:true});
 for(const width of [768,390]){await page.setViewportSize({width,height:900});await start('Heart Attack');await page.screenshot({path:`artifacts/surgery/operating-${width}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await follow();}
 // Touch input in a separate mobile context, plus localStorage recovery behavior.
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const touch=await mobile.newPage();await touch.goto(`${base}/games/surgery`);await touch.getByRole('button',{name:'Start Broken Arm',exact:true}).tap();await touch.getByRole('button',{name:'Select Ultrasound',exact:true}).tap();await touch.getByRole('button',{name:'Apply Ultrasound to patient',exact:true}).tap();await expect(touch.locator('.s-objective [role=status]')).toHaveText('Stabilize one fracture.');expect(await touch.locator('video.visible').evaluate((v:HTMLVideoElement)=>v.paused)).toBeTruthy();await mobile.close();
 await page.getByRole('link',{name:'Games',exact:true}).click();await page.getByRole('link',{name:'Enter Mosslight',exact:true}).click();await expect(page.locator('canvas[data-ready=true]')).toBeVisible();await page.getByRole('link',{name:'Notes',exact:true}).click();await expect(page.getByRole('heading',{name:'Notes.'})).toBeVisible();
 expect(errors).toEqual([]);console.log('PASS: 14 case wins, loss, drag/drop, touch, guide, persistence, fixed stage, layouts, Mosslight and Notes.');
}finally{await browser.close();}
