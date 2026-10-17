import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seedDatabase } from '../src/data/seed';
import { legacySeedDatabase } from '../src/data/legacySeed';
import { v014SeedDatabase } from '../src/data/v014Seed';
import {
  aircraftCatalogue,
  aircraftModel,
  validAircraftIdentity,
} from '../src/data/aircraftCatalogue';
import AircraftTypeFields from '../src/components/AircraftTypeFields';
import AircraftEditor from '../src/features/AircraftEditor';
import BackupManager from '../src/features/BackupManager';
import DutyPicker from '../src/components/DutyPicker';
import { dutyOptionText } from '../src/domain/roster';
import type { Database } from '../src/domain/model';
import { delaySeverity } from '../src/domain/delaySeverity';
import { stats, report, trashDuty, ranking } from '../src/domain/selectors';
import { emptyAircraft } from '../src/domain/model';
import { createBackup, parseBackup, BackupError, MAX_BACKUP_BYTES } from '../src/lib/backup';
import { loadDatabase, STORAGE_KEY, writeDatabase } from '../src/lib/storage';
import { LanguageContext } from '../src/i18n';

describe('v0.3.0 dependent aircraft identity and duty selection', () => {
  it('catalogue separates A321 from A320 family and limits new choices to Airbus/Boeing', () => {
    expect(aircraftCatalogue).toHaveLength(15);
    expect(aircraftCatalogue.every((x) => /^[AB]\d{3}$/.test(x.model))).toBe(true);
    expect(aircraftCatalogue.find((x) => x.model === 'A321')).toMatchObject({ family: 'A320' });
    expect(aircraftCatalogue.find((x) => x.model === 'A321')?.variants).toContain('A321XLR');
    expect(aircraftModel({ variant: 'A321neo' })).toBe('A321');
    expect(validAircraftIdentity({ aircraftType: 'A320', variant: 'A321neo' })).toBe(false);
    expect(validAircraftIdentity({ variant: 'Custom historical identity' })).toBe(true);
    expect(ranking(seedDatabase().aircraft, 'aircraftType')).toContainEqual(['A321', 1]);
  });
  it('disables variant until a model is chosen, restricts variants and clears incompatible selection', async () => {
    const user = userEvent.setup(),
      patch = vi.fn(),
      a = emptyAircraft();
    const { rerender } = render(<AircraftTypeFields a={a} onChange={patch} />);
    expect(screen.getByLabelText('Aircraft Variant *')).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Aircraft Type *'), 'A321');
    expect(patch).toHaveBeenLastCalledWith({
      aircraftType: 'A321',
      variant: '',
      family: 'A320',
      icao: '',
    });
    rerender(<AircraftTypeFields a={{ ...a, ...patch.mock.calls[0][0] }} onChange={patch} />);
    expect(screen.getByLabelText('Aircraft Variant *')).toBeEnabled();
    expect(screen.queryByRole('option', { name: 'A350-1000' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Aircraft Variant *'), 'A321XLR');
    expect(patch).toHaveBeenLastCalledWith({
      aircraftType: 'A321',
      variant: 'A321XLR',
      family: 'A320',
      icao: '',
    });
    await user.selectOptions(screen.getByLabelText('Aircraft Type *'), 'B787');
    expect(patch).toHaveBeenLastCalledWith({
      aircraftType: 'B787',
      variant: '',
      family: 'B787',
      icao: '',
    });
  });
  it('renders and allows editing unknown legacy variants without rewriting their snapshots', async () => {
    const user = userEvent.setup(),
      patch = vi.fn();
    const a = {
      ...seedDatabase().aircraft[0],
      variant: 'My historical aircraft',
      family: 'Old family',
      icao: 'OLD',
    };
    render(<AircraftTypeFields a={a} onChange={patch} />);
    expect(screen.getByLabelText('Aircraft Variant · historical/custom')).toHaveValue(a.variant);
    expect(patch).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Aircraft Variant · historical/custom'), ' X');
    expect(patch).toHaveBeenCalledWith({ variant: a.variant + 'X' });
  });
  it('formats overnight and incomplete duties without invented values, preserving legacy states', () => {
    const d = seedDatabase().duties[1];
    expect(dutyOptionText(d)).toBe('2026-Oct-15 22:00–06:00(+1) · Confirmed/Worked');
    expect(
      dutyOptionText({ ...d, start: '', end: '', status: 'Draft', workState: undefined }),
    ).toBe('2026-Oct-15 —–— · Draft/Legacy');
    expect(dutyOptionText(seedDatabase().duties[2])).toContain('Confirmed/Planned');
  });
  it('supports mouse, keyboard, Escape and wrapped option labels in a labeled combobox', async () => {
    const user = userEvent.setup(),
      onChange = vi.fn();
    render(<DutyPicker duties={seedDatabase().duties} value="" onChange={onChange} />);
    const box = screen.getByRole('combobox', { name: 'Duty / Shift' });
    await user.click(box);
    expect(screen.getAllByRole('option')).toHaveLength(4);
    await user.keyboard('{End}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('sample-night');
    await user.click(box);
    await user.keyboard('{Escape}');
    expect(box).toHaveAttribute('aria-expanded', 'false');
    await user.click(box);
    await user.click(screen.getByRole('option', { name: /Confirmed\/Planned/ }));
    expect(onChange).toHaveBeenLastCalledWith('sample-planned');
  });
});

describe('v0.3.0 disruption duration, not inferred flight causation', () => {
  it.each([
    [0, 'None / Below threshold'],
    [14, 'None / Below threshold'],
    [15, 'Minor'],
    [60, 'Minor'],
    [61, 'Moderate'],
    [180, 'Moderate'],
    [181, 'Major'],
    [undefined, 'Undetermined'],
    [-1, 'Undetermined'],
    [NaN, 'Undetermined'],
    [1.5, 'Undetermined'],
  ] as const)('classifies %s minutes as %s', (minutes, expected) =>
    expect(delaySeverity(minutes)).toBe(expected),
  );
  it('reactively calculates entered minutes and preserves historical impact through review/save', () => {
    const db = seedDatabase(),
      existing = db.aircraft[1],
      commit = vi.fn<(db: Database) => boolean>(() => true);
    render(
      <AircraftEditor
        db={db}
        existing={existing}
        commit={commit}
        onSaved={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText('Disruption delay · whole minutes (optional)'), {
      target: { value: '61' },
    });
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText(/Historical operational impact/)).toHaveTextContent('Minor');
    fireEvent.click(screen.getByText('Save & Close'));
    fireEvent.click(screen.getByText('Confirm & Save'));
    expect(commit).toHaveBeenCalledOnce();
    expect(
      commit.mock.calls[0][0].aircraft.find((a: { id: string }) => a.id === existing.id)!.events[0],
    ).toMatchObject({ impact: 'Minor', delayMinutes: 61 });
  });
  it('does not infer severity from cross-midnight times, cancellation or missing actual times', () => {
    const a = seedDatabase().aircraft[0];
    a.arrival.scheduled = '2026-10-31T23:30:00';
    a.arrival.actual = '2026-11-01T00:31:00';
    const event = { ...seedDatabase().aircraft[1].events[0], delayMinutes: undefined };
    expect(delaySeverity(event.delayMinutes)).toBe('Undetermined');
    expect(delaySeverity(61)).toBe('Moderate'); // Explicit elapsed minutes already span midnight; no clock subtraction ambiguity.
    a.departure.status = 'Cancelled';
    a.departure.actual = '';
    expect(delaySeverity(event.delayMinutes)).toBe('Undetermined');
  });
});

describe('v0.3.0 fresh preferences and backward compatibility', () => {
  it('enables six optional fields only without saved data and never writes during load', () => {
    const loaded = loadDatabase();
    expect(Object.values(loaded.db.settings.privacy)).toEqual(Array(6).fill(true));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('preserves disabled preferences and deleted values from an existing database', () => {
    const db = seedDatabase();
    db.settings.privacy.flights = true;
    db.aircraft[0].registration = '';
    const original = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, original);
    expect(loadDatabase().db).toEqual(db);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
  });
});

describe('v0.3.0 full JSON backups', () => {
  it.each([seedDatabase, legacySeedDatabase, v014SeedDatabase])(
    'round-trips complete current/legacy data including hidden fields, Trash and links',
    (fixture) => {
      const original = fixture(),
        db = trashDuty(original, original.duties[0].id);
      db.aircraft[0].status = 'Trashed';
      db.aircraft[0].previousStatus = 'Confirmed';
      db.aircraft[0].trashedAt = '2026-10-18T00:00:00Z';
      const backup = createBackup(db),
        restored = parseBackup(JSON.stringify(backup));
      expect(restored.data).toEqual(db);
      expect(restored.storageSchemaVersion).toBe(1);
      expect(stats(restored.data.aircraft, restored.data.duties)).toEqual(
        stats(db.aircraft, db.duties),
      );
      expect(restored.data.duties.find((d) => d.end < d.start)).toBeDefined();
      expect(writeDatabase(restored.data)).toBe(true);
      expect(loadDatabase().db).toEqual(db);
      expect(writeDatabase(restored.data)).toBe(true);
      expect(loadDatabase().db).toEqual(db);
    },
  );
  it('preserves structured identity, entered delay, manual impact and Planned/Worked counts', () => {
    const db = seedDatabase();
    db.aircraft[0].aircraftType = 'A350';
    db.aircraft[1].events[0].delayMinutes = 181;
    const restored = parseBackup(JSON.stringify(createBackup(db))).data;
    expect(restored).toEqual(db);
    expect(stats(restored.aircraft, restored.duties).duties).toBe(2);
  });
  it.each([
    '{',
    'null',
    '[]',
    '{"__proto__":{"polluted":true}}',
    '{"constructor":{"prototype":{"polluted":true}}}',
  ])('rejects malformed/malicious JSON without side effects (%s)', (text) => {
    expect(() => parseBackup(text)).toThrow(BackupError);
    expect(Object.prototype).not.toHaveProperty('polluted');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('rejects report exports with a specific error instead of inventing data', () => {
    const text = JSON.stringify(report(seedDatabase(), '', '', 'handled', [], []));
    expect(() => parseBackup(text)).toThrow(expect.objectContaining({ code: 'report' }));
  });
  it.each([
    'version',
    'duplicate',
    'orphan',
    'field',
    'setting',
    'variant',
    'date',
    'duration',
    'stateType',
    'oversized',
  ])('rejects unsafe %s data atomically', (kind) => {
    const backup = createBackup(seedDatabase());
    if (kind === 'version') backup.backupFormatVersion = 99 as 1;
    if (kind === 'duplicate') backup.data.aircraft.push(backup.data.aircraft[0]);
    if (kind === 'orphan') backup.data.aircraft[0].dutyId = 'missing';
    if (kind === 'field') Object.assign(backup.data.aircraft[0].arrival, { status: 'Guess' });
    if (kind === 'setting') Object.assign(backup.data.settings, { token: 'not-allowed' });
    if (kind === 'variant')
      Object.assign(backup.data.aircraft[0], { aircraftType: 'A320', variant: 'B787-9' });
    if (kind === 'date') backup.data.duties[0].date = '2026-02-30';
    if (kind === 'duration') backup.data.aircraft[1].events[0].delayMinutes = -1;
    if (kind === 'stateType') Object.assign(backup.data.duties[0], { workState: ['Planned'] });
    let text = JSON.stringify(backup);
    if (kind === 'oversized') text += ' '.repeat(MAX_BACKUP_BYTES);
    const saved = JSON.stringify(seedDatabase());
    localStorage.setItem(STORAGE_KEY, saved);
    expect(() => parseBackup(text)).toThrow(BackupError);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  });
  it.each(['originalDutyId', 'journalId', 'journalAircraft', 'duplicateEvent'])(
    'checks all relationship and event-ID paths (%s)',
    (kind) => {
      const backup = createBackup(seedDatabase());
      if (kind === 'originalDutyId') backup.data.aircraft[0].originalDutyId = 'lost';
      if (kind === 'journalId') backup.data.aircraft[1].events[0].journalId = 'lost';
      if (kind === 'journalAircraft') backup.data.journals[0].aircraftIds = ['lost'];
      if (kind === 'duplicateEvent')
        backup.data.aircraft[1].events.push(backup.data.aircraft[1].events[0]);
      expect(() => parseBackup(JSON.stringify(backup))).toThrow(BackupError);
    },
  );
  it('does not destroy old local data if atomic setItem fails due to quota', () => {
    const before = JSON.stringify(seedDatabase());
    localStorage.setItem(STORAGE_KEY, before);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    expect(writeDatabase(parseBackup(JSON.stringify(createBackup(seedDatabase()))).data)).toBe(
      false,
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });
});

describe('v0.3.0 reviewed restore UI', () => {
  it('exports only after confirmation without changing storage and releases the download URL', () => {
    const createObjectURL = vi.fn(() => 'blob:local-backup'),
      revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.useFakeTimers();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      const restore = vi.fn();
      render(<BackupManager db={seedDatabase()} restore={restore} />);
      fireEvent.click(screen.getByText('Export Full Backup (JSON)'));
      expect(createObjectURL).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Download unencrypted backup'));
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(click).toHaveBeenCalledOnce();
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-backup');
      expect(restore).not.toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it('rejects PDF and oversized files before reading or changing data', async () => {
    const restore = vi.fn();
    render(<BackupManager db={seedDatabase()} restore={restore} />);
    fireEvent.click(screen.getByText('Import Backup (JSON)'));
    const input = screen.getByLabelText('Local JSON backup file · maximum 5 MiB');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'report.pdf', { type: 'application/pdf' })] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'PDF and other file types cannot be restored',
    );
    const huge = new File(['x'], 'large.json', { type: 'application/json' });
    Object.defineProperty(huge, 'size', { value: MAX_BACKUP_BYTES + 1 });
    fireEvent.change(input, { target: { files: [huge] } });
    expect(screen.getByRole('alert')).toHaveTextContent('5 MiB limit');
    expect(restore).not.toHaveBeenCalled();
  });
  async function choose(text = JSON.stringify(createBackup(seedDatabase()))) {
    const user = userEvent.setup();
    await user.click(screen.getByText('Import Backup (JSON)'));
    const file = new File([text], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Local JSON backup file · maximum 5 MiB'), {
      target: { files: [file] },
    });
    return user;
  }
  it('preserves current data before explicit confirmation, previews replaced rows and restores once', async () => {
    const current = seedDatabase();
    current.aircraft = [];
    current.journals = [];
    const restore = vi.fn<(db: Database) => boolean>(() => true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    render(<BackupManager db={current} restore={restore} />);
    const user = await choose();
    await screen.findByText('Aircraft: 0 → 4');
    expect(restore).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(current);
    const button = screen.getByText('Confirm & Restore Backup');
    expect(button).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    fireEvent.click(button);
    fireEvent.click(button);
    expect(restore).toHaveBeenCalledOnce();
    expect(restore.mock.calls[0][0]).toEqual(seedDatabase());
    expect(screen.getByRole('status')).toHaveTextContent('completed locally');
  });
  it('keeps the preview and existing data after write failure; permits retry', async () => {
    const db = seedDatabase(),
      restore = vi.fn(() => false);
    render(<BackupManager db={db} restore={restore} />);
    const user = await choose();
    await screen.findByText('Aircraft: 4 → 4');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByText('Confirm & Restore Backup'));
    expect(screen.getByRole('alert')).toHaveTextContent('Existing data was not replaced');
    expect(screen.getByText('Confirm & Restore Backup')).toBeEnabled();
  });
  it('blocks stale previews when local data changes in another tab', async () => {
    const restore = vi.fn(() => true);
    render(<BackupManager db={seedDatabase()} restore={restore} />);
    const user = await choose();
    await screen.findByText('Aircraft: 4 → 4');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedDatabase()));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByText('Confirm & Restore Backup'));
    expect(restore).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('changed since preview');
  });
  it('reports an old report export clearly in Traditional Chinese', async () => {
    render(
      <LanguageContext.Provider value="zh-HK">
        <BackupManager db={seedDatabase()} restore={() => true} />
      </LanguageContext.Provider>,
    );
    fireEvent.click(screen.getByText('匯入備份（JSON）'));
    fireEvent.change(screen.getByLabelText('本機 JSON 備份檔案 · 最大 5 MiB'), {
      target: { files: [new File(['{"counts":[]}'], 'report.json', { type: 'application/json' })] },
    });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('此檔案是報告匯出，並非完整備份。'),
    );
  });
});
