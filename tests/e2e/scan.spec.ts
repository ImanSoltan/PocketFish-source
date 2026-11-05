import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NO_MODELS, hasModels } from './helpers';

test.skip(!hasModels, NO_MODELS);

// Fixtures rendered by scripts/make-fixtures.mjs (Chromium), independently of the
// Python generator the models were trained with. Expected piece placements:
const dir = fileURLToPath(new URL('../fixtures/', import.meta.url));
const fixtures: Record<string, string> = JSON.parse(fs.readFileSync(dir + 'fixtures.json', 'utf8'));

for (const [file, placement] of Object.entries(fixtures)) {
  test(`recognises ${file}`, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('scan').click();
    await page.getByTestId('file-input').setInputFiles(dir + file);
    await expect(page.getByText('Adjust the corners')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('recognize').click();
    await expect(page.getByText('Check the position')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('analyze').click();
    const fen = (await page.getByTestId('fen').textContent()) ?? '';
    expect(fen.split(' ')[0]).toBe(placement);
    // the scan is remembered under "Recent scans"
    await expect(page.getByTestId('history').locator('.history-item')).toHaveCount(1);
  });
}

test('pastes a copied screenshot', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByTestId('scan').click();

  // text on the clipboard is not a picture
  await page.evaluate(() => navigator.clipboard.writeText('not a picture'));
  await page.getByTestId('paste').click();
  await expect(page.getByRole('status')).toContainText('No picture on the clipboard');

  const png = fs.readFileSync(dir + 'app-screenshot.png').toString('base64');
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
  }, png);
  await page.getByTestId('paste').click();
  await expect(page.getByText('Adjust the corners')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('recognize').click();
  await expect(page.getByText('Check the position')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('analyze').click();
  const fen = (await page.getByTestId('fen').textContent()) ?? '';
  expect(fen.split(' ')[0]).toBe(fixtures['app-screenshot.png']);
});
