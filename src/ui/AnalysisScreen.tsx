import { useEffect, useMemo, useState } from 'react';
import { ChessBoard, THEMES, type Arrow } from '../board/Board';
import { applyUci, fenAt, legalMoves, moveNumberPrefix, newLine, play, pvToSan, status, type Line } from '../chess/game';
import { loadOpenings, openingKey } from '../chess/openings';
import {
  kingSquare,
  opposite,
  parseFen,
  setupToFen,
  squareIndex,
  squareName,
  validate,
  type Color,
} from '../chess/position';
import { formatScore, wdlPercent, whiteWinChance } from '../engine/uci';
import { useAnalysis } from '../engine/useAnalysis';
import { useSolveSession } from '../training/useSolveSession';
import { loadPlaySetup, savePlaySetup, type PlaySetup } from '../play/levels';
import { material } from '../play/material';
import { gameKey, takeBackPly } from '../play/result';
import { usePlay } from '../play/usePlay';
import { chessComUrl, copyText, lichessUrl, openUrl, tapFeedback } from '../app/platform';
import { moveSound, playSound } from '../app/sound';
import type { ScanRecord } from '../app/history';
import type { Settings } from '../app/settings';
import { IconCopy, IconEdit, IconExternal, IconFlip, IconLeft, IconRight } from './icons';
import { MaterialRow } from './MaterialRow';
import { PlayCard } from './PlayCard';
import { SolveCard } from './SolveCard';
import { WelcomeCard, setTipsDismissed, tipsDismissed } from './WelcomeCard';
import { language, t } from '../i18n';
import { tr } from '../i18n/rich';

export type Mode = 'analyze' | 'solve' | 'play';

/** SAN moves with move numbers: "12." before White's moves, "12..." if Black starts. */
function numberedSan(fen: string, san: string[]) {
  const parts = fen.split(' ');
  let num = Number(parts[5] ?? 1);
  let white = parts[1] !== 'b';
  return san.map((m, i) => {
    const part = { num: white ? `${num}.` : i === 0 ? `${num}...` : '', san: m };
    if (!white) num++;
    white = !white;
    return part;
  });
}

const ARROW_STYLE = [
  { opacity: 0.85, width: 0.2 },
  { opacity: 0.55, width: 0.15 },
  { opacity: 0.4, width: 0.12 },
  { opacity: 0.3, width: 0.1 },
  { opacity: 0.25, width: 0.09 },
];

interface Props {
  /** analyse with the engine visible, solve: find the best move yourself, or play against the engine */
  mode: Mode;
  setMode: (m: Mode) => void;
  line: Line;
  setLine: (l: Line) => void;
  orientation: Color;
  setOrientation: (c: Color) => void;
  settings: Settings;
  onEdit: () => void;
  toast: (msg: string) => void;
  history: ScanRecord[];
  onOpenRecord: (r: ScanRecord) => void;
  onClearHistory: () => void;
}

export function AnalysisScreen(props: Props) {
  const { mode, setMode, line, setLine, orientation, setOrientation, settings, onEdit, toast, history } = props;
  const solving = mode === 'solve';
  const playing = mode === 'play';
  /** the engine shows its analysis */
  const analyzing = !solving && !playing;
  const fen = fenAt(line);
  const setup = useMemo(() => parseFen(fen), [fen]);
  const problems = useMemo(() => (setup ? validate(setup) : [{ code: 'fen', message: t('analysis.invalidFen') }]), [setup]);
  const st = useMemo(() => (problems.length ? null : status(fen)), [fen, problems]);
  const playable = problems.length === 0;
  const terminal = st === 'checkmate' || st === 'stalemate';
  const { analysis, error } = useAnalysis(playable && !terminal && analyzing ? fen : null, settings.lines, settings.depth);
  const solve = useSolveSession(line, setLine, solving, settings.depth, settings.sounds);
  const [savedPlay, setSavedPlay] = useState<PlaySetup>(loadPlaySetup);
  const setPlaySetup = (s: PlaySetup) => {
    setSavedPlay(s);
    savePlaySetup(s);
  };
  // a new position (FEN, recent scan…): the player takes the side to move there
  const rootTurn: Color = line.rootFen.split(' ')[1] === 'b' ? 'b' : 'w';
  const newGame = savedPlay.root !== line.rootFen;
  const playSetup = newGame ? { ...savedPlay, color: rootTurn, root: line.rootFen, resigned: undefined } : savedPlay;
  useEffect(() => {
    if (!playing || !newGame) return;
    setPlaySetup(playSetup);
    setOrientation(playSetup.color);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, newGame]);
  // a resignation counts for the game it was given in, at its last move (like a mate)
  const resigned = playing && playSetup.resigned === gameKey(line) && line.ply === line.moves.length;
  const game = usePlay(line, setLine, playing, playable, playSetup.color, playSetup.level, settings.sounds, resigned);
  const taken = useMemo(() => (playing && playable ? material(line) : null), [line, playing, playable]);
  const [openings, setOpenings] = useState<Record<string, string>>({});
  const [fenInput, setFenInput] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(() => !tipsDismissed());

  useEffect(() => {
    loadOpenings().then(setOpenings);
  }, []);

  const moves = useMemo(() => (playable ? legalMoves(fen) : []), [fen, playable]);
  const dests = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const mv of moves) {
      const f = squareIndex(mv.from);
      m.set(f, [...(m.get(f) ?? []), squareIndex(mv.to)]);
    }
    return m;
  }, [moves]);

  const turn = setup?.turn ?? 'w';
  const best = analysis?.lines[0];
  const theme = THEMES.find((x) => x.name === settings.theme) ?? THEMES[0];

  const arrows: Arrow[] = [];
  if (solving) {
    const uci = solve.solution?.pv[0];
    if (uci) arrows.push({ from: squareIndex(uci.slice(0, 2)), to: squareIndex(uci.slice(2, 4)), color: 'var(--arrow)', ...ARROW_STYLE[0] });
  } else if (settings.showArrows && analysis) {
    const seen = new Set<string>();
    analysis.lines.forEach((l, i) => {
      const uci = l.pv[0];
      if (!uci || seen.has(uci.slice(0, 4))) return;
      seen.add(uci.slice(0, 4));
      const s = ARROW_STYLE[Math.min(i, ARROW_STYLE.length - 1)];
      arrows.push({ from: squareIndex(uci.slice(0, 2)), to: squareIndex(uci.slice(2, 4)), color: 'var(--arrow)', ...s });
    });
  }

  const last = line.ply > 0 ? line.moves[line.ply - 1].uci : null;
  const lastMove: [number, number] | null = last ? [squareIndex(last.slice(0, 2)), squareIndex(last.slice(2, 4))] : null;
  const checkSquare = st === 'check' || st === 'checkmate' ? kingSquare(setup!.board, turn) : null;

  const moveFeedback = (uci: string) => {
    const rec = applyUci(fen, uci);
    if (!rec) return;
    if (settings.sounds) playSound(moveSound(rec.san));
    tapFeedback();
  };

  const playUci = (uci: string) => {
    const next = play(line, uci);
    if (next) {
      setLine(next);
      moveFeedback(uci);
    }
  };

  const onMove = (from: number, to: number, promotion?: string) => {
    const uci = squareName(from) + squareName(to) + (promotion ?? '');
    if (solving) {
      moveFeedback(uci);
      solve.onMove(uci);
    } else playUci(uci);
  };

  const setTurn = (c: Color) => {
    if (!setup || c === turn) return;
    const next = { ...setup, turn: c, ep: null };
    const p = validate(next).find((x) => x.code === 'opponent-in-check');
    if (p) {
      toast(p.message);
      return;
    }
    setLine(newLine(setupToFen(next)));
  };

  let statusText: string;
  if (!playable) statusText = problems[0].message;
  else if (st === 'checkmate') statusText = t(turn === 'w' ? 'analysis.blackWins' : 'analysis.whiteWins');
  else if (st === 'stalemate') statusText = t('analysis.stalemate');
  else if (st === 'insufficient') statusText = t('analysis.insufficient');
  // opening names stay in English, as they are in most chess books
  else statusText = openings[openingKey(fen)] ?? t(turn === 'w' ? 'side.whiteToMove' : 'side.blackToMove');

  const evalText = terminal
    ? st === 'checkmate'
      ? turn === 'w' ? '0-1' : '1-0'
      : '½-½'
    : formatScore(best);
  const whiteChance = st === 'checkmate' ? (turn === 'w' ? 0 : 1) : whiteWinChance(best);

  /** Play mode: the player takes the side to move, at the bottom of the board. */
  const changeMode = (m: Mode) => {
    if (m === 'play' && mode !== 'play') {
      setPlaySetup({ ...playSetup, color: turn, root: line.rootFen, resigned: undefined });
      setOrientation(turn);
    }
    setMode(m);
  };

  const switchSides = () => {
    const color = opposite(playSetup.color);
    setPlaySetup({ ...playSetup, color, resigned: undefined });
    setOrientation(color);
  };

  /** Gives up the game (at its last move, also when looking at an earlier one). */
  const resign = () => {
    setPlaySetup({ ...playSetup, resigned: gameKey(line) });
    if (line.ply !== line.moves.length) setLine({ ...line, ply: line.moves.length });
  };

  const restart = () => {
    setPlaySetup({ ...playSetup, resigned: undefined });
    setLine(newLine(line.rootFen));
  };

  const takeBack = () => {
    const p = takeBackPly(line, playSetup.color);
    if (p !== null) setLine({ ...line, moves: line.moves.slice(0, p), ply: p });
  };

  const copyFen = async () => toast(t((await copyText(fen)) ? 'analysis.fenCopied' : 'analysis.copyFailed'));

  const submitFen = () => {
    if (fenInput === null) return;
    const s = parseFen(fenInput);
    if (!s) {
      toast(t('analysis.badFen'));
      return;
    }
    setLine(newLine(setupToFen(s)));
    setFenInput(null);
  };

  return (
    <div className="screen analysis">
      {showTips && (
        <WelcomeCard
          onClose={() => {
            setTipsDismissed(true);
            setShowTips(false);
          }}
        />
      )}

      <div className="segmented mode-switch" role="tablist" aria-label={t('analysis.mode')}>
        {(['analyze', 'solve', 'play'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? 'active' : ''}
            onClick={() => changeMode(m)}
          >
            {t(`common.${m}`)}
          </button>
        ))}
      </div>

      <div className="card board-card">
        {taken && <MaterialRow side={opposite(orientation)} material={taken} pieceSet={settings.pieceSet} />}
        <div className="board-row">
          {settings.showEvalBar && analyzing && (
            <div className={`evalbar ${orientation === 'b' ? 'flipped' : ''}`} aria-label={t('analysis.evalBar')}>
              <div className="evalbar-white" style={{ height: `${(whiteChance * 100).toFixed(1)}%` }} />
            </div>
          )}
          <ChessBoard
            board={setup?.board ?? []}
            orientation={orientation}
            theme={theme}
            pieceSet={settings.pieceSet}
            coords={settings.coords}
            arrows={arrows}
            lastMove={lastMove}
            checkSquare={checkSquare}
            marks={solving && solve.hintSquare ? { [squareIndex(solve.hintSquare)]: 'var(--hint)' } : undefined}
            dests={
              solving ? (solve.acceptsMoves ? dests : null) : playing ? (turn === playSetup.color && !game.end ? dests : null) : dests
            }
            isPromotion={(f, t) => moves.some((m) => m.promotion && squareIndex(m.from) === f && squareIndex(m.to) === t)}
            promotionColor={turn}
            onMove={onMove}
          />
        </div>
        {taken && <MaterialRow side={orientation} material={taken} pieceSet={settings.pieceSet} />}
        {analyzing && (
          <div className="info-row">
            <span className="eval" data-testid="eval">
              {playable ? evalText : '–'}
            </span>
            <span className={`status ${playable ? '' : 'error'}`} data-testid="status">
              {statusText}
            </span>
            {playable && !terminal && (
              <span className="chip" data-testid="depth">
                {tr('analysis.depth', { depth: analysis ? `${analysis.depth}${settings.depth ? `/${settings.depth}` : ''}` : '…' })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* right under the board, so the verdict is visible without scrolling */}
      {solving && <SolveCard solve={solve} line={line} />}
      {playing && (
        <PlayCard
          play={game}
          color={playSetup.color}
          turn={turn}
          level={playSetup.level}
          setLevel={(level) => setPlaySetup({ ...playSetup, level })}
          canTakeBack={takeBackPly(line, playSetup.color) !== null}
          onTakeBack={takeBack}
          onSwitchSides={switchSides}
          canResign={line.moves.length > 0}
          onResign={resign}
          onRestart={restart}
          onAnalyze={() => setMode('analyze')}
        />
      )}

      <div className="toolbar">
        <button className="tool" aria-label={t('common.back')} disabled={line.ply === 0} onClick={() => setLine({ ...line, ply: line.ply - 1 })}>
          <IconLeft />
        </button>
        <button
          className="tool"
          aria-label={t('common.forward')}
          disabled={line.ply >= line.moves.length}
          onClick={() => setLine({ ...line, ply: line.ply + 1 })}
        >
          <IconRight />
        </button>
        <button className="tool" aria-label={t('analysis.editPosition')} onClick={onEdit}>
          <IconEdit />
        </button>
        <button className="tool" aria-label={t('common.flipBoard')} onClick={() => setOrientation(opposite(orientation))}>
          <IconFlip />
        </button>
        <button
          className={`tool turn ${turn === 'w' ? 'active' : ''}`}
          aria-label={t('side.whiteToMove')}
          aria-pressed={turn === 'w'}
          onClick={() => setTurn('w')}
        >
          <img src={`pieces/${settings.pieceSet}/wK.svg`} alt="" />
        </button>
        <button
          className={`tool turn ${turn === 'b' ? 'active' : ''}`}
          aria-label={t('side.blackToMove')}
          aria-pressed={turn === 'b'}
          onClick={() => setTurn('b')}
        >
          <img src={`pieces/${settings.pieceSet}/bK.svg`} alt="" />
        </button>
      </div>

      {settings.showLines && playable && !terminal && analyzing && (
        <div className="card lines" data-testid="lines">
          {error && <div className="line muted">{t('common.engineError', { error })}</div>}
          {!analysis && !error && <div className="line muted">{t('analysis.thinking')}</div>}
          {settings.showWdl && best?.wdl && <Chances wdl={best.wdl} />}
          {analysis?.lines.map((l) => (
            <button key={l.multipv} className="line" onClick={() => l.pv[0] && playUci(l.pv[0])}>
              <span className="line-eval">{formatScore(l)}</span>
              <span className="line-moves">
                {numberedSan(fen, pvToSan(fen, l.pv, 12)).map((part, i) => (
                  <span key={i}>
                    {part.num && <span className="num">{part.num}</span>}
                    {part.san}{' '}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      )}

      {line.moves.length > 0 && (
        <div className="card moves" data-testid="moves">
          <button className={`mv ${line.ply === 0 ? 'current' : ''}`} onClick={() => setLine({ ...line, ply: 0 })}>
            {t('analysis.start')}
          </button>
          {line.moves.map((m, i) => {
            const before = fenAt(line, i);
            const prefix = moveNumberPrefix(before, i === 0);
            return (
              <button key={i} className={`mv ${line.ply === i + 1 ? 'current' : ''}`} onClick={() => setLine({ ...line, ply: i + 1 })}>
                {prefix && <span className="num">{prefix}</span>}
                {m.san}
              </button>
            );
          })}
        </div>
      )}

      <div className="card fen-row">
        <span className="label">FEN</span>
        {fenInput === null ? (
          <button className="fen" onClick={() => setFenInput(fen)} title={t('analysis.tapToEdit')} data-testid="fen">
            {fen}
          </button>
        ) : (
          <form
            className="fen-form"
            onSubmit={(e) => {
              e.preventDefault();
              submitFen();
            }}
          >
            <input
              autoFocus
              value={fenInput}
              onChange={(e) => setFenInput(e.target.value)}
              onBlur={() => setTimeout(() => setFenInput(null), 150)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="FEN"
            />
            <button type="submit" className="small">
              {t('analysis.load')}
            </button>
          </form>
        )}
        <button className="icon-btn" aria-label={t('analysis.copyFen')} onClick={copyFen}>
          <IconCopy size={20} />
        </button>
      </div>

      {history.length > 0 && (
        <div className="card history" data-testid="history">
          <div className="history-head">
            <span className="label">{t('analysis.recentScans')}</span>
            <button className="text-btn" onClick={props.onClearHistory}>
              {t('analysis.clear')}
            </button>
          </div>
          <div className="history-row">
            {history.map((r) => (
              <button
                key={r.id}
                className={`history-item ${r.fen === line.rootFen ? 'current' : ''}`}
                onClick={() => props.onOpenRecord(r)}
                title={r.fen}
              >
                {r.thumb ? <img src={r.thumb} alt={t('analysis.scannedPosition')} /> : <span className="no-thumb">♞</span>}
                <span className="history-time">
                  {new Date(r.time).toLocaleDateString(language(), { month: 'short', day: 'numeric' })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="links">
        <button className="card link" onClick={() => openUrl(lichessUrl(fen, orientation))}>
          <IconExternal size={18} /> lichess.org
        </button>
        <button className="card link" onClick={() => openUrl(chessComUrl(fen, orientation))}>
          <IconExternal size={18} /> chess.com
        </button>
      </div>
    </div>
  );
}

/** White / draw / Black chances as a small bar and text. */
function Chances({ wdl }: { wdl: [number, number, number] }) {
  const [white, draw, black] = wdlPercent(wdl);
  return (
    <div className="wdl" data-testid="wdl">
      <span className="wdl-bar" aria-hidden="true">
        <span className="wdl-white" style={{ width: `${white}%` }} />
        <span className="wdl-draw" style={{ width: `${draw}%` }} />
        <span className="wdl-black" style={{ width: `${black}%` }} />
      </span>
      <span>{t('analysis.chances', { white, draw, black })}</span>
    </div>
  );
}
