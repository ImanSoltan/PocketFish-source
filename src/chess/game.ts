// Move handling on top of chess.js: a "line" is the analysed position (root)
// plus the moves the user played from it, with a cursor for back / forward.
import { Chess } from 'chess.js';
import { parseFen, type PieceChar } from './position';

export interface MoveRec {
  uci: string;
  san: string;
  /** FEN after the move */
  fen: string;
}

export interface Line {
  rootFen: string;
  moves: MoveRec[];
  /** number of moves currently applied (0 = root position) */
  ply: number;
}

export interface LegalMove {
  from: string;
  to: string;
  promotion?: string;
  san: string;
}

export function newLine(rootFen: string): Line {
  return { rootFen, moves: [], ply: 0 };
}

/** A line saved by an earlier run, checked before use: null when its shape is off. */
export function restoreLine(saved: unknown): Line | null {
  if (!saved || typeof saved !== 'object') return null;
  const { rootFen, moves, ply } = saved as Partial<Line>;
  if (typeof rootFen !== 'string' || !parseFen(rootFen) || !Array.isArray(moves)) return null;
  const isMove = (m: unknown) =>
    !!m && typeof m === 'object' && ['uci', 'san', 'fen'].every((k) => typeof (m as Record<string, unknown>)[k] === 'string');
  if (!moves.every(isMove)) return null;
  const cursor = typeof ply === 'number' && Number.isInteger(ply) ? Math.min(Math.max(ply, 0), moves.length) : 0;
  return { rootFen, moves, ply: cursor };
}

export function fenAt(line: Line, ply = line.ply): string {
  return ply === 0 ? line.rootFen : line.moves[ply - 1].fen;
}

function load(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

export function isPlayable(fen: string): boolean {
  return load(fen) !== null;
}

export function legalMoves(fen: string): LegalMove[] {
  const c = load(fen);
  if (!c) return [];
  return c.moves({ verbose: true }).map((m) => ({
    from: m.from,
    to: m.to,
    promotion: m.promotion,
    san: m.san,
  }));
}

export function applyUci(fen: string, uci: string): MoveRec | null {
  const c = load(fen);
  if (!c) return null;
  try {
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return { uci: m.from + m.to + (m.promotion ?? ''), san: m.san, fen: c.fen() };
  } catch {
    return null;
  }
}

/** Play `uci` at the cursor. Re-uses the existing continuation when it matches. */
export function play(line: Line, uci: string): Line | null {
  const next = line.moves[line.ply];
  if (next && next.uci === uci) return { ...line, ply: line.ply + 1 };
  const rec = applyUci(fenAt(line), uci);
  if (!rec) return null;
  return { ...line, moves: [...line.moves.slice(0, line.ply), rec], ply: line.ply + 1 };
}

/** Convert a UCI principal variation into SAN (stops at the first illegal move). */
export function pvToSan(fen: string, pv: string[], max = pv.length): string[] {
  const c = load(fen);
  if (!c) return [];
  const out: string[] = [];
  for (const uci of pv.slice(0, max)) {
    try {
      out.push(c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san);
    } catch {
      break;
    }
  }
  return out;
}

export type Status = 'checkmate' | 'stalemate' | 'insufficient' | 'fifty-move' | 'check' | null;

export function status(fen: string): Status {
  const c = load(fen);
  if (!c) return null;
  if (c.isCheckmate()) return 'checkmate';
  if (c.isStalemate()) return 'stalemate';
  if (c.isInsufficientMaterial()) return 'insufficient';
  if (c.isDrawByFiftyMoves()) return 'fifty-move';
  if (c.inCheck()) return 'check';
  return null;
}

/** "12.", "12..." style move number prefix for the move made at `fen` (before the move). */
export function moveNumberPrefix(fen: string, force = false): string {
  const parts = fen.split(' ');
  const n = parts[5] ?? '1';
  if (parts[1] === 'w') return `${n}.`;
  return force ? `${n}...` : '';
}

export function promotionPiece(color: 'w' | 'b', p: string): PieceChar {
  return (color === 'w' ? p.toUpperCase() : p.toLowerCase()) as PieceChar;
}
