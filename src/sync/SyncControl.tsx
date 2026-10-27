import { useState, useSyncExternalStore } from 'react';
import type { SyncEngine } from './engine';
import { records } from './records';
import { recordKey } from './crypto';
import { Field } from '../components/ui';
import { useT } from '../i18n';
import './sync.css';
export default function SyncControl({ engine }: { engine: SyncEngine | null }) {
  const t = useT();
  return engine ? (
    <Controls engine={engine} />
  ) : (
    <p className="notice amber">
      {t(
        'Cloud Sync unavailable. Sign in online and unlock your Account Vault. Guest stays device-only.',
        '雲端同步未能使用。請連線登入並解鎖帳戶資料庫；訪客資料只存本機。',
      )}
    </p>
  );
}
function Controls({ engine }: { engine: SyncEngine }) {
  const t = useT(),
    status = useSyncExternalStore(engine.subscribe, engine.snapshot);
  const [secret, setSecret] = useState(''),
    [confirm, setConfirm] = useState(''),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [review, setReview] = useState<{
    snapshot: string | null | undefined;
    choices: Record<string, 'local' | 'cloud'>;
  } | null>(null);
  const state = engine.state();
  const labels = {
    disabled: t('Cloud Sync disabled', '雲端同步已停用'),
    locked: t('Sync paused · cloud key locked', '同步暫停 · 雲端金鑰已鎖定'),
    syncing: t('Syncing', '同步中'),
    pending: t('Pending changes', '尚待同步'),
    synced: t('Synced', '已同步'),
    conflict: t('Conflict detected', '發現衝突'),
    paused: t('Sync paused · action required', '同步暫停 · 需要處理'),
  };
  const errors: Record<string, string> = {
    setup: t(
      'Cloud Sync is not set up on the server. Ask the owner to apply the reviewed v0.8.0 migration.',
      '伺服器未設定雲端同步，請項目擁有者套用已審核的 v0.8.0 migration。',
    ),
    auth: t(
      'Online session verification failed. Sign in again; local records remain available.',
      '未能驗證線上登入狀態。請重新登入；本機紀錄仍保留。',
    ),
    network: t(
      'Server unavailable, timed out or rate limited. Local changes are safe; retry later.',
      '伺服器暫停、逾時或請求受限。本機修改已保留，請稍後重試。',
    ),
    capacity: t(
      'Cloud or payload capacity reached. Keep a JSON backup and review storage with the owner.',
      '雲端或資料容量已達上限。請保留 JSON 備份並與項目擁有者檢查容量。',
    ),
    invalid: t(
      'Passphrase, encrypted data or format could not be verified. Nothing unsafe was applied. Use the original cloud vault passphrase; do not reset the cloud key.',
      '未能驗證密語、密文或格式，未套用不安全資料。請使用原有雲端資料庫密語，勿重設雲端金鑰。',
    ),
    conflict: t(
      'Cloud changed concurrently. Retry to download both versions for review.',
      '雲端有並行修改。請重試下載兩個版本以供覆核。',
    ),
    local: t(
      'Local storage changed or could not be written. Save any open work, then reload/unlock and retry.',
      '本機資料已改變或未能儲存。請先儲存開啟中的工作，再重新載入及解鎖後重試。',
    ),
    editing: t(
      'Save and close other record/backup dialogs before syncing.',
      '請先儲存並關閉其他紀錄／備份視窗，再同步。',
    ),
    locks: t(
      'This browser lacks safe cross-tab locking. Use a current HTTPS browser; sync stays disabled.',
      '此瀏覽器不支援安全的跨分頁鎖定。請使用新版 HTTPS 瀏覽器；同步維持停用。',
    ),
    locked: t('Unlock the cloud key again to resume.', '請再次解鎖雲端金鑰以繼續。'),
  };
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch {
      setError(
        t(
          'Could not apply this selection. Check relationships, current data and local storage; no partial replacement was made.',
          '未能套用選擇。請檢查關聯、目前資料及本機儲存空間；未進行部分取代。',
        ),
      );
    } finally {
      setBusy(false);
      setSecret('');
      setConfirm('');
    }
  };
  const needsKey = ['disabled', 'locked'].includes(status.phase) || status.phase === 'paused';
  return (
    <section className="sync-control" aria-label={t('Cloud Sync', '雲端同步')}>
      <h3>{t('Encrypted Cloud Sync', '加密雲端同步')}</h3>
      <p role="status">
        <strong>{labels[status.phase]}</strong> · {status.pending}{' '}
        {t('pending changes', '項尚待同步')}
      </p>
      {status.lastSuccess && (
        <p>
          {t('Last acknowledged sync', '最近已確認同步')}:{' '}
          {new Date(status.lastSuccess).toLocaleString()}
        </p>
      )}
      <p>
        {t(
          'Sync is not an independent backup. Keep a verified JSON export. Disabling sync stops future transfers on this device, but does not delete cloud copies or stop other devices.',
          '同步不能代替獨立備份，請保留已核對的 JSON 匯出。停用只停止此裝置往後傳輸，不會刪除雲端副本或停止其他裝置。',
        )}
      </p>
      {status.error && (
        <p role="alert" className="notice amber">
          {errors[status.error] || errors.invalid}
        </p>
      )}
      {needsKey && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (consent && secret === confirm) void run(() => engine.enable(secret));
          }}
        >
          <p>
            {t(
              'Enable only for information you are permitted to store remotely. Handling records (including archived/private fields and disruptions), Duties, Journals and privacy settings will be encrypted locally before upload. The provider can still see account identity, sizes, counts and access/update activity. Encryption does not grant employer permission. Guest data is excluded.',
              '只可啟用於獲准儲存至遠端的資料。航機紀錄（包括封存／私隱欄位及異常事件）、更次、日誌及私隱設定會先在本機加密再上傳。供應商仍能看到帳戶、大小、數量及存取／更新活動。加密不等於僱主許可；訪客資料不會上傳。',
            )}
          </p>
          <p>
            {t(
              'Use the vault passphrase chosen on the first cloud-enabled device. It may differ from this device’s local vault passphrase. Existing data on both devices is reconciled; differences require review. For a new cloud key, use your local vault passphrase and keep it safe.',
              '請使用首個啟用雲端同步裝置所選的資料庫密語，可能與此裝置的本機密語不同。兩邊現有資料會進行比對，差異須覆核。首次建立雲端金鑰時，請使用本機資料庫密語並妥善保管。',
            )}
          </p>
          <Field
            label={t('Cloud vault passphrase', '雲端資料庫密語')}
            type="password"
            minLength={12}
            maxLength={1024}
            required
            autoComplete="current-password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <Field
            label={t('Confirm passphrase', '確認密語')}
            type="password"
            required
            autoComplete="current-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {t(
              'I understand and authorize encrypted sync for this Account Workspace.',
              '我明白並授權此帳戶工作區進行加密同步。',
            )}
          </label>
          <button
            className="primary"
            disabled={busy || !consent || secret !== confirm || secret.length < 12}
          >
            {t('Enable / unlock Cloud Sync', '啟用／解鎖雲端同步')}
          </button>
        </form>
      )}
      <div className="actions">
        <button disabled={busy || !engine.canRun()} onClick={() => void run(() => engine.run())}>
          {t('Retry sync', '重試同步')}
        </button>
        {state?.enabled && (
          <button disabled={busy} onClick={() => void run(() => engine.disable())}>
            {t('Disable future sync on this device', '停用此裝置往後的同步')}
          </button>
        )}
      </div>
      {!!state?.conflicts.length && (
        <>
          <h4>{t('Review conflicting versions', '覆核衝突版本')}</h4>
          <p>
            {t(
              'Local and cloud versions are retained until you choose. Deletions appear as Deleted. Resolve linked changes together; invalid relationships block the entire resolution.',
              '選擇前會保留本機及雲端版本。刪除會顯示為「已刪除」。請一併處理相關變更，無效關聯會阻止整次套用。',
            )}
          </p>
          {!review ? (
            <button
              onClick={() => setReview({ snapshot: engine.store.read().snapshot, choices: {} })}
            >
              {t('Review differences', '覆核差異')}
            </button>
          ) : (
            <>
              {state.conflicts.map((key) => {
                const local = records(engine.store.read().db).find((r) => recordKey(r) === key),
                  cloud = state.base.find((b) => recordKey(b.record) === key)?.record;
                const fields = [
                  ...new Set([
                    ...Object.keys((local?.value || {}) as object),
                    ...Object.keys((cloud?.value || {}) as object),
                  ]),
                ];
                return (
                  <fieldset key={key}>
                    <legend>
                      {local?.collection || cloud?.collection} · {local?.id || cloud?.id}
                    </legend>
                    <div className="sync-diff">
                      <div>
                        <strong>{t('This device', '此裝置')}</strong>
                        <pre>
                          {local?.value
                            ? JSON.stringify(local.value, null, 2)
                            : t('Deleted', '已刪除')}
                        </pre>
                      </div>
                      <div>
                        <strong>{t('Cloud', '雲端')}</strong>
                        <pre>
                          {cloud?.value
                            ? JSON.stringify(cloud.value, null, 2)
                            : t('Deleted', '已刪除')}
                        </pre>
                      </div>
                    </div>
                    <small>
                      {t(
                        'Review all saved fields, including private/archived values.',
                        '請覆核全部儲存欄位，包括私隱／封存值。',
                      )}{' '}
                      ({fields.length})
                    </small>
                    <label>
                      <input
                        type="radio"
                        name={key}
                        checked={review.choices[key] === 'local'}
                        onChange={() =>
                          setReview({ ...review, choices: { ...review.choices, [key]: 'local' } })
                        }
                      />
                      {t('Keep local version', '保留本機版本')}
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={key}
                        checked={review.choices[key] === 'cloud'}
                        onChange={() =>
                          setReview({ ...review, choices: { ...review.choices, [key]: 'cloud' } })
                        }
                      />
                      {t('Use cloud version', '使用雲端版本')}
                    </label>
                  </fieldset>
                );
              })}
              <button
                disabled={busy || state.conflicts.some((k) => !review.choices[k])}
                onClick={() =>
                  void run(async () => {
                    await engine.resolveConflicts(review.choices, review.snapshot);
                    setReview(null);
                  })
                }
              >
                {t('Confirm reviewed selections', '確認已覆核的選擇')}
              </button>
            </>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
