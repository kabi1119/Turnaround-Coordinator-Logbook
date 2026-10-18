import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import Radar from '../src/components/Radar';
import geography from '../src/data/radar-geography.json';
import {
  HKG,
  HKG_POINT,
  projectRadar,
  RADAR_BOUNDS,
  RADAR_RADIUS,
  RADAR_SIZE,
} from '../src/lib/radarProjection';

const polygons = geography.land
  .split('Z')
  .filter(Boolean)
  .map((path) =>
    [...path.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map((match) => [
      Number(match[1]),
      Number(match[2]),
    ]),
  );
function isLand(longitude: number, latitude: number) {
  const [x, y] = projectRadar(longitude, latitude);
  return polygons.reduce((land, points) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i],
        [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return land !== inside;
  }, false);
}

describe('geographic radar', () => {
  it('projects all four square corners and HKG with a uniform Mercator scale', () => {
    const { west, east, north, south } = RADAR_BOUNDS;
    expect(projectRadar(west, north)[0]).toBeCloseTo(0);
    expect(projectRadar(west, north)[1]).toBeCloseTo(0);
    expect(projectRadar(east, south)[0]).toBeCloseTo(RADAR_SIZE);
    expect(projectRadar(east, south)[1]).toBeCloseTo(RADAR_SIZE);
    expect(HKG_POINT).toEqual(projectRadar(HKG.longitude, HKG.latitude));
    expect(HKG_POINT[0] / RADAR_SIZE).toBeCloseTo(0.5);
    expect(HKG_POINT[1] / RADAR_SIZE).toBeCloseTo(0.5);
    const horizontal = projectRadar(114.001, HKG.latitude)[0] - projectRadar(114, HKG.latitude)[0];
    const vertical =
      projectRadar(114, HKG.latitude)[1] -
      projectRadar(114, HKG.latitude + 0.001 * Math.cos((HKG.latitude * Math.PI) / 180))[1];
    expect(horizontal).toBeCloseTo(vertical, 5);
  });
  it('keeps Japan, India and equatorial islands inside the frame without moving HKG', () => {
    for (const [lon, lat] of [
      [85, 23],
      [145.8, 45.5],
      [104, 1.3],
      [117, -3],
      [99, 3],
      [110.4, -7.3],
      [115.2, -8.4],
      [124, -9.5],
    ]) {
      for (const value of projectRadar(lon, lat)) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(RADAR_SIZE);
      }
    }
    for (const coordinate of HKG_POINT) {
      expect(coordinate - RADAR_RADIUS).toBeGreaterThan(0);
      expect(coordinate + RADAR_RADIUS).toBeLessThan(RADAR_SIZE);
    }
  });
  it('fills the square with a centered, comfortably inset ring and a south-shifted view', () => {
    const ringWidth = readFileSync('src/styles/radar.css', 'utf8').match(
      /\.ring-three\s*\{\s*width:\s*([\d.]+)%/,
    );
    expect(ringWidth).not.toBeNull();
    const outerRingRatio = (((RADAR_RADIUS * 2) / RADAR_SIZE) * Number(ringWidth![1])) / 100;
    expect(outerRingRatio).toBeGreaterThanOrEqual(0.88);
    expect(outerRingRatio).toBeLessThanOrEqual(0.94);
    expect(outerRingRatio).toBeCloseTo(0.9212);
    expect(RADAR_BOUNDS.north).toBeLessThan(51);
    expect(RADAR_BOUNDS.north).toBeGreaterThan(45.5);
    expect(RADAR_BOUNDS.south).toBeLessThan(-10);
    expect(RADAR_BOUNDS.south).toBeGreaterThan(-12);
  });
  it.each([
    ['China', 116, 39],
    ['India', 85, 23],
    ['Bangladesh', 90, 24],
    ['Myanmar', 96, 21],
    ['Thailand', 101, 16],
    ['Vietnam', 108, 16],
    ['Korea', 127, 37],
    ['Honshu', 138, 36],
    ['Hokkaido', 143, 43],
    ['Taiwan', 121, 23.7],
    ['Hainan', 109.7, 19.2],
    ['Luzon', 121, 16],
    ['Borneo', 114.5, 1],
    ['Sumatra', 99, 2],
    ['Malay Peninsula', 102, 4],
    ['Java', 110.4, -7.3],
    ['Bali', 115.2, -8.4],
    ['Timor', 124, -9.5],
  ])('retains recognizable land at %s', (_name, lon, lat) => {
    expect(isLand(Number(lon), Number(lat))).toBe(true);
  });
  it.each([
    [119, 24],
    [121, 20.5],
    [130, 32],
    [90, 15],
  ])('retains island/sea separation at %s,%s', (lon, lat) => {
    expect(isLand(lon, lat)).toBe(false);
  });
  it('ships only clipped, simplified local paths with source and license metadata', () => {
    expect(geography.bounds).toEqual(RADAR_BOUNDS);
    expect(geography.license).toBe('Public domain');
    expect(geography.source).toContain('1:50m');
    expect(geography.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(geography.polygonCount).toBe(polygons.length);
    expect(geography.land.length + geography.coastline.length).toBeLessThan(75000);
    for (const path of [geography.land, geography.coastline]) {
      expect(path).not.toMatch(/NaN|Infinity|https?:/);
      for (const match of path.matchAll(/[ML]([\d.-]+),([\d.-]+)/g))
        for (const n of [Number(match[1]), Number(match[2])]) {
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(RADAR_SIZE);
        }
    }
  });
  it('renders static paths, the actual anchor and an English aviation identifier without external images', () => {
    const view = render(<Radar />);
    expect(view.container.querySelector('.east-asia-map')).toHaveAttribute(
      'viewBox',
      '0 0 600 600',
    );
    expect(view.container.querySelector('.map-land')).toHaveAttribute('d', geography.land);
    expect(view.container.querySelector('.map-coastline')).toHaveAttribute(
      'd',
      geography.coastline,
    );
    expect(view.container.querySelector('.map-hkg')).toHaveAttribute('cx', String(HKG_POINT[0]));
    expect(view.container.querySelector('.map-hkg')).toHaveAttribute('cy', String(HKG_POINT[1]));
    expect(view.container.querySelector('.radar-airport-label')).toHaveTextContent('HKG / VHHH');
    expect(view.container.querySelectorAll('.radar-ring')).toHaveLength(3);
    expect(view.container.querySelector('image, img, iframe, canvas, [href]')).toBeNull();
    const path = view.container.querySelector('.map-coastline'),
      sweep = view.container.querySelector('.radar-sweep');
    view.rerender(<Radar active={false} />);
    expect(view.container.querySelector('.map-coastline')).toBe(path);
    expect(view.container.querySelector('.radar-sweep')).toBe(sweep);
  });
  it('retains square geometry, circular sweep, reduced-motion and pause rules', () => {
    const css = readFileSync('src/styles/v0_4_5.css', 'utf8');
    const base = readFileSync('src/styles/radar.css', 'utf8');
    expect(css).toContain('aspect-ratio: 1');
    expect(css).toContain('left: var(--radar-x)');
    expect(css).toContain('top: var(--radar-y)');
    expect(base).toContain('animation: radar-scan 6s linear infinite');
    expect(base).toContain('(prefers-reduced-motion: reduce)');
    expect(base).toContain("[data-document-hidden='true']");
    expect(base).toContain('(pointer: fine)');
  });
});
