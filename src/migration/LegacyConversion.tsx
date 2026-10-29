import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasVault, openVault } from '../workspaces/vault';
import type { WorkspaceStore, Commit } from '../workspaces/store';
import type { Aircraft, Database, Duty, Journal } from '../domain/model';
import { transport } from '../sync/transport';
import { accountTransport } from '../cloud/transport';
import type { AccountPull } from '../cloud/types';
import { useT } from '../i18n';
import { requestDownload } from '../cloud/archive';
import { compareFields } from './matching';
import AircraftEditor from '../features/AircraftEditor';
import DutyEditor from '../features/DutyEditor';
import { JournalEditor } from '../features/Journal';
import {
  inspectLegacy,
  legacyBackupText,
  legacyDifferences,
  reconcileLegacy,
  verifyLegacyBackup,
  type LegacySource,
  type LegacyDecisions,
} from './legacy';
import {
  approveConversion,
  conversionKey,
  runConversion,
  validateConversion,
  restartConversion,
  type Conversion,
} from './conversion';

export default function LegacyConversion({
  userId,
  client,
  active,
  onComplete,
  onClose,
}: {
  userId: string;
  client: SupabaseClient;
  active: () => boolean;
  onComplete: (p: AccountPull) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT(),
    controller = useRef(new AbortController()),
    local = useRef<WorkspaceStore | null>(null);
  const [source, setSource] = useState<LegacySource | null>(null),
    [decisions, setDecisions] = useState<LegacyDecisions>({});
  const [pending, setPending] = useState<Conversion | null>(null),
    [localSecret, setLocalSecret] = useState(''),
    [cloudSecret, setCloudSecret] = useState('');
  const [consent, setConsent] = useState(false),
    [approved, setApproved] = useState(false),
    [downloaded, setDownloaded] = useState(''),
    [reread, setReread] = useState('');
  const [busy, setBusy] = useState(true),
    [message, setMessage] = useState(''),
    [blocked, setBlocked] = useState(false);
  const [editing, setEditing] = useState<{
    key: string;
    collection: 'aircraft' | 'duties' | 'journals';
    id: string;
    db: Database;
  } | null>(null);
  const alive = () => active() && !controller.current.signal.aborted;
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    void Promise.resolve().then(async () => {
      try {
        const raw = localStorage.getItem(conversionKey(userId));
        if (raw) {
          const value = await validateConversion(JSON.parse(raw), userId);
          if (!abort.signal.aborted) {
            setPending(value);
            setSource(value.source);
            setDecisions(value.decisions);
          }
        }
      } catch {
        if (!abort.signal.aborted) {
          setBlocked(true);
          setMessage(
            t(
              'Saved conversion is invalid. Preserve it and your independent backup; do not reset the account.',
              '已存轉換計劃無效。請保留計劃及獨立備份，勿重設帳戶。',
            ),
          );
        }
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    });
    return () => {
      abort.abort();
      local.current?.lock();
    };
    // AccountEntry remounts this interface on account/auth-generation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const act = async (fn: () => Promise<void>) => {
    if (busy || blocked || !alive()) return;
    setBusy(true);
    setMessage('');
    try {
      await fn();
    } catch (error) {
      if (alive())
        setMessage(
          error instanceof Error && error.message === 'verification'
            ? t(
                'The downloaded destination is incomplete or differs from this conversion. Do not import again. Preserve the recovery plan and both sources; inspect account History or request reviewed forward recovery.',
                '下載的目的地不完整或與轉換不同。請勿重新匯入；保留復原計劃及兩個來源，檢查帳戶歷史或安排經覆核的後續復原。',
              )
            : t(
                'Conversion paused. Check passphrases/network and source changes. Both original sources and the saved plan remain intact. Invalid links or a changed legacy revision require a new review before any upload; an unknown submission must use Resume with its original UUID.',
                '轉換暫停。請檢查密碼、網絡及來源變更。原有資料與已存計劃仍保留；無效關聯或舊版修訂變更須重新覆核，結果未知的提交必須以原 UUID 恢復。',
              ),
        );
    } finally {
      if (alive()) setBusy(false);
    }
  };
  const resetApproval = () => {
    setApproved(false);
    setDownloaded('');
    setReread('');
  };
  const inspect = async () => {
    local.current?.lock();
    local.current = null;
    try {
      if (hasVault(userId)) local.current = await openVault(userId, localSecret, false);
      if (!alive()) {
        local.current?.lock();
        return;
      }
      const found = await inspectLegacy({
        userId,
        local: local.current,
        remote: transport(client, userId),
        cloudPassphrase: cloudSecret,
        signal: controller.current.signal,
      });
      if (!alive()) return;
      setSource(found);
      setDecisions({});
      resetApproval();
    } finally {
      setLocalSecret('');
      setCloudSecret('');
    }
  };
  let result: ReturnType<typeof reconcileLegacy> | null = null;
  if (source)
    try {
      result = reconcileLegacy(source, decisions);
    } catch {
      /* unresolved choices/links */
    }
  const rows = source ? legacyDifferences(source) : [];
  const choose = (key: string, value: LegacyDecisions[string]) => {
    setDecisions((old) => ({ ...old, [key]: value }));
    resetApproval();
  };
  const manual = (key: string) => {
    const row = rows.find((r) => r.key === key);
    if (!row || row.collection === 'privacy') return;
    const db = structuredClone(result?.db || source!.localDatabase || source!.cloudDatabase);
    const chosen = decisions[key];
    const value =
      chosen?.choice === 'manual'
        ? chosen.value
        : chosen
          ? row[chosen.choice]?.value
          : row.local?.value || row.cloud?.value || row.baseline?.value;
    if (!value || typeof value !== 'object') {
      setMessage(
        t(
          'Choose a live alternative before editing. Resolve related records first.',
          '請先選擇現存版本並處理關聯紀錄。',
        ),
      );
      return;
    }
    const list = db[row.collection] as unknown as { id: string }[],
      at = list.findIndex((r) => r.id === row.id),
      record = { ...structuredClone(value), id: row.id };
    if (at < 0) list.push(record);
    else list[at] = record;
    setEditing({ key, collection: row.collection, id: row.id, db });
  };
  const commit: Commit = async (next) => {
    if (!editing || !alive()) return false;
    const value = next[editing.collection].find((r) => r.id === editing.id);
    if (!value) return false;
    choose(editing.key, { choice: 'manual', value: structuredClone(value) });
    setEditing(null);
    return true;
  };
  const submit = async () => {
    if (
      !source ||
      !result ||
      !consent ||
      !approved ||
      downloaded !== legacyBackupText(source) ||
      reread !== downloaded
    )
      return;
    const value = await approveConversion(source, decisions, reread, consent, approved);
    if (!alive()) return;
    if (localStorage.getItem(conversionKey(userId)) !== null) throw Error('changed');
    // Explicit consent covers this plaintext, account-bound recovery plan. Persist before upload.
    localStorage.setItem(conversionKey(userId), JSON.stringify(value));
    setPending(value);
    await resume(value);
  };
  const resume = async (value: Conversion) => {
    try {
      const p = await runConversion({
        value,
        remote: accountTransport(client, userId, alive),
        legacy: transport(client, userId),
        active: alive,
        signal: controller.current.signal,
      });
      if (alive()) await onComplete(p);
    } finally {
      if (alive()) {
        const raw = localStorage.getItem(conversionKey(userId));
        if (raw) setPending(JSON.parse(raw));
      }
    }
  };
  const editorRecord = editing && editing.db[editing.collection].find((r) => r.id === editing.id);
  const privacyValue = (key: string, localValue: unknown, cloudValue: unknown) =>
    (decisions[key]?.choice === 'cloud'
      ? cloudValue
      : decisions[key]?.choice === 'baseline'
        ? rows.find((r) => r.key === key)?.baseline?.value
        : decisions[key]?.value || localValue || cloudValue || {}) as Record<string, boolean>;
  return (
    <section
      className="mixed-recovery legacy-conversion"
      aria-label={t('Legacy Vault conversion', '舊版資料庫轉換')}
    >
      <h2>{t('Review encrypted Legacy Vault', '覆核舊版加密資料庫')}</h2>
      <p>
        {t(
          'Nothing converts on sign-in. Original encrypted vaults, cloud keys and Guest data remain unchanged. Use a verified independent backup; do not delete your vault.',
          '登入不會自動轉換。原有加密資料庫、雲端金鑰與訪客資料維持不變。請保留已驗證的獨立備份，勿刪除資料庫。',
        )}
      </p>
      {!source && !pending && (
        <>
          {hasVault(userId) && (
            <label>
              {t('Local Vault Passphrase', '本機資料庫密碼')}
              <input
                type="password"
                autoComplete="off"
                value={localSecret}
                onChange={(e) => setLocalSecret(e.target.value)}
              />
            </label>
          )}
          <label>
            {t(
              'Cloud Vault Passphrase (may differ; leave blank for local-only)',
              '雲端資料庫密碼（可不同；僅本機可留空）',
            )}
            <input
              type="password"
              autoComplete="off"
              value={cloudSecret}
              onChange={(e) => setCloudSecret(e.target.value)}
            />
          </label>
          <button disabled={busy || blocked} onClick={() => void act(inspect)}>
            {t('Unlock and inspect sources', '解鎖及檢查來源')}
          </button>
          <details>
            <summary>
              {t('Recover a previously approved conversion file', '復原先前已批准的轉換檔')}
            </summary>
            <p>
              {t(
                'This file contains plaintext. Restoring it stores a plaintext recovery plan on this device, not an encrypted Vault. It never uploads automatically.',
                '此檔案含明文。復原會在本機儲存明文復原計劃，而非加密資料庫；不會自動上傳。',
              )}
            </p>
            <label>
              <input
                type="checkbox"
                checked={consent}
                disabled={busy || blocked}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {t(
                'I consent to restoring this plaintext recovery plan.',
                '我同意復原此明文復原計劃。',
              )}
            </label>
            <label>
              {t('Read approved conversion file', '讀取已批准轉換檔')}
              <input
                type="file"
                accept=".json,application/json"
                disabled={busy || blocked || !consent}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file || file.size > 32 * 1024 * 1024) return;
                  void act(async () => {
                    const value = await validateConversion(JSON.parse(await file.text()), userId);
                    if (
                      !alive() ||
                      !consent ||
                      localStorage.getItem(conversionKey(userId)) !== null
                    )
                      throw Error('changed');
                    localStorage.setItem(conversionKey(userId), JSON.stringify(value));
                    setPending(value);
                    setSource(value.source);
                    setDecisions(value.decisions);
                  });
                }}
              />
            </label>
          </details>
        </>
      )}
      {source && (
        <>
          <p>
            {t('Local / Cloud source records', '本機／雲端來源紀錄')}：
            {source.localDatabase ? rows.filter((r) => r.local).length : 0} /{' '}
            {source.cloudRecords.length} · {t('Legacy revision', '舊版修訂')}{' '}
            {source.cloud.envelope ? source.cloud.revision : '—'}
          </p>
          {source.localSync?.conflicts.length ? (
            <p role="status">
              {t(
                'Unresolved old sync alternatives are included below and in the backup. Every conflict needs a decision.',
                '舊同步衝突版本已列於下方及備份中，每項均須決定。',
              )}
            </p>
          ) : null}
          {!pending &&
            rows.map((row) => (
              <fieldset key={row.key} disabled={busy}>
                <legend>
                  {row.collection} · {row.id}
                </legend>
                {row.differs ? (
                  <>
                    <div className="mixed-values">
                      {compareFields(row.cloud?.value, row.local?.value)
                        .filter((f) => f.state !== 'match')
                        .map((f) => (
                          <p key={f.field}>
                            <strong>{f.field}</strong>
                            <br />
                            Cloud: {JSON.stringify(f.cloud) ?? '—'}
                            <br />
                            Local: {JSON.stringify(f.local) ?? '—'}
                          </p>
                        ))}
                    </div>
                    {row.baseline && source.localSync?.conflicts.includes(row.key) && (
                      <details>
                        <summary>{t('Retained conflict baseline', '保留的衝突基準')}</summary>
                        <pre>{JSON.stringify(row.baseline.value, null, 2)}</pre>
                      </details>
                    )}
                    <div className="actions">
                      {(['cloud', 'local', 'baseline'] as const)
                        .filter(
                          (choice) =>
                            !!row[choice] &&
                            (choice !== 'baseline' ||
                              source.localSync?.conflicts.includes(row.key)),
                        )
                        .map((choice) => (
                          <button
                            key={choice}
                            aria-pressed={decisions[row.key]?.choice === choice}
                            onClick={() => choose(row.key, { choice })}
                          >
                            {choice === 'cloud'
                              ? t('Keep Cloud', '保留雲端')
                              : choice === 'local'
                                ? t('Keep Local', '保留本機')
                                : t('Keep baseline alternative', '保留基準版本')}
                          </button>
                        ))}
                      {row.collection !== 'privacy' && (
                        <button onClick={() => manual(row.key)}>
                          {t('Manual Edit', '手動編輯')}
                        </button>
                      )}
                    </div>
                    {row.collection === 'privacy' && (
                      <details>
                        <summary>{t('Edit field visibility', '編輯欄位顯示')}</summary>
                        {Object.entries(source.cloudDatabase.settings.privacy).map(([field]) => (
                          <label key={field}>
                            <input
                              type="checkbox"
                              checked={Boolean(
                                privacyValue(row.key, row.local?.value, row.cloud?.value)[field],
                              )}
                              onChange={(e) =>
                                choose(row.key, {
                                  choice: 'manual',
                                  value: {
                                    ...privacyValue(row.key, row.local?.value, row.cloud?.value),
                                    [field]: e.target.checked,
                                  },
                                })
                              }
                            />
                            {field}
                          </label>
                        ))}
                      </details>
                    )}
                    {decisions[row.key] && (
                      <p role="status">
                        {t('Reviewed choice', '已選擇')}：{decisions[row.key].choice}
                      </p>
                    )}
                  </>
                ) : (
                  <p>
                    {t(
                      'Identical or single-source record retained with its original ID.',
                      '相同或單一來源紀錄將以原 ID 保留。',
                    )}
                  </p>
                )}
              </fieldset>
            ))}
          {!pending && (
            <>
              {!result && (
                <p role="status">
                  {t(
                    'Resolve every difference and linked reference. Invalid graphs block conversion; neither source is overwritten.',
                    '請處理所有差異與關聯；無效關聯會阻止轉換，兩個來源均不會覆寫。',
                  )}
                </p>
              )}
              <p>
                {t(
                  'New Account storage is server-readable and NOT end-to-end encrypted. This browser will store a plaintext offline cache and recovery plan. Provider access controls do not grant permission to upload employer data. Only upload permitted information.',
                  '新帳戶為伺服器可讀，並非端對端加密。本瀏覽器會儲存明文離線快取與復原計劃。供應商權限保護不代表獲准上傳僱主資料；僅上傳獲准資料。',
                )}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={busy}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    setApproved(false);
                  }}
                />
                {t('I explicitly consent to the new storage model.', '我明確同意新的儲存模式。')}
              </label>
              <p>
                {t(
                  'The independent backup contains plaintext records, conflict alternatives and original encrypted recovery bytes. Keep it private.',
                  '獨立備份包含明文紀錄、衝突版本及原始加密復原內容，請妥善保管。',
                )}
              </p>
              <button
                disabled={busy || !result}
                onClick={() => {
                  const text = legacyBackupText(source);
                  requestDownload(text, 'tco-legacy-conversion-backup.json');
                  setDownloaded(text);
                  setReread('');
                  setApproved(false);
                }}
              >
                {t('Download complete legacy backup', '下載完整舊版備份')}
              </button>
              {downloaded && (
                <label>
                  {t('Reread the saved backup', '重新讀取已儲存備份')}
                  <input
                    type="file"
                    accept=".json,application/json"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setReread('');
                      setApproved(false);
                      if (!file || file.size > 64 * 1024 * 1024) return;
                      void act(async () => {
                        const text = await file.text();
                        await verifyLegacyBackup(source, text);
                        if (alive() && text === downloaded) setReread(text);
                      });
                    }}
                  />
                </label>
              )}
              {result && (
                <p>
                  {t('Final workspace', '最終工作區')}：{result.db.aircraft.length} Aircraft ·{' '}
                  {result.db.duties.length} Duties · {result.db.journals.length} Journals ·{' '}
                  {JSON.stringify(result.db.settings.privacy)}
                </p>
              )}
              <label>
                <input
                  type="checkbox"
                  disabled={busy || !result || !reread || !consent}
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                {t(
                  'I reviewed all choices, replacements/deletions and settings, verified my saved backup and approve this conversion.',
                  '我已覆核所有選擇、替換／刪除及設定，驗證備份並批准轉換。',
                )}
              </label>
              <button
                className="primary"
                disabled={busy || !result || !reread || !consent || !approved}
                onClick={() => void act(submit)}
              >
                {t('Confirm conversion', '確認轉換')}
              </button>
            </>
          )}
        </>
      )}
      {pending && (
        <>
          <p role="status">
            {t('Saved conversion', '已存轉換')}：{pending.prepared.operationId} · {pending.phase}
          </p>
          <p>
            {t(
              'Resume verifies the original exact submission and downloads the destination before completion. No passphrase is needed for this consented saved plan.',
              '恢復會驗證原有精確提交並下載目的地後才完成。此已同意儲存的計劃不再需要密碼。',
            )}
          </p>
          <button disabled={busy || blocked} onClick={() => void act(() => resume(pending))}>
            {t('Resume and verify conversion', '恢復並驗證轉換')}
          </button>
          <button
            disabled={busy || blocked}
            onClick={() =>
              requestDownload(JSON.stringify(pending), 'tco-approved-conversion-recovery.json')
            }
          >
            {t('Download consented plaintext recovery plan', '下載已同意儲存的明文復原計劃')}
          </button>
          {pending.phase !== 'verified' && (
            <button
              disabled={busy || blocked}
              onClick={() =>
                void act(async () => {
                  await restartConversion(
                    pending,
                    accountTransport(client, userId, alive),
                    alive,
                    controller.current.signal,
                  );
                  if (!alive()) return;
                  local.current?.lock();
                  local.current = null;
                  setPending(null);
                  setSource(null);
                  setDecisions({});
                  setConsent(false);
                  resetApproval();
                })
              }
            >
              {t(
                'Retain old plan and start a safely fenced new review',
                '保留舊計劃並在安全防重播後重新覆核',
              )}
            </button>
          )}
        </>
      )}
      {busy && <p role="status">{t('Working…', '處理中…')}</p>}
      {message && (
        <p role="alert" className="notice amber">
          {message}
        </p>
      )}
      <button disabled={busy} onClick={onClose}>
        {t('Postpone and keep originals', '稍後處理並保留原始資料')}
      </button>
      {editing && editorRecord && (
        <>
          {editing.collection === 'aircraft' ? (
            <AircraftEditor
              db={editing.db}
              existing={editorRecord as Aircraft}
              migrationReview
              onClose={() => setEditing(null)}
              onSaved={() => {}}
              commit={commit}
            />
          ) : editing.collection === 'duties' ? (
            <DutyEditor
              db={editing.db}
              existing={editorRecord as Duty}
              onClose={() => setEditing(null)}
              commit={commit}
            />
          ) : (
            <JournalEditor
              db={editing.db}
              existing={editorRecord as Journal}
              onClose={() => setEditing(null)}
              commit={commit}
            />
          )}
        </>
      )}
    </section>
  );
}
