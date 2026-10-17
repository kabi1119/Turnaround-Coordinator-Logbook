import { useState } from 'react';
import type { Database, Duty } from '../domain/model';
import { hkToday, id } from '../domain/model';
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
      : { id: id(), date: hkToday(), start: '', end: '', status: 'Draft', notes: '' },
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
          <TextArea
            label={t('Notes · synthetic only', '筆記 · 只限虛構資料')}
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
