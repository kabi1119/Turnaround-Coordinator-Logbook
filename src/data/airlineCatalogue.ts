/** Owner-enabled display only. No redistribution permission is implied or changed. */
const identities: [string, string, string[]][] = [
  ['7C', 'Jeju Air', ['Jejuair']],
  ['9G', 'Sun PhuQuoc Airways', []],
  ['AK', 'AirAsia Malaysia', ['AirAsia', 'AirAsia (Malaysia)', 'AirAsia Berhad']],
  ['BI', 'Royal Brunei Airlines', ['Royal Brunei']],
  ['CX', 'Cathay Pacific', []],
  ['D7', 'AirAsia X', []],
  ['DL', 'Delta Air Lines', ['Delta']],
  ['FJ', 'Fiji Airways', []],
  ['GK', 'Jetstar Japan', []],
  ['JL', 'Japan Airlines', ['JAL']],
  ['JX', 'STARLUX Airlines', ['Starlux']],
  ['KE', 'Korean Air', []],
  ['LD', 'Air Hong Kong', ['AHK', 'AHK Air Hong Kong']],
  ['LH', 'Lufthansa', ['Lufthansa German Airlines']],
  ['LX', 'SWISS International Air Lines', ['SWISS', 'Swiss International Air Lines']],
  ['MS', 'Egyptair', ['Egypt Air']],
  ['PG', 'Bangkok Airways', []],
  ['PX', 'Air Niugini', []],
  ['QR', 'Qatar Airways', []],
  ['QZ', 'Indonesia AirAsia', ['AirAsia Indonesia']],
  ['RJ', 'Royal Jordanian', []],
  ['S7', 'S7 Airlines', []],
  ['UO', 'HK Express', ['Hong Kong Express']],
  ['Z2', 'Philippines AirAsia', ['AirAsia Philippines']],
];
export const airlineCatalogue = identities.map(([iata, name, aliases]) => ({
  iata,
  name,
  aliases,
  filename: `${iata}.png`,
  displayEnabled: true,
  redistributionPermission: 'unverified' as const,
}));
// Build-time local inventory; no runtime requests or duplicated imported PNG copies.
const presentAssets = new Set(__LOCAL_AIRLINE_FILES__);
export function findCatalogueAirline(value: string) {
  const query = value.trim().toLowerCase();
  return airlineCatalogue.find((a) =>
    [a.iata, a.name, ...a.aliases].some((v) => v.toLowerCase() === query),
  );
}
export function displayLogoPath(identity?: { iata: string; name: string }): string | null {
  if (!identity) return null;
  const asset = airlineCatalogue.find((a) => a.iata === identity.iata);
  if (
    !asset?.displayEnabled ||
    findCatalogueAirline(identity.name)?.iata !== identity.iata ||
    asset.filename !== `${identity.iata}.png` ||
    !presentAssets.has(asset.filename)
  )
    return null;
  return `/assets/airlines/${asset.filename}`;
}

export function searchAirlines(query: string) {
  const q = query.trim().toLowerCase();
  return airlineCatalogue.filter((a) =>
    [a.iata, a.name, ...a.aliases].some((value) => value.toLowerCase().includes(q)),
  );
}
