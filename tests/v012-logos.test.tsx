import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import AirlineLogo from '../src/components/AirlineLogo';
import {
  localAirlineLogos,
  displayLogoPath,
  findLocalAirline,
} from '../src/data/localAirlineLogos';
import { airlineRegistry } from '../src/data/airlines';
import inventory from '../docs/AIRLINE_ASSET_INVENTORY.json';

describe('Owner-enabled PNG display is independent of redistribution rights', () => {
  it('Maps all 24 exact filenames to distinct airline identities without changing legal evidence', () => {
    expect(localAirlineLogos).toHaveLength(24);
    expect(new Set(localAirlineLogos.map((a) => a.iata)).size).toBe(24);
    for (const asset of localAirlineLogos) {
      const path = displayLogoPath(asset);
      expect(path).toBe(`/assets/airlines/${asset.iata}.png`);
      expect(existsSync(`public${path}`)).toBe(true);
      expect(findLocalAirline(asset.iata)).toBe(asset);
      expect(asset.redistributionPermission).toBe('unverified');
      expect(inventory.assets.find((a) => a.iata === asset.iata)?.redistributionPermission).toBe(
        'unverified',
      );
    }
    for (const a of airlineRegistry) expect(a.logo.permission).toBe('not-established');
  });
  it('Preserves specific operating identities despite generic shared brand pixels', () => {
    expect(findLocalAirline('QZ')?.name).toBe('Indonesia AirAsia');
    expect(findLocalAirline('Z2')?.name).toBe('Philippines AirAsia');
    expect(findLocalAirline('GK')?.name).toBe('Jetstar Japan');
    expect(findLocalAirline('Jetstar')).toBeUndefined();
    expect(findLocalAirline('Hong Kong Airlines')).toBeUndefined();
    const { container } = render(<AirlineLogo airline="QZ" showName />);
    expect(screen.getByRole('img', { name: 'Indonesia AirAsia (QZ)' })).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', '/assets/airlines/QZ.png');
    expect(screen.getByText('Indonesia AirAsia')).toBeInTheDocument();
  });
  it('Rejects mismatched identity, unavailable/disabled mappings and external/invalid filenames', () => {
    expect(displayLogoPath({ iata: 'CX', name: 'HK Express' })).toBeNull();
    expect(displayLogoPath({ iata: 'JQ', name: 'Jetstar Japan' })).toBeNull();
    const asset = localAirlineLogos.find((a) => a.iata === 'CX')!;
    vi.spyOn(asset, 'displayEnabled', 'get').mockReturnValue(false);
    expect(displayLogoPath(asset)).toBeNull();
  });
  it('Uses a code fallback for no image and failed image load; all attempted sources are same-origin', () => {
    const { container, rerender } = render(<AirlineLogo airline="HX" />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Hong Kong Airlines (HX)' })).toHaveTextContent('HX');
    rerender(<AirlineLogo airline="CX" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Cathay Pacific (CX)' })).toHaveTextContent('CX');
    rerender(
      <>
        {localAirlineLogos.map((a) => (
          <AirlineLogo key={a.iata} airline={a.iata} />
        ))}
      </>,
    );
    for (const image of container.querySelectorAll('img'))
      expect(image.getAttribute('src')).toMatch(/^\/assets\/airlines\/[A-Z0-9]{2}\.png$/);
  });
});
