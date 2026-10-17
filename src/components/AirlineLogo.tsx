import { useState } from 'react';
import type { CSSProperties } from 'react';
import { logoBounds } from '../data/logoBounds';
import { findAirline } from '../data/airlines';
import { displayLogoPath, findLocalAirline } from '../data/localAirlineLogos';
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
  const entry = findAirline(airline) || findLocalAirline(airline),
    src = displayLogoPath(entry);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const t = useT();
  const name = entry?.name || airline || t('Airline not selected', '未選航空公司');
  const code = entry?.iata || '—';
  const label = `${name}${entry ? ` (${code})` : ''}`;
  const image = Boolean(src && failedSource !== src);
  const bounds = image ? logoBounds(entry?.iata) : undefined;
  const boundsStyle = bounds
    ? ({
        '--source-w': bounds[0],
        '--source-h': bounds[1],
        '--bounds-x': bounds[2],
        '--bounds-y': bounds[3],
        '--bounds-w': bounds[4],
        '--bounds-h': bounds[5],
      } as CSSProperties)
    : undefined;
  return (
    <span className={`airline-identity airline-size-${size}`}>
      <span
        className={`airline-logo ${image ? 'has-image' : 'code-fallback'} ${bounds ? 'has-bounds' : ''}`}
        style={boundsStyle}
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
