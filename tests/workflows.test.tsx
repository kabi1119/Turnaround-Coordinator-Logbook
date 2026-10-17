import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { seedDatabase } from '../src/data/seed';
import { STORAGE_KEY } from '../src/lib/storage';
import Logbook from '../src/features/Logbook';
import { ReportPreview } from '../src/features/Settings';
import type { Database } from '../src/domain/model';
const stored = (): Database => JSON.parse(localStorage.getItem(STORAGE_KEY)!);
describe('Cross-feature regression workflows', () => {
  it('An undated Draft remains visible in Timeline without an invalid date conversion', () => {
    const db = seedDatabase();
    db.aircraft = [{ ...db.aircraft[0], date: '', dutyId: '', status: 'Draft' }];
    render(<Logbook db={db} onAircraft={() => {}} onDuty={() => {}} onNew={() => {}} />);
    expect(screen.getByText('Undated drafts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cathay Pacific/ })).toBeInTheDocument();
  });
  it('Date filtering keeps midnight assignments in the shift start group even outside the date range', async () => {
    const db = seedDatabase();
    db.aircraft = [{ ...db.aircraft[0], date: '2026-10-16', dutyId: 'd3' }];
    const user = userEvent.setup();
    render(<Logbook db={db} onAircraft={() => {}} onDuty={() => {}} onNew={() => {}} />);
    await user.click(screen.getByText('Filters'));
    fireEvent.change(screen.getByLabelText('From · Handling Date'), {
      target: { value: '2026-10-16' },
    });
    expect(screen.getByRole('button', { name: /Cathay Pacific/ })).toBeInTheDocument();
    expect(screen.getByText(/Thu, 15 Oct 2026/)).toBeInTheDocument();
  });
  it('Duty trash preserves Aircraft and Journal; restore preview reconnects explicitly', async () => {
    const db = seedDatabase();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Logbook' }));
    await user.click(screen.getByRole('button', { name: /Duty · 22:00 – 06:00/ }));
    await user.click(screen.getByRole('button', { name: 'Move Duty to Trash' }));
    expect(stored().duties.find((d) => d.id === 'd3')?.status).toBe('Confirmed');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(stored().duties.find((d) => d.id === 'd3')?.status).toBe('Trashed');
    expect(stored().aircraft).toHaveLength(18);
    expect(
      stored()
        .aircraft.filter((a) => a.originalDutyId === 'd3')
        .every((a) => !a.dutyId),
    ).toBe(true);
    expect(stored().journals.find((j) => j.id === 'j2')?.dutyId).toBe('');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Preview restore' }));
    expect(
      screen.getByLabelText('Explicitly reconnect eligible original associations'),
    ).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(stored().aircraft.filter((a) => a.dutyId === 'd3')).toHaveLength(3);
    expect(stored().journals.find((j) => j.id === 'j2')?.dutyId).toBe('d3');
  });
  it('Journal can be created with multi-links, searched by competency, edited and unlinked without aircraft count changes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Journal' }));
    await user.click(screen.getByRole('button', { name: 'New Journal' }));
    await user.type(screen.getByLabelText('Title'), 'DEMO team learning');
    await user.type(screen.getByLabelText('Learning'), 'DEMO: check shared understanding.');
    await user.click(screen.getByLabelText('Leadership'));
    await user.selectOptions(screen.getByLabelText('Status'), 'Confirmed');
    await user.selectOptions(screen.getByLabelText('Link experience to'), 'aircraft');
    const links = within(
      screen.getByRole('group', { name: 'Linked Aircraft · uncheck to unlink' }),
    ).getAllByRole('checkbox');
    await user.click(links[0]);
    await user.click(links[1]);
    await user.click(screen.getByRole('button', { name: 'Save Journal' }));
    expect(stored().aircraft).toHaveLength(18);
    const journal = stored().journals.find((j) => j.title === 'DEMO team learning')!;
    expect(journal.aircraftIds).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText('Competency'), 'Leadership');
    await user.click(screen.getByRole('button', { name: /DEMO team learning/ }));
    await user.selectOptions(screen.getByLabelText('Link experience to'), 'standalone');
    await user.click(screen.getByRole('button', { name: 'Save Journal' }));
    expect(stored().journals.find((j) => j.id === journal.id)?.aircraftIds).toEqual([]);
    expect(stored().aircraft).toHaveLength(18);
  });
  it('Privacy report requires review; changing scope invalidates review; sanitized JSON and CSV export paths work', async () => {
    const user = userEvent.setup();
    const create = vi.fn(() => 'blob:demo');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ReportPreview db={seedDatabase()} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'JSON' })).toBeDisabled();
    await user.click(
      screen.getByLabelText(
        'I reviewed the synthetic figures, role scope and selected sanitized stories.',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'JSON' }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    await user.selectOptions(
      screen.getByLabelText('Career role scope · Training excluded'),
      'handled',
    );
    expect(screen.getByRole('button', { name: 'JSON' })).toBeDisabled();
    await user.click(
      screen.getByLabelText(
        'I reviewed the synthetic figures, role scope and selected sanitized stories.',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'CSV · counts' }));
    expect(click).toHaveBeenCalledTimes(2);
  });
  it('Invalid saved JSON is preserved until a confirmed demo reset', async () => {
    localStorage.setItem(STORAGE_KEY, 'broken-json');
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('has not been overwritten');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.selectOptions(screen.getByLabelText('Language'), 'zh-HK');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('broken-json');
    await user.click(screen.getByRole('button', { name: 'Seed Demo Data' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('broken-json');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(stored().version).toBe(1);
  });
});
