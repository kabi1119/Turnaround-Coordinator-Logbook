import { ChevronRight } from 'lucide-react';
import AirlineLogo from '../components/AirlineLogo';
import { Badge } from '../components/ui';
import type { Aircraft, Privacy } from '../domain/model';
import { cardText, hasArrival, hasDeparture } from '../domain/selectors';
import { aircraftTimes } from '../domain/time';
import { handlingDisplayStatus, untitledDraft } from '../domain/handlingForm';
import { useLabel, useT } from '../i18n';

/** Home-only summary; full Logbook cards and record details keep their existing presentation. */
export default function HomeAircraftCard({
  a,
  privacy,
  onClick,
}: {
  a: Aircraft;
  privacy: Privacy;
  onClick: () => void;
}) {
  const t = useT(),
    l = useLabel();
  const times = aircraftTimes(a, privacy);
  const statuses = privacy.statuses
    ? (
        [
          ['ARR', hasArrival(a), a.arrival.status],
          ['DEP', hasDeparture(a), a.departure.status],
        ] as const
      ).filter(([, applicable, status]) => applicable && status !== 'Not Recorded')
    : [];
  return (
    <button className="aircraft-card home-aircraft-card" onClick={onClick}>
      <AirlineLogo airline={a.airline} decorative />
      <span className="aircraft-content">
        <strong>
          {untitledDraft(a) ? t('Untitled Draft', '未命名草稿') : cardText(a, privacy).title}
        </strong>
        <span>
          {l(a.role) || t('Role not selected', '未選角色')} ·{' '}
          {a.variant || t('Type not selected', '未選機型')}
          {privacy.registration && a.registration ? ` (${a.registration})` : ''}
        </span>
        <span className="card-meta">
          {l(a.handling)} · {a.date || t('Undated', '未定日期')}
          {privacy.bay && a.bay ? ` · ${t('Bay', '停機位')} ${a.bay}` : ''}
        </span>
        {times.length > 0 && (
          <span className="aircraft-times">
            {times
              .map(
                (time) =>
                  `${time.scheduled ? t('Scheduled ', '表定 ') : ''}${time.label} ${time.value}`,
              )
              .join(' · ')}{' '}
            HKT
          </span>
        )}
      </span>
      <span className="home-aircraft-status">
        <span className="home-aircraft-badges">
          {statuses.map(([label, , status]) => (
            <span key={label}>
              {label} {l(status)}
            </span>
          ))}
          {a.status !== 'Confirmed' && <Badge>{l(handlingDisplayStatus(a))}</Badge>}
          {!a.dutyId && <Badge tone="amber">{t('Unlinked', '未連結')}</Badge>}
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </span>
    </button>
  );
}
