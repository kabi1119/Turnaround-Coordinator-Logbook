import type { Database, Duty } from './model';
import { hkToday } from './model';

export function monthDates(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, mon] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

export function shiftRange(d: Pick<Duty, 'date' | 'start' | 'end'>) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(d.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.start) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.end) ||
    d.start === d.end
  )
    return null;
  const start = Date.parse(`${d.date}T${d.start}:00+08:00`);
  if (!Number.isFinite(start) || hkToday(new Date(start)) !== d.date) return null;
  const end = Date.parse(`${d.date}T${d.end}:00+08:00`) + (d.end < d.start ? 86400000 : 0);
  return { start, end, endDate: hkToday(new Date(end)), overnight: d.end < d.start };
}

export function completedDuty(d: Duty, now = Date.now()) {
  if (d.status !== 'Confirmed' || d.workState === 'Planned') return false;
  if (!d.workState) return true; // Non-destructive interpretation of legacy v0.1.1 data.
  const range = shiftRange(d);
  return range ? range.end <= now : Boolean(d.date && d.date <= hkToday(new Date(now)));
}

export interface RosterConflict {
  kind: 'duplicate' | 'overlap';
  entry: Duty;
  other: Duty;
  saved: boolean;
}
export function rosterConflicts(entries: Duty[], saved: Duty[]): RosterConflict[] {
  const conflicts: RosterConflict[] = [];
  entries.forEach((entry, i) => {
    for (const other of [...entries.slice(i + 1), ...saved.filter((d) => d.status !== 'Trashed')]) {
      if (entry.id === other.id) continue;
      const same =
        entry.date === other.date && entry.start === other.start && entry.end === other.end;
      const a = shiftRange(entry),
        b = shiftRange(other);
      if (same || (a && b && a.start < b.end && b.start < a.end)) {
        conflicts.push({
          kind: same ? 'duplicate' : 'overlap',
          entry,
          other,
          saved: saved.some((d) => d.id === other.id),
        });
      }
    }
  });
  return conflicts;
}

export function appendRoster(db: Database, entries: Duty[]): Database {
  // Stable pending IDs make a retry idempotent, without merging by date or overwriting records.
  const ids = new Set(db.duties.map((d) => d.id));
  const added: Duty[] = [];
  for (const entry of entries) {
    if (!ids.has(entry.id)) {
      added.push(entry);
      ids.add(entry.id);
    }
  }
  return { ...db, duties: [...db.duties, ...added] };
}
