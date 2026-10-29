import { useState, useSyncExternalStore } from 'react';
import type { AccountEngine } from './engine';
import type { ArchiveExport } from './types';
import { requestDownload, verifyArchive } from './archive';
import { useT } from '../i18n';
export default function ArchiveControl({ engine }: { engine: AccountEngine }) {
  const t = useT(),
    status = useSyncExternalStore(engine.subscribe, engine.snapshot);
  const [exported, setExported] = useState<ArchiveExport | null>(null),
    [reread, setReread] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const capacity = status.capacity;
  const near =
    capacity &&
    (capacity.historyRows >= 15000 ||
      capacity.historyBytes >= 24 * 1024 * 1024 ||
      capacity.receipts >= 15000);
  return (
    <section aria-label={t('History archive', '歷史封存')}>
      <h3>{t('History archive', '歷史封存')}</h3>
      <p>
        {t(
          'Nothing is removed automatically. Archive only after downloading and rereading the complete recovery file. This plaintext file contains private records, old versions and operation receipts. Keep it secure; it is separate from a regular workspace JSON backup.',
          '不會自動移除任何歷史。須先下載並重新讀取完整復原檔才可封存。此明文檔包含私人紀錄、舊版本及操作回執；請妥善保管，它與一般工作區 JSON 備份不同。',
        )}
      </p>
      {capacity && (
        <p>
          {t('Recovery versions', '復原版本')}: {capacity.historyRows.toLocaleString()} / 20,000 ·{' '}
          {t('Operation receipts', '操作回執')}: {capacity.receipts.toLocaleString()} / 20,000
        </p>
      )}
      {near && (
        <p className="notice amber">
          {t(
            'Recovery storage is approaching its limit. Prepare a verified archive before cloud writes pause. Local records remain available.',
            '復原儲存接近上限；請在雲端寫入暫停前準備已驗證封存檔。本機紀錄仍會保留。',
          )}
        </p>
      )}
      <button
        disabled={busy || !engine.canRun()}
        onClick={() => {
          setBusy(true);
          setMessage('');
          setReread('');
          setConfirmed(false);
          void engine
            .prepareArchive()
            .then((file) => {
              requestDownload(file.text, 'tco-account-history-' + file.revision + '.json');
              setExported(file);
              setMessage(
                t(
                  'Download requested. Save the file, then select that saved file below.',
                  '已要求下載。儲存後，請在下方選擇剛才的檔案。',
                ),
              );
            })
            .catch(() =>
              setMessage(
                t(
                  'Archive preparation failed. Resolve pending changes or reconnect; no history was removed.',
                  '未能準備封存；請處理待同步項目或重新連線。未移除任何歷史。',
                ),
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        {t('Download recovery archive', '下載復原封存檔')}
      </button>
      {exported && (
        <>
          <label>
            {t('Reread saved archive', '重新讀取已儲存封存檔')}
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setReread('');
                setConfirmed(false);
                if (!file || file.size > 64 * 1024 * 1024) return;
                setBusy(true);
                void file
                  .text()
                  .then(async (text) => {
                    await verifyArchive(
                      exported,
                      text,
                      engine.store.account.userId,
                      engine.store.account.workspaceId,
                    );
                    setReread(text);
                    setMessage(
                      t(
                        'Saved file verified. Review the archival consequences before approval.',
                        '已驗證儲存檔案；批准前請覆核封存影響。',
                      ),
                    );
                  })
                  .catch(() =>
                    setMessage(
                      t(
                        'This file does not match the prepared archive. Nothing was removed.',
                        '此檔案與準備的封存不符，未移除任何資料。',
                      ),
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            />
          </label>
          <p>
            {t(
              'Approval removes the exported server recovery history and old retry receipts only. Current records and deletion tombstones remain. Older offline devices must back up their pending data and review synchronization again. Restoring archived history requires this saved file.',
              '批准只移除已匯出的伺服器復原歷史及舊重試回執；現有紀錄與刪除標記保留。過期離線裝置須先備份待同步資料，再重新覆核同步。復原已封存歷史需要此儲存檔。',
            )}
          </p>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={!reread || busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t(
              'I verified the saved archive and approve removing these server recovery versions and receipts.',
              '我已驗證已儲存封存，並批准移除這些伺服器復原版本及回執。',
            )}
          </label>
          <button
            disabled={!reread || !confirmed || busy}
            onClick={() => {
              setBusy(true);
              void engine
                .archiveHistory(exported, reread)
                .then(() => {
                  setExported(null);
                  setReread('');
                  setConfirmed(false);
                  setMessage(
                    t(
                      'Archival acknowledged. Current records are preserved; retain your verified archive.',
                      '已收到封存確認，現有紀錄保留；請妥善保存已驗證封存。',
                    ),
                  );
                  void engine.run();
                })
                .catch(() =>
                  setMessage(
                    t(
                      'Archival was not confirmed. Keep the file and retry; changed server data requires a new export.',
                      '尚未確認封存，請保留檔案後重試；伺服器資料如有變更須重新匯出。',
                    ),
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            {t('Approve history archival', '批准歷史封存')}
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
