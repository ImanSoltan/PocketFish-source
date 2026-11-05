// Board localisation (BoardNet) and square classification (SquareNet).
import { applyH, homography, invert3, isConvexQuad, multiply3, quadArea, quadSize, scale3, type Pt } from './geometry';
import { downscale, letterbox, mean, standardize, warp, type Gray } from './imageops';
import type { Model, Tensor } from './nn';

export const NET_SIZE = 256;
const OUT_STRIDE = 4;
/** must match synth.make_detector_sample (refine mode): board side = 256 / ~1.3 */
const REFINE_SIDE = NET_SIZE / 1.3;
/** square labels, index 0 = empty (same order as ml/synth.py CLASSES) */
export const CLASSES = '.PNBRQKpnbrqk';

export interface Detection {
  /** TL, TR, BR, BL in image pixel coordinates */
  corners: Pt[];
  /** peak confidence of each corner heatmap (0..1) */
  scores: number[];
  found: boolean;
}

function decodeCorners(out: Tensor): { pts: Pt[]; scores: number[] } {
  const n = out.h * out.w;
  const pts: Pt[] = [];
  const scores: number[] = [];
  for (let ch = 1; ch <= 4; ch++) {
    const base = ch * n;
    let mx = -Infinity;
    let arg = 0;
    for (let i = 0; i < n; i++) {
      const v = out.data[base + i];
      if (v > mx) {
        mx = v;
        arg = i;
      }
    }
    let total = 0;
    for (let i = 0; i < n; i++) total += Math.exp(out.data[base + i] - mx);
    const ay = Math.floor(arg / out.w);
    const ax = arg % out.w;
    let sw = 0;
    let sx = 0;
    let sy = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const y = ay + dy;
        const x = ax + dx;
        if (y < 0 || x < 0 || y >= out.h || x >= out.w) continue;
        const p = Math.exp(out.data[base + y * out.w + x] - mx);
        sw += p;
        sx += p * x;
        sy += p * y;
      }
    }
    pts.push([(sx / sw + 0.5) * OUT_STRIDE, (sy / sw + 0.5) * OUT_STRIDE]);
    scores.push(sw / total);
  }
  return { pts, scores };
}

function runNet(model: Model, img: Gray): Tensor {
  return model.run({ c: 1, h: img.h, w: img.w, data: standardize(img) });
}

/** One refinement pass: rectify around the current estimate and re-detect. */
function refine(model: Model, gray: Gray, corners: Pt[]): { pts: Pt[]; scores: number[] } {
  const c0 = (NET_SIZE - REFINE_SIDE) / 2;
  const ideal: Pt[] = [
    [c0, c0],
    [c0 + REFINE_SIDE, c0],
    [c0 + REFINE_SIDE, c0 + REFINE_SIDE],
    [c0, c0 + REFINE_SIDE],
  ];
  const f = Math.min(1, (1.3 * REFINE_SIDE) / Math.max(quadSize(corners), 1));
  const { img: small, sx, sy } = downscale(gray, f);
  const scaled = corners.map(([x, y]) => [x * sx, y * sy] as Pt);
  const H = homography(scaled, ideal); // small image -> crop
  const crop = warp(small, invert3(H), NET_SIZE, NET_SIZE, Math.floor(mean(small)));
  const { pts, scores } = decodeCorners(runNet(model, crop));
  const back = multiply3(scale3(1 / sx, 1 / sy), invert3(H)); // crop -> original image
  return { pts: pts.map((p) => applyH(back, p)), scores };
}

/** One refinement pass is enough: a second one doesn't reduce the corner error further. */
export function detectBoard(model: Model, gray: Gray, refinePasses = 1): Detection {
  const lb = letterbox(gray, NET_SIZE);
  const first = decodeCorners(runNet(model, lb.img));
  let corners = first.pts.map(([x, y]) => [(x - lb.ox) / lb.sx, (y - lb.oy) / lb.sy] as Pt);
  let scores = first.scores;
  if (isConvexQuad(corners)) {
    for (let i = 0; i < refinePasses; i++) {
      try {
        const r = refine(model, gray, corners);
        if (!isConvexQuad(r.pts)) break;
        corners = r.pts;
        scores = r.scores;
      } catch {
        break;
      }
    }
  }
  const area = quadArea(corners) / (gray.w * gray.h);
  // calibrated on the validation photos (ml/calibrate_found.py): with a board the first-pass
  // confidence is > 0.93 for 99% of photos, without one it is < 0.4 for 95% of them
  const found = isConvexQuad(corners) && area > 0.01 && Math.min(...first.scores) > 0.5 && Math.min(...scores) > 0.3;
  return { corners, scores, found };
}

/** A default quad (centred square) for when no board was found. */
export function defaultQuad(w: number, h: number): Pt[] {
  const s = Math.min(w, h) * 0.8;
  const x = (w - s) / 2;
  const y = (h - s) / 2;
  return [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
  ];
}

/** Rectify the board like synth.rectify: 256x256, 32 px per square. */
export function rectifyBoard(gray: Gray, corners: Pt[]): Gray {
  const f = Math.min(1, (1.25 * NET_SIZE) / Math.max(quadSize(corners), 1));
  const { img: small, sx, sy } = downscale(gray, f);
  const scaled = corners.map(([x, y]) => [x * sx, y * sy] as Pt);
  const dst: Pt[] = [
    [0, 0],
    [NET_SIZE, 0],
    [NET_SIZE, NET_SIZE],
    [0, NET_SIZE],
  ];
  const H = homography(scaled, dst);
  return warp(small, invert3(H), NET_SIZE, NET_SIZE, 'replicate');
}

/** Softmax of SquareNet's 13 x 8 x 8 output -> [64 * 13], squares in image order. */
function squareProbs(out: Tensor): Float32Array {
  const probs = new Float32Array(64 * 13);
  for (let sq = 0; sq < 64; sq++) {
    let mx = -Infinity;
    for (let k = 0; k < 13; k++) mx = Math.max(mx, out.data[k * 64 + sq]);
    let s = 0;
    for (let k = 0; k < 13; k++) {
      const e = Math.exp(out.data[k * 64 + sq] - mx);
      probs[sq * 13 + k] = e;
      s += e;
    }
    for (let k = 0; k < 13; k++) probs[sq * 13 + k] /= s;
  }
  return probs;
}

function mirror(img: Gray): Gray {
  const { w, h, data } = img;
  const out = new Float32Array(data.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = data[y * w + (w - 1 - x)];
  return { w, h, data: out };
}

/**
 * Square class probabilities [64 * 13], squares in image order (row 0 = top).
 * The board is also read mirrored left-right and both readings are averaged,
 * which noticeably helps on unusual piece styles.
 */
export function classifySquares(model: Model, gray: Gray, corners: Pt[], tta = true): Float32Array {
  const board = rectifyBoard(gray, corners);
  const probs = squareProbs(runNet(model, board));
  if (!tta) return probs;
  const flipped = squareProbs(runNet(model, mirror(board)));
  for (let sq = 0; sq < 64; sq++) {
    const m = (sq & ~7) + (7 - (sq & 7)); // same square on the mirrored board
    for (let k = 0; k < 13; k++) probs[sq * 13 + k] = (probs[sq * 13 + k] + flipped[m * 13 + k]) / 2;
  }
  return probs;
}

/** Mean of the per-square top probability: how confident a reading is. */
export function readingConfidence(probs: Float32Array): number {
  let s = 0;
  for (let sq = 0; sq < 64; sq++) {
    let m = 0;
    for (let k = 0; k < 13; k++) m = Math.max(m, probs[sq * 13 + k]);
    s += m;
  }
  return s / 64;
}

/** Corner order rotated by k quarter turns (the board's top-left becomes corner k). */
export const rotateCorners = (c: Pt[], k: number): Pt[] => [0, 1, 2, 3].map((i) => c[(i + k) % 4]);

/**
 * Classify the squares; if the reading looks unsure, also try the board turned by
 * 90/180/270 degrees (sideways or upside-down photos) and keep the most confident.
 */
export function classifyAnyRotation(
  model: Model,
  gray: Gray,
  corners: Pt[],
  minConfidence = 0.9,
): { probs: Float32Array; corners: Pt[]; rotation: number } {
  let best = { probs: classifySquares(model, gray, corners), corners, rotation: 0 };
  let bestScore = readingConfidence(best.probs);
  if (bestScore >= minConfidence) return best;
  for (const k of [1, 2, 3]) {
    const c = rotateCorners(corners, k);
    const probs = classifySquares(model, gray, c);
    const score = readingConfidence(probs);
    if (score > bestScore + 0.02) {
      best = { probs, corners: c, rotation: k };
      bestScore = score;
    }
  }
  return best;
}
