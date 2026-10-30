import type { SupabaseClient } from '@supabase/supabase-js';
import { identity } from './client';

export class SessionRejected extends Error {}
/** Network/5xx failures are recoverable; explicit provider rejection is not. */
export function rejectedSession(error: unknown) {
  const e = error as { status?: number; name?: string; code?: string } | null;
  return (
    error instanceof SessionRejected ||
    e?.status === 401 ||
    e?.status === 403 ||
    (e?.name === 'AuthApiError' && e.status === 400) ||
    e?.name === 'AuthSessionMissingError' ||
    [
      'refresh_token_not_found',
      'refresh_token_already_used',
      'session_not_found',
      'session_expired',
      'user_not_found',
      'user_banned',
      'bad_jwt',
    ].includes(e?.code || '')
  );
}

/** Let the SDK restore/rotate credentials, then verify ownership against Auth, never cached IDs. */
export async function verifiedSession(client: SupabaseClient, expected?: string) {
  const result = await client.auth.getSession();
  if (result.error) throw result.error;
  if (!result.data.session) throw new SessionRejected('Session unavailable');
  let session = result.data.session;
  const remaining = (session.expires_at || 0) * 1000 - Date.now();
  if (remaining <= 0) {
    const renewed = await client.auth.refreshSession();
    if (renewed.error) throw renewed.error;
    session = renewed.data.session!;
  }
  if (
    !session?.access_token ||
    !session.expires_at ||
    session.expires_at * 1000 <= Date.now() ||
    (expected && session.user.id !== expected)
  )
    throw new SessionRejected('Session mismatch');
  let expires = session.expires_at * 1000;
  let { data, error } = await client.auth.getUser(session.access_token);
  // A suspended tab may finish checking the previous token after another tab rotated it.
  // Retry only once, and verify the replacement with Auth before accepting it.
  if (error?.status === 401) {
    const latest = await client.auth.getSession();
    if (latest.error) throw latest.error;
    let replacement = latest.data.session;
    if (
      replacement?.access_token === session.access_token &&
      session.expires_at * 1000 <= Date.now()
    ) {
      const renewed = await client.auth.refreshSession();
      if (renewed.error) throw renewed.error;
      replacement = renewed.data.session;
    }
    if (replacement?.access_token && replacement.access_token !== session.access_token) {
      if (
        replacement.user.id !== session.user.id ||
        !replacement.expires_at ||
        replacement.expires_at * 1000 <= Date.now()
      )
        throw new SessionRejected('Rotated session mismatch');
      session = replacement;
      expires = replacement.expires_at * 1000;
      ({ data, error } = await client.auth.getUser(session.access_token));
    }
  }
  if (error) throw error;
  let user;
  try {
    user = identity(data.user);
  } catch {
    throw new SessionRejected('Unverified account');
  }
  if (user.id !== session.user.id || (expected && user.id !== expected))
    throw new SessionRejected('Identity mismatch');
  return { user, expires };
}
