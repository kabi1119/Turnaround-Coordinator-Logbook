import { useState } from 'react';
import { ArrowUpRight, Download } from 'lucide-react';
import type { Database, Filters } from '../domain/model';
import { filterAircraft, ranking, stats, visibleAircraft } from '../domain/selectors';
import { Metric, SectionTitle, Select } from '../components/ui';
import RecordFilters from '../components/RecordFilters';
import { useLabel, useT } from '../i18n';
import { dutyTotals } from '../domain/dutyCalendar';
import AirlineLogo from '../components/AirlineLogo';

export function Bars({ items, airline = false }: { items: [string, number][]; airline?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i[1]));
  return (
    <div className="bars">
      {items.map(([name, count]) => (
        <div className="bar-row" key={name}>
          <div>
            <span>
              {airline && <AirlineLogo airline={name} size="sm" decorative />} {name}
            </span>
            <strong>{count}</strong>
          </div>
          <div className="bar-track">
            <div style={{ width: `${(count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
export default function Statistics({ db, onReport }: { db: Database; onReport: () => void }) {
  const t = useT(),
    l = useLabel();
  const [filters, setFilters] = useState<Filters>({}),
    [scope, setScope] = useState<'logged' | 'handled' | 'primary'>('logged'),
    [rank, setRank] = useState<'airline' | 'aircraftType' | 'variant' | 'family' | 'registration'>(
      'airline',
    );
  const rows = filterAircraft(db.aircraft, filters, db.settings.privacy);
  const s = stats(
    rows,
    db.duties.filter(
      (d) => (!filters.from || d.date >= filters.from) && (!filters.to || d.date <= filters.to),
    ),
  );
  const totals = dutyTotals(
    db.duties.filter(
      (d) => (!filters.from || d.date >= filters.from) && (!filters.to || d.date <= filters.to),
    ),
  );
  const visible = rows.map((a) => visibleAircraft(a, db.settings.privacy));
  const ranked =
    scope === 'logged'
      ? visible
      : visible.filter((a) =>
          scope === 'handled'
            ? a.role !== 'Training / Observation'
            : a.role === 'Primary Coordinator',
        );
  const monthRows = ranking(ranked, 'month').sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ANALYSE / UNDERSTAND</span>
          <h1>
            {t(
              'Every handling assignment,\na bigger picture.',
              '每項航機處理任務，\n構成更完整的圖像。',
            )}
          </h1>
          <p>
            {t(
              'Your personal logbook in numbers. One Full Turnaround is always one handling assignment.',
              '以數字回顧個人紀錄；一次完整過站始終只算一項航機處理任務。',
            )}
          </p>
        </div>
        <button onClick={onReport}>
          <Download size={17} />
          {t('Privacy Preview', '私隱預覽')}
        </button>
      </div>
      <RecordFilters
        records={db.aircraft}
        privacy={db.settings.privacy}
        value={filters}
        onChange={setFilters}
      />
      <div className="metrics surface-dark">
        <Metric
          value={s.logged}
          label={t('Handling Assignments Logged', '航機處理任務（記錄）')}
          detail={t('Primary + Supporting + Training', '主要 + 支援 + 訓練')}
        />
        <Metric
          value={s.handled}
          label={t('Handling Assignments Handled', '航機處理任務（已處理）')}
          detail={t('Primary + Supporting', '主要 + 支援')}
        />
        <Metric
          value={s.primary}
          label={t('Primary Coordinator', '主要協調員')}
          detail={t('Included in both totals', '已包含在兩項總數內')}
        />
      </div>
      <div className="section-title">
        <h2>{t('Handling Assignments', '航機處理任務')}</h2>
        <Select
          label={t('Breakdown & ranking scope', '分類及排名範圍')}
          options={[
            { value: 'logged', label: t('Logged · all roles', '記錄 · 所有角色') },
            { value: 'handled', label: t('Handled · excludes Training', '處理 · 排除訓練') },
            { value: 'primary', label: t('Primary only', '僅主要協調員') },
          ]}
          value={scope}
          onChange={(e) => setScope(e.target.value as typeof scope)}
        />
      </div>
      <div className="two-col">
        <section className="panel">
          <SectionTitle
            title={t('Handling Type', '處理類型')}
            subtitle={t(
              'Three mutually exclusive handling assignment types',
              '三種互斥的航機處理任務類型',
            )}
          />
          <Bars items={s.types.map((x) => [l(x.type), x[scope]])} />
          <p className="muted">
            {t('Breakdown total', '分類合計')}: {s.types.reduce((n, x) => n + x[scope], 0)} ·{' '}
            {t('Full Turnaround is never doubled.', '完整過站不會重複計算。')}
          </p>
        </section>
        <section className="panel">
          <SectionTitle title={t('Role breakdown', '角色分類')} />
          <Bars
            items={[
              [t('Primary', '主要'), s.primary],
              [t('Supporting', '支援'), s.supporting],
              [t('Training / Observation', '訓練／觀察'), s.training],
            ]}
          />
          <p className="muted">
            {t(
              'Confirmed handling assignments only. Drafts and Trash are excluded.',
              '只計已確認的航機處理任務，排除草稿及垃圾桶。',
            )}
          </p>
        </section>
        <section className="panel">
          <SectionTitle
            title={t('Monthly encounters', '每月接觸次數')}
            subtitle={t('By Handling Date, not creation time', '按處理日期，並非建立時間')}
          />
          <div className="trend-chart">
            {monthRows.map(([month, count]) => (
              <div key={month} className="trend-column">
                <strong>{count}</strong>
                <div
                  style={{
                    height: `${Math.max(4, (count / Math.max(1, ...monthRows.map((x) => x[1]))) * 130)}px`,
                  }}
                />
                <small>{month}</small>
              </div>
            ))}
            {!monthRows.length && (
              <p>{t('No confirmed encounters in this period.', '此期間沒有已確認的接觸紀錄。')}</p>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>{t('Rankings', '排名')}</h2>
            <ArrowUpRight size={20} />
          </div>
          <Select
            label={t('Rank by', '排名分類')}
            value={rank === 'registration' && !db.settings.privacy.registration ? 'airline' : rank}
            options={[
              { value: 'airline', label: t('Airline', '航空公司') },
              { value: 'aircraftType', label: t('Aircraft type', '航機型號') },
              { value: 'variant', label: t('Aircraft variant', '航機子型號') },
              { value: 'family', label: t('Aircraft family', '航機系列') },
              ...(db.settings.privacy.registration
                ? [
                    {
                      value: 'registration',
                      label: t('Registration · encounter frequency', '機身註冊 · 接觸次數'),
                    },
                  ]
                : []),
            ]}
            onChange={(e) => setRank(e.target.value as typeof rank)}
          />
          <Bars
            airline={
              rank === 'airline' || (rank === 'registration' && !db.settings.privacy.registration)
            }
            items={ranking(
              ranked,
              rank === 'registration' && !db.settings.privacy.registration ? 'airline' : rank,
            )}
          />
          <p className="muted">
            {t(
              'Counts are encounters, not unique airframes. Logged includes Training.',
              '次數代表接觸紀錄，非獨立機身；記錄範圍包括訓練。',
            )}
          </p>
        </section>
        {db.settings.privacy.statuses && (
          <>
            <section className="panel">
              <SectionTitle
                title={t('Arrival Flight Status', '抵港航班狀態')}
                subtitle={t(
                  'Arrival-only + Full Turnaround arrival legs',
                  '僅抵港 + 完整過站的抵港航段',
                )}
              />
              <Bars items={s.arrival.map((x) => [l(x.status), x.count])} />
            </section>
            <section className="panel">
              <SectionTitle
                title={t('Departure Flight Status', '離港航班狀態')}
                subtitle={t(
                  'Departure-only + Full Turnaround departure legs',
                  '僅離港 + 完整過站的離港航段',
                )}
              />
              <Bars items={s.departure.map((x) => [l(x.status), x.count])} />
            </section>
          </>
        )}
      </div>
      <section className="panel" aria-label={t('Duty and leave totals', '更次及假別統計')}>
        <h2>{t('Duty and leave totals', '更次及假別統計')}</h2>
        <div className="mini-metrics duty-totals">
          {[
            [t('Scheduled duty hours', '已排更工時'), totals.scheduledHours.toFixed(1)],
            [t('Actual worked duty hours', '實際已工作工時'), totals.workedHours.toFixed(1)],
            [t('Scheduled SL hours', '病假原定工時'), totals.sickHours.toFixed(1)],
            [t('Annual Leave dates', '年假日數'), totals.annualDates],
            [t('Sick Leave dates', '病假日數'), totals.sickDates],
            [t('Confirmed worked duty shifts', '已確認的已工作更次'), totals.workedShifts],
          ].map(([label, value]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <p className="muted">
          {t(
            'Confirmed records only, filtered by Duty start date. AL has no hours; SL retains planned hours separately. Missing times add no hours. Aircraft counts are independent.',
            '只計已確認紀錄，按開更日期篩選；年假沒有工時，病假保留原定工時並獨立列出。缺少時間不增加工時，航機次數獨立計算。',
          )}
        </p>
      </section>
      <div className="mini-metrics">
        <div>
          <strong>{s.duties}</strong>
          <span>{t('Worked Duty Shifts', '已工作更次')}</span>
          <small>
            {t(
              'Confirmed worked duties; planned shifts excluded. Legacy confirmed duties retain their original meaning. Date-filtered independently.',
              '只計已確認並已工作的更次，排除計劃更次；舊版已確認更次保留原有含義，按日期獨立篩選。',
            )}
          </small>
        </div>
        {db.settings.privacy.registration && (
          <div>
            <strong>{stats(visible).unique}</strong>
            <span>{t('Unique registrations', '不重複機身註冊')}</span>
          </div>
        )}
        <div>
          <strong>{s.events}</strong>
          <span>{t('Disruption Events', '異常事件')}</span>
        </div>
        <div>
          <strong>{s.disrupted}</strong>
          <span>{t('Handling assignments with events', '有事件的航機處理任務')}</span>
        </div>
      </div>
      <p className="muted">
        {t(
          'Flight categories are self-reported or confirmed mock gate suggestions. These are not official HAS or airline performance figures.',
          '航班分類為自行申報或已確認的模擬時間建議，並非 HAS 或航空公司官方績效。',
        )}
      </p>
    </>
  );
}
