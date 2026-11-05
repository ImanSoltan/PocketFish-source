// Writes public/licenses.txt, the Licences page in the app (About → Licences): PocketFish's GPL notice and
// what it doesn't cover, where Stockfish's source is, the piece sets, the licence of every library bundled
// from npm, and the full GNU GPL v3 at the end. Runs with `npm install` and `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const config = read('src/app/config.ts');
const constant = (name) => new RegExp(`export const ${name}(?::\\s*\\w+)?\\s*=\\s*'([^']*)'`).exec(config)?.[1];
const app = constant('APP_NAME');
const developer = constant('DEVELOPER');
// paragraphs as single lines, so the phone wraps them to its width (licence files come hard-wrapped)
const reflow = (text) =>
  text
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n[ \t]*\n/)
    .map((par) => par.split('\n').map((line) => line.trim()).filter(Boolean).join(' '))
    .join('\n\n');
const rule = '-'.repeat(32);
const out = [];
const section = (title, ...paragraphs) => out.push(rule, title.toUpperCase(), '', ...paragraphs.map((p) => reflow(p) + '\n'));

section(
  app,
  `© 2026 ${developer}. Source code: ${constant('SOURCE_URL')}`,
  `${app}'s source code is free software: you can redistribute it and/or modify it under the terms of
  the GNU General Public License as published by the Free Software Foundation, version 3. It is distributed
  in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. The licence is at the end of this page.`,
  `Not covered by the GPL: the trained recognition models (models/board.bin, models/squares.bin) are
  © 2026 ${developer}, all rights reserved, and not part of the public source code. As GPLv3 section 7(e)
  allows, the licence grants no rights to the name ${app} or its logo and app icon.`,
);

const sf = JSON.parse(read('node_modules/stockfish/package.json'));
section(
  `Stockfish ${sf.buildVersion}`,
  '© The Stockfish developers, https://stockfishchess.org. GNU GPL v3 (the licence at the end).',
  `WebAssembly build: stockfish.js ${sf.version} (lite, single-threaded) by Nathan Rugg / Chess.com.`,
  `Source code of the build in this app: https://github.com/nmrugg/stockfish.js/tree/v${sf.version}`,
  'Stockfish: https://github.com/official-stockfish/Stockfish',
);

// piece sets: src/board/pieceSets.ts, with the licence files next to the pictures
const sets = [...read('src/board/pieceSets.ts').matchAll(/id: '(\w+)', name: '([^']+)', author: '([^']+)', license: '([^']+)'/g)];
const pieces = [];
for (const [, id, name, author, license] of sets) {
  const gpl2 = license === 'GPLv2+' ? ', used under the GNU GPL v3 (the licence at the end)' : '';
  pieces.push(`${name} pieces (lichess "${id}"): ${author}, ${license}${gpl2}`);
  const file = path.join(root, 'public', 'pieces', id, 'LICENSE.txt');
  if (fs.existsSync(file)) pieces.push(fs.readFileSync(file, 'utf8'));
}
section('Piece sets (via lichess.org)', ...pieces);

section(
  'Data',
  'Opening names: lichess-org/chess-openings, CC0 1.0 (public domain).',
  'Puzzles: the lichess.org puzzle database, CC0 1.0 (public domain).',
);

// every package the app ships (production dependencies), with its licence file
const dirs = execSync('npm ls --omit=dev --all --parseable', { cwd: root })
  .toString()
  .split('\n')
  .filter((d) => d && path.resolve(d) !== path.resolve(root));
const libs = [];
const seen = new Set();
for (const dir of dirs.sort()) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  // types only (not in the app), and Stockfish, which has its own section
  if (pkg.name.startsWith('@types/') || pkg.name === 'csstype' || pkg.name === 'stockfish') continue;
  if (seen.has(pkg.name)) continue;
  seen.add(pkg.name);
  const licenseFile = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  libs.push(`${pkg.name} ${pkg.version}: ${pkg.license ?? 'see the licence'}`);
  if (licenseFile) libs.push(fs.readFileSync(path.join(dir, licenseFile), 'utf8'));
}
section('Open-source libraries', ...libs);

section('GNU General Public License, version 3', read('LICENSE'));

fs.writeFileSync(path.join(root, 'public', 'licenses.txt'), out.join('\n'));
console.log(`wrote public/licenses.txt (${seen.size} libraries, ${sets.length} piece sets)`);
