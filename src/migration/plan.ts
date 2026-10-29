import type { Aircraft, Database, Duty, Journal } from '../domain/model';
import { validateBackupDatabase } from '../lib/backup';
import { uuidV4 } from '../lib/uuid';
import { canonical } from '../sync/records';
import { compareFields, matchAircraft, MergeError, type MatchGroup } from './matching';

export type Collection = 'aircraft' | 'duties' | 'journals';
export type MergeValue = Aircraft | Duty | Journal;
export type Decision =
  | { choice: 'cloud'; target: string }
  | { choice: 'local'; target: string }
  | {
      choice: 'manual';
      target?: string;
      result?: MergeValue;
      separate?: boolean;
      references?: 'guest' | 'account' | 'staged';
    };
export type ReviewItem = {
  key: string;
  collection: Collection;
  sourceId: string;
  targets: string[];
  group: string;
  bulkEligible: boolean;
  kind: 'exact' | 'likely' | 'conflicting' | 'partial' | 'ambiguous';
};
export type MergePlan = {
  version: 1;
  operationId: string;
  userId: string;
  workspaceId: string;
  destinationRevision: number;
  stage: 'permission' | 'review' | 'queued' | 'verified';
  confirmations: {
    permissionAt: string | null;
    finalAt: string | null;
    additionalAt: string | null;
  };
  source: Database;
  destination: Database;
  sourceSnapshot: string;
  destinationFingerprint: string;
  sourceFingerprint: string;
  groups: MatchGroup[];
  items: ReviewItem[];
  decisions: Record<string, Decision>;
  mappings: Record<Collection, Record<string, string>>;
  eventIds: Record<string, string>;
  preferences: 'account' | 'guest';
  queuedResult: Database | null;
  verifiedRevision: number | null;
};
export type MergeSummary = {
  add: Record<Collection, number>;
  skipped: number;
  replaced: number;
  unchanged: number;
  manual: number;
  separate: number;
  unresolved: number;
  settingsChanged: boolean;
  highRisk: string[];
};
const collections: Collection[] = ['duties', 'aircraft', 'journals'];
export const itemKey = (collection: Collection, id: string) => JSON.stringify([collection, id]);
const validIdentity = (id: string) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
export async function fingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : canonical(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
}
function assertOwner(plan: MergePlan, userId: string) {
  if (plan.userId !== userId || !validIdentity(userId)) throw new MergeError('identity');
}
function assertReview(plan: MergePlan) {
  if (plan.stage !== 'review') throw new MergeError('stage');
}
/** No matching/preparation until confirmPreparation. Source must be actual persisted Guest bytes. */
export async function requestMerge(input: {
  source: Database;
  destination: Database;
  sourceSnapshot: string;
  userId: string;
  workspaceId: string;
  revision: number;
}): Promise<MergePlan> {
  if (
    !validIdentity(input.userId) ||
    !validIdentity(input.workspaceId) ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0
  )
    throw new MergeError('identity');
  validateBackupDatabase(input.source);
  validateBackupDatabase(input.destination);
  if (canonical(JSON.parse(input.sourceSnapshot)) !== canonical(input.source))
    throw new MergeError('stale');
  return {
    version: 1,
    operationId: uuidV4(),
    userId: input.userId,
    workspaceId: input.workspaceId,
    destinationRevision: input.revision,
    stage: 'permission',
    confirmations: { permissionAt: null, finalAt: null, additionalAt: null },
    source: structuredClone(input.source),
    destination: structuredClone(input.destination),
    sourceSnapshot: input.sourceSnapshot,
    destinationFingerprint: await fingerprint(input.destination),
    sourceFingerprint: await fingerprint(input.sourceSnapshot),
    groups: [],
    items: [],
    decisions: {},
    mappings: { aircraft: {}, duties: {}, journals: {} },
    eventIds: {},
    preferences: 'account',
    queuedResult: null,
    verifiedRevision: null,
  };
}
export function confirmPreparation(input: MergePlan, userId: string): MergePlan {
  assertOwner(input, userId);
  if (input.stage !== 'permission') throw new MergeError('stage');
  const plan = structuredClone(input);
  const matches = matchAircraft(plan.source.aircraft, plan.destination.aircraft);
  plan.groups = matches.groups;
  for (const group of matches.groups)
    for (const sourceId of group.localIds) {
      plan.items.push({
        key: itemKey('aircraft', sourceId),
        collection: 'aircraft',
        sourceId,
        targets: group.candidates.filter((c) => c.localId === sourceId).map((c) => c.cloudId),
        group: group.id,
        bulkEligible: group.bulkEligible,
        kind: group.kind,
      });
    }
  for (const collection of ['duties', 'journals'] as const)
    for (const row of plan.source[collection]) {
      const other = plan.destination[collection].find((r) => r.id === row.id);
      if (!other) continue;
      const exact = canonical(other) === canonical(row);
      plan.items.push({
        key: itemKey(collection, row.id),
        collection,
        sourceId: row.id,
        targets: [other.id],
        group: itemKey(collection, row.id),
        bulkEligible: exact,
        kind: exact ? 'exact' : 'conflicting',
      });
    }
  for (const collection of collections) {
    const used = new Set(plan.destination[collection].map((r) => r.id));
    for (const row of plan.source[collection]) {
      let next = row.id;
      while (used.has(next)) next = uuidV4();
      used.add(next);
      plan.mappings[collection]['$' + row.id] = next;
    }
  }
  const usedEvents = new Set(plan.destination.aircraft.flatMap((a) => a.events.map((e) => e.id)));
  for (const a of plan.source.aircraft)
    for (const event of a.events) {
      let next = event.id;
      while (usedEvents.has(next)) next = uuidV4();
      usedEvents.add(next);
      plan.eventIds['$' + event.id] = next;
    }
  plan.items.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  plan.stage = 'review';
  plan.confirmations = {
    permissionAt: new Date().toISOString(),
    finalAt: null,
    additionalAt: null,
  };
  return plan;
}
export function decide(
  input: MergePlan,
  key: string,
  decision: Decision,
  userId: string,
): MergePlan {
  assertOwner(input, userId);
  assertReview(input);
  const item = input.items.find((i) => i.key === key);
  if (!item || !['cloud', 'local', 'manual'].includes(decision.choice))
    throw new MergeError('invalid');
  const separate = decision.choice === 'manual' && decision.separate === true;
  if (
    decision.choice === 'manual' &&
    decision.result &&
    !['guest', 'account', 'staged'].includes(decision.references || '')
  )
    throw new MergeError('invalid');
  const target = 'target' in decision ? decision.target : undefined;
  if (
    !separate &&
    (decision.choice !== 'manual' || decision.result) &&
    (!target || !item.targets.includes(target))
  )
    throw new MergeError('invalid');
  if (separate && decision.choice === 'manual' && decision.result) throw new MergeError('invalid');
  const plan = structuredClone(input);
  plan.decisions[key] = structuredClone(decision);
  return plan;
}
export function bulkDecide(
  input: MergePlan,
  keys: string[],
  choice: Decision['choice'],
  userId: string,
) {
  assertOwner(input, userId);
  assertReview(input);
  if (!keys.length || new Set(keys).size !== keys.length) throw new MergeError('invalid');
  const selected = keys.map((key) => input.items.find((i) => i.key === key));
  if (selected.some((i) => !i)) throw new MergeError('invalid');
  if (choice !== 'manual' && selected.some((i) => !i!.bulkEligible)) throw new MergeError('manual');
  let next = input;
  for (const item of selected)
    next = decide(
      next,
      item!.key,
      choice === 'manual' ? { choice: 'manual' } : { choice, target: item!.targets[0] },
      userId,
    );
  return next;
}
export const resolved = (decision?: Decision) =>
  !!decision && (decision.choice !== 'manual' || decision.separate === true || !!decision.result);
export function selectEligible(plan: MergePlan) {
  return plan.items.filter((i) => i.bulkEligible).map((i) => i.key);
}
export function setPreferences(input: MergePlan, choice: 'account' | 'guest', userId: string) {
  assertOwner(input, userId);
  assertReview(input);
  const plan = structuredClone(input);
  plan.preferences = choice;
  return plan;
}
function remapValue(
  plan: MergePlan,
  collection: Collection,
  source: MergeValue,
  id: string,
): MergeValue {
  const value = structuredClone(source);
  value.id = id;
  if ('dutyId' in value && value.dutyId)
    value.dutyId = plan.mappings.duties['$' + value.dutyId] || value.dutyId;
  if ('originalDutyId' in value && value.originalDutyId)
    value.originalDutyId = plan.mappings.duties['$' + value.originalDutyId] || value.originalDutyId;
  if (collection === 'aircraft') {
    const a = value as Aircraft;
    for (const e of a.events) {
      e.id = plan.eventIds['$' + e.id] || e.id;
      if (e.journalId) e.journalId = plan.mappings.journals['$' + e.journalId] || e.journalId;
    }
  }
  if (collection === 'journals') {
    const j = value as Journal;
    j.aircraftIds = [...new Set(j.aircraftIds.map((x) => plan.mappings.aircraft['$' + x] || x))];
  }
  return value;
}
/** Editor context contains both complete graphs; allocated Guest IDs never collide with Account IDs. */
export function manualContext(
  plan: MergePlan,
  item: ReviewItem,
  target: string,
  basis: 'local' | 'cloud',
) {
  const separate = structuredClone(plan);
  for (const row of separate.items)
    separate.decisions[row.key] = { choice: 'manual', separate: true };
  const db = previewMerge(separate).db;
  const id = basis === 'local' ? plan.mappings[item.collection]['$' + item.sourceId] : target;
  const record = db[item.collection].find((row) => row.id === id);
  if (!record) throw new MergeError('invalid');
  return { db, record: structuredClone(record) as MergeValue };
}
function stagedValue(
  original: MergePlan,
  final: MergePlan,
  collection: Collection,
  source: MergeValue,
  id: string,
) {
  const value = structuredClone(source);
  const link = (c: Collection, ref: string) => {
    const found = Object.entries(original.mappings[c]).find(([, allocated]) => allocated === ref);
    return found ? final.mappings[c][found[0]] : ref;
  };
  value.id = id;
  if ('dutyId' in value && value.dutyId) value.dutyId = link('duties', value.dutyId);
  if ('originalDutyId' in value && value.originalDutyId)
    value.originalDutyId = link('duties', value.originalDutyId);
  if (collection === 'aircraft')
    for (const event of (value as Aircraft).events)
      if (event.journalId) event.journalId = link('journals', event.journalId);
  if (collection === 'journals')
    (value as Journal).aircraftIds = [
      ...new Set((value as Journal).aircraftIds.map((ref) => link('aircraft', ref))),
    ];
  return value;
}
export function previewMerge(input: MergePlan): {
  db: Database;
  summary: MergeSummary;
  recovery: { collection: Collection; value: MergeValue }[];
} {
  if (!['review', 'queued'].includes(input.stage)) throw new MergeError('stage');
  const plan = structuredClone(input);
  const summary: MergeSummary = {
    add: { aircraft: 0, duties: 0, journals: 0 },
    skipped: 0,
    replaced: 0,
    unchanged: 0,
    manual: 0,
    separate: 0,
    unresolved: plan.items.filter((i) => !resolved(plan.decisions[i.key])).length,
    settingsChanged: false,
    highRisk: [],
  };
  if (summary.unresolved) throw new MergeError('unresolved');
  // Resolve the complete mapping before copying any linked objects.
  for (const item of plan.items) {
    const d = plan.decisions[item.key];
    if (d.choice !== 'manual' || !d.separate)
      plan.mappings[item.collection]['$' + item.sourceId] = d.target!;
  }
  const result = structuredClone(plan.destination);
  const recovery: { collection: Collection; value: MergeValue }[] = [];
  // A resumed plan cannot redirect an unselected Guest record to a destination ID.
  for (const collection of collections) {
    const occupied = new Set(plan.destination[collection].map((r) => r.id));
    for (const source of plan.source[collection]) {
      const original = input.mappings[collection]['$' + source.id];
      if (
        typeof original !== 'string' ||
        !original.trim() ||
        occupied.has(original) ||
        (!occupied.has(source.id) && original !== source.id)
      )
        throw new MergeError('invalid');
    }
  }
  const replacements = new Set<string>();
  for (const collection of collections)
    for (const source of plan.source[collection]) {
      const key = itemKey(collection, source.id),
        item = plan.items.find((i) => i.key === key),
        decision = plan.decisions[key];
      if (item && decision.choice === 'cloud') {
        summary.skipped++;
        continue;
      }
      const separate = decision?.choice === 'manual' && decision.separate === true;
      const target = plan.mappings[collection]['$' + source.id];
      const proposed = decision?.choice === 'manual' && decision.result ? decision.result : source;
      if (proposed.id !== source.id && decision?.choice === 'manual' && proposed.id !== target)
        throw new MergeError('invalid');
      const rows = result[collection] as MergeValue[];
      const position = rows.findIndex((r) => r.id === target);
      const remapped =
        decision?.choice === 'manual' && decision.references === 'staged'
          ? stagedValue(input, plan, collection, proposed, target)
          : decision?.choice === 'manual' && decision.references === 'account'
            ? { ...structuredClone(proposed), id: target }
            : remapValue(plan, collection, proposed, target);
      if (position >= 0) {
        if (!item || separate) throw new MergeError('invalid');
        const replacementKey = itemKey(collection, target);
        if (replacements.has(replacementKey)) throw new MergeError('manual');
        replacements.add(replacementKey);
        recovery.push({ collection, value: structuredClone(rows[position]) });
        const loss = compareFields(rows[position], remapped).filter(
          (d) =>
            d.state !== 'match' &&
            !['id', 'createdAt', 'updatedAt'].includes(d.field) &&
            !d.field.startsWith('revisions') &&
            d.cloud !== undefined &&
            d.cloud !== null &&
            d.cloud !== '' &&
            !(Array.isArray(d.cloud) && d.cloud.length === 0),
        );
        if (loss.length) summary.highRisk.push('nonempty-values-replaced:' + key);
        rows[position] = remapped;
        summary.replaced++;
      } else {
        rows.push(remapped);
        summary.add[collection]++;
      }
      if (decision?.choice === 'manual') {
        summary.manual++;
        if (separate) summary.separate++;
      }
      if (item && ['ambiguous', 'partial'].includes(item.kind))
        summary.highRisk.push('special-match:' + key);
    }
  if (plan.preferences === 'guest')
    result.settings.privacy = structuredClone(plan.source.settings.privacy);
  summary.settingsChanged =
    canonical(result.settings.privacy) !== canonical(plan.destination.settings.privacy);
  if (summary.settingsChanged) summary.highRisk.push('privacy-settings-change');
  if (summary.replaced >= 10) summary.highRisk.push('large-replacement');
  summary.unchanged =
    collections.reduce((n, c) => n + plan.destination[c].length, 0) - summary.replaced;
  validateBackupDatabase(result);
  return { db: result, summary, recovery };
}
/** Confirmation 2 is independent; high-risk loss/group/settings cases need additional confirmation. */
export async function confirmFinal(
  input: MergePlan,
  current: {
    userId: string;
    workspaceId: string;
    sourceSnapshot: string;
    destination: Database;
    revision: number;
  },
  additionalConfirmation = false,
): Promise<MergePlan> {
  assertOwner(input, current.userId);
  assertReview(input);
  if (
    input.workspaceId !== current.workspaceId ||
    input.destinationRevision !== current.revision ||
    input.sourceFingerprint !== (await fingerprint(current.sourceSnapshot)) ||
    input.destinationFingerprint !== (await fingerprint(current.destination))
  )
    throw new MergeError('stale');
  const result = previewMerge(input);
  if (result.summary.highRisk.length && !additionalConfirmation) throw new MergeError('manual');
  const plan = structuredClone(input);
  if (!input.confirmations?.permissionAt) throw new MergeError('stage');
  plan.stage = 'queued';
  plan.confirmations.finalAt = new Date().toISOString();
  plan.confirmations.additionalAt = result.summary.highRisk.length
    ? new Date().toISOString()
    : null;
  plan.queuedResult = result.db;
  return plan;
}
/** A local save/UI dismissal is never a server receipt. */
export function verifyReceipt(
  input: MergePlan,
  receipt: {
    userId: string;
    workspaceId: string;
    operationId: string;
    revision: number;
    db: Database;
    verification?: 'read' | 'write';
  },
): MergePlan {
  if (input.stage !== 'queued' || !input.queuedResult) throw new MergeError('stage');
  assertOwner(input, receipt.userId);
  validateBackupDatabase(receipt.db);
  if (
    receipt.workspaceId !== input.workspaceId ||
    receipt.operationId !== input.operationId ||
    !Number.isSafeInteger(receipt.revision) ||
    receipt.revision < input.destinationRevision ||
    (receipt.revision === input.destinationRevision &&
      (receipt.verification !== 'read' ||
        canonical(input.queuedResult) !== canonical(input.destination))) ||
    canonical(receipt.db) !== canonical(input.queuedResult)
  )
    throw new MergeError('stale');
  const plan = structuredClone(input);
  plan.stage = 'verified';
  plan.verifiedRevision = receipt.revision;
  return plan;
}
/** Validates resumed plans without accepting executable objects, changed snapshots or unknown decisions. */
export async function validatePlan(value: unknown, userId: string): Promise<MergePlan> {
  const plan = value as MergePlan;
  if (
    !plan ||
    plan.version !== 1 ||
    !validIdentity(plan.operationId) ||
    !validIdentity(plan.workspaceId) ||
    !['permission', 'review', 'queued', 'verified'].includes(plan.stage)
  )
    throw new MergeError('invalid');
  assertOwner(plan, userId);
  const confirmations = plan.confirmations;
  const timestamp = (value: unknown) =>
    typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (
    !confirmations ||
    (plan.stage === 'permission'
      ? confirmations.permissionAt !== null ||
        confirmations.finalAt !== null ||
        confirmations.additionalAt !== null
      : !timestamp(confirmations.permissionAt)) ||
    (['queued', 'verified'].includes(plan.stage) && !timestamp(confirmations.finalAt))
  )
    throw new MergeError('invalid');
  validateBackupDatabase(plan.source);
  validateBackupDatabase(plan.destination);
  if (
    plan.sourceFingerprint !== (await fingerprint(plan.sourceSnapshot)) ||
    canonical(JSON.parse(plan.sourceSnapshot)) !== canonical(plan.source) ||
    plan.destinationFingerprint !== (await fingerprint(plan.destination)) ||
    !Number.isSafeInteger(plan.destinationRevision) ||
    plan.destinationRevision < 0 ||
    !['account', 'guest'].includes(plan.preferences)
  )
    throw new MergeError('invalid');
  if (plan.stage === 'permission') {
    if (
      plan.items.length ||
      plan.groups.length ||
      Object.keys(plan.decisions).length ||
      plan.queuedResult
    )
      throw new MergeError('invalid');
  } else {
    const rebuilt = confirmPreparation(
      { ...plan, stage: 'permission', items: [], groups: [], decisions: {} },
      userId,
    );
    if (
      canonical(rebuilt.items) !== canonical(plan.items) ||
      canonical(rebuilt.groups) !== canonical(plan.groups)
    )
      throw new MergeError('invalid');
    let checking = { ...plan, stage: 'review' as const, decisions: {} };
    for (const [key, decision] of Object.entries(plan.decisions))
      checking = decide(checking, key, decision, userId) as typeof checking;
    if (plan.stage === 'queued' || plan.stage === 'verified') {
      const preview = previewMerge({ ...plan, stage: 'review' });
      if (preview.summary.highRisk.length && !timestamp(confirmations.additionalAt))
        throw new MergeError('invalid');
      if (canonical(preview.db) !== canonical(plan.queuedResult)) throw new MergeError('invalid');
    }
  }
  return structuredClone(plan);
}
