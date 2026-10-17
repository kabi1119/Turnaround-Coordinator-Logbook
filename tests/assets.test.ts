import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import inventory from '../docs/AIRLINE_ASSET_INVENTORY.json';
import { airlineRegistry, approvedLogoPath } from '../src/data/airlines';

const assetsDirectory = 'public/assets/airlines';

describe('Owner-retained asset publication integrity', () => {
  it('Inventories every PNG with its exact case-sensitive filename and unique intended code', () => {
    const files = readdirSync(assetsDirectory)
      .filter((name) => name.endsWith('.png'))
      .sort();
    expect(inventory.assets.map((asset) => asset.filename).sort()).toEqual(files);
    expect(new Set(inventory.assets.map((asset) => asset.iata)).size).toBe(files.length);
    for (const asset of inventory.assets) expect(asset.filename).toBe(`${asset.iata}.png`);
  });

  it('Preserves original PNG bytes, dimensions and checksums without silently replacing artwork', () => {
    for (const asset of inventory.assets) {
      const bytes = readFileSync(join(assetsDirectory, asset.filename));
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(bytes.length).toBe(asset.bytes);
      expect(bytes.readUInt32BE(16)).toBe(asset.width);
      expect(bytes.readUInt32BE(20)).toBe(asset.height);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    }
  });

  it('Does not equate owner retention with permission or allow broken approved runtime paths', () => {
    for (const asset of inventory.assets) {
      expect(asset.redistributionPermission).toBe('unverified');
      expect(asset.permissionEvidence).toBeNull();
      expect(asset.exactDownloadUrl).toBeNull();
    }
    for (const airline of airlineRegistry) {
      const path = approvedLogoPath(airline);
      if (path) expect(existsSync(`public${path}`)).toBe(true);
      else expect(airline.logo.permission).toBe('not-established');
    }
  });
});
