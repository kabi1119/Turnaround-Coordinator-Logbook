import { useState } from 'react';
import DutyCalendar from '../components/DutyCalendar';
import { hkToday } from '../domain/model';
import { matchesHandlingScope, type HandlingScope } from '../domain/homeSummary';
import { useCalendarNow } from '../lib/useCalendarNow';
import { dutyOptionText } from '../domain/roster';
import { CalendarDays, List, ChevronRight, Plus } from 'lucide-react';
import type { Aircraft, Database, Duty, Filters } from '../domain/model';
import { filterAircraft, timelineDate } from '../domain/selectors';
import { AircraftCard, Badge, Empty, Select } from '../components/ui';
import RecordFilters from '../components/RecordFilters';
import { useLabel, useT } from '../i18n';
export type LogbookView = { mode: string; filters: Filters & { lifecycle?: HandlingScope } };
export default function Logbook({
  db,
  onAircraft,
  onDuty,
  onNew,
  initialMode = 'timeline',
  view,
  onViewChange,
}: {
  initialMode?: string;
  view?: LogbookView;
  onViewChange?: (view: LogbookView) => void;
  db: Database;
  onAircraft: (a: Aircraft) => void;
  onDuty: (d: Duty) => void;
  onNew: () => void;
}) {
  const t = useT(),
    l = useLabel();
  const [localView, setLocalView] = useState<LogbookView>({ mode: initialMode, filters: {} });
  const { mode, filters } = view || localView;
  const updateView = (patch: Partial<LogbookView>) =>
    (onViewChange || setLocalView)({ mode, filters, ...patch });
  const setFilters = (filters: LogbookView['filters']) => updateView({ filters });
  const setMode = (mode: string) => updateView({ mode });
  const today = hkToday(new Date(useCalendarNow()));
  const [month, setMonth] = useState(hkToday().slice(0, 7)),
    [day, setDay] = useState(hkToday());
  const rows = filterAircraft(
    db.aircraft.filter((a) => matchesHandlingScope(a, filters.lifecycle, today)),
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
                  {t('Duty', '更次')} · {dutyOptionText(d, l)}
                </strong>
                <small>
                  {rows.filter((a) => a.dutyId === d.id).length}{' '}
                  {t('matching records', '項符合紀錄')}
                </small>
              </span>
              <Badge tone={d.status === 'Draft' ? 'amber' : 'teal'}>
                {l(d.status)} · {l(d.leave || d.workState || 'Work state not recorded')}
                {d.shiftType ? ` · ${l(d.shiftType)}` : ''}
              </Badge>
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
        .filter((a) => !dutyRows.some((d) => d.id === a.dutyId) && a.date === date)
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
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('Aircraft', '航機')}</span>
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
          {t('New Handling Record', '新增航機處理紀錄')}
        </button>
      </div>
      <RecordFilters
        records={db.aircraft}
        privacy={db.settings.privacy}
        value={filters}
        onChange={setFilters}
        extra={
          <Select
            label={t('Handling record status', '航機處理紀錄狀態')}
            value={filters.lifecycle || ''}
            options={[
              { value: '', label: t('All records', '全部紀錄') },
              {
                value: 'unfinished',
                label: t('Unfinished · Drafts + Pending', '未完成 · 草稿及待處理'),
              },
              { value: 'Draft', label: t('Drafts', '草稿') },
              { value: 'Pending', label: t('Pending', '待處理') },
              { value: 'Confirmed', label: t('Confirmed', '已確認') },
            ]}
            onChange={(e) =>
              setFilters({
                ...filters,
                lifecycle: (e.target.value || undefined) as HandlingScope | undefined,
              })
            }
          />
        }
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
          {filters.lifecycle === 'unfinished' && <>{t('Unfinished Records', '未完成紀錄')} · </>}
          {rows.length} {t('records', '項紀錄')}
        </span>
      </div>
      {mode === 'timeline' ? (
        dates.map(renderDate)
      ) : (
        <>
          <DutyCalendar
            duties={db.duties}
            month={month}
            onMonth={setMonth}
            selected={[day]}
            onSelect={setDay}
          />
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
