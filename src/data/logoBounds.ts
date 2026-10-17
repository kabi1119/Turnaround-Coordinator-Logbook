/** Historical v0.1.3 fixture, not used for runtime rendering; replacements can make it stale.
 * Runtime measurements now come from lib/normalizeLogo.ts. Original PNGs are unchanged.
 * Read-only measured artwork bounds, padded by 6 source pixels.
 * Near-white/neutral checkerboard background is excluded from measurement, not edited. */
const measured: Record<string, [number, number, number, number, number, number]> = {
  '7C': [600, 600, 24, 244, 552, 111],
  '9G': [1509, 1200, 0, 0, 1509, 1200],
  AK: [600, 600, 24, 138, 552, 324],
  BI: [600, 600, 24, 180, 552, 239],
  CX: [600, 600, 24, 188, 552, 224],
  D7: [600, 600, 24, 33, 552, 534],
  DL: [600, 600, 24, 252, 552, 95],
  FJ: [600, 600, 24, 176, 552, 248],
  GK: [600, 600, 24, 229, 552, 142],
  JL: [600, 600, 24, 119, 552, 362],
  JX: [600, 600, 24, 243, 552, 114],
  KE: [1080, 1080, 49, 433, 982, 214],
  LD: [600, 600, 24, 225, 552, 150],
  LH: [600, 600, 0, 0, 600, 600],
  LX: [600, 600, 24, 232, 552, 135],
  MS: [600, 600, 24, 152, 552, 296],
  PG: [600, 600, 24, 65, 546, 465],
  PX: [600, 600, 24, 30, 552, 540],
  QR: [600, 600, 24, 39, 552, 521],
  QZ: [600, 600, 24, 138, 552, 324],
  RJ: [600, 600, 24, 231, 552, 137],
  S7: [600, 600, 24, 207, 552, 185],
  UO: [500, 500, 59, 109, 382, 282],
  Z2: [600, 600, 24, 138, 552, 324],
};
export const logoBounds = (iata?: string) => (iata ? measured[iata] : undefined);
