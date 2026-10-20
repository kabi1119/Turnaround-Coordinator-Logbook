import { afterSave, type Commit } from '../workspaces/store';
import { useRef, useState } from 'react';
import type { Database } from '../domain/model';
import { SectionTitle, Modal, Field } from '../components/ui';
import { useT } from '../i18n';
import { BackupError, createBackup, parseBackup, MAX_BACKUP_BYTES } from '../lib/backup';
import type { FullBackup, BackupCode } from '../lib/backup';
import { useWorkspaceStore } from '../workspaces/context';

export default function BackupManager({ db, restore }: { db: Database; restore: Commit }) {
  const t = useT();
  const workspace = useWorkspaceStore();
  const [mode, setMode] = useState<'export' | 'import' | null>(null);
  const [preview, setPreview] = useState<FullBackup | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(''),
    [success, setSuccess] = useState<'export' | 'restore' | null>(null);
  const snapshot = useRef(''),
    storedSnapshot = useRef<string | null>(null),
    saving = useRef(false),
    selection = useRef(0);
  const errors: Record<BackupCode, string> = {
    invalid: t(
      'Malformed or unsupported backup fields. Nothing was changed.',
      '備份欄位格式錯誤或不受支援，未有更改資料。',
    ),
    report: t(
      'This file is a report export, not a full backup.',
      '此檔案是報告匯出，並非完整備份。',
    ),
    version: t(
      'Unsupported backup format or storage schema version.',
      '不支援此備份格式或儲存結構版本。',
    ),
    duplicate: t(
      'Duplicate record or disruption IDs. Nothing was imported.',
      '紀錄或異常 ID 重複，未匯入任何資料。',
    ),
    orphan: t(
      'Missing linked Duty, Aircraft or Journal. Restore was blocked.',
      '缺少已連結的更次、航機或日誌，已阻止還原。',
    ),
    size: t('Backup exceeds the 5 MiB limit.', '備份超過 5 MiB 上限。'),
    file: t(
      'Choose a local .json file. PDF and other file types cannot be restored.',
      '請選擇本機 .json 檔案；不能還原 PDF 或其他檔案類型。',
    ),
  };
  const showError = (e: unknown) =>
    setError(
      e instanceof BackupError
        ? errors[e.code]
        : t(
            'Could not read or restore local data. Nothing was changed. Keep the original data and check browser storage before retrying.',
            '未能讀取或還原本機資料，未有更改資料。請保留原有資料，檢查瀏覽器儲存空間後再試。',
          ),
    );
  function open(next: 'export' | 'import') {
    selection.current++;
    setMode(next);
    setError('');
    setSuccess(null);
    setPreview(null);
    setConfirmed(false);
    saving.current = false;
  }
  function read(file?: File) {
    const seq = ++selection.current;
    setError('');
    setPreview(null);
    setConfirmed(false);
    if (!file) return;
    if (
      !/\.json$/i.test(file.name) ||
      !['', 'application/json', 'text/json', 'text/plain'].includes(file.type)
    ) {
      showError(new BackupError('file'));
      return;
    }
    if (file.size > MAX_BACKUP_BYTES) {
      showError(new BackupError('size'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => {
      if (seq === selection.current)
        setError(t('Could not read this local file.', '未能讀取此本機檔案。'));
    };
    reader.onload = () => {
      if (seq !== selection.current) return;
      try {
        const incoming = parseBackup(String(reader.result));
        snapshot.current = JSON.stringify(db);
        storedSnapshot.current = workspace.snapshot();
        setPreview(incoming);
      } catch (e) {
        showError(e);
      }
    };
    reader.readAsText(file);
  }
  function download() {
    try {
      if (!workspace.current(db)) {
        setError(
          t(
            'Stored data changed or cannot be read. Backup was not created. Reload and review your local data first; do not clear site data.',
            '已儲存資料有變動或無法讀取，未建立備份。請先重新載入並檢查本機資料，切勿清除網站資料。',
          ),
        );
        return;
      }
      const backup = createBackup(db),
        content = JSON.stringify(backup, null, 2);
      if (new TextEncoder().encode(content).byteLength > MAX_BACKUP_BYTES)
        throw new BackupError('size');
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `tco-logbook-backup-${backup.exportedAt.slice(0, 10)}.json`;
      a.hidden = true;
      document.body.append(a);
      try {
        a.click();
      } finally {
        a.remove();
        // Give the browser's download handler time to consume the URL, including mobile engines.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setMode(null);
      setSuccess('export');
    } catch (e) {
      if (e instanceof BackupError) showError(e);
      else
        setError(
          t(
            'Could not read or export local data. No backup was created and existing data was not changed.',
            '未能讀取或匯出本機資料。未建立備份，既有資料沒有更改。',
          ),
        );
    }
  }
  function apply() {
    if (!preview || !confirmed || saving.current) return;
    try {
      if (
        snapshot.current !== JSON.stringify(db) ||
        storedSnapshot.current !== workspace.snapshot()
      ) {
        setError(
          t(
            'Local data changed since preview. Reselect the backup to review again.',
            '預覽後本機資料已改動，請重新選擇備份再覆核。',
          ),
        );
        return;
      }
      const validated = parseBackup(JSON.stringify(preview));
      saving.current = true;
      afterSave(restore(validated.data), (ok) => {
        if (!ok) {
          saving.current = false;
          setError(
            t(
              'Could not restore this backup, possibly due to storage space. Existing data was not replaced. The preview is retained; you can retry.',
              '可能因儲存空間不足而未能還原備份；既有資料未被取代。預覽已保留，可重試。',
            ),
          );
          return;
        }
        setMode(null);
        setPreview(null);
        setSuccess('restore');
      });
    } catch (e) {
      saving.current = false;
      showError(e);
    }
  }
  return (
    <section className="panel">
      <SectionTitle
        title={t('Full local backup', '完整本機備份')}
        subtitle={t(
          'JSON backup is separate from privacy-reviewed reports. PDF is for viewing/printing only.',
          'JSON 備份與私隱覆核報告分開；PDF 只供閱讀及列印。',
        )}
      />
      <p className="notice amber">
        {t(
          'Full backups include hidden/archived sensitive fields, settings and Trash. They are not encrypted. Keep the file private. Nothing is uploaded.',
          '完整備份包含已隱藏／封存的敏感欄位、設定及垃圾桶，並未加密。請妥善保管，資料不會上傳。',
        )}
      </p>
      <div className="actions left">
        <button onClick={() => open('export')}>
          {t('Export Full Backup (JSON)', '匯出完整備份（JSON）')}
        </button>
        <button onClick={() => open('import')}>
          {t('Import Backup (JSON)', '匯入備份（JSON）')}
        </button>
      </div>
      {success && (
        <p role="status">
          {success === 'export'
            ? t(
                'Backup download requested. Save the JSON file in Files or Downloads and check that it is present. No cloud copy was created.',
                '已要求下載備份。請將 JSON 檔案儲存至「檔案」或下載項目，並確認檔案存在；未建立雲端副本。',
              )
            : t(
                'Backup restore completed locally. Current records and settings now match the backup; other devices are unchanged.',
                '備份還原已在本機完成。目前紀錄及設定已與備份一致，其他裝置不受影響。',
              )}
        </p>
      )}
      {mode && (
        <Modal
          title={
            mode === 'export'
              ? t('Export Full Backup (JSON)', '匯出完整備份（JSON）')
              : t('Import Backup (JSON)', '匯入備份（JSON）')
          }
          onClose={() => {
            selection.current++;
            setMode(null);
          }}
          wide
        >
          <p className="notice amber">
            {t(
              'Unencrypted full data, including hidden fields. This is not a sanitized report or cloud backup.',
              '完整資料未加密，包含隱藏欄位；並非去識別化報告或雲端備份。',
            )}
          </p>
          {mode === 'export' ? (
            <>
              <p>
                {db.aircraft.length} {t('Aircraft', '航機')} · {db.duties.length}{' '}
                {t('Duties', '更次')} · {db.journals.length} {t('Journals', '日誌')}
              </p>
              <button className="primary" onClick={download}>
                {t('Download unencrypted backup', '下載未加密備份')}
              </button>
            </>
          ) : (
            <>
              <p>
                {t(
                  'Selecting a file only previews it. Existing data changes only after you review and confirm replacement. Cancel to keep current data.',
                  '選擇檔案只會顯示預覽，覆核並確認取代後才會更改既有資料；取消即可保留目前資料。',
                )}
              </p>
              <Field
                label={t(
                  'Local JSON backup file · maximum 5 MiB',
                  '本機 JSON 備份檔案 · 最大 5 MiB',
                )}
                type="file"
                accept=".json,application/json"
                onChange={(e) => read(e.target.files?.[0])}
              />
              {preview && (
                <>
                  <p>
                    {t(
                      'Restore / Replace — all current records and supported settings will be replaced. Export a full backup of current data first if you need to keep it. No merge is performed.',
                      '還原／取代：會取代全部目前紀錄及支援的設定。如需保留目前資料，請先匯出完整備份。不會合併資料。',
                    )}
                  </p>
                  <p>
                    {t('Exported', '匯出時間')}: {preview.exportedAt} · {t('Schema', '結構版本')} 1
                  </p>
                  {(['aircraft', 'duties', 'journals'] as const).map((key, i) => (
                    <section key={key}>
                      <h3>
                        {[t('Aircraft', '航機'), t('Duties', '更次'), t('Journals', '日誌')][i]}:{' '}
                        {db[key].length} → {preview.data[key].length}
                      </h3>
                      <details>
                        <summary>
                          {t('Review current records being replaced', '覆核將被取代的目前紀錄')}
                        </summary>
                        <ul className="backup-records">
                          {db[key].map((row) => (
                            <li key={row.id}>
                              {row.id} · {row.date}
                            </li>
                          ))}
                        </ul>
                      </details>
                      <details>
                        <summary>{t('Review incoming records', '覆核將還原的紀錄')}</summary>
                        <ul className="backup-records">
                          {preview.data[key].map((row) => (
                            <li key={row.id}>
                              {row.id} · {row.date}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </section>
                  ))}
                  <p>
                    {t(
                      'Language and all six optional-field preferences will also be restored, including disabled fields. Trash, archived values and links are included.',
                      '亦會還原語言及全部六項選填欄位偏好（包括已停用欄位），並保留垃圾桶、封存資料及關聯。',
                    )}
                  </p>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    {t(
                      'I reviewed the replacement and confirm restoring this backup on this device.',
                      '我已覆核取代內容，確認在此裝置還原此備份。',
                    )}
                  </label>
                  <button className="primary" disabled={!confirmed} onClick={apply}>
                    {t('Confirm & Restore Backup', '確認並還原備份')}
                  </button>
                </>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="notice amber">
              {error}
            </p>
          )}
        </Modal>
      )}
    </section>
  );
}
