// The puzzle rating and score, kept on the device. Every puzzle counts once: solved at the
// first try (no wrong move, hint or solution) is a win against the puzzle's rating, anything
// else a loss.
import { loadJson, saveJson } from '../app/settings';
import { glicko2, START, type Glicko } from './glicko';
import type { Puzzle } from './data';

export type Difficulty = 'easier' | 'normal' | 'harder';

/** rating offset of the puzzles picked for each difficulty */
export const DIFFICULTY_OFFSET: Record<Difficulty, number> = { easier: -300, normal: 0, harder: 300 };

export interface PuzzleProfile {
  glicko: Glicko;
  /** ids of the puzzles that counted (each counts once) */
  played: string[];
  tried: number;
  solved: number;
  streak: number;
  bestStreak: number;
  /** rating after each rated puzzle, oldest first (the last HISTORY ones) */
  history: number[];
  /** per theme: [tried, solved] */
  themes: Record<string, [number, number]>;
  /** the last puzzle of the day finished */
  daily?: { date: string; id: string; solved: boolean };
  /** the puzzle being played, so it's still there after switching screens */
  current?: string;
  /** filters: a theme key ('' = all) and the difficulty */
  theme: string;
  difficulty: Difficulty;
}

export const HISTORY = 60;
/** the puzzles' own rating deviation (the set only has well-established ratings) */
const PUZZLE_RD = 75;
const MIN_RATING = 400;

const KEY = 'chessy.puzzles.v1';

export const emptyProfile = (): PuzzleProfile => ({
  glicko: { ...START },
  played: [],
  tried: 0,
  solved: 0,
  streak: 0,
  bestStreak: 0,
  history: [],
  themes: {},
  theme: '',
  difficulty: 'normal',
});

export function loadProfile(): PuzzleProfile {
  const s = loadJson<Partial<PuzzleProfile>>(KEY);
  const p = { ...emptyProfile(), ...(s && typeof s === 'object' ? s : {}) };
  const g = p.glicko;
  if (!g || !(g.rating > 0 && g.rd > 0 && g.vol > 0)) p.glicko = { ...START };
  if (!Array.isArray(p.played)) p.played = [];
  if (!Array.isArray(p.history)) p.history = [];
  if (!p.themes || typeof p.themes !== 'object') p.themes = {};
  if (!(p.difficulty in DIFFICULTY_OFFSET)) p.difficulty = 'normal';
  if (typeof p.theme !== 'string') p.theme = '';
  return p;
}

export function saveProfile(p: PuzzleProfile) {
  saveJson(KEY, p);
}

export interface Outcome {
  profile: PuzzleProfile;
  /** rating change, or null when the puzzle had already counted */
  delta: number | null;
}

/** Counts a finished (or failed) puzzle, once. */
export function recordResult(p: PuzzleProfile, puzzle: Puzzle, win: boolean): Outcome {
  if (p.played.includes(puzzle.id)) return { profile: p, delta: null };
  const next = glicko2(p.glicko, [{ rating: puzzle.rating, rd: PUZZLE_RD, score: win ? 1 : 0 }]);
  next.rating = Math.max(MIN_RATING, next.rating);
  const themes = { ...p.themes };
  for (const t of puzzle.themes) {
    const [tried, solved] = themes[t] ?? [0, 0];
    themes[t] = [tried + 1, solved + (win ? 1 : 0)];
  }
  const streak = win ? p.streak + 1 : 0;
  const profile: PuzzleProfile = {
    ...p,
    glicko: next,
    played: [...p.played, puzzle.id],
    tried: p.tried + 1,
    solved: p.solved + (win ? 1 : 0),
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    history: [...p.history, Math.round(next.rating)].slice(-HISTORY),
    themes,
  };
  return { profile, delta: Math.round(next.rating) - Math.round(p.glicko.rating) };
}

/** Themes tried at least `min` times, the weakest (lowest share solved) first. */
export function weakestThemes(p: PuzzleProfile, min = 3): { theme: string; tried: number; solved: number }[] {
  return Object.entries(p.themes)
    .filter(([, [tried]]) => tried >= min)
    .map(([theme, [tried, solved]]) => ({ theme, tried, solved }))
    .sort((a, b) => a.solved / a.tried - b.solved / b.tried || b.tried - a.tried);
}
