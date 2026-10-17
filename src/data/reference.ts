import { airlineRegistry } from './airlines';
export const airlines = airlineRegistry.map((entry) => entry.name);
// Historical v0.1.3 fingerprint only; fresh samples use the complete catalogue.
export const legacyDemoCatalogue = [
  'Cathay Pacific',
  'HK Express',
  'Air Hong Kong',
  'Jeju Air',
  'STARLUX Airlines',
  'Korean Air',
  'Qatar Airways',
  'Lufthansa',
];
export const variants = [
  { name: 'A350-1000', family: 'A350', icao: 'A35K' },
  { name: 'A350-900', family: 'A350', icao: 'A359' },
  { name: 'A330-300', family: 'A330', icao: 'A333' },
  { name: 'A321neo', family: 'A320', icao: 'A21N' },
  { name: 'A320-200', family: 'A320', icao: 'A320' },
  { name: 'B777-300ER', family: 'B777', icao: 'B77W' },
  { name: 'B787-9', family: 'B787', icao: 'B789' },
  { name: 'A380-800', family: 'A380', icao: 'A388' },
  { name: 'B737-800', family: 'B737', icao: 'B738' },
  { name: 'A330-300F', family: 'A330', icao: 'A333' },
];
export const demoBays = ['S25', 'S25R', 'W121L', 'W123R', 'D301', 'L421'];
