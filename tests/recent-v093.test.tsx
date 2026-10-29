import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { recentAircraft } from '../src/domain/recentAircraft';
import { emptyAircraft, type Aircraft } from '../src/domain/model';
import { emptyGuestDatabase, STORAGE_KEY } from '../src/lib/storage';

const row = (id: string, date: string, patch: Partial<Aircraft> = {}): Aircraft => ({
  ...emptyAircraft(date),
  id,
  airline: 'Cathay Pacific',
  variant: 'A350-1000',
  ...patch,
});
afterEach(() => vi.useRealTimers());

describe('Home seven HK calendar days, display only', () => {
  it('includes both boundaries across year end; excludes older, future, invalid and Trashed dates', () => {
    const records = [
      row('today', '2027-01-01'),
      row('first', '2026-12-26'),
      row('old', '2026-12-25'),
      row('future', '2027-01-02'),
      row('invalid', '2026-12-32'),
      row('undated', ''),
      row('trash', '2027-01-01', { status: 'Trashed' }),
    ];
    const original = JSON.stringify(records);
    expect(recentAircraft(records, '2027-01-01').map((a) => a.id)).toEqual(['today', 'first']);
    expect(JSON.stringify(records)).toBe(original);
    expect(recentAircraft([row('leap', '2028-02-29')], '2028-03-06')).toHaveLength(1);
    expect(recentAircraft([row('leap', '2028-02-29')], '2028-03-07')).toHaveLength(0);
  });
  it('keeps existing Draft/Confirmed visibility, orders by handling date, edit time, stable ID and caps at four', () => {
    const records = [
      row('z', '2027-01-01'),
      row('a', '2027-01-01'),
      row('edited', '2027-01-01', { updatedAt: '2027-01-02T00:00:00Z' }),
      row('confirmed', '2026-12-31', { status: 'Confirmed' }),
      row('fifth', '2026-12-30'),
    ];
    expect(recentAircraft(records, '2027-01-01').map((a) => a.id)).toEqual([
      'edited',
      'a',
      'z',
      'confirmed',
    ]);
    expect(recentAircraft([...records].reverse(), '2027-01-01')).toEqual(
      recentAircraft(records, '2027-01-01'),
    );
  });
});

function setup(records: Aircraft[] = [], language: 'en' | 'zh-HK' = 'en') {
  const db = emptyGuestDatabase();
  db.aircraft = records;
  db.settings.language = language;
  const raw = JSON.stringify(db);
  localStorage.setItem(STORAGE_KEY, raw);
  const view = render(<App />);
  return { ...view, raw, recent: view.container.querySelector('.home-recent')! as HTMLElement };
}

it('keeps an empty panel, heading/history and keyboard CTA opening the existing editor without writing', async () => {
  const user = userEvent.setup();
  const { recent, raw } = setup();
  expect(within(recent).getByText('Your first assignment starts here.')).toBeVisible();
  expect(
    within(recent).getByText('Add your first handling record to begin your logbook.'),
  ).toBeVisible();
  expect(within(recent).getByRole('button', { name: 'View aircraft history' })).toBeVisible();
  within(recent).getByRole('button', { name: 'Add a Handling Record' }).focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('dialog', { name: 'New Handling Record' })).toBeVisible();
  expect(screen.getByLabelText('Airline *')).toBeVisible();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});

it.each(['en', 'zh-HK'] as const)(
  'uses contextual historical copy and clickable CTA in %s; History retains old records',
  (language) => {
    const { recent, container, raw } = setup([row('old', '2020-01-01')], language);
    expect(recent).toHaveTextContent(
      language === 'en' ? 'No aircraft records in the last 7 days.' : '最近七天沒有航機處理紀錄。',
    );
    expect(recent).not.toHaveTextContent('Your first assignment starts here.');
    fireEvent.click(
      within(recent).getByRole('button', {
        name: language === 'en' ? 'View aircraft history' : '查看航機歷史',
      }),
    );
    expect(container.querySelector('[data-page="logbook"] .aircraft-card')).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  },
);

it('updates at HK midnight and on foreground resume, preserving stored bytes', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2027-01-01T15:59:59Z'));
  const { recent, raw } = setup([row('boundary', '2026-12-26'), row('future', '2027-01-02')]);
  expect(recent.querySelectorAll('.aircraft-card')).toHaveLength(1);
  act(() => vi.advanceTimersByTime(1100));
  expect(recent).toHaveTextContent('2027-01-02');
  expect(recent).not.toHaveTextContent('2026-12-26');
  expect(recent.querySelectorAll('.aircraft-card')).toHaveLength(1);
  vi.setSystemTime(new Date('2027-01-10T00:00:00Z'));
  fireEvent(window, new Event('focus'));
  expect(recent.querySelectorAll('.aircraft-card')).toHaveLength(0);
  vi.setSystemTime(new Date('2027-01-01T12:00:00Z'));
  fireEvent(document, new Event('visibilitychange'));
  expect(recent.querySelectorAll('.aircraft-card')).toHaveLength(1);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});
