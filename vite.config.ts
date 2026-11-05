import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Content Security Policy for the production build (the dev server needs inline scripts).
 * Everything comes from the app's own files: no remote scripts, styles, images or
 * connections. The engine needs WebAssembly, photos and thumbnails are blob: / data: URLs,
 * React sets inline style attributes. tests/e2e/privacy.spec.ts checks nothing is blocked.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self' data: blob:",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const csp = (): Plugin => ({
  name: 'csp',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
});

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // relative asset paths so the same build works inside Capacitor and on any sub-path
  base: './',
  plugins: [react(), csp()],
  worker: { format: 'es' },
  // Safari 16.4 / iOS 16.4 is the floor anyway: the Stockfish build needs WebAssembly SIMD
  build: { target: ['es2022', 'safari16.4', 'chrome100'], chunkSizeWarningLimit: 1500 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});
