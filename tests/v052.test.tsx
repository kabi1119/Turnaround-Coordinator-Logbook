import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import App from '../src/App';
import ConnectivityStatus from '../src/pwa/ConnectivityStatus';
import UpcomingShift from '../src/features/UpcomingShift';
import { seedDatabase } from '../src/data/seed';
import { STORAGE_KEY } from '../src/lib/storage';

it('keeps connectivity behavior while exposing distinct badge states and a larger icon', () => {
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  render(<ConnectivityStatus />);
  const status = screen.getByRole('status', { name: 'Connection status' });
  expect(status).toHaveAttribute('data-state', 'online');
  expect(status.querySelector('.connection-badge')).toHaveTextContent('Online');
  expect(status.querySelector('svg')).toHaveAttribute('width', '17');
  expect(status.querySelector('.connection-separator')).toHaveTextContent('·');
  expect(status.querySelector('.connection-separator')).toHaveAttribute('aria-hidden', 'true');
  expect(status.querySelector('.connection-local')).toHaveTextContent('Device only');
  online.mockReturnValue(false);
  fireEvent(window, new Event('offline'));
  expect(status).toHaveAttribute('data-state', 'offline');
  expect(status.querySelector('.connection-badge')).toHaveTextContent('Offline');
  expect(status).toHaveTextContent('Device only');
});

it('orders Home hero, Upcoming Shift, three metrics and secondary content without changing saved data', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-19T12:00:00+08:00'));
  const db = seedDatabase(),
    bytes = JSON.stringify(db);
  localStorage.setItem(STORAGE_KEY, bytes);
  const { container } = render(<App />);
  const home = container.querySelector('[data-page="home"]')!;
  const hero = home.querySelector('.home-intro')!;
  const upcoming = home.querySelector('.upcoming-shift')!;
  const metrics = home.querySelector('.home-metrics')!;
  const secondary = home.querySelector('.home-secondary')!;
  for (const [before, after] of [
    [hero, upcoming],
    [upcoming, metrics],
    [metrics, secondary],
  ])
    expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect([...metrics.querySelectorAll('strong')].map((el) => el.textContent)).toEqual([
    '03',
    'Cathay Pacific (CX)',
    'A321neo',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'View Duty' }));
  expect(screen.getByRole('dialog', { name: 'Duty · 2026-11-05' })).toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
});

it('retains overnight Scheduled presentation, linked record count and the exact Duty action', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-05T12:00:00+08:00'));
  const db = seedDatabase(),
    duty = { ...db.duties[2], start: '22:00', end: '06:00' };
  const aircraft = [{ ...db.aircraft[0], dutyId: duty.id }],
    onDuty = vi.fn();
  const before = JSON.stringify({ duty, aircraft });
  const { container } = render(
    <UpcomingShift duties={[duty]} aircraft={aircraft} onDuty={onDuty} onCalendar={() => {}} />,
  );
  expect(container.querySelector('.shift-summary time')).toHaveAttribute('datetime', duty.date);
  expect(container.querySelector('.shift-summary')).toHaveTextContent('November 2026');
  expect(container.querySelector('.duty-facts')).toHaveTextContent(
    'Start 22:00 · End 06:00 (+1 day) HKT',
  );
  expect(container.querySelector('.duty-facts')).toHaveTextContent('1 records');
  expect(screen.getByText('Scheduled')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View Duty' }));
  expect(onDuty).toHaveBeenCalledWith(duty);
  expect(JSON.stringify({ duty, aircraft })).toBe(before);
});
