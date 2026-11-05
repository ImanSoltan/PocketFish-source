// Play mode: the engine answers the player's moves at the chosen level, whenever it's its turn
// at the end of the line (stepping back through the moves doesn't make it move).
import { useEffect, useMemo, useRef, useState } from 'react';
import { moveSound, playSound } from '../app/sound';
import { fenAt, play, type Line } from '../chess/game';
import type { Color } from '../chess/position';
import { getEngine, type AnalysisUpdate } from '../engine/engine';
import { LEVELS } from './levels';
import { gameEnd, resignation } from './result';

/** the engine's reply comes after at least this long, so it doesn't feel instant */
const MIN_THINK_MS = 400;

export function usePlay(
  line: Line,
  setLine: (l: Line) => void,
  active: boolean,
  playable: boolean,
  color: Color,
  level: number,
  sounds: boolean,
  /** the player resigned this game (at its last move) */
  resigned = false,
) {
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lineRef = useRef(line);
  lineRef.current = line;
  const fen = fenAt(line);
  const end = useMemo(() => (resigned ? resignation(color) : playable ? gameEnd(line) : null), [line, playable, resigned, color]);
  const atEnd = line.ply === line.moves.length;
  const engineTurn = active && playable && atEnd && !end && fen.split(' ')[1] !== color;

  useEffect(() => {
    if (!engineTurn) return;
    const engine = getEngine();
    const lv = LEVELS[level - 1] ?? LEVELS[0];
    const started = performance.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setThinking(true);
    setError(null);
    const listener = (u: AnalysisUpdate) => {
      if (cancelled || !u.done || u.aborted) return;
      const uci = u.bestmove ?? u.lines[0]?.pv[0];
      timer = setTimeout(
        () => {
          if (cancelled) return;
          setThinking(false);
          const l = lineRef.current;
          if (!uci || fenAt(l) !== fen || l.ply !== l.moves.length) return;
          const next = play(l, uci);
          if (!next) return;
          setLine(next);
          if (sounds) playSound(moveSound(next.moves[next.ply - 1].san));
        },
        Math.max(0, MIN_THINK_MS - (performance.now() - started)),
      );
    };
    engine
      .analyze(fen, { multiPv: 1, depth: lv.depth, movetime: lv.movetime, skill: lv.skill }, listener)
      .catch((e) => {
        if (cancelled) return;
        setThinking(false);
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      engine.stop(listener);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineTurn, fen, level]);

  return { thinking: engineTurn && thinking, error, end, engineTurn };
}
