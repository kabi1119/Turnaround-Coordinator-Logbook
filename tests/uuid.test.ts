import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidV4 } from '../src/lib/uuid';

const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const withoutNativeUUID = () => vi.stubGlobal('crypto', { getRandomValues });

afterEach(() => vi.unstubAllGlobals());

describe('record UUIDs on secure contexts and LAN HTTP', () => {
  it('prefers the native method and preserves its receiver', () => {
    const native = {
      randomUUID: vi.fn(function (this: unknown) {
        expect(this).toBe(native);
        return '12345678-1234-4123-8123-123456789abc';
      }),
      getRandomValues: vi.fn(),
    };
    vi.stubGlobal('crypto', native);
    expect(uuidV4()).toBe('12345678-1234-4123-8123-123456789abc');
    expect(native.randomUUID).toHaveBeenCalledOnce();
    expect(native.getRandomValues).not.toHaveBeenCalled();
  });

  it('generates distinct, correctly formatted UUID v4 values without randomUUID', () => {
    withoutNativeUUID();
    expect(globalThis.crypto.randomUUID).toBeUndefined();
    const ids = Array.from({ length: 256 }, uuidV4);
    expect(new Set(ids).size).toBe(ids.length);
    for (const value of ids) expect(value).toMatch(uuidPattern);
  });

  it.each([
    [0x00, '00000000-0000-4000-8000-000000000000'],
    [0xff, 'ffffffff-ffff-4fff-bfff-ffffffffffff'],
  ])('sets version and variant bits while preserving other bits (%i)', (byte, expected) => {
    const fill = vi.fn((bytes: Uint8Array) => bytes.fill(byte));
    vi.stubGlobal('crypto', { randomUUID: undefined, getRandomValues: fill });
    expect(uuidV4()).toBe(expected);
    expect(fill).toHaveBeenCalledOnce();
    expect(fill.mock.calls[0][0]).toHaveLength(16);
  });

  it.each([undefined, {}])(
    'fails explicitly if secure randomness is unavailable (%j)',
    (crypto) => {
      vi.stubGlobal('crypto', crypto);
      const predictable = vi.spyOn(Math, 'random');
      expect(uuidV4).toThrow('Secure random number generation is unavailable');
      expect(predictable).not.toHaveBeenCalled();
    },
  );

  it('initializes seed and sample-refresh modules and creates records without randomUUID', async () => {
    withoutNativeUUID();
    vi.resetModules();
    const { seedDatabase } = await import('../src/data/seed');
    const { sampleRefreshPlan, refreshSamples } = await import('../src/data/sampleRefresh');
    const { id, emptyAircraft } = await import('../src/domain/model');
    const db = seedDatabase();
    expect(db.aircraft).toHaveLength(4);
    expect(emptyAircraft().id).toMatch(uuidPattern);
    expect(id()).toMatch(uuidPattern); // Shared by Duty, Journal, disruption and roster creation.
    const plan = sampleRefreshPlan(db);
    expect(plan.blocked).toEqual([]);
    expect(plan.changed).toBe(false);
    expect(refreshSamples(db, plan.token)).toEqual(db);
  });

  it('preserves stored IDs, relationships and schema without regenerating records', async () => {
    withoutNativeUUID();
    const { seedDatabase } = await import('../src/data/seed');
    const { loadDatabase, writeDatabase, STORAGE_KEY } = await import('../src/lib/storage');
    const db = seedDatabase();
    const originalDuty = db.duties[0].id;
    db.duties[0].id = 'existing-personal-duty';
    for (const aircraft of db.aircraft)
      if (aircraft.dutyId === originalDuty) aircraft.dutyId = db.duties[0].id;
    for (const journal of db.journals)
      if (journal.dutyId === originalDuty) journal.dutyId = db.duties[0].id;
    const originalAircraft = db.aircraft[0].id;
    db.aircraft[0].id = 'existing-personal-aircraft';
    for (const journal of db.journals)
      journal.aircraftIds = journal.aircraftIds.map((id) =>
        id === originalAircraft ? db.aircraft[0].id : id,
      );
    const serialized = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, serialized);
    const loaded = loadDatabase();
    expect(loaded.error).toBe('');
    expect(loaded.db).toEqual(db);
    expect(loaded.db.version).toBe(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(serialized);
    expect(writeDatabase(loaded.db)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(serialized);
  });
});
