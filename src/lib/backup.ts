import type { Database } from '../domain/model';
import { disruptionCategories, flightStatuses, handlingTypes, roles } from '../domain/model';
import { aircraftCatalogue, validAircraftIdentity } from '../data/aircraftCatalogue';

export const BACKUP_APP = 'turnaround-coordinator-logbook';
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export type BackupCode =
  'invalid' | 'report' | 'version' | 'duplicate' | 'orphan' | 'size' | 'file';
export class BackupError extends Error {
  constructor(public code: BackupCode) {
    super(code);
  }
}
const fail = (code: BackupCode = 'invalid'): never => {
  throw new BackupError(code);
};
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
function shape(
  v: unknown,
  required: string[],
  optional: string[] = [],
): asserts v is Record<string, unknown> {
  if (
    !obj(v) ||
    required.some((k) => !Object.hasOwn(v, k)) ||
    Object.keys(v).some((k) => !required.includes(k) && !optional.includes(k))
  )
    fail();
}
const str = (v: unknown): v is string => typeof v === 'string' && v.length <= 200_000;
const strings = (v: Record<string, unknown>, keys: string[]) => {
  if (keys.some((k) => !str(v[k]))) fail();
};
const oneOf = (v: unknown, values: readonly unknown[]) => {
  if (!values.includes(v)) fail();
};
const member = (v: unknown, values: readonly string[]) =>
  typeof v === 'string' && values.includes(v);
const optional = (v: Record<string, unknown>, key: string, valid: (v: unknown) => boolean) => {
  if (v[key] !== undefined && !valid(v[key])) fail();
};
const recordStates = ['Draft', 'Confirmed', 'Trashed'];
const date = (v: unknown): v is string =>
  str(v) &&
  (v === '' ||
    (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
      Number.isFinite(Date.parse(`${v}T00:00:00Z`)) &&
      new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v));
const clock = (v: unknown) => str(v) && (v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v));
const timestamp = (v: unknown) =>
  str(v) &&
  (v === '' ||
    (date(v.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))));
const gate = (v: unknown) =>
  str(v) &&
  (v === '' ||
    (date(v.slice(0, 10)) &&
      /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)?$/.test(
        v,
      ) &&
      Number.isFinite(Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(v) ? v : `${v}+08:00`))));
const array = (v: unknown): unknown[] => {
  if (!Array.isArray(v)) fail();
  return v as unknown[];
};
const stringArray = (v: unknown) => {
  const a = array(v);
  if (!a.every(str) || new Set(a).size !== a.length) fail();
  return a as string[];
};
function cleanKeys(v: unknown, depth = 0) {
  if (depth > 32) fail();
  if (v && typeof v === 'object') {
    for (const [key, child] of Object.entries(v)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) fail();
      cleanKeys(child, depth + 1);
    }
  }
}
function ids(rows: unknown[]): Set<string> {
  const found = new Set<string>();
  for (const row of rows) {
    if (!obj(row) || !str(row.id) || !row.id.trim()) throw new BackupError('invalid');
    if (found.has(row.id)) fail('duplicate');
    found.add(row.id);
  }
  return found;
}

/** Strict import/export validation. Local loading stays permissive for existing records. */
export function validateBackupDatabase(value: unknown): asserts value is Database {
  cleanKeys(value);
  shape(value, ['version', 'duties', 'aircraft', 'journals', 'settings']);
  if (value.version !== 1) fail('version');
  const duties = array(value.duties),
    aircraft = array(value.aircraft),
    journals = array(value.journals);
  const dutyIds = ids(duties),
    aircraftIds = ids(aircraft),
    journalIds = ids(journals),
    events: unknown[] = [];
  shape(value.settings, ['language', 'privacy']);
  oneOf(value.settings.language, ['en', 'zh-HK']);
  shape(value.settings.privacy, [
    'registration',
    'flights',
    'bay',
    'gateTimes',
    'statuses',
    'disruptionNotes',
  ]);
  if (!Object.values(value.settings.privacy).every((v) => typeof v === 'boolean')) fail();
  for (const d of duties) {
    shape(
      d,
      ['id', 'date', 'start', 'end', 'status', 'notes'],
      ['workState', 'shiftType', 'leave', 'trashedAt', 'previousStatus'],
    );
    strings(d, ['id', 'notes']);
    oneOf(d.status, recordStates);
    if (!date(d.date) || !clock(d.start) || !clock(d.end)) fail();
    optional(d, 'leave', (v) => member(v, ['AL', 'SL']));
    if (d.leave && !d.date) fail();
    if (d.leave === 'AL' && (d.start || d.end)) fail();
    if (d.leave === 'SL' && (d.workState !== 'Planned' || !d.start || !d.end || d.start === d.end))
      fail();
    optional(d, 'workState', (v) => member(v, ['Planned', 'Worked']));
    optional(d, 'shiftType', (v) => member(v, ['Day', 'Evening', 'Night', 'Custom']));
    optional(d, 'trashedAt', timestamp);
    optional(d, 'previousStatus', (v) => member(v, recordStates));
  }
  const link = (v: unknown, targets: Set<string>) => {
    if (!str(v) || (v && !targets.has(v))) fail('orphan');
  };
  for (const a of aircraft) {
    shape(
      a,
      [
        'id',
        'date',
        'dutyId',
        'airline',
        'variant',
        'family',
        'icao',
        'handling',
        'role',
        'registration',
        'bay',
        'arrival',
        'departure',
        'disruption',
        'events',
        'notes',
        'actualHandling',
        'status',
        'createdAt',
        'updatedAt',
        'revisions',
      ],
      ['aircraftType', 'originalDutyId', 'previousStatus', 'trashedAt'],
    );
    strings(a, [
      'id',
      'dutyId',
      'airline',
      'variant',
      'family',
      'icao',
      'registration',
      'bay',
      'notes',
    ]);
    if (
      !date(a.date) ||
      !timestamp(a.createdAt) ||
      !timestamp(a.updatedAt) ||
      typeof a.actualHandling !== 'boolean'
    )
      fail();
    oneOf(a.handling, [...handlingTypes, '']);
    oneOf(a.role, [...roles, '']);
    oneOf(a.status, recordStates);
    oneOf(a.disruption, ['Unknown', 'Normal', 'Disrupted']);
    optional(a, 'aircraftType', str);
    if (
      !validAircraftIdentity(a as unknown as Database['aircraft'][number]) &&
      !(
        (a.status === 'Draft' || (a.status === 'Trashed' && a.previousStatus === 'Draft')) &&
        a.variant === '' &&
        (a.aircraftType === '' || aircraftCatalogue.some((type) => type.model === a.aircraftType))
      )
    )
      fail();
    optional(a, 'previousStatus', (v) => member(v, recordStates));
    optional(a, 'trashedAt', timestamp);
    link(a.dutyId, dutyIds);
    if (a.originalDutyId !== undefined) link(a.originalDutyId, dutyIds);
    for (const leg of [a.arrival, a.departure]) {
      shape(leg, ['flight', 'status', 'origin', 'scheduled', 'actual']);
      strings(leg, ['flight']);
      oneOf(leg.status, flightStatuses);
      oneOf(leg.origin, ['Self-reported', 'Confirmed mock gate suggestion']);
      if (!gate(leg.scheduled) || !gate(leg.actual)) fail();
    }
    for (const e of array(a.events)) {
      shape(
        e,
        ['id', 'category', 'involvement', 'resolution', 'notes'],
        ['impact', 'delayMinutes', 'journalId'],
      );
      strings(e, ['id', 'notes']);
      oneOf(e.category, disruptionCategories);
      oneOf(e.involvement, ['Observed', 'Assisted', 'Coordinated', 'Escalated']);
      oneOf(e.resolution, ['Resolved', 'Escalated', 'Handed Over']);
      optional(e, 'impact', (v) => member(v, ['Minor', 'Moderate', 'Major']));
      optional(
        e,
        'delayMinutes',
        (v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0,
      );
      if (e.journalId !== undefined) link(e.journalId, journalIds);
      events.push(e);
    }
    for (const r of array(a.revisions)) {
      shape(r, ['at', 'summary']);
      strings(r, ['summary']);
      if (!timestamp(r.at)) fail();
    }
  }
  ids(events);
  for (const j of journals) {
    shape(
      j,
      [
        'id',
        'date',
        'title',
        'status',
        'situation',
        'challenge',
        'responsibility',
        'actions',
        'result',
        'learning',
        'tags',
        'dutyId',
        'aircraftIds',
        'outcome',
        'unit',
        'contribution',
        'evidence',
        'verification',
      ],
      ['originalDutyId'],
    );
    strings(j, [
      'id',
      'title',
      'situation',
      'challenge',
      'responsibility',
      'actions',
      'result',
      'learning',
      'outcome',
      'unit',
      'contribution',
      'evidence',
      'verification',
    ]);
    oneOf(j.status, ['Draft', 'Confirmed']);
    if (!date(j.date)) fail();
    // Unknown historical competency text is retained; strings are never interpreted as markup/code.
    stringArray(j.tags);
    link(j.dutyId, dutyIds);
    if (j.originalDutyId !== undefined) link(j.originalDutyId, dutyIds);
    for (const id of stringArray(j.aircraftIds)) link(id, aircraftIds);
  }
}

export interface FullBackup {
  appId: typeof BACKUP_APP;
  backupFormatVersion: 1;
  exportedAt: string;
  storageSchemaVersion: 1;
  data: Database;
}
export function createBackup(db: Database, now = new Date()): FullBackup {
  validateBackupDatabase(db);
  return {
    appId: BACKUP_APP,
    backupFormatVersion: 1,
    exportedAt: now.toISOString(),
    storageSchemaVersion: 1,
    data: structuredClone(db),
  };
}
export function parseBackup(text: string): FullBackup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) fail('size');
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return fail();
  }
  cleanKeys(v);
  if (obj(v) && (Array.isArray(v.counts) || Array.isArray(v.stories)) && !Object.hasOwn(v, 'data'))
    fail('report');
  shape(v, ['appId', 'backupFormatVersion', 'exportedAt', 'storageSchemaVersion', 'data']);
  if (v.appId !== BACKUP_APP) fail();
  if (v.backupFormatVersion !== 1 || v.storageSchemaVersion !== 1) fail('version');
  if (
    !str(v.exportedAt) ||
    !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(v.exportedAt) ||
    !timestamp(v.exportedAt)
  )
    fail();
  validateBackupDatabase(v.data);
  return v as unknown as FullBackup;
}
