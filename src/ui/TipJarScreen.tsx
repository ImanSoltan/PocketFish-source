import { useEffect, useState } from 'react';
import { APP_NAME } from '../app/config';
import { giveTip, isSupporter, loadTips, tipsAvailable, type TipOffer, type TipOutcome } from '../app/tips';
import { t } from '../i18n';
import { IconCheck, IconHeart } from './icons';

/** Settings > Help & feedback > Support PocketFish: tips through the App Store. */
export function TipJarScreen() {
  const available = tipsAvailable();
  const [offers, setOffers] = useState<TipOffer[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<TipOutcome | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const load = () => {
    setOffline(false);
    loadTips().then(setOffers, () => setOffline(true));
  };
  useEffect(() => {
    if (available) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tip = async (id: string) => {
    setBusy(id);
    setOutcome(null);
    setFailure(null);
    try {
      setOutcome(await giveTip(id));
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <TipJar
      available={available}
      offers={offers}
      offline={offline}
      busy={busy}
      outcome={outcome}
      failure={failure}
      supporter={isSupporter()}
      onTip={tip}
      onRetry={load}
    />
  );
}

interface Props {
  /** only the iPhone app can take tips */
  available: boolean;
  /** null while the prices load */
  offers: TipOffer[] | null;
  offline: boolean;
  /** the tip being paid */
  busy: string | null;
  outcome: TipOutcome | null;
  failure: string | null;
  supporter: boolean;
  onTip: (id: string) => void;
  onRetry: () => void;
}

export function TipJar(p: Props) {
  let body;
  if (!p.available) body = <p className="muted">{t('tips.webOnly', { app: APP_NAME })}</p>;
  else if (p.offline)
    body = (
      <>
        <p className="muted">{t('tips.offline')}</p>
        <button className="secondary compact" onClick={p.onRetry}>
          {t('common.tryAgain')}
        </button>
      </>
    );
  else if (!p.offers) body = <p className="muted busy">{t('tips.loading')}</p>;
  else if (!p.offers.length) body = <p className="muted">{t('tips.unavailable')}</p>;

  return (
    <div className="screen settings tips-screen">
      <div className="about-hero">
        <span className="tip-heart">
          <IconHeart size={40} />
        </span>
        <div className="about-name">{t('tips.title', { app: APP_NAME })}</div>
      </div>

      <div className="card about-text">{t('tips.intro', { app: APP_NAME })}</div>

      {body ? (
        <div className="card about-text" data-testid="tips-status">
          {body}
        </div>
      ) : (
        <div className="card" data-testid="tips">
          {p.offers!.map((o) => (
            <button key={o.id} className="setting nav-row" disabled={p.busy !== null} onClick={() => p.onTip(o.id)}>
              <span>{t(`tips.${o.size}`)}</span>
              <span className="chip">{o.price}</span>
            </button>
          ))}
        </div>
      )}

      {p.outcome === 'thanks' && (
        <div className="card solve-title verdict ok tip-outcome" role="status">
          <IconCheck size={20} />
          {t('tips.thanks', { app: APP_NAME })}
        </div>
      )}
      {p.outcome === 'pending' && (
        <p className="card muted small tip-outcome" role="status">
          {t('tips.pending')}
        </p>
      )}
      {p.failure && (
        <p className="card small error tip-outcome" role="status">
          {t('tips.failed', { error: p.failure })}
        </p>
      )}

      <p className="muted small center">
        {p.supporter && p.outcome !== 'thanks' && (
          <>
            {t('tips.supporterHint', { app: APP_NAME })}
            <br />
          </>
        )}
        {t('tips.note')}
      </p>
    </div>
  );
}
