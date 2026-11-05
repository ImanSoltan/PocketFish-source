// Board setups, FEN conversion and validation (independent of chess.js so it
// also works for the illegal / incomplete positions that come out of a scan).
import { t } from '../i18n';

export type Color = 'w' | 'b';
export type PieceChar = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
/** 64 squares, index 0 = a8, 7 = h8, 56 = a1, 63 = h1 (FEN order). */
export type Board = (PieceChar | null)[];

export interface Castling {
  K: boolean;
  Q: boolean;
  k: boolean;
  q: boolean;
}

export interface Setup {
  board: Board;
  turn: Color;
  castling: Castling;
  ep: string | null;
  halfmove: number;
  fullmove: number;
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const PIECES: PieceChar[] = ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'];
const FILES = 'abcdefgh';

export const colorOf = (p: PieceChar): Color => (p === p.toUpperCase() ? 'w' : 'b');
export const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export function squareName(i: number): string {
  return FILES[i % 8] + String(8 - Math.floor(i / 8));
}

export function squareIndex(name: string): number {
  const f = FILES.indexOf(name[0]);
  const r = Number(name[1]);
  if (f < 0 || !(r >= 1 && r <= 8)) return -1;
  return (8 - r) * 8 + f;
}

export function emptyBoard(): Board {
  return new Array<PieceChar | null>(64).fill(null);
}

export function boardToPlacement(board: Board): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = board[r * 8 + f];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) row += String(empty);
      empty = 0;
      row += p;
    }
    if (empty) row += String(empty);
    rows.push(row);
  }
  return rows.join('/');
}

export function placementToBoard(placement: string): Board | null {
  const rows = placement.trim().split('/');
  if (rows.length !== 8) return null;
  const board = emptyBoard();
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      if (/[1-8]/.test(ch)) f += Number(ch);
      else if ('PNBRQKpnbrqk'.includes(ch)) {
        if (f > 7) return null;
        board[r * 8 + f] = ch as PieceChar;
        f++;
      } else return null;
    }
    if (f !== 8) return null;
  }
  return board;
}

/** Lenient FEN parser: only the piece placement is required. */
export function parseFen(fen: string): Setup | null {
  const parts = fen.trim().split(/\s+/);
  const board = placementToBoard(parts[0] ?? '');
  if (!board) return null;
  const turn: Color = parts[1] === 'b' ? 'b' : 'w';
  const c = parts[2] ?? '-';
  const castling = sanitizeCastling(board, {
    K: c.includes('K'),
    Q: c.includes('Q'),
    k: c.includes('k'),
    q: c.includes('q'),
  });
  // only an en-passant square that's possible here: chess.js refuses the position otherwise
  const ep = parts[3] && epCandidates(board, turn).includes(parts[3]) ? parts[3] : null;
  // the counters within sensible bounds (150 halfmoves is the 75-move rule; huge values overflow Stockfish)
  const halfmove = Math.min(150, Math.max(0, Number.parseInt(parts[4] ?? '0', 10) || 0));
  const fullmove = Math.min(9999, Math.max(1, Number.parseInt(parts[5] ?? '1', 10) || 1));
  return { board, turn, castling, ep, halfmove, fullmove };
}

export function castlingString(c: Castling): string {
  const s = (c.K ? 'K' : '') + (c.Q ? 'Q' : '') + (c.k ? 'k' : '') + (c.q ? 'q' : '');
  return s || '-';
}

export function setupToFen(s: Setup): string {
  const castling = castlingString(sanitizeCastling(s.board, s.castling));
  return `${boardToPlacement(s.board)} ${s.turn} ${castling} ${s.ep ?? '-'} ${s.halfmove} ${s.fullmove}`;
}

const E1 = squareIndex('e1');
const H1 = squareIndex('h1');
const A1 = squareIndex('a1');
const E8 = squareIndex('e8');
const H8 = squareIndex('h8');
const A8 = squareIndex('a8');

/** Castling rights that are possible given where the kings and rooks stand. */
export function possibleCastling(board: Board): Castling {
  return {
    K: board[E1] === 'K' && board[H1] === 'R',
    Q: board[E1] === 'K' && board[A1] === 'R',
    k: board[E8] === 'k' && board[H8] === 'r',
    q: board[E8] === 'k' && board[A8] === 'r',
  };
}

export function sanitizeCastling(board: Board, c: Castling): Castling {
  const p = possibleCastling(board);
  return { K: c.K && p.K, Q: c.Q && p.Q, k: c.k && p.k, q: c.q && p.q };
}

// ---------------------------------------------------------------------------
// attacks

const KNIGHT = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];
const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

const at = (board: Board, r: number, f: number) =>
  r >= 0 && r < 8 && f >= 0 && f < 8 ? board[r * 8 + f] : undefined;

/** Is square `sq` attacked by any piece of color `by`? */
export function isAttacked(board: Board, sq: number, by: Color): boolean {
  const r = Math.floor(sq / 8);
  const f = sq % 8;
  const w = by === 'w';
  // pawns: white pawns attack towards row 0
  const pr = w ? r + 1 : r - 1;
  const pawn = w ? 'P' : 'p';
  if (at(board, pr, f - 1) === pawn || at(board, pr, f + 1) === pawn) return true;
  const knight = w ? 'N' : 'n';
  for (const [dr, df] of KNIGHT) if (at(board, r + dr, f + df) === knight) return true;
  const king = w ? 'K' : 'k';
  for (const [dr, df] of KING) if (at(board, r + dr, f + df) === king) return true;
  const slide = (dirs: number[][], a: string, b: string) => {
    for (const [dr, df] of dirs) {
      for (let i = 1; i < 8; i++) {
        const p = at(board, r + dr * i, f + df * i);
        if (p === undefined) break;
        if (p === null) continue;
        if (p === a || p === b) return true;
        break;
      }
    }
    return false;
  };
  return w
    ? slide(ORTHO, 'R', 'Q') || slide(DIAG, 'B', 'Q')
    : slide(ORTHO, 'r', 'q') || slide(DIAG, 'b', 'q');
}

export function kingSquare(board: Board, color: Color): number {
  return board.indexOf(color === 'w' ? 'K' : 'k');
}

export function inCheck(board: Board, color: Color): boolean {
  const k = kingSquare(board, color);
  return k >= 0 && isAttacked(board, k, opposite(color));
}

// ---------------------------------------------------------------------------
// validation

export interface Problem {
  code: string;
  message: string;
}

export function validate(s: Setup): Problem[] {
  const problems: Problem[] = [];
  const count = (p: PieceChar) => s.board.filter((x) => x === p).length;
  for (const k of ['K', 'k'] as const) {
    const n = count(k);
    const white = k === 'K';
    if (n === 0) problems.push({ code: 'missing-king', message: t(white ? 'problem.whiteKingMissing' : 'problem.blackKingMissing') });
    if (n > 1) problems.push({ code: 'extra-king', message: t(white ? 'problem.whiteKings' : 'problem.blackKings', { n }) });
  }
  for (let f = 0; f < 8; f++) {
    for (const r of [0, 7]) {
      const p = s.board[r * 8 + f];
      if (p === 'P' || p === 'p') {
        problems.push({
          code: 'pawn-back-rank',
          message: t('problem.pawnBackRank', { square: squareName(r * 8 + f) }),
        });
      }
    }
  }
  for (const c of ['w', 'b'] as const) {
    const pieces = s.board.filter((p) => p && colorOf(p) === c).length;
    const pawns = count(c === 'w' ? 'P' : 'p');
    const white = c === 'w';
    if (pawns > 8) problems.push({ code: 'too-many-pawns', message: t(white ? 'problem.whitePawns' : 'problem.blackPawns', { n: pawns }) });
    if (pieces > 16) problems.push({ code: 'too-many-pieces', message: t(white ? 'problem.whitePieces' : 'problem.blackPieces', { n: pieces }) });
  }
  if (count('K') === 1 && count('k') === 1) {
    const other = opposite(s.turn);
    if (inCheck(s.board, other)) {
      problems.push({
        code: 'opponent-in-check',
        message: t(other === 'w' ? 'problem.whiteInCheck' : 'problem.blackInCheck'),
      });
    }
  }
  return problems;
}

/**
 * Side to move when the position decides it: the side in check must be the one
 * to move. Returns null when both sides are possible.
 */
export function forcedTurn(board: Board): Color | null {
  const w = inCheck(board, 'w');
  const b = inCheck(board, 'b');
  if (w && !b) return 'w';
  if (b && !w) return 'b';
  return null;
}

export function rotate180(board: Board): Board {
  return board.slice().reverse();
}

/**
 * En passant target squares that make sense for the side to move: an enemy pawn
 * that could just have advanced two squares, with one of our pawns next to it.
 */
export function epCandidates(board: Board, turn: Color): string[] {
  const out: string[] = [];
  // white to move: black pawn on rank 5 (row 3), target on rank 6 (row 2)
  const pawnRow = turn === 'w' ? 3 : 4;
  const targetRow = turn === 'w' ? 2 : 5;
  const startRow = turn === 'w' ? 1 : 6;
  const enemy = turn === 'w' ? 'p' : 'P';
  const ours = turn === 'w' ? 'P' : 'p';
  for (let f = 0; f < 8; f++) {
    if (board[pawnRow * 8 + f] !== enemy) continue;
    if (board[targetRow * 8 + f] || board[startRow * 8 + f]) continue;
    const left = f > 0 && board[pawnRow * 8 + f - 1] === ours;
    const right = f < 7 && board[pawnRow * 8 + f + 1] === ours;
    if (left || right) out.push(squareName(targetRow * 8 + f));
  }
  return out;
}
