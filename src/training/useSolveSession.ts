// Solve mode: the user looks for the best move in the current position while
// the engine (hidden) works out the answer. Their move is judged; a good move
// gets the engine's reply so a combination can be played out to the end.
import { useEffect, useMemo, useRef, useState } from 'react';
import { resultFeedback, tapFeedback } from '../app/platform';
import { moveSound, playSound } from '../app/sound';
import { applyUci, fenAt, play, status, type Line } from '../chess/game';
import { parseFen, validate } from '../chess/position';
import type { EngineLine } from '../engine/uci';
import { isSolved } from './judge';
import { loadStats, recordAttempt, saveStats, type SolveStats } from './stats';
import { useSolver, type MoveResult } from './useSolver';

export type SolvePhase = 'thinking' | 'checking' | 'verdict' | 'replying';

interface Session {
  rootFen: string;
  /** the position to solve is fenAt(line, ply); during checking / verdict the user's move follows it */
  ply: number;
  phase: SolvePhase;
  result: MoveResult | null;
  hint: boolean;
  revealed: boolean;
  /** best line remembered from a judged move, shown when the solution is revealed */
  solution: EngineLine | null;
}

const fresh = (rootFen: string, ply: number, keep: Partial<Session> = {}): Session => ({
  rootFen,
  ply,
  phase: 'thinking',
  result: null,
  hint: false,
  revealed: false,
  solution: null,
  ...keep,
});

export function isGameOver(fen: string): boolean {
  const st = status(fen);
  return st === 'checkmate' || st === 'stalemate' || st === 'insufficient' || st === 'fifty-move';
}

function solvable(fen: string): boolean {
  const s = parseFen(fen);
  return !!s && validate(s).length === 0 && !isGameOver(fen);
}

export function useSolveSession(
  line: Line,
  setLine: (l: Line) => void,
  active: boolean,
  maxDepth: number,
  sounds: boolean,
) {
  const [state, setState] = useState<Session>(() => fresh(line.rootFen, line.ply));
  const [stats, setStats] = useState<SolveStats>(loadStats);
  const lineRef = useRef(line);
  lineRef.current = line;
  // positions whose first attempt is already in the stats (for the current root position)
  const counted = useRef({ root: line.rootFen, fens: new Set<string>() });

  // the board moved on (back / forward, another position, a reply): start over there
  const valid =
    state.rootFen === line.rootFen && line.ply === (state.phase === 'thinking' ? state.ply : state.ply + 1);
  const s = valid ? state : fresh(line.rootFen, line.ply);
  useEffect(() => {
    if (!valid) setState(fresh(line.rootFen, line.ply));
  });

  const puzzleFen = fenAt(line, s.ply);
  const isSolvable = useMemo(() => solvable(puzzleFen), [puzzleFen]);
  const canSolve = active && isSolvable;
  const solver = useSolver(canSolve && s.phase !== 'replying' ? puzzleFen : null, maxDepth);
  const engineBest = solver.root?.lines[0] ?? null;

  const count = (fen: string, solved: boolean) => {
    if (counted.current.root !== line.rootFen) counted.current = { root: line.rootFen, fens: new Set() };
    if (counted.current.fens.has(fen)) return;
    counted.current.fens.add(fen);
    setStats((prev) => {
      const next = recordAttempt(prev, solved);
      saveStats(next);
      return next;
    });
  };

  const undoMove = () => {
    const l = lineRef.current;
    setLine({ ...l, moves: l.moves.slice(0, s.ply), ply: s.ply });
  };

  /** The user played `uci` in the position to solve. */
  const onMove = async (uci: string) => {
    if (!canSolve || s.phase !== 'thinking') return;
    const next = play(line, uci);
    if (!next) return;
    const at = s;
    setLine(next);
    setState({ ...at, phase: 'checking', result: null });
    const result = await solver.check(uci);
    if (result) {
      const ok = isSolved(result.verdict);
      count(puzzleFen, ok && !at.hint && !at.revealed);
      if (sounds) playSound(ok ? 'right' : 'wrong');
      resultFeedback(ok);
    }
    setState((cur) =>
      cur.rootFen === at.rootFen && cur.ply === at.ply && cur.phase === 'checking'
        ? { ...cur, phase: 'verdict', result, solution: result?.best ?? cur.solution }
        : cur,
    );
  };

  const showHint = () => setState({ ...s, hint: true });

  /** Show the best move (after a wrong move, take it back first). */
  const reveal = () => {
    count(puzzleFen, false);
    if (s.phase === 'verdict') undoMove();
    setState(fresh(s.rootFen, s.ply, { hint: s.hint, revealed: true, solution: s.result?.best ?? s.solution }));
  };

  const retry = () => {
    undoMove();
    setState(fresh(s.rootFen, s.ply, { hint: s.hint, revealed: s.revealed, solution: s.solution }));
  };

  /** After a good move: the engine answers, then it's the user's turn again. */
  const cont = async () => {
    if (s.phase !== 'verdict' || !s.result) return;
    const after = fenAt(line);
    if (isGameOver(after)) return;
    const at = s;
    setState({ ...at, phase: 'replying' });
    let reply: string | null = at.result!.played.pv[1] ?? null;
    if (!reply || !applyUci(after, reply)) reply = await solver.reply(after);
    const l = lineRef.current;
    const next = reply && l.rootFen === at.rootFen && l.ply === at.ply + 1 ? play(l, reply) : null;
    if (next) {
      setLine(next);
      if (sounds) playSound(moveSound(next.moves[next.ply - 1].san));
      tapFeedback();
    } else setState((cur) => (cur.phase === 'replying' ? { ...cur, phase: 'verdict' } : cur));
  };

  const best = s.solution ?? engineBest;
  return {
    phase: s.phase,
    result: s.result,
    hint: s.hint,
    revealed: s.revealed,
    stats,
    puzzleFen,
    canSolve,
    /** moves can be played on the board */
    acceptsMoves: canSolve && s.phase === 'thinking',
    /** square of the piece to move, once a hint was asked for */
    hintSquare: s.hint && best ? best.pv[0].slice(0, 2) : null,
    /** the best line, once revealed (while the move is still to be played) */
    solution: s.revealed && s.phase === 'thinking' ? best : null,
    /** the engine has something to show for hints / the solution */
    ready: !!best,
    error: solver.error,
    gameOver: s.phase === 'verdict' && isGameOver(fenAt(line)),
    onMove,
    showHint,
    reveal,
    retry,
    cont,
  };
}
