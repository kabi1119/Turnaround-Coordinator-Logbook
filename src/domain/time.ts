import type { Aircraft, Privacy } from './model';
import { hkToday } from './model';
import { hasArrival, hasDeparture } from './selectors';

export function gateDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+08:00`);
  if (!Number.isFinite(date.getTime())) return null;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value) && hkToday(date) !== value.slice(0, 10)) return null;
  return date;
}

export function gateText(value: string, full = false): string {
  const date = gateDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hong_Kong',
    ...(full ? ({ year: 'numeric', month: '2-digit', day: '2-digit' } as const) : {}),
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function aircraftTimes(a: Aircraft, privacy: Privacy) {
  if (!privacy.gateTimes) return [];
  return (['arrival', 'departure'] as const)
    .filter((key) => (key === 'arrival' ? hasArrival(a) : hasDeparture(a)))
    .flatMap((key) => {
      const leg = a[key];
      const actual = gateDate(leg.actual);
      const scheduled = gateDate(leg.scheduled);
      if (!actual && !scheduled) return [];
      const value = actual ? leg.actual : leg.scheduled;
      return [
        {
          key,
          scheduled: !actual,
          label: key === 'arrival' ? (actual ? 'AIBT' : 'SIBT') : actual ? 'AOBT' : 'SOBT',
          value: gateText(value, hkToday((actual || scheduled)!) !== a.date),
        },
      ];
    });
}

export function formatHKClock(now: Date, locale: string) {
  return {
    date: new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    }).format(now),
    time: new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Hong_Kong',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  };
}
