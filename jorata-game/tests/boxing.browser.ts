import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createServer, type ViteDevServer } from 'vite';

let viteServer: ViteDevServer | null = null;
let base = process.env.TEST_BASE_URL ?? '';
if (!base) {
  viteServer = await createServer({
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'silent',
  });
  await viteServer.listen();
  const addr = viteServer.httpServer?.address();
  const port = typeof addr === 'object' && addr ? addr.port : 3107;
  base = `http://127.0.0.1:${port}`;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));

await mkdir('artifacts/boxing', { recursive: true });

try {
  // 1. Open Games library and navigate into Ringcraft Boxing
  await page.goto(`${base}/games`);
  await expect(page.getByRole('heading', { name: 'Ringcraft Boxing', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Play Boxing', exact: true }).click();
  await expect(page.locator('canvas[data-ready=true][data-assets-ready=true]')).toBeVisible({ timeout: 10000 });

  // Verify Main Menu hierarchy inside the arena:
  // BOXING JORATA -> [ START PLAY ] -> [ 1 PLAYER ] [ 2 PLAYERS ] -> [ SETTINGS ]
  await expect(page.getByRole('heading', { name: 'BOXING JORATA', exact: true })).toBeVisible();
  const startBtn = page.getByRole('button', { name: 'START PLAY', exact: true });
  const onePlayerBtn = page.getByRole('button', { name: '1 PLAYER', exact: true });
  const twoPlayersBtn = page.getByRole('button', { name: '2 PLAYERS', exact: true });
  const settingsBtn = page.getByRole('button', { name: 'SETTINGS', exact: true });

  await expect(startBtn).toBeVisible();
  await expect(onePlayerBtn).toBeVisible();
  await expect(twoPlayersBtn).toBeVisible();
  await expect(settingsBtn).toBeVisible();

  // Verify all rendered pixel-art images loaded with non-zero dimensions
  const brokenImages = await page.locator('img').evaluateAll(imgs =>
    imgs
      .filter(img => !(img as HTMLImageElement).complete || (img as HTMLImageElement).naturalWidth === 0)
      .map(img => (img as HTMLImageElement).src)
  );
  expect(brokenImages).toEqual([]);

  // Hover Start Play to verify custom pixel-art glove cursor hero state
  const startBox = await startBtn.boundingBox();
  if (startBox) {
    await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
    await expect(page.locator('.b-glove-cursor')).toHaveClass(/is-hero/);
  }

  await page.screenshot({ path: 'artifacts/boxing/main-menu-desktop.png' });

  // 2. Select 1 PLAYER and inspect the minimal Settings overlay
  await onePlayerBtn.click();
  await expect(onePlayerBtn).toHaveAttribute('aria-pressed', 'true');
  await settingsBtn.click();

  const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(settingsDialog).toBeVisible();
  await expect(settingsDialog.getByRole('button', { name: /Sound Effects/ })).toBeVisible();
  await expect(settingsDialog.getByRole('button', { name: /Arena Music/ })).toBeVisible();
  await expect(settingsDialog.getByRole('group', { name: 'AI difficulty' })).toBeVisible();

  for (const diffLabel of ['Easy', 'Normal', 'Hard']) {
    const diffBtn = settingsDialog.getByRole('button', { name: diffLabel, exact: true });
    await expect(diffBtn).toBeVisible();
    await diffBtn.click();
    await expect(diffBtn).toHaveAttribute('aria-pressed', 'true');
  }

  // Verify shared-keyboard control reference inside Settings
  await expect(settingsDialog).toContainText('PLAYER 1 · RED');
  await expect(settingsDialog).toContainText('PLAYER 2 · BLUE');
  await expect(settingsDialog).toContainText('Jab → Hook → Uppercut');

  await page.screenshot({ path: 'artifacts/boxing/settings-overlay.png' });

  await settingsDialog.getByRole('button', { name: 'DONE', exact: true }).click();
  await expect(settingsDialog).toBeHidden();

  // 3. Switch to 2 PLAYERS and click START PLAY for shared-keyboard multiplayer combat
  await twoPlayersBtn.click();
  await expect(twoPlayersBtn).toHaveAttribute('aria-pressed', 'true');
  await startBtn.click();

  // Wait for menu transition into active arena HUD
  await expect(page.locator('.b-hud')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Player 1 Health' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Player 1 Stamina' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Player 2 Health' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Player 2 Stamina' })).toBeVisible();
  await expect(page.getByLabel('Round timer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

  // Simultaneous shared-keyboard movement & blocking for both players
  await page.locator('canvas').focus();
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(650);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ArrowLeft');

  // Automatic 3-hit combo chain (Jab -> Hook -> Uppercut) with single punch key (F)
  await expect(page.locator('.b-fighter-p1 .b-combo-pill.is-next')).toContainText('1. Jab');
  await page.keyboard.press('KeyF');
  await expect(page.locator('.b-fighter-p1 .b-combo-pill.is-next')).toContainText('2. Hook');
  await page.waitForTimeout(240);
  await page.keyboard.press('KeyF');
  await expect(page.locator('.b-fighter-p1 .b-combo-pill.is-next')).toContainText('3. Uppercut');
  await page.waitForTimeout(260);
  await page.keyboard.press('KeyF');
  await expect(page.locator('.b-fighter-p1 .b-combo-pill.is-next')).toContainText('1. Jab');

  const p2HpAfterCombo = Number(
    await page.getByRole('progressbar', { name: 'Player 2 Health' }).getAttribute('aria-valuenow')
  );
  expect(p2HpAfterCombo).toBeLessThan(100);

  // Player 2 steps in and counters using L
  await page.waitForTimeout(500);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(650);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('KeyL');
  await page.waitForTimeout(220);
  const p1HpAfterCounter = Number(
    await page.getByRole('progressbar', { name: 'Player 1 Health' }).getAttribute('aria-valuenow')
  );
  expect(p1HpAfterCounter).toBeLessThan(100);

  await page.screenshot({ path: 'artifacts/boxing/local-1v1-desktop.png' });

  // 4. Pause overlay & return to Main Menu -> Launch 1 PLAYER vs AI
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const pauseDialog = page.getByRole('dialog', { name: 'Match Paused' });
  await expect(pauseDialog).toBeVisible();
  await pauseDialog.getByRole('button', { name: 'MAIN MENU', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'BOXING JORATA', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '1 PLAYER', exact: true }).click();
  await page.getByRole('button', { name: 'START PLAY', exact: true }).click();
  await expect(page.locator('.b-hud')).toBeVisible();
  await page.waitForTimeout(950);
  await page.screenshot({ path: 'artifacts/boxing/vs-ai-desktop.png' });

  // 5. Responsive layouts and accessibility across 1440, 768, and 390px
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const blankButtons = await page
      .locator('button')
      .evaluateAll(els =>
        els
          .filter(el => !el.textContent?.trim() && !el.getAttribute('aria-label'))
          .map(el => el.outerHTML)
      );
    expect(blankButtons).toEqual([]);
    await page.screenshot({ path: `artifacts/boxing/boxing-${width}.png` });
  }

  expect(errors).toEqual([]);
  console.log('PASS: Boxing Jorata arcade main menu, custom glove cursor, minimal settings overlay, minimal HUD, shared-keyboard 2P and 1P AI combat, and responsive layouts.');
} finally {
  await context.close();
  await browser.close();
  if (viteServer) {
    await viteServer.close();
  }
}
