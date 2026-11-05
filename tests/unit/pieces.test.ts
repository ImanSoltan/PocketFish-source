import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PIECE_SETS } from '../../src/board/pieceSets';

const root = new URL('../../', import.meta.url);

describe('piece sets', () => {
  it('ship all twelve pieces of every set as self-contained SVGs', () => {
    for (const { id } of PIECE_SETS) {
      for (const c of ['w', 'b']) {
        for (const p of ['K', 'Q', 'R', 'B', 'N', 'P']) {
          const svg = fs.readFileSync(new URL(`public/pieces/${id}/${c}${p}.svg`, root), 'utf8');
          expect(svg, `${id}/${c}${p}`).toMatch(/<svg[^>]*viewBox=/);
          expect(svg, `${id}/${c}${p}`).not.toMatch(/href="(https?:)?\/\//);
        }
      }
    }
  });

  it('are all precached for offline use', () => {
    const sw = fs.readFileSync(new URL('public/sw.js', root), 'utf8');
    const list = sw.match(/\.\.\.\[([^\]]*)\]\.flatMap\(\(set\)/)![1];
    const ids = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(ids).toEqual(PIECE_SETS.map((s) => s.id));
  });
});
