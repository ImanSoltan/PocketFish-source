// Piece sets bundled in public/pieces/<id>/ (12 SVGs each, from lichess.org).
// Only sets whose licences allow redistribution in a GPLv3 app, including
// commercially. public/sw.js precaches the same ids (tests/unit/pieces.test.ts
// checks both).

export interface PieceSet {
  id: string;
  name: string;
  author: string;
  license: string;
}

export const PIECE_SETS: PieceSet[] = [
  { id: 'cburnett', name: 'Classic', author: 'Colin M.L. Burnett', license: 'GPLv2+' },
  { id: 'merida', name: 'Merida', author: 'Armando Hernandez Marroquin', license: 'GPLv2+' },
  { id: 'chessnut', name: 'Chessnut', author: 'Alexis Luengas', license: 'Apache 2.0' },
  { id: 'mpchess', name: 'Bold', author: 'Maxime Chupin', license: 'GPLv3+' },
  { id: 'celtic', name: 'Celtic', author: 'Maurizio Monge', license: 'MIT' },
  { id: 'fantasy', name: 'Fantasy', author: 'Maurizio Monge', license: 'MIT' },
];

export const isPieceSet = (id: string) => PIECE_SETS.some((s) => s.id === id);
