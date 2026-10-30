import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HomeAircraftCard from '../src/features/HomeAircraftCard';
import { AircraftCard } from '../src/components/ui';
import { defaultOptionalFields, emptyAircraft } from '../src/domain/model';
import { LanguageContext } from '../src/i18n';

describe('Home-only compact Aircraft summary', () => {
  it('omits default placeholders but keeps Draft/Unlinked, normal button navigation and original record bytes', () => {
    const a = { ...emptyAircraft('2026-10-30'), airline: 'Cathay Pacific', variant: 'A350-1000' };
    const raw = JSON.stringify(a),
      open = vi.fn();
    const view = render(<HomeAircraftCard a={a} privacy={defaultOptionalFields} onClick={open} />);
    expect(view.container).not.toHaveTextContent('Time not recorded');
    expect(view.container).not.toHaveTextContent('Not Recorded');
    expect(view.container).toHaveTextContent('Draft');
    expect(view.container).toHaveTextContent('Unlinked');
    fireEvent.click(screen.getByRole('button'));
    expect(open).toHaveBeenCalledOnce();
    expect(JSON.stringify(a)).toBe(raw);
    expect(view.container.querySelectorAll('button')).toHaveLength(1);
  });
  it.each(['en', 'zh-HK'] as const)(
    'preserves full flight identifiers, recorded times, non-default statuses and privacy in %s',
    (language) => {
      const a = {
        ...emptyAircraft('2026-10-30'),
        airline: 'Synthetic long airline name',
        variant: 'A350-1000',
        registration: 'B-SYNTH',
        bay: 'SYNTH-BAY',
      };
      a.arrival = {
        ...a.arrival,
        flight: 'CX0402A',
        status: 'Delayed',
        actual: '2026-10-30T12:00:00+08:00',
      };
      a.departure = { ...a.departure, flight: 'CX12345B', status: 'Cancelled' };
      const view = render(
        <LanguageContext.Provider value={language}>
          <HomeAircraftCard a={a} privacy={defaultOptionalFields} onClick={() => {}} />
        </LanguageContext.Provider>,
      );
      expect(view.container).toHaveTextContent('CX0402A / CX12345B');
      expect(view.container).toHaveTextContent('AIBT 12:00 HKT');
      expect(view.container).toHaveTextContent(language === 'en' ? 'ARR Delayed' : 'ARR 延誤');
      expect(view.container).toHaveTextContent(language === 'en' ? 'DEP Cancelled' : 'DEP 取消');
      expect(view.container).toHaveTextContent('SYNTH-BAY');
      view.rerender(
        <HomeAircraftCard
          a={a}
          privacy={{
            ...defaultOptionalFields,
            flights: false,
            statuses: false,
            gateTimes: false,
            registration: false,
            bay: false,
          }}
          onClick={() => {}}
        />,
      );
      expect(view.container.textContent).not.toMatch(
        /CX0402A|CX12345B|Delayed|Cancelled|12:00|B-SYNTH|SYNTH-BAY/,
      );
    },
  );
  it('does not suppress one recorded leg or show a status for an inapplicable leg', () => {
    const a = emptyAircraft('2026-10-30');
    a.arrival.status = 'Early';
    a.departure.status = 'Other';
    const view = render(
      <HomeAircraftCard a={a} privacy={defaultOptionalFields} onClick={() => {}} />,
    );
    expect(view.container).toHaveTextContent('ARR Early');
    expect(view.container).toHaveTextContent('DEP Other');
    view.rerender(
      <HomeAircraftCard
        a={{ ...a, handling: 'Arrival Only' }}
        privacy={defaultOptionalFields}
        onClick={() => {}}
      />,
    );
    expect(view.container).not.toHaveTextContent('DEP Other');
  });
  it('leaves the full Logbook card placeholders intact', () => {
    const view = render(
      <AircraftCard
        a={emptyAircraft('2026-10-30')}
        privacy={defaultOptionalFields}
        onClick={() => {}}
      />,
    );
    expect(view.container).toHaveTextContent('Time not recorded');
    expect(view.container).toHaveTextContent('ARR Not Recorded · DEP Not Recorded');
  });
});
