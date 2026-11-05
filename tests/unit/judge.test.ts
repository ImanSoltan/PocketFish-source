import { describe, expect, it } from 'vitest';
import { isSolved, judge, moverChance, moverMate } from '../../src/training/judge';
import { recordAttempt } from '../../src/training/stats';

const cp = (v: number) => ({ cp: v, mate: null });
const mate = (n: number) => ({ cp: null, mate: n });

describe('judging a move against the best move', () => {
  it('the engine move itself is best', () => {
    expect(judge('w', cp(80), cp(80), true).verdict).toBe('best');
  });

  it('grades by the drop in winning chances', () => {
    expect(judge('w', cp(30), cp(27), false).verdict).toBe('best');
    expect(judge('w', cp(50), cp(0), false).verdict).toBe('good');
    expect(judge('w', cp(100), cp(10), false).verdict).toBe('inaccuracy');
    expect(judge('w', cp(100), cp(-50), false).verdict).toBe('mistake');
    expect(judge('w', cp(300), cp(-300), false).verdict).toBe('blunder');
  });

  it('works from Black’s side (scores are from White’s side)', () => {
    expect(moverChance(cp(-200), 'b')).toBeCloseTo(1 - moverChance(cp(-200), 'w'));
    expect(judge('b', cp(-200), cp(100), false).verdict).toBe('blunder');
    expect(judge('b', cp(-200), cp(-190), false).verdict).toBe('best');
  });

  it('missing a forced mate is at least an inaccuracy', () => {
    const j = judge('w', mate(2), cp(900), false);
    expect(j.verdict).toBe('inaccuracy');
    expect(j.missedMate).toBe(2);
    expect(judge('b', mate(-3), cp(-1500), false).missedMate).toBe(3);
  });

  it('another mate counts; a slower one is only good', () => {
    expect(judge('w', mate(3), mate(3), false).verdict).toBe('best');
    expect(judge('w', mate(2), mate(5), false).verdict).toBe('good');
  });

  it('when getting mated anyway, any move is fine', () => {
    expect(moverMate(mate(-3), 'w')).toBeNull();
    expect(judge('w', mate(-5), mate(-2), false).verdict).toBe('best');
  });

  it('best and good count as solved', () => {
    expect(isSolved('best') && isSolved('good')).toBe(true);
    expect(isSolved('inaccuracy') || isSolved('mistake') || isSolved('blunder')).toBe(false);
  });
});

describe('solve stats', () => {
  it('counts first attempts and streaks', () => {
    let s = { tried: 0, solved: 0, streak: 0, bestStreak: 0 };
    s = recordAttempt(s, true);
    s = recordAttempt(s, true);
    s = recordAttempt(s, false);
    s = recordAttempt(s, true);
    expect(s).toEqual({ tried: 4, solved: 3, streak: 1, bestStreak: 2 });
  });
});
