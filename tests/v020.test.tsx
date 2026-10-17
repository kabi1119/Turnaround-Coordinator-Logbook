import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import Radar from '../src/components/Radar';
import { seedDatabase } from '../src/data/seed';
import { v014SeedDatabase } from '../src/data/v014Seed';
import { legacySeedDatabase } from '../src/data/legacySeed';
import { sampleRefreshPlan, refreshSamples } from '../src/data/sampleRefresh';
import { stats, hasArrival, hasDeparture, isComplete } from '../src/domain/selectors';
import { shiftRange } from '../src/domain/roster';
import { STORAGE_KEY } from '../src/lib/storage';
import DemoAirlineRefresh from '../src/features/DemoAirlineRefresh';
import type { Database } from '../src/domain/model';
import { LanguageContext } from '../src/i18n';
import BatchDutyEditor from '../src/features/BatchDutyEditor';

function assertLinks(db: Database) {
  for (const a of db.aircraft) {
    expect(db.duties.some((d) => d.id === a.dutyId)).toBe(true);
    for (const e of a.events)
      if (e.journalId) expect(db.journals.some((j) => j.id === e.journalId)).toBe(true);
  }
  for (const j of db.journals) {
    if (j.dutyId) expect(db.duties.some((d) => d.id === j.dutyId)).toBe(true);
    for (const id of j.aircraftIds) expect(db.aircraft.some((a) => a.id === id)).toBe(true);
  }
}

describe('v0.2.0 compact fictional samples', () => {
  it('Covers all handling types, roles and six statuses with four assignments and accurate work counts', () => {
    const db = seedDatabase();
    expect(db).toEqual(seedDatabase());
    expect(db.aircraft).toHaveLength(4);
    expect(db.duties).toHaveLength(3);
    expect(db.journals).toHaveLength(2);
    expect(db.aircraft.every(isComplete)).toBe(true);
    expect(new Set(db.aircraft.map((a) => a.handling)).size).toBe(3);
    expect(new Set(db.aircraft.map((a) => a.role)).size).toBe(3);
    const legs = db.aircraft.flatMap((a) => [
      ...(hasArrival(a) ? [a.arrival] : []),
      ...(hasDeparture(a) ? [a.departure] : []),
    ]);
    expect(new Set(legs.map((l) => l.status))).toEqual(
      new Set(['Early', 'On Time', 'Delayed', 'Cancelled', 'Not Recorded', 'Other']),
    );
    expect(stats(db.aircraft, db.duties)).toMatchObject({
      logged: 4,
      handled: 3,
      primary: 2,
      training: 1,
      duties: 2,
      events: 1,
    });
    expect(shiftRange(db.duties[1])).toMatchObject({ overnight: true, endDate: '2026-10-16' });
    expect(db.aircraft.filter((a) => a.dutyId === 'sample-day')).toHaveLength(2);
    expect(db.journals.some((j) => !j.dutyId && !j.aircraftIds.length)).toBe(true);
    expect(JSON.stringify(db)).not.toMatch(/demo/i);
    assertLinks(db);
  });
  it.each([legacySeedDatabase, v014SeedDatabase])(
    'Refreshes an untouched historical collection without orphaning links and is idempotent',
    (fixture) => {
      const old = fixture();
      const original = structuredClone(old);
      const plan = sampleRefreshPlan(old);
      expect(plan.blocked).toEqual([]);
      const next = refreshSamples(old, plan.token)!;
      expect(old).toEqual(original);
      expect(next.aircraft).toEqual(seedDatabase().aircraft);
      expect(next.duties).toEqual(seedDatabase().duties);
      expect(next.journals).toEqual(seedDatabase().journals);
      expect(next.settings).toEqual(old.settings);
      assertLinks(next);
      expect(sampleRefreshPlan(next).changed).toBe(false);
      expect(refreshSamples(next, sampleRefreshPlan(next).token)).toEqual(next);
    },
  );
  it('Preserves unrelated personal records and blocks edited samples, stale previews and personal links', () => {
    const old = v014SeedDatabase();
    const d = { ...seedDatabase().duties[0], id: 'personal-duty', notes: 'My hours' };
    const a = {
      ...seedDatabase().aircraft[0],
      id: 'personal-aircraft',
      dutyId: d.id,
      notes: 'My record',
    };
    const j = {
      ...seedDatabase().journals[1],
      id: 'personal-journal',
      aircraftIds: [a.id],
      dutyId: d.id,
    };
    old.duties.push(d);
    old.aircraft.push(a);
    old.journals.push(j);
    old.settings.language = 'zh-HK';
    const plan = sampleRefreshPlan(old);
    const next = refreshSamples(old, plan.token)!;
    expect(next.aircraft).toContainEqual(a);
    expect(next.duties).toContainEqual(d);
    expect(next.journals).toContainEqual(j);
    expect(next.settings.language).toBe('zh-HK');
    assertLinks(next);
    a.dutyId = old.duties[0].id;
    expect(sampleRefreshPlan(old).blocked).toContain(a.id);
    expect(refreshSamples(old, sampleRefreshPlan(old).token)).toBeNull();
    a.dutyId = d.id;
    j.aircraftIds = [old.aircraft[0].id];
    expect(sampleRefreshPlan(old).blocked).toContain(j.id);
    j.aircraftIds = [a.id];
    old.aircraft[0].notes += ' edited';
    expect(sampleRefreshPlan(old).blocked).toContain(old.aircraft[0].id);
    expect(refreshSamples(seedDatabase(), plan.token)).toBeNull();
    const current = seedDatabase();
    current.aircraft[0].notes += ' personal edit';
    expect(sampleRefreshPlan(current).blocked).toContain(current.aircraft[0].id);
  });
  it('Requires reviewed refresh confirmation, writes once and supports cancellation without writes', () => {
    const commit = vi.fn(() => true),
      close = vi.fn();
    const view = render(
      <DemoAirlineRefresh db={v014SeedDatabase()} commit={commit} onClose={close} />,
    );
    const confirm = screen.getByRole('button', { name: 'Confirm sample refresh' });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(commit).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0]).toEqual([
      expect.objectContaining({ aircraft: seedDatabase().aircraft }),
    ]);
    view.unmount();
  });
});

describe('v0.2.0 pre-release presentation', () => {
  it.each(['en', 'zh-HK'] as const)(
    'Removes the hours acknowledgement while retaining batch review in %s',
    (language) => {
      const db = seedDatabase();
      db.duties = [];
      const commit = vi.fn(() => true);
      render(
        <LanguageContext.Provider value={language}>
          <BatchDutyEditor db={db} commit={commit} onClose={() => {}} />
        </LanguageContext.Provider>,
      );
      expect(screen.queryByRole('checkbox')).toBeNull();
      fireEvent.change(
        screen.getByLabelText(language === 'en' ? 'Roster month and year' : '更表月份及年份'),
        { target: { value: '2026-11' } },
      );
      fireEvent.click(
        screen.getByRole('button', {
          name: language === 'en' ? 'Select 2026-11-05' : '選擇 2026-11-05',
        }),
      );
      fireEvent.change(
        screen.getByLabelText(language === 'en' ? 'Template start' : '範本開更時間'),
        { target: { value: '22:00' } },
      );
      fireEvent.change(screen.getByLabelText(language === 'en' ? 'Template end' : '範本完更時間'), {
        target: { value: '06:00' },
      });
      fireEvent.click(
        screen.getByRole('button', {
          name: language === 'en' ? 'Apply template to selected dates' : '套用範本至所選日期',
        }),
      );
      expect(commit).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', { name: language === 'en' ? 'Review Batch' : '覆核批次' }),
      );
      expect(screen.getByRole('dialog')).toHaveTextContent('2026-11-06');
      expect(commit).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', {
          name: language === 'en' ? 'Confirm & Save Batch' : '確認並儲存批次',
        }),
      );
      expect(commit).toHaveBeenCalledOnce();
      expect((commit.mock.calls[0] as unknown as [Database])[0].duties[0]).toMatchObject({
        date: '2026-11-05',
        start: '22:00',
        end: '06:00',
        workState: 'Planned',
      });
    },
  );
  it('Previews every affected entity without exposing historical internal labels', () => {
    render(<DemoAirlineRefresh db={v014SeedDatabase()} commit={() => true} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Review affected records'));
    for (const name of [
      'Aircraft to remove',
      'Aircraft to add',
      'Duties to remove',
      'Duties to add',
      'Journals to remove',
      'Journals to add',
    ])
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.getByRole('dialog').textContent).not.toMatch(/\bdemo\b/i);
  });
  it('Uses the full name only in the brand, compact release metadata and no showcase strip or DEMO labels in navigation', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.brand-name')).toHaveTextContent(
      'Turnaround Coordinator Logbook',
    );
    expect(container.querySelector('.demo-strip')).toBeNull();
    expect(container.querySelector('.nav-context')).toHaveTextContent('v0.3.0 Pre-release');
    const nav = screen.getByRole('navigation');
    for (const page of ['Home', 'Logbook', 'Statistics', 'Journal']) {
      fireEvent.click(within(nav).getByRole('button', { name: page }));
      expect(container.textContent).not.toMatch(/\bdemo\b/i);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(container.textContent).not.toMatch(/\bdemo\b/i);
    expect(container.textContent).toMatch(/fictional/i);
  });
  it('Does not automatically replace or write existing browser records on load', () => {
    const old = v014SeedDatabase();
    old.aircraft[0].notes = 'My personal edits';
    const raw = JSON.stringify(old);
    localStorage.setItem(STORAGE_KEY, raw);
    render(<App />);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('Renders a decorative local map with all requested regions and an independent CSS sweep', () => {
    const { container } = render(<Radar />);
    expect(
      [...container.querySelectorAll('[data-region]')].map((p) => p.getAttribute('data-region')),
    ).toEqual(['china', 'korea', 'japan', 'taiwan', 'philippines', 'vietnam']);
    expect(container.querySelector('image, iframe, canvas, [href]')).toBeNull();
    expect(container.querySelector('.flight-visual')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.map-hkg')).toHaveAttribute('cx', '220');
    expect(container.querySelector('.radar-sweep')).not.toBeNull();
  });
});
