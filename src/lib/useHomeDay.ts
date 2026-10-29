import { useEffect, useState } from 'react';
import { hkToday } from '../domain/model';

/** Refresh on HK midnight and resume; throttled background timers never determine eligibility. */
export function useHomeDay() {
  const [today, setToday] = useState(() => hkToday());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = Date.now();
      const day = hkToday(new Date(now));
      setToday(day);
      timer = setTimeout(update, Date.parse(`${day}T00:00:00+08:00`) + 86400000 - now + 20);
    };
    update();
    window.addEventListener('focus', update);
    window.addEventListener('pageshow', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', update);
      window.removeEventListener('pageshow', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return today;
}
