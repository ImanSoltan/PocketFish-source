// Images for the website and social posts (press-kit/), taken from the real app:
//
//   npm run build && node scripts/press-kit.mjs
//
// screens/raw/   full-resolution screenshots (iPhone 15 size, 1179 × 2556 px)
// screens/       the same, as rounded phone screens with a soft shadow on a transparent background
// images/        hero-phones.png (three phones, transparent), social-card.png (link previews, 1200 × 630 @2x),
//                square-post.png (1080 × 1080), the app icon in light and dark
// Uses Playwright's Chromium (CHROMIUM_PATH to override).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const kit = path.join(root, 'press-kit');
const fixtures = path.join(root, 'tests', 'fixtures');
for (const dir of ['screens/raw', 'images']) fs.mkdirSync(path.join(kit, dir), { recursive: true });

const server = await preview({ root, logLevel: 'silent', preview: { host: '127.0.0.1', port: 4176, strictPort: true } });
const base = 'http://127.0.0.1:4176/';
// GPU emulation, so the glass bars' backdrop blur renders as on a phone (headless Chromium's default
// compositor leaves scrolled content behind them unblurred)
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});

const ITALIAN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5';
const SCHOLAR = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
const line = (fen) => JSON.stringify({ rootFen: fen, moves: [], ply: 0 });
/** a player a few weeks in, about to play 0hW9J (Bxh7+ Nxh7 Qxh7#) */
const PUZZLER = JSON.stringify({
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
});

/** The app on an iPhone 15 (393 × 852 points, 3x), first-run tips dismissed. */
async function phone(storage = {}) {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  });
  await context.addInitScript((entries) => {
    try {
      localStorage.setItem('chessy.tips-dismissed.v1', 'true');
      for (const [k, v] of Object.entries(entries)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
    } catch {
      // about:blank
    }
  }, storage);
  return context.newPage();
}

const tapper = (page) => async (sq) => {
  const box = await page.locator('svg.board').first().boundingBox();
  const f = sq.charCodeAt(0) - 97;
  const r = 8 - Number(sq[1]);
  await page.mouse.click(box.x + ((f + 0.5) * box.width) / 8, box.y + ((r + 0.5) * box.height) / 8);
};

const shots = {};
const take = async (name, page) => {
  await page.waitForTimeout(250);
  shots[name] = await page.screenshot();
  fs.writeFileSync(path.join(kit, 'screens', 'raw', `${name}.png`), shots[name]);
};
const src = (name) => `data:image/png;base64,${shots[name].toString('base64')}`;

try {
  // scanning a photographed book page, then the recognised position
  let page = await phone();
  await page.goto(base);
  await page.getByTestId('scan').click();
  await page.getByTestId('file-input').setInputFiles(path.join(fixtures, 'book-photo.jpg'));
  await page.getByText('Adjust the corners').waitFor({ timeout: 60_000 });
  await take('1-scan', page);
  await page.getByTestId('recognize').click();
  await page.getByText('Check the position').waitFor({ timeout: 60_000 });
  await take('2-review', page);

  // analysis
  page = await phone({ 'chessy.line.v1': line(ITALIAN) });
  await page.goto(base);
  await page.getByTestId('depth').filter({ hasText: /depth (1[89]|2\d)\// }).waitFor({ timeout: 90_000 });
  await take('3-analyze', page);

  // solve mode
  page = await phone({ 'chessy.line.v1': line(SCHOLAR), 'chessy.mode.v1': '"solve"' });
  await page.goto(base);
  await page.getByRole('button', { name: 'Show solution' }).and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  let tap = tapper(page);
  await tap('h5');
  await tap('f7');
  await page.getByTestId('verdict').filter({ hasText: 'Best move' }).waitFor({ timeout: 60_000 });
  await take('4-solve', page);

  // a rated puzzle, solved
  page = await phone({ 'chessy.puzzles.v1': PUZZLER });
  await page.goto(base);
  await page.getByLabel('Puzzles', { exact: true }).click();
  const puzzle = page.locator('[data-puzzle-id="0hW9J"]');
  await puzzle.and(page.locator('[data-phase="play"][data-ply="1"]')).waitFor();
  tap = tapper(page);
  await tap('d3');
  await tap('h7');
  await puzzle.and(page.locator('[data-phase="play"][data-ply="3"]')).waitFor();
  await tap('h6');
  await tap('h7');
  await puzzle.and(page.locator('[data-phase="done"]')).waitFor();
  await take('5-puzzles', page);

  // a game against the engine
  page = await phone({
    'chessy.line.v1': line(ITALIAN),
    'chessy.mode.v1': '"play"',
    'chessy.play.v1': JSON.stringify({ color: 'w', level: 4, root: ITALIAN }),
  });
  await page.goto(base);
  tap = tapper(page);
  await tap('d2');
  await tap('d4');
  await page.getByTestId('moves').locator('.mv').nth(2).waitFor({ timeout: 60_000 });
  await page.getByTestId('play-title').filter({ hasText: 'Your move' }).waitFor();
  await take('6-play', page);

  // private by design
  page = await phone();
  await page.goto(base);
  await page.getByLabel('Settings').click();
  await page.getByTestId('privacy').evaluate((el) => {
    const main = document.querySelector('main');
    main.scrollTop += el.previousElementSibling.getBoundingClientRect().top - 74;
  });
  await take('7-privacy', page);

  // dark mode
  page = await phone({
    'chessy.line.v1': line(ITALIAN),
    'chessy.settings.v1': JSON.stringify({ scheme: 'midnight', theme: 'slate' }),
  });
  await page.goto(base);
  await page.getByTestId('depth').filter({ hasText: /depth (1[89]|2\d)\// }).waitFor({ timeout: 90_000 });
  await take('8-dark', page);

  const canvas = await browser.newPage({ deviceScaleFactor: 2 });
  const FONT = "'Inter', -apple-system, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif";
  const phoneCss = `
    .phone { display: block; border-radius: 13.5% / 6.2%; border: 1px solid rgba(15, 23, 42, 0.14);
             box-shadow: 0 30px 60px -18px rgba(15, 23, 42, 0.45), 0 10px 22px -10px rgba(15, 23, 42, 0.3); }`;
  const render = async (file, width, height, html, transparent = false) => {
    await canvas.setViewportSize({ width, height });
    await canvas.setContent(`<style>body { margin: 0; font-family: ${FONT}; } ${phoneCss}</style>${html}`);
    await canvas.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    await canvas.screenshot({ path: path.join(kit, file), omitBackground: transparent });
  };

  // every screen as a rounded phone screen with a soft shadow
  for (const name of Object.keys(shots)) {
    await render(
      `screens/${name}.png`,
      393 + 120,
      852 + 120,
      `<div style="padding: 40px 60px 80px"><img class="phone" src="${src(name)}" width="393"></div>`,
      true,
    );
  }

  // three phones for a hero section
  await render(
    'images/hero-phones.png',
    1200,
    860,
    `<div style="position: relative; width: 1200px; height: 860px">
       <img class="phone" src="${src('1-scan')}" style="position: absolute; left: 150px; top: 110px; width: 300px; transform: rotate(-6deg)">
       <img class="phone" src="${src('5-puzzles')}" style="position: absolute; right: 150px; top: 110px; width: 300px; transform: rotate(6deg)">
       <img class="phone" src="${src('3-analyze')}" style="position: absolute; left: 430px; top: 30px; width: 340px">
     </div>`,
    true,
  );

  const icon = `data:image/svg+xml;base64,${fs.readFileSync(path.join(root, 'public', 'icon.svg')).toString('base64')}`;
  const backdrop = `background: radial-gradient(80% 70% at 85% 10%, #60a5fa 0%, transparent 60%),
                    radial-gradient(70% 60% at 0% 100%, #1e3a8a 0%, transparent 70%),
                    linear-gradient(150deg, #3b82f6 0%, #2563eb 45%, #1e3a8a 100%); color: #fff;`;
  const pill = (text) =>
    `<span style="display: inline-flex; align-items: center; gap: 10px; padding: 9px 18px; border-radius: 999px;
       background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.35); font-size: 20px; font-weight: 600;
       backdrop-filter: blur(10px)"><span style="width: 10px; height: 10px; border-radius: 50%; background: #4ade80;
       box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.25)"></span>${text}</span>`;

  // link previews (Open Graph / LinkedIn / X): 1200 × 630
  await render(
    'images/social-card.png',
    1200,
    630,
    `<div style="position: relative; width: 1200px; height: 630px; overflow: hidden; ${backdrop}">
       <div style="position: absolute; left: 72px; top: 70px; width: 560px">
         <div style="display: flex; align-items: center; gap: 20px">
           <img src="${icon}" width="88" height="88" style="border-radius: 22%; box-shadow: 0 10px 30px rgba(15,23,42,0.35)">
           <div style="font-size: 64px; font-weight: 800; letter-spacing: -1.5px">PocketFish</div>
         </div>
         <div style="margin-top: 26px; font-size: 34px; font-weight: 700; line-height: 1.2; letter-spacing: -0.5px">
           Scan a chess diagram.<br>Analyse it with Stockfish.</div>
         <div style="margin-top: 16px; font-size: 22px; line-height: 1.45; opacity: 0.9">
           Rated puzzles and games against the engine too — all on your iPhone, offline and private.</div>
         <div style="margin-top: 30px">${pill('Now in beta testing on iPhone')}</div>
       </div>
       <img class="phone" src="${src('3-analyze')}" style="position: absolute; left: 700px; top: 70px; width: 290px; transform: rotate(-4deg)">
       <img class="phone" src="${src('5-puzzles')}" style="position: absolute; left: 905px; top: 150px; width: 260px; transform: rotate(5deg)">
       <div style="position: absolute; left: 72px; bottom: 34px; font-size: 18px; opacity: 0.75">An app by Agile With AI</div>
     </div>`,
  );

  // a square post: 1080 × 1080
  await canvas.setViewportSize({ width: 1080, height: 1080 });
  await render(
    'images/square-post.png',
    1080,
    1080,
    `<div style="position: relative; width: 1080px; height: 1080px; overflow: hidden; ${backdrop}">
       <div style="position: absolute; left: 0; right: 0; top: 70px; text-align: center">
         ${pill('Now testing')}
         <div style="margin-top: 26px; font-size: 76px; font-weight: 800; letter-spacing: -2px">PocketFish</div>
         <div style="margin-top: 10px; font-size: 32px; font-weight: 600; opacity: 0.92">Stockfish in your pocket</div>
       </div>
       <img class="phone" src="${src('1-scan')}" style="position: absolute; left: 95px; top: 400px; width: 290px; transform: rotate(-7deg)">
       <img class="phone" src="${src('5-puzzles')}" style="position: absolute; right: 95px; top: 400px; width: 290px; transform: rotate(7deg)">
       <img class="phone" src="${src('3-analyze')}" style="position: absolute; left: 380px; top: 340px; width: 320px">
     </div>`,
  );

  // the app icon
  for (const [from, to] of [
    ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 'images/app-icon.png'],
    ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-dark.png', 'images/app-icon-dark.png'],
    ['public/icon.svg', 'images/app-icon.svg'],
    ['public/icon-dark.svg', 'images/app-icon-dark.svg'],
  ]) {
    fs.copyFileSync(path.join(root, from), path.join(kit, to));
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`wrote ${Object.keys(shots).length} screens and the images to press-kit/`);
