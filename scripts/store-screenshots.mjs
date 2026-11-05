// App Store screenshots (6.9-inch iPhone, 1320 × 2868) with a caption above the app:
//
//   npm run build && node scripts/store-screenshots.mjs [en|de|es|fr|all]
//
// Writes store/screenshots/*.jpg (English) or store/screenshots/<language>/*.jpg: JPEG, which App Store
// Connect takes too, at a third of the PNG size. Uses Playwright's Chromium (CHROMIUM_PATH to override).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { bookPage } from './book-page.mjs';
import { preview } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixtures = path.join(root, 'tests', 'fixtures');

/** Captions (title, with *words* set in gold, and line below): first the book screenshot, then the app screenshots in order; the same as in
 * store/listing*.md. */
const CAPTIONS = {
  en: [
    ['The companion for every *chess book*', 'Scan a diagram, ask Stockfish, play on'],
    ['*Straight* from the page', 'Books, magazines or screenshots'],
    ['Every piece, *recognised*', 'Check it and fix anything in a tap'],
    ['What the book *doesn’t explain*', 'Stockfish shows the best moves and lines'],
    ['Solve the book’s *puzzles*', 'Every answer graded, hints when you need them'],
    ['*Rated puzzles*, offline', 'Thousands of tactics and a daily puzzle'],
    ['*Play on* from the page', 'Against Stockfish, from beginner to full strength'],
    ['*Private* by design', 'No account, no tracking, works offline'],
    ['Make it *yours*', '6 piece sets, 5 colour schemes, dark mode'],
  ],
  de: [
    ['Der Begleiter für jedes *Schachbuch*', 'Diagramm scannen, Stockfish fragen, weiterspielen'],
    ['*Direkt* von der Buchseite', 'Bücher, Zeitschriften oder Bildschirmfotos'],
    ['Jede Figur *erkannt*', 'Prüfen und mit einem Tippen korrigieren'],
    ['Was das Buch *nicht erklärt*', 'Stockfish zeigt die besten Züge und Varianten'],
    ['Löse die *Aufgaben* im Buch', 'Jede Antwort bewertet, Tipps, wenn du sie brauchst'],
    ['*Bewertete Aufgaben*, offline', 'Tausende Taktiken und eine Aufgabe des Tages'],
    ['*Spiel* von der Seite *weiter*', 'Gegen Stockfish, vom Anfänger bis zur vollen Stärke'],
    ['*Privat* von Grund auf', 'Kein Konto, kein Tracking, funktioniert offline'],
    ['Ganz nach *deinem Geschmack*', '6 Figurensätze, 5 Farbschemata, Dunkelmodus'],
  ],
  es: [
    ['El compañero de todo *libro de ajedrez*', 'Escanea, pregunta a Stockfish y sigue jugando'],
    ['*Directo* desde la página', 'Libros, revistas o capturas de pantalla'],
    ['Cada pieza, *reconocida*', 'Revísala y corrige lo que haga falta con un toque'],
    ['Lo que el libro *no explica*', 'Stockfish muestra las mejores jugadas y líneas'],
    ['Resuelve los *problemas* del libro', 'Cada respuesta evaluada, pistas cuando las necesites'],
    ['*Problemas* sin conexión', 'Miles de tácticas y un problema del día'],
    ['*Sigue jugando* desde la página', 'Contra Stockfish, de principiante a máxima fuerza'],
    ['*Privado* por diseño', 'Sin cuenta, sin rastreo, funciona sin conexión'],
    ['A *tu gusto*', '6 juegos de piezas, 5 esquemas de color, modo oscuro'],
  ],
  fr: [
    ['Le compagnon de tous vos *livres d’échecs*', 'Scannez, consultez Stockfish, jouez la suite'],
    ['*Directement* depuis la page', 'Livres, magazines ou captures d’écran'],
    ['Chaque pièce *reconnue*', 'Vérifiez et corrigez d’un toucher'],
    ['Ce que le livre *n’explique pas*', 'Stockfish montre les meilleurs coups et variantes'],
    ['Résolvez les *problèmes* du livre', 'Chaque réponse notée, des indices au besoin'],
    ['*Problèmes classés*, hors ligne', 'Des milliers de tactiques et un problème du jour'],
    ['*Jouez la suite* depuis la page', 'Contre Stockfish, de débutant à pleine puissance'],
    ['*Confidentiel* par conception', 'Sans compte, sans pistage, fonctionne hors ligne'],
    ['À *votre goût*', '6 jeux de pièces, 5 thèmes de couleurs, mode sombre'],
  ],
};
const LOCALES = { en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };
const composeOnly = process.argv.includes('--compose');
const arg = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'en';
const languages = arg === 'all' ? Object.keys(CAPTIONS) : [arg];
if (!languages.every((l) => CAPTIONS[l])) throw new Error(`unknown language ${arg}: use ${Object.keys(CAPTIONS).join(', ')} or all`);

/** The app's texts in a language, from src/i18n/<language>.ts, to find buttons by their label. */
function messages(lang) {
  const src = fs.readFileSync(path.join(root, 'src', 'i18n', `${lang}.ts`), 'utf8');
  const m = {};
  for (const [, key, a, b] of src.matchAll(/'([\w.]+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g))
    m[key] = (a ?? b).replace(/\\(.)/g, '$1');
  return m;
}

const server = await preview({ root, logLevel: 'silent', preview: { host: '127.0.0.1', port: 4175, strictPort: true } });
const base = 'http://127.0.0.1:4175/';
// GPU emulation, so the glass bars' backdrop blur renders as on a phone (headless Chromium's default
// compositor leaves scrolled content behind them unblurred)
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});

const ITALIAN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5';
const SCHOLAR = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

/** The app on a large iPhone (430 × 932 points, 3x) in a language, first-run tips dismissed. */
async function phone(lang, storage = {}) {
  const settings = { ...JSON.parse(storage['chessy.settings.v1'] ?? '{}'), language: lang };
  storage = { ...storage, 'chessy.settings.v1': JSON.stringify(settings) };
  const context = await browser.newContext({
    locale: LOCALES[lang],
    viewport: { width: 430, height: 932 },
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
  const board = page.locator('svg.board').first();
  const box = await board.boundingBox();
  const f = sq.charCodeAt(0) - 97;
  const r = 8 - Number(sq[1]);
  await page.mouse.click(box.x + ((f + 0.5) * box.width) / 8, box.y + ((r + 0.5) * box.height) / 8);
};

const line = (fen) => JSON.stringify({ rootFen: fen, moves: [], ply: 0 });

/** a player with a few weeks of puzzles behind them, about to play 0hW9J (Bxh7+ Nxh7 Qxh7#) */
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
const BOOK_FILE = '0-book';
const FILES = ['1-scan', '2-review', '3-analyze', '4-solve', '5-puzzles', '6-play', '7-private', '8-themes'];
let written = 0;

try {
  for (const lang of languages) await screenshots(lang);
} finally {
  await browser.close();
  await server.close();
}
console.log(`wrote ${written} screenshots (${languages.join(', ')}) to store/screenshots/`);

async function screenshots(lang) {
  const m = messages(lang);
  const shots = [];
  const shot = async (page) => shots.push(await page.screenshot());
  const cache = path.join(root, 'playwright-report', 'store-raw', lang);
  if (composeOnly) {
    for (const file of FILES) shots.push(fs.readFileSync(path.join(cache, `${file}.png`)));
  } else {

  // 1. scanning a book page
  let page = await phone(lang);
  await page.goto(base);
  await page.getByTestId('scan').click();
  await page.getByTestId('file-input').setInputFiles(path.join(fixtures, 'book-photo.jpg'));
  await page.getByTestId('recognize').and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  await shot(page);

  // 2. reviewing the recognised position
  await page.getByTestId('recognize').click();
  await page.locator('.review-head').waitFor({ timeout: 60_000 });
  await shot(page);

  // 3. analysis
  page = await phone(lang, { 'chessy.line.v1': line(ITALIAN) });
  await page.goto(base);
  await page.getByTestId('depth').filter({ hasText: /(1[89]|2\d)\// }).waitFor({ timeout: 90_000 });
  await shot(page);

  // 4. solve mode
  page = await phone(lang, { 'chessy.line.v1': line(SCHOLAR), 'chessy.mode.v1': '"solve"' });
  await page.goto(base);
  await page.getByRole('button', { name: m['common.showSolution'] }).and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  const tap = tapper(page);
  await tap('h5');
  await tap('f7');
  await page.getByTestId('verdict').filter({ hasText: m['verdict.best'] }).waitFor({ timeout: 60_000 });
  await shot(page);

  // 5. puzzles
  page = await phone(lang, { 'chessy.puzzles.v1': PUZZLER });
  await page.goto(base);
  await page.getByLabel(m['nav.puzzles'], { exact: true }).click();
  const puzzle = page.locator('[data-puzzle-id="0hW9J"]');
  await puzzle.and(page.locator('[data-phase="play"][data-ply="1"]')).waitFor();
  const tapP = tapper(page);
  await tapP('d3');
  await tapP('h7');
  await puzzle.and(page.locator('[data-phase="play"][data-ply="3"]')).waitFor();
  await tapP('h6');
  await tapP('h7');
  await puzzle.and(page.locator('[data-phase="done"]')).waitFor();
  await page.waitForTimeout(300);
  await shot(page);

  // 6. playing against the engine
  page = await phone(lang, {
    'chessy.line.v1': line(ITALIAN),
    'chessy.mode.v1': '"play"',
    'chessy.play.v1': JSON.stringify({ color: 'w', level: 4, root: ITALIAN }),
  });
  await page.goto(base);
  const tapG = tapper(page);
  await tapG('d2');
  await tapG('d4');
  await page.getByTestId('moves').locator('.mv').nth(2).waitFor({ timeout: 60_000 });
  await page.getByTestId('play-title').filter({ hasText: m['play.yourMove'] }).waitFor();
  await shot(page);

  // 7. privacy
  page = await phone(lang);
  await page.goto(base);
  await page.getByLabel(m['nav.settings']).click();
  await page.getByTestId('privacy').evaluate((el) => el.previousElementSibling.scrollIntoView({ block: 'start' }));
  await shot(page);

  // 8. dark mode with another piece set
  page = await phone(lang, {
    'chessy.line.v1': line(ITALIAN),
    'chessy.settings.v1': JSON.stringify({ scheme: 'midnight', theme: 'slate', pieceSet: 'celtic' }),
  });
  await page.goto(base);
  await page.getByTestId('depth').filter({ hasText: /(1[89]|2\d)\// }).waitFor({ timeout: 90_000 });
  await shot(page);
  fs.mkdirSync(cache, { recursive: true });
  shots.forEach((png, i) => fs.writeFileSync(path.join(cache, `${FILES[i]}.png`), png));
  }

  // compose (1320 × 2868 px): a navy backdrop with soft light, a bold title with its key words in the icon's gold,
  // and the app in an iPhone frame (Dynamic Island, a 9:41 status bar in the colour of the app's top bar)
  const out = path.join(root, 'store', 'screenshots', lang === 'en' ? '' : lang);
  fs.mkdirSync(out, { recursive: true });
  const frame = await browser.newPage({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 });
  const writeShot = async (file, html) => {
    await frame.setContent(html);
    await frame.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    // the status bar takes the colour of the app's top bar, and light or dark text to suit
    await frame.evaluate(() => {
      for (const img of document.querySelectorAll('.screen img')) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = 4;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const [r, gr, b] = g.getImageData(Math.round(img.naturalWidth * 0.08), 1, 1, 1).data;
        const bar = img.closest('.screen').querySelector('.status');
        bar.style.background = `rgb(${r}, ${gr}, ${b})`;
        bar.classList.toggle('light', 0.299 * r + 0.587 * gr + 0.114 * b < 140);
      }
    });
    await frame.screenshot({ path: path.join(out, `${file}.jpg`), type: 'jpeg', quality: 92 });
    written++;
  };
  const title = (text) => text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const device = (png, cls = '') => `<div class="device ${cls}"><div class="screen">
      <div class="status"><span class="time">9:41</span><span class="island"></span>
        <svg class="icons" viewBox="0 0 66 12" aria-hidden="true"><g fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1"/><rect x="4.5" y="6" width="3" height="6" rx="1"/>
          <rect x="9" y="3.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="1" width="3" height="11" rx="1"/>
          <path d="M28 3.2a9.5 9.5 0 0 1 12.6 0l-1.3 1.4a7.6 7.6 0 0 0-10 0Zm2.3 2.6a6 6 0 0 1 8 0l-1.3 1.4a4.1 4.1 0 0 0-5.4 0Zm2.4 2.6a2.5 2.5 0 0 1 3.2 0L34.3 10Z"/>
          <rect x="45" y="1.5" width="18" height="9" rx="2.6" fill="none" stroke="currentColor" stroke-opacity=".45"/>
          <rect x="46.6" y="3.1" width="14.8" height="5.8" rx="1.4"/><rect x="64" y="4.4" width="1.4" height="3.2" rx=".7" opacity=".45"/>
        </g></svg></div>
      <img src="data:image/png;base64,${png.toString('base64')}"></div></div>`;
  const layout = (inner) => `
    <style>
      body { margin: 0; }
      .bg { position: relative; width: 440px; height: 956px; overflow: hidden; color: #fff;
            font-family: -apple-system, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif;
            background:
              radial-gradient(110% 60% at 88% -6%, rgba(96, 165, 250, 0.55) 0%, rgba(96, 165, 250, 0) 62%),
              radial-gradient(90% 45% at 0% 104%, rgba(246, 220, 150, 0.16) 0%, rgba(246, 220, 150, 0) 64%),
              linear-gradient(172deg, #1a3f93 0%, #102c70 46%, #0b1d4d 100%); }
      /* the same height in every language and screenshot, so the phone sits at the same place in all of them */
      header { position: relative; height: 222px; box-sizing: border-box; padding: 40px 30px 0; text-align: center; }
      h1 { margin: 0; font-size: 37px; line-height: 1.04; font-weight: 800; letter-spacing: -1px; text-wrap: balance; }
      h1 em { font-style: normal; color: #f6dc96; }
      p.sub { margin: 12px 0 0; font-size: 17px; line-height: 1.3; font-weight: 500; color: rgba(226, 236, 255, 0.82);
              text-wrap: balance; }
      .device { position: absolute; left: 50%; top: 226px; width: 350px; margin-left: -175px; box-sizing: border-box;
                padding: 10px; border-radius: 60px; background: linear-gradient(150deg, #3a3f48, #121418 40%, #24272d);
                box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.5),
                            0 50px 90px -20px rgba(2, 8, 30, 0.75), 0 0 140px rgba(96, 165, 250, 0.28); }
      .screen { position: relative; border-radius: 50px; overflow: hidden; background: #000; }
      .screen img { display: block; width: 100%; }
      .status { position: relative; height: 41px; display: flex; align-items: center; justify-content: space-between;
                padding: 4px 26px 0 34px; box-sizing: border-box; color: #0b1220; }
      .status.light { color: #fff; }
      .time { font-size: 13.5px; font-weight: 650; letter-spacing: -0.2px; }
      .icons { width: 54px; height: 10px; }
      .island { position: absolute; left: 50%; top: 9px; width: 92px; height: 26px; margin-left: -46px; border-radius: 13px;
                background: #000; }
      .book { position: absolute; left: 20px; top: 238px; transform: rotate(-6deg); transform-origin: top left;
              filter: drop-shadow(0 26px 40px rgba(2, 8, 30, 0.55)); }
      .device.small { left: auto; right: 14px; top: 392px; width: 262px; margin: 0; padding: 8px; border-radius: 46px;
                      transform: rotate(4deg); }
      .device.small .screen { border-radius: 38px; }
      .device.small .status { height: 31px; padding: 3px 20px 0 26px; }
      .device.small .time { font-size: 10.5px; }
      .device.small .icons { width: 42px; height: 8px; }
      .device.small .island { top: 7px; width: 70px; height: 20px; margin-left: -35px; }
    </style>
    <div class="bg" lang="${lang}">${inner}</div>`;

  // 0. the companion: a page of a chess book, and the phone analysing its diagram (the analysis screenshot)
  {
    const [t, sub] = CAPTIONS[lang][0];
    await writeShot(
      BOOK_FILE,
      layout(`<header><h1>${title(t)}</h1><p class="sub">${sub}</p></header>
        <div class="book">${bookPage(lang, { width: 286 })}</div>${device(shots[2], 'small')}`),
    );
  }
  for (const [i, png] of shots.entries()) {
    const [t, sub] = CAPTIONS[lang][i + 1];
    await writeShot(FILES[i], layout(`<header><h1>${title(t)}</h1><p class="sub">${sub}</p></header>${device(png)}`));
  }
  await frame.close();
}
