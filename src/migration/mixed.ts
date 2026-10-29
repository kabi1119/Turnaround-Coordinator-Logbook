import type { Database } from '../domain/model';
import type { AccountOperation, AccountPayload } from '../cloud/types';
import { AccountError } from '../cloud/types';
import type { RecordData } from '../sync/types';
import { recordKey } from '../sync/crypto';
import { materialize, pending, records, same, validateSyncDatabase } from '../sync/records';
import { fingerprint, itemKey, validatePlan, type MergePlan } from './plan';
import { uuidV4 } from '../lib/uuid';

export type MixedDecision = {
  choice: 'cloud' | 'local' | 'manual';
  target?: string;
  result?: RecordData['value'];
};
export type MixedPlan = {
  version: 1;
  id: string;
  userId: string;
  workspaceId: string;
  stage: 'awaiting-cloud' | 'guest-review' | 'account-review' | 'queued' | 'complete';
  outcome: 'unresolved' | 'unsent' | 'committed' | 'retired' | 'expired';
  originalCache: string;
  originalDigest: string;
  originalOperationId: string;
  cloudRevision: number;
  guestPlan: MergePlan | null;
  skipGuest: boolean;
  operationId: string;
  delivery?: 'queued' | 'unknown' | 'committed';
  retained?: { id: string; outcome: 'committed' | 'retired' | 'expired'; revision: number | null };
  decisions: Record<string, MixedDecision>;
  history: {
    revision: number;
    at: string;
    decisions: Record<string, MixedDecision>;
    operation?: AccountOperation;
    reason: string;
  }[];
};
export function mixedSource(cache: string) {
  const p = JSON.parse(cache) as AccountPayload;
  if (
    Object.keys(p.state).some(
      (key) =>
        ![
          'cursor',
          'base',
          'conflicts',
          'operation',
          'lastSuccess',
          'merge',
          'guestDelivery',
          'recovery',
          'mixed',
        ].includes(key),
    )
  )
    throw new AccountError('invalid'); // Never silently ignore an unsupported queued-operation format.
  const plan = p.state.merge?.stage === 'queued' ? p.state.merge : p.state.recovery?.merge;
  if (!plan || plan.stage !== 'queued' || !plan.queuedResult) throw new AccountError('invalid');
  const later =
    p.state.recovery?.stage === 'review' && p.state.recovery.merge ? p.state.recovery.db : p.db;
  const active = p.state.operation || p.state.recovery?.operation;
  const retainedOperation = active?.purpose === 'edit' ? active : null;
  if (
    retainedOperation &&
    (retainedOperation.expected !== p.state.cursor ||
      retainedOperation.expected <= plan.destinationRevision)
  )
    throw new AccountError('invalid');
  const baseline = retainedOperation
    ? materialize(
        p.state.base.map((b) => b.record),
        later.settings.language,
      )
    : plan.queuedResult;
  const after = new Map(records(baseline).map((r) => [recordKey(r), r]));
  for (const row of retainedOperation?.changes || []) after.set(recordKey(row), row);
  const afterOperation = materialize([...after.values()], later.settings.language);
  const final = new Map(records(later).map((r) => [recordKey(r), r]));
  const keys = new Set([
    ...(retainedOperation?.changes || []).map(recordKey),
    ...pending(later, {
      base: records(afterOperation).map((record) => ({ record, revision: p.state.cursor })),
    }).map(recordKey),
  ]);
  const changes = [...keys].map((key) => final.get(key) || { ...after.get(key)!, value: null });
  return { payload: p, plan, later, changes, retainedOperation, baseline, afterOperation };
}
export function laterEdits(db: Database, plan: MergePlan) {
  if (!plan.queuedResult) throw new AccountError('invalid');
  return pending(db, {
    base: records(plan.queuedResult).map((record) => ({
      record,
      revision: plan.destinationRevision,
    })),
  });
}
export async function createMixed(
  cache: string,
  userId: string,
  workspaceId: string,
): Promise<MixedPlan> {
  const source = mixedSource(cache);
  if (
    source.payload.userId !== userId ||
    source.payload.workspaceId !== workspaceId ||
    !source.changes.length
  )
    throw new AccountError('invalid');
  return {
    version: 1,
    id: uuidV4(),
    userId,
    workspaceId,
    stage: 'awaiting-cloud',
    outcome: 'unresolved',
    originalCache: cache,
    originalDigest: await fingerprint(cache),
    originalOperationId: source.plan.operationId,
    cloudRevision: source.payload.state.cursor,
    guestPlan: null,
    skipGuest: false,
    operationId: uuidV4(),
    decisions: {},
    history: [],
  };
}
export async function validateMixed(m: MixedPlan, userId: string, workspaceId: string) {
  const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  if (
    !m ||
    m.version !== 1 ||
    m.userId !== userId ||
    m.workspaceId !== workspaceId ||
    !uuid.test(m.id) ||
    !uuid.test(m.operationId) ||
    !['awaiting-cloud', 'guest-review', 'account-review', 'queued', 'complete'].includes(m.stage) ||
    !['unresolved', 'unsent', 'committed', 'retired', 'expired'].includes(m.outcome) ||
    typeof m.originalCache !== 'string' ||
    m.originalCache.length > 16 * 1024 * 1024 ||
    m.originalDigest !== (await fingerprint(m.originalCache)) ||
    !Number.isSafeInteger(m.cloudRevision) ||
    m.cloudRevision < 1 ||
    typeof m.skipGuest !== 'boolean' ||
    !Array.isArray(m.history) ||
    (m.delivery !== undefined && !['queued', 'unknown', 'committed'].includes(m.delivery))
  )
    throw new AccountError('invalid');
  const source = mixedSource(m.originalCache);
  if (
    source.payload.userId !== userId ||
    source.payload.workspaceId !== workspaceId ||
    source.plan.operationId !== m.originalOperationId ||
    !source.changes.length
  )
    throw new AccountError('invalid');
  validateSyncDatabase(source.later);
  await validatePlan(source.plan, userId);
  if (m.guestPlan) {
    await validatePlan(m.guestPlan, userId);
    if (m.guestPlan.stage !== 'verified' || m.guestPlan.workspaceId !== workspaceId)
      throw new AccountError('invalid');
  }
  if (
    m.retained &&
    (!source.retainedOperation ||
      m.retained.id !== source.retainedOperation.id ||
      !uuid.test(m.retained.id) ||
      !['committed', 'retired', 'expired'].includes(m.retained.outcome) ||
      (m.retained.outcome === 'committed' &&
        m.retained.revision !== source.retainedOperation.expected + 1) ||
      (m.retained.outcome === 'retired' &&
        m.retained.revision !== source.retainedOperation.expected) ||
      (m.retained.outcome === 'expired' && m.retained.revision !== null))
  )
    throw new AccountError('invalid');
  const keys = new Set(source.changes.map(recordKey));
  const choices = (values: Record<string, MixedDecision>) => {
    if (!values || typeof values !== 'object' || Array.isArray(values))
      throw new AccountError('invalid');
    for (const [key, d] of Object.entries(values))
      if (
        !keys.has(key) ||
        !d ||
        !['cloud', 'local', 'manual'].includes(d.choice) ||
        (d.target !== undefined &&
          (typeof d.target !== 'string' || !d.target.trim() || d.target.length > 512))
      )
        throw new AccountError('invalid');
  };
  choices(m.decisions);
  for (const h of m.history) {
    if (
      !Number.isSafeInteger(h.revision) ||
      h.revision < 1 ||
      !Number.isFinite(Date.parse(h.at)) ||
      typeof h.reason !== 'string'
    )
      throw new AccountError('invalid');
    choices(h.decisions);
  }
}
type IdMap = Record<'aircraft' | 'duties' | 'journals', Map<string, string | null>>;
function finalIds(plan: MergePlan, collection: 'aircraft' | 'duties' | 'journals') {
  return new Map(
    plan.source[collection].map((row) => {
      const decision = plan.decisions[itemKey(collection, row.id)];
      const target =
        decision && !(decision.choice === 'manual' && decision.separate)
          ? decision.target
          : plan.mappings[collection]['$' + row.id];
      return [row.id, target || null];
    }),
  );
}
function translations(m: MixedPlan): IdMap {
  const original = mixedSource(m.originalCache).plan;
  const map: IdMap = { aircraft: new Map(), duties: new Map(), journals: new Map() };
  for (const c of ['duties', 'aircraft', 'journals'] as const) {
    const old = finalIds(original, c),
      fresh = m.guestPlan ? finalIds(m.guestPlan, c) : new Map();
    const occupied = new Set(original.destination[c].map((row) => row.id));
    const candidates = new Map<string, Set<string | null>>();
    for (const [sourceId, oldId] of old) {
      if (!oldId || occupied.has(oldId)) continue; // Existing Account identity stays stable.
      const target =
        m.outcome === 'committed' ? oldId : m.guestPlan ? fresh.get(sourceId) || null : null;
      const values = candidates.get(oldId) || new Set();
      values.add(target);
      candidates.set(oldId, values);
    }
    for (const [oldId, values] of candidates)
      map[c].set(oldId, values.size === 1 ? [...values][0] : null);
  }
  for (const [key, decision] of Object.entries(m.decisions)) {
    const [c, id] = JSON.parse(key) as [RecordData['collection'], string];
    if (c !== 'privacy' && decision.target && map[c].has(id)) map[c].set(id, decision.target);
  }
  return map;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
function remap(
  value: unknown,
  collection: RecordData['collection'],
  id: string,
  map: IdMap,
  missing: string[],
) {
  if (!object(value)) return structuredClone(value);
  const out = structuredClone(value);
  if (collection !== 'privacy') out.id = id;
  const ref = (c: keyof IdMap, v: unknown) => {
    if (typeof v !== 'string' || !v || !map[c].has(v)) return v;
    const target = map[c].get(v);
    if (!target) {
      missing.push(c + ' · ' + v);
      return v;
    }
    return target;
  };
  if ('dutyId' in out) out.dutyId = ref('duties', out.dutyId);
  if ('originalDutyId' in out) out.originalDutyId = ref('duties', out.originalDutyId);
  if (Array.isArray(out.aircraftIds))
    out.aircraftIds = [...new Set(out.aircraftIds.map((v) => ref('aircraft', v)))];
  if (Array.isArray(out.events))
    out.events = out.events.map((event) =>
      object(event) && 'journalId' in event
        ? { ...event, journalId: ref('journals', event.journalId) }
        : event,
    );
  return out;
}
/** Apply only fields changed AFTER the reviewed merge. Never reapply its unchanged values. */
function intent(before: unknown, after: unknown, cloud: unknown): unknown {
  if (same(before, after)) return structuredClone(cloud);
  if (!object(before) || !object(after) || !object(cloud)) return structuredClone(after);
  const result = structuredClone(cloud);
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (same(before[key], after[key])) continue;
    if (!(key in after)) delete result[key];
    else result[key] = intent(before[key], after[key], cloud[key]);
  }
  return result;
}
export function mixedRows(m: MixedPlan, cloud: Database) {
  const { plan, changes, baseline, afterOperation } = mixedSource(m.originalCache),
    maps = translations(m);
  const before = new Map(records(baseline).map((r) => [recordKey(r), r]));
  const queued = new Map(records(afterOperation).map((r) => [recordKey(r), r]));
  const original = new Map(records(plan.destination).map((r) => [recordKey(r), r]));
  const current = new Map(records(cloud).map((r) => [recordKey(r), r]));
  return changes.map((local) => {
    const key = recordKey(local),
      decision = m.decisions[key];
    const proposedId =
      local.collection === 'privacy'
        ? local.id
        : maps[local.collection].has(local.id)
          ? maps[local.collection].get(local.id)
          : local.id;
    const target = decision?.target || proposedId || null;
    const bound = target !== null;
    const targetId = target || local.id;
    const missing: string[] = [];
    const previous = before.get(key)?.value ?? null;
    const cloudValue = current.get(recordKey({ ...local, id: targetId }))?.value ?? null;
    const remappedBefore = remap(previous, local.collection, targetId, maps, []);
    const queuedValue = queued.get(key)?.value ?? null;
    const remappedQueued = remap(queuedValue, local.collection, targetId, maps, []);
    const remappedLocal = remap(local.value, local.collection, targetId, maps, missing);
    const candidate = intent(
      remappedQueued,
      remappedLocal,
      intent(remappedBefore, remappedQueued, cloudValue),
    );
    const kind = !before.has(key)
      ? 'New Account record'
      : !original.has(key)
        ? 'Guest-imported record'
        : !same(original.get(key)?.value, previous)
          ? 'Guest-replaced or manually reviewed record'
          : 'Independent Account record';
    return {
      key,
      collection: local.collection,
      id: local.id,
      target: targetId,
      bound,
      kind,
      before: previous,
      queued: queuedValue,
      local: local.value,
      cloud: cloudValue,
      candidate,
      missing: [...new Set(missing)],
      conflict: !same(remappedBefore, cloudValue),
      decision,
      deletion: local.value === null,
    };
  });
}
export function mixedResult(m: MixedPlan, cloud: Database) {
  if (m.stage !== 'account-review') throw new AccountError('local');
  const result = new Map(records(cloud).map((r) => [recordKey(r), r]));
  const written = new Set<string>();
  const rows = mixedRows(m, cloud);
  for (const row of rows) {
    const choice = row.decision;
    if (!choice) throw new AccountError('conflict');
    if (choice.choice === 'cloud') continue;
    if (!row.bound || (choice.choice === 'local' && row.missing.length))
      throw new AccountError('conflict');
    if (
      choice.target &&
      (row.collection === 'privacy'
        ? choice.target !== 'settings'
        : !cloud[row.collection].some((r) => r.id === choice.target))
    )
      throw new AccountError('invalid');
    const record = {
      collection: row.collection,
      id: row.target,
      value: choice.choice === 'manual' ? structuredClone(choice.result) : row.candidate,
    };
    if (
      record.value === undefined ||
      (object(record.value) && record.collection !== 'privacy' && record.value.id !== record.id)
    )
      throw new AccountError('invalid');
    const key = recordKey(record);
    if (written.has(key)) throw new AccountError('conflict');
    written.add(key);
    result.set(key, record);
  }
  const db = materialize([...result.values()], cloud.settings.language);
  validateSyncDatabase(db);
  return {
    db,
    changes: pending(db, {
      base: records(cloud).map((record) => ({ record, revision: m.cloudRevision })),
    }),
    highRisk: rows.some(
      (row) => row.decision?.choice !== 'cloud' && (row.deletion || row.conflict),
    ),
  };
}
