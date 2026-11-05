import { describe, expect, it } from 'vitest';
import { newLine, play, type Line } from '../../src/chess/game';
import { START_FEN } from '../../src/chess/position';
import { material } from '../../src/play/material';

function moves(fen: string, ucis: string[]): Line {
  let l = newLine(fen);
  for (const u of ucis) l = play(l, u)!;
  return l;
}

describe('material in play mode', () => {
  it('nothing taken and level at the start', () => {
    expect(material(newLine(START_FEN))).toEqual({ taken: { w: [], b: [] }, balance: 0 });
  });

  it('collects what each side took, cheapest first, and the balance', () => {
    // 1.e4 d5 2.exd5 Qxd5 3.Nc3 Qxg2 4.Bxg2
    const l = moves(START_FEN, ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5g2', 'f1g2']);
    expect(material(l)).toEqual({ taken: { w: ['p', 'q'], b: ['P', 'P'] }, balance: 8 });
  });

  it('follows the cursor when stepping back', () => {
    const l = moves(START_FEN, ['e2e4', 'd7d5', 'e4d5', 'd8d5']);
    expect(material({ ...l, ply: 3 })).toEqual({ taken: { w: ['p'], b: [] }, balance: 1 });
    expect(material({ ...l, ply: 0 }).taken).toEqual({ w: [], b: [] });
  });

  it('counts an en passant capture', () => {
    const l = moves('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', ['e5d6']);
    expect(material(l)).toEqual({ taken: { w: ['p'], b: [] }, balance: 1 });
  });

  it('a promotion changes the balance but takes nothing', () => {
    const l = moves('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', ['a7a8q']);
    expect(material(l)).toEqual({ taken: { w: [], b: [] }, balance: 9 });
  });

  it('a capture with promotion takes the piece on the square', () => {
    const l = moves('1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1', ['a7b8n']);
    expect(material(l)).toEqual({ taken: { w: ['r'], b: [] }, balance: 3 });
  });

  it('a scanned position starts with its own balance and nothing taken', () => {
    // White has an extra rook on the board
    expect(material(newLine('4k3/8/8/8/8/8/8/R3K3 b - - 0 1'))).toEqual({ taken: { w: [], b: [] }, balance: 5 });
  });

  it('Black ahead gives a negative balance', () => {
    const l = moves(START_FEN, ['e2e4', 'd7d5', 'g1f3', 'd5e4']);
    expect(material(l)).toEqual({ taken: { w: [], b: ['P'] }, balance: -1 });
  });
});
