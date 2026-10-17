import { describe, expect, it } from 'vitest';
import { seedDatabase } from '../src/data/seed';
import { emptyAircraft, restrictivePrivacy, roles } from '../src/domain/model';
import type { Aircraft, Privacy } from '../src/domain/model';
import {
  canRestore,
  cardText,
  classifyDelta,
  clearPrivateField,
  duplicates,
  filterAircraft,
  gateSuggestion,
  isComplete,
  ranking,
  report,
  resolveDuty,
  restoreDuty,
  saveAircraft,
  stats,
  timelineDate,
  trashDuty,
  visibleAircraft,
} from '../src/domain/selectors';
const all: Privacy = {
  registration: true,
  flights: true,
  bay: true,
  gateTimes: true,
  statuses: true,
  disruptionNotes: true,
};
function a(part: Partial<Aircraft> = {}): Aircraft {
  return {
    ...emptyAircraft('2026-10-16', 'd1'),
    airline: 'Cathay Pacific',
    variant: 'A350-1000',
    family: 'A350',
    icao: 'A35K',
    status: 'Confirmed',
    ...part,
  };
}
describe('Exact personal gate status boundaries', () => {
  it.each([
    [-901, 'Early'],
    [-900, 'On Time'],
    [899, 'On Time'],
    [900, 'Delayed'],
  ] as const)('%s seconds → %s', (seconds, result) => expect(classifyDelta(seconds)).toBe(result));
  it('Uses dated Hong Kong gate times across midnight without rounding', () => {
    expect(gateSuggestion('2026-10-15T23:55:00', '2026-10-16T00:09:59')).toBe('On Time');
    expect(gateSuggestion('2026-10-15T23:55:00', '2026-10-16T00:10:00')).toBe('Delayed');
    expect(gateSuggestion('', '')).toBeNull();
    expect(gateSuggestion('bad', 'bad')).toBeNull();
  });
});
describe('Assignment statistics and mutually exclusive types', () => {
  it('Full Turnaround counts once with two independent leg status categories', () => {
    const record = a();
    record.arrival.status = 'Delayed';
    record.departure.status = 'On Time';
    const s = stats([record]);
    expect(s.logged).toBe(1);
    expect(s.handled).toBe(1);
    expect(s.types.map((t) => t.logged)).toEqual([1, 0, 0]);
    expect(s.arrival.find((s) => s.status === 'Delayed')?.count).toBe(1);
    expect(s.departure.find((s) => s.status === 'On Time')?.count).toBe(1);
  });
  it('40 Full + 25 Departure + 15 Arrival = 80 handled; 10 Training → 90 logged', () => {
    const rows = [
      ...Array.from({ length: 40 }, () => a()),
      ...Array.from({ length: 25 }, () => a({ handling: 'Departure Only' })),
      ...Array.from({ length: 15 }, () => a({ handling: 'Arrival Only' })),
      ...Array.from({ length: 10 }, () => a({ role: roles[2] })),
    ];
    const s = stats(rows);
    expect([s.logged, s.handled]).toEqual([90, 80]);
    expect(s.types.map((t) => t.handled)).toEqual([40, 25, 15]);
    expect(s.types.reduce((n, t) => n + t.logged, 0)).toBe(s.logged);
    expect(s.types.reduce((n, t) => n + t.handled, 0)).toBe(s.handled);
  });
  it('P300 S100 T50 → Logged450 Handled400 Primary300', () => {
    const s = stats([
      ...Array.from({ length: 300 }, () => a()),
      ...Array.from({ length: 100 }, () => a({ role: roles[1] })),
      ...Array.from({ length: 50 }, () => a({ role: roles[2] })),
    ]);
    expect([s.logged, s.handled, s.primary]).toEqual([450, 400, 300]);
  });
  it('Unique normalizes surrounding whitespace and case, excludes blanks and preserves suffixes', () => {
    expect(
      stats([
        a({ registration: ' demo-001 ' }),
        a({ registration: 'DEMO-001' }),
        a({ registration: '' }),
        a({ registration: 'DEMO-001R' }),
      ]).unique,
    ).toBe(2);
  });
  it('Draft/Trash are excluded; Confirmed Aircraft in Draft Duty count; only confirmed Duties count', () => {
    const db = seedDatabase();
    const record = db.aircraft.find((a) => a.dutyId === 'd4')!;
    expect(record.status).toBe('Confirmed');
    const s = stats([record, a({ status: 'Draft' }), a({ status: 'Trashed' })], db.duties);
    expect(s.logged).toBe(1);
    expect(s.duties).toBe(5);
  });
  it('Two events in one confirmed assignment = two events and one disrupted assignment', () => {
    const record = seedDatabase().aircraft[0];
    expect(record.events.length).toBe(2);
    expect(stats([record])).toMatchObject({ events: 2, disrupted: 1 });
  });
  it('Only applicable legs enter status categories; Not Recorded remains independent', () => {
    const arr = a({ handling: 'Arrival Only' }),
      dep = a({ handling: 'Departure Only' });
    arr.departure.status = 'Delayed';
    dep.arrival.status = 'Early';
    const s = stats([arr, dep]);
    expect(s.arrival.find((s) => s.status === 'Not Recorded')?.count).toBe(1);
    expect(s.departure.find((s) => s.status === 'Not Recorded')?.count).toBe(1);
    expect(s.arrival.find((s) => s.status === 'Early')?.count).toBe(0);
    expect(s.departure.find((s) => s.status === 'Delayed')?.count).toBe(0);
  });
  it('Rankings include every handling type and Training', () => {
    expect(
      ranking(
        [a(), a({ handling: 'Departure Only' }), a({ handling: 'Arrival Only', role: roles[2] })],
        'airline',
      ),
    ).toEqual([['Cathay Pacific', 3]]);
  });
});
describe('Composed search, privacy and report boundaries', () => {
  it('Composes date/family/variant/role/type/airline/both leg statuses/disruption filters using handling date', () => {
    const record = a({ createdAt: '2030-01-01', disruption: 'Disrupted' });
    record.arrival.status = 'Delayed';
    record.departure.status = 'On Time';
    const rows = [
      record,
      a({ role: roles[1] }),
      a({ date: '2026-08-01' }),
      a({ handling: 'Arrival Only' }),
    ];
    expect(
      filterAircraft(
        rows,
        {
          from: '2026-10-01',
          to: '2026-10-31',
          family: 'A350',
          variant: 'A350-1000',
          role: roles[0],
          handling: 'Full Turnaround',
          airline: 'Cathay Pacific',
          arrival: 'Delayed',
          departure: 'On Time',
          disruption: 'Disrupted',
        },
        all,
      ),
    ).toEqual([record]);
    expect(filterAircraft(rows, { from: '2027-01-01' }, all)).toHaveLength(0);
  });
  it('Disabled identifiers are neither searchable nor displayed; status filters ignored if disabled', () => {
    const record = a({ registration: 'DEMO-SECRET', bay: 'S25R' });
    record.arrival.flight = 'DEMO-SECRET-FLIGHT';
    record.arrival.status = 'Delayed';
    expect(filterAircraft([record], { query: 'DEMO-SECRET' }, restrictivePrivacy)).toEqual([]);
    expect(filterAircraft([record], { arrival: 'On Time' }, restrictivePrivacy)).toEqual([record]);
    expect(visibleAircraft(record, restrictivePrivacy)).toMatchObject({
      registration: '',
      bay: '',
      arrival: { flight: '', status: 'Not Recorded' },
    });
  });
  it('Cards omit optional values cleanly and use airline + flights / role + variant hierarchy', () => {
    const record = a({ registration: 'DEMO-001' });
    record.arrival.flight = 'DEMO-ARR';
    record.departure.flight = 'DEMO-DEP';
    expect(cardText(record, all)).toEqual({
      title: 'Cathay Pacific DEMO-ARR / DEMO-DEP',
      subtitle: 'Primary Coordinator · A350-1000 (DEMO-001)',
    });
    expect(cardText(record, restrictivePrivacy)).toEqual({
      title: 'Cathay Pacific',
      subtitle: 'Primary Coordinator · A350-1000',
    });
    expect(cardText(a(), all).subtitle).not.toContain('()');
  });
  it('Disabled fields never enter sanitized report, even if archived; Training, Draft and Trash excluded', () => {
    const db = seedDatabase();
    db.aircraft = [
      a({ registration: 'PRIVATE-VALUE' }),
      a({ role: roles[1], handling: 'Departure Only' }),
      a({ role: roles[2] }),
      a({ status: 'Draft' }),
      a({ status: 'Trashed' }),
    ];
    const r = report(
      db,
      '',
      '',
      'handled',
      ['Full Turnaround', 'Departure Only', 'Arrival Only'],
      ['j1'],
    );
    expect(r.counts.map((c) => c.count)).toEqual([1, 1, 0]);
    expect(r.total).toBe(2);
    expect(JSON.stringify(r)).not.toContain('PRIVATE-VALUE');
    expect(JSON.stringify(r)).not.toContain('aircraftIds');
    expect(report(db, '', '', 'primary', ['Full Turnaround'], []).total).toBe(1);
    expect(
      report(db, '2027-01-01', '', 'handled', ['Full Turnaround'], ['j1']).stories,
    ).toHaveLength(0);
  });
  it('Deletion clears only the selected field and retains stand suffixes elsewhere', () => {
    const db = seedDatabase();
    db.settings.privacy = { ...all };
    const old = db.aircraft[0].bay;
    const next = clearPrivateField(db, 'registration');
    expect(next.aircraft.every((a) => !a.registration)).toBe(true);
    expect(next.aircraft[0].bay).toBe(old);
    expect(next.settings.privacy.registration).toBe(false);
    expect(next.settings.privacy.bay).toBe(true);
  });
});
describe('Duty lifecycle and saving', () => {
  it('Multiple same-day Duties require explicit choice; unique auto-selects; missing suggests a new Draft only', () => {
    const db = seedDatabase();
    expect(resolveDuty('2026-10-16', db.duties)).toMatchObject({ ambiguous: true, selected: '' });
    expect(resolveDuty('2026-10-15', db.duties).selected).toBe('d3');
    expect(resolveDuty('2026-10-17', db.duties).selected).toBe('new');
    expect(db.duties).toHaveLength(6);
  });
  it('Cross-midnight record groups under HK shift start date while filters use handling date', () => {
    const db = seedDatabase();
    const record = a({ date: '2026-10-16', dutyId: 'd3' });
    expect(timelineDate(record, db.duties)).toBe('2026-10-15');
    expect(filterAircraft([record], { from: '2026-10-16' }, all)).toHaveLength(1);
  });
  it('Hong Kong dates remain stable when UTC is previous day', async () => {
    const { hkToday } = await import('../src/domain/model');
    expect(hkToday(new Date('2026-10-15T18:00:00Z'))).toBe('2026-10-16');
  });
  it('Trashing Duty preserves and unlinks Aircraft/Journal; restore explicitly reconnects and never overwrites new links', () => {
    const original = seedDatabase();
    const db = trashDuty(original, 'd3');
    expect(db.aircraft.length).toBe(original.aircraft.length);
    expect(db.aircraft.filter((a) => a.originalDutyId === 'd3').every((a) => !a.dutyId)).toBe(true);
    expect(db.journals.find((j) => j.id === 'j2')?.dutyId).toBe('');
    expect(stats(db.aircraft).logged).toBe(stats(original.aircraft).logged);
    expect(restoreDuty(db, 'd3', false).journals.find((j) => j.id === 'j2')?.dutyId).toBe('');
    db.aircraft.find((a) => a.originalDutyId === 'd3')!.dutyId = 'd1';
    db.journals.find((j) => j.id === 'j2')!.aircraftIds = ['a1'];
    const restored = restoreDuty(db, 'd3', true);
    expect(restored.aircraft.find((a) => a.id === 'a7')?.dutyId).toBe('d1');
    expect(restored.aircraft.find((a) => a.id === 'a8')?.dutyId).toBe('d3');
    expect(restored.journals.find((j) => j.id === 'j2')?.dutyId).toBe('');
  });
  it('Duplicate detector is advisory, supports distinct IDs and upsert is idempotent', () => {
    const db = seedDatabase(),
      record = { ...db.aircraft[0], id: 'another' };
    expect(duplicates(record, db.aircraft, all)).toHaveLength(1);
    const next = saveAircraft(db, record);
    expect(next.aircraft.length).toBe(db.aircraft.length + 1);
    expect(saveAircraft(next, record).aircraft.length).toBe(next.aircraft.length);
    expect(duplicates(record, db.aircraft, restrictivePrivacy)).toHaveLength(0);
  });
  it('Required fields and actual handling guard Confirmed; stand values are unrestricted', () => {
    expect(isComplete(a())).toBe(true);
    expect(isComplete(a({ airline: '' }))).toBe(false);
    expect(isComplete(a({ actualHandling: false }))).toBe(false);
    expect(isComplete(a({ bay: 'DEMO-UNLISTED-W121L' }))).toBe(true);
  });
  it('30-day restore eligibility has a precise boundary', () => {
    const at = '2026-10-01T00:00:00Z';
    expect(canRestore(at, Date.parse(at) + 30 * 86400000 - 1)).toBe(true);
    expect(canRestore(at, Date.parse(at) + 30 * 86400000)).toBe(false);
  });
});
