import { expect, test } from '@playwright/test';
import { clickSquare } from './helpers';

test.describe('on a German phone', () => {
  test.use({ locale: 'de-DE' });

  test('the app follows the phone’s language', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByTestId('welcome')).toContainText('Willkommen bei PocketFish');
    await page.getByTestId('welcome').getByRole('button', { name: 'Verstanden' }).click();
    await expect(page.getByRole('tab', { name: 'Lösen' })).toBeVisible();
    await expect(page.getByLabel('Schwarz am Zug')).toBeVisible();
    await expect(page.getByTestId('depth')).toContainText('Tiefe');

    // a problem with the position, in German
    await page.getByLabel('Stellung bearbeiten').click();
    await page.getByRole('button', { name: 'Leeren' }).click();
    await expect(page.getByTestId('problems')).toContainText('Der weiße König fehlt');
    await page.getByLabel('Setzen: weißer König', { exact: true }).click();
    await clickSquare(page, 'e1');
    await expect(page.getByTestId('problems')).not.toContainText('Der weiße König fehlt');
    await page.getByRole('button', { name: 'Abbrechen' }).click();

    await page.getByLabel('Aufgaben', { exact: true }).click();
    await expect(page.getByTestId('puzzle-stats')).toContainText('Aufgabenwertung');
    await page.getByLabel('Einstellungen').click();
    await expect(page.getByTestId('language')).toHaveValue('auto');
    await expect(page.getByTestId('language').locator('option[value="auto"]')).toHaveText('Automatisch');
  });
});

test('the Language setting overrides the phone and is remembered', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByLabel('Settings').click();
  await page.getByTestId('language').selectOption('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { name: 'Langue' })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Réglages')).toBeVisible();
  await page.getByLabel('Échiquier', { exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Résoudre' })).toBeVisible();

  await page.getByLabel('Réglages').click();
  await page.getByTestId('language').selectOption('es');
  await expect(page.getByRole('heading', { name: 'Idioma' })).toBeVisible();
  await page.getByTestId('language').selectOption('auto');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
});
