import { chromium, expect, type Browser, type Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';

// Run the actual production server against a temporary save, leaving player builds alone.
const directory = mkdtempSync(pathJoin(tmpdir(), 'jorata-browser-'));
let logs = '';
function spawnServer(port = '0') {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env: { ...process.env, PORT: port, NODE_ENV: 'production', WORLD_FILE: pathJoin(directory, 'world.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', data => { logs += String(data); });
  return child;
}
let server = spawnServer();
async function ready() {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${logs}`)), 10000);
    server.on('error', error => { clearTimeout(timeout); reject(error); });
    server.on('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${logs}`)); });
    let output = '';
    server.stdout.on('data', data => {
      output += String(data);
      const match = output.match(/ready at (http:\/\/localhost:\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
}
let browser: Browser | undefined;
let url = '';
const errors: string[] = [];
async function join(page: Page, username: string) {
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.locator('#username').fill(username);
  await page.getByRole('button', { name: /Enter the meadow/i }).click();
  await expect(page.locator('.connection')).toContainText('Connected');
  await expect(page.locator('.join-backdrop')).toHaveCount(0);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-player-x', /\d/);
}
async function position(page: Page) {
  return Number(await page.locator('#game-canvas').getAttribute('data-player-x'));
}
async function clickTile(page: Page, x: number, y: number, button: 'left' | 'right' = 'left') {
  const canvas = page.locator('#game-canvas');
  const camera = await canvas.evaluate(el => ({ x: Number(el.dataset.cameraX), y: Number(el.dataset.cameraY) }));
  await canvas.click({ position: { x: (x + 0.5) * 32 - camera.x, y: (y + 0.5) * 32 - camera.y }, button });
}
try {
  url = await ready() + '?legacy=1';
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const alice = await context.newPage();
  const bobContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const bob = await bobContext.newPage();
  await join(alice, 'BrowserAlice');
  await join(bob, 'BrowserBob');
  await expect(alice.locator('.player-list')).toContainText('BrowserBob');
  await expect(bob.locator('.player-list')).toContainText('BrowserAlice');
  await alice.bringToFront();
  await alice.locator('#game-canvas').focus();
  const x = await position(alice);
  await alice.keyboard.down('d');
  await expect.poll(() => position(alice)).toBeGreaterThan(x + 1.5);
  await alice.keyboard.up('d');
  const beforeJump = Number(await alice.locator('#game-canvas').getAttribute('data-player-y'));
  await alice.keyboard.down('Space');
  await expect.poll(async () => Number(await alice.locator('#game-canvas').getAttribute('data-player-y'))).toBeLessThan(beforeJump - 0.5);
  await alice.keyboard.up('Space');
  await alice.keyboard.press('Enter');
  await expect(alice.locator('#chat-input')).toBeFocused();
  const typingX = await position(alice);
  await alice.locator('#chat-input').pressSequentially('wasd hello meadow', { delay: 40 });
  await alice.keyboard.press('Enter');
  await expect(bob.locator('.message')).toContainText('wasd hello meadow');
  await expect.poll(() => position(alice)).toBeLessThan(typingX + 0.15);
  await alice.keyboard.press('Escape');
  await expect(alice.locator('#game-canvas')).toBeFocused();
  await alice.getByRole('button', { name: 'Minimize social panel' }).click();
  await alice.locator('#game-canvas').focus();
  await alice.keyboard.press('Enter');
  await expect(alice.locator('#chat-input')).toBeFocused();
  await alice.keyboard.press('Escape');
  await alice.keyboard.press('q');
  await expect(alice.getByRole('button', { name: 'Demolish', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await alice.keyboard.press('x');
  await expect(alice.getByRole('button', { name: 'Timber', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await alice.getByRole('button', { name: 'Help and controls' }).click();
  const modalX = await position(alice);
  await alice.keyboard.down('d');
  await alice.waitForTimeout(350);
  await alice.keyboard.up('d');
  expect(Math.abs(await position(alice) - modalX)).toBeLessThan(0.15);
  await alice.keyboard.press('Escape');
  await alice.getByRole('button', { name: 'Return to spawn' }).click();
  await expect.poll(() => position(alice)).toBeLessThan(12.2);
  await alice.waitForTimeout(700);
  const revision = Number(await alice.locator('.saved-state').getAttribute('data-revision'));
  await alice.getByRole('button', { name: 'Timber' }).click();
  await clickTile(alice, 16, 27);
  await expect(bob.locator('.saved-state')).toHaveAttribute('data-revision', String(revision + 1));
  await alice.reload();
  await alice.getByRole('button', { name: /Enter the meadow/i }).click();
  await expect(alice.locator('.saved-state')).toHaveAttribute('data-revision', String(revision + 1));
  await expect(alice.locator('.join-backdrop')).toHaveCount(0);
  await alice.waitForTimeout(700);
  await clickTile(alice, 16, 27, 'right');
  await expect(bob.locator('.saved-state')).toHaveAttribute('data-revision', String(revision + 2));
  await alice.getByRole('button', { name: 'Clay' }).click();
  await clickTile(alice, 16, 27);
  await expect(bob.locator('.saved-state')).toHaveAttribute('data-revision', String(revision + 3));
  mkdirSync('artifacts', { recursive: true });
  await alice.screenshot({ path: 'artifacts/multiplayer-desktop.png', fullPage: true });
  // Kill and restart the actual server: clients must rejoin with the persisted world.
  const stopped = once(server, 'exit');
  server.kill('SIGKILL');
  await stopped;
  await expect(alice.locator('.reconnect-banner')).toBeVisible({ timeout: 10000 });
  server = spawnServer(new URL(url).port);
  await ready();
  await expect(alice.locator('.connection')).toContainText('Connected', { timeout: 15000 });
  await expect(bob.locator('.connection')).toContainText('Connected', { timeout: 15000 });
  await expect(alice.locator('.saved-state')).toHaveAttribute('data-revision', String(revision + 3));
  await alice.waitForTimeout(700);
  await clickTile(alice, 16, 27, 'right');
  await expect(bob.locator('.saved-state')).toHaveAttribute('data-revision', String(revision + 4));
  await bob.close();
  await expect(alice.locator('.player-list .player-chip')).toHaveCount(1);
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await mobile.newPage();
  await join(phone, 'PhoneGuest');
  await expect(phone.getByRole('button', { name: 'Open chat', exact: true })).toBeVisible();
  await expect(phone.getByRole('button', { name: 'Move right' })).toBeVisible();
  const phoneX = await position(phone);
  const right = phone.getByRole('button', { name: 'Move right' });
  const bounds = await right.boundingBox();
  if (!bounds) throw new Error('Touch control not laid out');
  await phone.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await phone.mouse.down();
  await expect.poll(() => position(phone)).toBeGreaterThan(phoneX + 0.5);
  await phone.mouse.up();
  await phone.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  console.log('PASS: two browser clients, keyboard/jump, chat without movement, shared place/remove, refresh persistence, reconnect, leave and mobile controls; no browser errors.');
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    await stopped;
  }
  rmSync(directory, { recursive: true, force: true });
}
