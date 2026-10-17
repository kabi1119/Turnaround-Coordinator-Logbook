import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AirlineLogo from '../src/components/AirlineLogo';
import * as registry from '../src/data/airlines';
import { airlines, demoAirlines } from '../src/data/reference';
import type { AirlineReference } from '../src/data/airlines';
import App from '../src/App';
import { seedDatabase } from '../src/data/seed';
import { STORAGE_KEY } from '../src/lib/storage';

const approvedFixture = (): AirlineReference => ({
  ...structuredClone(registry.airlineRegistry[0]),
  logo: {
    localPath: '/assets/airlines/test-only.svg',
    sourceUrl: 'https://example.test/official-brand',
    verificationStatus: 'approved',
    permission: 'approved-for-bundling',
    permissionEvidenceUrl: 'https://example.test/permission',
    notes: 'Test-only metadata, not a real licensed airline asset.',
  },
});
describe('Verified airline reference and local-only logo policy', () => {
  it('Includes explicit CX and LD, distinct from HX, with IATA evidence for LD/AHK', () => {
    expect(registry.findAirline('CX')).toMatchObject({
      name: 'Cathay Pacific',
      iata: 'CX',
      requestedInclusion: true,
    });
    expect(registry.findAirline('Air Hong Kong')).toMatchObject({
      iata: 'LD',
      icao: 'AHK',
      requestedInclusion: true,
    });
    expect(registry.findAirline('HX')?.name).toBe('Hong Kong Airlines');
    expect(new Set(registry.airlineRegistry.map((a) => a.iata)).size).toBe(
      registry.airlineRegistry.length,
    );
    expect(airlines).toContain('Air Hong Kong');
    expect(demoAirlines).toEqual([
      'Cathay Pacific',
      'HK Express',
      'Hong Kong Airlines',
      'Singapore Airlines',
      'ANA',
      'Emirates',
      'Qatar Airways',
      'Lufthansa',
    ]);
  });
  it('Resolves historical aliases without rewriting the stored snapshot; unknown manual airlines remain possible', () => {
    expect(registry.findAirline('  ana ')?.iata).toBe('NH');
    expect(registry.findAirline('Lufthansa')?.iata).toBe('LH');
    expect(registry.findAirline('DEMO manual airline')).toBeUndefined();
    const value = seedDatabase();
    const snapshot = JSON.stringify(value);
    localStorage.setItem(STORAGE_KEY, snapshot);
    render(<App />);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(snapshot);
  });
  it('Keeps handling affiliation separate and unverified; no fabricated HAS relationship or implied logo permission', () => {
    for (const a of registry.airlineRegistry) {
      expect(a.identitySourceUrl).toMatch(/^https:\/\//);
      expect(a.verifiedOn).toBe('2026-10-17');
      expect(a.handling.status).toBe('unverified');
      expect(a.handling.notes).toContain('passenger');
      expect(a.logo.permission).toBe('not-established');
      expect(registry.approvedLogoPath(a)).toBeNull();
    }
  });
  it('Renders every registry entry using an accessible code/name fallback with no image requests', () => {
    const { container } = render(
      <>
        {registry.airlineRegistry.map((a) => (
          <AirlineLogo key={a.iata} airline={a.name} showName />
        ))}
      </>,
    );
    expect(container.querySelectorAll('img')).toHaveLength(0);
    for (const a of registry.airlineRegistry) {
      expect(screen.getByRole('img', { name: `${a.name} (${a.iata})` })).toHaveTextContent(a.iata);
      expect(screen.getByText(a.name)).toBeInTheDocument();
    }
  });
  it('Unknown names use a neutral badge and full name, never fabricated initials or an invented logo', () => {
    const { container } = render(<AirlineLogo airline="DEMO custom airline" showName size="sm" />);
    expect(screen.getByRole('img', { name: 'DEMO custom airline' })).toHaveTextContent('—');
    expect(screen.getByText('DEMO custom airline')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
  it('Rejects external, encoded, traversal and unapproved sources before they can become a request', () => {
    const fixture = approvedFixture();
    expect(registry.approvedLogoPath(fixture)).toBe('/assets/airlines/test-only.svg');
    for (const path of [
      'https://example.test/logo.svg',
      '//example.test/logo.svg',
      'data:image/svg+xml,test',
      '/assets/airlines/../secret.svg',
      '/assets/airlines/%2fexternal.svg',
      '/assets/airlines/logo.svg?redirect=https://example.test',
    ])
      expect(
        registry.approvedLogoPath({ ...fixture, logo: { ...fixture.logo, localPath: path } }),
      ).toBeNull();
    expect(
      registry.approvedLogoPath({
        ...fixture,
        logo: { ...fixture.logo, permission: 'not-established' },
      }),
    ).toBeNull();
    expect(
      registry.approvedLogoPath({
        ...fixture,
        logo: { ...fixture.logo, verificationStatus: 'permission-unverified' },
      }),
    ).toBeNull();
    expect(
      registry.approvedLogoPath({
        ...fixture,
        logo: { ...fixture.logo, permissionEvidenceUrl: null },
      }),
    ).toBeNull();
  });
  it('An approved local asset uses the supplied pixels and fails gracefully without a broken image', () => {
    // Mocked metadata tests a future-approved branch; no test brand image is shipped.
    vi.spyOn(registry, 'findAirline').mockReturnValue(approvedFixture());
    const { container, rerender } = render(<AirlineLogo airline="Cathay Pacific" size="lg" />);
    const image = container.querySelector('img')!;
    expect(image).toHaveAttribute('src', '/assets/airlines/test-only.svg');
    expect(image).toHaveAttribute('alt', '');
    fireEvent.error(image);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Cathay Pacific (CX)' })).toHaveTextContent('CX');
    rerender(<AirlineLogo airline="Cathay Pacific" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
