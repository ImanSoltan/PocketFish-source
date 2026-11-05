// Parsing of UCI "info" lines (pure functions, unit tested).

export interface EngineLine {
  multipv: number;
  depth: number;
  /** centipawns from White's point of view (null when a mate is reported) */
  cp: number | null;
  /** moves to mate from White's point of view: > 0 White mates, < 0 Black mates */
  mate: number | null;
  /** principal variation in UCI notation */
  pv: string[];
  /** chances in per mille from White's side: [White wins, draw, Black wins] (UCI_ShowWDL) */
  wdl?: [number, number, number];
}

export interface InfoLine extends EngineLine {
  nodes?: number;
  nps?: number;
}

/**
 * Parse an "info ... pv ..." line. Scores are converted from the side to move's
 * point of view (UCI) to White's. Bound (lowerbound / upperbound) lines and lines
 * without a PV return null.
 */
export function parseInfo(line: string, turn: 'w' | 'b'): InfoLine | null {
  if (!line.startsWith('info ')) return null;
  const t = line.split(/\s+/);
  let depth = -1;
  let multipv = 1;
  let cp: number | null = null;
  let mate: number | null = null;
  let nodes: number | undefined;
  let nps: number | undefined;
  let pv: string[] | null = null;
  let wdl: [number, number, number] | undefined;
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        depth = Number(t[++i]);
        break;
      case 'multipv':
        multipv = Number(t[++i]);
        break;
      case 'nodes':
        nodes = Number(t[++i]);
        break;
      case 'nps':
        nps = Number(t[++i]);
        break;
      case 'score': {
        const kind = t[++i];
        const v = Number(t[++i]);
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') return null;
        if (kind === 'cp') cp = v;
        else if (kind === 'mate') mate = v;
        break;
      }
      case 'wdl': {
        // win / draw / loss for the side to move
        const v = [Number(t[i + 1]), Number(t[i + 2]), Number(t[i + 3])];
        i += 3;
        if (v.every(Number.isFinite)) wdl = turn === 'w' ? [v[0], v[1], v[2]] : [v[2], v[1], v[0]];
        break;
      }
      case 'pv':
        pv = t.slice(i + 1).filter(Boolean);
        i = t.length;
        break;
      default:
        break;
    }
  }
  if (!pv || pv.length === 0 || depth < 0 || (cp === null && mate === null)) return null;
  const sign = turn === 'w' ? 1 : -1;
  return {
    multipv,
    depth,
    cp: cp === null ? null : cp * sign,
    mate: mate === null ? null : mate * sign,
    pv,
    wdl,
    nodes,
    nps,
  };
}

/** Per-mille chances as whole percentages that add up to 100: [White, draw, Black]. */
export function wdlPercent(wdl: [number, number, number]): [number, number, number] {
  const total = wdl[0] + wdl[1] + wdl[2] || 1;
  const white = Math.round((wdl[0] * 100) / total);
  const black = Math.round((wdl[2] * 100) / total);
  return [white, Math.max(0, 100 - white - black), black];
}

/** "+0.5", "-1.2", "#3", "#-2", "0.0" */
export function formatScore(l: Pick<EngineLine, 'cp' | 'mate'> | null | undefined): string {
  if (!l) return '…';
  if (l.mate !== null) return l.mate === 0 ? '#' : `#${l.mate}`;
  const v = (l.cp ?? 0) / 100;
  if (Math.abs(v) < 0.05) return '0.0';
  return (v > 0 ? '+' : '') + v.toFixed(1);
}

/** Winning chances for White in [0, 1] (lichess formula), used for the eval bar. */
export function whiteWinChance(l: Pick<EngineLine, 'cp' | 'mate'> | null | undefined): number {
  if (!l) return 0.5;
  if (l.mate !== null) return l.mate > 0 ? 1 : l.mate < 0 ? 0 : 0.5;
  const cp = Math.max(-1000, Math.min(1000, l.cp ?? 0));
  return 1 / (1 + Math.exp(-0.00368208 * cp));
}
