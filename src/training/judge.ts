// Solve mode: how good was the user's move compared with the engine's best move?
// Pure functions (unit tested).
import type { Color } from '../chess/position';
import { t } from '../i18n';
import { whiteWinChance, type EngineLine } from '../engine/uci';

export type Verdict = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

const ORDER: Verdict[] = ['best', 'good', 'inaccuracy', 'mistake', 'blunder'];

export interface Judgement {
  verdict: Verdict;
  /** drop in the mover's winning chances (0..1) compared with the best move */
  loss: number;
  /** a forced mate in this many moves was missed */
  missedMate: number | null;
}

type Score = Pick<EngineLine, 'cp' | 'mate'>;

/** The mover's winning chances (0..1) for a line scored from White's side. */
export function moverChance(line: Score, mover: Color): number {
  const w = whiteWinChance(line);
  return mover === 'w' ? w : 1 - w;
}

/** Moves to mate for the mover, or null if the line isn't a forced mate for them. */
export function moverMate(line: Score, mover: Color): number | null {
  if (line.mate === null || line.mate === 0) return null;
  const m = mover === 'w' ? line.mate : -line.mate;
  return m > 0 ? m : null;
}

// Drops in winning chances, as lichess uses them for ?!, ? and ??
function fromLoss(loss: number): Verdict {
  if (loss < 0.01) return 'best';
  if (loss < 0.05) return 'good';
  if (loss < 0.1) return 'inaccuracy';
  if (loss < 0.15) return 'mistake';
  return 'blunder';
}

const worst = (a: Verdict, b: Verdict) => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

/**
 * Judge the move that leads to `played` (both lines scored from White's side, from the
 * position before the move) against the engine's `best` line.
 */
export function judge(mover: Color, best: Score, played: Score, sameMove: boolean): Judgement {
  if (sameMove) return { verdict: 'best', loss: 0, missedMate: null };
  const loss = Math.max(0, moverChance(best, mover) - moverChance(played, mover));
  const bestMate = moverMate(best, mover);
  if (bestMate !== null) {
    const playedMate = moverMate(played, mover);
    // another mate counts, a slower one as merely good; missing the mate is at least an inaccuracy
    if (playedMate !== null) return { verdict: playedMate <= bestMate ? 'best' : 'good', loss, missedMate: null };
    return { verdict: worst(fromLoss(loss), 'inaccuracy'), loss, missedMate: bestMate };
  }
  return { verdict: fromLoss(loss), loss, missedMate: null };
}

/** Found the move: the best one or close enough. */
export const isSolved = (v: Verdict) => v === 'best' || v === 'good';

/** The verdict in words, in the current language. */
export const verdictLabel = (v: Verdict): string => t(`verdict.${v}`);

/** Move annotation symbol: Nf3?! / Nf3? / Nf3?? */
export const VERDICT_MARK: Record<Verdict, string> = {
  best: '!',
  good: '',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};
