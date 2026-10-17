import { uuidV4 } from '../lib/uuid';

export const handlingTypes = ['Full Turnaround', 'Departure Only', 'Arrival Only'] as const;
export const roles = [
  'Primary Coordinator',
  'Supporting Coordinator',
  'Training / Observation',
] as const;
export const flightStatuses = [
  'Not Recorded',
  'Early',
  'On Time',
  'Delayed',
  'Cancelled',
  'Other',
] as const;
export const disruptionCategories = [
  'Weather',
  'ATC Restrictions',
  'Late Inbound',
  'Aircraft Technical',
  'Baggage/Loading',
  'Passenger/Boarding',
  'Ground Handling',
  'Other Operational',
] as const;
export const competencies = [
  'Problem-solving',
  'Decision-making',
  'Leadership',
  'Communication',
  'Organising',
  'Safety Awareness',
  'Stakeholder Coordination',
  'Time Management',
  'Customer Service',
  'Continuous Improvement',
] as const;
export type HandlingType = (typeof handlingTypes)[number];
export type Role = (typeof roles)[number];
export type FlightStatus = (typeof flightStatuses)[number];
export type RecordStatus = 'Draft' | 'Confirmed' | 'Trashed';
export type PrivacyKey =
  'registration' | 'flights' | 'bay' | 'gateTimes' | 'statuses' | 'disruptionNotes';
export type Privacy = Record<PrivacyKey, boolean>;
export interface Duty {
  /** Absent on v0.1.1 records: retain legacy Confirmed-duty semantics. */
  workState?: 'Planned' | 'Worked';
  shiftType?: 'Day' | 'Evening' | 'Night' | 'Custom';
  id: string;
  date: string;
  start: string;
  end: string;
  status: RecordStatus;
  notes: string;
  trashedAt?: string;
  previousStatus?: RecordStatus;
}
export interface Leg {
  flight: string;
  status: FlightStatus;
  origin: 'Self-reported' | 'Confirmed mock gate suggestion';
  scheduled: string;
  actual: string;
}
export interface Disruption {
  id: string;
  category: string;
  involvement: 'Observed' | 'Assisted' | 'Coordinated' | 'Escalated';
  /** Historical operational impact, separate from calculated delay severity. */
  impact?: 'Minor' | 'Moderate' | 'Major';
  /** Explicit user-entered disruption duration, not derived from flight delay. */
  delayMinutes?: number;
  resolution: 'Resolved' | 'Escalated' | 'Handed Over';
  notes: string;
  journalId?: string;
}
export interface Aircraft {
  id: string;
  date: string;
  dutyId: string;
  originalDutyId?: string;
  airline: string;
  variant: string;
  /** Optional for legacy snapshots; new structured selections persist the model. */
  aircraftType?: string;
  family: string;
  icao: string;
  handling: HandlingType | '';
  role: Role | '';
  registration: string;
  bay: string;
  arrival: Leg;
  departure: Leg;
  disruption: 'Unknown' | 'Normal' | 'Disrupted';
  events: Disruption[];
  notes: string;
  actualHandling: boolean;
  status: RecordStatus;
  previousStatus?: RecordStatus;
  trashedAt?: string;
  createdAt: string;
  updatedAt: string;
  revisions: { at: string; summary: string }[];
}
export interface Journal {
  id: string;
  date: string;
  title: string;
  status: 'Draft' | 'Confirmed';
  situation: string;
  challenge: string;
  responsibility: string;
  actions: string;
  result: string;
  learning: string;
  tags: string[];
  dutyId: string;
  originalDutyId?: string;
  aircraftIds: string[];
  outcome: string;
  unit: string;
  contribution: string;
  evidence: string;
  verification: string;
}
export interface Database {
  version: 1;
  duties: Duty[];
  aircraft: Aircraft[];
  journals: Journal[];
  settings: { language: 'en' | 'zh-HK'; privacy: Privacy };
}
export interface Filters {
  from?: string;
  to?: string;
  airline?: string;
  family?: string;
  variant?: string;
  role?: string;
  handling?: string;
  arrival?: string;
  departure?: string;
  disruption?: string;
  query?: string;
}
export const restrictivePrivacy: Privacy = {
  registration: false,
  flights: false,
  bay: false,
  gateTimes: false,
  statuses: false,
  disruptionNotes: false,
};
export const newLeg = (): Leg => ({
  flight: '',
  status: 'Not Recorded',
  origin: 'Self-reported',
  scheduled: '',
  actual: '',
});
export const hkToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
export const id = uuidV4;
export const emptyAircraft = (date = hkToday(), dutyId = ''): Aircraft => ({
  id: id(),
  date,
  dutyId,
  airline: '',
  variant: '',
  family: '',
  icao: '',
  handling: 'Full Turnaround',
  role: 'Primary Coordinator',
  registration: '',
  bay: '',
  arrival: newLeg(),
  departure: newLeg(),
  disruption: 'Unknown',
  events: [],
  notes: '',
  actualHandling: true,
  status: 'Draft',
  createdAt: '',
  updatedAt: '',
  revisions: [],
});
