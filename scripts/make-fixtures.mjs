// Generates the scan test fixtures in tests/fixtures (run with the dev or
// preview server on http://127.0.0.1:4173):
//   app-screenshot.png  - a phone screenshot of PocketFish's own analysis screen (arrows on)
//   book-photo.jpg      - a book page with a hatched diagram, rendered by the browser and
//                         "photographed" with CSS 3D perspective, blur and uneven light
//   book-photo-black.jpg- the same kind of page, diagram printed from Black's side
// These are rendered by Chromium, independently of the Python training-data generator.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'tests', 'fixtures');
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
fs.mkdirSync(out, { recursive: true });

export const FIXTURES = {
  'app-screenshot.png': 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1',
  'book-photo.jpg': '2r2rk1/pb3ppp/1p2pn2/q2p4/3P4/P1NBP3/1PQ2PPP/2R2RK1',
  'book-photo-black.jpg': '6k1/5ppp/8/3N4/8/1P6/r4PPP/3R2K1',
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

// 1. app screenshot
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.goto(base);
  const fen = `${FIXTURES['app-screenshot.png']} w - - 0 9`;
  await page.evaluate((f) => {
    localStorage.clear();
    localStorage.setItem('chessy.line.v1', JSON.stringify({ rootFen: f, moves: [], ply: 0 }));
  }, fen);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('svg.board polygon').length >= 3, null, {
    timeout: 60_000,
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, 'app-screenshot.png') });
  await ctx.close();
}

// 2. book pages
const PIECE_URL = (p) => {
  const color = p === p.toUpperCase() ? 'w' : 'b';
  return path.join(root, 'public', 'pieces', 'merida', `${color}${p.toUpperCase()}.svg`);
};
const pieceData = {};
for (const p of 'KQRBNPkqrbnp') {
  pieceData[p] = 'data:image/svg+xml;base64,' + fs.readFileSync(PIECE_URL(p)).toString('base64');
}

function boardSvg(placement, blackAtBottom) {
  const rows = placement.split('/').map((r) => r.replace(/\d/g, (d) => '.'.repeat(Number(d))));
  let squares = '';
  let pieces = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dr = blackAtBottom ? 7 - r : r;
      const dc = blackAtBottom ? 7 - c : c;
      if ((dr + dc) % 2 === 1) squares += `<rect x="${dc * 50}" y="${dr * 50}" width="50" height="50" fill="url(#hatch)"/>`;
      const p = rows[r][c];
      if (p !== '.') {
        pieces += `<rect x="${dc * 50 + 6}" y="${dr * 50 + 4}" width="38" height="42" fill="#fff" opacity="${(dr + dc) % 2 ? 1 : 0}"/>`;
        pieces += `<image href="${pieceData[p]}" x="${dc * 50 + 3}" y="${dr * 50 + 3}" width="44" height="44"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -14 428 428" width="380" height="380">
    <defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="5" height="5" fill="#fbf8f1"/><rect width="2.1" height="5" fill="#222"/></pattern></defs>
    <rect x="-10" y="-10" width="420" height="420" fill="none" stroke="#111" stroke-width="5"/>
    <rect x="0" y="0" width="400" height="400" fill="#fbf8f1" stroke="#111" stroke-width="1.5"/>
    ${squares}${pieces}</svg>`;
}

const LOREM =
  'The position after White’s twentieth move shows the typical features of the Queen’s Gambit Declined. ' +
  'Black has completed his development but the pressure along the c-file and the weakness of the ' +
  'c6-square give White a lasting initiative. In the diagram below it is White to play, and the most ' +
  'precise continuation keeps the knights on the board. ';

async function bookPhoto(file, placement, blackAtBottom, tilt) {
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#6b4f35;
      background-image:radial-gradient(circle at 30% 20%, #8a6a48, #4a3423);overflow:hidden">
    <div style="width:900px;height:1200px;display:flex;align-items:center;justify-content:center;perspective:1100px">
      <div style="width:640px;padding:44px 48px;background:#f6f1e4;font:17px/1.5 Georgia,serif;color:#222;
          transform:${tilt};box-shadow:0 20px 50px rgba(0,0,0,.6);filter:blur(0.7px)">
        <p style="margin:0 0 12px">${LOREM}</p>
        <div style="text-align:center;margin:16px 0">${boardSvg(placement, blackAtBottom)}
          <div style="font-style:italic;margin-top:6px">Diagram 14 — White to play</div></div>
        <p style="margin:0">${LOREM}${LOREM}</p>
      </div></div>
    <div style="position:fixed;inset:0;background:linear-gradient(110deg,rgba(255,250,235,.25),rgba(0,0,0,.35))"></div>
  </body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 82 });
  await page.close();
}

await bookPhoto('book-photo.jpg', FIXTURES['book-photo.jpg'], false, 'rotateX(14deg) rotateZ(-3deg) rotateY(6deg)');
await bookPhoto('book-photo-black.jpg', FIXTURES['book-photo-black.jpg'], true, 'rotateX(-8deg) rotateZ(4deg)');
fs.writeFileSync(path.join(out, 'fixtures.json'), JSON.stringify(FIXTURES, null, 2) + '\n');
await browser.close();
console.log('fixtures written to', out);
