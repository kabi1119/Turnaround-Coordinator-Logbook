import type { Aircraft } from './model';
import { hkToday, roles } from './model';
import { stats } from './selectors';
import { handlingDisplayStatus } from './handlingForm';
import { validDutyDate } from './dutyCalendar';
import { findAirline } from '../data/airlines';
import { aircraftCatalogue, aircraftModel } from '../data/aircraftCatalogue';

export type HandlingScope = 'unfinished' | 'Draft' | 'Pending' | 'Confirmed';
export function matchesHandlingScope(a: Aircraft, scope: HandlingScope | undefined, today: string) {
  if (a.status === 'Trashed') return false;
  const status = handlingDisplayStatus(a, today);
  return (
    !scope ||
    (scope === 'unfinished' ? status === 'Draft' || status === 'Pending' : status === scope)
  );
}

type Identity = { key: string; label: string };
function frequent(rows: Aircraft[], identity: (a: Aircraft) => Identity | null) {
  const counts = new Map<string, Identity & { count: number; latest: string }>();
  for (const a of rows) {
    const value = identity(a);
    if (!value) continue;
    const prior = counts.get(value.key);
    counts.set(value.key, {
      ...value,
      label: prior && prior.label < value.label ? prior.label : value.label,
      count: (prior?.count || 0) + 1,
      latest: prior && prior.latest > a.date ? prior.latest : a.date,
    });
  }
  // Frequency, latest operational date, then stable canonical key; never input order.
  return (
    [...counts.values()].sort(
      (a, b) =>
        b.count - a.count ||
        b.latest.localeCompare(a.latest) ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    )[0] || null
  );
}
function aircraftIdentity(a: Aircraft): Identity | null {
  const variant = a.variant.trim();
  if (variant) {
    const canonical = aircraftCatalogue
      .flatMap((type) => [...type.variants])
      .find((v) => v.toUpperCase() === variant.toUpperCase());
    // Retain meaningful historical/custom variant snapshots, without guessing a registration/type.
    return { key: `variant:${(canonical || variant).toUpperCase()}`, label: canonical || variant };
  }
  const model = aircraftCatalogue.find(
    (type) => type.model.toUpperCase() === aircraftModel(a).trim().toUpperCase(),
  );
  return model ? { key: `type:${model.model}`, label: model.model } : null;
}
export function homeSummary(records: Aircraft[], now = Date.now()) {
  const today = hkToday(new Date(now));
  const from = hkToday(new Date(Date.parse(`${today}T00:00:00+08:00`) - 29 * 86400000));
  const eligible = records.filter(
    (a) => a.status === 'Confirmed' && (a.role === roles[0] || a.role === roles[1]),
  );
  const recent = eligible.filter((a) => validDutyDate(a.date) && a.date >= from && a.date <= today);
  return {
    lifetime: stats(records).handled,
    from,
    today,
    airline: frequent(recent, (a) => {
      const airline = findAirline(a.airline);
      return airline ? { key: airline.iata, label: `${airline.name} (${airline.iata})` } : null;
    }),
    aircraft: frequent(recent, aircraftIdentity),
    drafts: records.filter((a) => matchesHandlingScope(a, 'Draft', today)).length,
    pending: records.filter((a) => matchesHandlingScope(a, 'Pending', today)).length,
  };
}
