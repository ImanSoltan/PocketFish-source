import { describe, expect, it } from 'vitest';
import {
  START_FEN,
  epCandidates,
  forcedTurn,
  inCheck,
  isAttacked,
  parseFen,
  placementToBoard,
  possibleCastling,
  rotate180,
  setupToFen,
  squareIndex,
  squareName,
  validate,
} from '../../src/chess/position';

describe('squares', () => {
  it('maps names to FEN-order indices', () => {
    expect(squareIndex('a8')).toBe(0);
    expect(squareIndex('h8')).toBe(7);
    expect(squareIndex('a1')).toBe(56);
    expect(squareIndex('h1')).toBe(63);
    expect(squareIndex('e4')).toBe(36);
    for (let i = 0; i < 64; i++) expect(squareIndex(squareName(i))).toBe(i);
  });
});

describe('FEN', () => {
  it('round-trips the start position', () => {
    expect(setupToFen(parseFen(START_FEN)!)).toBe(START_FEN);
  });

  it('accepts a bare piece placement', () => {
    const s = parseFen('8/8/8/4k3/8/8/8/4K3')!;
    expect(s.turn).toBe('w');
    expect(setupToFen(s)).toBe('8/8/8/4k3/8/8/8/4K3 w - - 0 1');
  });

  it('rejects malformed placements', () => {
    expect(placementToBoard('8/8/8')).toBeNull();
    expect(placementToBoard('9/8/8/8/8/8/8/8')).toBeNull();
    expect(placementToBoard('rnbqkbnrr/8/8/8/8/8/8/8')).toBeNull();
    expect(placementToBoard('x7/8/8/8/8/8/8/8')).toBeNull();
  });

  it('drops castling rights that are impossible', () => {
    const s = parseFen('4k3/8/8/8/8/8/8/4K2R w KQkq - 0 1')!;
    expect(s.castling).toEqual({ K: true, Q: false, k: false, q: false });
    expect(setupToFen(s)).toBe('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
  });
});

describe('attacks and checks', () => {
  it('detects attacks by every piece type', () => {
    const b = placementToBoard('4k3/8/8/3p4/8/2N5/8/R3K3')!;
    expect(isAttacked(b, squareIndex('e4'), 'b')).toBe(true); // black pawn d5 attacks e4
    expect(isAttacked(b, squareIndex('d4'), 'b')).toBe(false);
    expect(isAttacked(b, squareIndex('d5'), 'w')).toBe(true); // knight c3
    expect(isAttacked(b, squareIndex('a8'), 'w')).toBe(true); // rook a1 up the file
    expect(isAttacked(b, squareIndex('e2'), 'w')).toBe(true); // king
  });

  it('blocks sliding attacks', () => {
    const b = placementToBoard('4k3/8/8/8/8/8/P7/R3K3')!;
    expect(isAttacked(b, squareIndex('a8'), 'w')).toBe(false);
  });

  it('knows who is in check and therefore to move', () => {
    const b = placementToBoard('4k3/8/8/8/8/8/8/4KR2')!;
    expect(inCheck(b, 'b')).toBe(false);
    const c = placementToBoard('4k3/8/8/8/8/8/8/4R1K1')!;
    expect(inCheck(c, 'b')).toBe(true);
    expect(forcedTurn(c)).toBe('b');
    expect(forcedTurn(b)).toBeNull();
  });
});

describe('validate', () => {
  it('accepts the start position', () => {
    expect(validate(parseFen(START_FEN)!)).toEqual([]);
  });

  it('reports missing kings, back-rank pawns and the wrong side in check', () => {
    expect(validate(parseFen('8/8/8/8/8/8/8/4K3 w - - 0 1')!).map((p) => p.code)).toContain('missing-king');
    expect(validate(parseFen('P3k3/8/8/8/8/8/8/4K3 w - - 0 1')!).map((p) => p.code)).toContain('pawn-back-rank');
    expect(validate(parseFen('4k3/8/8/8/8/8/8/4R1K1 w - - 0 1')!).map((p) => p.code)).toContain('opponent-in-check');
    expect(validate(parseFen('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1')!)).toEqual([]);
  });
});

describe('helpers', () => {
  it('rotates the board', () => {
    const b = placementToBoard(START_FEN.split(' ')[0])!;
    const r = rotate180(b);
    expect(r[squareIndex('h1')]).toBe('r');
    expect(r[squareIndex('a8')]).toBe('R');
    expect(r[squareIndex('d1')]).toBe('k'); // e8 -> d1
  });

  it('infers castling from home squares', () => {
    expect(possibleCastling(placementToBoard('r3k2r/8/8/8/8/8/8/R3K2R')!)).toEqual({ K: true, Q: true, k: true, q: true });
    expect(possibleCastling(placementToBoard('r3k3/8/8/8/8/8/8/4K2R')!)).toEqual({ K: true, Q: false, k: false, q: true });
  });
});

describe('en passant', () => {
  it('offers the square behind a pawn that may just have moved two squares', () => {
    const b = placementToBoard('4k3/8/8/3pP3/8/8/8/4K3')!;
    expect(epCandidates(b, 'w')).toEqual(['d6']);
    expect(epCandidates(b, 'b')).toEqual([]);
    // blocked: something stands on d6
    expect(epCandidates(placementToBoard('4k3/8/3n4/3pP3/8/8/8/4K3')!, 'w')).toEqual([]);
  });
});

describe('parseFen keeps the optional fields sensible', () => {
  it('drops an en-passant square that is impossible here', () => {
    expect(parseFen('4k3/8/8/8/8/8/8/4K3 w - e3 0 1')?.ep).toBeNull();
    // after 1. e4 with Black to move, but no black pawn next to e4
    expect(parseFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')?.ep).toBeNull();
  });

  it('keeps one that is possible', () => {
    // 1. e4 … 2. e5 d5: White can take en passant on d6
    expect(parseFen('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3')?.ep).toBe('d6');
  });

  it('keeps the move counters within bounds', () => {
    const s = parseFen('4k3/8/8/8/8/8/8/4K3 w - - 99999999999 99999999999')!;
    expect(s.halfmove).toBe(150);
    expect(s.fullmove).toBe(9999);
    expect(parseFen('4k3/8/8/8/8/8/8/4K3 w - - -5 0')).toMatchObject({ halfmove: 0, fullmove: 1 });
  });
});
