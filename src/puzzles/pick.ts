// Which puzzle comes next: one not played yet, close to the player's rating (shifted by the
// difficulty), and the puzzle of the day, the same one for everybody on a given date.
import type { Puzzle } from './data';

/** the next puzzle is picked at random among this many closest to the target rating */
const NEAREST = 12;

export interface PickOptions {
  target: number;
  /** theme key, '' for all */
  theme: string;
  played: ReadonlySet<string>;
  /** never this one (the puzzle just played) */
  exclude?: string;
  random?: () => number;
}

export function pickPuzzle(puzzles: Puzzle[], o: PickOptions): Puzzle | null {
  const pool = o.theme ? puzzles.filter((p) => p.themes.includes(o.theme)) : puzzles;
  let fresh = pool.filter((p) => !o.played.has(p.id) && p.id !== o.exclude);
  // all of them played: start over
  if (fresh.length === 0) fresh = pool.filter((p) => p.id !== o.exclude);
  if (fresh.length === 0) return pool[0] ?? null;
  const near = fresh
    .map((p) => ({ p, d: Math.abs(p.rating - o.target) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, NEAREST);
  const r = (o.random ?? Math.random)();
  return near[Math.min(near.length - 1, Math.floor(r * near.length))].p;
}

/** The local date as YYYY-MM-DD. */
export function dateKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The puzzle of the day: one of the mid-rated puzzles, chosen by the date. */
export function dailyPuzzle(puzzles: Puzzle[], date: string): Puzzle | null {
  const pool = puzzles.filter((p) => p.rating >= 1200 && p.rating < 2000);
  const list = pool.length ? pool : puzzles;
  if (list.length === 0) return null;
  const [y, m, d] = date.split('-').map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  // a multiplicative hash, so consecutive days get puzzles from all over the list
  // (day * 2654435761 stays below 2^53 for thousands of years)
  return list[(day * 2654435761) % list.length];
}
