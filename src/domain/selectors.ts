import { flightStatuses, handlingTypes, roles } from './model';
import type { Aircraft, Database, Filters, Privacy, PrivacyKey, Duty, Journal } from './model';
export const normalizeRegistration = (v: string) => v.trim().toUpperCase();
export const hasArrival = (a: Aircraft) =>
  a.handling === 'Full Turnaround' || a.handling === 'Arrival Only';
export const hasDeparture = (a: Aircraft) =>
  a.handling === 'Full Turnaround' || a.handling === 'Departure Only';
export function classifyDelta(seconds: number) {
  return seconds < -900 ? 'Early' : seconds < 900 ? 'On Time' : 'Delayed';
}
export function gateSuggestion(scheduled: string, actual: string) {
  if (!scheduled || !actual) return null;
  const delta = (Date.parse(`${actual}+08:00`) - Date.parse(`${scheduled}+08:00`)) / 1000;
  return Number.isFinite(delta) ? classifyDelta(delta) : null;
}
export function visibleAircraft(a: Aircraft, p: Privacy): Aircraft {
  return {
    ...a,
    registration: p.registration ? a.registration : '',
    bay: p.bay ? a.bay : '',
    arrival: {
      ...a.arrival,
      flight: p.flights ? a.arrival.flight : '',
      status: p.statuses ? a.arrival.status : 'Not Recorded',
      origin: p.statuses ? a.arrival.origin : 'Self-reported',
      scheduled: p.gateTimes ? a.arrival.scheduled : '',
      actual: p.gateTimes ? a.arrival.actual : '',
    },
    departure: {
      ...a.departure,
      flight: p.flights ? a.departure.flight : '',
      status: p.statuses ? a.departure.status : 'Not Recorded',
      origin: p.statuses ? a.departure.origin : 'Self-reported',
      scheduled: p.gateTimes ? a.departure.scheduled : '',
      actual: p.gateTimes ? a.departure.actual : '',
    },
    events: a.events.map((e) => ({ ...e, notes: p.disruptionNotes ? e.notes : '' })),
  };
}
export function cardText(a: Aircraft, p: Privacy) {
  const flights = p.flights
    ? [hasArrival(a) && a.arrival.flight, hasDeparture(a) && a.departure.flight]
        .filter(Boolean)
        .join(' / ')
    : '';
  return {
    title: [a.airline || 'Untitled aircraft', flights].filter(Boolean).join(' '),
    subtitle: `${a.role || 'Role not selected'} · ${a.variant || 'Type not selected'}${p.registration && a.registration ? ` (${a.registration})` : ''}`,
  };
}
export function filterAircraft(records: Aircraft[], filters: Filters, privacy: Privacy) {
  return records.filter((raw) => {
    const a = visibleAircraft(raw, privacy);
    const q = filters.query?.trim().toLowerCase();
    return (
      (!filters.from || a.date >= filters.from) &&
      (!filters.to || a.date <= filters.to) &&
      (!filters.airline || a.airline === filters.airline) &&
      (!filters.family || a.family === filters.family) &&
      (!filters.variant || a.variant === filters.variant) &&
      (!filters.role || a.role === filters.role) &&
      (!filters.handling || a.handling === filters.handling) &&
      (!filters.disruption || a.disruption === filters.disruption) &&
      (!privacy.statuses ||
        !filters.arrival ||
        (hasArrival(a) && a.arrival.status === filters.arrival)) &&
      (!privacy.statuses ||
        !filters.departure ||
        (hasDeparture(a) && a.departure.status === filters.departure)) &&
      (!q ||
        [
          a.airline,
          a.variant,
          a.family,
          a.registration,
          a.bay,
          a.arrival.flight,
          a.departure.flight,
          a.role,
          a.handling,
          a.date,
          a.disruption,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q))
    );
  });
}
export function stats(records: Aircraft[], duties: Duty[] = []) {
  const rows = records.filter((a) => a.status === 'Confirmed');
  const p = rows.filter((a) => a.role === roles[0]).length,
    s = rows.filter((a) => a.role === roles[1]).length,
    t = rows.filter((a) => a.role === roles[2]).length;
  return {
    logged: rows.length,
    handled: p + s,
    primary: p,
    supporting: s,
    training: t,
    unique: new Set(rows.map((a) => normalizeRegistration(a.registration)).filter(Boolean)).size,
    duties: duties.filter((d) => d.status === 'Confirmed').length,
    events: rows.reduce((n, a) => n + a.events.length, 0),
    disrupted: rows.filter((a) => a.events.length > 0).length,
    types: handlingTypes.map((type) => ({
      type,
      logged: rows.filter((a) => a.handling === type).length,
      handled: rows.filter((a) => a.handling === type && a.role !== roles[2]).length,
      primary: rows.filter((a) => a.handling === type && a.role === roles[0]).length,
    })),
    arrival: flightStatuses.map((status) => ({
      status,
      count: rows.filter((a) => hasArrival(a) && a.arrival.status === status).length,
    })),
    departure: flightStatuses.map((status) => ({
      status,
      count: rows.filter((a) => hasDeparture(a) && a.departure.status === status).length,
    })),
  };
}
export function ranking(
  records: Aircraft[],
  key: 'airline' | 'variant' | 'family' | 'registration' | 'month',
) {
  const counts = new Map<string, number>();
  records
    .filter((a) => a.status === 'Confirmed')
    .forEach((a) => {
      const value =
        key === 'month'
          ? a.date.slice(0, 7)
          : key === 'registration'
            ? normalizeRegistration(a.registration)
            : a[key];
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    });
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
export const isComplete = (a: Aircraft) =>
  Boolean(a.date && a.airline.trim() && a.variant && a.handling && a.role && a.actualHandling);
export function duplicates(a: Aircraft, records: Aircraft[], p: Privacy) {
  return records.filter(
    (b) =>
      b.id !== a.id &&
      b.status !== 'Trashed' &&
      a.date === b.date &&
      a.dutyId === b.dutyId &&
      a.handling === b.handling &&
      a.airline === b.airline &&
      a.variant === b.variant &&
      ((p.registration &&
        a.registration &&
        normalizeRegistration(a.registration) === normalizeRegistration(b.registration)) ||
        (p.flights &&
          ((hasArrival(a) && a.arrival.flight && a.arrival.flight === b.arrival.flight) ||
            (hasDeparture(a) && a.departure.flight && a.departure.flight === b.departure.flight)))),
  );
}
export function resolveDuty(date: string, duties: Duty[]) {
  const options = duties.filter((d) => d.status !== 'Trashed' && d.date === date);
  return {
    options,
    selected: options.length === 1 ? options[0].id : options.length === 0 ? 'new' : '',
    ambiguous: options.length > 1,
  };
}
export function timelineDate(a: Aircraft, duties: Duty[]) {
  return duties.find((d) => d.id === a.dutyId && d.status !== 'Trashed')?.date || a.date;
}
export function trashDuty(db: Database, dutyId: string, now = new Date().toISOString()): Database {
  return {
    ...db,
    duties: db.duties.map((d) =>
      d.id === dutyId ? { ...d, previousStatus: d.status, status: 'Trashed', trashedAt: now } : d,
    ),
    aircraft: db.aircraft.map((a) =>
      a.dutyId === dutyId ? { ...a, dutyId: '', originalDutyId: dutyId } : a,
    ),
    journals: db.journals.map((j) =>
      j.dutyId === dutyId ? { ...j, dutyId: '', originalDutyId: dutyId } : j,
    ),
  };
}
export function restoreDuty(db: Database, dutyId: string, reconnect: boolean): Database {
  return {
    ...db,
    duties: db.duties.map((d) =>
      d.id === dutyId ? { ...d, status: d.previousStatus || 'Draft', trashedAt: undefined } : d,
    ),
    aircraft: db.aircraft.map((a) =>
      reconnect && a.originalDutyId === dutyId && !a.dutyId
        ? { ...a, dutyId, originalDutyId: undefined }
        : a,
    ),
    journals: db.journals.map((j) =>
      reconnect && j.originalDutyId === dutyId && !j.dutyId && !j.aircraftIds.length
        ? { ...j, dutyId, originalDutyId: undefined }
        : j,
    ),
  };
}
export const canRestore = (trashedAt?: string, now = Date.now()) =>
  Boolean(trashedAt && now - Date.parse(trashedAt) < 30 * 86400000);
export function saveAircraft(db: Database, record: Aircraft, newDuty?: Duty): Database {
  return {
    ...db,
    duties:
      newDuty && !db.duties.some((d) => d.id === newDuty.id) ? [...db.duties, newDuty] : db.duties,
    aircraft: db.aircraft.some((a) => a.id === record.id)
      ? db.aircraft.map((a) => (a.id === record.id ? record : a))
      : [record, ...db.aircraft],
  };
}
export function clearPrivateField(db: Database, key: PrivacyKey): Database {
  const privacy = { ...db.settings.privacy, [key]: false };
  return {
    ...db,
    settings: { ...db.settings, privacy },
    aircraft: db.aircraft.map((a) =>
      visibleAircraft(a, {
        registration: true,
        flights: true,
        bay: true,
        gateTimes: true,
        statuses: true,
        disruptionNotes: true,
        [key]: false,
      }),
    ),
  };
}
// Allowlisted sanitized stories: linked IDs and operational fields never enter reports.
export function sanitizedStory(j: Journal) {
  return {
    title: j.title,
    date: j.date,
    situation: j.situation,
    challenge: j.challenge,
    responsibility: j.responsibility,
    actions: j.actions,
    result: j.result,
    learning: j.learning,
    tags: j.tags,
    outcome: j.outcome,
    unit: j.unit,
    contribution: j.contribution,
    evidence: j.evidence,
    verification: j.verification,
  };
}
export function report(
  db: Database,
  from: string,
  to: string,
  scope: 'primary' | 'handled',
  categories: string[],
  storyIds: string[],
) {
  const rows = db.aircraft.filter(
    (a) =>
      a.status === 'Confirmed' &&
      a.role !== roles[2] &&
      (scope === 'handled' || a.role === roles[0]) &&
      (!from || a.date >= from) &&
      (!to || a.date <= to),
  );
  const counts = stats(rows)
    .types.filter((t) => categories.includes(t.type))
    .map((t) => ({
      category:
        t.type === 'Full Turnaround'
          ? 'Full Turnarounds Coordinated'
          : t.type === 'Departure Only'
            ? 'Departure-only Assignments Coordinated'
            : 'Arrival-only Assignments Coordinated',
      count: t.handled,
    }));
  return {
    notice: 'SYNTHETIC DEMO ONLY. Self-reported; not employer verified. Not a full backup.',
    from,
    to,
    roleScope:
      scope === 'primary' ? 'Primary only' : 'Primary + Supporting (includes assisted work)',
    trainingExcluded: true,
    counts,
    total: counts.reduce((n, t) => n + t.count, 0),
    stories: db.journals
      .filter(
        (j) =>
          storyIds.includes(j.id) &&
          j.status === 'Confirmed' &&
          (!from || j.date >= from) &&
          (!to || j.date <= to),
      )
      .map(sanitizedStory),
  };
}
