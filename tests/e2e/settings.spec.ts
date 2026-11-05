import { expect, test } from '@playwright/test';

test('About opens from Help & feedback: developer, version, credits', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Settings').click();
  await expect(page.getByTestId('developer')).toHaveCount(0); // not on the Settings screen itself
  await page.getByTestId('about').click();
  await expect(page.getByTestId('developer')).toHaveText(/A product by Agile With AI\s*agilewithai\.com/);
  await expect(page.getByTestId('version')).toHaveText('Version 1.0.0');
  await expect(page.getByTestId('credits')).toContainText('Stockfish');
  await expect(page.getByTestId('credits')).toContainText('lichess.org puzzle database');
  await expect(page.getByText('© 2026 Iman Soltanzadeh')).toBeVisible();
  await page.getByLabel('Back').click();
  await expect(page.getByTestId('about')).toBeVisible();
});

test('About shows the GPL notices; the Licences page has every licence and where the sources are', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Settings').click();
  await page.getByTestId('about').click();
  const legal = page.getByTestId('legal');
  await expect(legal).toContainText('GNU General Public License v3');
  await expect(legal).toContainText('no warranty');
  await expect(legal).toContainText('The recognition models are © Iman Soltanzadeh, all rights reserved.');
  await page.getByTestId('licences').click();
  const text = page.getByTestId('licences-text');
  for (const part of [
    'WITHOUT ANY WARRANTY',
    'https://github.com/ImanSoltan/PocketFish-source',
    'all rights reserved',
    'https://github.com/nmrugg/stockfish.js/tree/v19.0.0',
    'Classic pieces',
    'react 19',
    'chess.js',
    '@capacitor/core',
    'lucide-react',
    'TERMS AND CONDITIONS',
  ])
    await expect(text).toContainText(part);
  // Back returns to About, then to Settings
  await page.getByLabel('Back').click();
  await expect(page.getByTestId('legal')).toBeVisible();
  await page.getByLabel('Back').click();
  await expect(page.getByTestId('about')).toBeVisible();
});

test('a new screen opens at the top; Back returns to where Settings was', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Settings').click();
  const main = page.locator('main');
  await page.getByTestId('about').scrollIntoViewIfNeeded();
  const where = await main.evaluate((m) => m.scrollTop);
  expect(where).toBeGreaterThan(300);
  await page.getByTestId('about').click();
  await expect(page.getByTestId('version')).toBeVisible();
  expect(await main.evaluate((m) => m.scrollTop)).toBe(0);
  await page.getByLabel('Back').click();
  await expect(page.getByTestId('about')).toBeInViewport();
  expect(Math.abs((await main.evaluate((m) => m.scrollTop)) - where)).toBeLessThan(2);
});

test('switches the piece set and remembers it', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Settings').click();
  const sets = page.getByRole('radiogroup', { name: 'Piece set' });
  await expect(sets.getByRole('radio')).toHaveCount(6);
  await sets.getByRole('radio', { name: 'Fantasy' }).click();
  await expect(sets.getByRole('radio', { name: 'Fantasy' })).toHaveAttribute('aria-checked', 'true');

  await page.getByLabel('Board', { exact: true }).click();
  const king = page.locator('svg.board image[href$="/wK.svg"]');
  await expect(king).toHaveAttribute('href', 'pieces/fantasy/wK.svg');
  // the image really loads
  const ok = await page.evaluate(async () => (await fetch('pieces/fantasy/wK.svg')).ok);
  expect(ok).toBe(true);

  await page.reload();
  await expect(page.locator('svg.board image[href$="/wK.svg"]')).toHaveAttribute('href', 'pieces/fantasy/wK.svg');
});

test('first-run tips: shown once, dismissed, and shown again from Settings', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const tips = page.getByTestId('welcome');
  await expect(tips).toContainText('Tap Board twice');
  await tips.getByRole('button', { name: 'Got it' }).click();
  await expect(tips).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('welcome')).toHaveCount(0);

  await page.getByLabel('Settings').click();
  await page.getByRole('button', { name: 'Show tips' }).click();
  await expect(page.getByTestId('welcome')).toBeVisible();
});

test('move sounds can be switched off', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Settings').click();
  const toggle = page.getByRole('checkbox', { name: /Move sounds/ });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.reload();
  await page.getByLabel('Settings').click();
  await expect(page.getByRole('checkbox', { name: /Move sounds/ })).not.toBeChecked();
});

test('win / draw / loss chances can be switched on', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Settings').click();
  await page.getByRole('checkbox', { name: /Win \/ draw \/ loss chances/ }).check();
  await page.getByLabel('Board', { exact: true }).click();
  await expect(page.getByTestId('wdl')).toHaveText(/^White \d+% · draw \d+% · Black \d+%$/, { timeout: 60_000 });
});

test('help & feedback: a prefilled mail and the version', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Settings').click();
  const help = page.getByTestId('help');
  await expect(help.getByRole('link', { name: /Send feedback/ })).toHaveAttribute(
    'href',
    /^mailto:[^?]+\?subject=PocketFish%20feedback&body=.*PocketFish%201\.0\.0/,
  );
  await expect(help.getByRole('link', { name: /Report a misread scan/ })).toHaveAttribute('href', /subject=PocketFish%3A%20a%20scan%20was%20misread/);
  await expect(help.getByTestId('about')).toContainText('Version 1.0.0');
});

test('the support page is published with the app', async ({ page }) => {
  await page.goto('/support.html');
  await expect(page.getByRole('heading', { name: 'PocketFish support' })).toBeVisible();
  await page.getByRole('link', { name: 'privacy policy' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
});

test('tips are only offered in the iPhone app, which can take App Store payments', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Settings').click();
  await expect(page.getByTestId('help')).toContainText('Send feedback');
  await expect(page.getByTestId('tip-jar')).toHaveCount(0);
  await expect(page.getByTestId('help')).not.toContainText('Support PocketFish');
});

test('About links the studio’s website, in German for the app in German', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { opened: string[] }).opened = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { opened: string[] }).opened.push(String(url));
      return null;
    };
  });
  await page.goto('/');
  await page.getByLabel('Settings').click();
  await page.getByTestId('about').click();
  await expect(page.getByText('Iman Soltanzadeh', { exact: false }).first()).toBeVisible(); // the legal lines keep the name
  await expect(page.getByTestId('developer')).not.toContainText('Soltanzadeh');
  await page.getByTestId('developer').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual(['https://agilewithai.com/']);

  await page.evaluate(() => localStorage.setItem('chessy.settings.v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('chessy.settings.v1') ?? '{}'), language: 'de' })));
  await page.reload();
  await page.getByLabel('Einstellungen').click();
  await page.getByTestId('about').click();
  await expect(page.getByTestId('developer')).toHaveText(/Ein Produkt von Agile With AI\s*agilewithai\.com\/de/);
  await page.getByTestId('developer').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual(['https://agilewithai.com/de']);
});
