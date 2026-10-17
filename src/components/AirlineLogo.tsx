import { useState } from 'react';
import { approvedLogoPath, findAirline } from '../data/airlines';
import { useT } from '../i18n';

export default function AirlineLogo({
  airline,
  size = 'md',
  showName = false,
  decorative = false,
}: {
  airline: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  decorative?: boolean;
}) {
  const entry = findAirline(airline),
    src = approvedLogoPath(entry);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const t = useT();
  const name = entry?.name || airline || t('Airline not selected', '未選航空公司');
  const code = entry?.iata || '—';
  const label = `${name}${entry ? ` (${code})` : ''}`;
  const image = Boolean(src && failedSource !== src);
  return (
    <span className={`airline-identity airline-size-${size}`}>
      <span
        className={`airline-logo ${image ? 'has-image' : 'code-fallback'}`}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative || undefined}
        title={label}
      >
        {image ? (
          <img
            src={src!}
            alt=""
            width="72"
            height="40"
            decoding="async"
            onError={() => setFailedSource(src)}
          />
        ) : (
          <span>{code}</span>
        )}
      </span>
      {showName && <span className="airline-name">{name}</span>}
    </span>
  );
}
