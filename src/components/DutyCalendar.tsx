import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Duty } from '../domain/model';
import { hkToday } from '../domain/model';
import { monthDates } from '../domain/roster';
import { resolveDutyDay, type DayStatus } from '../domain/dutyCalendar';
import { useT } from '../i18n';
import { useCalendarNow } from '../lib/useCalendarNow';

export default function DutyCalendar({
  duties,
  month,
  onMonth,
  selected = [],
  onSelect,
  selectionLabel = false,
  now: suppliedNow,
}: {
  duties: Duty[];
  month: string;
  onMonth: (month: string) => void;
  selected?: string[];
  onSelect: (date: string) => void;
  selectionLabel?: boolean;
  now?: number;
}) {
  const t = useT(),
    legendId = useId(),
    clock = useCalendarNow(),
    now = suppliedNow ?? clock;
  const dates = monthDates(month),
    today = hkToday(new Date(now));
  const offset = dates.length ? new Date(`${dates[0]}T12:00:00+08:00`).getUTCDay() : 0;
  const label = (status: DayStatus | null) => {
    switch (status) {
      case 'AL':
        return t('Annual Leave (AL)', '年假 (AL)');
      case 'SL':
        return t('Sick Leave (SL)', '病假 (SL)');
      case 'Worked':
        return t('Worked', '已工作');
      case 'Scheduled':
        return t('Scheduled', '已排更');
      case 'Currently Working':
        return t('Currently Working', '正在當值');
      case 'Not recorded':
        return t('Work state not recorded', '未記錄工作進度');
      default:
        return t('No duty record', '沒有更次紀錄');
    }
  };
  function shift(delta: number) {
    if (!dates.length) return;
    const date = new Date(`${month}-15T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    if (date.getUTCFullYear() >= 1900 && date.getUTCFullYear() <= 9999)
      onMonth(date.toISOString().slice(0, 7));
  }
  return (
    <section className="panel calendar duty-calendar" aria-label={t('Duty calendar', '更次月曆')}>
      <div className="section-title">
        <button aria-label={t('Previous month', '上個月')} onClick={() => shift(-1)}>
          <ChevronLeft size={18} />
        </button>
        <h3>{month}</h3>
        <button aria-label={t('Next month', '下個月')} onClick={() => shift(1)}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-grid" aria-describedby={legendId}>
        {t('Sun,Mon,Tue,Wed,Thu,Fri,Sat', '日,一,二,三,四,五,六')
          .split(',')
          .map((d) => (
            <small key={d}>{d}</small>
          ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {dates.map((date) => {
          const status = resolveDutyDay(duties, date, now),
            count = duties.filter((d) => d.date === date && d.status !== 'Trashed').length;
          return (
            <button
              key={date}
              data-date={date}
              title={`${date} · ${label(status)}`}
              className={selected.includes(date) ? 'active' : ''}
              aria-pressed={selected.includes(date)}
              aria-current={date === today ? 'date' : undefined}
              aria-label={
                selectionLabel
                  ? t(`Select ${date}`, `選擇 ${date}`)
                  : `${date} · ${label(status)} · ${count} ${t('records', '項紀錄')}`
              }
              aria-description={
                selectionLabel ? `${label(status)} · ${count} ${t('records', '項紀錄')}` : undefined
              }
              onClick={() => onSelect(date)}
            >
              <span>{Number(date.slice(-2))}</span>
              {status && (
                <span
                  aria-hidden="true"
                  data-duty-marker={status}
                  className={
                    status === 'AL' || status === 'SL'
                      ? 'leave-marker'
                      : `duty-marker ${status === 'Worked' ? 'worked' : status === 'Scheduled' ? 'scheduled' : status === 'Currently Working' ? 'working' : 'unknown'}`
                  }
                >
                  {status === 'AL' || status === 'SL' ? status : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="calendar-legend muted" id={legendId}>
        {t(
          'Green: Worked · Red: Scheduled · Yellow: Currently Working · AL: Annual Leave · SL: Sick Leave. No marker means no Duty. Select a date to inspect every record.',
          '綠：已工作 · 紅：已排更 · 黃：正在當值 · AL：年假 · SL：病假。沒有標記表示沒有更次，選擇日期可查看全部紀錄。',
        )}
      </p>
    </section>
  );
}
