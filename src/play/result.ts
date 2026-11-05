// When a game played out on the board is over, and who won.
import { fenAt, status, type Line } from '../chess/game';
import { opposite, type Color } from '../chess/position';

export interface GameEnd {
  reason: 'checkmate' | 'stalemate' | 'insufficient' | 'fifty-move' | 'repetition' | 'resignation';
  /** null for a draw */
  winner: Color | null;
}

/** The position part of a FEN (pieces, side to move, castling, en passant): equal for repeated positions. */
const positionKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

/** How the game stands at the cursor: over (and why) or not. */
export function gameEnd(line: Line): GameEnd | null {
  const fen = fenAt(line);
  const turn: Color = fen.split(' ')[1] === 'b' ? 'b' : 'w';
  const st = status(fen);
  if (st === 'checkmate') return { reason: 'checkmate', winner: turn === 'w' ? 'b' : 'w' };
  if (st === 'stalemate' || st === 'insufficient' || st === 'fifty-move') return { reason: st, winner: null };
  const key = positionKey(fen);
  let seen = 0;
  for (let p = 0; p <= line.ply; p++) if (positionKey(fenAt(line, p)) === key) seen++;
  return seen >= 3 ? { reason: 'repetition', winner: null } : null;
}

/** Identifies a game: its start position and all its moves (a take back or another move makes a new one). */
export const gameKey = (line: Line) => `${line.rootFen}|${line.moves.map((m) => m.uci).join(' ')}`;

/** The player gave up: the engine wins. */
export const resignation = (player: Color): GameEnd => ({ reason: 'resignation', winner: opposite(player) });

/** The position to go back to for "take back": the player's turn before their last move. */
export function takeBackPly(line: Line, color: Color): number | null {
  for (let p = line.ply - 1; p >= 0; p--) if (fenAt(line, p).split(' ')[1] === color) return p;
  return null;
}
