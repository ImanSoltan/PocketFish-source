// The last resort: an error while drawing a screen shows this instead of a blank page, with a way out
// even when the cause is something stored on the device (Reset deletes what the app keeps).
import { Component, type ReactNode } from 'react';
import { deleteAllData } from '../app/settings';
import { t } from '../i18n';

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('screen error', error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    const reset = () => {
      deleteAllData();
      location.reload();
    };
    return (
      <main className="crash" role="alert" data-testid="crash">
        <div className="card">
          <h1>{t('crash.title')}</h1>
          <p>{t('crash.body')}</p>
          <button className="primary" onClick={() => location.reload()}>
            {t('crash.reload')}
          </button>
          <button className="secondary" onClick={reset}>
            {t('crash.reset')}
          </button>
        </div>
      </main>
    );
  }
}
