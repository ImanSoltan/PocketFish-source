import { expect, test } from '@playwright/test';
import { clickSquare, loadFen } from './helpers';

const BACK_RANK = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'; // 1.Rd8#

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('tab', { name: 'Solve' }).click();
});

test('judges the move without showing the engine; only the first try counts', async ({ page }) => {
  await loadFen(page, BACK_RANK);
  const solve = page.getByTestId('solve');
  await expect(solve).toContainText('White to play');
  await expect(page.getByTestId('lines')).toHaveCount(0);
  await expect(page.getByTestId('eval')).toHaveCount(0);
  await expect(page.getByTestId('depth')).toHaveCount(0);
  await expect(page.locator('svg.board polygon')).toHaveCount(0); // no arrows

  // a move that misses the mate
  await clickSquare(page, 'd1');
  await clickSquare(page, 'd2');
  await expect(page.getByTestId('verdict')).toContainText(/Inaccuracy|Mistake|Blunder/, { timeout: 60_000 });
  await expect(solve).toContainText('forced mate in 1');
  await expect(page.getByTestId('solve-stats')).toContainText('solved 0 of 1');

  await solve.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('fen')).toHaveText(BACK_RANK);
  await clickSquare(page, 'd1');
  await clickSquare(page, 'd8');
  await expect(page.getByTestId('verdict')).toContainText('Best move', { timeout: 60_000 });
  await expect(solve).toContainText('Checkmate — solved!');
  await expect(page.getByTestId('continue')).toHaveCount(0);
  await expect(page.getByTestId('solve-stats')).toContainText('solved 0 of 1');
});

test('solved at the first try raises the streak', async ({ page }) => {
  await loadFen(page, BACK_RANK);
  await clickSquare(page, 'd1');
  await clickSquare(page, 'd8');
  await expect(page.getByTestId('verdict')).toContainText('Best move', { timeout: 60_000 });
  await expect(page.getByTestId('solve-stats')).toContainText('Streak 1 · best 1 · solved 1 of 1');
});

test('hint, the engine’s reply after a good move, and the solution', async ({ page }) => {
  const solve = page.getByTestId('solve');
  await solve.getByRole('button', { name: 'Hint' }).click();
  await expect(page.locator('svg.board rect[style*="--hint"]')).toHaveCount(1, { timeout: 60_000 });

  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect(page.getByTestId('verdict')).toContainText(/Best move|Good move/, { timeout: 60_000 });
  await expect(page.getByTestId('solve-stats')).toContainText('solved 0 of 1'); // a hint was used

  await page.getByTestId('continue').click();
  await expect(solve).toContainText('White to play', { timeout: 60_000 });
  await expect(page.getByTestId('fen')).toHaveText(/ w KQkq - \d+ 2$/);
  await expect(page.getByTestId('moves')).toContainText('1.e4');

  await solve.getByRole('button', { name: 'Show solution' }).click({ timeout: 60_000 });
  await expect(page.getByTestId('solution')).toContainText('2.');
  await expect(page.locator('svg.board polygon')).toHaveCount(1);
  await expect(page.getByTestId('solve-stats')).toContainText('solved 0 of 2');
});

test('playing the revealed solution: the arrow goes and the move counts as best', async ({ page }) => {
  await loadFen(page, BACK_RANK);
  const solve = page.getByTestId('solve');
  await solve.getByRole('button', { name: 'Show solution' }).click({ timeout: 60_000 });
  await expect(page.getByTestId('solution')).toContainText('Rd8#');
  await expect(page.locator('svg.board polygon')).toHaveCount(1);
  await clickSquare(page, 'd1');
  await clickSquare(page, 'd8');
  await expect(page.getByTestId('verdict')).toContainText('Best move', { timeout: 60_000 });
  await expect(page.locator('svg.board polygon')).toHaveCount(0);
  await expect(page.getByTestId('solve-stats')).toContainText('Streak 0 · best 0 · solved 0 of 1');
});

test('the mode is remembered; the editor opens the position to analyse or to solve', async ({ page }) => {
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Solve' })).toHaveAttribute('aria-selected', 'true');

  await page.getByLabel('Edit position').click();
  await page.getByTestId('analyze').click();
  await expect(page.getByRole('tab', { name: 'Analyze' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('lines')).toBeVisible();

  await page.getByLabel('Edit position').click();
  await page.getByTestId('solve-it').click();
  await expect(page.getByRole('tab', { name: 'Solve' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('solve')).toBeVisible();
});
