import { handlingTypes, newLeg, roles } from '../domain/model';
import type { Database } from '../domain/model';
import { airlineCatalogue } from './airlineCatalogue';
import { legacySeedDatabase } from './legacySeed';
import { variants } from './reference';

/** Frozen representative HK dates, deterministic IDs; never based on device timezone. */
export function seedDatabase(): Database {
  const base = legacySeedDatabase();
  const dates = [
    '2026-10-16',
    '2026-10-15',
    '2026-10-14',
    '2026-09-22',
    '2026-08-12',
    ...Array.from({ length: 19 }, (_, i) => `2026-09-${String(30 - i).padStart(2, '0')}`).filter(
      (d) => d !== '2026-09-22',
    ),
    '2026-09-11',
  ];
  // Keep the six original duties and three journal IDs/content. New dates get explicit demo duties.
  const duties = [...base.duties];
  const typeNames = [
    'B737-800',
    'A321neo',
    'A320-200',
    'A320-200',
    'A350-1000',
    'A330-300',
    'A350-900',
    'A350-900',
    'A320-200',
    'B787-9',
    'A350-900',
    'B777-300ER',
    'A330-300F',
    'A350-900',
    'B777-300ER',
    'B787-9',
    'A320-200',
    'B737-800',
    'A350-1000',
    'A320-200',
    'B787-9',
    'A320-200',
    'A321neo',
    'A320-200',
  ];
  const aircraft = airlineCatalogue.map((airline, i) => {
    const date = dates[i];
    let duty = duties.find((d) => d.date === date);
    if (!duty) {
      duty = {
        id: `demo-v014-duty-${date}`,
        date,
        start: '08:00',
        end: '16:00',
        status: 'Confirmed',
        notes: 'DEMO · fictional shift, not an employer roster',
      };
      duties.push(duty);
    }
    const variant = variants.find((v) => v.name === typeNames[i])!;
    const status =
      i === 0
        ? ('Delayed' as const)
        : (['Early', 'On Time', 'Delayed', 'Cancelled', 'Other', 'Not Recorded'] as const)[i % 6];
    const timed = i % 6 < 3;
    const scheduledOnly = i % 6 === 1;
    const stamp = `${date}T12:00:00+08:00`;
    return {
      ...base.aircraft[i % 18],
      id: `a${i + 1}`,
      date,
      dutyId: duty.id,
      airline: airline.name,
      variant: variant.name,
      family: variant.family,
      icao: variant.icao,
      handling: handlingTypes[i % 3],
      role: roles[Math.floor(i / 3) % 3],
      registration: `DEMO-${airline.iata}-${String(i + 1).padStart(3, '0')}`,
      bay: i % 2 === 0 ? `DEMO-BAY-${i + 1}` : '',
      arrival: {
        ...newLeg(),
        flight: `DEMO-${airline.iata}-ARR`,
        status,
        scheduled: timed ? `${date}T${i === 1 ? '22:30' : '10:00'}:00` : '',
        actual:
          timed && !scheduledOnly ? `${date}T${status === 'Delayed' ? '10:15' : '09:40'}:00` : '',
      },
      departure: {
        ...newLeg(),
        flight: `DEMO-${airline.iata}-DEP`,
        status: i % 6 === 0 ? ('On Time' as const) : status,
        scheduled: timed ? `${date}T${i === 1 ? '23:55' : '12:00'}:00` : '',
        actual:
          timed && !scheduledOnly
            ? `${date}T${i === 0 ? '12:05' : status === 'Delayed' ? '12:20' : '12:05'}:00`
            : '',
      },
      events: i === 0 ? base.aircraft[0].events : i === 4 ? base.aircraft[4].events : [],
      disruption: i === 0 || i === 4 ? ('Disrupted' as const) : ('Unknown' as const),
      notes:
        'DEMO v0.1.4 · Entirely synthetic scenario; not an actual flight or employer assignment.',
      status: 'Confirmed' as const,
      createdAt: stamp,
      updatedAt: stamp,
      revisions: [],
    };
  });
  return { ...base, duties, aircraft };
}
