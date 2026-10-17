import type { Aircraft, Database } from '../domain/model';
import { cardText, hasArrival, hasDeparture, visibleAircraft } from '../domain/selectors';
import { gateText } from '../domain/time';
import { findAirline } from '../data/airlines';
import { findLocalAirline } from '../data/localAirlineLogos';
import AirlineLogo from '../components/AirlineLogo';
import { Badge } from '../components/ui';
import { useLabel, useT } from '../i18n';

export default function AircraftDetails({
  a: raw,
  db,
  onDuty,
  onJournal,
}: {
  a: Aircraft;
  db: Database;
  onDuty?: (id: string) => void;
  onJournal?: (id: string) => void;
}) {
  const t = useT(),
    l = useLabel(),
    p = db.settings.privacy;
  const a = visibleAircraft(raw, p),
    c = cardText(a, p);
  const duty = db.duties.find((d) => d.id === a.dutyId && d.status !== 'Trashed');
  const journals = db.journals.filter(
    (j) => j.aircraftIds.includes(a.id) || a.events.some((e) => e.journalId === j.id),
  );
  const missing = t('Not recorded', '未記錄');
  const identity = findAirline(a.airline) || findLocalAirline(a.airline);
  return (
    <>
      <span className="eyebrow">{t('AIRCRAFT ASSIGNMENT', '航機處理紀錄')}</span>
      <div className="detail-airline">
        <AirlineLogo airline={a.airline} size="lg" decorative />
        <h2 className="detail-title">{c.title}</h2>
      </div>
      <p>
        {l(a.role)} · {a.variant}
        {p.registration && a.registration ? ` (${a.registration})` : ''}
      </p>
      <div className="tags">
        <Badge tone="teal">{l(a.status)}</Badge>
        <Badge>{l(a.handling)}</Badge>
        {!duty && <Badge tone="amber">{t('Unlinked', '未連結')}</Badge>}
      </div>
      <section className="detail-section">
        <h3>{t('Assignment Information', '處理紀錄資料')}</h3>
        <dl className="review-list">
          <dt>{t('Handling Date', '處理日期')}</dt>
          <dd>{a.date || missing} · HKT</dd>
          <dt>{t('Airline', '航空公司')}</dt>
          <dd>
            {a.airline || missing}
            {identity
              ? `${identity.name === a.airline ? '' : ` · ${identity.name}`} (${identity.iata})`
              : ''}
          </dd>
          <dt>{t('Aircraft Type / Variant', '航機型號／子型號')}</dt>
          <dd>{a.variant || missing}</dd>
          <dt>{t('Aircraft Family / ICAO', '航機系列／ICAO')}</dt>
          <dd>
            {a.family || missing} / {a.icao || missing}
          </dd>
          <dt>{t('My Role / Handling Type', '本人角色／處理類型')}</dt>
          <dd>
            {l(a.role) || missing} · {l(a.handling) || missing}
          </dd>
          {p.registration && (
            <>
              <dt>{t('Registration', '機身註冊')}</dt>
              <dd>{a.registration || missing}</dd>
            </>
          )}
          {p.bay && (
            <>
              <dt>{t('Parking Bay', '停機位')}</dt>
              <dd>{a.bay || missing}</dd>
            </>
          )}
          <dt>{t('Actual handling', '實際處理')}</dt>
          <dd>{a.actualHandling ? t('Yes · self-reported', '有 · 自行申報') : t('No', '無')}</dd>
        </dl>
      </section>
      {(['arrival', 'departure'] as const)
        .filter((key) => (key === 'arrival' ? hasArrival(a) : hasDeparture(a)))
        .map((key) => (
          <section className="detail-section" key={key}>
            <h3>
              {key === 'arrival'
                ? t('Arrival Information', '抵港資料')
                : t('Departure Information', '離港資料')}
            </h3>
            <dl className="review-list">
              {p.flights && (
                <>
                  <dt>
                    {key === 'arrival'
                      ? t('Arrival flight number', '抵港航班編號')
                      : t('Departure flight number', '離港航班編號')}
                  </dt>
                  <dd>{a[key].flight || missing}</dd>
                </>
              )}
              {p.gateTimes && (
                <>
                  <dt>
                    {key === 'arrival'
                      ? t('Scheduled in-block · SIBT', '表定入位 · SIBT')
                      : t('Scheduled off-block · SOBT', '表定離位 · SOBT')}
                  </dt>
                  <dd>{a[key].scheduled ? `${gateText(a[key].scheduled, true)} HKT` : missing}</dd>
                  <dt>
                    {key === 'arrival'
                      ? t('Actual in-block · AIBT', '實際入位 · AIBT')
                      : t('Actual off-block · AOBT', '實際離位 · AOBT')}
                  </dt>
                  <dd>{a[key].actual ? `${gateText(a[key].actual, true)} HKT` : missing}</dd>
                </>
              )}
              {p.statuses && (
                <>
                  <dt>
                    {key === 'arrival'
                      ? t('Arrival Status', '抵港狀態')
                      : t('Departure Status', '離港狀態')}
                  </dt>
                  <dd>{l(a[key].status)}</dd>
                  <dt>{t('Status source', '狀態來源')}</dt>
                  <dd>{l(a[key].origin)}</dd>
                </>
              )}
            </dl>
            {!p.gateTimes && (
              <p className="muted">
                {t('Gate times hidden by privacy settings.', '停機位時間已按私隱設定隱藏。')}
              </p>
            )}
          </section>
        ))}
      <section className="detail-section">
        <h3>{t('Relationships', '關聯')}</h3>
        <dl className="review-list">
          <dt>{t('Linked Duty', '連結更次')}</dt>
          <dd>
            {duty ? (
              <>
                <span>
                  {duty.date} · {duty.start || missing} – {duty.end || missing}{' '}
                  {duty.start && duty.end && duty.end < duty.start ? '(+1)' : ''}
                </span>
                {onDuty && (
                  <button className="text-button" onClick={() => onDuty(duty.id)}>
                    {t('Open Duty', '開啟更次')}
                  </button>
                )}
              </>
            ) : (
              t('Unlinked', '未連結')
            )}
          </dd>
        </dl>
        <h4>{t('Linked Journal entries', '連結日誌')}</h4>
        {journals.length ? (
          journals.map((j) => (
            <p key={j.id}>
              {onJournal ? (
                <button className="text-button" onClick={() => onJournal(j.id)}>
                  {j.title}
                </button>
              ) : (
                j.title
              )}{' '}
              · {j.date} · {l(j.status)}
            </p>
          ))
        ) : (
          <p>{t('No linked Journal entries.', '沒有連結日誌。')}</p>
        )}
      </section>
      <section className="detail-section">
        <h3>{t('Disruption & Notes', '異常及筆記')}</h3>
        <p>
          {l(a.disruption)} · {a.events.length} {t('events', '事件')}
        </p>
        {a.disruption === 'Normal' && a.events.length > 0 && (
          <p className="notice amber">
            {t(
              'Inconsistent: events recorded while status is Normal.',
              '不一致：已記錄事件但狀態為正常。',
            )}
          </p>
        )}
        {a.events.map((e) => (
          <section className="inset" key={e.id}>
            <h4>{l(e.category)}</h4>
            <p>
              {l(e.involvement)} · {l(e.impact)} · {l(e.resolution)}
            </p>
            {p.disruptionNotes && <p>{e.notes || missing}</p>}
            {e.journalId && (
              <p>
                {t('Journal', '日誌')}:{' '}
                {db.journals.find((j) => j.id === e.journalId)?.title ||
                  t('Linked entry unavailable', '連結項目無法使用')}
              </p>
            )}
          </section>
        ))}
        <h4>{t('Notes', '筆記')}</h4>
        <p className="preserve-lines">{a.notes || missing}</p>
      </section>
      <section className="detail-section">
        <h3>{t('Record activity', '紀錄活動')}</h3>
        <dl className="review-list">
          {(
            [
              ['createdAt', t('Created', '建立時間')],
              ['updatedAt', t('Updated', '更新時間')],
            ] as const
          ).map(([key, label]) =>
            a[key] && Number.isFinite(Date.parse(a[key])) ? (
              <div className="review-leg" key={key}>
                <dt>{label}</dt>
                <dd>
                  {new Intl.DateTimeFormat(t('en-HK', 'zh-HK'), {
                    timeZone: 'Asia/Hong_Kong',
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  }).format(new Date(a[key]))}{' '}
                  HKT
                </dd>
              </div>
            ) : null,
          )}
        </dl>
      </section>
      <p className="muted">
        {t(
          'Optional fields follow privacy settings; hidden data remains archived. Enable only for authorized synthetic demonstrations.',
          '選填欄位遵循私隱設定，隱藏資料仍保留。只在獲准的虛構示範中啟用。',
        )}
      </p>
    </>
  );
}
