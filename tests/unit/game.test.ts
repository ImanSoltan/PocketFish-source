import { describe, expect, it } from 'vitest';
import { applyUci, fenAt, legalMoves, newLine, play, pvToSan, restoreLine, status } from '../../src/chess/game';
import { START_FEN } from '../../src/chess/position';

describe('line', () => {
  it('plays moves, navigates and branches', () => {
    let l = newLine(START_FEN);
    l = play(l, 'e2e4')!;
    l = play(l, 'e7e5')!;
    expect(l.moves.map((m) => m.san)).toEqual(['e4', 'e5']);
    l = { ...l, ply: 1 };
    // same move as the existing continuation: just advance
    expect(play(l, 'e7e5')!.moves.length).toBe(2);
    // different move: truncate and branch
    const b = play(l, 'c7c5')!;
    expect(b.moves.map((m) => m.san)).toEqual(['e4', 'c5']);
    expect(fenAt(b)).toBe('rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  });

  it('rejects illegal moves', () => {
    expect(play(newLine(START_FEN), 'e2e5')).toBeNull();
  });

  it('handles promotion', () => {
    const r = applyUci('8/P6k/8/8/8/8/8/K7 w - - 0 1', 'a7a8q')!;
    expect(r.san).toBe('a8=Q');
    expect(legalMoves('8/P6k/8/8/8/8/8/K7 w - - 0 1').filter((m) => m.promotion).length).toBe(4);
  });

  it('converts a PV to SAN', () => {
    expect(pvToSan(START_FEN, ['e2e4', 'e7e5', 'g1f3', 'b8c6'])).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(pvToSan(START_FEN, ['e2e4', 'e2e4'])).toEqual(['e4']);
  });

  it('reports game status', () => {
    expect(status('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1')).toBe('checkmate');
    expect(status('7k/8/6Q1/8/8/8/8/K7 b - - 0 1')).toBe('stalemate');
    expect(status(START_FEN)).toBeNull();
  });
});

describe('restoring the saved line', () => {
  const e4 = applyUci(START_FEN, 'e2e4')!;
  const saved = { rootFen: START_FEN, moves: [e4], ply: 1 };

  it('keeps a good line and its cursor', () => {
    expect(restoreLine(saved)).toEqual(saved);
    expect(restoreLine({ ...saved, ply: 0 })?.ply).toBe(0);
  });

  it('keeps the cursor within the moves', () => {
    expect(restoreLine({ ...saved, ply: 5 })?.ply).toBe(1);
    expect(restoreLine({ ...saved, ply: -1 })?.ply).toBe(0);
    expect(restoreLine({ ...saved, ply: 'x' })?.ply).toBe(0);
    expect(restoreLine({ ...saved, ply: 0.5 })?.ply).toBe(0);
    expect(restoreLine({ rootFen: START_FEN, moves: [e4] })?.ply).toBe(0);
  });

  it('refuses anything else, so the app starts from the start position', () => {
    for (const bad of [null, 'x', 42, [], {}, { rootFen: 'nonsense', moves: [] }, { rootFen: START_FEN, moves: {} },
      { rootFen: START_FEN, moves: [null], ply: 1 }, { rootFen: START_FEN, moves: [{ uci: 'e2e4' }], ply: 1 },
      { rootFen: START_FEN, moves: [{ ...e4, fen: 7 }], ply: 1 }]) {
      expect(restoreLine(bad)).toBeNull();
    }
  });
});
