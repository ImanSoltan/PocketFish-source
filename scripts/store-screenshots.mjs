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
import { preview } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixtures = path.join(root, 'tests', 'fixtures');

/** Captions (title and line below) in the order of the screenshots; the same as in store/listing*.md. */
const CAPTIONS = {
  en: [
    ['Scan any chess diagram', 'From books, magazines or screens'],
    ['Every piece, recognised', 'Check it and fix anything in a tap'],
    ['Stockfish on your phone', 'Best moves and lines, fully offline'],
    ['Find the move yourself', 'Solve mode grades every answer'],
    ['Rated puzzles, offline', 'Thousands of tactics and a daily puzzle'],
    ['Play it out against Stockfish', 'Eight levels, from beginner to full strength'],
    ['Private by design', 'No account, no tracking, works offline'],
    ['Make it yours', '6 piece sets, 5 colour schemes, dark mode'],
  ],
  de: [
    ['Scanne jedes Schachdiagramm', 'Aus Büchern, Zeitschriften oder vom Bildschirm'],
    ['Jede Figur erkannt', 'Prüfen und mit einem Tippen korrigieren'],
    ['Stockfish auf dem iPhone', 'Beste Züge und Varianten, ganz offline'],
    ['Finde den Zug selbst', 'Der Lösen-Modus bewertet jede Antwort'],
    ['Bewertete Aufgaben, offline', 'Tausende Taktiken und eine Aufgabe des Tages'],
    ['Spiel es gegen Stockfish aus', 'Acht Stufen, vom Anfänger bis zur vollen Stärke'],
    ['Privat von Grund auf', 'Kein Konto, kein Tracking, funktioniert offline'],
    ['Ganz nach deinem Geschmack', '6 Figurensätze, 5 Farbschemata, Dunkelmodus'],
  ],
  es: [
    ['Escanea cualquier diagrama', 'De libros, revistas o pantallas'],
    ['Cada pieza, reconocida', 'Revísala y corrige lo que haga falta con un toque'],
    ['Stockfish en tu iPhone', 'Mejores jugadas y líneas, sin conexión'],
    ['Encuentra tú la jugada', 'El modo Resolver evalúa cada respuesta'],
    ['Problemas sin conexión', 'Miles de tácticas y un problema del día'],
    ['Juega contra Stockfish', 'Ocho niveles, de principiante a máxima fuerza'],
    ['Privado por diseño', 'Sin cuenta, sin rastreo, funciona sin conexión'],
    ['A tu gusto', '6 juegos de piezas, 5 esquemas de color, modo oscuro'],
  ],
  fr: [
    ['Scannez tout diagramme', 'Livres, magazines ou écrans'],
    ['Chaque pièce reconnue', 'Vérifiez et corrigez d’un toucher'],
    ['Stockfish dans votre iPhone', 'Meilleurs coups et variantes, hors ligne'],
    ['Trouvez le coup vous-même', 'Le mode Résoudre note chaque réponse'],
    ['Problèmes classés, hors ligne', 'Des milliers de tactiques et un problème du jour'],
    ['Jouez contre Stockfish', 'Huit niveaux, de débutant à pleine puissance'],
    ['Confidentiel par conception', 'Sans compte, sans pistage, fonctionne hors ligne'],
    ['À votre goût', '6 jeux de pièces, 5 thèmes de couleurs, mode sombre'],
  ],
};
const LOCALES = { en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };
const arg = process.argv[2] ?? 'en';
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

  // compose: caption on a gradient, the app below with rounded corners (1320 × 2868 px)
  const out = path.join(root, 'store', 'screenshots', lang === 'en' ? '' : lang);
  fs.mkdirSync(out, { recursive: true });
  const frame = await browser.newPage({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 });
  for (const [i, png] of shots.entries()) {
    const [title, sub] = CAPTIONS[lang][i];
    await frame.setContent(`
      <style>
        body { margin: 0; }
        .bg { width: 440px; height: 956px; overflow: hidden; display: flex; flex-direction: column; align-items: center;
              background: linear-gradient(160deg, #60a5fa 0%, #2563eb 55%, #1e3a8a 100%);
              font-family: -apple-system, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif; color: #fff; }
        /* the same height in every language and screenshot, so the app sits at the same place in all of them */
        header { flex: none; height: 212px; width: 100%; box-sizing: border-box; padding: 20px 26px 18px;
                 display: flex; flex-direction: column; justify-content: center; text-align: center; }
        h1 { margin: 0 0 8px; font-size: 35px; line-height: 1.08; font-weight: 800; letter-spacing: -0.5px; text-wrap: balance; }
        p { margin: 0; font-size: 18.5px; line-height: 1.25; opacity: 0.92; text-wrap: balance; }
        img { width: 332px; border-radius: 33px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.45); }
      </style>
      <div class="bg" lang="${lang}"><header><h1>${title}</h1><p>${sub}</p></header><img src="data:image/png;base64,${png.toString('base64')}"></div>`);
    await frame.screenshot({ path: path.join(out, `${FILES[i]}.jpg`), type: 'jpeg', quality: 92 });
    written++;
  }
  await frame.close();
}
