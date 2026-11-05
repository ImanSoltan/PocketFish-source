// The TypeScript recognition pipeline must reproduce the Python reference
// (ml/pipeline.py) that the models were evaluated with. Fixture produced by
// `python ml/make_parity.py` with the models in public/models.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Model } from '../../src/vision/nn';
import { classifySquares, detectBoard, NET_SIZE } from '../../src/vision/recognize';
import { letterbox } from '../../src/vision/imageops';
import { decodeLabels } from '../../src/vision/postprocess';
import type { Gray } from '../../src/vision/imageops';

const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root));
const toArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

function readPgm(buf: Buffer): Gray {
  const text = buf.subarray(0, 64).toString('latin1');
  const m = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(text)!;
  const w = Number(m[1]);
  const h = Number(m[2]);
  const pixels = buf.subarray(m[0].length, m[0].length + w * h);
  return { w, h, data: Float32Array.from(pixels) };
}

// the models aren't part of the public source (all rights reserved): there, this test is skipped
const hasModels = existsSync(new URL('public/models/board.bin', root));

describe.runIf(hasModels)('TypeScript pipeline matches the Python reference', () => {
  const expected = JSON.parse(read('tests/fixtures/parity.json').toString());
  const gray = readPgm(read('tests/fixtures/parity.pgm'));
  // vitest still runs this body for a skipped suite: read the models only when they exist
  const model = (name: string) => (hasModels ? Model.fromBuffer(toArrayBuffer(read(`public/models/${name}`))) : (null as never));
  const boardNet = model('board.bin');
  const squareNet = model('squares.bin');

  it('letterboxes like the training data', () => {
    const lb = letterbox(gray, NET_SIZE);
    expect(lb.img.w).toBe(NET_SIZE);
    expect([gray.w, gray.h]).toEqual(expected.size);
  });

  it('finds the same corners', () => {
    const det = detectBoard(boardNet, gray);
    expect(det.found).toBe(expected.found);
    det.corners.forEach((c, i) => {
      expect(Math.abs(c[0] - expected.corners[i][0])).toBeLessThan(0.05);
      expect(Math.abs(c[1] - expected.corners[i][1])).toBeLessThan(0.05);
    });
  });

  it('classifies the squares identically', () => {
    const corners = expected.corners as [number, number][];
    const probs = classifySquares(squareNet, gray, corners);
    for (let i = 0; i < probs.length; i++) {
      expect(Math.abs(probs[i] - expected.probs[Math.floor(i / 13)][i % 13])).toBeLessThan(2e-3);
    }
    expect(decodeLabels(probs)).toEqual(expected.labels);
  });
});
