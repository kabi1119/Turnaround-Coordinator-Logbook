import type { Database } from '../domain/model';
export type Collection = 'aircraft' | 'duties' | 'journals' | 'privacy';
export type RecordData = { collection: Collection; id: string; value: unknown | null };
export type KeyEnvelope = {
  version: 1;
  userId: string;
  keyId: string;
  salt: string;
  iterations: 600000;
  iv: string;
  ciphertext: string;
};
export type CipherRecord = {
  version: 1;
  userId: string;
  keyId: string;
  recordId: string;
  revision: number;
  iv: string;
  ciphertext: string;
};
export type BaseRecord = { record: RecordData; revision: number };
export type SyncState = {
  version: 1;
  enabled: boolean;
  envelope: KeyEnvelope;
  cursor: number;
  base: BaseRecord[];
  conflicts: string[];
  lastSuccess: string | null;
};
export type Pull = {
  version: 1;
  userId: string;
  revision: number;
  envelope: KeyEnvelope | null;
  records: CipherRecord[];
  count: number;
  total: number;
};
export interface CloudTransport {
  pull(cursor: number, signal: AbortSignal): Promise<Pull>;
  initialize(envelope: KeyEnvelope, signal: AbortSignal): Promise<void>;
  push(
    expected: number,
    operation: string,
    records: CipherRecord[],
    signal: AbortSignal,
  ): Promise<number>;
}
export type SyncVault = {
  read: () => SyncState | null;
  write: (
    db: Database,
    state: SyncState,
    expected: string | null | undefined,
  ) => Promise<import('../workspaces/store').WriteResult>;
};
export class SyncError extends Error {
  constructor(
    public code:
      | 'setup'
      | 'auth'
      | 'network'
      | 'capacity'
      | 'invalid'
      | 'conflict'
      | 'local'
      | 'locked'
      | 'editing',
  ) {
    super(code);
  }
}
