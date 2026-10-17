import {chromium,expect,type Page} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
const qa=JSON.parse(readFileSync(process.env.QA_ACCOUNTS_FILE||'/tmp/jorata-qa-bootstrap.json','utf8')) as {accounts:{id:string;email:string;username:string;password:string;display_name:string}[]};
const fixtures=JSON.parse(readFileSync('/tmp/jorata-qa-fixtures.json','utf8')) as {dm:string;group:string;privateRoom:string};
const url=process.env.TEST_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const errors:string[]=[];
async function login(page:Page,index:number){page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.getByLabel('Email',{exact:true}).fill(qa.accounts[index].email);await page.getByLabel('Password',{exact:true}).fill(qa.accounts[index].password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('.social-status')).toContainText('Connected',{timeout:20000});}
async function open(page:Page,id:string){await page.locator(`[data-room-id="${id}"]`).click();await expect(page.getByLabel('Message',{exact:true})).toBeVisible();}
try{
  const ac=await browser.newContext({viewport:{width:1450,height:950},permissions:['camera']});
  const bc=await browser.newContext({viewport:{width:1450,height:950}});
  const a=await ac.newPage(),b=await bc.newPage();
  await login(a,0);await login(b,1);
  await a.getByRole('button',{name:'New chat',exact:true}).click();await a.getByLabel('Find a username',{exact:true}).fill(qa.accounts[1].username);await a.getByRole('button',{name:'Find people',exact:true}).click();await a.getByRole('button',{name:`Message ${qa.accounts[1].display_name}`,exact:true}).click();
  await expect(a.locator(`[data-room-id="${fixtures.dm}"]`)).toHaveClass(/selected/);await open(b,fixtures.dm);
  const marker=`Browser hello ${Date.now()}`;
  await a.getByLabel('Message',{exact:true}).fill(marker);await a.getByRole('button',{name:'Send',exact:true}).click();
  await expect(b.locator('.social-message-body').filter({hasText:marker})).toBeVisible({timeout:10000});
  await expect(a.getByText('Online now',{exact:true})).toBeVisible({timeout:10000});
  const messageId=await b.locator('.social-message').filter({hasText:marker}).getAttribute('data-message-id');
  const received=b.locator(`[data-message-id="${messageId}"]`);await received.getByRole('button',{name:'Reply',exact:true}).click();
  await b.getByLabel('Message',{exact:true}).fill('Browser reply');await b.getByRole('button',{name:'Send',exact:true}).click();
  await expect(a.locator('.social-message-body').filter({hasText:'Browser reply'}).last()).toBeVisible();
  const own=a.locator(`[data-message-id="${messageId}"]`);await own.getByRole('button',{name:'Edit message',exact:true}).click();await own.getByLabel('Edit message text').fill(marker+' edited');await own.getByRole('button',{name:'Save edit',exact:true}).click();
  await expect(b.locator('.social-message-body').filter({hasText:marker+' edited'})).toBeVisible();
  await received.getByRole('button',{name:'React 👍',exact:true}).click();await expect(own.getByRole('button',{name:'React 👍',exact:true})).toContainText('1');
  await b.reload();await expect(b.locator('.social-status')).toContainText('Connected',{timeout:20000});await open(b,fixtures.dm);await expect(b.locator('.social-message-body').filter({hasText:marker+' edited'})).toBeVisible();
  // Real group creation and invitation through the production UI.
  const groupName=`Browser Group ${Date.now()}`;
  await a.getByRole('button',{name:'New chat',exact:true}).click();await a.getByLabel('Group name',{exact:true}).fill(groupName);await a.getByRole('button',{name:'Create group',exact:true}).click();
  await a.getByLabel('Invite username',{exact:true}).fill(qa.accounts[1].username);await a.getByRole('button',{name:'Invite member',exact:true}).click();
  const groupButton=b.locator('.social-room').filter({hasText:groupName});await expect(groupButton).toBeVisible({timeout:15000});await groupButton.click();
  await a.getByRole('button',{name:'Tasks',exact:true}).click();await b.getByRole('button',{name:'Tasks',exact:true}).click();
  const title=`Meetup ${Date.now()}`;
  await a.getByLabel('Task title',{exact:true}).fill(title);await a.getByLabel('Details',{exact:true}).fill('Bring ideas for our community');await a.getByLabel('Assign to',{exact:true}).selectOption(qa.accounts[1].id);await a.getByLabel('Deadline',{exact:true}).fill('2026-12-01');await a.getByRole('button',{name:'Add task',exact:true}).click();
  await expect(b.getByLabel(`Complete ${title}`,{exact:true})).toBeVisible();await b.getByLabel(`Complete ${title}`,{exact:true}).click();await expect(a.getByLabel(`Complete ${title}`,{exact:true})).toBeChecked();await expect(b.getByLabel(`Complete ${title}`,{exact:true})).toBeChecked();
  await a.getByRole('button',{name:'Close side panel',exact:true}).click();await b.getByRole('button',{name:'Close side panel',exact:true}).click();
  // Camera opens only after an explicit click; Chromium supplies a synthetic test camera.
  await a.getByRole('button',{name:'Attach or capture photo',exact:true}).click();await a.getByRole('button',{name:'Use camera',exact:true}).click();await expect(a.getByLabel('Camera preview')).toBeVisible();
  await expect.poll(async()=>a.getByLabel('Camera preview').evaluate(el=>(el as HTMLVideoElement).videoWidth)).toBeGreaterThan(0);
  await a.getByRole('button',{name:'Capture photo',exact:true}).click();await expect(a.getByLabel('Edited photo preview')).toBeVisible();await expect(a.getByLabel('Camera preview')).toHaveCount(0);
  await a.getByLabel('Filter',{exact:true}).selectOption('Warm');await a.getByLabel('Frame background',{exact:true}).selectOption('Meadow');await a.getByLabel('Caption',{exact:true}).fill('Hello JORATA');
  await a.getByRole('button',{name:'Send photo',exact:true}).click();await expect(a.getByRole('dialog',{name:'Make a moment'})).toHaveCount(0,{timeout:15000});
  await expect(b.locator('.social-message-photo').last()).toBeVisible({timeout:15000});await expect.poll(async()=>b.locator('.social-message-photo').last().evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  // Genuine network loss followed by resubscription and database catch-up.
  await bc.setOffline(true);await a.getByLabel('Message',{exact:true}).fill('Catch up after reconnect');await a.getByRole('button',{name:'Send',exact:true}).click();await bc.setOffline(false);await b.reload();await expect(b.locator('.social-status')).toContainText('Connected',{timeout:20000});
  await b.locator('.social-room').filter({hasText:groupName}).click();await expect(b.locator('.social-message-body').filter({hasText:'Catch up after reconnect'}).last()).toBeVisible();
  mkdirSync('artifacts',{recursive:true});await a.screenshot({path:'artifacts/social-desktop.png',fullPage:true});
  await a.getByRole('button',{name:'Visit the Meadow',exact:false}).click();await b.getByRole('button',{name:'Visit the Meadow',exact:false}).click();
  await expect(a.locator('.social-world-info')).toContainText('2 here',{timeout:15000});await expect(b.locator('.social-world-info')).toContainText('QA A');
  const canvas=a.locator('#game-canvas');await canvas.focus();const start=Number(await canvas.getAttribute('data-player-x'));await a.keyboard.down('d');await expect.poll(async()=>Number(await canvas.getAttribute('data-player-x'))).toBeGreaterThan(start+.5);await a.keyboard.up('d');
  await a.getByRole('button',{name:'Back to messages',exact:false}).click();
  await a.locator('.social-profile-button').click();
  const avatar=await a.evaluate(()=>{const c=document.createElement('canvas');c.width=32;c.height=32;const x=c.getContext('2d')!;x.fillStyle='#709951';x.fillRect(0,0,32,32);return c.toDataURL('image/png').split(',')[1];});
  await a.getByLabel('Profile photo',{exact:true}).setInputFiles({name:'qa-avatar.png',mimeType:'image/png',buffer:Buffer.from(avatar,'base64')});await a.getByRole('button',{name:'Save profile',exact:true}).click();await expect(a.getByRole('dialog',{name:'Your profile',exact:true})).toHaveCount(0,{timeout:15000});await expect(a.locator('.social-profile-button img')).toBeVisible();
  await a.getByRole('button',{name:'Summarize',exact:true}).click();const aiResponse=a.waitForResponse(r=>r.url().endsWith('/api/ai')&&r.request().method()==='POST');await a.getByRole('button',{name:'Send messages to Gemini and summarize',exact:true}).click();const ai=await aiResponse;expect([200,429,502,503]).toContain(ai.status());await expect(a.locator('.social-ai-result')).not.toBeEmpty({timeout:30000});console.log(`AI endpoint verified: HTTP ${ai.status()} (${ai.status()===200?'provider summary':'explicit unavailable/rate-limit response'})`);await a.getByRole('button',{name:'Close dialog',exact:true}).click();
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const phone=await mobile.newPage();await login(phone,2);await expect(phone.getByRole('button',{name:'New chat',exact:true})).toBeVisible();await phone.screenshot({path:'artifacts/social-mobile.png',fullPage:true});expect(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await a.getByRole('button',{name:'Sign out',exact:true}).click();await expect(a.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
  console.log('PASS: real account browser login/session/logout, realtime DM/reply/edit/reaction/history, group invitation, synchronized task assignment/completion, camera permission/capture/filter/private photo delivery, reconnect catch-up, two-player managed world, inactive-AI handling, and mobile layout.');
}finally{await browser.close();}
