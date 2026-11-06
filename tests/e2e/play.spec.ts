import { expect, test } from '@playwright/test';
import { clickSquare, loadFen, startFresh } from './helpers';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BACK_RANK = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'; // 1.Rd8#

test.beforeEach(async ({ page }) => {
  await startFresh(page);
  await page.getByRole('tab', { name: 'Play' }).click();
});

test('the engine answers; take back and switch sides', async ({ page }) => {
  const card = page.getByTestId('play');
  await expect(page.getByTestId('play-title')).toHaveText('Your move');
  await expect(page.getByTestId('lines')).toHaveCount(0);
  await expect(page.getByTestId('eval')).toHaveCount(0);

  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect(page.getByTestId('moves').locator('.mv')).toHaveCount(3, { timeout: 30_000 }); // "start" and two moves
  await expect(page.getByTestId('play-title')).toHaveText('Your move');
  await expect(page.getByTestId('fen')).toHaveText(/ w KQkq \S+ \d+ 2$/);

  await card.getByRole('button', { name: 'Take back' }).click();
  await expect(page.getByTestId('fen')).toHaveText(START);
  await expect(card.getByRole('button', { name: 'Take back' })).toBeDisabled();

  // the engine takes White and moves; the board turns round
  await card.getByRole('button', { name: 'Switch sides' }).click();
  await expect(page.locator('svg.board')).toHaveAttribute('data-orientation', 'b');
  await expect(page.getByTestId('fen')).toHaveText(/ b KQkq \S+ \d+ 1$/, { timeout: 30_000 }); // any first move
  await expect(page.getByTestId('play-title')).toHaveText('Your move');
});

test('captured pieces and the lead in material', async ({ page }) => {
  // White's queen against Black's rook: White is 4 up before anything is taken
  await loadFen(page, '4k3/8/8/8/8/8/r7/Q3K3 w - - 0 1');
  const white = page.getByTestId('material-w');
  const black = page.getByTestId('material-b');
  await expect(white.getByTestId('material-lead')).toHaveText('+4');
  await expect(white.locator('img')).toHaveCount(0);
  await expect(black.getByTestId('material-lead')).toHaveCount(0);
  // the player's row is under the board, the engine's above it
  const board = (await page.locator('svg.board').boundingBox())!;
  expect((await white.boundingBox())!.y).toBeGreaterThan(board.y);
  expect((await black.boundingBox())!.y).toBeLessThan(board.y);

  await clickSquare(page, 'a1');
  await clickSquare(page, 'a2');
  await expect(white.getByRole('img', { name: 'black rook' })).toBeVisible();
  await expect(white.getByTestId('material-lead')).toHaveText('+9');
  await expect(white).toHaveAttribute('aria-label', 'Taken by White');

  // not shown in the other modes
  await page.getByRole('tab', { name: 'Analyze' }).click();
  await expect(white).toHaveCount(0);
});

test('resigning a game, after asking once more', async ({ page }) => {
  const card = page.getByTestId('play');
  const resign = card.getByRole('button', { name: 'Resign', exact: true });
  await expect(resign).toBeDisabled(); // no game yet

  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await expect(page.getByTestId('moves').locator('.mv')).toHaveCount(3, { timeout: 30_000 });
  await resign.click();
  await expect(card.getByText('Resign this game?')).toBeVisible();
  await card.getByRole('button', { name: 'Keep playing' }).click();
  await expect(card.getByText('Resign this game?')).toHaveCount(0);
  await expect(page.getByTestId('play-title')).toHaveText('Your move');

  await resign.click();
  await page.getByTestId('resign-confirm').click();
  await expect(page.getByTestId('play-title')).toHaveText('You resigned — Stockfish wins');
  await expect(resign).toHaveCount(0);
  // the board takes no more moves
  const fen = await page.getByTestId('fen').textContent();
  await clickSquare(page, 'd2');
  await clickSquare(page, 'd4');
  await expect(page.getByTestId('fen')).toHaveText(fen!);

  // still resigned after a restart of the app; Play again starts over
  await page.reload();
  await expect(page.getByTestId('play-title')).toHaveText('You resigned — Stockfish wins');
  await page.getByTestId('play-again').click();
  await expect(page.getByTestId('fen')).toHaveText(START);
  await expect(page.getByTestId('play-title')).toHaveText('Your move');
  await expect(resign).toBeDisabled();
});

test('a win, playing again and analysing the game', async ({ page }) => {
  await loadFen(page, BACK_RANK);
  await expect(page.getByTestId('play-title')).toHaveText('Your move');
  await clickSquare(page, 'd1');
  await clickSquare(page, 'd8');
  await expect(page.getByTestId('play-title')).toHaveText('Checkmate — you win!');

  await page.getByTestId('play-again').click();
  await expect(page.getByTestId('fen')).toHaveText(BACK_RANK);
  await clickSquare(page, 'd1');
  await clickSquare(page, 'd8');
  await page.getByTestId('play').getByRole('button', { name: 'Analyze the game' }).click();
  await expect(page.getByRole('tab', { name: 'Analyze' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('moves')).toContainText('Rd8#');
  await expect(page.getByTestId('eval')).toHaveText('1-0');
});

test('in a new position the player takes the side to move; full strength finds the mate; the level is kept', async ({
  page,
}) => {
  await page.getByRole('radio', { name: /^Level 8/ }).click();
  await expect(page.getByTestId('level-name')).toHaveText('8 · Full strength');

  // Black to move (and to mate with Rd1#): the player gets Black …
  await loadFen(page, '3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1');
  await expect(page.locator('svg.board')).toHaveAttribute('data-orientation', 'b');
  await expect(page.getByTestId('play-title')).toHaveText('Your move');
  // … and hands it to the engine
  await page.getByTestId('play').getByRole('button', { name: 'Switch sides' }).click();
  await expect(page.getByTestId('play-title')).toHaveText('Checkmate — Stockfish wins', { timeout: 30_000 });
  await expect(page.getByTestId('moves')).toContainText('Rd1#');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('level-name')).toHaveText('8 · Full strength');
  await expect(page.getByTestId('play-title')).toHaveText('Checkmate — Stockfish wins');
});
