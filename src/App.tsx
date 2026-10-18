import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Plane,
  Home,
  BookOpen,
  Plus,
  ChartNoAxesCombined,
  NotebookPen,
  Settings as SettingsIcon,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Check,
  Trash2,
  Pencil,
  History,
  X,
} from 'lucide-react';
import type { Aircraft, Database } from './domain/model';
import { canRestore, normalizeRegistration, stats, trashDuty } from './domain/selectors';
import { LanguageContext, useLabel, useT } from './i18n';
import { loadDatabase, writeDatabase } from './lib/storage';
import { AircraftCard, Badge, Confirm, Empty, Metric, Modal, SectionTitle } from './components/ui';
import AircraftEditor from './features/AircraftEditor';
import DutyEditor from './features/DutyEditor';
import Logbook from './features/Logbook';
import Statistics from './features/Statistics';
import { JournalEditor, JournalPage } from './features/Journal';
import Settings, { ReportPreview } from './features/Settings';
import Radar from './components/Radar';
import AircraftSummary from './features/AircraftDetails';
import BatchDutyEditor from './features/BatchDutyEditor';
import HongKongClock from './components/HongKongClock';
import FullDutyCalendar from './features/FullDutyCalendar';
import UpcomingShift from './features/UpcomingShift';
import { dutyOptionText } from './domain/roster';
import DutyHistory from './features/DutyHistory';
import { useMotionClose } from './lib/useMotionClose';
import { useRecordNavigation } from './lib/useRecordNavigation';

type Page = 'home' | 'logbook' | 'statistics' | 'journal' | 'settings';
type Overlay =
  | { type: 'add' }
  | { type: 'aircraft'; id?: string; dutyId?: string }
  | { type: 'detail'; id: string }
  | { type: 'duty'; id?: string }
  | { type: 'dutyDetail'; id: string }
  | { type: 'batchDuty' }
  | { type: 'dutyHistory' }
  | { type: 'journal'; id?: string }
  | { type: 'report' }
  | { type: 'history'; registration: string }
  | null;
export default function App() {
  const [loaded] = useState(loadDatabase);
  const [db, setDb] = useState(loaded.db);
  return (
    <LanguageContext.Provider value={db.settings.language}>
      <Workspace db={db} setDb={setDb} loadError={loaded.error} />
    </LanguageContext.Provider>
  );
}
function Workspace({
  db,
  setDb,
  loadError,
}: {
  db: Database;
  setDb: (db: Database) => void;
  loadError: string;
}) {
  const t = useT(),
    l = useLabel();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const {
    current: overlay,
    previous,
    open: setOverlay,
    back: close,
  } = useRecordNavigation<Exclude<Overlay, null>>();
  const [page, setPage] = useState<Page>('home'),
    [toast, setToast] = useState(''),
    [storageError, setStorageError] = useState(loadError),
    [pending, setPending] = useState<{
      kind: 'aircraftTrash' | 'dutyTrash' | 'aircraftRestore';
      id: string;
    } | null>(null);
  const [visited, setVisited] = useState<Page[]>(['home']);
  const positions = useRef<Partial<Record<Page, number>>>({});
  const [saveSequence, setSaveSequence] = useState(0);
  const { closing: detailClosing, close: closeDetail } = useMotionClose(close);
  useLayoutEffect(() => {
    window.scrollTo({ top: positions.current[page] || 0, behavior: 'instant' });
  }, [page]);
  function changePage(next: Page) {
    if (next === page) return;
    positions.current[page] = window.scrollY;
    setVisited((rows) => (rows.includes(next) ? rows : [...rows, next]));
    setPage(next);
  }
  useEffect(() => {
    document.documentElement.lang = db.settings.language;
  }, [db.settings.language]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast, saveSequence]);
  function commit(next: Database, explicitReset = false) {
    if (loadError && storageError && !explicitReset) {
      setToast('');
      setStorageError(loadError);
      return false;
    }
    if (!writeDatabase(next)) {
      setToast('');
      setStorageError(
        t(
          'Could not write browser storage. Changes have not been saved.',
          '未能寫入瀏覽器儲存空間，修改尚未儲存。',
        ),
      );
      return false;
    }
    setDb(next);
    setSaveSequence((n) => n + 1);
    setStorageError('');
    setToast(t('Saved on this device', '已儲存在此裝置'));
    return true;
  }
  const s = useMemo(() => stats(db.aircraft, db.duties), [db.aircraft, db.duties]),
    active = db.aircraft
      .filter((a) => a.status !== 'Trashed')
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  const openAircraft = (a: Aircraft) => setOverlay({ type: 'detail', id: a.id });
  const detail =
    overlay?.type === 'detail' ? db.aircraft.find((a) => a.id === overlay.id) : undefined;
  const duty =
    overlay?.type === 'dutyDetail' ? db.duties.find((d) => d.id === overlay.id) : undefined;
  const nav = [
    { key: 'home', en: 'Home', zh: '首頁', icon: Home },
    { key: 'logbook', en: 'Logbook', zh: '紀錄簿', icon: BookOpen },
    { key: 'add', en: 'Add', zh: '新增', icon: Plus },
    { key: 'statistics', en: 'Statistics', zh: '統計', icon: ChartNoAxesCombined },
    { key: 'journal', en: 'Journal', zh: '日誌', icon: NotebookPen },
  ] as const;
  function navigate(key: (typeof nav)[number]['key']) {
    setCalendarOpen(false);
    if (key === 'add') {
      setOverlay({ type: 'add' });
      return;
    }
    setOverlay(null);
    changePage(key);
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={() => navigate('home')} aria-label="TCO Logbook Home">
          <span className="app-mark">
            <Plane size={23} strokeWidth={1.7} />
          </span>
          <span className="brand-name">
            <strong>Turnaround Coordinator Logbook</strong>
            <small>PERSONAL AVIATION JOURNAL</small>
          </span>
        </button>
        <div className="header-right">
          <HongKongClock />
          <button
            className="icon-button"
            aria-label={t('Settings', '設定')}
            onClick={() => {
              setCalendarOpen(false);
              setOverlay(null);
              changePage('settings');
            }}
          >
            <SettingsIcon size={21} />
          </button>
        </div>
      </header>
      <main id="main-content">
        {storageError && (
          <div className="notice amber" role="alert">
            {storageError}
            <button
              onClick={() => {
                setOverlay(null);
                setCalendarOpen(false);
                changePage('settings');
              }}
            >
              {t('Open Settings to manage local data', '開啟設定以管理本機資料')}
            </button>
          </div>
        )}
        {visited.includes('home') && (
          <section
            className="page-view"
            data-page="home"
            data-active={page === 'home'}
            hidden={page !== 'home'}
          >
            <section className="home-intro">
              <div>
                <span className="eyebrow">YOUR JOURNEY / YOUR RECORD</span>
                <h1>{t('A record of every\nturnaround.', '記下每一次\n過站歷程。')}</h1>
                <p>
                  {t(
                    'Small details. Valuable experience. All in your logbook.',
                    '每個細節，都是值得記下的經驗。',
                  )}
                </p>
              </div>
              <Radar active={page === 'home'} />
            </section>
            <div className="metrics surface-dark">
              <Metric
                value={s.logged}
                label={t('Total Aircraft Logged', '航機記錄總數')}
                detail={t('Every confirmed assignment', '每項已確認的處理紀錄')}
              />
              <Metric
                value={s.handled}
                label={t('Total Aircraft Handled', '航機處理總數')}
                detail={t('Primary + Supporting', '主要協調 + 支援協調')}
              />
              <Metric
                value={s.primary}
                label={t('Primary Coordinator', '主要協調員')}
                detail={t('A subset of Logged & Handled', '包含於記錄及處理總數內')}
              />
            </div>
            <div className="home-columns">
              <div>
                <UpcomingShift
                  duties={db.duties}
                  aircraft={db.aircraft}
                  onDuty={(d) => setOverlay({ type: 'dutyDetail', id: d.id })}
                  onCalendar={() => setCalendarOpen(true)}
                />
                <section className="journal-teaser">
                  <span className="eyebrow">BEYOND THE NUMBERS</span>
                  <h2>{t('What did today\nteach you?', '今天學到了\n甚麼？')}</h2>
                  <p>
                    {t(
                      'Keep the lessons that make you a better coordinator.',
                      '留下每一份有助成長的經驗。',
                    )}
                  </p>
                  <button className="text-button" onClick={() => setOverlay({ type: 'journal' })}>
                    {t('Write a reflection', '寫下反思')}
                    <ArrowUpRight size={17} />
                  </button>
                </section>
              </div>
              <section>
                <SectionTitle
                  title={t('Recent Aircraft', '最近航機紀錄')}
                  action={
                    <button className="text-button" onClick={() => navigate('logbook')}>
                      {t('View all', '查看全部')}
                      <ArrowRight size={16} />
                    </button>
                  }
                />
                <div className="panel records-panel">
                  {active.slice(0, 5).map((a) => (
                    <AircraftCard
                      key={a.id}
                      a={a}
                      privacy={db.settings.privacy}
                      onClick={() => openAircraft(a)}
                    />
                  ))}
                  {!active.length && (
                    <Empty
                      text={t(
                        'Your first assignment starts here.',
                        '從這裡開始記錄第一項處理工作。',
                      )}
                    />
                  )}
                </div>
                <div className="home-footnote">
                  <span>
                    <MapPin size={16} />
                    Asia/Hong_Kong
                  </span>
                  <span>{t('All examples are fictional.', '所有例子均屬虛構。')}</span>
                </div>
              </section>
            </div>
          </section>
        )}
        {visited.includes('logbook') && (
          <section
            className="page-view"
            data-page="logbook"
            data-active={page === 'logbook'}
            hidden={page !== 'logbook'}
          >
            <Logbook
              db={db}
              onAircraft={openAircraft}
              onDuty={(d) => setOverlay({ type: 'dutyDetail', id: d.id })}
              onNew={() => setOverlay({ type: 'aircraft' })}
            />
          </section>
        )}
        {visited.includes('statistics') && (
          <section
            className="page-view"
            data-page="statistics"
            data-active={page === 'statistics'}
            hidden={page !== 'statistics'}
          >
            <Statistics db={db} onReport={() => setOverlay({ type: 'report' })} />
          </section>
        )}
        {visited.includes('journal') && (
          <section
            className="page-view"
            data-page="journal"
            data-active={page === 'journal'}
            hidden={page !== 'journal'}
          >
            <JournalPage
              db={db}
              onOpen={(j) => setOverlay({ type: 'journal', id: j.id })}
              onNew={() => setOverlay({ type: 'journal' })}
            />
          </section>
        )}
        {visited.includes('settings') && (
          <section
            className="page-view"
            data-page="settings"
            data-active={page === 'settings'}
            hidden={page !== 'settings'}
          >
            <Settings
              db={db}
              commit={commit}
              resetCommit={(next) => commit(next, true)}
              onBack={() => navigate('home')}
              onReport={() => setOverlay({ type: 'report' })}
              onAircraftRestore={(id) => setPending({ kind: 'aircraftRestore', id })}
            />
          </section>
        )}
        <footer className="page-footer">
          TCO Logbook{' '}
          <span className="mobile-release">
            v0.4.5 {t('Pre-release', '預發佈')} ·{' '}
            {t('Stored on this device only', '僅儲存於此裝置')} · Hong Kong · UTC+08
          </span>
        </footer>
      </main>
      <nav className="app-navigation" aria-label={t('Main navigation', '主導覽')}>
        <span className="nav-caption">{t('WORKSPACE', '工作區')}</span>
        {nav.map(({ key, en, zh, icon: Icon }) => (
          <button
            key={key}
            aria-current={page === key ? 'page' : undefined}
            className={`${page === key ? 'active' : ''} ${key === 'add' ? 'nav-add' : ''}`}
            onClick={() => navigate(key)}
          >
            <span>
              <Icon size={key === 'add' ? 25 : 21} />
            </span>
            {t(en, zh)}
          </button>
        ))}
        <div className="nav-context">
          <Plane size={20} />
          <strong>TCO Logbook</strong>
          <span className="release-version">v0.4.5 {t('Pre-release', '預發佈')}</span>
          <span>{t('Stored on this device only', '僅儲存於此裝置')}</span>
          <small>Hong Kong · UTC+08</small>
        </div>
      </nav>
      {toast && (
        <div className="toast surface-dark" role="status" key={saveSequence}>
          <Check size={17} />
          {toast}
          <button aria-label={t('Dismiss', '關閉提示')} onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {overlay?.type === 'add' && (
        <Modal
          title={t('Add to your logbook', '新增至紀錄簿')}
          onClose={closeDetail}
          closing={detailClosing}
        >
          <p className="muted">{t('What would you like to record?', '想記下甚麼？')}</p>
          {[
            {
              en: 'New Handling Record',
              zh: '新增航機處理紀錄',
              sub: t('One handling assignment', '一項航機處理任務'),
              icon: Plane,
              type: 'aircraft',
            },
            {
              en: 'Add Duties',
              zh: '新增更次',
              sub: t('Scheduled, Worked, Annual or Sick Leave', '已排更、已工作、年假或病假'),
              icon: CalendarDays,
              type: 'batchDuty',
            },
            {
              en: 'New Career Journal',
              zh: '新增職涯日誌',
              sub: t('A lesson or experience', '一份學習或經驗'),
              icon: NotebookPen,
              type: 'journal',
            },
          ].map((item) => (
            <button
              className="add-option"
              key={item.type}
              onClick={() =>
                setOverlay({ type: item.type as 'aircraft' | 'batchDuty' | 'journal' })
              }
            >
              <item.icon size={25} />
              <span>
                <strong>{t(item.en, item.zh)}</strong>
                <small>{item.sub}</small>
              </span>
              <ArrowUpRight size={20} />
            </button>
          ))}
        </Modal>
      )}
      <FullDutyCalendar
        duties={db.duties}
        open={calendarOpen && !overlay}
        onClose={() => setCalendarOpen(false)}
        onDuty={(d) => setOverlay({ type: 'dutyDetail', id: d.id })}
      />
      {overlay?.type === 'aircraft' && (
        <AircraftEditor
          key={overlay.id || `new-${overlay.dutyId || ''}`}
          db={db}
          existing={db.aircraft.find((a) => a.id === overlay.id)}
          dutyId={overlay.dutyId}
          onClose={close}
          commit={commit}
          onSaved={() => setToast(t('Saved on this device', '已儲存在此裝置'))}
        />
      )}
      {overlay?.type === 'dutyHistory' && (
        <DutyHistory
          duties={db.duties}
          onClose={close}
          onDuty={(d) => setOverlay({ type: 'dutyDetail', id: d.id })}
        />
      )}
      {overlay?.type === 'batchDuty' && <BatchDutyEditor db={db} onClose={close} commit={commit} />}
      {overlay?.type === 'duty' && (
        <DutyEditor
          db={db}
          existing={db.duties.find((d) => d.id === overlay.id)}
          onClose={close}
          commit={commit}
        />
      )}
      {overlay?.type === 'journal' && (
        <JournalEditor
          db={db}
          existing={db.journals.find((j) => j.id === overlay.id)}
          onClose={close}
          commit={commit}
        />
      )}
      {overlay?.type === 'report' && <ReportPreview db={db} onClose={close} />}
      {detail && (
        <Modal
          title={t('Handling Record', '航機處理紀錄')}
          onClose={closeDetail}
          wide
          closing={detailClosing}
        >
          {previous && (
            <button className="text-button record-back" onClick={closeDetail}>
              {previous.type === 'dutyDetail'
                ? t('Back to Duty', '返回更次')
                : t('Back to previous record', '返回上一筆紀錄')}
            </button>
          )}
          <AircraftSummary
            a={detail}
            db={db}
            onDuty={(id) => setOverlay({ type: 'dutyDetail', id })}
            onJournal={(id) => setOverlay({ type: 'journal', id })}
          />
          <div className="actions">
            <button onClick={() => setPending({ kind: 'aircraftTrash', id: detail.id })}>
              <Trash2 size={16} />
              {t('Move to Trash', '移至垃圾桶')}
            </button>
            {db.settings.privacy.registration && detail.registration && (
              <button
                onClick={() => setOverlay({ type: 'history', registration: detail.registration })}
              >
                <History size={16} />
                {t('Aircraft History', '航機歷史')}
              </button>
            )}
            <button
              className="primary"
              onClick={() => setOverlay({ type: 'aircraft', id: detail.id })}
            >
              <Pencil size={16} />
              {t('Edit Handling Record', '編輯航機處理紀錄')}
            </button>
          </div>
          <details>
            <summary>{t('Revision activity', '修改紀錄')}</summary>
            {detail.revisions.length ? (
              detail.revisions.map((r, i) => (
                <p key={i}>
                  {new Date(r.at).toLocaleString(t('en-HK', 'zh-HK'), {
                    timeZone: 'Asia/Hong_Kong',
                  })}{' '}
                  · {r.summary}
                </p>
              ))
            ) : (
              <p>{t('No revisions recorded.', '尚無修改紀錄。')}</p>
            )}
            <p className="muted">
              {t(
                'Metadata only in v0.1; no full version rollback or retention promise.',
                'v0.1 僅提供修改摘要，沒有完整版本回復或保留期保證。',
              )}
            </p>
          </details>
        </Modal>
      )}
      {duty && (
        <Modal
          title={`${t('Duty', '更次')} · ${duty.date}`}
          onClose={closeDetail}
          wide
          closing={detailClosing}
        >
          {(previous || calendarOpen) && (
            <button className="text-button record-back" onClick={close}>
              {previous
                ? t('Back to previous record', '返回上一筆紀錄')
                : t('Back to Calendar', '返回月曆')}
            </button>
          )}
          <div className="section-title">
            <Badge tone="teal">
              {l(duty.status)} · {l(duty.leave || duty.workState || 'Work state not recorded')}
              {duty.shiftType ? ` · ${l(duty.shiftType)}` : ''}
            </Badge>
            <span>
              {duty.leave === 'SL' && `${t('Original planned shift', '原定更次')} · `}
              {dutyOptionText(duty, l)} · Asia/Hong_Kong
            </span>
          </div>
          <p>{duty.notes}</p>
          <div className="actions left">
            <button
              className="primary"
              disabled={!!duty.leave}
              onClick={() => setOverlay({ type: 'aircraft', dutyId: duty.id })}
            >
              <Plus size={16} />
              {t('New Handling Record for this Duty', '新增此更次的航機處理紀錄')}
            </button>
            <button onClick={() => setOverlay({ type: 'duty', id: duty.id })}>
              {t('Edit Duty', '編輯更次')}
            </button>
            <button onClick={() => setPending({ kind: 'dutyTrash', id: duty.id })}>
              <Trash2 size={16} />
              {t('Move Duty to Trash', '將更次移至垃圾桶')}
            </button>
          </div>
          {db.aircraft
            .filter((a) => a.dutyId === duty.id && a.status !== 'Trashed')
            .map((a) => (
              <AircraftCard
                key={a.id}
                a={a}
                privacy={db.settings.privacy}
                onClick={() => openAircraft(a)}
              />
            ))}
          <SectionTitle title={t('Linked Journal', '連結日誌')} />
          {db.journals
            .filter((j) => j.dutyId === duty.id)
            .map((j) => (
              <button
                className="add-option"
                key={j.id}
                onClick={() => setOverlay({ type: 'journal', id: j.id })}
              >
                {j.title}
                <ArrowUpRight size={18} />
              </button>
            ))}
        </Modal>
      )}
      {overlay?.type === 'history' && db.settings.privacy.registration && (
        <Modal
          title={`${t('Aircraft History', '航機歷史')} · ${overlay.registration}`}
          onClose={closeDetail}
          closing={detailClosing}
          wide
        >
          <HistoryView db={db} registration={overlay.registration} onAircraft={openAircraft} />
        </Modal>
      )}
      {pending && (
        <Confirm
          title={
            pending.kind === 'aircraftRestore'
              ? t('Review Handling Record Restore', '覆核還原航機處理紀錄')
              : t('Move to Trash?', '移至垃圾桶？')
          }
          onClose={() => setPending(null)}
          onConfirm={() => {
            let next = db;
            if (pending.kind === 'dutyTrash') next = trashDuty(db, pending.id);
            else
              next = {
                ...db,
                aircraft: db.aircraft.map((a) => {
                  if (a.id !== pending.id) return a;
                  if (pending.kind === 'aircraftRestore') {
                    if (!canRestore(a.trashedAt)) return a;
                    const validDuty = db.duties.some(
                      (d) => d.id === a.dutyId && d.status !== 'Trashed',
                    );
                    return {
                      ...a,
                      status: a.previousStatus || 'Draft',
                      trashedAt: undefined,
                      dutyId: validDuty ? a.dutyId : '',
                    };
                  }
                  return {
                    ...a,
                    previousStatus: a.status,
                    status: 'Trashed',
                    trashedAt: new Date().toISOString(),
                  };
                }),
              };
            if (commit(next)) {
              setPending(null);
              close();
            }
          }}
        >
          {pending.kind === 'dutyTrash' ? (
            <>
              <p>
                {t(
                  'Aircraft and Journal records will be preserved and unlinked. Confirmed Aircraft still count. Restore is available in Settings for 30 days, with a reconnection preview.',
                  '會保留航機及日誌紀錄並解除連結；已確認航機仍計入統計。30 日內可在設定預覽並還原關聯。',
                )}
              </p>
              <p>
                {db.duties.find((d) => d.id === pending.id)?.date} ·{' '}
                {db.aircraft.filter((a) => a.dutyId === pending.id).length} Aircraft ·{' '}
                {db.journals.filter((j) => j.dutyId === pending.id).length} Journal
              </p>
            </>
          ) : (
            <>
              <AircraftSummary a={db.aircraft.find((a) => a.id === pending.id)!} db={db} />
              <p>
                {pending.kind === 'aircraftRestore'
                  ? t(
                      'Restores the previous Draft/Confirmed state. Statistics will recalculate. Trashed Duties will not be reconnected automatically.',
                      '將還原原有草稿／已確認狀態並重新計算統計，不會自動連結已刪除的更次。',
                    )
                  : t(
                      'Excluded from statistics while in Trash. Restore within 30 days in Settings.',
                      '在垃圾桶內不計統計；30 日內可在設定還原。',
                    )}
              </p>
            </>
          )}
        </Confirm>
      )}
    </div>
  );
}
function HistoryView({
  db,
  registration,
  onAircraft,
}: {
  db: Database;
  registration: string;
  onAircraft: (a: Aircraft) => void;
}) {
  const t = useT();
  const rows = db.aircraft
    .filter(
      (a) =>
        a.status !== 'Trashed' &&
        normalizeRegistration(a.registration) === normalizeRegistration(registration),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const s = stats(rows),
    confirmed = rows.filter((a) => a.status === 'Confirmed');
  return (
    <>
      <div className="mini-metrics">
        <div>
          <strong>{s.logged}</strong>
          {t('Logged', '記錄')}
        </div>
        <div>
          <strong>{s.handled}</strong>
          {t('Handled', '處理')}
        </div>
        <div>
          <strong>{s.primary}</strong>
          {t('Primary', '主要')}
        </div>
      </div>
      <p>
        {t('First / Last confirmed encounter', '首次／最近已確認接觸')}:{' '}
        {confirmed.at(-1)?.date || '—'} / {confirmed[0]?.date || '—'}
      </p>
      {rows.map((a) => (
        <AircraftCard
          key={a.id}
          a={a}
          privacy={db.settings.privacy}
          onClick={() => onAircraft(a)}
        />
      ))}
    </>
  );
}
