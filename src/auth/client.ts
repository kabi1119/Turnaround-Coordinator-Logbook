import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { authConfig } from './config';
export type AccountIdentity = { id: string; email: string };
export const AUTH_STORAGE_KEY = 'tco-supabase-auth-v1';
export const LAST_ACCOUNT_KEY = 'tco-last-account-v1';
let authGeneration = 0,
  authAllowed = true;
let revokingSession: string | null = null;
let signInGeneration = 0;
/** Cancel credential-issuing UI requests without touching remembered sessions or token rotation. */
export function cancelPendingSignIn() {
  signInGeneration++;
}
export function cancelAuthRequests() {
  authGeneration++;
  authAllowed = false;
  try {
    revokingSession = localStorage.getItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    revokingSession = null;
  }
}
export function resumeAuthRequests() {
  // An already allowed SDK refresh must survive ordinary restoration/Guest return.
  if (!authAllowed) authGeneration++;
  authAllowed = true;
  revokingSession = null;
}
export function finishAuthLogout() {
  revokingSession = null;
}
let logoutPending: Promise<unknown> = Promise.resolve();
export function signOutLocal(client: SupabaseClient) {
  logoutPending = client.auth
    .signOut({ scope: 'local' })
    .then(({ error }) => {
      if (error) throw error;
    })
    .finally(finishAuthLogout);
  return logoutPending;
}
export async function authenticationReady() {
  await logoutPending.catch(() => {});
}
const sessionStorage = {
  getItem: (key: string) =>
    !authAllowed && key === AUTH_STORAGE_KEY ? revokingSession : localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    if (authAllowed) localStorage.setItem(key, value);
  },
  removeItem: (key: string) => localStorage.removeItem(key),
};
async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const path = new URL(String(input instanceof Request ? input.url : input)).pathname;
  const signingIn = /\/(verify|otp)$/.test(path);
  const signInTurn = signInGeneration;
  if (
    !authAllowed &&
    !new URL(String(input instanceof Request ? input.url : input)).pathname.endsWith('/logout')
  )
    return new Response(JSON.stringify({ message: 'Authentication cancelled' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  const turn = authGeneration,
    controller = new AbortController();
  const abort = () => controller.abort();
  if (init?.signal?.aborted) controller.abort();
  init?.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    // Buffer before returning: cancelled credential responses must never reach SDK persistence.
    const body = await response.arrayBuffer();
    if (turn !== authGeneration || (signingIn && signInTurn !== signInGeneration))
      return new Response(JSON.stringify({ message: 'Authentication cancelled' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    return new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener('abort', abort);
  }
}
let client: SupabaseClient | null | undefined;
export function authClient() {
  if (client !== undefined) return client;
  try {
    const config = authConfig(import.meta.env);
    client = config
      ? createClient(config.url, config.key, {
          auth: {
            storageKey: AUTH_STORAGE_KEY,
            storage: sessionStorage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
          global: { fetch: authFetch },
        })
      : null;
  } catch {
    client = null;
  }
  return client;
}
export function identity(user: User | null): AccountIdentity {
  if (!user?.id || !user.email || !user.email_confirmed_at || user.is_anonymous)
    throw new Error('Account is not verified');
  return { id: user.id, email: user.email };
}
export async function verifiedIdentity(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return identity(data.user);
}
export async function ensureProfile(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data) {
    const { error: insertError } = await client.from('profiles').insert({ id: userId });
    if (insertError && insertError.code !== '23505') throw insertError;
  }
}
/** Own template uses a fragment, so the token never enters hosting request URLs. */
export function consumeInvitation(location: Location, history: History) {
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (!fragment.has('invite_token_hash')) {
    if (fragment.has('access_token') || fragment.has('refresh_token'))
      history.replaceState(null, '', location.pathname);
    return null;
  }
  const token = fragment.get('invite_token_hash');
  history.replaceState(null, '', location.pathname);
  if (!token || !/^[A-Za-z0-9_-]{20,512}$/.test(token)) throw new Error('Invalid invitation');
  return token;
}
