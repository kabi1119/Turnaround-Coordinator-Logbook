import type { Aircraft } from '../domain/model';

/** Curated passenger/freighter subset, not an exhaustive fleet or certification list.
 * Sources and naming/legacy limits: docs/AIRCRAFT_CATALOGUE.md.
 * No unverified ICAO designators are inferred for newly added variants.
 */
export const aircraftCatalogue = [
  { model: 'A220', family: 'A220', variants: ['A220-100', 'A220-300'] },
  { model: 'A318', family: 'A320', variants: ['A318-100'] },
  { model: 'A319', family: 'A320', variants: ['A319-100', 'A319neo'] },
  { model: 'A320', family: 'A320', variants: ['A320-200', 'A320neo', 'A320P2F'] },
  {
    model: 'A321',
    family: 'A320',
    variants: ['A321-100', 'A321-200', 'A321neo', 'A321LR', 'A321XLR', 'A321P2F'],
  },
  {
    model: 'A330',
    family: 'A330',
    variants: [
      'A330-200',
      'A330-300',
      'A330-800',
      'A330-900',
      'A330-200F',
      'A330-200P2F',
      'A330-300P2F',
    ],
  },
  { model: 'A340', family: 'A340', variants: ['A340-200', 'A340-300', 'A340-500', 'A340-600'] },
  { model: 'A350', family: 'A350', variants: ['A350-900', 'A350-1000'] },
  { model: 'A380', family: 'A380', variants: ['A380-800'] },
  {
    model: 'B737',
    family: 'B737',
    variants: [
      'B737-300',
      'B737-400',
      'B737-500',
      'B737-600',
      'B737-700',
      'B737-800',
      'B737-900',
      'B737-900ER',
      'B737 MAX 8',
      'B737 MAX 9',
    ],
  },
  {
    model: 'B747',
    family: 'B747',
    variants: ['B747-400', 'B747-400ER', 'B747-400F', 'B747-8', 'B747-8F'],
  },
  { model: 'B757', family: 'B757', variants: ['B757-200', 'B757-300', 'B757-200PF'] },
  {
    model: 'B767',
    family: 'B767',
    variants: ['B767-200', 'B767-200ER', 'B767-300', 'B767-300ER', 'B767-400ER', 'B767-300F'],
  },
  {
    model: 'B777',
    family: 'B777',
    variants: ['B777-200', 'B777-200ER', 'B777-200LR', 'B777-300', 'B777-300ER', 'B777F'],
  },
  { model: 'B787', family: 'B787', variants: ['B787-8', 'B787-9', 'B787-10'] },
] as const;

export function aircraftModel(a: Pick<Aircraft, 'aircraftType' | 'variant'>): string {
  if (a.aircraftType) return a.aircraftType;
  return aircraftCatalogue.find((t) => a.variant.startsWith(t.model))?.model || '';
}
export function validAircraftIdentity(a: Pick<Aircraft, 'aircraftType' | 'variant'>) {
  // Absence means an untouched legacy/custom snapshot, never silently normalized.
  if (a.aircraftType === undefined) return true;
  return aircraftCatalogue.some(
    (t) => t.model === a.aircraftType && (t.variants as readonly string[]).includes(a.variant),
  );
}
export const knownIcao: Record<string, string> = {
  'A350-1000': 'A35K',
  'A350-900': 'A359',
  'A330-300': 'A333',
  A321neo: 'A21N',
  'A320-200': 'A320',
  'B777-300ER': 'B77W',
  'B787-9': 'B789',
  'A380-800': 'A388',
  'B737-800': 'B738',
};
