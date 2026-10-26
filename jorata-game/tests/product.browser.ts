import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||process.env.TEST_URL||'http://localhost:3107';
const browser=await chromium.launch({headless:true});
const errors:string[]=[];
try {
 const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await mkdir('artifacts/rebuild',{recursive:true});
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});await page.goto(base);await expect(page.getByRole('heading',{name:'Find your next world.'})).toBeVisible();
  await page.screenshot({path:`artifacts/rebuild/home-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('link',{name:'Notes',exact:true}).click();await expect(page.getByRole('heading',{name:'Notes.'})).toBeVisible();await page.screenshot({path:`artifacts/rebuild/notes-${width}.png`,fullPage:true});
  await page.goto(`${base}/play`);await expect(page.locator('canvas[data-ready=true]')).toBeVisible();await page.screenshot({path:`artifacts/rebuild/play-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('link',{name:'Settings',exact:true}).click();await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();await page.getByRole('checkbox',{name:/Interface motion/}).uncheck();expect(await page.locator('html').getAttribute('data-motion')).toBe('off');await page.reload();await expect(page.getByRole('checkbox',{name:/Interface motion/})).not.toBeChecked();
  await page.screenshot({path:`artifacts/rebuild/settings-${width}.png`,fullPage:true});
  expect(await page.locator('body').innerText()).not.toMatch(/chat|conversation|message composer/i);
 }
 const obsolete=await page.goto(`${base}/accounts`);if(obsolete?.status()!==404)await expect(page.getByRole('heading',{name:'This path ends here.'})).toBeVisible();
 await page.goto(base);await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.floating-island').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
 expect(errors).toEqual([]);console.log('PASS: navigation, desktop/tablet/mobile layouts, settings persistence, reduced motion, obsolete route, no chat UI, no JS errors.');
 await context.close();
}finally{await browser.close()}
