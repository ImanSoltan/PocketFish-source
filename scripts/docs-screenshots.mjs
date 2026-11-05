// Regenerates the README screenshots in docs/ from the production build:
//
//   npm run build && node scripts/docs-screenshots.mjs
//
// Uses Playwright's Chromium (set CHROMIUM_PATH to use another Chromium binary).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';
import { preview } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const docs = path.join(root, 'docs');
const fixtures = path.join(root, 'tests', 'fixtures');

const server = await preview({ root, logLevel: 'silent', preview: { host: '127.0.0.1', port: 4174, strictPort: true } });
const base = 'http://127.0.0.1:4174/';
// GPU emulation, so the glass bars' backdrop blur renders as on a phone (headless Chromium's default
// compositor leaves scrolled content behind them unblurred)
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});

/** A phone-sized page with the first-run tips already dismissed. */
async function phone(options = {}) {
  const context = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, ...options });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('chessy.tips-dismissed.v1', 'true');
    } catch {
      // about:blank
    }
  });
  return context.newPage();
}

try {
  const page = await phone();

  // analysis of the start position
  await page.goto(base);
  await page.getByTestId('depth').filter({ hasText: /depth (1[6-9]|2\d)\// }).waitFor({ timeout: 60_000 });
  await page.screenshot({ path: path.join(docs, 'analysis.png') });

  // scanning a photographed book page, then reviewing the result
  await page.getByTestId('scan').click();
  await page.getByTestId('file-input').setInputFiles(path.join(fixtures, 'book-photo.jpg'));
  await page.getByText('Adjust the corners').waitFor({ timeout: 60_000 });
  await page.screenshot({ path: path.join(docs, 'scan.png') });
  await page.getByTestId('recognize').click();
  await page.getByText('Check the position').waitFor({ timeout: 60_000 });
  await page.screenshot({ path: path.join(docs, 'review.png') });

  // the piece sets, as listed in Settings
  await page.goto(base);
  await page.getByLabel('Settings').click();
  const sets = await page
    .getByRole('radiogroup', { name: 'Piece set' })
    .getByRole('radio')
    .evaluateAll((els) => els.map((el) => ({ name: el.textContent, src: el.querySelector('img').getAttribute('src') })));
  const pieces = ['wK', 'wQ', 'wN', 'bK', 'bQ', 'bN'];
  const rows = sets
    .map(({ name, src }) => {
      const dir = src.slice(0, src.lastIndexOf('/') + 1);
      const squares = pieces.map((p, i) => `<i class="${i % 2 ? 'd' : 'l'}"><img src="${dir}${p}.svg"></i>`).join('');
      return `<div class="set"><b>${name}</b><span>${squares}</span></div>`;
    })
    .join('');
  const sheet = await browser.newPage({ viewport: { width: 900, height: 400 }, deviceScaleFactor: 2 });
  await sheet.setContent(`<base href="${base}">
    <style>
      body { margin: 0; font: 600 17px system-ui, sans-serif; color: #1d2430; }
      .sheet { display: inline-block; padding: 22px 24px; background: #f3f6fb; }
      .grid { display: grid; grid-template-columns: repeat(3, auto); gap: 14px 22px; justify-content: start; }
      .set { display: flex; flex-direction: column; gap: 6px; }
      span { display: flex; border-radius: 8px; overflow: hidden; }
      i { width: 44px; height: 44px; }
      i img { width: 44px; height: 44px; display: block; }
      .l { background: #e7edf6; } .d { background: #8ba3c4; }
    </style>
    <div class="sheet"><div class="grid">${rows}</div></div>`);
  await sheet.locator('.sheet').screenshot({ path: path.join(docs, 'piece-sets.png') });

  // solve mode on a puzzle (1.Qxf7#): looking for the move, a wrong try, the solution
  const solver = await phone({ viewport: { width: 390, height: 760 } });
  await solver.goto(base);
  await solver.evaluate(() => {
    const rootFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    localStorage.setItem('chessy.mode.v1', '"solve"');
    localStorage.setItem('chessy.line.v1', JSON.stringify({ rootFen, moves: [], ply: 0 }));
  });
  await solver.reload();
  const tap = async (sq) => {
    const box = await solver.locator('svg.board').boundingBox();
    const f = sq.charCodeAt(0) - 97;
    const r = 8 - Number(sq[1]);
    await solver.mouse.click(box.x + ((f + 0.5) * box.width) / 8, box.y + ((r + 0.5) * box.height) / 8);
  };
  const shots = [];
  await solver.getByRole('button', { name: 'Show solution' }).and(solver.locator(':enabled')).waitFor({ timeout: 60_000 });
  shots.push(await solver.screenshot());
  await tap('h5');
  await tap('h7');
  await solver.getByTestId('verdict').waitFor({ timeout: 60_000 });
  shots.push(await solver.screenshot());
  await solver.getByRole('button', { name: 'Try again' }).click();
  await tap('h5');
  await tap('f7');
  await solver.getByTestId('verdict').filter({ hasText: 'Best move' }).waitFor({ timeout: 60_000 });
  shots.push(await solver.screenshot());
  const strip = await browser.newPage({ viewport: { width: 1300, height: 800 }, deviceScaleFactor: 2 });
  await strip.setContent(`
    <style>
      body { margin: 0; }
      .strip { display: inline-flex; gap: 18px; padding: 18px; background: #dfe5ee; }
      img { width: 390px; border-radius: 18px; display: block; }
    </style>
    <div class="strip">${shots.map((b) => `<img src="data:image/png;base64,${b.toString('base64')}">`).join('')}</div>`);
  await strip.locator('.strip').screenshot({ path: path.join(docs, 'solve-mode.png') });

  // puzzles (0hW9J: Bxh7+ Nxh7 Qxh7#), solved, and a game against the engine
  const trainer = await phone({ viewport: { width: 390, height: 760 } });
  await trainer.goto(base);
  await trainer.evaluate(() => {
    const puzzles = {
      glicko: { rating: 1612, rd: 68, vol: 0.06 },
      played: [],
      tried: 23,
      solved: 17,
      streak: 4,
      bestStreak: 6,
      history: [1500, 1452, 1497, 1530, 1511, 1548, 1572, 1556, 1581, 1569, 1590, 1612],
      themes: {},
      current: '0hW9J',
      theme: '',
      difficulty: 'normal',
    };
    localStorage.setItem('chessy.puzzles.v1', JSON.stringify(puzzles));
  });
  await trainer.reload();
  const tapT = async (sq) => {
    const box = await trainer.locator('svg.board').boundingBox();
    const f = sq.charCodeAt(0) - 97;
    const r = 8 - Number(sq[1]);
    await trainer.mouse.click(box.x + ((f + 0.5) * box.width) / 8, box.y + ((r + 0.5) * box.height) / 8);
  };
  const train = [];
  await trainer.getByLabel('Puzzles', { exact: true }).click();
  const puzzle = trainer.locator('[data-puzzle-id="0hW9J"]');
  await puzzle.and(trainer.locator('[data-phase="play"][data-ply="1"]')).waitFor();
  train.push(await trainer.screenshot());
  await tapT('d3');
  await tapT('h7');
  await puzzle.and(trainer.locator('[data-phase="play"][data-ply="3"]')).waitFor();
  await tapT('h6');
  await tapT('h7');
  await puzzle.and(trainer.locator('[data-phase="done"]')).waitFor();
  await trainer.waitForTimeout(300);
  train.push(await trainer.screenshot());
  await trainer.evaluate(() => {
    const rootFen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5';
    localStorage.setItem('chessy.mode.v1', '"play"');
    localStorage.setItem('chessy.play.v1', JSON.stringify({ color: 'w', level: 4, root: rootFen }));
    localStorage.setItem('chessy.line.v1', JSON.stringify({ rootFen, moves: [], ply: 0 }));
  });
  await trainer.reload();
  await tapT('d2');
  await tapT('d4');
  await trainer.getByTestId('moves').locator('.mv').nth(2).waitFor({ timeout: 60_000 });
  await trainer.getByTestId('play-title').filter({ hasText: 'Your move' }).waitFor();
  await trainer.locator('main').evaluate((m) => m.scrollTo(0, 0));
  train.push(await trainer.screenshot());
  await strip.setContent(`
    <style>
      body { margin: 0; }
      .strip { display: inline-flex; gap: 18px; padding: 18px; background: #dfe5ee; }
      img { width: 390px; border-radius: 18px; display: block; }
    </style>
    <div class="strip">${train.map((b) => `<img src="data:image/png;base64,${b.toString('base64')}">`).join('')}</div>`);
  await strip.locator('.strip').screenshot({ path: path.join(docs, 'puzzles-play.png') });
} finally {
  await browser.close();
  await server.close();
}
console.log('wrote docs/analysis.png, scan.png, review.png, piece-sets.png, solve-mode.png, puzzles-play.png');
