import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import App from '../src/App';
import { seedDatabase } from '../src/data/seed';
import { STORAGE_KEY } from '../src/lib/storage';

it('groups the same three Home metrics in a single accessible summary without writing records', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-20T12:00:00+08:00'));
  const db = seedDatabase(),
    bytes = JSON.stringify(db);
  localStorage.setItem(STORAGE_KEY, bytes);
  const { container } = render(<App />);
  const summary = screen.getByRole('region', { name: 'Handling summary' });
  expect(container.querySelectorAll('.home-metrics')).toHaveLength(1);
  const rows = [...summary.querySelectorAll('.metric')];
  expect(rows).toHaveLength(3);
  expect(rows.map((row) => row.querySelector('.metric-label')?.textContent)).toEqual([
    'Lifetime Aircraft Handled',
    'Most Frequent Airline · Last 30 Days',
    'Most Frequent Aircraft · Last 30 Days',
  ]);
  expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual([
    '03',
    'Cathay Pacific (CX)',
    'A321neo',
  ]);
  for (const detail of ['Confirmed · Primary + Supporting', '1 qualifying handlings'])
    for (const element of within(summary).getAllByText(detail)) expect(element).toBeVisible();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
});

it('keeps the grouped summary readable and fully localized in Traditional Chinese', () => {
  const db = seedDatabase();
  db.settings.language = 'zh-HK';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  render(<App />);
  const summary = screen.getByRole('region', { name: '處理紀錄摘要' });
  expect(screen.getByRole('heading', { name: '處理統計' })).toBeVisible();
  for (const label of [
    '累計航機處理數',
    '最常處理航空公司 · 過去 30 天',
    '最常處理航機 · 過去 30 天',
  ])
    expect(within(summary).getByText(label)).toBeVisible();
  expect(within(summary).queryByText('Total Aircraft Logged')).toBeNull();
});
