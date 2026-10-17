import { useRef, useState } from 'react';
import type { Database, Duty } from '../domain/model';
import { hkToday, id } from '../domain/model';
import { appendRoster, monthDates, rosterConflicts, shiftRange } from '../domain/roster';
import { Confirm, Field, Modal, Select, TextArea } from '../components/ui';
import { useLabel, useT } from '../i18n';

const shiftTypes = ['Day', 'Evening', 'Night', 'Custom'] as const;
type ShiftType = (typeof shiftTypes)[number];

export default function BatchDutyEditor({
  db,
  commit,
  onClose,
}: {
  db: Database;
  commit: (next: Database) => boolean;
  onClose: () => void;
}) {
  const t = useT(),
    l = useLabel();
  const [month, setMonth] = useState(hkToday().slice(0, 7));
  const [selected, setSelected] = useState<string[]>([]);
  const [type, setType] = useState<ShiftType>('Day');
  const [templates, setTemplates] = useState<Record<ShiftType, { start: string; end: string }>>({
    Day: { start: '', end: '' },
    Evening: { start: '', end: '' },
    Night: { start: '', end: '' },
    Custom: { start: '', end: '' },
  });
  const [confirmedHours, setConfirmedHours] = useState(false);
  const [entries, setEntries] = useState<Duty[]>([]);
  const [review, setReview] = useState(false);
  const [override, setOverride] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const dates = monthDates(month);
  const offset = dates.length ? new Date(`${dates[0]}T00:00:00Z`).getUTCDay() : 0;
  const template = templates[type];
  const conflicts = rosterConflicts(entries, db.duties);
  const duplicates = conflicts.some((c) => c.kind === 'duplicate');
  const invalid = entries.some((d) => !shiftRange(d));
  const requestClose = () => (entries.length || selected.length ? setDiscard(true) : onClose());
  const patchEntry = (entryId: string, patch: Partial<Duty>) => {
    setEntries((rows) => rows.map((row) => (row.id === entryId ? { ...row, ...patch } : row)));
    setOverride(false);
    setError('');
  };
  function applyTemplate() {
    if (
      !selected.length ||
      !confirmedHours ||
      selected.some((date) => !shiftRange({ date, ...template }))
    ) {
      setError(
        t(
          'Select dates, enter different valid start/end times and confirm your template hours.',
          '請選擇日期、輸入不同的有效開更及完更時間，並確認自訂時段。',
        ),
      );
      return;
    }
    setEntries((rows) => [
      ...rows,
      ...[...selected].sort().map((date) => ({
        id: id(),
        date,
        ...template,
        shiftType: type,
        status: 'Confirmed' as const,
        workState: 'Planned' as const,
        notes: '',
      })),
    ]);
    setSelected([]);
    setOverride(false);
    setError('');
  }
  function save() {
    if (
      saving.current ||
      !review ||
      !entries.length ||
      invalid ||
      duplicates ||
      (conflicts.length > 0 && !override)
    )
      return;
    saving.current = true;
    if (commit(appendRoster(db, entries))) onClose();
    else {
      saving.current = false;
      setError(
        t(
          'Could not save locally. Your pending entries are retained; retry after resolving storage access.',
          '未能在本機儲存，待存更次仍保留；請處理儲存問題後重試。',
        ),
      );
    }
  }
  return (
    <>
      <Modal
        title={
          review ? t('Review Batch Duties', '覆核批次更次') : t('Batch Add Duties', '批次新增更次')
        }
        onClose={requestClose}
        wide
      >
        <p className="notice">
          {t(
            'Roster entries are Planned, not work completed. Day / Evening / Night are personal labels; no official employer hours are supplied.',
            '更表項目為計劃中，不代表已完成工作。日更／晚更／夜更只是個人標籤，沒有提供官方僱主更次時間。',
          )}
        </p>
        {!review && (
          <>
            <Field
              label={t('Roster month and year', '更表月份及年份')}
              type="month"
              min="1900-01"
              max="9999-12"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <div className="roster-layout">
              <section className="panel calendar">
                <h3>{t('Select multiple dates', '選擇多個日期')}</h3>
                <div className="calendar-grid roster-calendar">
                  {t('Sun,Mon,Tue,Wed,Thu,Fri,Sat', '日,一,二,三,四,五,六')
                    .split(',')
                    .map((day) => (
                      <small key={day}>{day}</small>
                    ))}
                  {Array.from({ length: offset }, (_, i) => (
                    <span key={`blank-${i}`} />
                  ))}
                  {dates.map((date) => (
                    <button
                      key={date}
                      className={selected.includes(date) ? 'active' : ''}
                      aria-label={t(`Select ${date}`, `選擇 ${date}`)}
                      aria-pressed={selected.includes(date)}
                      onClick={() =>
                        setSelected((rows) =>
                          rows.includes(date) ? rows.filter((d) => d !== date) : [...rows, date],
                        )
                      }
                    >
                      {Number(date.slice(-2))}
                      {entries.some((d) => d.date === date) && <span className="calendar-dot" />}
                    </button>
                  ))}
                </div>
                <p>
                  {t('Selected dates', '已選日期')}: {selected.length}
                </p>
                <button onClick={() => setSelected([])} disabled={!selected.length}>
                  {t('Clear date selection', '清除日期選擇')}
                </button>
              </section>
              <section className="inset">
                <h3>{t('Your shift template', '你的更次範本')}</h3>
                <Select
                  label={t('Shift template', '更次範本')}
                  options={shiftTypes}
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value as ShiftType);
                    setConfirmedHours(false);
                  }}
                />
                <div className="form-grid">
                  <Field
                    label={t('Template start', '範本開更時間')}
                    type="time"
                    value={template.start}
                    onChange={(e) => {
                      setTemplates({
                        ...templates,
                        [type]: { ...template, start: e.target.value },
                      });
                      setConfirmedHours(false);
                    }}
                  />
                  <Field
                    label={t('Template end', '範本完更時間')}
                    type="time"
                    value={template.end}
                    onChange={(e) => {
                      setTemplates({ ...templates, [type]: { ...template, end: e.target.value } });
                      setConfirmedHours(false);
                    }}
                  />
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={confirmedHours}
                    onChange={(e) => setConfirmedHours(e.target.checked)}
                  />
                  {t(
                    'I confirm these are my chosen hours, not an official HAS schedule.',
                    '我確認這是自行選定的時段，並非 HAS 官方更表。',
                  )}
                </label>
                <button className="primary" onClick={applyTemplate}>
                  {t('Apply template to selected dates', '套用範本至所選日期')}
                </button>
              </section>
            </div>
          </>
        )}
        <h3>
          {t('Pending duties', '待存更次')} · {entries.length}
        </h3>
        <p className="muted">
          {t(
            'Start dates determine the Hong Kong Duty date. An earlier end time means the following day. Equal start/end times are not accepted.',
            '香港開更日期決定更次所屬日期。完更時間較早表示翌日完更；不接受相同的開更及完更時間。',
          )}
        </p>
        <div className="roster-entries">
          {entries.map((entry, i) => {
            const range = shiftRange(entry);
            return (
              <section
                className="inset"
                key={entry.id}
                aria-label={t(`Pending duty ${i + 1}`, `待存更次 ${i + 1}`)}
              >
                <div className="section-title">
                  <strong>
                    {i + 1}. {entry.date} · {l(entry.shiftType || 'Custom')} · {l('Planned')}
                  </strong>
                  {!review && (
                    <button
                      onClick={() => {
                        setEntries((rows) => rows.filter((d) => d.id !== entry.id));
                        setOverride(false);
                      }}
                    >
                      {t(`Remove duty ${i + 1}`, `移除更次 ${i + 1}`)}
                    </button>
                  )}
                </div>
                {review ? (
                  <>
                    <p>
                      {entry.start} → {range?.endDate} {entry.end} HKT{' '}
                      {range?.overnight ? t('(next day)', '（翌日）') : ''}
                    </p>
                    {entry.notes && <p className="preserve-lines">{entry.notes}</p>}
                  </>
                ) : (
                  <>
                    <div className="form-grid roster-entry-fields">
                      <Field
                        label={t(`Duty ${i + 1} date`, `更次 ${i + 1} 日期`)}
                        type="date"
                        value={entry.date}
                        onChange={(e) => patchEntry(entry.id, { date: e.target.value })}
                      />
                      <Select
                        label={t(`Duty ${i + 1} type`, `更次 ${i + 1} 類型`)}
                        options={shiftTypes}
                        value={entry.shiftType}
                        onChange={(e) =>
                          patchEntry(entry.id, { shiftType: e.target.value as ShiftType })
                        }
                      />
                      <Field
                        label={t(`Duty ${i + 1} start`, `更次 ${i + 1} 開始`)}
                        type="time"
                        value={entry.start}
                        onChange={(e) => patchEntry(entry.id, { start: e.target.value })}
                      />
                      <Field
                        label={t(`Duty ${i + 1} end`, `更次 ${i + 1} 結束`)}
                        type="time"
                        value={entry.end}
                        onChange={(e) => patchEntry(entry.id, { end: e.target.value })}
                      />
                    </div>
                    <TextArea
                      label={t(
                        `Duty ${i + 1} notes · synthetic only`,
                        `更次 ${i + 1} 筆記 · 只限虛構`,
                      )}
                      value={entry.notes}
                      onChange={(e) => patchEntry(entry.id, { notes: e.target.value })}
                    />
                    <p>
                      {range
                        ? `${entry.date} ${entry.start} → ${range.endDate} ${entry.end} HKT`
                        : t(
                            'Enter a valid date and different start/end times.',
                            '請輸入有效日期及不同的開更、完更時間。',
                          )}
                    </p>
                  </>
                )}
              </section>
            );
          })}
        </div>
        {conflicts.length > 0 && (
          <section className="notice amber" aria-label={t('Roster conflicts', '更表衝突')}>
            <h3>{t('Review conflicts', '覆核衝突')}</h3>
            {conflicts.map((conflict, i) => (
              <p key={i}>
                {conflict.kind === 'duplicate'
                  ? t('Exact duplicate — edit or remove', '完全重複 — 請修改或移除')
                  : t('Overlapping shifts', '更次時段重疊')}
                : {conflict.entry.date} {conflict.entry.start}–{conflict.entry.end} ↔{' '}
                {conflict.other.date} {conflict.other.start}–{conflict.other.end} ·{' '}
                {conflict.saved ? t('saved Duty', '已儲存更次') : t('pending Duty', '待存更次')}
              </p>
            ))}
            {!duplicates && review && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => setOverride(e.target.checked)}
                />
                {t(
                  'I reviewed every overlap and intentionally keep these separate duties.',
                  '我已覆核每項時段重疊，並確定保留為獨立更次。',
                )}
              </label>
            )}
          </section>
        )}
        {error && (
          <p role="alert" className="notice amber">
            {error}
          </p>
        )}
        <div className="actions sticky-actions">
          {review ? (
            <>
              <button
                onClick={() => {
                  setReview(false);
                  setOverride(false);
                }}
              >
                {t('Back to Edit', '返回修改')}
              </button>
              <button
                className="primary"
                onClick={save}
                disabled={
                  !entries.length || invalid || duplicates || (conflicts.length > 0 && !override)
                }
              >
                {t('Confirm & Save Batch', '確認並儲存批次')}
              </button>
            </>
          ) : (
            <>
              <button onClick={requestClose}>{t('Cancel', '取消')}</button>
              <button
                className="primary"
                disabled={!entries.length || invalid}
                onClick={() => {
                  setReview(true);
                  setOverride(false);
                  setError('');
                }}
              >
                {t('Review Batch', '覆核批次')}
              </button>
            </>
          )}
        </div>
      </Modal>
      {discard && (
        <Confirm
          title={t('Discard pending roster?', '捨棄待存更表？')}
          onClose={() => setDiscard(false)}
          onConfirm={onClose}
          confirmLabel={t('Discard changes', '捨棄修改')}
        >
          <p>{t('No pending duties have been saved.', '尚未儲存任何待存更次。')}</p>
        </Confirm>
      )}
    </>
  );
}
