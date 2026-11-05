// Playing one puzzle: the opponent's move sets it up, then the solver's and the opponent's
// moves alternate. The expected move, or any other checkmate, is right. A wrong move, a hint
// or the solution makes the puzzle count as failed; the moves can still be found afterwards.
import { applyUci, fenAt, newLine, play, status, type Line } from '../chess/game';
import type { Puzzle } from './data';

export type Phase =
  /** the opponent's move is coming */
  | 'waiting'
  /** the solver's turn */
  | 'play'
  /** the solver's last move was wrong (it's on the board) */
  | 'wrong'
  | 'done';

export interface Run {
  puzzle: Puzzle;
  line: Line;
  /** index in puzzle.moves of the next move */
  next: number;
  phase: Phase;
  /** a wrong move, hint or the solution: no longer solved at the first try */
  failed: boolean;
  hint: boolean;
  revealed: boolean;
}

export function startRun(puzzle: Puzzle): Run {
  return { puzzle, line: newLine(puzzle.fen), next: 0, phase: 'waiting', failed: false, hint: false, revealed: false };
}

/** Plays the opponent's move that is coming. */
export function opponentMove(r: Run): Run {
  if (r.phase !== 'waiting') return r;
  const line = play(r.line, r.puzzle.moves[r.next]);
  if (!line) return { ...r, phase: 'done' };
  const next = r.next + 1;
  return { ...r, line, next, phase: next >= r.puzzle.moves.length ? 'done' : 'play' };
}

/** The solver's move. */
export function solverMove(r: Run, uci: string): Run {
  if (r.phase !== 'play') return r;
  const rec = applyUci(fenAt(r.line), uci);
  const line = play(r.line, uci);
  if (!rec || !line) return r;
  const expected = r.puzzle.moves[r.next];
  if (uci !== expected && status(rec.fen) !== 'checkmate') return { ...r, line, phase: 'wrong', failed: true };
  const next = r.next + 1;
  const done = next >= r.puzzle.moves.length || status(rec.fen) === 'checkmate';
  return { ...r, line, next, phase: done ? 'done' : 'waiting' };
}

/** Takes the wrong move back. */
export function retry(r: Run): Run {
  if (r.phase !== 'wrong') return r;
  const ply = r.line.ply - 1;
  return { ...r, line: { ...r.line, moves: r.line.moves.slice(0, ply), ply }, phase: 'play' };
}

export function showHint(r: Run): Run {
  return r.phase === 'play' ? { ...r, hint: true, failed: true } : r;
}

/** The square of the piece the solver should move. */
export const hintSquare = (r: Run): string | null =>
  r.hint && r.phase === 'play' ? r.puzzle.moves[r.next].slice(0, 2) : null;

/** Plays the rest of the solution; the board shows the solver's next move. */
export function reveal(r: Run): Run {
  if (r.phase === 'done') return r;
  let line = r.phase === 'wrong' ? retry(r).line : r.line;
  const at = line.ply;
  for (const m of r.puzzle.moves.slice(r.next)) line = play(line, m) ?? line;
  // the opponent's move still coming is shown too
  const shown = Math.min(line.moves.length, at + (r.phase === 'waiting' ? 2 : 1));
  return { ...r, line: { ...line, ply: shown }, next: r.puzzle.moves.length, phase: 'done', failed: true, revealed: true };
}

/** Solved at the first try, without help. */
export const solvedClean = (r: Run) => r.phase === 'done' && !r.failed;

/** The position the solver starts from (after the opponent's first move). */
export function puzzleLine(r: Run): Line {
  return { ...r.line, ply: Math.min(1, r.line.moves.length) };
}
