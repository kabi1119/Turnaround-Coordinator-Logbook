import { useState, useSyncExternalStore } from 'react';
import type { AccountEngine } from './engine';
import { requestDownload } from './archive';
import { compareFields } from '../migration/matching';
import { useT } from '../i18n';
const show = (v: unknown) =>
  v === undefined || v === null ? '—' : typeof v === 'string' ? v || '—' : JSON.stringify(v);
export default function RecoveryControl({
  engine,
  onMerge,
}: {
  engine: AccountEngine;
  onMerge?: () => void;
}) {
  const t = useT(),
    status = useSyncExternalStore(engine.subscribe, engine.snapshot);
  const [backup, setBackup] = useState(''),
    [reread, setReread] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [choices, setChoices] = useState<Record<string, 'local' | 'cloud'>>({}),
    [confirmed, setConfirmed] = useState(false);
  const state = engine.state();
  if (status.error !== 'archived' && state.recovery?.stage !== 'review') return null;
  const rows = engine.recoveryRows();
  return (
    <section aria-label={t('Expired offline device review', '過期離線裝置覆核')}>
      <h3>{t('Review this offline device', '覆核此離線裝置')}</h3>
      <p>
        {t(
          'Automatic replay is blocked. Export and reread this device’s complete pending-work recovery file before downloading the current cloud state. Nothing is uploaded by preparing the review.',
          '自動重送已封鎖。下載目前雲端狀態前，請匯出並重新讀取此裝置的完整待同步復原檔。準備覆核不會上傳資料。',
        )}
      </p>
      <button
        disabled={busy}
        onClick={() => {
          const text = engine.recoveryBackup();
          requestDownload(text, 'tco-pending-recovery.json');
          setBackup(text);
          setReread('');
          setConfirmed(false);
        }}
      >
        {t('Download pending-work recovery file', '下載待同步復原檔')}
      </button>
      {backup && (
        <label>
          {t('Reread the saved pending-work file', '重新讀取已儲存待同步檔')}
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              setReread('');
              if (!file || file.size > 32 * 1024 * 1024) return;
              void file
                .text()
                .then((text) => {
                  if (text === backup) {
                    setReread(text);
                    setMessage(t('Saved pending-work file verified.', '已驗證待同步儲存檔。'));
                  } else setMessage(t('File mismatch; no data changed.', '檔案不符；未變更資料。'));
                })
                .catch(() => setMessage(t('File could not be read.', '未能讀取檔案。')));
            }}
          />
        </label>
      )}
      <button
        disabled={!reread || busy}
        onClick={() => {
          setBusy(true);
          setChoices({});
          setConfirmed(false);
          void engine
            .reviewAfterArchive(reread)
            .then(() =>
              setMessage(
                t(
                  'Cloud state downloaded. Review every pending change before approving a new upload.',
                  '已下載雲端狀態；批准重新上傳前，請覆核每項待同步變更。',
                ),
              ),
            )
            .catch(() =>
              setMessage(
                t(
                  'Review could not be prepared safely. Retain your file and retry; do not reset this device.',
                  '未能安全準備覆核。請保留檔案後重試，不要重設裝置。',
                ),
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        {t('Prepare synchronization review', '準備同步覆核')}
      </button>
      {state.recovery?.stage === 'review' && (
        <>
          {state.recovery.merge ? (
            <div>
              <p className="notice amber">
                {t(
                  'This device contains an interrupted Guest merge. Its original plan and both snapshots are retained. Do not approve it as an ordinary edit; the full Guest merge must be reviewed again. Guest originals remain unchanged.',
                  '此裝置包含中斷的訪客合併；原計劃及雙方快照已保留。不能把它當成一般編輯批准，須重新進行完整訪客合併覆核。訪客原件未變更。',
                )}
              </p>
              {onMerge && (
                <button onClick={onMerge}>
                  {t('Resume Guest Merge Recovery', '繼續訪客合併復原')}
                </button>
              )}
            </div>
          ) : (
            <>
              {rows.map((row) => (
                <fieldset key={row.key}>
                  <legend>
                    {row.local?.collection || row.cloud?.collection} ·{' '}
                    {row.local?.id || row.cloud?.id}
                  </legend>
                  <details>
                    <summary>{t('Review all field differences', '覆核所有欄位差異')}</summary>
                    {compareFields(row.cloud?.value, row.local?.value)
                      .filter((f) => f.state !== 'match')
                      .map((f) => (
                        <p key={f.field}>
                          <strong>{f.field}</strong>
                          <br />
                          {t('Cloud', '雲端')}: {show(f.cloud)}
                          <br />
                          {t('Local', '本機')}: {show(f.local)}
                        </p>
                      ))}
                  </details>
                  {(['cloud', 'local'] as const).map((choice) => (
                    <label key={choice}>
                      <input
                        type="radio"
                        name={row.key}
                        checked={choices[row.key] === choice}
                        onChange={() => {
                          setChoices({ ...choices, [row.key]: choice });
                          setConfirmed(false);
                        }}
                      />
                      {choice === 'cloud'
                        ? t('Keep Cloud', '保留雲端')
                        : t('Keep Local', '保留本機')}
                    </label>
                  ))}
                </fieldset>
              ))}
              {!rows.length && (
                <p>
                  {t(
                    'No pending differences remain. Confirm after reviewing the downloaded state.',
                    '沒有待同步差異；請覆核下載狀態後確認。',
                  )}
                </p>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {t(
                  'I reviewed all retained differences, including deletions, and approve these choices. The verified recovery file preserves the original pending work.',
                  '我已覆核所有保留差異（包括刪除），並批准這些選擇。已驗證復原檔保留原有待同步資料。',
                )}
              </label>
              <button
                disabled={!confirmed || busy || rows.some((r) => !choices[r.key])}
                onClick={() => {
                  setBusy(true);
                  void engine
                    .approveArchiveReview(choices, engine.store.snapshot())
                    .then(() =>
                      setMessage(
                        t(
                          'Review approved. Check the synchronization status for server acknowledgement.',
                          '已批准覆核；請查看同步狀態以確認伺服器回應。',
                        ),
                      ),
                    )
                    .catch(() =>
                      setMessage(
                        t(
                          'Approval was not applied. The cloud state may have changed; prepare and review again.',
                          '未套用批准。雲端狀態可能已變更，請重新準備及覆核。',
                        ),
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                {t('Approve reviewed synchronization', '批准已覆核同步')}
              </button>
            </>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
