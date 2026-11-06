import { expect, test } from '@playwright/test';
import { clickSquare, startFresh } from './helpers';

test.beforeEach(async ({ page }) => {
  await startFresh(page);
});

test('analyses the start position on the device', async ({ page }) => {
  await expect(page.getByTestId('status')).toHaveText('Starting Position');
  // Stockfish (WASM) reports a few plies within seconds
  await expect(page.getByTestId('depth')).toHaveText(/depth (1\d|2\d)\/22/, { timeout: 60_000 });
  await expect(page.getByTestId('eval')).toHaveText(/^[+-]?\d\.\d$/);
  await expect(page.locator('svg.board polygon').first()).toBeVisible(); // best-move arrow
  await expect(page.getByTestId('lines').locator('button.line')).toHaveCount(3);
  await expect(page.getByTestId('wdl')).toHaveCount(0); // off by default
});

test('plays moves, navigates history and switches the side to move', async ({ page }) => {
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await clickSquare(page, 'c7');
  await clickSquare(page, 'c5');
  await expect(page.getByTestId('fen')).toHaveText('rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  await expect(page.getByTestId('status')).toContainText('Sicilian Defense');

  await page.getByLabel('Back').click();
  await expect(page.getByTestId('fen')).toHaveText('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
  await page.getByLabel('Forward').click();
  await expect(page.getByTestId('moves')).toContainText('1.e4c5');

  await page.getByLabel('Black to move').click();
  await expect(page.getByTestId('fen')).toHaveText('rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2');
});

test('edits a position and refuses impossible side to move', async ({ page }) => {
  await page.getByLabel('Edit position').click();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByTestId('problems')).toContainText('White king is missing');
  await page.getByLabel('Place white king', { exact: true }).click();
  await clickSquare(page, 'g1');
  await page.getByLabel('Place black king', { exact: true }).click();
  await clickSquare(page, 'g8');
  await page.getByLabel('Place white rook', { exact: true }).click();
  await clickSquare(page, 'a8'); // gives check
  await expect(page.getByTestId('problems')).toContainText("Black is in check, so it can't be White's move");
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByTestId('analyze').click();
  await expect(page.getByTestId('fen')).toHaveText('R5k1/8/8/8/8/8/8/6K1 b - - 0 1');
  await expect(page.getByTestId('eval')).toHaveText(/^[+-]?\d|#/);
});

test('promotes a pawn with the piece picker', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'chessy.line.v1',
      JSON.stringify({ rootFen: '7k/P7/8/8/8/8/8/K7 w - - 0 1', moves: [], ply: 0 }),
    ),
  );
  await page.reload();
  await clickSquare(page, 'a7');
  await clickSquare(page, 'a8');
  await page.locator('.promo-choice[data-piece="n"]').dispatchEvent('pointerdown');
  await expect(page.getByTestId('fen')).toHaveText('N6k/8/8/8/8/8/8/K7 b - - 0 1');
  await expect(page.getByTestId('moves')).toContainText('a8=N');
});

test('tapping Board twice starts a new game, which can be undone', async ({ page }) => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  const rankAtTopLeft = () => page.locator('svg.board text').first().textContent();
  const home = page.getByLabel('Board', { exact: true });
  // already at the start: two taps just confirm, with nothing to undo
  await home.dblclick();
  await expect(page.locator('.toast')).toHaveText('New game');
  await expect(page.locator('.toast').getByRole('button')).toHaveCount(0);

  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await page.getByLabel('Flip board').click();
  await expect(page.getByTestId('fen')).toHaveText(afterE4);
  expect(await rankAtTopLeft()).toBe('1');

  // separate single taps keep the position
  await home.click();
  await page.waitForTimeout(800);
  await home.click();
  await expect(page.getByTestId('fen')).toHaveText(afterE4);

  // quick taps (here three): the starting position with White at the bottom; the
  // extra tap doesn't replace what Undo restores
  await home.click({ clickCount: 3 });
  await expect(page.getByTestId('fen')).toHaveText(start);
  expect(await rankAtTopLeft()).toBe('8');
  await expect(page.locator('.toast')).toContainText('New game');
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('fen')).toHaveText(afterE4);
  expect(await rankAtTopLeft()).toBe('1');
  await expect(page.locator('.toast')).toBeHidden();

  // from Settings, too
  await page.getByLabel('Settings').click();
  await home.dblclick();
  await expect(page.getByTestId('fen')).toHaveText(start);
});

test('a damaged saved position opens the start position instead of a blank screen', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'chessy.line.v1',
      JSON.stringify({ rootFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [null], ply: -1 }),
    ),
  );
  await page.reload();
  await expect(page.getByTestId('status')).toHaveText('Starting Position');
  await expect(page.getByTestId('crash')).toHaveCount(0);
});
