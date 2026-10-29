import { render, screen, within } from '@testing-library/react';
import { it, expect } from 'vitest';
import App from '../src/App';
import { seedDatabase } from '../src/data/seed';
import { STORAGE_KEY } from '../src/lib/storage';
it('keeps natural Home stacks in reading order and moves timezone/sample disclosure into the footer', () => {
  const raw = JSON.stringify(seedDatabase());
  localStorage.setItem(STORAGE_KEY, raw);
  const { container } = render(<App />);
  const left = container.querySelector('.home-left')!,
    right = container.querySelector('.home-right')!;
  expect([...left.children].map((e) => e.className)).toEqual([
    'home-statistics',
    'panel home-unfinished surface-dark',
  ]);
  expect([...right.children].map((e) => e.className)).toEqual(['home-recent', 'home-secondary']);
  expect(right.querySelectorAll('.aircraft-card')).toHaveLength(4);
  expect(container.querySelector('.home-footnote')).toBeNull();
  const footer = container.querySelector('footer')!;
  expect(within(footer).getByText('Asia/Hong_Kong')).toBeInTheDocument();
  expect(within(footer).getByText('Includes fictional sample records.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Write a reflection' })).toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});
