import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ArchiveControl from '../src/cloud/ArchiveControl';
import { fingerprint } from '../src/migration/plan';
import { records } from '../src/sync/records';
import { emptyAccountDatabase } from '../src/workspaces/vault';
import type { AccountEngine } from '../src/cloud/engine';
const A = '90000000-0000-4000-8000-000000000001',
  W = '90000000-0000-4000-8000-000000000003';
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:synthetic-archive'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});
async function fixture() {
  const text = JSON.stringify({
    kind: 'tco-account-history-archive',
    version: 1,
    userId: A,
    workspaceId: W,
    revision: 2,
    previousFloor: 0,
    records: records(emptyAccountDatabase()),
    history: [],
    receipts: [],
  });
  const file = {
    version: 2 as const,
    userId: A,
    workspaceId: W,
    revision: 2,
    text,
    digest: await fingerprint(text),
  };
  const status = {
    phase: 'synced',
    pending: 0,
    conflicts: 0,
    lastSuccess: null,
    error: '',
    capacity: { historyRows: 15000, historyBytes: 1000, receipts: 15000 },
  };
  const engine = {
    subscribe: () => () => {},
    snapshot: () => status,
    canRun: () => true,
    prepareArchive: vi.fn(async () => file),
    archiveHistory: vi.fn(async () => ({
      version: 2,
      userId: A,
      workspaceId: W,
      revision: 2,
      replayFloor: 2,
    })),
    run: vi.fn(),
    store: { account: { userId: A, workspaceId: W } },
  };
  render(<ArchiveControl engine={engine as unknown as AccountEngine} />);
  return { engine, file };
}
describe('manual archive UI confirmation (synthetic files only)', () => {
  it('warns in advance without automatically deleting or requesting anything', async () => {
    const { engine } = await fixture();
    expect(screen.getByText(/Recovery storage is approaching/)).toBeVisible();
    expect(engine.prepareArchive).not.toHaveBeenCalled();
    expect(engine.archiveHistory).not.toHaveBeenCalled();
  });
  it('download is insufficient: requires rereading matching saved bytes and a separate explicit approval', async () => {
    const { engine, file } = await fixture();
    fireEvent.click(screen.getByRole('button', { name: 'Download recovery archive' }));
    const approve = await screen.findByRole('button', { name: 'Approve history archival' });
    expect(approve).toBeDisabled();
    expect(engine.archiveHistory).not.toHaveBeenCalled();
    const input = screen.getByLabelText('Reread saved archive');
    fireEvent.change(input, {
      target: { files: [{ size: 100, text: async () => file.text + 'wrong' }] },
    });
    await screen.findByText(/This file does not match/);
    expect(approve).toBeDisabled();
    fireEvent.change(input, {
      target: { files: [{ size: file.text.length, text: async () => file.text }] },
    });
    await screen.findByText(/Saved file verified/);
    expect(approve).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(approve).toBeEnabled();
    expect(engine.archiveHistory).not.toHaveBeenCalled();
    fireEvent.click(approve);
    await waitFor(() => expect(engine.archiveHistory).toHaveBeenCalledWith(file, file.text));
    await screen.findByText(/Archival acknowledged/);
  });
  it('failed archival never shows completion or drops the verified file/retry action', async () => {
    const { engine, file } = await fixture();
    engine.archiveHistory.mockRejectedValueOnce(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: 'Download recovery archive' }));
    const input = await screen.findByLabelText('Reread saved archive');
    fireEvent.change(input, {
      target: { files: [{ size: file.text.length, text: async () => file.text }] },
    });
    await screen.findByText(/Saved file verified/);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve history archival' }));
    await screen.findByText(/Archival was not confirmed/);
    expect(screen.queryByText(/Archival acknowledged/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve history archival' })).toBeEnabled();
  });
});
