import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
 await page.goto((process.env.TEST_BASE_URL??'http://localhost:3107')+'/games/surgery');
 await page.getByLabel('Search disease',{exact:true}).fill('Heart Attack');await page.locator('.s-case-list>button').click();await page.getByRole('button',{name:'Start Heart Attack',exact:true}).click();
 const video=()=>page.locator('video.visible');await expect.poll(()=>video().evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(2);
 await page.waitForTimeout(1400);const time=await video().evaluate((v:HTMLVideoElement)=>v.currentTime);expect(time).toBeGreaterThanOrEqual(1.3);expect(time).toBeLessThan(2.85);
 const bed=async()=>{await page.locator('.s-apply-zone').scrollIntoViewIfNeeded();const b=(await page.locator('.s-patient').boundingBox())!;return page.screenshot({clip:{x:b.x+b.width*.08,y:b.y+b.height*.70,width:b.width*.2,height:b.height*.15},animations:'disabled'});};
 const before=await bed();
 const use=async(name:string)=>{await page.getByRole('button',{name:`Select ${name}`,exact:true}).click();await page.getByRole('button',{name:`Apply ${name} to patient`,exact:true}).click();};
 await use('Ultrasound');await use('Defibrillator');await expect(page.locator('.s-patient')).toHaveAttribute('data-mood','fear');await page.waitForTimeout(250);expect((await bed()).equals(before)).toBe(true);
 const t1=await video().evaluate((v:HTMLVideoElement)=>v.currentTime);await page.waitForTimeout(400);expect(await video().evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(t1);
 await use('Anesthetic');await expect(page.locator('.s-patient')).toHaveAttribute('data-mood','healthy');await page.waitForTimeout(250);expect((await bed()).equals(before)).toBe(true);
 // Selecting a different disease must not replace the rules of an unfinished case.
 await page.getByRole('button',{name:/Select Disease/}).click();await page.getByLabel('Search disease',{exact:true}).fill('Bird Flu');await page.locator('.s-case-list>button').click();await page.getByRole('button',{name:'Play Surgery',exact:true}).click();await expect(page.getByRole('heading',{name:'Heart Attack',exact:true})).toBeVisible();
 // Storage corruption and blocked writes never prevent playing.
 await page.evaluate(()=>localStorage.setItem('jorata.surgery.progress.v1','invalid'));await page.reload();await expect(page.locator('.s-skill')).toContainText('0 / 100');
 await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage blocked for test')};});await page.reload();await page.getByRole('button',{name:'Start Broken Arm',exact:true}).click();for(let i=0;i<5;i++)await use('Pins');await expect(page.getByRole('alert')).toContainText('storage is unavailable');
 console.log('PASS: critical loop, actual video playback, pixel-identical fixed bed across moods, case resume isolation, corrupt/blocked storage.');
}finally{await browser.close();}
