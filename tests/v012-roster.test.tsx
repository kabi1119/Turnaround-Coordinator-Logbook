import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Database, Duty } from '../src/domain/model';
import {
  monthDates,
  shiftRange,
  rosterConflicts,
  appendRoster,
  completedDuty,
} from '../src/domain/roster';
import { stats, trashDuty, restoreDuty } from '../src/domain/selectors';
// Preserve the historical fixture for v0.1.0–v0.1.3 compatibility regression assertions.
import { legacySeedDatabase as seedDatabase } from '../src/data/legacySeed';
import { loadDatabase, STORAGE_KEY, writeDatabase } from '../src/lib/storage';
import BatchDutyEditor from '../src/features/BatchDutyEditor';
import DutyEditor from '../src/features/DutyEditor';
import App from '../src/App';
import { LanguageContext } from '../src/i18n';

const duty = (overrides: Partial<Duty> = {}): Duty => ({
  id: 'one',
  date: '2026-11-05',
  start: '08:00',
  end: '16:00',
  status: 'Confirmed',
  workState: 'Planned',
  shiftType: 'Day',
  notes: '',
  ...overrides,
});
const empty = (): Database => ({ ...seedDatabase(), duties: [] });
function prepare(
  dates = ['2026-11-05', '2026-11-06'],
  type = 'Day',
  start = '08:00',
  end = '16:00',
) {
  fireEvent.change(screen.getByLabelText('Roster month and year'), {
    target: { value: '2026-11' },
  });
  dates.forEach((date) => fireEvent.click(screen.getByRole('button', { name: `Select ${date}` })));
  fireEvent.change(screen.getByLabelText('Shift template'), { target: { value: type } });
  fireEvent.change(screen.getByLabelText('Template start'), { target: { value: start } });
  fireEvent.change(screen.getByLabelText('Template end'), { target: { value: end } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply template to selected dates' }));
}

describe('Roster dates, conflicts and backwards-compatible work counts', () => {
  it('Uses Hong Kong start date across month/year boundaries, supports leap months and rejects invalid/equal times', () => {
    expect(monthDates('2028-02')).toHaveLength(29);
    expect(monthDates('2026-13')).toEqual([]);
    expect(shiftRange(duty({ date: '2026-12-31', start: '22:00', end: '06:00' }))).toMatchObject({
      endDate: '2027-01-01',
      overnight: true,
    });
    expect(shiftRange(duty({ date: '2026-11-30', start: '22:00', end: '06:00' }))?.endDate).toBe(
      '2026-12-01',
    );
    expect(shiftRange(duty({ date: '2026-02-30' }))).toBeNull();
    expect(shiftRange(duty({ start: '08:00', end: '08:00' }))).toBeNull();
  });
  it('Detects pending and saved duplicates, cross-date overlaps, boundary-touching shifts and ignores Trash', () => {
    const a = duty(),
      same = duty({ id: 'two' });
    expect(rosterConflicts([a, same], [])[0].kind).toBe('duplicate');
    expect(rosterConflicts([a], [same])[0]).toMatchObject({ kind: 'duplicate', saved: true });
    expect(
      rosterConflicts(
        [duty({ start: '22:00', end: '06:00' })],
        [duty({ id: 'next', date: '2026-11-06', start: '05:00', end: '09:00' })],
      )[0].kind,
    ).toBe('overlap');
    expect(rosterConflicts([a], [duty({ id: 'touch', start: '16:00', end: '23:00' })])).toEqual([]);
    expect(rosterConflicts([a], [{ ...same, status: 'Trashed' }])).toEqual([]);
  });
  it('Appends separate same-day shifts idempotently without altering IDs or Aircraft/Journal links', () => {
    const db = seedDatabase(),
      a = duty(),
      b = duty({ id: 'two', start: '17:00', end: '23:00' });
    const next = appendRoster(db, [a, b]);
    expect(next.duties.length).toBe(db.duties.length + 2);
    expect(appendRoster(next, [a, b])).toEqual(next);
    expect(next.aircraft).toBe(db.aircraft);
    expect(next.journals).toBe(db.journals);
    expect(
      restoreDuty(trashDuty(next, 'one'), 'one', true).duties.find((d) => d.id === 'one')
        ?.workState,
    ).toBe('Planned');
  });
  it('Keeps old v0.1.1 storage byte-for-byte unchanged on repeated load and preserves all legacy relationships/counts', () => {
    const db = seedDatabase(),
      original = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, original);
    expect(loadDatabase()).toEqual({ db, error: '' });
    expect(loadDatabase()).toEqual({ db, error: '' });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
    expect(stats(db.aircraft, db.duties).duties).toBe(
      db.duties.filter((d) => d.status === 'Confirmed').length,
    );
    const withPlanned = appendRoster(db, [duty()]);
    expect(stats(withPlanned.aircraft, withPlanned.duties)).toEqual(stats(db.aircraft, db.duties));
    expect(writeDatabase(withPlanned)).toBe(true);
    expect(loadDatabase().db).toEqual(withPlanned);
  });
  it('Requires an explicit Worked state and completed time; elapsed Planned shifts never count', () => {
    const now = Date.parse('2026-11-05T09:00:00Z');
    expect(completedDuty(duty(), now)).toBe(false);
    expect(completedDuty(duty({ workState: 'Worked' }), now)).toBe(true);
    expect(completedDuty(duty({ workState: 'Worked', end: '23:00' }), now)).toBe(false);
    expect(completedDuty(duty({ workState: 'Worked', status: 'Draft' }), now)).toBe(false);
    expect(completedDuty(duty({ date: '2027-01-01', workState: 'Worked' }), now)).toBe(false);
  });
});

describe('Batch duty review and persistence UI', () => {
  it('Requires valid customized hours; selects dates, edits/removes pending duties and saves once only after review', () => {
    const db = empty(),
      commit = vi.fn(() => true),
      close = vi.fn();
    render(<BatchDutyEditor db={db} commit={commit} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply template to selected dates' }));
    expect(screen.getByRole('alert')).toHaveTextContent('valid shift times');
    prepare(['2026-11-05', '2026-11-06', '2026-11-30'], 'Night', '22:00', '06:00');
    expect(screen.getByLabelText('Pending duty 3')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Duty 1 start'), { target: { value: '21:00' } });
    fireEvent.change(screen.getByLabelText('Duty 1 notes'), {
      target: { value: 'Synthetic roster note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove duty 2' }));
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review Batch' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('2026-12-01');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Edit' }));
    expect(screen.getByLabelText('Duty 1 start')).toHaveValue('21:00');
    fireEvent.click(screen.getByRole('button', { name: 'Review Batch' }));
    const save = screen.getByRole('button', { name: 'Confirm & Save Batch' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(commit).toHaveBeenCalledTimes(1);
    const value = (commit.mock.calls[0] as unknown as [Database])[0];
    expect(value.duties).toHaveLength(2);
    expect(value.duties[0]).toMatchObject({
      date: '2026-11-05',
      start: '21:00',
      workState: 'Planned',
      status: 'Confirmed',
      shiftType: 'Night',
      notes: 'Synthetic roster note',
    });
    expect(stats(value.aircraft, value.duties).duties).toBe(0);
  });
  it('Blocks exact saved duplicates and requires a separate overlap override; failed saves retain entries for retry', () => {
    const db = empty();
    db.duties = [duty()];
    const commit = vi
      .fn<(db: Database) => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    render(<BatchDutyEditor db={db} commit={commit} onClose={() => {}} />);
    prepare(['2026-11-05']);
    fireEvent.click(screen.getByRole('button', { name: 'Review Batch' }));
    expect(screen.getByRole('button', { name: 'Confirm & Save Batch' })).toBeDisabled();
    expect(screen.getByLabelText('Roster conflicts')).toHaveTextContent('Exact duplicate');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Edit' }));
    fireEvent.change(screen.getByLabelText('Duty 1 start'), { target: { value: '15:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review Batch' }));
    const save = screen.getByRole('button', { name: 'Confirm & Save Batch' });
    expect(save).toBeDisabled();
    fireEvent.click(
      screen.getByLabelText(
        'I reviewed every overlap and intentionally keep these separate duties.',
      ),
    );
    fireEvent.click(save);
    expect(screen.getByRole('alert')).toHaveTextContent('pending entries are retained');
    fireEvent.click(save);
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[0][0].duties[1].id).toBe(commit.mock.calls[1][0].duties[1].id);
    expect(commit.mock.calls[1][0].duties).toHaveLength(2);
  });
  it('Closing a pending roster requires discard and never writes', () => {
    const commit = vi.fn(() => true),
      close = vi.fn();
    render(<BatchDutyEditor db={empty()} commit={commit} onClose={close} />);
    prepare(['2026-11-05']);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
  });
  it('Home actions work; a batch saves into the existing origin storage and survives remount', () => {
    const original = seedDatabase();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(original));
    const view = render(<App />);
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /^Add Duties/ }));
    expect(screen.getByRole('dialog', { name: 'Add Duties' })).toBeInTheDocument();
    prepare();
    fireEvent.click(screen.getByRole('button', { name: 'Review Batch' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).duties).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save Batch' }));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.duties).toHaveLength(8);
    expect(stored.aircraft).toEqual(original.aircraft);
    expect(stored.journals).toEqual(original.journals);
    view.unmount();
    render(<App />);
    fireEvent.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: 'Logbook' }),
    );
    expect(screen.getAllByText(/Planned/).length).toBeGreaterThan(0);
    expect(loadDatabase().db.duties).toHaveLength(8);
  });
  it('Allows explicit Planned → Worked after completion and rejects future Worked duties', () => {
    const commit = vi.fn(() => true);
    const db = empty();
    const old = duty({ date: '2000-01-01' });
    db.duties = [old];
    const view = render(<DutyEditor db={db} existing={old} commit={commit} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Work state'), { target: { value: 'Worked' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Duty' }));
    expect((commit.mock.calls[0] as unknown as [Database])[0].duties[0].workState).toBe('Worked');
    view.unmount();
    render(<DutyEditor db={empty()} commit={commit} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Duty Date · shift start in Hong Kong'), {
      target: { value: '2099-01-01' },
    });
    fireEvent.change(screen.getByLabelText('Work state'), { target: { value: 'Worked' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Duty' }));
    expect(screen.getByRole('alert')).toHaveTextContent('must remain Planned');
    expect(commit).toHaveBeenCalledTimes(1);
  });
  it('Uses Traditional Chinese for every new workflow label', () => {
    render(
      <LanguageContext.Provider value="zh-HK">
        <BatchDutyEditor db={empty()} commit={() => true} onClose={() => {}} />
      </LanguageContext.Provider>,
    );
    expect(screen.getByRole('heading', { name: '新增更次' })).toBeInTheDocument();
    expect(screen.getByLabelText('更次範本')).toHaveTextContent('日更');
    expect(screen.getByRole('button', { name: '覆核批次' })).toBeDisabled();
  });
});
