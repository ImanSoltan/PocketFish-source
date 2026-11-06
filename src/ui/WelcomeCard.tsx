import { useEffect, useRef } from 'react';
import { loadJson, saveJson } from '../app/settings';
import { APP_NAME } from '../app/config';
import { t } from '../i18n';
import { tr } from '../i18n/rich';
import { IconBoard, IconCamera, IconLock, IconPuzzle, IconRetry } from './icons';

// First-run tips: a floating glass sheet over the analysis screen, until dismissed (Settings can show them
// again). It floats instead of pushing the board down; "Got it", a tap beside it or Escape closes it.
const KEY = 'chessy.tips-dismissed.v1';

export const tipsDismissed = () => loadJson<boolean>(KEY) === true;
export const setTipsDismissed = (v: boolean) => saveJson(KEY, v);

export function WelcomeCard({ onClose }: { onClose: () => void }) {
  const gotIt = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    gotIt.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="welcome-layer">
      <div className="welcome-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" data-testid="welcome">
        <div className="welcome-title" id="welcome-title">
          {t('welcome.title', { app: APP_NAME })}
        </div>
        <ul>
          <li>
            <span className="welcome-icon">
              <IconCamera size={18} />
            </span>
            <span>{tr('welcome.scan')}</span>
          </li>
          <li>
            <span className="welcome-icon">♞</span>
            <span>{tr('welcome.modes')}</span>
          </li>
          <li>
            <span className="welcome-icon">
              <IconPuzzle size={18} />
            </span>
            <span>{tr('welcome.puzzles')}</span>
          </li>
          <li>
            <span className="welcome-icon">
              <IconRetry size={18} />
            </span>
            <span>{tr('welcome.newGame', undefined, <IconBoard size={15} />)}</span>
          </li>
          <li>
            <span className="welcome-icon">
              <IconLock size={18} />
            </span>
            <span>{tr('welcome.private')}</span>
          </li>
        </ul>
        <button ref={gotIt} className="primary compact" onClick={onClose}>
          {t('welcome.gotIt')}
        </button>
      </div>
    </div>
  );
}
