import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import AircraftEditor from '../src/features/AircraftEditor';
import { seedDatabase } from '../src/data/seed';
import { hkToday, type Database, type Duty } from '../src/domain/model';
import { resolveDuty, stats, trashDuty, restoreDuty } from '../src/domain/selectors';
import { STORAGE_KEY, loadDatabase } from '../src/lib/storage';

const duty = (patch: Partial<Duty> = {}): Duty => ({
  id: 'duty-qa',
  date: hkToday(),
  start: '08:00',
  end: '16:00',
  status: 'Confirmed',
  workState: 'Planned',
  notes: 'Fictional integration shift',
  ...patch,
});
function core() {
  fireEvent.change(screen.getByRole('combobox', { name: 'Airline *' }), {
    target: { value: 'Cathay Pacific' },
  });
  fireEvent.change(screen.getByLabelText('Aircraft Type *'), { target: { value: 'A350' } });
  fireEvent.change(screen.getByLabelText('Aircraft Variant *'), { target: { value: 'A350-1000' } });
}
function start(db = seedDatabase()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  return render(<App />);
}
function calendarDuty() {
  fireEvent.click(screen.getByRole('button', { name: 'View Full Calendar' }));
  fireEvent.click(document.querySelector('.calendar-records button')!);
}

describe('v0.4.0 integrated Duty and Handling workflow', () => {
  it('Only auto-selects one non-leave, non-Trashed candidate; ambiguity remains explicit', () => {
    const row = duty(),
      leave = duty({ id: 'al', leave: 'AL', start: '', end: '' }),
      sick = duty({ id: 'sl', leave: 'SL' });
    expect(
      resolveDuty(row.date, [row, leave, sick, duty({ id: 'trash', status: 'Trashed' })]).selected,
    ).toBe(row.id);
    expect(resolveDuty(row.date, [leave, sick]).selected).toBe('');
    expect(resolveDuty(row.date, [row, { ...row, id: 'second' }])).toMatchObject({
      selected: '',
      ambiguous: true,
    });
  });
  it('Starts from Duty, preselects it, reviews before saving and returns to the same Duty with the new linked card', () => {
    const db = seedDatabase(),
      row = duty();
    db.duties.push(row);
    start(db);
    calendarDuty();
    fireEvent.click(screen.getByRole('button', { name: 'New Handling Record for this Duty' }));
    expect(screen.getByRole('combobox', { name: 'Duty / Shift' })).toHaveTextContent(row.start);
    core();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Close' }));
    expect(loadDatabase().db.aircraft).toHaveLength(db.aircraft.length);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    expect(screen.getByRole('dialog', { name: `Duty · ${row.date}` })).toBeInTheDocument();
    const saved = loadDatabase().db.aircraft[0];
    expect(saved.dutyId).toBe(row.id);
    expect(loadDatabase().db.duties).toEqual(db.duties);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Cathay Pacific/ }),
    );
    expect(screen.getByRole('button', { name: 'Open Duty' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Duty' }));
    expect(screen.getByRole('dialog', { name: `Duty · ${row.date}` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Calendar' }));
    expect(screen.getByRole('dialog', { name: 'Full Duty Calendar' })).toBeInTheDocument();
  });
  it('Editing a Handling date never silently changes an existing Duty, including an overnight link', () => {
    const db = seedDatabase(),
      row = db.aircraft[0],
      commit = vi.fn(() => true);
    render(
      <AircraftEditor
        db={db}
        existing={row}
        commit={commit}
        onSaved={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText('Handling Date · Hong Kong'), {
      target: { value: '2026-10-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save & Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    expect(
      (commit.mock.calls[0] as unknown as [Database])[0].aircraft.find((a) => a.id === row.id),
    ).toMatchObject({ date: '2026-10-15', dutyId: row.dutyId });
  });
  it('An explicit new-form link or explicit unlink survives subsequent handling date changes', () => {
    const db = seedDatabase();
    db.duties = [duty(), duty({ id: 'other', date: '2027-01-01' })];
    render(
      <AircraftEditor
        db={db}
        dutyId="duty-qa"
        commit={() => true}
        onSaved={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText('Handling Date · Hong Kong'), {
      target: { value: '2027-01-01' },
    });
    expect(screen.getByRole('combobox', { name: 'Duty / Shift' })).toHaveTextContent('08:00');
    fireEvent.click(screen.getByRole('combobox', { name: 'Duty / Shift' }));
    fireEvent.click(screen.getByRole('option', { name: 'No linked Duty' }));
    fireEvent.change(screen.getByLabelText('Handling Date · Hong Kong'), {
      target: { value: hkToday() },
    });
    expect(screen.getByRole('combobox', { name: 'Duty / Shift' })).toHaveTextContent(
      'No linked Duty',
    );
  });
  it('A candidate made ineligible during review is blocked instead of creating a stale relationship', () => {
    const db = seedDatabase();
    db.duties = [duty()];
    const commit = vi.fn(() => true);
    const view = render(
      <AircraftEditor db={db} commit={commit} onSaved={() => {}} onClose={() => {}} />,
    );
    core();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Close' }));
    view.rerender(
      <AircraftEditor
        db={{ ...db, duties: [{ ...db.duties[0], leave: 'SL' }] }}
        commit={commit}
        onSaved={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    expect(commit).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole('dialog', { name: 'Review Handling Record' })).getByRole('alert'),
    ).toHaveTextContent('no longer eligible');
  });
  it('Failed local save retains review and values, shows no success, and retry creates only one assignment', () => {
    const db = seedDatabase();
    start(db);
    fireEvent.click(screen.getByRole('button', { name: 'Log a Handling Task' }));
    core();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Close' }));
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw Error('quota');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Review Handling Record' })).toBeInTheDocument();
    expect(loadDatabase().db.aircraft).toHaveLength(db.aircraft.length);
    const confirm = screen.getByRole('button', { name: 'Confirm & Save' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(loadDatabase().db.aircraft).toHaveLength(db.aircraft.length + 1);
    expect(screen.getByRole('status')).toHaveTextContent('Saved on this device');
    expect(write).toHaveBeenCalledTimes(2);
  });
  it('Legacy v0.3.4 data loads byte-for-byte and deletion/restore preserves counts, independent dates and Journal links', () => {
    const db = seedDatabase();
    const bytes = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, bytes);
    expect(loadDatabase().db).toEqual(db);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
    const removed = trashDuty(db, db.duties[0].id),
      restored = restoreDuty(removed, db.duties[0].id, true);
    expect(stats(removed.aircraft).logged).toBe(stats(db.aircraft).logged);
    expect(restored.aircraft).toEqual(db.aircraft);
    expect(restored.journals).toEqual(db.journals);
    expect(removed.aircraft.map((a) => a.date)).toEqual(db.aircraft.map((a) => a.date));
  });
});
