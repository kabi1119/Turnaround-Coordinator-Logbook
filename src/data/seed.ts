import { emptyAircraft, handlingTypes, newLeg, restrictivePrivacy, roles } from '../domain/model';
import type { Database, Journal } from '../domain/model';
import { demoAirlines as airlines, variants } from './reference';
export function seedDatabase(): Database {
  const duties: Database['duties'] = [
    {
      id: 'd1',
      date: '2026-10-16',
      start: '06:00',
      end: '14:00',
      status: 'Confirmed',
      notes: 'DEMO · morning shift, entirely fictional',
    },
    {
      id: 'd2',
      date: '2026-10-16',
      start: '15:00',
      end: '23:00',
      status: 'Confirmed',
      notes: 'DEMO · second shift on same day',
    },
    {
      id: 'd3',
      date: '2026-10-15',
      start: '22:00',
      end: '06:00',
      status: 'Confirmed',
      notes: 'DEMO · crosses midnight; grouped on 15 October',
    },
    {
      id: 'd4',
      date: '2026-10-14',
      start: '',
      end: '',
      status: 'Draft',
      notes: 'DEMO · confirmed aircraft can belong to a draft duty',
    },
    {
      id: 'd5',
      date: '2026-09-22',
      start: '08:00',
      end: '16:00',
      status: 'Confirmed',
      notes: 'DEMO · fictional shift',
    },
    {
      id: 'd6',
      date: '2026-08-12',
      start: '09:00',
      end: '17:00',
      status: 'Confirmed',
      notes: 'DEMO · fictional shift',
    },
  ];
  const aircraft = Array.from({ length: 18 }, (_, i) => {
    const d = duties[i < 4 ? 0 : i < 6 ? 1 : i < 9 ? 2 : i < 11 ? 3 : i < 15 ? 4 : 5],
      v = variants[i % variants.length];
    return {
      ...emptyAircraft(d.date, d.id),
      id: `a${i + 1}`,
      airline: airlines[i % airlines.length],
      variant: v.name,
      family: v.family,
      icao: v.icao,
      handling: handlingTypes[i % 3],
      role: roles[Math.floor(i / 3) % 3],
      registration:
        i % 4 === 3 ? '' : `DEMO-${i % 5 === 0 ? '001' : String(i + 1).padStart(3, '0')}`,
      bay: ['S25R', 'W121L', 'DEMO-CUSTOM', ''][i % 4],
      arrival: {
        ...newLeg(),
        flight: i % 4 === 2 ? '' : `DEMO-ARR${100 + i}`,
        status: (['Delayed', 'Early', 'On Time', 'Cancelled', 'Other', 'Not Recorded'] as const)[
          i % 6
        ],
      },
      departure: {
        ...newLeg(),
        flight: i % 4 === 2 ? '' : `DEMO-DEP${200 + i}`,
        status: (['On Time', 'Not Recorded', 'Delayed', 'Early', 'Other', 'Cancelled'] as const)[
          i % 6
        ],
      },
      disruption:
        i === 0 ? ('Disrupted' as const) : i === 4 ? ('Normal' as const) : ('Unknown' as const),
      notes: 'DEMO · synthetic handling illustration. No actual operational data.',
      status: i === 17 ? ('Draft' as const) : ('Confirmed' as const),
      createdAt: `${d.date}T12:00:00+08:00`,
      updatedAt: `${d.date}T12:00:00+08:00`,
    };
  });
  aircraft[0].events = [
    {
      id: 'e1',
      category: 'Weather',
      involvement: 'Coordinated',
      impact: 'Moderate',
      resolution: 'Resolved',
      notes: 'DEMO · practised a fictional weather response.',
      journalId: 'j1',
    },
    {
      id: 'e2',
      category: 'Baggage/Loading',
      involvement: 'Assisted',
      impact: 'Minor',
      resolution: 'Handed Over',
      notes: 'DEMO · assisted a fictional handover.',
      journalId: 'j1',
    },
  ];
  aircraft[4].events = [
    {
      id: 'e3',
      category: 'Ground Handling',
      involvement: 'Observed',
      impact: 'Minor',
      resolution: 'Resolved',
      notes: 'DEMO · observation, not personal resolution.',
    },
  ];
  const base: Omit<Journal, 'id' | 'title' | 'date'> = {
    status: 'Confirmed',
    situation: 'DEMO · a fictional team exercise with changing priorities.',
    challenge: 'Keep a shared picture of the plan.',
    responsibility: 'Communicate my assigned part of the exercise.',
    actions: 'Summarised priorities and checked understanding.',
    result: 'The fictional team completed the exercise.',
    learning: 'A short, structured handover improves clarity.',
    tags: ['Communication', 'Stakeholder Coordination'],
    dutyId: '',
    aircraftIds: [],
    outcome: '',
    unit: '',
    contribution: 'Supporting contribution in a synthetic scenario',
    evidence: 'Synthetic exercise notes',
    verification: 'Self-reported · demo, not employer verified',
  };
  return {
    version: 1,
    duties,
    aircraft,
    journals: [
      {
        ...base,
        id: 'j1',
        date: '2026-10-16',
        title: 'A clearer handover under pressure',
        aircraftIds: ['a1', 'a2'],
      },
      {
        ...base,
        id: 'j2',
        date: '2026-10-15',
        title: 'Building a shared plan',
        dutyId: 'd3',
        tags: ['Organising', 'Time Management'],
      },
      {
        ...base,
        id: 'j3',
        date: '2026-09-20',
        title: 'Learning from a team workshop',
        tags: ['Continuous Improvement'],
        status: 'Draft',
      },
    ],
    settings: { language: 'en', privacy: { ...restrictivePrivacy } },
  };
}
