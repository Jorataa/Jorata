import { chromium, expect, type Browser, type Page } from '@playwright/test';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';

// Exercise the existing guest API and sockets against disposable local data.
// Nothing in this test is injected into the application or a user's saved world.
const directory = mkdtempSync(join(tmpdir(), 'jorata-redesign-'));
const artifacts = 'artifacts';
const errors: string[] = [];
const verified: string[] = [];
let logs = '';
let browser: Browser | undefined;
let server: ChildProcessWithoutNullStreams | undefined;
let url = process.env.REDESIGN_TEST_URL || '';
let a: Page | undefined;
let b: Page | undefined;
mkdirSync(artifacts, { recursive: true });

async function startServer(port = '0') {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: port,
      GUEST_FILE: join(directory, 'guests.json'),
      WORLD_FILE: join(directory, 'world.json'),
    },
    stdio: 'pipe',
  });
  server = child;
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Dev server startup timed out: ${logs}`)), 20000);
    child.stderr.on('data', data => { logs += String(data); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${logs}`)); });
    let output = '';
    child.stdout.on('data', data => {
      output += String(data);
      const ready = output.match(/ready at (http:\/\/localhost:\d+)/);
      if (ready) { clearTimeout(timer); resolve(ready[1]); }
    });
  });
}

async function stopServer() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const exited = once(server, 'exit');
  server.kill('SIGTERM');
  let timer: ReturnType<typeof setTimeout>;
  try { await Promise.race([exited, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Local server did not shut down within 10 seconds')), 10000); })]); }
  finally { clearTimeout(timer!); }
}

async function open(page: Page, roomId: string) {
  await page.locator(`[data-room-id="${roomId}"]`).click();
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
}

async function rename(page: Page, name: string) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Edit guest', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Temporary profile', exact: true });
  await dialog.getByLabel('Display name').fill(name);
  await dialog.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  if (await settings.count()) await settings.getByRole('button', { name: 'Close dialog', exact: true }).click();
}

async function send(page: Page, text: string, keyboard = false) {
  const composer = page.getByRole('textbox', { name: 'Message', exact: true });
  await composer.fill(text);
  if (keyboard) await composer.press('Enter');
  else await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(composer).toHaveValue('');
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function screenshot(page: Page, name: string) {
  await expect(page.locator('[data-closing="true"]')).toHaveCount(0);
  await page.screenshot({ path: `${artifacts}/redesign-${name}.png`, fullPage: true });
}

// These are ordinary authenticated server actions used only to populate enough
// real conversations for a meaningful sidebar scrolling check.
async function seedScrollFixtures(page: Page, roomId: string) {
  const token = await page.evaluate(() => {
    const saved = sessionStorage.getItem('jorata-development-identity-v1');
    if (!saved) throw new Error('No local guest session');
    return (JSON.parse(saved) as { token: string }).token;
  });
  const socket = io(`${url}/dev-social`, { auth: { token }, transports: ['websocket'], autoConnect: false });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    async function action(name: string, payload: Record<string, unknown>) {
      const response = await socket.timeout(10000).emitWithAck('action', { name, payload }) as { error?: string };
      if (response.error) throw new Error(response.error);
    }
    for (const name of ['Weekend plans', 'Studio friends', 'Sunday walks', 'Film club', 'Book recommendations', 'Garden notes', 'The music room', 'Travel ideas', 'Coffee tomorrow', 'Family recipes', 'Summer plans', 'Little discoveries']) {
      await action('create_group', { name });
    }
    for (let index = 0; index < 14; index++) {
      await action('send_message', {
        room_id: roomId,
        body: `A little note from our day, ${index + 1}.\nThe city was quiet this morning. We found a small café near the park and stayed for a while.\nLet's save a seat by the window next time.`,
      });
    }
  } finally {
    socket.disconnect();
  }
}

try {
  if (!url) url = await startServer();
  browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const mobile = await browser.newContext({ viewport: { width: 1440, height: 960 }, isMobile: true, hasTouch: true });
  a = await desktop.newPage();
  b = await mobile.newPage();
  for (const page of [a, b]) page.on('pageerror', error => errors.push(error.message));
  await Promise.all([a.goto(url), b.goto(url)]);
  await expect(a.locator('[data-room-id="guest-lobby"]')).toBeVisible();
  await expect(b.locator('[data-room-id="guest-lobby"]')).toBeVisible();
  await rename(a, 'Sophia Chen');
  await rename(b, 'Luca Moreno');
  verified.push('Direct entry and guest profile controls in Settings');

  await a.getByRole('button', { name: 'New chat', exact: true }).click();
  const newChat = a.getByRole('dialog', { name: 'Start a conversation', exact: true });
  await newChat.getByPlaceholder('Search username').fill('Luca Moreno');
  await newChat.getByRole('button', { name: 'Find people', exact: true }).click();
  await newChat.getByRole('button', { name: 'Message Luca Moreno', exact: true }).click();
  await expect(newChat).toHaveCount(0);
  const roomA = a.locator('.social-room').filter({ hasText: 'Luca Moreno' });
  const roomId = await roomA.getAttribute('data-room-id');
  if (!roomId) throw new Error('Direct message room was not created');
  await expect(b.locator(`[data-room-id="${roomId}"]`)).toBeVisible();
  await open(b, roomId);
  await expect(a.getByRole('button', { name: 'Close side panel', exact: true })).toHaveCount(0);
  verified.push('New real direct conversation opens without an unsolicited information panel');

  const firstMessage = 'Are you free for a walk by the river this evening?';
  await a.getByRole('textbox', { name: 'Message', exact: true }).fill('A quiet evening');
  await expect(b.locator('.social-typing')).toContainText('Sophia Chen');
  await send(a, firstMessage, true);
  const received = b.locator('article.social-message').filter({ has: b.locator('.social-message-body').filter({ hasText: firstMessage }) });
  await expect(received).toBeVisible();
  const messageId = await received.getAttribute('data-message-id');
  if (!messageId) throw new Error('Received message has no identifier');
  await received.hover();
  await received.getByRole('button', { name: 'Message options', exact: true }).click();
  await b.getByRole('menuitem', { name: 'Reply', exact: true }).click();
  await send(b, 'That sounds lovely. Shall we meet at six?');
  await expect(a.locator('.social-message-reply').filter({ hasText: firstMessage })).toBeVisible();
  const own = a.locator(`[data-message-id="${messageId}"]`);
  await own.hover();
  await own.getByRole('button', { name: 'Message options', exact: true }).click();
  await a.getByRole('menuitem', { name: 'Edit message', exact: true }).click();
  await a.getByLabel('Edit message text').fill('Are you free for a walk by the river at six?');
  await a.getByRole('button', { name: 'Save edit', exact: true }).click();
  await expect(b.locator(`[data-message-id="${messageId}"] .social-message-body`)).toContainText('at six?');
  const editedReceived = b.locator(`[data-message-id="${messageId}"]`);
  await editedReceived.hover();
  await editedReceived.getByRole('button', { name: 'Message options', exact: true }).click();
  await b.getByRole('menuitem', { name: 'React 👍', exact: true }).click();
  await expect(own.getByRole('button', { name: 'React 👍', exact: true })).toContainText('1');
  await send(a, 'Six is perfect. I’ll bring the coffee.');
  await send(b, 'See you there!');
  verified.push('Two-client typing, Enter-to-send, receipt, reply, edit, and reaction through the existing server');
  await noOverflow(a);
  await screenshot(a, 'desktop-chat');
  // Physical interactions use the same real server and independent clients.
  const divider = a.getByRole('separator', { name: 'Resize conversation sidebar' });
  expect((await a.locator('.social-sidebar').boundingBox())!.width).toBe(288);
  expect((await a.locator('.social-conversation-heading').boundingBox())!.height).toBe(54);
  expect((await a.locator('.social-room').first().boundingBox())!.height).toBeLessThanOrEqual(60);
  const handle = (await divider.boundingBox())!;
  await a.mouse.move(handle.x + 3, handle.y + 200);
  await a.mouse.down();
  await a.mouse.move(handle.x + 75, handle.y + 200, { steps: 12 });
  await a.mouse.up();
  await expect(divider).toHaveAttribute('aria-valuenow', '360');
  await a.reload();
  await expect(divider).toHaveAttribute('aria-valuenow', '360');
  await open(a, roomId);
  await divider.dblclick();
  await expect(divider).toHaveAttribute('aria-valuenow', '288');
  await divider.focus();
  await a.keyboard.press('End');
  await expect(divider).toHaveAttribute('aria-valuenow', '420');
  await a.keyboard.press('Home');
  await expect(divider).toHaveAttribute('aria-valuenow', '250');
  await a.keyboard.press('Enter');
  await expect(divider).toHaveAttribute('aria-valuenow', '288');
  verified.push('Compact dimensions; pointer/keyboard sidebar resize, bounds, reload persistence and double-click reset');

  const photoCount = await b.locator('.social-message-photo-button').count();
  async function dropPhoto() {
    const data = await a!.evaluateHandle(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#507e91'; ctx.fillRect(0, 0, 1600, 900);
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
      const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'river.png', { type: 'image/png' }));
      return transfer;
    });
    const target = a!.locator('.social-conversation-content');
    await target.dispatchEvent('dragenter', { dataTransfer: data });
    await expect(a!.locator('.social-drop-overlay')).toBeVisible();
    await target.dispatchEvent('drop', { dataTransfer: data });
    await data.dispose();
    await expect(a!.getByLabel('Edited photo preview')).toBeVisible();
  }
  await dropPhoto();
  expect(await b.locator('.social-message-photo-button').count()).toBe(photoCount);
  await a.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(a.getByRole('dialog', { name: 'Photo preview' })).toHaveCount(0);
  expect(await b.locator('.social-message-photo-button').count()).toBe(photoCount);
  await dropPhoto();
  await a.getByRole('button', { name: 'Send photo', exact: true }).click();
  await expect(b.locator('.social-message-photo-button')).toHaveCount(photoCount + 1);
  await b.locator('.social-message-photo-button').last().click();
  await expect(b.getByRole('dialog', { name: 'Photo', exact: true }).locator('img')).toBeVisible();
  await b.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(b.getByRole('dialog')).toHaveCount(0);
  verified.push('Drop overlay, explicit preview/cancel/send, real photo delivery and media viewer');

  await b.setViewportSize({ width: 390, height: 844 });
  const swipeTarget = b.locator(`[data-message-id="${messageId}"]`);
  await swipeTarget.scrollIntoViewIfNeeded();
  const touch = await b.context().newCDPSession(b);
  async function gesture(dx: number, dy: number) {
    const rect = (await swipeTarget.locator('.social-message-body').boundingBox())!;
    const x = rect.x + rect.width / 2, y = rect.y + 8;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 8, y: y + dy * step / 8 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await gesture(28, 1);
  await expect(b.locator('.social-reply-preview')).toHaveCount(0);
  await gesture(3, -70);
  await expect(b.locator('.social-reply-preview')).toHaveCount(0);
  await swipeTarget.scrollIntoViewIfNeeded();
  await gesture(104, 2);
  await expect(b.locator('.social-reply-preview')).toBeVisible();
  await send(b, 'Replied with a swipe.');
  await expect(a.locator('.social-message').filter({ hasText: 'Replied with a swipe.' }).locator('.social-message-reply')).toBeVisible();
  await touch.detach();
  await b.setViewportSize({ width: 1440, height: 960 });
  verified.push('Native Chromium touch swipe-to-reply, short-swipe cancellation and vertical-scroll rejection');
  await a.getByRole('button', { name: 'Conversation options', exact: true }).click();
  await a.getByRole('menuitem', { name: 'Shared tasks', exact: true }).click();
  await a.getByLabel('Task title', { exact: true }).fill('Bring coffee');
  await a.getByRole('button', { name: 'Add task', exact: true }).click();
  await b.getByRole('button', { name: 'Conversation options', exact: true }).click();
  await b.getByRole('menuitem', { name: 'Shared tasks', exact: true }).click();
  await b.getByRole('checkbox', { name: 'Complete Bring coffee' }).click();
  await expect(b.getByRole('checkbox', { name: 'Complete Bring coffee' })).toBeChecked();
  await expect(a.getByRole('checkbox', { name: 'Complete Bring coffee' })).toBeChecked();
  for (const page of [a, b]) {
    await page.getByRole('button', { name: 'Close side panel', exact: true }).click();
    await expect(page.locator('.social-detail-panel')).toHaveCount(0);
  }
  verified.push('Shared tasks remain accessible through conversation options and synchronize between users');


  await a.getByRole('button', { name: 'Settings', exact: true }).click();
  await a.getByRole('button', { name: 'Dark', exact: true }).click();
  await a.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await screenshot(a, 'desktop-dark');
  await a.getByRole('button', { name: 'Settings', exact: true }).click();
  await a.getByRole('button', { name: 'Light', exact: true }).click();
  await a.getByRole('button', { name: 'Close dialog', exact: true }).click();
  verified.push('Light and dark appearance controls');

  const input = a.getByRole('textbox', { name: 'Message', exact: true });
  const oneLine = (await input.boundingBox())!.height;
  await input.fill('First line');
  await input.press('Shift+Enter');
  await input.pressSequentially('Second line');
  await expect(input).toHaveValue('First line\nSecond line');
  expect((await input.boundingBox())!.height).toBeGreaterThan(oneLine);
  await open(a, 'guest-lobby');
  await open(a, roomId);
  await expect(input).toHaveValue('First line\nSecond line');
  await input.fill('');
  verified.push('Auto-expanding composer, Shift+Enter, and per-conversation draft retention');

  await seedScrollFixtures(b, roomId);
  await expect(a.locator('.social-message-body').filter({ hasText: 'A little note from our day, 14.' })).toBeVisible();
  const history = a.locator('.social-messages');
  await history.evaluate(element => { element.scrollTop = 160; element.dispatchEvent(new Event('scroll')); });
  const readPosition = await history.evaluate(element => element.scrollTop);
  await send(b, 'One more thing — the path near the bridge is open again.');
  await expect(a.locator('.social-message-body').filter({ hasText: 'the path near the bridge' })).toHaveCount(1);
  expect(Math.abs(await history.evaluate(element => element.scrollTop) - readPosition)).toBeLessThan(8);
  await open(a, 'guest-lobby');
  await open(a, roomId);
  expect(Math.abs(await history.evaluate(element => element.scrollTop) - readPosition)).toBeLessThan(8);
  verified.push('Incoming messages do not interrupt history reading; room scroll position is restored');

  await open(a, 'guest-lobby');
  await send(b, 'I’ll wait by the old stone bridge.');
  await expect(roomA.locator('.social-unread-badge')).toBeVisible();
  await open(a, roomId);
  await a.getByRole('button', { name: /Jump to latest message/ }).click();
  await expect(roomA.locator('.social-unread-badge')).toHaveCount(0);
  verified.push('Unread conversation indicator appears and clears after reading the latest message');

  await a.getByRole('textbox', { name: 'Search conversations', exact: true }).fill('no-match-3198427');
  await expect(a.locator('.social-room')).toHaveCount(0);
  await screenshot(a, 'search-empty');
  await a.getByRole('textbox', { name: 'Search conversations', exact: true }).fill('');
  await a.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = a.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(settings).toBeVisible();
  await a.keyboard.press('Tab');
  expect(await settings.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await screenshot(a, 'settings');
  await a.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(a.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  verified.push('Search empty state, Settings keyboard focus, Escape, and focus restoration');

  await b.setViewportSize({ width: 390, height: 844 });
  await b.getByRole('button', { name: 'Back to conversations', exact: true }).click();
  const mobileRoom = b.locator(`[data-room-id="${roomId}"]`);
  await expect(b.getByRole('textbox', { name: 'Search conversations', exact: true })).toBeVisible();
  await noOverflow(b);
  await screenshot(b, 'mobile-inbox');
  const lowerRoom = b.locator('.social-room').filter({ hasText: 'Weekend plans' });
  await lowerRoom.scrollIntoViewIfNeeded();
  const list = b.locator('.social-room-list');
  const listPosition = await list.evaluate(element => element.scrollTop);
  expect(listPosition).toBeGreaterThan(0);
  await lowerRoom.click();
  await expect(b.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
  await screenshot(b, 'mobile-empty-conversation');
  await b.getByRole('button', { name: 'Back to conversations', exact: true }).click();
  expect(Math.abs(await list.evaluate(element => element.scrollTop) - listPosition)).toBeLessThan(8);
  await mobileRoom.click();
  await noOverflow(b);
  await screenshot(b, 'mobile-chat');
  await b.setViewportSize({ width: 320, height: 568 });
  await noOverflow(b);
  await screenshot(b, 'mobile-320');
  // A short viewport checks layout resizing. It does not emulate an OS keyboard.
  await b.setViewportSize({ width: 390, height: 450 });
  const phoneInput = b.getByRole('textbox', { name: 'Message', exact: true });
  await phoneInput.focus();
  await phoneInput.fill('A message in a shorter viewport');
  const composerBounds = await b.locator('.social-composer').boundingBox();
  expect(composerBounds!.y + composerBounds!.height).toBeLessThanOrEqual(451);
  await noOverflow(b);
  await screenshot(b, 'mobile-short-viewport');
  await phoneInput.fill('');
  await b.setViewportSize({ width: 390, height: 844 });
  verified.push('390px and 320px mobile screens, preserved inbox scrolling, back navigation, and short-viewport composer');

  await a.getByRole('button', { name: 'Games', exact: true }).click();
  await screenshot(a, 'games');
  await a.getByRole('button', { name: /Enter the Meadow|Visit the Meadow|Play the Meadow/ }).click();
  const canvas = a.locator('#game-canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.getAttribute('data-player-x')).not.toBeNull();
  await canvas.focus();
  const start = Number(await canvas.getAttribute('data-player-x'));
  await a.keyboard.down('d');
  await expect.poll(async () => Number(await canvas.getAttribute('data-player-x'))).toBeGreaterThan(start + 0.5);
  await a.keyboard.up('d');
  await a.getByRole('button', { name: /Back to messages/ }).click();
  await expect(a.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
  verified.push('Dedicated Games discovery, actual Meadow rendering/movement, and return to messages');

  await a.emulateMedia({ reducedMotion: 'reduce' });
  await open(a, 'guest-lobby');
  await open(a, roomId);
  const animationDuration = await a.locator('.social-main').evaluate(element => getComputedStyle(element).animationDuration);
  expect(animationDuration.split(',').every(value => parseFloat(value) <= 0.01)).toBe(true);
  verified.push('Reduced-motion preference');

  if (server) {
    const port = new URL(url).port;
    console.log('Verified so far:', verified);
    await stopServer();
    console.log('Disposable server stopped; checking reconnect.');
    await expect(a.locator('.social-app')).toContainText(/Reconnecting|Connection lost|offline/i);
    const failedDraft = 'The message is still here while we reconnect.';
    await a.getByRole('textbox', { name: 'Message', exact: true }).fill(failedDraft);
    await a.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(a.locator('.social-send-error')).toBeVisible();
    await expect(a.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(failedDraft);
    await screenshot(a, 'reconnecting');
    // Vite may reload its clients when its own websocket reconnects.
    const reloads = [a, b].map(page => page.waitForEvent('load', { timeout: 10000 }).catch(() => undefined));
    await startServer(port);
    await Promise.all(reloads);
    await expect(a.locator('.social-connection-note')).toContainText(/Connected|Live/, { timeout: 15000 });
    await open(a, roomId);
    if (await b.locator('.social-sidebar').isVisible()) await open(b, roomId);
    await expect(a.locator(`[data-message-id="${messageId}"] .social-message-body`)).toContainText('at six?');
    await send(a, 'Back online — see you soon.');
    await expect(b.locator('.social-message-body').filter({ hasText: 'Back online — see you soon.' })).toBeVisible();
    verified.push('Genuine server disconnect, visible send failure with retained draft, reconnect, persisted history, and resumed two-client delivery');
  }

  expect(errors).toEqual([]);
  writeFileSync(`${artifacts}/redesign-verification.json`, JSON.stringify({ verified, errors, limitations: ['An OS virtual keyboard is not available in headless Chromium; the resized viewport is checked instead.', 'This pass uses the existing local guest transport; hosted account credentials are not exercised.'] }, null, 2));
  console.log(JSON.stringify({ status: 'PASS', verified, errors }, null, 2));
} catch (error) {
  if (a && !a.isClosed()) await screenshot(a, 'failure-desktop');
  if (b && !b.isClosed()) await screenshot(b, 'failure-mobile');
  console.error('Completed checks:', verified);
  console.error('Browser errors:', errors);
  throw error;
} finally {
  await browser?.close();
  await stopServer();
  rmSync(directory, { recursive: true, force: true });
}
