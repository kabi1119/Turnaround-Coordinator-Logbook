import { useState, useSyncExternalStore } from 'react';
import type { AccountEngine } from '../cloud/engine';
import { requestDownload } from '../cloud/archive';
import { useT } from '../i18n';
import { compareFields } from './matching';
import { mixedSource, mixedResult } from './mixed';
import AircraftEditor from '../features/AircraftEditor';
import DutyEditor from '../features/DutyEditor';
import { JournalEditor } from '../features/Journal';
import type { Aircraft, Database, Duty, Journal } from '../domain/model';
import { same } from '../sync/records';
import { AccountError } from '../cloud/types';

const show = (value: unknown) =>
  value === undefined || value === null
    ? '—'
    : typeof value === 'string'
      ? value || '—'
      : JSON.stringify(value);
type Editing = {
  key: string;
  collection: 'aircraft' | 'duties' | 'journals';
  id: string;
  db: Database;
  target?: string;
  planId: string;
};
export default function MixedRecoveryControl({
  engine,
  onGuestReview,
  embedded = false,
}: {
  engine: AccountEngine;
  onGuestReview?: () => void;
  embedded?: boolean;
}) {
  const t = useT();
  useSyncExternalStore(engine.subscribe, engine.snapshot);
  const [backup, setBackup] = useState(''),
    [reread, setReread] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState<string | null | undefined>(null);
  const [approved, setApproved] = useState(false),
    [risk, setRisk] = useState(false),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''),
    [editing, setEditing] = useState<Editing | null>(null);
  const state = engine.state(),
    m = state.mixed;
  if (!m) return null;
  const source = mixedSource(m.originalCache),
    cloud = engine.mixedCloud(),
    rows = engine.mixedEditRows();
  const verified =
    !!backup &&
    backup === reread &&
    backup === engine.recoveryBackup() &&
    savedSnapshot === engine.store.snapshot();
  let valid = false,
    highRisk = true;
  try {
    const result = mixedResult(m, cloud);
    valid = true;
    highRisk = result.highRisk;
  } catch {
    /* Incomplete choices or invalid reference graph must not submit. */
  }
  const clearApproval = () => {
    setBackup('');
    setReread('');
    setApproved(false);
    setRisk(false);
  };
  const act = async (action: () => Promise<unknown>, resetGuest = false) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await action();
      clearApproval();
      if (resetGuest) onGuestReview?.();
    } catch (error) {
      setMessage(
        error instanceof AccountError && error.code === 'setup'
          ? t(
              'The recovery service has not been installed on this backend. Keep the exported file and ask the owner to review the pending recovery migration. No operation was removed.',
              '此後端尚未安裝復原服務。請保留匯出檔，並請擁有者覆核待安裝的復原更新；沒有移除任何操作。',
            )
          : t(
              'Review was not applied. Keep your recovery file. Reconnect or review the refreshed Cloud values and every affected link before approving again.',
              '未套用覆核。請保留復原檔，重新連線或覆核最新雲端值及每項關聯後再批准。',
            ),
      );
    } finally {
      setBusy(false);
    }
  };
  const manual = (key: string) => {
    const row = rows.find((r) => r.key === key);
    if (!row || row.collection === 'privacy' || !row.bound) return;
    const value = row.decision?.result || row.candidate || row.cloud || row.local;
    if (!value || typeof value !== 'object') return;
    const db = structuredClone(cloud),
      list = db[row.collection] as unknown as { id: string }[];
    const record = { ...structuredClone(value), id: row.target } as { id: string };
    const at = list.findIndex((r) => r.id === row.target);
    if (at >= 0) list[at] = record;
    else list.push(record);
    setEditing({
      key,
      collection: row.collection,
      id: row.target,
      db,
      target: row.decision?.target,
      planId: m.id,
    });
    clearApproval();
  };
  const commit = async (db: Database) => {
    if (!editing) return false;
    const result = db[editing.collection].find((r) => r.id === editing.id);
    if (!result) return false;
    try {
      await engine.saveMixedDecision(
        editing.key,
        { choice: 'manual', target: editing.target, result },
        editing.planId,
      );
      setEditing(null);
      clearApproval();
      return true;
    } catch {
      setMessage(
        t(
          'Manual edit could not be staged; original data remains.',
          '無法暫存手動編輯，原資料仍保留。',
        ),
      );
      return false;
    }
  };
  const editorRecord = editing
    ? editing.db[editing.collection].find((r) => r.id === editing.id)
    : null;
  return (
    <>
      <section
        className="mixed-recovery"
        aria-label={t('Later Account edits review', '後續帳戶編輯覆核')}
      >
        <h3>
          {t('Later Account edits', '後續帳戶編輯')} · {source.changes.length}
        </h3>
        <p>
          {t(
            'An older version saved Account edits after the Guest transfer was queued. These are separate from the Guest duplicate decisions. The original queue and every retained local value are preserved in this recovery plan.',
            '舊版本在訪客轉移排隊後又儲存了帳戶編輯。這些編輯與訪客重複紀錄決定分開處理；原佇列及所有保留的本機值均存於復原計劃。',
          )}
        </p>
        <p>
          {t('Original Guest outcome', '原訪客操作結果')}:{' '}
          <strong>
            {
              {
                unresolved: t('Awaiting verification', '等待驗證'),
                unsent: t('Cancelled before transmission', '已在傳送前取消'),
                committed: t('Cloud commit confirmed', '雲端提交已確認'),
                retired: t('Uncommitted operation closed', '未提交操作已封鎖'),
                expired: t('Historical receipt expired', '歷史回執已過期'),
              }[m.outcome]
            }
          </strong>{' '}
          · {t('Review stage', '覆核階段')}:{' '}
          {
            {
              'awaiting-cloud': t('Waiting for verified Cloud data', '等待已驗證雲端資料'),
              'guest-review': t('Guest duplicate review', '訪客重複紀錄覆核'),
              'account-review': t('Account edit review', '帳戶編輯覆核'),
              queued: t('Pending verification', '等待驗證'),
              complete: t('Reviewed and verified', '已覆核及驗證'),
            }[m.stage]
          }
        </p>
        {source.retainedOperation && (
          <details>
            <summary>
              {t('Preserved queue order and operation identity', '保留的佇列順序與操作身分')}
            </summary>
            <p>
              {t('Original Guest operation', '原訪客操作')}: {source.plan.operationId}
              <br />
              {t('Recorded later Account operation', '已記錄的後續帳戶操作')}:{' '}
              {source.retainedOperation.id}
              <br />
              {t(
                'Remaining local changes follow that operation. The old format stores their final values, without separate operation IDs or a complete keystroke history.',
                '其餘本機變更排在此操作之後。舊格式儲存其最終值，沒有各自的操作 ID 或完整逐步編輯歷史。',
              )}
            </p>
          </details>
        )}
        {m.stage === 'complete' ? (
          <p role="status">
            {t(
              'Later Account edits were separately reviewed and the current Cloud state verified. The original recovery copy remains available.',
              '後續帳戶編輯已獨立覆核並核實目前雲端狀態；原復原副本仍保留。',
            )}
          </p>
        ) : (
          <>
            {m.stage === 'awaiting-cloud' && (
              <p>
                {m.outcome === 'unsent'
                  ? t(
                      'Only the unsent Guest operation was cancelled. Later edits remain preserved and blocked until the current Cloud records are loaded and their dependencies reviewed.',
                      '只取消了尚未提交的訪客操作。後續編輯仍保留；載入目前雲端紀錄並覆核依賴前會保持封鎖。',
                    )
                  : source.retainedOperation && m.outcome !== 'unresolved'
                    ? t(
                        'The original Guest outcome is established. A separately recorded Account operation still needs its own receipt verification. It will not be silently replayed or removed.',
                        '原訪客結果已查明，但另一項已記錄帳戶操作仍須獨立查核回執；不會默默重送或移除。',
                      )
                    : t(
                        'Resolve the original Guest outcome with the verification controls below before reviewing later Account edits.',
                        '請先使用下方驗證控制查明原訪客結果，再覆核後續帳戶編輯。',
                      )}
              </p>
            )}
            {m.stage === 'awaiting-cloud' &&
              m.outcome === 'unresolved' &&
              !embedded &&
              onGuestReview && (
                <button onClick={onGuestReview}>
                  {t('Verify original Guest outcome', '驗證原訪客結果')}
                </button>
              )}
            {m.stage === 'guest-review' && (
              <>
                <p>
                  {t(
                    'Complete the fresh Guest duplicate review first. Later Account edits remain blocked and require their own approval afterward.',
                    '請先完成新的訪客重複紀錄覆核。後續帳戶編輯仍被封鎖，之後須另外批准。',
                  )}
                </p>
                {!embedded && onGuestReview && (
                  <button onClick={onGuestReview}>
                    {t('Open Guest duplicate review', '開啟訪客重複紀錄覆核')}
                  </button>
                )}
              </>
            )}
            {m.stage === 'queued' && (
              <p role="status">
                {t(
                  'The separately approved Account edits are pending server verification. Their exact operation is retained; changing decisions requires verified renewal.',
                  '已獨立批准的帳戶編輯正在等待伺服器驗證；完整原操作已保留，更改決定前須經驗證重新覆核。',
                )}
              </p>
            )}
            {m.stage === 'account-review' && (
              <>
                <p>
                  {t(
                    'Keep Local applies only the changes made after the approved merge, preserving unrelated newer Cloud fields. Deletions, changed identities and all relationships require review. Unbound Guest-derived identities cannot be uploaded through an ordinary edit.',
                    '保留本機只套用已批准合併之後的改動，並保留其他較新的雲端欄位。請覆核刪除、身分變更及所有關聯；未綁定的訪客來源身分不能透過一般編輯上傳。',
                  )}
                </p>
                {rows.map((row) => (
                  <fieldset key={row.key}>
                    <legend>
                      {row.collection} · {row.id}
                    </legend>
                    <p>
                      {row.kind}
                      {row.deletion ? ` · ${t('Later deletion', '後續刪除')}` : ''}
                      {row.conflict
                        ? ` · ${t('Cloud differs from the old baseline', '雲端與舊基準不同')}`
                        : ''}
                    </p>
                    {!row.bound && (
                      <p className="notice amber">
                        {t(
                          'This Guest identity is not bound to the current workspace. Review Guest dependencies or explicitly choose an existing target before keeping/editing it.',
                          '此訪客身分尚未綁定目前工作區；請覆核訪客依賴，或先明確選擇現有目標再保留／編輯。',
                        )}
                      </p>
                    )}
                    {!!row.missing.length && (
                      <p className="notice amber">
                        {t('Unresolved references', '未解決關聯')}: {row.missing.join(', ')}.{' '}
                        {t(
                          'Use Manual Edit to choose valid current links.',
                          '請手動編輯並選擇有效的目前連結。',
                        )}
                      </p>
                    )}
                    <details>
                      <summary>
                        {t(
                          'Compare all retained values and later edit intent',
                          '比對全部保留值及後續編輯意圖',
                        )}
                      </summary>
                      <div className="mixed-values">
                        <div>
                          <strong>{t('Reviewed merge baseline', '已覆核合併基準')}</strong>
                          <pre>{show(row.before)}</pre>
                        </div>
                        <div>
                          <strong>{t('Retained later local version', '保留的後續本機版本')}</strong>
                          <pre>{show(row.local)}</pre>
                        </div>
                      </div>
                      {!same(row.before, row.queued) && (
                        <div>
                          <strong>
                            {t('Recorded intermediate Account operation', '已記錄的中間帳戶操作')}
                          </strong>
                          <pre>{show(row.queued)}</pre>
                        </div>
                      )}
                      {compareFields(
                        row.cloud,
                        row.decision?.choice === 'manual' ? row.decision.result : row.candidate,
                      )
                        .filter((d) => !same(d.cloud, d.local))
                        .map((d) => (
                          <div className="guest-merge-difference" key={d.field}>
                            <strong>{d.field}</strong>
                            <div className="mixed-values">
                              <p>
                                {t('Cloud', '雲端')}: {show(d.cloud)}
                              </p>
                              <p>
                                {t('Proposed later edit', '擬套用後續編輯')}: {show(d.local)}
                              </p>
                            </div>
                          </div>
                        ))}
                    </details>
                    {row.collection !== 'privacy' && (
                      <label>
                        {t('Explicit existing target (optional)', '明確指定現有目標（選填）')}
                        <select
                          disabled={busy}
                          value={row.decision?.target || ''}
                          onChange={(event) =>
                            void act(() =>
                              engine.saveMixedDecision(
                                row.key,
                                { choice: 'manual', target: event.target.value || undefined },
                                m.id,
                              ),
                            )
                          }
                        >
                          <option value="">
                            {t('Use reviewed identity mapping', '使用已覆核身分對應')}
                          </option>
                          {cloud[row.collection].map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.id}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="actions">
                      <button
                        aria-pressed={row.decision?.choice === 'cloud'}
                        disabled={busy}
                        onClick={() =>
                          void act(() =>
                            engine.saveMixedDecision(
                              row.key,
                              { choice: 'cloud', target: row.decision?.target },
                              m.id,
                            ),
                          )
                        }
                      >
                        {t('Keep Cloud', '保留雲端')}
                      </button>
                      <button
                        aria-pressed={row.decision?.choice === 'local'}
                        disabled={busy || !row.bound || !!row.missing.length}
                        onClick={() =>
                          void act(() =>
                            engine.saveMixedDecision(
                              row.key,
                              { choice: 'local', target: row.decision?.target },
                              m.id,
                            ),
                          )
                        }
                      >
                        {t('Keep Local', '保留本機')}
                      </button>
                      {row.collection !== 'privacy' && (
                        <button
                          aria-pressed={
                            row.decision?.choice === 'manual' && row.decision.result !== undefined
                          }
                          disabled={busy || !row.bound}
                          onClick={() => manual(row.key)}
                        >
                          {t('Manual Edit', '手動編輯')}
                        </button>
                      )}
                    </div>
                    <p>
                      {t(
                        'Keep Cloud removes only this unsent later edit from the new submission. Its original value remains in the recovery copy; dependent edits must still form a valid graph.',
                        '保留雲端只把此項尚未提交的後續編輯排除於新提交之外；原值仍在復原副本內，其他依賴編輯仍須形成有效關聯。',
                      )}
                    </p>
                    {row.collection === 'privacy' && (
                      <details>
                        <summary>{t('Manual Edit', '手動編輯')}</summary>
                        {Object.entries(cloud.settings.privacy).map(([key, value]) => (
                          <label key={key}>
                            <input
                              type="checkbox"
                              checked={Boolean(
                                (row.decision?.result as Record<string, boolean> | undefined)?.[
                                  key
                                ] ?? value,
                              )}
                              onChange={(event) =>
                                void act(() =>
                                  engine.saveMixedDecision(
                                    row.key,
                                    {
                                      choice: 'manual',
                                      result: {
                                        ...cloud.settings.privacy,
                                        ...((row.decision?.result as object) || {}),
                                        [key]: event.target.checked,
                                      },
                                    },
                                    m.id,
                                  ),
                                )
                              }
                            />
                            {key}
                          </label>
                        ))}
                      </details>
                    )}
                  </fieldset>
                ))}
                {!valid && (
                  <p className="notice amber">
                    {t(
                      'Resolve every entry and its links. Missing Duty/Journal/Aircraft references, duplicate target writes or incomplete manual decisions block approval.',
                      '請解決每項編輯及其連結。缺少更次／日誌／航機關聯、重複目標或未完成手動決定會阻擋批准。',
                    )}
                  </p>
                )}
              </>
            )}
          </>
        )}
        <button
          disabled={busy}
          onClick={() => {
            const text = engine.recoveryBackup();
            requestDownload(text, 'tco-mixed-account-recovery.json');
            setBackup(text);
            setSavedSnapshot(engine.store.snapshot());
            setReread('');
            setApproved(false);
            setRisk(false);
          }}
        >
          {t('Download mixed-queue recovery file', '下載混合佇列復原檔')}
        </button>
        {backup && (
          <label>
            {t('Reread saved mixed-queue recovery file', '重新讀取已儲存混合佇列復原檔')}
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setReread('');
                setApproved(false);
                setRisk(false);
                if (!file || file.size > 64 * 1024 * 1024) return;
                void file
                  .text()
                  .then((text) => {
                    if (text === backup && text === engine.recoveryBackup()) setReread(text);
                    else
                      setMessage(
                        t(
                          'File mismatch; export the current plan again.',
                          '檔案不符，請重新匯出目前計劃。',
                        ),
                      );
                  })
                  .catch(() => setMessage(t('File could not be read.', '無法讀取檔案。')));
              }}
            />
          </label>
        )}
        {m.stage === 'awaiting-cloud' && m.outcome === 'unsent' && (
          <button
            disabled={!verified || busy}
            onClick={() => void act(() => engine.loadMixedCloud(reread, savedSnapshot))}
          >
            {t('Load current Cloud for later edits review', '載入目前雲端以覆核後續編輯')}
          </button>
        )}
        {m.stage === 'awaiting-cloud' && m.outcome !== 'unresolved' && source.retainedOperation && (
          <>
            <label>
              <input
                type="checkbox"
                checked={approved}
                disabled={!verified || busy}
                onChange={(event) => setApproved(event.target.checked)}
              />
              {t(
                'I verified the complete recovery file. Check the later operation independently and fence it only if it has not committed; then prepare a separate review of all retained changes.',
                '我已驗證完整復原檔。請獨立查核後續操作，只在未提交時封鎖它，再準備全部保留變更的獨立覆核。',
              )}
            </label>
            <button
              disabled={!verified || !approved || busy}
              onClick={() =>
                void act(() => engine.resolveRetainedAccountOperation(reread, savedSnapshot), true)
              }
            >
              {t('Verify retained Account operation', '驗證保留的帳戶操作')}
            </button>
          </>
        )}
        {m.stage === 'guest-review' && (
          <button
            disabled={!verified || busy}
            onClick={() =>
              void act(() => engine.chooseMixedGuestReview(false, reread, savedSnapshot))
            }
          >
            {t(
              'Continue without Guest transfer; review later edits only',
              '不轉移訪客資料，只覆核後續編輯',
            )}
          </button>
        )}
        {m.stage === 'account-review' && (
          <>
            {m.skipGuest && m.outcome !== 'committed' && (
              <button
                disabled={!verified || busy}
                onClick={() =>
                  void act(() => engine.chooseMixedGuestReview(true, reread, savedSnapshot), true)
                }
              >
                {t('Review Guest dependencies first', '先覆核訪客依賴')}
              </button>
            )}
            <label>
              <input
                type="checkbox"
                checked={approved}
                disabled={!verified || !valid || busy}
                onChange={(event) => setApproved(event.target.checked)}
              />
              {t(
                'I reviewed every later Account edit and all links, verified this recovery file, and separately approve this reconciliation.',
                '我已覆核每項後續帳戶編輯及所有關聯、驗證此復原檔，並獨立批准本次協調。',
              )}
            </label>
            {highRisk && (
              <label>
                <input
                  type="checkbox"
                  checked={risk}
                  disabled={!verified || !valid || busy}
                  onChange={(event) => setRisk(event.target.checked)}
                />
                {t(
                  'I approve the reviewed deletions, resurrections or replacements of changed Cloud values.',
                  '我批准已覆核的刪除、復原或取代已變更雲端值。',
                )}
              </label>
            )}
            <button
              className="primary"
              disabled={busy || !valid || !verified || !approved || (highRisk && !risk)}
              onClick={() =>
                void act(() => engine.approveMixed(reread, savedSnapshot, approved, risk))
              }
            >
              {t('Approve later Account edits', '批准後續帳戶編輯')}
            </button>
          </>
        )}
        {m.stage === 'queued' && (
          <div className="actions">
            <button disabled={busy} onClick={() => void act(() => engine.run())}>
              {t('Retry exact approved Account edits', '重試完全相同的已批准帳戶編輯')}
            </button>
            <button
              disabled={busy || !verified}
              onClick={() => void act(() => engine.renewMixedReview(reread, savedSnapshot))}
            >
              {t('Verify submitted edits or renew review', '驗證已提交編輯或重新覆核')}
            </button>
          </div>
        )}
        {message && (
          <p className="notice amber" role="alert">
            {message}
          </p>
        )}
      </section>
      {editing && editorRecord && (
        <>
          {editing.collection === 'aircraft' && (
            <AircraftEditor
              db={editing.db}
              existing={editorRecord as Aircraft}
              migrationReview
              onClose={() => setEditing(null)}
              onSaved={() => {}}
              commit={commit}
            />
          )}
          {editing.collection === 'duties' && (
            <DutyEditor
              db={editing.db}
              existing={editorRecord as Duty}
              onClose={() => setEditing(null)}
              commit={commit}
            />
          )}
          {editing.collection === 'journals' && (
            <JournalEditor
              db={editing.db}
              existing={editorRecord as Journal}
              onClose={() => setEditing(null)}
              commit={commit}
            />
          )}
        </>
      )}
    </>
  );
}
