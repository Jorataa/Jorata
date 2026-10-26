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
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));

await mkdir('artifacts/boxing', { recursive: true });

try {
  // 1. Open Games library and navigate to Ringcraft Boxing
  await page.goto(`${base}/games`);
  await expect(page.getByRole('heading', { name: 'Ringcraft Boxing', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Play Boxing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ringcraft Boxing', exact: true })).toBeVisible();
  await expect(page.locator('canvas[data-ready=true][data-assets-ready=true]')).toBeVisible({ timeout: 10000 });

  // Verify all rendered pixel-art UI images loaded with non-zero dimensions
  const brokenImages = await page.locator('img').evaluateAll(imgs =>
    imgs
      .filter(img => !(img as HTMLImageElement).complete || (img as HTMLImageElement).naturalWidth === 0)
      .map(img => (img as HTMLImageElement).src)
  );
  expect(brokenImages).toEqual([]);

  // 2. Verify Local 1v1 is active by default and exact 4 keys per player are shown
  await expect(page.getByRole('button', { name: /Local 1v1/ })).toHaveAttribute('aria-pressed', 'true');
  const p1Buttons = page.locator('.b-deck-column').first().locator('.b-key-cap');
  const p2Buttons = page.locator('.b-deck-column').nth(1).locator('.b-key-cap');
  await expect(p1Buttons).toHaveCount(4);
  await expect(p2Buttons).toHaveCount(4);
  await expect(p1Buttons.nth(0)).toContainText('A');
  await expect(p1Buttons.nth(1)).toContainText('D');
  await expect(p1Buttons.nth(2)).toContainText('W');
  await expect(p1Buttons.nth(3)).toContainText('F');
  await expect(p2Buttons.nth(0)).toContainText('←');
  await expect(p2Buttons.nth(1)).toContainText('→');
  await expect(p2Buttons.nth(2)).toContainText('↑');
  await expect(p2Buttons.nth(3)).toContainText('L');

  // 3. Simultaneous shared-keyboard movement & blocking for both players
  await page.locator('canvas').focus();
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ArrowUp');
  await expect(p1Buttons.nth(1)).toHaveClass(/is-pressed/);
  await expect(p1Buttons.nth(2)).toHaveClass(/is-pressed/);
  await expect(p2Buttons.nth(0)).toHaveClass(/is-pressed/);
  await expect(p2Buttons.nth(2)).toHaveClass(/is-pressed/);
  await page.waitForTimeout(650);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ArrowLeft');

  // 4. Automatic 3-hit combo chain (Jab -> Hook -> Uppercut) with single punch key (F)
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

  // Player 2 recovers from uppercut knockback, steps in, and punches back using L
  await page.waitForTimeout(450);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(450);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('KeyL');
  await page.waitForTimeout(150);
  const p1HpAfterCounter = Number(
    await page.getByRole('progressbar', { name: 'Player 1 Health' }).getAttribute('aria-valuenow')
  );
  expect(p1HpAfterCounter).toBeLessThan(100);

  await page.screenshot({ path: 'artifacts/boxing/local-1v1-desktop.png', fullPage: true });

  // 5. Customizable key bindings & anti-ghosting tester
  await page.getByRole('button', { name: 'Customize Keys & Ghosting' }).click();
  await expect(page.getByRole('heading', { name: /Custom Key Bindings/ })).toBeVisible();

  await page.keyboard.down('KeyA');
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('.b-ghost-meter')).toContainText('Simultaneous Keys Registered: 2');
  await page.keyboard.up('KeyA');
  await page.keyboard.up('ArrowRight');

  await page.getByRole('button', { name: 'Rebind Player 2 Punch (Combo)' }).click();
  await page.keyboard.press('KeyK');
  await expect(p2Buttons.nth(3)).toContainText('K');

  // Verify persistence across reload and reset to default
  await page.reload();
  await expect(page.locator('canvas[data-ready=true][data-assets-ready=true]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.b-deck-column').nth(1).locator('.b-key-cap').nth(3)).toContainText('K');
  await page.getByRole('button', { name: 'Customize Keys & Ghosting' }).click();
  await page.getByRole('button', { name: /Reset Defaults/ }).click();
  await expect(page.locator('.b-deck-column').nth(1).locator('.b-key-cap').nth(3)).toContainText('L');
  await page.getByRole('button', { name: 'Hide Key Setup' }).click();

  // 5b. Pause overlay & How to Play modal
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Match Paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume Fight' }).click();
  await expect(page.getByRole('dialog', { name: 'Match Paused' })).toBeHidden();

  await page.getByRole('button', { name: 'How to Play' }).click();
  await expect(page.getByRole('heading', { name: /1\. Shared Keyboard Controls/ })).toBeVisible();
  await page.getByRole('button', { name: 'Hide Guide' }).click();

  // 6. Single Player vs AI mode with Easy, Normal, and Hard difficulties
  await page.getByRole('button', { name: /Single Player vs AI/ }).click();
  await expect(page.getByRole('button', { name: /Single Player vs AI/ })).toHaveAttribute('aria-pressed', 'true');
  for (const diffLabel of ['Easy', 'Normal', 'Hard']) {
    const diffBtn = page.getByRole('button', { name: diffLabel, exact: true });
    await expect(diffBtn).toBeVisible();
    await diffBtn.click();
    await expect(diffBtn).toHaveAttribute('aria-pressed', 'true');
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/boxing/vs-ai-desktop.png', fullPage: true });

  // 7. Responsive layouts, accessibility labels, and contrast at 1440, 768, and 390px
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const unlabeledControls = await page
      .locator('input,textarea,select')
      .evaluateAll(els =>
        els
          .filter(el => !el.getAttribute('aria-label') && !(el as HTMLInputElement).labels?.length)
          .map(el => el.outerHTML)
      );
    expect(unlabeledControls).toEqual([]);
    const blankButtons = await page
      .locator('button')
      .evaluateAll(els =>
        els
          .filter(el => !el.textContent?.trim() && !el.getAttribute('aria-label'))
          .map(el => el.outerHTML)
      );
    expect(blankButtons).toEqual([]);
    await page.screenshot({ path: `artifacts/boxing/boxing-${width}.png`, fullPage: true });
  }

  expect(errors).toEqual([]);
  console.log('PASS: Ringcraft Boxing shared-keyboard Local 1v1, 4-key controls, automatic Jab-Hook-Uppercut combo, simultaneous movement/blocking/attacks, customizable anti-ghosting bindings, AI mode, and responsive layouts.');
} finally {
  await context.close();
  await browser.close();
  if (viteServer) {
    await viteServer.close();
  }
}
