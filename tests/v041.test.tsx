import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import Radar from '../src/components/Radar';
import { Modal } from '../src/components/ui';
import UpcomingShift from '../src/features/UpcomingShift';
import { homeDutySchedule } from '../src/domain/homeDuty';
import { emptyAircraft, type Duty } from '../src/domain/model';
import { stats } from '../src/domain/selectors';
import { seedDatabase } from '../src/data/seed';
import { STORAGE_KEY } from '../src/lib/storage';
import { LanguageContext } from '../src/i18n';

const now = Date.parse('2026-11-05T12:00:00+08:00');
const duty = (patch: Partial<Duty> = {}): Duty => ({
  id: 'future',
  date: '2026-11-05',
  start: '14:00',
  end: '22:00',
  status: 'Confirmed',
  workState: 'Planned',
  notes: '',
  ...patch,
});

describe('v0.4.1 schedule presentation without attendance inference', () => {
  it('Selects only eligible future schedules and preserves all underlying records', () => {
    const rows = [
      duty(),
      duty({ id: 'worked', workState: 'Worked' }),
      duty({ id: 'draft', status: 'Draft' }),
      duty({ id: 'trash', status: 'Trashed' }),
      duty({ id: 'AL', leave: 'AL' }),
      duty({ id: 'SL', leave: 'SL' }),
      duty({ id: 'legacy', workState: undefined }),
      duty({ id: 'invalid', date: '2026-11-31' }),
    ];
    const bytes = JSON.stringify(rows);
    expect(homeDutySchedule(rows, now)).toEqual({ current: [], next: [rows[0]], remaining: 0 });
    expect(JSON.stringify(rows)).toBe(bytes);
  });
  it('Uses half-open intervals and never duplicates current and next, including same-day duties', () => {
    const current = duty({ id: 'current', start: '10:00', end: '13:00' }),
      next = duty();
    expect(homeDutySchedule([next, current], now)).toMatchObject({
      current: [current],
      next: [next],
    });
    expect(homeDutySchedule([current], Date.parse('2026-11-05T10:00:00+08:00')).current).toEqual([
      current,
    ]);
    expect(homeDutySchedule([current], Date.parse('2026-11-05T13:00:00+08:00')).current).toEqual(
      [],
    );
    expect(current.workState).toBe('Planned');
  });
  it('Keeps an overnight shift on its Hong Kong start date across month boundaries', () => {
    const night = duty({ date: '2026-10-31', start: '22:00', end: '06:00' });
    const result = homeDutySchedule([night], Date.parse('2026-10-31T17:00:00Z'));
    expect(result).toEqual({ current: [night], next: [], remaining: 0 });
    expect(night.date).toBe('2026-10-31');
  });
  it('Never infers a current shift from missing, invalid or equal hours', () => {
    const rows = [
      duty({ id: 'end-missing', start: '10:00', end: '' }),
      duty({ id: 'start-missing', start: '' }),
      duty({ id: 'both-missing', start: '', end: '' }),
      duty({ id: 'equal', start: '10:00', end: '10:00' }),
      duty({ id: 'invalid', start: '25:00' }),
    ];
    const result = homeDutySchedule(rows, now);
    expect(result.current).toEqual([]);
    expect(result.next.map((d) => d.id).sort()).toEqual(['both-missing', 'start-missing']);
  });
  it('Exposes all overlapping current and tied future candidates, instead of selecting by arbitrary ID', () => {
    const rows = [
      duty({ id: 'current1', start: '10:00', end: '16:00' }),
      duty({ id: 'current2', start: '11:00', end: '15:00' }),
      duty(),
      duty({ id: 'future2' }),
    ];
    expect(homeDutySchedule(rows, now).current).toEqual(rows.slice(0, 2));
    expect(homeDutySchedule(rows, now).next).toEqual(rows.slice(2));
  });
});

describe('v0.4.1 Home Duty cards and linked navigation', () => {
  it('Reuses the dark card, shows only Scheduled, and counts actual linked non-Trashed records including inspectable Drafts', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const row = duty(),
      onDuty = vi.fn(),
      onCalendar = vi.fn();
    const aircraft = [
      emptyAircraft(row.date, row.id),
      { ...emptyAircraft(row.date, row.id), status: 'Trashed' as const },
      emptyAircraft(row.date, 'other'),
    ];
    const view = render(
      <UpcomingShift duties={[row]} aircraft={aircraft} onDuty={onDuty} onCalendar={onCalendar} />,
    );
    expect(view.container.querySelector('.current-duty.surface-dark')).toBeInTheDocument();
    expect(screen.getByRole('region')).toHaveTextContent('1 records');
    expect(screen.getByRole('region')).toHaveTextContent('Scheduled');
    expect(screen.getByRole('region')).not.toHaveTextContent('Confirmed');
    expect(screen.queryByRole('heading', { name: 'Next Shift' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View Duty' }));
    expect(onDuty).toHaveBeenCalledWith(row);
    fireEvent.click(screen.getByRole('button', { name: 'View Full Calendar' }));
    expect(onCalendar).toHaveBeenCalledOnce();
  });
  it.each(['en', 'zh-HK'] as const)(
    'Shows current and smaller next cards in %s without Worked/In Progress claims',
    (language) => {
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const current = duty({ id: 'current', start: '10:00', end: '13:00' }),
        next = duty(),
        onDuty = vi.fn();
      render(
        <LanguageContext.Provider value={language}>
          <UpcomingShift duties={[current, next]} onDuty={onDuty} onCalendar={() => {}} />
        </LanguageContext.Provider>,
      );
      const currentRegion = screen.getByRole('region', {
        name: language === 'en' ? "Today's Scheduled Shift" : '今日已排更次',
      });
      const nextRegion = screen.getByRole('region', {
        name: language === 'en' ? 'Next Shift' : '下一更次',
      });
      expect(currentRegion.textContent).not.toMatch(
        /Worked|In Progress|Confirmed|已工作|進行中|已確認/,
      );
      const label = language === 'en' ? 'View Duty' : '查看更次';
      fireEvent.click(within(nextRegion).getByRole('button', { name: label }));
      expect(onDuty).toHaveBeenLastCalledWith(next);
      fireEvent.click(currentRegion.querySelector('.duty-open')!);
      expect(onDuty).toHaveBeenLastCalledWith(current);
    },
  );
  it('Requires explicit inspection of ambiguous schedules and opens each exact record', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const rows = [
        duty({ id: 'one', start: '10:00', end: '16:00' }),
        duty({ id: 'two', start: '11:00', end: '15:00' }),
      ],
      onDuty = vi.fn();
    render(<UpcomingShift duties={rows} onDuty={onDuty} onCalendar={() => {}} />);
    expect(
      screen.getByText('Multiple scheduled shifts. Choose a Duty to inspect.'),
    ).toBeInTheDocument();
    screen.getAllByRole('button', { name: /View Duty/ }).forEach((button, i) => {
      fireEvent.click(button);
      expect(onDuty).toHaveBeenLastCalledWith(rows[i]);
    });
    expect(screen.queryByRole('region', { name: 'Next Shift' })).toBeNull();
  });
  it('Updates current/next presentation after clock ticks and resume without persistence writes', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-05T13:59:30+08:00'));
      const row = duty(),
        bytes = JSON.stringify(row),
        write = vi.spyOn(Storage.prototype, 'setItem');
      render(<UpcomingShift duties={[row]} onDuty={() => {}} onCalendar={() => {}} />);
      expect(screen.getByRole('heading', { name: 'Upcoming Shift' })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(60000));
      expect(screen.getByRole('heading', { name: "Today's Scheduled Shift" })).toBeInTheDocument();
      vi.setSystemTime(new Date('2026-11-05T22:01:00+08:00'));
      fireEvent(document, new Event('visibilitychange'));
      expect(screen.getByText('No upcoming scheduled shifts.')).toBeInTheDocument();
      expect(JSON.stringify(row)).toBe(bytes);
      expect(write).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it('Opens future Duty → Draft detail → edit/add with review, preserving counts and storage', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = seedDatabase(),
      future = duty();
    db.duties = [future];
    const draft = {
      ...emptyAircraft(future.date, future.id),
      airline: 'Cathay Pacific',
      notes: 'Fictional future draft',
    };
    db.aircraft.push(draft);
    const originalStats = stats(db.aircraft, db.duties);
    const bytes = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, bytes);
    render(<App />);
    expect(screen.queryByRole('button', { name: 'Log a Handling Task' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Most recent Duty' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View Duty' }));
    expect(screen.getByRole('dialog', { name: 'Duty · 2026-11-05' })).toHaveTextContent('14:00');
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Cathay Pacific/ }),
    );
    expect(screen.getByRole('dialog', { name: 'Handling Record' })).toHaveTextContent(draft.notes);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Duty' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Duty' }));
    expect(screen.getByLabelText('Shift Start · optional')).toHaveValue('14:00');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Handling Record for this Duty' }));
    expect(screen.getByRole('combobox', { name: 'Duty / Shift' })).toHaveTextContent('14:00');
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    expect(screen.getByRole('dialog', { name: 'Review Handling Record' })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
    expect(stats(db.aircraft, db.duties)).toEqual(originalStats);
    expect(originalStats.logged).toBe(4);
  });
  it('Keeps central Add functional without a redundant Home action', () => {
    render(<App />);
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /^New Handling Record/ }));
    expect(screen.getByRole('dialog', { name: 'New Handling Record' })).toBeInTheDocument();
  });
});

describe('v0.4.1 decoration and centralized scroll lock lifecycle', () => {
  it('Pauses hidden and inactive radar without remounting/restarting the sweep; cleans visibility listener', () => {
    const add = vi.spyOn(document, 'addEventListener'),
      remove = vi.spyOn(document, 'removeEventListener');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const view = render(<Radar />),
      sweep = view.container.querySelector('.radar-sweep');
    hidden.mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    expect(view.container.firstChild).toHaveAttribute('data-document-hidden', 'true');
    hidden.mockReturnValue(false);
    fireEvent(document, new Event('visibilitychange'));
    expect(view.container.firstChild).toHaveAttribute('data-document-hidden', 'false');
    view.rerender(<Radar active={false} />);
    expect(view.container.firstChild).toHaveAttribute('data-active', 'false');
    expect(view.container.querySelector('.radar-sweep')).toBe(sweep);
    const listener = add.mock.calls.find(([type]) => type === 'visibilitychange')![1];
    view.unmount();
    expect(remove).toHaveBeenCalledWith('visibilitychange', listener);
  });
  it('Keeps background locked after a nested dialog closes, restoring original style only on final close', () => {
    function Nested() {
      const [child, setChild] = useState(false);
      return (
        <Modal title="Parent" onClose={() => {}}>
          <button onClick={() => setChild(true)}>Open child</button>
          {child && (
            <Modal title="Child" onClose={() => setChild(false)}>
              <p>Review</p>
            </Modal>
          )}
        </Modal>
      );
    }
    document.body.style.overflow = 'auto';
    const view = render(<Nested />);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Open child' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Child' })).getByRole('button', { name: 'Close' }),
    );
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement).toHaveClass('modal-open');
    view.unmount();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.documentElement).not.toHaveClass('modal-open');
    document.body.style.overflow = '';
  });
});
