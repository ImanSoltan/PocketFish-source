// The lichess puzzle themes offered as filters; their names are in src/i18n (theme.<key>).
import { hasMessage, t } from '../i18n';

/** Filters on the puzzle screen, in this order (only themes with enough puzzles are shown). */
export const THEME_FILTERS = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'sacrifice',
  'deflection',
  'attraction',
  'backRankMate',
  'hangingPiece',
  'trappedPiece',
  'clearance',
  'quietMove',
  'defensiveMove',
  'zugzwang',
  'promotion',
  'opening',
  'middlegame',
  'endgame',
  'rookEndgame',
  'pawnEndgame',
  'short',
  'long',
];

/** A theme's name in the current language (the lichess key for themes without one). */
export const themeLabel = (theme: string): string => {
  const key = `theme.${theme}`;
  return hasMessage(key) ? t(key) : theme;
};
