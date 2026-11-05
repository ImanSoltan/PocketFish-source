import { useMemo, useState, type ReactNode } from 'react';
import { ChessBoard, THEMES } from '../board/Board';
import { fenAt, legalMoves, moveNumberPrefix, status, type Line } from '../chess/game';
import { kingSquare, opposite, parseFen, squareIndex, squareName, type Color } from '../chess/position';
import type { Settings } from '../app/settings';
import { solverColor } from '../puzzles/data';
import { PROVISIONAL_RD } from '../puzzles/glicko';
import { hintSquare, puzzleLine } from '../puzzles/run';
import { weakestThemes, type Difficulty } from '../puzzles/store';
import { THEME_FILTERS, themeLabel } from '../puzzles/themes';
import { usePuzzles } from '../puzzles/usePuzzles';
import { IconCalendar, IconCheck, IconEye, IconFlip, IconHint, IconLeft, IconRetry, IconRight, IconX } from './icons';
import { t } from '../i18n';
import { tr } from '../i18n/rich';

const DIFFICULTIES: Difficulty[] = ['easier', 'normal', 'harder'];

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

interface Props {
  settings: Settings;
  /** open the puzzle on the analysis screen */
  onAnalyze: (line: Line, orientation: Color) => void;
}

export function PuzzleScreen({ settings, onAnalyze }: Props) {
  const pz = usePuzzles(settings.sounds);
  const { run, profile } = pz;
  /** id of the puzzle shown from the opponent's side */
  const [flipped, setFlipped] = useState<string | null>(null);
  const fen = run ? fenAt(run.line) : null;
  const setup = useMemo(() => (fen ? parseFen(fen) : null), [fen]);
  const playing = run?.phase === 'play';
  const moves = useMemo(() => (fen && playing ? legalMoves(fen) : []), [fen, playing]);
  const dests = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const mv of moves) {
      const f = squareIndex(mv.from);
      m.set(f, [...(m.get(f) ?? []), squareIndex(mv.to)]);
    }
    return m;
  }, [moves]);

  if (pz.loadError) {
    return (
      <div className="screen puzzles">
        <div className="card solve">
          <div className="solve-title">{t('puzzles.loadError')}</div>
          <div className="solve-actions">
            <button className="secondary compact" onClick={pz.reload}>
              {t('common.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!run || !setup || !fen) {
    return (
      <div className="screen puzzles">
        <div className="card solve">
          <div className="solve-title busy">{t('puzzles.loading')}</div>
        </div>
      </div>
    );
  }

  const puzzle = run.puzzle;
  const done = run.phase === 'done';
  const solver = solverColor(puzzle);
  const orientation = flipped === puzzle.id ? opposite(solver) : solver;
  const theme = THEMES.find((x) => x.name === settings.theme) ?? THEMES[0];
  const st = status(fen);
  const last = run.line.ply > 0 ? run.line.moves[run.line.ply - 1] : null;
  const lastMove: [number, number] | null = last ? [squareIndex(last.uci.slice(0, 2)), squareIndex(last.uci.slice(2, 4))] : null;
  const hint = hintSquare(run);
  const g = profile.glicko;
  const deltaText =
    pz.delta === null ? t('puzzles.alreadyCounted') : pz.delta !== undefined ? t('puzzles.ratingDelta', { delta: signed(pz.delta) }) : '';

  let body: ReactNode;
  if (run.phase === 'wrong') {
    body = (
      <>
        <div className="solve-title verdict bad" data-testid="puzzle-title">
          <IconX size={20} />
          {tr('puzzles.notTheMove', { move: last?.san ?? '' })}
        </div>
        <p className="muted small">
          {deltaText} {t('puzzles.tryOrSolution')}
        </p>
        <div className="solve-actions">
          <button className="primary compact" onClick={pz.retry}>
            <IconRetry size={17} /> {t('common.tryAgain')}
          </button>
          <button className="secondary compact" onClick={pz.reveal}>
            <IconEye size={17} /> {t('common.showSolution')}
          </button>
        </div>
      </>
    );
  } else if (done) {
    let title: ReactNode;
    let detail: string;
    if (run.revealed) {
      title = (
        <div className="solve-title" data-testid="puzzle-title">
          {t('puzzles.solution')}
        </div>
      );
      detail = `${deltaText} ${t('puzzles.stepThrough')}`;
    } else {
      title = (
        <div className="solve-title verdict ok" data-testid="puzzle-title">
          <IconCheck size={20} />
          {t(run.failed ? 'puzzles.solved' : 'puzzles.solvedClean')}
        </div>
      );
      detail = run.failed ? `${t(run.hint ? 'puzzles.withHint' : 'puzzles.notFirstTry')} ${deltaText}` : deltaText;
    }
    body = (
      <>
        {title}
        <p className="muted small">{detail}</p>
        <div className="solve-actions">
          <button className="primary compact" onClick={pz.nextPuzzle} data-testid="next-puzzle">
            {t('puzzles.next')} <IconRight size={17} />
          </button>
          <button className="secondary compact" onClick={() => onAnalyze(puzzleLine(run), solver)}>
            {t('common.analyze')}
          </button>
        </div>
      </>
    );
  } else {
    // waiting for the opponent, or the solver's turn
    const progress = run.next > 1;
    body = (
      <>
        <div
          className={`solve-title ${progress ? 'verdict ok' : ''} ${run.phase === 'waiting' ? 'busy' : ''}`}
          data-testid="puzzle-title"
        >
          {progress ? (
            <>
              <IconCheck size={20} />
              {t('puzzles.bestMove')}
            </>
          ) : (
            t(solver === 'w' ? 'side.whiteToPlay' : 'side.blackToPlay')
          )}
        </div>
        <p className="muted small">
          {t(
            run.next === 0
              ? 'puzzles.watch'
              : hint
                ? 'puzzles.hint'
                : progress
                  ? 'puzzles.keepGoing'
                  : solver === 'w'
                    ? 'puzzles.findWhite'
                    : 'puzzles.findBlack',
          )}
        </p>
        <div className="solve-actions">
          <button className="secondary compact" onClick={pz.hint} disabled={!playing || run.hint}>
            <IconHint size={17} /> {t('common.hint')}
          </button>
          <button className="secondary compact" onClick={pz.reveal} disabled={run.next === 0}>
            <IconEye size={17} /> {t('common.showSolution')}
          </button>
        </div>
      </>
    );
  }

  const weak = weakestThemes(profile)
    .filter((x) => THEME_FILTERS.includes(x.theme))
    .slice(0, 5);

  return (
    <div className="screen puzzles">
      <div className="card puzzle-head" data-testid="puzzle-rating">
        <div>
          <div className="puzzle-rating">
            <b data-testid="rating">
              {Math.round(g.rating)}
              {g.rd > PROVISIONAL_RD ? '?' : ''}
            </b>
            {pz.delta != null && (
              <span className={`delta ${pz.delta >= 0 ? 'up' : 'down'}`} data-testid="delta">
                {signed(pz.delta)}
              </span>
            )}
          </div>
          <div className="muted small" data-testid="puzzle-stats">
            {tr('puzzles.stats', { streak: profile.streak, solved: profile.solved, tried: profile.tried })}
          </div>
        </div>
        <Sparkline values={profile.history} />
      </div>

      <div className="card board-card" data-puzzle-id={puzzle.id} data-phase={run.phase} data-ply={run.line.ply}>
        <div className="board-row">
          <ChessBoard
            board={setup.board}
            orientation={orientation}
            theme={theme}
            pieceSet={settings.pieceSet}
            coords={settings.coords}
            lastMove={lastMove}
            checkSquare={st === 'check' || st === 'checkmate' ? kingSquare(setup.board, setup.turn) : null}
            marks={hint ? { [squareIndex(hint)]: 'var(--hint)' } : undefined}
            dests={playing ? dests : null}
            isPromotion={(f, t) => moves.some((m) => m.promotion && squareIndex(m.from) === f && squareIndex(m.to) === t)}
            promotionColor={setup.turn}
            onMove={(from, to, promotion) => pz.onMove(squareName(from) + squareName(to) + (promotion ?? ''))}
          />
        </div>
      </div>

      {/* right under the board, so it's visible without scrolling */}
      <div className="card solve" data-testid="puzzle">
        {body}
        <div className="solve-stats puzzle-name muted small">
          <span data-testid="puzzle-name">{pz.isDaily ? t('puzzles.daily') : t('puzzles.name', { id: puzzle.id })}</span>
          <span data-testid="puzzle-level">{tr('puzzles.rated', { rating: done ? puzzle.rating : '?' })}</span>
        </div>
      </div>

      <div className="toolbar three">
        <button className="tool" aria-label={t('common.back')} disabled={!done || run.line.ply <= 1} onClick={() => pz.setPly(run.line.ply - 1)}>
          <IconLeft />
        </button>
        <button
          className="tool"
          aria-label={t('common.forward')}
          disabled={!done || run.line.ply >= run.line.moves.length}
          onClick={() => pz.setPly(run.line.ply + 1)}
        >
          <IconRight />
        </button>
        <button className="tool" aria-label={t('common.flipBoard')} onClick={() => setFlipped(flipped === puzzle.id ? null : puzzle.id)}>
          <IconFlip />
        </button>
      </div>

      {done && (
        <div className="card moves" data-testid="puzzle-moves">
          {run.line.moves.map((m, i) => {
            const prefix = moveNumberPrefix(fenAt(run.line, i), i === 0);
            return (
              <button key={i} className={`mv ${run.line.ply === i + 1 ? 'current' : ''}`} onClick={() => pz.setPly(i + 1)}>
                {prefix && <span className="num">{prefix}</span>}
                {m.san}
              </button>
            );
          })}
        </div>
      )}

      {done && puzzle.themes.length > 0 && (
        <div className="puzzle-themes" data-testid="puzzle-themes">
          {puzzle.themes
            .filter((x) => THEME_FILTERS.includes(x))
            .map((x) => (
              <span key={x} className="chip">
                {themeLabel(x)}
              </span>
            ))}
        </div>
      )}

      <div className="card">
        <button className="setting nav-row" onClick={pz.playDaily} disabled={!pz.daily || pz.isDaily} data-testid="daily">
          <span className="daily">
            <IconCalendar size={20} />
            <span>
              {t('puzzles.daily')}
              <small>
                {t(pz.dailyDone ? (pz.dailyDone.solved ? 'puzzles.dailySolved' : 'puzzles.dailyPlayed') : 'puzzles.dailyNew')}
              </small>
            </span>
          </span>
          <span className="chevron">›</span>
        </button>
      </div>

      <div className="card puzzle-filters">
        <label className="setting">
          <span>{t('puzzles.theme')}</span>
          <select
            value={profile.theme}
            onChange={(e) => pz.setTheme(e.target.value)}
            aria-label={t('puzzles.theme')}
            data-testid="theme"
          >
            <option value="">{t('puzzles.allThemes')}</option>
            {THEME_FILTERS.filter(pz.hasTheme).map((x) => (
              <option key={x} value={x}>
                {themeLabel(x)}
              </option>
            ))}
          </select>
        </label>
        <div className="setting wrap">
          <span>{t('puzzles.difficulty')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('puzzles.difficulty')}>
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={profile.difficulty === d}
                className={profile.difficulty === d ? 'active' : ''}
                onClick={() => pz.setDifficulty(d)}
              >
                {t(`puzzles.${d}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {weak.length > 0 && (
        <div className="card theme-stats" data-testid="theme-stats">
          <div className="history-head">
            <span className="label">{t('puzzles.yourThemes')}</span>
          </div>
          {weak.map((x) => (
            <button key={x.theme} className="setting nav-row" onClick={() => pz.setTheme(x.theme)}>
              <span>{themeLabel(x.theme)}</span>
              <span className="muted small">
                {t('puzzles.themeScore', { solved: x.solved, tried: x.tried, percent: Math.round((100 * x.solved) / x.tried) })}
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="muted small center">{t('puzzles.credit')}</p>
    </div>
  );
}

/** The rating over the last puzzles. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const v = values.slice(-30);
  const min = Math.min(...v);
  const span = Math.max(1, Math.max(...v) - min);
  const pts = v.map((x, i) => `${((i / (v.length - 1)) * 100).toFixed(1)},${(26 - ((x - min) / span) * 24).toFixed(1)}`);
  return (
    <svg className="sparkline" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
