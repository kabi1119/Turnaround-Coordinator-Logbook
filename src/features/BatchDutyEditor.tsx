import { useRef, useState } from 'react';
import { useMotionClose } from '../lib/useMotionClose';
import type { Database, Duty } from '../domain/model';
import { hkToday, id } from '../domain/model';
import { dutyOptionText, rosterConflicts, shiftRange } from '../domain/roster';
import {
  batchProblem,
  commitDutyBatch,
  eligibleSickDuty,
  validDutyDate,
  type DutyKind,
} from '../domain/dutyCalendar';
import DutyCalendar from '../components/DutyCalendar';
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
  const [kind, setKind] = useState<DutyKind>('Scheduled');
  const [targets, setTargets] = useState<Record<string, string>>({});
  const { closing, close: animateClose } = useMotionClose(onClose);
  function finishClose() {
    setDiscard(false);
    animateClose();
  }
  const [type, setType] = useState<ShiftType>('Day');
  const [templates, setTemplates] = useState<Record<ShiftType, { start: string; end: string }>>({
    Day: { start: '', end: '' },
    Evening: { start: '', end: '' },
    Night: { start: '', end: '' },
    Custom: { start: '', end: '' },
  });
  const [entries, setEntries] = useState<Duty[]>([]);
  const [review, setReview] = useState(false);
  const [override, setOverride] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const template = templates[type];
  const conflicts = rosterConflicts(entries, db.duties);
  const duplicates = conflicts.some((c) => c.kind !== 'overlap');
  const problem = entries.length ? batchProblem(entries, db.duties, kind) : '';
  const invalid = Boolean(problem);
  const calendarRows = [
    ...db.duties.filter((d) => !entries.some((e) => e.id === d.id)),
    ...entries,
  ];
  const requestClose = () => {
    if (!closing) {
      if (entries.length || selected.length) setDiscard(true);
      else finishClose();
    }
  };
  const patchEntry = (entryId: string, patch: Partial<Duty>) => {
    setEntries((rows) => rows.map((row) => (row.id === entryId ? { ...row, ...patch } : row)));
    setOverride(false);
    setError('');
  };
  function applyTemplate() {
    const additions: Duty[] = [];
    for (const date of selected) {
      if (!validDutyDate(date)) {
        setError(t(`Invalid date: ${date}`, `無效日期：${date}`));
        return;
      }
      if (kind === 'SL') {
        const eligible = db.duties.filter((d) => d.date === date && eligibleSickDuty(d));
        const original =
          eligible.find((d) => d.id === targets[date]) ||
          (eligible.length === 1 ? eligible[0] : undefined);
        if (!original || entries.some((d) => d.id === original.id)) {
          setError(
            t(
              `Select an eligible Scheduled duty for ${date}. No changes saved.`,
              `請為 ${date} 選擇合資格的已排更更次，尚未儲存任何修改。`,
            ),
          );
          return;
        }
        additions.push({ ...original, leave: 'SL' });
      } else {
        additions.push({
          id: id(),
          date,
          start: kind === 'AL' ? '' : template.start,
          end: kind === 'AL' ? '' : template.end,
          ...(kind === 'AL'
            ? { leave: 'AL' as const }
            : {
                workState: kind === 'Worked' ? ('Worked' as const) : ('Planned' as const),
                shiftType: type,
              }),
          status: 'Confirmed',
          notes: '',
        });
      }
    }
    if (!additions.length || batchProblem(additions, db.duties, kind)) {
      setError(
        t(
          'Select dates and valid shift times. Worked shifts must have ended; no entries were added.',
          '請選擇日期及有效時間；已工作更次必須已結束，沒有新增任何項目。',
        ),
      );
      return;
    }
    setEntries((rows) => [...rows, ...additions]);
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
    const next = commitDutyBatch(db, entries, kind, override);
    if (next && commit(next)) finishClose();
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
        title={review ? t('Review Batch Duties', '覆核批次更次') : t('Add Duties', '新增更次')}
        onClose={requestClose}
        wide
        sheet
        closing={closing}
      >
        <p className="notice">
          {t(
            'Choose one record type per batch. Scheduled does not mean Worked. Shift templates are personal, not official employer hours.',
            '每個批次只可選擇一種紀錄類型；已排更不等於已工作。更次範本為個人設定，並非官方僱主更表。',
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
            <Select
              label={t('Record type', '紀錄類型')}
              options={[
                { value: 'Scheduled', label: t('Scheduled', '已排更') },
                { value: 'Worked', label: t('Worked', '已工作') },
                { value: 'AL', label: t('Annual Leave (AL)', '年假 (AL)') },
                { value: 'SL', label: t('Sick Leave (SL)', '病假 (SL)') },
              ]}
              value={kind}
              disabled={entries.length > 0}
              onChange={(e) => {
                setKind(e.target.value as DutyKind);
                setError('');
              }}
            />
            <p className="muted">
              {t(
                'Remove all pending entries to change the batch record type.',
                '如需更改批次紀錄類型，請先移除所有待存項目。',
              )}
            </p>
            <div className="roster-layout">
              <section>
                <h3>{t('Select multiple dates', '選擇多個日期')}</h3>
                <DutyCalendar
                  duties={calendarRows}
                  month={month}
                  onMonth={setMonth}
                  selected={selected}
                  selectionLabel
                  onSelect={(date) =>
                    setSelected((rows) =>
                      rows.includes(date) ? rows.filter((d) => d !== date) : [...rows, date],
                    )
                  }
                />
                <p>
                  {t('Selected dates', '已選日期')}: {selected.length} ·{' '}
                  {[...selected].sort().join(', ')}
                </p>
                <button onClick={() => setSelected([])} disabled={!selected.length}>
                  {t('Clear date selection', '清除日期選擇')}
                </button>
              </section>
              <section className="inset">
                {(kind === 'Scheduled' || kind === 'Worked') && (
                  <>
                    <h3>{t('Your shift template', '你的更次範本')}</h3>
                    <Select
                      label={t('Shift template', '更次範本')}
                      options={shiftTypes}
                      value={type}
                      onChange={(e) => {
                        setType(e.target.value as ShiftType);
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
                        }}
                      />
                      <Field
                        label={t('Template end', '範本完更時間')}
                        type="time"
                        value={template.end}
                        onChange={(e) => {
                          setTemplates({
                            ...templates,
                            [type]: { ...template, end: e.target.value },
                          });
                        }}
                      />
                    </div>
                  </>
                )}
                {kind === 'AL' && (
                  <p>
                    {t(
                      'Annual Leave is date-based, without duty hours. Resolve conflicts before saving.',
                      '年假按日期記錄，不產生工時；儲存前必須解決衝突。',
                    )}
                  </p>
                )}
                {kind === 'SL' && (
                  <>
                    <p>
                      {t(
                        'Sick Leave converts an existing confirmed Scheduled duty, retaining planned times, notes and links. Choose the exact duty when several exist.',
                        '病假只可由現有已確認的已排更更次轉換，保留原定時間、筆記及連結；同日多更時請選擇指定更次。',
                      )}
                    </p>
                    {[...selected].sort().map((date) => {
                      const eligible = db.duties.filter(
                        (d) => d.date === date && eligibleSickDuty(d),
                      );
                      return (
                        <Select
                          key={date}
                          label={t('Scheduled duty ' + date, '已排更更次 ' + date)}
                          placeholder={t('Choose eligible duty', '選擇合資格更次')}
                          options={eligible.map((d) => ({
                            value: d.id,
                            label: dutyOptionText(d, l),
                          }))}
                          value={targets[date] || (eligible.length === 1 ? eligible[0].id : '')}
                          onChange={(e) => setTargets({ ...targets, [date]: e.target.value })}
                        />
                      );
                    })}
                  </>
                )}
                <button className="primary" onClick={applyTemplate}>
                  {kind === 'AL' || kind === 'SL'
                    ? t('Add selected leave entries', '加入所選假別項目')
                    : t('Apply template to selected dates', '套用範本至所選日期')}
                </button>
              </section>
            </div>
          </>
        )}
        {entries.length > 0 && selected.length > 0 && (
          <p className="notice amber">
            {t(
              'Apply or clear the selected dates before reviewing. Only pending entries will be saved.',
              '覆核前請先套用或清除所選日期，只有待存項目會被儲存。',
            )}
          </p>
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
                    {i + 1}. {entry.date} · {entry.leave || l(entry.shiftType || 'Custom')} ·{' '}
                    {l(kind)}
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
                {review || kind === 'SL' ? (
                  <>
                    <p>
                      {entry.leave === 'AL'
                        ? t('No duty hours', '沒有工時')
                        : `${entry.start} → ${range?.endDate || entry.date} ${entry.end} HKT`}{' '}
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
                      {kind !== 'AL' && (
                        <>
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
                        </>
                      )}{' '}
                    </div>
                    <TextArea
                      label={t(`Duty ${i + 1} notes`, `更次 ${i + 1} 筆記 · 只限虛構`)}
                      value={entry.notes}
                      onChange={(e) => patchEntry(entry.id, { notes: e.target.value })}
                    />
                    <p>
                      {entry.leave === 'AL'
                        ? t('No duty hours', '沒有工時')
                        : range
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
                  : conflict.kind === 'leave'
                    ? t(
                        'Annual Leave conflict — edit or remove; existing duties are retained.',
                        '年假衝突，請修改或移除；現有更次會保留。',
                      )
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
        {problem && (
          <p role="alert" className="notice amber">
            {t(
              'Invalid or stale batch. Check the date, finished shift times or eligible Scheduled duty. No partial save:',
              '批次無效或原更次已變更，請檢查日期、已完更時間或已排更更次；不會部分儲存：',
            )}{' '}
            {problem.split(':').slice(1).join(':')}
          </p>
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
                disabled={!entries.length || invalid || selected.length > 0}
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
          onConfirm={finishClose}
          confirmLabel={t('Discard changes', '捨棄修改')}
        >
          <p>{t('No pending duties have been saved.', '尚未儲存任何待存更次。')}</p>
        </Confirm>
      )}
    </>
  );
}
