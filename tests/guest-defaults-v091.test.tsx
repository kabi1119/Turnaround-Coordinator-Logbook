import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';
import Settings from '../src/features/Settings';
import { seedDatabase } from '../src/data/seed';
import { hasKnownSamples } from '../src/data/sampleRefresh';
import { defaultOptionalFields, emptyAircraft } from '../src/domain/model';
import { emptyGuestDatabase, readDatabase, STORAGE_KEY } from '../src/lib/storage';
import { guestStore } from '../src/workspaces/store';
import { WorkspaceContext } from '../src/workspaces/context';
import { confirmPreparation, previewMerge, requestMerge } from '../src/migration/plan';
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());

it('starts missing Guest storage empty, with six enabled preferences and no initialization write', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const loaded = readDatabase();
  expect(loaded).toEqual({ db: emptyGuestDatabase(), snapshot: null, error: '' });
  expect(loaded.db.settings.privacy).toEqual(defaultOptionalFields);
  expect(write).not.toHaveBeenCalled();
  render(<App />);
  expect(screen.getByText('Your first assignment starts here.')).toBeVisible();
  expect(screen.queryByText('All examples are fictional.')).toBeNull();
  expect(screen.queryByText('Includes fictional sample records.')).toBeNull();
  expect(screen.getByText('Asia/Hong_Kong')).toBeVisible();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});

it('preserves saved records, edited samples, IDs, links, trash and disabled settings byte for byte', () => {
  const db = seedDatabase();
  db.settings.language = 'zh-HK';
  db.settings.privacy.registration = false;
  db.aircraft[0].notes = 'Owner-edited fictional fixture';
  db.duties[0].status = 'Trashed';
  const raw = JSON.stringify(db, null, 2);
  localStorage.setItem(STORAGE_KEY, raw);
  expect(readDatabase()).toEqual({ db, snapshot: raw, error: '' });
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});

it.each(['', '{broken', '{"version":99}', '{"version":1,"aircraft":[]}'])(
  'preserves unreadable bytes %j and exposes the existing error without fictional fallback',
  (raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    const loaded = readDatabase();
    expect(loaded.error).toMatch(/could not be read/);
    expect(loaded.snapshot).toBe(raw);
    expect(loaded.db.aircraft).toEqual([]);
    expect(loaded.db.duties).toEqual([]);
    expect(loaded.db.journals).toEqual([]);
    render(<App />);
    expect(screen.getByText(/Saved data could not be read/)).toBeVisible();
    expect(screen.queryByText('Includes fictional sample records.')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  },
);

it('manually loads samples only after confirmation, then clears all record collections and stays empty after remount', async () => {
  const view = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load sample records' }));
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).aircraft).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
  expect(screen.getByText('Includes fictional sample records.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear local records' }));
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'Duties, Aircraft, Journal entries and Trash',
  );
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).aircraft).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  const raw = localStorage.getItem(STORAGE_KEY)!,
    empty = JSON.parse(raw);
  expect(empty).toEqual(emptyGuestDatabase());
  view.unmount();
  render(<App />);
  await waitFor(() => expect(screen.getByText('Your first assignment starts here.')).toBeVisible());
  expect(readDatabase().db).toEqual(empty);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});

it('does not label user-only records fictional and accurately identifies mixed known samples', () => {
  const db = emptyGuestDatabase();
  db.aircraft.push({
    ...emptyAircraft('', ''),
    id: 'synthetic-user-record',
    airline: 'Personal entry',
  });
  expect(hasKnownSamples(db)).toBe(false);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  const view = render(<App />);
  expect(screen.queryByText('Includes fictional sample records.')).toBeNull();
  view.unmount();
  db.duties.push(seedDatabase().duties[0]);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  render(<App />);
  expect(screen.getByText('Includes fictional sample records.')).toBeVisible();
  expect(screen.queryByText('All examples are fictional.')).toBeNull();
  const edited = seedDatabase();
  for (const rows of [edited.aircraft, edited.duties, edited.journals])
    for (const row of rows)
      Object.assign(
        row,
        'notes' in row ? { notes: 'Changed by owner' } : { title: 'Changed by owner' },
      );
  expect(hasKnownSamples(edited)).toBe(false);
});

it('keeps empty Guest migration record-free and existing populated migration counts unchanged', async () => {
  const userId = '90000000-0000-4000-8000-000000000001',
    workspaceId = '90000000-0000-4000-8000-000000000002';
  for (const db of [emptyGuestDatabase(), seedDatabase()]) {
    const raw = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, raw);
    const plan = await requestMerge({
      userId,
      workspaceId,
      source: db,
      sourceSnapshot: raw,
      destination: emptyGuestDatabase(),
      revision: 1,
    });
    const review = confirmPreparation(plan, userId);
    expect(review.stage).toBe('review');
    if (!db.aircraft.length) expect(previewMerge(review).db.aircraft).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(plan.source.aircraft).toHaveLength(db.aircraft.length);
  }
});

it('cannot inject or refresh manual samples through an Account workspace Settings screen', () => {
  const commit = vi.fn(() => true);
  render(
    <WorkspaceContext.Provider value={{ ...guestStore, kind: 'account' }}>
      <Settings
        db={emptyGuestDatabase()}
        cloudAccount
        commit={commit}
        resetCommit={commit}
        onReport={() => {}}
        onBack={() => {}}
        onAircraftRestore={() => {}}
      />
    </WorkspaceContext.Provider>,
  );
  expect(screen.queryByRole('button', { name: 'Load sample records' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Refresh sample records' })).toBeNull();
  expect(commit).not.toHaveBeenCalled();
});
