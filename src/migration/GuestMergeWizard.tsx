import { useState, useSyncExternalStore } from 'react';
import { Modal } from '../components/ui';
import { useT } from '../i18n';
import { readDatabase, STORAGE_KEY } from '../lib/storage';
import AircraftEditor from '../features/AircraftEditor';
import DutyEditor from '../features/DutyEditor';
import { JournalEditor } from '../features/Journal';
import type { AccountEngine } from '../cloud/engine';
import { requestDownload } from '../cloud/archive';
import { compareFields } from './matching';
import {
  bulkDecide,
  confirmFinal,
  confirmPreparation,
  decide,
  manualContext,
  previewMerge,
  requestMerge,
  resolved,
  selectEligible,
  setPreferences,
  type MergePlan,
  type ReviewItem,
} from './plan';
import type { Aircraft, Duty, Journal } from '../domain/model';
import type { Database } from '../domain/model';
import GuestRecoveryControl from './GuestRecoveryControl';
import MixedRecoveryControl from './MixedRecoveryControl';

const display = (value: unknown) =>
  value === undefined || value === null || value === ''
    ? '—'
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);
function sourceSnapshot() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error('No saved Guest source');
  const loaded = readDatabase();
  if (loaded.error || loaded.snapshot !== raw) throw new Error('Unreadable Guest source');
  return { raw, db: loaded.db };
}
type Editing = {
  item: ReviewItem;
  target: string;
  basis: 'cloud' | 'local';
  context: ReturnType<typeof manualContext>;
};
export default function GuestMergeWizard({
  engine,
  onClose,
}: {
  engine: AccountEngine;
  onClose: () => void;
}) {
  const t = useT();
  useSyncExternalStore(engine.subscribe, engine.snapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [permission, setPermission] = useState(false);
  const [savedReview, setSavedReview] = useState('');
  const [verifiedReview, setVerifiedReview] = useState('');
  const [finalReview, setFinalReview] = useState(false);
  const [finalConsent, setFinalConsent] = useState(false);
  const [highRiskConsent, setHighRiskConsent] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [manualItem, setManualItem] = useState<ReviewItem | null>(null);
  const [manualTarget, setManualTarget] = useState('');
  const [basis, setBasis] = useState<'cloud' | 'local'>('local');
  const state = engine.state();
  const reviewReady =
    (!state.mixed || state.mixed.stage === 'complete' || state.mixed.stage === 'guest-review') &&
    (!state.recovery ||
      state.recovery.stage === 'approved' ||
      !!(state.recovery.merge && state.recovery.guestReady));
  const plan = state.merge;
  const userId = engine.store.account.userId;
  let source: ReturnType<typeof sourceSnapshot> | null = null;
  try {
    source = sourceSnapshot();
  } catch {
    /* Preserve unreadable Guest bytes. */
  }
  const stale =
    !!plan &&
    (source?.raw !== plan.sourceSnapshot ||
      state.cursor !== plan.destinationRevision ||
      engine.store.account.workspaceId !== plan.workspaceId);
  const reviewBackup = plan
    ? JSON.stringify({ kind: 'tco-guest-review-backup', version: 1, plan })
    : '';
  const canReplaceReview =
    !plan || !stale || (savedReview === reviewBackup && verifiedReview === reviewBackup);
  const summary =
    plan?.stage === 'review' && plan.items.every((i) => resolved(plan.decisions[i.key]))
      ? (() => {
          try {
            return previewMerge(plan).summary;
          } catch {
            return null;
          }
        })()
      : null;
  const act = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch {
      setError(
        t(
          'Review could not be saved safely. No Guest records were changed.',
          '無法安全儲存覆核；訪客原有紀錄未變。',
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async (next: MergePlan) => {
    await engine.saveMergeReview(next, sourceSnapshot().raw);
  };
  const start = () =>
    act(async () => {
      if (!source || !permission || !canReplaceReview) throw new Error('Permission required');
      const latest = sourceSnapshot();
      const current = engine.store.read();
      const initial = await requestMerge({
        source: latest.db,
        destination: current.db,
        sourceSnapshot: latest.raw,
        userId,
        workspaceId: engine.store.account.workspaceId,
        revision: state.cursor,
      });
      await save(confirmPreparation(initial, userId));
      setSelected([]);
      setFinalReview(false);
    });
  const choose = (item: ReviewItem, choice: 'cloud' | 'local') =>
    act(async () => {
      if (!plan || stale || item.targets.length !== 1) throw new Error('Manual review required');
      await save(decide(plan, item.key, { choice, target: item.targets[0] }, userId));
      setFinalReview(false);
    });
  const edit = () => {
    if (!plan || !manualItem || !manualTarget || stale) return;
    try {
      setEditing({
        item: manualItem,
        target: manualTarget,
        basis,
        context: manualContext(plan, manualItem, manualTarget, basis),
      });
      setError('');
    } catch {
      setError(t('Editor context could not be prepared.', '無法準備編輯內容。'));
    }
  };
  const commitEdit = async (db: Database) => {
    if (!plan || !editing || stale) return false;
    const { item, target } = editing;
    const result = db[item.collection].find((row) => row.id === editing.context.record.id);
    if (!result) return false;
    try {
      const next = decide(
        plan,
        item.key,
        {
          choice: 'manual',
          target,
          result: { ...result, id: item.sourceId },
          references: 'staged',
        },
        userId,
      );
      await save(next);
      setManualItem(null);
      setFinalReview(false);
      return true;
    } catch {
      setError(
        t(
          'Manual result could not be staged. Nothing was uploaded.',
          '無法暫存手動編輯結果；沒有上傳資料。',
        ),
      );
      return false;
    }
  };
  const fieldLabel = (field: string) => field.replaceAll('.', ' · ');
  return (
    <>
      <Modal
        title={t('Review Guest data transfer', '覆核訪客資料轉移')}
        onClose={onClose}
        wide
        syncControl
      >
        <section className="guest-merge-review">
          <MixedRecoveryControl
            engine={engine}
            embedded
            onGuestReview={() => {
              setPermission(false);
              setFinalReview(false);
              setFinalConsent(false);
              setHighRiskConsent(false);
              setSelected([]);
              setSavedReview('');
              setVerifiedReview('');
            }}
          />
          <GuestRecoveryControl
            engine={engine}
            onReviewed={() => {
              setPermission(false);
              setFinalReview(false);
              setFinalConsent(false);
              setHighRiskConsent(false);
              setSelected([]);
              setSavedReview('');
              setVerifiedReview('');
            }}
          />
          <p>
            {t(
              'Guest originals stay on this device. Account records are server-readable, not end-to-end encrypted. Review hidden fields and linked records before any upload.',
              '訪客原件會留在此裝置。帳戶紀錄可由伺服器讀取，並非端對端加密。上傳前請覆核隱藏欄位及關聯紀錄。',
            )}
          </p>
          {error && (
            <p role="alert" className="notice amber">
              {error}
            </p>
          )}
          {!source && (
            <p role="alert" className="notice amber">
              {t(
                'No readable, saved Guest workspace was found. Unsaved sample records cannot be transferred.',
                '找不到可讀取的已儲存訪客工作區；未儲存的範例紀錄不能轉移。',
              )}
            </p>
          )}
          {source &&
            ((!plan && reviewReady) ||
              (stale &&
                ['review', 'verified'].includes(plan.stage) &&
                !state.operation &&
                reviewReady)) && (
              <>
                <p>
                  {t('Source: saved Guest workspace', '來源：已儲存訪客工作區')} ·{' '}
                  {source.db.aircraft.length} {t('aircraft', '航機')} · {source.db.duties.length}{' '}
                  {t('duties', '更次')} · {source.db.journals.length} {t('journals', '日誌')}
                </p>
                <p>
                  {t('Destination: current Cloud Account', '目的地：目前雲端帳戶')} ·{' '}
                  {engine.store.read().db.aircraft.length} {t('aircraft', '航機')}
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={permission}
                    onChange={(e) => setPermission(e.target.checked)}
                  />
                  {t(
                    'Confirmation 1: prepare an individual review; do not upload yet.',
                    '確認一：準備逐項覆核，現階段不會上傳。',
                  )}
                </label>
                <button
                  disabled={!permission || busy || !canReplaceReview}
                  onClick={() => void start()}
                >
                  {t(
                    plan ? 'Start a new review' : 'Prepare duplicate review',
                    plan ? '重新開始覆核' : '準備重複紀錄覆核',
                  )}
                </button>
              </>
            )}
          {plan && stale && (
            <p role="alert" className="notice amber">
              {t(
                'The Guest source or Account destination changed. This plan cannot be submitted. Start a new review only after preserving a backup of pending work.',
                '訪客來源或帳戶目的地已有變動，不能提交此計劃。請先備份待處理資料，再重新覆核。',
              )}
            </p>
          )}
          {plan && stale && !state.operation && reviewReady && (
            <section>
              <p>
                {t(
                  'Before replacing this review, download and reread its complete pending plan. Manual edits and decisions in the old plan must remain recoverable.',
                  '取代此覆核前，請下載並重新讀取完整待處理計劃。舊計劃中的手動編輯和決定必須可供復原。',
                )}
              </p>
              <button
                onClick={() => {
                  requestDownload(reviewBackup, 'tco-guest-review-recovery.json');
                  setSavedReview(reviewBackup);
                  setVerifiedReview('');
                }}
              >
                {t('Download old review plan', '下載舊覆核計劃')}
              </button>
              {savedReview && (
                <label>
                  {t('Reread the saved review file', '重新讀取已儲存覆核檔案')}
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setVerifiedReview('');
                      if (!file || file.size > 32 * 1024 * 1024) return;
                      void file
                        .text()
                        .then((text) => {
                          if (text === reviewBackup && text === savedReview)
                            setVerifiedReview(text);
                        })
                        .catch(() => {});
                    }}
                  />
                </label>
              )}
              {canReplaceReview && (
                <p role="status">{t('Saved review file verified.', '已驗證儲存的覆核檔案。')}</p>
              )}
            </section>
          )}
          {plan &&
            ['permission', 'review'].includes(plan.stage) &&
            !state.operation &&
            reviewReady && (
              <section>
                <p>
                  {t(
                    'This review has not been submitted. To cancel it, save and reread the complete review plan first. Guest and Account records are unchanged.',
                    '此覆核尚未提交。取消前請儲存並重新讀取完整覆核計劃。訪客及帳戶紀錄不變。',
                  )}
                </p>
                <button
                  disabled={busy}
                  onClick={() => {
                    requestDownload(reviewBackup, 'tco-guest-review-recovery.json');
                    setSavedReview(reviewBackup);
                    setVerifiedReview('');
                  }}
                >
                  {t('Download unsubmitted review', '下載未提交覆核')}
                </button>
                {savedReview === reviewBackup && (
                  <label>
                    {t('Reread saved review', '重新讀取已儲存覆核')}
                    <input
                      type="file"
                      accept="application/json,.json"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        setVerifiedReview('');
                        if (!file || file.size > 32 * 1024 * 1024) return;
                        void file
                          .text()
                          .then((text) => {
                            if (text === reviewBackup && text === savedReview)
                              setVerifiedReview(text);
                          })
                          .catch(() => {});
                      }}
                    />
                  </label>
                )}
                <button
                  disabled={busy || !reviewBackup || verifiedReview !== reviewBackup}
                  onClick={() =>
                    void act(async () => {
                      await engine.cancelUnsubmittedReview(engine.store.snapshot());
                      setSavedReview('');
                      setVerifiedReview('');
                      setPermission(false);
                    })
                  }
                >
                  {t('Cancel unsubmitted review', '取消未提交覆核')}
                </button>
              </section>
            )}
          {plan?.stage === 'review' && !stale && (
            <>
              <p>
                {t(
                  'Review every suspected duplicate. Distinct records are added with collision-safe IDs and all links checked.',
                  '請逐項覆核疑似重複紀錄。獨立紀錄會以避免碰撞的識別碼加入，並檢查全部關聯。',
                )}
              </p>
              <div className="guest-merge-bulk">
                <button onClick={() => setSelected(selectEligible(plan))}>
                  {t('Select eligible', '選取合資格項目')}
                </button>
                <button onClick={() => setSelected([])}>{t('Clear selection', '清除選取')}</button>
                <button
                  disabled={!selected.length || busy}
                  onClick={() =>
                    void act(async () => {
                      await save(bulkDecide(plan, selected, 'cloud', userId));
                      setSelected([]);
                    })
                  }
                >
                  {t('Keep Cloud for selected', '所選項目保留雲端版本')}
                </button>
                <button
                  disabled={!selected.length || busy}
                  onClick={() =>
                    void act(async () => {
                      await save(bulkDecide(plan, selected, 'local', userId));
                      setSelected([]);
                    })
                  }
                >
                  {t('Keep Local for selected', '所選項目保留訪客版本')}
                </button>
              </div>
              {plan.items.map((item) => {
                const guest = plan.source[item.collection].find((r) => r.id === item.sourceId);
                const decision = plan.decisions[item.key];
                const candidate =
                  plan.groups
                    .find((g) => g.id === item.group)
                    ?.candidates.filter((c) => c.localId === item.sourceId) || [];
                return (
                  <fieldset key={item.key}>
                    <legend>
                      {item.collection} · {guest && 'date' in guest ? guest.date : item.sourceId} ·{' '}
                      {item.kind}
                    </legend>
                    <p>
                      {t('Guest', '訪客')}:{' '}
                      {guest && 'airline' in guest
                        ? `${guest.airline} · ${guest.arrival.flight} / ${guest.departure.flight}`
                        : guest && 'title' in guest
                          ? guest.title
                          : item.sourceId}
                    </p>
                    <p>
                      {t('Current choice', '目前選擇')}:{' '}
                      {decision ? decision.choice : t('Unresolved', '未解決')}
                      {decision?.choice === 'manual' && decision.separate
                        ? ` · ${t('Separate records', '獨立紀錄')}`
                        : ''}
                    </p>
                    {item.bulkEligible && (
                      <label>
                        <input
                          type="checkbox"
                          checked={selected.includes(item.key)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, item.key]
                                : selected.filter((k) => k !== item.key),
                            )
                          }
                        />
                        {t('Select for eligible bulk decision', '選取作合資格批次決定')}
                      </label>
                    )}
                    {item.targets.map((target) => {
                      const cloud = plan.destination[item.collection].find((r) => r.id === target);
                      const edge = candidate.find((c) => c.cloudId === target);
                      return (
                        <details key={target}>
                          <summary>
                            {t('Cloud candidate', '雲端候選紀錄')} ·{' '}
                            {cloud && 'date' in cloud ? cloud.date : target} ·{' '}
                            {edge?.canonicalFlights.join(', ') ||
                              t('No shared flight number', '沒有共用航班編號')}
                          </summary>
                          {edge?.reasons.length ? <p>{edge.reasons.join(' · ')}</p> : null}
                          {compareFields(cloud, guest).map((diff) => (
                            <p key={diff.field} className="guest-merge-difference">
                              <strong>{fieldLabel(diff.field)}</strong> · {diff.state}
                              <br />
                              {t('Cloud', '雲端')}: {display(diff.cloud)}
                              <br />
                              {t('Guest', '訪客')}: {display(diff.local)}
                            </p>
                          ))}
                        </details>
                      );
                    })}
                    <div className="actions">
                      <button
                        disabled={busy || item.targets.length !== 1}
                        onClick={() => void choose(item, 'cloud')}
                      >
                        {t('Keep Cloud', '保留雲端版本')}
                      </button>
                      <button
                        disabled={busy || item.targets.length !== 1}
                        onClick={() => void choose(item, 'local')}
                      >
                        {t('Keep Local', '保留訪客版本')}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setManualItem(item);
                          setManualTarget(item.targets[0] || '');
                          setBasis('local');
                        }}
                      >
                        {t('Manual Edit', '手動編輯')}
                      </button>
                    </div>
                  </fieldset>
                );
              })}
              {manualItem && (
                <fieldset className="guest-merge-manual">
                  <legend>
                    {t('Manual review', '手動覆核')} · {manualItem.collection}
                  </legend>
                  <p>
                    {t(
                      'Choose a candidate and starting version, then edit it in the normal record editor. The result remains staged until final approval.',
                      '選擇候選紀錄及起始版本，再於原有紀錄編輯器修改。最終批准前只會暫存結果。',
                    )}
                  </p>
                  {manualItem.targets.length > 0 && (
                    <>
                      <label>
                        {t('Cloud candidate', '雲端候選紀錄')}
                        <select
                          value={manualTarget}
                          onChange={(e) => setManualTarget(e.target.value)}
                        >
                          {manualItem.targets.map((id) => (
                            <option value={id} key={id}>
                              {id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t('Starting version', '起始版本')}
                        <select
                          value={basis}
                          onChange={(e) => setBasis(e.target.value as 'cloud' | 'local')}
                        >
                          <option value="local">{t('Guest', '訪客')}</option>
                          <option value="cloud">{t('Cloud', '雲端')}</option>
                        </select>
                      </label>
                      <button disabled={busy} onClick={edit}>
                        {t('Open record editor', '開啟紀錄編輯器')}
                      </button>
                    </>
                  )}
                  <button
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await save(
                          decide(
                            plan,
                            manualItem.key,
                            { choice: 'manual', separate: true },
                            userId,
                          ),
                        );
                        setManualItem(null);
                        setFinalReview(false);
                      })
                    }
                  >
                    {t('These are separate legitimate records', '兩者是各自獨立的真實紀錄')}
                  </button>
                </fieldset>
              )}
              <fieldset>
                <legend>{t('Optional-field preferences', '選填欄位偏好')}</legend>
                <p>
                  {t(
                    'Keep Account preferences by default. Choosing Guest preferences changes visibility, not whether saved fields exist.',
                    '預設保留帳戶偏好。選擇訪客偏好只會改變欄位顯示，不會刪除已儲存欄位。',
                  )}
                </p>
                <label>
                  <input
                    type="radio"
                    checked={plan.preferences === 'account'}
                    onChange={() => void act(() => save(setPreferences(plan, 'account', userId)))}
                  />
                  {t('Keep Account preferences', '保留帳戶偏好')}
                </label>
                <label>
                  <input
                    type="radio"
                    checked={plan.preferences === 'guest'}
                    onChange={() => void act(() => save(setPreferences(plan, 'guest', userId)))}
                  />
                  {t('Use Guest preferences', '採用訪客偏好')}
                </label>
              </fieldset>
              <button
                disabled={!summary || busy}
                onClick={() => {
                  setFinalReview(true);
                  setFinalConsent(false);
                  setHighRiskConsent(false);
                }}
              >
                {t('Review transfer summary', '覆核轉移摘要')}
              </button>
              {finalReview && summary && (
                <section>
                  <h3>{t('Final transfer review', '最終轉移覆核')}</h3>
                  <p>
                    {t('Add', '新增')}: {summary.add.aircraft} {t('aircraft', '航機')},{' '}
                    {summary.add.duties} {t('duties', '更次')}, {summary.add.journals}{' '}
                    {t('journals', '日誌')} · {t('Replace', '取代')}: {summary.replaced} ·{' '}
                    {t('Keep Cloud', '保留雲端版本')}: {summary.skipped} ·{' '}
                    {t('Manual edits', '手動編輯')}: {summary.manual}
                  </p>
                  {summary.highRisk.length > 0 && (
                    <p className="notice amber">{summary.highRisk.join(' · ')}</p>
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={finalConsent}
                      onChange={(e) => setFinalConsent(e.target.checked)}
                    />
                    {t(
                      'Confirmation 2: I reviewed all records, links and settings and approve this transfer.',
                      '確認二：我已覆核全部紀錄、關聯及設定，並批准轉移。',
                    )}
                  </label>
                  {summary.highRisk.length > 0 && (
                    <label>
                      <input
                        type="checkbox"
                        checked={highRiskConsent}
                        onChange={(e) => setHighRiskConsent(e.target.checked)}
                      />
                      {t(
                        'I separately approve the highlighted high-risk replacements or settings changes.',
                        '我另行批准上述高風險取代或設定變更。',
                      )}
                    </label>
                  )}
                  <button
                    className="primary"
                    disabled={
                      busy || !finalConsent || (!!summary.highRisk.length && !highRiskConsent)
                    }
                    onClick={() =>
                      void act(async () => {
                        const current = engine.store.read();
                        const latest = sourceSnapshot();
                        const final = await confirmFinal(
                          plan,
                          {
                            userId,
                            workspaceId: engine.store.account.workspaceId,
                            sourceSnapshot: latest.raw,
                            destination: current.db,
                            revision: engine.state().cursor,
                          },
                          highRiskConsent,
                        );
                        await engine.queueMerge(final, sourceSnapshot().raw);
                        setFinalReview(false);
                      })
                    }
                  >
                    {t('Approve and queue transfer', '批准並加入轉移佇列')}
                  </button>
                </section>
              )}
            </>
          )}
          {plan?.stage === 'verified' && (
            <details open>
              <summary>{t('View Completed Merge', '查看已完成合併')}</summary>
              <p role="status">
                {t(
                  'The original transfer was confirmed and the current Cloud workspace was independently retrieved. Later Cloud edits may also be present. Guest originals remain on this device.',
                  '原轉移已確認，目前雲端工作區亦已獨立讀取；當中可能包含之後的雲端編輯。訪客原件仍保留於此裝置。',
                )}
              </p>
              <p>
                {t('Verified transfer revision', '已驗證轉移修訂版')}: {plan.verifiedRevision} ·{' '}
                {t('Current revision', '目前修訂版')}: {state.cursor}
              </p>
            </details>
          )}
        </section>
      </Modal>
      {editing && plan && (
        <>
          {editing.item.collection === 'aircraft' && (
            <AircraftEditor
              db={editing.context.db}
              existing={editing.context.record as Aircraft}
              migrationReview
              onClose={() => setEditing(null)}
              onSaved={() => {}}
              commit={commitEdit}
            />
          )}
          {editing.item.collection === 'duties' && (
            <DutyEditor
              db={editing.context.db}
              existing={editing.context.record as Duty}
              onClose={() => setEditing(null)}
              commit={commitEdit}
            />
          )}
          {editing.item.collection === 'journals' && (
            <JournalEditor
              db={editing.context.db}
              existing={editing.context.record as Journal}
              onClose={() => setEditing(null)}
              commit={commitEdit}
            />
          )}
        </>
      )}
    </>
  );
}
