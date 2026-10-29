import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { emptyAircraft, defaultOptionalFields, restrictivePrivacy } from '../src/domain/model';
import type { Aircraft, Database } from '../src/domain/model';
import { emptyAccountDatabase } from '../src/workspaces/vault';
import { seedDatabase } from '../src/data/seed';
import {
  canonicalFlight,
  compareAircraft,
  compareFields,
  matchAircraft,
  MergeError,
} from '../src/migration/matching';
import {
  bulkDecide,
  confirmFinal,
  confirmPreparation,
  decide,
  itemKey,
  manualContext,
  previewMerge,
  requestMerge,
  selectEligible,
  setPreferences,
  validatePlan,
  verifyReceipt,
} from '../src/migration/plan';
const userId = '90000000-0000-4000-8000-000000000001',
  otherId = '90000000-0000-4000-8000-000000000002',
  workspaceId = '90000000-0000-4000-8000-000000000003';
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());
function aircraft(id = 'local', flight = 'CX0402', extra: Partial<Aircraft> = {}): Aircraft {
  return {
    ...emptyAircraft('2026-10-28', ''),
    id,
    airline: 'Cathay Pacific',
    variant: 'A350-1000',
    handling: 'Full Turnaround',
    role: 'Primary Coordinator',
    arrival: { flight, status: 'Not Recorded', origin: 'Self-reported', scheduled: '', actual: '' },
    ...extra,
  };
}
function db(rows: Aircraft[] = []): Database {
  return { ...emptyAccountDatabase(), aircraft: rows };
}
async function permission(
  source = db([aircraft()]),
  destination = db([aircraft('cloud', 'CX402')]),
  revision = 1,
) {
  return requestMerge({
    source,
    destination,
    sourceSnapshot: JSON.stringify(source),
    userId,
    workspaceId,
    revision,
  });
}
describe('comparison-only flight identity and conservative matching', () => {
  it.each([
    ['CX0402', 'CX402'],
    ['CX00402', 'CX402'],
    ['cx0402', 'CX402'],
    ['UO0625', 'UO625'],
    ['CX0402A', 'CX402A'],
    ['cx000402a', 'CX402A'],
    [' 7C00081B ', '7C81B'],
    ['9G0009', '9G9'],
  ])('canonicalizes %s without rewriting source', (raw, expected) =>
    expect(canonicalFlight(raw)).toBe(expected),
  );
  it.each([
    'CX',
    'CX0000',
    '402',
    'CX 402',
    'CX402AB',
    'CX-402',
    'CX402.0',
    'CX+402',
    '',
    'CX402A extra',
    'CX1234567890123',
  ])('does not confidently identify malformed/prefix-only %s', (raw) =>
    expect(canonicalFlight(raw)).toBeNull(),
  );
  it('keeps prefixes and suffixes distinct', () => {
    expect(canonicalFlight('CX0402A')).not.toBe(canonicalFlight('CX402'));
    expect(canonicalFlight('CX0402A')).not.toBe(canonicalFlight('CX402B'));
    expect(canonicalFlight('UO0402')).not.toBe(canonicalFlight('CX402'));
  });
  it('recognizes equivalent flight strings as exact semantic duplicates while preserving every original byte', () => {
    const a = aircraft(),
      b = aircraft('cloud', 'cx00402'),
      before = JSON.stringify([a, b]);
    expect(compareAircraft(a, b)?.kind).toBe('exact');
    expect(matchAircraft([a], [b]).groups[0]).toMatchObject({ kind: 'exact', bulkEligible: true });
    expect(JSON.stringify([a, b])).toBe(before);
  });
  it('uses airline identities and never matches unrelated prefixes or flights', () => {
    expect(
      compareAircraft(aircraft(), aircraft('cloud', 'CX402', { airline: 'HK Express' })),
    ).toBeNull();
    expect(compareAircraft(aircraft(), aircraft('cloud', 'UO402'))).toBeNull();
    expect(compareAircraft(aircraft(), aircraft('cloud', 'CX403'))).toBeNull();
    expect(compareAircraft(aircraft('a', ''), aircraft('b', ''))).toBeNull();
  });
  it('does not use the same flight on a different operational date without corroborating HKT leg instants', () => {
    expect(
      compareAircraft(aircraft(), aircraft('cloud', 'CX402', { date: '2026-10-27' })),
    ).toBeNull();
    expect(
      compareAircraft(aircraft(), aircraft('cloud', 'CX402', { date: '2026-09-28' })),
    ).toBeNull();
  });
  it('flags cross-midnight pairs only with matching actual/scheduled instants and does not change dates', () => {
    const a = aircraft(),
      b = aircraft('cloud', 'CX402', { date: '2026-10-27' });
    a.arrival.actual = '2026-10-28T00:15:00+08:00';
    b.arrival.actual = '2026-10-27T16:15:00Z';
    expect(compareAircraft(a, b)?.reasons).toContain('shared-hkt-leg-instant-across-dates');
    expect(compareAircraft(a, b)?.kind).toBe('conflicting');
    b.arrival.actual = '2026-10-27T00:15:00+08:00';
    expect(compareAircraft(a, b)).toBeNull();
    expect(a.date).toBe('2026-10-28');
  });
  it.each(['Arrival Only', 'Departure Only'] as const)(
    'flags %s versus turnaround as partial and disallows bulk resolution',
    (handling) => {
      const a = aircraft(),
        b = aircraft('cloud', 'CX402', { handling });
      a.departure.flight = 'CX451';
      b.departure.flight = 'CX451';
      const group = matchAircraft([a], [b]).groups[0];
      expect(group.kind).toBe('partial');
      expect(group.bulkEligible).toBe(false);
    },
  );
  it('uses strong corroboration for no-flight records, not registration/date alone', () => {
    const a = aircraft('a', '', { registration: 'SYN-1' }),
      b = aircraft('b', '', { registration: 'SYN-1' });
    expect(compareAircraft(a, b)).toBeNull();
    a.arrival.actual = b.arrival.actual = '2026-10-28T01:00:00+08:00';
    expect(compareAircraft(a, b)?.reasons).toContain('airframe-and-leg-instant');
  });
  it('retains notes/disabled fields, statuses and role differences in conflicting review', () => {
    const a = aircraft('a', 'CX402', {
        notes: 'local confidential fixture',
        registration: 'SYN-A',
      }),
      b = aircraft('b', 'CX402', {
        notes: 'cloud confidential fixture',
        registration: 'SYN-B',
        role: 'Supporting Coordinator',
      });
    const match = compareAircraft(a, b)!;
    expect(match.kind).toBe('conflicting');
    expect(match.differences).toContainEqual({
      field: 'notes',
      cloud: b.notes,
      local: a.notes,
      state: 'conflict',
    });
    expect(
      match.differences.some((d) => d.field === 'registration' && d.state === 'conflict'),
    ).toBe(true);
    expect(
      compareFields({ bay: 'A', notes: '' }, { bay: '', notes: 'B' }).map((d) => d.state),
    ).toEqual(['cloud-only', 'local-only']);
  });
  it('classifies a missing value on one side as likely, not a silent field merge', () => {
    const group = matchAircraft(
      [aircraft('a', 'CX402')],
      [aircraft('b', 'CX402', { registration: 'SYN-A' })],
    ).groups[0];
    expect(group.kind).toBe('likely');
    expect(group.bulkEligible).toBe(true);
    expect(group.candidates[0].differences.find((d) => d.field === 'registration')?.state).toBe(
      'cloud-only',
    );
  });
  it('groups one-to-many and many-to-many matches deterministically without a greedy winner', () => {
    const local = [aircraft('a', 'CX402'), aircraft('b', 'CX402')],
      cloud = [aircraft('c', 'CX402'), aircraft('d', 'CX402')];
    const result = matchAircraft(local, cloud);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({
      kind: 'ambiguous',
      bulkEligible: false,
      localIds: ['a', 'b'],
      cloudIds: ['c', 'd'],
    });
    expect(result.groups[0].candidates).toHaveLength(4);
    expect(matchAircraft([...local].reverse(), [...cloud].reverse())).toEqual(result);
    expect(matchAircraft([local[0]], cloud).groups[0].kind).toBe('ambiguous');
  });
  it('flags stable-ID collisions even when the operational identities differ', () => {
    expect(
      compareAircraft(
        aircraft('same'),
        aircraft('same', 'UO77', { airline: 'HK Express', date: '2025-01-01' }),
      )?.kind,
    ).toBe('conflicting');
  });
});
describe('two-stage non-destructive Guest merge planning', () => {
  it('requires separate permission and final approval; never marks local planning as cloud complete', async () => {
    const p = await permission();
    expect(p.stage).toBe('permission');
    expect(p.items).toEqual([]);
    expect(() => previewMerge(p)).toThrow(MergeError);
    expect(() => bulkDecide(p, [], 'cloud', userId)).toThrow(MergeError);
    const review = confirmPreparation(p, userId);
    expect(review.stage).toBe('review');
    expect(() => previewMerge(review)).toThrow('unresolved');
    const chosen = decide(
      review,
      review.items[0].key,
      { choice: 'cloud', target: 'cloud' },
      userId,
    );
    const queued = await confirmFinal(chosen, {
      userId,
      workspaceId,
      sourceSnapshot: p.sourceSnapshot,
      destination: p.destination,
      revision: 1,
    });
    expect(queued.stage).toBe('queued');
    expect(queued.verifiedRevision).toBeNull();
    const complete = verifyReceipt(queued, {
      userId,
      workspaceId,
      operationId: queued.operationId,
      revision: 2,
      db: queued.queuedResult!,
    });
    expect(complete.stage).toBe('verified');
    expect(complete.source).toEqual(p.source);
  });
  it('Keep Cloud skips the Guest counterpart without changing either original source', async () => {
    const p = confirmPreparation(await permission(), userId),
      before = JSON.stringify(p);
    const chosen = bulkDecide(p, selectEligible(p), 'cloud', userId);
    expect(previewMerge(chosen)).toMatchObject({
      db: p.destination,
      summary: { skipped: 1, replaced: 0, add: { aircraft: 0 } },
    });
    expect(JSON.stringify(p)).toBe(before);
  });
  it('Keep Local preserves a recoverable Cloud copy and needs additional approval before replacing nonempty fields', async () => {
    const p = confirmPreparation(
      await permission(
        db([aircraft('local', 'CX402', { notes: 'local version' })]),
        db([aircraft('cloud', 'CX402', { notes: 'cloud version' })]),
      ),
      userId,
    );
    const next = decide(p, p.items[0].key, { choice: 'local', target: 'cloud' }, userId),
      preview = previewMerge(next);
    expect(preview.db.aircraft[0]).toMatchObject({ id: 'cloud', notes: 'local version' });
    expect(preview.recovery).toEqual([
      { collection: 'aircraft', value: p.destination.aircraft[0] },
    ]);
    expect(preview.summary.highRisk.length).toBeGreaterThan(0);
    const context = {
      userId,
      workspaceId,
      sourceSnapshot: p.sourceSnapshot,
      destination: p.destination,
      revision: 1,
    };
    await expect(confirmFinal(next, context)).rejects.toThrow('manual');
    expect((await confirmFinal(next, context, true)).stage).toBe('queued');
  });
  it('supports manual edit and separate records only inside Manual Review', async () => {
    const p = confirmPreparation(await permission(), userId);
    const unfinished = bulkDecide(p, [p.items[0].key], 'manual', userId);
    expect(() => previewMerge(unfinished)).toThrow('unresolved');
    const edit = { ...p.source.aircraft[0], notes: 'reviewed final' };
    const chosen = decide(
      p,
      p.items[0].key,
      { choice: 'manual', target: 'cloud', result: edit, references: 'guest' },
      userId,
    );
    expect(previewMerge(chosen).db.aircraft[0]).toMatchObject({
      id: 'cloud',
      notes: 'reviewed final',
    });
    const separate = decide(p, p.items[0].key, { choice: 'manual', separate: true }, userId);
    const result = previewMerge(separate);
    expect(result.db.aircraft).toHaveLength(2);
    expect(new Set(result.db.aircraft.map((a) => a.id)).size).toBe(2);
    expect(result.summary).toMatchObject({ separate: 1, manual: 1, replaced: 0 });
  });
  it('supports single/multiple selection, eligible all, deselection and overriding bulk decisions', async () => {
    const source = db([aircraft('g1', 'CX401'), aircraft('g2', 'CX402')]),
      destination = db([aircraft('c1', 'CX401'), aircraft('c2', 'CX402')]);
    const p = confirmPreparation(await permission(source, destination), userId);
    const selected = selectEligible(p);
    expect(selected).toHaveLength(2);
    let chosen = bulkDecide(p, selected, 'cloud', userId);
    expect(previewMerge(chosen).summary.skipped).toBe(2);
    chosen = decide(chosen, itemKey('aircraft', 'g2'), { choice: 'local', target: 'c2' }, userId);
    expect(previewMerge(chosen).summary).toMatchObject({ skipped: 1, replaced: 1 });
    // Selection is UI state; deselecting never changes recorded choices.
    const selection = new Set(selected);
    selection.clear();
    expect(previewMerge(chosen).summary.skipped).toBe(1);
  });
  it('rejects bulk Cloud/Local for conflicting, partial or ambiguous groups; manual marking remains unresolved', async () => {
    const p = confirmPreparation(
      await permission(db([aircraft()]), db([aircraft('c1', 'CX402'), aircraft('c2', 'CX402')])),
      userId,
    );
    expect(selectEligible(p)).toEqual([]);
    for (const choice of ['cloud', 'local'] as const)
      expect(() => bulkDecide(p, [p.items[0].key], choice, userId)).toThrow('manual');
    expect(() => previewMerge(bulkDecide(p, [p.items[0].key], 'manual', userId))).toThrow(
      'unresolved',
    );
  });
  it('does not allow multiple incoming replacements to silently target one Cloud record', async () => {
    let p = confirmPreparation(
      await permission(db([aircraft('g1', 'CX402'), aircraft('g2', 'CX402')])),
      userId,
    );
    for (const item of p.items)
      p = decide(p, item.key, { choice: 'local', target: 'cloud' }, userId);
    expect(() => previewMerge(p)).toThrow('manual');
    p = decide(p, itemKey('aircraft', 'g2'), { choice: 'manual', separate: true }, userId);
    expect(previewMerge(p).db.aircraft).toHaveLength(2);
  });
  it('preserves Duty, Journal, disruptions and all links, remapping colliding IDs without touching Guest', async () => {
    const source = seedDatabase(),
      destination = emptyAccountDatabase();
    destination.duties = [{ ...source.duties[0], notes: 'different existing duty' }];
    const bytes = JSON.stringify(source);
    let p = confirmPreparation(await permission(source, destination), userId);
    const duty = p.items.find((i) => i.collection === 'duties')!;
    p = decide(p, duty.key, { choice: 'manual', separate: true }, userId);
    const result = previewMerge(p).db;
    expect(result.aircraft).toHaveLength(source.aircraft.length);
    expect(result.journals).toHaveLength(source.journals.length);
    expect(result.duties).toHaveLength(source.duties.length + 1);
    const copied = result.duties.find(
      (d) => d.id !== source.duties[0].id && d.date === source.duties[0].date,
    )!;
    for (const a of result.aircraft.filter(
      (a) => source.aircraft.find((s) => s.id === a.id)?.dutyId === source.duties[0].id,
    ))
      expect(a.dutyId).toBe(copied.id);
    expect(JSON.stringify(source)).toBe(bytes);
  });
  it('keeps Account preferences by default; Guest preferences require a separate decision and additional approval', async () => {
    const source = db(),
      destination = db();
    source.settings.privacy = { ...restrictivePrivacy };
    destination.settings.privacy = { ...defaultOptionalFields, registration: false };
    const p = confirmPreparation(await permission(source, destination), userId);
    expect(previewMerge(p).db.settings.privacy).toEqual(destination.settings.privacy);
    const chosen = setPreferences(p, 'guest', userId);
    expect(previewMerge(chosen).summary.settingsChanged).toBe(true);
    expect(previewMerge(chosen).db.settings.privacy).toEqual(restrictivePrivacy);
  });
  it('preserves incomplete Drafts and special string IDs without prototype-key collisions', async () => {
    const source = db([
      {
        ...emptyAircraft('', ''),
        id: '__proto__',
        handling: '',
        role: '',
        airline: '',
        variant: '',
      },
    ]);
    const p = confirmPreparation(await permission(source, db()), userId);
    expect(previewMerge(p).db.aircraft[0]).toMatchObject({
      id: '__proto__',
      status: 'Draft',
      handling: '',
      variant: '',
    });
    expect(Object.getPrototypeOf(p.mappings.aircraft)).toBe(Object.prototype);
  });
  it('preserves explicitly account-scoped Manual Edit links when Guest duty IDs collide', async () => {
    const duty = {
      id: 'same-duty',
      date: '2026-10-28',
      start: '',
      end: '',
      status: 'Draft' as const,
      notes: 'Guest',
    };
    const source = db([aircraft('local', 'CX402', { dutyId: duty.id })]);
    source.duties = [duty];
    const destination = db([aircraft('cloud', 'CX402', { dutyId: duty.id })]);
    destination.duties = [{ ...duty, notes: 'Cloud' }];
    let plan = confirmPreparation(await permission(source, destination), userId);
    plan = decide(plan, itemKey('duties', duty.id), { choice: 'manual', separate: true }, userId);
    plan = decide(
      plan,
      itemKey('aircraft', 'local'),
      {
        choice: 'manual',
        target: 'cloud',
        result: { ...destination.aircraft[0], id: 'local' },
        references: 'account',
      },
      userId,
    );
    const result = previewMerge(plan).db;
    expect(result.aircraft[0].dutyId).toBe('same-duty');
    expect(result.duties).toHaveLength(2);
    expect(result.duties.find((d) => d.id === 'same-duty')!.notes).toBe('Cloud');
  });
  it('stages a real editor result and remaps provisional Guest links to the final reviewed duty choice', async () => {
    const duty = {
      id: 'same-duty',
      date: '2026-10-28',
      start: '',
      end: '',
      status: 'Draft' as const,
      notes: 'Guest',
    };
    const source = db([aircraft('local', 'CX0402', { dutyId: duty.id })]);
    source.duties = [duty];
    const destination = db([aircraft('cloud', 'CX402', { dutyId: duty.id })]);
    destination.duties = [{ ...duty, notes: 'Cloud' }];
    let plan = confirmPreparation(await permission(source, destination), userId);
    const item = plan.items.find((row) => row.collection === 'aircraft')!;
    const context = manualContext(plan, item, 'cloud', 'local');
    const edited = { ...context.record, notes: 'Reviewed in editor' } as Aircraft;
    expect(edited.dutyId).not.toBe(duty.id);
    plan = decide(
      plan,
      item.key,
      {
        choice: 'manual',
        target: 'cloud',
        result: { ...edited, id: item.sourceId },
        references: 'staged',
      },
      userId,
    );
    plan = decide(plan, itemKey('duties', duty.id), { choice: 'cloud', target: duty.id }, userId);
    const result = previewMerge(plan).db;
    expect(result.duties).toHaveLength(1);
    expect(result.aircraft).toHaveLength(1);
    expect(result.aircraft[0].notes).toBe('Reviewed in editor');
    expect(result.aircraft[0].dutyId).toBe(duty.id);
    expect(result.aircraft[0].arrival.flight).toBe('CX0402');
    expect(source.aircraft[0].arrival.flight).toBe('CX0402');
  });
  it('rejects a resumed mapping that redirects an unrelated record outside the reviewed group', async () => {
    const plan = confirmPreparation(
      await permission(db([aircraft('guest', 'CX402')]), db([aircraft('unrelated', 'CX777')])),
      userId,
    );
    plan.mappings.aircraft['$guest'] = 'unrelated';
    expect(() => previewMerge(plan)).toThrow('invalid');
    await expect(
      validatePlan({ ...plan, stage: 'queued', queuedResult: plan.destination }, userId),
    ).rejects.toThrow('invalid');
  });
  it('invalidates stale source/destination/identity/revision approvals and rejects forged target choices', async () => {
    const p = confirmPreparation(await permission(db(), db()), userId);
    const context = {
      userId,
      workspaceId,
      sourceSnapshot: p.sourceSnapshot,
      destination: p.destination,
      revision: 1,
    };
    for (const override of [
      { userId: otherId },
      { workspaceId: otherId },
      { revision: 2 },
      { sourceSnapshot: p.sourceSnapshot + ' ' },
      {
        destination: {
          ...p.destination,
          settings: { ...p.destination.settings, language: 'zh-HK' as const },
        },
      },
    ])
      await expect(confirmFinal(p, { ...context, ...override })).rejects.toThrow(MergeError);
    const duplicate = confirmPreparation(await permission(), userId);
    expect(() =>
      decide(
        duplicate,
        duplicate.items[0].key,
        { choice: 'local', target: 'unrelated-cloud-record' },
        userId,
      ),
    ).toThrow('invalid');
  });
  it('resumes the same durable plan/mappings and receipt without duplicate IDs; rejects false completion', async () => {
    const p = confirmPreparation(await permission(db([aircraft()]), db()), userId);
    const queued = await confirmFinal(p, {
      userId,
      workspaceId,
      sourceSnapshot: p.sourceSnapshot,
      destination: p.destination,
      revision: 1,
    });
    const restored = await validatePlan(JSON.parse(JSON.stringify(queued)), userId);
    expect(restored.operationId).toBe(queued.operationId);
    expect(restored.queuedResult).toEqual(queued.queuedResult);
    const receipt = {
      userId,
      workspaceId,
      operationId: queued.operationId,
      revision: 2,
      db: queued.queuedResult!,
    };
    expect(verifyReceipt(restored, receipt).queuedResult?.aircraft).toHaveLength(1);
    for (const override of [
      { userId: otherId },
      { operationId: otherId },
      { revision: 1 },
      { db: db() },
    ])
      expect(() => verifyReceipt(restored, { ...receipt, ...override })).toThrow(MergeError);
    expect(queued.confirmations.permissionAt).toBeTruthy();
    expect(queued.confirmations.finalAt).toBeTruthy();
    const shortcut = structuredClone(queued);
    shortcut.confirmations.finalAt = null;
    await expect(validatePlan(shortcut, userId)).rejects.toThrow('invalid');
    const changed = structuredClone(queued);
    changed.queuedResult!.aircraft[0].notes = 'unapproved';
    await expect(validatePlan(changed, userId)).rejects.toThrow('invalid');
  });
});
