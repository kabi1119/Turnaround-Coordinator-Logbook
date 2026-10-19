import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import App from '../src/App';
import { seedDatabase } from '../src/data/seed';
import { STORAGE_KEY } from '../src/lib/storage';

it('keeps A above a shared B/C container and secondary content after the operational sections', () => {
  const bytes = JSON.stringify(seedDatabase());
  localStorage.setItem(STORAGE_KEY, bytes);
  const { container } = render(<App />);
  const home = container.querySelector('[data-page="home"]')!;
  const operations = home.querySelector('.home-operations')!;
  const stats = within(home as HTMLElement).getByRole('region', { name: 'Handling summary' });
  const recent = home.querySelector('.home-recent')!;
  expect([...operations.children]).toEqual([stats, recent]);
  expect(stats.querySelectorAll('.metric')).toHaveLength(3);
  expect([...stats.querySelectorAll('strong')].map((el) => el.textContent)).toEqual([
    '04',
    '03',
    '02',
  ]);
  const order = [
    home.querySelector('.home-intro')!,
    home.querySelector('.upcoming-shift')!,
    operations,
    home.querySelector('.home-secondary')!,
  ];
  for (let i = 1; i < order.length; i++)
    expect(
      order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  expect(recent.querySelectorAll('.aircraft-card')).toHaveLength(4);
  expect(home.querySelector('.home-secondary .journal-teaser')).not.toBeNull();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
});

it('retains keyboard View All navigation and the secondary Journal action', async () => {
  const { container } = render(<App />);
  const recent = container.querySelector('.home-recent') as HTMLElement;
  within(recent).getByRole('button', { name: 'View all' }).focus();
  await userEvent.setup().keyboard('{Enter}');
  expect(container.querySelector('[data-page="logbook"]')).toHaveAttribute('data-active', 'true');
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Home' }));
  fireEvent.click(screen.getByRole('button', { name: 'Write a reflection' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Career Journal');
});

it('requests a non-translucent installed status bar without removing viewport safe-area support', () => {
  const html = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');
  expect(html.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe(
    'width=device-width, initial-scale=1.0, viewport-fit=cover',
  );
  expect(
    html.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content'),
  ).toBe('yes');
  expect(
    html
      .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
      ?.getAttribute('content'),
  ).toBe('default');
  const { container } = render(<App />);
  const header = container.querySelector('.app-header')!;
  expect(header.previousElementSibling).toHaveClass('standalone-top-inset');
  expect(header.previousElementSibling).toHaveAttribute('aria-hidden', 'true');
});
