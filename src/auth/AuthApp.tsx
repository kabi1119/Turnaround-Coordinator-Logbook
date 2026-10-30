import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import App from '../App';
import { LanguageContext } from '../i18n';
import { Modal } from '../components/ui';
import OfflineSetup from '../pwa/OfflineSetup';
import SignIn from './SignIn';
import VaultGate from './VaultGate';
import AccountControl from './AccountControl';
import AccountSettings from './AccountSettings';
import GuestDataWarning from './GuestDataWarning';
import AccountEntry from '../cloud/AccountEntry';
import { cloudAccountsEnabled } from '../cloud/config';
import { AccountCloudContext } from '../cloud/context';
import { accountCacheKey } from '../cloud/cache';
import type { AccountEngine } from '../cloud/engine';
import {
  authClient,
  AUTH_STORAGE_KEY,
  LAST_ACCOUNT_KEY,
  cancelAuthRequests,
  cancelPendingSignIn,
  authenticationReady,
  resumeAuthRequests,
  signOutLocal,
  consumeInvitation,
  ensureProfile,
  verifiedIdentity,
} from './client';
import { rejectedSession, SessionRejected, verifiedSession } from './session';
import { SessionVerificationContext } from './sessionContext';
import type { AccountIdentity } from './client';
import { CHOICE_KEY, chooseGuest, guestReturning, guestStore } from '../workspaces/store';
import type { WorkspaceStore } from '../workspaces/store';
import { SyncContext } from '../sync/context';
import { SyncEngine } from '../sync/engine';
import { transport } from '../sync/transport';
import { hasVault } from '../workspaces/vault';
import { readOnlyVault } from '../migration/recovery';
import GuestMergeWizard from '../migration/GuestMergeWizard';
import { readDatabase, STORAGE_KEY } from '../lib/storage';

type Target = { user: AccountIdentity; offline: boolean; turn: number };
export default function AuthApp({
  provider,
  cloudMode,
}: {
  provider?: SupabaseClient | null;
  cloudMode?: boolean;
}) {
  const [newMode] = useState(() => cloudMode ?? cloudAccountsEnabled(import.meta.env));
  const [cloudEngine, setCloudEngine] = useState<AccountEngine | null>(null);
  useEffect(() => cloudEngine?.attach(), [cloudEngine]);
  const [legacyRecovery, setLegacyRecovery] = useState(false);
  const [client] = useState(() => (provider === undefined ? authClient() : provider));
  const [stage, setStage] = useState<'loading' | 'welcome' | 'vault' | 'cloud' | 'workspace'>(
    'loading',
  );
  const [store, setStore] = useState<WorkspaceStore | null>(null),
    [target, setTarget] = useState<Target | null>(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [guestMergeOpen, setGuestMergeOpen] = useState(false);
  const [login, setLogin] = useState(false),
    [notice, setNotice] = useState('');
  const [language, setLanguage] = useState<'en' | 'zh-HK'>(() =>
    navigator.language.startsWith('zh') ? 'zh-HK' : 'en',
  );
  const [expires, setExpires] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const verification = useRef<Promise<void> | null>(null);
  const recheck = useRef<() => Promise<void>>(async () => {});
  const [syncEngine, setSyncEngine] = useState<SyncEngine | null>(null);
  useEffect(() => syncEngine?.attach(), [syncEngine]);
  const active = useRef<WorkspaceStore | null>(null),
    generation = useRef(0),
    mounted = useRef(true);
  const pendingIdentity = useRef<string | null>(null);
  const activeMode = useRef<'verified' | 'offline' | 'guest' | null>(null);
  const t = (en: string, zh: string) => (language === 'zh-HK' ? zh : en);
  function lock() {
    verification.current = null;
    pendingIdentity.current = null;
    setAccountSettingsOpen(false);
    setGuestMergeOpen(false);
    active.current?.lock();
    active.current = null;
    activeMode.current = null;
    setStore(null);
    setSyncEngine(null);
    setCloudEngine(null);
  }
  function guest() {
    generation.current++;
    cancelPendingSignIn();
    lock();
    setTarget(null);
    setExpires(0);
    setLogin(false);
    setRestoring(false);
    setRestoreFailed(false);
    setNotice('');
    chooseGuest();
    setStore(guestStore);
    active.current = guestStore;
    activeMode.current = 'guest';
    setStage('workspace');
  }
  function signOut() {
    generation.current++;
    cancelAuthRequests();
    lock();
    setTarget(null);
    setExpires(0);
    setLogin(false);
    setRestoring(false);
    setRestoreFailed(false);
    setNotice('');
    chooseGuest();
    setStage('welcome');
    client?.auth.stopAutoRefresh();
    if (client)
      void signOutLocal(client).catch(() => {
        if (mounted.current)
          setNotice(
            t(
              'Signed out locally. Server sign-out could not be confirmed; saved records remain on this device.',
              '已在本機登出，未能確認伺服器登出；已儲存紀錄仍保留在此裝置。',
            ),
          );
      });
  }
  function localUnlock(userId: string) {
    generation.current++;
    cancelPendingSignIn();
    lock();
    setLogin(false);
    setExpires(0);
    setLegacyRecovery(newMode);
    if (newMode)
      setNotice(
        t(
          'Read-only Legacy recovery. Sign in online for reviewed Cloud Account conversion; original encrypted data is retained.',
          '舊版唯讀復原。請連線登入以覆核雲端帳戶轉換；原有加密資料保留。',
        ),
      );
    setTarget({ user: { id: userId, email: '' }, offline: true, turn: generation.current });
    setStage('vault');
  }
  async function authenticate(email?: string) {
    if (!client || !navigator.onLine) throw new Error('Authentication unavailable');
    const turn = ++generation.current;
    const checked = await verifiedSession(client);
    const user = checked.user;
    if (email && user.email.toLowerCase() !== email.toLowerCase())
      throw new SessionRejected('Identity mismatch');
    if (turn !== generation.current || !mounted.current) throw new Error('Cancelled');
    pendingIdentity.current = user.id;
    await ensureProfile(client, user.id);
    if (turn !== generation.current || !mounted.current) throw new Error('Cancelled');
    lock();
    setLogin(false);
    setNotice('');
    setExpires(checked.expires);
    setRestoreFailed(false);
    setRestoring(false);
    pendingIdentity.current = user.id;
    setTarget({ user, offline: false, turn });
    setLegacyRecovery(false);
    setStage(newMode ? 'cloud' : 'vault');
    try {
      localStorage.setItem(CHOICE_KEY, `account:${user.id}`);
      localStorage.setItem(LAST_ACCOUNT_KEY, user.id);
    } catch {
      /* Session identity is still verified before opening the workspace. */
    }
    client.auth.startAutoRefresh();
  }
  function invalidate() {
    generation.current++;
    lock();
    setTarget(null);
    setLogin(false);
    setExpires(0);
    setRestoring(false);
    setRestoreFailed(false);
    setStage('welcome');
  }
  async function returnAccount() {
    if (!client) {
      setLogin(true);
      return;
    }
    let turn = ++generation.current;
    setRestoring(true);
    setRestoreFailed(false);
    try {
      await authenticationReady();
      if (turn !== generation.current || !mounted.current) return;
      resumeAuthRequests();
      const { data, error } = await client.auth.getSession();
      if (turn !== generation.current || !mounted.current) return;
      if (error) throw error;
      if (!data.session) {
        setLogin(true);
        return;
      }
      const pending = authenticate();
      turn = generation.current;
      await pending;
    } catch (error) {
      if (turn !== generation.current || !mounted.current) return;
      setRestoreFailed(!rejectedSession(error));
      setLogin(true);
      setNotice(
        t(
          'Account verification is required before synchronization. Saved work is retained.',
          '同步前須驗證帳戶；已儲存資料保持不變。',
        ),
      );
    } finally {
      if (turn === generation.current && mounted.current) setRestoring(false);
    }
  }
  async function verifyCurrent() {
    const current = active.current;
    const expected =
      current?.kind === 'account' ? current.key.split(':').at(-1) : pendingIdentity.current;
    if (
      !expected &&
      activeMode.current !== 'guest' &&
      restoreFailed &&
      stage === 'welcome' &&
      navigator.onLine
    ) {
      await returnAccount();
      return;
    }
    if (
      !client ||
      !expected ||
      (activeMode.current === 'offline' && current?.storageModel !== 'cloud-v2')
    )
      return;
    if (verification.current) return verification.current;
    const turn = generation.current;
    const task = (async () => {
      try {
        if (!navigator.onLine) throw new TypeError('Offline');
        const checked = await verifiedSession(client, expected);
        if (!mounted.current || turn !== generation.current) return;
        setExpires(checked.expires);
        setTarget((previous) =>
          previous && previous.user.id === checked.user.id
            ? { ...previous, user: checked.user, offline: false }
            : previous,
        );
        activeMode.current = 'verified';
        setNotice('');
        void cloudEngine?.run();
      } catch (error) {
        if (!mounted.current || turn !== generation.current) return;
        if (rejectedSession(error)) {
          invalidate();
          return;
        }
        setExpires(0);
        activeMode.current = 'offline';
        setTarget((previous) => (previous ? { ...previous, offline: true } : previous));
        setNotice(
          t(
            'Account session not verified · Offline / Pending Sync. Local changes are retained; reconnect or retry verification.',
            '尚未驗證帳戶登入 · 離線／尚待同步。本機修改保留；請重新連線或重試驗證。',
          ),
        );
      }
    })();
    verification.current = task;
    try {
      await task;
    } finally {
      if (verification.current === task) verification.current = null;
    }
  }
  useEffect(() => {
    recheck.current = verifyCurrent;
  });
  useEffect(() => {
    mounted.current = true;
    let stopped = false;
    const cancelPending = () => {
      generation.current++;
    };
    let bootTurn = ++generation.current;
    const boot = async () => {
      let invitation: string | null = null;
      try {
        invitation = consumeInvitation(window.location, window.history);
        const returning = guestReturning();
        const choice = localStorage.getItem(CHOICE_KEY);
        if (!invitation && returning && !choice?.startsWith('account:')) {
          chooseGuest();
          active.current = guestStore;
          activeMode.current = 'guest';
          setStore(guestStore);
          setStage('workspace');
          return;
        }
        if (client && navigator.onLine) {
          await authenticationReady();
          if (stopped || bootTurn !== generation.current) return;
          resumeAuthRequests();
          if (invitation) {
            resumeAuthRequests();
            const { error } = await client.auth.verifyOtp({
              token_hash: invitation,
              type: 'invite',
            });
            if (error) throw error;
            if (stopped || bootTurn !== generation.current) return;
          }
          const { data, error } = await client.auth.getSession();
          if (error) throw error;
          if (stopped || bootTurn !== generation.current) return;
          if (!stopped && data.session) {
            const signingIn = authenticate();
            bootTurn = generation.current;
            await signingIn;
            return;
          }
        }
      } catch (error) {
        if (!stopped && bootTurn === generation.current) setRestoreFailed(!rejectedSession(error));
        if (!stopped && bootTurn === generation.current)
          setNotice(
            t(
              'Sign-in could not be restored or the invitation could not be verified. Your saved workspaces have not been deleted.',
              '未能恢復登入或驗證邀請，已儲存的工作區並未刪除。',
            ),
          );
      }
      if (!stopped && bootTurn === generation.current) setStage('welcome');
    };
    void boot();
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      // Explicit local Legacy recovery is not an authenticated cloud workspace.
      if (
        activeMode.current === 'offline' &&
        active.current?.kind === 'account' &&
        active.current.storageModel !== 'cloud-v2'
      )
        return;
      const expectedId =
        active.current?.kind === 'account'
          ? active.current.key.split(':').at(-1)
          : pendingIdentity.current;
      if (!expectedId) return;
      if (
        (event === 'SIGNED_OUT' &&
          !(activeMode.current === 'offline' && active.current?.storageModel !== 'cloud-v2')) ||
        (['SIGNED_IN', 'TOKEN_REFRESHED'].includes(event) && session?.user.id !== expectedId)
      ) {
        invalidate();
        return;
      }
      if (['TOKEN_REFRESHED', 'SIGNED_IN'].includes(event)) {
        // Keep provider calls outside the auth notification callback.
        setTimeout(() => {
          if (mounted.current) void recheck.current();
        }, 0);
      }
    });
    const changed = (event: StorageEvent) => {
      if (
        activeMode.current === 'offline' &&
        active.current?.kind === 'account' &&
        active.current.storageModel !== 'cloud-v2'
      )
        return;
      if (
        active.current?.kind === 'account' &&
        (event.key === AUTH_STORAGE_KEY || event.key === null)
      ) {
        if (!event.newValue) {
          invalidate();
          return;
        }
        try {
          const rotated = JSON.parse(event.newValue);
          const expected = active.current.key.split(':').at(-1);
          if (rotated.user?.id !== expected) {
            invalidate();
            return;
          }
        } catch {
          invalidate();
          return;
        }
        void recheck.current();
      }
    };
    const wake = () => {
      if (document.visibilityState !== 'hidden') void recheck.current();
    };
    window.addEventListener('storage', changed);
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      mounted.current = false;
      cancelPending();
      active.current?.lock();
      active.current = null;
      subscription?.data.subscription.unsubscribe();
      window.removeEventListener('storage', changed);
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
      document.removeEventListener('visibilitychange', wake);
    };
    // Initial provider/ownership resolution runs once; later actions use the current render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);
  useEffect(() => {
    if (!['workspace', 'cloud', 'vault'].includes(stage) || !target || target.offline || !expires)
      return;
    const check = () => {
      void recheck.current();
    };
    const timer = window.setTimeout(
      check,
      Math.max(1000, Math.min(2_147_000_000, expires - Date.now() + 20)),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [stage, target, expires]);
  useEffect(() => {
    if (stage !== 'workspace') document.querySelector<HTMLElement>('.auth-card h1')?.focus();
  }, [stage]);
  let cachedId = '';
  try {
    const choice = localStorage.getItem(CHOICE_KEY);
    const id = localStorage.getItem(LAST_ACCOUNT_KEY);
    if (newMode && id && choice === 'account:' + id && localStorage.getItem(accountCacheKey(id)))
      cachedId = id;
  } catch {
    /* Corrupt/unavailable caches never reset. */
  }
  let savedId = '';
  try {
    const id = localStorage.getItem(LAST_ACCOUNT_KEY);
    if (id && hasVault(id)) savedId = id;
  } catch {
    /* Damaged/unavailable storage never opens a vault. */
  }
  return (
    <SessionVerificationContext.Provider value={!target?.offline}>
      <LanguageContext.Provider value={language}>
        {stage === 'workspace' && store ? (
          <>
            <SyncContext.Provider value={syncEngine}>
              <AccountCloudContext.Provider value={cloudEngine}>
                <App
                  key={store.key}
                  workspace={store}
                  workspaceNotice={
                    restoring ? t('Restoring your account…', '正在恢復帳戶…') : notice
                  }
                  accountSettings={
                    target && store.kind === 'account'
                      ? {
                          onOpen: () => setAccountSettingsOpen(true),
                          dialog: accountSettingsOpen && (
                            <AccountSettings
                              user={target.user}
                              engine={syncEngine}
                              cloudEngine={cloudEngine}
                              onMerge={
                                cloudEngine
                                  ? () => {
                                      setAccountSettingsOpen(false);
                                      setGuestMergeOpen(true);
                                    }
                                  : undefined
                              }
                              onLegacy={
                                cloudEngine && target && hasVault(target.user.id)
                                  ? () => {
                                      generation.current++;
                                      lock();
                                      setLegacyRecovery(true);
                                      setStage('vault');
                                      setNotice(
                                        t(
                                          'Legacy recovery view. Cloud uploads are paused; original encrypted data is retained.',
                                          '舊版復原檢視：雲端上傳已暫停，原有加密資料保留。',
                                        ),
                                      );
                                    }
                                  : undefined
                              }
                              onClose={() => setAccountSettingsOpen(false)}
                              onSignOut={signOut}
                              onRetrySession={() => void recheck.current()}
                            />
                          ),
                        }
                      : undefined
                  }
                  accountControl={
                    <AccountControl
                      onSettings={() => setAccountSettingsOpen(true)}
                      user={target?.user || null}
                      offline={target?.offline || false}
                      cloudAccount={Boolean(cloudEngine)}
                      onLeave={guest}
                      onSignOut={signOut}
                      onSignIn={(lang) => {
                        setLanguage(lang);
                        void returnAccount();
                      }}
                    />
                  }
                />
                {cloudEngine && guestMergeOpen && (
                  <GuestMergeWizard engine={cloudEngine} onClose={() => setGuestMergeOpen(false)} />
                )}
              </AccountCloudContext.Provider>
            </SyncContext.Provider>
            {login && (
              <Modal
                title={t('Sign in to TCO Logbook', '登入 TCO Logbook')}
                onClose={() => {
                  generation.current++;
                  cancelPendingSignIn();
                  setRestoring(false);
                  setRestoreFailed(false);
                  setLogin(false);
                }}
              >
                {restoreFailed ? (
                  <button onClick={() => void returnAccount()}>
                    {t('Retry account verification', '重試帳戶驗證')}
                  </button>
                ) : (
                  <SignIn
                    client={client}
                    onVerified={authenticate}
                    onGuest={guest}
                    cloudAccountMode={newMode}
                  />
                )}
                {savedId && (
                  <button onClick={() => localUnlock(savedId)}>
                    {newMode
                      ? t(
                          'Recover encrypted Legacy Vault (read-only)',
                          '復原舊版加密資料庫（唯讀）',
                        )
                      : t('Unlock saved local vault', '解鎖已儲存的本機資料庫')}
                  </button>
                )}
              </Modal>
            )}
          </>
        ) : (
          <main className="auth-page">
            <div className="auth-card surface-dark">
              <div className="auth-brand">
                <img src="/airplane.svg?v=0.6.1" width="64" height="64" alt="" />
                <span>
                  TCO Logbook<small>v0.9.4 · {t('Device only', '僅限本機')}</small>
                </span>
              </div>
              <div className="auth-languages">
                <button onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>
                  English
                </button>
                <button onClick={() => setLanguage('zh-HK')} aria-pressed={language === 'zh-HK'}>
                  繁體中文
                </button>
              </div>
              <OfflineSetup />
              {notice && (
                <p className="notice amber" role="alert">
                  {notice}
                </p>
              )}
              {stage === 'cloud' && target && client ? (
                <AccountEntry
                  key={target.user.id + ':' + target.turn}
                  user={target.user}
                  client={client}
                  offline={target.offline}
                  active={() => mounted.current && generation.current === target.turn}
                  onInvalid={invalidate}
                  onRetry={() => void returnAccount()}
                  onGuest={guest}
                  onLegacy={() => {
                    setLegacyRecovery(true);
                    setStage('vault');
                  }}
                  onOpen={(next, engine) => {
                    active.current = next;
                    activeMode.current = target.offline ? 'offline' : 'verified';
                    setStore(next);
                    setCloudEngine(engine);
                    try {
                      const raw = localStorage.getItem(STORAGE_KEY);
                      if (raw) {
                        const guestData = readDatabase();
                        if (
                          !guestData.error &&
                          guestData.snapshot === raw &&
                          (guestData.db.aircraft.length ||
                            guestData.db.duties.length ||
                            guestData.db.journals.length) &&
                          !engine.state().merge
                        )
                          setGuestMergeOpen(true);
                      }
                    } catch {
                      /* Damaged Guest data is retained without transfer. */
                    }
                    setLanguage(next.read().db.settings.language);
                    setStage('workspace');
                  }}
                />
              ) : stage === 'vault' && target ? (
                <VaultGate
                  key={target.user.id}
                  user={target.user}
                  offline={target.offline}
                  recovery={legacyRecovery}
                  onGuest={guest}
                  onOpen={async (opened) => {
                    const next = legacyRecovery ? readOnlyVault(opened, target.user.id) : opened;
                    const turn = generation.current;
                    try {
                      if (!target.offline) {
                        if (!client || !navigator.onLine)
                          throw new Error('Reconnect or use local unlock');
                        const checked = await verifiedIdentity(client);
                        const { data, error } = await client.auth.getSession();
                        if (
                          error ||
                          checked.id !== target.user.id ||
                          data.session?.user.id !== checked.id ||
                          !data.session?.expires_at ||
                          data.session.expires_at * 1000 <= Date.now()
                        )
                          throw new Error('Session expired');
                        setExpires(data.session.expires_at * 1000);
                      }
                      if (turn !== generation.current || !mounted.current) {
                        next.lock();
                        return;
                      }
                      if (client && !target.offline && !legacyRecovery)
                        setSyncEngine(
                          new SyncEngine(
                            next,
                            target.user.id,
                            transport(client, target.user.id),
                            undefined,
                            invalidate,
                          ),
                        );
                      active.current = next;
                      activeMode.current = target.offline ? 'offline' : 'verified';
                      setStore(next);
                      setLanguage(next.read().db.settings.language);
                      try {
                        localStorage.setItem(CHOICE_KEY, `account:${target.user.id}`);
                      } catch {
                        /* No plaintext fallback. */
                      }
                      setStage('workspace');
                    } catch (error) {
                      next.lock();
                      throw error;
                    }
                  }}
                />
              ) : stage === 'loading' ? (
                <>
                  <p role="status">{t('Opening your workspace…', '正在開啟工作區…')}</p>
                  <button onClick={guest}>{t('Continue as Guest', '以訪客身分繼續')}</button>
                  <GuestDataWarning />
                </>
              ) : (
                <>
                  <h1 tabIndex={-1}>{t('Welcome to TCO Logbook', '歡迎使用 TCO Logbook')}</h1>
                  <p>
                    {t('Your personal aircraft turnaround logbook.', '你的個人航機周轉紀錄簿。')}
                  </p>
                  {restoreFailed ? (
                    <>
                      <p role="status">
                        {t(
                          'Session restoration is paused. Saved data is retained; reconnect to verify your account.',
                          '登入恢復已暫停。已儲存資料保留；請重新連線以驗證帳戶。',
                        )}
                      </p>
                      <button onClick={() => void returnAccount()}>
                        {t('Retry account verification', '重試帳戶驗證')}
                      </button>
                      <button onClick={guest}>{t('Continue as Guest', '以訪客身分繼續')}</button>
                    </>
                  ) : (
                    <SignIn
                      client={client}
                      onVerified={authenticate}
                      onGuest={guest}
                      cloudAccountMode={newMode}
                    />
                  )}
                  {cachedId && client && (
                    <div className="offline-vault-option">
                      <button
                        onClick={() => {
                          generation.current++;
                          lock();
                          resumeAuthRequests();
                          setTarget({
                            user: { id: cachedId, email: '' },
                            offline: true,
                            turn: generation.current,
                          });
                          setExpires(0);
                          setStage('cloud');
                          setNotice(
                            t(
                              'Offline account cache · Server session not verified. Reauthentication may be required before uploads.',
                              '離線帳戶快取 · 未驗證伺服器登入；上傳前可能須重新登入。',
                            ),
                          );
                        }}
                      >
                        {t('Continue saved Account offline', '離線開啟已存帳戶')}
                      </button>
                    </div>
                  )}
                  {savedId && (
                    <div className="offline-vault-option">
                      <button onClick={() => localUnlock(savedId)}>
                        {newMode
                          ? t(
                              'Recover encrypted Legacy Vault (read-only)',
                              '復原舊版加密資料庫（唯讀）',
                            )
                          : t('Unlock saved local vault', '解鎖已儲存的本機資料庫')}
                      </button>
                      <p>
                        {t(
                          'Passphrase required. This does not authenticate with the server or sync records.',
                          '需要本機密語。此操作不代表已向伺服器登入，亦不會同步紀錄。',
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>
        )}
      </LanguageContext.Provider>
    </SessionVerificationContext.Provider>
  );
}
