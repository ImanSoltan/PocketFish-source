// Solve mode engine work: analyse the position to solve in the background
// (hidden from the user), then judge the user's move against it.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Color } from '../chess/position';
import { getEngine, type AnalysisOptions, type AnalysisUpdate } from '../engine/engine';
import type { EngineLine } from '../engine/uci';
import { judge, type Judgement } from './judge';

/** moves are compared at (at least) this depth */
const JUDGE_DEPTH = 16;
/** the engine keeps thinking up to this depth while the user does */
const ROOT_DEPTH = 22;

export interface MoveResult extends Judgement {
  uci: string;
  /** engine's best line from the position (scores from White's side) */
  best: EngineLine;
  /** line starting with the user's move */
  played: EngineLine;
}

/** One search to the end; null if another request replaced it. */
function searchOnce(fen: string, opts: AnalysisOptions): Promise<AnalysisUpdate | null> {
  return new Promise((resolve) => {
    getEngine()
      .analyze(fen, opts, (u) => {
        if (u.aborted) resolve(null);
        else if (u.done) resolve(u);
      })
      .catch(() => resolve(null));
  });
}

export function useSolver(fen: string | null, maxDepth: number) {
  const judgeDepth = maxDepth > 0 ? Math.min(JUDGE_DEPTH, maxDepth) : JUDGE_DEPTH;
  const rootDepth = maxDepth > 0 ? Math.min(ROOT_DEPTH, maxDepth) : ROOT_DEPTH;
  const [root, setRoot] = useState<AnalysisUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  // bumped to restart the background analysis after a one-off search replaced it
  const [run, setRun] = useState(0);
  const rootRef = useRef<AnalysisUpdate | null>(null);
  const failed = useRef(false);
  const fenRef = useRef(fen);
  fenRef.current = fen;
  const waiters = useRef(new Set<() => void>());
  const wake = () => [...waiters.current].forEach((w) => w());

  useEffect(() => {
    rootRef.current = null;
    setRoot(null);
    if (!fen) return;
    const engine = getEngine();
    let cancelled = false;
    let shownDepth = -1;
    const listener = (u: AnalysisUpdate) => {
      if (cancelled || u.aborted) return;
      rootRef.current = u;
      wake();
      // re-render once per depth, not for every engine line
      if (u.done || u.depth !== shownDepth) {
        shownDepth = u.depth;
        setRoot(u);
      }
    };
    setError(null);
    failed.current = false;
    engine.analyze(fen, { multiPv: 3, depth: rootDepth }, listener).catch((e) => {
      failed.current = true;
      wake();
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelled = true;
      engine.stop(listener);
      wake();
    };
  }, [fen, run, rootDepth]);

  /** The background analysis once it can judge a move; null if the position changed meanwhile. */
  const ready = (forFen: string) =>
    new Promise<AnalysisUpdate | null>((resolve) => {
      const test = () => {
        const r = rootRef.current;
        if (fenRef.current !== forFen || failed.current) {
          waiters.current.delete(test);
          resolve(null);
        } else if (r && r.fen === forFen && r.lines.length > 0 && (r.done || r.depth >= judgeDepth)) {
          waiters.current.delete(test);
          resolve(r);
        }
      };
      waiters.current.add(test);
      test();
    });

  /** Judge `uci` played in the current position. */
  const check = useCallback(
    async (uci: string): Promise<MoveResult | null> => {
      const forFen = fenRef.current;
      if (!forFen) return null;
      const r = await ready(forFen);
      if (!r) return null;
      const best = r.lines[0];
      let played = r.lines.find((l) => l.pv[0] === uci) ?? null;
      if (!played) {
        // not among the engine's top lines: score this move on its own
        const u = await searchOnce(forFen, { multiPv: 1, depth: judgeDepth, searchMoves: [uci] });
        if (fenRef.current !== forFen) return null;
        setRun((n) => n + 1);
        played = u?.lines[0] ?? null;
      }
      if (!played) return null;
      const mover: Color = forFen.split(' ')[1] === 'b' ? 'b' : 'w';
      return { ...judge(mover, best, played, best.pv[0] === uci), uci, best, played };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [judgeDepth],
  );

  /** The engine's reply in `fen` (a quick search). */
  const reply = useCallback(
    async (afterFen: string): Promise<string | null> => {
      const u = await searchOnce(afterFen, { multiPv: 1, depth: Math.min(12, judgeDepth) });
      return u?.lines[0]?.pv[0] ?? null;
    },
    [judgeDepth],
  );

  return { root: root && root.fen === fen ? root : null, error, check, reply };
}
