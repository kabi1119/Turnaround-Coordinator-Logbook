import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { v014SeedDatabase as seedDatabase } from '../src/data/v014Seed';
import { legacySeedDatabase } from '../src/data/legacySeed';
import { legacyDemoAirlines } from '../src/data/demoRefresh';
import { applyDemoDataset, demoDatasetPlan, isCurrentDemo } from '../src/data/demoDatasetRefresh';
import { airlineCatalogue, findCatalogueAirline } from '../src/data/airlineCatalogue';
import { gateSuggestion, stats } from '../src/domain/selectors';
import { previousDuties, shiftRange } from '../src/domain/roster';
import { loadDatabase, STORAGE_KEY, writeDatabase } from '../src/lib/storage';
import AirlineCombobox from '../src/components/AirlineCombobox';
import AircraftEditor from '../src/features/AircraftEditor';
import DemoAirlineRefresh from '../src/features/DemoAirlineRefresh';
import DutyHistory from '../src/features/DutyHistory';
import DemoScope from '../src/components/DemoScope';
import App from '../src/App';
import { LanguageContext } from '../src/i18n';
import type { Database } from '../src/domain/model';

function assertLinks(db: Database) {
  for (const a of db.aircraft) {
    if (a.dutyId) expect(db.duties.some((d) => d.id === a.dutyId)).toBe(true);
    for (const e of a.events)
      if (e.journalId) expect(db.journals.some((j) => j.id === e.journalId)).toBe(true);
  }
  for (const j of db.journals) {
    if (j.dutyId) expect(db.duties.some((d) => d.id === j.dutyId)).toBe(true);
    for (const id of j.aircraftIds) expect(db.aircraft.some((a) => a.id === id)).toBe(true);
  }
}
describe('v0.1.4 image combobox', () => {
  it('Lists exactly 24 distinct options, local image/code/name associations and unchanged legal status', () => {
    render(<AirlineCombobox value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show airline options' }));
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(24);
    for (const a of airlineCatalogue) {
      const option = screen.getByRole('option', { name: `${a.name} ${a.iata}` });
      expect(option.querySelector('img')).toHaveAttribute('src', `/assets/airlines/${a.iata}.png`);
      expect(a.redistributionPermission).toBe('unverified');
    }
    expect(new Set(options.map((o) => o.id)).size).toBe(24);
  });
  it('Filters names/codes and confirms ArrowDown/Enter without submitting the Aircraft form', () => {
    render(
      <AircraftEditor
        db={seedDatabase()}
        commit={() => true}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Airline *' });
    fireEvent.change(input, { target: { value: 'phuquoc' } });
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
    fireEvent.change(input, { target: { value: 'CX' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(
      document.getElementById(input.getAttribute('aria-activedescendant')!)!,
    ).toHaveTextContent('Cathay Pacific');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('Cathay Pacific');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: 'Review Handling Record' })).toBeNull();
  });
  it('ArrowUp scrolls the last mounted option into view; Escape retains the editor', () => {
    const close = vi.fn();
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(
      <AircraftEditor db={seedDatabase()} commit={() => true} onClose={close} onSaved={() => {}} />,
    );
    const input = screen.getByRole('combobox', { name: 'Airline *' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(
      document.getElementById(input.getAttribute('aria-activedescendant')!)!,
    ).toHaveTextContent('SWISS International Air Lines');
    expect(scroll).toHaveBeenLastCalledWith({ block: 'nearest' });
    expect(scroll.mock.contexts.at(-1)).toBe(
      document.getElementById(input.getAttribute('aria-activedescendant')!),
    );
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'New Handling Record' })).toBeInTheDocument();
  });
  it.each(['mouse', 'touch'] as const)(
    'Selects with %s and returns focus to the input',
    async (kind) => {
      const user = userEvent.setup(),
        change = vi.fn();
      render(<AirlineCombobox value="" onChange={change} />);
      await user.click(screen.getByRole('combobox'));
      const option = screen.getByRole('option', { name: 'Japan Airlines JL' });
      if (kind === 'mouse') await user.click(option);
      else
        await user.pointer([
          { keys: '[TouchA>]', target: option },
          { keys: '[/TouchA]', target: option },
        ]);
      expect(change).toHaveBeenLastCalledWith('Japan Airlines');
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(screen.getByRole('combobox')).toHaveFocus();
    },
  );
  it('Preserves historical/custom names and falls back to code on image failure', () => {
    const change = vi.fn();
    const view = render(<AirlineCombobox value="Hong Kong Airlines" onChange={change} />);
    expect(screen.getByRole('combobox')).toHaveValue('Hong Kong Airlines');
    expect(document.querySelector('.code-fallback')).toHaveTextContent('HX');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'DEMO custom airline' } });
    expect(change).toHaveBeenLastCalledWith('DEMO custom airline');
    expect(screen.getByRole('status')).toHaveTextContent('Custom text is kept');
    view.rerender(<AirlineCombobox value="CX" onChange={change} />);
    fireEvent.click(screen.getByRole('combobox'));
    const option = screen.getByRole('option', { name: 'Cathay Pacific CX' });
    fireEvent.error(option.querySelector('img')!);
    expect(option.querySelector('.code-fallback')).toHaveTextContent('CX');
    expect(option.querySelector('img')).toBeNull();
  });
});

describe('v0.1.4 deterministic synthetic data and reviewed refresh', () => {
  it('Generates exactly one assignment per catalogue identity on 24 distinct HK dates', () => {
    const db = seedDatabase();
    expect(db.aircraft).toHaveLength(24);
    expect(db.aircraft.map((a) => findCatalogueAirline(a.airline)?.iata).sort()).toEqual(
      airlineCatalogue.map((a) => a.iata).sort(),
    );
    expect(new Set(db.aircraft.map((a) => a.date)).size).toBe(24);
    expect(new Set(db.aircraft.map((a) => `${a.role}|${a.handling}`)).size).toBe(9);
    for (const a of db.aircraft) {
      expect(a.registration).toMatch(/^DEMO-/);
      expect(a.arrival.flight).toMatch(/^DEMO-/);
      expect(a.departure.flight).toMatch(/^DEMO-/);
      expect(a.variant).toBeTruthy();
      expect(a.actualHandling).toBe(true);
      for (const leg of [a.arrival, a.departure])
        if (leg.actual) expect(gateSuggestion(leg.scheduled, leg.actual)).toBe(leg.status);
    }
    expect(db).toEqual(seedDatabase());
    expect(db.duties.filter((d) => d.date === '2026-10-16')).toHaveLength(2);
    expect(shiftRange(db.duties.find((d) => d.id === 'd3')!)?.overnight).toBe(true);
    assertLinks(db);
  });
  it('Derives 24 Logged / 18 Handled / 9 Primary, disjoint types and mixed totals from records', () => {
    const db = seedDatabase();
    const s = stats(db.aircraft, db.duties);
    expect(s).toMatchObject({ logged: 24, handled: 18, primary: 9, training: 6 });
    expect(s.types.map((t) => t.logged)).toEqual([8, 8, 8]);
    expect(s.types.reduce((n, t) => n + t.handled, 0)).toBe(18);
    const custom = {
      ...db.aircraft[0],
      id: 'user-created',
      airline: 'Singapore Airlines',
      notes: 'Personal synthetic exercise',
    };
    db.aircraft.push(custom);
    expect(stats(db.aircraft).logged).toBe(25);
    expect(stats(db.aircraft.filter(isCurrentDemo)).logged).toBe(24);
    render(<DemoScope rows={db.aircraft} />);
    expect(screen.getByText(/Metrics above cover all matching records/)).toHaveTextContent(
      '24 / 18 / 9',
    );
  });
  it.each(['v0.1.1', 'v0.1.3'])(
    'Loads %s without rewriting and refreshes only after review, preserving user rows/links',
    (version) => {
      const db = legacySeedDatabase(version === 'v0.1.1' ? legacyDemoAirlines : undefined);
      const userAircraft = {
        ...db.aircraft[0],
        id: 'user-aircraft',
        airline: 'Singapore Airlines',
        notes: 'User-entered synthetic exercise',
        events: db.aircraft[0].events.map((e) => ({ ...e, id: `user-${e.id}` })),
      };
      const userJournal = {
        ...db.journals[0],
        id: 'user-journal',
        title: 'My exercise',
        aircraftIds: ['a3', 'user-aircraft'],
      };
      db.aircraft.push(userAircraft);
      db.journals.push(userJournal);
      const before = structuredClone(db);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      expect(loadDatabase().db).toEqual(before);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(before));
      const plan = demoDatasetPlan(db);
      expect(plan.replace).toHaveLength(18);
      expect(plan.generate).toHaveLength(24);
      expect(plan.blocked).toEqual([]);
      expect(plan.eventsRemoved).toBe(3);
      const next = applyDemoDataset(db, plan.token)!;
      expect(next.aircraft).toHaveLength(25);
      expect(next.aircraft.filter(isCurrentDemo)).toHaveLength(24);
      expect(next.aircraft.find((a) => a.id === 'user-aircraft')).toEqual(userAircraft);
      expect(next.journals).toEqual(before.journals);
      for (const d of before.duties) expect(next.duties.find((s) => s.id === d.id)).toEqual(d);
      expect(next.settings).toEqual(before.settings);
      assertLinks(next);
      const again = applyDemoDataset(next, demoDatasetPlan(next).token)!;
      expect(again).toEqual(next);
      expect(demoDatasetPlan(again).generate).toEqual([]);
      expect(again.aircraft.flatMap((a) => a.events).filter((e) => e.id === 'e1')).toHaveLength(1);
      const events = again.aircraft.flatMap((a) => a.events);
      expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
      expect(writeDatabase(next)).toBe(true);
      expect(loadDatabase().db).toEqual(next);
      expect(db).toEqual(before);
    },
  );
  it.each(['notes', 'registration'] as const)(
    'Blocks an edited/deleted %s field instead of guessing from a demo ID',
    (field) => {
      const db = legacySeedDatabase(legacyDemoAirlines);
      db.aircraft[2][field] = field === 'registration' ? '' : 'User changes';
      const before = structuredClone(db),
        plan = demoDatasetPlan(db);
      expect(plan.blocked).toContain('a3');
      expect(applyDemoDataset(db, plan.token)).toBeNull();
      expect(db).toEqual(before);
    },
  );
  it('Rejects stale previews, duplicate IDs and wrong-date Duty collisions without mutation', () => {
    const db = legacySeedDatabase(),
      token = demoDatasetPlan(db).token;
    db.journals[0].title = 'Changed after review';
    expect(applyDemoDataset(db, token)).toBeNull();
    db.aircraft.push({ ...db.aircraft[0] });
    expect(demoDatasetPlan(db).blocked).toContain('a1');
    db.aircraft.pop();
    db.duties[0].date = '2026-01-01';
    expect(demoDatasetPlan(db).blocked).toContain('d1');
  });
  it('Requires confirmation, resists double submission and reports persistence failure', () => {
    const db = legacySeedDatabase(legacyDemoAirlines),
      commit = vi.fn(() => true),
      close = vi.fn();
    const view = render(<DemoAirlineRefresh db={db} commit={commit} onClose={close} />);
    const confirm = screen.getByRole('button', { name: 'Confirm sample refresh' });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Hong Kong Airlines');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(commit).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    view.unmount();
    render(<DemoAirlineRefresh db={db} commit={() => false} onClose={close} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm sample refresh' }));
    expect(screen.getByRole('alert')).toHaveTextContent('No refresh was applied');
  });
  it.each(['en', 'zh-HK'] as const)(
    'An edited current demo is blocked without a false up-to-date claim in %s',
    (language) => {
      const db = seedDatabase(),
        commit = vi.fn(() => true);
      db.aircraft[0].notes = 'User-edited synthetic example';
      const before = structuredClone(db);
      expect(demoDatasetPlan(db).generate).toHaveLength(0);
      expect(demoDatasetPlan(db).blocked).toEqual(['a1']);
      render(
        <LanguageContext.Provider value={language}>
          <DemoAirlineRefresh db={db} commit={commit} onClose={() => {}} />
        </LanguageContext.Provider>,
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        language === 'en' ? 'Refresh blocked' : '無法更新',
      );
      expect(
        screen.queryByText(
          language === 'en'
            ? 'The 24-airline dataset is already current. No refresh is needed.'
            : '24 家航空公司示範資料已是最新，毋須更新。',
        ),
      ).toBeNull();
      fireEvent.click(screen.getByRole('checkbox'));
      const confirm = screen.getByRole('button', {
        name: language === 'en' ? 'Confirm sample refresh' : '確認更新樣本',
      });
      expect(confirm).toBeDisabled();
      fireEvent.click(confirm);
      expect(commit).not.toHaveBeenCalled();
      expect(db).toEqual(before);
    },
  );
  it('A changed database cannot reuse an already approved preview', () => {
    const db = legacySeedDatabase(),
      commit = vi.fn(() => true);
    const view = render(<DemoAirlineRefresh db={db} commit={commit} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    const next = structuredClone(db);
    next.journals[0].learning = 'New edit';
    view.rerender(<DemoAirlineRefresh db={next} commit={commit} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm sample refresh' }));
    expect(commit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Preview changed');
  });
});

describe('v0.1.4 previous Duty navigation', () => {
  it('Uses past HK start time, latest first, preserves multiple same-day shifts and excludes future/Trash', () => {
    const base = legacySeedDatabase().duties[0];
    const rows = [
      { ...base, id: 'past-plan', date: '2026-10-15', workState: 'Planned' as const },
      { ...base, id: 'today', date: '2026-10-16', start: '06:00' },
      { ...base, id: 'later-today', date: '2026-10-16', start: '20:00' },
      { ...base, id: 'earlier', date: '2026-10-16', start: '05:00' },
      { ...base, id: 'future', date: '2026-10-17', workState: 'Planned' as const },
      { ...base, id: 'trash', status: 'Trashed' as const },
    ];
    expect(previousDuties(rows, Date.parse('2026-10-16T12:00:00+08:00')).map((d) => d.id)).toEqual([
      'today',
      'earlier',
      'past-plan',
    ]);
  });
  it('Home opens the existing calendar; central Add provides Duties without redundant Home actions', () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: 'Add Duty' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Batch Add Duties' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View Full Calendar' }));
    expect(screen.getByRole('dialog', { name: 'Full Duty Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Duty calendar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Return to Home' }));
    fireEvent.click(
      within(screen.getByRole('navigation')).getByRole('button', { name: 'Logbook' }),
    );
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('duty-row'))!);
    expect(screen.getByRole('dialog', { name: /Duty ·/ })).toHaveTextContent('Edit Duty');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /^Add Duties/ }));
    expect(screen.getByRole('dialog', { name: 'Add Duties' })).toBeInTheDocument();
  });
  it('Shows Planned/Worked, overnight end dates, an empty state and Traditional Chinese controls', () => {
    const db = legacySeedDatabase(),
      open = vi.fn();
    db.duties[2].workState = 'Planned';
    const view = render(
      <DutyHistory duties={[db.duties[2], db.duties[3]]} onDuty={open} onClose={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /2026-10-15/ })).toHaveTextContent('Planned');
    expect(screen.getByRole('dialog')).toHaveTextContent('(+1 · 2026-10-16)');
    expect(screen.getByRole('button', { name: /2026-10-14/ })).toHaveTextContent(
      'Draft · Not Recorded',
    );
    fireEvent.click(screen.getByRole('button', { name: /2026-10-15/ }));
    expect(open).toHaveBeenCalledWith(db.duties[2]);
    view.rerender(
      <LanguageContext.Provider value="zh-HK">
        <DutyHistory duties={[]} onDuty={open} onClose={() => {}} />
      </LanguageContext.Provider>,
    );
    expect(screen.getByRole('dialog', { name: '過往更次' })).toHaveTextContent('尚無過往更次');
  });
});
