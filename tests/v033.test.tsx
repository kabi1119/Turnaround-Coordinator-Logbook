import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Database, Duty } from '../src/domain/model';
import { hkToday } from '../src/domain/model';
import { seedDatabase } from '../src/data/seed';
import {
  batchProblem,
  calendarExamples,
  commitDutyBatch,
  dutyTotals,
  eligibleSickDuty,
  resolveDutyDay,
} from '../src/domain/dutyCalendar';
import { completedDuty, rosterConflicts } from '../src/domain/roster';
import { stats } from '../src/domain/selectors';
import { createBackup, parseBackup } from '../src/lib/backup';
import { loadDatabase, STORAGE_KEY, writeDatabase } from '../src/lib/storage';
import DutyCalendar from '../src/components/DutyCalendar';
import BatchDutyEditor from '../src/features/BatchDutyEditor';
import DutyEditor from '../src/features/DutyEditor';
import HomeCalendar from '../src/features/HomeCalendar';
import App from '../src/App';
import { LanguageContext } from '../src/i18n';

const now = Date.parse('2026-10-18T12:00:00+08:00');
const duty = (patch: Partial<Duty> = {}): Duty => ({
  id: 'scheduled',
  date: '2026-10-09',
  start: '08:00',
  end: '16:00',
  status: 'Confirmed',
  workState: 'Planned',
  shiftType: 'Day',
  notes: 'Fictional handover',
  ...patch,
});
const database = (duties: Duty[] = []): Database => ({
  ...seedDatabase(),
  duties,
  aircraft: [],
  journals: [],
});
const choose = (dates: string[]) => {
  fireEvent.change(screen.getByLabelText('Roster month and year'), {
    target: { value: dates[0].slice(0, 7) },
  });
  dates.forEach((date) => fireEvent.click(screen.getByRole('button', { name: `Select ${date}` })));
};
const kind = (value: string) =>
  fireEvent.change(screen.getByLabelText('Record type'), { target: { value } });
const applyLeave = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Add selected leave entries' }));
const save = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Review Batch' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save Batch' }));
};

describe('v0.3.3 date summary and fictional preview', () => {
  it('Aggregates unresolved Scheduled ahead of Worked regardless of record order; never infers work from elapsed dates', () => {
    const rows = [duty({ id: 'worked', workState: 'Worked' }), duty()];
    expect(resolveDutyDay(rows, '2026-10-09', now)).toBe('Scheduled');
    expect(resolveDutyDay([...rows].reverse(), '2026-10-09', now)).toBe('Scheduled');
    expect(completedDuty(rows[1], now)).toBe(false);
    expect(resolveDutyDay([duty({ workState: undefined })], '2026-10-09', now)).toBe(
      'Not recorded',
    );
    expect(resolveDutyDay([duty({ status: 'Trashed' })], '2026-10-09', now)).toBeNull();
    expect(resolveDutyDay(rows, '2026-10-10', now)).toBeNull();
  });
  it('Resolves leave before ordinary markers deterministically, including a mixed-state 9th', () => {
    const rows = [
      duty(),
      duty({ id: 'worked', workState: 'Worked' }),
      duty({ id: 'al', leave: 'AL', start: '', end: '' }),
    ];
    expect(resolveDutyDay(rows, '2026-10-09', now)).toBe('AL');
    expect(resolveDutyDay([...rows, duty({ id: 'sl', leave: 'SL' })], '2026-10-09', now)).toBe(
      'SL',
    );
    const { container } = render(
      <DutyCalendar
        duties={rows}
        month="2026-10"
        onMonth={() => {}}
        onSelect={() => {}}
        now={now}
      />,
    );
    expect(
      container.querySelector('[data-date="2026-10-09"]')?.querySelectorAll('[data-duty-marker]'),
    ).toHaveLength(1);
    expect(container.querySelector('[data-date="2026-10-09"] .leave-marker')).toHaveTextContent(
      'AL',
    );
    expect(container.querySelector('[data-date="2026-10-09"] .duty-marker')).toBeNull();
  });
  it('Currently Working applies only inside a confirmed Scheduled HKT range, including overnight', () => {
    const row = duty({ date: '2026-10-17', start: '22:00', end: '06:00' });
    const midnight = Date.parse('2026-10-18T01:00:00+08:00');
    expect(resolveDutyDay([row], row.date, midnight)).toBe('Currently Working');
    expect(resolveDutyDay([{ ...row, status: 'Draft' }], row.date, midnight)).toBe('Scheduled');
    expect(resolveDutyDay([row], row.date, now)).toBe('Scheduled');
    expect(row.workState).toBe('Planned');
  });
  it.each(['2026-10', '2027-02', '2028-02'])(
    'Generates dynamic examples for %s with one marker per date and SL on the mixed 9th',
    (month) => {
      const current = Date.parse(`${month}-18T12:00:00+08:00`),
        rows = calendarExamples(month, current);
      const { container } = render(
        <DutyCalendar
          duties={rows}
          month={month}
          onMonth={() => {}}
          onSelect={() => {}}
          now={current}
        />,
      );
      container
        .querySelectorAll('[data-date]')
        .forEach((cell) => expect(cell.querySelectorAll('[data-duty-marker]')).toHaveLength(1));
      expect(resolveDutyDay(rows, `${month}-08`, current)).toBe('Worked');
      expect(resolveDutyDay(rows, `${month}-19`, current)).toBe('Scheduled');
      expect(resolveDutyDay(rows, `${month}-18`, current)).toBe('Currently Working');
      expect(resolveDutyDay(rows, `${month}-05`, current)).toBe('AL');
      expect(resolveDutyDay(rows, `${month}-09`, current)).toBe('SL');
      expect(rows.filter((d) => d.date === `${month}-09`)).toHaveLength(2);
    },
  );
  it('Calendar month navigation and selection keep existing statuses and accessible descriptions', () => {
    const select = vi.fn(),
      change = vi.fn();
    render(
      <DutyCalendar
        duties={[duty()]}
        month="2026-10"
        selected={['2026-10-09']}
        onMonth={change}
        onSelect={select}
        now={now}
      />,
    );
    const day = screen.getByRole('button', { name: /2026-10-09 · Scheduled/ });
    expect(day).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(day);
    expect(select).toHaveBeenCalledWith('2026-10-09');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(change).toHaveBeenCalledWith('2026-11');
    expect(screen.getByRole('button', { name: /2026-10-18/ })).toHaveAttribute(
      'aria-current',
      'date',
    );
  });
});

describe('Atomic leave conversions, conflicts and compatible storage', () => {
  it('AL has no hours, can be future-dated and never counts as a Worked shift', () => {
    const al = duty({
        id: 'al',
        leave: 'AL',
        date: '2099-01-01',
        start: '',
        end: '',
        workState: undefined,
      }),
      db = database();
    expect(commitDutyBatch(db, [al], 'AL', false, now)?.duties).toEqual([al]);
    expect(dutyTotals([al], now)).toMatchObject({
      annualDates: 1,
      workedHours: 0,
      workedShifts: 0,
      scheduledHours: 0,
    });
    expect(completedDuty(al, now)).toBe(false);
  });
  it('SL converts only an eligible confirmed Scheduled duty; preserves every field and all links', () => {
    const original = duty({ date: '2026-10-31', start: '22:00', end: '06:00' }),
      db = seedDatabase();
    original.id = db.duties[0].id;
    db.duties[0] = original;
    const converted = { ...original, leave: 'SL' as const },
      next = commitDutyBatch(db, [converted], 'SL', false, now)!;
    expect(next.duties[0]).toEqual({ ...original, leave: 'SL' });
    expect(next.duties).toHaveLength(db.duties.length);
    expect(next.aircraft).toBe(db.aircraft);
    expect(next.journals).toBe(db.journals);
    expect(db.duties[0]).toEqual(original);
    expect(dutyTotals([converted], now)).toMatchObject({
      sickHours: 8,
      workedHours: 0,
      scheduledHours: 0,
      sickDates: 1,
      workedShifts: 0,
    });
    expect(stats(next.aircraft, next.duties).logged).toBe(stats(db.aircraft, db.duties).logged);
  });
  it.each([
    { workState: 'Worked' as const },
    { status: 'Draft' as const },
    { status: 'Trashed' as const },
    { leave: 'AL' as const },
    { leave: 'SL' as const },
    { start: '' },
  ])('Rejects ineligible SL source %j', (patch) => {
    const row = duty(patch);
    expect(eligibleSickDuty(row)).toBe(false);
    expect(
      commitDutyBatch(database([row]), [{ ...row, leave: 'SL' }], 'SL', false, now),
    ).toBeNull();
  });
  it('Rejects fabricated, stale or changed SL conversions and cannot overwrite unrelated metadata', () => {
    const row = duty(),
      candidate = { ...row, leave: 'SL' as const };
    expect(commitDutyBatch(database(), [candidate], 'SL', false, now)).toBeNull();
    expect(
      commitDutyBatch(database([row]), [{ ...candidate, notes: 'replacement' }], 'SL', false, now),
    ).toBeNull();
    expect(
      commitDutyBatch(database([{ ...row, end: '17:00' }]), [candidate], 'SL', false, now),
    ).toBeNull();
  });
  it('Rejects the whole batch on invalid dates, mixed classifications, duplicate IDs and future Worked; retains all original rows', () => {
    const db = database([duty()]),
      snapshot = JSON.stringify(db),
      al = duty({ id: 'al', leave: 'AL', date: '2026-11-01', start: '', end: '' });
    expect(
      commitDutyBatch(db, [al, { ...al, id: 'invalid', date: '2026-11-31' }], 'AL', false, now),
    ).toBeNull();
    expect(commitDutyBatch(db, [al, duty({ id: 'new' })], 'AL', false, now)).toBeNull();
    expect(commitDutyBatch(db, [al, al], 'AL', false, now)).toBeNull();
    expect(
      batchProblem([duty({ date: '2099-01-01', workState: 'Worked' })], [], 'Worked', now),
    ).toContain('invalid:');
    expect(JSON.stringify(db)).toBe(snapshot);
  });
  it('Detects AL collisions including a previous-day overnight shift; exact duplicates cannot be overridden', () => {
    const al = duty({ id: 'al', date: '2026-11-01', leave: 'AL', start: '', end: '' });
    const overnight = duty({ date: '2026-10-31', start: '22:00', end: '06:00' }),
      db = database([overnight]);
    expect(rosterConflicts([al], db.duties)[0].kind).toBe('leave');
    expect(commitDutyBatch(db, [al], 'AL', true, now)).toBeNull();
    expect(
      commitDutyBatch(db, [{ ...overnight, id: 'duplicate' }], 'Scheduled', true, now),
    ).toBeNull();
    expect(db.duties).toEqual([overnight]);
  });
  it('Keeps same-day separate shifts and requires explicit overlap override', () => {
    const row = duty(),
      db = database([row]),
      separate = duty({ id: 'second', start: '17:00', end: '21:00' }),
      overlapping = duty({ id: 'overlap', start: '15:00', end: '18:00' });
    expect(commitDutyBatch(db, [separate], 'Scheduled', false, now)?.duties).toHaveLength(2);
    expect(commitDutyBatch(db, [overlapping], 'Scheduled', false, now)).toBeNull();
    expect(commitDutyBatch(db, [overlapping], 'Scheduled', true, now)?.duties).toHaveLength(2);
  });
  it('Separates scheduled, actual, SL, AL and confirmed counts, counts leave dates once, ignores Draft/Trash', () => {
    const rows = [
      duty(),
      duty({ id: 'worked', workState: 'Worked' }),
      duty({ id: 'sl', leave: 'SL' }),
      duty({ id: 'al', date: '2026-10-10', leave: 'AL', start: '', end: '' }),
      duty({ id: 'al2', date: '2026-10-10', leave: 'AL', start: '', end: '' }),
      duty({ id: 'draft', workState: 'Worked', status: 'Draft' }),
      duty({ id: 'trash', leave: 'SL', status: 'Trashed' }),
    ];
    expect(dutyTotals(rows, now)).toEqual({
      scheduledHours: 8,
      workedHours: 8,
      sickHours: 8,
      annualDates: 1,
      sickDates: 1,
      workedShifts: 1,
    });
  });
  it('Loads legacy data without rewriting bytes or IDs, and roundtrips leave metadata through strict backup validation', () => {
    const old = seedDatabase(),
      bytes = JSON.stringify(old);
    localStorage.setItem(STORAGE_KEY, bytes);
    expect(loadDatabase().db).toEqual(old);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
    const db = database([
      duty({ leave: 'SL' }),
      duty({ id: 'al', date: '2026-10-10', leave: 'AL', start: '', end: '', workState: undefined }),
    ]);
    expect(writeDatabase(db)).toBe(true);
    expect(loadDatabase().db).toEqual(db);
    expect(parseBackup(JSON.stringify(createBackup(db))).data).toEqual(db);
    expect(() => createBackup(database([duty({ leave: 'SL', workState: 'Worked' })]))).toThrow();
    expect(() => createBackup(database([duty({ leave: 'AL' })]))).toThrow();
    expect(() => createBackup(database([duty({ leave: 'SL', date: '' })]))).toThrow();
  });
});

describe('Add Duties and connected calendars', () => {
  it('Creates explicitly Worked past overnight shifts and does not save selected but unapplied dates', () => {
    const commit = vi.fn(() => true);
    render(<BatchDutyEditor db={database()} commit={commit} onClose={() => {}} />);
    kind('Worked');
    choose(['2000-01-30', '2000-01-31']);
    fireEvent.change(screen.getByLabelText('Template start'), { target: { value: '22:00' } });
    fireEvent.change(screen.getByLabelText('Template end'), { target: { value: '06:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply template to selected dates' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select 2000-01-29' }));
    expect(screen.getByRole('button', { name: 'Review Batch' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear date selection' }));
    save();
    const result = (commit.mock.calls[0] as unknown as [Database])[0];
    expect(result.duties).toHaveLength(2);
    expect(result.duties.every((d) => d.workState === 'Worked')).toBe(true);
    expect(dutyTotals(result.duties, now)).toMatchObject({
      workedHours: 16,
      workedShifts: 2,
      scheduledHours: 0,
    });
  });
  it('One ineligible SL date blocks every conversion in that multi-date batch', () => {
    const commit = vi.fn(() => true),
      row = duty();
    render(<BatchDutyEditor db={database([row])} commit={commit} onClose={() => {}} />);
    kind('SL');
    choose(['2026-10-09', '2026-10-10']);
    applyLeave();
    expect(screen.getByRole('alert')).toHaveTextContent('2026-10-10');
    expect(screen.queryByLabelText('Pending duty 1')).toBeNull();
    expect(commit).not.toHaveBeenCalled();
  });
  it('Tracks the visual viewport for the sheet keyboard height and cleans up the listener', () => {
    const viewport = { height: 520, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('visualViewport', viewport);
    try {
      const view = render(
        <BatchDutyEditor db={database()} commit={() => true} onClose={() => {}} />,
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog.style.getPropertyValue('--sheet-viewport-height')).toBe('520px');
      viewport.height = 350;
      act(() => viewport.addEventListener.mock.calls[0][1]());
      expect(dialog.style.getPropertyValue('--sheet-viewport-height')).toBe('350px');
      view.unmount();
      expect(viewport.removeEventListener).toHaveBeenCalledWith(
        'resize',
        viewport.addEventListener.mock.calls[0][1],
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('Adds multiple AL dates without hours, locks batch type, reviews before one atomic save and protects cancellation', () => {
    const commit = vi.fn(() => true),
      close = vi.fn();
    render(<BatchDutyEditor db={database()} commit={commit} onClose={close} />);
    kind('AL');
    expect(screen.queryByLabelText('Template start')).toBeNull();
    choose(['2026-11-05', '2026-11-06']);
    applyLeave();
    expect(screen.getByLabelText('Record type')).toBeDisabled();
    expect(screen.getAllByText('No duty hours')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Review Batch' }));
    expect(commit).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('2026-11-05');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save Batch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save Batch' }));
    expect(commit).toHaveBeenCalledTimes(1);
    const result = (commit.mock.calls[0] as unknown as [Database])[0];
    expect(result.duties).toHaveLength(2);
    expect(result.duties.every((d) => d.leave === 'AL' && !d.start && !d.end)).toBe(true);
  });
  it('Requires choosing the intended SL shift when several exist and retains its ID, notes and hours', () => {
    const first = duty(),
      second = duty({ id: 'second', start: '17:00', end: '21:00' }),
      commit = vi.fn(() => true);
    render(<BatchDutyEditor db={database([first, second])} commit={commit} onClose={() => {}} />);
    kind('SL');
    choose(['2026-10-09']);
    applyLeave();
    expect(screen.getByRole('alert')).toHaveTextContent('Select an eligible Scheduled duty');
    expect(screen.queryByLabelText('Pending duty 1')).toBeNull();
    fireEvent.change(screen.getByLabelText('Scheduled duty 2026-10-09'), {
      target: { value: 'second' },
    });
    applyLeave();
    save();
    const result = (commit.mock.calls[0] as unknown as [Database])[0];
    expect(result.duties).toEqual([first, { ...second, leave: 'SL' }]);
  });
  it('SL without a Scheduled duty is blocked; cancelling selected dates never commits', () => {
    const commit = vi.fn(() => true),
      close = vi.fn();
    render(<BatchDutyEditor db={database()} commit={commit} onClose={close} />);
    kind('SL');
    choose(['2026-10-09']);
    applyLeave();
    expect(screen.getByRole('alert')).toHaveTextContent('No changes saved');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(commit).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
  it('Blocks an invalid edited date before review; removing every entry unlocks type and preserves selection across months', () => {
    render(<BatchDutyEditor db={database()} commit={() => true} onClose={() => {}} />);
    kind('AL');
    choose(['2026-11-05']);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('button', { name: 'Select 2026-11-05' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    applyLeave();
    fireEvent.change(screen.getByLabelText('Duty 1 date'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Review Batch' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid');
    fireEvent.click(screen.getByRole('button', { name: 'Remove duty 1' }));
    expect(screen.getByLabelText('Record type')).toBeEnabled();
  });
  it('Home shows all same-day records; editing updates Home and Add calendars through shared props without reload', () => {
    const original = duty({ date: hkToday() }),
      other = duty({ date: hkToday(), id: 'other', start: '17:00', end: '21:00' }),
      open = vi.fn();
    const view = render(<HomeCalendar duties={[original, other]} onDuty={open} />);
    const records = view.container.querySelector('.calendar-records')!;
    expect(within(records as HTMLElement).getAllByRole('button')).toHaveLength(2);
    fireEvent.click(within(records as HTMLElement).getAllByRole('button')[1]);
    expect(open).toHaveBeenCalledWith(other);
    const converted = { ...original, leave: 'SL' as const };
    view.rerender(<HomeCalendar duties={[converted, other]} onDuty={open} />);
    expect(
      view.container.querySelector(`[data-date="${hkToday()}"] [data-duty-marker]`),
    ).toHaveAttribute('data-duty-marker', 'SL');
    view.unmount();
    const add = render(
      <BatchDutyEditor db={database([converted, other])} commit={() => true} onClose={() => {}} />,
    );
    expect(
      add.container.querySelector(`[data-date="${hkToday()}"] [data-duty-marker]`),
    ).toHaveAttribute('data-duty-marker', 'SL');
  });
  it('Duty editor preserves SL planned metadata and supports editing date-only AL and explicitly restoring Scheduled', () => {
    const row = duty({ leave: 'SL' }),
      commit = vi.fn(() => true),
      view = render(
        <DutyEditor db={database([row])} existing={row} commit={commit} onClose={() => {}} />,
      );
    expect(screen.getByLabelText('Shift Start · optional')).toBeDisabled();
    expect(screen.getByLabelText('Notes')).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Duty' }));
    expect((commit.mock.calls[0] as unknown as [Database])[0].duties[0]).toEqual({
      ...row,
      leave: undefined,
    });
    view.unmount();
    const al = duty({ leave: 'AL', start: '', end: '' });
    render(<DutyEditor db={database([al])} existing={al} commit={commit} onClose={() => {}} />);
    expect(screen.queryByLabelText('Shift Start · optional')).toBeNull();
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Fictional leave note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Duty' }));
    expect((commit.mock.calls[1] as unknown as [Database])[0].duties[0]).toMatchObject({
      leave: 'AL',
      notes: 'Fictional leave note',
      start: '',
      end: '',
    });
  });
  it('Keeps scroll lock during the closing animation, cleans timers, and dismisses immediately for reduced motion', () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: false })),
      );
      const close = vi.fn();
      const view = render(<BatchDutyEditor db={database()} commit={() => true} onClose={close} />);
      expect(document.body.style.overflow).toBe('hidden');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('dialog')).toHaveClass('closing');
      expect(close).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(180));
      expect(close).toHaveBeenCalledOnce();
      view.unmount();
      expect(document.body.style.overflow).not.toBe('hidden');
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: true })),
      );
      render(<BatchDutyEditor db={database()} commit={() => true} onClose={close} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(close).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it('New leave workflow is localized in Traditional Chinese', () => {
    render(
      <LanguageContext.Provider value="zh-HK">
        <BatchDutyEditor db={database()} commit={() => true} onClose={() => {}} />
      </LanguageContext.Provider>,
    );
    expect(screen.getByLabelText('紀錄類型')).toHaveTextContent('年假 (AL)');
    fireEvent.change(screen.getByLabelText('紀錄類型'), { target: { value: 'SL' } });
    expect(screen.getByRole('button', { name: '加入所選假別項目' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('病假只可由現有已確認');
  });
  it('Central Add is the duty entry and View Calendar opens Logbook; saved AL immediately appears on Home', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(database()));
    const view = render(<App />);
    expect(screen.queryByRole('button', { name: 'Add Duty' })).toBeNull();
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /^Add Duties/ }));
    kind('AL');
    choose([hkToday()]);
    applyLeave();
    save();
    expect(
      view.container.querySelector(`[data-date="${hkToday()}"] [data-duty-marker]`),
    ).toHaveTextContent('AL');
    expect(loadDatabase().db.duties[0].leave).toBe('AL');
    fireEvent.click(screen.getByRole('button', { name: 'View Calendar' }));
    expect(screen.getByRole('button', { name: 'Calendar' })).toHaveClass('selected');
    expect(
      screen.getByRole('button', { name: new RegExp(`${hkToday()} · Annual Leave`) }),
    ).toBeInTheDocument();
  });
});
