// Explicit maintenance command only. Normal builds use the committed regional geometry offline.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { format } from 'prettier';
import { projectRadar, RADAR_SIZE, RADAR_BOUNDS } from '../src/lib/radarProjection.ts';

const commit = 'ca96624a56bd078437bca8184e78163e5039ad19';
const hashes = {
  land: 'e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b',
  coastline: '271f1c4c1908312bac6b29d158ea1356544beafc129f260005300913aa5ea283',
};
const tolerance = 0.65; // SVG units: under 0.5px even at the largest 440px UI size.
const sources = {};
async function source(name) {
  const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${commit}/geojson/ne_50m_${name}.geojson`;
  let bytes;
  try {
    bytes = readFileSync(`.checkpoints/ne_50m_${name}.geojson`);
  } catch {
    const response = await globalThis.fetch(url);
    if (!response.ok) throw Error(`Source download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (createHash('sha256').update(bytes).digest('hex') !== hashes[name])
    throw Error(`Source checksum mismatch: ${name}`);
  sources[name] = { url, sha256: hashes[name] };
  return JSON.parse(bytes.toString('utf8'));
}
const inside = ([x, y], side) => [x >= 0, x <= RADAR_SIZE, y >= 0, y <= RADAR_SIZE][side];
function intersection(a, b, side) {
  const axis = side < 2 ? 0 : 1,
    value = side % 2 ? RADAR_SIZE : 0;
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function clipPolygon(points) {
  for (let side = 0; side < 4 && points.length; side++) {
    const output = [];
    let a = points.at(-1);
    for (const b of points) {
      if (inside(a, side) !== inside(b, side)) output.push(intersection(a, b, side));
      if (inside(b, side)) output.push(b);
      a = b;
    }
    points = output;
  }
  return points;
}
function clipSegment(a, b) {
  for (let side = 0; side < 4; side++) {
    const ai = inside(a, side),
      bi = inside(b, side);
    if (!ai && !bi) return null;
    if (ai !== bi) {
      const p = intersection(a, b, side);
      if (!ai) a = p;
      else b = p;
    }
  }
  return [a, b];
}
function simplify(points) {
  if (points.length < 3) return points;
  const a = points[0],
    b = points.at(-1),
    dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = dx * dx + dy * dy;
  let largest = tolerance * tolerance,
    index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i],
      t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
    const distance = (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
    if (distance > largest) {
      largest = distance;
      index = i;
    }
  }
  return index
    ? [...simplify(points.slice(0, index + 1)).slice(0, -1), ...simplify(points.slice(index))]
    : [a, b];
}
const project = (points) =>
  points
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(([x, y]) => projectRadar(x, Math.max(-85, Math.min(85, y))));
const path = (points) =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
let land = '',
  coastline = '',
  polygonCount = 0,
  lineCount = 0;
const data = await source('land');
for (const feature of data.features) {
  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  for (const polygon of polygons)
    for (const ring of polygon) {
      const clipped = simplify(clipPolygon(project(ring)));
      if (clipped.length >= 4) {
        land += path(clipped) + 'Z';
        polygonCount++;
      }
    }
}
const coast = await source('coastline');
for (const feature of coast.features) {
  const lines =
    feature.geometry.type === 'LineString'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  for (const line of lines) {
    const points = project(line);
    let current = [];
    const flush = () => {
      if (current.length > 1) {
        coastline += path(simplify(current));
        lineCount++;
      }
      current = [];
    };
    for (let i = 1; i < points.length; i++) {
      const segment = clipSegment(points[i - 1], points[i]);
      if (!segment) {
        flush();
        continue;
      }
      if (
        current.length &&
        Math.hypot(current.at(-1)[0] - segment[0][0], current.at(-1)[1] - segment[0][1]) > 0.001
      )
        flush();
      if (!current.length) current.push(segment[0]);
      current.push(segment[1]);
    }
    flush();
  }
}
const output = {
  source: 'Natural Earth 1:50m land and coastline',
  license: 'Public domain',
  commit,
  sources,
  projection: 'Spherical Mercator',
  bounds: RADAR_BOUNDS,
  size: RADAR_SIZE,
  tolerance,
  polygonCount,
  lineCount,
  land,
  coastline,
};
writeFileSync(
  'src/data/radar-geography.json',
  await format(JSON.stringify(output), {
    ...JSON.parse(readFileSync('.prettierrc.json', 'utf8')),
    parser: 'json',
  }),
);
globalThis.console.log(
  `Generated ${polygonCount} regional polygons / ${lineCount} coastline segments; ${Buffer.byteLength(JSON.stringify(output))} bytes. No source/world data is shipped.`,
);
