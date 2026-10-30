import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountIdentity } from '../auth/client';
import { hasVault, emptyAccountDatabase } from '../workspaces/vault';
import { accountCacheKey, openAccountCache, validatePayload, type AccountStore } from './cache';
import { accountTransport } from './transport';
import { AccountEngine, stateFromPull, validatePull } from './engine';
import { AccountError, type AccountPull, type AccountTransport } from './types';
import { records, same } from '../sync/records';
import { uuidV4 } from '../lib/uuid';
import { useT } from '../i18n';
import LegacyConversion from '../migration/LegacyConversion';
import { conversionKey, validateConversion } from '../migration/conversion';
const operationKey = (uid: string) => 'tco-cloud-onboarding-v1:' + uid;
export default function AccountEntry({
  user,
  client,
  offline = false,
  active,
  onOpen,
  onLegacy,
  onGuest,
  onInvalid,
  onRetry,
}: {
  user: AccountIdentity;
  client: SupabaseClient;
  offline?: boolean;
  active: () => boolean;
  onOpen: (store: AccountStore, engine: AccountEngine) => void;
  onLegacy: () => void;
  onGuest: () => void;
  onInvalid: () => void;
  onRetry?: () => void;
}) {
  const t = useT(),
    mounted = useRef(true),
    entryTurn = useRef(0),
    controller = useRef(new AbortController()),
    remote = useRef<AccountTransport | null>(null);
  const [info, setInfo] = useState<AccountPull | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [consent, setConsent] = useState(false);
  const [converting, setConverting] = useState(false);
  const valid = () => mounted.current && active() && !controller.current.signal.aborted;
  async function enter(p: AccountPull, turn = entryTurn.current) {
    validatePull(p, user.id, 0);
    if (!p.workspaceId || p.conversionState !== 'active') throw new AccountError('legacy');
    const store = await openAccountCache(user.id, p.workspaceId, stateFromPull(p, user.id), () =>
      active() ? user.id : null,
    );
    if (!valid() || turn !== entryTurn.current) {
      store.lock();
      return;
    }
    const engine = new AccountEngine(store, remote.current!, undefined, onInvalid);
    onOpen(store, engine);
  }
  useEffect(() => {
    mounted.current = true;
    const attemptController = new AbortController();
    controller.current = attemptController;
    const turn = ++entryTurn.current;
    const alive = () => valid() && turn === entryTurn.current;
    const transport = accountTransport(client, user.id, active);
    remote.current = transport;
    async function boot() {
      try {
        if (offline) {
          const savedConversion = localStorage.getItem(conversionKey(user.id));
          if (
            savedConversion &&
            (await validateConversion(JSON.parse(savedConversion), user.id)).phase !== 'verified'
          )
            throw new AccountError('local');
          const raw = localStorage.getItem(accountCacheKey(user.id));
          if (!raw) throw new AccountError('local');
          const parsed = JSON.parse(raw),
            cached = await validatePayload(parsed, user.id, parsed.workspaceId);
          const store = await openAccountCache(
            user.id,
            cached.workspaceId,
            { db: cached.db, state: cached.state },
            () => (active() ? user.id : null),
          );
          if (!alive()) {
            store.lock();
            return;
          }
          onOpen(store, new AccountEngine(store, transport, undefined, onInvalid));
          return;
        }
        const p = await transport.pull(0, controller.current.signal);
        if (!alive()) return;
        validatePull(p, user.id, 0);
        if (
          !p.features?.includes('legacy-manifest-v1') ||
          !p.features?.includes('manual-archive-v1')
        )
          throw new AccountError('setup');
        const saved = localStorage.getItem(conversionKey(user.id));
        const conversion = saved ? await validateConversion(JSON.parse(saved), user.id) : null;
        if (!alive()) return;
        if (conversion && conversion.phase !== 'verified') {
          setInfo(p);
          setConverting(true);
          return;
        }
        if (p.workspaceId && p.conversionState === 'active') {
          await enter(p, turn);
          return;
        }
        setInfo(p);
      } catch (e) {
        if (alive()) setError(e instanceof AccountError ? e.code : 'invalid');
      } finally {
        if (alive()) setBusy(false);
      }
    }
    void boot();
    return () => {
      mounted.current = false;
      entryTurn.current = turn + 1;
      attemptController.abort();
    };
    // A fresh entry is keyed by account and auth generation by the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function initialize() {
    if (!consent || busy || !info || info.established || hasVault(user.id)) return;
    setBusy(true);
    setError('');
    try {
      // Stable, durable onboarding operation before the first remote write.
      const key = operationKey(user.id),
        raw = localStorage.getItem(key);
      const progress = raw
        ? JSON.parse(raw)
        : { version: 1, userId: user.id, operationId: uuidV4(), db: emptyAccountDatabase() };
      if (
        progress.version !== 1 ||
        progress.userId !== user.id ||
        !same(progress.db, emptyAccountDatabase())
      )
        throw new AccountError('local');
      localStorage.setItem(key, JSON.stringify(progress));
      const receipt = await remote.current!.initialize(
        progress.operationId,
        records(progress.db),
        null,
        controller.current.signal,
      );
      if (!valid()) return;
      const p = await remote.current!.pull(0, controller.current.signal);
      const verified = stateFromPull(p, user.id);
      if (
        receipt.operationId !== progress.operationId ||
        receipt.workspaceId !== p.workspaceId ||
        !same(verified.db, progress.db)
      )
        throw new AccountError('invalid');
      await enter(p);
    } catch (e) {
      if (valid()) setError(e instanceof AccountError ? e.code : 'invalid');
    } finally {
      if (valid()) setBusy(false);
    }
  }
  const legacy = !!info && (info.established || hasVault(user.id));
  if (converting)
    return (
      <LegacyConversion
        userId={user.id}
        client={client}
        active={valid}
        onComplete={enter}
        onClose={() => setConverting(false)}
      />
    );
  return (
    <section className="account-entry">
      <h1 tabIndex={-1}>
        {legacy
          ? t('Your encrypted legacy workspace', '你的舊版加密工作區')
          : t('Your Cloud Account', '你的雲端帳戶')}
      </h1>
      {busy && <p role="status">{t('Opening your account…', '正在開啟帳戶…')}</p>}
      {error && (
        <p role="alert" className="notice amber">
          {error === 'setup'
            ? t(
                'The new account backend is not installed. No empty replacement was created.',
                '新帳戶後端尚未安裝，未建立空白替代工作區。',
              )
            : t(
                'The account could not be opened safely. Saved data has not been deleted. Reconnect and retry account verification.',
                '未能安全開啟帳戶；已儲存資料並未刪除。請重新連線並重試帳戶驗證。',
              )}
        </p>
      )}
      {!busy && legacy ? (
        <>
          <p>
            {t(
              'Encrypted account data was detected, even if it contains no flights. It will not be silently converted.',
              '已偵測舊版加密帳戶，即使沒有航班也不會自動轉換。',
            )}
          </p>
          <button onClick={onLegacy}>
            {t('Open original local vault for recovery', '開啟原有本機資料庫復原')}
          </button>
          {!offline && (
            <button onClick={() => setConverting(true)}>
              {t('Review and convert Legacy Vault', '覆核及轉換舊版資料庫')}
            </button>
          )}
          <p className="muted">
            {t(
              'Original vaults and cloud ciphertext remain available for recovery.',
              '原有資料庫及雲端密文仍可復原。',
            )}
          </p>
        </>
      ) : !busy && info && !info.workspaceId ? (
        <>
          <p>
            {t(
              'Account records will synchronize automatically after setup. Supabase stores server-readable data protected by account access controls; this is not end-to-end encryption. This device also keeps a plaintext offline cache.',
              '設定後帳戶紀錄會自動同步。Supabase 儲存受帳戶權限保護、伺服器可讀的資料，並非端對端加密；此裝置亦會保留明文離線快取。',
            )}
          </p>
          <p>
            {t(
              'Only store information you are permitted to upload. Guest records stay separate unless you approve a reviewed transfer. Keep independent backups.',
              '只儲存獲准上傳的資料。訪客紀錄保持獨立，除非你批准已覆核的轉移；請另存獨立備份。',
            )}
          </p>
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {t(
              'I understand and accept this account storage model.',
              '我了解並接受此帳戶儲存模式。',
            )}
          </label>
          <button className="primary" disabled={!consent || busy} onClick={() => void initialize()}>
            {t('Create Cloud Account Workspace', '建立雲端帳戶工作區')}
          </button>
        </>
      ) : null}
      <div className="actions">
        <button onClick={onGuest}>{t('Continue as Guest', '以訪客身分繼續')}</button>
        {error && onRetry && (
          <button onClick={onRetry}>{t('Retry account verification', '重試帳戶驗證')}</button>
        )}
        {error && hasVault(user.id) && (
          <button onClick={onLegacy}>{t('Open legacy recovery', '開啟舊版復原')}</button>
        )}
      </div>
    </section>
  );
}
