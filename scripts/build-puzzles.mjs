// Builds public/puzzles.json, the offline puzzle set, from the lichess.org puzzle database
// (https://database.lichess.org/#puzzles, CC0):
//
//   zstd -dc lichess_db_puzzle.csv.zst | node scripts/build-puzzles.mjs -
//   node scripts/build-puzzles.mjs puzzles.csv            # or an uncompressed file
//
// Reads the CSV (PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,…) or
// NDJSON with the same fields (one puzzle per line, optionally under a "puzzle" key). Keeps
// popular, well-rated puzzles, the most popular ones per 100 rating points, and checks that
// every move is legal.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/build-puzzles.mjs <puzzles.csv | puzzles.ndjson | ->');
  process.exit(1);
}

const MIN_RATING = 600;
const MAX_RATING = 2799;
const PER_BUCKET = 300; // puzzles per 100 rating points
const MIN_POPULARITY = 85; // lichess popularity, -100..100
const MIN_PLAYS = 100;
const MAX_RD = 90;

const stream = input === '-' ? process.stdin : fs.createReadStream(input);
const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });

let header = null;
const buckets = new Map();
let read = 0;
for await (const line of lines) {
  if (!line.trim()) continue;
  let p;
  if (line.startsWith('{')) {
    const o = JSON.parse(line);
    p = o.puzzle ?? o;
  } else {
    const cols = line.split(',');
    if (!header) {
      if (cols[0] === 'PuzzleId') {
        header = cols;
        continue;
      }
      header = ['PuzzleId', 'FEN', 'Moves', 'Rating', 'RatingDeviation', 'Popularity', 'NbPlays', 'Themes'];
    }
    p = Object.fromEntries(header.map((h, i) => [h, cols[i]]));
  }
  read++;
  const rating = Number(p.Rating);
  if (!(rating >= MIN_RATING && rating <= MAX_RATING)) continue;
  if (Number(p.Popularity) < MIN_POPULARITY || Number(p.NbPlays) < MIN_PLAYS || Number(p.RatingDeviation) > MAX_RD) continue;
  const b = Math.floor(rating / 100);
  if (!buckets.has(b)) buckets.set(b, []);
  buckets.get(b).push({
    id: p.PuzzleId,
    fen: p.FEN,
    moves: p.Moves,
    rating,
    popularity: Number(p.Popularity),
    plays: Number(p.NbPlays),
    themes: (p.Themes ?? '').split(' ').filter(Boolean),
  });
}

/** Every move legal from the FEN, at least the opponent's move and one answer. */
function legal(p) {
  const moves = p.moves.split(' ');
  if (moves.length < 2) return false;
  try {
    const c = new Chess(p.fen);
    for (const m of moves) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    return true;
  } catch {
    return false;
  }
}

const chosen = [];
for (const b of [...buckets.keys()].sort((x, y) => x - y)) {
  const best = buckets
    .get(b)
    .sort((x, y) => y.popularity - x.popularity || y.plays - x.plays || x.id.localeCompare(y.id))
    .filter(legal)
    .slice(0, PER_BUCKET);
  chosen.push(...best);
}
chosen.sort((x, y) => x.rating - y.rating || x.id.localeCompare(y.id));

const themeCount = new Map();
for (const p of chosen) for (const t of p.themes) themeCount.set(t, (themeCount.get(t) ?? 0) + 1);
const themes = [...themeCount.keys()].sort();
const index = new Map(themes.map((t, i) => [t, i]));

const out = {
  source: 'lichess.org puzzle database, CC0 (https://database.lichess.org/#puzzles)',
  themes,
  // [id, FEN, moves (UCI; the first is the opponent's), rating, theme indices]
  puzzles: chosen.map((p) => [p.id, p.fen, p.moves, p.rating, p.themes.map((t) => index.get(t))]),
};
const file = path.join(root, 'public', 'puzzles.json');
fs.writeFileSync(file, JSON.stringify(out) + '\n');
console.log(`read ${read} puzzles, wrote ${chosen.length} (${(fs.statSync(file).size / 1024).toFixed(0)} KB) to public/puzzles.json`);
