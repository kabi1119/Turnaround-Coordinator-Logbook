import { useState } from 'react';
import {
  Shield,
  Download,
  RotateCcw,
  LockKeyhole,
  Monitor,
  Database as DatabaseIcon,
} from 'lucide-react';
import type { Database, PrivacyKey } from '../domain/model';
import { handlingTypes } from '../domain/model';
import { canRestore, clearPrivateField, report, restoreDuty } from '../domain/selectors';
import { Badge, Confirm, Field, Modal, Select, SectionTitle } from '../components/ui';
import { seedDatabase } from '../data/seed';
import { useLabel, useT } from '../i18n';
import DemoAirlineRefresh from './DemoAirlineRefresh';
import BackupManager from './BackupManager';
const privacyLabels: Record<PrivacyKey, [string, string]> = {
  registration: ['Registration', '機身註冊'],
  flights: ['Flight Number(s)', '航班編號'],
  bay: ['Parking Bay', '停機位'],
  gateTimes: ['Fine-grained Gate / Stand Times', '詳細停機位時間'],
  statuses: ['Flight Statuses', '航班狀態'],
  disruptionNotes: ['Detailed Disruption Notes', '詳細異常筆記'],
};
function affected(db: Database, k: PrivacyKey) {
  return db.aircraft.filter((a) =>
    k === 'registration'
      ? a.registration
      : k === 'bay'
        ? a.bay
        : k === 'flights'
          ? a.arrival.flight || a.departure.flight
          : k === 'statuses'
            ? a.arrival.status !== 'Not Recorded' || a.departure.status !== 'Not Recorded'
            : k === 'gateTimes'
              ? a.arrival.scheduled ||
                a.arrival.actual ||
                a.departure.scheduled ||
                a.departure.actual
              : a.events.some((e) => e.notes),
  ).length;
}
export default function Settings({
  db,
  commit,
  resetCommit,
  onReport,
  onBack,
  onAircraftRestore,
}: {
  db: Database;
  commit: (db: Database) => boolean;
  resetCommit: (db: Database) => boolean;
  onReport: () => void;
  onBack: () => void;
  onAircraftRestore: (id: string) => void;
}) {
  const t = useT();
  const [refreshDemo, setRefreshDemo] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacyKey | null>(null),
    [action, setAction] = useState<'archive' | 'delete'>('archive'),
    [reset, setReset] = useState<'empty' | 'seed' | null>(null),
    [restore, setRestore] = useState(''),
    [reconnect, setReconnect] = useState(true);
  const trashDuties = db.duties.filter((d) => d.status === 'Trashed'),
    trashAircraft = db.aircraft.filter((a) => a.status === 'Trashed');
  function resetData() {
    const next = seedDatabase();
    if (reset === 'empty') {
      next.aircraft = [];
      next.duties = [];
      next.journals = [];
    }
    next.settings = db.settings;
    if (resetCommit(next)) setReset(null);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PREFERENCES / LOCAL</span>
          <h1>{t('Settings.', '設定。')}</h1>
          <p>{t('Your preferences and local data.', '個人偏好與本機資料。')}</p>
        </div>
        <button onClick={onBack}>{t('Back to Home', '返回首頁')}</button>
      </div>
      <div className="notice prototype-notice">
        <Shield size={24} />
        <div>
          <strong>{t('TCO Logbook · Pre-release', 'TCO Logbook · 預發佈')}</strong>
          <p>
            {t(
              'Stored on this device only · Not cloud synced. Browser data can be cleared or lost. Included sample records are fictional. Privacy controls are not security guarantees or employer permission.',
              '資料只存此裝置，沒有雲端同步。瀏覽器資料可能被清除或遺失；內附樣本紀錄全屬虛構。私隱控制並非安全保證或公司許可。',
            )}
          </p>
        </div>
      </div>
      <div className="two-col">
        <section className="panel">
          <SectionTitle title={t('Appearance & language', '外觀與語言')} />
          <Select
            label={t('Language', '語言')}
            value={db.settings.language}
            options={[
              { value: 'en', label: 'English' },
              { value: 'zh-HK', label: '繁體中文（香港）' },
            ]}
            onChange={(e) =>
              commit({
                ...db,
                settings: { ...db.settings, language: e.target.value as 'en' | 'zh-HK' },
              })
            }
          />
          <p className="setting-row">
            <Monitor size={20} />
            {t('Theme follows your system · Light / Dark', '主題跟隨系統 · 明亮／深色')}
          </p>
          <p className="muted">
            {t(
              'Local airline PNGs are displayed where mapped; names/codes identify the airline independently of shared artwork. Missing images fall back to text. Redistribution rights remain unverified.',
              '已映射的本機 PNG 會顯示；航空公司身份由名稱及代碼識別，不單憑共用標誌。圖片缺失時改為文字，權利仍未核實。',
            )}
          </p>
        </section>
        <section className="panel">
          <SectionTitle
            title={t('Personal reports', '個人報告')}
            subtitle={t(
              'Review the period, role scope and stories before exporting.',
              '匯出前先覆核期間、角色範圍及故事。',
            )}
          />
          <button className="primary" onClick={onReport}>
            <Download size={18} />
            {t('Open Privacy Preview', '開啟私隱預覽')}
          </button>
          <p className="muted">
            {t(
              'Sanitized summary only. Not a secure full backup. No AI connection.',
              '僅去識別化摘要，非安全完整備份，沒有連接 AI。',
            )}
          </p>
        </section>
      </div>
      <BackupManager db={db} restore={resetCommit} />
      <section className="panel">
        <SectionTitle
          title={t('Optional field controls', '選填欄位控制')}
          subtitle={t(
            'Enabled for fresh installations to explore fictional samples. Saved preferences are preserved. This is not permission to store workplace information.',
            '新安裝預設啟用以測試虛構樣本；既有偏好維持不變。這並非儲存工作資料的許可。',
          )}
        />
        {(Object.keys(privacyLabels) as PrivacyKey[]).map((k) => (
          <div className="privacy-row" key={k}>
            <div>
              <strong>{t(...privacyLabels[k])}</strong>
              <small>
                {affected(db, k)} {t('records contain this field', '項紀錄包含此欄位')}
                {!db.settings.privacy[k] ? ` · ${t('archived / hidden', '封存／隱藏')}` : ''}
              </small>
            </div>
            <button
              className={`switch ${db.settings.privacy[k] ? 'on' : ''}`}
              role="switch"
              aria-checked={db.settings.privacy[k]}
              aria-label={t(...privacyLabels[k])}
              onClick={() => {
                if (db.settings.privacy[k]) {
                  setAction('archive');
                  setPrivacy(k);
                } else
                  commit({
                    ...db,
                    settings: { ...db.settings, privacy: { ...db.settings.privacy, [k]: true } },
                  });
              }}
            >
              <span />
            </button>
          </div>
        ))}
      </section>
      <section className="panel">
        <SectionTitle title={t('Sample records', '樣本紀錄')} />
        <button onClick={() => setRefreshDemo(true)}>
          {t('Refresh sample records', '更新樣本紀錄')}
        </button>
        <p className="muted">
          {t(
            'Preview only unchanged legacy synthetic samples; preserve user-created and edited records. This does not reset storage.',
            '只預覽未修改的舊版虛構範例，保留自訂及已修改紀錄，不會重設儲存。',
          )}
        </p>
        <div className="actions left">
          <button onClick={() => setReset('empty')}>
            <RotateCcw size={17} />
            {t('Clear local records', '清空本機紀錄')}
          </button>
          <button onClick={() => setReset('seed')}>
            <DatabaseIcon size={17} />
            {t('Load sample records', '載入樣本紀錄')}
          </button>
        </div>
        <p className="muted">
          {t(
            'Both actions replace this browser’s records after confirmation. Use Refresh sample records to preserve personal records.',
            '兩者均會在確認後取代此瀏覽器的紀錄。如需保留個人資料，請使用更新樣本紀錄。',
          )}
        </p>
      </section>
      <section className="panel">
        <SectionTitle
          title={t('Trash · 30-day recovery window', '垃圾桶 · 30 日回復期')}
          subtitle={t(
            'No background purge service. Expired entries cannot be restored here.',
            '沒有背景清除服務；到期項目不能在此還原。',
          )}
        />
        {trashDuties.map((d) => (
          <div className="setting-row" key={d.id}>
            <span>
              Duty · {d.date} {d.start}–{d.end}
            </span>
            <button
              disabled={!canRestore(d.trashedAt)}
              onClick={() => {
                setReconnect(true);
                setRestore(d.id);
              }}
            >
              {t('Preview restore', '預覽還原')}
            </button>
          </div>
        ))}
        {trashAircraft.map((a) => (
          <div className="setting-row" key={a.id}>
            <span>
              {a.airline} · {a.variant} · {a.date}
            </span>
            <button disabled={!canRestore(a.trashedAt)} onClick={() => onAircraftRestore(a.id)}>
              {t('Review restore', '覆核還原')}
            </button>
          </div>
        ))}
        {!trashDuties.length && !trashAircraft.length && (
          <p className="muted">{t('Trash is empty.', '垃圾桶為空。')}</p>
        )}
      </section>
      <section className="panel">
        <SectionTitle title={t('Future Protection — Coming Soon', '未來保護功能 — 即將推出')} />
        {[
          t('Authentication / Email OTP / Passkey', '身份驗證／Email OTP／Passkey'),
          t('Cloud sync / Conflict resolution', '雲端同步／衝突處理'),
          t('Production encryption and cloud backup', '正式加密及雲端備份'),
          t('Live public aircraft lookup', '即時公開航機查詢'),
        ].map((s) => (
          <div className="future-row" key={s}>
            <LockKeyhole size={18} />
            <span>{s}</span>
            <Badge>{t('Coming Soon · unavailable', '即將推出 · 尚未提供')}</Badge>
          </div>
        ))}
      </section>
      {privacy && (
        <Confirm
          title={t('Disable field · impact preview', '停用欄位 · 影響預覽')}
          onClose={() => setPrivacy(null)}
          onConfirm={() => {
            const next =
              action === 'delete'
                ? clearPrivateField(db, privacy)
                : {
                    ...db,
                    settings: {
                      ...db.settings,
                      privacy: { ...db.settings.privacy, [privacy]: false },
                    },
                  };
            if (commit(next)) setPrivacy(null);
          }}
        >
          <p>
            {t(...privacyLabels[privacy])} · {affected(db, privacy)}{' '}
            {t('affected records.', '項受影響紀錄。')}
          </p>
          <Select
            label={t('Existing values', '現有值')}
            options={[
              {
                value: 'archive',
                label: t('Archive / hide · keep local values', '封存／隱藏 · 保留本機值'),
              },
              {
                value: 'delete',
                label: t('Delete this field’s local values', '刪除此欄位的本機值'),
              },
            ]}
            value={action}
            onChange={(e) => setAction(e.target.value as typeof action)}
          />
          <p className="muted">
            {t(
              'Disabled fields cannot be entered, searched, displayed or exported in ordinary views. Archive is not deletion. JSON report never includes these optional operational values.',
              '停用後普通介面不可輸入、搜尋、顯示或匯出；封存不等於刪除。JSON 報告不包含這些選填營運值。',
            )}
          </p>
          {action === 'delete' && (
            <p className="notice amber">
              {t(
                'This local field deletion cannot be undone. Previously downloaded copies remain outside this app.',
                '刪除此本機欄位後無法復原，先前已下載的副本不受原型控制。',
              )}
            </p>
          )}
        </Confirm>
      )}
      {reset && (
        <Confirm
          title={
            reset === 'empty'
              ? t('Reset to an empty logbook?', '重設為空白紀錄？')
              : t('Replace with fictional sample records?', '取代為虛構樣本紀錄？')
          }
          onClose={() => setReset(null)}
          onConfirm={resetData}
        >
          <p>
            {t(
              'This replaces all current local Duties, Aircraft, Journal entries and Trash. Language and privacy preferences are retained.',
              '這會取代目前本機所有更次、航機、日誌及垃圾桶；保留語言及私隱設定。',
            )}
          </p>
        </Confirm>
      )}
      {refreshDemo && (
        <DemoAirlineRefresh db={db} commit={commit} onClose={() => setRefreshDemo(false)} />
      )}
      {restore && (
        <Confirm
          title={t('Restore Duty · association preview', '還原更次 · 關聯預覽')}
          onClose={() => setRestore('')}
          onConfirm={() => {
            if (commit(restoreDuty(db, restore, reconnect))) setRestore('');
          }}
        >
          <p>{db.duties.find((d) => d.id === restore)?.date}</p>
          <p>
            {t('Original Aircraft associations', '原航機關聯')}:{' '}
            {db.aircraft.filter((a) => a.originalDutyId === restore).length} ·{' '}
            {t('Journal associations', '日誌關聯')}:{' '}
            {db.journals.filter((j) => j.originalDutyId === restore).length}
          </p>
          <ul>
            {db.aircraft
              .filter((a) => a.originalDutyId === restore)
              .map((a) => (
                <li key={a.id}>
                  {a.airline} · {a.variant} · {a.date} ·{' '}
                  {a.dutyId
                    ? t('Linked elsewhere — will not be overwritten', '已有其他關聯，不會覆寫')
                    : t('Eligible to reconnect', '可重新連結')}
                </li>
              ))}
            {db.journals
              .filter((j) => j.originalDutyId === restore)
              .map((j) => (
                <li key={j.id}>
                  {j.title} ·{' '}
                  {j.dutyId || j.aircraftIds.length
                    ? t('Linked elsewhere — will not be overwritten', '已有其他關聯，不會覆寫')
                    : t('Eligible to reconnect', '可重新連結')}
                </li>
              ))}
          </ul>
          <label className="check">
            <input
              type="checkbox"
              checked={reconnect}
              onChange={(e) => setReconnect(e.target.checked)}
            />
            {t('Explicitly reconnect eligible original associations', '明確重新連結可用的原有關聯')}
          </label>
        </Confirm>
      )}
    </>
  );
}
export function ReportPreview({ db, onClose }: { db: Database; onClose: () => void }) {
  const t = useT(),
    l = useLabel();
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [scope, setScope] = useState<'primary' | 'handled'>('primary'),
    [categories, setCategories] = useState<string[]>([...handlingTypes]),
    [stories, setStories] = useState<string[]>([]),
    [reviewed, setReviewed] = useState(false);
  const value = report(db, from, to, scope, categories, stories),
    invalid = Boolean(from && to && from > to);
  const change = () => setReviewed(false);
  function download(format: 'json' | 'csv') {
    const csvCell = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const content =
      format === 'json'
        ? JSON.stringify(value, null, 2)
        : [
            ['FICTIONAL SAMPLES · not employer verified', ''],
            ['Role scope', value.roleScope],
            ['From', from],
            ['To', to],
            ['Category', 'Count'],
            ...value.counts.map((c) => [c.category, c.count]),
            ['Total selected', value.total],
          ]
            .map((r) => r.map(csvCell).join(','))
            .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', content], {
        type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `tco-report.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Modal title={t('Privacy Preview · report', '私隱預覽 · 個人報告')} onClose={onClose} wide>
      <div className="report-controls">
        <p className="notice">
          {t(
            'Synthetic, self-reported summary. No operational identifiers, gate times, statuses, disruption details or link IDs are exported. Selected stories must be reviewed for sanitized content. Not a full backup.',
            '合成、自行申報摘要，不匯出營運識別值、停機位時間、狀態、異常詳情或關聯 ID。請覆核所選故事已去識別化。非完整備份。',
          )}
        </p>
        <div className="form-grid">
          <Field
            label={t('From', '由')}
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              change();
            }}
          />
          <Field
            label={t('To', '至')}
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              change();
            }}
          />
        </div>
        <Select
          label={t('Career role scope · Training excluded', '職涯角色範圍 · 排除訓練')}
          value={scope}
          options={[
            { value: 'primary', label: t('Primary only', '僅主要協調員') },
            {
              value: 'handled',
              label: t(
                'Primary + Supporting · includes assisted work',
                '主要 + 支援 · 包含協助工作',
              ),
            },
          ]}
          onChange={(e) => {
            setScope(e.target.value as typeof scope);
            change();
          }}
        />
        <fieldset>
          <legend>{t('Count categories', '計數分類')}</legend>
          {handlingTypes.map((type) => (
            <label key={type} className="check">
              <input
                type="checkbox"
                checked={categories.includes(type)}
                onChange={() => {
                  setCategories(
                    categories.includes(type)
                      ? categories.filter((c) => c !== type)
                      : [...categories, type],
                  );
                  change();
                }}
              />
              {l(type)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t('Select sanitized stories', '選擇去識別化故事')}</legend>
          {db.journals
            .filter(
              (j) => j.status === 'Confirmed' && (!from || j.date >= from) && (!to || j.date <= to),
            )
            .map((j) => (
              <label className="check" key={j.id}>
                <input
                  type="checkbox"
                  checked={stories.includes(j.id)}
                  onChange={() => {
                    setStories(
                      stories.includes(j.id)
                        ? stories.filter((x) => x !== j.id)
                        : [...stories, j.id],
                    );
                    change();
                  }}
                />
                {j.title} · {j.date}
              </label>
            ))}
        </fieldset>
      </div>
      <section className="report-paper">
        <span className="eyebrow">TCO Logbook / PERSONAL REPORT</span>
        <h2>{t('Career experience summary', '職涯經驗摘要')}</h2>
        <p>
          {from || t('Beginning', '起始')} → {to || t('Present', '目前')} ·{' '}
          {scope === 'primary'
            ? t('Primary only', '僅主要協調員')
            : t('Primary + Supporting · assisted work included', '主要 + 支援 · 包含協助工作')}
        </p>
        <p>
          {t(
            'Training excluded. Self-reported; not employer verified.',
            '排除訓練，自行申報，非僱主核實。',
          )}
        </p>
        {value.counts.map((c) => (
          <div className="report-count" key={c.category}>
            <span>{c.category}</span>
            <strong>{c.count}</strong>
          </div>
        ))}
        <div className="report-count">
          <strong>{t('Total selected coordinated assignments', '所選協調紀錄合計')}</strong>
          <strong>{value.total}</strong>
        </div>
        {value.stories.map((s, i) => (
          <article key={i}>
            <h3>{s.title}</h3>
            <p>
              {s.date} · {s.verification}
            </p>
            {Object.entries(s)
              .filter(([k, v]) => !['title', 'date', 'verification'].includes(k) && String(v))
              .map(([k, v]) => (
                <p key={k}>
                  <strong>{k}: </strong>
                  {Array.isArray(v) ? v.join(', ') : v}
                </p>
              ))}
          </article>
        ))}
      </section>
      <div className="report-controls">
        {invalid && (
          <p role="alert">
            {t('Start date must not be after end date.', '開始日期不可遲於結束日期。')}
          </p>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          {t(
            'I reviewed the synthetic figures, role scope and selected sanitized stories.',
            '我已覆核合成數字、角色範圍及所選去識別化故事。',
          )}
        </label>
        <div className="actions">
          <button disabled={!reviewed || invalid} onClick={() => download('json')}>
            JSON
          </button>
          <button disabled={!reviewed || invalid} onClick={() => download('csv')}>
            {t('CSV · counts', 'CSV · 計數')}
          </button>
          <button
            className="primary"
            disabled={!reviewed || invalid}
            onClick={() => window.print()}
          >
            {t('Print / Save as PDF', '列印／另存 PDF')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
