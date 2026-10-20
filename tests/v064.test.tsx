import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import HomeInsights from '../src/features/HomeInsights';
import { homeSummary } from '../src/domain/homeSummary';
import { emptyAircraft, type Aircraft } from '../src/domain/model';
import { stats } from '../src/domain/selectors';
import { seedDatabase } from '../src/data/seed';
import { STORAGE_KEY } from '../src/lib/storage';

const now = Date.parse('2027-01-01T12:00:00+08:00');
const record = (id: string, date = '2027-01-01', patch: Partial<Aircraft> = {}): Aircraft => ({
  ...emptyAircraft(date),
  id,
  status: 'Confirmed',
  airline: 'Cathay Pacific',
  variant: 'A350-1000',
  ...patch,
});

describe('Home handling insights', () => {
  it('reuses lifetime Handled eligibility and counts a turnaround once without changing existing statistics or records', () => {
    const rows = [
      record('primary'),
      record('support', undefined, { role: 'Supporting Coordinator' }),
      record('training', undefined, { role: 'Training / Observation' }),
      record('draft', undefined, { status: 'Draft' }),
      record('pending', '2027-01-02', { status: 'Draft' }),
      record('trash', undefined, { status: 'Trashed' }),
      record('missing-role', undefined, { role: '' }),
      record('old', '2020-01-01'),
    ];
    rows[0].arrival.flight = 'CX123';
    rows[0].departure.flight = 'CX124';
    const bytes = JSON.stringify(rows),
      totals = stats(rows),
      summary = homeSummary(rows, now);
    expect(summary.lifetime).toBe(3);
    expect(summary.lifetime).toBe(totals.handled);
    expect(summary.airline?.count).toBe(2);
    expect(summary.aircraft?.count).toBe(2);
    expect([summary.drafts, summary.pending]).toEqual([1, 1]);
    expect(JSON.stringify(rows)).toBe(bytes);
    expect(stats(rows)).toEqual(totals);
  });
  it('uses today plus 29 Hong Kong calendar days across year boundaries, never creation time or a future/invalid date', () => {
    const rows = [
      record('outside', '2026-12-02'),
      record('first', '2026-12-03'),
      record('today'),
      record('future', '2027-01-02'),
      record('invalid', '2026-12-32'),
    ];
    rows.forEach((a) => {
      a.createdAt = '2050-01-01T00:00:00Z';
      a.updatedAt = a.createdAt;
    });
    const s = homeSummary(rows, now);
    expect([s.from, s.today]).toEqual(['2026-12-03', '2027-01-01']);
    expect(s.airline?.count).toBe(2);
    expect(s.aircraft?.count).toBe(2);
    expect(homeSummary([], Date.parse('2026-11-01T00:00:00+08:00')).from).toBe('2026-10-03');
  });
  it('normalizes known airline codes/aliases and uses latest date then canonical key for stable ties', () => {
    const rows = [
      record('cx1', '2026-12-10'),
      record('cx2', '2026-12-12', { airline: 'cx' }),
      record('lh1', '2026-12-11', { airline: 'LH' }),
      record('lh2', '2026-12-13', { airline: 'Lufthansa German Airlines' }),
    ];
    expect(homeSummary(rows, now).airline?.label).toBe('Lufthansa (LH)');
    expect(homeSummary([...rows].reverse(), now).airline).toEqual(homeSummary(rows, now).airline);
    rows[1].date = '2026-12-13';
    expect(homeSummary(rows, now).airline?.label).toBe('Cathay Pacific (CX)');
  });
  it('keeps canonical variants distinct, falls back to known type only when variant is missing, and never uses registration', () => {
    const rows = [
      record('v1', undefined, { variant: 'a350-900' }),
      record('v2', undefined, { variant: 'A350-900' }),
      record('v3'),
    ];
    expect(homeSummary(rows, now).aircraft?.label).toBe('A350-900');
    expect(
      homeSummary([record('type', undefined, { variant: '', aircraftType: 'A350' })], now).aircraft
        ?.label,
    ).toBe('A350');
    expect(
      homeSummary([record('missing', undefined, { variant: '', registration: 'A350-1000' })], now)
        .aircraft,
    ).toBeNull();
    const tied = [
      record('900', '2026-12-20', { variant: 'A350-900' }),
      record('1000', '2026-12-21'),
    ];
    expect(homeSummary(tied, now).aircraft?.label).toBe('A350-1000');
    tied[0].date = '2026-12-21';
    expect(homeSummary(tied.reverse(), now).aircraft?.label).toBe('A350-1000');
  });
  it('keeps missing/unknown data empty and rolls the HK window/Pending display across midnight independently of device timezone', () => {
    const missing = record('missing', undefined, { airline: '', variant: '' });
    expect(homeSummary([missing], now)).toMatchObject({ airline: null, aircraft: null });
    expect(
      homeSummary([record('unknown', undefined, { airline: 'Unknown custom airline' })], now)
        .airline,
    ).toBeNull();
    expect(homeSummary([record('old', '2020-01-01')], now)).toMatchObject({
      airline: null,
      aircraft: null,
    });
    const rows = [
      record('boundary', '2026-12-03'),
      record('pending', '2027-01-02', { status: 'Draft' }),
    ];
    const before = homeSummary(rows, Date.parse('2027-01-01T15:59:59Z'));
    const after = homeSummary(rows, Date.parse('2027-01-01T16:00:00Z'));
    expect([before.today, before.pending, before.airline?.count]).toEqual(['2027-01-01', 1, 1]);
    expect([after.today, after.pending, after.drafts, after.airline]).toEqual([
      '2027-01-02',
      0,
      1,
      null,
    ]);
    expect(rows[1].status).toBe('Draft');
  });
  it('updates actual Draft/Pending counts on confirmation, date edits and deletion, without inferring work from a Duty', () => {
    const rows = [
      record('draft', undefined, { status: 'Draft' }),
      record('pending', '2027-01-02', { status: 'Draft' }),
    ];
    expect(homeSummary(rows, now)).toMatchObject({ drafts: 1, pending: 1, lifetime: 0 });
    expect(homeSummary([{ ...rows[0], status: 'Confirmed' }, rows[1]], now)).toMatchObject({
      drafts: 0,
      pending: 1,
      lifetime: 1,
    });
    expect(
      homeSummary(
        [
          { ...rows[0], status: 'Trashed' },
          { ...rows[1], date: '2026-12-31' },
        ],
        now,
      ),
    ).toMatchObject({ drafts: 1, pending: 0 });
    expect(homeSummary([], now)).toMatchObject({
      drafts: 0,
      pending: 0,
      lifetime: 0,
      airline: null,
      aircraft: null,
    });
  });
});

it('renders neutral empty states, no ranking logos and updated counts from current props', () => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const view = render(<HomeInsights records={[]} onStats={() => {}} onUnfinished={() => {}} />);
  expect(screen.getAllByText('No data')).toHaveLength(2);
  expect(screen.getByText('All caught up')).toBeVisible();
  expect(view.container.querySelectorAll('img')).toHaveLength(0);
  view.rerender(
    <HomeInsights
      records={[record('draft', undefined, { status: 'Draft' })]}
      onStats={() => {}}
      onUnfinished={() => {}}
    />,
  );
  expect(screen.queryByText('All caught up')).toBeNull();
  expect(view.container.querySelector('.unfinished-counts dd')).toHaveTextContent('01');
});

it('opens Statistics/history and resets conflicting Logbook filters for real Draft+Pending navigation, without writing data', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-20T12:00:00+08:00'));
  const db = seedDatabase();
  db.duties.push({ ...db.duties[0], id: 'trashed-parent', status: 'Trashed' });
  db.aircraft.push(
    record('unfinished1', '2026-10-19', {
      status: 'Draft',
      airline: 'Lufthansa',
      dutyId: 'trashed-parent',
    }),
    record('unfinished2', '', { status: 'Draft', airline: '' }),
    record('future', '2026-10-21', { status: 'Draft', airline: 'Cathay Pacific' }),
    record('trashed', '2026-10-22', { status: 'Trashed' }),
  );
  const bytes = JSON.stringify(db);
  localStorage.setItem(STORAGE_KEY, bytes);
  const { container } = render(<App />);
  const nav = (name: string) =>
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name }));
  fireEvent.click(screen.getByRole('button', { name: 'View all stats' }));
  const statistics = container.querySelector('[data-page="statistics"]')!;
  expect(statistics).toHaveAttribute('data-active', 'true');
  expect([...statistics.querySelectorAll('.metrics strong')].map((e) => e.textContent)).toEqual([
    '04',
    '03',
    '02',
  ]);
  nav('Home');
  fireEvent.click(screen.getByRole('button', { name: 'View aircraft history' }));
  const logbook = container.querySelector<HTMLElement>('[data-page="logbook"]')!;
  expect(logbook.querySelectorAll('.aircraft-card')).toHaveLength(7);
  fireEvent.change(within(logbook).getByLabelText('Search records'), {
    target: { value: 'Qatar' },
  });
  fireEvent.click(within(logbook).getByRole('button', { name: 'Calendar' }));
  nav('Home');
  const unfinished = screen.getByRole('region', { name: 'Unfinished Records' });
  expect([...unfinished.querySelectorAll('dd')].map((e) => e.textContent)).toEqual(['02', '01']);
  fireEvent.click(within(unfinished).getByRole('button', { name: 'View unfinished records' }));
  expect(within(logbook).getByLabelText('Search records')).toHaveValue('');
  expect(within(logbook).getByLabelText('Handling record status')).toHaveValue('unfinished');
  expect(logbook.querySelectorAll('.aircraft-card')).toHaveLength(3);
  expect(logbook.textContent).not.toContain('CX9401');
  fireEvent.change(within(logbook).getByLabelText('Handling record status'), {
    target: { value: 'Pending' },
  });
  expect(logbook.querySelectorAll('.aircraft-card')).toHaveLength(1);
  fireEvent.click(within(logbook).getByRole('button', { name: 'Clear filters' }));
  expect(logbook.querySelectorAll('.aircraft-card')).toHaveLength(7);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
});
