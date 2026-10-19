import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useT } from '../i18n';

/** Browser connectivity hint, never a server probe or a synchronization claim. */
export default function ConnectivityStatus() {
  const t = useT();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const resume = () => {
      if (document.visibilityState === 'visible') update();
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('pageshow', update);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('pageshow', update);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);
  const Icon = online ? Wifi : WifiOff;
  return (
    <span
      className="connectivity-status"
      data-state={online ? 'online' : 'offline'}
      role="status"
      aria-label={t('Connection status', '連線狀態')}
      title={t(
        'Browser connection status; internet access is not verified. Records stay on this device. Offline launch requires installed app assets.',
        '瀏覽器連線狀態，未驗證網際網路是否可用。紀錄留在此裝置；離線啟動須先完成安裝應用程式資產。',
      )}
    >
      <span className="connection-badge">
        <Icon size={17} aria-hidden="true" />
        {online ? t('Online', '已連線') : t('Offline', '離線')}
      </span>
      <span aria-hidden="true">·</span>
      <span className="connection-local">{t('Device only', '僅限此裝置')}</span>
    </span>
  );
}
