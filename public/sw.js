// Offline support for the web / PWA version (not used inside the native apps).
// Network-first: always fresh when online, cached copies when offline. The big
// static files the app needs offline (engine, models, pieces, puzzles) are precached.
const CACHE = 'chessy-v5';
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icon-dark.svg',
  'icon-glyph.svg',
  'apple-touch-icon.png',
  'openings.json',
  'puzzles.json',
  'privacy.html',
  'support.html',
  'licenses.txt',
  'engine/stockfish.js',
  'engine/stockfish.wasm',
  'models/board.bin',
  'models/squares.bin',
  // the piece sets in src/board/pieceSets.ts
  ...['cburnett', 'merida', 'chessnut', 'mpchess', 'celtic', 'fantasy'].flatMap((set) =>
    ['K', 'Q', 'R', 'B', 'N', 'P'].flatMap((p) => [`pieces/${set}/w${p}.svg`, `pieces/${set}/b${p}.svg`]),
  ),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        throw err;
      }
    })(),
  );
});
