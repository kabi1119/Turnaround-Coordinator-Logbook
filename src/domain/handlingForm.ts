import type { Aircraft, Privacy } from './model';
import { hkToday } from './model';
import { hasArrival, hasDeparture } from './selectors';
import { findAirline } from '../data/airlines';
import { aircraftCatalogue, aircraftModel, validAircraftIdentity } from '../data/aircraftCatalogue';
import { validDutyDate } from './dutyCalendar';

const portion = /^[0-9]{1,4}[A-Z]?$/;
const full = /^[A-Z0-9]{2}[0-9]{1,4}[A-Z]?$/;
export const flightPrefix = (airline: string) => findAirline(airline)?.iata || '';
/** Unrecognized text is retained verbatim, not guessed, truncated or re-prefixed. */
export function flightInput(airline: string, value: string) {
  const prefix = flightPrefix(airline),
    normalized = value.trim().toUpperCase();
  if (!prefix) return { input: value, valid: full.test(normalized), value };
  const input = normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
  const valid = portion.test(input);
  return { input: valid ? input : value, valid, value: valid ? prefix + input : value };
}
export function flightEntry(airline: string, input: string) {
  if (!input.trim()) return '';
  return flightInput(airline, input).value;
}
export function changeFlightAirline(oldAirline: string, nextAirline: string, value: string) {
  if (!value || !flightPrefix(nextAirline)) return value;
  if (!flightPrefix(oldAirline))
    return portion.test(value.trim().toUpperCase())
      ? flightPrefix(nextAirline) + value.trim().toUpperCase()
      : value;
  const parsed = flightInput(oldAirline, value);
  return parsed.valid ? flightPrefix(nextAirline) + parsed.input : value;
}
export type HandlingField =
  'date' | 'airline' | 'handling' | 'aircraftType' | 'variant' | 'role' | 'arrival' | 'departure';
export type HandlingIssue = { field: HandlingField; reason: 'required' | 'invalid' | 'future' };
export function confirmedHandlingIssues(
  a: Aircraft,
  p: Privacy,
  today = hkToday(new Date(Date.now())),
): HandlingIssue[] {
  const issues: HandlingIssue[] = [];
  const add = (field: HandlingField, reason: HandlingIssue['reason'] = 'required') =>
    issues.push({ field, reason });
  if (!a.date) add('date');
  else if (!validDutyDate(a.date)) add('date', 'invalid');
  else if (a.date > today) add('date', 'future');
  if (!a.airline.trim()) add('airline');
  if (!a.handling) add('handling');
  if (
    !(a.aircraftType === undefined && a.variant) &&
    !aircraftCatalogue.some((type) => type.model === aircraftModel(a))
  )
    add('aircraftType', aircraftModel(a) ? 'invalid' : 'required');
  if (!a.variant) add('variant');
  else if (!validAircraftIdentity(a)) add('variant', 'invalid');
  if (!a.role) add('role');
  for (const key of ['arrival', 'departure'] as const) {
    if (p.flights && (key === 'arrival' ? hasArrival(a) : hasDeparture(a))) {
      if (!a[key].flight.trim()) add(key);
      else if (!flightInput(a.airline, a[key].flight).valid) add(key, 'invalid');
    }
  }
  return issues;
}
export function handlingDisplayStatus(a: Aircraft, today = hkToday(new Date(Date.now()))) {
  return a.status === 'Draft' && validDutyDate(a.date) && a.date > today ? 'Pending' : a.status;
}
export function untitledDraft(a: Aircraft) {
  return a.status === 'Draft' && !a.airline.trim() && !a.handling && !a.variant && !a.role;
}
