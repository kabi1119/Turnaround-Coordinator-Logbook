import type { Aircraft, Database } from '../domain/model';
import { seedDatabase } from './seed';

/** Historical fixture only; never used by the default entry catalogue or fresh seed. */
export const legacyDemoAirlines = [
  'Cathay Pacific',
  'HK Express',
  'Hong Kong Airlines',
  'Singapore Airlines',
  'ANA',
  'Emirates',
  'Qatar Airways',
  'Lufthansa',
];
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${stable(v)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
export function demoAirlineRefreshPlan(db: Database) {
  const legacy = seedDatabase(legacyDemoAirlines);
  const current = seedDatabase();
  return legacy.aircraft.flatMap((before) => {
    const after = current.aircraft.find((a) => a.id === before.id)!;
    const stored = db.aircraft.find((a) => a.id === before.id);
    if (!stored || before.airline === after.airline || stable(stored) !== stable(before)) return [];
    return [{ id: stored.id, before: before.airline, after: after.airline, date: stored.date }];
  });
}
export function refreshDemoAirlines(db: Database, approvedIds: string[]): Database {
  // Recheck full content at confirmation. Never restore deleted fields or replace edited samples.
  const changes = new Map(
    demoAirlineRefreshPlan(db)
      .filter((row) => approvedIds.includes(row.id))
      .map((row) => [row.id, row.after]),
  );
  return {
    ...db,
    aircraft: db.aircraft.map((a): Aircraft =>
      changes.has(a.id) ? { ...a, airline: changes.get(a.id)! } : a,
    ),
  };
}
