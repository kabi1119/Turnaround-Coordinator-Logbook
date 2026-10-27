import { afterSave, type Commit } from '../workspaces/store';
import { useRef, useState } from 'react';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';
import type { Aircraft, Database, Disruption, Leg } from '../domain/model';
import {
  disruptionCategories,
  emptyAircraft,
  flightStatuses,
  hkToday,
  id,
  roles,
  newLeg,
} from '../domain/model';
import {
  duplicates,
  gateSuggestion,
  hasArrival,
  hasDeparture,
  normalizeRegistration,
  resolveDuty,
  saveAircraft,
  visibleAircraft,
} from '../domain/selectors';
import { Confirm, Field, Modal, Select, TextArea, Badge } from '../components/ui';
import { useLabel, useT } from '../i18n';
import AirlineLogo from '../components/AirlineLogo';
import AirlineCombobox from '../components/AirlineCombobox';
import DutyPicker from '../components/DutyPicker';
import { dutyOptionText } from '../domain/roster';
import AircraftTypeFields from '../components/AircraftTypeFields';
import { aircraftModel } from '../data/aircraftCatalogue';
import { delaySeverity } from '../domain/delaySeverity';
import { useMotionClose } from '../lib/useMotionClose';
import FlightNumberField from '../components/FlightNumberField';
import {
  changeFlightAirline,
  confirmedHandlingIssues,
  handlingDisplayStatus,
  flightPrefix,
  flightEntry,
  type HandlingField,
} from '../domain/handlingForm';
import { validDutyDate } from '../domain/dutyCalendar';
import { useCalendarNow } from '../lib/useCalendarNow';
import { focusModalField } from '../lib/modalInteraction';
import BlockTimeField from '../components/BlockTimeField';
import { gateText } from '../domain/time';
export interface EditorProps {
  db: Database;
  existing?: Aircraft;
  dutyId?: string;
  onClose: () => void;
  commit: Commit;
  onSaved: () => void;
}
export default function AircraftEditor({
  db,
  existing,
  dutyId,
  onClose: leave,
  commit,
  onSaved,
}: EditorProps) {
  const t = useT(),
    l = useLabel(),
    p = db.settings.privacy;
  const calendarNow = useCalendarNow(),
    today = hkToday(new Date(calendarNow));
  const { closing, close: onClose } = useMotionClose(leave);
  const chosen = db.duties.find((d) => d.id === dutyId && d.status !== 'Trashed' && !d.leave);
  const [explicitDuty, setExplicitDuty] = useState(Boolean(existing || chosen));
  const [a, setA] = useState<Aircraft>(() =>
    existing
      ? visibleAircraft(structuredClone(existing), p)
      : {
          ...emptyAircraft(
            chosen?.date || hkToday(),
            chosen?.id || resolveDuty(hkToday(), db.duties).selected,
          ),
          handling: '',
          role: '',
          actualHandling: false,
        },
  );
  const [review, setReview] = useState<'close' | 'next' | 'draft' | null>(null),
    [error, setError] = useState(''),
    [keep, setKeep] = useState(false),
    [discard, setDiscard] = useState(false);
  const { closing: reviewClosing, close: closeReview } = useMotionClose(() => setReview(null));
  const saving = useRef(false),
    form = useRef<HTMLFormElement>(null);
  const lastKnownAirline = useRef(a.airline);
  const [attempted, setAttempted] = useState(false),
    [performed, setPerformed] = useState(false);
  const [pendingType, setPendingType] = useState<Aircraft['handling'] | null>(null);
  const issues = attempted ? confirmedHandlingIssues(a, p, today) : [];
  const fieldNames: Record<HandlingField, string> = {
    date: t('Handling Date', '處理日期'),
    airline: t('Airline', '航空公司'),
    handling: t('Handling Type', '處理類型'),
    aircraftType: t('Aircraft Type', '航機型號'),
    variant: t('Aircraft Variant', '航機子型號'),
    role: t('My Role', '本人角色'),
    arrival: t('Arrival Flight Number', '抵港航班編號'),
    departure: t('Departure Flight Number', '離港航班編號'),
    bay: t('Parking Bay', '停機位'),
  };
  function fieldError(field: HandlingField) {
    const issue = issues.find((i) => i.field === field);
    return !issue
      ? undefined
      : issue.reason === 'future'
        ? t(
            'Future Handling must be saved as Draft (Pending).',
            '未來處理紀錄必須儲存為草稿（待處理）。',
          )
        : issue.reason === 'invalid'
          ? t('Check this value before confirming.', '確認前請檢查此欄位。')
          : t('Required for confirmed records.', '已確認紀錄必須填寫。');
  }
  function changeAirline(airline: string) {
    const prior = flightPrefix(a.airline) ? a.airline : lastKnownAirline.current;
    patch({
      airline,
      arrival: { ...a.arrival, flight: changeFlightAirline(prior, airline, a.arrival.flight) },
      departure: {
        ...a.departure,
        flight: changeFlightAirline(prior, airline, a.departure.flight),
      },
    });
    if (flightPrefix(airline)) lastKnownAirline.current = airline;
  }
  function changeType(handling: Aircraft['handling']) {
    const candidate = { ...a, handling };
    const losesData =
      existing &&
      (['arrival', 'departure'] as const).some((key) => {
        const applicable = key === 'arrival' ? hasArrival(candidate) : hasDeparture(candidate);
        const old = existing[key];
        return (
          !applicable &&
          Boolean(old.flight || old.scheduled || old.actual || old.status !== 'Not Recorded')
        );
      });
    if (losesData && handling !== existing.handling) setPendingType(handling);
    else patch({ handling });
  }
  const patch = (part: Partial<Aircraft>) => setA((prev) => ({ ...prev, ...part }));
  const applicableDuties = db.duties.filter((d) => d.status !== 'Trashed' || d.id === a.dutyId);
  const suggested = resolveDuty(a.date, db.duties);
  const matches = duplicates(a, db.aircraft, p);
  const history =
    p.registration && a.registration
      ? db.aircraft
          .filter(
            (b) =>
              b.status !== 'Trashed' &&
              normalizeRegistration(b.registration) === normalizeRegistration(a.registration),
          )
          .sort((x, y) => y.date.localeCompare(x.date))[0]
      : undefined;
  const selectedDuty = db.duties.find((d) => d.id === a.dutyId);
  function validTimes() {
    const controls =
      form.current?.querySelectorAll<HTMLInputElement>('.block-time-field input') || [];
    for (const control of controls) {
      if (
        !control.checkValidity() ||
        (control.type === 'date' && control.value && !validDutyDate(control.value))
      ) {
        setError(
          t(
            'Enter a valid HH:mm time and Hong Kong date for each recorded block event.',
            '請為每項停機位事件填寫有效 HH:mm 時間及香港日期。',
          ),
        );
        focusModalField(control);
        return false;
      }
    }
    return true;
  }
  function openReview(mode: 'close' | 'next' | 'draft') {
    setError('');
    if (!validLink() || !validTimes()) return;
    setAttempted(mode !== 'draft');
    if (a.date && !validDutyDate(a.date)) {
      setError(t('Choose a valid Hong Kong date.', '請選擇有效的香港日期。'));
      return;
    }
    if (mode !== 'draft') {
      const invalid = confirmedHandlingIssues(a, p);
      if (invalid.length) {
        const control = form.current?.elements.namedItem(invalid[0].field) as HTMLElement | null;
        if (control) focusModalField(control);
        return;
      }
    }
    setPerformed(false);
    setKeep(false);
    saving.current = false;
    setReview(mode);
  }
  function confirmSave() {
    if (saving.current || !review || (matches.length > 0 && !keep)) return;
    if (!validLink() || !validTimes()) return;
    if (a.date && !validDutyDate(a.date)) {
      setError(t('Choose a valid Hong Kong date.', '請選擇有效的香港日期。'));
      return;
    }
    if (review !== 'draft' && (confirmedHandlingIssues(a, p).length || !performed)) {
      setError(
        t(
          'Return to Edit to resolve the fields, and explicitly confirm that handling occurred.',
          '請返回修改以修正欄位，並明確確認已實際處理。',
        ),
      );
      return;
    }
    if (
      a.events.some(
        (e) =>
          e.journalId &&
          !db.journals.some((j) => j.id === e.journalId) &&
          !existing?.events.some((old) => old.id === e.id && old.journalId === e.journalId),
      )
    ) {
      setError(
        t(
          'A linked Journal is no longer available. Review the relationship.',
          '連結的日誌已無法使用，請覆核連結。',
        ),
      );
      return;
    }
    saving.current = true;
    const now = new Date().toISOString();
    // Disabled values remain archived on edits; only enabled fields accept new values.
    const base = existing || emptyAircraft(a.date);
    const record: Aircraft = {
      ...a,
      dutyId: a.dutyId,
      registration: p.registration ? a.registration.trim() : base.registration,
      bay: p.bay ? (existing && a.bay === existing.bay ? existing.bay : a.bay.trim()) : base.bay,
      arrival: !hasArrival(a)
        ? existing?.handling === a.handling
          ? base.arrival
          : newLeg()
        : {
            ...a.arrival,
            flight: p.flights ? flightEntry(a.airline, a.arrival.flight) : base.arrival.flight,
            status: p.statuses ? a.arrival.status : base.arrival.status,
            origin: p.statuses ? a.arrival.origin : base.arrival.origin,
            scheduled: p.gateTimes ? a.arrival.scheduled : base.arrival.scheduled,
            actual: p.gateTimes ? a.arrival.actual : base.arrival.actual,
          },
      departure: !hasDeparture(a)
        ? existing?.handling === a.handling
          ? base.departure
          : newLeg()
        : {
            ...a.departure,
            flight: p.flights ? flightEntry(a.airline, a.departure.flight) : base.departure.flight,
            status: p.statuses ? a.departure.status : base.departure.status,
            origin: p.statuses ? a.departure.origin : base.departure.origin,
            scheduled: p.gateTimes ? a.departure.scheduled : base.departure.scheduled,
            actual: p.gateTimes ? a.departure.actual : base.departure.actual,
          },
      events: a.events.map((e) => ({
        ...e,
        notes: p.disruptionNotes ? e.notes : base.events.find((b) => b.id === e.id)?.notes || '',
      })),
      airline: a.airline.trim(),
      actualHandling: review === 'draft' ? a.actualHandling : true,
      status: review === 'draft' ? 'Draft' : 'Confirmed',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      revisions: [
        ...(existing?.revisions || []),
        {
          at: now,
          summary: `${review === 'draft' ? 'Draft' : 'Confirmed'} · explicit review confirmed`,
        },
      ],
    };
    afterSave(commit(saveAircraft(db, record)), (ok) => {
      if (!ok) {
        saving.current = false;
        setError(t('Storage is unavailable. Nothing was saved.', '儲存空間無法使用，尚未儲存。'));
        return;
      }
      onSaved();
      if (review === 'next') {
        setA({
          ...emptyAircraft(a.date, record.dutyId),
          handling: '',
          role: '',
          actualHandling: false,
        });
        setAttempted(false);
        setPerformed(false);
        setReview(null);
        setError('');
        saving.current = false;
      } else onClose();
    });
  }
  function validLink() {
    // Preserve historical associations on edits; never create a new leave/trash/orphan link.
    if (
      !a.dutyId ||
      a.dutyId === existing?.dutyId ||
      db.duties.some((d) => d.id === a.dutyId && d.status !== 'Trashed' && !d.leave)
    )
      return true;
    setError(
      t(
        'The selected Duty is no longer eligible. Choose another Duty or explicitly unlink before saving.',
        '所選更次已不再合資格，請選擇其他更次或明確解除連結後再儲存。',
      ),
    );
    return false;
  }
  function legFields(key: 'arrival' | 'departure') {
    const leg = a[key],
      arrival = key === 'arrival';
    const suggestion = p.gateTimes ? gateSuggestion(leg.scheduled, leg.actual) : null;
    const update = (part: Partial<Leg>) => patch({ [key]: { ...leg, ...part } });
    return (
      <section className="inset" key={key}>
        <h3>{arrival ? t('Arrival leg', '抵港航段') : t('Departure leg', '離港航段')}</h3>
        {p.statuses && (
          <>
            <Select
              label={
                arrival
                  ? t('Arrival Flight Status', '抵港航班狀態')
                  : t('Departure Flight Status', '離港航班狀態')
              }
              options={flightStatuses}
              value={leg.status}
              onChange={(e) =>
                update({ status: e.target.value as Leg['status'], origin: 'Self-reported' })
              }
            />
          </>
        )}
        {p.gateTimes && (
          <>
            <p className="muted">
              {t(
                'Hong Kong time · choose each date independently for overnight operations. Times are optional; scheduled times are not actual times.',
                '香港時間 · 跨日作業請分別選擇日期。時間可留空；表定時間不等於實際時間。',
              )}
            </p>
            <BlockTimeField
              key={`${a.id}-${key}-actual`}
              label={
                arrival
                  ? t('Actual In-Block Time (AIBT)', '實際入位時間（AIBT）')
                  : t('Actual Off-Block Time (AOBT)', '實際離位時間（AOBT）')
              }
              code={arrival ? 'AIBT' : 'AOBT'}
              value={leg.actual}
              fallbackDate={a.date}
              onChange={(actual) => update({ actual })}
            />
            <BlockTimeField
              key={`${a.id}-${key}-scheduled`}
              label={
                arrival
                  ? t('Scheduled In-Block Time (SIBT)', '表定入位時間（SIBT）')
                  : t('Scheduled Off-Block Time (SOBT)', '表定離位時間（SOBT）')
              }
              code={arrival ? 'SIBT' : 'SOBT'}
              value={leg.scheduled}
              fallbackDate={a.date}
              onChange={(scheduled) => update({ scheduled })}
            />
            {suggestion && (
              <div className="notice">
                {t('Timing suggestion', '時間分類建議')}: <strong>{l(suggestion)}</strong>.{' '}
                {p.statuses && (
                  <button
                    type="button"
                    onClick={() =>
                      update({ status: suggestion, origin: 'Confirmed mock gate suggestion' })
                    }
                  >
                    {t('Use suggestion explicitly', '明確採用此建議')}
                  </button>
                )}
                {p.statuses && leg.status !== suggestion && (
                  <p>
                    {t(
                      'Current manual status differs. It has not been changed.',
                      '目前手動狀態不同；系統未有覆寫。',
                    )}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>
    );
  }
  function addEvent() {
    patch({
      events: [
        ...a.events,
        {
          id: id(),
          category: 'Weather',
          involvement: 'Observed',
          resolution: 'Handed Over',
          notes: '',
        },
      ],
    });
  }
  function updateEvent(eventId: string, part: Partial<Disruption>) {
    patch({ events: a.events.map((e) => (e.id === eventId ? { ...e, ...part } : e)) });
  }
  const dutyText =
    !a.date && !selectedDuty
      ? t(
          'Unlinked Draft · no date; no Duty will be created',
          '未連結草稿 · 未定日期，不會建立更次',
        )
      : selectedDuty
        ? dutyOptionText(selectedDuty, l)
        : t('Unlinked · no Duty will be created', '未連結 · 不會建立更次');
  return (
    <>
      <Modal
        title={
          existing
            ? t('Edit Handling Record', '編輯航機處理紀錄')
            : t('New Handling Record', '新增航機處理紀錄')
        }
        onClose={() => {
          if (!closing) setDiscard(true);
        }}
        wide
        sheet
        closing={closing}
        upperKeyboardFocus
      >
        <p className="muted">
          {t('Fields marked with ', '標示 ')}
          <span className="required-marker">*</span>
          {t(
            ' are required for confirmed records. Drafts can be incomplete.',
            ' 的欄位為已確認紀錄必填；草稿可不完整。',
          )}
        </p>
        <form
          ref={form}
          noValidate
          className="handling-form"
          onSubmit={(e) => {
            e.preventDefault();
            openReview('close');
          }}
        >
          <div className="form-grid">
            <Field
              name="date"
              error={fieldError('date')}
              label={t('Handling Date · Hong Kong', '處理日期 · 香港')}
              type="date"
              value={a.date}
              onChange={(e) => {
                const date = e.target.value;
                patch({
                  date,
                  ...(!explicitDuty ? { dutyId: resolveDuty(date, db.duties).selected } : {}),
                });
              }}
            />
            <DutyPicker
              value={a.dutyId}
              duties={applicableDuties}
              onChange={(dutyId) => {
                setExplicitDuty(true);
                patch({ dutyId });
              }}
            />
          </div>
          {suggested.ambiguous && !a.dutyId && (
            <p className="notice amber">
              {t('Several Duties exist on this date. Please choose.', '此日期有多個更次，請選擇。')}
            </p>
          )}
          <AirlineCombobox
            value={a.airline}
            onChange={changeAirline}
            error={fieldError('airline')}
          />
          <Select
            name="handling"
            error={fieldError('handling')}
            label={t('Handling Type *', '處理類型 *')}
            placeholder={t('Select handling type', '選擇處理類型')}
            options={['Full Turnaround', 'Arrival Only', 'Departure Only']}
            value={a.handling}
            onChange={(e) => changeType(e.target.value as Aircraft['handling'])}
          />
          {p.flights && (hasArrival(a) || hasDeparture(a)) && (
            <div className="form-grid">
              {hasArrival(a) && (
                <FlightNumberField
                  name="arrival"
                  airline={a.airline}
                  error={fieldError('arrival')}
                  label={t('Arrival Flight Number *', '抵港航班編號 *')}
                  value={a.arrival.flight}
                  onChange={(flight) => patch({ arrival: { ...a.arrival, flight } })}
                />
              )}{' '}
              {hasDeparture(a) && (
                <FlightNumberField
                  name="departure"
                  airline={a.airline}
                  error={fieldError('departure')}
                  label={t('Departure Flight Number *', '離港航班編號 *')}
                  value={a.departure.flight}
                  onChange={(flight) => patch({ departure: { ...a.departure, flight } })}
                />
              )}
            </div>
          )}
          <AircraftTypeFields
            a={a}
            onChange={patch}
            errors={{ aircraftType: fieldError('aircraftType'), variant: fieldError('variant') }}
          />
          <Select
            name="role"
            error={fieldError('role')}
            label={t('My Role *', '本人角色 *')}
            options={roles}
            placeholder={t('Select my role', '選擇本人角色')}
            value={a.role}
            onChange={(e) => patch({ role: e.target.value as Aircraft['role'] })}
          />
          {p.registration && (
            <>
              <Field
                label={t('Aircraft Registration', '機身註冊')}
                value={a.registration}
                onChange={(e) => patch({ registration: e.target.value.toUpperCase() })}
              />
              {history && (
                <div className="notice">
                  {t('Local history suggests', '本機歷史建議')}: {history.airline} ·{' '}
                  {history.variant}
                  <button
                    type="button"
                    onClick={() => {
                      changeAirline(history.airline);
                      patch({
                        aircraftType: aircraftModel(history),
                        variant: history.variant,
                        family: history.family,
                        icao: history.icao,
                      });
                    }}
                  >
                    {t('Use suggestion', '採用建議')}
                  </button>
                </div>
              )}
            </>
          )}
          {p.bay && (
            <Field
              name="bay"
              label={t('Parking Bay *', '停機位 *')}
              error={fieldError('bay')}
              value={a.bay}
              onChange={(e) => patch({ bay: e.target.value })}
            />
          )}
          {(p.statuses || p.gateTimes) && (
            <>
              {hasArrival(a) && legFields('arrival')}
              {hasDeparture(a) && legFields('departure')}
            </>
          )}
          <details className="more-details">
            <summary>
              {t('More Details', '更多資料')}{' '}
              <span>{t('Optional fields & disruptions', '選填欄位及異常事件')}</span>
            </summary>
            <div className="details-content">
              <Select
                label={t(
                  'Disruption Status · independent of flight status',
                  '異常狀態 · 與航班狀態獨立',
                )}
                options={['Unknown', 'Normal', 'Disrupted']}
                value={a.disruption}
                onChange={(e) => patch({ disruption: e.target.value as Aircraft['disruption'] })}
              />
              <div className="section-title">
                <h3>
                  {t('Disruption Events', '異常事件')} ({a.events.length})
                </h3>
                <button type="button" onClick={addEvent}>
                  <Plus size={16} />
                  {t('Add event', '新增事件')}
                </button>
              </div>
              {a.disruption === 'Normal' && a.events.length > 0 && (
                <p className="notice amber">
                  {t(
                    'Events exist but status is Normal. Please review; events will be retained.',
                    '已有事件但狀態為正常，請覆核；事件會保留。',
                  )}
                </p>
              )}
              {a.events.map((event, i) => (
                <section className="inset" key={event.id}>
                  <div className="section-title">
                    <h3>
                      {t('Event', '事件')} {i + 1}
                    </h3>
                    <button
                      type="button"
                      aria-label={t(`Remove event ${i + 1}`, `移除事件 ${i + 1}`)}
                      onClick={() => patch({ events: a.events.filter((e) => e.id !== event.id) })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <Select
                      label={t('Category', '分類')}
                      options={disruptionCategories}
                      value={event.category}
                      onChange={(e) => updateEvent(event.id, { category: e.target.value })}
                    />
                    <Select
                      label={t('My involvement', '本人參與')}
                      options={['Observed', 'Assisted', 'Coordinated', 'Escalated']}
                      value={event.involvement}
                      onChange={(e) =>
                        updateEvent(event.id, {
                          involvement: e.target.value as Disruption['involvement'],
                        })
                      }
                    />
                    <Field
                      label={t(
                        'Disruption delay · whole minutes (optional)',
                        '異常延誤 · 整數分鐘（選填）',
                      )}
                      type="number"
                      min="0"
                      step="1"
                      value={event.delayMinutes ?? ''}
                      onChange={(e) => {
                        const n = e.target.valueAsNumber;
                        updateEvent(event.id, {
                          delayMinutes: Number.isSafeInteger(n) && n >= 0 ? n : undefined,
                        });
                      }}
                    />
                    <Select
                      label={t('Resolution', '結果')}
                      options={['Resolved', 'Escalated', 'Handed Over']}
                      value={event.resolution}
                      onChange={(e) =>
                        updateEvent(event.id, {
                          resolution: e.target.value as Disruption['resolution'],
                        })
                      }
                    />
                  </div>
                  <p aria-live="polite">
                    {t('Calculated Delay Severity', '計算延誤嚴重程度')}:{' '}
                    <strong>{l(delaySeverity(event.delayMinutes))}</strong>
                  </p>
                  <small>
                    {t(
                      'Source: your entered disruption duration, independent of flight times. Personal thresholds; no causation or official standard implied.',
                      '來源：自行輸入的異常持續時間，與航班時間獨立。個人門檻，不推斷因果或代表官方標準。',
                    )}
                  </small>
                  {event.impact && (
                    <p>
                      {t('Historical operational impact (preserved)', '歷史營運影響（保留原值）')}:{' '}
                      {l(event.impact)}
                    </p>
                  )}
                  {p.disruptionNotes && (
                    <TextArea
                      label={t('Event notes', '事件筆記')}
                      value={event.notes}
                      onChange={(e) => updateEvent(event.id, { notes: e.target.value })}
                    />
                  )}
                  <Select
                    label={t('Linked Career Journal', '連結職涯日誌')}
                    placeholder={t('No Journal link', '不連結日誌')}
                    options={db.journals.map((j) => ({ value: j.id, label: j.title }))}
                    value={event.journalId || ''}
                    onChange={(e) =>
                      updateEvent(event.id, { journalId: e.target.value || undefined })
                    }
                  />
                </section>
              ))}
              <TextArea
                label={t('Notes', '筆記')}
                value={a.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </div>
          </details>
          <p className="muted">
            <ShieldCheck size={15} />{' '}
            {t(
              'Privacy-controlled fields can be enabled for synthetic data in Settings.',
              '可在設定啟用私隱控制欄位，以測試虛構資料。',
            )}
          </p>
          {!review && issues.length > 0 && (
            <div role="alert" className="validation-summary">
              <strong>
                {t('Please complete the following required fields:', '請填妥以下必填欄位：')}
              </strong>
              <ul>
                {issues.map((issue) => (
                  <li key={issue.field}>
                    {fieldNames[issue.field]} — {fieldError(issue.field)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.date > today && (
            <p className="notice">
              {t(
                'Future Handling: save as Draft. It will display Pending until you explicitly confirm it after handling.',
                '未來處理紀錄請儲存為草稿，將顯示待處理；完成實際處理後須明確確認。',
              )}
            </p>
          )}
          {!review && error && (
            <p role="alert" className="validation-summary">
              {error}
            </p>
          )}
          <div className="actions sticky-actions">
            <button type="button" onClick={() => openReview('draft')}>
              {t('Save Draft', '儲存草稿')}
            </button>
            <button type="button" onClick={() => openReview('next')}>
              {t('Save & Add Next', '儲存並新增下一項')}
            </button>
            <button className="primary" type="submit">
              {t('Save & Close', '儲存並關閉')}
            </button>
          </div>
        </form>
      </Modal>
      {review && (
        <Modal
          title={t('Review Handling Record', '覆核航機處理紀錄')}
          sheet
          closing={reviewClosing}
          onClose={closeReview}
        >
          <div className="airline-selection">
            <AirlineLogo airline={a.airline} size="sm" showName />
          </div>
          <p className="notice">
            {t(
              'Nothing has been saved yet. Check every detail before confirming.',
              '目前尚未儲存，請確認所有資料。',
            )}
          </p>
          <dl className="review-list">
            <dt>{t('Handling Date', '處理日期')}</dt>
            <dd>{a.date || t('Undated Draft', '未定日期草稿')} · Asia/Hong_Kong</dd>
            <dt>{t('Duty', '更次')}</dt>
            <dd>{dutyText}</dd>
            <dt>{t('Airline + Flight Number(s)', '航空公司及航班編號')}</dt>
            <dd>
              {a.airline || '—'}{' '}
              {p.flights &&
                [
                  hasArrival(a) && flightEntry(a.airline, a.arrival.flight),
                  hasDeparture(a) && flightEntry(a.airline, a.departure.flight),
                ]
                  .filter(Boolean)
                  .join(' / ')}
            </dd>
            <dt>{t('Aircraft Type + Registration', '航機型號及機身註冊')}</dt>
            <dd>
              {aircraftModel(a) || '—'} · {a.variant || '—'}
              {p.registration && a.registration ? ` (${a.registration})` : ''}
            </dd>
            <dt>{t('My Role / Handling Type', '本人角色／處理類型')}</dt>
            <dd>
              {l(a.role) || '—'} · {l(a.handling) || '—'}
            </dd>
            {p.bay && (
              <>
                <dt>{t('Parking Bay', '停機位')}</dt>
                <dd>{a.bay || '—'}</dd>
              </>
            )}
            {(['arrival', 'departure'] as const)
              .filter((key) => (key === 'arrival' ? hasArrival(a) : hasDeparture(a)))
              .map((key) => (
                <div className="review-leg" key={key}>
                  {p.statuses && (
                    <>
                      <dt>
                        {key === 'arrival'
                          ? t('Arrival Status', '抵港狀態')
                          : t('Departure Status', '離港狀態')}
                      </dt>
                      <dd>{l(a[key].status)}</dd>
                    </>
                  )}
                  {p.gateTimes && (
                    <>
                      <dt>{key === 'arrival' ? 'SIBT → AIBT' : 'SOBT → AOBT'}</dt>
                      <dd>
                        {a[key].scheduled ? gateText(a[key].scheduled, true) : '—'} →{' '}
                        {a[key].actual ? gateText(a[key].actual, true) : '—'} HKT
                      </dd>
                    </>
                  )}
                </div>
              ))}
            <dt>{t('Disruption', '異常')}</dt>
            <dd>
              {l(a.disruption)} · {a.events.length} {t('events', '事件')}
              {a.events.map((e) => (
                <p key={e.id}>
                  {l(e.category)} · {l(e.involvement)} · {l(e.resolution)}
                  {e.impact ? ` · ${t('Historical impact', '歷史影響')}: ${l(e.impact)}` : ''}
                  {` · ${t('Calculated Delay Severity', '計算延誤嚴重程度')}: ${l(delaySeverity(e.delayMinutes))}`}
                  {e.delayMinutes !== undefined ? ` (${e.delayMinutes} min)` : ''}
                  {p.disruptionNotes && e.notes ? ` · ${e.notes}` : ''}
                  {e.journalId
                    ? ` · Journal: ${db.journals.find((j) => j.id === e.journalId)?.title || '—'}`
                    : ''}
                </p>
              ))}
            </dd>
            <dt>{t('Notes', '筆記')}</dt>
            <dd>{a.notes || '—'}</dd>
            <dt>{t('Actual handling', '實際處理')}</dt>
            <dd>
              {(review === 'draft' ? a.actualHandling : performed)
                ? t('Yes', '有')
                : t('Not confirmed', '尚未確認')}
            </dd>
            <dt>{t('Will be saved as', '將儲存為')}</dt>
            <dd>
              <Badge tone="teal">
                {l(
                  review === 'draft'
                    ? handlingDisplayStatus({ ...a, status: 'Draft' })
                    : 'Confirmed',
                )}
              </Badge>{' '}
              · {t('This device only', '僅此裝置')}
            </dd>
          </dl>
          {a.disruption === 'Normal' && a.events.length > 0 && (
            <p className="notice amber">
              {t('Inconsistency: Normal with recorded events.', '不一致：正常但已有事件。')}
            </p>
          )}
          {matches.length > 0 && (
            <div className="notice amber">
              <strong>
                {t('Possible duplicate handling record', '可能重複的航機處理紀錄')} (
                {matches.length})
              </strong>
              <label className="check">
                <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
                {t('Keep as separate assignment', '保留為獨立處理紀錄')}
              </label>
            </div>
          )}
          {review !== 'draft' && (
            <label className="check completion-check">
              <input
                type="checkbox"
                checked={performed}
                onChange={(e) => setPerformed(e.target.checked)}
              />
              {t(
                'I confirm this handling assignment actually occurred.',
                '我確認此航機處理任務已實際發生。',
              )}
            </label>
          )}
          {error && (
            <p role="alert" className="validation-summary">
              {error}
            </p>
          )}
          <div className="actions">
            <button onClick={closeReview}>{t('Back to Edit', '返回修改')}</button>
            <button
              className="primary"
              disabled={(matches.length > 0 && !keep) || (review !== 'draft' && !performed)}
              onClick={confirmSave}
            >
              {t('Confirm & Save', '確認並儲存')}
            </button>
          </div>
        </Modal>
      )}
      {pendingType !== null && (
        <Confirm
          title={t('Change Handling Type?', '更改處理類型？')}
          onClose={() => setPendingType(null)}
          onConfirm={() => {
            patch({ handling: pendingType });
            setPendingType(null);
          }}
          confirmLabel={t('Change type', '更改類型')}
        >
          <p>
            {t(
              'Saved flight, status and timing values for inapplicable legs, including archived values, will be removed only after reviewed save. Temporary input is kept if you switch back before saving.',
              '不適用航段已儲存的航班、狀態及時間（包括封存值）只會在覆核儲存後移除；儲存前切回原類型會保留暫存輸入。',
            )}
          </p>
        </Confirm>
      )}
      {discard && (
        <Confirm
          title={t('Close without saving?', '關閉而不儲存？')}
          onClose={() => setDiscard(false)}
          onConfirm={() => {
            setDiscard(false);
            onClose();
          }}
          confirmLabel={t('Discard changes', '捨棄修改')}
        >
          <p>
            {t(
              'Unsaved edits will be discarded. No record or Duty will be created.',
              '未儲存的修改將被捨棄，不會建立紀錄或更次。',
            )}
          </p>
        </Confirm>
      )}
    </>
  );
}
