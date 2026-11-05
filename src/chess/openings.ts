// Opening names (lichess-org/chess-openings, CC0), loaded lazily.
let table: Promise<Record<string, string>> | null = null;

/** key: piece placement + side to move + castling rights */
export const openingKey = (fen: string) => fen.split(' ').slice(0, 3).join(' ');

export function loadOpenings(): Promise<Record<string, string>> {
  table ??= fetch('openings.json')
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return table;
}
