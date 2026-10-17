import { useEffect, useState } from 'react';
import { formatHKClock } from '../domain/time';
import { useT } from '../i18n';

export default function HongKongClock() {
  const t = useT();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const resume = () => {
      if (document.visibilityState === 'visible') update();
    };
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', update);
    };
  }, []);
  const value = formatHKClock(now, t('en-HK', 'zh-HK'));
  return (
    <span
      className="hk-clock"
      aria-label={t('Hong Kong clock', '香港時鐘')}
      title={t(
        'Asia/Hong_Kong · Accuracy depends on your device clock; not synchronized to a time server.',
        'Asia/Hong_Kong · 準確度取決於裝置時鐘，沒有與標準時間伺服器同步。',
      )}
    >
      <span>{value.date}</span>
      <time dateTime={now.toISOString()}>
        {value.time} <small>HKT</small>
      </time>
      <small>{t('Device clock', '裝置時鐘')}</small>
    </span>
  );
}
