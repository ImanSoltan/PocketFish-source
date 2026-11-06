// App icon, web icons and splash screens from one vector design, on the Agile With AI product construction:
// a white fish inside camera-viewfinder corners, and the studio's spark top right, where the fourth corner
// would be (agilewithai-site brand/product-icons; canvas 1024, secondary lines white at 55 %). The fish is
// drawn large, and its eye, a fine gill line and the scales cut out of it: the back of the body is a chessboard
// whose dark squares are see-through, so the tile shows through them like through the eye.
//
//   node scripts/make-icons.mjs              # writes every icon and splash file, and ios/App/App/AppIcon.icon
//   node scripts/make-icons.mjs --preview d  # only writes a preview sheet to d/icons-preview.png
//
// iOS gets the light icon plus the dark and tinted variants of iOS 18+ (Settings → Home Screen →
// Customize), and an Icon Composer file with the fish, the corners and the spark on their own layers for
// the Liquid Glass icons of iOS 26+. Uses Playwright's Chromium (CHROMIUM_PATH to override).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = (p) => path.join(root, p);

const PALETTES = {
  light: { bg: ['#3a7bea', '#16388a', '#0b1d4d'], highlight: 0.24 },
  dark: { bg: ['#25324a', '#101828', '#05080f'], highlight: 0.1 },
  tinted: { bg: ['#000000', '#000000', '#000000'], highlight: 0 },
};

// the symbol, white, in a 1024 × 1024 canvas: a sleek fish facing right with a forked crescent tail
const FISH_BODY = 'M776 512C746 450 664 406 560 406C468 406 398 448 346 512C398 576 468 618 560 618C664 618 746 574 776 512Z';
const FISH_TAIL =
  'M368 512C334 476 300 446 248 414Q230 404 233 424C243 458 258 488 258 512C258 536 243 566 233 600Q230 620 248 610C300 578 334 548 368 512Z';
const EYE = { cx: 688, cy: 494, r: 21 };
const GILL = 'M630 432Q662 512 630 592';
/** the scales: a chessboard of 53-unit squares on the back of the body (x 346–611, y 406–618: 5 × 4 squares) */
const SCALES = { x0: 346, x1: 611, y0: 406, y1: 618, cell: 53, ox: 505, oy: 512 };
/** where the fish sits: 1.32 times its drawn size, its centre (505, 512) moved to (520, 536) */
const FISH_PLACE = 'translate(520 536) scale(1.32) translate(-505 -512)';
/** the viewfinder corners, 150 from the edges, 96 long, with a radius of 26 */
const CORNER = { inset: 150, length: 96, radius: 26 };
const CORNERS = (() => {
  const { inset: a, length: l, radius: r } = CORNER;
  const b = 1024 - a;
  return [
    `M${a} ${a + l}L${a} ${a + r}Q${a} ${a} ${a + r} ${a}L${a + l} ${a}`,
    `M${a} ${b - l}L${a} ${b - r}Q${a} ${b} ${a + r} ${b}L${a + l} ${b}`,
    `M${b} ${b - l}L${b} ${b - r}Q${b} ${b} ${b - r} ${b}L${b - l} ${b}`,
  ];
})();
/** the four-point spark of the Agile With AI logo, drawn centred at (819, 205), placed at (846, 178) at 90 % */
const SPARK =
  'M819.2 122.88C829.03 176.128 847.872 194.97 901.12 204.8C847.872 214.63 829.03 233.472 819.2 286.72C809.37 233.472 790.528 214.63 737.28 204.8C790.528 194.97 809.37 176.128 819.2 122.88Z';
const SPARK_PLACE = 'translate(846 178) scale(0.9) translate(-819.2 -204.8)';

/** the dark squares of the scales, as plain rectangles (Icon Composer reads no SVG patterns) */
const scaleSquares = () => {
  const { x0, x1, y0, y1, cell, ox, oy } = SCALES;
  const squares = [];
  for (let i = Math.floor((x0 - ox) / cell); ox + i * cell < x1; i++)
    for (let j = Math.floor((y0 - oy) / cell); oy + j * cell < y1; j++) {
      if ((((i + j) % 2) + 2) % 2 !== 0) continue;
      const x = Math.max(x0, ox + i * cell);
      const y = Math.max(y0, oy + j * cell);
      const w = Math.min(x1, ox + (i + 1) * cell) - x;
      const h = Math.min(y1, oy + (j + 1) * cell) - y;
      if (w > 0 && h > 0) squares.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`);
    }
  return squares.join('');
};

/** the fish; the eye, the gill and the dark squares are cut out of it and show whatever is behind it */
const fishSvg = () => {
  const r = EYE.r;
  const eye = `M${EYE.cx - r} ${EYE.cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  return `<g transform="${FISH_PLACE}"><defs><mask id="cutouts" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="#ffffff"/><g fill="#000000">${scaleSquares()}</g><path d="${GILL}" fill="none" stroke="#000000" stroke-width="13" stroke-linecap="round"/></mask></defs>
  <g mask="url(#cutouts)"><path fill-rule="evenodd" d="${FISH_BODY}${eye}" fill="#ffffff"/><path d="${FISH_TAIL}" fill="#ffffff"/></g></g>`;
};
const cornersSvg = (opacity = 0.55) =>
  CORNERS.map(
    (d) => `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${opacity}"/>`,
  ).join('\n  ');
const sparkSvg = () => `<path transform="${SPARK_PLACE}" d="${SPARK}" fill="#ffffff"/>`;
const canvas = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${inner}
</svg>`;

/**
 * The icon artwork. `rounded`: draw the iOS-like rounded square (web icons) instead of filling the square;
 * `glyphScale`: shrink the symbol and spark around the centre (Android's safe zone); `background`: the tile;
 * `mono`: the corners at full white (Android's themed icon).
 */
function iconSvg(variant = 'light', { rounded = false, glyphScale = 1, background = true, mono = false } = {}) {
  const c = PALETTES[variant];
  const t = (1 - glyphScale) * 512;
  const rx = rounded ? 230 : 0;
  return canvas(`<defs>
    <linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1024" y2="870.4">
      <stop offset="0" stop-color="${c.bg[0]}"/><stop offset="0.5" stop-color="${c.bg[1]}"/><stop offset="1" stop-color="${c.bg[2]}"/>
    </linearGradient>
    <radialGradient id="hl" cx="0.22" cy="0.12" r="0.75">
      <stop offset="0" stop-color="#ffffff" stop-opacity="${c.highlight}"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${
    background
      ? `<rect width="1024" height="1024" rx="${rx}" fill="url(#bg)"/>
  <rect width="1024" height="1024" rx="${rx}" fill="url(#hl)"/>`
      : ''
  }
  <g transform="translate(${t} ${t}) scale(${glyphScale})">
  ${fishSvg()}
  ${cornersSvg(mono ? 1 : 0.55)}
  ${sparkSvg()}
  </g>`);
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();

/** Renders HTML into a w × h PNG (transparent where nothing is drawn if `transparent`). */
async function render(html, w, h, file, { transparent = false } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden">${html}</body></html>`);
  const png = await page.screenshot({ omitBackground: transparent });
  if (file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png);
  }
  return png;
}
const sized = (svg, size) => svg.replace('width="1024" height="1024"', `width="${size}" height="${size}"`);
const icon = (variant, size, opts) => sized(iconSvg(variant, opts), size);
const dataUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const previewAt = process.argv.indexOf('--preview');
if (previewAt > 0) {
  // the three iOS variants large, on a light and a dark home screen, and small
  const dir = process.argv[previewAt + 1];
  const tile = (v, size, bg) =>
    `<div style="background:${bg};padding:24px;display:inline-flex;gap:24px;align-items:center">
      <img src="${dataUrl(iconSvg(v))}" style="width:${size}px;height:${size}px;border-radius:${size * 0.225}px">
      <img src="${dataUrl(iconSvg(v))}" style="width:60px;height:60px;border-radius:13.5px">
      <img src="${dataUrl(iconSvg(v))}" style="width:29px;height:29px;border-radius:6.5px"></div>`;
  await render(
    `<div style="display:flex;flex-direction:column">${tile('light', 360, '#dfe8f3')}${tile('dark', 360, '#111')}${tile(
      'tinted',
      360,
      '#222',
    )}</div>`,
    560,
    1224,
    path.join(dir, 'icons-preview.png'),
  );
  await browser.close();
  process.exit(0);
}

const written = [];
const write = async (file, html, w, h, opts) => {
  await render(html, w, h, out(file), opts);
  written.push(file);
};

// iOS: 1024 px, full bleed (the system rounds the corners), no transparency
const ios = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';
await write(`${ios}/AppIcon-512@2x.png`, icon('light', 1024), 1024, 1024);
await write(`${ios}/AppIcon-dark.png`, icon('dark', 1024), 1024, 1024);
await write(`${ios}/AppIcon-tinted.png`, icon('tinted', 1024), 1024, 1024);
const variant = (filename, appearance) => ({
  ...(appearance ? { appearances: [{ appearance: 'luminosity', value: appearance }] } : {}),
  filename,
  idiom: 'universal',
  platform: 'ios',
  size: '1024x1024',
});
fs.writeFileSync(
  out(`${ios}/Contents.json`),
  JSON.stringify(
    {
      images: [variant('AppIcon-512@2x.png'), variant('AppIcon-dark.png', 'dark'), variant('AppIcon-tinted.png', 'tinted')],
      info: { author: 'xcode', version: 1 },
    },
    null,
    2,
  ) + '\n',
);

// iOS 26+: an Icon Composer file, the tile as the fill and the symbol on its own layers, so the system can
// draw the Liquid Glass icon (default, dark, clear and tinted); the symbol and the spark stay pure white
const iconDoc = 'ios/App/App/AppIcon.icon';
fs.rmSync(out(iconDoc), { recursive: true, force: true });
fs.mkdirSync(out(`${iconDoc}/Assets`), { recursive: true });
const assets = {
  'spark.svg': sparkSvg(),
  'fish.svg': fishSvg(),
  'corners.svg': cornersSvg(1),
};
for (const [file, svg] of Object.entries(assets)) fs.writeFileSync(out(`${iconDoc}/Assets/${file}`), canvas(svg) + '\n');
const srgb = (hex) =>
  'srgb:' + [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(5)).join(',') + ',1.00000';
const group = (name, layers, { translucency = 0.25, shadow = 0.5 } = {}) => ({
  layers,
  name,
  shadow: { kind: 'neutral', opacity: shadow },
  translucency: { enabled: true, value: translucency },
});
// in the dark appearance the system would tint white layers with the fill colour: they stay white
const WHITE_IN_DARK = [{ appearance: 'dark', value: { solid: srgb('#ffffff') } }];
const layer = (file, extra = {}) => ({ 'image-name': file, name: file.replace('.svg', ''), ...extra });
const gradient = (bg) => ({
  'linear-gradient': [srgb(bg[0]), srgb(bg[2])],
  orientation: { start: { x: 0.1, y: 0 }, stop: { x: 0.9, y: 1 } },
});
fs.writeFileSync(
  out(`${iconDoc}/icon.json`),
  JSON.stringify(
    {
      'fill-specializations': [{ value: gradient(PALETTES.light.bg) }, { appearance: 'dark', value: gradient(PALETTES.dark.bg) }],
      groups: [
        group('Spark', [layer('spark.svg', { 'fill-specializations': WHITE_IN_DARK })]),
        // the fish solid (no translucency), so the eye and the gill stay crisp
        {
          ...group('Fish', [layer('fish.svg', { 'fill-specializations': WHITE_IN_DARK })]),
          translucency: { enabled: false, value: 0 },
        },
        group('Corners', [layer('corners.svg', { opacity: 0.55, 'fill-specializations': WHITE_IN_DARK })], {
          translucency: 0.5,
          shadow: 0.3,
        }),
      ],
      'supported-platforms': { circles: ['watchOS'], squares: 'shared' },
    },
    null,
    2,
  ) + '\n',
);
written.push(iconDoc);

// web / PWA
for (const [file, v] of [['public/icon.svg', 'light'], ['public/icon-dark.svg', 'dark']]) {
  fs.writeFileSync(out(file), iconSvg(v, { rounded: true }) + '\n');
  written.push(file);
}
// the symbol alone, cropped to it, for the logo inside the app (a CSS mask in the colour scheme's accent):
// white with the corners at 55 %, so they come out lighter in any colour
fs.writeFileSync(
  out('public/icon-glyph.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="126 100 798 798" width="798" height="798">
  ${fishSvg()}
  ${cornersSvg(0.55)}
  ${sparkSvg()}
</svg>
`,
);
written.push('public/icon-glyph.svg');
await write('public/icon-192.png', icon('light', 192, { rounded: true }), 192, 192, { transparent: true });
await write('public/icon-512.png', icon('light', 512, { rounded: true }), 512, 512, { transparent: true });
await write('public/apple-touch-icon.png', icon('light', 180), 180, 180);

// the three variants side by side, for the README
await write(
  'docs/app-icon.png',
  `<div style="display:flex;gap:36px;padding:24px;background:#ffffff">${['light', 'dark', 'tinted']
    .map((v) => `<img src="${dataUrl(iconSvg(v))}" style="width:200px;height:200px;border-radius:45px">`)
    .join('')}</div>`,
    720,
    248,
);

// sources for @capacitor/assets, should anyone prefer it
await write('resources/icon.png', icon('light', 1024), 1024, 1024);
await write('resources/icon-dark.png', icon('dark', 1024), 1024, 1024);

// splash screens: the icon in the middle of the app's background colour (light and dark)
const SPLASH = { light: '#f3f6fb', dark: '#0b0e14' };
const splash = (w, h, mode) => {
  const s = Math.round(Math.min(w, h) * 0.26);
  return `<div style="width:${w}px;height:${h}px;background:${SPLASH[mode]};display:flex;align-items:center;justify-content:center">
    <img src="${dataUrl(iconSvg(mode))}" style="width:${s}px;height:${s}px;border-radius:${s * 0.225}px;box-shadow:0 ${s * 0.04}px ${s * 0.12}px rgba(0,0,0,${mode === 'dark' ? 0.5 : 0.18})"></div>`;
};
const splashSet = 'ios/App/App/Assets.xcassets/Splash.imageset';
for (const scale of [1, 2, 3]) {
  await write(`${splashSet}/Default@${scale}x~universal~anyany.png`, splash(2732, 2732, 'light'), 2732, 2732);
  await write(`${splashSet}/Default@${scale}x~universal~anyany-dark.png`, splash(2732, 2732, 'dark'), 2732, 2732);
}
await write('resources/splash.png', splash(2732, 2732, 'light'), 2732, 2732);
await write('resources/splash-dark.png', splash(2732, 2732, 'dark'), 2732, 2732);

// Android: launcher icons (legacy, round, adaptive layers) and splash drawables
const res = 'android/app/src/main/res';
// the corners reach 150 from the edges: shrunk to 66 %, they stay inside the launchers' round masks
const ANDROID_GLYPH = 0.66;
const DENSITY = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENSITY)) {
  const legacy = Math.round(48 * k);
  const layer = Math.round(108 * k);
  const svg = iconSvg('light');
  await write(
    `${res}/mipmap-${d}/ic_launcher.png`,
    `<img src="${dataUrl(svg)}" style="width:${legacy}px;height:${legacy}px;border-radius:${legacy * 0.2}px;display:block">`,
    legacy,
    legacy,
    { transparent: true },
  );
  await write(
    `${res}/mipmap-${d}/ic_launcher_round.png`,
    `<img src="${dataUrl(sized(iconSvg('light', { glyphScale: 0.65 }), legacy))}" style="width:${legacy}px;height:${legacy}px;border-radius:50%;display:block">`,
    legacy,
    legacy,
    { transparent: true },
  );
  // adaptive icon: the launcher masks the layers (circle, squircle…), so the glyph stays inside the safe zone
  await write(`${res}/mipmap-${d}/ic_launcher_background.png`, icon('light', layer, { glyphScale: 0, background: true }), layer, layer);
  await write(
    `${res}/mipmap-${d}/ic_launcher_foreground.png`,
    icon('light', layer, { glyphScale: ANDROID_GLYPH, background: false }),
    layer,
    layer,
    { transparent: true },
  );
  await write(
    `${res}/mipmap-${d}/ic_launcher_monochrome.png`,
    icon('light', layer, { glyphScale: ANDROID_GLYPH, background: false, mono: true }),
    layer,
    layer,
    { transparent: true },
  );
}
// the themed icon of Android 13+ uses the monochrome layer
for (const file of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  const xml = `${res}/mipmap-anydpi-v26/${file}`;
  const text = fs.readFileSync(out(xml), 'utf8');
  if (!text.includes('<monochrome>')) {
    fs.writeFileSync(
      out(xml),
      text.replace(
        '</adaptive-icon>',
        '    <monochrome>\n        <inset android:drawable="@mipmap/ic_launcher_monochrome" android:inset="16.7%" />\n    </monochrome>\n</adaptive-icon>',
      ),
    );
    written.push(xml);
  }
}
const ANDROID_SPLASH = {
  drawable: [320, 480],
  'drawable-night': [320, 240],
  ...Object.fromEntries(
    Object.entries({ ldpi: [240, 320], mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] }).flatMap(
      ([d, [w, h]]) => [
        [`drawable-port-${d}`, [w, h]],
        [`drawable-land-${d}`, [h, w]],
        [`drawable-port-night-${d}`, [w, h]],
        [`drawable-land-night-${d}`, [h, w]],
      ],
    ),
  ),
};
for (const [dir, [w, h]] of Object.entries(ANDROID_SPLASH)) {
  await write(`${res}/${dir}/splash.png`, splash(w, h, dir.includes('night') ? 'dark' : 'light'), w, h);
}

await browser.close();
console.log(`wrote ${written.length} files`);
