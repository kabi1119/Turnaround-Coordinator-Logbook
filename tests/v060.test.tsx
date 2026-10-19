import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AircraftEditor from '../src/features/AircraftEditor';
import AircraftDetails from '../src/features/AircraftDetails';
import { AircraftCard } from '../src/components/ui';
import { seedDatabase as baseSeed } from '../src/data/seed';
import { emptyAircraft, type Aircraft, type Database } from '../src/domain/model';
import { confirmedHandlingIssues, handlingDisplayStatus } from '../src/domain/handlingForm';
import { blockTimeParts, blockTimeValue } from '../src/domain/blockTime';
import { gateSuggestion, stats } from '../src/domain/selectors';
import { createBackup, parseBackup } from '../src/lib/backup';
import { LanguageContext } from '../src/i18n';
import { attestHandlingReview } from './handlingHelpers';

function seedDatabase() {
  const db = baseSeed();
  for (const key of Object.keys(db.settings.privacy) as (keyof typeof db.settings.privacy)[])
    db.settings.privacy[key] = true;
  return db;
}

const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
function setup(existing?: Aircraft, db = seedDatabase()) {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-02T12:00:00+08:00'));
  const commit = vi.fn<(next: Database) => boolean>(() => true);
  const view = render(
    <AircraftEditor
      db={db}
      existing={existing}
      commit={commit}
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  return {
    ...view,
    db,
    commit,
    saved: () =>
      commit.mock.calls.at(-1)![0].aircraft.find((a) => a.id === existing?.id) ||
      commit.mock.calls.at(-1)![0].aircraft[0],
  };
}
function saveDraft() {
  click('Save Draft');
  click('Confirm & Save');
}

describe('v0.6.0 Handling operational entry', () => {
  it('uses a required free-text Bay for Confirm, but permits a completely empty reviewed Draft', () => {
    const { container, commit, saved } = setup();
    const bay = screen.getByLabelText('Parking Bay *');
    expect(bay).toHaveAttribute('name', 'bay');
    expect(bay).not.toHaveAttribute('list');
    expect(container.querySelector('#demo-bays')).toBeNull();
    expect(screen.queryByText(/Reference suggestions only/)).toBeNull();
    click('Save & Close');
    expect(screen.getByRole('alert')).toHaveTextContent('Parking Bay');
    change('Handling Date · Hong Kong', '');
    click('Save Draft');
    expect(commit).not.toHaveBeenCalled();
    click('Confirm & Save');
    expect(saved()).toMatchObject({ bay: '', date: '', status: 'Draft' });
    expect(stats([saved()]).logged).toBe(0);
  });
  it('requires Bay again at Confirm, preserves custom case and trims only explicitly edited text', () => {
    const a = seedDatabase().aircraft[0];
    const { commit, saved } = setup(a);
    change('Parking Bay *', '   ');
    click('Save & Close');
    expect(screen.getByLabelText('Parking Bay *')).toHaveAttribute('aria-invalid', 'true');
    expect(commit).not.toHaveBeenCalled();
    change('Parking Bay *', '  Custom-West/121l  ');
    click('Save & Close');
    attestHandlingReview();
    click('Confirm & Save');
    expect(saved().bay).toBe('Custom-West/121l');
    expect(saved().status).toBe('Confirmed');
  });
  it('does not require or expose disabled Bay/times/registration, and preserves archived values', () => {
    const db = seedDatabase(),
      a = { ...db.aircraft[0], bay: '' };
    Object.assign(db.settings.privacy, { bay: false, gateTimes: false, registration: false });
    const { saved } = setup(a, db);
    expect(confirmedHandlingIssues(a, db.settings.privacy, '2026-11-02')).toEqual([]);
    expect(screen.queryByLabelText(/Parking Bay|Aircraft Registration|AIBT/)).toBeNull();
    click('Save & Close');
    attestHandlingReview();
    click('Confirm & Save');
    expect(saved().arrival).toEqual(a.arrival);
    expect(saved().registration).toBe(a.registration);
    expect(saved().bay).toBe('');
  });
  it.each([
    ['Arrival Only', true, false],
    ['Departure Only', false, true],
    ['Full Turnaround', true, true],
  ] as const)(
    'exposes applicable actual times directly for %s, without opening More Details',
    (type, arrival, departure) => {
      setup();
      change('Handling Type *', type);
      expect(Boolean(screen.queryByLabelText('Actual In-Block Time (AIBT)'))).toBe(arrival);
      expect(Boolean(screen.queryByLabelText('Actual Off-Block Time (AOBT)'))).toBe(departure);
      for (const input of document.querySelectorAll('.block-time-field [data-block-clock]')) {
        expect(input.closest('details')).toBeNull();
        expect(input).toHaveAttribute('type', 'text');
        expect(input).toHaveAttribute('inputmode', 'numeric');
      }
      expect(screen.getByLabelText('Aircraft Registration')).toBeInTheDocument();
      expect(screen.queryByText(/local history lookup/)).toBeNull();
    },
  );
  it('saves independent month-boundary actual times, without inferring statuses or rewriting Duty links', () => {
    const a = seedDatabase().aircraft[0],
      { db, saved, commit } = setup(a);
    change('Handling Date · Hong Kong', '2026-10-31');
    change('AIBT Date · Hong Kong', '2026-10-31');
    change('Actual In-Block Time (AIBT)', '23:55');
    change('AOBT Date · Hong Kong', '2026-11-01');
    change('Actual Off-Block Time (AOBT)', '00:10');
    saveDraft();
    expect(saved().arrival.actual).toBe('2026-10-31T23:55:00+08:00');
    expect(saved().departure.actual).toBe('2026-11-01T00:10:00+08:00');
    expect(saved().arrival.status).toBe(a.arrival.status);
    expect(saved().dutyId).toBe(a.dutyId);
    expect(commit.mock.calls[0][0].duties).toEqual(db.duties);
    expect(
      parseBackup(JSON.stringify(createBackup(commit.mock.calls[0][0]))).data.aircraft.find(
        (row) => row.id === a.id,
      ),
    ).toEqual(saved());
  });
  it('keeps historical seconds, timezone, provenance and Bay bytes when those fields are not edited', () => {
    const db = seedDatabase(),
      a = { ...db.aircraft[0], bay: ' legacy-W121l ' };
    a.arrival = { ...a.arrival, actual: '2026-10-15T16:01:47Z' };
    const { saved } = setup(a, db);
    expect(screen.getByLabelText('Actual In-Block Time (AIBT)')).toHaveValue('00:01');
    expect(screen.getByLabelText('AIBT Date · Hong Kong')).toHaveValue('2026-10-16');
    click('Save Draft');
    const review = screen.getByRole('dialog', { name: 'Review Handling Record' });
    expect(review).not.toHaveTextContent('16:01:47');
    expect(review).not.toHaveTextContent('Self-reported');
    click('Confirm & Save');
    expect(saved().arrival).toEqual(a.arrival);
    expect(saved().departure).toEqual(a.departure);
    expect(saved().bay).toBe(a.bay);
    expect(saved().id).toBe(a.id);
  });
  it('resets seconds only for an explicitly changed timestamp and retains the other leg', () => {
    const a = seedDatabase().aircraft[0];
    a.arrival.actual = '2026-10-15T16:01:47Z';
    const { saved } = setup(a);
    change('Actual In-Block Time (AIBT)', '00:02');
    saveDraft();
    expect(saved().arrival.actual).toBe('2026-10-16T00:02:00+08:00');
    expect(saved().departure).toEqual(a.departure);
  });
  it('blocks an incomplete entered time/date pair but never invents a time for date-only input', () => {
    const { commit, saved } = setup();
    change('Handling Type *', 'Arrival Only');
    change('AIBT Date · Hong Kong', '');
    change('Actual In-Block Time (AIBT)', '08:40');
    click('Save Draft');
    expect(screen.getByRole('alert')).toHaveTextContent('HH:mm time and Hong Kong date');
    expect(commit).not.toHaveBeenCalled();
    change('Actual In-Block Time (AIBT)', '');
    change('AIBT Date · Hong Kong', '2026-10-16');
    saveDraft();
    expect(saved().arrival.actual).toBe('');
  });
  it('retains Pending and empty actual values instead of inferring work from future schedules', () => {
    const a = emptyAircraft('2099-01-01');
    a.actualHandling = false;
    const { saved } = setup(a);
    saveDraft();
    expect(handlingDisplayStatus(saved())).toBe('Pending');
    expect(saved().arrival.actual).toBe('');
    expect(saved().actualHandling).toBe(false);
  });
  it('keeps visible 24-hour text independent of browser locale, formats digits and blocks partial/invalid input', () => {
    const a = seedDatabase().aircraft[0],
      { commit, saved } = setup(a);
    change('Actual In-Block Time (AIBT)', '2355');
    expect(screen.getByLabelText('Actual In-Block Time (AIBT)')).toHaveValue('23:55');
    change('Actual In-Block Time (AIBT)', '29:55');
    click('Save Draft');
    expect(commit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('HH:mm');
    change('Actual In-Block Time (AIBT)', '23:56');
    saveDraft();
    expect(saved().arrival.actual).toBe('2026-10-16T23:56:00+08:00');
  });
});

it('formats valid historical and new block times to minutes, while timezone-aware suggestions stay explicit', () => {
  expect(blockTimeParts('2026-10-15T16:01:47Z')).toEqual({ date: '2026-10-16', time: '00:01' });
  expect(blockTimeValue('2026-02-30', '08:40')).toBeNull();
  expect(gateSuggestion('2026-10-31T23:55:00+08:00', '2026-11-01T00:10:00+08:00')).toBe('Delayed');
  expect(gateSuggestion('', '2026-10-16T08:40:00+08:00')).toBeNull();
  const db = seedDatabase(),
    a = structuredClone(db.aircraft[0]);
  a.arrival.actual = '2026-10-16T08:40:59+08:00';
  const { container } = render(
    <AircraftCard a={a} privacy={db.settings.privacy} onClick={() => {}} />,
  );
  expect(container.textContent).toContain('AIBT 08:40');
  expect(container.textContent).not.toContain('08:40:59');
});

it('opens the exact linked Duty via keyboard, removes provenance UI and handles missing links without mutation', async () => {
  const db = seedDatabase(),
    a = db.aircraft[0],
    onDuty = vi.fn(),
    before = JSON.stringify(db);
  const view = render(<AircraftDetails a={a} db={db} onDuty={onDuty} />);
  const button = view.container.querySelector<HTMLButtonElement>('.linked-duty')!;
  button.focus();
  await userEvent.setup().keyboard('{Enter}');
  expect(onDuty).toHaveBeenCalledWith(a.dutyId);
  expect(screen.queryByRole('button', { name: 'Open Duty' })).toBeNull();
  expect(view.container.textContent).not.toMatch(/Status source|Self-reported|self-reported/);
  expect(
    within(
      screen.getByRole('heading', { name: 'Arrival Information' }).closest('section')!,
    ).queryByText(/08:40:00/),
  ).toBeNull();
  view.rerender(<AircraftDetails a={{ ...a, dutyId: 'missing-duty' }} db={db} onDuty={onDuty} />);
  expect(screen.getByText('Linked Duty unavailable')).toBeInTheDocument();
  expect(view.container.querySelector('.linked-duty')).toBeNull();
  expect(JSON.stringify(db)).toBe(before);
});

it('localizes the operational entry without showing status provenance', () => {
  const db = seedDatabase();
  render(
    <LanguageContext.Provider value="zh-HK">
      <AircraftEditor
        db={db}
        existing={db.aircraft[0]}
        commit={() => true}
        onSaved={() => {}}
        onClose={() => {}}
      />
    </LanguageContext.Provider>,
  );
  expect(screen.getByLabelText('停機位 *')).not.toHaveAttribute('list');
  expect(screen.getByLabelText('實際入位時間（AIBT）')).toHaveValue('08:40');
  expect(screen.getByLabelText('機身註冊')).toBeInTheDocument();
  expect(screen.queryByText(/自行申報|狀態來源|本機歷史查詢/)).toBeNull();
});
