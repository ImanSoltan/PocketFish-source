import { useEffect, useState, type ReactNode } from 'react';
import type { Color } from '../chess/position';
import { t, type MessageKey } from '../i18n';
import { LEVELS, levelName } from '../play/levels';
import type { GameEnd } from '../play/result';
import type { usePlay } from '../play/usePlay';
import { IconCheck, IconFlag, IconRetry, IconSwap, IconUndo, IconX } from './icons';

type Play = ReturnType<typeof usePlay>;

function resultTitle(end: GameEnd, color: Color): { text: string; tone: 'ok' | 'bad' | '' } {
  if (end.reason === 'checkmate') {
    return end.winner === color ? { text: t('play.youWin'), tone: 'ok' } : { text: t('play.engineWins'), tone: 'bad' };
  }
  if (end.reason === 'resignation') return { text: t('play.youResigned'), tone: 'bad' };
  const draw: Record<Exclude<GameEnd['reason'], 'checkmate' | 'resignation'>, MessageKey> = {
    stalemate: 'play.stalemate',
    insufficient: 'play.insufficient',
    'fifty-move': 'play.fiftyMove',
    repetition: 'play.repetition',
  };
  return { text: t(draw[end.reason]), tone: '' };
}

interface Props {
  play: Play;
  /** the side the player plays */
  color: Color;
  /** the side to move on the board */
  turn: Color;
  level: number;
  setLevel: (n: number) => void;
  canTakeBack: boolean;
  onTakeBack: () => void;
  onSwitchSides: () => void;
  /** a move has been played, so there is a game to resign */
  canResign: boolean;
  onResign: () => void;
  onRestart: () => void;
  onAnalyze: () => void;
}

export function PlayCard(props: Props) {
  const { play, color, turn, level } = props;
  const white = color === 'w';
  // Resign asks once more, in the card (a system alert can't be translated on iOS)
  const [confirming, setConfirming] = useState(false);
  const over = !!play.end;
  useEffect(() => {
    if (over) setConfirming(false);
  }, [over]);

  let title: ReactNode;
  let detail: string;
  if (play.end) {
    const r = resultTitle(play.end, color);
    title = (
      <div className={`solve-title ${r.tone ? `verdict ${r.tone}` : ''}`} data-testid="play-title">
        {r.tone === 'ok' && <IconCheck size={20} />}
        {r.tone === 'bad' && <IconX size={20} />}
        {r.text}
      </div>
    );
    detail = t('play.overHint');
  } else if (play.thinking) {
    title = (
      <div className="solve-title busy" data-testid="play-title">
        {t('play.thinking')}
      </div>
    );
    detail = t(white ? 'play.youPlayWhite' : 'play.youPlayBlack');
  } else if (turn === color) {
    title = (
      <div className="solve-title" data-testid="play-title">
        {t('play.yourMove')}
      </div>
    );
    detail = t(white ? 'play.vsWhite' : 'play.vsBlack');
  } else {
    // stepping back through the moves: the engine only plays at the last one
    title = (
      <div className="solve-title" data-testid="play-title">
        {t('play.engineToMove')}
      </div>
    );
    detail = t('play.goForward');
  }

  return (
    <div className="card solve play" data-testid="play">
      <div className="play-head">
        {title}
        {!play.end && !confirming && (
          <button className="text-btn resign-btn" onClick={() => setConfirming(true)} disabled={!props.canResign}>
            <IconFlag size={16} /> {t('play.resign')}
          </button>
        )}
      </div>
      <p className="muted small">{detail}</p>
      {play.error && <p className="small error">{t('common.engineError', { error: play.error })}</p>}
      {confirming ? (
        <div className="resign-confirm" role="group" aria-label={t('play.resign')}>
          <span className="question">{t('play.resignConfirm')}</span>
          <button
            className="danger compact"
            data-testid="resign-confirm"
            onClick={() => {
              setConfirming(false);
              props.onResign();
            }}
          >
            {t('play.resign')}
          </button>
          <button className="secondary compact" onClick={() => setConfirming(false)}>
            {t('play.keepPlaying')}
          </button>
        </div>
      ) : (
      <div className="solve-actions">
        {play.end ? (
          <>
            <button className="primary compact" onClick={props.onRestart} data-testid="play-again">
              <IconRetry size={17} /> {t('play.playAgain')}
            </button>
            <button className="secondary compact" onClick={props.onAnalyze}>
              {t('play.analyzeGame')}
            </button>
          </>
        ) : (
          <>
            <button className="secondary compact" onClick={props.onTakeBack} disabled={!props.canTakeBack}>
              <IconUndo size={17} /> {t('play.takeBack')}
            </button>
            <button className="secondary compact" onClick={props.onSwitchSides}>
              <IconSwap size={17} /> {t('play.switchSides')}
            </button>
          </>
        )}
      </div>
      )}
      <div className="solve-stats play-level">
        <div className="muted small">
          {t('play.level')}{' '}
          <b data-testid="level-name">
            {level} · {levelName(level)}
          </b>
        </div>
        <div className="levels" role="radiogroup" aria-label={t('play.levels')}>
          {LEVELS.map((_, i) => (
            <button
              key={i}
              role="radio"
              aria-checked={level === i + 1}
              aria-label={t('play.levelAria', { n: i + 1, name: levelName(i + 1) })}
              className={level === i + 1 ? 'active' : ''}
              onClick={() => props.setLevel(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
