import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AircraftCard } from '../src/components/ui';
import AircraftDetails from '../src/features/AircraftDetails';
import { emptyAircraft, hkToday } from '../src/domain/model';
import type { Privacy } from '../src/domain/model';
// Preserve the historical fixture for v0.1.0–v0.1.3 compatibility regression assertions.
import { legacySeedDatabase as seedDatabase } from '../src/data/legacySeed';
import { aircraftTimes } from '../src/domain/time';
import App from '../src/App';
import { STORAGE_KEY } from '../src/lib/storage';

const privacy: Privacy = {
  registration: true,
  flights: true,
  bay: true,
  gateTimes: true,
  statuses: true,
  disruptionNotes: true,
};
const aircraft = () => ({
  ...emptyAircraft('2026-11-05'),
  airline: 'Cathay Pacific',
  variant: 'A350-1000',
  registration: 'DEMO-TEST',
  bay: 'DEMO-W121L',
  arrival: {
    ...emptyAircraft().arrival,
    flight: 'DEMO-ARR',
    scheduled: '2026-11-05T14:00',
    actual: '2026-11-05T14:35',
  },
  departure: {
    ...emptyAircraft().departure,
    flight: 'DEMO-DEP',
    scheduled: '2026-11-05T16:00',
    actual: '2026-11-05T16:10',
  },
});

describe('v0.1.2 aircraft card gate times', () => {
  it.each(['Arrival Only', 'Departure Only', 'Full Turnaround'] as const)(
    'Shows applicable independent events for %s',
    (handling) => {
      const a = { ...aircraft(), handling };
      const { container } = render(<AircraftCard a={a} privacy={privacy} onClick={() => {}} />);
      const text = container.textContent!;
      expect(text.includes('AIBT 14:35')).toBe(handling !== 'Departure Only');
      expect(text.includes('AOBT 16:10')).toBe(handling !== 'Arrival Only');
      expect(text).toContain('Bay DEMO-W121L');
      expect(text).toContain('Primary Coordinator · A350-1000 (DEMO-TEST)');
    },
  );
  it('Labels scheduled-only time and never falls back to a duty/creation timestamp', () => {
    const a = aircraft();
    a.arrival.actual = '';
    a.departure.actual = '';
    a.departure.scheduled = '';
    const { container, rerender } = render(
      <AircraftCard a={a} privacy={privacy} onClick={() => {}} />,
    );
    expect(container.textContent).toContain('Scheduled SIBT 14:00');
    a.arrival.scheduled = '';
    a.createdAt = '2026-11-05T01:23:45Z';
    rerender(<AircraftCard a={a} privacy={privacy} onClick={() => {}} />);
    expect(screen.getByText(/Time not recorded/)).toBeInTheDocument();
    expect(container.textContent).not.toContain('01:23');
  });
  it('Keeps next-day actual dates and hides restricted times/bay/identifiers', () => {
    const a = aircraft();
    a.departure.actual = '2026-11-06T00:10';
    expect(aircraftTimes(a, privacy)[1].value).toContain('06/11/2026');
    a.departure.actual = '2026-11-05T16:10Z';
    expect(aircraftTimes(a, privacy)[1].value).toContain('06/11/2026');
    const { container } = render(
      <AircraftCard
        a={a}
        privacy={{ ...privacy, gateTimes: false, bay: false, flights: false, registration: false }}
        onClick={() => {}}
      />,
    );
    expect(container.textContent).toContain('Times hidden by privacy settings');
    for (const value of ['14:35', '00:10', 'DEMO-W121L', 'DEMO-ARR', 'DEMO-TEST'])
      expect(container.textContent).not.toContain(value);
  });
  it('Preserves all optional details and navigable Duty/Journal relationships under privacy controls', () => {
    const db = seedDatabase();
    db.settings.privacy = privacy;
    const a = {
      ...aircraft(),
      id: 'detail-test',
      dutyId: db.duties[0].id,
      family: 'A350',
      icao: 'A35K',
      notes: 'Synthetic full notes',
      createdAt: '2026-11-05T01:00:00Z',
      updatedAt: '2026-11-05T02:00:00Z',
      events: [
        {
          id: 'event',
          category: 'Weather',
          involvement: 'Coordinated' as const,
          impact: 'Major' as const,
          resolution: 'Resolved' as const,
          notes: 'Synthetic event note',
          journalId: db.journals[0].id,
        },
      ],
    };
    db.journals[1].aircraftIds = [a.id];
    const { container } = render(<AircraftDetails a={a} db={db} />);
    for (const text of [
      'DEMO-ARR',
      'DEMO-DEP',
      'SIBT',
      'AIBT',
      'SOBT',
      'AOBT',
      '14:00',
      '14:35',
      '16:00',
      '16:10',
      'A35K',
      'DEMO-W121L',
      'Synthetic full notes',
      'Synthetic event note',
      'Coordinated',
      'Major',
      'Resolved',
      db.journals[0].title,
      db.journals[1].title,
    ])
      expect(container.textContent).toContain(text);
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });
  it('Home opens the complete existing detail view, follows links and preserves storage until an edit is confirmed', () => {
    const db = seedDatabase();
    db.aircraft[0].date = hkToday();
    db.settings.privacy = privacy;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    render(<App />);
    const before = localStorage.getItem(STORAGE_KEY);
    fireEvent.click(document.querySelector('.aircraft-card')!);
    const detail = screen.getByRole('dialog', { name: 'Handling Record' });
    expect(
      within(detail).getByRole('heading', { name: 'Assignment Information' }),
    ).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole('button', { name: /^2026-10-16 ·/ }));
    expect(screen.getByRole('button', { name: 'Edit Duty' })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });
});
