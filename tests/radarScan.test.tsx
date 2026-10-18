import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import Radar from '../src/components/Radar';

describe('v0.4.6 scan containment and center marker', () => {
  it('separates the scan from the range-ring disc and retains a single shared animation', () => {
    const view = render(<Radar />);
    const viewport = view.container.querySelector('.radar-scan-viewport')!;
    const disc = view.container.querySelector('.radar-disc')!;
    const sweep = viewport.querySelector('.radar-sweep');
    expect(sweep).not.toBeNull();
    expect(view.container.querySelectorAll('.radar-sweep')).toHaveLength(1);
    expect(disc.contains(sweep)).toBe(false);
    expect(viewport.querySelector('.radar-trail')).not.toBeNull();
    expect(viewport.querySelector('.radar-beam')).not.toBeNull();
    expect(disc.querySelector('.hero-plane')).not.toBeNull();
    expect(disc.querySelector('.radar-airport-label')).toHaveTextContent('HKG / VHHH');
    expect(view.container.querySelector('.radar-caption')).toBeNull();
    expect(view.container.textContent).not.toContain('TCO Logbook / ASIA');
    view.rerender(<Radar active={false} />);
    expect(view.container.querySelector('.radar-sweep')).toBe(sweep);
    expect(view.container.firstChild).toHaveAttribute('data-active', 'false');
  });
  it('provides rounded square clipping and corner reach without changing the ring geometry', () => {
    const css = readFileSync('src/styles/v0_4_6.css', 'utf8');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('border-radius: inherit');
    expect(css).toContain('contain: paint');
    expect(css).toContain('mask-image: radial-gradient');
    const inset = Number(
      css.match(/\.radar-scan-viewport \.radar-sweep\s*\{\s*inset:\s*(-?[\d.]+)%/)![1],
    );
    const radius = (1 - inset / 50) / 2;
    expect(radius).toBeGreaterThan(Math.SQRT1_2);
    expect(css).not.toMatch(/\.radar-ring|\.ring-three|animation:/);
  });
  it('sets the marker to 55% of its former rendered width and keeps a clear label gap', () => {
    const css = readFileSync('src/styles/v0_4_6.css', 'utf8');
    const width = Number(css.match(/width:\s*([\d.]+)px/)![1]);
    expect(width / 46).toBeCloseTo(0.55);
    expect(css).toContain(`height: ${width}px`);
    const top = Number(css.match(/top: calc\(50% \+ ([\d.]+)px\)/)![1]);
    expect(top).toBeGreaterThan((width * Math.SQRT2) / 2);
  });
});
