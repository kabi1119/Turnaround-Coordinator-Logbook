import { useContext, useSyncExternalStore } from 'react';
import { SyncContext } from './context';
import { AccountCloudContext } from '../cloud/context';
import type { AccountStatus } from '../cloud/engine';
import type { SyncStatus } from './engine';
import { useWorkspaceStore } from '../workspaces/context';
import { useT } from '../i18n';
const noop = () => () => {};
const absent = () => null;
export function StorageLabel() {
  const cloud = useContext(AccountCloudContext);
  const legacy = useContext(SyncContext);
  const engine = cloud || legacy,
    store = useWorkspaceStore(),
    t = useT();
  const status = useSyncExternalStore<AccountStatus | SyncStatus | null>(
    engine?.subscribe || noop,
    engine?.snapshot || absent,
  );
  if (!status || status.phase === 'disabled')
    return (
      <>
        {store.sync?.read()?.enabled
          ? t('Sync paused', '同步暫停')
          : t('Device only', '僅限此裝置')}
      </>
    );
  const labels = {
    locked: t('Sync paused', '同步暫停'),
    syncing: t('Syncing', '同步中'),
    pending: t('Sync pending', '尚待同步'),
    synced: t('Synced', '已同步'),
    conflict: t('Sync conflict', '同步衝突'),
    paused: t('Sync paused', '同步暫停'),
  };
  return <>{labels[status.phase]}</>;
}
