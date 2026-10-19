import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import AircraftEditor from '../src/features/AircraftEditor';
import DutyEditor from '../src/features/DutyEditor';
import { JournalEditor } from '../src/features/Journal';
import Statistics from '../src/features/Statistics';
import { seedDatabase } from '../src/data/seed';
import { hkToday, type Duty } from '../src/domain/model';
import { stats } from '../src/domain/selectors';
import { loadDatabase, STORAGE_KEY } from '../src/lib/storage';

const nav = (name: string) =>
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name }));
const initialize = () => {
  const db = seedDatabase();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  return db;
};

describe('v0.4.0 preserved navigation and authoritative presentation', () => {
  it('Preserves Logbook filters and scroll position across pages without remounting its controls', () => {
    initialize();
    const scroll = vi.spyOn(window, 'scrollTo');
    render(<App />);
    nav('Logbook');
    const input = screen.getByLabelText('Search records');
    fireEvent.change(input, { target: { value: 'Cathay' } });
    vi.stubGlobal('scrollY', 360);
    nav('Statistics');
    nav('Logbook');
    vi.unstubAllGlobals();
    expect(
      screen.getAllByLabelText('Search records').find((e) => e.closest('[data-active="true"]')),
    ).toBe(input);
    expect(input).toHaveValue('Cathay');
    expect(scroll).toHaveBeenLastCalledWith({ top: 360, behavior: 'instant' });
    expect(document.querySelector('[data-page="statistics"]')).toHaveAttribute('hidden');
  });
  it('Keeps the originating Duty scroll position when a linked Handling record opens and returns', () => {
    initialize();
    render(<App />);
    nav('Logbook');
    fireEvent.click(
      [...document.querySelectorAll('.duty-row')].find((el) =>
        el.textContent?.includes('2026-Oct-16'),
      )!,
    );
    const duty = screen.getByRole('dialog');
    duty.querySelector('.modal-body')!.scrollTop = 250;
    fireEvent.click(within(duty).getByRole('button', { name: /Cathay Pacific/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Duty' }));
    expect(screen.getByRole('dialog').querySelector('.modal-body')!.scrollTop).toBe(250);
  });
  it('A saved progress edit updates Duty, Full Calendar, Logbook and Statistics without reload', () => {
    const db = initialize(),
      date = hkToday(new Date(Date.now() - 86400000));
    const row: Duty = {
      id: 'reactive-duty',
      date,
      start: '00:00',
      end: '08:00',
      status: 'Confirmed',
      workState: 'Planned',
      notes: '',
    };
    db.duties = [row];
    db.aircraft = [];
    db.journals = [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    const view = render(<App />);
    nav('Logbook');
    fireEvent.click(document.querySelector('.duty-row')!);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Duty' }));
    fireEvent.change(screen.getByLabelText('Work state'), { target: { value: 'Worked' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Duty' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Worked');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(view.container.querySelector('.duty-row')).toHaveTextContent('Worked');
    nav('Home');
    fireEvent.click(screen.getByRole('button', { name: 'View Full Calendar' }));
    if (date.slice(0, 7) !== hkToday().slice(0, 7))
      fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(
      view.container.querySelector(`[data-date="${date}"] [data-duty-marker]`),
    ).toHaveAttribute('data-duty-marker', 'Worked');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    nav('Statistics');
    const totals = screen.getByRole('region', { name: 'Duty and leave totals' });
    expect(
      within(totals).getByText('Actual worked duty hours').previousElementSibling,
    ).toHaveTextContent('8.0');
    expect(
      within(totals).getByText('Scheduled duty hours').previousElementSibling,
    ).toHaveTextContent('0.0');
    expect(loadDatabase().db.duties).toEqual([{ ...row, workState: 'Worked' }]);
  });
  it('Chart transforms and visible figures always equal calculated results, including decreases after filters change', () => {
    const db = seedDatabase(),
      view = render(<Statistics db={db} onReport={() => {}} />);
    expect(view.container.querySelector('.metrics strong')).toHaveTextContent(
      String(stats(db.aircraft).logged).padStart(2, '0'),
    );
    const first = view.container.querySelector('.bar-track > div') as HTMLElement;
    expect(first.style.transform).toMatch(/^scaleX\(/);
    fireEvent.change(screen.getByLabelText('Search records'), { target: { value: 'Cathay' } });
    expect(view.container.querySelector('.metrics strong')).toHaveTextContent('01');
    expect(view.container.querySelector('.trend-column strong')).toHaveTextContent('1');
    fireEvent.change(screen.getByLabelText('Search records'), {
      target: { value: 'No matching aircraft' },
    });
    expect(view.container.querySelector('.metrics strong')).toHaveTextContent('00');
  });
  it('A failure after a prior successful save removes the stale success message and retains unsaved values', () => {
    initialize();
    render(<App />);
    nav('Logbook');
    fireEvent.click(
      [...document.querySelectorAll('.duty-row')].find((el) =>
        el.textContent?.includes('2026-Oct-16'),
      )!,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Duty' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Duty' }));
    expect(screen.getByRole('status', { name: 'Save result' })).toHaveTextContent(
      'Saved on this device',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Duty' }));
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Fictional unsaved revision' },
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw Error('quota');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Duty' }));
    expect(screen.queryByRole('status', { name: 'Save result' })).toBeNull();
    expect(screen.getByLabelText('Notes')).toHaveValue('Fictional unsaved revision');
    expect(loadDatabase().db.duties.find((d) => d.id === 'sample-day')?.notes).not.toBe(
      'Fictional unsaved revision',
    );
  });
});

describe('v0.4.0 shared dismissal and double-submit guards', () => {
  it('Animated review Back preserves input and scroll lock, then explicit discard closes without saving', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    try {
      const commit = vi.fn(() => true),
        close = vi.fn();
      const view = render(
        <AircraftEditor db={seedDatabase()} commit={commit} onSaved={() => {}} onClose={close} />,
      );
      fireEvent.change(screen.getByRole('combobox', { name: 'Airline *' }), {
        target: { value: 'Fictional edit' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
      fireEvent.click(screen.getByRole('button', { name: 'Back to Edit' }));
      expect(screen.getByRole('dialog', { name: 'Review Handling Record' })).toHaveClass('closing');
      expect(document.body.style.overflow).toBe('hidden');
      expect(commit).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(180));
      expect(screen.queryByRole('dialog', { name: 'Review Handling Record' })).toBeNull();
      expect(screen.getByRole('combobox', { name: 'Airline *' })).toHaveValue('Fictional edit');
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
      expect(close).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(180));
      expect(close).toHaveBeenCalledOnce();
      expect(commit).not.toHaveBeenCalled();
      view.unmount();
      expect(document.body.style.overflow).not.toBe('hidden');
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it('Reduced-motion dismissal is immediate and cannot bypass mandatory review', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    try {
      const commit = vi.fn(() => true);
      render(
        <AircraftEditor
          db={seedDatabase()}
          commit={commit}
          onSaved={() => {}}
          onClose={() => {}}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
      expect(commit).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Back to Edit' }));
      expect(screen.queryByRole('dialog', { name: 'Review Handling Record' })).toBeNull();
      expect(commit).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('Unmount cleans a pending close callback instead of navigating from an abandoned sheet', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    try {
      const close = vi.fn(),
        view = render(<DutyEditor db={seedDatabase()} onClose={close} commit={() => true} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      view.unmount();
      act(() => vi.advanceTimersByTime(500));
      expect(close).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it('Duty and Journal forms reject repeated submission while successful dismissal is pending', () => {
    const db = seedDatabase(),
      commit = vi.fn(() => true),
      view = render(
        <DutyEditor db={db} existing={db.duties[0]} onClose={() => {}} commit={commit} />,
      );
    const save = screen.getByRole('button', { name: 'Save Duty' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(commit).toHaveBeenCalledOnce();
    view.unmount();
    render(<JournalEditor db={db} existing={db.journals[0]} onClose={() => {}} commit={commit} />);
    const journal = screen.getByRole('button', { name: 'Save Journal' });
    fireEvent.click(journal);
    fireEvent.click(journal);
    expect(commit).toHaveBeenCalledTimes(2);
  });
});
