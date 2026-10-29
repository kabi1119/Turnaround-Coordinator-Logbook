import type { Database } from '../domain/model';
import { seedDatabase } from './seed';
import { legacySeedDatabase } from './legacySeed';
import { v014SeedDatabase } from './v014Seed';
import { legacyDemoAirlines } from './demoRefresh';

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.entries(v)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, x]) => JSON.stringify(k) + ':' + stable(x))
      .join(',')}}`;
  return JSON.stringify(v) ?? 'undefined';
}
let fixtures: { current: Database; previous: Database[] } | undefined;
function sampleFixtures() {
  return (fixtures ??= {
    current: seedDatabase(),
    previous: [legacySeedDatabase(), legacySeedDatabase(legacyDemoAirlines), v014SeedDatabase()],
  });
}
const keys = ['aircraft', 'duties', 'journals'] as const;
/** Exact frozen fixture content only; IDs or user-entered text alone do not establish provenance. */
export function hasKnownSamples(db: Database): boolean {
  if (!keys.some((key) => db[key].length)) return false;
  const { current, previous } = sampleFixtures();
  return keys.some((key) =>
    db[key].some((row) =>
      [current, ...previous].some((fixture) =>
        fixture[key].some((known) => known.id === row.id && stable(known) === stable(row)),
      ),
    ),
  );
}
export function sampleRefreshPlan(db: Database) {
  const { current, previous } = sampleFixtures();
  const blocked: string[] = [];
  const remove = { aircraft: [] as string[], duties: [] as string[], journals: [] as string[] };
  const add = {
    aircraft: [] as Database['aircraft'],
    duties: [] as Database['duties'],
    journals: [] as Database['journals'],
  };
  for (const key of keys) {
    const known: { id: string }[] = [...current[key]];
    for (const p of previous) known.push(...p[key]);
    const seen = new Set<string>();
    for (const row of db[key]) {
      if (seen.has(row.id)) blocked.push(row.id);
      seen.add(row.id);
      if (!known.some((k) => k.id === row.id)) continue;
      if (!known.some((k) => stable(k) === stable(row))) {
        blocked.push(row.id);
        continue;
      }
      if (!current[key].some((k) => stable(k) === stable(row))) remove[key].push(row.id);
    }
  }
  // Never delete a parent/link target still referenced by a preserved user record.
  for (const a of db.aircraft.filter((a) => !remove.aircraft.includes(a.id))) {
    if (
      remove.duties.includes(a.dutyId) ||
      (a.originalDutyId && remove.duties.includes(a.originalDutyId))
    )
      blocked.push(a.id);
    if (a.events.some((e) => e.journalId && remove.journals.includes(e.journalId)))
      blocked.push(a.id);
  }
  for (const j of db.journals.filter((j) => !remove.journals.includes(j.id))) {
    if (
      remove.duties.includes(j.dutyId) ||
      (j.originalDutyId && remove.duties.includes(j.originalDutyId)) ||
      j.aircraftIds.some((id) => remove.aircraft.includes(id))
    )
      blocked.push(j.id);
  }
  add.aircraft = current.aircraft.filter((a) => !db.aircraft.some((x) => x.id === a.id));
  add.duties = current.duties.filter((a) => !db.duties.some((x) => x.id === a.id));
  add.journals = current.journals.filter((a) => !db.journals.some((x) => x.id === a.id));
  return {
    blocked: [...new Set(blocked)],
    remove,
    add,
    token: stable(db),
    changed: keys.some((k) => remove[k].length || add[k].length),
  };
}
export function refreshSamples(db: Database, token: string): Database | null {
  const p = sampleRefreshPlan(db);
  if (p.blocked.length || token !== p.token) return null;
  return {
    ...db,
    aircraft: [...db.aircraft.filter((a) => !p.remove.aircraft.includes(a.id)), ...p.add.aircraft],
    duties: [...db.duties.filter((a) => !p.remove.duties.includes(a.id)), ...p.add.duties],
    journals: [...db.journals.filter((a) => !p.remove.journals.includes(a.id)), ...p.add.journals],
  };
}
