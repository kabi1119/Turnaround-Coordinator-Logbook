import type { Database } from '../domain/model';
import { restrictivePrivacy, flightStatuses, handlingTypes, roles } from '../domain/model';
import { seedDatabase } from '../data/seed';
export const STORAGE_KEY = 'tco-logbook-demo-v0.1';
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object');
const strings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => typeof value[k] === 'string');
function validDatabase(value: unknown): value is Database {
  if (
    !object(value) ||
    value.version !== 1 ||
    !Array.isArray(value.aircraft) ||
    !Array.isArray(value.duties) ||
    !Array.isArray(value.journals) ||
    !object(value.settings) ||
    !object(value.settings.privacy)
  )
    return false;
  const privacy = value.settings.privacy;
  const validLeg = (leg: unknown) =>
    object(leg) &&
    strings(leg, ['flight', 'status', 'origin', 'scheduled', 'actual']) &&
    flightStatuses.some((s) => s === leg.status);
  return (
    ['en', 'zh-HK'].includes(String(value.settings.language)) &&
    Object.keys(restrictivePrivacy).every((k) => typeof privacy[k] === 'boolean') &&
    value.duties.every(
      (d) =>
        object(d) &&
        strings(d, ['id', 'date', 'start', 'end', 'status', 'notes']) &&
        ['Draft', 'Confirmed', 'Trashed'].includes(String(d.status)) &&
        (d.workState === undefined || ['Planned', 'Worked'].includes(String(d.workState))) &&
        (d.shiftType === undefined ||
          ['Day', 'Evening', 'Night', 'Custom'].includes(String(d.shiftType))),
    ) &&
    value.aircraft.every(
      (a) =>
        object(a) &&
        strings(a, [
          'id',
          'date',
          'dutyId',
          'airline',
          'variant',
          'family',
          'icao',
          'handling',
          'role',
          'registration',
          'bay',
          'disruption',
          'notes',
          'status',
          'createdAt',
          'updatedAt',
        ]) &&
        ['Draft', 'Confirmed', 'Trashed'].includes(String(a.status)) &&
        ['Unknown', 'Normal', 'Disrupted'].includes(String(a.disruption)) &&
        [...handlingTypes, ''].includes(String(a.handling)) &&
        [...roles, ''].includes(String(a.role)) &&
        typeof a.actualHandling === 'boolean' &&
        validLeg(a.arrival) &&
        validLeg(a.departure) &&
        Array.isArray(a.events) &&
        a.events.every(
          (e) =>
            object(e) &&
            strings(e, ['id', 'category', 'involvement', 'impact', 'resolution', 'notes']),
        ) &&
        Array.isArray(a.revisions) &&
        a.revisions.every((r) => object(r) && strings(r, ['at', 'summary'])),
    ) &&
    value.journals.every(
      (j) =>
        object(j) &&
        strings(j, [
          'id',
          'date',
          'title',
          'status',
          'situation',
          'challenge',
          'responsibility',
          'actions',
          'result',
          'learning',
          'dutyId',
          'outcome',
          'unit',
          'contribution',
          'evidence',
          'verification',
        ]) &&
        ['Draft', 'Confirmed'].includes(String(j.status)) &&
        Array.isArray(j.tags) &&
        j.tags.every((tag) => typeof tag === 'string') &&
        Array.isArray(j.aircraftIds) &&
        j.aircraftIds.every((id) => typeof id === 'string'),
    )
  );
}
export function loadDatabase(): { db: Database; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { db: seedDatabase(), error: '' };
    const value = JSON.parse(raw);
    if (!validDatabase(value)) throw new Error('Unsupported demo data');
    return { db: value, error: '' };
  } catch {
    return {
      db: seedDatabase(),
      error:
        'Saved demo data could not be read. A temporary demo is shown; the stored copy has not been overwritten. Reset explicitly to replace it.',
    };
  }
}
export function writeDatabase(db: Database): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}
