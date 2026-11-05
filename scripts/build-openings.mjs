// Builds public/openings.json from the lichess-org/chess-openings TSV files
// (CC0): maps "placement side castling" to the opening name.
// Usage: node scripts/build-openings.mjs <path to chess-openings checkout>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/build-openings.mjs <chess-openings dir>');
  process.exit(1);
}
const out = { 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq': 'Starting Position' };
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const lines = fs.readFileSync(path.join(dir, `${f}.tsv`), 'utf8').trim().split('\n').slice(1);
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t');
    const c = new Chess();
    c.loadPgn(pgn);
    const key = c.fen().split(' ').slice(0, 3).join(' ');
    // keep the shortest (most general) name for transpositions
    if (!out[key] || out[key].length > name.length + 6) out[key] = `${name} (${eco})`;
  }
}
const root = fileURLToPath(new URL('..', import.meta.url));
fs.writeFileSync(path.join(root, 'public', 'openings.json'), JSON.stringify(out));
console.log(`${Object.keys(out).length} positions`);
