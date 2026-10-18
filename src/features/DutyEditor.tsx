import { useRef, useState } from 'react';
import type { Database, Duty } from '../domain/model';
import { hkToday, id } from '../domain/model';
import { completedDuty, rosterConflicts, shiftRange } from '../domain/roster';
import { eligibleSickDuty, validDutyDate, batchProblem } from '../domain/dutyCalendar';
import { Confirm, Field, Modal, Select, TextArea } from '../components/ui';
import { useT } from '../i18n';
import { useMotionClose } from '../lib/useMotionClose';
export default function DutyEditor({
  db,
  existing,
  onClose: leave,
  commit,
}: {
  db: Database;
  existing?: Duty;
  onClose: () => void;
  commit: (db: Database) => boolean;
}) {
  const t = useT();
  const { closing, close: onClose } = useMotionClose(leave);
  const saving = useRef(false);
  const [d, setD] = useState<Duty>(
    existing
      ? { ...existing }
      : {
          id: id(),
          date: hkToday(),
          start: '',
          end: '',
          status: 'Draft',
          workState: 'Planned',
          notes: '',
        },
  );
  const [error, setError] = useState(''),
    [overlapOverride, setOverlapOverride] = useState(false),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const patch = (p: Partial<Duty>) => {
    setD({ ...d, ...p });
    setDirty(true);
    setOverlapOverride(false);
  };
  const changedRange =
    !existing || d.date !== existing.date || d.start !== existing.start || d.end !== existing.end;
  const conflicts = changedRange
    ? rosterConflicts(
        [d],
        db.duties.filter((row) => row.id !== d.id),
      )
    : [];
  const requestClose = () => (dirty ? setDiscard(true) : onClose());
  return (
    <>
      <Modal
        title={existing ? t('Edit Duty', '編輯更次') : t('New Duty', '新增更次')}
        onClose={requestClose}
        sheet
        closing={closing}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (saving.current) return;
            if (
              !validDutyDate(d.date) ||
              (conflicts.length &&
                (!overlapOverride || conflicts.some((c) => c.kind !== 'overlap')))
            ) {
              setError(
                t(
                  'Resolve invalid dates or conflicting records before saving. Existing duties are retained.',
                  '儲存前請解決無效日期或紀錄衝突；現有更次會保留。',
                ),
              );
              return;
            }
            if (
              d.leave === 'SL' &&
              existing?.leave !== 'SL' &&
              batchProblem([d], db.duties, 'SL')
            ) {
              setError(
                t(
                  'SL requires an unchanged eligible confirmed Scheduled duty.',
                  '病假必須由未被修改的合資格已確認已排更更次轉換。',
                ),
              );
              return;
            }
            if (d.start && d.end && !shiftRange(d)) {
              setError(
                t(
                  'Enter a valid shift date and different start/end times.',
                  '請輸入有效更次日期及不同的開更、完更時間。',
                ),
              );
              return;
            }
            if (
              !d.leave &&
              d.workState === 'Worked' &&
              !completedDuty({ ...d, status: 'Confirmed' })
            ) {
              setError(
                t(
                  'A future or unfinished shift must remain Planned.',
                  '未來或尚未結束的更次必須保留為計劃中。',
                ),
              );
              return;
            }
            saving.current = true;
            if (
              commit({
                ...db,
                duties: existing
                  ? db.duties.map((b) => (b.id === d.id ? d : b))
                  : [...db.duties, d],
              })
            )
              onClose();
            else {
              saving.current = false;
              setError(t('Could not save locally.', '未能在本機儲存。'));
            }
          }}
        >
          <Field
            label={t('Duty Date · shift start in Hong Kong', '更次日期 · 香港開更日期')}
            type="date"
            required
            value={d.date}
            disabled={d.leave === 'SL' || existing?.leave === 'SL'}
            onChange={(e) => patch({ date: e.target.value })}
          />
          {d.leave === 'AL' ? (
            <p className="notice">
              {t('Annual Leave · date only, no duty hours.', '年假 · 只記錄日期，沒有工時。')}
            </p>
          ) : (
            <div className="form-grid">
              <Field
                label={t('Shift Start · optional', '開更時間 · 選填')}
                type="time"
                value={d.start}
                disabled={d.leave === 'SL' || existing?.leave === 'SL'}
                onChange={(e) => patch({ start: e.target.value })}
              />
              <Field
                label={t('Shift End · optional', '完更時間 · 選填')}
                type="time"
                value={d.end}
                disabled={d.leave === 'SL' || existing?.leave === 'SL'}
                onChange={(e) => patch({ end: e.target.value })}
              />
            </div>
          )}
          {d.start && d.end && d.end < d.start && (
            <p className="notice">
              {t(
                'Ends the following day. Grouped by shift start date.',
                '翌日完更，按開更日期歸組。',
              )}
            </p>
          )}
          <Select
            label={t('Duty Status', '更次狀態')}
            options={['Draft', 'Confirmed']}
            value={d.status}
            disabled={d.leave === 'SL' || existing?.leave === 'SL'}
            onChange={(e) => patch({ status: e.target.value as Duty['status'] })}
          />
          {!d.leave && existing?.leave !== 'SL' && (
            <Select
              label={t('Work state', '工作進度')}
              options={[
                { value: 'Planned', label: t('Scheduled', '已排更') },
                { value: 'Worked', label: t('Worked', '已工作') },
              ]}
              placeholder={t('Work state not recorded', '未記錄工作進度')}
              placeholderDisabled
              value={d.workState || ''}
              onChange={(e) =>
                patch({ workState: (e.target.value || undefined) as Duty['workState'] })
              }
            />
          )}
          {(existing?.leave === 'SL' || (existing && eligibleSickDuty(existing))) && (
            <label className="check">
              <input
                type="checkbox"
                checked={d.leave === 'SL'}
                onChange={(e) => {
                  if (existing) {
                    setD({ ...existing, leave: e.target.checked ? 'SL' : undefined });
                    setDirty(true);
                  }
                }}
              />
              {t(
                'Classify this Scheduled duty as Sick Leave (SL); preserve its original planned information.',
                '將此已排更更次列為病假 (SL)，保留原有計劃資料。',
              )}
            </label>
          )}
          <p className="muted">
            {t(
              'Planned duties never count as worked shifts. Mark Worked explicitly after the shift; elapsed time alone does not change the state.',
              '計劃更次不計入已工作更次。完更後須自行標記已工作，時間經過不會自動改變進度。',
            )}
          </p>
          {d.leave !== 'AL' && (
            <Select
              label={t('Shift type', '更次類型')}
              options={['Day', 'Evening', 'Night', 'Custom']}
              value={d.shiftType || 'Custom'}
              disabled={d.leave === 'SL' || existing?.leave === 'SL'}
              onChange={(e) => patch({ shiftType: e.target.value as Duty['shiftType'] })}
            />
          )}
          <TextArea
            label={t('Notes', '筆記')}
            value={d.notes}
            disabled={d.leave === 'SL' || existing?.leave === 'SL'}
            onChange={(e) => patch({ notes: e.target.value })}
          />
          {conflicts.length > 0 && (
            <p role="alert" className="notice amber">
              {t(
                'Conflicting duty or Annual Leave. Edit the dates/times or resolve the existing entry without deleting it automatically.',
                '更次或年假衝突。請修改日期／時間，或先處理現有紀錄；不會自動刪除。',
              )}
            </p>
          )}
          {conflicts.length > 0 && conflicts.every((c) => c.kind === 'overlap') && (
            <label className="check">
              <input
                type="checkbox"
                checked={overlapOverride}
                onChange={(e) => setOverlapOverride(e.target.checked)}
              />
              {t(
                'I intentionally retain these overlapping separate duties.',
                '我確定保留這些時段重疊的獨立更次。',
              )}
            </label>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="actions">
            <button type="button" onClick={requestClose}>
              {t('Cancel', '取消')}
            </button>
            <button className="primary">{t('Save Duty', '儲存更次')}</button>
          </div>
        </form>
      </Modal>
      {discard && (
        <Confirm
          title={t('Discard unsaved Duty changes?', '捨棄未儲存的更次修改？')}
          onClose={() => setDiscard(false)}
          onConfirm={onClose}
          confirmLabel={t('Discard changes', '捨棄修改')}
        >
          <p>{t('No changes will be saved.', '不會儲存修改。')}</p>
        </Confirm>
      )}
    </>
  );
}
