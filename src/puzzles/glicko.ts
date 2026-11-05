// Glicko-2 ratings (Glickman, "Example of the Glicko-2 system"), as lichess uses for puzzles:
// every puzzle is a game against the puzzle's rating.

export interface Glicko {
  rating: number;
  /** rating deviation: how sure the rating is (lower = surer) */
  rd: number;
  /** volatility */
  vol: number;
}

export interface Game {
  rating: number;
  rd: number;
  /** 1 = solved, 0 = not */
  score: number;
}

const SCALE = 173.7178;
/** system constant: how much the volatility may change */
const TAU = 0.75;
export const MIN_RD = 45;
export const MAX_RD = 350;
export const START: Glicko = { rating: 1500, rd: 300, vol: 0.06 };
/** lichess shows a "?" after ratings this uncertain */
export const PROVISIONAL_RD = 110;

/** The player's rating after one rating period with the given games. */
export function glicko2(p: Glicko, games: Game[], tau = TAU): Glicko {
  if (games.length === 0) return p;
  const mu = (p.rating - 1500) / SCALE;
  const phi = p.rd / SCALE;
  let vInv = 0;
  let sum = 0;
  for (const g of games) {
    const muJ = (g.rating - 1500) / SCALE;
    const phiJ = g.rd / SCALE;
    const gPhi = 1 / Math.sqrt(1 + (3 * phiJ * phiJ) / (Math.PI * Math.PI));
    const e = 1 / (1 + Math.exp(-gPhi * (mu - muJ)));
    vInv += gPhi * gPhi * e * (1 - e);
    sum += gPhi * (g.score - e);
  }
  const v = 1 / vInv;
  const delta = v * sum;

  // new volatility (Illinois algorithm)
  const a = Math.log(p.vol * p.vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (tau * tau);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  const vol = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * sum;
  return {
    rating: muNew * SCALE + 1500,
    rd: Math.min(MAX_RD, Math.max(MIN_RD, phiNew * SCALE)),
    vol,
  };
}
