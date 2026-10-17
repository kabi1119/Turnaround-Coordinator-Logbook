import { useState } from 'react';
import type { Database, Duty } from '../domain/model';
import { hkToday, id } from '../domain/model';
import { completedDuty, shiftRange } from '../domain/roster';
import { Confirm, Field, Modal, Select, TextArea } from '../components/ui';
import { useT } from '../i18n';
export default function DutyEditor({
  db,
  existing,
  onClose,
  commit,
}: {
  db: Database;
  existing?: Duty;
  onClose: () => void;
  commit: (db: Database) => boolean;
}) {
  const t = useT();
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
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const patch = (p: Partial<Duty>) => {
    setD({ ...d, ...p });
    setDirty(true);
  };
  const requestClose = () => (dirty ? setDiscard(true) : onClose());
  return (
    <>
      <Modal
        title={existing ? t('Edit Duty', '編輯更次') : t('New Duty', '新增更次')}
        onClose={requestClose}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (d.start && d.end && !shiftRange(d)) {
              setError(
                t(
                  'Enter a valid shift date and different start/end times.',
                  '請輸入有效更次日期及不同的開更、完更時間。',
                ),
              );
              return;
            }
            if (d.workState === 'Worked' && !completedDuty({ ...d, status: 'Confirmed' })) {
              setError(
                t(
                  'A future or unfinished shift must remain Planned.',
                  '未來或尚未結束的更次必須保留為計劃中。',
                ),
              );
              return;
            }
            if (
              commit({
                ...db,
                duties: existing
                  ? db.duties.map((b) => (b.id === d.id ? d : b))
                  : [...db.duties, d],
              })
            )
              onClose();
            else setError(t('Could not save locally.', '未能在本機儲存。'));
          }}
        >
          <Field
            label={t('Duty Date · shift start in Hong Kong', '更次日期 · 香港開更日期')}
            type="date"
            required
            value={d.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
          <div className="form-grid">
            <Field
              label={t('Shift Start · optional', '開更時間 · 選填')}
              type="time"
              value={d.start}
              onChange={(e) => patch({ start: e.target.value })}
            />
            <Field
              label={t('Shift End · optional', '完更時間 · 選填')}
              type="time"
              value={d.end}
              onChange={(e) => patch({ end: e.target.value })}
            />
          </div>
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
            onChange={(e) => patch({ status: e.target.value as Duty['status'] })}
          />
          <Select
            label={t('Work state', '工作進度')}
            options={['Planned', 'Worked']}
            value={d.workState || 'Worked'}
            onChange={(e) => patch({ workState: e.target.value as Duty['workState'] })}
          />
          <p className="muted">
            {t(
              'Planned duties never count as worked shifts. Mark Worked explicitly after the shift; elapsed time alone does not change the state.',
              '計劃更次不計入已工作更次。完更後須自行標記已工作，時間經過不會自動改變進度。',
            )}
          </p>
          <Select
            label={t('Shift type', '更次類型')}
            options={['Day', 'Evening', 'Night', 'Custom']}
            value={d.shiftType || 'Custom'}
            onChange={(e) => patch({ shiftType: e.target.value as Duty['shiftType'] })}
          />
          <TextArea
            label={t('Notes', '筆記')}
            value={d.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
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
