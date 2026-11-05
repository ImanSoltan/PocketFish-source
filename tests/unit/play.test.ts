import { describe, expect, it } from 'vitest';
import { newLine, play, type Line } from '../../src/chess/game';
import { LEVELS } from '../../src/play/levels';
import { gameEnd, gameKey, resignation, takeBackPly } from '../../src/play/result';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function moves(fen: string, ucis: string[]): Line {
  let l = newLine(fen);
  for (const u of ucis) l = play(l, u)!;
  return l;
}

describe('the end of a game', () => {
  it('checkmate: the side that mated wins', () => {
    expect(gameEnd(moves(START, ['f2f3', 'e7e5', 'g2g4', 'd8h4']))).toEqual({ reason: 'checkmate', winner: 'b' });
    expect(gameEnd(moves('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', ['d1d8']))).toEqual({ reason: 'checkmate', winner: 'w' });
  });

  it('stalemate, insufficient material and the fifty-move rule are draws', () => {
    expect(gameEnd(newLine('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toEqual({ reason: 'stalemate', winner: null });
    expect(gameEnd(newLine('8/8/4k3/8/8/3K4/8/8 w - - 0 1'))).toEqual({ reason: 'insufficient', winner: null });
    expect(gameEnd(newLine('8/8/4k3/8/8/3K4/8/R7 w - - 100 80'))).toEqual({ reason: 'fifty-move', winner: null });
  });

  it('the same position three times is a draw', () => {
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    const twice = moves(START, shuffle);
    expect(gameEnd(twice)).toBeNull();
    const thrice = moves(START, [...shuffle, ...shuffle]);
    expect(gameEnd(thrice)).toEqual({ reason: 'repetition', winner: null });
    // looking at an earlier move: not over there
    expect(gameEnd({ ...thrice, ply: 4 })).toBeNull();
  });

  it('a game in progress is not over', () => {
    expect(gameEnd(moves(START, ['e2e4', 'e7e5']))).toBeNull();
  });
});

describe('taking a move back', () => {
  it("goes back to the player's turn before their last move", () => {
    const l = moves(START, ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
    expect(takeBackPly(l, 'w')).toBe(2); // before Nf3, Nc6 goes too
    expect(takeBackPly({ ...l, ply: 3 }, 'w')).toBe(2); // the engine hasn't answered yet
    expect(takeBackPly(l, 'b')).toBe(3);
  });

  it('nothing to take back at the start', () => {
    expect(takeBackPly(newLine(START), 'w')).toBeNull();
    // the engine (White) moved first
    expect(takeBackPly(moves(START, ['e2e4']), 'b')).toBeNull();
  });
});

describe('resigning', () => {
  it('the engine wins', () => {
    expect(resignation('w')).toEqual({ reason: 'resignation', winner: 'b' });
    expect(resignation('b')).toEqual({ reason: 'resignation', winner: 'w' });
  });

  it('a game is its start position and all its moves, wherever the cursor is', () => {
    const l = moves(START, ['e2e4', 'e7e5']);
    expect(gameKey({ ...l, ply: 0 })).toBe(gameKey(l));
    expect(gameKey(moves(START, ['e2e4']))).not.toBe(gameKey(l)); // taken back
    expect(gameKey(moves(START, ['e2e4', 'c7c5']))).not.toBe(gameKey(l)); // another move
    expect(gameKey(newLine('8/8/4k3/8/8/3K4/8/R7 w - - 0 1'))).not.toBe(gameKey(newLine(START)));
  });
});

describe('engine levels', () => {
  it('get stronger level by level', () => {
    expect(LEVELS).toHaveLength(8);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].skill).toBeGreaterThanOrEqual(LEVELS[i - 1].skill);
      expect(LEVELS[i].movetime).toBeGreaterThan(LEVELS[i - 1].movetime);
    }
    expect(LEVELS.at(-1)).toMatchObject({ skill: 20, depth: 0 });
  });
});
