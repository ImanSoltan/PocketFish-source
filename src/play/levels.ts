// Play mode: the engine's strength levels, and the side and level last played (kept on the device).
import { loadJson, saveJson } from '../app/settings';
import type { Color } from '../chess/position';
import { t, type MessageKey } from '../i18n';

export interface Level {
  /** Stockfish "Skill Level", 0-20 */
  skill: number;
  /** search depth (0 = no limit) */
  depth: number;
  /** thinking time per move, ms */
  movetime: number;
}

/** Weak levels search only a few moves deep and pick a weaker move on purpose (like lichess's levels). */
export const LEVELS: Level[] = [
  { skill: 0, depth: 1, movetime: 50 }, // Beginner
  { skill: 0, depth: 2, movetime: 100 }, // Novice
  { skill: 2, depth: 3, movetime: 150 }, // Casual
  { skill: 5, depth: 5, movetime: 250 }, // Intermediate
  { skill: 8, depth: 7, movetime: 350 }, // Club player
  { skill: 12, depth: 10, movetime: 500 }, // Strong club player
  { skill: 16, depth: 14, movetime: 800 }, // Expert
  { skill: 20, depth: 0, movetime: 1500 }, // Full strength
];

/** The name of level 1-8 in the current language. */
export const levelName = (level: number): string => t(`level.${level}` as MessageKey);

export interface PlaySetup {
  /** the side the player plays */
  color: Color;
  /** 1-8 */
  level: number;
  /** the starting position the side was chosen for (another position: the player takes the side to move) */
  root?: string;
  /** the game the player resigned (result.gameKey), shown as lost at its last move */
  resigned?: string;
}

const KEY = 'chessy.play.v1';

export function loadPlaySetup(): PlaySetup {
  const s = loadJson<Partial<PlaySetup>>(KEY);
  const level = Number(s?.level);
  return {
    color: s?.color === 'b' ? 'b' : 'w',
    level: Number.isInteger(level) && level >= 1 && level <= LEVELS.length ? level : 3,
    root: typeof s?.root === 'string' ? s.root : undefined,
    resigned: typeof s?.resigned === 'string' ? s.resigned : undefined,
  };
}

export function savePlaySetup(s: PlaySetup) {
  saveJson(KEY, s);
}
