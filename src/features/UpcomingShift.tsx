import type { Duty } from '../domain/model';
import { hkToday } from '../domain/model';
import { shiftRange } from '../domain/roster';
import { validDutyDate } from '../domain/dutyCalendar';
import { useCalendarNow } from '../lib/useCalendarNow';
import { Badge } from '../components/ui';
import { useT, useLabel } from '../i18n';
import { ArrowUpRight, CalendarDays } from 'lucide-react';

export default function UpcomingShift({
  duties,
  onDuty,
  onCalendar,
}: {
  duties: Duty[];
  onDuty: (d: Duty) => void;
  onCalendar: () => void;
}) {
  const t = useT(),
    l = useLabel(),
    now = useCalendarNow(),
    today = hkToday(new Date(now));
  const upcoming = duties
    .filter((d) => {
      if (
        d.status !== 'Confirmed' ||
        d.workState !== 'Planned' ||
        d.leave ||
        !validDutyDate(d.date)
      )
        return false;
      const range = shiftRange(d);
      if (range) return range.start >= now;
      if (d.start) return Date.parse(`${d.date}T${d.start}:00+08:00`) >= now;
      return d.date >= today;
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.start || '99:99').localeCompare(b.start || '99:99') ||
        a.id.localeCompare(b.id),
    );
  const next = upcoming[0];
  return (
    <section className="panel upcoming-shift" aria-label={t('Upcoming Shift', '即將到來的更次')}>
      <div className="section-title">
        <h2>{t('Upcoming Shift', '即將到來的更次')}</h2>
        <button className="text-button" onClick={onCalendar}>
          {t('View Full Calendar', '查看完整月曆')}
          <ArrowUpRight size={16} />
        </button>
      </div>
      {next ? (
        <>
          <button className="upcoming-shift-row" onClick={() => onDuty(next)}>
            <CalendarDays size={24} aria-hidden="true" />
            <span>
              <strong>
                {new Intl.DateTimeFormat(t('en-HK', 'zh-HK'), {
                  dateStyle: 'full',
                  timeZone: 'Asia/Hong_Kong',
                }).format(new Date(`${next.date}T12:00:00+08:00`))}
              </strong>
              <span>
                {next.start
                  ? `${t('Start', '開更')} ${next.start}`
                  : t('Start not recorded', '未記錄開更時間')}{' '}
                ·{' '}
                {next.end
                  ? `${t('End', '完更')} ${next.end}`
                  : t('End not recorded', '未記錄完更時間')}
                {next.start && next.end && next.end < next.start ? t(' (+1 day)', '（翌日）') : ''}{' '}
                HKT
              </span>
            </span>
            <Badge tone="teal">
              {l('Scheduled')} · {l(next.status)}
            </Badge>
          </button>
          {upcoming.length > 1 && (
            <p className="muted upcoming-more">
              {t(
                `${upcoming.length - 1} more scheduled ${upcoming.length === 2 ? 'shift' : 'shifts'} in the Full Calendar.`,
                `完整月曆另有 ${upcoming.length - 1} 個已排更更次。`,
              )}
            </p>
          )}
        </>
      ) : (
        <p className="muted">{t('No upcoming scheduled shifts.', '沒有即將到來的已排更更次。')}</p>
      )}
    </section>
  );
}
