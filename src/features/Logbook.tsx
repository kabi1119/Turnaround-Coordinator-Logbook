import { useState } from 'react';
import { CalendarDays, List, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Aircraft, Database, Duty, Filters } from '../domain/model';
import { filterAircraft, timelineDate } from '../domain/selectors';
import { AircraftCard, Badge, Empty } from '../components/ui';
import RecordFilters from '../components/RecordFilters';
import { useLabel, useT } from '../i18n';
export default function Logbook({
  db,
  onAircraft,
  onDuty,
  onNew,
}: {
  db: Database;
  onAircraft: (a: Aircraft) => void;
  onDuty: (d: Duty) => void;
  onNew: () => void;
}) {
  const t = useT(),
    l = useLabel();
  const [mode, setMode] = useState('timeline'),
    [filters, setFilters] = useState<Filters>({}),
    [month, setMonth] = useState('2026-10'),
    [day, setDay] = useState('2026-10-16');
  const rows = filterAircraft(
    db.aircraft.filter((a) => a.status !== 'Trashed'),
    filters,
    db.settings.privacy,
  ).sort((a, b) => b.date.localeCompare(a.date));
  const dutyRows = db.duties.filter(
    (d) =>
      d.status !== 'Trashed' &&
      (rows.some((a) => a.dutyId === d.id) ||
        ((!filters.from || d.date >= filters.from) && (!filters.to || d.date <= filters.to))),
  );
  const dates = [
    ...new Set([
      ...rows.map((a) => timelineDate(a, db.duties)),
      ...dutyRows
        .filter((d) => !Object.values(filters).some(Boolean) || rows.some((a) => a.dutyId === d.id))
        .map((d) => d.date),
    ]),
  ]
    .sort()
    .reverse();
  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(date.toISOString().slice(0, 7));
    setDay(date.toISOString().slice(0, 10));
  };
  const renderDate = (date: string) => (
    <div className="timeline-group" key={date}>
      <div className="date-marker">
        <span />
        {date
          ? new Intl.DateTimeFormat(t('en-HK', 'zh-HK'), {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              timeZone: 'Asia/Hong_Kong',
            }).format(new Date(`${date}T12:00:00+08:00`))
          : t('Undated drafts', '未定日期草稿')}
      </div>
      {dutyRows
        .filter(
          (d) =>
            d.date === date &&
            (!Object.values(filters).some(Boolean) || rows.some((a) => a.dutyId === d.id)),
        )
        .map((d) => (
          <section key={d.id} className="panel duty-group">
            <button className="duty-row" onClick={() => onDuty(d)}>
              <span>
                <strong>
                  {t('Duty', '更次')} · {d.start || '—'} – {d.end || '—'}
                  {d.start && d.end && d.end < d.start ? ' (+1)' : ''}
                </strong>
                <small>
                  {rows.filter((a) => a.dutyId === d.id).length}{' '}
                  {t('matching records', '項符合紀錄')}
                </small>
              </span>
              <Badge tone={d.status === 'Draft' ? 'amber' : 'teal'}>{l(d.status)}</Badge>
              <ChevronRight size={17} />
            </button>
            {rows
              .filter((a) => a.dutyId === d.id)
              .map((a) => (
                <AircraftCard
                  key={a.id}
                  a={a}
                  privacy={db.settings.privacy}
                  onClick={() => onAircraft(a)}
                />
              ))}
          </section>
        ))}
      {rows
        .filter((a) => !a.dutyId && a.date === date)
        .map((a) => (
          <AircraftCard
            key={a.id}
            a={a}
            privacy={db.settings.privacy}
            onClick={() => onAircraft(a)}
          />
        ))}
    </div>
  );
  const [year, mon] = month.split('-').map(Number),
    days = new Date(Date.UTC(year, mon, 0)).getUTCDate(),
    offset = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">RECORD / REVISIT</span>
          <h1>{t('The logbook.', '航機紀錄。')}</h1>
          <p>
            {t(
              'Every shift and every assignment, in one place.',
              '每個更次、每項處理紀錄，盡在此處。',
            )}
          </p>
        </div>
        <button className="primary" onClick={onNew}>
          <Plus size={18} />
          {t('New Aircraft', '新增航機')}
        </button>
      </div>
      <RecordFilters
        records={db.aircraft}
        privacy={db.settings.privacy}
        value={filters}
        onChange={setFilters}
      />
      <div className="section-title">
        <div className="segmented">
          <button
            className={mode === 'timeline' ? 'selected' : ''}
            onClick={() => setMode('timeline')}
          >
            <List size={17} />
            {t('Timeline', '時間軸')}
          </button>
          <button
            className={mode === 'calendar' ? 'selected' : ''}
            onClick={() => setMode('calendar')}
          >
            <CalendarDays size={17} />
            {t('Calendar', '月曆')}
          </button>
        </div>
        <span className="muted">
          {rows.length} {t('records', '項紀錄')}
        </span>
      </div>
      {mode === 'timeline' ? (
        dates.map(renderDate)
      ) : (
        <>
          <section className="panel calendar">
            <div className="section-title">
              <button aria-label={t('Previous month', '上個月')} onClick={() => shift(-1)}>
                <ChevronLeft size={18} />
              </button>
              <h2>{month}</h2>
              <button aria-label={t('Next month', '下個月')} onClick={() => shift(1)}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="calendar-grid">
              {t('Sun,Mon,Tue,Wed,Thu,Fri,Sat', '日,一,二,三,四,五,六')
                .split(',')
                .map((d) => (
                  <small key={d}>{d}</small>
                ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={`blank${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const date = `${month}-${String(i + 1).padStart(2, '0')}`;
                const count = rows.filter((a) => timelineDate(a, db.duties) === date).length;
                const dutyCount = dutyRows.filter((d) => d.date === date).length;
                return (
                  <button
                    key={date}
                    className={day === date ? 'active' : ''}
                    onClick={() => setDay(date)}
                    aria-label={`${date} · ${count} ${t('records', '項紀錄')}`}
                    aria-pressed={day === date}
                  >
                    {i + 1}
                    {(count > 0 || dutyCount > 0) && <span className="calendar-dot" />}
                  </button>
                );
              })}
            </div>
            <p className="muted">
              {t(
                'No record does not mean day off. Cross-midnight shifts stay on their start date.',
                '無紀錄不代表休假；跨午夜更次按開更日期歸組。',
              )}
            </p>
          </section>
          {dates.includes(day) ? (
            renderDate(day)
          ) : (
            <Empty text={t('No matching records for this date.', '此日期沒有符合的紀錄。')} />
          )}
        </>
      )}
      {mode === 'timeline' && dates.length === 0 && (
        <Empty
          text={t(
            'No matching records. Try clearing filters or add an assignment.',
            '沒有符合紀錄，可清除篩選或新增一項。',
          )}
        />
      )}
    </>
  );
}
