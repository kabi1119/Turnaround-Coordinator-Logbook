import type { Database } from '../domain/model';
import {
  defaultOptionalFields,
  restrictivePrivacy,
  flightStatuses,
  handlingTypes,
  roles,
} from '../domain/model';
export const STORAGE_KEY = 'tco-logbook-demo-v0.1';
/** Fresh Guest data only; never merge defaults into saved preferences or reseed on load. */
export function emptyGuestDatabase(language: Database['settings']['language'] = 'en'): Database {
  return {
    version: 1,
    aircraft: [],
    duties: [],
    journals: [],
    settings: { language, privacy: { ...defaultOptionalFields } },
  };
}
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object');
const strings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => typeof value[k] === 'string');
export function validDatabase(value: unknown): value is Database {
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
        (d.leave === undefined || ['AL', 'SL'].includes(String(d.leave))) &&
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
            strings(e, ['id', 'category', 'involvement', 'resolution', 'notes']) &&
            (e.impact === undefined || ['Minor', 'Moderate', 'Major'].includes(String(e.impact))) &&
            (e.delayMinutes === undefined ||
              (typeof e.delayMinutes === 'number' &&
                Number.isSafeInteger(e.delayMinutes) &&
                e.delayMinutes >= 0)),
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
export function readDatabase(): {
  db: Database;
  error: string;
  snapshot: string | null | undefined;
} {
  let snapshot: string | null | undefined;
  try {
    const raw = (snapshot = localStorage.getItem(STORAGE_KEY));
    if (raw === null) {
      return { db: emptyGuestDatabase(), error: '', snapshot };
    }
    const value = JSON.parse(raw);
    if (!validDatabase(value)) throw new Error('Unsupported local data');
    return { db: value, error: '', snapshot };
  } catch {
    return {
      db: emptyGuestDatabase(),
      snapshot,
      error:
        'Saved data could not be read. No saved records are being displayed; the stored copy has not been overwritten. Use Settings to recover or explicitly manage local data.',
    };
  }
}
/** Keep the established loader contract for older callers and backups. */
export function loadDatabase(): { db: Database; error: string } {
  const { db, error } = readDatabase();
  return { db, error };
}
export function writeDatabase(db: Database): boolean {
  return persist(db).ok;
}
type WriteResult =
  { ok: true; snapshot: string } | { ok: false; reason: 'invalid' | 'conflict' | 'unavailable' };
/** One-key write, with a conservative stale-page guard. Not a cross-tab transaction. */
export function persistDatabase(db: Database, expected: string | null | undefined): WriteResult {
  return persist(db, { expected });
}
function persist(db: Database, guard?: { expected: string | null | undefined }): WriteResult {
  try {
    const serialized = JSON.stringify(db);
    const decoded: unknown = JSON.parse(serialized);
    if (!validDatabase(decoded)) return { ok: false, reason: 'invalid' };
    for (const rows of [decoded.aircraft, decoded.duties, decoded.journals]) {
      if (
        rows.some((row) => !row.id.trim()) ||
        new Set(rows.map((row) => row.id)).size !== rows.length
      )
        return { ok: false, reason: 'invalid' };
    }
    if (guard) {
      if (guard.expected === undefined) return { ok: false, reason: 'unavailable' };
      if (localStorage.getItem(STORAGE_KEY) !== guard.expected)
        return { ok: false, reason: 'conflict' };
    }
    localStorage.setItem(STORAGE_KEY, serialized);
    return { ok: true, snapshot: serialized };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
