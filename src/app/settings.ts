// User settings, persisted in localStorage.
import { isPieceSet } from '../board/pieceSets';
import type { Color } from '../chess/position';
import { isLanguage, type Language } from '../i18n';

export interface Settings {
  /** number of engine lines (MultiPV) */
  lines: number;
  /** maximum search depth, 0 = infinite */
  depth: number;
  showArrows: boolean;
  showEvalBar: boolean;
  showLines: boolean;
  /** win / draw / loss chances above the engine lines */
  showWdl: boolean;
  /** colour scheme of the app (src/app/schemes.ts), or 'auto' to follow the system */
  scheme: string;
  /** board colours */
  theme: string;
  /** id of a bundled piece set (src/board/pieceSets.ts) */
  pieceSet: string;
  coords: boolean;
  /** move sounds and solve-mode chimes */
  sounds: boolean;
  /** side to move assumed after a scan when the position doesn't decide it */
  defaultTurn: Color;
  /** give castling rights when king and rook stand on their home squares */
  assumeCastling: boolean;
  /** keep recent scans (position + small thumbnail) on the device */
  keepScans: boolean;
  /** the app's language, or 'auto' for the phone's */
  language: Language | 'auto';
}

export const DEFAULT_SETTINGS: Settings = {
  lines: 3,
  depth: 22,
  showArrows: true,
  showEvalBar: true,
  showLines: true,
  showWdl: false,
  scheme: 'auto',
  theme: 'ocean',
  pieceSet: 'cburnett',
  coords: true,
  sounds: true,
  defaultTurn: 'w',
  assumeCastling: true,
  keepScans: true,
  language: 'auto',
};

const KEY = 'chessy.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Settings>;
      // settings from before colour schemes existed: move off the old green board
      if (saved.scheme === undefined && saved.theme === 'green') saved.theme = DEFAULT_SETTINGS.theme;
      if (saved.pieceSet !== undefined && !isPieceSet(saved.pieceSet)) delete saved.pieceSet;
      if (saved.language !== undefined && saved.language !== 'auto' && !isLanguage(saved.language)) delete saved.language;
      return { ...DEFAULT_SETTINGS, ...saved };
    }
  } catch {
    // storage unavailable or corrupt: use defaults
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore (private mode / quota)
  }
}

/** Everything the app keeps lives in localStorage under this prefix. */
const PREFIX = 'chessy.';

/** Removes all of the app's data from the device: settings, position, recent scans, scores, tips. */
export function deleteAllData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // storage unavailable: nothing stored
  }
}

export function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
