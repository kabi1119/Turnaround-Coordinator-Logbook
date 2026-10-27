import type { Database } from '../domain/model';
import { readDatabase, persistDatabase, STORAGE_KEY } from '../lib/storage';
export type LoadedWorkspace = ReturnType<typeof readDatabase>;
export type WriteResult = ReturnType<typeof persistDatabase>;
export type Commit = (db: Database) => boolean | Promise<boolean>;
export interface WorkspaceStore {
  key: string;
  kind: 'guest' | 'account';
  read: () => LoadedWorkspace;
  snapshot: () => string | null;
  current: (db: Database) => boolean;
  write: (db: Database, expected: string | null | undefined) => WriteResult | Promise<WriteResult>;
  lock: () => void;
  sync?: import('../sync/types').SyncVault;
  subscribe?: (listener: (reason: 'local' | 'sync' | 'lock') => void) => () => void;
}
export const guestStore: WorkspaceStore = {
  key: STORAGE_KEY,
  kind: 'guest',
  read: readDatabase,
  snapshot: () => localStorage.getItem(STORAGE_KEY),
  current: (db) => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null || JSON.stringify(JSON.parse(raw)) === JSON.stringify(db);
  },
  write: persistDatabase,
  lock: () => {},
};
export const CHOICE_KEY = 'tco-workspace-choice-v1';
export const GUEST_OWNER_KEY = 'tco-guest-owner-v1';
/** Assign ownership in place: never copy, delete or rewrite the legacy database. */
export function guestReturning() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const loaded = readDatabase();
      if (!loaded.error && loaded.snapshot === raw) {
        localStorage.setItem(GUEST_OWNER_KEY, JSON.stringify({ version: 1, key: STORAGE_KEY }));
      }
      // Even an unreadable legacy copy belongs to Guest; retain its recovery UI and bytes.
      return true;
    }
    return localStorage.getItem(CHOICE_KEY) === 'guest';
  } catch {
    return false;
  }
}
export function chooseGuest() {
  try {
    localStorage.setItem(CHOICE_KEY, 'guest');
  } catch {
    /* Guest still works in memory. */
  }
}
/** Keep synchronous Guest behavior; account completion waits for encrypted persistence. */
export function afterSave(result: boolean | Promise<boolean>, done: (ok: boolean) => void) {
  if (result instanceof Promise) void result.then(done, () => done(false));
  else done(result);
}
