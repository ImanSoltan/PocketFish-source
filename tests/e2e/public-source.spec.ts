import { expect, test } from '@playwright/test';
import { NO_MODELS, hasModels } from './helpers';

// The public source has no recognition models (they're all rights reserved): such a build says so on
// the scan screen, and everything else keeps working.
test.use({ serviceWorkers: 'block' });

test('a build without the recognition models says so, and the rest works', async ({ page }) => {
  await page.route('**/models/*.bin', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await page.getByTestId('scan').click();
  await expect(page.getByTestId('no-models')).toContainText('This build has no recognition models');
  await expect(page.getByTestId('paste')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeHidden();
  await page.getByLabel('Back').click();
  await expect(page.getByTestId('depth')).toContainText('depth', { timeout: 60_000 });
});

test('with the models, the scan screen offers the camera as usual', async ({ page }) => {
  test.skip(!hasModels, NO_MODELS);
  await page.goto('/');
  await page.getByTestId('scan').click();
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible();
  await expect(page.getByTestId('no-models')).toHaveCount(0);
});
