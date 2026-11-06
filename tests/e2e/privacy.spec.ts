import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { NO_MODELS, clickSquare, hasModels, loadFen } from './helpers';

const fixtures = fileURLToPath(new URL('../fixtures/', import.meta.url));
const BACK_RANK = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'; // 1.Rd8#

/** Scan the photographed book page and open it for analysis. */
async function scanBookPage(page: Page) {
  await page.getByTestId('scan').click();
  await page.getByTestId('file-input').setInputFiles(fixtures + 'book-photo.jpg');
  await expect(page.getByText('Adjust the corners')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('recognize').click();
  await expect(page.getByText('Check the position')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('analyze').click();
}

test('never talks to a server: scanning, analysis, Solve mode, puzzles, settings', async ({ page, context, baseURL }) => {
  test.skip(!hasModels, NO_MODELS);
  // every request the page, its workers or the service worker make
  const own = new URL(baseURL!).host;
  const elsewhere: string[] = [];
  context.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol !== 'data:' && url.protocol !== 'blob:' && url.host !== own) elsewhere.push(req.url());
  });
  page.on('websocket', (ws) => elsewhere.push(ws.url()));
  // the Content Security Policy (vite.config.ts) must not block anything the app does
  const blocked: string[] = [];
  page.on('console', (m) => /Content.Security.Policy/i.test(m.text()) && blocked.push(m.text()));

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  await expect(page.getByTestId('welcome')).toContainText('never leave your phone');
  await page.getByTestId('welcome').getByRole('button', { name: 'Got it' }).click();
  await page.getByTestId('scan').click();
  await expect(page.getByTestId('privacy-note')).toContainText('never uploaded');
  await page.getByLabel('Back').click();

  await scanBookPage(page);
  await expect(page.getByTestId('depth')).toHaveText(/depth [1-9]\d\//, { timeout: 60_000 });

  await page.getByRole('tab', { name: 'Solve' }).click();
  await loadFen(page, BACK_RANK);
  await clickSquare(page, 'd1');
  await clickSquare(page, 'd8');
  await expect(page.getByTestId('verdict')).toContainText('Best move', { timeout: 60_000 });

  await page.getByLabel('Puzzles', { exact: true }).click();
  await expect(page.locator('[data-puzzle-id]')).toHaveAttribute('data-phase', 'play');

  await page.getByLabel('Settings').click();
  const privacy = page.getByTestId('privacy');
  await expect(privacy).toContainText('Photos are read on this device and never uploaded');
  await privacy.getByRole('button', { name: /Privacy policy/ }).click();
  const policy = page.frameLocator('iframe[title="Privacy policy"]');
  await expect(policy.getByText("doesn't collect, store or share any personal data")).toBeVisible();
  await page.getByLabel('Back').click();
  await expect(privacy).toBeVisible();

  expect(elsewhere).toEqual([]);
  expect(blocked).toEqual([]);
});

test('recent scans are only kept while "Remember recent scans" is on', async ({ page }) => {
  test.skip(!hasModels, NO_MODELS);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('chessy.tips-dismissed.v1', 'true');
    const old = { id: '1', fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1', thumb: null, time: 1 };
    localStorage.setItem('chessy.history.v1', JSON.stringify([old]));
  });
  await page.reload();
  await expect(page.getByTestId('history').locator('.history-item')).toHaveCount(1);

  // switching it off forgets the scans kept so far …
  await page.getByLabel('Settings').click();
  const keep = page.getByRole('checkbox', { name: /Remember recent scans/ });
  await expect(keep).toBeChecked();
  await keep.uncheck();
  await page.getByLabel('Board', { exact: true }).click();
  await expect(page.getByTestId('history')).toHaveCount(0);

  // … and new scans aren't kept
  await scanBookPage(page);
  await expect(page.getByTestId('fen')).toBeVisible();
  await expect(page.getByTestId('history')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('chessy.history.v1') ?? '[]'))).toEqual([]);
});

test('"Delete all data" removes everything the app stored, after confirming', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('chessy.settings.v1', JSON.stringify({ pieceSet: 'fantasy', sounds: false }));
    localStorage.setItem('chessy.tips-dismissed.v1', 'true');
    const scan = { id: '1', fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1', thumb: null, time: 1 };
    localStorage.setItem('chessy.history.v1', JSON.stringify([scan]));
    localStorage.setItem('chessy.solve-stats.v1', JSON.stringify({ tried: 5, solved: 3, streak: 2, bestStreak: 4 }));
    localStorage.setItem('chessy.puzzles.v1', JSON.stringify({ glicko: { rating: 1720, rd: 80, vol: 0.06 }, tried: 9 }));
  });
  await page.reload();
  await expect(page.getByTestId('history')).toBeVisible();
  await page.getByLabel('Settings').click();
  const remove = page.getByTestId('privacy').getByRole('button', { name: /Delete all data/ });

  // cancelled: nothing happens
  page.once('dialog', (d) => d.dismiss());
  await remove.click();
  await expect(page.getByRole('radio', { name: 'Fantasy' })).toHaveAttribute('aria-checked', 'true');

  page.once('dialog', (d) => d.accept());
  await remove.click();
  // the app starts afresh: tips, default pieces, no recent scans
  await expect(page.getByTestId('welcome')).toBeVisible();
  await expect(page.getByTestId('history')).toHaveCount(0);
  await expect(page.locator('svg.board image[href$="/wK.svg"]')).toHaveAttribute('href', 'pieces/cburnett/wK.svg');
  const left = await page.evaluate(() =>
    ['chessy.settings.v1', 'chessy.tips-dismissed.v1', 'chessy.history.v1', 'chessy.solve-stats.v1', 'chessy.puzzles.v1'].map(
      (k) => localStorage.getItem(k),
    ),
  );
  expect(left).toEqual([null, null, null, null, null]);
});
