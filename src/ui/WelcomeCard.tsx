import { loadJson, saveJson } from '../app/settings';
import { APP_NAME } from '../app/config';
import { t } from '../i18n';
import { tr } from '../i18n/rich';
import { IconBoard, IconCamera, IconLock, IconPuzzle } from './icons';

// First-run tips on the analysis screen, until dismissed (Settings can show them again).
const KEY = 'chessy.tips-dismissed.v1';

export const tipsDismissed = () => loadJson<boolean>(KEY) === true;
export const setTipsDismissed = (v: boolean) => saveJson(KEY, v);

export function WelcomeCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="card welcome" data-testid="welcome">
      <div className="welcome-title">{t('welcome.title', { app: APP_NAME })}</div>
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
            <IconBoard size={18} />
          </span>
          <span>{tr('welcome.newGame')}</span>
        </li>
        <li>
          <span className="welcome-icon">
            <IconLock size={18} />
          </span>
          <span>{tr('welcome.private')}</span>
        </li>
      </ul>
      <button className="primary compact" onClick={onClose}>
        {t('welcome.gotIt')}
      </button>
    </div>
  );
}
