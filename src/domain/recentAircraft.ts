import type { Aircraft } from './model';
import { hkToday } from './model';
import { validDutyDate } from './dutyCalendar';

/** Home display only: today and six preceding HK dates, all existing non-Trashed statuses. */
export function recentAircraft(records: Aircraft[], today = hkToday()) {
  const from = hkToday(new Date(Date.parse(`${today}T00:00:00+08:00`) - 6 * 86400000));
  return records
    .filter(
      (a) => a.status !== 'Trashed' && validDutyDate(a.date) && a.date >= from && a.date <= today,
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, 4);
}
