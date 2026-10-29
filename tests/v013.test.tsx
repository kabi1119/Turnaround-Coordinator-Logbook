import { Profiler } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { airlineCatalogue, searchAirlines, displayLogoPath } from '../src/data/airlineCatalogue';
import { airlineRegistry, findAirline } from '../src/data/airlines';
// Preserve the historical fixture for v0.1.0–v0.1.3 compatibility regression assertions.
import { legacySeedDatabase as seedDatabase } from '../src/data/legacySeed';
import {
  legacyDemoAirlines,
  demoAirlineRefreshPlan,
  refreshDemoAirlines,
} from '../src/data/demoRefresh';
import { stats } from '../src/domain/selectors';
import { loadDatabase, STORAGE_KEY } from '../src/lib/storage';
import App from '../src/App';
import AircraftEditor from '../src/features/AircraftEditor';
import DemoAirlineRefresh from '../src/features/DemoAirlineRefresh';
import AircraftDetails from '../src/features/AircraftDetails';
import * as DetailModule from '../src/features/AircraftDetails';
import HongKongClock from '../src/components/HongKongClock';
import { Modal } from '../src/components/ui';
import { logoBounds } from '../src/data/logoBounds';

const codes = [
  '7C',
  '9G',
  'AK',
  'BI',
  'CX',
  'D7',
  'DL',
  'FJ',
  'GK',
  'JL',
  'JX',
  'KE',
  'LD',
  'LH',
  'LX',
  'MS',
  'PG',
  'PX',
  'QR',
  'QZ',
  'RJ',
  'S7',
  'UO',
  'Z2',
];
describe('v0.1.3 owner-defined catalogue', () => {
  it('Has exactly the requested 24 identities and shared asset mappings, excluding old defaults', () => {
    expect(airlineCatalogue.map((a) => a.iata)).toEqual(codes);
    expect(airlineRegistry.map((a) => a.iata)).toEqual(codes);
    expect(new Set(airlineRegistry.map((a) => a.name)).size).toBe(24);
    expect(searchAirlines('')).toHaveLength(24);
    for (const code of codes) {
      const a = searchAirlines(code).find((a) => a.iata === code)!;
      expect(a).toBeDefined();
      expect(displayLogoPath(a)).toBe(`/assets/airlines/${code}.png`);
    }
    for (const code of ['NH', 'SQ', 'HX', 'EK'])
      expect(searchAirlines('').some((a) => a.iata === code)).toBe(false);
    expect(searchAirlines('phuquoc')[0].iata).toBe('9G');
    expect(searchAirlines('AirAsia').map((a) => a.iata)).toEqual(['AK', 'D7', 'QZ', 'Z2']);
    expect(findAirline('HX')?.name).toBe('Hong Kong Airlines');
  });
  it('Entry combobox exposes all 24 by default, filters codes and keeps custom/historical text editable', () => {
    const db = seedDatabase();
    const view = render(
      <AircraftEditor db={db} commit={() => true} onClose={() => {}} onSaved={() => {}} />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Airline *' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(24);
    fireEvent.change(screen.getByLabelText('Airline *'), { target: { value: 'LD' } });
    expect(screen.getByRole('option', { name: 'Air Hong Kong LD' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Airline *'), {
      target: { value: 'DEMO custom carrier' },
    });
    expect(screen.getByLabelText('Airline *')).toHaveValue('DEMO custom carrier');
    view.unmount();
    const old = seedDatabase(legacyDemoAirlines).aircraft[2];
    render(
      <AircraftEditor
        db={db}
        existing={old}
        commit={() => true}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(screen.getByLabelText('Airline *')).toHaveValue('Hong Kong Airlines');
  });
  it('Fresh synthetic fixtures retain workload variety and links without excluded airlines', () => {
    const db = seedDatabase(),
      old = seedDatabase(legacyDemoAirlines);
    expect(db.aircraft.every((a) => airlineCatalogue.some((i) => i.name === a.airline))).toBe(true);
    expect(
      new Set(
        db.aircraft.filter((a) => a.status === 'Confirmed').map((a) => `${a.role}|${a.handling}`),
      ).size,
    ).toBe(9);
    expect(stats(db.aircraft, db.duties)).toEqual(stats(old.aircraft, old.duties));
    expect(db.duties).toEqual(old.duties);
    expect(db.journals).toEqual(old.journals);
  });
});
describe('Conservative, reviewed demo-airline refresh', () => {
  it('Never updates on load; updates only full exact legacy fixture matches and is idempotent', () => {
    const db = seedDatabase(legacyDemoAirlines);
    db.aircraft[2].notes = 'User edited sample';
    expect(db.aircraft[4].registration).not.toBe('');
    db.aircraft[4].registration = ''; // Privacy deletion must not be reversed.
    db.aircraft.push({ ...db.aircraft[4], id: 'user-created', notes: 'Personal custom entry' });
    const before = structuredClone(db);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    expect(loadDatabase().db).toEqual(before);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(before));
    const plan = demoAirlineRefreshPlan(db);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.some((p) => ['a3', 'a5', 'user-created'].includes(p.id))).toBe(false);
    const next = refreshDemoAirlines(
      db,
      plan.map((p) => p.id),
    );
    expect(next.aircraft).toHaveLength(db.aircraft.length);
    for (const id of ['a3', 'a5', 'user-created'])
      expect(next.aircraft.find((a) => a.id === id)).toEqual(
        before.aircraft.find((a) => a.id === id),
      );
    expect(next.duties).toBe(db.duties);
    expect(next.journals).toBe(db.journals);
    expect(stats(next.aircraft, next.duties)).toEqual(stats(before.aircraft, before.duties));
    expect(demoAirlineRefreshPlan(next)).toEqual([]);
    expect(
      refreshDemoAirlines(
        next,
        plan.map((p) => p.id),
      ),
    ).toEqual(next);
    expect(db).toEqual(before);
  });
  it('Rechecks eligibility at confirmation and does not infer identity from demo IDs/labels alone', () => {
    const db = seedDatabase(legacyDemoAirlines),
      plan = demoAirlineRefreshPlan(db);
    db.aircraft.find((a) => a.id === plan[0].id)!.notes = 'Changed since preview';
    expect(
      refreshDemoAirlines(
        db,
        plan.map((p) => p.id),
      ).aircraft.find((a) => a.id === plan[0].id),
    ).toEqual(db.aircraft.find((a) => a.id === plan[0].id));
  });
  it('Requires preview approval, cancellation writes nothing, and Settings exposes the safe action', () => {
    const db = seedDatabase(legacyDemoAirlines),
      commit = vi.fn(() => true),
      close = vi.fn();
    const view = render(<DemoAirlineRefresh db={db} commit={commit} onClose={close} />);
    const confirm = screen.getByRole('button', { name: 'Confirm sample refresh' });
    expect(confirm).toBeDisabled();
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(close).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByLabelText('I reviewed the replacements, new dates and relationship impact.'),
    );
    fireEvent.click(confirm);
    expect(commit).toHaveBeenCalledOnce();
    expect((commit.mock.calls[0] as unknown as [typeof db])[0].aircraft).toHaveLength(4);
    view.unmount();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: 'Refresh sample records' })).toBeInTheDocument();
  });
});
describe('Modal isolation, scroll stability and artwork bounds', () => {
  it('Actual Home detail stays stable through live header clock updates', () => {
    vi.useFakeTimers();
    const ActualDetails = AircraftDetails,
      rendered = vi.fn();
    vi.spyOn(DetailModule, 'default').mockImplementation((props) => (
      <Profiler id="app-detail" onRender={rendered}>
        <ActualDetails {...props} />
      </Profiler>
    ));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seedDatabase()));
      const view = render(<App />);
      fireEvent.click(document.querySelector('.aircraft-card')!);
      const dialog = screen.getByRole('dialog', { name: 'Handling Record' });
      dialog.scrollTop = 200;
      const calls = rendered.mock.calls.length;
      expect(calls).toBeGreaterThan(0);
      act(() => {
        vi.advanceTimersByTime(2200);
      });
      expect(rendered).toHaveBeenCalledTimes(calls);
      expect(dialog.scrollTop).toBe(200);
      view.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
  it('Clock ticks do not rerender stable detail content or reset dialog scrolling', () => {
    vi.useFakeTimers();
    const db = seedDatabase(),
      rendered = vi.fn();
    try {
      const view = render(
        <>
          <HongKongClock />
          <Modal title="Detail performance test" onClose={() => {}}>
            <Profiler id="details" onRender={rendered}>
              <AircraftDetails a={db.aircraft[0]} db={db} />
            </Profiler>
          </Modal>
        </>,
      );
      const dialog = screen.getByRole('dialog');
      dialog.scrollTop = 180;
      const calls = rendered.mock.calls.length;
      act(() => {
        vi.advanceTimersByTime(3100);
      });
      expect(rendered).toHaveBeenCalledTimes(calls);
      expect(dialog.scrollTop).toBe(180);
      expect(within(dialog).getByRole('heading', { name: 'Relationships' })).toBeInTheDocument();
      view.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
  it('Locks background for nested dialogs, preserves focus and handles native Escape cancellation', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const close = vi.fn();
    const view = render(
      <Modal title="Outer" onClose={close}>
        <Modal title="Inner" onClose={() => {}}>
          Nested
        </Modal>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement).toHaveClass('modal-open');
    view.rerender(
      <Modal title="Outer" onClose={close}>
        Remaining
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(close).toHaveBeenCalledOnce();
    view.unmount();
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement).not.toHaveClass('modal-open');
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
  it('Padded bounds stay inside each immutable source and representative wordmarks/symbols are measured', () => {
    for (const code of codes) {
      const [w, h, x, y, bw, bh] = logoBounds(code)!;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + bw).toBeLessThanOrEqual(w);
      expect(y + bh).toBeLessThanOrEqual(h);
    }
    for (const code of ['CX', 'UO', 'LH', 'LD', 'JL', 'QR']) expect(logoBounds(code)).toBeDefined();
  });
});
