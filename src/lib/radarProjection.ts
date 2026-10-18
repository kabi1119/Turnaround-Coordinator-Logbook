/** Spherical Mercator, one uniform scale for both axes. Decorative, not navigation. */
export const RADAR_SIZE = 600;
export const HKG = { longitude: 113.918, latitude: 22.308 } as const;
const radians = Math.PI / 180;
const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + (latitude * radians) / 2));
const longitudeSpan = 68;
const west = HKG.longitude - longitudeSpan / 2;
const east = HKG.longitude + longitudeSpan / 2;
const span = longitudeSpan * radians;
const top = mercatorY(HKG.latitude) + span / 2;
const inverseY = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / radians;
// Frame symmetrically around the actual HKG point, not a separately positioned icon.
// The narrower square includes Hokkaido and more Indonesia without excess far north.
export const RADAR_BOUNDS = {
  west,
  east,
  south: inverseY(top - span),
  north: inverseY(top),
} as const;
export function projectRadar(longitude: number, latitude: number): [number, number] {
  return [
    (((longitude - west) * radians) / span) * RADAR_SIZE,
    ((top - mercatorY(latitude)) / span) * RADAR_SIZE,
  ];
}
export const HKG_POINT = projectRadar(HKG.longitude, HKG.latitude);
// Disc = 94% of the canvas; existing 98%-wide outer ring = 92.12% of the canvas.
export const RADAR_RADIUS = RADAR_SIZE * 0.47;
