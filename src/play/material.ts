// Play mode: the pieces each side has taken since the game started, and who is ahead in material.
// Pure functions (unit tested).
import { fenAt, type Line } from '../chess/game';
import { colorOf, placementToBoard, type Board, type Color, type PieceChar } from '../chess/position';

/** The usual piece values, in pawns. */
export const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Captured pieces are shown cheapest first: pawns, knights, bishops, rooks, queens. */
const ORDER = 'pnbrq';

export interface Material {
  /** the pieces each side has taken (so White's are black pieces), cheapest first */
  taken: Record<Color, PieceChar[]>;
  /** material on the board, White's minus Black's, in pawns (> 0: White is ahead) */
  balance: number;
}

const boardAt = (line: Line, ply: number): Board => placementToBoard(fenAt(line, ply).split(' ')[0]) ?? [];

const count = (board: Board) => {
  const n = new Map<PieceChar, number>();
  for (const p of board) if (p) n.set(p, (n.get(p) ?? 0) + 1);
  return n;
};

/** Material of the game at the cursor: what was taken from the start position up to it, and the balance there. */
export function material(line: Line): Material {
  const taken: Record<Color, PieceChar[]> = { w: [], b: [] };
  let before = count(boardAt(line, 0));
  for (let ply = 1; ply <= line.ply; ply++) {
    const after = count(boardAt(line, ply));
    const mover: Color = fenAt(line, ply - 1).split(' ')[1] === 'b' ? 'b' : 'w';
    // only the other side can lose a piece; a promotion changes the mover's own pieces
    for (const [p, n] of before) {
      if (colorOf(p) === mover) continue;
      for (let i = after.get(p) ?? 0; i < n; i++) taken[mover].push(p);
    }
    before = after;
  }
  const rank = (p: PieceChar) => ORDER.indexOf(p.toLowerCase());
  taken.w.sort((a, b) => rank(a) - rank(b));
  taken.b.sort((a, b) => rank(a) - rank(b));
  let balance = 0;
  for (const p of boardAt(line, line.ply)) if (p) balance += (colorOf(p) === 'w' ? 1 : -1) * PIECE_VALUE[p.toLowerCase()];
  return { taken, balance };
}
