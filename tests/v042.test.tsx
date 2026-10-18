import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AircraftEditor from '../src/features/AircraftEditor';
import AircraftDetails from '../src/features/AircraftDetails';
import App from '../src/App';
import UpcomingShift from '../src/features/UpcomingShift';
import FullDutyCalendar from '../src/features/FullDutyCalendar';
import { AircraftCard } from '../src/components/ui';
import { seedDatabase } from '../src/data/seed';
import {
  emptyAircraft,
  newLeg,
  type Aircraft,
  type Duty,
  type Database,
} from '../src/domain/model';
import {
  changeFlightAirline,
  flightInput,
  flightEntry,
  handlingDisplayStatus,
} from '../src/domain/handlingForm';
import { homeDutyPresentation } from '../src/domain/homeDuty';
import { stats, filterAircraft } from '../src/domain/selectors';
import { createBackup, parseBackup } from '../src/lib/backup';
import { loadDatabase, STORAGE_KEY } from '../src/lib/storage';
import { LanguageContext } from '../src/i18n';
import { attestHandlingReview, chooseRequiredHandling } from './handlingHelpers';

const now = Date.parse('2026-10-18T12:00:00+08:00');
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
function testDatabase() {
  const db = seedDatabase();
  db.settings.privacy = {
    registration: true,
    flights: true,
    bay: true,
    gateTimes: true,
    statuses: true,
    disruptionNotes: true,
  };
  return db;
}
function setup(existing?: Aircraft, db = testDatabase()) {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const commit = vi.fn<(db: Database) => boolean>(() => true),
    saved = vi.fn();
  const view = render(
    <AircraftEditor
      db={db}
      existing={existing}
      commit={commit}
      onSaved={saved}
      onClose={() => {}}
    />,
  );
  return {
    ...view,
    db,
    commit,
    saved,
    record: () =>
      commit.mock.calls.at(-1)![0].aircraft.find((a) => a.id === existing?.id) ||
      commit.mock.calls.at(-1)![0].aircraft[0],
  };
}
function complete(type: Aircraft['handling'] = 'Full Turnaround') {
  change('Handling Date · Hong Kong', '2026-10-18');
  change('Airline *', 'Cathay Pacific');
  chooseRequiredHandling();
  change('Handling Type *', type);
  change('Aircraft Type *', 'A350');
  change('Aircraft Variant *', 'A350-1000');
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('v0.4.2 conditional Handling form', () => {
  it('Has explicit placeholders and the specified form order; no flight fields before a type is chosen', () => {
    const { container } = setup();
    expect(screen.getByLabelText('Handling Type *')).toHaveValue('');
    expect(screen.getByLabelText('My Role *')).toHaveValue('');
    expect(
      within(screen.getByLabelText('Handling Type *'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Select handling type', 'Full Turnaround', 'Arrival Only', 'Departure Only']);
    expect(screen.queryByLabelText(/Flight Number/)).toBeNull();
    expect(
      [...container.querySelector('.handling-form')!.children].map((e) => e.className).slice(0, 5),
    ).toEqual(['form-grid', 'airline-combobox', 'field', 'aircraft-type-fields', 'field']);
    expect(
      screen.getByText(/Drafts can be incomplete/).querySelector('.required-marker'),
    ).toHaveTextContent('*');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it.each([
    ['Full Turnaround', true, true],
    ['Arrival Only', true, false],
    ['Departure Only', false, true],
  ] as const)('Renders only applicable flight/status fields for %s', (type, arrival, departure) => {
    setup();
    change('Handling Type *', type);
    fireEvent.click(screen.getByText('More Details'));
    expect(Boolean(screen.queryByLabelText('Arrival Flight Number *'))).toBe(arrival);
    expect(Boolean(screen.queryByLabelText('Departure Flight Number *'))).toBe(departure);
    expect(Boolean(screen.queryByLabelText('Arrival Flight Status'))).toBe(arrival);
    expect(Boolean(screen.queryByLabelText('Departure Flight Status'))).toBe(departure);
  });
  it('Reports dynamic missing fields, focuses the first, and clears corrected errors without validating hidden fields', () => {
    setup();
    click('Save & Close');
    const alert = screen.getByRole('alert');
    for (const label of [
      'Airline',
      'Handling Type',
      'Aircraft Type',
      'Aircraft Variant',
      'My Role',
    ])
      expect(alert).toHaveTextContent(label);
    expect(alert).not.toHaveTextContent('Flight Number');
    expect(screen.getByLabelText('Airline *')).toHaveFocus();
    change('Airline *', 'Cathay Pacific');
    expect(screen.getByLabelText('Airline *')).toHaveAttribute('aria-invalid', 'false');
    change('Handling Type *', 'Arrival Only');
    expect(screen.getByRole('alert')).toHaveTextContent('Arrival Flight Number');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Departure Flight Number');
    change('Arrival Flight Number *', 'CX450');
    expect(screen.getByLabelText('Arrival Flight Number *')).toHaveAttribute(
      'aria-invalid',
      'false',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('Arrival Flight Number');
  });
  it('Saves a completely empty business Draft only after review, with stable ID, editable fields and no confirmed counts', () => {
    const { commit, record, db } = setup();
    change('Handling Date · Hong Kong', '');
    click('Save & Close');
    expect(screen.getByRole('alert')).toHaveTextContent('Handling Date');
    click('Save Draft');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /I confirm this handling/ })).toBeNull();
    expect(commit).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Confirm & Save' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(commit).toHaveBeenCalledOnce();
    const a = record();
    expect(a).toMatchObject({
      date: '',
      airline: '',
      handling: '',
      role: '',
      variant: '',
      status: 'Draft',
      actualHandling: false,
    });
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.createdAt).toBeTruthy();
    expect(stats([a]).logged).toBe(0);
    const view = render(<AircraftCard a={a} privacy={db.settings.privacy} onClick={() => {}} />);
    expect(within(view.container).getByText('Untitled Draft')).toBeInTheDocument();
    expect(
      parseBackup(JSON.stringify(createBackup(commit.mock.calls[0][0]))).data.aircraft.find(
        (row) => row.id === a.id,
      ),
    ).toEqual(a);
  });
  it('Preserves partial business fields and reviewed input when switching Handling types; never submits inapplicable legs', () => {
    const { record } = setup();
    complete();
    change('Arrival Flight Number *', '450');
    change('Departure Flight Number *', '451A');
    change('Handling Type *', 'Arrival Only');
    expect(screen.queryByLabelText('Departure Flight Number *')).toBeNull();
    change('Handling Type *', 'Full Turnaround');
    expect(screen.getByLabelText('Departure Flight Number *')).toHaveValue('451A');
    change('Handling Type *', 'Arrival Only');
    click('Save & Close');
    expect(screen.getByRole('dialog', { name: 'Review Handling Record' })).not.toHaveTextContent(
      'CX451A',
    );
    expect(screen.getByRole('button', { name: 'Confirm & Save' })).toBeDisabled();
    attestHandlingReview();
    click('Confirm & Save');
    expect(record()).toMatchObject({
      arrival: { flight: 'CX450' },
      departure: newLeg(),
      actualHandling: true,
    });
  });
  it('Warns before saved leg data becomes inapplicable; Cancel preserves it and reviewed change keeps one ID', () => {
    const db = seedDatabase(),
      existing = db.aircraft[0],
      { commit, record } = setup(existing, db);
    change('Handling Type *', 'Arrival Only');
    expect(screen.getByRole('dialog', { name: 'Change Handling Type?' })).toHaveTextContent(
      'archived values',
    );
    click('Cancel');
    expect(screen.getByLabelText('Handling Type *')).toHaveValue('Full Turnaround');
    change('Handling Type *', 'Arrival Only');
    click('Change type');
    click('Save Draft');
    click('Confirm & Save');
    expect(record().id).toBe(existing.id);
    expect(record().departure).toEqual(newLeg());
    expect(commit.mock.calls[0][0].aircraft).toHaveLength(db.aircraft.length);
  });
  it('Privacy-disabled flights are neither required nor disclosed; archived values remain unchanged on same-type edits', () => {
    const db = seedDatabase(),
      existing = db.aircraft[0];
    db.settings.privacy.flights = false;
    const { record, rerender, commit } = setup(existing, db);
    expect(screen.queryByLabelText(/Flight Number/)).toBeNull();
    click('Save & Close');
    expect(screen.getByRole('dialog', { name: 'Review Handling Record' })).not.toHaveTextContent(
      existing.arrival.flight,
    );
    // Privacy may change while review is open; confirmation must revalidate current settings.
    rerender(
      <AircraftEditor
        db={{
          ...db,
          settings: { ...db.settings, privacy: { ...db.settings.privacy, flights: true } },
        }}
        existing={existing}
        commit={commit}
        onSaved={() => {}}
        onClose={() => {}}
      />,
    );
    attestHandlingReview();
    click('Confirm & Save');
    expect(commit).not.toHaveBeenCalled();
    rerender(
      <AircraftEditor
        db={db}
        existing={existing}
        commit={commit}
        onSaved={() => {}}
        onClose={() => {}}
      />,
    );
    click('Confirm & Save');
    expect(record().arrival.flight).toBe(existing.arrival.flight);
    expect(
      filterAircraft([record()], { query: existing.arrival.flight }, db.settings.privacy),
    ).toEqual([]);
  });
  it('Keeps incomplete structured Drafts compatible with strict backup/restore, including Trash', () => {
    const { db, record, commit } = setup();
    change('Aircraft Type *', 'A350');
    click('Save Draft');
    click('Confirm & Save');
    expect(record()).toMatchObject({ aircraftType: 'A350', variant: '', status: 'Draft' });
    expect(
      parseBackup(JSON.stringify(createBackup(commit.mock.calls[0][0]))).data.aircraft[0],
    ).toEqual(record());
    const partial = { ...record(), status: 'Trashed' as const, previousStatus: 'Draft' as const };
    expect(
      parseBackup(JSON.stringify(createBackup({ ...db, aircraft: [partial, ...db.aircraft] }))).data
        .aircraft[0],
    ).toEqual(partial);
    expect(() =>
      createBackup({ ...db, aircraft: [{ ...partial, status: 'Confirmed' }, ...db.aircraft] }),
    ).toThrow();
  });
});

describe('v0.4.2 fixed catalogue IATA prefixes', () => {
  it('Confirms a custom airline through the explicit full-number path without fabricating a fixed code', () => {
    const { record, container } = setup();
    complete();
    change('Airline *', 'Fictional Custom');
    change('Arrival Flight Number *', 'ZZ450');
    change('Departure Flight Number *', 'ZZ451A');
    expect(container.querySelector('.flight-prefix')).toBeNull();
    click('Save & Close');
    attestHandlingReview();
    click('Confirm & Save');
    expect(record()).toMatchObject({
      airline: 'Fictional Custom',
      status: 'Confirmed',
      arrival: { flight: 'ZZ450' },
      departure: { flight: 'ZZ451A' },
    });
  });
  it.each(['450', 'CX450', 'cx450', '450A'])('Normalizes %s without duplicated prefix', (input) => {
    expect(flightEntry('Cathay Pacific', input)).toBe(
      input.toUpperCase().endsWith('A') ? 'CX450A' : 'CX450',
    );
  });
  it.each(['CX', 'UO450', 'ABC123', '12345', '450AA'])(
    'Retains invalid/conflicting %s and blocks completeness',
    (value) => {
      expect(flightInput('Cathay Pacific', value)).toMatchObject({ valid: false, value });
    },
  );
  it('Preserves independent numbers/suffixes when the airline changes, including typed intermediate names', () => {
    const { record } = setup();
    complete();
    change('Arrival Flight Number *', 'CX450');
    change('Departure Flight Number *', '451A');
    expect(screen.getAllByText('CX', { selector: '.flight-prefix' })).toHaveLength(2);
    change('Airline *', '');
    change('Airline *', 'HK Exp');
    change('Airline *', 'HK Express');
    expect(screen.getAllByText('UO', { selector: '.flight-prefix' })).toHaveLength(2);
    expect(screen.getByLabelText('Arrival Flight Number *')).toHaveValue('450');
    expect(screen.getByLabelText('Departure Flight Number *')).toHaveValue('451A');
    click('Save & Close');
    expect(screen.getByRole('dialog', { name: 'Review Handling Record' })).toHaveTextContent(
      'UO450 / UO451A',
    );
    attestHandlingReview();
    click('Confirm & Save');
    expect(record()).toMatchObject({
      arrival: { flight: 'UO450' },
      departure: { flight: 'UO451A' },
    });
  });
  it('Provides full-number fallback for custom airlines, and preserves unfamiliar historical values for Draft editing', () => {
    const db = testDatabase(),
      existing = {
        ...db.aircraft[0],
        airline: 'Fictional Custom',
        arrival: { ...newLeg(), flight: 'PRIVATE-7' },
      };
    const { record } = setup(existing, db);
    expect(screen.queryByText('CX', { selector: '.flight-prefix' })).toBeNull();
    expect(screen.getByLabelText('Arrival Flight Number *')).toHaveValue('PRIVATE-7');
    click('Save & Close');
    expect(screen.getByLabelText('Arrival Flight Number *')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    click('Save Draft');
    click('Confirm & Save');
    expect(record().arrival.flight).toBe('PRIVATE-7');
    expect(changeFlightAirline('Cathay Pacific', 'HK Express', 'UNFAMILIAR')).toBe('UNFAMILIAR');
  });
});

describe('v0.4.2 Draft / Pending / explicit Confirmed lifecycle', () => {
  it('Blocks future confirmation, preserves a Pending Draft, and never confirms it as time passes', () => {
    const { record, commit } = setup();
    complete();
    change('Handling Date · Hong Kong', '2026-10-19');
    click('Save & Close');
    expect(screen.getByRole('alert')).toHaveTextContent('Future Handling');
    expect(screen.queryByRole('dialog', { name: 'Review Handling Record' })).toBeNull();
    click('Save Draft');
    expect(screen.getByRole('dialog', { name: 'Review Handling Record' })).toHaveTextContent(
      'Pending',
    );
    click('Confirm & Save');
    const a = record();
    expect(a.status).toBe('Draft');
    expect(handlingDisplayStatus(a, '2026-10-18')).toBe('Pending');
    expect(handlingDisplayStatus(a, '2026-10-20')).toBe('Draft');
    expect(stats([a]).logged).toBe(0);
    expect(a.status).toBe('Draft');
    expect(commit).toHaveBeenCalledOnce();
  });
  it('Revalidates future dates at final confirmation and preserves failed writes for retry', () => {
    const { commit, saved } = setup();
    complete();
    click('Save & Close');
    attestHandlingReview();
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-17T12:00:00+08:00'));
    click('Confirm & Save');
    expect(commit).not.toHaveBeenCalled();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    commit.mockReturnValueOnce(false);
    click('Confirm & Save');
    expect(saved).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Nothing was saved');
    click('Confirm & Save');
    expect(commit).toHaveBeenCalledTimes(2);
    expect(saved).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0][0].aircraft[0].id).toBe(commit.mock.calls[1][0].aircraft[0].id);
  });
  it('Manually completes an existing Draft with the same ID and links, then updates actual stored statistics', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = testDatabase(),
      draft = {
        ...emptyAircraft('2026-10-18', 'sample-day'),
        id: 'pending-qa',
        airline: 'Cathay Pacific',
        aircraftType: 'A350',
        variant: 'A350-1000',
        actualHandling: false,
      };
    db.aircraft.unshift(draft);
    const bytes = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, bytes);
    const view = render(<App />);
    expect(view.container.querySelector('.metrics strong')).toHaveTextContent('04');
    fireEvent.click(view.container.querySelector('.aircraft-card')!);
    click('Edit Handling Record');
    change('Arrival Flight Number *', '450');
    change('Departure Flight Number *', '451');
    click('Save & Close');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
    expect(screen.getByRole('button', { name: 'Confirm & Save' })).toBeDisabled();
    attestHandlingReview();
    click('Confirm & Save');
    const saved = loadDatabase().db;
    expect(saved.aircraft.find((a) => a.id === draft.id)).toMatchObject({
      status: 'Confirmed',
      actualHandling: true,
      dutyId: draft.dutyId,
    });
    expect(saved.aircraft).toHaveLength(5);
    expect(stats(saved.aircraft).logged).toBe(5);
    expect(view.container.querySelector('.metrics strong')).toHaveTextContent('05');
    expect(saved.journals).toEqual(db.journals);
  });
  it('Loads legacy Confirmed records byte-for-byte and flags inconsistencies without rewriting their state', () => {
    const db = seedDatabase();
    db.aircraft[0].date = '2099-01-01';
    db.aircraft[0].arrival.flight = 'OLD UNKNOWN';
    const bytes = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, bytes);
    expect(loadDatabase().db).toEqual(db);
    render(<AircraftDetails a={db.aircraft[0]} db={db} />);
    expect(screen.getByText(/needs review under current completion rules/)).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
    expect(db.aircraft[0].status).toBe('Confirmed');
  });
});

describe('v0.4.2 time-aware Home and simplified Calendar', () => {
  const row = (patch: Partial<Duty> = {}): Duty => ({
    id: 'today',
    date: '2026-10-18',
    start: '14:00',
    end: '22:00',
    status: 'Confirmed',
    workState: 'Planned',
    notes: '',
    ...patch,
  });
  it.each([
    ['2026-10-17T12:00:00+08:00', 'upcoming'],
    ['2026-10-18T12:00:00+08:00', 'today'],
    ['2026-10-18T14:00:00+08:00', 'current'],
    ['2026-10-18T22:00:00+08:00', 'upcoming'],
  ] as const)(
    'Uses %s time for %s presentation without writing work progress',
    (timestamp, kind) => {
      const rows = [row(), row({ id: 'next', date: '2026-10-19' })],
        bytes = JSON.stringify(rows);
      const result = homeDutyPresentation(rows, Date.parse(timestamp));
      expect(result.kind).toBe(kind);
      expect(new Set([...result.primary, ...result.next].map((d) => d.id)).size).toBe(
        result.primary.length + result.next.length,
      );
      expect(JSON.stringify(rows)).toBe(bytes);
    },
  );
  it('Handles overnight start dates, unknown hours and overlapping same-day schedules transparently', () => {
    const night = row({ date: '2026-10-17', start: '22:00', end: '06:00' });
    expect(homeDutyPresentation([night], Date.parse('2026-10-18T02:00:00+08:00'))).toMatchObject({
      kind: 'current',
      primary: [night],
      next: [],
    });
    expect(homeDutyPresentation([row({ start: '', end: '' })], now).kind).toBe('today');
    expect(
      homeDutyPresentation(
        [
          row({ start: '10:00', end: '16:00' }),
          row({ id: 'overlap', start: '11:00', end: '15:00' }),
        ],
        now,
      ).primary,
    ).toHaveLength(2);
  });
  it.each(['en', 'zh-HK'] as const)(
    'Shows same-day pre-start and Current titles, with a distinct Next Shift in %s',
    (language) => {
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const duties = [row(), row({ id: 'next', date: '2026-10-19' })];
      const view = render(
        <LanguageContext.Provider value={language}>
          <UpcomingShift duties={duties} onDuty={() => {}} onCalendar={() => {}} />
        </LanguageContext.Provider>,
      );
      expect(
        screen.getByRole('heading', {
          name: language === 'en' ? "Today's Scheduled Shift" : '今日已排更次',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: language === 'en' ? 'Next Shift' : '下一更次' }),
      ).toBeInTheDocument();
      vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-18T15:00:00+08:00'));
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      expect(
        screen.getByRole('heading', { name: language === 'en' ? 'Current Shift' : '當前更次' }),
      ).toBeInTheDocument();
      expect(view.container.querySelector('.current-duty.surface-dark')).toBeInTheDocument();
      expect(view.container.querySelector('.current-duty')).not.toHaveTextContent('Confirmed');
    },
  );
  it('Removes Return to Home, retains one X and the selected date after reopening', () => {
    const close = vi.fn(),
      view = render(<FullDutyCalendar duties={[]} open onDuty={() => {}} onClose={close} />);
    expect(screen.queryByRole('button', { name: 'Return to Home' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1);
    click('Close');
    expect(close).toHaveBeenCalledOnce();
    fireEvent.click(view.container.querySelector('[data-date$="-09"]')!);
    view.rerender(<FullDutyCalendar duties={[]} open={false} onDuty={() => {}} onClose={close} />);
    view.rerender(<FullDutyCalendar duties={[]} open onDuty={() => {}} onClose={close} />);
    expect(view.container.querySelector('[data-date$="-09"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
