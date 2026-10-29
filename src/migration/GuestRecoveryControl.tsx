import { useState, useSyncExternalStore } from 'react';
import type { AccountEngine } from '../cloud/engine';
import { requestDownload } from '../cloud/archive';
import { useT } from '../i18n';
import { AccountError } from '../cloud/types';

/** Owns only the pending Guest submission. It never writes the original Guest key. */
export default function GuestRecoveryControl({
  engine,
  onReviewed,
}: {
  engine: AccountEngine;
  onReviewed: () => void;
}) {
  const t = useT();
  useSyncExternalStore(engine.subscribe, engine.snapshot);
  const [backup, setBackup] = useState('');
  const [snapshot, setSnapshot] = useState<string | null | undefined>(null);
  const [reread, setReread] = useState('');
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const state = engine.state();
  const recovering = state.recovery?.stage === 'review' && !!state.recovery.merge;
  if (state.mixed && state.mixed.stage !== 'complete' && state.mixed.outcome !== 'unresolved')
    return null;
  if (state.merge?.stage !== 'queued' && !recovering) return null;
  if (recovering && state.recovery?.guestReady && state.merge?.stage !== 'queued')
    return (
      <section aria-label={t('Guest transfer recovery', '訪客轉移復原')}>
        <h3>{t('Full Guest review required', '需要完整重新覆核訪客資料')}</h3>
        <p>
          {t(
            'The original plan and pending records remain in the recovery copy. Current Cloud records are loaded. Start Confirmation 1 again using the current Guest source; previous decisions and final approval do not carry over.',
            '原有計劃與待處理紀錄保留在復原副本內。目前雲端紀錄已載入。請使用目前訪客來源重新進行確認一；舊有決定及最終批准不會沿用。',
          )}
        </p>
      </section>
    );
  const phase = state.guestDelivery?.phase || 'unknown';
  const messages = {
    queued: t(
      'Not submitted. The exact transfer is queued locally; cancellation is available only while this state is still proven.',
      '尚未提交。原轉移已存於本機佇列；只有能證明此狀態時才可取消。',
    ),
    unknown: t(
      'Possibly submitted. A lost response does not prove failure. Verify the original submission before making a different transfer.',
      '可能已提交。遺失回應不能證明失敗；進行不同轉移前須驗證原提交。',
    ),
    rejected: t(
      'The server rejected the last attempt. Verify its receipt or close the original operation safely before a fresh review.',
      '伺服器拒絕了上次嘗試。請查核回執，或安全封鎖原操作後重新覆核。',
    ),
    expired: t(
      'Recovery required. This offline operation predates the archive replay floor. Its old receipt may be in your independent archive; it must not be resent.',
      '需要復原。此離線操作早於封存重送下限；舊回執可能在獨立封存檔內，不能重送。',
    ),
    retired: t(
      'The original operation is closed against future submission. Its records were not deleted or rolled back. Download the current Cloud state for a complete new review.',
      '原操作已封鎖，不能再次提交；沒有刪除或回退紀錄。請下載目前雲端狀態並完整重新覆核。',
    ),
    committed: t(
      'Cloud confirmed the original commit. The current workspace still needs independent verification; do not import it again.',
      '雲端已確認原提交；仍須獨立驗證目前工作區，請勿再次匯入。',
    ),
  };
  const act = async (action: () => Promise<unknown>, reset = false) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setBackup('');
      setReread('');
      setApproved(false);
      if (reset) onReviewed();
    } catch (error) {
      setMessage(
        error instanceof AccountError && error.code === 'merge-local-edits'
          ? t(
              'This older queue contains additional Account edits beyond the approved transfer. Both remain in the cache and recovery file. Automatic cancellation or renewed review is blocked; preserve this file for a separate reconciliation. Receipt verification remains available.',
              '此舊佇列包含已批准轉移以外的帳戶編輯。兩者均保留於快取及復原檔；自動取消或重新覆核已封鎖。請保留檔案以作獨立協調，仍可查核原回執。',
            )
          : t(
              'Recovery is paused. Keep the exported file and original pending work. Reconnect, reauthenticate, or reread a fresh export before trying again. No cancellation or completion is assumed.',
              '復原已暫停。請保留匯出檔與原待處理資料；重新連線、登入，或重新匯出並讀回後再試。不會假定已取消或完成。',
            ),
      );
    } finally {
      setBusy(false);
    }
  };
  const verified =
    backup &&
    backup === reread &&
    backup === engine.recoveryBackup() &&
    snapshot === engine.store.snapshot();
  return (
    <section className="guest-recovery" aria-label={t('Guest transfer recovery', '訪客轉移復原')}>
      <h3>{t('Guest transfer recovery', '訪客轉移復原')}</h3>
      <p role="status">{messages[phase]}</p>
      {state.guestDelivery?.reason === 'source-changed' && (
        <p className="notice amber">
          {t(
            'Guest source changed. Previous approval cannot submit these changed records.',
            '訪客來源已改變；先前批准不適用於變更後紀錄。',
          )}
        </p>
      )}
      {state.guestDelivery?.reason === 'destination-changed' && (
        <p className="notice amber">
          {t(
            'Cloud destination changed. A fresh duplicate review and both confirmations are required.',
            '雲端目的地已改變，須重新覆核重複紀錄及完成兩次確認。',
          )}
        </p>
      )}
      <div className="actions">
        <button
          disabled={busy || !engine.canRun()}
          onClick={() => void act(() => engine.verifyGuestSubmission())}
        >
          {t('Verify Previous Submission', '驗證先前提交')}
        </button>
        {phase === 'unknown' && state.guestDelivery?.reason === 'missing' && (
          <button
            disabled={busy || !engine.canRun()}
            onClick={() => void act(() => engine.retryGuestSubmission())}
          >
            {t('Retry exact original submission', '重試完全相同的原提交')}
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => {
            const text = engine.recoveryBackup();
            requestDownload(text, 'tco-guest-submission-recovery.json');
            setBackup(text);
            setSnapshot(engine.store.snapshot());
            setReread('');
            setApproved(false);
          }}
        >
          {t('Export Recovery Data', '匯出復原資料')}
        </button>
      </div>
      <p>
        {t(
          'The recovery file includes private plaintext records, the exact original operation, both review snapshots and pending data. Save it securely, then select the actual saved file.',
          '復原檔包括私人明文紀錄、完整原操作、雙方覆核快照與待處理資料。請安全儲存，再選取實際儲存的檔案。',
        )}
      </p>
      {backup && (
        <label>
          {t('Reread saved Guest recovery file', '重新讀取已儲存訪客復原檔')}
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setReread('');
              setApproved(false);
              if (!file || file.size > 32 * 1024 * 1024) return;
              void file
                .text()
                .then((text) => {
                  if (text === backup && text === engine.recoveryBackup()) setReread(text);
                  else
                    setMessage(
                      t(
                        'File mismatch. Export the current recovery state again.',
                        '檔案不符，請重新匯出目前復原狀態。',
                      ),
                    );
                })
                .catch(() => setMessage(t('The file could not be read.', '無法讀取檔案。')));
            }}
          />
        </label>
      )}
      {phase === 'queued' && state.operation?.purpose !== 'edit' && (
        <button
          disabled={busy || !verified}
          onClick={() => void act(() => engine.cancelQueuedGuest(reread, snapshot), true)}
        >
          {t('Cancel Unsubmitted Merge', '取消未提交合併')}
        </button>
      )}
      {phase !== 'committed' && (
        <>
          <label>
            <input
              type="checkbox"
              checked={approved}
              disabled={!verified || busy}
              onChange={(event) => setApproved(event.target.checked)}
            />
            {t(
              'I verified this recovery file. Check the original outcome, close it only if uncommitted, and load current Cloud records for a new review. A completed commit will not be undone.',
              '我已驗證復原檔。請查核原結果，只在未提交時封鎖原操作，並載入目前雲端紀錄以重新覆核；已完成提交不會被回退。',
            )}
          </label>
          <button
            disabled={busy || !verified || !approved}
            onClick={() => void act(() => engine.reviewUpdatedGuest(reread, snapshot), true)}
          >
            {t('Review Updated Cloud Records', '覆核最新雲端紀錄')}
          </button>
        </>
      )}
      {message && (
        <p role="alert" className="notice amber">
          {message}
        </p>
      )}
    </section>
  );
}
