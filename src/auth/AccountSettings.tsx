import type { ReactNode } from 'react';
import { Modal } from '../components/ui';
import { useT } from '../i18n';
import SyncControl from '../sync/SyncControl';
import type { SyncEngine } from '../sync/engine';
import type { AccountIdentity } from './client';

export type AccountSettingsAccess = { onOpen: () => void; dialog: ReactNode };

/** One workspace-scoped dialog, outside the header/menu, shared by both entry points. */
export default function AccountSettings({
  user,
  engine,
  onClose,
}: {
  user: AccountIdentity;
  engine: SyncEngine | null;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Modal syncControl title={t('Account Settings', '帳戶設定')} onClose={onClose}>
      <p className="auth-email">
        {user.email || t('Server session not verified', '未驗證伺服器登入狀態')}
      </p>
      <SyncControl engine={engine} />
      <p>
        {t(
          'Sign out locks the vault without deleting it. Keep a verified JSON backup; losing the vault passphrase can make local records unrecoverable.',
          '登出會鎖定資料庫而不刪除紀錄。請保留已核對的 JSON 備份；遺失密語可能令本機紀錄無法復原。',
        )}
      </p>
    </Modal>
  );
}
