import type { Aircraft, Database } from '../domain/model';
import { v014SeedDatabase as seedDatabase } from './v014Seed';
import { legacySeedDatabase } from './legacySeed';
import { legacyDemoAirlines } from './demoRefresh';

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
const current = seedDatabase();
const historical = [
  ...legacySeedDatabase().aircraft,
  ...legacySeedDatabase(legacyDemoAirlines).aircraft,
];
const fingerprints = new Map(current.aircraft.map((a) => [a.id, stable(a)]));
export const isCurrentDemo = (a: Aircraft) => fingerprints.get(a.id) === stable(a);

export function demoDatasetPlan(db: Database) {
  const blocked: string[] = [];
  const replace: Aircraft[] = [],
    generate: Aircraft[] = [];
  for (const after of current.aircraft) {
    const existing = db.aircraft.filter((a) => a.id === after.id);
    if (existing.length > 1) {
      blocked.push(after.id);
      continue;
    }
    const before = existing[0];
    if (before && stable(before) === stable(after)) continue;
    if (before && !historical.some((s) => stable(s) === stable(before))) {
      blocked.push(after.id);
      continue;
    }
    if (before) replace.push(before);
    generate.push(after);
  }
  const addDuties = current.duties.filter((d) => !db.duties.some((s) => s.id === d.id));
  for (const a of generate) {
    const existing = db.duties.filter((d) => d.id === a.dutyId);
    if (existing.length > 1 || existing.some((d) => d.status === 'Trashed' || d.date !== a.date))
      blocked.push(a.dutyId);
  }
  // Existing Journal text and IDs remain intact; add only a missing required demo Journal.
  const missingJournals = new Set(
    generate.flatMap((a) =>
      a.events.flatMap((e) =>
        e.journalId && !db.journals.some((j) => j.id === e.journalId) ? [e.journalId] : [],
      ),
    ),
  );
  const addJournals = current.journals.filter((j) => missingJournals.has(j.id));
  const replacedIds = new Set(replace.map((a) => a.id));
  return {
    blocked: [...new Set(blocked)],
    replace,
    generate,
    addDuties,
    addJournals,
    linkedJournals: db.journals.filter((j) => j.aircraftIds.some((id) => replacedIds.has(id))),
    eventsRemoved: replace.reduce((n, a) => n + a.events.length, 0),
    eventsGenerated: generate.reduce((n, a) => n + a.events.length, 0),
    token: stable({ aircraft: db.aircraft, duties: db.duties, journals: db.journals }),
  };
}

/** Apply exactly the previewed transaction. Ambiguous IDs or a stale preview cause no mutation. */
export function applyDemoDataset(db: Database, token: string): Database | null {
  const plan = demoDatasetPlan(db);
  if (plan.blocked.length || token !== plan.token) return null;
  const replacing = new Map(plan.generate.map((a) => [a.id, a]));
  const existingIds = new Set(db.aircraft.map((a) => a.id));
  return {
    ...db,
    aircraft: [
      ...db.aircraft.map((a) => replacing.get(a.id) || a),
      ...plan.generate.filter((a) => !existingIds.has(a.id)),
    ],
    duties: [...db.duties, ...plan.addDuties],
    journals: [...db.journals, ...plan.addJournals],
  };
}
