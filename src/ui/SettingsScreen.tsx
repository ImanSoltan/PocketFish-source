import { useEffect, useState } from 'react';
import { THEMES } from '../board/Board';
import { PIECE_SETS } from '../board/pieceSets';
import { AUTO_DARK, AUTO_LIGHT, SCHEMES } from '../app/schemes';
import { DEFAULT_SETTINGS, type Settings } from '../app/settings';
import { APP_NAME, APP_VERSION } from '../app/config';
import { appVersion, deviceName, feedbackMail, reviewUrl } from '../app/support';
import { isSupporter, tipsAvailable } from '../app/tips';
import { IconEyeOff, IconHeart, IconLock, IconShield, IconWifiOff, Logo } from './icons';
import { LANGUAGES, LANGUAGE_NAMES, isLanguage, t, type MessageKey } from '../i18n';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  /** show the first-run tips again (on the analysis screen) */
  onShowTips: () => void;
  onPrivacy: () => void;
  onAbout: () => void;
  /** the tip jar (only in the iPhone app) */
  onTips: () => void;
  /** delete everything the app stored on the device (after confirming) */
  onDeleteData: () => void;
}

export function SettingsScreen({ settings, onChange, onShowTips, onPrivacy, onAbout, onTips, onDeleteData }: Props) {
  const [version, setVersion] = useState(APP_VERSION);
  useEffect(() => {
    appVersion().then(setVersion);
  }, []);
  const device = deviceName(navigator.userAgent);
  const rate = reviewUrl();
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  const toggle = (k: keyof Settings, label: MessageKey, hint?: MessageKey) => (
    <label className="setting">
      <span>
        {t(label)}
        {hint && <small>{t(hint)}</small>}
      </span>
      <input type="checkbox" className="switch" checked={settings[k] as boolean} onChange={(e) => set(k, e.target.checked as never)} />
    </label>
  );

  const pickScheme = (id: string) => {
    const scheme = SCHEMES.find((x) => x.id === (id === 'auto' ? AUTO_LIGHT : id));
    onChange({ ...settings, scheme: id, theme: scheme?.board ?? settings.theme });
  };
  const boardTheme = THEMES.find((x) => x.name === settings.theme) ?? THEMES[0];
  const light = SCHEMES.find((x) => x.id === AUTO_LIGHT)!;
  const dark = SCHEMES.find((x) => x.id === AUTO_DARK)!;
  const schemeCards = [
    { id: 'auto', preview: [light.preview, dark.preview] },
    ...SCHEMES.map((x) => ({ id: x.id, preview: [x.preview] })),
  ];

  return (
    <div className="screen settings">
      <h2>{t('settings.appearance')}</h2>
      <div className="card schemes" role="radiogroup" aria-label={t('settings.colourScheme')}>
        {schemeCards.map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={settings.scheme === c.id}
            className={`scheme ${settings.scheme === c.id ? 'active' : ''}`}
            onClick={() => pickScheme(c.id)}
          >
            <span className="scheme-preview">
              {c.preview.map(([bg, accent, board], i) => (
                <span key={i} className="scheme-half" style={{ background: bg }}>
                  <span className="scheme-board" style={{ background: board }} />
                  <span className="scheme-accent" style={{ background: accent }} />
                </span>
              ))}
            </span>
            <span className="scheme-name">{t(`scheme.${c.id}` as MessageKey)}</span>
          </button>
        ))}
      </div>

      <h2>{t('settings.language')}</h2>
      <div className="card">
        <label className="setting">
          <span>
            {t('settings.appLanguage')}
            <small>{t('settings.languageHint')}</small>
          </span>
          <select
            value={settings.language}
            onChange={(e) => set('language', isLanguage(e.target.value) ? e.target.value : 'auto')}
            data-testid="language"
          >
            <option value="auto">{t('settings.automatic')}</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l} lang={l}>
                {LANGUAGE_NAMES[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h2>{t('settings.engine')}</h2>
      <div className="card">
        <label className="setting">
          <span>
            {t('settings.bestLines')}
            <small>{t('settings.bestLinesHint')}</small>
          </span>
          <select value={settings.lines} onChange={(e) => set('lines', Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="setting">
          <span>
            {t('settings.depth')}
            <small>{t('settings.depthHint')}</small>
          </span>
          <select value={settings.depth} onChange={(e) => set('depth', Number(e.target.value))}>
            {[12, 16, 18, 20, 22, 25, 30, 0].map((d) => (
              <option key={d} value={d}>
                {d === 0 ? t('settings.unlimited') : d}
              </option>
            ))}
          </select>
        </label>
        {toggle('showArrows', 'settings.arrows')}
        {toggle('showLines', 'settings.lines')}
        {toggle('showWdl', 'settings.wdl', 'settings.wdlHint')}
        {toggle('showEvalBar', 'settings.evalBar')}
      </div>

      <h2>{t('settings.board')}</h2>
      <div className="card">
        <div className="setting">
          <span>{t('settings.colors')}</span>
          <div className="swatches">
            {THEMES.map((x) => (
              <button
                key={x.name}
                className={`swatch ${settings.theme === x.name ? 'active' : ''}`}
                aria-label={t('settings.boardColors', { name: x.name })}
                onClick={() => set('theme', x.name)}
                style={{ background: `linear-gradient(135deg, ${x.light} 50%, ${x.dark} 50%)` }}
              />
            ))}
          </div>
        </div>
        <div className="setting stacked">
          <span>{t('settings.pieces')}</span>
          <div className="piece-sets" role="radiogroup" aria-label={t('settings.pieceSet')}>
            {PIECE_SETS.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={settings.pieceSet === p.id}
                className={`piece-set ${settings.pieceSet === p.id ? 'active' : ''}`}
                onClick={() => set('pieceSet', p.id)}
              >
                <span className="piece-set-preview">
                  <img src={`pieces/${p.id}/wN.svg`} alt="" style={{ background: boardTheme.light }} />
                  <img src={`pieces/${p.id}/bN.svg`} alt="" style={{ background: boardTheme.dark }} />
                </span>
                <span className="piece-set-name">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
        {toggle('coords', 'settings.coords')}
        {toggle('sounds', 'settings.sounds', 'settings.soundsHint')}
      </div>

      <h2>{t('settings.scanning')}</h2>
      <div className="card">
        <label className="setting">
          <span>
            {t('settings.defaultTurn')}
            <small>{t('settings.defaultTurnHint')}</small>
          </span>
          <select value={settings.defaultTurn} onChange={(e) => set('defaultTurn', e.target.value as 'w' | 'b')}>
            <option value="w">{t('common.white')}</option>
            <option value="b">{t('common.black')}</option>
          </select>
        </label>
        {toggle('assumeCastling', 'settings.castling', 'settings.castlingHint')}
      </div>

      <h2>{t('settings.privacy')}</h2>
      <div className="card privacy" data-testid="privacy">
        <div className="privacy-head">
          <IconShield size={20} /> {t('settings.privateByDesign')}
        </div>
        <ul className="privacy-points">
          <li>
            <IconLock size={17} /> {t('settings.privacy1')}
          </li>
          <li>
            <IconWifiOff size={17} /> {t('settings.privacy2')}
          </li>
          <li>
            <IconEyeOff size={17} /> {t('settings.privacy3')}
          </li>
        </ul>
        {toggle('keepScans', 'settings.keepScans', 'settings.keepScansHint')}
        <button className="setting nav-row" onClick={onPrivacy}>
          <span>
            {t('settings.privacyPolicy')}
            <small>{t('settings.privacyPolicyHint')}</small>
          </span>
          <span className="chevron" aria-hidden="true">›</span>
        </button>
        <button className="setting nav-row danger" onClick={onDeleteData}>
          <span>
            {t('settings.deleteAll')}
            <small>{t('settings.deleteAllHint')}</small>
          </span>
        </button>
      </div>

      <h2>{t('settings.help')}</h2>
      <div className="card help" data-testid="help">
        <a className="setting nav-row" href={feedbackMail('feedback', version, device)}>
          <span>
            {t('settings.feedback')}
            <small>{t('settings.feedbackHint')}</small>
          </span>
          <span className="chevron" aria-hidden="true">›</span>
        </a>
        <a className="setting nav-row" href={feedbackMail('scan', version, device)}>
          <span>
            {t('settings.misread')}
            <small>{t('settings.misreadHint')}</small>
          </span>
          <span className="chevron" aria-hidden="true">›</span>
        </a>
        {rate && (
          <a className="setting nav-row" href={rate} target="_blank" rel="noreferrer">
            <span>{t('settings.rate', { app: APP_NAME })}</span>
            <span className="chevron" aria-hidden="true">›</span>
          </a>
        )}
        {tipsAvailable() && (
          <button className="setting nav-row" onClick={onTips} data-testid="tip-jar">
            <span className="row-lead">
              <span className="tip-heart small">
                <IconHeart size={17} />
              </span>
              <span>
                {t('tips.title', { app: APP_NAME })}
                <small>{isSupporter() ? t('tips.supporterHint', { app: APP_NAME }) : t('tips.hint')}</small>
              </span>
            </span>
            <span className="chevron" aria-hidden="true">›</span>
          </button>
        )}
        <button className="setting nav-row" onClick={onShowTips}>
          <span>{t('settings.showTips')}</span>
          <span className="chevron" aria-hidden="true">›</span>
        </button>
        <button className="setting nav-row" onClick={onAbout} data-testid="about">
          <span className="row-lead">
            <Logo size={30} />
            <span>
              {t('settings.about', { app: APP_NAME })}
              <small>{t('settings.aboutHint', { version })}</small>
            </span>
          </span>
          <span className="chevron" aria-hidden="true">›</span>
        </button>
      </div>

      <div className="card">
        <button
          className="setting nav-row accent"
          onClick={() => window.confirm(t('settings.resetConfirm')) && onChange({ ...DEFAULT_SETTINGS })}
        >
          <span>{t('settings.reset')}</span>
        </button>
      </div>
    </div>
  );
}
