import { materialize } from '../sync/records';
import { fingerprint } from '../migration/plan';
import { AccountError, type ArchiveExport } from './types';
/** Exact downloaded bytes, account, full current graph and all recovery categories must match. */
export async function verifyArchive(
  exported: ArchiveExport,
  text: string,
  userId: string,
  workspaceId: string,
) {
  if (
    !exported ||
    exported.version !== 2 ||
    exported.userId !== userId ||
    exported.workspaceId !== workspaceId ||
    !Number.isSafeInteger(exported.revision) ||
    exported.revision < 1 ||
    !/^[0-9a-f]{64}$/.test(exported.digest) ||
    typeof text !== 'string' ||
    new TextEncoder().encode(text).length > 64 * 1024 * 1024 ||
    text !== exported.text ||
    (await fingerprint(text)) !== exported.digest
  )
    throw new AccountError('invalid');
  const data = JSON.parse(text);
  if (
    data.kind !== 'tco-account-history-archive' ||
    data.version !== 1 ||
    data.userId !== userId ||
    data.workspaceId !== workspaceId ||
    data.revision !== exported.revision ||
    !Array.isArray(data.records) ||
    !Array.isArray(data.history) ||
    !Array.isArray(data.receipts) ||
    data.records.length > 5000 ||
    data.history.length > 20000 ||
    data.receipts.length > 20000 ||
    !Number.isSafeInteger(data.previousFloor) ||
    data.previousFloor < 0 ||
    data.previousFloor > data.revision
  )
    throw new AccountError('invalid');
  materialize(
    data.records.map(
      ({ collection, id, value }: { collection: string; id: string; value: unknown }) => ({
        collection,
        id,
        value,
      }),
    ),
    'en',
  );
  return data;
}
export function requestDownload(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
