import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

/** The recognition models are only in the private repository, not in the public source. */
export const hasModels = fs.existsSync(fileURLToPath(new URL('../../public/models/board.bin', import.meta.url)));
export const NO_MODELS = 'needs the recognition models, which are not part of the public source';

/**
 * Opens the app with nothing stored, as on a first start, except that the first-run tips are already dismissed
 * (they float over the screen and would catch the taps). The tests about the tips clear everything instead.
 */
export async function startFresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('chessy.tips-dismissed.v1', 'true');
  });
  await page.reload();
}

/** Screen position of a square's centre on the (first) board, scrolled into view. */
export async function square(page: Page, name: string) {
  const board = page.locator('svg.board').first();
  await board.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = (await board.boundingBox())!;
  const black = (await board.getAttribute('data-orientation')) === 'b';
  let f = name.charCodeAt(0) - 97;
  let r = 8 - Number(name[1]);
  if (black) [f, r] = [7 - f, 7 - r];
  return { x: box.x + ((f + 0.5) * box.width) / 8, y: box.y + ((r + 0.5) * box.height) / 8 };
}

export async function clickSquare(page: Page, name: string) {
  const p = await square(page, name);
  await page.mouse.click(p.x, p.y);
}

/** Load a position through the FEN field of the analysis screen. */
export async function loadFen(page: Page, fen: string) {
  await page.getByTestId('fen').click();
  const input = page.getByLabel('FEN', { exact: true });
  await input.fill(fen);
  await input.press('Enter');
}

/** Play a UCI move on the board (choosing the promotion piece if there is one). */
export async function playUci(page: Page, uci: string) {
  await clickSquare(page, uci.slice(0, 2));
  await clickSquare(page, uci.slice(2, 4));
  if (uci[4]) await page.locator(`.promo-choice[data-piece="${uci[4]}"]`).dispatchEvent('pointerdown');
}
