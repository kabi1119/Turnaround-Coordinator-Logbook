import { useState } from 'react';
import type { Database } from '../domain/model';
import { demoAirlineRefreshPlan, refreshDemoAirlines } from '../data/demoRefresh';
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
  const t = useT();
  const [approved, setApproved] = useState(false),
    [error, setError] = useState('');
  const rows = demoAirlineRefreshPlan(db);
  return (
    <Modal title={t('Review demo airline refresh', '覆核示範航空公司更新')} onClose={onClose} wide>
      <p className="notice">
        {t(
          'Only exact, unchanged legacy synthetic samples listed below are eligible. IDs or DEMO labels alone are not sufficient. Edited, deleted-field, custom and unrecognized records are left untouched. No Duty, Journal, links or records will be deleted or added.',
          '只有以下內容完全符合未修改舊版虛構範例的項目可更新；單憑 ID 或 DEMO 字樣不足以辨認。已修改、曾刪除欄位、自訂及無法辨認的紀錄維持不變。不會新增或刪除更次、日誌、關聯或紀錄。',
        )}
      </p>
      <p>
        {t('Eligible changes', '符合更新條件')}: {rows.length}
      </p>
      {rows.map((row) => (
        <p key={row.id}>
          {row.date} · {row.before} → {row.after}
        </p>
      ))}
      {!rows.length && (
        <p>
          {t(
            'No unchanged obsolete samples found. Existing records are preserved; no refresh is needed or safe to infer.',
            '找不到未修改的過時範例。現有紀錄會保留，毋須更新或無法安全判定。',
          )}
        </p>
      )}
      <label className="check">
        <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
        {t(
          'I reviewed these synthetic samples and approve only the listed airline changes.',
          '我已覆核這些虛構範例，並只批准以上航空公司更改。',
        )}
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button onClick={onClose}>{t('Cancel', '取消')}</button>
        <button
          className="primary"
          disabled={!approved || !rows.length}
          onClick={() => {
            if (
              commit(
                refreshDemoAirlines(
                  db,
                  rows.map((row) => row.id),
                ),
              )
            )
              onClose();
            else
              setError(
                t(
                  'Could not save locally. No refresh was applied.',
                  '未能在本機儲存，尚未套用更新。',
                ),
              );
          }}
        >
          {t('Confirm demo airline refresh', '確認更新示範航空公司')}
        </button>
      </div>
    </Modal>
  );
}
