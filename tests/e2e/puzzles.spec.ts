import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { Chess } from 'chess.js';
import { playUci } from './helpers';

interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

const file = JSON.parse(readFileSync(new URL('../../public/puzzles.json', import.meta.url), 'utf8')) as {
  themes: string[];
  puzzles: [string, string, string, number, number[]][];
};
const PUZZLES = new Map<string, Puzzle>(
  file.puzzles.map(([id, fen, moves, rating, themes]) => [
    id,
    { id, fen, moves: moves.split(' '), rating, themes: themes.map((i) => file.themes[i]) },
  ]),
);

const board = (page: Page) => page.locator('[data-puzzle-id]');
const card = (page: Page) => page.getByTestId('puzzle');

async function current(page: Page): Promise<Puzzle> {
  return PUZZLES.get((await board(page).getAttribute('data-puzzle-id'))!)!;
}

/** Waits until it's the solver's turn after `ply` moves. */
async function turn(page: Page, ply: number) {
  await expect(board(page)).toHaveAttribute('data-ply', String(ply));
  await expect(board(page)).toHaveAttribute('data-phase', 'play');
}

/** Plays the solver's moves from the move at `from` on. */
async function solve(page: Page, p: Puzzle, from = 1) {
  for (let i = from; i < p.moves.length; i += 2) {
    await turn(page, i);
    await playUci(page, p.moves[i]);
  }
  await expect(board(page)).toHaveAttribute('data-phase', 'done');
}

/** A legal move after the opponent's first move that is neither the solution nor a mate. */
function wrongMove(p: Puzzle) {
  const c = new Chess(p.fen);
  c.move({ from: p.moves[0].slice(0, 2), to: p.moves[0].slice(2, 4), promotion: p.moves[0][4] });
  return c.moves({ verbose: true }).find((m) => m.lan !== p.moves[1] && !m.san.includes('#'))!;
}

const rating = async (page: Page) => Number((await page.getByTestId('rating').textContent())!.replace('?', ''));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Puzzles', { exact: true }).click();
});

test('a puzzle solved at the first try raises the rating; Analyze opens it with the solution', async ({ page }) => {
  await expect(page.getByTestId('rating')).toHaveText('1500?');
  const p = await current(page);
  const solver = p.fen.split(' ')[1] === 'w' ? 'b' : 'w';
  await expect(page.locator('svg.board')).toHaveAttribute('data-orientation', solver);
  await expect(card(page)).toContainText(`${solver === 'w' ? 'White' : 'Black'} to play`);
  await expect(page.getByTestId('puzzle-level')).toHaveText('rated ?');

  await solve(page, p);
  await expect(page.getByTestId('puzzle-title')).toHaveText('Solved!');
  await expect(page.getByTestId('delta')).toHaveText(/^\+\d+$/);
  expect(await rating(page)).toBeGreaterThan(1500);
  await expect(page.getByTestId('puzzle-stats')).toContainText('streak 1 · solved 1 of 1');
  await expect(page.getByTestId('puzzle-level')).toHaveText(`rated ${p.rating}`);
  await expect(page.getByTestId('puzzle-moves').locator('.mv')).toHaveCount(p.moves.length);

  await card(page).getByRole('button', { name: 'Analyze' }).click();
  const c = new Chess(p.fen);
  c.move({ from: p.moves[0].slice(0, 2), to: p.moves[0].slice(2, 4), promotion: p.moves[0][4] });
  await expect(page.getByTestId('fen')).toHaveText(c.fen());
  await expect(page.getByTestId('moves').locator('.mv')).toHaveCount(p.moves.length + 1); // and "start"
  await expect(page.locator('svg.board')).toHaveAttribute('data-orientation', solver);

  // back on Puzzles: the next one
  await page.getByLabel('Puzzles', { exact: true }).click();
  await expect(board(page)).not.toHaveAttribute('data-puzzle-id', p.id);
  await expect(page.getByTestId('puzzle-stats')).toContainText('solved 1 of 1');
});

test('a wrong move counts as a miss; try again, the solution and the next puzzle', async ({ page }) => {
  const p = await current(page);
  await turn(page, 1);
  const wrong = wrongMove(p);
  await playUci(page, wrong.lan);
  await expect(page.getByTestId('puzzle-title')).toContainText(`${wrong.san} isn't the move`);
  await expect(page.getByTestId('delta')).toHaveText(/^−\d+$/);
  expect(await rating(page)).toBeLessThan(1500);
  await expect(page.getByTestId('puzzle-stats')).toContainText('streak 0 · solved 0 of 1');

  await card(page).getByRole('button', { name: 'Try again' }).click();
  await turn(page, 1);
  await card(page).getByRole('button', { name: 'Show solution' }).click();
  await expect(page.getByTestId('puzzle-title')).toHaveText('Solution');
  const moves = page.getByTestId('puzzle-moves').locator('.mv');
  await expect(moves).toHaveCount(p.moves.length);
  await expect(moves.nth(1)).toHaveClass(/current/); // the solver's move
  await page.getByLabel('Back', { exact: true }).click();
  await expect(moves.nth(0)).toHaveClass(/current/);
  await expect(page.getByLabel('Back', { exact: true })).toBeDisabled();
  await page.getByLabel('Forward', { exact: true }).click();
  await expect(moves.nth(1)).toHaveClass(/current/);

  await page.getByTestId('next-puzzle').click();
  await expect(board(page)).not.toHaveAttribute('data-puzzle-id', p.id);
  await expect(card(page)).toContainText('to play');
  await expect(page.getByTestId('puzzle-stats')).toContainText('solved 0 of 1');
  await expect(page.getByTestId('delta')).toHaveCount(0);
});

test('a hint highlights the piece to move, and the puzzle counts as missed', async ({ page }) => {
  const p = await current(page);
  await turn(page, 1);
  await card(page).getByRole('button', { name: 'Hint' }).click();
  await expect(page.locator('svg.board rect[style*="--hint"]')).toHaveCount(1);
  await expect(page.getByTestId('delta')).toHaveText(/^−\d+$/);

  await solve(page, p);
  await expect(page.getByTestId('puzzle-title')).toHaveText('Solved');
  await expect(card(page)).toContainText('With a hint, so it counts as missed.');
  await expect(page.getByTestId('puzzle-stats')).toContainText('solved 0 of 1');
});

test('theme and difficulty filters; an unfinished puzzle is still there later', async ({ page }) => {
  await page.getByTestId('theme').selectOption('mateIn2');
  await expect(async () => expect((await current(page)).themes).toContain('mateIn2')).toPass();
  const easy = await current(page);
  await page.getByRole('radio', { name: 'Harder' }).click();
  await expect(board(page)).not.toHaveAttribute('data-puzzle-id', easy.id);
  const p = await current(page);
  expect(p.themes).toContain('mateIn2');
  expect(p.rating).toBeGreaterThan(1600);
  await expect(page.getByTestId('puzzle-stats')).toContainText('solved 0 of 0'); // switching doesn't count

  await page.getByLabel('Board', { exact: true }).click();
  await page.getByLabel('Puzzles', { exact: true }).click();
  await expect(board(page)).toHaveAttribute('data-puzzle-id', p.id);

  await page.reload();
  await page.getByLabel('Puzzles', { exact: true }).click();
  await expect(board(page)).toHaveAttribute('data-puzzle-id', p.id);
  await expect(page.getByTestId('theme')).toHaveValue('mateIn2');
  await expect(page.getByRole('radio', { name: 'Harder' })).toHaveAttribute('aria-checked', 'true');
});

test('the puzzle of the day', async ({ page }) => {
  const daily = page.getByTestId('daily');
  await expect(daily).toContainText('A new one every day');
  await daily.click();
  await expect(page.getByTestId('puzzle-name')).toHaveText('Puzzle of the day');
  await expect(daily).toBeDisabled();
  await solve(page, await current(page));
  await expect(daily).toContainText('Solved today ✓');
  await page.getByTestId('next-puzzle').click();
  await expect(page.getByTestId('puzzle-name')).toHaveText(/^Puzzle \w+$/);
  await expect(daily).toBeEnabled();
});
