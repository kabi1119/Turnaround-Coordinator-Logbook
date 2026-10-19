import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from '../src/App';
import { seedDatabase } from '../src/data/seed';
import { STORAGE_KEY } from '../src/lib/storage';

it('groups the same three Home metrics in a single accessible summary without writing records', () => {
  const db = seedDatabase(),
    bytes = JSON.stringify(db);
  localStorage.setItem(STORAGE_KEY, bytes);
  const { container } = render(<App />);
  const summary = screen.getByRole('region', { name: 'Handling summary' });
  expect(container.querySelectorAll('.home-metrics')).toHaveLength(1);
  const rows = [...summary.querySelectorAll('.metric')];
  expect(rows).toHaveLength(3);
  expect(rows.map((row) => row.querySelector('.metric-label')?.textContent)).toEqual([
    'Total Aircraft Logged',
    'Total Aircraft Handled',
    'Primary Coordinator',
  ]);
  expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual(['04', '03', '02']);
  for (const detail of [
    'Every confirmed assignment',
    'Primary + Supporting',
    'A subset of Logged & Handled',
  ])
    expect(within(summary).getByText(detail)).toBeVisible();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
});

it('keeps the grouped summary readable and fully localized in Traditional Chinese', () => {
  const db = seedDatabase();
  db.settings.language = 'zh-HK';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  render(<App />);
  const summary = screen.getByRole('region', { name: '處理紀錄摘要' });
  expect(screen.getByRole('heading', { name: '處理統計' })).toBeVisible();
  for (const label of ['航機記錄總數', '航機處理總數', '主要協調員'])
    expect(within(summary).getByText(label)).toBeVisible();
  expect(within(summary).queryByText('Total Aircraft Logged')).toBeNull();
});
