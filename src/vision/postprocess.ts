// Turn per-square class probabilities into a chess position: enforce basic
// chess constraints and guess whether the diagram is printed from Black's side.
import { rotate180, type Board, type PieceChar } from '../chess/position';
import { CLASSES } from './recognize';

export interface ScanResult {
  /** standard orientation (index 0 = a8), with the orientation guess applied */
  board: Board;
  /** probability of the chosen label per square (standard orientation) */
  confidence: number[];
  /** true when the diagram shows Black at the bottom */
  blackAtBottom: boolean;
}

const N_CLASSES = CLASSES.length;
const piece = (k: number): PieceChar | null => (k === 0 ? null : (CLASSES[k] as PieceChar));

/** Best class for square `sq` excluding `banned` class indices. */
function bestExcept(probs: Float32Array, sq: number, banned: Set<number>): number {
  let best = 0;
  let bp = -1;
  for (let k = 0; k < N_CLASSES; k++) {
    if (banned.has(k)) continue;
    const p = probs[sq * N_CLASSES + k];
    if (p > bp) {
      bp = p;
      best = k;
    }
  }
  return best;
}

/** Labels per square in image order, after applying chess constraints. */
export function decodeLabels(probs: Float32Array): number[] {
  const labels = Array.from({ length: 64 }, (_, sq) => bestExcept(probs, sq, new Set()));
  const P = (sq: number, k: number) => probs[sq * N_CLASSES + k];
  const back = (sq: number) => sq < 8 || sq >= 56;

  // pawns cannot stand on the first / last rank (whatever the orientation)
  const pw = CLASSES.indexOf('P');
  const pb = CLASSES.indexOf('p');
  for (let sq = 0; sq < 64; sq++) {
    if (back(sq) && (labels[sq] === pw || labels[sq] === pb)) labels[sq] = bestExcept(probs, sq, new Set([pw, pb]));
  }

  // exactly one king per side when the evidence allows it
  for (const kc of ['K', 'k']) {
    const k = CLASSES.indexOf(kc);
    const sqs = labels.map((l, sq) => (l === k ? sq : -1)).filter((s) => s >= 0);
    if (sqs.length > 1) {
      sqs.sort((a, b) => P(b, k) - P(a, k));
      for (const sq of sqs.slice(1)) {
        labels[sq] = bestExcept(probs, sq, new Set([k, ...(back(sq) ? [pw, pb] : [])]));
      }
    } else if (sqs.length === 0) {
      let best = -1;
      for (let sq = 0; sq < 64; sq++) if (best < 0 || P(sq, k) > P(best, k)) best = sq;
      const other = CLASSES.indexOf(kc === 'K' ? 'k' : 'K');
      if (P(best, k) > 0.03 && labels[best] !== other) labels[best] = k;
    }
  }

  // at most 8 pawns per side
  for (const pk of [pw, pb]) {
    const sqs = labels.map((l, sq) => (l === pk ? sq : -1)).filter((s) => s >= 0);
    if (sqs.length > 8) {
      sqs.sort((a, b) => P(b, pk) - P(a, pk));
      for (const sq of sqs.slice(8)) labels[sq] = bestExcept(probs, sq, new Set([pw, pb]));
    }
  }
  return labels;
}

const PAWN_PRIOR = [0, 0, 0.3, 0.22, 0.18, 0.14, 0.1, 0.06, 0]; // by rank from own side
const KING_PRIOR = [0, 0.45, 0.2, 0.12, 0.08, 0.06, 0.04, 0.03, 0.02];

/**
 * Log-likelihood ratio that the diagram is printed with Black at the bottom,
 * from where pawns and kings stand. Books mostly print White at the bottom, so
 * that is the prior.
 */
export function blackAtBottomScore(imageBoard: Board): number {
  let ll = 0; // log P(flipped) - log P(normal)
  imageBoard.forEach((p, sq) => {
    if (!p) return;
    const row = Math.floor(sq / 8); // 0 = top of the image
    const white = p === p.toUpperCase();
    const normalRel = white ? 8 - row : row + 1;
    const flippedRel = white ? row + 1 : 8 - row;
    const prior = p === 'P' || p === 'p' ? PAWN_PRIOR : p === 'K' || p === 'k' ? KING_PRIOR : null;
    if (!prior) return;
    ll += Math.log(prior[flippedRel] + 1e-3) - Math.log(prior[normalRel] + 1e-3);
  });
  return ll - Math.log(8);
}

export function interpret(probs: Float32Array): ScanResult {
  const labels = decodeLabels(probs);
  const imageBoard: Board = labels.map(piece);
  const conf = labels.map((k, sq) => probs[sq * N_CLASSES + k]);
  const blackAtBottom = blackAtBottomScore(imageBoard) > 0;
  return {
    board: blackAtBottom ? rotate180(imageBoard) : imageBoard,
    confidence: blackAtBottom ? conf.slice().reverse() : conf,
    blackAtBottom,
  };
}
