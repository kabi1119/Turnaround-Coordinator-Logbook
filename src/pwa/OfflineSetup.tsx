import { useEffect, useState } from 'react';
import { useT } from '../i18n';

/** Critical failure only; update/status cosmetics are intentionally deferred. */
export default function OfflineSetup() {
  const t = useT();
  const [failed, setFailed] = useState(
    () => import.meta.env.PROD && (!window.isSecureContext || !('serviceWorker' in navigator)),
  );
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!window.isSecureContext || !('serviceWorker' in navigator)) {
      return;
    }
    let alive = true;
    const disposers: (() => void)[] = [];
    const fail = () => {
      if (alive) setFailed(true);
    };
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        if (!alive) return;
        if (!registration.active && !registration.waiting && !registration.installing) fail();
        const watch = () => {
          const worker = registration.installing;
          if (!worker) return;
          const changed = () => {
            if (worker.state === 'redundant') fail();
          };
          worker.addEventListener('statechange', changed);
          disposers.push(() => worker.removeEventListener('statechange', changed));
          changed();
        };
        registration.addEventListener('updatefound', watch);
        disposers.push(() => registration.removeEventListener('updatefound', watch));
        watch();
      })
      .catch(fail);
    return () => {
      alive = false;
      disposers.forEach((dispose) => dispose());
    };
  }, []);
  return failed ? (
    <p role="alert" className="notice amber">
      {t(
        'Offline setup or update could not complete. Retry when connected and keep a JSON backup. Local record saving is separate from the offline cache.',
        '離線安裝或更新未能完成。請連線後重試，並保留 JSON 備份；本機紀錄儲存與離線快取分開。',
      )}
    </p>
  ) : null;
}
