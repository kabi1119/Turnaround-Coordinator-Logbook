import type { SupabaseClient } from '@supabase/supabase-js';
import { verifiedSession, rejectedSession } from '../auth/session';
import { AccountError, type AccountTransport } from './types';
export function accountTransport(
  client: SupabaseClient,
  userId: string,
  active: () => boolean,
): AccountTransport {
  async function call(
    name: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
    empty = false,
  ) {
    if (signal.aborted || !active()) throw new AccountError('locked');
    let token: string;
    try {
      const { user } = await verifiedSession(client, userId);
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (
        user.id !== userId ||
        data.session?.user.id !== userId ||
        !data.session.expires_at ||
        data.session.expires_at * 1000 <= Date.now() ||
        !data.session.access_token
      )
        throw new AccountError('auth');
      token = data.session.access_token;
    } catch (error) {
      if (error instanceof AccountError) throw error;
      throw new AccountError(rejectedSession(error) ? 'auth' : 'network');
    }
    if (signal.aborted || !active()) throw new AccountError('locked');
    // Bind this request to the token just verified. SDK session changes must not
    // send Account A plaintext with Account B's later ambient Authorization header.
    const { data, error } = await client
      .rpc(name, args)
      .setHeader('Authorization', 'Bearer ' + token)
      .abortSignal(signal);
    if (signal.aborted || !active()) throw new AccountError('locked');
    if (error) {
      const message = error.message || '';
      if (error.code === 'PGRST202' || error.code === '42P01' || message.includes('account_setup'))
        throw new AccountError('setup');
      if (['42501', 'PGRST301'].includes(error.code) || message.includes('account_auth'))
        throw new AccountError('auth');
      if (message.includes('account_archived_review')) throw new AccountError('archived');
      if (message.includes('account_operation_retired')) throw new AccountError('retired');
      if (message.includes('account_legacy')) throw new AccountError('legacy');
      if (message.includes('account_conflict') || error.code === '23505')
        throw new AccountError('conflict');
      if (message.includes('account_capacity') || ['53100', '54000'].includes(error.code))
        throw new AccountError('capacity');
      if (message.includes('account_invalid')) throw new AccountError('invalid');
      throw new AccountError('network');
    }
    if (empty) return;
    if (!data || data.version !== 2 || data.userId !== userId) throw new AccountError('invalid');
    return data;
  }
  return {
    verifyConversion: async (operation, expected, digest, signal) => {
      await call(
        'tco_account_verify_conversion',
        { p_operation: operation, p_expected: expected, p_digest: digest },
        signal,
        true,
      );
    },
    editOutcome: (operation, retire, signal) =>
      call(
        'tco_account_edit_outcome',
        {
          p_expected: operation.expected,
          p_operation: operation.id,
          p_records: operation.changes,
          p_retire: retire,
        },
        signal,
      ),
    mergeOutcome: (operation, retire, signal) =>
      call(
        'tco_account_merge_outcome',
        {
          p_expected: operation.expected,
          p_operation: operation.id,
          p_records: operation.changes,
          p_retire: retire,
        },
        signal,
      ),
    history: (collection, id, signal) =>
      call('tco_account_history', { p_collection: collection, p_id: id }, signal),
    prepareArchive: (signal) => call('tco_account_prepare_archive', {}, signal),
    archive: (expected, digest, signal) =>
      call(
        'tco_account_archive',
        { p_expected: expected, p_digest: digest, p_confirmation: true },
        signal,
      ),
    pull: (cursor, signal) => call('tco_account_pull', { p_cursor: cursor }, signal),
    initialize: (operation, rows, legacyRevision, signal, manifest) =>
      call(
        'tco_account_initialize',
        {
          p_operation: operation,
          p_consent: true,
          p_records: rows,
          p_legacy_revision: legacyRevision,
          p_manifest: manifest || null,
        },
        signal,
      ),
    push: (operation, signal) =>
      call(
        'tco_account_push',
        {
          p_expected: operation.expected,
          p_operation: operation.id,
          p_records: operation.changes,
          p_purpose: operation.purpose,
        },
        signal,
      ),
  };
}
