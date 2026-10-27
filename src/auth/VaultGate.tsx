import { useEffect, useRef, useState } from 'react';
import type { AccountIdentity } from './client';
import { hasVault, openVault, vaultAvailable } from '../workspaces/vault';
import type { WorkspaceStore } from '../workspaces/store';
import { Field } from '../components/ui';
import { useT } from '../i18n';
export default function VaultGate({
  user,
  offline,
  onOpen,
  onGuest,
}: {
  user: AccountIdentity;
  offline: boolean;
  onOpen: (store: WorkspaceStore) => void | Promise<void>;
  onGuest: () => void;
}) {
  const t = useT(),
    [secret, setSecret] = useState(''),
    [confirm, setConfirm] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const alive = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  let exists = false,
    readable = true;
  try {
    exists = hasVault(user.id);
  } catch {
    readable = false;
  }
  const create = !exists;
  return (
    <div className="vault-gate">
      <h1 tabIndex={-1}>
        {create
          ? t('Create your local account vault', '建立本機帳戶資料庫')
          : t('Unlock your local account vault', '解鎖本機帳戶資料庫')}
      </h1>
      <p>
        {offline
          ? t(
              'Local unlock only · Server session not verified',
              '只解鎖本機資料 · 未驗證伺服器登入狀態',
            )
          : user.email}
      </p>
      <p>
        {t(
          'Your local account vault is encrypted with its passphrase. After unlocking, encrypted Cloud Sync can be explicitly enabled in Account Settings. Guest records are not imported.',
          '本機帳戶資料庫以密語加密。解鎖後可在帳戶設定明確啟用加密雲端同步；不會匯入訪客紀錄。',
        )}
      </p>
      <p className="notice amber">
        {t(
          'Signing in does not create a cloud copy. A lost vault/cloud passphrase cannot be reset to decrypt records. Keep a verified JSON backup; exported JSON is not encrypted.',
          '登入不會自動建立雲端副本。遺失本機／雲端密語後，不能藉重設密語解密紀錄。請保留已核對的 JSON 備份；匯出的 JSON 並未加密。',
        )}
      </p>
      {(!vaultAvailable() || !readable || (offline && create)) && (
        <p role="alert">
          {t(
            'Secure local storage is unavailable. Use HTTPS/localhost or return to Guest; no account data will be exposed.',
            '安全本機儲存無法使用。請使用 HTTPS／localhost 或返回訪客；不會顯示帳戶資料。',
          )}
        </p>
      )}
      <form
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending.current || !readable || !vaultAvailable() || (offline && create)) return;
          if (create && secret !== confirm) {
            setError(t('Passphrases must match.', '兩次密語必須相同。'));
            return;
          }
          pending.current = true;
          setBusy(true);
          setError('');
          try {
            const store = await openVault(user.id, secret, create);
            if (!alive.current) {
              store.lock();
              return;
            }
            setSecret('');
            setConfirm('');
            await onOpen(store);
          } catch {
            if (alive.current)
              setError(
                t(
                  'Could not unlock or create this vault. Check the passphrase and browser storage; existing records were not replaced.',
                  '未能解鎖或建立資料庫。請檢查密語與瀏覽器儲存空間；沒有取代現有紀錄。',
                ),
              );
          } finally {
            pending.current = false;
            if (alive.current) setBusy(false);
          }
        }}
      >
        <Field
          label={t('Local vault passphrase', '本機資料庫密語')}
          type="password"
          autoComplete={create ? 'new-password' : 'current-password'}
          minLength={12}
          maxLength={1024}
          required
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          disabled={busy}
        />
        <p className="muted">
          {t(
            'Use at least 12 characters; a long, unique passphrase is recommended.',
            '最少 12 個字元，建議使用長且獨有的密語。',
          )}
        </p>
        {create && (
          <Field
            label={t('Confirm vault passphrase', '確認本機密語')}
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
          />
        )}
        {error && <p role="alert">{error}</p>}
        <button
          className="primary"
          disabled={busy || !vaultAvailable() || !readable || (offline && create)}
        >
          {busy
            ? t('Unlocking…', '解鎖中…')
            : create
              ? t('Create encrypted vault', '建立加密資料庫')
              : t('Unlock vault', '解鎖資料庫')}
        </button>
      </form>
      <button type="button" onClick={onGuest}>
        {t('Continue as Guest', '以訪客身分繼續')}
      </button>
    </div>
  );
}
