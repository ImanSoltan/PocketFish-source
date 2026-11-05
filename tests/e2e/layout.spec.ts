import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { NO_MODELS, hasModels } from './helpers';

const fixtures = fileURLToPath(new URL('../fixtures/', import.meta.url));

/** Corner editor geometry: svg box on screen, photo size (viewBox) and the corners in photo px. */
async function quad(page: Page) {
  return page.getByTestId('quad').evaluate((svg: SVGSVGElement) => {
    const r = svg.getBoundingClientRect();
    const img = svg.parentElement!.querySelector('img')!.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const pts = svg
      .querySelector('polygon')!
      .getAttribute('points')!
      .split(' ')
      .map((p) => p.split(',').map(Number));
    return { left: r.left, top: r.top, width: r.width, height: r.height, img, w: vb.width, h: vb.height, pts };
  });
}

test('corner editor keeps photo, outline and loupe aligned on a tall screenshot', async ({ page }) => {
  test.skip(!hasModels, NO_MODELS);
  await page.goto('/');
  await page.getByTestId('scan').click();
  await page.getByTestId('file-input').setInputFiles(fixtures + 'app-screenshot.png'); // 1170 x 1992
  await expect(page.getByText('Adjust the corners')).toBeVisible({ timeout: 60_000 });

  const q = await quad(page);
  // the editor has the photo's aspect ratio, so the photo isn't stretched under the outline
  expect(q.width / q.height).toBeCloseTo(q.w / q.h, 2);
  expect(q.img.width).toBeCloseTo(q.width, 0);
  expect(q.img.height).toBeCloseTo(q.height, 0);
  expect(q.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.62 + 1);

  // press a little off the top-left corner and drag: the corner follows the finger's
  // movement instead of jumping under it
  const s = q.width / q.w;
  const [x0, y0] = q.pts[0];
  const px = q.left + x0 * s + 12;
  const py = q.top + y0 * s + 10;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px + 20, py + 15, { steps: 4 });

  // the loupe is centred on the dragged corner
  const loupe = page.getByTestId('loupe');
  await expect(loupe).toBeVisible();
  const during = await quad(page);
  const vb = await loupe.locator('svg').evaluate((el: SVGSVGElement) => {
    const b = el.viewBox.baseVal;
    return [b.x + b.width / 2, b.y + b.height / 2];
  });
  expect(vb[0]).toBeCloseTo(during.pts[0][0], 3);
  expect(vb[1]).toBeCloseTo(during.pts[0][1], 3);

  await page.mouse.up();
  await expect(loupe).toBeHidden();
  const after = await quad(page);
  expect(Math.abs(after.pts[0][0] - (x0 + 20 / s))).toBeLessThan(1.5);
  expect(Math.abs(after.pts[0][1] - (y0 + 15 / s))).toBeLessThan(1.5);
});

for (const width of [320, 390]) {
  test(`piece palette fits a ${width} px wide screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/');
    await page.getByLabel('Edit position').click();
    const palette = page.getByRole('toolbar', { name: 'Pieces' });
    const box = (await palette.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    const tiles = palette.locator('button');
    await expect(tiles).toHaveCount(14);
    for (const tile of await tiles.all()) {
      const t = (await tile.boundingBox())!;
      expect(t.x).toBeGreaterThanOrEqual(box.x);
      expect(t.x + t.width).toBeLessThanOrEqual(box.x + box.width);
    }
  });
}
