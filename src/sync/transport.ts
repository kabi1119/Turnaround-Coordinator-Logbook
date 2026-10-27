import type { SupabaseClient } from '@supabase/supabase-js';
import { verifiedIdentity } from '../auth/client';
import type { CloudTransport, Pull } from './types';
import { SyncError } from './types';
export function transport(client: SupabaseClient, userId: string): CloudTransport {
  async function call(name: string, args: Record<string, unknown>, signal: AbortSignal) {
    if (signal.aborted) throw new SyncError('locked');
    try {
      const user = await verifiedIdentity(client);
      const { data, error } = await client.auth.getSession();
      if (
        error ||
        user.id !== userId ||
        data.session?.user.id !== userId ||
        !data.session.expires_at ||
        data.session.expires_at * 1000 <= Date.now()
      )
        throw new SyncError('auth');
    } catch (e) {
      if (e instanceof SyncError) throw e;
      const detail = e as { status?: number; message?: string };
      if ([401, 403].includes(detail?.status || 0) || detail?.message === 'Account is not verified')
        throw new SyncError('auth');
      throw new SyncError('network');
    }
    if (signal.aborted) throw new SyncError('locked');
    const { data, error } = await client.rpc(name, args).abortSignal(signal);
    if (signal.aborted) throw new SyncError('locked');
    if (error) {
      const code = error.code,
        message = error.message || '';
      if (code === 'PGRST202' || code === '42P01' || message.includes('sync_setup'))
        throw new SyncError('setup');
      if (code === '42501' || code === 'PGRST301' || message.includes('sync_auth'))
        throw new SyncError('auth');
      if (code === '23505' || message.includes('sync_conflict')) throw new SyncError('conflict');
      if (code === '53100' || code === '54000' || message.includes('sync_capacity'))
        throw new SyncError('capacity');
      if (message.includes('sync_invalid')) throw new SyncError('invalid');
      throw new SyncError('network');
    }
    return data;
  }
  return {
    pull: async (cursor, signal) =>
      (await call('tco_sync_pull', { p_cursor: cursor }, signal)) as Pull,
    initialize: async (envelope, signal) => {
      await call('tco_sync_initialize', { p_envelope: envelope }, signal);
    },
    push: async (expected, operation, records, signal) =>
      (await call(
        'tco_sync_push',
        { p_expected: expected, p_operation: operation, p_records: records },
        signal,
      )) as number,
  };
}
