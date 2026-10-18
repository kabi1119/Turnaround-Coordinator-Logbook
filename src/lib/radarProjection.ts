/** Spherical Mercator, one uniform scale for both axes. Decorative, not navigation. */
export const RADAR_SIZE = 600;
export const HKG = { longitude: 113.918, latitude: 22.308 } as const;
const radians = Math.PI / 180;
const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + (latitude * radians) / 2));
const west = 75;
const east = 150;
const south = -5;
const span = (east - west) * radians;
const top = mercatorY(south) + span;
// A square, undistorted Mercator canvas needs additional northern coverage.
// Keep the southern edge at 5 S rather than exposing the whole Indonesian archipelago.
export const RADAR_BOUNDS = {
  west,
  east,
  south,
  north: (2 * Math.atan(Math.exp(top)) - Math.PI / 2) / radians,
} as const;
export function projectRadar(longitude: number, latitude: number): [number, number] {
  return [
    (((longitude - west) * radians) / span) * RADAR_SIZE,
    ((top - mercatorY(latitude)) / span) * RADAR_SIZE,
  ];
}
export const HKG_POINT = projectRadar(HKG.longitude, HKG.latitude);
export const RADAR_RADIUS =
  Math.min(HKG_POINT[0], HKG_POINT[1], RADAR_SIZE - HKG_POINT[0], RADAR_SIZE - HKG_POINT[1]) - 12;
