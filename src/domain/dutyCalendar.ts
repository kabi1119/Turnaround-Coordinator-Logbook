import type { Database, Duty } from './model';
import { hkToday } from './model';
import { completedDuty, monthDates, rosterConflicts, shiftRange } from './roster';

export type DutyKind = 'Scheduled' | 'Worked' | 'AL' | 'SL';
export type DayStatus = 'AL' | 'SL' | 'Scheduled' | 'Currently Working' | 'Worked' | 'Not recorded';
export function validDutyDate(date: string) {
  return monthDates(date.slice(0, 7)).includes(date);
}
export function eligibleSickDuty(d: Duty) {
  return d.status === 'Confirmed' && d.workState === 'Planned' && !d.leave && !!shiftRange(d);
}
/** One marker only; leave > unresolved scheduled > explicitly completed. Never mutates records. */
export function resolveDutyDay(duties: Duty[], date: string, now = Date.now()): DayStatus | null {
  const rows = duties.filter((d) => d.date === date && d.status !== 'Trashed');
  if (rows.some((d) => d.leave === 'SL')) return 'SL';
  if (rows.some((d) => d.leave === 'AL')) return 'AL';
  const scheduled = rows.filter((d) => d.workState === 'Planned');
  if (scheduled.length) {
    return scheduled.some((d) => {
      const r = shiftRange(d);
      return d.status === 'Confirmed' && r && r.start <= now && now < r.end;
    })
      ? 'Currently Working'
      : 'Scheduled';
  }
  if (rows.some((d) => d.workState === 'Worked' && completedDuty(d, now))) return 'Worked';
  return rows.length ? 'Not recorded' : null;
}
export function dutyTotals(duties: Duty[], now = Date.now()) {
  const totals = {
    scheduledHours: 0,
    workedHours: 0,
    sickHours: 0,
    annualDates: 0,
    sickDates: 0,
    workedShifts: 0,
  };
  const annual = new Set<string>(),
    sick = new Set<string>();
  for (const d of duties.filter((row) => row.status === 'Confirmed')) {
    const r = shiftRange(d),
      hours = r ? (r.end - r.start) / 3600000 : 0;
    if (d.leave === 'AL') annual.add(d.date);
    else if (d.leave === 'SL') {
      sick.add(d.date);
      totals.sickHours += hours;
    } else if (d.workState === 'Planned') totals.scheduledHours += hours;
    else if (completedDuty(d, now)) {
      totals.workedHours += hours;
      totals.workedShifts++;
    }
  }
  totals.annualDates = annual.size;
  totals.sickDates = sick.size;
  return totals;
}
export function batchProblem(entries: Duty[], saved: Duty[], kind: DutyKind, now = Date.now()) {
  if (!entries.length) return 'empty';
  if (new Set(entries.map((d) => d.id)).size !== entries.length) return 'duplicate';
  for (const d of entries) {
    if (!validDutyDate(d.date) || d.status !== 'Confirmed') return `invalid:${d.date}`;
    if (kind === 'AL') {
      if (d.leave !== 'AL' || d.start || d.end) return `invalid:${d.date}`;
    } else if (kind === 'SL') {
      const original = saved.find((row) => row.id === d.id);
      if (
        !original ||
        !eligibleSickDuty(original) ||
        JSON.stringify({ ...original, leave: 'SL' }) !== JSON.stringify(d)
      )
        return `sick:${d.date}`;
    } else if (
      d.leave ||
      d.workState !== (kind === 'Scheduled' ? 'Planned' : 'Worked') ||
      !shiftRange(d) ||
      (kind === 'Worked' && !completedDuty(d, now))
    )
      return `invalid:${d.date}`;
    if (kind !== 'SL' && saved.some((row) => row.id === d.id)) return 'duplicate';
  }
  return '';
}
/** Validate the whole batch before creating a replacement database; never partially save. */
export function commitDutyBatch(
  db: Database,
  entries: Duty[],
  kind: DutyKind,
  overlapOverride = false,
  now = Date.now(),
): Database | null {
  if (batchProblem(entries, db.duties, kind, now)) return null;
  const conflicts = rosterConflicts(entries, db.duties);
  if (conflicts.some((c) => c.kind !== 'overlap') || (conflicts.length && !overlapOverride))
    return null;
  if (kind === 'SL') {
    const conversions = new Map(entries.map((d) => [d.id, d]));
    return { ...db, duties: db.duties.map((d) => conversions.get(d.id) || d) };
  }
  return { ...db, duties: [...db.duties, ...entries] };
}

/** Explicit fictional preview only: no storage writes, IDs or historical sample refresh changes. */
export function calendarExamples(month: string, now = Date.now()): Duty[] {
  const today = hkToday(new Date(now));
  return monthDates(month).flatMap((date) => {
    const day = Number(date.slice(-2));
    const row: Duty = {
      id: `calendar-preview-${date}`,
      date,
      start: '08:00',
      end: '16:00',
      status: 'Confirmed',
      workState: date < today ? 'Worked' : 'Planned',
      notes: '',
    };
    if (day === 5) return [{ ...row, leave: 'AL' as const, start: '', end: '' }];
    if (day === 9)
      return [
        { ...row, workState: 'Planned' as const, leave: 'SL' as const },
        { ...row, id: `${row.id}-second`, start: '17:00', end: '21:00' },
      ];
    if (date === today) return [{ ...row, start: '00:00', end: '23:59' }];
    return [row];
  });
}
