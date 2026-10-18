import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import UpcomingShift from '../src/features/UpcomingShift';
import FullDutyCalendar from '../src/features/FullDutyCalendar';
import DutyCalendar from '../src/components/DutyCalendar';
import { seedDatabase } from '../src/data/seed';
import { calendarExamples } from '../src/domain/dutyCalendar';
import { hkToday, type Duty } from '../src/domain/model';
import { LanguageContext } from '../src/i18n';
import { STORAGE_KEY } from '../src/lib/storage';

const now = Date.parse('2026-11-05T12:00:00+08:00');
const duty = (patch: Partial<Duty> = {}): Duty => ({
  id: 'next',
  date: '2026-11-05',
  start: '14:00',
  end: '22:00',
  status: 'Confirmed',
  workState: 'Planned',
  notes: 'Fictional shift',
  ...patch,
});

describe('v0.3.4 compact Upcoming Shift', () => {
  it('Shows the next confirmed Scheduled shift in stable order, retaining multiple same-day duties', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const later = duty({ id: 'later', start: '23:00', end: '06:00' }),
      next = duty(),
      onDuty = vi.fn(),
      onCalendar = vi.fn();
    const rows = [
      later,
      duty({ id: 'worked', workState: 'Worked' }),
      duty({ id: 'past', date: '2026-11-04' }),
      duty({ id: 'active', start: '10:00', end: '13:00' }),
      duty({ id: 'al', leave: 'AL', start: '', end: '' }),
      duty({ id: 'sl', leave: 'SL' }),
      duty({ id: 'draft', status: 'Draft' }),
      duty({ id: 'trash', status: 'Trashed' }),
      next,
    ];
    const snapshot = JSON.stringify(rows);
    const { container } = render(
      <UpcomingShift duties={rows} onDuty={onDuty} onCalendar={onCalendar} />,
    );
    expect(container.querySelector('.calendar-grid')).toBeNull();
    expect(screen.getByRole('region', { name: 'Upcoming Shift' })).toHaveTextContent(
      'Start 14:00 · End 22:00 HKT',
    );
    expect(screen.getByText('1 more scheduled shift in the Full Calendar.')).toBeInTheDocument();
    fireEvent.click(container.querySelector('.upcoming-shift-row')!);
    expect(onDuty).toHaveBeenCalledWith(next);
    fireEvent.click(screen.getByRole('button', { name: 'View Full Calendar' }));
    expect(onCalendar).toHaveBeenCalledOnce();
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
  it('Shows recorded partial times accurately without inventing hours and labels overnight shifts', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const view = render(
      <UpcomingShift
        duties={[duty({ date: '2026-11-06', start: '', end: '' })]}
        onDuty={() => {}}
        onCalendar={() => {}}
      />,
    );
    expect(screen.getByRole('region')).toHaveTextContent('Start not recorded · End not recorded');
    view.rerender(
      <UpcomingShift
        duties={[duty({ start: '22:00', end: '06:00' })]}
        onDuty={() => {}}
        onCalendar={() => {}}
      />,
    );
    expect(screen.getByRole('region')).toHaveTextContent('Start 22:00 · End 06:00 (+1 day) HKT');
    view.rerender(
      <UpcomingShift duties={[duty({ end: '' })]} onDuty={() => {}} onCalendar={() => {}} />,
    );
    expect(screen.getByRole('region')).toHaveTextContent('Start 14:00 · End not recorded');
  });
  it('Has a concise empty state; elapsed Scheduled rows stay unmodified', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const row = duty({ date: '2026-11-04' });
    render(<UpcomingShift duties={[row]} onDuty={() => {}} onCalendar={() => {}} />);
    expect(screen.getByText('No upcoming scheduled shifts.')).toBeInTheDocument();
    expect(row.workState).toBe('Planned');
  });
  it('Refreshes upcoming presentation at the start time without writing attendance or other data', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-05T13:59:30+08:00'));
      const row = duty();
      render(<UpcomingShift duties={[row]} onDuty={() => {}} onCalendar={() => {}} />);
      expect(screen.queryByText('No upcoming scheduled shifts.')).toBeNull();
      act(() => vi.advanceTimersByTime(60000));
      expect(screen.getByText('No upcoming scheduled shifts.')).toBeInTheDocument();
      expect(row.workState).toBe('Planned');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Full Calendar navigation and structured status legend', () => {
  it.each(['en', 'zh-HK'] as const)(
    'Uses five icon-and-label groups directly below the grid in %s',
    (language) => {
      const { container } = render(
        <LanguageContext.Provider value={language}>
          <DutyCalendar
            duties={calendarExamples('2026-11', now)}
            month="2026-11"
            onMonth={() => {}}
            onSelect={() => {}}
            now={now}
          />
        </LanguageContext.Provider>,
      );
      const legend = screen.getByRole('list', {
        name: language === 'en' ? 'Calendar status legend' : '月曆狀態圖例',
      });
      const items = within(legend).getAllByRole('listitem');
      expect(items).toHaveLength(5);
      expect(container.querySelector('.calendar-grid')?.nextElementSibling).toBe(legend);
      expect(items[0].querySelector('.duty-marker.scheduled')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      expect(items[1].querySelector('.duty-marker.worked')).toBeInTheDocument();
      expect(items[2].querySelector('.duty-marker.working')).toBeInTheDocument();
      expect(items[3].querySelector('.leave-marker')).toHaveTextContent('AL');
      expect(items[4].querySelector('.leave-marker')).toHaveTextContent('SL');
      expect(items[3].querySelector('.duty-marker')).toBeNull();
      expect(legend).toHaveTextContent(language === 'en' ? 'Currently Working' : '正在當值');
      expect(container.querySelector('.calendar-instructions')).toHaveTextContent(
        language === 'en' ? 'Select a date' : '選擇日期',
      );
      container
        .querySelectorAll('[data-date]')
        .forEach((cell) =>
          expect(cell.querySelectorAll('[data-duty-marker]').length).toBeLessThanOrEqual(1),
        );
      expect(
        container.querySelector('[data-date="2026-11-09"] [data-duty-marker]'),
      ).toHaveTextContent('SL');
    },
  );
  it('Preserves month/date selection on close and reopen; lists all selected-date duties', () => {
    const today = hkToday(),
      rows = [
        duty({ id: 'one', date: today }),
        duty({ id: 'two', date: today, start: '23:00', end: '06:00' }),
      ],
      onDuty = vi.fn();
    const view = render(<FullDutyCalendar duties={rows} onDuty={onDuty} open onClose={() => {}} />);
    const records = view.container.querySelector('.calendar-records') as HTMLElement;
    expect(within(records).getAllByRole('button')).toHaveLength(2);
    fireEvent.click(within(records).getAllByRole('button')[1]);
    expect(onDuty).toHaveBeenCalledWith(rows[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    const nextMonth = view.container.querySelector('.duty-calendar h3')!.textContent!;
    const date = `${nextMonth}-09`;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${date} ·`) }));
    view.rerender(
      <FullDutyCalendar duties={rows} onDuty={onDuty} open={false} onClose={() => {}} />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<FullDutyCalendar duties={rows} onDuty={onDuty} open onClose={() => {}} />);
    expect(view.container.querySelector('.duty-calendar h3')).toHaveTextContent(nextMonth);
    expect(screen.getByRole('button', { name: new RegExp(`${date} ·`) })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it('Home opens and closes the complete calendar; detail and editing return to the selected date without storage writes on navigation', () => {
    const db = seedDatabase(),
      today = hkToday();
    db.duties.push(
      duty({ id: 'qa-next', date: today }),
      duty({ id: 'qa-second', date: today, start: '23:00', end: '06:00' }),
    );
    const bytes = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, bytes);
    const view = render(<App />);
    expect(view.container.querySelector('.calendar-grid')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Upcoming Shift' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fictional calendar preview' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View Full Calendar' }));
    expect(screen.getByRole('dialog', { name: 'Full Duty Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(`${today} ·`) })).toHaveAttribute(
      'aria-current',
      'date',
    );
    const records = view.container.querySelector('.calendar-records') as HTMLElement;
    fireEvent.click(within(records).getAllByRole('button')[1]);
    expect(screen.getByRole('dialog', { name: `Duty · ${today}` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Duty' }));
    expect(screen.getByRole('dialog', { name: 'Edit Duty' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('dialog', { name: 'Full Duty Calendar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Return to Home' }));
    expect(view.container.querySelector('.calendar-grid')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
  });
  it('Keeps fictional examples clearly disclosed inside the Full Calendar and never persists them', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedDatabase()));
    const bytes = localStorage.getItem(STORAGE_KEY);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'View Full Calendar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fictional calendar preview' }));
    const preview = screen.getByRole('dialog', { name: 'Fictional calendar preview' });
    expect(preview).toHaveTextContent('not your saved duties');
    expect(
      within(preview).getByRole('list', { name: 'Calendar status legend' }),
    ).toBeInTheDocument();
    fireEvent.click(within(preview).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Return to Home' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
  });
  it('Escape closes only the active fictional preview, keeping Full Calendar and its selected date', () => {
    render(<FullDutyCalendar duties={[]} open onClose={vi.fn()} onDuty={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fictional calendar preview' }));
    fireEvent(
      screen.getByRole('dialog', { name: 'Fictional calendar preview' }),
      new Event('cancel', { cancelable: true }),
    );
    expect(screen.queryByRole('dialog', { name: 'Fictional calendar preview' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Full Duty Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(`${hkToday()} ·`) })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it('Localizes the compact Home entry and Full Calendar controls', () => {
    const db = seedDatabase();
    db.settings.language = 'zh-HK';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    render(<App />);
    expect(screen.getByRole('heading', { name: '即將到來的更次' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看完整月曆' }));
    expect(screen.getByRole('dialog', { name: '完整更次月曆' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '月曆狀態圖例' })).toHaveTextContent('年假');
    fireEvent.click(screen.getByRole('button', { name: '返回首頁' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
