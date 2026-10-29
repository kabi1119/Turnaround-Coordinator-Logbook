import { useSyncExternalStore } from 'react';
import ArchiveControl from './ArchiveControl';
import RecoveryControl from './RecoveryControl';
import ConflictControl from './ConflictControl';
import HistoryControl from './HistoryControl';
import MixedRecoveryControl from '../migration/MixedRecoveryControl';
import './cloud.css';
import { useT } from '../i18n';
import type { AccountEngine } from './engine';
export default function AccountControls({
  engine,
  onLegacy,
  onMerge,
}: {
  engine: AccountEngine;
  onLegacy?: () => void;
  onMerge?: () => void;
}) {
  const t = useT(),
    status = useSyncExternalStore(engine.subscribe, engine.snapshot);
  const recoveringMixed = !!engine.state().mixed && engine.state().mixed!.stage !== 'complete';
  const labels = {
    pending: t('Saved locally / Pending Sync', '已存本機／尚待同步'),
    syncing: t('Syncing', '同步中'),
    synced: t('Synced', '已同步'),
    paused: t('Sync error · Local data retained', '同步錯誤 · 本機資料保留'),
    conflict: t('Conflict requires attention', '衝突需要處理'),
  };
  return (
    <section className="cloud-controls" aria-label={t('Cloud Account storage', '雲端帳戶儲存')}>
      <h3>{t('Account synchronization', '帳戶同步')}</h3>
      <p role="status">
        <strong>{labels[status.phase]}</strong> · {status.pending}{' '}
        {t('pending changes', '項尚待同步')}
      </p>
      {status.lastSuccess && (
        <p>
          {t('Last verified sync', '最近已驗證同步')}:{' '}
          {new Date(status.lastSuccess).toLocaleString()}
        </p>
      )}
      <p>
        {t(
          'Account data is server-readable and this browser keeps a plaintext offline cache. Sync is not an independent backup. Guest data is never uploaded without reviewed approval.',
          '帳戶資料可由伺服器讀取，此瀏覽器保留明文離線快取。同步不能代替獨立備份；訪客資料不會在未覆核批准下上傳。',
        )}
      </p>
      {status.error && (
        <p className="notice amber" role="alert">
          {t(
            'Synchronization is paused. Your local records and pending operation remain available. Reconnect or sign in again before retrying.',
            '同步已暫停。本機紀錄及待處理操作仍保留，請重新連線或登入後再試。',
          )}
        </p>
      )}
      {status.error === 'archived' && (
        <p className="notice amber">
          {t(
            'Server history was manually archived. This device is too old to replay changes safely. Keep a verified local JSON backup and request synchronization review; pending records have not been discarded.',
            '伺服器歷史已手動封存。此裝置的版本過舊，不能安全重送變更。請保留已驗證本機 JSON 備份並重新覆核同步；待同步紀錄並未捨棄。',
          )}
        </p>
      )}
      {!recoveringMixed && <RecoveryControl engine={engine} onMerge={onMerge} />}
      <MixedRecoveryControl engine={engine} onGuestReview={onMerge} />
      {!recoveringMixed && (
        <>
          <ConflictControl engine={engine} />
          <ArchiveControl engine={engine} />
          <HistoryControl engine={engine} />
        </>
      )}
      <div className="actions">
        <button disabled={!engine.canRun()} onClick={() => void engine.run()}>
          {t('Retry synchronization', '重試同步')}
        </button>
        {onMerge && <button onClick={onMerge}>{t('Merge Guest Data', '合併訪客資料')}</button>}
        {onLegacy && (
          <button onClick={onLegacy}>
            {t('Open legacy vault recovery', '開啟舊版資料庫復原')}
          </button>
        )}
      </div>
    </section>
  );
}
