import { useRef, useState } from 'react';
import type { Database } from '../domain/model';
import { applyDemoDataset, demoDatasetPlan } from '../data/demoDatasetRefresh';
import { Modal } from '../components/ui';
import { useT } from '../i18n';

export default function DemoAirlineRefresh({
  db,
  commit,
  onClose,
}: {
  db: Database;
  commit: (db: Database) => boolean;
  onClose: () => void;
}) {
  const t = useT(),
    [approved, setApproved] = useState(false),
    [error, setError] = useState('');
  const saving = useRef(false);
  const [plan] = useState(() => demoDatasetPlan(db));
  return (
    <Modal
      title={t('Review 24-airline demo refresh', '覆核 24 家航空公司示範更新')}
      onClose={onClose}
      wide
    >
      <p className="notice">
        {t(
          'Only full, unchanged application-generated samples can be replaced. Aircraft IDs and existing Journal references are kept. All existing duties, journals, settings and unrelated records are preserved. Nothing changes until confirmation.',
          '只會替換內容完全符合未修改應用程式範例的紀錄，保留航機 ID 及既有日誌引用。保留所有現有更次、日誌、設定及其他紀錄，確認前不會更改資料。',
        )}
      </p>
      <p>
        {t('Replace', '替換')}: {plan.replace.length} ·{' '}
        {t('Generate / replace with', '產生／替換為')}: {plan.generate.length} ·{' '}
        {t('Target synthetic assignments', '目標虛構處理紀錄')}: 24
      </p>
      <p>
        {t('New demo duties', '新增示範更次')}: {plan.addDuties.length} ·{' '}
        {t('New required demo journals', '新增必要示範日誌')}: {plan.addJournals.length}
      </p>
      <p>
        {t('Existing journals retaining aircraft links', '保留航機連結的現有日誌')}:{' '}
        {plan.linkedJournals.length} ·{' '}
        {t('Disruption events replaced / generated', '替換／產生異常事件')}: {plan.eventsRemoved} /{' '}
        {plan.eventsGenerated}
      </p>
      <p>
        {t(
          'Existing aircraft IDs retain their journal references but point to the new synthetic scenarios below. Their date, airline and Duty may change. No journal text is edited; all existing duties remain.',
          '既有航機 ID 會保留日誌引用，但改為以下新虛構情境，其日期、航空公司及所屬更次可能更改。不會修改日誌文字，所有現有更次均保留。',
        )}
      </p>
      {plan.blocked.length > 0 && (
        <p role="alert" className="notice amber">
          {t(
            'Refresh blocked: edited or unrecognized records occupy required IDs. They will not be overwritten. Review the listed records; no automatic cleanup is safe.',
            '無法更新：必要 ID 已被修改過或無法辨認的紀錄佔用，不會覆寫。無法安全自動清理，請先檢查紀錄。',
          )}{' '}
          {plan.blocked.join(', ')}
        </p>
      )}
      <details open>
        <summary>{t('Records to remove / replace', '將移除／替換的紀錄')}</summary>
        {plan.replace.map((a) => (
          <p key={a.id}>
            {a.id} · {a.date} · {a.airline}
          </p>
        ))}
      </details>
      <details open>
        <summary>{t('Records to generate', '將產生的紀錄')}</summary>
        {plan.generate.map((a) => (
          <p key={a.id}>
            {a.id} · {a.date} · {a.airline}
            {db.settings.privacy.registration ? ` · ${a.registration}` : ''}
          </p>
        ))}
      </details>
      {!plan.generate.length && !plan.blocked.length && (
        <p>
          {t(
            'The 24-airline dataset is already current. No refresh is needed.',
            '24 家航空公司示範資料已是最新，毋須更新。',
          )}
        </p>
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
          disabled={!approved || !!plan.blocked.length || !plan.generate.length}
          onClick={() => {
            if (saving.current) return;
            const next = applyDemoDataset(db, plan.token);
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
            if (commit(next)) onClose();
            else {
              saving.current = false;
              setError(
                t(
                  'Could not save locally. No refresh was applied.',
                  '未能在本機儲存，尚未套用更新。',
                ),
              );
            }
          }}
        >
          {t('Confirm 24-airline demo refresh', '確認更新 24 家航空公司示範')}
        </button>
      </div>
    </Modal>
  );
}
