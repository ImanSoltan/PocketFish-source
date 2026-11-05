import { describe, expect, it } from 'vitest';
import { applyH, homography, invert3, isConvexQuad, type Pt } from '../../src/vision/geometry';
import { letterbox, resize, standardize, warp, type Gray } from '../../src/vision/imageops';
import { halfToFloat } from '../../src/vision/nn';
import { blackAtBottomScore, decodeLabels } from '../../src/vision/postprocess';
import { CLASSES } from '../../src/vision/recognize';
import { placementToBoard } from '../../src/chess/position';

const img = (w: number, h: number, f: (x: number, y: number) => number): Gray => {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = f(x, y);
  return { w, h, data };
};

describe('geometry', () => {
  it('solves a homography through four points', () => {
    const src: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const dst: Pt[] = [[10, 12], [110, 5], [120, 98], [3, 90]];
    const H = homography(src, dst);
    src.forEach((p, i) => {
      const q = applyH(H, p);
      expect(q[0]).toBeCloseTo(dst[i][0], 6);
      expect(q[1]).toBeCloseTo(dst[i][1], 6);
    });
    const back = applyH(invert3(H), dst[2]);
    expect(back[0]).toBeCloseTo(1, 6);
    expect(back[1]).toBeCloseTo(1, 6);
  });

  it('checks quad convexity and winding', () => {
    expect(isConvexQuad([[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(true);
    expect(isConvexQuad([[0, 0], [0, 10], [10, 10], [10, 0]])).toBe(false); // counter-clockwise
    expect(isConvexQuad([[0, 0], [10, 10], [10, 0], [0, 10]])).toBe(false); // self-intersecting
  });
});

describe('image ops', () => {
  it('area-resizes by averaging blocks', () => {
    const src = img(4, 4, (x, y) => (x < 2 && y < 2 ? 100 : 0));
    const out = resize(src, 2, 2);
    expect(Array.from(out.data)).toEqual([100, 0, 0, 0]);
    const odd = resize(img(3, 1, (x) => x * 30), 2, 1); // [0,30,60] -> [10, 50]
    expect(odd.data[0]).toBeCloseTo(10);
    expect(odd.data[1]).toBeCloseTo(50);
  });

  it('warps with the identity homography', () => {
    const src = img(8, 6, (x, y) => x * 10 + y);
    const out = warp(src, [1, 0, 0, 0, 1, 0, 0, 0, 1], 8, 6, 'replicate');
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });

  it('letterboxes into a square, centred', () => {
    const lb = letterbox(img(200, 100, () => 50), 256);
    expect(lb.img.w).toBe(256);
    expect(lb.oy).toBe(64);
    expect(lb.ox).toBe(0);
    expect(lb.sx).toBeCloseTo(256 / 200);
  });

  it('standardises to zero mean / unit variance', () => {
    const s = standardize(img(16, 16, (x, y) => (x * 7 + y * 13) % 255));
    const m = s.reduce((a, b) => a + b, 0) / s.length;
    expect(Math.abs(m)).toBeLessThan(1e-5);
  });

  it('decodes float16', () => {
    expect(Array.from(halfToFloat(new Uint16Array([0x3c00, 0xc000, 0x0000, 0x3555, 0x0001])))).toEqual([
      1, -2, 0, 0.333251953125, 5.960464477539063e-8,
    ]);
  });
});

describe('post-processing', () => {
  const onehot = (labels: string): Float32Array => {
    const p = new Float32Array(64 * 13).fill(0.001);
    [...labels].forEach((c, sq) => (p[sq * 13 + CLASSES.indexOf(c)] = 0.9));
    return p;
  };
  const start = 'rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR';

  it('keeps a clean recognition', () => {
    expect(decodeLabels(onehot(start)).map((k) => CLASSES[k]).join('')).toBe(start);
  });

  it('keeps only the most likely of two white kings', () => {
    const p = onehot(start);
    // a second, less confident "K" on e4
    const e4 = 36;
    p[e4 * 13 + CLASSES.indexOf('K')] = 0.6;
    p[e4 * 13 + CLASSES.indexOf('Q')] = 0.3;
    p[e4 * 13] = 0.001;
    const labels = decodeLabels(p).map((k) => CLASSES[k]);
    expect(labels[60]).toBe('K');
    expect(labels[e4]).toBe('Q');
  });

  it('never puts pawns on the back ranks', () => {
    const p = onehot('P' + start.slice(1));
    p[0 * 13 + CLASSES.indexOf('R')] = 0.5;
    expect(CLASSES[decodeLabels(p)[0]]).toBe('R');
  });

  it('guesses the printed orientation from pawns and kings', () => {
    const normal = placementToBoard('r1bq1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1')!;
    expect(blackAtBottomScore(normal)).toBeLessThan(0);
    expect(blackAtBottomScore(normal.slice().reverse())).toBeGreaterThan(0);
  });
});
