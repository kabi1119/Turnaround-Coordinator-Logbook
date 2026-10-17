import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HongKongClock from '../src/components/HongKongClock';
import { formatHKClock } from '../src/domain/time';
import { LanguageContext } from '../src/i18n';

afterEach(() => {
  vi.useRealTimers();
});
describe('Hong Kong live clock', () => {
  it('Formats Hong Kong date/time independently from default local time and includes seconds', () => {
    const now = new Date('2026-11-05T16:00:01Z');
    expect(formatHKClock(now, 'en-HK')).toEqual({
      date: expect.stringContaining('6 Nov 2026'),
      time: '00:00:01',
    });
    expect(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(now),
    ).not.toBe(formatHKClock(now, 'en-HK').time);
  });
  it('Updates across midnight, resumes from actual system time and cleans up timers/listeners', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T15:59:59Z'));
    const clear = vi.spyOn(window, 'clearInterval');
    const removed = vi.spyOn(document, 'removeEventListener');
    const view = render(<HongKongClock />);
    expect(screen.getByLabelText('Hong Kong clock')).toHaveTextContent('23:59:59');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByLabelText('Hong Kong clock')).toHaveTextContent('00:00:00');
    expect(screen.getByLabelText('Hong Kong clock')).toHaveTextContent('6 Nov 2026');
    act(() => {
      vi.setSystemTime(new Date('2026-11-07T03:04:05Z'));
      fireEvent.focus(window);
    });
    expect(screen.getByLabelText('Hong Kong clock')).toHaveTextContent('11:04:05');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => {
      vi.setSystemTime(new Date('2026-11-07T08:09:10Z'));
      fireEvent(document, new Event('visibilitychange'));
    });
    expect(screen.getByLabelText('Hong Kong clock')).toHaveTextContent('16:09:10');
    view.unmount();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });
  it('Provides bilingual device-clock accuracy disclosure without announcing every second', () => {
    const { container } = render(
      <LanguageContext.Provider value="zh-HK">
        <HongKongClock />
      </LanguageContext.Provider>,
    );
    expect(screen.getByLabelText('香港時鐘')).toHaveAttribute(
      'title',
      expect.stringContaining('準確度取決於裝置時鐘'),
    );
    expect(screen.getByText('裝置時鐘')).toBeInTheDocument();
    expect(container.querySelector('[aria-live]')).toBeNull();
  });
});
