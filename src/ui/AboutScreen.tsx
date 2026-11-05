import { useEffect, useState } from 'react';
import { PIECE_SETS } from '../board/pieceSets';
import { openUrl } from '../app/platform';
import { APP_NAME, APP_VERSION, BRAND, BRAND_URL, BRAND_URL_DE, DEVELOPER, LEGAL_URL, LEGAL_URL_DE, SOURCE_URL, SUPPORT_EMAIL } from '../app/config';
import { appVersion } from '../app/support';
import { IconCode, IconGlobe, IconLicence, IconMail, Logo } from './icons';
import { language, t } from '../i18n';
import { tr } from '../i18n/rich';

/** Third-party work in the app: what, by whom, under which licence (in the current language). */
const credits = (): { name: string; by: string; license: string }[] => [
  { name: 'Stockfish', by: t('about.stockfishBy'), license: 'GPLv3' },
  { name: t('about.stockfishWeb'), by: 'Chess.com, Nathan Rugg', license: 'GPLv3' },
  ...PIECE_SETS.map((p) => ({ name: t('about.pieces', { name: p.name }), by: t('about.via', { author: p.author }), license: p.license })),
  { name: t('about.openings'), by: 'lichess-org/chess-openings', license: 'CC0' },
  { name: t('about.puzzles'), by: t('about.puzzlesBy'), license: 'CC0' },
  { name: t('about.icons'), by: 'Lucide', license: 'ISC' },
];

export function AboutScreen({ onLicences }: { onLicences: () => void }) {
  const [version, setVersion] = useState(APP_VERSION);
  const brandUrl = language() === 'de' ? BRAND_URL_DE : BRAND_URL;
  const legalUrl = language() === 'de' ? LEGAL_URL_DE : LEGAL_URL;
  useEffect(() => {
    appVersion().then(setVersion);
  }, []);

  return (
    <div className="screen settings about-screen">
      <div className="about-hero">
        <span className="about-logo">
          <Logo size={96} glass />
        </span>
        <div className="about-name">{APP_NAME}</div>
        <div className="muted">{t('about.tagline')}</div>
        <span className="chip" data-testid="version">
          {t('about.version', { version })}
        </span>
      </div>

      <div className="card about-text">
        {t('about.text', { app: APP_NAME })}
      </div>

      <h2>{t('about.developer')}</h2>
      <div className="card">
        <button className="setting nav-row" onClick={() => openUrl(brandUrl)} data-testid="developer">
          <span className="row-lead">
            <IconGlobe size={19} />
            <span>
              {tr('about.by', { brand: BRAND })}
              <small>{brandUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</small>
            </span>
          </span>
          <span className="chevron" aria-hidden="true">›</span>
        </button>
        <a className="setting nav-row" href={`mailto:${SUPPORT_EMAIL}`}>
          <span className="row-lead">
            <IconMail size={19} />
            <span>
              {t('about.contact')}
              <small>{SUPPORT_EMAIL}</small>
            </span>
          </span>
          <span className="chevron" aria-hidden="true">›</span>
        </a>
        <button className="setting nav-row" onClick={() => openUrl(SOURCE_URL)}>
          <span className="row-lead">
            <IconCode size={19} />
            <span>
              {t('about.source')}
              <small>{t('about.sourceHint')}</small>
            </span>
          </span>
          <span className="chevron" aria-hidden="true">›</span>
        </button>
        <button className="setting nav-row" onClick={() => openUrl(legalUrl)} data-testid="imprint">
          <span className="row-lead">
            <IconLicence size={19} />
            <span>
              {t('about.imprint')}
              <small>{legalUrl.replace(/^https?:\/\//, '')}</small>
            </span>
          </span>
          <span className="chevron" aria-hidden="true">›</span>
        </button>
      </div>

      <h2>{t('about.thanks')}</h2>
      <div className="card credits" data-testid="credits">
        {credits().map((c) => (
          <div key={c.name} className="setting">
            <span>
              {c.name}
              <small>{c.by}</small>
            </span>
            <span className="license">{c.license}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <button className="setting nav-row" onClick={onLicences} data-testid="licences">
          <span className="row-lead">
            <IconLicence size={19} />
            <span>
              {t('about.licences')}
              <small>{t('about.licencesHint')}</small>
            </span>
          </span>
          <span className="chevron" aria-hidden="true">›</span>
        </button>
      </div>

      {/* the GPL's "appropriate legal notices": copyright, no warranty, where the licence is */}
      <p className="muted small center about-legal" data-testid="legal">
        {t('about.legal', { app: APP_NAME, name: DEVELOPER })}
      </p>

      <p className="muted small center about-footer">
        © 2026 {DEVELOPER}
        <br />
        {t('about.footer')}
      </p>
    </div>
  );
}
