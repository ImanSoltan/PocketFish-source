import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { decodePuzzles, solverColor, type Puzzle, type PuzzleFile } from '../../src/puzzles/data';
import { START, glicko2 } from '../../src/puzzles/glicko';
import { dailyPuzzle, dateKey, pickPuzzle } from '../../src/puzzles/pick';
import { hintSquare, opponentMove, puzzleLine, retry, reveal, showHint, solvedClean, solverMove, startRun } from '../../src/puzzles/run';
import { emptyProfile, recordResult, weakestThemes } from '../../src/puzzles/store';
import { THEME_FILTERS } from '../../src/puzzles/themes';

const file = JSON.parse(readFileSync(new URL('../../public/puzzles.json', import.meta.url), 'utf8')) as PuzzleFile;
const all = decodePuzzles(file);

const puzzle = (id: string, rating: number, themes: string[] = []): Puzzle => ({
  id,
  fen: '7k/2p3pp/8/8/8/8/5PPP/3RR1K1 b - - 0 1',
  moves: ['c7c6', 'd1d8'],
  rating,
  themes,
});

describe('Glicko-2', () => {
  it("matches Glickman's worked example", () => {
    const p = glicko2(
      { rating: 1500, rd: 200, vol: 0.06 },
      [
        { rating: 1400, rd: 30, score: 1 },
        { rating: 1550, rd: 100, score: 0 },
        { rating: 1700, rd: 300, score: 0 },
      ],
      0.5,
    );
    expect(p.rating).toBeCloseTo(1464.06, 1);
    expect(p.rd).toBeCloseTo(151.52, 1);
    expect(p.vol).toBeCloseTo(0.059996, 6); // the paper rounds it to 0.05999
  });

  it('a win against a stronger puzzle gains more than against a weaker one', () => {
    const up = (r: number) => glicko2(START, [{ rating: r, rd: 75, score: 1 }]).rating - START.rating;
    expect(up(1800)).toBeGreaterThan(up(1200));
    expect(up(1200)).toBeGreaterThan(0);
    const down = glicko2(START, [{ rating: 1500, rd: 75, score: 0 }]);
    expect(down.rating).toBeLessThan(1500);
    expect(down.rd).toBeLessThan(START.rd);
  });
});

describe('the puzzle set', () => {
  it('has thousands of puzzles over a wide range of ratings', () => {
    expect(all.length).toBeGreaterThan(5000);
    const ratings = all.map((p) => p.rating);
    expect(Math.min(...ratings)).toBeLessThan(800);
    expect(Math.max(...ratings)).toBeGreaterThan(2500);
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
  });

  it('every puzzle is legal and ends with the solver’s move', () => {
    for (const p of all) {
      expect(p.moves.length % 2, p.id).toBe(0);
      const c = new Chess(p.fen);
      for (const m of p.moves) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
      expect(c.turn() === solverColor(p), p.id).toBe(false); // the opponent is to move at the end
    }
  });

  it('the theme filters have puzzles', () => {
    for (const t of THEME_FILTERS) expect(all.filter((p) => p.themes.includes(t)).length, t).toBeGreaterThan(20);
  });
});

describe('picking puzzles', () => {
  const set = [puzzle('a', 1000), puzzle('b', 1400), puzzle('c', 1500, ['fork']), puzzle('d', 1600), puzzle('e', 2200, ['fork'])];
  const near = (target: number, played: string[] = [], theme = '') =>
    pickPuzzle(set, { target, theme, played: new Set(played), random: () => 0 })?.id;

  it('picks the closest unplayed puzzle', () => {
    expect(near(1480)).toBe('c');
    expect(near(1480, ['c'])).toBe('b');
    expect(near(2500)).toBe('e');
  });

  it('filters by theme and starts over when everything was played', () => {
    expect(near(1000, [], 'fork')).toBe('c');
    expect(near(1500, ['c'], 'fork')).toBe('e');
    expect(near(1500, ['c', 'e'], 'fork')).toBe('c');
  });

  it('never repeats the puzzle just played', () => {
    const p = pickPuzzle(set, { target: 1500, theme: 'fork', played: new Set(['c', 'e']), exclude: 'c', random: () => 0 });
    expect(p?.id).toBe('e');
  });

  it('the puzzle of the day is the same all day and changes with the date', () => {
    const d1 = dailyPuzzle(all, '2026-10-19');
    expect(dailyPuzzle(all, '2026-10-19')).toBe(d1);
    expect(d1!.rating).toBeGreaterThanOrEqual(1200);
    expect(d1!.rating).toBeLessThan(2000);
    const week = new Set(Array.from({ length: 7 }, (_, i) => dailyPuzzle(all, `2026-10-${20 + i}`)!.id));
    expect(week.size).toBe(7);
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('playing a puzzle', () => {
  const p = all.find((x) => x.moves.length === 4)!;
  /** a legal move that is neither the solution nor a mate */
  const wrongMove = (fen: string, not: string) => {
    const m = new Chess(fen).moves({ verbose: true }).find((x) => x.lan !== not && !x.san.includes('#'))!;
    return m.lan;
  };

  it('the opponent moves first, then the solver; the right moves solve it', () => {
    let r = startRun(p);
    expect(r.phase).toBe('waiting');
    r = opponentMove(r);
    expect(r.phase).toBe('play');
    expect(r.line.ply).toBe(1);
    r = solverMove(r, p.moves[1]);
    expect(r.phase).toBe('waiting');
    r = opponentMove(r);
    r = solverMove(r, p.moves[3]);
    expect(r.phase).toBe('done');
    expect(solvedClean(r)).toBe(true);
    expect(puzzleLine(r).ply).toBe(1);
    expect(puzzleLine(r).moves).toHaveLength(4);
  });

  it('a wrong move fails it; it can be taken back and found', () => {
    let r = opponentMove(startRun(p));
    const fen = r.line.moves[0].fen;
    r = solverMove(r, wrongMove(fen, p.moves[1]));
    expect(r.phase).toBe('wrong');
    expect(r.failed).toBe(true);
    expect(r.line.ply).toBe(2);
    r = retry(r);
    expect(r.phase).toBe('play');
    expect(r.line.moves).toHaveLength(1);
    r = opponentMove(solverMove(r, p.moves[1]));
    r = solverMove(r, p.moves[3]);
    expect(r.phase).toBe('done');
    expect(solvedClean(r)).toBe(false);
  });

  it('a hint shows the piece to move and counts as help', () => {
    const r = showHint(opponentMove(startRun(p)));
    expect(r.failed).toBe(true);
    expect(hintSquare(r)).toBe(p.moves[1].slice(0, 2));
  });

  it('the solution plays the remaining moves and shows the next one', () => {
    let r = reveal(opponentMove(startRun(p)));
    expect(r.phase).toBe('done');
    expect(r.revealed).toBe(true);
    expect(r.line.moves.map((m) => m.uci)).toEqual(p.moves);
    expect(r.line.ply).toBe(2);
    // after a wrong move, the wrong move goes
    r = opponentMove(startRun(p));
    r = reveal(solverMove(r, wrongMove(r.line.moves[0].fen, p.moves[1])));
    expect(r.line.moves.map((m) => m.uci)).toEqual(p.moves);
  });

  it('any checkmate is right', () => {
    const mate = puzzle('m', 1000);
    let r = opponentMove(startRun(mate));
    r = solverMove(r, 'e1e8'); // the puzzle says Rd8#, Re8# mates as well
    expect(r.phase).toBe('done');
    expect(solvedClean(r)).toBe(true);
  });
});

describe('the puzzle rating', () => {
  it('counts every puzzle once', () => {
    const p = puzzle('x', 1500, ['fork', 'short']);
    const won = recordResult(emptyProfile(), p, true);
    expect(won.delta).toBeGreaterThan(0);
    expect(won.profile).toMatchObject({ tried: 1, solved: 1, streak: 1, bestStreak: 1, played: ['x'] });
    expect(won.profile.themes).toEqual({ fork: [1, 1], short: [1, 1] });
    expect(won.profile.history).toEqual([Math.round(won.profile.glicko.rating)]);
    const again = recordResult(won.profile, p, false);
    expect(again.delta).toBeNull();
    expect(again.profile).toBe(won.profile);
  });

  it('a miss lowers the rating and ends the streak', () => {
    const won = recordResult(emptyProfile(), puzzle('x', 1500), true).profile;
    const lost = recordResult(won, puzzle('y', 1500, ['fork']), false);
    expect(lost.delta).toBeLessThan(0);
    expect(lost.profile).toMatchObject({ tried: 2, solved: 1, streak: 0, bestStreak: 1 });
  });

  it('lists the weakest themes first', () => {
    let pr = emptyProfile();
    for (const [i, win] of [true, true, true, false, false, false].entries()) {
      pr = recordResult(pr, puzzle(`f${i}`, 1500, [win ? 'fork' : 'pin']), win).profile;
    }
    pr = recordResult(pr, puzzle('p', 1500, ['fork']), false).profile;
    expect(weakestThemes(pr).map((t) => t.theme)).toEqual(['pin', 'fork']);
  });
});
