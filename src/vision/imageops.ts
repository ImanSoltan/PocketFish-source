// Grayscale image operations matching the OpenCV calls used to generate the
// training data (ml/synth.py): area resize, bilinear perspective warp,
// letterboxing and per-image standardisation.
import { applyH, type Mat3 } from './geometry';

/** grayscale image, values 0..255 */
export interface Gray {
  w: number;
  h: number;
  data: Float32Array;
}

export function rgbaToGray(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Gray {
  const data = new Float32Array(w * h);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    data[i] = Math.round(0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]);
  }
  return { w, h, data };
}

/** For each output index: source indices and weights of the box filter (cv2.INTER_AREA). */
function areaTaps(src: number, dst: number) {
  const scale = src / dst;
  const idx: number[][] = [];
  const wts: number[][] = [];
  for (let o = 0; o < dst; o++) {
    const a = o * scale;
    const b = a + scale;
    const i: number[] = [];
    const w: number[] = [];
    for (let s = Math.floor(a); s < Math.min(src, Math.ceil(b)); s++) {
      const cover = Math.min(b, s + 1) - Math.max(a, s);
      if (cover > 1e-9) {
        i.push(s);
        w.push(cover / scale);
      }
    }
    idx.push(i);
    wts.push(w);
  }
  return { idx, wts };
}

function bilinearResize(src: Gray, nw: number, nh: number): Gray {
  const out = new Float32Array(nw * nh);
  const fx = src.w / nw;
  const fy = src.h / nh;
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(Math.max((y + 0.5) * fy - 0.5, 0), src.h - 1);
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, src.h - 1);
    const ty = sy - y0;
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(Math.max((x + 0.5) * fx - 0.5, 0), src.w - 1);
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, src.w - 1);
      const tx = sx - x0;
      const d = src.data;
      out[y * nw + x] =
        (d[y0 * src.w + x0] * (1 - tx) + d[y0 * src.w + x1] * tx) * (1 - ty) +
        (d[y1 * src.w + x0] * (1 - tx) + d[y1 * src.w + x1] * tx) * ty;
    }
  }
  return { w: nw, h: nh, data: out };
}

/** Resize to nw x nh: exact area averaging when shrinking, bilinear when enlarging. */
export function resize(src: Gray, nw: number, nh: number): Gray {
  if (nw === src.w && nh === src.h) return src;
  if (nw > src.w || nh > src.h) return bilinearResize(src, nw, nh);
  const tx = areaTaps(src.w, nw);
  const ty = areaTaps(src.h, nh);
  const tmp = new Float32Array(nw * src.h);
  for (let y = 0; y < src.h; y++) {
    const row = y * src.w;
    for (let x = 0; x < nw; x++) {
      const ii = tx.idx[x];
      const ww = tx.wts[x];
      let s = 0;
      for (let k = 0; k < ii.length; k++) s += src.data[row + ii[k]] * ww[k];
      tmp[y * nw + x] = s;
    }
  }
  const out = new Float32Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    const ii = ty.idx[y];
    const ww = ty.wts[y];
    for (let k = 0; k < ii.length; k++) {
      const w = ww[k];
      const r = ii[k] * nw;
      const o = y * nw;
      for (let x = 0; x < nw; x++) out[o + x] += tmp[r + x] * w;
    }
  }
  return { w: nw, h: nh, data: out };
}

/** Downscale by `factor` (< 1) like synth.downscale_for. Returns the image and actual x/y ratios. */
export function downscale(src: Gray, factor: number): { img: Gray; sx: number; sy: number } {
  if (factor >= 1) return { img: src, sx: 1, sy: 1 };
  const nw = Math.max(1, Math.round(src.w * factor));
  const nh = Math.max(1, Math.round(src.h * factor));
  return { img: resize(src, nw, nh), sx: nw / src.w, sy: nh / src.h };
}

/**
 * Perspective warp with bilinear sampling. `dstToSrc` maps output pixel-corner
 * coordinates to input coordinates. border: 'replicate' or a constant value.
 */
export function warp(src: Gray, dstToSrc: Mat3, dw: number, dh: number, border: 'replicate' | number): Gray {
  const out = new Float32Array(dw * dh);
  const { w, h, data } = src;
  const constant = border === 'replicate' ? 0 : border;
  const rep = border === 'replicate';
  const px = (x: number, y: number) => {
    if (rep) {
      x = x < 0 ? 0 : x >= w ? w - 1 : x;
      y = y < 0 ? 0 : y >= h ? h - 1 : y;
      return data[y * w + x];
    }
    return x < 0 || y < 0 || x >= w || y >= h ? constant : data[y * w + x];
  };
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const [u, v] = applyH(dstToSrc, [x + 0.5, y + 0.5]);
      const fx = u - 0.5;
      const fy = v - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      out[y * dw + x] =
        (px(x0, y0) * (1 - tx) + px(x0 + 1, y0) * tx) * (1 - ty) +
        (px(x0, y0 + 1) * (1 - tx) + px(x0 + 1, y0 + 1) * tx) * ty;
    }
  }
  return { w: dw, h: dh, data: out };
}

export function mean(img: Gray): number {
  let s = 0;
  for (let i = 0; i < img.data.length; i++) s += img.data[i];
  return s / img.data.length;
}

export interface Letterboxed {
  img: Gray;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

/** Fit into size x size (centred, padded with the image mean) like synth.letterbox. */
export function letterbox(src: Gray, size: number): Letterboxed {
  const s = size / Math.max(src.w, src.h);
  const nw = Math.max(1, Math.round(src.w * s));
  const nh = Math.max(1, Math.round(src.h * s));
  const small = resize(src, nw, nh);
  const fill = Math.floor(mean(small));
  const data = new Float32Array(size * size).fill(fill);
  const ox = Math.floor((size - nw) / 2);
  const oy = Math.floor((size - nh) / 2);
  for (let y = 0; y < nh; y++) data.set(small.data.subarray(y * nw, (y + 1) * nw), (y + oy) * size + ox);
  return { img: { w: size, h: size, data }, sx: nw / src.w, sy: nh / src.h, ox, oy };
}

/** (x/255 - mean) / (std + 0.01), std with Bessel's correction (torch default). */
export function standardize(img: Gray): Float32Array {
  const n = img.data.length;
  let m = 0;
  for (let i = 0; i < n; i++) m += img.data[i];
  m /= n * 255;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const d = img.data[i] / 255 - m;
    v += d * d;
  }
  const s = Math.sqrt(v / (n - 1)) + 1e-2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (img.data[i] / 255 - m) / s;
  return out;
}

export function rotate90(src: Gray, clockwise = true): Gray {
  const { w, h, data } = src;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = data[y * w + x];
      if (clockwise) out[x * h + (h - 1 - y)] = v;
      else out[(w - 1 - x) * h + y] = v;
    }
  }
  return { w: h, h: w, data: out };
}
