import { hkToday } from './model';
import { validDutyDate } from './dutyCalendar';

/** Offset-less historical gate timestamps are Hong Kong local time. */
export function gateDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+08:00`);
  if (!Number.isFinite(date.getTime())) return null;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value) && hkToday(date) !== value.slice(0, 10)) return null;
  return date;
}

export function blockTimeParts(value: string) {
  const date = gateDate(value);
  return date
    ? {
        date: hkToday(date),
        time: new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Hong_Kong',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(date),
      }
    : { date: '', time: '' };
}

/** Only explicit date/time edits create a new minute-precision value. */
export function blockTimeValue(date: string, time: string) {
  return validDutyDate(date) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
    ? `${date}T${time}:00+08:00`
    : null;
}
