import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import AircraftEditor from '../src/features/AircraftEditor';
// Preserve the historical fixture for v0.1.0–v0.1.3 compatibility regression assertions.
import { legacySeedDatabase as seedDatabase } from '../src/data/legacySeed';
import { emptyAircraft } from '../src/domain/model';
import type { Database } from '../src/domain/model';
import { STORAGE_KEY, writeDatabase } from '../src/lib/storage';
function setupEditor(db = seedDatabase(), existing?: Database['aircraft'][number]) {
  const commit = vi.fn(() => true),
    saved = vi.fn(),
    close = vi.fn();
  render(
    <AircraftEditor db={db} existing={existing} commit={commit} onSaved={saved} onClose={close} />,
  );
  return { commit, saved, close };
}
async function core(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Airline *'), 'Cathay Pacific');
  await user.selectOptions(screen.getByLabelText('Aircraft Type / Variant *'), 'A350-1000');
}
describe('Mandatory Aircraft Review Sheet', () => {
  it('An undated incomplete Draft requires review and never creates an undated Duty', async () => {
    const user = userEvent.setup(),
      { commit } = setupEditor();
    fireEvent.change(screen.getByLabelText('Handling Date · Hong Kong'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Save & Close' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a handling date');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));
    expect(screen.getByRole('dialog', { name: 'Review / Double-check' })).toHaveTextContent(
      'no Duty will be created',
    );
    expect(commit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    const value = commit.mock.calls[0] as unknown as [Database];
    expect(value[0].duties).toHaveLength(6);
    expect(value[0].aircraft[0]).toMatchObject({ date: '', dutyId: '', status: 'Draft' });
  });
  it('Never writes before explicit confirm; Back to Edit preserves values; close review does not save; Confirm saves once', async () => {
    const user = userEvent.setup(),
      { commit, saved } = setupEditor();
    await core(user);
    await user.click(screen.getByRole('button', { name: 'Save & Close' }));
    expect(commit).not.toHaveBeenCalled();
    const review = screen.getByRole('dialog', { name: 'Review / Double-check' });
    expect(within(review).getByText(/New Draft Duty/)).toBeInTheDocument();
    await user.click(within(review).getByRole('button', { name: 'Back to Edit' }));
    expect(screen.getByLabelText('Airline *')).toHaveValue('Cathay Pacific');
    expect(commit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save & Close' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Review / Double-check' })).getByRole('button', {
        name: 'Close',
      }),
    );
    expect(commit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save & Close' }));
    const btn = within(screen.getByRole('dialog', { name: 'Review / Double-check' })).getByRole(
      'button',
      { name: 'Confirm & Save' },
    );
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledTimes(1);
    const value = commit.mock.calls[0] as unknown as [Database];
    expect(value[0].aircraft[0].status).toBe('Confirmed');
    expect(value[0].duties).toHaveLength(7);
  });
  it('Closing editor discards without creating Aircraft or Draft Duty', async () => {
    const user = userEvent.setup(),
      { commit, close } = setupEditor();
    await core(user);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(commit).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('Save & Add Next reviews, then clears form while preserving selected Duty', async () => {
    const user = userEvent.setup(),
      { commit, close } = setupEditor();
    await core(user);
    await user.selectOptions(screen.getByLabelText('Duty / Shift'), 'd3');
    await user.click(screen.getByRole('button', { name: 'Save & Add Next' }));
    expect(commit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Airline *')).toHaveValue('');
    expect(screen.getByLabelText('Duty / Shift')).toHaveValue('d3');
  });
  it('Missing core fields cannot Confirm but Save Draft still requires review', async () => {
    const user = userEvent.setup(),
      { commit } = setupEditor();
    await user.click(screen.getByRole('button', { name: 'Save & Close' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Complete the four core');
    expect(screen.queryByRole('button', { name: 'Confirm & Save' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));
    expect(commit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    const value = commit.mock.calls[0] as unknown as [Database];
    expect(value[0].aircraft[0].status).toBe('Draft');
  });
  it('Multiple candidate Duties require choice; mere date change writes nothing', async () => {
    const user = userEvent.setup(),
      { commit } = setupEditor();
    await core(user);
    fireEvent.change(screen.getByLabelText('Handling Date · Hong Kong'), {
      target: { value: '2026-10-16' },
    });
    expect(screen.getByLabelText('Duty / Shift')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save & Close' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a Duty');
    expect(commit).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Duty / Shift'), 'd1');
    await user.click(screen.getByRole('button', { name: 'Save & Close' }));
    expect(screen.getByRole('dialog', { name: 'Review / Double-check' })).toBeInTheDocument();
  });
  it('Likely duplicate allows explicit separate assignment; editing same ID does not warn', async () => {
    const db = seedDatabase();
    db.settings.privacy.registration = true;
    const existing = { ...db.aircraft[0], id: 'new-separate' };
    const user = userEvent.setup(),
      { commit } = setupEditor(db, existing);
    await user.click(screen.getByRole('button', { name: 'Save & Close' }));
    const button = screen.getByRole('button', { name: 'Confirm & Save' });
    expect(button).toBeDisabled();
    await user.click(screen.getByLabelText('Keep as separate assignment'));
    await user.click(button);
    expect(commit).toHaveBeenCalledTimes(1);
  });
  it('Hidden archived fields stay hidden throughout editor/review and remain archived on save', async () => {
    const db = seedDatabase(),
      existing = db.aircraft[0],
      user = userEvent.setup(),
      { commit } = setupEditor(db, existing);
    expect(screen.queryByLabelText(/Registration ·/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Arrival Flight Status/)).not.toBeInTheDocument();
    expect(screen.queryByText(existing.registration)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save & Close' }));
    expect(screen.getByRole('dialog', { name: 'Review / Double-check' })).not.toHaveTextContent(
      existing.registration,
    );
    await user.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    const value = commit.mock.calls[0] as unknown as [Database];
    expect(value[0].aircraft.find((a) => a.id === existing.id)?.registration).toBe(
      existing.registration,
    );
  });
  it('Shows only applicable statuses; mock gate suggestion requires explicit adoption and respects manual choice', async () => {
    const db = seedDatabase();
    db.settings.privacy.statuses = true;
    db.settings.privacy.gateTimes = true;
    const user = userEvent.setup();
    setupEditor(db);
    await user.click(screen.getByText('More Details'));
    await user.selectOptions(screen.getByLabelText('Handling Type *'), 'Arrival Only');
    expect(screen.getByLabelText('Arrival Flight Status')).toBeInTheDocument();
    expect(screen.queryByLabelText('Departure Flight Status')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Scheduled gate / stand'), {
      target: { value: '2026-10-16T23:55:00' },
    });
    fireEvent.change(screen.getByLabelText('Actual gate / stand'), {
      target: { value: '2026-10-17T00:10:00' },
    });
    expect(screen.getByLabelText('Arrival Flight Status')).toHaveValue('Not Recorded');
    await user.click(screen.getByRole('button', { name: 'Use suggestion explicitly' }));
    expect(screen.getByLabelText('Arrival Flight Status')).toHaveValue('Delayed');
    await user.selectOptions(screen.getByLabelText('Arrival Flight Status'), 'On Time');
    expect(screen.getByText(/Current manual status differs/)).toBeInTheDocument();
  });
  it('Preserves custom parking stand suffixes through review and confirmation', async () => {
    const db = seedDatabase();
    db.settings.privacy.bay = true;
    const user = userEvent.setup(),
      { commit } = setupEditor(db);
    await core(user);
    await user.click(screen.getByText('More Details'));
    await user.type(screen.getByLabelText('Parking Bay · search or custom'), 'demo-w121l');
    await user.click(screen.getByRole('button', { name: 'Save & Close' }));
    expect(screen.getByRole('dialog', { name: 'Review / Double-check' })).toHaveTextContent(
      'DEMO-W121L',
    );
    await user.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    const value = commit.mock.calls[0] as unknown as [Database];
    expect(value[0].aircraft[0].bay).toBe('DEMO-W121L');
  });
  it('No actual handling cannot be Confirmed even with complete core fields', async () => {
    const user = userEvent.setup(),
      { commit } = setupEditor();
    await core(user);
    await user.click(screen.getByText('More Details'));
    await user.click(screen.getByLabelText(/Actual handling took place/));
    await user.click(screen.getByRole('button', { name: 'Save & Close' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(commit).not.toHaveBeenCalled();
  });
});
describe('App navigation, persistence and privacy', () => {
  it('All five navigation items work, with Settings separate and bilingual switch persisted', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('heading', { name: /A record of every/ })).toBeInTheDocument();
    const nav = screen.getByRole('navigation');
    await user.click(within(nav).getByRole('button', { name: 'Logbook' }));
    expect(screen.getByRole('button', { name: 'Timeline' })).toHaveClass('selected');
    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(screen.getByLabelText(/2026-10-16 ·/)).toBeInTheDocument();
    await user.click(within(nav).getByRole('button', { name: 'Statistics' }));
    expect(screen.getByRole('heading', { name: 'Handling Type' })).toBeInTheDocument();
    await user.click(within(nav).getByRole('button', { name: 'Journal' }));
    expect(screen.getByLabelText('Search Journal')).toBeInTheDocument();
    await user.click(within(nav).getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('button', { name: /New Career Journal/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.selectOptions(screen.getByLabelText('Language'), 'zh-HK');
    expect(screen.getByRole('heading', { name: '設定。' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).settings.language).toBe('zh-HK');
    expect(within(nav).getByRole('button', { name: '紀錄簿' })).toBeInTheDocument();
  });
  it('New Aircraft persists only after confirmation and survives remount', async () => {
    const user = userEvent.setup();
    const view = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Log an Aircraft' }));
    await core(user);
    await user.click(screen.getByRole('button', { name: 'Save & Close' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).aircraft).toHaveLength(5);
    expect(screen.getByRole('status')).toHaveTextContent('Saved on this device');
    view.unmount();
    render(<App />);
    expect(screen.getAllByText('05')).not.toHaveLength(0);
  });
  it('Privacy disable previews impact and archives by default; reset/seed require explicit confirm', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('switch', { name: 'Registration' }));
    expect(screen.getByRole('switch', { name: 'Registration' })).toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'Registration' }));
    expect(
      screen.getByRole('dialog', { name: 'Disable field · impact preview' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.settings.privacy.registration).toBe(false);
    expect(stored.aircraft[0].registration).toBe('X-TCL1');
    await user.click(screen.getByRole('button', { name: 'Clear local records' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).aircraft).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).aircraft).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Clear local records' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).aircraft).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Load sample records' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).aircraft).toHaveLength(4);
  });
  it('Browser storage failures do not claim save success', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const db = seedDatabase();
    expect(writeDatabase(db)).toBe(false);
    expect(spy).toHaveBeenCalled();
  });
  it('Seed covers all nine role × handling combinations and repeated synthetic registrations', () => {
    const db = seedDatabase();
    expect(
      new Set(
        db.aircraft.filter((a) => a.status === 'Confirmed').map((a) => `${a.role}|${a.handling}`),
      ).size,
    ).toBe(9);
    expect(db.aircraft.filter((a) => a.registration === 'DEMO-001').length).toBeGreaterThan(1);
    expect(emptyAircraft().arrival.status).toBe('Not Recorded');
  });
});
