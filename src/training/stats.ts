// Solve mode score, kept on the device: how many positions were tried, how many
// were solved at the first attempt without help, and the current / best streak.
import { loadJson, saveJson } from '../app/settings';

export interface SolveStats {
  tried: number;
  solved: number;
  streak: number;
  bestStreak: number;
}

const KEY = 'chessy.solve-stats.v1';
const EMPTY: SolveStats = { tried: 0, solved: 0, streak: 0, bestStreak: 0 };

export function loadStats(): SolveStats {
  const s = loadJson<Partial<SolveStats>>(KEY);
  return { ...EMPTY, ...(s && typeof s === 'object' ? s : {}) };
}

export function saveStats(s: SolveStats) {
  saveJson(KEY, s);
}

/** Count the first attempt at a position: solved without a hint or not. */
export function recordAttempt(s: SolveStats, solved: boolean): SolveStats {
  const streak = solved ? s.streak + 1 : 0;
  return {
    tried: s.tried + 1,
    solved: s.solved + (solved ? 1 : 0),
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
  };
}
