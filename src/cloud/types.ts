import type { LegacyManifest } from '../migration/legacy';
import type { Database } from '../domain/model';
import type { BaseRecord, RecordData } from '../sync/types';
import type { MergePlan } from '../migration/plan';
import type { MixedPlan } from '../migration/mixed';
export type AccountOperation = {
  id: string;
  expected: number;
  changes: RecordData[];
  purpose: 'edit' | 'guest-merge' | 'history-restore';
};
export type AccountRecovery = {
  guestReady?: boolean;
  stage: 'review' | 'approved';
  fromRevision: number;
  at: string;
  db: Database;
  operation: AccountOperation | null;
  merge: MergePlan | null;
};
export type GuestDelivery = {
  operationId: string;
  phase: 'queued' | 'unknown' | 'rejected' | 'expired' | 'retired' | 'committed';
  reason?: 'source-changed' | 'destination-changed' | 'missing' | 'server';
  receiptRevision?: number;
};
export type MergeOutcome = {
  version: 2;
  userId: string;
  workspaceId: string;
  operationId: string;
  expected: number;
  revision: number;
  replayFloor: number;
  outcome: 'missing' | 'committed' | 'retired' | 'expired';
  operationRevision: number | null;
};
export type AccountState = {
  mixed?: MixedPlan;
  guestDelivery?: GuestDelivery;
  recovery?: AccountRecovery;
  cursor: number;
  base: BaseRecord[];
  conflicts: string[];
  operation: AccountOperation | null;
  lastSuccess: string | null;
  merge: MergePlan | null;
};
export type AccountPull = {
  version: 2;
  userId: string;
  workspaceId: string | null;
  established: boolean;
  legacyRevision: number | null;
  revision: number;
  replayFloor?: number;
  conversionState?: 'active' | 'verifying';
  snapshotDigest?: string | null;
  features?: string[];
  capacity?: { historyRows: number; historyBytes: number; receipts: number };
  records: (RecordData & { revision: number })[];
  count: number;
  total: number;
};
export type AccountReceipt = {
  version: 2;
  userId: string;
  workspaceId: string;
  operationId: string;
  revision: number;
};
export type ArchiveExport = {
  version: 2;
  userId: string;
  workspaceId: string;
  revision: number;
  digest: string;
  text: string;
};
export type ArchiveReceipt = {
  version: 2;
  userId: string;
  workspaceId: string;
  revision: number;
  replayFloor: number;
};
export type HistoryRow = {
  operationId: string;
  collection: RecordData['collection'];
  id: string;
  previousRevision: number;
  replacementRevision: number;
  value: RecordData['value'];
  createdAt: string;
};
export type HistoryResponse = {
  version: 2;
  userId: string;
  workspaceId: string;
  revision: number;
  replayFloor: number;
  archivedAt: string | null;
  records: HistoryRow[];
};
export interface AccountTransport {
  verifyConversion?(
    operation: string,
    expected: number,
    digest: string,
    signal: AbortSignal,
  ): Promise<void>;
  editOutcome?(
    operation: AccountOperation,
    retire: boolean,
    signal: AbortSignal,
  ): Promise<MergeOutcome>;
  mergeOutcome?(
    operation: AccountOperation,
    retire: boolean,
    signal: AbortSignal,
  ): Promise<MergeOutcome>;
  prepareArchive?(signal: AbortSignal): Promise<ArchiveExport>;
  archive?(expected: number, digest: string, signal: AbortSignal): Promise<ArchiveReceipt>;
  pull(cursor: number, signal: AbortSignal): Promise<AccountPull>;
  initialize(
    operation: string,
    rows: RecordData[],
    legacyRevision: number | null,
    signal: AbortSignal,
    manifest?: LegacyManifest,
  ): Promise<AccountReceipt>;
  push(operation: AccountOperation, signal: AbortSignal): Promise<AccountReceipt>;
  history?(
    collection: RecordData['collection'],
    id: string,
    signal: AbortSignal,
  ): Promise<HistoryResponse>;
}
export type AccountPayload = {
  version: 1 | 2;
  userId: string;
  workspaceId: string;
  db: Database;
  state: AccountState;
};
export class AccountError extends Error {
  constructor(
    public code:
      | 'auth'
      | 'setup'
      | 'invalid'
      | 'conflict'
      | 'network'
      | 'capacity'
      | 'local'
      | 'locked'
      | 'editing'
      | 'legacy'
      | 'locks'
      | 'archived'
      | 'retired'
      | 'merge-local-edits',
  ) {
    super(code);
  }
}
