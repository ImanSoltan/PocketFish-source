// Copies the Stockfish WASM build (lite, single-threaded: runs everywhere,
// no cross-origin isolation needed) from node_modules into public/engine so
// Vite serves it as a static asset and Capacitor bundles it into the app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
const pkgDir = path.dirname(require.resolve('stockfish/package.json'));
const { buildVersion } = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
const base = `stockfish-${buildVersion}-lite-single`;
const outDir = path.join(root, 'public', 'engine');
fs.mkdirSync(outDir, { recursive: true });
for (const ext of ['js', 'wasm']) {
  fs.copyFileSync(path.join(pkgDir, 'bin', `${base}.${ext}`), path.join(outDir, `stockfish.${ext}`));
}
fs.copyFileSync(path.join(pkgDir, 'Copying.txt'), path.join(outDir, 'COPYING.txt'));
console.log(`copied ${base} -> public/engine/stockfish.{js,wasm}`);
