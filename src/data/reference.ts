import { airlineRegistry } from './airlines';
export const airlines = airlineRegistry.map((entry) => entry.name);
// Keep v0.1's synthetic fixture identities/order stable; registry updates never rewrite history.
export const demoAirlines = [
  'Cathay Pacific',
  'HK Express',
  'Hong Kong Airlines',
  'Singapore Airlines',
  'ANA',
  'Emirates',
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
];
export const demoBays = ['S25', 'S25R', 'W121L', 'W123R', 'D301', 'L421'];
