import { useContext, type ReactNode } from 'react';
import { SessionVerificationContext } from './sessionContext';
import { Modal } from '../components/ui';
import { useT } from '../i18n';
import SyncControl from '../sync/SyncControl';
import AccountControls from '../cloud/AccountControls';
import type { AccountEngine } from '../cloud/engine';
import type { SyncEngine } from '../sync/engine';
import type { AccountIdentity } from './client';

export type AccountSettingsAccess = { onOpen: () => void; dialog: ReactNode };

/** One workspace-scoped dialog, outside the header/menu, shared by both entry points. */
export default function AccountSettings({
  user,
  engine,
  cloudEngine = null,
  onMerge,
  onLegacy,
  onClose,
  onSignOut,
  onRetrySession,
}: {
  user: AccountIdentity;
  engine: SyncEngine | null;
  cloudEngine?: AccountEngine | null;
  onMerge?: () => void;
  onLegacy?: () => void;
  onClose: () => void;
  onSignOut?: () => void;
  onRetrySession?: () => void;
}) {
  const t = useT();
  const verified = useContext(SessionVerificationContext);
  return (
    <Modal syncControl title={t('Account Settings', '帳戶設定')} onClose={onClose}>
      <p className="auth-email">
        {user.email || t('Server session not verified', '未驗證伺服器登入狀態')}
      </p>
      {!verified && onRetrySession && (
        <button onClick={onRetrySession}>{t('Retry account verification', '重試帳戶驗證')}</button>
      )}
      {cloudEngine ? (
        <AccountControls engine={cloudEngine} onLegacy={onLegacy} onMerge={onMerge} />
      ) : (
        <SyncControl engine={engine} />
      )}
      {!cloudEngine && (
        <p>
          {t(
            'Sign out locks the vault without deleting it. Keep a verified JSON backup; losing the vault passphrase can make local records unrecoverable.',
            '登出會鎖定資料庫而不刪除紀錄。請保留已核對的 JSON 備份；遺失密語可能令本機紀錄無法復原。',
          )}
        </p>
      )}
      {onSignOut && <button onClick={onSignOut}>{t('Sign Out', '登出')}</button>}
    </Modal>
  );
}
