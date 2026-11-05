// Decoding photos (EXIF orientation applied by the browser), downscaling for
// processing and 90 degree rotation.
import { applyH, homography, invert3 } from './geometry';
import { rgbaToGray, type Gray } from './imageops';

export interface Photo {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** object URL for display (revoke with releasePhoto) */
  url: string;
}

function canvasUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) =>
    canvas.toBlob(
      (b) => resolve(b ? URL.createObjectURL(b) : canvas.toDataURL('image/jpeg', 0.9)),
      'image/jpeg',
      0.9,
    ),
  );
}

export function releasePhoto(p: Photo | null) {
  if (p?.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export async function loadPhoto(blob: Blob, maxSide = 1600): Promise<Photo> {
  const src = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s));
    const h = Math.max(1, Math.round(img.naturalHeight * s));
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return { canvas, width: w, height: h, url: await canvasUrl(canvas) };
  } finally {
    URL.revokeObjectURL(src);
  }
}

export async function rotatePhoto(p: Photo, clockwise = true): Promise<Photo> {
  const canvas = makeCanvas(p.height, p.width);
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(((clockwise ? 1 : -1) * Math.PI) / 2);
  ctx.drawImage(p.canvas, -p.width / 2, -p.height / 2);
  return { canvas, width: canvas.width, height: canvas.height, url: await canvasUrl(canvas) };
}

export function photoGray(p: Photo): Gray {
  const data = p.canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, p.width, p.height).data;
  return rgbaToGray(data, p.width, p.height);
}

/** Perspective-rectified colour crop of the board (as printed), for display. */
export function rectifiedCrop(p: Photo, corners: [number, number][], size = 320): string {
  const src = p.canvas.getContext('2d')!.getImageData(0, 0, p.width, p.height);
  const out = new ImageData(size, size);
  const H = invert3(homography(corners, [[0, 0], [size, 0], [size, size], [0, size]]));
  const { width: w, height: h, data } = src;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [u, v] = applyH(H, [x + 0.5, y + 0.5]);
      const fx = Math.min(Math.max(u - 0.5, 0), w - 1);
      const fy = Math.min(Math.max(v - 0.5, 0), h - 1);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(x0 + 1, w - 1);
      const y1 = Math.min(y0 + 1, h - 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const o = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const a = data[(y0 * w + x0) * 4 + c] * (1 - tx) + data[(y0 * w + x1) * 4 + c] * tx;
        const b = data[(y1 * w + x0) * 4 + c] * (1 - tx) + data[(y1 * w + x1) * 4 + c] * tx;
        out.data[o + c] = a * (1 - ty) + b * ty;
      }
      out.data[o + 3] = 255;
    }
  }
  const c = makeCanvas(size, size);
  c.getContext('2d')!.putImageData(out, 0, 0);
  return c.toDataURL('image/jpeg', 0.85);
}
