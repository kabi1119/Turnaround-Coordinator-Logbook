/** Branding/reference metadata only. Never describes a user's actual handling history. */
export interface AirlineReference {
  name: string;
  iata: string;
  icao: string | null;
  aliases: string[];
  requestedInclusion: boolean;
  identitySourceUrl: string;
  verifiedOn: string;
  logo: {
    localPath: string | null;
    sourceUrl: string;
    verificationStatus: 'permission-unverified' | 'approved';
    permission: 'not-established' | 'approved-for-bundling';
    permissionEvidenceUrl: string | null;
    notes: string;
  };
  handling: {
    status: 'unverified';
    sourceUrl: string;
    notes: string;
  };
}
const directory = 'https://www.hongkongairport.com/en/flights/airlines-information/airlines.page';
const passengerAgents =
  'https://www.hongkongairport.com/tc/flights/airlines-information/ground-handling-agents.page';
const verifiedOn = '2026-10-17';
function reference(
  name: string,
  iata: string,
  officialUrl: string,
  aliases: string[] = [],
  notes = 'No permission for bundling in this app established from the reviewed official sources.',
): AirlineReference {
  return {
    name,
    iata,
    icao: null,
    aliases,
    requestedInclusion: iata === 'CX' || iata === 'LD',
    identitySourceUrl: directory,
    verifiedOn,
    logo: {
      localPath: null,
      sourceUrl: officialUrl,
      verificationStatus: 'permission-unverified',
      permission: 'not-established',
      permissionEvidenceUrl: null,
      notes,
    },
    handling: {
      status: 'unverified',
      sourceUrl: passengerAgents,
      notes:
        'Public passenger-handling reference only. Does not establish ramp/TCO affiliation or a definitive HAS customer list; requires separate confirmation.',
    },
  };
}
// Retain the existing reference airlines. This is deliberately not an exhaustive HKIA/HAS list.
export const airlineRegistry: AirlineReference[] = [
  reference('Cathay Pacific', 'CX', 'https://www.cathaypacific.com/'),
  reference('HK Express', 'UO', 'https://www.hkexpress.com/'),
  reference(
    'Hong Kong Airlines',
    'HX',
    'https://www.hongkongairlines.com/',
    [],
    'Official homepage returned no readable terms in the research tool; no reuse permission established. HKIA confirms name/code only.',
  ),
  reference(
    'Singapore Airlines',
    'SQ',
    'https://www.singaporeair.com/',
    [],
    'Official SIA SilverKris conditions reserve marks; no permission for this app established.',
  ),
  reference('All Nippon Airways', 'NH', 'https://www.ana.co.jp/en/jp/', ['ANA']),
  reference(
    'Emirates',
    'EK',
    'https://www.emirates.com/',
    [],
    'Official website terms reserve logo/IP rights and do not establish app redistribution permission.',
  ),
  reference('Qatar Airways', 'QR', 'https://www.qatarairways.com/'),
  reference('Lufthansa German Airlines', 'LH', 'https://www.lufthansa.com/', ['Lufthansa']),
  {
    ...reference(
      'Air Hong Kong',
      'LD',
      'https://www.airhongkong.com.hk/',
      ['AHK', 'AHK Air Hong Kong'],
      'Official homepage identifies AHK and reserves copyright; no reusable app-logo licence found.',
    ),
    icao: 'AHK',
    identitySourceUrl: 'https://www.iata.org/en/about/members/airline-list/air-hong-kong/607/',
  },
];
export function findAirline(value: string): AirlineReference | undefined {
  const query = value.trim().toLocaleLowerCase('en');
  return airlineRegistry.find((a) =>
    [a.name, a.iata, ...a.aliases].some((n) => n.toLocaleLowerCase('en') === query),
  );
}
/** Both identity/permission approval and a constrained same-origin filename are required. */
export function approvedLogoPath(entry?: AirlineReference): string | null {
  const logo = entry?.logo;
  if (
    !logo ||
    logo.verificationStatus !== 'approved' ||
    logo.permission !== 'approved-for-bundling' ||
    !logo.permissionEvidenceUrl ||
    !logo.notes.trim() ||
    !entry?.verifiedOn
  )
    return null;
  return logo.localPath &&
    /^\/assets\/airlines\/[a-z0-9][a-z0-9-]*\.(?:svg|png|webp)$/.test(logo.localPath)
    ? logo.localPath
    : null;
}
