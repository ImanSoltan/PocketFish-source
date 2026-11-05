import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { isNative } from './app/platform';
import { applyScheme } from './app/schemes';
import { loadSettings } from './app/settings';
import { setLanguage } from './i18n';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './styles.css';

// colours and language before the first paint (no flash of the defaults)
const settings = loadSettings();
applyScheme(settings.scheme);
setLanguage(settings.language);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// offline support for the web version (the native apps ship their files)
if (import.meta.env.PROD && 'serviceWorker' in navigator && !isNative()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => undefined);
  });
}
