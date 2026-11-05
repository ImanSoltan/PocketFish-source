import { resolveScheme } from '../app/schemes';
import { t } from '../i18n';

/** The privacy policy (public/privacy.html, bundled with the app, so it works offline). */
export function PrivacyScreen({ scheme }: { scheme: string }) {
  const dark = resolveScheme(scheme).dark;
  return (
    <div className="screen doc">
      <iframe className="doc-frame" src={`privacy.html?theme=${dark ? 'dark' : 'light'}`} title={t('settings.privacyPolicy')} />
    </div>
  );
}
