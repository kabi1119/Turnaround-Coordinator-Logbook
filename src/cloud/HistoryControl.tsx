import { useRef, useState, useSyncExternalStore } from 'react';
import { useT } from '../i18n';
import { compareFields } from '../migration/matching';
import { recordKey } from '../sync/crypto';
import { requestDownload } from './archive';
import type { AccountEngine } from './engine';
import type { HistoryResponse } from './types';

const display = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? '—'
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);

/** Live server history only. Archived versions need the independent archive file. */
export default function HistoryControl({ engine }: { engine: AccountEngine }) {
  const t = useT();
  useSyncExternalStore(engine.subscribe, engine.snapshot);
  const [key, setKey] = useState('');
  const [reviewed, setReviewed] = useState<HistoryResponse | null>(null);
  const [selected, setSelected] = useState(-1);
  const [backup, setBackup] = useState('');
  const [backupSnapshot, setBackupSnapshot] = useState<string | null | undefined>(null);
  const [reread, setReread] = useState('');
  const [approved, setApproved] = useState(false);
  const [highRisk, setHighRisk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const selectedKey = useRef('');
  const entries = engine.state().base.map(({ record }) => record);
  const current = entries.find((row) => recordKey(row) === key);
  const chosen = reviewed?.records[selected];
  const differences = chosen
    ? compareFields(current?.value, chosen.value).filter((d) => d.state !== 'match')
    : [];
  const db = engine.store.read().db;
  const linked = current
    ? [
        ...db.aircraft.flatMap((aircraft) =>
          (current.collection === 'duties' &&
            (aircraft.dutyId === current.id || aircraft.originalDutyId === current.id)) ||
          (current.collection === 'journals' &&
            aircraft.events.some((event) => event.journalId === current.id))
            ? [`aircraft · ${aircraft.id}`]
            : [],
        ),
        ...db.journals.flatMap((journal) =>
          (current.collection === 'duties' &&
            (journal.dutyId === current.id || journal.originalDutyId === current.id)) ||
          (current.collection === 'aircraft' && journal.aircraftIds.includes(current.id))
            ? [`journals · ${journal.id}`]
            : [],
        ),
      ]
    : [];
  const risk = chosen?.value === null || current?.value === null || differences.length > 0;
  const ready =
    !!chosen &&
    !!current &&
    backup === engine.recoveryBackup() &&
    reread === backup &&
    backupSnapshot === engine.store.snapshot();
  const clearReview = () => {
    setReviewed(null);
    setSelected(-1);
    setBackup('');
    setReread('');
    setApproved(false);
    setHighRisk(false);
  };
  return (
    <section className="cloud-history" aria-label={t('Record history', '紀錄歷史')}>
      <h3>{t('Record history', '紀錄歷史')}</h3>
      <p>
        {t(
          'Inspect live previous versions. Restoring one creates a new revision and keeps the current version in history. Archived versions require your separately saved and verified archive file.',
          '查看伺服器現存的舊版。還原會建立新修訂版，並把目前版本留在歷史中。已封存版本需要另外保存且驗證過的封存檔。',
        )}
      </p>
      <label>
        {t('Record', '紀錄')}
        <select
          value={key}
          disabled={busy}
          onChange={(event) => {
            selectedKey.current = event.target.value;
            setKey(event.target.value);
            clearReview();
          }}
        >
          <option value="">{t('Choose a record', '選擇紀錄')}</option>
          {entries.map((row) => (
            <option key={recordKey(row)} value={recordKey(row)}>
              {row.collection} · {row.id}
              {row.value === null ? ` · ${t('deleted', '已刪除')}` : ''}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={!current || busy}
        onClick={() => {
          if (!current) return;
          setBusy(true);
          clearReview();
          setMessage('');
          void engine
            .history(current.collection, current.id)
            .then((response) => {
              if (selectedKey.current !== recordKey(current)) return;
              setReviewed(response);
              setMessage(
                response.records.length
                  ? t('Select a live version to compare.', '請選擇現存舊版作比對。')
                  : t('No live previous versions for this record.', '此紀錄沒有現存的舊版。'),
              );
            })
            .catch(() =>
              setMessage(
                t(
                  'History could not be verified. No data changed.',
                  '無法驗證歷史；資料沒有變更。',
                ),
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        {t('Open record history', '開啟紀錄歷史')}
      </button>
      {reviewed && (
        <>
          <p>
            {t('Live versions', '現存舊版')}: {reviewed.records.length} ·{' '}
            {t('Cloud revision', '雲端修訂版')}: {reviewed.revision}
          </p>
          {reviewed.archivedAt && (
            <p className="notice amber">
              {t(
                'Older versions were manually archived and are not available in this list. Use your independent archive for recovery review.',
                '較舊版本已手動封存，不在此清單內。請使用獨立封存檔作復原覆核。',
              )}
            </p>
          )}
          {reviewed.records.map((row, index) => (
            <label key={`${row.operationId}:${row.previousRevision}`}>
              <input
                type="radio"
                name="history-version"
                checked={selected === index}
                onChange={() => {
                  setSelected(index);
                  setApproved(false);
                  setHighRisk(false);
                }}
              />
              {t('Previous revision', '舊修訂版')} {row.previousRevision} ·{' '}
              {new Date(row.createdAt).toLocaleString()} ·{' '}
              {row.value === null ? t('deletion', '刪除') : t('record', '紀錄')}
            </label>
          ))}
        </>
      )}
      {chosen && (
        <>
          <details open>
            <summary>{t('Compare current and selected version', '比對目前與所選版本')}</summary>
            <p>
              {t('Current', '目前')}:{' '}
              {current?.value === null ? t('deleted', '已刪除') : t('record', '紀錄')} ·{' '}
              {t('Selected', '所選')}:{' '}
              {chosen.value === null ? t('deleted', '已刪除') : t('record', '紀錄')}
            </p>
            {differences.map((diff) => (
              <p key={diff.field}>
                <strong>{diff.field}</strong> · {diff.state}
                <br />
                {t('Current', '目前')}: {display(diff.cloud)}
                <br />
                {t('Selected', '所選')}: {display(diff.local)}
              </p>
            ))}
            {!differences.length && <p>{t('No field differences.', '欄位沒有差異。')}</p>}
          </details>
          <p>
            {t(
              'Linked Duty, Aircraft and Journal references must remain valid. If restoring this version would break a link, approval is rejected without changing records.',
              '相關更次、航機與日誌連結必須保持有效。如還原會破壞連結，系統會拒絕批准而不更改紀錄。',
            )}
          </p>
          <details>
            <summary>
              {t('Review linked current records', '覆核目前關聯紀錄')} ({linked.length})
            </summary>
            {linked.length ? (
              linked.map((item) => <p key={item}>{item}</p>)
            ) : (
              <p>{t('No inbound links.', '沒有指向此紀錄的連結。')}</p>
            )}
          </details>
          <button
            disabled={busy}
            onClick={() => {
              const text = engine.recoveryBackup();
              requestDownload(text, 'tco-history-restore-recovery.json');
              setBackup(text);
              setBackupSnapshot(engine.store.snapshot());
              setReread('');
              setApproved(false);
              setHighRisk(false);
            }}
          >
            {t('Download current recovery file', '下載目前復原檔')}
          </button>
          {backup && (
            <label>
              {t('Reread saved recovery file', '重新讀取已儲存復原檔')}
              <input
                type="file"
                accept="application/json,.json"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setReread('');
                  setApproved(false);
                  setHighRisk(false);
                  if (!file || file.size > 32 * 1024 * 1024) return;
                  void file
                    .text()
                    .then((text) => {
                      if (text === backup && text === engine.recoveryBackup()) setReread(text);
                      else
                        setMessage(
                          t(
                            'Recovery file mismatch; nothing was restored.',
                            '復原檔不符；沒有還原紀錄。',
                          ),
                        );
                    })
                    .catch(() =>
                      setMessage(t('Could not read the recovery file.', '無法讀取復原檔。')),
                    );
                }}
              />
            </label>
          )}
          <label>
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            {t(
              'I reviewed the field differences, record links and saved recovery file.',
              '我已覆核欄位差異、紀錄連結與已儲存復原檔。',
            )}
          </label>
          {risk && (
            <label>
              <input
                type="checkbox"
                checked={highRisk}
                onChange={(event) => setHighRisk(event.target.checked)}
              />
              {t(
                'I approve replacing the current value, including any populated fields or deletion state.',
                '我批准取代目前內容，包括已填欄位或刪除狀態。',
              )}
            </label>
          )}
          <button
            className="primary"
            disabled={!ready || !approved || (risk && !highRisk) || busy}
            onClick={() => {
              if (!reviewed || !chosen || !backup) return;
              setBusy(true);
              setMessage('');
              void engine
                .restoreHistory(
                  reviewed,
                  chosen,
                  backup,
                  backupSnapshot,
                  approved && (!risk || highRisk),
                )
                .then(() => {
                  clearReview();
                  setMessage(
                    t(
                      'Restore saved locally. Check sync status for verified server acknowledgement.',
                      '還原已存於本機；請查看同步狀態以確認伺服器回執。',
                    ),
                  );
                })
                .catch(() =>
                  setMessage(
                    t(
                      'Restore was not approved or the cloud changed. Keep your recovery file and review again.',
                      '還原未獲批准或雲端已有變更。請保留復原檔並重新覆核。',
                    ),
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            {t('Approve new restoration revision', '批准建立還原修訂版')}
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
