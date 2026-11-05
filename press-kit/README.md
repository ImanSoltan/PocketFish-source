# PocketFish press kit

Images and copy for the website and social posts. Everything here is taken from the real app.

| file | size | use |
| --- | --- | --- |
| `content.md` | — | taglines, descriptions, feature list, privacy block, call to action, alt texts, social posts |
| `screens/1-scan.png` … `8-dark.png` | 1026 × 1944, transparent | phone screens with rounded corners and a soft shadow, ready to place on any background |
| `screens/raw/*.png` | 1179 × 2556 | the same screens without the frame (iPhone 15 resolution), to frame or crop yourself |
| `images/hero-phones.png` | 2400 × 1720, transparent | three phones (scan, analysis, puzzle) for a hero section |
| `images/social-card.png` | 2400 × 1260 (1200 × 630 @2x) | link previews (`og:image`), LinkedIn and X posts |
| `images/square-post.png` | 2160 × 2160 (1080 × 1080 @2x) | square social posts |
| `images/app-icon.png`, `app-icon-dark.png` | 1024 × 1024 | the app icon (light and dark) |
| `images/app-icon.svg`, `app-icon-dark.svg` | vector | the app icon, scalable |

The images are 2× (retina) PNGs; scale them down or convert them to WebP for the page as needed.

Regenerate after design changes: `npm run build && node scripts/press-kit.mjs`.

The App Store screenshots (with captions, 1320 × 2868) are in `../store/screenshots/`.
