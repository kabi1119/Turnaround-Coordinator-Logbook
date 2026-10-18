import type { Duty } from './model';
import { hkToday } from './model';
import { validDutyDate } from './dutyCalendar';
import { shiftRange } from './roster';

/** Presentation only: a schedule interval never establishes attendance or changes stored progress. */
export function homeDutySchedule(duties: Duty[], now: number) {
  const today = hkToday(new Date(now));
  const eligible = duties.filter(
    (d) =>
      d.status === 'Confirmed' && d.workState === 'Planned' && !d.leave && validDutyDate(d.date),
  );
  const current = eligible.filter((d) => {
    const range = shiftRange(d);
    return range && range.start <= now && now < range.end;
  });
  const future = eligible
    .filter((d) => {
      if (current.some((row) => row.id === d.id)) return false;
      const range = shiftRange(d);
      if (range) return range.start > now;
      if (d.start)
        return (
          /^([01]\d|2[0-3]):[0-5]\d$/.test(d.start) &&
          Date.parse(`${d.date}T${d.start}:00+08:00`) > now
        );
      return d.date >= today;
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.start || '99:99').localeCompare(b.start || '99:99') ||
        a.id.localeCompare(b.id),
    );
  // Expose every tied start (including unknown times), rather than choosing an arbitrary record ID.
  const next = future.filter((d) => d.date === future[0]?.date && d.start === future[0]?.start);
  return { current, next, remaining: future.length - next.length };
}
