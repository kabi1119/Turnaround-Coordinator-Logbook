import type { Aircraft, Duty } from '../domain/model';
import { homeDutyPresentation } from '../domain/homeDuty';
import { shiftRange } from '../domain/roster';
import { useCalendarNow } from '../lib/useCalendarNow';
import { Badge } from '../components/ui';
import { useT } from '../i18n';
import { ArrowRight, ArrowUpRight, Clock3, Plane } from 'lucide-react';

export default function UpcomingShift({
  duties,
  aircraft = [],
  onDuty,
  onCalendar,
}: {
  duties: Duty[];
  aircraft?: Aircraft[];
  onDuty: (d: Duty) => void;
  onCalendar: () => void;
}) {
  const t = useT(),
    now = useCalendarNow();
  const { primary, next, remaining, kind } = homeDutyPresentation(duties, now);
  const title =
    kind === 'current'
      ? t('Current Shift', '當前更次')
      : kind === 'today'
        ? t("Today's Scheduled Shift", '今日已排更次')
        : t('Upcoming Shift', '即將到來的更次');
  function hours(d: Duty) {
    return (
      (d.start ? t('Start', '開更') + ' ' + d.start : t('Start not recorded', '未記錄開更時間')) +
      ' · ' +
      (d.end ? t('End', '完更') + ' ' + d.end : t('End not recorded', '未記錄完更時間')) +
      (shiftRange(d)?.overnight ? t(' (+1 day)', '（翌日）') : '') +
      ' HKT'
    );
  }
  function date(d: Duty, full = false) {
    return new Intl.DateTimeFormat(t('en-HK', 'zh-HK'), {
      ...(full
        ? { dateStyle: 'full' as const }
        : { month: 'long' as const, year: 'numeric' as const }),
      timeZone: 'Asia/Hong_Kong',
    }).format(new Date(d.date + 'T12:00:00+08:00'));
  }
  function choices(rows: Duty[]) {
    return (
      <div className="shift-choices">
        <p>
          {t(
            'Multiple scheduled shifts. Choose a Duty to inspect.',
            '有多個已排更次，請選擇要查看的更次。',
          )}
        </p>
        {rows.map((d, i) => (
          <button key={d.id} onClick={() => onDuty(d)}>
            <span>
              <strong>{date(d, true)}</strong>
              <span>{hours(d)}</span>
            </span>
            <span>
              {t('View Duty', '查看更次')} {i + 1}
              <ArrowRight size={16} />
            </span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <section className="upcoming-shift" aria-label={title}>
      <div className="section-title">
        <h2>{title}</h2>
        <button className="text-button" onClick={onCalendar}>
          {t('View Full Calendar', '查看完整月曆')}
          <ArrowUpRight size={16} />
        </button>
      </div>
      {primary.length ? (
        <div className="current-duty surface-dark">
          <div className="section-title">
            <Badge tone="light">{t('Scheduled', '已排班')}</Badge>
          </div>
          {primary.length > 1 ? (
            choices(primary)
          ) : (
            <div className="shift-summary">
              <div className="duty-big-date">
                <time dateTime={primary[0].date} aria-label={date(primary[0], true)}>
                  {primary[0].date.slice(8)}
                </time>
                <div>{date(primary[0])}</div>
              </div>
              <div className="duty-facts">
                <span>
                  <Clock3 size={16} aria-hidden="true" />
                  {hours(primary[0])}
                </span>
                <span>
                  <Plane size={16} aria-hidden="true" />
                  {
                    aircraft.filter((a) => a.dutyId === primary[0].id && a.status !== 'Trashed')
                      .length
                  }{' '}
                  {t('records', '項紀錄')}
                </span>
              </div>
              <button className="duty-open" onClick={() => onDuty(primary[0])}>
                {t('View Duty', '查看更次')}
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="panel">
          <p className="muted">
            {t('No upcoming scheduled shifts.', '沒有即將到來的已排更更次。')}
          </p>
        </div>
      )}
      {next.length > 0 && (
        <section className="panel next-shift" aria-label={t('Next Shift', '下一更次')}>
          <h3>{t('Next Shift', '下一更次')}</h3>
          {next.length > 1 ? (
            choices(next)
          ) : (
            <>
              <strong>{date(next[0], true)}</strong>
              <p className="muted">{hours(next[0])}</p>
              <button className="text-button" onClick={() => onDuty(next[0])}>
                {t('View Duty', '查看更次')}
                <ArrowRight size={16} />
              </button>
            </>
          )}
        </section>
      )}
      {remaining > 0 && (
        <p className="muted upcoming-more">
          {t(
            remaining +
              ' more scheduled ' +
              (remaining === 1 ? 'shift' : 'shifts') +
              ' in the Full Calendar.',
            '完整月曆另有 ' + remaining + ' 個已排更更次。',
          )}
        </p>
      )}
    </section>
  );
}
