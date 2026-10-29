import { useState, useSyncExternalStore } from 'react';
import { useT } from '../i18n';
import { compareFields } from '../migration/matching';
import { requestDownload } from './archive';
import type { AccountEngine } from './engine';

const display = (value: unknown) =>
  value === undefined || value === null || value === ''
    ? '—'
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);

/** Ordinary same-record conflicts; both alternatives remain in a verified external recovery file. */
export default function ConflictControl({ engine }: { engine: AccountEngine }) {
  const t = useT();
  useSyncExternalStore(engine.subscribe, engine.snapshot);
  const [saved, setSaved] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState<string | null | undefined>(null);
  const [reread, setReread] = useState('');
  const [choices, setChoices] = useState<Record<string, 'local' | 'cloud'>>({});
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const state = engine.state();
  if (!state.conflicts.length || state.recovery?.stage === 'review') return null;
  const current = engine.recoveryBackup();
  const rows = engine.recoveryRows().filter((row) => state.conflicts.includes(row.key));
  const ready =
    rows.length === state.conflicts.length &&
    saved === current &&
    reread === current &&
    savedSnapshot === engine.store.snapshot() &&
    rows.every((row) => choices[row.key]);
  return (
    <section
      className="cloud-conflict-review"
      aria-label={t('Review synchronization conflicts', '覆核同步衝突')}
    >
      <h3>{t('Review synchronization conflicts', '覆核同步衝突')}</h3>
      <p>
        {t(
          'Both versions remain available. Before choosing one, download and reread the complete plaintext recovery file. Keep it private; choosing Cloud may discard a local-only version from this browser.',
          '兩個版本仍然保留。選擇前請下載並重新讀取完整明文復原檔。請妥善保管；選擇雲端版本可能從此瀏覽器捨棄僅存本機的版本。',
        )}
      </p>
      {rows.length !== state.conflicts.length && (
        <p role="alert" className="notice amber">
          {t(
            'A conflict alternative is missing. Stop and preserve the recovery file.',
            '衝突的其中一個版本無法取得。請停止並保留復原檔。',
          )}
        </p>
      )}
      <button
        disabled={busy}
        onClick={() => {
          requestDownload(current, 'tco-conflict-recovery.json');
          setSaved(current);
          setSavedSnapshot(engine.store.snapshot());
          setReread('');
          setApproved(false);
        }}
      >
        {t('Download conflict recovery file', '下載衝突復原檔')}
      </button>
      {saved && (
        <label>
          {t('Reread saved recovery file', '重新讀取已儲存復原檔')}
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              setReread('');
              setApproved(false);
              if (!file || file.size > 32 * 1024 * 1024) return;
              void file
                .text()
                .then((text) => {
                  if (text === saved && text === engine.recoveryBackup()) setReread(text);
                  else setMessage(t('File mismatch; no data changed.', '檔案不符；資料未變。'));
                })
                .catch(() => setMessage(t('File could not be read.', '無法讀取檔案。')));
            }}
          />
        </label>
      )}
      {rows.map((row) => (
        <fieldset key={row.key}>
          <legend>
            {row.local?.collection || row.cloud?.collection} · {row.local?.id || row.cloud?.id}
          </legend>
          <p>
            {row.local?.value === null
              ? t('Local deletion', '本機刪除')
              : row.cloud?.value === null
                ? t('Cloud deletion', '雲端刪除')
                : t('Concurrent edits', '同步期間的不同編輯')}
          </p>
          <details>
            <summary>{t('Review all field differences', '覆核全部欄位差異')}</summary>
            {compareFields(row.cloud?.value, row.local?.value).map((diff) => (
              <p key={diff.field}>
                <strong>{diff.field}</strong> · {diff.state}
                <br />
                {t('Cloud', '雲端')}: {display(diff.cloud)}
                <br />
                {t('Local', '本機')}: {display(diff.local)}
              </p>
            ))}
          </details>
          <label>
            <input
              type="radio"
              name={row.key}
              checked={choices[row.key] === 'cloud'}
              onChange={() => {
                setChoices({ ...choices, [row.key]: 'cloud' });
                setApproved(false);
              }}
            />
            {t('Keep Cloud version', '保留雲端版本')}
          </label>
          <label>
            <input
              type="radio"
              name={row.key}
              checked={choices[row.key] === 'local'}
              onChange={() => {
                setChoices({ ...choices, [row.key]: 'local' });
                setApproved(false);
              }}
            />
            {t('Keep Local version', '保留本機版本')}
          </label>
        </fieldset>
      ))}
      <label>
        <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
        {t(
          'I reviewed every conflict and verified the saved recovery file.',
          '我已覆核每項衝突及驗證儲存的復原檔。',
        )}
      </label>
      <button
        className="primary"
        disabled={!ready || !approved || busy}
        onClick={() => {
          if (engine.recoveryBackup() !== saved || engine.store.snapshot() !== savedSnapshot)
            return;
          setBusy(true);
          setMessage('');
          void engine
            .resolveConflicts(choices, savedSnapshot)
            .then(() => {
              setChoices({});
              setSaved('');
              setReread('');
              setApproved(false);
              setMessage(
                t(
                  'Choices saved locally. Synchronization will verify the result.',
                  '決定已儲存至本機，同步程序將核對結果。',
                ),
              );
            })
            .catch(() =>
              setMessage(
                t(
                  'Conflicts could not be resolved safely. Keep the recovery file and retry.',
                  '無法安全解決衝突；請保留復原檔並重試。',
                ),
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        {t('Approve conflict decisions', '批准衝突決定')}
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
