import type { Aircraft, Leg } from '../domain/model';
import { findAirline } from '../data/airlines';
import { validDutyDate } from '../domain/dutyCalendar';
import { canonical } from '../sync/records';

export type MatchKind = 'exact' | 'likely' | 'conflicting' | 'partial' | 'ambiguous';
export type Difference = {
  field: string;
  cloud: unknown;
  local: unknown;
  state: 'match' | 'cloud-only' | 'local-only' | 'conflict';
};
export type Candidate = {
  localId: string;
  cloudId: string;
  kind: Exclude<MatchKind, 'ambiguous'>;
  reasons: string[];
  canonicalFlights: string[];
  differences: Difference[];
};
export type MatchGroup = {
  id: string;
  localIds: string[];
  cloudIds: string[];
  kind: MatchKind;
  candidates: Candidate[];
  bulkEligible: boolean;
};
export class MergeError extends Error {
  constructor(
    public code: 'invalid' | 'capacity' | 'stage' | 'stale' | 'unresolved' | 'manual' | 'identity',
  ) {
    super(code);
  }
}
export function airlineIdentity(value: string): string {
  return (
    findAirline(value)?.iata ||
    (/^[A-Z0-9]{2}$/i.test(value.trim())
      ? value.trim().toUpperCase()
      : 'custom:' + value.trim().toLocaleLowerCase('en'))
  );
}
/** Comparison only. Stored strings are never rewritten. Zero/prefix-only/malformed flights are not identifiers. */
export function canonicalFlight(raw: string): string | null {
  const m = /^([A-Z0-9]{2})([0-9]{1,12})([A-Z]?)$/i.exec(raw.trim());
  if (!m || !/[A-Z]/i.test(m[1]) || !/[1-9]/.test(m[2])) return null;
  return m[1].toUpperCase() + m[2].replace(/^0+/, '') + m[3].toUpperCase();
}
function applicable(a: Aircraft): ('arrival' | 'departure')[] {
  return a.handling === 'Full Turnaround'
    ? ['arrival', 'departure']
    : a.handling === 'Arrival Only'
      ? ['arrival']
      : a.handling === 'Departure Only'
        ? ['departure']
        : [];
}
function instant(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d\d:\d\d/.test(value) || !validDutyDate(value.slice(0, 10)))
    return null;
  const n = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value + '+08:00');
  return Number.isFinite(n) ? n : null;
}
function sameInstant(a: Leg, b: Leg) {
  return (['actual', 'scheduled'] as const).some((k) => {
    const first = instant(a[k]),
      second = instant(b[k]);
    return first !== null && second !== null && first === second;
  });
}
function flatten(value: unknown, prefix = '', result: Record<string, unknown> = {}) {
  if (value && typeof value === 'object' && Object.keys(value).length) {
    for (const [key, child] of Object.entries(value))
      flatten(child, prefix ? prefix + '.' + key : key, result);
  } else result[prefix] = value;
  return result;
}
const empty = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);
function equalField(field: string, a: unknown, b: unknown) {
  if (field === 'airline' && typeof a === 'string' && typeof b === 'string')
    return airlineIdentity(a) === airlineIdentity(b);
  if (
    /^(arrival|departure)\.flight$/.test(field) &&
    typeof a === 'string' &&
    typeof b === 'string'
  ) {
    const first = canonicalFlight(a),
      second = canonicalFlight(b);
    return first && second ? first === second : a === b;
  }
  return canonical(a ?? null) === canonical(b ?? null);
}
/** Includes archived/disabled fields. Only show within an authenticated, consented migration review. */
export function compareFields(cloud: unknown, local: unknown): Difference[] {
  const a = flatten(cloud),
    b = flatten(local);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().map((field) => ({
    field,
    cloud: a[field],
    local: b[field],
    state: equalField(field, a[field], b[field])
      ? 'match'
      : empty(a[field])
        ? 'local-only'
        : empty(b[field])
          ? 'cloud-only'
          : 'conflict',
  }));
}
const metadata = (field: string) =>
  ['id', 'createdAt', 'updatedAt'].includes(field) ||
  field.startsWith('revisions') ||
  /^events\.\d+\.id$/.test(field);
export function compareAircraft(local: Aircraft, cloud: Aircraft): Candidate | null {
  const sameId = local.id === cloud.id;
  if (!sameId && airlineIdentity(local.airline) !== airlineIdentity(cloud.airline)) return null;
  const legs = applicable(local).filter((k) => applicable(cloud).includes(k));
  const matching = legs.filter((k) => {
    const flight = canonicalFlight(local[k].flight);
    return flight !== null && flight === canonicalFlight(cloud[k].flight);
  });
  const sameDate = validDutyDate(local.date) && local.date === cloud.date;
  const adjacent =
    validDutyDate(local.date) &&
    validDutyDate(cloud.date) &&
    Math.abs(Date.parse(local.date + 'T00:00:00Z') - Date.parse(cloud.date + 'T00:00:00Z')) ===
      86400000;
  const sharedInstant = legs.some((k) => sameInstant(local[k], cloud[k]));
  const crossMidnight = adjacent && matching.some((k) => sameInstant(local[k], cloud[k]));
  const sameAirframe =
    local.registration.trim() !== '' &&
    local.registration.trim().toUpperCase() === cloud.registration.trim().toUpperCase();
  // A date or model alone is never sufficient evidence.
  const strongNoFlight =
    sameDate &&
    sameAirframe &&
    sharedInstant &&
    local.handling === cloud.handling &&
    local.role === cloud.role;
  if (!sameId && !((sameDate || crossMidnight) && matching.length) && !strongNoFlight) return null;
  const differences = compareFields(cloud, local);
  const meaningful = differences.filter((d) => !metadata(d.field));
  const reasons = [
    ...(sameId ? ['stable-id'] : []),
    ...(matching.length ? ['canonical-flight'] : []),
    ...(sameDate ? ['operational-date'] : []),
    ...(crossMidnight ? ['shared-hkt-leg-instant-across-dates'] : []),
    ...(strongNoFlight ? ['airframe-and-leg-instant'] : []),
  ];
  const conflict = meaningful.some((d) => d.state === 'conflict');
  const partial = local.handling !== cloud.handling && matching.length > 0;
  return {
    localId: local.id,
    cloudId: cloud.id,
    kind: partial
      ? 'partial'
      : conflict
        ? 'conflicting'
        : meaningful.every((d) => d.state === 'match')
          ? 'exact'
          : 'likely',
    reasons,
    canonicalFlights: [...new Set(matching.map((k) => canonicalFlight(local[k].flight)!))].sort(),
    differences,
  };
}
/** Indexed candidate generation, then connected components; no ordering-dependent greedy pairing. */
export function matchAircraft(
  local: Aircraft[],
  cloud: Aircraft[],
): { groups: MatchGroup[]; distinct: string[] } {
  for (const rows of [local, cloud]) {
    if (rows.length > 5000) throw new MergeError('capacity');
    if (new Set(rows.map((r) => r.id)).size !== rows.length || rows.some((r) => !r.id.trim()))
      throw new MergeError('invalid');
  }
  const index = new Map<string, Set<Aircraft>>();
  const add = (key: string, row: Aircraft) => {
    if (!index.has(key)) index.set(key, new Set());
    index.get(key)!.add(row);
  };
  for (const row of cloud) {
    add('id:' + row.id, row);
    for (const k of applicable(row)) {
      const f = canonicalFlight(row[k].flight);
      if (f) add('flight:' + f, row);
    }
    if (row.registration.trim()) add('reg:' + row.registration.trim().toUpperCase(), row);
  }
  const candidates: Candidate[] = [];
  let comparisons = 0;
  for (const row of [...local].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const keys = [
      'id:' + row.id,
      ...applicable(row).map((k) => 'flight:' + canonicalFlight(row[k].flight)),
      'reg:' + row.registration.trim().toUpperCase(),
    ];
    const possible = new Set(keys.flatMap((k) => [...(index.get(k) || [])]));
    for (const other of [...possible].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
      if (++comparisons > 250000) throw new MergeError('capacity');
      const pair = compareAircraft(row, other);
      if (pair) candidates.push(pair);
    }
  }
  const adjacency = new Map<string, Set<string>>();
  for (const c of candidates) {
    const a = 'local:' + c.localId,
      b = 'cloud:' + c.cloudId;
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      if (!adjacency.has(x)) adjacency.set(x, new Set());
      adjacency.get(x)!.add(y);
    }
  }
  const visited = new Set<string>(),
    groups: MatchGroup[] = [];
  for (const node of [...adjacency.keys()].sort()) {
    if (visited.has(node)) continue;
    const queue = [node],
      component: string[] = [];
    while (queue.length) {
      const next = queue.pop()!;
      if (visited.has(next)) continue;
      visited.add(next);
      component.push(next);
      queue.push(...adjacency.get(next)!);
    }
    const localIds = component
      .filter((x) => x.startsWith('local:'))
      .map((x) => x.slice(6))
      .sort();
    const cloudIds = component
      .filter((x) => x.startsWith('cloud:'))
      .map((x) => x.slice(6))
      .sort();
    const edges = candidates.filter(
      (c) => localIds.includes(c.localId) && cloudIds.includes(c.cloudId),
    );
    const ambiguous = localIds.length !== 1 || cloudIds.length !== 1;
    const kind = ambiguous ? 'ambiguous' : edges[0].kind;
    groups.push({
      id: JSON.stringify([localIds, cloudIds]),
      localIds,
      cloudIds,
      kind,
      candidates: edges,
      bulkEligible: !ambiguous && ['exact', 'likely'].includes(kind),
    });
  }
  return {
    groups: groups.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    distinct: local
      .filter((r) => !adjacency.has('local:' + r.id))
      .map((r) => r.id)
      .sort(),
  };
}
