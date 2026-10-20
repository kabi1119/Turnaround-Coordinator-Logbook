import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Aircraft } from '../domain/model';
import { homeSummary } from '../domain/homeSummary';
import { useCalendarNow } from '../lib/useCalendarNow';
import { useT } from '../i18n';
import { SectionTitle } from '../components/ui';

export default function HomeInsights({
  records,
  onStats,
  onUnfinished,
}: {
  records: Aircraft[];
  onStats: () => void;
  onUnfinished: () => void;
}) {
  const t = useT(),
    now = useCalendarNow();
  const summary = useMemo(() => homeSummary(records, now), [records, now]);
  const noData = t('No data', '暫無資料');
  return (
    <>
      <div className="home-statistics">
        <SectionTitle
          title={t('Handling Statistics', '處理統計')}
          action={
            <button className="text-button" onClick={onStats}>
              {t('View all stats', '查看全部統計')}
              <ArrowUpRight size={16} />
            </button>
          }
        />
        <section
          className="metrics home-metrics surface-dark"
          aria-label={t('Handling summary', '處理紀錄摘要')}
        >
          <div className="metric home-insight">
            <span className="metric-label">{t('Lifetime Aircraft Handled', '累計航機處理數')}</span>
            <strong>{String(summary.lifetime).padStart(2, '0')}</strong>
            <small>{t('Confirmed · Primary + Supporting', '已確認 · 主要及支援協調')}</small>
          </div>
          <div className="metric home-insight home-insight-text">
            <span className="metric-label">
              {t('Most Frequent Airline · Last 30 Days', '最常處理航空公司 · 過去 30 天')}
            </span>
            <strong>{summary.airline?.label || noData}</strong>
            <small>
              {summary.airline
                ? `${summary.airline.count} ${t('qualifying handlings', '項合資格處理紀錄')}`
                : t('No qualifying airline data', '沒有合資格航空公司資料')}
            </small>
          </div>
          <div className="metric home-insight home-insight-text">
            <span className="metric-label">
              {t('Most Frequent Aircraft · Last 30 Days', '最常處理航機 · 過去 30 天')}
            </span>
            <strong>{summary.aircraft?.label || noData}</strong>
            <small>
              {summary.aircraft
                ? `${summary.aircraft.count} ${t('qualifying handlings', '項合資格處理紀錄')}`
                : t('No qualifying aircraft data', '沒有合資格航機資料')}
            </small>
          </div>
        </section>
      </div>
      <section
        className="panel home-unfinished surface-dark"
        aria-label={t('Unfinished Records', '未完成紀錄')}
      >
        <h2>{t('Unfinished Records', '未完成紀錄')}</h2>
        <dl className="unfinished-counts">
          <div>
            <dt>{t('Drafts', '草稿')}</dt>
            <dd>{String(summary.drafts).padStart(2, '0')}</dd>
          </div>
          <div>
            <dt>{t('Pending', '待處理')}</dt>
            <dd>{String(summary.pending).padStart(2, '0')}</dd>
          </div>
        </dl>
        {!summary.drafts && !summary.pending && (
          <p className="muted">{t('All caught up', '目前沒有未完成紀錄')}</p>
        )}
        <button className="text-button" onClick={onUnfinished}>
          {t('View unfinished records', '查看未完成紀錄')}
          <ArrowUpRight size={16} />
        </button>
      </section>
    </>
  );
}
