import { chromium, expect, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.PREMIUM_TEST_URL || 'http://localhost:3107';
const browser = await chromium.launch({ headless: true });
const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
const desktop = await desktopContext.newPage();
const mobile = await mobileContext.newPage();
const errors: string[] = [];
const consoleErrors: string[] = [];
for (const [name, page] of [['desktop', desktop], ['mobile', mobile]] as const) {
  page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(`${name}: ${message.text()}`); });
}
const tag = Date.now().toString().slice(-7);
const nameA = `Premium A ${tag}`;
const nameB = `Premium B ${tag}`;
const lobbyMessage = `A little closer, together. ${tag}`;
const replyMessage = `That sounds like a plan. ${tag}`;
const editedMessage = `A little closer, together. See you soon! ${tag}`;
const groupName = `Weekend plans ${tag}`;
const composer = (page: Page) => page.getByRole('textbox', { name: 'Message', exact: true });
const lobby = (page: Page) => page.locator('.social-room[data-room-id="guest-lobby"]');
const message = (page: Page, body: string) => page.locator('article.social-message').filter({
  has: page.locator('.social-message-body').filter({ hasText: body }),
});

async function rename(page: Page, name: string) {
  const edit = page.getByRole('button', { name: 'Edit guest', exact: true });
  if (!(await edit.isVisible())) await page.getByRole('button', { name: 'Back to conversations' }).click();
  await edit.click();
  const dialog = page.getByRole('dialog', { name: 'Temporary profile' });
  await dialog.getByLabel('Display name').fill(name);
  await dialog.getByRole('button', { name: 'Save profile' }).click();
  await expect(dialog).toHaveCount(0);
  if (!(await composer(page).isVisible())) await lobby(page).click();
}

async function send(page: Page, body: string) {
  await composer(page).fill(body);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(message(page, body)).toBeVisible();
}

async function openMenu(page: Page, target: Locator, touch = false) {
  const button = target.getByRole('button', { name: 'Message options' });
  if (touch) await button.tap();
  else { await target.hover(); await button.click(); }
  const menu = page.getByRole('menu', { name: 'Message options' });
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
  return menu;
}

async function closePanel(page: Page) {
  const close = page.getByRole('button', { name: 'Close side panel' });
  if (await close.isVisible()) await close.click();
}

async function assertLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const bounds = await composer(page).boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
}

try {
  await Promise.all([desktop.goto(base), mobile.goto(base)]);
  for (const page of [desktop, mobile]) {
    await expect(page.getByRole('heading', { name: 'Guest lounge · test data', exact: true })).toBeVisible();
  }
  await rename(desktop, nameA);
  await rename(mobile, nameB);

  await send(desktop, lobbyMessage);
  await expect(message(mobile, lobbyMessage)).toBeVisible();
  const own = message(desktop, lobbyMessage);
  const keyboardMenu = await openMenu(desktop, own);
  await expect(keyboardMenu.getByRole('menuitem', { name: 'React 👍', exact: true })).toBeFocused();
  await desktop.keyboard.press('End');
  await expect(keyboardMenu.getByRole('menuitem', { name: 'Delete message', exact: true })).toBeFocused();
  await desktop.keyboard.press('Home');
  await desktop.keyboard.press('ArrowDown');
  await expect(keyboardMenu.getByRole('menuitem', { name: 'React ❤️', exact: true })).toBeFocused();
  await desktop.keyboard.press('Escape');
  await expect(keyboardMenu).toHaveCount(0);
  await expect(own.getByRole('button', { name: 'Message options' })).toBeFocused();

  const reactionMenu = await openMenu(mobile, message(mobile, lobbyMessage), true);
  await reactionMenu.getByRole('menuitem', { name: 'React 👍', exact: true }).tap();
  await expect(own.getByRole('button', { name: 'React 👍', exact: true })).toHaveText('👍1');
  const replyMenu = await openMenu(mobile, message(mobile, lobbyMessage), true);
  await replyMenu.getByRole('menuitem', { name: 'Reply', exact: true }).tap();
  await expect(composer(mobile)).toBeFocused();
  await send(mobile, replyMessage);
  await expect(message(desktop, replyMessage).locator('blockquote')).toHaveText(lobbyMessage);
  const editMenu = await openMenu(desktop, own);
  await editMenu.getByRole('menuitem', { name: 'Edit message', exact: true }).click();
  await desktop.getByLabel('Edit message text').fill(editedMessage);
  await desktop.getByRole('button', { name: 'Save edit', exact: true }).click();
  await expect(message(mobile, editedMessage)).toBeVisible();

  const lobbyDraft = `Remember the picnic blanket ${tag}`;
  const groupDraft = `Bring something to share ${tag}`;
  await composer(desktop).fill(lobbyDraft);
  await desktop.getByRole('button', { name: 'New chat', exact: true }).click();
  const groupDialog = desktop.getByRole('dialog', { name: 'Start a conversation' });
  await groupDialog.getByLabel('Group name').fill(groupName);
  await groupDialog.getByRole('button', { name: 'Create group', exact: true }).click();
  await expect(groupDialog).toHaveCount(0);
  await closePanel(desktop);
  await expect(composer(desktop)).toHaveValue('');
  await composer(desktop).fill(groupDraft);
  await lobby(desktop).click();
  await expect(composer(desktop)).toHaveValue(lobbyDraft);
  const group = desktop.locator('.social-room').filter({ hasText: groupName });
  await group.click();
  await expect(composer(desktop)).toHaveValue(groupDraft);
  await lobby(desktop).click();
  await composer(desktop).fill('');

  // A real direct conversation gives the Personal filter a positive match.
  await desktop.getByRole('button', { name: 'New chat', exact: true }).click();
  const directDialog = desktop.getByRole('dialog', { name: 'Start a conversation' });
  await directDialog.getByPlaceholder('Search username').fill(nameB);
  await directDialog.getByRole('button', { name: 'Find people' }).click();
  await directDialog.getByRole('button', { name: `Message ${nameB}`, exact: true }).click();
  await expect(directDialog).toHaveCount(0);
  await closePanel(desktop);
  const direct = desktop.locator('.social-room').filter({ hasText: nameB });
  const filters = desktop.getByRole('group', { name: 'Filter conversations' });
  await filters.getByRole('button', { name: 'Personal', exact: true }).click();
  await expect(direct).toBeVisible();
  await expect(group).toHaveCount(0);
  await expect(lobby(desktop)).toHaveCount(0);
  await filters.getByRole('button', { name: 'Groups', exact: true }).click();
  await expect(group).toBeVisible();
  await expect(lobby(desktop)).toBeVisible();
  await expect(direct).toHaveCount(0);
  await filters.getByRole('button', { name: 'All chats', exact: true }).click();
  await expect(direct).toBeVisible();
  await expect(group).toBeVisible();
  await lobby(desktop).click();

  const peerPhoto = mobile.getByRole('img', { name: `Photo from ${nameA}`, exact: true });
  const previousPhotos = await peerPhoto.count();
  // Build a real PNG in the browser, then exercise the native file drop path.
  await desktop.locator('.social-main').evaluate(async element => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#172b3e';
    context.fillRect(0, 0, 320, 180);
    context.fillStyle = '#7bb7e5';
    context.beginPath();
    context.arc(230, 60, 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#315c68';
    context.beginPath();
    context.moveTo(0, 180);
    context.lineTo(105, 65);
    context.lineTo(210, 180);
    context.closePath();
    context.fill();
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG generation failed')), 'image/png'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([png], 'weekend-view.png', { type: 'image/png' }));
    element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    element.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await expect(desktop.getByRole('img', { name: 'Photo ready to send' })).toBeVisible();
  await expect(desktop.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  await expect(peerPhoto).toHaveCount(previousPhotos);
  await composer(desktop).fill(`A place for the weekend. ${tag}`);
  await expect(desktop.getByRole('img', { name: 'Photo ready to send' })).toBeVisible();
  await expect(peerPhoto).toHaveCount(previousPhotos);
  await desktop.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(desktop.getByRole('img', { name: 'Photo ready to send' })).toHaveCount(0);
  await expect(peerPhoto).toHaveCount(previousPhotos + 1);
  await expect(peerPhoto.last()).toBeVisible();
  await expect.poll(() => peerPhoto.last().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  await mobile.getByRole('button', { name: 'Back to conversations' }).tap();
  await expect(mobile.getByRole('textbox', { name: 'Search conversations' })).toBeVisible();
  await expect(composer(mobile)).toHaveCount(0);
  await lobby(mobile).tap();
  await expect(composer(mobile)).toBeVisible();
  await expect(mobile.locator('.social-sidebar')).toBeHidden();
  await Promise.all([assertLayout(desktop), assertLayout(mobile)]);

  await mobile.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMenu = await openMenu(mobile, message(mobile, `A place for the weekend. ${tag}`), true);
  const motion = await mobile.locator('.social-main, .social-message, .social-context-menu').evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element);
    const durations = `${style.animationDuration},${style.transitionDuration}`.split(',').map(value => {
      const number = parseFloat(value);
      return value.trim().endsWith('ms') ? number / 1000 : number;
    });
    return Math.max(...durations);
  }));
  expect(motion.every(duration => duration <= 0.01)).toBe(true);
  await mobile.keyboard.press('Escape');
  await expect(reducedMenu).toHaveCount(0);

  await mkdir('artifacts', { recursive: true });
  await desktop.screenshot({ path: 'artifacts/premium-desktop.png', fullPage: true });
  await mobile.screenshot({ path: 'artifacts/premium-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  console.log(JSON.stringify({ verified: ['independent guest identities', 'live delivery', 'keyboard and touch menus', 'reactions', 'quoted replies', 'editing', 'per-conversation drafts', 'conversation filters', 'drop preview and explicit send', 'peer image delivery', 'mobile navigation and layout', 'reduced motion'], errors, consoleErrors }));
} catch (error) {
  await mkdir('artifacts', { recursive: true });
  await Promise.all([
    desktop.screenshot({ path: 'artifacts/premium-failure-desktop.png', fullPage: true }),
    mobile.screenshot({ path: 'artifacts/premium-failure-mobile.png', fullPage: true }),
  ]);
  console.error('Browser errors:', { errors, consoleErrors });
  throw error;
} finally {
  await browser.close();
}
