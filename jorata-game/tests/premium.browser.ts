import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL??'http://localhost:3107';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await context.addInitScript('window.__name = (fn) => fn;');
const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
const audit:Array<unknown>=[];await mkdir('artifacts/premium',{recursive:true});
try{
 for(const width of [1440,768,390])for(const route of ['','games','play','games/surgery','notes','settings']){
  await page.setViewportSize({width,height:1000});await page.goto(`${base}/${route}`);await expect(page.locator('h1').first()).toBeVisible();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('.dock a[aria-current=page]')).toHaveCount(1);
  const forms=await page.locator('input,textarea,select').evaluateAll(els=>els.filter(el=>!el.getAttribute('aria-label')&&!(el as HTMLInputElement).labels?.length).map(el=>el.outerHTML));expect(forms).toEqual([]);
  const blankButtons=await page.locator('button').evaluateAll(els=>els.filter(el=>!el.textContent?.trim()&&!el.getAttribute('aria-label')).map(el=>el.outerHTML));expect(blankButtons).toEqual([]);
  await page.screenshot({path:`artifacts/premium/${route.replace('/','-')||'home'}-${width}.png`,fullPage:true});
  const contrast=await page.evaluate(()=>{
   const rgb=(s:string)=>s.match(/[\d.]+/g)?.map(Number)??[0,0,0];
   const blend=(fg:number[],bg:number[])=>{const a=fg[3]??1;return fg.slice(0,3).map((v,i)=>v*a+bg[i]*(1-a));};
   const lum=(c:number[])=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
   const background=(el:Element):number[]=>{const parent=el.parentElement?background(el.parentElement):[20,22,20];return blend(rgb(getComputedStyle(el).backgroundColor),parent);};
   return [...document.querySelectorAll('p,small,label,span,h1,h2,h3,a,button')].filter(el=>el.getClientRects().length&&el.textContent?.trim()&&el.children.length===0&&!el.closest('svg,[disabled],.s-patient,.game-cover')).map(el=>{const s=getComputedStyle(el),bg=background(el),fg=blend(rgb(s.color),bg),a=lum(fg),b=lum(bg);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);const large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);return {text:el.textContent?.trim().slice(0,60),ratio:Number(ratio.toFixed(2)),required:large?3:4.5};}).filter(x=>x.ratio<x.required);
  });audit.push({route:route||'home',width,contrast});
 }
 // Search and category filtering are real and reflected in the URL.
 await page.goto(`${base}/games`);await page.getByRole('button',{name:/Simulation/}).click();await expect(page.locator('.game-card')).toHaveCount(2);expect(page.url()).toContain('category=Simulation');await page.reload();await expect(page.locator('.game-card')).toHaveCount(2);
 await page.getByLabel('Search games').fill('not-a-game');await expect(page.getByRole('heading',{name:'No games found.'})).toBeVisible();await page.getByRole('button',{name:'Show all games'}).click();await expect(page.locator('.game-card')).toHaveCount(5);
 // Header and all feature launches remain normal links, including new-tab semantics.
 const nextPage=context.waitForEvent('page');await page.getByRole('link',{name:'Play Surgery',exact:true}).click({modifiers:['Control']});const opened=await nextPage;await opened.waitForLoadState('domcontentloaded');await expect(opened.getByRole('heading',{name:'Surgery Simulator',exact:true})).toBeVisible();await opened.close();
 // A mobile tool selector applies without scrolling back to the patient.
 await page.goto(`${base}/games/surgery`);await page.getByRole('button',{name:'Start Broken Arm',exact:true}).click();await page.getByLabel('Selected surgical tool').selectOption('ultrasound');await page.getByRole('button',{name:'Apply to patient',exact:true}).click();await expect(page.locator('.s-objective [role=status]')).toHaveText('Stabilize one fracture.');await page.screenshot({path:'artifacts/premium/surgery-active-mobile.png',fullPage:true});
 // Quick note is keyboard reachable, traps focus, and restores it after Escape.
 await page.goto(base);await page.getByRole('button',{name:/Quick note/}).focus();await page.keyboard.press('Control+j');const dialog=page.getByRole('dialog',{name:'Quick note',exact:true});await expect(dialog).toBeVisible();await expect(dialog.getByLabel('Quick note content')).toBeFocused();await dialog.getByLabel('Close quick note').focus();await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:/Return to world/})).toBeFocused();await page.screenshot({path:'artifacts/premium/quick-note-mobile.png',fullPage:true});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 // In-page animation pause and device reduced motion both stop decorative loops.
 await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:'Pause interface motion'}).click();expect(await page.locator('html').getAttribute('data-motion')).toBe('off');expect(await page.locator('.floating-island').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await page.getByRole('button',{name:'Resume interface motion'}).click();await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.floating-island').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 expect(errors).toEqual([]);await writeFile('artifacts/premium/audit.json',JSON.stringify({audit,pageErrors:errors},null,2));console.log(JSON.stringify({pass:'All six routes at three widths, labels, empty states, filter persistence, new-tab navigation, mobile surgery apply, keyboard modal and reduced motion.',contrastFindings:audit.filter((a:any)=>a.contrast.length)},null,2));
}finally{await browser.close();}
