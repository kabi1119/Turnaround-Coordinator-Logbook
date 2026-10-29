import type { WorkspaceStore } from '../workspaces/store';
/** Recovery is a view/export path. All writes and sync hooks are withheld; original bytes remain intact. */
export function readOnlyVault(store: WorkspaceStore, userId: string): WorkspaceStore {
  if (store.kind !== 'account' || store.key !== 'tco-account-vault-v1:' + userId)
    throw new Error('identity');
  return {
    ...store,
    read: () => structuredClone(store.read()),
    sync: undefined,
    write: () => ({ ok: false, reason: 'unavailable' }),
  };
}
