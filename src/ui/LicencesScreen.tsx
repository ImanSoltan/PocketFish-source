import { useEffect, useState } from 'react';
import { SOURCE_URL } from '../app/config';
import { t } from '../i18n';

/** About > Licences: public/licenses.txt, written at build time by scripts/licenses.mjs (in English). */
export function LicencesScreen() {
  const [text, setText] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    fetch('licenses.txt')
      .then((r) => (r.ok && !r.headers.get('content-type')?.includes('text/html') ? r.text() : Promise.reject()))
      .then(setText, () => setMissing(true));
  }, []);

  return (
    <div className="screen settings licences-screen">
      {missing ? (
        <p className="card about-text">{t('licences.missing', { url: SOURCE_URL })}</p>
      ) : (
        <pre className="card licences" lang="en" data-testid="licences-text">
          {text ?? '…'}
        </pre>
      )}
    </div>
  );
}
