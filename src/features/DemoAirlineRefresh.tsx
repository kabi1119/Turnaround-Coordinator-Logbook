import { afterSave, type Commit } from '../workspaces/store';
import { useRef, useState } from 'react';
import type { Database } from '../domain/model';
import { sampleRefreshPlan, refreshSamples } from '../data/sampleRefresh';
import { Modal } from '../components/ui';
import { useLabel, useT } from '../i18n';

export default function DemoAirlineRefresh({
  db,
  commit,
  onClose,
}: {
  db: Database;
  commit: Commit;
  onClose: () => void;
}) {
  const t = useT(),
    l = useLabel(),
    [plan] = useState(() => sampleRefreshPlan(db)),
    [approved, setApproved] = useState(false),
    [error, setError] = useState('');
  const saving = useRef(false);
  const describe = (id: string) => {
    const aircraft = db.aircraft.find((a) => a.id === id);
    if (aircraft) return `${aircraft.date} · ${aircraft.airline}`;
    const duty = db.duties.find((d) => d.id === id);
    if (duty) return `${duty.date} · ${duty.start || '—'}–${duty.end || '—'}`;
    const journal = db.journals.find((j) => j.id === id);
    return journal
      ? `${journal.date} · ${journal.title}`
      : t('Unrecognized record', '未能辨認的紀錄');
  };
  return (
    <Modal title={t('Review sample refresh', '覆核樣本更新')} onClose={onClose} wide>
      <p className="notice">
        {t(
          'Replace only unchanged application samples with the compact fictional collection. Personal records and settings are preserved. Edited samples and personal links to removed records block the update. Nothing changes before confirmation.',
          '只會以精簡虛構樣本取代未修改的應用程式範例，保留個人紀錄及設定。已修改的樣本或個人紀錄仍引用將移除的資料時，會阻擋更新。確認前不會更改資料。',
        )}
      </p>
      {(['aircraft', 'duties', 'journals'] as const).map((key) => (
        <p key={key}>
          {t(
            key === 'aircraft' ? 'Aircraft' : key === 'duties' ? 'Duties' : 'Journals',
            key === 'aircraft' ? '航機' : key === 'duties' ? '更次' : '日誌',
          )}{' '}
          · {t('Remove / add', '移除／新增')}: {plan.remove[key].length} / {plan.add[key].length}
        </p>
      ))}
      <details>
        <summary>{t('Review affected records', '查看受影響紀錄')}</summary>
        <h3>{t('Aircraft to remove', '將移除的航機')}</h3>
        {plan.remove.aircraft.map((id) => (
          <p key={id}>{describe(id)}</p>
        ))}
        <h3>{t('Aircraft to add', '將新增的航機')}</h3>
        {plan.add.aircraft.map((a) => (
          <p key={a.id}>
            {a.date} · {a.airline} · {l(a.handling)}
          </p>
        ))}
        <h3>{t('Duties to remove', '將移除的更次')}</h3>
        {plan.remove.duties.map((id) => (
          <p key={id}>{describe(id)}</p>
        ))}
        <h3>{t('Duties to add', '將新增的更次')}</h3>
        {plan.add.duties.map((d) => (
          <p key={d.id}>
            {d.date} · {d.start}–{d.end} HKT · {l(d.workState || 'Not Recorded')}
          </p>
        ))}
        <h3>{t('Journals to remove', '將移除的日誌')}</h3>
        {plan.remove.journals.map((id) => (
          <p key={id}>{describe(id)}</p>
        ))}
        <h3>{t('Journals to add', '將新增的日誌')}</h3>
        {plan.add.journals.map((j) => (
          <p key={j.id}>
            {j.date} · {j.title}
          </p>
        ))}
        <p>
          {t(
            'Linked sample disruptions are replaced with their assignments. Personal links must be resolved before removal.',
            '連結的樣本異常事件會隨處理紀錄一併替換。移除前必須先處理個人紀錄的引用。',
          )}
        </p>
      </details>
      {plan.blocked.length > 0 && (
        <p role="alert" className="notice amber">
          {t(
            'Refresh blocked: review edited records or personal links. Nothing will be overwritten.',
            '無法更新：請檢查已修改紀錄或個人引用，不會覆寫資料。',
          )}{' '}
          {plan.blocked.map(describe).join('; ')}
        </p>
      )}
      {!plan.changed && !plan.blocked.length && (
        <p>{t('Sample records are already current.', '樣本紀錄已是最新。')}</p>
      )}
      <label className="check">
        <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
        {t(
          'I reviewed the replacements, new dates and relationship impact.',
          '我已覆核替換紀錄、新日期及關聯影響。',
        )}
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button onClick={onClose}>{t('Cancel', '取消')}</button>
        <button
          className="primary"
          disabled={!approved || !!plan.blocked.length || !plan.changed}
          onClick={() => {
            if (saving.current) return;
            const next = refreshSamples(db, plan.token);
            if (!next) {
              setError(
                t(
                  'Preview changed. Please reopen and review again.',
                  '預覽已變更，請重新開啟並覆核。',
                ),
              );
              return;
            }
            saving.current = true;
            afterSave(commit(next), (ok) => {
              if (ok) onClose();
              else {
                saving.current = false;
                setError(
                  t(
                    'Could not save locally. No refresh was applied.',
                    '未能在本機儲存，尚未套用更新。',
                  ),
                );
              }
            });
          }}
        >
          {t('Confirm sample refresh', '確認更新樣本')}
        </button>
      </div>
    </Modal>
  );
}
