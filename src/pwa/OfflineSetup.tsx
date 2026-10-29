import { useEffect, useState } from 'react';
import { useT } from '../i18n';

/** Explain waiting updates without activating them or interrupting forms. */
export default function OfflineSetup() {
  const t = useT();
  const [failed, setFailed] = useState(
    () => import.meta.env.PROD && (!window.isSecureContext || !('serviceWorker' in navigator)),
  );
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState<ServiceWorker | null>(null);
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
        // Fetch update metadata now; keep the existing safe, user-reviewed activation policy.
        if (typeof registration.update === 'function') void registration.update().catch(fail);
        const refreshWaiting = () => {
          if (alive) setWaiting(registration.active ? registration.waiting : null);
        };
        refreshWaiting();
        if (!registration.active && !registration.waiting && !registration.installing) fail();
        const watch = () => {
          const worker = registration.installing;
          if (!worker) return;
          const changed = () => {
            if (!alive) return;
            if (worker.state === 'redundant') fail();
            refreshWaiting();
            if (worker.state === 'installed' && registration.active) setWaiting(worker);
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
  return (
    <>
      {waiting && waiting !== dismissed && (
        <section
          className="notice update-notice"
          role="status"
          aria-label={t('App update', '應用程式更新')}
        >
          <div>
            <strong>{t('Update ready', '更新已就緒')}</strong>
            <p>
              {t(
                'Save your work, then close all TCO Logbook tabs and Home Screen windows. Reopen to use the update.',
                '請先儲存修改，再關閉所有 TCO Logbook 分頁及主畫面視窗，重新開啟後即可使用更新。',
              )}
            </p>
          </div>
          <button
            onClick={() => setDismissed(waiting)}
            aria-label={t('Dismiss update notice', '關閉更新提示')}
          >
            {t('Dismiss', '關閉提示')}
          </button>
        </section>
      )}
      {failed && (
        <p role="alert" className="notice amber">
          {t(
            'Offline setup or update could not complete. Retry when connected and keep a JSON backup. Local record saving is separate from the offline cache.',
            '離線安裝或更新未能完成。請連線後重試，並保留 JSON 備份；本機紀錄儲存與離線快取分開。',
          )}
        </p>
      )}
    </>
  );
}
