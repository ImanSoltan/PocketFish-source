import { useMemo, useState } from 'react';
import { ChessBoard, THEMES, pieceUrl } from '../board/Board';
import {
  PIECES,
  START_FEN,
  emptyBoard,
  epCandidates,
  forcedTurn,
  opposite,
  parseFen,
  possibleCastling,
  rotate180,
  sanitizeCastling,
  setupToFen,
  validate,
  type Color,
  type PieceChar,
  type Setup,
} from '../chess/position';
import type { Settings } from '../app/settings';
import type { Pt } from '../vision/geometry';
import type { Photo } from '../vision/photo';
import type { Mode } from './AnalysisScreen';
import { IconCrop, IconFlip, IconHand, IconTrash } from './icons';
import { t } from '../i18n';

export interface ScanReview {
  setup: Setup;
  /** per-square confidence of the recognised piece (standard orientation) */
  confidence: number[];
  blackAtBottom: boolean;
  /** rectified photo of the board (data URL), as printed */
  crop: string | null;
  /** why the side to move was chosen */
  turnReason: 'check' | 'default';
  /** the photo and corners it came from, to go back and adjust them */
  source?: { photo: Photo; corners: Pt[] };
}

type Tool = PieceChar | 'erase' | 'move';

interface Props {
  mode: 'edit' | 'review';
  initial: Setup;
  review?: ScanReview;
  settings: Settings;
  orientation: Color;
  /** open the position on the analysis screen, to analyse or to solve */
  onDone: (fen: string, orientation: Color, mode: Mode) => void;
  onCancel: () => void;
  onRescan?: () => void;
}

export function EditorScreen({
  mode,
  initial,
  review,
  settings,
  orientation: initialOrientation,
  onDone,
  onCancel,
  onRescan,
}: Props) {
  const [setup, setSetup] = useState<Setup>(initial);
  const [tool, setTool] = useState<Tool>('move');
  const [orientation, setOrientation] = useState<Color>(initialOrientation);
  const [blackAtBottom, setBlackAtBottom] = useState(review?.blackAtBottom ?? false);
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const theme = THEMES.find((x) => x.name === settings.theme) ?? THEMES[0];
  const problems = useMemo(() => validate(setup), [setup]);
  const possible = possibleCastling(setup.board);

  const update = (board: Setup['board'], changed: number[] = []) => {
    const castling = sanitizeCastling(board, setup.castling);
    // newly possible castling (king/rook placed on home squares) is assumed available
    const p = possibleCastling(board);
    const before = possibleCastling(setup.board);
    for (const k of ['K', 'Q', 'k', 'q'] as const) if (p[k] && !before[k] && settings.assumeCastling) castling[k] = true;
    setSetup({ ...setup, board, castling, ep: null });
    if (changed.length) setTouched(new Set([...touched, ...changed]));
  };

  const onSquareTap = (sq: number) => {
    if (tool === 'move') return;
    const board = setup.board.slice();
    if (tool === 'erase') board[sq] = null;
    else board[sq] = board[sq] === tool ? null : tool;
    update(board, [sq]);
  };

  const onPieceDrop = (from: number, to: number | null) => {
    const board = setup.board.slice();
    const p = board[from];
    board[from] = null;
    if (to !== null) board[to] = p;
    update(board, to === null ? [from] : [from, to]);
  };

  const flipPrinted = () => {
    // the diagram was printed from the other side: rotate the position
    setBlackAtBottom(!blackAtBottom);
    setOrientation(opposite(orientation)); // keep showing the board as it looks in the photo
    const board = rotate180(setup.board);
    setSetup({ ...setup, board, castling: settings.assumeCastling ? possibleCastling(board) : sanitizeCastling(board, setup.castling), ep: null });
    setTouched(new Set([...touched].map((s) => 63 - s)));
  };

  const setTurn = (turn: Color) => setSetup({ ...setup, turn, ep: null });
  const forced = forcedTurn(setup.board);

  // highlight squares the recogniser was unsure about (until the user edits them)
  const marks: Record<number, string> = {};
  if (review) {
    review.confidence.forEach((c, sq) => {
      const s = blackAtBottom === review.blackAtBottom ? sq : 63 - sq;
      if (c < 0.75 && !touched.has(s)) marks[s] = c < 0.5 ? 'rgba(230, 60, 40, 0.45)' : 'rgba(255, 170, 0, 0.4)';
    });
  }

  const palette: PieceChar[] = PIECES;
  const done = (m: Mode) => onDone(setupToFen(setup), orientation, m);

  return (
    <div className="screen editor">
      <div className="card board-card">
        <ChessBoard
          board={setup.board}
          orientation={orientation}
          theme={theme}
          pieceSet={settings.pieceSet}
          coords={settings.coords}
          marks={marks}
          onSquareTap={onSquareTap}
          onPieceDrop={onPieceDrop}
        />
      </div>

      <div className="card palette" role="toolbar" aria-label={t('editor.pieces')}>
        <button className={`pal ${tool === 'move' ? 'active' : ''}`} aria-label={t('editor.move')} onClick={() => setTool('move')}>
          <IconHand />
        </button>
        {palette.map((p) => (
          <button key={p} className={`pal ${tool === p ? 'active' : ''}`} aria-label={t('editor.place', { piece: t(`piece.${p}`) })} data-piece={p} onClick={() => setTool(p)}>
            <img src={pieceUrl(settings.pieceSet, p)} alt={p} />
          </button>
        ))}
        <button className={`pal ${tool === 'erase' ? 'active' : ''}`} aria-label={t('editor.erase')} onClick={() => setTool('erase')}>
          <IconTrash />
        </button>
      </div>

      {mode === 'review' && (
        <div className="card review-head">
          {review?.crop && <img className="crop" src={review.crop} alt={t('editor.scannedBoard')} />}
          <div>
            <div className="title">{t('editor.check')}</div>
            <div className="muted small">
              {t('editor.checkHint')}
              {Object.keys(marks).length > 0 && ` ${t('editor.hardToRead')}`}
            </div>
          </div>
        </div>
      )}

      <div className="card form">
        <div className="row">
          <span className="label">{t('editor.toMove')}</span>
          <div className="segmented">
            {(['w', 'b'] as const).map((c) => (
              <button key={c} className={setup.turn === c ? 'active' : ''} onClick={() => setTurn(c)} aria-pressed={setup.turn === c}>
                <img src={pieceUrl(settings.pieceSet, c === 'w' ? 'K' : 'k')} alt="" />
                {t(c === 'w' ? 'common.white' : 'common.black')}
              </button>
            ))}
          </div>
        </div>
        {forced && forced === setup.turn && (
          <div className="hint">{t(forced === 'w' ? 'editor.whiteInCheck' : 'editor.blackInCheck')}</div>
        )}
        {mode === 'review' && !forced && (
          <div className="hint">{t('editor.booksSay')}</div>
        )}
        <div className="row">
          <span className="label">{t('editor.castling')}</span>
          <div className="checks">
            {(
              [
                ['K', 'common.white', 'O-O'],
                ['Q', 'common.white', 'O-O-O'],
                ['k', 'common.black', 'O-O'],
                ['q', 'common.black', 'O-O-O'],
              ] as const
            ).map(([k, side, castle]) => (
              <label key={k} className={possible[k] ? '' : 'disabled'}>
                <input
                  type="checkbox"
                  disabled={!possible[k]}
                  checked={setup.castling[k]}
                  onChange={(e) => setSetup({ ...setup, castling: { ...setup.castling, [k]: e.target.checked } })}
                />
                {t(side)} {castle}
              </label>
            ))}
          </div>
        </div>
        {epCandidates(setup.board, setup.turn).length > 0 && (
          <div className="row">
            <span className="label">{t('editor.enPassant')}</span>
            <select
              value={setup.ep ?? ''}
              onChange={(e) => setSetup({ ...setup, ep: e.target.value || null })}
              aria-label={t('editor.enPassantSquare')}
            >
              <option value="">{t('editor.epNone')}</option>
              {epCandidates(setup.board, setup.turn).map((sq) => (
                <option key={sq} value={sq}>
                  {t('editor.epCapture', { square: sq })}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="row buttons">
          {mode === 'review' ? (
            <button className="small" onClick={flipPrinted} aria-pressed={blackAtBottom}>
              <IconFlip size={16} /> {t(blackAtBottom ? 'editor.blackAtBottom' : 'editor.whiteAtBottom')}
            </button>
          ) : (
            <button className="small" onClick={() => setOrientation(opposite(orientation))}>
              <IconFlip size={16} /> {t('editor.flip')}
            </button>
          )}
          <button className="small" onClick={() => update(emptyBoard())}>
            {t('editor.clear')}
          </button>
          <button className="small" onClick={() => setSetup(parseFen(START_FEN)!)}>
            {t('editor.start')}
          </button>
        </div>
      </div>

      {problems.length > 0 && (
        <div className="card problems" data-testid="problems">
          {problems.map((p) => (
            <div key={p.code + p.message}>⚠ {p.message}</div>
          ))}
        </div>
      )}

      <div className="actions">
        {mode === 'review' && onRescan ? (
          <button className="secondary" onClick={onRescan} aria-label={t('editor.adjustCorners')}>
            <IconCrop size={18} /> {t('editor.corners')}
          </button>
        ) : (
          <button className="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        )}
        <button className="primary" disabled={problems.length > 0} onClick={() => done('analyze')} data-testid="analyze">
          {t('common.analyze')}
        </button>
        <button className="primary" disabled={problems.length > 0} onClick={() => done('solve')} data-testid="solve-it">
          {t('common.solve')}
        </button>
      </div>
    </div>
  );
}
