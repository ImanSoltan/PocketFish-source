// The offline puzzle set: public/puzzles.json, built by scripts/build-puzzles.mjs from the
// lichess.org puzzle database (CC0). Loaded on first use.

export interface Puzzle {
  id: string;
  /** the position before the opponent's move that sets up the puzzle */
  fen: string;
  /** UCI moves: the opponent's move, then the solution (the solver's and the opponent's moves alternate) */
  moves: string[];
  rating: number;
  /** lichess theme keys (src/puzzles/themes.ts) */
  themes: string[];
}

export interface PuzzleFile {
  themes: string[];
  /** [id, FEN, moves, rating, theme indices] */
  puzzles: [string, string, string, number, number[]][];
}

export function decodePuzzles(file: PuzzleFile): Puzzle[] {
  return file.puzzles.map(([id, fen, moves, rating, themes]) => ({
    id,
    fen,
    moves: moves.split(' '),
    rating,
    themes: themes.map((i) => file.themes[i]).filter(Boolean),
  }));
}

/** The side that solves the puzzle: the one to move after the opponent's first move. */
export const solverColor = (p: Puzzle): 'w' | 'b' => (p.fen.split(' ')[1] === 'w' ? 'b' : 'w');

let loading: Promise<Puzzle[]> | null = null;

export function loadPuzzles(): Promise<Puzzle[]> {
  if (!loading) {
    loading = fetch('puzzles.json')
      .then((r) => {
        if (!r.ok) throw new Error(`puzzles.json: ${r.status}`);
        return r.json() as Promise<PuzzleFile>;
      })
      .then(decodePuzzles);
    loading.catch(() => (loading = null)); // try again next time
  }
  return loading;
}
