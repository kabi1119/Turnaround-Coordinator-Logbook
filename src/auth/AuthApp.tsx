import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import App from '../App';
import { LanguageContext } from '../i18n';
import { Modal } from '../components/ui';
import OfflineSetup from '../pwa/OfflineSetup';
import SignIn from './SignIn';
import VaultGate from './VaultGate';
import AccountControl from './AccountControl';
import {
  authClient,
  AUTH_STORAGE_KEY,
  LAST_ACCOUNT_KEY,
  cancelAuthRequests,
  resumeAuthRequests,
  signOutLocal,
  consumeInvitation,
  ensureProfile,
  verifiedIdentity,
} from './client';
import type { AccountIdentity } from './client';
import { CHOICE_KEY, chooseGuest, guestReturning, guestStore } from '../workspaces/store';
import type { WorkspaceStore } from '../workspaces/store';
import { SyncContext } from '../sync/context';
import { SyncEngine } from '../sync/engine';
import { transport } from '../sync/transport';
import { hasVault } from '../workspaces/vault';

type Target = { user: AccountIdentity; offline: boolean };
export default function AuthApp({ provider }: { provider?: SupabaseClient | null }) {
  const [client] = useState(() => (provider === undefined ? authClient() : provider));
  const [stage, setStage] = useState<'loading' | 'welcome' | 'vault' | 'workspace'>('loading');
  const [store, setStore] = useState<WorkspaceStore | null>(null),
    [target, setTarget] = useState<Target | null>(null);
  const [login, setLogin] = useState(false),
    [notice, setNotice] = useState('');
  const [language, setLanguage] = useState<'en' | 'zh-HK'>(() =>
    navigator.language.startsWith('zh') ? 'zh-HK' : 'en',
  );
  const [expires, setExpires] = useState(0);
  const [syncEngine, setSyncEngine] = useState<SyncEngine | null>(null);
  useEffect(() => syncEngine?.attach(), [syncEngine]);
  const active = useRef<WorkspaceStore | null>(null),
    generation = useRef(0),
    mounted = useRef(true);
  const activeMode = useRef<'verified' | 'offline' | 'guest' | null>(null);
  const t = (en: string, zh: string) => (language === 'zh-HK' ? zh : en);
  function lock() {
    active.current?.lock();
    active.current = null;
    activeMode.current = null;
    setStore(null);
    setSyncEngine(null);
  }
  function guest() {
    generation.current++;
    cancelAuthRequests();
    lock();
    setTarget(null);
    setExpires(0);
    setLogin(false);
    chooseGuest();
    setStore(guestStore);
    active.current = guestStore;
    activeMode.current = 'guest';
    setStage('workspace');
    client?.auth.stopAutoRefresh();
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      /* Do not expose account records. */
    }
    if (client)
      void signOutLocal(client).catch(() => {
        if (mounted.current)
          setNotice(
            t(
              'The vault is locked locally. Server sign-out could not be confirmed; reconnect to finish signing out.',
              '本機資料庫已鎖定，但未能確認伺服器登出。請連線後完成登出。',
            ),
          );
      });
  }
  function localUnlock(userId: string) {
    generation.current++;
    cancelAuthRequests();
    client?.auth.stopAutoRefresh();
    if (client) void signOutLocal(client).catch(() => {});
    lock();
    setLogin(false);
    setExpires(0);
    setTarget({ user: { id: userId, email: '' }, offline: true });
    setStage('vault');
  }
  async function authenticate(email?: string) {
    if (!client || !navigator.onLine) throw new Error('Authentication unavailable');
    const turn = ++generation.current;
    const user = await verifiedIdentity(client);
    if (email && user.email.toLowerCase() !== email.toLowerCase())
      throw new Error('Identity mismatch');
    await ensureProfile(client, user.id);
    const { data, error } = await client.auth.getSession();
    if (
      error ||
      !data.session ||
      data.session.user.id !== user.id ||
      !data.session.expires_at ||
      data.session.expires_at * 1000 <= Date.now()
    )
      throw new Error('Invalid session');
    if (turn !== generation.current || !mounted.current) throw new Error('Cancelled');
    lock();
    setLogin(false);
    setNotice('');
    setExpires(data.session.expires_at * 1000);
    setTarget({ user, offline: false });
    setStage('vault');
    try {
      localStorage.setItem(CHOICE_KEY, `account:${user.id}`);
      localStorage.setItem(LAST_ACCOUNT_KEY, user.id);
    } catch {
      /* Unlock still requires the passphrase. */
    }
    client.auth.startAutoRefresh();
  }
  function invalidate() {
    generation.current++;
    lock();
    setTarget(null);
    setLogin(false);
    setExpires(0);
    setStage('welcome');
  }
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
          cancelAuthRequests();
          client?.auth.stopAutoRefresh();
          if (client) void signOutLocal(client).catch(() => {});
          chooseGuest();
          active.current = guestStore;
          activeMode.current = 'guest';
          setStore(guestStore);
          setStage('workspace');
          return;
        }
        if (client && navigator.onLine) {
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
      } catch {
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
      if (!active.current || active.current.kind !== 'account') return;
      if (
        (event === 'SIGNED_OUT' && activeMode.current !== 'offline') ||
        (event === 'SIGNED_IN' && session?.user.id !== active.current.key.split(':').at(-1))
      ) {
        invalidate();
        return;
      }
      if (event === 'TOKEN_REFRESHED' && activeMode.current === 'verified') {
        const current = active.current;
        // Keep provider calls outside the auth notification callback.
        setTimeout(() => {
          if (!mounted.current || active.current !== current) return;
          void verifiedIdentity(client!).then(
            (user) => {
              if (active.current !== current) return;
              if (current.key !== `tco-account-vault-v1:${user.id}` || !session?.expires_at) {
                invalidate();
                return;
              }
              setExpires(session.expires_at * 1000);
            },
            () => {
              if (active.current === current) invalidate();
            },
          );
        }, 0);
      }
    });
    const changed = (event: StorageEvent) => {
      if (
        active.current?.kind === 'account' &&
        (event.key === AUTH_STORAGE_KEY || event.key === null)
      )
        invalidate();
    };
    window.addEventListener('storage', changed);
    return () => {
      stopped = true;
      mounted.current = false;
      cancelPending();
      active.current?.lock();
      active.current = null;
      subscription?.data.subscription.unsubscribe();
      window.removeEventListener('storage', changed);
    };
    // Initial provider/ownership resolution runs once; later actions use the current render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);
  useEffect(() => {
    if (stage !== 'workspace' || !target || target.offline || !expires) return;
    const check = () => {
      if (Date.now() >= expires) invalidate();
    };
    const timer = window.setTimeout(
      check,
      Math.max(0, Math.min(2_147_000_000, expires - Date.now())),
    );
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, target, expires]);
  useEffect(() => {
    if (stage !== 'workspace') document.querySelector<HTMLElement>('.auth-card h1')?.focus();
  }, [stage]);
  let savedId = '';
  try {
    const id = localStorage.getItem(LAST_ACCOUNT_KEY);
    if (id && hasVault(id)) savedId = id;
  } catch {
    /* Damaged/unavailable storage never opens a vault. */
  }
  return (
    <LanguageContext.Provider value={language}>
      {stage === 'workspace' && store ? (
        <>
          <SyncContext.Provider value={syncEngine}>
            <App
              key={store.key}
              workspace={store}
              workspaceNotice={notice}
              accountControl={
                <AccountControl
                  syncEngine={syncEngine}
                  user={target?.user || null}
                  offline={target?.offline || false}
                  onLeave={guest}
                  onSignIn={(lang) => {
                    setLanguage(lang);
                    setLogin(true);
                  }}
                />
              }
            />
          </SyncContext.Provider>
          {login && (
            <Modal
              title={t('Sign in to TCO Logbook', '登入 TCO Logbook')}
              onClose={() => {
                generation.current++;
                cancelAuthRequests();
                if (client) void signOutLocal(client).catch(() => {});
                setLogin(false);
              }}
            >
              <SignIn client={client} onVerified={authenticate} onGuest={guest} />
              {savedId && (
                <button onClick={() => localUnlock(savedId)}>
                  {t('Unlock saved local vault', '解鎖已儲存的本機資料庫')}
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
                TCO Logbook<small>v0.8.1 · {t('Device only', '僅限本機')}</small>
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
            {stage === 'vault' && target ? (
              <VaultGate
                key={target.user.id}
                user={target.user}
                offline={target.offline}
                onGuest={guest}
                onOpen={async (next) => {
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
                    if (client && !target.offline)
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
              </>
            ) : (
              <>
                <h1 tabIndex={-1}>{t('Welcome to TCO Logbook', '歡迎使用 TCO Logbook')}</h1>
                <p>{t('Your personal aircraft turnaround logbook.', '你的個人航機周轉紀錄簿。')}</p>
                <SignIn client={client} onVerified={authenticate} onGuest={guest} />
                {savedId && (
                  <div className="offline-vault-option">
                    <button onClick={() => localUnlock(savedId)}>
                      {t('Unlock saved local vault', '解鎖已儲存的本機資料庫')}
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
  );
}
