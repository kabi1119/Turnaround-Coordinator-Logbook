import { useState } from 'react';
import type { CSSProperties } from 'react';
import { measureLogo, logoFitting } from '../lib/normalizeLogo';
import type { LogoBounds } from '../lib/normalizeLogo';
import { airlineLogoRendering } from '../data/airlineLogoRendering';
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
  const [measured, setMeasured] = useState<{ src: string; bounds: LogoBounds } | null>(null);
  const t = useT();
  const name = entry?.name || airline || t('Airline not selected', '未選航空公司');
  const code = entry?.iata || '—';
  const label = `${name}${entry ? ` (${code})` : ''}`;
  const image = Boolean(src && failedSource !== src);
  const bounds = image && measured?.src === src ? measured.bounds : undefined;
  const overrides = airlineLogoRendering[code];
  const fitting = bounds ? logoFitting(bounds, overrides) : undefined;
  const boundsStyle = bounds
    ? ({
        '--visible-ratio': bounds.width / bounds.height,
        '--fill-width': fitting!.fillWidth,
        '--fill-height': fitting!.fillHeight,
        '--image-width': `${(bounds.sourceWidth / bounds.width) * 100}%`,
        '--image-height': `${(bounds.sourceHeight / bounds.height) * 100}%`,
        '--image-left': `${(-bounds.x / bounds.width) * 100}%`,
        '--image-top': `${(-bounds.y / bounds.height) * 100}%`,
      } as CSSProperties)
    : undefined;
  return (
    <span className={`airline-identity airline-size-${size}`}>
      <span
        className={`airline-logo ${image ? 'has-image' : 'code-fallback'} ${bounds ? 'is-normalized' : ''}`}
        style={boundsStyle}
        data-logo-fit={fitting?.fit}
        data-logo-measurement={bounds?.method}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative || undefined}
        title={label}
      >
        {image ? (
          <span className="airline-logo-normalized">
            <img
              src={src!}
              alt=""
              width="72"
              height="40"
              decoding="async"
              onLoad={(e) => {
                const next = measureLogo(e.currentTarget, overrides?.trimLightBackground !== false);
                if (next && src)
                  setMeasured((previous) =>
                    previous?.src === src && previous.bounds === next
                      ? previous
                      : { src, bounds: next },
                  );
              }}
              onError={() => setFailedSource(src)}
            />
          </span>
        ) : (
          <span>{code}</span>
        )}
      </span>
      {showName && <span className="airline-name">{name}</span>}
    </span>
  );
}
