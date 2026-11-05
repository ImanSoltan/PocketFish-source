import type { ReactNode } from 'react';
import { fenAt, pvToSan, status, type Line } from '../chess/game';
import { formatScore } from '../engine/uci';
import { t } from '../i18n';
import { tr } from '../i18n/rich';
import { VERDICT_MARK, isSolved, verdictLabel } from '../training/judge';
import type { useSolveSession } from '../training/useSolveSession';
import { IconCheck, IconEye, IconHint, IconRetry, IconX } from './icons';

type Session = ReturnType<typeof useSolveSession>;

/** SAN with move numbers ("1. Nf3 Nc6 2. Bb5", "1... Nc6 2. Bb5") */
function numbered(fen: string, san: string[]): string {
  const parts = fen.split(' ');
  let num = Number(parts[5] ?? 1);
  let white = parts[1] !== 'b';
  return san
    .map((m, i) => {
      const t = white ? `${num}. ${m}` : i === 0 ? `${num}... ${m}` : m;
      if (!white) num++;
      white = !white;
      return t;
    })
    .join(' ');
}

export function SolveCard({ solve, line }: { solve: Session; line: Line }) {
  const { phase, result, stats, puzzleFen } = solve;
  const toPlay = t(puzzleFen.split(' ')[1] === 'b' ? 'side.blackToPlay' : 'side.whiteToPlay');
  const san = (uci: string) => pvToSan(puzzleFen, [uci])[0] ?? uci;
  const statsLine = (
    <div className="solve-stats muted small" data-testid="solve-stats">
      {tr('solve.stats', { streak: stats.streak, best: stats.bestStreak, solved: stats.solved, tried: stats.tried })}
    </div>
  );

  if (!solve.canSolve && phase === 'thinking') {
    return (
      <div className="card solve" data-testid="solve">
        <div className="solve-title">{t('solve.nothing')}</div>
        <p className="muted small">{t('solve.nothingHint')}</p>
        {statsLine}
      </div>
    );
  }

  let body: ReactNode;
  if (phase === 'checking') {
    body = <div className="solve-title busy">{t('solve.checking', { move: san(line.moves[line.ply - 1]?.uci ?? '') })}</div>;
  } else if (phase === 'replying') {
    body = <div className="solve-title busy">{t('solve.replying')}</div>;
  } else if (phase === 'verdict') {
    const moveSan = line.moves[line.ply - 1]?.san ?? '';
    if (!result) {
      body = (
        <>
          <div className="solve-title">{t('solve.couldntCheck', { move: moveSan })}</div>
          <p className="muted small">{solve.error ?? t('solve.interrupted')}</p>
          <div className="solve-actions">
            <button className="secondary compact" onClick={solve.retry}>
              <IconRetry size={17} /> {t('common.tryAgain')}
            </button>
          </div>
        </>
      );
    } else {
      const ok = isSolved(result.verdict);
      const after = fenAt(line);
      const mate = status(after) === 'checkmate';
      const bestSan = san(result.best.pv[0]);
      let detail: string;
      if (mate) detail = t('solve.mateSolved');
      else if (solve.gameOver) detail = t('solve.gameOver');
      else if (result.verdict === 'best' && result.best.pv[0] !== result.uci) detail = t('solve.asStrongAs', { move: bestSan });
      else if (result.verdict === 'best') detail = t('solve.enginesChoice');
      else if (result.verdict === 'good') detail = t('solve.close', { move: bestSan });
      else if (result.missedMate) detail = t('solve.missedMate', { n: result.missedMate });
      else detail = t('solve.better');
      body = (
        <>
          <div className={`solve-title verdict ${ok ? 'ok' : result.verdict === 'inaccuracy' ? 'warn' : 'bad'}`} data-testid="verdict">
            {ok ? <IconCheck size={20} /> : <IconX size={20} />}
            <span className="solve-move">
              {moveSan}
              {VERDICT_MARK[result.verdict]}
            </span>
            {verdictLabel(result.verdict)}
            <span className="solve-eval">{formatScore(result.played)}</span>
          </div>
          <p className="muted small">{detail}</p>
          <div className="solve-actions">
            {ok ? (
              !solve.gameOver && (
                <button className="primary compact" onClick={solve.cont} data-testid="continue">
                  {t('solve.continue')}
                </button>
              )
            ) : (
              <>
                <button className="primary compact" onClick={solve.retry}>
                  <IconRetry size={17} /> {t('common.tryAgain')}
                </button>
                <button className="secondary compact" onClick={solve.reveal}>
                  <IconEye size={17} /> {t('common.showSolution')}
                </button>
              </>
            )}
          </div>
        </>
      );
    }
  } else {
    // thinking: the user looks for the move
    const sol = solve.solution;
    body = (
      <>
        <div className="solve-title">{toPlay}</div>
        {sol ? (
          <p className="small" data-testid="solution">
            {tr('solve.solution', { line: numbered(puzzleFen, pvToSan(puzzleFen, sol.pv, 6)), score: formatScore(sol) })}
          </p>
        ) : solve.hint ? (
          <p className="muted small">{t(solve.ready ? 'solve.hintReady' : 'solve.hintThinking')}</p>
        ) : (
          <p className="muted small">{t('solve.intro')}</p>
        )}
        {solve.error && <p className="small error">{t('common.engineError', { error: solve.error })}</p>}
        <div className="solve-actions">
          <button className="secondary compact" onClick={solve.showHint} disabled={solve.hint || !!sol}>
            <IconHint size={17} /> {t('common.hint')}
          </button>
          <button className="secondary compact" onClick={solve.reveal} disabled={!!sol || !solve.ready}>
            <IconEye size={17} /> {t('common.showSolution')}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="card solve" data-testid="solve">
      {body}
      {statsLine}
    </div>
  );
}
