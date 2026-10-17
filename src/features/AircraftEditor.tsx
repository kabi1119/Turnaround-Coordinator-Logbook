import { useRef, useState } from 'react';
import { Plus, Trash2, Search, ShieldCheck } from 'lucide-react';
import type { Aircraft, Database, Disruption, Duty, Leg } from '../domain/model';
import {
  disruptionCategories,
  emptyAircraft,
  flightStatuses,
  handlingTypes,
  hkToday,
  id,
  roles,
} from '../domain/model';
import {
  duplicates,
  gateSuggestion,
  hasArrival,
  hasDeparture,
  isComplete,
  normalizeRegistration,
  resolveDuty,
  saveAircraft,
  visibleAircraft,
} from '../domain/selectors';
import { demoBays, variants } from '../data/reference';
import { Confirm, Field, Modal, Select, TextArea, Badge } from '../components/ui';
import { useLabel, useT } from '../i18n';
import AirlineLogo from '../components/AirlineLogo';
import AirlineCombobox from '../components/AirlineCombobox';
export interface EditorProps {
  db: Database;
  existing?: Aircraft;
  dutyId?: string;
  onClose: () => void;
  commit: (db: Database) => boolean;
  onSaved: () => void;
}
export default function AircraftEditor({
  db,
  existing,
  dutyId,
  onClose,
  commit,
  onSaved,
}: EditorProps) {
  const t = useT(),
    l = useLabel(),
    p = db.settings.privacy;
  const chosen = db.duties.find((d) => d.id === dutyId);
  const [a, setA] = useState<Aircraft>(() =>
    existing
      ? visibleAircraft(structuredClone(existing), p)
      : emptyAircraft(
          chosen?.date || hkToday(),
          chosen?.id || resolveDuty(hkToday(), db.duties).selected,
        ),
  );
  const [review, setReview] = useState<'close' | 'next' | 'draft' | null>(null),
    [error, setError] = useState(''),
    [keep, setKeep] = useState(false),
    [discard, setDiscard] = useState(false);
  const saving = useRef(false);
  const patch = (part: Partial<Aircraft>) => setA((prev) => ({ ...prev, ...part }));
  const applicableDuties = db.duties.filter((d) => d.status !== 'Trashed');
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
  function openReview(mode: 'close' | 'next' | 'draft') {
    setError('');
    if (!a.date && mode !== 'draft') {
      setError(
        t(
          'Choose a handling date, or save an undated Draft.',
          '請選擇處理日期，或儲存未定日期草稿。',
        ),
      );
      return;
    }
    if (!a.dutyId && (mode !== 'draft' || a.date)) {
      setError(
        t(
          'Choose a Duty. Multiple candidate shifts must be selected explicitly.',
          '請選擇更次；有多個候選時必須明確選擇。',
        ),
      );
      return;
    }
    if (mode !== 'draft' && !isComplete(a)) {
      setError(
        t(
          'Complete the four core fields and confirm actual handling, or choose Save Draft.',
          '請填妥四項核心欄位並確認有實際處理，或選儲存草稿。',
        ),
      );
      return;
    }
    setKeep(false);
    saving.current = false;
    setReview(mode);
  }
  function confirmSave() {
    if (saving.current || !review || (matches.length > 0 && !keep)) return;
    saving.current = true;
    const now = new Date().toISOString();
    const newDuty: Duty | undefined =
      a.dutyId === 'new' && a.date
        ? {
            id: id(),
            date: a.date,
            start: '',
            end: '',
            status: 'Draft',
            notes: 'DEMO · Created at Aircraft confirmation',
          }
        : undefined;
    // Disabled values remain archived on edits; only enabled fields accept new values.
    const base = existing || emptyAircraft(a.date);
    const record: Aircraft = {
      ...a,
      dutyId: newDuty?.id || (a.dutyId === 'new' ? '' : a.dutyId),
      registration: p.registration ? a.registration.trim() : base.registration,
      bay: p.bay ? a.bay.trim().toUpperCase() : base.bay,
      arrival: {
        ...a.arrival,
        flight: p.flights ? a.arrival.flight.trim() : base.arrival.flight,
        status: p.statuses ? a.arrival.status : base.arrival.status,
        origin: p.statuses ? a.arrival.origin : base.arrival.origin,
        scheduled: p.gateTimes ? a.arrival.scheduled : base.arrival.scheduled,
        actual: p.gateTimes ? a.arrival.actual : base.arrival.actual,
      },
      departure: {
        ...a.departure,
        flight: p.flights ? a.departure.flight.trim() : base.departure.flight,
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
    if (!commit(saveAircraft(db, record, newDuty))) {
      saving.current = false;
      setError(t('Storage is unavailable. Nothing was saved.', '儲存空間無法使用，尚未儲存。'));
      return;
    }
    onSaved();
    if (review === 'next') {
      setA(emptyAircraft(a.date, record.dutyId));
      setReview(null);
      setError('');
      saving.current = false;
    } else onClose();
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
            <small>
              {l(leg.origin)} · {t('Personal category, not official OTP', '個人分類，並非官方 OTP')}
            </small>
          </>
        )}
        {p.gateTimes && (
          <>
            <p className="muted">
              {arrival ? 'SIBT → AIBT' : 'SOBT → AOBT'} · Asia/Hong_Kong (+08:00).{' '}
              {t(
                'Mock gate/stand times only. Never chocks or runway times.',
                '僅模擬停機位時間，非輪擋或跑道時間。',
              )}
            </p>
            <div className="form-grid">
              <Field
                label={t('Scheduled gate / stand', '表定停機位時間')}
                type="datetime-local"
                step="1"
                value={leg.scheduled}
                onChange={(e) => update({ scheduled: e.target.value })}
              />
              <Field
                label={t('Actual gate / stand', '實際停機位時間')}
                type="datetime-local"
                step="1"
                value={leg.actual}
                onChange={(e) => update({ actual: e.target.value })}
              />
            </div>
            {suggestion && (
              <div className="notice">
                {t('Mock gate suggestion', '模擬停機位時間建議')}: <strong>{l(suggestion)}</strong>.{' '}
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
          impact: 'Minor',
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
      : a.dutyId === 'new'
        ? t(
            `New Draft Duty · ${a.date} (created only after confirmation)`,
            `新草稿更次 · ${a.date}（確認後才建立）`,
          )
        : `${selectedDuty?.date || ''} · ${selectedDuty?.start || '—'}–${selectedDuty?.end || '—'} · ${l(selectedDuty?.status || '')}`;
  return (
    <>
      <Modal
        title={existing ? t('Edit Aircraft', '編輯航機') : t('New Aircraft', '新增航機')}
        onClose={() => setDiscard(true)}
        wide
      >
        <p className="muted">
          {t(
            'One assignment. Four core fields. Always review before saving.',
            '一項處理紀錄。四項核心欄位。每次儲存前必須覆核。',
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            openReview('close');
          }}
        >
          <div className="form-grid">
            <Field
              label={t('Handling Date · Hong Kong', '處理日期 · 香港')}
              type="date"
              value={a.date}
              onChange={(e) => {
                const date = e.target.value;
                patch({ date, dutyId: resolveDuty(date, db.duties).selected });
              }}
            />
            <Select
              label={t('Duty / Shift', '所屬更次')}
              value={a.dutyId}
              placeholder={t('Choose a Duty explicitly', '請明確選擇更次')}
              options={[
                ...applicableDuties.map((d) => ({
                  value: d.id,
                  label: `${d.date} · ${d.start || '—'}–${d.end || '—'} · ${l(d.status)} · ${d.id.slice(0, 5)}`,
                })),
                {
                  value: 'new',
                  label: a.date
                    ? t('Create a new Draft Duty at confirmation', '確認時建立新的草稿更次')
                    : t('Undated Draft · no new Duty', '未定日期草稿 · 不新增更次'),
                },
              ]}
              onChange={(e) => patch({ dutyId: e.target.value })}
            />
          </div>
          {suggested.ambiguous && !a.dutyId && (
            <p className="notice amber">
              {t('Several Duties exist on this date. Please choose.', '此日期有多個更次，請選擇。')}
            </p>
          )}
          <AirlineCombobox value={a.airline} onChange={(airline) => patch({ airline })} />
          {p.flights && (
            <div className="form-grid">
              {hasArrival(a) && (
                <Field
                  label={t('Arrival Flight Number · optional', '抵港航班編號 · 選填')}
                  value={a.arrival.flight}
                  onChange={(e) => patch({ arrival: { ...a.arrival, flight: e.target.value } })}
                />
              )}{' '}
              {hasDeparture(a) && (
                <Field
                  label={t('Departure Flight Number · optional', '離港航班編號 · 選填')}
                  value={a.departure.flight}
                  onChange={(e) => patch({ departure: { ...a.departure, flight: e.target.value } })}
                />
              )}
            </div>
          )}
          <Select
            label={t('Aircraft Type / Variant *', '航機型號／子型號 *')}
            options={variants.map((v) => v.name)}
            placeholder={t('Select variant', '選擇子型號')}
            value={a.variant}
            onChange={(e) => {
              const v = variants.find((v) => v.name === e.target.value);
              patch({ variant: v?.name || '', family: v?.family || '', icao: v?.icao || '' });
            }}
          />
          <div className="form-grid">
            <Select
              label={t('Handling Type *', '處理類型 *')}
              options={handlingTypes}
              value={a.handling}
              onChange={(e) => patch({ handling: e.target.value as Aircraft['handling'] })}
            />
            <Select
              label={t('My Role *', '本人角色 *')}
              options={roles}
              value={a.role}
              onChange={(e) => patch({ role: e.target.value as Aircraft['role'] })}
            />
          </div>
          <details className="more-details">
            <summary>
              {t('More Details', '更多資料')}{' '}
              <span>{t('Optional fields & disruptions', '選填欄位及異常事件')}</span>
            </summary>
            <div className="details-content">
              {p.registration && (
                <>
                  <Field
                    label={t('Registration · local history lookup', '機身註冊 · 本機歷史查詢')}
                    value={a.registration}
                    onChange={(e) => patch({ registration: e.target.value.toUpperCase() })}
                  />
                  {history && (
                    <div className="notice">
                      {t('Local demo history suggests', '本機示範歷史建議')}: {history.airline} ·{' '}
                      {history.variant}
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            airline: history.airline,
                            variant: history.variant,
                            family: history.family,
                            icao: history.icao,
                          })
                        }
                      >
                        {t('Use suggestion', '採用建議')}
                      </button>
                    </div>
                  )}
                  <button type="button" disabled>
                    <Search size={16} />
                    {t(
                      'Search Public Database · Future feature — not connected in prototype',
                      '搜尋公開資料庫 · 未來功能，原型未連接',
                    )}
                  </button>
                </>
              )}
              {p.bay && (
                <>
                  <Field
                    label={t('Parking Bay · search or custom', '停機位 · 搜尋或自訂')}
                    list="demo-bays"
                    value={a.bay}
                    onChange={(e) => patch({ bay: e.target.value.toUpperCase() })}
                  />
                  <datalist id="demo-bays">
                    {demoBays.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                  <p className="muted">
                    {t(
                      'Demo suggestions only — not a verified current HKIA stand catalog. Custom values welcome.',
                      '僅示範建議，並非已核實的現行香港機場停機位清單；可自行輸入。',
                    )}
                  </p>
                </>
              )}
              {(p.statuses || p.gateTimes) && (
                <>
                  {hasArrival(a) && legFields('arrival')}
                  {hasDeparture(a) && legFields('departure')}
                </>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={a.actualHandling}
                  onChange={(e) => patch({ actualHandling: e.target.checked })}
                />
                {t(
                  'Actual handling took place (synthetic scenario). A cancellation without handling cannot be Confirmed.',
                  '此合成情境有實際處理工作；純取消且無處理不能確認。',
                )}
              </label>
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
                    <Select
                      label={t('Impact · subjective', '影響 · 主觀分類')}
                      options={['Minor', 'Moderate', 'Major']}
                      value={event.impact}
                      onChange={(e) =>
                        updateEvent(event.id, { impact: e.target.value as Disruption['impact'] })
                      }
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
                  {p.disruptionNotes && (
                    <TextArea
                      label={t('Sanitized demo event notes', '去識別化示範事件筆記')}
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
                label={t('Notes · synthetic only', '筆記 · 只限虛構資料')}
                value={a.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </div>
          </details>
          <p className="muted">
            <ShieldCheck size={15} />{' '}
            {t(
              'Restricted optional fields can be enabled for synthetic data in Settings.',
              '可在設定啟用受限制選填欄位，以測試虛構資料。',
            )}
          </p>
          {error && (
            <p role="alert" className="notice amber">
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
        <Modal title={t('Review / Double-check', '覆核／再次核對')} onClose={() => setReview(null)}>
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
                [hasArrival(a) && a.arrival.flight, hasDeparture(a) && a.departure.flight]
                  .filter(Boolean)
                  .join(' / ')}
            </dd>
            <dt>{t('Aircraft Type + Registration', '航機型號及機身註冊')}</dt>
            <dd>
              {a.variant || '—'}
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
                      <dd>
                        {l(a[key].status)} · {l(a[key].origin)}
                      </dd>
                    </>
                  )}
                  {p.gateTimes && (
                    <>
                      <dt>{key === 'arrival' ? 'SIBT → AIBT' : 'SOBT → AOBT'}</dt>
                      <dd>
                        {a[key].scheduled || '—'} → {a[key].actual || '—'} (+08:00)
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
                  {l(e.category)} · {l(e.involvement)} · {l(e.impact)} · {l(e.resolution)}
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
              {a.actualHandling
                ? t('Yes · synthetic', '有 · 合成情境')
                : t('No · Draft only', '無 · 僅草稿')}
            </dd>
            <dt>{t('Will be saved as', '將儲存為')}</dt>
            <dd>
              <Badge tone="teal">{l(review === 'draft' ? 'Draft' : 'Confirmed')}</Badge> ·{' '}
              {t('This device only', '僅此裝置')}
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
                {t('Possible duplicate assignment', '可能重複的處理紀錄')} ({matches.length})
              </strong>
              <label className="check">
                <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
                {t('Keep as separate assignment', '保留為獨立處理紀錄')}
              </label>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="actions">
            <button onClick={() => setReview(null)}>{t('Back to Edit', '返回修改')}</button>
            <button
              className="primary"
              disabled={matches.length > 0 && !keep}
              onClick={confirmSave}
            >
              {t('Confirm & Save', '確認並儲存')}
            </button>
          </div>
        </Modal>
      )}
      {discard && (
        <Confirm
          title={t('Close without saving?', '關閉而不儲存？')}
          onClose={() => setDiscard(false)}
          onConfirm={onClose}
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
